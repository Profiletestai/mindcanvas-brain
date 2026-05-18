-- =============================================================
-- Migration: Sub-Account Management v1
-- Adds parent-admin / owner-contact metadata to portal.org_relationships
-- and provides RPCs to create + transition child org status.
-- =============================================================

-- 1. Extend portal.org_relationships with sub-account metadata
ALTER TABLE portal.org_relationships
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payer_mode         text
    CHECK (payer_mode IN ('parent_paid','self_paid')),
  ADD COLUMN IF NOT EXISTS owner_first_name   text,
  ADD COLUMN IF NOT EXISTS owner_last_name    text,
  ADD COLUMN IF NOT EXISTS owner_email        text,
  ADD COLUMN IF NOT EXISTS owner_phone        text;

-- 2. Defensive seed of tier=1 definition for v1 (only if missing)
INSERT INTO portal.tier_definitions (tier, version, included_trials_per_month,
                                     extra_trial_unit_price_cents, extra_trials_cap, valid_from)
SELECT 1, 1, 0, 0, NULL, now()
WHERE NOT EXISTS (
  SELECT 1 FROM portal.tier_definitions WHERE tier = 1 AND valid_until IS NULL
);

-- 3. RPC: portal.fn_create_sub_org
CREATE OR REPLACE FUNCTION portal.fn_create_sub_org(
  p_caller_user_id    uuid,
  p_parent_org_id     uuid,
  p_child_name        text,
  p_child_slug        text,
  p_country_code      text,
  p_website           text,
  p_industry          text,
  p_payer_mode        text,
  p_tier              int,
  p_owner_first_name  text,
  p_owner_last_name   text,
  p_owner_email       text,
  p_owner_phone       text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_parent_status      text;
  v_child_id           uuid;
  v_child_status       text;
  v_tier_def           portal.tier_definitions%ROWTYPE;
  v_billing_id         uuid;
  v_billing_type       text;
  v_entitlement_status text;
  v_period_start       timestamptz := date_trunc('month', now());
  v_period_end         timestamptz := date_trunc('month', now()) + interval '1 month';
BEGIN
  -- Validate parent
  SELECT status INTO v_parent_status FROM portal.orgs WHERE id = p_parent_org_id;
  IF v_parent_status IS NULL THEN
    RAISE EXCEPTION 'parent_not_found';
  END IF;
  IF v_parent_status = 'archived' THEN
    RAISE EXCEPTION 'parent_archived';
  END IF;

  -- Validate tier (v1: only tier 1)
  IF p_tier IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'tier_unavailable';
  END IF;
  SELECT * INTO v_tier_def
    FROM portal.tier_definitions
   WHERE tier = p_tier AND valid_until IS NULL
   ORDER BY version DESC
   LIMIT 1;
  IF v_tier_def.id IS NULL THEN
    RAISE EXCEPTION 'tier_unavailable';
  END IF;

  -- Derive child status + billing/entitlement shape from payer_mode
  v_child_status := CASE p_payer_mode
    WHEN 'parent_paid' THEN 'active'
    WHEN 'self_paid'   THEN 'pending_activation'
    ELSE NULL
  END;
  IF v_child_status IS NULL THEN
    RAISE EXCEPTION 'invalid_payer_mode';
  END IF;
  v_billing_type := CASE p_payer_mode
    WHEN 'parent_paid' THEN 'licensee'
    WHEN 'self_paid'   THEN 'owner'
  END;
  v_entitlement_status := CASE p_payer_mode
    WHEN 'parent_paid' THEN 'active'
    WHEN 'self_paid'   THEN 'suspended'
  END;

  -- Insert child org
  INSERT INTO portal.orgs (
    name, slug, country, website_url, industry, status, last_completed_step
  ) VALUES (
    p_child_name, p_child_slug, p_country_code, p_website, p_industry, v_child_status, 3
  ) RETURNING id INTO v_child_id;

  -- Grant caller manage access on the child
  INSERT INTO portal.user_orgs (user_id, org_id, role)
  VALUES (p_caller_user_id, v_child_id, 'org_owner')
  ON CONFLICT DO NOTHING;

  -- Parent-child relationship + sub-account metadata
  INSERT INTO portal.org_relationships (
    parent_org_id, child_org_id, relationship_type, status,
    created_by_user_id, payer_mode,
    owner_first_name, owner_last_name, owner_email, owner_phone
  ) VALUES (
    p_parent_org_id, v_child_id, 'licensee', 'active',
    p_caller_user_id, p_payer_mode,
    p_owner_first_name, p_owner_last_name, p_owner_email, p_owner_phone
  );

  -- Billing shell (both payer modes; stripe_status NULL until onboarding)
  INSERT INTO portal.billing_accounts (
    org_id, billing_type, tier, stripe_status, period_start, period_end
  ) VALUES (
    v_child_id, v_billing_type, p_tier, NULL, v_period_start, v_period_end
  ) RETURNING id INTO v_billing_id;

  -- Entitlement shell
  INSERT INTO portal.entitlements (
    org_id, billing_account_id, tier,
    included_trials_per_month, extra_trial_unit_price_in_cents, extra_trials_cap,
    status, period_start, period_end, tier_definition_id
  ) VALUES (
    v_child_id, v_billing_id, p_tier,
    v_tier_def.included_trials_per_month, v_tier_def.extra_trial_unit_price_cents, v_tier_def.extra_trials_cap,
    v_entitlement_status, v_period_start, v_period_end, v_tier_def.id
  );

  -- Audit
  INSERT INTO portal.org_status_history (org_id, status, changed_by, reason)
  VALUES (v_child_id, v_child_status, p_caller_user_id,
          'Sub-account created (payer_mode=' || p_payer_mode || ')');

  RETURN v_child_id;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_create_sub_org(
  uuid, uuid, text, text, text, text, text, text, int, text, text, text, text
) TO authenticated, service_role;

-- 4. RPC: portal.fn_update_sub_org_status
CREATE OR REPLACE FUNCTION portal.fn_update_sub_org_status(
  p_caller_user_id uuid,
  p_child_org_id   uuid,
  p_action         text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_rel_status       text;
  v_org_status       text;
  v_new_status       text;
  v_billing_type     text;
  v_has_entitlement  boolean;
BEGIN
  IF p_action NOT IN ('suspend','reactivate','archive') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT r.status INTO v_rel_status
    FROM portal.org_relationships r
   WHERE r.child_org_id = p_child_org_id
     AND r.relationship_type = 'licensee'
   FOR UPDATE;
  IF v_rel_status IS NULL THEN
    RAISE EXCEPTION 'child_not_found';
  END IF;

  SELECT status INTO v_org_status FROM portal.orgs WHERE id = p_child_org_id;

  IF p_action = 'suspend' THEN
    IF v_org_status <> 'active' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    v_new_status := 'suspended';
  ELSIF p_action = 'reactivate' THEN
    IF v_org_status <> 'suspended' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    v_new_status := 'active';
  ELSE -- archive
    IF v_org_status = 'archived' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    v_new_status := 'archived';
  END IF;

  UPDATE portal.orgs SET status = v_new_status WHERE id = p_child_org_id;
  UPDATE portal.org_relationships
     SET status = v_new_status, updated_at = now()
   WHERE child_org_id = p_child_org_id
     AND relationship_type = 'licensee';

  -- Entitlement cascade
  SELECT billing_type INTO v_billing_type
    FROM portal.billing_accounts
   WHERE org_id = p_child_org_id
   ORDER BY created_at DESC
   LIMIT 1;
  SELECT EXISTS (
    SELECT 1 FROM portal.entitlements WHERE org_id = p_child_org_id
  ) INTO v_has_entitlement;

  IF v_has_entitlement THEN
    IF p_action = 'archive' THEN
      UPDATE portal.entitlements
         SET status = 'archived', updated_at = now()
       WHERE org_id = p_child_org_id;
    ELSIF p_action = 'suspend' THEN
      IF v_billing_type = 'licensee' THEN
        UPDATE portal.entitlements
           SET status = 'suspended', updated_at = now()
         WHERE org_id = p_child_org_id
           AND status = 'active';
      END IF;
    ELSIF p_action = 'reactivate' THEN
      IF v_billing_type = 'licensee' THEN
        UPDATE portal.entitlements
           SET status = 'active', updated_at = now()
         WHERE org_id = p_child_org_id
           AND status = 'suspended';
      END IF;
      -- self_paid: entitlement stays suspended until billing onboarding
    END IF;
  END IF;

  INSERT INTO portal.org_status_history (org_id, status, changed_by, reason)
  VALUES (p_child_org_id, v_new_status, p_caller_user_id,
          'Sub-account ' || p_action);

  RETURN v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_update_sub_org_status(uuid, uuid, text)
  TO authenticated, service_role;
