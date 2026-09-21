-- SEC-002U
-- Restrict MCAS ownership-inheritance trigger functions.
--
-- Scope:
--   - Remove PUBLIC/anon/authenticated EXECUTE.
--   - Preserve service_role EXECUTE.
--
-- These functions are attached to table triggers and are not application RPCs.
-- Their existing SECURITY DEFINER and fixed search_path are intentionally
-- preserved so the triggers continue to populate portal_org_id correctly.

revoke execute on function
  mcas.fn_inherit_partner_application_portal_org()
from PUBLIC, anon, authenticated;

grant execute on function
  mcas.fn_inherit_partner_application_portal_org()
to service_role;


revoke execute on function
  mcas.fn_inherit_assessment_portal_org()
from PUBLIC, anon, authenticated;

grant execute on function
  mcas.fn_inherit_assessment_portal_org()
to service_role;