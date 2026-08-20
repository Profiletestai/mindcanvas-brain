-- =============================================================
-- Migration: Map the People (MCAS) engine to its portal catalogue test
--
-- Third and last companion to 20260722120000 (seeded 'sales') and
-- 20260723150000 (seeded 'coaching'). portal.engines has carried
-- ('people','MCAS','People Engine') since 20260721120000, but no portal.tests
-- row existed for MCAS, so portal.engine_tests had no 'people' entry. The
-- consequence, exactly as predicted in the 20260722120000 comment: an org that
-- selects the People engine gets 3 trial credits in engine_trial_allocations
-- that can never be spent, because fn_reserve_submission resolves the engine
-- from the submitted test id and finds nothing.
--
-- MCAS assessments live in the mcas schema, not in portal.test_submissions —
-- this row is a catalogue entry, not a deployable portal test. It exists so
-- that:
--   * portal.engine_tests can map 'people' -> a test id
--   * fn_sync_org_test_access can grant/revoke MCAS access per org
--   * fn_reserve_submission / fn_submission_availability can find the engine
--     when the public MCAS submit route records usage
--
-- Matched and created by slug because test ids differ per environment.
--
-- NOTE: this migration only creates the mapping. Existing orgs do not pick it
-- up until fn_sync_org_test_access runs for them — see the companion migration
-- 20260813121000, which is deliberately separate so its revocations can be
-- reviewed first.
-- =============================================================

DO $$
DECLARE
  v_test_id uuid;
  v_org_id  uuid;
BEGIN
  SELECT t.id INTO v_test_id
    FROM portal.tests t
   WHERE t.slug = 'mcas-core-alignment'
   LIMIT 1;

  IF v_test_id IS NULL THEN
    -- Catalogue tests all live in one org; inherit it rather than hardcoding.
    SELECT t.org_id INTO v_org_id
      FROM portal.tests t
     WHERE t.slug IN ('growth-engine-diagnostic', 'lead-system')
     ORDER BY CASE t.slug WHEN 'growth-engine-diagnostic' THEN 1 ELSE 2 END,
              t.created_at
     LIMIT 1;

    IF v_org_id IS NULL THEN
      RAISE EXCEPTION
        'map_people_engine_mcas_test: no catalogue test found to inherit org_id from. Seed portal.tests for growth-engine-diagnostic or lead-system first, or insert the mcas-core-alignment row by hand.';
    END IF;

    INSERT INTO portal.tests (org_id, name, slug, status, meta)
    VALUES (
      v_org_id,
      'MCAS — Core Alignment',
      'mcas-core-alignment',
      'active',
      jsonb_build_object(
        'engine',            'people',
        'external_schema',   'mcas',
        'framework_slug',    'mcas-core-alignment',
        'framework_version', 'v1',
        -- Flags this as a catalogue-only entry: it is never answered through
        -- portal.test_submissions, only through /mcas/t/[token].
        'catalogue_only',    true
      )
    )
    RETURNING id INTO v_test_id;
  END IF;

  INSERT INTO portal.engine_tests (engine_key, test_id)
  VALUES ('people', v_test_id)
  ON CONFLICT DO NOTHING;
END $$;
