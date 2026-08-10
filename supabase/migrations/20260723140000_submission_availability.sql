-- fn_submission_availability: can this org submit THIS test right now?
--
-- A read-only mirror of fn_reserve_submission's decision, without consuming a
-- credit. fn_reserve_submission spends a per-engine trial credit (scoped to the
-- test's engine) before the monthly subscription allowance, so availability is
-- per-test: an org may still have trial credits for engine A while engine B is
-- exhausted.
--
-- The org-wide gate (fn_submission_usage) can't see this — it sums trial credits
-- across all engines — so opening a test whose engine is exhausted looked fine
-- until submit failed. This function lets the open/start gates block up front for
-- the specific test the taker is about to answer.

CREATE OR REPLACE FUNCTION portal.fn_submission_availability(
  p_org_id  uuid,
  p_test_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_engine     text;
  v_trial      int := 0;
  v_ent        portal.entitlements%ROWTYPE;
  v_allowance  int;
  v_used       int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM portal.submission_quota_exemptions WHERE org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'available', true, 'exempt', true);
  END IF;

  -- Engine for this test (same resolution as fn_reserve_submission, including
  -- the cloned/wrapper-test meta fallback to the catalogue test).
  IF p_test_id IS NOT NULL THEN
    SELECT et.engine_key INTO v_engine
      FROM portal.engine_tests et
     WHERE et.test_id = p_test_id AND et.active
     LIMIT 1;

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

  -- Trial credits for this test's engine are spent first.
  IF v_engine IS NOT NULL THEN
    SELECT COALESCE(sum(quantity_remaining), 0) INTO v_trial
      FROM portal.engine_trial_allocations
     WHERE org_id          = p_org_id
       AND engine_key      = v_engine
       AND allocation_type = 'trial';

    IF v_trial > 0 THEN
      RETURN jsonb_build_object(
        'ok', true, 'available', true,
        'source', 'engine_trial', 'engine_key', v_engine, 'trial_remaining', v_trial
      );
    END IF;
  END IF;

  -- Fall back to the monthly subscription allowance.
  SELECT e.* INTO v_ent
    FROM portal.entitlements e
    JOIN portal.billing_accounts ba ON ba.id = e.billing_account_id
   WHERE e.org_id = p_org_id
     AND e.status = 'active'
     AND ba.billing_type = 'owner'
   ORDER BY e.period_start DESC
   LIMIT 1;

  IF v_ent.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'available', false,
      'reason', CASE WHEN v_engine IS NOT NULL THEN 'limit_reached' ELSE 'no_subscription' END,
      'engine_key', v_engine, 'trial_remaining', v_trial
    );
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
      'ok', false, 'available', false, 'reason', 'limit_reached',
      'allowance', v_allowance, 'used', v_used, 'remaining', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'available', true, 'source', 'subscription',
    'allowance', v_allowance, 'used', v_used, 'remaining', v_allowance - v_used
  );
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_submission_availability(uuid, uuid) TO service_role;
