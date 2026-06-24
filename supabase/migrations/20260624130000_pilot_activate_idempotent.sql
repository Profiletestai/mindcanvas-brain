-- =============================================================
-- Migration: make pilot activation truly idempotent
--
-- fn_activate_pilot used `ON CONFLICT DO NOTHING` on the entitlement insert,
-- but the only unique constraint (uq_entitlement_period on
-- (billing_account_id, period_start)) can never collide because period_start
-- is set to now() on every call. The conflict guard was therefore a no-op:
-- each call (e.g. a reload of the pilot welcome page, which POSTs activate on
-- mount) stacked another active tier-0 entitlement on the same billing account.
--
-- Fix: a partial unique index enforcing at most one active tier-0 entitlement
-- per billing account, and a real ON CONFLICT target in fn_activate_pilot that
-- refreshes the pilot window instead of inserting a duplicate.
--
-- NOTE: pre-existing duplicate active tier-0 entitlements must be cleaned up
-- manually before this migration runs, otherwise the unique index creation
-- will fail.
-- =============================================================

-- -------------------------------------------------------
-- A. At most one active pilot entitlement per billing account.
-- -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_entitlement_active_pilot
  ON portal.entitlements (billing_account_id)
  WHERE tier = 0 AND status = 'active';

-- -------------------------------------------------------
-- B. fn_activate_pilot: use the partial unique index as the conflict target
--    and refresh the window on re-run instead of duplicating.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_activate_pilot(
  p_org_id        uuid,
  p_pilot_end     timestamptz,
  p_grace_hours   int DEFAULT 48
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_billing_id uuid;
  v_tier_def   uuid;
  v_period_end timestamptz := p_pilot_end + make_interval(hours => p_grace_hours);
BEGIN
  -- Resolve current pilot tier_definition (tier = 0, still open).
  SELECT id INTO v_tier_def
    FROM portal.tier_definitions
   WHERE tier = 0 AND valid_until IS NULL
   ORDER BY created_at DESC, id DESC
   LIMIT 1;
  IF v_tier_def IS NULL THEN
    RAISE EXCEPTION 'pilot_tier_definition_missing'
      USING HINT = 'Seed portal.tier_definitions (tier = 0, valid_until IS NULL) before activating pilots.';
  END IF;

  -- Idempotency: reuse the org's owner billing_account if it exists.
  SELECT id INTO v_billing_id
    FROM portal.billing_accounts
   WHERE org_id = p_org_id AND billing_type = 'owner';

  IF v_billing_id IS NULL THEN
    INSERT INTO portal.billing_accounts
      (org_id, billing_type, tier, stripe_status, period_start, period_end)
    VALUES
      (p_org_id, 'owner', 0, 'pilot', now(), v_period_end)
    RETURNING id INTO v_billing_id;
  ELSE
    UPDATE portal.billing_accounts
       SET tier          = 0,
           stripe_status = 'pilot',
           period_start  = COALESCE(period_start, now()),
           period_end    = v_period_end
     WHERE id = v_billing_id;
  END IF;

  -- Create (or refresh) the pilot entitlement: 13 trials over the pilot window
  -- + grace. Source of truth for pilot status (tier = 0) and the window. The
  -- partial unique index uq_entitlement_active_pilot guarantees at most one
  -- active tier-0 entitlement per billing account, so a re-run (e.g. reloaded
  -- welcome page) refreshes the window instead of stacking duplicates.
  -- Trigger trg_entitlements_sync_test_access grants the GED test.
  INSERT INTO portal.entitlements
    (org_id, billing_account_id, tier, tier_definition_id,
     included_trials_per_month, extra_trials_purchased, extra_trials_cap,
     extra_trial_unit_price_in_cents, status, period_start, period_end)
  VALUES
    (p_org_id, v_billing_id, 0, v_tier_def,
     13, 0, 0, 0, 'active', now(), v_period_end)
  ON CONFLICT (billing_account_id) WHERE (tier = 0 AND status = 'active')
  DO UPDATE SET period_end = EXCLUDED.period_end;

  -- Activate org + mark as pilot (provenance flag).
  UPDATE portal.orgs
     SET status = 'active', account_type = 'pilot'
   WHERE id = p_org_id;

  INSERT INTO portal.org_status_history (org_id, status, reason)
  VALUES (p_org_id, 'active', 'pilot_activated');

  RETURN v_billing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_activate_pilot(uuid, timestamptz, int) TO service_role;
