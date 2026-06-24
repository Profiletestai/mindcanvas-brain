-- =============================================================
-- Migration: Main Account Billing (Stripe Checkout v1)
-- - Adds past_due to orgs.status
-- - Adds past_due_since column to billing_accounts
-- - RPC fn_apply_billing_event (Stripe webhook → local state)
-- - RPC fn_sweep_past_due_to_suspended (7d grace backstop)
--
-- NOTE: tier_definitions + tier_prices are operator-seeded (ops
-- migration with real Stripe price IDs). This migration assumes
-- those rows exist before any Stripe webhook fires.
-- =============================================================

-- 1. Allow past_due on orgs.status
ALTER TABLE portal.orgs DROP CONSTRAINT IF EXISTS orgs_status_check;
ALTER TABLE portal.orgs
  ADD CONSTRAINT orgs_status_check
    CHECK (status IN ('pending_activation','active','past_due','suspended','archived'));

-- 2. Past-due tracking on billing_accounts
ALTER TABLE portal.billing_accounts
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;

-- 3. RPC: idempotent Stripe-event → local-state applier.
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
    UPDATE portal.entitlements
       SET status = 'active',
           period_start = COALESCE(p_period_start, period_start),
           period_end   = COALESCE(p_period_end, period_end)
     WHERE billing_account_id = v_billing_id AND status <> 'archived';

    IF NOT EXISTS (SELECT 1 FROM portal.entitlements WHERE billing_account_id = v_billing_id) THEN
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

-- 4. RPC: 7-day past_due → suspended sweeper (backstop for Stripe Smart Retries)
CREATE OR REPLACE FUNCTION portal.fn_sweep_past_due_to_suspended(p_grace_days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE v_count int;
BEGIN
  WITH expired AS (
    SELECT ba.org_id
      FROM portal.billing_accounts ba
     WHERE ba.stripe_status = 'past_due'
       AND ba.past_due_since IS NOT NULL
       AND ba.past_due_since < now() - make_interval(days => p_grace_days)
  ), updated AS (
    UPDATE portal.orgs o SET status = 'suspended'
      FROM expired e
     WHERE o.id = e.org_id AND o.status = 'past_due'
     RETURNING o.id
  ), history AS (
    INSERT INTO portal.org_status_history (org_id, status, reason)
      SELECT id, 'suspended', 'grace_period_expired' FROM updated
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_sweep_past_due_to_suspended(int) TO service_role;
