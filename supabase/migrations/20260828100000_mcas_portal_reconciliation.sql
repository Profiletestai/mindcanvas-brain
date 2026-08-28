-- =============================================================
-- MCAS portal integration reconciliation
--
-- The original MCAS portal migrations were applied to staging outside
-- Supabase's migration ledger. This migration records the required schema
-- declaratively and safely:
--
-- - MCAS catalogue and People-engine mapping
-- - portal ownership columns
-- - portal candidate view
-- - retry-safe usage-ledger index
-- - non-destructive MCAS access grants
--
-- It intentionally does NOT replace portal.fn_reserve_submission. The newer
-- usage-bundle implementation already serialises duplicate submission
-- references and preserves engine-trial, subscription and purchased balances.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Resolve or create the catalogue-only MCAS test
-- -------------------------------------------------------------
DO $$
DECLARE
  v_test_id uuid;
  v_catalogue_org_id uuid;
BEGIN
  SELECT t.id
    INTO v_test_id
    FROM portal.tests t
   WHERE t.slug = 'mcas-core-alignment'
   ORDER BY t.created_at ASC
   LIMIT 1;

  IF v_test_id IS NULL THEN
    SELECT t.org_id
      INTO v_catalogue_org_id
      FROM portal.tests t
      JOIN portal.orgs o
        ON o.id = t.org_id
     WHERE o.slug = 'profiletest-ai'
       AND t.status = 'active'
     ORDER BY
       CASE
         WHEN t.slug = 'growth-engine-diagnostic' THEN 1
         WHEN t.slug = 'lead-system' THEN 2
         ELSE 3
       END,
       t.created_at ASC
     LIMIT 1;

    IF v_catalogue_org_id IS NULL THEN
      RAISE EXCEPTION
        'mcas_portal_reconciliation: Profiletest.ai catalogue organisation could not be resolved';
    END IF;

    INSERT INTO portal.tests (
      org_id,
      name,
      slug,
      status,
      meta
    )
    VALUES (
      v_catalogue_org_id,
      'MCAS — Core Alignment',
      'mcas-core-alignment',
      'active',
      jsonb_build_object(
        'engine', 'people',
        'external_schema', 'mcas',
        'framework_slug', 'mcas-core-alignment',
        'framework_version', 'v1',
        'catalogue_only', true
      )
    )
    RETURNING id INTO v_test_id;
  ELSE
    UPDATE portal.tests
       SET name = 'MCAS — Core Alignment',
           status = 'active',
           meta = COALESCE(meta, '{}'::jsonb)
             || jsonb_build_object(
                  'engine', 'people',
                  'external_schema', 'mcas',
                  'framework_slug', 'mcas-core-alignment',
                  'framework_version', 'v1',
                  'catalogue_only', true
                )
     WHERE id = v_test_id;
  END IF;

  INSERT INTO portal.engine_tests (
    engine_key,
    test_id
  )
  VALUES (
    'people',
    v_test_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- -------------------------------------------------------------
-- 2. Portal ownership for MCAS records
-- -------------------------------------------------------------
ALTER TABLE mcas.test_links
  ADD COLUMN IF NOT EXISTS portal_org_id
  uuid REFERENCES portal.orgs(id);

ALTER TABLE mcas.partner_applications
  ADD COLUMN IF NOT EXISTS portal_org_id
  uuid REFERENCES portal.orgs(id);

ALTER TABLE mcas.assessments
  ADD COLUMN IF NOT EXISTS portal_org_id
  uuid REFERENCES portal.orgs(id);

COMMENT ON COLUMN mcas.test_links.portal_org_id IS
  'Owning portal.orgs row for links created from the portal. NULL for admin-created links.';

COMMENT ON COLUMN mcas.partner_applications.portal_org_id IS
  'Immutable portal organisation snapshot copied from the MCAS link when the candidate starts.';

COMMENT ON COLUMN mcas.assessments.portal_org_id IS
  'Immutable portal organisation snapshot copied when the MCAS assessment is submitted.';

CREATE INDEX IF NOT EXISTS idx_mcas_test_links_portal_org
  ON mcas.test_links (portal_org_id);

CREATE INDEX IF NOT EXISTS idx_mcas_partner_applications_portal_org
  ON mcas.partner_applications (
    portal_org_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_mcas_assessments_portal_org
  ON mcas.assessments (
    portal_org_id,
    started_at DESC
  );

-- -------------------------------------------------------------
-- 3. Portal-scoped MCAS candidate view
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW mcas.v_portal_candidate_database AS
SELECT
  pa.id AS partner_application_id,
  pa.portal_org_id,
  pa.org_id,
  pa.partner_key,
  pa.application_id,
  pa.public_token,
  pa.status AS application_status,
  pa.candidate_first_name,
  pa.candidate_last_name,
  pa.candidate_email,
  pa.candidate_phone,
  pa.consent,
  pa.created_at AS application_created_at,
  pa.started_at AS application_started_at,
  pa.completed_at AS application_completed_at,

  pa.test_link_id,
  tl.name AS test_link_name,
  tl.report_version AS test_link_report_version,

  a.id AS assessment_id,
  a.status AS assessment_status,
  a.started_at AS assessment_started_at,
  a.completed_at AS assessment_completed_at,
  a.report_token AS assessment_report_token,
  a.framework_slug,
  a.framework_version,
  a.meta AS assessment_meta,

  r.id AS result_id,
  r.scoring_model,
  r.core_distribution,
  r.os_distribution,
  r.vertical_readiness,
  r.confidence,
  r.flags,
  r.computed_at AS result_computed_at,

  tl.show_results AS test_link_show_results
FROM mcas.partner_applications pa
LEFT JOIN mcas.test_links tl
  ON tl.id = pa.test_link_id
LEFT JOIN LATERAL (
  SELECT assessment.*
    FROM mcas.assessments assessment
   WHERE assessment.partner_application_id = pa.id
   ORDER BY COALESCE(
     assessment.completed_at,
     assessment.started_at
   ) DESC
   LIMIT 1
) a ON true
LEFT JOIN mcas.results r
  ON r.assessment_id = a.id;

COMMENT ON VIEW mcas.v_portal_candidate_database IS
  'Portal-scoped MCAS candidate list. API queries must always filter by portal_org_id.';

GRANT SELECT
  ON mcas.v_portal_candidate_database
  TO service_role;

-- -------------------------------------------------------------
-- 4. Retry-safe submission references
-- -------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_usage_ledger_submission_reference
ON portal.usage_ledger (reference_id)
WHERE reference_type = 'submission'
  AND event_type IN (
    'trial_consumed',
    'engine_trial_consumed',
    'usage_bundle_consumed'
  );

COMMENT ON INDEX
  portal.uq_usage_ledger_submission_reference IS
  'Permits only one consumed usage entry per submission reference across engine trials, subscription allowances and purchased bundles.';

-- -------------------------------------------------------------
-- 5. Grant MCAS without revoking any other assessment access
-- -------------------------------------------------------------
DO $$
DECLARE
  v_mcas_test_id uuid;
BEGIN
  SELECT t.id
    INTO v_mcas_test_id
    FROM portal.tests t
   WHERE t.slug = 'mcas-core-alignment'
   ORDER BY t.created_at ASC
   LIMIT 1;

  IF v_mcas_test_id IS NULL THEN
    RAISE EXCEPTION
      'mcas_portal_reconciliation: MCAS catalogue test was not resolved';
  END IF;

  INSERT INTO portal.org_test_access (
    org_id,
    test_id,
    status,
    source,
    granted_at,
    revoked_at
  )
  SELECT
    oe.org_id,
    v_mcas_test_id,
    'active',
    CASE
      WHEN EXISTS (
        SELECT 1
          FROM portal.entitlements entitlement
         WHERE entitlement.org_id = oe.org_id
           AND entitlement.status = 'active'
      )
      THEN 'billing'
      ELSE 'manual'
    END,
    now(),
    NULL
  FROM portal.org_engines oe
  WHERE oe.engine_key = 'people'
    AND oe.status = 'active'
  ON CONFLICT (org_id, test_id)
  DO UPDATE
     SET status = 'active',
         source = CASE
           WHEN portal.org_test_access.source IN (
             'manual',
             'migration'
           )
           THEN portal.org_test_access.source
           ELSE EXCLUDED.source
         END,
         revoked_at = NULL,
         granted_at = CASE
           WHEN portal.org_test_access.status = 'active'
           THEN portal.org_test_access.granted_at
           ELSE now()
         END;
END;
$$;

NOTIFY pgrst, 'reload schema';