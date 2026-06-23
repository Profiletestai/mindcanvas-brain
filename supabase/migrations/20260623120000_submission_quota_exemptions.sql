-- =============================================================
-- Migration: Submission quota exemptions
--
-- Allowlist of orgs that bypass the per-period submission cap
-- enforced by portal.fn_reserve_submission. Intended for the
-- internal owner org and demo/test orgs that have no Stripe
-- subscription but still need unlimited submissions.
--
-- Security model:
--   - No PostgREST roles get any grant on this table.
--   - RLS enabled with zero policies => anon/authenticated cannot
--     read or write through PostgREST.
--   - service_role bypasses RLS for backend admin reads and for
--     the SECURITY DEFINER RPCs below.
--   - No HTTP endpoint reads or writes this table. Exemptions are
--     granted by ops via direct SQL only:
--       INSERT INTO portal.submission_quota_exemptions
--         (org_id, granted_by, reason)
--       VALUES ('<org-uuid>', 'ops:<name>', 'owner org / demo');
-- =============================================================

CREATE TABLE portal.submission_quota_exemptions (
  org_id     uuid PRIMARY KEY REFERENCES portal.orgs(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text,
  reason     text
);

ALTER TABLE portal.submission_quota_exemptions ENABLE ROW LEVEL SECURITY;
-- No policies; no GRANTs to anon/authenticated. service_role only.

-- -------------------------------------------------------------
-- fn_reserve_submission: skip allowance check + ledger write
-- when the caller's org is exempt. Falls through to the existing
-- entitlement-based logic otherwise.
-- -------------------------------------------------------------
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
  IF EXISTS (
    SELECT 1 FROM portal.submission_quota_exemptions WHERE org_id = p_org_id
  ) THEN
    -- Exempt orgs have no billing_account; usage_ledger.billing_account_id
    -- is NOT NULL, so skip the ledger write entirely.
    RETURN jsonb_build_object('ok', true, 'exempt', true);
  END IF;

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

-- -------------------------------------------------------------
-- fn_submission_usage: surface exempt: true to the UI so callers
-- can render "unlimited" instead of "no_subscription".
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_submission_usage(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_ent       portal.entitlements%ROWTYPE;
  v_allowance int;
  v_used      int;
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
      'period_start', NULL,
      'period_end', NULL
    );
  END IF;

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
