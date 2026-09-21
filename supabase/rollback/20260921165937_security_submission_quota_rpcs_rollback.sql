-- ROLLBACK for:
-- 20260921165937_security_submission_quota_rpcs.sql
--
-- WARNING:
-- Restores the previous direct RPC execution permissions.

grant execute on function
  portal.fn_reserve_submission(uuid, text, uuid)
to PUBLIC, anon, authenticated, service_role;


grant execute on function
  portal.fn_submission_availability(uuid, uuid)
to PUBLIC, anon, authenticated, service_role;


grant execute on function
  portal.fn_submission_usage(uuid)
to PUBLIC, anon, authenticated, service_role;