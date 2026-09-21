-- ROLLBACK for:
-- 20260921120259_security_legacy_org_tables_server_only.sql
--
-- Restores the exact broad table grants and authenticated ALL policies that
-- existed before SEC-002G.
--
-- The narrower org_profiles read policies were not changed by the migration
-- and therefore do not need to be recreated here.

begin;

grant all privileges on table public.org_profiles
  to anon, authenticated;

grant all privileges on table public.org_frameworks
  to anon, authenticated;

create policy "org_profiles_auth_rw"
  on public.org_profiles
  for all
  to authenticated
  using (true)
  with check (true);

create policy "org_frameworks_auth_rw"
  on public.org_frameworks
  for all
  to authenticated
  using (true)
  with check (true);

commit;
