-- SEC-002L
-- Harden legacy public.organizations access.
--
-- Scope:
--   - Remove the legacy public "read all" policy.
--   - Remove unnecessary write privileges from anon/authenticated.
--   - Preserve SELECT for anon so the existing /health connectivity
--     check continues to work; RLS will return no organisation rows.
--   - Preserve SELECT for authenticated so existing legitimate
--     membership policies can continue to operate.
--   - Preserve full service_role access for server/admin workflows.
--
-- Important:
--   This migration deliberately does NOT modify:
--     public.org_members
--     public.org_memberships
--     public.portal_members
--     public.is_member(...)
--     public.member_of_row(...)
--     public.org_owner(...)
--
-- Those legacy helpers/policies will be reviewed separately.

do $migration$
begin
  -- Only target the specific legacy schema we audited.
  --
  -- Some MindCanvas Supabase environments contain a different historical
  -- organizations table. Do not apply this lockdown blindly to those schemas.
  if to_regclass('public.organizations') is null
     or to_regclass('public.org_memberships') is null then
    raise notice
      'Skipping legacy organizations RLS lockdown: expected legacy tables are not present.';
    return;
  end if;

  -- Only proceed when the vulnerable policy we audited is present.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'read all'
  ) then
    raise notice
      'Skipping legacy organizations RLS lockdown: "read all" policy is not present.';
    return;
  end if;

  -- RLS is already enabled on staging, but keep this explicit/idempotent.
  execute
    'alter table public.organizations enable row level security';

  -- Critical fix: remove unrestricted organisation visibility.
  execute
    'drop policy if exists "read all" on public.organizations';

  -- Reset inherited/client-facing privileges to least privilege.
  execute
    'revoke all privileges on table public.organizations from PUBLIC';

  execute
    'revoke all privileges on table public.organizations from anon';

  execute
    'revoke all privileges on table public.organizations from authenticated';

  -- Keep read capability only.
  --
  -- anon:
  -- Existing /health uses an anon Supabase client to run a SELECT.
  -- With "read all" removed, RLS will return no rows to anon.
  execute
    'grant select on table public.organizations to anon';

  -- authenticated:
  -- Existing legitimate legacy membership SELECT policies remain responsible
  -- for determining which organisation rows a signed-in user may see.
  execute
    'grant select on table public.organizations to authenticated';

  -- Server/admin workflows must remain unaffected.
  execute
    'grant all privileges on table public.organizations to service_role';
end
$migration$;