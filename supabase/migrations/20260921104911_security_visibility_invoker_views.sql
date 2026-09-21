-- SEC-002E: Make Visibility scoring coverage views SECURITY INVOKER
--
-- The two views below are currently owned by postgres and use the default
-- security-definer behavior. That allows callers to execute the view query
-- using the view owner's privileges instead of the caller's RLS context.
--
-- Current observed behavior:
-- - anon receives 0 rows from visibility.questions/options directly
-- - anon can nevertheless read rows through these views
--
-- PostgreSQL 17 supports security_invoker views. Setting this option makes
-- the views respect the querying role's underlying privileges and RLS rules.
--
-- This migration changes only the view security mode. It does not modify:
-- - the view definitions
-- - grants
-- - RLS policies
-- - underlying tables

begin;

alter view visibility.v_pillar_scoring_coverage
  set (security_invoker = true);

alter view visibility.v_option_scoring_coverage
  set (security_invoker = true);

commit;