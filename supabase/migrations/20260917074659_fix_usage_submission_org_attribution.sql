-- ============================================================
-- Fix usage attribution for shared catalogue tests.
--
-- Submissions belong to the organisation of the test taker,
-- not necessarily the organisation that owns the test definition.
--
-- This matters for shared tests such as GED, where portal.tests
-- is owned by the platform org but the assessment is taken under
-- a customer organisation.
-- ============================================================

CREATE OR REPLACE VIEW portal.v_usage_submissions AS
SELECT
  ts.id AS submission_id,
  ts.test_id,
  t.name AS test_name,
  t.slug AS test_slug,
  tl.id AS link_id,
  tl.token AS link_token,
  tl.name AS link_name,

  COALESCE(
    tt.org_id,
    t.org_id
  ) AS org_id,

  o.slug AS org_slug,
  ts.created_at,
  ts.taker_id

FROM portal.test_submissions ts

JOIN portal.tests t
  ON t.id = ts.test_id

LEFT JOIN portal.test_takers tt
  ON tt.id = ts.taker_id

JOIN portal.orgs o
  ON o.id = COALESCE(
    tt.org_id,
    t.org_id
  )

LEFT JOIN portal.test_links tl
  ON tl.token = ts.link_token;