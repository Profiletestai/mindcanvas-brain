-- ROLLBACK for:
-- 20260921125057_security_onboarding_rpc_permissions.sql
--
-- Restores the pre-remediation EXECUTE permissions for the three privileged
-- onboarding functions.
--
-- Before SEC-002J, PUBLIC, anon, authenticated and service_role could execute
-- each function.

begin;

grant execute on function portal.fn_create_onboarding_org(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_save_onboarding_selection(
  uuid,
  text[],
  integer
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_apply_onboarding_selection(
  uuid,
  uuid
) to public, anon, authenticated, service_role;

commit;