-- SEC-002C: Visibility tenant-isolation lockdown
--
-- Context:
-- The application now accesses Visibility submissions/results/generated reports
-- through server-side service-role clients.
--
-- Before this migration:
--   - visibility.submissions and visibility.results allowed every authenticated
--     Supabase user to SELECT every row via USING (true).
--   - anon and authenticated both held direct SELECT/INSERT/UPDATE/DELETE grants
--     on submissions, results and generated_reports.
--   - visibility.get_generated_report(...) and
--     visibility.upsert_generated_report(...) are SECURITY DEFINER functions
--     executable by PUBLIC/anon/authenticated, which can bypass table RLS/grants.
--
-- This migration removes direct client access while preserving service-role
-- access for the hardened server-side application paths.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove broad authenticated read policies
-- ---------------------------------------------------------------------------

drop policy if exists visibility_submissions_read_auth
  on visibility.submissions;

drop policy if exists visibility_results_read_auth
  on visibility.results;

-- ---------------------------------------------------------------------------
-- 2. Remove direct anon/authenticated table privileges
-- ---------------------------------------------------------------------------

revoke select, insert, update, delete
  on table visibility.submissions
  from anon, authenticated;

revoke select, insert, update, delete
  on table visibility.results
  from anon, authenticated;

revoke select, insert, update, delete
  on table visibility.generated_reports
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Remove direct execution of privileged Visibility report RPCs
-- ---------------------------------------------------------------------------

revoke execute
  on function visibility.get_generated_report(uuid, text, text, integer)
  from public, anon, authenticated;

revoke execute
  on function visibility.upsert_generated_report(
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    text,
    integer
  )
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Explicitly preserve service-role access
-- ---------------------------------------------------------------------------

grant select, insert, update, delete
  on table visibility.submissions
  to service_role;

grant select, insert, update, delete
  on table visibility.results
  to service_role;

grant select, insert, update, delete
  on table visibility.generated_reports
  to service_role;

grant execute
  on function visibility.get_generated_report(uuid, text, text, integer)
  to service_role;

grant execute
  on function visibility.upsert_generated_report(
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    text,
    integer
  )
  to service_role;

commit;
