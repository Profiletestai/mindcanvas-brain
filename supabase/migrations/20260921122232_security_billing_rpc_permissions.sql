-- SEC-002H: Restrict privileged billing/pilot SECURITY DEFINER RPCs
--
-- These functions perform privileged billing and pilot state changes and are
-- called from server-side application routes using the Supabase service-role
-- client.
--
-- Before remediation, PUBLIC/anon/authenticated all have EXECUTE permission.
-- Because these functions are SECURITY DEFINER, allowing untrusted callers to
-- invoke them would execute privileged billing logic with the function owner's
-- database rights.
--
-- This migration changes EXECUTE permissions only. It does not modify:
-- - function bodies
-- - Stripe webhook logic
-- - pilot activation logic
-- - billing/entitlement tables
-- - RLS policies

begin;

revoke execute on function portal.fn_activate_pilot(
  uuid,
  timestamp with time zone,
  integer
) from public, anon, authenticated;

revoke execute on function portal.fn_apply_billing_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone
) from public, anon, authenticated;

revoke execute on function portal.fn_apply_billing_event_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  text
) from public, anon, authenticated;

grant execute on function portal.fn_activate_pilot(
  uuid,
  timestamp with time zone,
  integer
) to service_role;

grant execute on function portal.fn_apply_billing_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone
) to service_role;

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
) to service_role;

commit;