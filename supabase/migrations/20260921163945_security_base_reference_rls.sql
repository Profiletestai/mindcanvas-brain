-- SEC-002R
-- Harden final legacy public reference tables.
--
-- Scope:
--   - Enable RLS on base question/option reference tables.
--   - Enable RLS on legacy public.frameworks.
--   - Remove direct anon/authenticated access.
--   - Preserve service_role access for legacy server-side routes.
--
-- Note:
-- Active MCAS uses mcas.frameworks.
-- Modern report/admin framework tooling uses portal.frameworks.
-- This migration only affects the small legacy public.frameworks table.

do $migration$
begin
  if to_regclass('public.base_questions') is not null then
    execute 'alter table public.base_questions enable row level security';
    execute 'revoke all privileges on table public.base_questions from PUBLIC';
    execute 'revoke all privileges on table public.base_questions from anon';
    execute 'revoke all privileges on table public.base_questions from authenticated';
    execute 'grant all privileges on table public.base_questions to service_role';
  end if;

  if to_regclass('public.base_options') is not null then
    execute 'alter table public.base_options enable row level security';
    execute 'revoke all privileges on table public.base_options from PUBLIC';
    execute 'revoke all privileges on table public.base_options from anon';
    execute 'revoke all privileges on table public.base_options from authenticated';
    execute 'grant all privileges on table public.base_options to service_role';
  end if;

  if to_regclass('public.frameworks') is not null then
    execute 'alter table public.frameworks enable row level security';
    execute 'revoke all privileges on table public.frameworks from PUBLIC';
    execute 'revoke all privileges on table public.frameworks from anon';
    execute 'revoke all privileges on table public.frameworks from authenticated';
    execute 'grant all privileges on table public.frameworks to service_role';
  end if;
end
$migration$;