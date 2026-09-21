-- SEC-002V
-- Restrict portal test-access trigger functions.
--
-- Scope:
--   - Remove PUBLIC/anon/authenticated EXECUTE.
--   - Preserve service_role EXECUTE.
--
-- These functions are attached to portal table triggers and are not intended
-- to be called directly through the Data API. Their existing SECURITY DEFINER
-- status and fixed search_path = portal are intentionally preserved.

revoke execute on function
  portal.fn_entitlements_sync_test_access()
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_entitlements_sync_test_access()
to service_role;


revoke execute on function
  portal.fn_orgs_sync_test_access()
from PUBLIC, anon, authenticated;

grant execute on function
  portal.fn_orgs_sync_test_access()
to service_role;