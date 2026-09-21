-- SEC-002W
-- Restrict final portal SECURITY DEFINER RPCs.
--
-- Scope:
--   - Remove PUBLIC/anon/authenticated EXECUTE.
--   - Preserve service_role EXECUTE.
--
-- fn_engine_trial_summary is called only from a server-side service-role route.
-- fn_get_dashboard_data has no active application caller in staging and its
-- underlying dashboard view is already service-role-only.
--
-- This migration changes permissions only. It intentionally does not repair
-- fn_get_dashboard_data, which currently references a non-existent `metrics`
-- column and should be handled separately.

revoke execute on function
  portal.fn_engine_trial_summary(uuid)
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_engine_trial_summary(uuid)
to service_role;


revoke execute on function
  portal.fn_get_dashboard_data(text, uuid)
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_get_dashboard_data(text, uuid)
to service_role;