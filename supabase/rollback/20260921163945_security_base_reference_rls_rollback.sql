-- ROLLBACK for:
-- 20260921163945_security_base_reference_rls.sql
--
-- WARNING:
-- Restores the broad legacy access that existed before SEC-002R.
-- Use only for a critical regression.

do $rollback$
begin
  if to_regclass('public.base_questions') is not null then
    execute 'alter table public.base_questions disable row level security';
    execute 'grant all privileges on table public.base_questions to anon';
    execute 'grant all privileges on table public.base_questions to authenticated';
    execute 'grant all privileges on table public.base_questions to service_role';
  end if;

  if to_regclass('public.base_options') is not null then
    execute 'alter table public.base_options disable row level security';
    execute 'grant all privileges on table public.base_options to anon';
    execute 'grant all privileges on table public.base_options to authenticated';
    execute 'grant all privileges on table public.base_options to service_role';
  end if;

  if to_regclass('public.frameworks') is not null then
    execute 'alter table public.frameworks disable row level security';
    execute 'grant all privileges on table public.frameworks to anon';
    execute 'grant all privileges on table public.frameworks to authenticated';
    execute 'grant all privileges on table public.frameworks to service_role';
  end if;
end
$rollback$;