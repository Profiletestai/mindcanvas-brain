-- =============================================================
-- Migration: expose test_links.show_results on the portal candidate view
--
-- The public report pages gate differently:
--   /mcas/r/<token>/snapshot  404s unless access.snapshotUnlocked, which is
--                             test_links.show_results (reportPayload.ts:2176)
--   /mcas/r/<token>/full      checks neither flag; it renders whenever the
--                             payload builds
--
-- show_results is a CANDIDATE-facing consent setting — "may the person who took
-- this assessment see their own result" — not a staff permission. But the portal
-- candidate page was offering staff a Snapshot button for every candidate, which
-- 404s on any link created with the box unticked (the default).
--
-- Adding the column here lets the portal offer the snapshot only when it will
-- actually render. Staff always get the full report, which has no gate.
--
-- CREATE OR REPLACE VIEW only permits appending columns, so show_results goes
-- last and every existing column keeps its position and name.
-- =============================================================

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
  r.computed_at            AS result_computed_at,

  -- Appended by this migration.
  tl.show_results          AS test_link_show_results
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

GRANT SELECT ON mcas.v_portal_candidate_database TO service_role;

NOTIFY pgrst, 'reload schema';
