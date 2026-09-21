-- SEC-002N
-- Harden legacy public result / answer configuration tables.
--
-- Findings:
--   - public.org_test_answers is legacy question/answer-option configuration.
--   - It is used by server-side admin routes through the service role.
--   - public.test_results is empty in staging and absent in current production.
--   - Active assessment result flows use portal.test_results instead.
--
-- Scope:
--   - Enable RLS on both legacy public tables when present.
--   - Remove all direct anon/authenticated privileges.
--   - Preserve full service_role access for server/admin workflows.
--
-- No client-facing policies are created intentionally: these tables are
-- server-only after this migration.

do $migration$
begin
  if to_regclass('public.org_test_answers') is not null then
    execute
      'alter table public.org_test_answers enable row level security';

    execute
      'revoke all privileges on table public.org_test_answers from PUBLIC';

    execute
      'revoke all privileges on table public.org_test_answers from anon';

    execute
      'revoke all privileges on table public.org_test_answers from authenticated';

    execute
      'grant all privileges on table public.org_test_answers to service_role';
  end if;

  if to_regclass('public.test_results') is not null then
    execute
      'alter table public.test_results enable row level security';

    execute
      'revoke all privileges on table public.test_results from PUBLIC';

    execute
      'revoke all privileges on table public.test_results from anon';

    execute
      'revoke all privileges on table public.test_results from authenticated';

    execute
      'grant all privileges on table public.test_results to service_role';
  end if;
end
$migration$;