-- =============================================================
-- Migration: Submission Quota Enforcement
-- - RPC fn_reserve_submission: atomically reserve one submission
--   slot against the org's active entitlement for the current
--   billing period (writes portal.usage_ledger). Blocks when no
--   active subscription or the per-period cap is reached.
-- - RPC fn_submission_usage: read-only allowance/used/remaining
--   for UI display.
--
-- Quota = entitlements.included_trials_per_month + extra_trials_purchased
-- Period = entitlements.period_start .. period_end (Stripe billing period)
-- =============================================================

-- 1. RPC: atomic reserve-one-slot.
CREATE OR REPLACE FUNCTION portal.fn_reserve_submission(
  p_org_id       uuid,
  p_reference_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_ent        portal.entitlements%ROWTYPE;
  v_allowance  int;
  v_used       int;
BEGIN
  -- Active entitlement for the org's owner billing account, locked to
  -- serialize concurrent submissions for the same org.
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
    'allowance', v_allowance,
    'used', v_used + 1,
    'remaining', v_allowance - v_used - 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_reserve_submission(uuid, text) TO service_role;

-- 2. RPC: read-only usage for UI display.
CREATE OR REPLACE FUNCTION portal.fn_submission_usage(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_ent       portal.entitlements%ROWTYPE;
  v_allowance int;
  v_used      int;
BEGIN
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
      'ok', false, 'reason', 'no_subscription',
      'allowance', 0, 'used', 0, 'remaining', 0,
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
    'period_start', v_ent.period_start,
    'period_end', v_ent.period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_submission_usage(uuid) TO service_role;
