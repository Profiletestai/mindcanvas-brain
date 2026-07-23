-- =============================================================
-- Migration: Onboarding steps 7-9 + per-engine trial consumption
--
-- Companion to 20260721120000_onboarding_engine_selection.sql (do not edit
-- that file). Two things happen here:
--
-- 1. The onboarding flow grows from 6 to 9 steps. Payment moves inside
--    onboarding and three acknowledge-only screens are appended:
--      1 account, 2 verify, 3 engines+plan, 4 organisation,
--      5 billing (contact + payment), 6 branding,
--      7 organisation created, 8 welcome video, 9 first test link
--    Orgs that finished the old flow sit on the old terminal value 6 and are
--    backfilled to 9 so they keep reading as complete.
--
-- 2. The trial credits granted per engine on step 3 are actually consumed.
--    portal.fn_reserve_submission now draws from
--    portal.engine_trial_allocations first and only falls through to the
--    subscription allowance when the engine has no trial left (or the test
--    maps to no engine at all). Trial draws are recorded in the existing
--    usage_ledger under a distinct event_type so the subscription quota maths
--    (event_type = 'trial_consumed') is left untouched.
-- =============================================================

-- -------------------------------------------------------
-- 1. Step range: 6 was the old terminal step, 9 is the new one.
--    Runs before anything else writes a step value.
-- -------------------------------------------------------
UPDATE portal.orgs SET last_completed_step = 9 WHERE last_completed_step = 6;

-- -------------------------------------------------------
-- 2. usage_ledger carries engine trial draws
-- -------------------------------------------------------
-- An engine trial can be consumed before Stripe has created a billing account
-- (the org is activated by the webhook, trials are granted at org creation).
ALTER TABLE portal.usage_ledger
  ALTER COLUMN billing_account_id DROP NOT NULL;

-- The original check was declared inline, so its name is whatever Postgres
-- generated. Drop it by what it constrains rather than by an assumed name —
-- a missed drop would silently keep rejecting the new event type.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class     cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns  ON ns.oid  = cls.relnamespace
     WHERE ns.nspname = 'portal'
       AND cls.relname = 'usage_ledger'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%trial_consumed%'
  LOOP
    EXECUTE format('ALTER TABLE portal.usage_ledger DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE portal.usage_ledger
  ADD CONSTRAINT usage_ledger_event_type_check
  CHECK (event_type IN (
    'trial_consumed',
    'extra_trials_purchased',
    'period_reset',
    'engine_trial_consumed'
  ));

ALTER TABLE portal.usage_ledger
  ADD COLUMN IF NOT EXISTS engine_key text REFERENCES portal.engines(key);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_engine
  ON portal.usage_ledger (org_id, engine_key)
  WHERE event_type = 'engine_trial_consumed';

-- -------------------------------------------------------
-- 3. fn_reserve_submission: engine trial first, subscription second
-- -------------------------------------------------------
-- The old two-argument signature is dropped so the new default-argument form
-- is unambiguous; two-argument callers keep working through the default.
DROP FUNCTION IF EXISTS portal.fn_reserve_submission(uuid, text);

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
  END IF;

  -- ---- subscription allowance (unchanged) --------------------------
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

  INSERT INTO portal.usage_ledger (
    org_id, billing_account_id, event_type, quantity,
    reference_type, reference_id
  ) VALUES (
    p_org_id, v_ent.billing_account_id, 'trial_consumed', 1,
    'submission', p_reference_id
  );

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

-- -------------------------------------------------------
-- 4. Per-engine trial summary (confirmation screen + usage page)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_engine_trial_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = portal
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'engines', COALESCE(jsonb_agg(
      jsonb_build_object(
        'engine_key',   a.engine_key,
        'product_code', a.product_code,
        'display_name', e.display_name,
        'allocated',    a.quantity_allocated,
        'remaining',    a.quantity_remaining
      )
      ORDER BY CASE a.engine_key
                 WHEN 'sales' THEN 1 WHEN 'coaching' THEN 2 ELSE 3 END
    ), '[]'::jsonb),
    'total_allocated', COALESCE(sum(a.quantity_allocated), 0),
    'total_remaining', COALESCE(sum(a.quantity_remaining), 0)
  )
    FROM portal.engine_trial_allocations a
    JOIN portal.engines e ON e.key = a.engine_key
   WHERE a.org_id = p_org_id
     AND a.allocation_type = 'trial';
$$;

GRANT EXECUTE ON FUNCTION portal.fn_engine_trial_summary(uuid) TO service_role;

-- -------------------------------------------------------
-- 5. Seed portal.engine_tests
-- -------------------------------------------------------
-- Matched by slug because test ids differ per environment. Only the Sales
-- engine has a live product today: the Coaching (MPS) and People (MCAS)
-- assessments do not exist as portal.tests rows yet. Until they are created
-- and mapped here, those engines fall back to tier-only test access
-- (see fn_sync_org_test_access) and their trial credits cannot be spent.
INSERT INTO portal.engine_tests (engine_key, test_id)
SELECT 'sales', t.id
  FROM portal.tests t
 WHERE t.slug = 'growth-engine-diagnostic'
   AND t.status = 'active'
ON CONFLICT DO NOTHING;
