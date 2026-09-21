-- SEC-002M
-- Harden legacy SECURITY DEFINER helpers and compatibility-table access.
--
-- Scope:
--   - Remove direct anon/authenticated access to org_profile_compatibility.
--   - Preserve service_role access used by server-side compatibility routes.
--   - Remove public/client EXECUTE from legacy SECURITY DEFINER helpers.
--   - Preserve trigger behaviour.
--   - Set explicit safe search_path values.
--
-- Intentionally NOT changed:
--   public.create_org_and_owner(...)
--   public.org_id_from_auth()
--
-- Those two functions are actively used by authenticated legacy application
-- flows and are already restricted to authenticated/service_role.

do $migration$
begin
  -- -------------------------------------------------------------------------
  -- 1. Compatibility data is server-side only
  -- -------------------------------------------------------------------------

  if to_regclass('public.org_profile_compatibility') is not null then
    execute
      'revoke all privileges on table public.org_profile_compatibility from PUBLIC';

    execute
      'revoke all privileges on table public.org_profile_compatibility from anon';

    execute
      'revoke all privileges on table public.org_profile_compatibility from authenticated';

    execute
      'grant all privileges on table public.org_profile_compatibility to service_role';
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Legacy SECURITY DEFINER helpers
  -- -------------------------------------------------------------------------

  if to_regprocedure('public.member_of_row(uuid)') is not null then
    execute
      'revoke execute on function public.member_of_row(uuid)
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function public.member_of_row(uuid)
       to service_role';

    execute
      'alter function public.member_of_row(uuid)
       set search_path = pg_catalog, public';
  end if;

  if to_regprocedure('public.org_owner(uuid)') is not null then
    execute
      'revoke execute on function public.org_owner(uuid)
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function public.org_owner(uuid)
       to service_role';

    execute
      'alter function public.org_owner(uuid)
       set search_path = pg_catalog, public';
  end if;

  -- -------------------------------------------------------------------------
  -- 3. Trigger helpers
  --
  -- PostgreSQL triggers do not require the invoking application role to have
  -- direct EXECUTE permission on the trigger function, so removing PUBLIC /
  -- anon / authenticated RPC access does not prevent the trigger from firing.
  -- -------------------------------------------------------------------------

  if to_regprocedure('public.organizations_autofill()') is not null then
    execute
      'revoke execute on function public.organizations_autofill()
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function public.organizations_autofill()
       to service_role';

    execute
      'alter function public.organizations_autofill()
       set search_path = pg_catalog, public';
  end if;

  if to_regprocedure('public.set_org_owner()') is not null then
    execute
      'revoke execute on function public.set_org_owner()
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function public.set_org_owner()
       to service_role';

    execute
      'alter function public.set_org_owner()
       set search_path = pg_catalog, public';
  end if;
end
$migration$;
