-- =============================================================
-- Migration: Lead-Generation Pilot Onboarding
-- - billing_accounts: allow tier 0 (pilot sentinel)
-- - orgs: account_type convenience flag
-- - RPC fn_activate_pilot         (create billing_account + entitlement)
-- - RPC fn_sweep_expired_pilots   (suspend after grace window)
-- - fn_apply_billing_event extended for pilot -> paid migration
--
-- Source of truth for "is this a pilot" is the active tier-0 entitlement, not
-- a denormalised flag. The pilot window lives entirely in the entitlement:
--   period_start = activation, period_end = pilot_end + 48h grace.
-- Pilot accounts are also marked with billing_accounts.stripe_status = 'pilot'
-- (an existing column) which keeps them out of the active-subscription unique
-- index and flips to 'active' automatically on conversion.
--
-- NOTE: the pilot tier_definition (tier = 0) and its plan_test_access row
-- (pilot tier -> GED test) are operator-seeded in a separate ops migration.
-- fn_activate_pilot resolves the tier-0 definition at runtime and will raise
-- 'pilot_tier_definition_missing' if it has not been seeded yet.
-- =============================================================

-- -------------------------------------------------------
-- A. billing_accounts: allow tier 0 (pilot)
-- -------------------------------------------------------
ALTER TABLE portal.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_tier_check;
ALTER TABLE portal.billing_accounts
  ADD CONSTRAINT billing_accounts_tier_check CHECK (tier BETWEEN 0 AND 4);

-- -------------------------------------------------------
-- B. orgs: convenience flag (provenance; NOT the runtime pilot signal)
-- -------------------------------------------------------
ALTER TABLE portal.orgs
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'standard'
    CHECK (account_type IN ('standard','pilot'));

-- Sweeper lookup: active pilot entitlements by grace boundary.
CREATE INDEX IF NOT EXISTS idx_entitlements_pilot_sweep
  ON portal.entitlements (period_end)
  WHERE tier = 0 AND status = 'active';

-- -------------------------------------------------------
-- C. RPC: pilot activation (billing_account + entitlement, atomic)
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

  -- Create the pilot entitlement: 13 trials over the pilot window + grace.
  -- This is the source of truth for pilot status (tier = 0) and the window.
  -- Trigger trg_entitlements_sync_test_access grants the GED test (the only
  -- plan_test_access row mapped to the pilot tier).
  INSERT INTO portal.entitlements
    (org_id, billing_account_id, tier, tier_definition_id,
     included_trials_per_month, extra_trials_purchased, extra_trials_cap,
     extra_trial_unit_price_in_cents, status, period_start, period_end)
  VALUES
    (p_org_id, v_billing_id, 0, v_tier_def,
     13, 0, 0, 0, 'active', now(), v_period_end)
  ON CONFLICT DO NOTHING;

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

-- -------------------------------------------------------
-- D. RPC: sweep pilots past the grace window without a paid subscription.
--    The grace boundary is already baked into entitlements.period_end
--    (pilot_end + 48h), so no extra interval arithmetic is needed.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_sweep_expired_pilots()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE v_count int;
BEGIN
  WITH expired AS (
    SELECT e.org_id
      FROM portal.entitlements e
      JOIN portal.billing_accounts ba ON ba.id = e.billing_account_id
     WHERE e.tier = 0
       AND e.status = 'active'
       AND e.period_end < now()
       AND (ba.stripe_status IS NULL
            OR ba.stripe_status NOT IN ('active','trialing'))
  ), suspended_orgs AS (
    UPDATE portal.orgs o SET status = 'suspended'
      FROM expired e
     WHERE o.id = e.org_id AND o.status NOT IN ('suspended','archived')
     RETURNING o.id
  ), entitlements_off AS (
    UPDATE portal.entitlements en SET status = 'suspended'
      FROM suspended_orgs s
     WHERE en.org_id = s.id AND en.status = 'active'
     RETURNING 1
  ), history AS (
    INSERT INTO portal.org_status_history (org_id, status, reason)
      SELECT id, 'suspended', 'pilot_grace_expired' FROM suspended_orgs
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM suspended_orgs;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_sweep_expired_pilots() TO service_role;

-- -------------------------------------------------------
-- E. fn_apply_billing_event: migrate pilot -> paid on first active sub
--    (replaces the function body from 20260603120000_billing_main_account.sql)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_apply_billing_event(
  p_event_id          text,
  p_event_type        text,
  p_org_id            uuid,
  p_stripe_customer   text,
  p_stripe_sub_id     text,
  p_stripe_status     text,
  p_period_start      timestamptz,
  p_period_end        timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_billing_id   uuid;
  v_current_org  text;
  v_next_org     text;
  v_inserted     int;
  v_was_pilot    boolean;
BEGIN
  -- Idempotency guard
  IF EXISTS (SELECT 1 FROM portal.stripe_events
              WHERE stripe_event_id = p_event_id AND status = 'ok' AND processed_at IS NOT NULL) THEN
    RETURN 'already_processed';
  END IF;

  UPDATE portal.billing_accounts
     SET stripe_customer_id     = COALESCE(p_stripe_customer, stripe_customer_id),
         stripe_subscription_id = COALESCE(p_stripe_sub_id, stripe_subscription_id),
         stripe_status          = COALESCE(p_stripe_status, stripe_status),
         period_start           = COALESCE(p_period_start, period_start),
         period_end             = COALESCE(p_period_end, period_end),
         past_due_since         = CASE WHEN p_stripe_status = 'past_due' AND past_due_since IS NULL
                                       THEN now()
                                       WHEN p_stripe_status = 'active' THEN NULL
                                       ELSE past_due_since END
   WHERE org_id = p_org_id AND billing_type = 'owner'
   RETURNING id INTO v_billing_id;

  IF v_billing_id IS NULL THEN
    RAISE EXCEPTION 'billing_account_not_found_for_org_%', p_org_id;
  END IF;

  SELECT status INTO v_current_org FROM portal.orgs WHERE id = p_org_id;

  v_next_org := CASE
    WHEN p_stripe_status = 'active'   THEN 'active'
    WHEN p_stripe_status = 'past_due' THEN 'past_due'
    WHEN p_stripe_status IN ('canceled','unpaid') THEN 'suspended'
    ELSE v_current_org
  END;

  IF v_next_org IS DISTINCT FROM v_current_org THEN
    UPDATE portal.orgs SET status = v_next_org WHERE id = p_org_id;
    INSERT INTO portal.org_status_history (org_id, status, reason)
    VALUES (p_org_id, v_next_org, format('stripe:%s', p_event_type));
  END IF;

  IF p_stripe_status = 'active' THEN
    -- Pilot -> paid migration: a live tier-0 entitlement means this account is
    -- still on the pilot. Archive it so the standard creation path below builds
    -- a fresh entitlement against the chosen paid tier (checkout already set
    -- ba.tier). stripe_status was flipped pilot -> active by the UPDATE above.
    SELECT EXISTS (
      SELECT 1 FROM portal.entitlements
       WHERE billing_account_id = v_billing_id
         AND status <> 'archived'
         AND tier = 0
    ) INTO v_was_pilot;

    IF v_was_pilot THEN
      UPDATE portal.entitlements
         SET status = 'archived'
       WHERE billing_account_id = v_billing_id AND status <> 'archived';
    END IF;

    UPDATE portal.entitlements
       SET status = 'active',
           period_start = COALESCE(p_period_start, period_start),
           period_end   = COALESCE(p_period_end, period_end)
     WHERE billing_account_id = v_billing_id AND status <> 'archived';

    -- Create a fresh entitlement when none is active (first paid sub, or the
    -- pilot entitlement was just archived above).
    IF NOT EXISTS (SELECT 1 FROM portal.entitlements
                    WHERE billing_account_id = v_billing_id AND status <> 'archived') THEN
      WITH ins AS (
        INSERT INTO portal.entitlements (org_id, billing_account_id, tier, included_trials_per_month,
                                         extra_trials_cap, extra_trial_unit_price_in_cents, status,
                                         period_start, period_end, tier_definition_id)
        SELECT p_org_id, v_billing_id, td.tier, td.included_trials_per_month,
               td.extra_trials_cap, td.extra_trial_unit_price_cents, 'active',
               COALESCE(p_period_start, now()),
               COALESCE(p_period_end, now() + interval '30 days'),
               td.id
          FROM portal.billing_accounts ba
          JOIN portal.tier_definitions td
            ON td.tier = ba.tier AND td.valid_until IS NULL
         WHERE ba.id = v_billing_id
         LIMIT 1
        RETURNING 1
      )
      SELECT count(*) INTO v_inserted FROM ins;

      IF v_inserted = 0 THEN
        RAISE EXCEPTION 'tier_definitions_missing_for_billing_account_%', v_billing_id
          USING HINT = 'Seed portal.tier_definitions (with matching tier and valid_until IS NULL) before processing Stripe events.';
      END IF;
    END IF;
  ELSIF p_stripe_status IN ('canceled','unpaid') THEN
    UPDATE portal.entitlements
       SET status = 'suspended'
     WHERE billing_account_id = v_billing_id AND status = 'active';
  END IF;

  RETURN v_next_org;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_apply_billing_event(
  text, text, uuid, text, text, text, timestamptz, timestamptz
) TO service_role;
