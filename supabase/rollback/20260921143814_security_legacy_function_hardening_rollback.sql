-- ROLLBACK for:
-- 20260921143814_security_legacy_function_hardening.sql
--
-- WARNING:
-- This rollback restores the broader legacy privileges that existed before
-- SEC-002M. Use only if the forward migration causes a critical regression.

do $rollback$
begin
  if to_regclass('public.org_profile_compatibility') is not null then
    execute
      'grant all privileges on table public.org_profile_compatibility to anon';

    execute
      'grant all privileges on table public.org_profile_compatibility to authenticated';

    execute
      'grant all privileges on table public.org_profile_compatibility to service_role';
  end if;

  if to_regprocedure('public.member_of_row(uuid)') is not null then
    execute
      'grant execute on function public.member_of_row(uuid)
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function public.member_of_row(uuid)
       set search_path = public';
  end if;

  if to_regprocedure('public.org_owner(uuid)') is not null then
    execute
      'grant execute on function public.org_owner(uuid)
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function public.org_owner(uuid)
       reset search_path';
  end if;

  if to_regprocedure('public.organizations_autofill()') is not null then
    execute
      'grant execute on function public.organizations_autofill()
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function public.organizations_autofill()
       reset search_path';
  end if;

  if to_regprocedure('public.set_org_owner()') is not null then
    execute
      'grant execute on function public.set_org_owner()
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function public.set_org_owner()
       reset search_path';
  end if;
end
$rollback$;