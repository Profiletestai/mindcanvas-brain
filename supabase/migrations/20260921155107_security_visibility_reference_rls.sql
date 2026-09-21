-- SEC-002O
-- Harden Visibility reference / knowledge tables and related RPC access.
--
-- Scope:
--   - Enable RLS on Visibility reference/config tables.
--   - Remove direct anon/authenticated table privileges.
--   - Preserve service_role access used by server-side report/scoring routes.
--   - Restrict related SECURITY INVOKER RPCs to service_role.
--   - Set explicit safe search_path values.
--
-- Note:
--   compute_pillars_and_patterns has a separate pre-existing array-append bug
--   for some score combinations. That is intentionally not changed here.

do $migration$
begin
  if to_regclass('visibility.kb_blocks') is not null then
    execute
      'alter table visibility.kb_blocks enable row level security';

    execute
      'revoke all privileges on table visibility.kb_blocks from PUBLIC';

    execute
      'revoke all privileges on table visibility.kb_blocks from anon';

    execute
      'revoke all privileges on table visibility.kb_blocks from authenticated';

    execute
      'grant all privileges on table visibility.kb_blocks to service_role';
  end if;

  if to_regclass('visibility.pillar_map') is not null then
    execute
      'alter table visibility.pillar_map enable row level security';

    execute
      'revoke all privileges on table visibility.pillar_map from PUBLIC';

    execute
      'revoke all privileges on table visibility.pillar_map from anon';

    execute
      'revoke all privileges on table visibility.pillar_map from authenticated';

    execute
      'grant all privileges on table visibility.pillar_map to service_role';
  end if;

  if to_regclass('visibility.pillar_band_rules') is not null then
    execute
      'alter table visibility.pillar_band_rules enable row level security';

    execute
      'revoke all privileges on table visibility.pillar_band_rules from PUBLIC';

    execute
      'revoke all privileges on table visibility.pillar_band_rules from anon';

    execute
      'revoke all privileges on table visibility.pillar_band_rules from authenticated';

    execute
      'grant all privileges on table visibility.pillar_band_rules to service_role';
  end if;

  if to_regprocedure(
    'visibility.kb_select_blocks(text,text,jsonb,integer)'
  ) is not null then
    execute
      'revoke execute on function visibility.kb_select_blocks(text,text,jsonb,integer)
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function visibility.kb_select_blocks(text,text,jsonb,integer)
       to service_role';

    execute
      'alter function visibility.kb_select_blocks(text,text,jsonb,integer)
       set search_path = pg_catalog, visibility';
  end if;

  if to_regprocedure(
    'visibility.compute_pillars_and_patterns(jsonb)'
  ) is not null then
    execute
      'revoke execute on function visibility.compute_pillars_and_patterns(jsonb)
       from PUBLIC, anon, authenticated';

    execute
      'grant execute on function visibility.compute_pillars_and_patterns(jsonb)
       to service_role';

    execute
      'alter function visibility.compute_pillars_and_patterns(jsonb)
       set search_path = pg_catalog, visibility';
  end if;
end
$migration$;