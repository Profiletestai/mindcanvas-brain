-- ROLLBACK for:
-- 20260921130512_security_legacy_org_helper_rpc_permissions.sql
--
-- Restores the pre-remediation EXECUTE permissions for the two legacy
-- user-scoped organisation helper functions.
--
-- Before SEC-002K, PUBLIC, anon, authenticated and service_role could execute
-- each function.

begin;

grant execute on function public.create_org_and_owner(
  text,
  text
) to public, anon, authenticated, service_role;

grant execute on function public.org_id_from_auth()
  to public, anon, authenticated, service_role;

commit;