-- ROLLBACK for:
-- 20260921122232_security_billing_rpc_permissions.sql
--
-- Restores the pre-remediation EXECUTE permissions for the three privileged
-- billing/pilot functions.
--
-- Before SEC-002H, PUBLIC, anon, authenticated and service_role could execute
-- each function.

begin;

grant execute on function portal.fn_activate_pilot(
  uuid,
  timestamp with time zone,
  integer
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_apply_billing_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone
) to public, anon, authenticated, service_role;

grant execute on function portal.fn_apply_billing_event_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  text
) to public, anon, authenticated, service_role;

commit;