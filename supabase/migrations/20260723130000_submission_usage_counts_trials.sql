-- Make fn_submission_usage aware of per-engine trial credits.
--
-- fn_reserve_submission spends a per-engine trial credit (engine_trial_allocations)
-- BEFORE the monthly subscription allowance. But fn_submission_usage — read by the
-- org-wide gate that blocks opening/starting a public test — only looked at the
-- subscription entitlement. An org that skipped payment has no entitlement but does
-- have trial credits, so the gate returned no_subscription / remaining 0 and blocked
-- the test with "Submission limit reached for your plan" before a credit could ever
-- be spent.
--
-- Fix: also surface the org's remaining trial credits as an additive `trial_remaining`
-- field. Existing fields (allowance/used/remaining) stay subscription-only so the
-- portal usage page keeps showing the monthly quota and the trials strip separately;
-- the public gate now treats trial credits as available submissions.

CREATE OR REPLACE FUNCTION portal.fn_submission_usage(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_ent             portal.entitlements%ROWTYPE;
  v_allowance       int;
  v_used            int;
  v_trial_remaining int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM portal.submission_quota_exemptions WHERE org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'exempt', true,
      'allowance', NULL,
      'used', 0,
      'remaining', NULL,
      'trial_remaining', NULL,
      'period_start', NULL,
      'period_end', NULL
    );
  END IF;

  SELECT COALESCE(sum(quantity_remaining), 0) INTO v_trial_remaining
    FROM portal.engine_trial_allocations
   WHERE org_id = p_org_id
     AND allocation_type = 'trial';

  SELECT e.* INTO v_ent
    FROM portal.entitlements e
    JOIN portal.billing_accounts ba ON ba.id = e.billing_account_id
   WHERE e.org_id = p_org_id
     AND e.status = 'active'
     AND ba.billing_type = 'owner'
   ORDER BY e.period_start DESC
   LIMIT 1;

  IF v_ent.id IS NULL THEN
    -- No subscription, but trial credits may still cover submissions.
    RETURN jsonb_build_object(
      'ok', v_trial_remaining > 0,
      'reason', CASE WHEN v_trial_remaining > 0 THEN NULL ELSE 'no_subscription' END,
      'allowance', 0, 'used', 0, 'remaining', 0,
      'trial_remaining', v_trial_remaining,
      'period_start', NULL, 'period_end', NULL
    );
  END IF;

  v_allowance := v_ent.included_trials_per_month + v_ent.extra_trials_purchased;

  SELECT COALESCE(sum(quantity), 0) INTO v_used
    FROM portal.usage_ledger
   WHERE billing_account_id = v_ent.billing_account_id
     AND event_type = 'trial_consumed'
     AND created_at >= v_ent.period_start
     AND created_at <  v_ent.period_end;

  RETURN jsonb_build_object(
    'ok', true,
    'allowance', v_allowance,
    'used', v_used,
    'remaining', greatest(v_allowance - v_used, 0),
    'trial_remaining', v_trial_remaining,
    'period_start', v_ent.period_start,
    'period_end', v_ent.period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_submission_usage(uuid) TO service_role;
