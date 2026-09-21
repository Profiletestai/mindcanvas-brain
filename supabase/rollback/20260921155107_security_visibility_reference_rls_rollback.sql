-- ROLLBACK for:
-- 20260921155107_security_visibility_reference_rls.sql
--
-- WARNING:
-- This restores the broader legacy Visibility access that existed before
-- SEC-002O. Use only for a critical regression.

do $rollback$
begin
  if to_regclass('visibility.kb_blocks') is not null then
    execute
      'alter table visibility.kb_blocks disable row level security';

    execute
      'grant all privileges on table visibility.kb_blocks to anon';

    execute
      'grant all privileges on table visibility.kb_blocks to authenticated';

    execute
      'grant all privileges on table visibility.kb_blocks to service_role';
  end if;

  if to_regclass('visibility.pillar_map') is not null then
    execute
      'alter table visibility.pillar_map disable row level security';

    execute
      'grant all privileges on table visibility.pillar_map to anon';

    execute
      'grant all privileges on table visibility.pillar_map to authenticated';

    execute
      'grant all privileges on table visibility.pillar_map to service_role';
  end if;

  if to_regclass('visibility.pillar_band_rules') is not null then
    execute
      'alter table visibility.pillar_band_rules disable row level security';

    execute
      'grant all privileges on table visibility.pillar_band_rules to anon';

    execute
      'grant all privileges on table visibility.pillar_band_rules to authenticated';

    execute
      'grant all privileges on table visibility.pillar_band_rules to service_role';
  end if;

  if to_regprocedure(
    'visibility.kb_select_blocks(text,text,jsonb,integer)'
  ) is not null then
    execute
      'grant execute on function visibility.kb_select_blocks(text,text,jsonb,integer)
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function visibility.kb_select_blocks(text,text,jsonb,integer)
       reset search_path';
  end if;

  if to_regprocedure(
    'visibility.compute_pillars_and_patterns(jsonb)'
  ) is not null then
    execute
      'grant execute on function visibility.compute_pillars_and_patterns(jsonb)
       to PUBLIC, anon, authenticated, service_role';

    execute
      'alter function visibility.compute_pillars_and_patterns(jsonb)
       reset search_path';
  end if;
end
$rollback$;