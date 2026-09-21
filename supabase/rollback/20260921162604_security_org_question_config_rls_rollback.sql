-- ROLLBACK for:
-- 20260921162604_security_org_question_config_rls.sql
--
-- WARNING:
-- Restores the broad legacy client access and public seed RPC execution
-- that existed before SEC-002Q.
-- Use only for a critical regression.

do $rollback$
begin
  if to_regclass('public.org_frequencies') is not null then
    execute 'alter table public.org_frequencies disable row level security';
    execute 'grant all privileges on table public.org_frequencies to anon';
    execute 'grant all privileges on table public.org_frequencies to authenticated';
    execute 'grant all privileges on table public.org_frequencies to service_role';
  end if;

  if to_regclass('public.org_questions') is not null then
    execute 'alter table public.org_questions disable row level security';
    execute 'grant all privileges on table public.org_questions to anon';
    execute 'grant all privileges on table public.org_questions to authenticated';
    execute 'grant all privileges on table public.org_questions to service_role';
  end if;

  if to_regclass('public.org_question_options') is not null then
    execute 'alter table public.org_question_options disable row level security';
    execute 'grant all privileges on table public.org_question_options to anon';
    execute 'grant all privileges on table public.org_question_options to authenticated';
    execute 'grant all privileges on table public.org_question_options to service_role';
  end if;

  if to_regclass('public.org_question_weights') is not null then
    execute 'alter table public.org_question_weights disable row level security';
    execute 'grant all privileges on table public.org_question_weights to anon';
    execute 'grant all privileges on table public.org_question_weights to authenticated';
    execute 'grant all privileges on table public.org_question_weights to service_role';
  end if;

  if to_regclass('public.org_test_defs') is not null then
    execute 'alter table public.org_test_defs disable row level security';
    execute 'grant all privileges on table public.org_test_defs to anon';
    execute 'grant all privileges on table public.org_test_defs to authenticated';
    execute 'grant all privileges on table public.org_test_defs to service_role';
  end if;

  if to_regclass('public.org_test_questions') is not null then
    execute 'alter table public.org_test_questions disable row level security';
    execute 'grant all privileges on table public.org_test_questions to anon';
    execute 'grant all privileges on table public.org_test_questions to authenticated';
    execute 'grant all privileges on table public.org_test_questions to service_role';
  end if;

  if to_regprocedure('public.seed_base_questions(text)') is not null then
    execute
      'grant execute on function public.seed_base_questions(text)
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function public.seed_base_questions(text)
       reset search_path';
  end if;
end
$rollback$;