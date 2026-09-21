-- SEC-002G: Make legacy org profile/framework tables server-only
--
-- Current application usage of public.org_profiles and public.org_frameworks
-- is server-side through the Supabase service-role client.
--
-- Before remediation, anon and authenticated have broad table privileges, and
-- authenticated also has permissive ALL policies using true/with check true.
-- That combination allows signed-in users to access rows across organisations.
--
-- This migration:
-- - removes direct table privileges from anon and authenticated
-- - removes the two broad authenticated ALL policies
-- - preserves service_role access
-- - leaves the narrower existing org_profiles read policies unchanged
--
-- No table definitions or data are changed.

begin;

revoke all privileges on table public.org_profiles
  from anon, authenticated;

revoke all privileges on table public.org_frameworks
  from anon, authenticated;

drop policy if exists "org_profiles_auth_rw"
  on public.org_profiles;

drop policy if exists "org_frameworks_auth_rw"
  on public.org_frameworks;

commit;