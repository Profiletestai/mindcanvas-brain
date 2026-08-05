-- =============================================================
-- Migration: A selected engine's test is always granted
--
-- fn_sync_org_test_access (20260721120000) granted the INTERSECTION of the
-- tier's plan_test_access and the selected engines' mapped tests. Engines could
-- only NARROW the tier plan, never add to it. So a mapped engine test that is
-- absent from the tier plan was silently dropped:
--
--   Pick sales + coaching, skip billing (free/trial, tier plan = { GED }):
--     granted = plan ∩ engine_tests = { GED } ∩ { GED, lead-system } = { GED }
--   -> the org has coaching trial credits but no lead-system to spend them on.
--
-- Fix: when the org has any engine mapping, grant the UNION of every selected
-- engine's mapped tests, independent of the tier plan. Narrowing is preserved
-- (only tests of engines the org actually selected), but the engine's own test
-- can no longer be filtered out by a tier plan that omits it. Orgs with no
-- engine mapping keep the tier-only fallback unchanged.
--
-- Test access (which tests an org can see/deploy) is separate from the monthly
-- subscription allowance (fn_reserve_submission), which still caps usage — so
-- granting the engine's test does not hand out extra quota.
-- =============================================================

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

  -- Does the org have at least one selected engine with a seeded test mapping?
  -- If not, fall back to tier-only access (plan_test_access).
  SELECT EXISTS (
    SELECT 1
      FROM portal.org_engines oe
      JOIN portal.engine_tests et ON et.engine_key = oe.engine_key AND et.active
     WHERE oe.org_id = p_org_id AND oe.status = 'active'
  ) INTO v_has_engine_map;

  IF v_has_engine_map THEN
    -- Grant the union of every selected engine's mapped tests. The tier plan no
    -- longer gates these: a selected engine's test is always granted.
    INSERT INTO portal.org_test_access (org_id, test_id, status, source, granted_at, revoked_at)
    SELECT DISTINCT p_org_id, et.test_id, 'active', 'billing', now(), null::timestamptz
      FROM portal.engine_tests et
      JOIN portal.org_engines oe
        ON oe.engine_key = et.engine_key
       AND oe.org_id     = p_org_id
       AND oe.status     = 'active'
     WHERE et.active
    ON CONFLICT (org_id, test_id) DO UPDATE
       SET status     = 'active',
           source     = CASE WHEN portal.org_test_access.source IN ('manual','migration')
                             THEN portal.org_test_access.source
                             ELSE 'billing' END,
           revoked_at = null,
           granted_at = CASE WHEN portal.org_test_access.status = 'active'
                             THEN portal.org_test_access.granted_at
                             ELSE now() END;

    -- Revoke billing-sourced tests that are no longer for a selected engine.
    UPDATE portal.org_test_access ota
       SET status     = 'revoked',
           revoked_at = now()
     WHERE ota.org_id = p_org_id
       AND ota.source = 'billing'
       AND ota.status <> 'revoked'
       AND NOT EXISTS (
         SELECT 1
           FROM portal.engine_tests et
           JOIN portal.org_engines oe
             ON oe.engine_key = et.engine_key
            AND oe.org_id     = p_org_id
            AND oe.status     = 'active'
          WHERE et.test_id = ota.test_id AND et.active
       );
  ELSE
    -- Tier-only fallback: the org picked no engines, or none is mapped yet.
    INSERT INTO portal.org_test_access (org_id, test_id, status, source, granted_at, revoked_at)
    SELECT p_org_id, pta.test_id, 'active', 'billing', now(), null::timestamptz
      FROM portal.plan_test_access pta
     WHERE pta.tier_definition_id = p_tier_definition_id
       AND pta.active = true
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
       );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_sync_org_test_access(uuid, uuid) TO service_role;
