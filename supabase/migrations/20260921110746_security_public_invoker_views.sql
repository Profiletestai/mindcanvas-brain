-- SEC-002F: Make remaining public views SECURITY INVOKER
--
-- These views are owned by postgres and currently use PostgreSQL's default
-- owner/definer behavior. That allows callers to execute the view query using
-- the view owner's privileges instead of the querying role's own permissions
-- and RLS context.
--
-- Observed before remediation:
-- - anon receives 0 rows from public.org_profiles / public.org_frameworks directly
-- - anon can nevertheless read rows through public.v_org_profiles_8
-- - public.v_portal_profile_map also exposes data through a definer view even
--   though its underlying portal label tables are not directly granted to anon/auth
--
-- PostgreSQL 17 supports security_invoker views. Setting this option makes the
-- views respect the querying role's underlying privileges and RLS rules.
--
-- This migration changes only the view security mode. It does not modify:
-- - view definitions
-- - grants
-- - RLS policies
-- - underlying tables

begin;

alter view public.v_org_profiles_8
  set (security_invoker = true);

alter view public.v_portal_profile_map
  set (security_invoker = true);

commit;
