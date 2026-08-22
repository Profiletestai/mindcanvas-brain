-- =============================================================
-- Migration: Make submission usage recording retry-safe
--
-- portal.usage_ledger has no uniqueness on (reference_type, reference_id), so
-- fn_reserve_submission happily inserts a second row for a reference it has
-- already charged — and worse, the engine-trial branch decrements
-- engine_trial_allocations.quantity_remaining again on the way there. A retried
-- submit therefore burns two credits for one assessment.
--
-- This is not hypothetical for MCAS: the public submit route deletes and
-- re-inserts assessment_answers and upserts results by assessment_id, so the
-- whole path is designed to be re-runnable and a client retry re-enters it.
-- The existing GED path has the same exposure — it passes taker.id as the
-- reference (app/api/public/test/[token]/submit/route.ts).
--
-- Two layers:
--   1. An early EXISTS guard, so a retry is answered cheaply and returns ok.
--   2. A partial unique index plus unique_violation handlers, which is what
--      actually holds under a concurrent double-submit. The handlers sit in
--      plpgsql sub-blocks, so a lost race rolls the credit decrement back
--      instead of leaving it spent.
--
-- PREREQUISITE: query 5 in supabase/sql-snippets/mcas_portal_integration_preflight.sql
-- must return no rows. If it does, the index creation below fails — review
-- those duplicates before touching them, they are billing history.
-- =============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_ledger_submission_reference
  ON portal.usage_ledger (reference_id)
 WHERE reference_type = 'submission'
   AND event_type IN ('trial_consumed', 'engine_trial_consumed');

COMMENT ON INDEX portal.uq_usage_ledger_submission_reference IS
  'One consumption row per submission reference. Enforces fn_reserve_submission idempotency under concurrency.';

-- Body is 20260722120000_onboarding_steps_and_trials.sql with the idempotency
-- guards added. Everything else — engine resolution including the cloned/wrapper
-- meta fallback, trial-before-subscription ordering, the FOR UPDATE on the
-- entitlement — is unchanged.
CREATE OR REPLACE FUNCTION portal.fn_reserve_submission(
  p_org_id       uuid,
  p_reference_id text,
  p_test_id      uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_ent        portal.entitlements%ROWTYPE;
  v_allowance  int;
  v_used       int;
  v_engine     text;
  v_remaining  int;
  v_ba_id      uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM portal.submission_quota_exemptions WHERE org_id = p_org_id
  ) THEN
    -- Exempt orgs have no billing_account and no quota to draw down.
    RETURN jsonb_build_object('ok', true, 'exempt', true);
  END IF;

  -- ---- idempotency -------------------------------------------------
  -- Already charged for this reference: report success without spending
  -- anything again. Callers that retry (network blip, client re-submit) get a
  -- stable answer instead of a second charge.
  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM portal.usage_ledger
     WHERE reference_type = 'submission'
       AND reference_id   = p_reference_id
       AND event_type IN ('trial_consumed', 'engine_trial_consumed')
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_recorded', true);
  END IF;

  -- ---- engine trial ------------------------------------------------
  IF p_test_id IS NOT NULL THEN
    SELECT et.engine_key INTO v_engine
      FROM portal.engine_tests et
     WHERE et.test_id = p_test_id AND et.active
     LIMIT 1;

    -- Cloned/wrapper tests point at the catalogue test through meta; the
    -- engine mapping is only ever seeded against the catalogue test.
    IF v_engine IS NULL THEN
      SELECT et.engine_key INTO v_engine
        FROM portal.tests t
        JOIN portal.engine_tests et
          ON et.active
         AND et.test_id = (
               CASE
                 WHEN COALESCE(t.meta->>'source_test_id', t.meta->>'base_test_id',
                               t.meta->>'parent_test_id') ~*
                      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 THEN COALESCE(t.meta->>'source_test_id', t.meta->>'base_test_id',
                               t.meta->>'parent_test_id')::uuid
               END
             )
       WHERE t.id = p_test_id
       LIMIT 1;
    END IF;
  END IF;

  IF v_engine IS NOT NULL THEN
    -- Sub-block: if the ledger insert loses a race on the unique index, the
    -- credit decrement in the same block is rolled back with it.
    BEGIN
      -- The UPDATE ... RETURNING takes a row lock, so two concurrent
      -- submissions cannot both spend the last credit.
      UPDATE portal.engine_trial_allocations
         SET quantity_remaining = quantity_remaining - 1
       WHERE org_id          = p_org_id
         AND engine_key      = v_engine
         AND allocation_type = 'trial'
         AND quantity_remaining > 0
      RETURNING quantity_remaining INTO v_remaining;

      IF FOUND THEN
        SELECT ba.id INTO v_ba_id
          FROM portal.billing_accounts ba
         WHERE ba.org_id = p_org_id AND ba.billing_type = 'owner'
         LIMIT 1;

        INSERT INTO portal.usage_ledger (
          org_id, billing_account_id, event_type, quantity,
          reference_type, reference_id, engine_key
        ) VALUES (
          p_org_id, v_ba_id, 'engine_trial_consumed', 1,
          'submission', p_reference_id, v_engine
        );

        RETURN jsonb_build_object(
          'ok', true,
          'source', 'engine_trial',
          'engine_key', v_engine,
          'remaining', v_remaining
        );
      END IF;
    EXCEPTION
      WHEN unique_violation THEN
        -- A concurrent call recorded this reference first. The decrement above
        -- is rolled back with this sub-block, so no credit was spent.
        RETURN jsonb_build_object('ok', true, 'already_recorded', true);
    END;
  END IF;

  -- ---- subscription allowance --------------------------------------
  SELECT e.* INTO v_ent
    FROM portal.entitlements e
    JOIN portal.billing_accounts ba ON ba.id = e.billing_account_id
   WHERE e.org_id = p_org_id
     AND e.status = 'active'
     AND ba.billing_type = 'owner'
   ORDER BY e.period_start DESC
   LIMIT 1
   FOR UPDATE OF e;

  IF v_ent.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_subscription');
  END IF;

  v_allowance := v_ent.included_trials_per_month + v_ent.extra_trials_purchased;

  SELECT COALESCE(sum(quantity), 0) INTO v_used
    FROM portal.usage_ledger
   WHERE billing_account_id = v_ent.billing_account_id
     AND event_type = 'trial_consumed'
     AND created_at >= v_ent.period_start
     AND created_at <  v_ent.period_end;

  IF v_used >= v_allowance THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'limit_reached',
      'allowance', v_allowance, 'used', v_used
    );
  END IF;

  BEGIN
    INSERT INTO portal.usage_ledger (
      org_id, billing_account_id, event_type, quantity,
      reference_type, reference_id
    ) VALUES (
      p_org_id, v_ent.billing_account_id, 'trial_consumed', 1,
      'submission', p_reference_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', true, 'already_recorded', true);
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'source', 'subscription',
    'allowance', v_allowance,
    'used', v_used + 1,
    'remaining', v_allowance - v_used - 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_reserve_submission(uuid, text, uuid) TO service_role;
