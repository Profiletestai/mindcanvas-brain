-- SEC-002I: Restrict privileged access-management SECURITY DEFINER RPCs
--
-- These functions grant, revoke, suspend, reactivate or synchronise
-- organisation test/engine access, or sweep account state as part of
-- privileged billing/pilot operations.
--
-- Before remediation, PUBLIC/anon/authenticated all have EXECUTE permission.
-- Because these functions are SECURITY DEFINER, untrusted callers should not
-- be able to invoke them directly with the function owner's database rights.
--
-- This migration changes EXECUTE permissions only. It does not modify:
-- - function bodies
-- - onboarding logic
-- - billing or pilot logic
-- - database triggers
-- - scheduled cron jobs
-- - test/engine access mappings
-- - RLS policies

begin;

revoke execute on function portal.fn_grant_onboarding_trial_access(
  uuid
) from public, anon, authenticated;

revoke execute on function portal.fn_reactivate_org_test_access(
  uuid
) from public, anon, authenticated;

revoke execute on function portal.fn_suspend_org_test_access(
  uuid
) from public, anon, authenticated;

revoke execute on function portal.fn_sync_org_engines_for_tier(
  uuid,
  integer
) from public, anon, authenticated;

revoke execute on function portal.fn_sync_org_test_access(
  uuid,
  uuid
) from public, anon, authenticated;

revoke execute on function portal.fn_sweep_expired_pilots()
  from public, anon, authenticated;

revoke execute on function portal.fn_sweep_past_due_to_suspended(
  integer
) from public, anon, authenticated;

grant execute on function portal.fn_grant_onboarding_trial_access(
  uuid
) to service_role;

grant execute on function portal.fn_reactivate_org_test_access(
  uuid
) to service_role;

grant execute on function portal.fn_suspend_org_test_access(
  uuid
) to service_role;

grant execute on function portal.fn_sync_org_engines_for_tier(
  uuid,
  integer
) to service_role;

grant execute on function portal.fn_sync_org_test_access(
  uuid,
  uuid
) to service_role;

grant execute on function portal.fn_sweep_expired_pilots()
  to service_role;

grant execute on function portal.fn_sweep_past_due_to_suspended(
  integer
) to service_role;

commit;