-- ROLLBACK for:
-- 20260921110746_security_public_invoker_views.sql
--
-- Restores the pre-remediation state.
--
-- Before SEC-002F, neither view had an explicit security_invoker option.
-- RESET restores that exact prior state rather than explicitly setting
-- security_invoker = false.

begin;

alter view public.v_org_profiles_8
  reset (security_invoker);

alter view public.v_portal_profile_map
  reset (security_invoker);

commit;