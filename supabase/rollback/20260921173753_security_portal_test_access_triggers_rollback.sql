-- ROLLBACK for:
-- 20260921173753_security_portal_test_access_triggers.sql
--
-- WARNING:
-- Restores the direct RPC execution permissions that existed before SEC-002V.

grant execute on function
  portal.fn_entitlements_sync_test_access()
to PUBLIC, anon, authenticated, service_role;


grant execute on function
  portal.fn_orgs_sync_test_access()
to PUBLIC, anon, authenticated, service_role;