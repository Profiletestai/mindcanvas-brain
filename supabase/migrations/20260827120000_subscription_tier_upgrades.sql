-- =============================================================
-- Subscription tier upgrades
--
-- Adds billing-sourced engine access and a tier-aware wrapper around
-- fn_apply_billing_event. The Stripe webhook supplies the confirmed
-- subscription Price ID; the database maps that price to the canonical
-- tier definition and updates billing, entitlement and engine access
-- atomically.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Allow engine access granted by a paid subscription
-- -------------------------------------------------------------
ALTER TABLE portal.org_engines
  DROP CONSTRAINT IF EXISTS org_engines_source_check;

ALTER TABLE portal.org_engines
  ADD CONSTRAINT org_engines_source_check
  CHECK (source IN ('onboarding', 'manual', 'billing'));

-- -------------------------------------------------------------
-- 2. Synchronise the engine catalogue from a paid tier
--
-- Tier 1: Sales
-- Tier 2: Sales + Coaching
-- Tier 3+: Sales + Coaching + People
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_sync_org_engines_for_tier(
  p_org_id uuid,
  p_tier int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal
AS $$
DECLARE
  v_engine_keys text[];
BEGIN
  IF p_tier < 1 OR p_tier > 4 THEN
    RAISE EXCEPTION 'invalid_paid_tier_%', p_tier;
  END IF;

  v_engine_keys := CASE
    WHEN p_tier = 1 THEN ARRAY['sales']::text[]
    WHEN p_tier = 2 THEN ARRAY['sales', 'coaching']::text[]
    ELSE ARRAY['sales', 'coaching', 'people']::text[]
  END;

  PERFORM pg_advisory_xact_lock(
    hashtext('portal.org_engines:' || p_org_id::text)
  );

  INSERT INTO portal.org_engines (
    org_id,
    engine_key,
    status,
    source
  )
  SELECT
    p_org_id,
    desired.engine_key,
    'active',
    'billing'
  FROM unnest(v_engine_keys) AS desired(engine_key)
  ON CONFLICT (org_id, engine_key)
  DO UPDATE
     SET status = 'active',
         source = CASE
           WHEN portal.org_engines.source = 'manual'
             THEN portal.org_engines.source
           ELSE 'billing'
         END;

  UPDATE portal.org_engines
     SET status = 'revoked'
   WHERE org_id = p_org_id
     AND source = 'billing'
     AND status = 'active'
     AND NOT (engine_key = ANY(v_engine_keys));
END;
$$;

GRANT EXECUTE ON FUNCTION
  portal.fn_sync_org_engines_for_tier(uuid, int)
TO service_role;

-- -------------------------------------------------------------
-- 3. Apply a billing event and synchronise its confirmed tier
--
-- The existing fn_apply_billing_event remains intact for rolling
-- deployment safety. The webhook will move to this v2 wrapper.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_apply_billing_event_v2(
  p_event_id          text,
  p_event_type        text,
  p_org_id            uuid,
  p_stripe_customer   text,
  p_stripe_sub_id     text,
  p_stripe_status     text,
  p_period_start      timestamptz,
  p_period_end        timestamptz,
  p_stripe_price_id   text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal
AS $$
DECLARE
  v_result             text;
  v_billing_id         uuid;
  v_target_tier        int;
  v_tier_definition_id uuid;
  v_interval           text;
  v_included           int;
  v_extra_cap          int;
  v_extra_unit_price   int;
BEGIN
  -- Preserve all existing subscription status, period, pilot migration
  -- and organisation status behaviour.
  v_result := portal.fn_apply_billing_event(
    p_event_id,
    p_event_type,
    p_org_id,
    p_stripe_customer,
    p_stripe_sub_id,
    p_stripe_status,
    p_period_start,
    p_period_end
  );

  -- A Price ID is authoritative only for an active paid subscription.
  IF p_stripe_status <> 'active'
     OR p_stripe_price_id IS NULL
     OR btrim(p_stripe_price_id) = '' THEN
    RETURN v_result;
  END IF;

  SELECT
    td.tier,
    td.id,
    tp.interval,
    td.included_trials_per_month,
    td.extra_trials_cap,
    td.extra_trial_unit_price_cents
  INTO
    v_target_tier,
    v_tier_definition_id,
    v_interval,
    v_included,
    v_extra_cap,
    v_extra_unit_price
  FROM portal.tier_prices tp
  JOIN portal.tier_definitions td
    ON td.id = tp.tier_definition_id
  WHERE tp.stripe_price_id = p_stripe_price_id
    AND tp.billing_type = 'owner'
    AND tp.active = true
    AND td.valid_until IS NULL
  LIMIT 1;

  IF v_target_tier IS NULL
     OR v_target_tier < 1
     OR v_target_tier > 4 THEN
    RAISE EXCEPTION
      'active_owner_tier_not_found_for_stripe_price_%',
      p_stripe_price_id;
  END IF;

  UPDATE portal.billing_accounts
     SET tier = v_target_tier,
         billing_interval = v_interval
   WHERE org_id = p_org_id
     AND billing_type = 'owner'
   RETURNING id INTO v_billing_id;

  IF v_billing_id IS NULL THEN
    RAISE EXCEPTION
      'billing_account_not_found_for_org_%',
      p_org_id;
  END IF;

  UPDATE portal.entitlements
     SET tier = v_target_tier,
         tier_definition_id = v_tier_definition_id,
         included_trials_per_month = v_included,
         extra_trials_cap = v_extra_cap,
         extra_trial_unit_price_in_cents = v_extra_unit_price,
         status = 'active',
         period_start = COALESCE(
           p_period_start,
           period_start
         ),
         period_end = COALESCE(
           p_period_end,
           period_end
         )
   WHERE billing_account_id = v_billing_id
     AND status <> 'archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'active_entitlement_not_found_for_billing_account_%',
      v_billing_id;
  END IF;

  UPDATE portal.orgs
     SET selected_tier = v_target_tier
   WHERE id = p_org_id;

  PERFORM portal.fn_sync_org_engines_for_tier(
    p_org_id,
    v_target_tier
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION
  portal.fn_apply_billing_event_v2(
    text,
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
TO service_role;