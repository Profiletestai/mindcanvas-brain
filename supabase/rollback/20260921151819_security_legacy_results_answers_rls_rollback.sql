-- ROLLBACK for:
-- 20260921151819_security_legacy_results_answers_rls.sql
--
-- WARNING:
-- This restores the broad legacy client privileges that existed before
-- SEC-002N. Use only for a critical regression.

do $rollback$
begin
  if to_regclass('public.org_test_answers') is not null then
    execute
      'alter table public.org_test_answers disable row level security';

    execute
      'grant all privileges on table public.org_test_answers to anon';

    execute
      'grant all privileges on table public.org_test_answers to authenticated';

    execute
      'grant all privileges on table public.org_test_answers to service_role';
  end if;

  if to_regclass('public.test_results') is not null then
    execute
      'alter table public.test_results disable row level security';

    execute
      'grant all privileges on table public.test_results to anon';

    execute
      'grant all privileges on table public.test_results to authenticated';

    execute
      'grant all privileges on table public.test_results to service_role';
  end if;
end
$rollback$;