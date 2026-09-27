-- ROLLBACK for:
-- 20260921175445_security_final_portal_rpcs.sql
--
-- WARNING:
-- Restores the direct RPC execution permissions that existed before SEC-002W.

grant execute on function
  portal.fn_engine_trial_summary(uuid)
to PUBLIC, anon, authenticated, service_role;


grant execute on function
  portal.fn_get_dashboard_data(text, uuid)
to PUBLIC, anon, authenticated, service_role;