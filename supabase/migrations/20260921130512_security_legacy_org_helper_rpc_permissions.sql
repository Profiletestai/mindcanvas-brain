 -- SEC-002K: Restrict legacy org helper RPCs to authenticated users
--
-- These functions are intentionally user-scoped:
-- - create_org_and_owner() derives the caller from auth.uid()
-- - org_id_from_auth() resolves the current caller's legacy organisation
--
-- Before remediation, PUBLIC/anon/authenticated all have EXECUTE permission.
-- Anonymous callers should not be able to invoke these SECURITY DEFINER
-- functions, while authenticated users must retain access for the existing
-- legacy test-builder/report flows.
--
-- This migration changes EXECUTE permissions only. It does not modify:
-- - function bodies
-- - auth.uid() checks
-- - legacy org creation behaviour
-- - table grants
-- - RLS policies

begin;

revoke execute on function public.create_org_and_owner(
  text,
  text
) from public, anon;

revoke execute on function public.org_id_from_auth()
  from public, anon;

grant execute on function public.create_org_and_owner(
  text,
  text
) to authenticated, service_role;

grant execute on function public.org_id_from_auth()
  to authenticated, service_role;

commit;