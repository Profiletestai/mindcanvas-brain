-- =============================================================
-- Migration: Onboarding Engine + Subscription Selection (screen 3)
--
-- New onboarding step 3 lets a client pick 1-3 MindCanvas engines and a
-- subscription tier. The engine count fixes the minimum tier
-- (1 engine -> tier 1, 2 -> tier 2, 3 -> tier 3) and each selected engine
-- carries 3 free trial tests. Tier 4 is not selectable during onboarding.
--
-- The selection is made BEFORE the org exists (org is created on step 4), so
-- it is stored per user in portal.onboarding_selections and copied onto the
-- org (org_engines + engine_trial_allocations) when the org is created.
--
-- Every rule enforced in the UI is re-enforced here: the tier check lives in
-- a table constraint and in fn_save_onboarding_selection, and the trial
-- quantities are derived from the engine list, never from client input.
--
-- Step renumbering (orgs.last_completed_step):
--   1 account, 2 verify, 3 engines+plan, 4 organisation, 5 contact, 6 branding
-- Org creation now records step 4 (was 3); contact records 5 (was 4).
-- =============================================================

-- -------------------------------------------------------
-- 0. Engine catalogue (permanent internal identifiers)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.engines (
  key          text PRIMARY KEY CHECK (key IN ('sales','coaching','people')),
  product_code text NOT NULL CHECK (product_code IN ('GED','MPS','MCAS')),
  display_name text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO portal.engines (key, product_code, display_name) VALUES
  ('sales',    'GED',  'Sales Engine'),
  ('coaching', 'MPS',  'Coaching Engine'),
  ('people',   'MCAS', 'People Engine')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE portal.engines ENABLE ROW LEVEL SECURITY;

-- Engine -> test mapping. Operator-seeded: test ids differ per environment.
-- While this table is empty for an engine, test access falls back to the
-- tier-only mapping in portal.plan_test_access (see fn_sync_org_test_access).
CREATE TABLE IF NOT EXISTS portal.engine_tests (
  engine_key text NOT NULL REFERENCES portal.engines(key) ON DELETE CASCADE,
  test_id    uuid NOT NULL REFERENCES portal.tests(id) ON DELETE CASCADE,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (engine_key, test_id)
);

CREATE INDEX IF NOT EXISTS idx_engine_tests_test ON portal.engine_tests (test_id);

ALTER TABLE portal.engine_tests ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 1. Pre-org selection, keyed by the onboarding user
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.onboarding_selections (
  user_id       uuid PRIMARY KEY,
  engines       text[] NOT NULL,
  selected_tier int NOT NULL,
  org_id        uuid REFERENCES portal.orgs(id) ON DELETE SET NULL,
  applied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Duplicates are stripped by fn_save_onboarding_selection before insert.
  CONSTRAINT chk_onboarding_selection_engines CHECK (
    array_length(engines, 1) BETWEEN 1 AND 3
    AND engines <@ ARRAY['sales','coaching','people']::text[]
  ),
  -- Tier 4 is out of the onboarding flow, and the tier must support the
  -- number of engines chosen (minimum tier = engine count).
  CONSTRAINT chk_onboarding_selection_tier CHECK (
    selected_tier BETWEEN 1 AND 3
    AND selected_tier >= array_length(engines, 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_onboarding_selections_org
  ON portal.onboarding_selections (org_id);

CREATE TRIGGER trg_onboarding_selections_updated_at
  BEFORE UPDATE ON portal.onboarding_selections
  FOR EACH ROW EXECUTE FUNCTION portal.fn_set_updated_at();

ALTER TABLE portal.onboarding_selections ENABLE ROW LEVEL SECURITY;

-- Owners may read their own row (writes go through the service role).
CREATE POLICY onboarding_selections_self_select
  ON portal.onboarding_selections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 2. Engines active for an org (drives product access)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.org_engines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES portal.orgs(id) ON DELETE CASCADE,
  engine_key text NOT NULL REFERENCES portal.engines(key),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  source     text NOT NULL DEFAULT 'onboarding' CHECK (source IN ('onboarding','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, engine_key)
);

CREATE INDEX IF NOT EXISTS idx_org_engines_org_active
  ON portal.org_engines (org_id) WHERE status = 'active';

CREATE TRIGGER trg_org_engines_updated_at
  BEFORE UPDATE ON portal.org_engines
  FOR EACH ROW EXECUTE FUNCTION portal.fn_set_updated_at();

ALTER TABLE portal.org_engines ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_engines_member_select
  ON portal.org_engines
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM portal.user_orgs uo
             WHERE uo.org_id = org_engines.org_id AND uo.user_id = auth.uid())
  );

-- Selected tier carried into billing (Stripe step reads it, never the browser).
ALTER TABLE portal.orgs
  ADD COLUMN IF NOT EXISTS selected_tier int
    CHECK (selected_tier IS NULL OR selected_tier BETWEEN 1 AND 4);

-- -------------------------------------------------------
-- 3. Per-engine trial allocations (trial usage ledger)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.engine_trial_allocations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES portal.orgs(id) ON DELETE CASCADE,
  engine_key         text NOT NULL REFERENCES portal.engines(key),
  product_code       text NOT NULL,
  quantity_allocated int NOT NULL CHECK (quantity_allocated > 0),
  quantity_remaining int NOT NULL CHECK (quantity_remaining >= 0),
  allocation_type    text NOT NULL DEFAULT 'trial' CHECK (allocation_type IN ('trial')),
  reference          text,            -- onboarding / subscription reference
  billing_account_id uuid REFERENCES portal.billing_accounts(id),
  allocated_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_engine_trial_remaining CHECK (quantity_remaining <= quantity_allocated),
  -- Idempotency: one trial allocation per org+engine, ever.
  UNIQUE (org_id, engine_key, allocation_type)
);

CREATE INDEX IF NOT EXISTS idx_engine_trial_allocations_org
  ON portal.engine_trial_allocations (org_id);

CREATE TRIGGER trg_engine_trial_allocations_updated_at
  BEFORE UPDATE ON portal.engine_trial_allocations
  FOR EACH ROW EXECUTE FUNCTION portal.fn_set_updated_at();

ALTER TABLE portal.engine_trial_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY engine_trial_allocations_member_select
  ON portal.engine_trial_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM portal.user_orgs uo
             WHERE uo.org_id = engine_trial_allocations.org_id AND uo.user_id = auth.uid())
  );

-- -------------------------------------------------------
-- 4. RPC: save the step-3 selection (server-side rule enforcement)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_save_onboarding_selection(
  p_user_id uuid,
  p_engines text[],
  p_tier    int
) RETURNS portal.onboarding_selections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_engines text[];
  v_count   int;
  v_min     int;
  v_row     portal.onboarding_selections;
  v_org_id  uuid;
BEGIN
  -- Canonicalise: drop duplicates and unknown keys, keep catalogue order.
  SELECT array_agg(e.key ORDER BY
           CASE e.key WHEN 'sales' THEN 1 WHEN 'coaching' THEN 2 ELSE 3 END)
    INTO v_engines
    FROM portal.engines e
   WHERE e.active AND e.key = ANY (p_engines);

  v_count := COALESCE(array_length(v_engines, 1), 0);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_engine_selected';
  END IF;

  -- Minimum tier is derived from the engine count — the caller's idea of the
  -- recommended tier is ignored entirely.
  v_min := v_count;
  IF p_tier IS NULL OR p_tier < 1 OR p_tier > 3 THEN
    RAISE EXCEPTION 'invalid_tier';
  END IF;
  IF p_tier < v_min THEN
    RAISE EXCEPTION 'tier_below_minimum';
  END IF;

  SELECT uo.org_id INTO v_org_id
    FROM portal.user_orgs uo
   WHERE uo.user_id = p_user_id
   LIMIT 1;

  INSERT INTO portal.onboarding_selections (user_id, engines, selected_tier, org_id)
  VALUES (p_user_id, v_engines, p_tier, v_org_id)
  ON CONFLICT (user_id) DO UPDATE
     SET engines       = EXCLUDED.engines,
         selected_tier = EXCLUDED.selected_tier,
         org_id        = COALESCE(portal.onboarding_selections.org_id, EXCLUDED.org_id)
  RETURNING * INTO v_row;

  -- If the org already exists (client came back and changed the selection),
  -- push the change through immediately.
  IF v_row.org_id IS NOT NULL THEN
    PERFORM portal.fn_apply_onboarding_selection(p_user_id, v_row.org_id);
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_save_onboarding_selection(uuid, text[], int) TO service_role;

-- -------------------------------------------------------
-- 5. RPC: copy the selection onto the org (idempotent)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_apply_onboarding_selection(
  p_user_id uuid,
  p_org_id  uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_sel portal.onboarding_selections;
BEGIN
  SELECT * INTO v_sel FROM portal.onboarding_selections WHERE user_id = p_user_id;
  IF v_sel.user_id IS NULL THEN
    RETURN;  -- nothing selected yet
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('portal.org_engines:' || p_org_id::text));

  UPDATE portal.onboarding_selections
     SET org_id     = p_org_id,
         applied_at = now()
   WHERE user_id = p_user_id;

  -- Engines: grant the selected ones, revoke onboarding-sourced leftovers.
  INSERT INTO portal.org_engines (org_id, engine_key, status, source)
  SELECT p_org_id, e, 'active', 'onboarding' FROM unnest(v_sel.engines) e
  ON CONFLICT (org_id, engine_key) DO UPDATE SET status = 'active';

  UPDATE portal.org_engines
     SET status = 'revoked'
   WHERE org_id = p_org_id
     AND source = 'onboarding'
     AND status = 'active'
     AND NOT (engine_key = ANY (v_sel.engines));

  UPDATE portal.orgs SET selected_tier = v_sel.selected_tier WHERE id = p_org_id;

  -- Trial credits: 3 per selected engine, created once per org+engine.
  -- ON CONFLICT DO NOTHING is what makes re-submitting onboarding safe —
  -- an existing allocation (possibly already partly consumed) is left alone.
  INSERT INTO portal.engine_trial_allocations
    (org_id, engine_key, product_code, quantity_allocated, quantity_remaining,
     allocation_type, reference)
  SELECT p_org_id, e.key, e.product_code, 3, 3, 'trial',
         'onboarding:' || p_user_id::text
    FROM portal.engines e
   WHERE e.key = ANY (v_sel.engines)
  ON CONFLICT (org_id, engine_key, allocation_type) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_apply_onboarding_selection(uuid, uuid) TO service_role;

-- -------------------------------------------------------
-- 6. Org creation: record step 4 and apply the selection
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_create_onboarding_org(
  p_user_id        uuid,
  p_name           text,
  p_slug           text,
  p_address        text DEFAULT NULL,
  p_country        text DEFAULT NULL,
  p_billing_region text DEFAULT NULL,
  p_website_url    text DEFAULT NULL,
  p_industry       text DEFAULT NULL,
  p_logo_url       text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE v_org_id uuid;
BEGIN
  INSERT INTO portal.orgs (name, slug, address, country, billing_region, website_url, industry, logo_url, status, last_completed_step)
  VALUES (p_name, p_slug, p_address, p_country, p_billing_region, p_website_url, p_industry, p_logo_url, 'pending_activation', 4)
  RETURNING id INTO v_org_id;

  INSERT INTO portal.user_orgs (user_id, org_id, role) VALUES (p_user_id, v_org_id, 'org_owner');
  INSERT INTO portal.org_status_history (org_id, status, changed_by, reason)
    VALUES (v_org_id, 'pending_activation', p_user_id, 'Org created during onboarding');

  -- Engines + tier + trial credits chosen on step 3.
  PERFORM portal.fn_apply_onboarding_selection(p_user_id, v_org_id);

  RETURN v_org_id;
END;
$$;

-- Existing orgs created under the old numbering sit one step behind between
-- org creation (was 3, now 4) and contact (was 4, now 5). Branding (6) and
-- everything before org creation are unchanged. Shift the higher value first
-- so a row is not bumped twice.
UPDATE portal.orgs SET last_completed_step = 5 WHERE last_completed_step = 4;
UPDATE portal.orgs SET last_completed_step = 4 WHERE last_completed_step = 3;

-- -------------------------------------------------------
-- 7. Test access respects the engine selection
--    (tier mapping stays the ceiling; engines narrow it)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_sync_org_test_access(
  p_org_id             uuid,
  p_tier_definition_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_has_engine_map boolean;
BEGIN
  IF p_tier_definition_id IS NULL THEN
    RAISE EXCEPTION 'fn_sync_org_test_access: p_tier_definition_id is null for org %', p_org_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('portal.org_test_access:' || p_org_id::text));

  -- Only filter by engine when the org picked engines AND those engines have a
  -- seeded test mapping; otherwise fall back to tier-only access.
  SELECT EXISTS (
    SELECT 1
      FROM portal.org_engines oe
      JOIN portal.engine_tests et ON et.engine_key = oe.engine_key AND et.active
     WHERE oe.org_id = p_org_id AND oe.status = 'active'
  ) INTO v_has_engine_map;

  INSERT INTO portal.org_test_access (org_id, test_id, status, source, granted_at, revoked_at)
  SELECT p_org_id, pta.test_id, 'active', 'billing', now(), null
    FROM portal.plan_test_access pta
   WHERE pta.tier_definition_id = p_tier_definition_id
     AND pta.active = true
     AND (
       NOT v_has_engine_map
       OR EXISTS (
         SELECT 1
           FROM portal.engine_tests et
           JOIN portal.org_engines oe
             ON oe.engine_key = et.engine_key AND oe.org_id = p_org_id AND oe.status = 'active'
          WHERE et.test_id = pta.test_id AND et.active
       )
     )
  ON CONFLICT (org_id, test_id) DO UPDATE
     SET status     = 'active',
         source     = CASE WHEN portal.org_test_access.source IN ('manual','migration')
                           THEN portal.org_test_access.source
                           ELSE 'billing' END,
         revoked_at = null,
         granted_at = CASE WHEN portal.org_test_access.status = 'active'
                           THEN portal.org_test_access.granted_at
                           ELSE now() END;

  UPDATE portal.org_test_access ota
     SET status     = 'revoked',
         revoked_at = now()
   WHERE ota.org_id = p_org_id
     AND ota.source = 'billing'
     AND ota.status <> 'revoked'
     AND NOT EXISTS (
       SELECT 1
         FROM portal.plan_test_access pta
        WHERE pta.tier_definition_id = p_tier_definition_id
          AND pta.active             = true
          AND pta.test_id            = ota.test_id
          AND (
            NOT v_has_engine_map
            OR EXISTS (
              SELECT 1
                FROM portal.engine_tests et
                JOIN portal.org_engines oe
                  ON oe.engine_key = et.engine_key AND oe.org_id = p_org_id AND oe.status = 'active'
               WHERE et.test_id = pta.test_id AND et.active
            )
          )
     );
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_sync_org_test_access(uuid, uuid) TO service_role;
