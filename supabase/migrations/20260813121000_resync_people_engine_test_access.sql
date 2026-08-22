-- =============================================================
-- Migration: Re-sync test access for orgs on the People engine
--
-- Separate from 20260813120000 on purpose. fn_sync_org_test_access only fires
-- from triggers on portal.entitlements and portal.orgs.status, so mapping the
-- People engine does not by itself grant MCAS to orgs that already selected it.
-- This runs the sync for exactly those orgs.
--
-- READ THIS BEFORE RUNNING.
--
-- Since 20260723160000 the engine branch of fn_sync_org_test_access grants the
-- UNION of every selected engine's mapped tests and REVOKES every other
-- billing-sourced row. Orgs that previously had no engine with a seeded mapping
-- fell through to the tier-only branch; once 'people' is mapped they switch to
-- the engine branch, which can revoke tier-granted tests that belong to no
-- selected engine.
--
-- Run query 9 in supabase/sql-snippets/mcas_portal_integration_preflight.sql
-- before and after this migration and confirm the revocations are intended.
-- Rows with source in ('manual','migration') keep their source and are not
-- revoked by the billing arm.
-- =============================================================

DO $$
DECLARE
  r             record;
  v_tier_def_id uuid;
BEGIN
  FOR r IN
    SELECT e.org_id, e.tier_definition_id, e.tier
      FROM portal.entitlements e
     WHERE e.status = 'active'
       AND EXISTS (
             SELECT 1
               FROM portal.org_engines oe
              WHERE oe.org_id     = e.org_id
                AND oe.engine_key = 'people'
                AND oe.status     = 'active'
           )
  LOOP
    v_tier_def_id := r.tier_definition_id;

    -- Mirror the fallback in fn_entitlements_sync_test_access: legacy rows may
    -- have no tier_definition_id.
    IF v_tier_def_id IS NULL THEN
      SELECT td.id INTO v_tier_def_id
        FROM portal.tier_definitions td
       WHERE td.tier = r.tier
         AND td.valid_until IS NULL
       ORDER BY td.created_at DESC, td.id DESC
       LIMIT 1;
    END IF;

    IF v_tier_def_id IS NULL THEN
      RAISE WARNING 'resync_people_engine_test_access: skipping org % — no tier_definition for tier %', r.org_id, r.tier;
      CONTINUE;
    END IF;

    PERFORM portal.fn_sync_org_test_access(r.org_id, v_tier_def_id);
  END LOOP;
END $$;

-- Orgs that skipped billing have no entitlement row at all (see
-- 20260723120000), so the loop above misses them. They still hold People-engine
-- trial credits and must be able to see MCAS. Grant directly, marked 'manual'
-- so a later billing sync does not revoke it.
INSERT INTO portal.org_test_access (org_id, test_id, status, source, granted_at)
SELECT oe.org_id, t.id, 'active', 'manual', now()
  FROM portal.org_engines oe
  CROSS JOIN portal.tests t
 WHERE oe.engine_key = 'people'
   AND oe.status     = 'active'
   AND t.slug        = 'mcas-core-alignment'
   AND NOT EXISTS (
         SELECT 1 FROM portal.entitlements e
          WHERE e.org_id = oe.org_id AND e.status = 'active'
       )
ON CONFLICT (org_id, test_id) DO UPDATE
   SET status     = 'active',
       revoked_at = NULL;
