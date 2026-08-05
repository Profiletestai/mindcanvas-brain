-- =============================================================
-- Migration: Map the Coaching (MPS) engine to its live test
--
-- Companion to 20260722120000_onboarding_steps_and_trials.sql, which seeded
-- only the Sales engine (growth-engine-diagnostic) into portal.engine_tests
-- and left Coaching/People unmapped. The Coaching assessment now exists as a
-- portal.tests row (slug 'lead-system'), so map it here.
--
-- Matched by slug because test ids differ per environment. Once mapped, the
-- engine's trial credits become spendable (fn_reserve_submission) instead of
-- falling back to tier-only test access (fn_sync_org_test_access).
-- =============================================================

INSERT INTO portal.engine_tests (engine_key, test_id)
SELECT 'coaching', t.id
  FROM portal.tests t
 WHERE t.slug = 'lead-system'
   AND t.status = 'active'
ON CONFLICT DO NOTHING;
