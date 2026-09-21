-- ROLLBACK for:
-- 20260921164950_security_legacy_test_link_rpc.sql
--
-- WARNING:
-- Restores the legacy public execution permissions.

grant execute on function
  public.create_test_link_by_id(text, uuid, text, integer, integer)
to PUBLIC, anon, authenticated, service_role;

alter function
  public.create_test_link_by_id(text, uuid, text, integer, integer)
reset search_path;


grant execute on function
  public.create_test_link_by_slug(text, text, text, integer, integer)
to PUBLIC, anon, authenticated, service_role;

alter function
  public.create_test_link_by_slug(text, text, text, integer, integer)
reset search_path;