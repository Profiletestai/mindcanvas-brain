-- ROLLBACK for:
-- 20260921134038_security_legacy_organizations_rls.sql
--
-- WARNING:
-- This rollback intentionally restores the previous insecure configuration.
-- Use only if the forward migration causes a critical regression.

do $rollback$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.org_memberships') is null then
    raise notice
      'Skipping rollback: expected legacy organizations schema is not present.';
    return;
  end if;

  -- Restore the previous broad table grants.
  execute
    'grant all privileges on table public.organizations to anon';

  execute
    'grant all privileges on table public.organizations to authenticated';

  execute
    'grant all privileges on table public.organizations to service_role';

  -- Restore the former unrestricted SELECT policy.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'read all'
  ) then
    execute
      'create policy "read all"
       on public.organizations
       for select
       to PUBLIC
       using (true)';
  end if;
end
$rollback$;