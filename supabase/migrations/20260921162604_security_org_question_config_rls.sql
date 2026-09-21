-- SEC-002Q
-- Harden legacy organisation question/config tables and seed RPC.
--
-- Scope:
--   - Enable RLS on legacy org question/config tables.
--   - Remove direct anon/authenticated privileges.
--   - Preserve service_role access used by server-side routes.
--   - Restrict seed_base_questions() to service_role.
--   - Set an explicit safe search_path on the SECURITY DEFINER RPC.
--
-- Note:
-- seed_base_questions() appears stale against the current org_questions schema.
-- Its behaviour is intentionally not changed in this migration.

do $migration$
begin
  if to_regclass('public.org_frequencies') is not null then
    execute 'alter table public.org_frequencies enable row level security';
    execute 'revoke all privileges on table public.org_frequencies from PUBLIC';
    execute 'revoke all privileges on table public.org_frequencies from anon';
    execute 'revoke all privileges on table public.org_frequencies from authenticated';
    execute 'grant all privileges on table public.org_frequencies to service_role';
  end if;

  if to_regclass('public.org_questions') is not null then
    execute 'alter table public.org_questions enable row level security';
    execute 'revoke all privileges on table public.org_questions from PUBLIC';
    execute 'revoke all privileges on table public.org_questions from anon';
    execute 'revoke all privileges on table public.org_questions from authenticated';
    execute 'grant all privileges on table public.org_questions to service_role';
  end if;

  if to_regclass('public.org_question_options') is not null then
    execute 'alter table public.org_question_options enable row level security';
    execute 'revoke all privileges on table public.org_question_options from PUBLIC';
    execute 'revoke all privileges on table public.org_question_options from anon';
    execute 'revoke all privileges on table public.org_question_options from authenticated';
    execute 'grant all privileges on table public.org_question_options to service_role';
  end if;

  if to_regclass('public.org_question_weights') is not null then
    execute 'alter table public.org_question_weights enable row level security';
    execute 'revoke all privileges on table public.org_question_weights from PUBLIC';
    execute 'revoke all privileges on table public.org_question_weights from anon';
    execute 'revoke all privileges on table public.org_question_weights from authenticated';
    execute 'grant all privileges on table public.org_question_weights to service_role';
  end if;

  if to_regclass('public.org_test_defs') is not null then
    execute 'alter table public.org_test_defs enable row level security';
    execute 'revoke all privileges on table public.org_test_defs from PUBLIC';
    execute 'revoke all privileges on table public.org_test_defs from anon';
    execute 'revoke all privileges on table public.org_test_defs from authenticated';
    execute 'grant all privileges on table public.org_test_defs to service_role';
  end if;

  if to_regclass('public.org_test_questions') is not null then
    execute 'alter table public.org_test_questions enable row level security';
    execute 'revoke all privileges on table public.org_test_questions from PUBLIC';
    execute 'revoke all privileges on table public.org_test_questions from anon';
    execute 'revoke all privileges on table public.org_test_questions from authenticated';
    execute 'grant all privileges on table public.org_test_questions to service_role';
  end if;

  if to_regprocedure('public.seed_base_questions(text)') is not null then
    execute
      'revoke execute on function public.seed_base_questions(text)
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function public.seed_base_questions(text)
       to service_role';

    execute
      'alter function public.seed_base_questions(text)
       set search_path = pg_catalog, public';
  end if;
end
$migration$;