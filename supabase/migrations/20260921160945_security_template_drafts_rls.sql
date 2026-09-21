-- SEC-002P
-- Harden legacy template and profile-draft tables.
--
-- Scope:
--   - Enable RLS on template/draft tables.
--   - Remove all direct anon/authenticated privileges.
--   - Preserve service_role access for server-side admin routes.
--
-- These tables are intentionally server-only after this migration.

do $migration$
begin
  if to_regclass('public.profiles_drafts') is not null then
    execute
      'alter table public.profiles_drafts enable row level security';

    execute
      'revoke all privileges on table public.profiles_drafts from PUBLIC';

    execute
      'revoke all privileges on table public.profiles_drafts from anon';

    execute
      'revoke all privileges on table public.profiles_drafts from authenticated';

    execute
      'grant all privileges on table public.profiles_drafts to service_role';
  end if;

  if to_regclass('public.templates') is not null then
    execute
      'alter table public.templates enable row level security';

    execute
      'revoke all privileges on table public.templates from PUBLIC';

    execute
      'revoke all privileges on table public.templates from anon';

    execute
      'revoke all privileges on table public.templates from authenticated';

    execute
      'grant all privileges on table public.templates to service_role';
  end if;

  if to_regclass('public.template_questions') is not null then
    execute
      'alter table public.template_questions enable row level security';

    execute
      'revoke all privileges on table public.template_questions from PUBLIC';

    execute
      'revoke all privileges on table public.template_questions from anon';

    execute
      'revoke all privileges on table public.template_questions from authenticated';

    execute
      'grant all privileges on table public.template_questions to service_role';
  end if;

  if to_regclass('public.template_profiles') is not null then
    execute
      'alter table public.template_profiles enable row level security';

    execute
      'revoke all privileges on table public.template_profiles from PUBLIC';

    execute
      'revoke all privileges on table public.template_profiles from anon';

    execute
      'revoke all privileges on table public.template_profiles from authenticated';

    execute
      'grant all privileges on table public.template_profiles to service_role';
  end if;

  if to_regclass('public.template_profile_content') is not null then
    execute
      'alter table public.template_profile_content enable row level security';

    execute
      'revoke all privileges on table public.template_profile_content from PUBLIC';

    execute
      'revoke all privileges on table public.template_profile_content from anon';

    execute
      'revoke all privileges on table public.template_profile_content from authenticated';

    execute
      'grant all privileges on table public.template_profile_content to service_role';
  end if;

  if to_regclass('public.template_report_templates') is not null then
    execute
      'alter table public.template_report_templates enable row level security';

    execute
      'revoke all privileges on table public.template_report_templates from PUBLIC';

    execute
      'revoke all privileges on table public.template_report_templates from anon';

    execute
      'revoke all privileges on table public.template_report_templates from authenticated';

    execute
      'grant all privileges on table public.template_report_templates to service_role';
  end if;
end
$migration$;