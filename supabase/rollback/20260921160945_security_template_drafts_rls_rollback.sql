-- ROLLBACK for:
-- 20260921160945_security_template_drafts_rls.sql
--
-- WARNING:
-- Restores the broad legacy client privileges that existed before SEC-002P.
-- Use only for a critical regression.

do $rollback$
begin
  if to_regclass('public.profiles_drafts') is not null then
    execute
      'alter table public.profiles_drafts disable row level security';

    execute
      'grant all privileges on table public.profiles_drafts to anon';

    execute
      'grant all privileges on table public.profiles_drafts to authenticated';

    execute
      'grant all privileges on table public.profiles_drafts to service_role';
  end if;

  if to_regclass('public.templates') is not null then
    execute
      'alter table public.templates disable row level security';

    execute
      'grant all privileges on table public.templates to anon';

    execute
      'grant all privileges on table public.templates to authenticated';

    execute
      'grant all privileges on table public.templates to service_role';
  end if;

  if to_regclass('public.template_questions') is not null then
    execute
      'alter table public.template_questions disable row level security';

    execute
      'grant all privileges on table public.template_questions to anon';

    execute
      'grant all privileges on table public.template_questions to authenticated';

    execute
      'grant all privileges on table public.template_questions to service_role';
  end if;

  if to_regclass('public.template_profiles') is not null then
    execute
      'alter table public.template_profiles disable row level security';

    execute
      'grant all privileges on table public.template_profiles to anon';

    execute
      'grant all privileges on table public.template_profiles to authenticated';

    execute
      'grant all privileges on table public.template_profiles to service_role';
  end if;

  if to_regclass('public.template_profile_content') is not null then
    execute
      'alter table public.template_profile_content disable row level security';

    execute
      'grant all privileges on table public.template_profile_content to anon';

    execute
      'grant all privileges on table public.template_profile_content to authenticated';

    execute
      'grant all privileges on table public.template_profile_content to service_role';
  end if;

  if to_regclass('public.template_report_templates') is not null then
    execute
      'alter table public.template_report_templates disable row level security';

    execute
      'grant all privileges on table public.template_report_templates to anon';

    execute
      'grant all privileges on table public.template_report_templates to authenticated';

    execute
      'grant all privileges on table public.template_report_templates to service_role';
  end if;
end
$rollback$;