-- SEC-002J: Restrict privileged onboarding SECURITY DEFINER RPCs
--
-- These functions create onboarding organisations, persist onboarding plan
-- selections, apply engine/tier selections, and allocate trial access.
--
-- Before remediation, PUBLIC/anon/authenticated all have EXECUTE permission.
-- Because these functions are SECURITY DEFINER and accept caller-supplied user
-- or organisation identifiers, they must not be directly invokable by
-- untrusted roles.
--
-- Current application usage is server-side through the Supabase service-role
-- client after application-level authentication.
--
-- This migration changes EXECUTE permissions only. It does not modify:
-- - function bodies
-- - onboarding business rules
-- - organisation creation logic
-- - engine/tier selection logic
-- - trial allocation logic
-- - tables
-- - RLS policies

begin;

revoke execute on function portal.fn_create_onboarding_org(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function portal.fn_save_onboarding_selection(
  uuid,
  text[],
  integer
) from public, anon, authenticated;

revoke execute on function portal.fn_apply_onboarding_selection(
  uuid,
  uuid
) from public, anon, authenticated;

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
) to service_role;

grant execute on function portal.fn_save_onboarding_selection(
  uuid,
  text[],
  integer
) to service_role;

grant execute on function portal.fn_apply_onboarding_selection(
  uuid,
  uuid
) to service_role;

commit;