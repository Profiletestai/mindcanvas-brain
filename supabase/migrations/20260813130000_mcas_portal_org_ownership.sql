-- =============================================================
-- Migration: Portal organisation ownership for MCAS records
--
-- mcas.test_links.org_id references mcas.organisations, which is a different
-- table from portal.orgs. Portal-created MCAS links therefore need a second,
-- explicit owner column: portal_org_id is the only thing the portal APIs ever
-- scope on. mcas.organisations keeps its existing role (partner_key, the public
-- link page, /admin/mcas) and is mirrored per portal org by
-- ensureMcasOrganisationForPortalOrg() in lib/mcas/mcasPortalData.ts.
--
-- Three tables, not the two in the original spec:
--   test_links           ownership at creation
--   partner_applications ownership snapshot when the candidate starts
--   assessments          ownership snapshot when the candidate submits
--
-- partner_applications is required: it is the row the candidate list is keyed
-- on (v_admin_candidate_database.partner_application_id), and it exists from
-- the moment a candidate opens the link, whereas assessments only appears on
-- submit. Without it, started-but-unfinished candidates would be invisible to
-- the owning org.
--
-- The snapshot is immutable by convention — the application code only ever
-- writes it where it is currently NULL — so disabling or re-pointing a link
-- later cannot retro-attribute finished assessments.
--
-- All columns are nullable with no default. Every MCAS record created before
-- this migration keeps portal_org_id NULL and is simply invisible to the portal
-- until scripts/backfill-mcas-portal-org.ts attributes it. That is the intended
-- failure mode: nothing leaks into the wrong tenant.
-- =============================================================

ALTER TABLE mcas.test_links
  ADD COLUMN IF NOT EXISTS portal_org_id uuid REFERENCES portal.orgs(id);

ALTER TABLE mcas.partner_applications
  ADD COLUMN IF NOT EXISTS portal_org_id uuid REFERENCES portal.orgs(id);

ALTER TABLE mcas.assessments
  ADD COLUMN IF NOT EXISTS portal_org_id uuid REFERENCES portal.orgs(id);

COMMENT ON COLUMN mcas.test_links.portal_org_id IS
  'Owning portal.orgs row for links created from the portal. NULL for links created in /admin/mcas.';
COMMENT ON COLUMN mcas.partner_applications.portal_org_id IS
  'Immutable ownership snapshot copied from test_links.portal_org_id when the candidate starts.';
COMMENT ON COLUMN mcas.assessments.portal_org_id IS
  'Immutable ownership snapshot copied from test_links.portal_org_id at submission time.';

CREATE INDEX IF NOT EXISTS idx_mcas_test_links_portal_org
  ON mcas.test_links (portal_org_id);

-- (portal_org_id, created_at DESC) matches the candidate list's default sort.
CREATE INDEX IF NOT EXISTS idx_mcas_partner_applications_portal_org
  ON mcas.partner_applications (portal_org_id, created_at DESC);

-- assessments has no created_at column (started_at is NOT NULL and serves the
-- same purpose), so the ordering column here differs from the other two tables.
CREATE INDEX IF NOT EXISTS idx_mcas_assessments_portal_org
  ON mcas.assessments (portal_org_id, started_at DESC);

-- -------------------------------------------------------
-- Portal-scoped candidate view
-- -------------------------------------------------------
-- A new view rather than a CREATE OR REPLACE of v_admin_candidate_database:
-- that view was created out of band, is not in this repo's migration history,
-- and is read by /admin/mcas. Replacing it blind risks the admin screens; a
-- separate view is purely additive.
--
-- Column names mirror v_admin_candidate_database so
-- normaliseCandidateDatabaseRow() in lib/mcas/mcasAdminData.ts maps both,
-- plus portal_org_id and the link name the portal list shows.
CREATE OR REPLACE VIEW mcas.v_portal_candidate_database AS
SELECT
  pa.id                    AS partner_application_id,
  pa.portal_org_id,
  pa.org_id,
  pa.partner_key,
  pa.application_id,
  pa.public_token,
  pa.status                AS application_status,
  pa.candidate_first_name,
  pa.candidate_last_name,
  pa.candidate_email,
  pa.candidate_phone,
  pa.consent,
  pa.created_at            AS application_created_at,
  pa.started_at            AS application_started_at,
  pa.completed_at          AS application_completed_at,

  pa.test_link_id,
  tl.name                  AS test_link_name,
  tl.report_version        AS test_link_report_version,

  a.id                     AS assessment_id,
  a.status                 AS assessment_status,
  a.started_at             AS assessment_started_at,
  a.completed_at           AS assessment_completed_at,
  a.report_token           AS assessment_report_token,
  a.framework_slug,
  a.framework_version,
  a.meta                   AS assessment_meta,

  r.id                     AS result_id,
  r.scoring_model,
  r.core_distribution,
  r.os_distribution,
  r.vertical_readiness,
  r.confidence,
  r.flags,
  r.computed_at            AS result_computed_at
FROM mcas.partner_applications pa
LEFT JOIN mcas.test_links tl
  ON tl.id = pa.test_link_id
-- One assessment per application in practice; the lateral keeps the newest so a
-- restarted assessment cannot fan the row out into duplicates.
LEFT JOIN LATERAL (
  SELECT a2.*
    FROM mcas.assessments a2
   WHERE a2.partner_application_id = pa.id
   -- Same ordering as v_admin_candidate_database, so both views agree on which
   -- attempt is "the" assessment when one was restarted.
   ORDER BY COALESCE(a2.completed_at, a2.started_at) DESC
   LIMIT 1
) a ON true
LEFT JOIN mcas.results r
  ON r.assessment_id = a.id;

COMMENT ON VIEW mcas.v_portal_candidate_database IS
  'Portal-scoped MCAS candidate list. Always filter on portal_org_id; rows with a NULL portal_org_id belong to no portal organisation.';

-- Read exclusively by server routes holding the service role key. Not granted
-- to `authenticated`: the browser never queries the mcas schema directly, it
-- goes through /api/portal/[slug]/mcas/*.
GRANT SELECT ON mcas.v_portal_candidate_database TO service_role;

-- PostgREST caches the schema; without this the new view 404s until the next
-- reload.
NOTIFY pgrst, 'reload schema';
