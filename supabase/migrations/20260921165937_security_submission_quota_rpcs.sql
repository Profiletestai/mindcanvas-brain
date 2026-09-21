-- SEC-002T
-- Restrict submission/quota SECURITY DEFINER RPCs.
--
-- Scope:
--   - Remove PUBLIC/anon/authenticated EXECUTE.
--   - Preserve service_role EXECUTE for server-side billing/quota helpers.
--
-- All active application calls use portalAdmin(), which is backed by the
-- Supabase service-role key. These functions already have an explicit
-- search_path = portal, so no function-body/search-path change is required.

revoke execute on function
  portal.fn_reserve_submission(uuid, text, uuid)
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_reserve_submission(uuid, text, uuid)
to service_role;


revoke execute on function
  portal.fn_submission_availability(uuid, uuid)
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_submission_availability(uuid, uuid)
to service_role;


revoke execute on function
  portal.fn_submission_usage(uuid)
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_submission_usage(uuid)
to service_role;
