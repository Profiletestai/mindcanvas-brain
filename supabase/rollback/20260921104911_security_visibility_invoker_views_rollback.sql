-- ROLLBACK for:
-- 20260921104911_security_visibility_invoker_views.sql
--
-- Restores the pre-remediation view state.
--
-- Before SEC-002E, neither view had an explicit security_invoker option,
-- which meant PostgreSQL used the default owner/definer behavior.
--
-- RESET restores that exact prior state rather than explicitly setting
-- security_invoker = false.

begin;

alter view visibility.v_pillar_scoring_coverage
  reset (security_invoker);

alter view visibility.v_option_scoring_coverage
  reset (security_invoker);

commit;