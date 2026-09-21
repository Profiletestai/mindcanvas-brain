-- ROLLBACK for:
-- 20260921123954_security_access_management_rpc_permissions.sql
--
-- Restores the pre-remediation EXECUTE permissions for the seven privileged
-- access-management functions.
--
-- Before SEC-002I, PUBLIC, anon, authenticated and service_role could execute
-- each function.

begin;

grant execute on function portal.fn_grant_onboarding_trial_access(
  uuid
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_reactivate_org_test_access(
  uuid
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_suspend_org_test_access(
  uuid
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_sync_org_engines_for_tier(
  uuid,
  integer
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_sync_org_test_access(
  uuid,
  uuid
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_sweep_expired_pilots()
  to public, anon, authenticated, service_role;

grant execute on function portal.fn_sweep_past_due_to_suspended(
  integer
) to public, anon, authenticated, service_role;

commit;