-- SEC-002S
-- Restrict legacy test-link SECURITY DEFINER RPCs.
--
-- Scope:
--   - Remove PUBLIC/anon/authenticated EXECUTE.
--   - Preserve service_role EXECUTE for any server-side legacy use.
--   - Set an explicit safe search_path.
--
-- These RPCs are not referenced by the current staging codebase and have
-- no database-function/view dependencies.

revoke execute on function
  public.create_test_link_by_id(text, uuid, text, integer, integer)
from PUBLIC, anon, authenticated;

grant execute on function
  public.create_test_link_by_id(text, uuid, text, integer, integer)
to service_role;

alter function
  public.create_test_link_by_id(text, uuid, text, integer, integer)
set search_path = pg_catalog, public, extensions;


revoke execute on function
  public.create_test_link_by_slug(text, text, text, integer, integer)
from PUBLIC, anon, authenticated;

grant execute on function
  public.create_test_link_by_slug(text, text, text, integer, integer)
to service_role;

alter function
  public.create_test_link_by_slug(text, text, text, integer, integer)
set search_path = pg_catalog, public, extensions;