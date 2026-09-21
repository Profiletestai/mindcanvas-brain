-- ROLLBACK for:
-- 20260921080029_security_visibility_rls_lockdown.sql
--
-- Restores the Visibility grants, authenticated read policies, and privileged
-- report RPC execution permissions that existed immediately before SEC-002C
-- remediation.
--
-- USE ONLY if the lockdown migration must be reversed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Restore previous table privileges
-- ---------------------------------------------------------------------------

grant select, insert, update, delete
  on table visibility.submissions
  to anon, authenticated;

grant select, insert, update, delete
  on table visibility.results
  to anon, authenticated;

grant select, insert, update, delete
  on table visibility.generated_reports
  to anon, authenticated;

grant select, insert, update, delete
  on table visibility.submissions
  to service_role;

grant select, insert, update, delete
  on table visibility.results
  to service_role;

grant select, insert, update, delete
  on table visibility.generated_reports
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Restore previous broad authenticated SELECT policies
-- ---------------------------------------------------------------------------

drop policy if exists visibility_submissions_read_auth
  on visibility.submissions;

create policy visibility_submissions_read_auth
  on visibility.submissions
  for select
  to authenticated
  using (true);

drop policy if exists visibility_results_read_auth
  on visibility.results;

create policy visibility_results_read_auth
  on visibility.results
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 3. Restore previous privileged RPC execution permissions
-- ---------------------------------------------------------------------------

grant execute
  on function visibility.get_generated_report(uuid, text, text, integer)
  to public, anon, authenticated, service_role;

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
  to public, anon, authenticated, service_role;

commit;
