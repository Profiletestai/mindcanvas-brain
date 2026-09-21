-- ROLLBACK for:
-- 20260921171446_security_mcas_inheritance_triggers.sql
--
-- WARNING:
-- Restores direct execution permissions that existed before SEC-002U.

grant execute on function
  mcas.fn_inherit_partner_application_portal_org()
to PUBLIC, anon, authenticated, service_role;


grant execute on function
  mcas.fn_inherit_assessment_portal_org()
to PUBLIC, anon, authenticated, service_role;
