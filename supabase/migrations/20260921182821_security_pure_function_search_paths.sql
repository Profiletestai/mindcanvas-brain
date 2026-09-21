-- SEC-002Y
-- Pin search_path for pure helper functions.
--
-- Scope:
--   - public.slugify
--   - Visibility JSON/matching/scoring helpers
--
-- These functions are pure helpers:
--   - no table writes
--   - no dynamic SQL
--   - no SECURITY DEFINER behaviour
--   - internal Visibility function calls are explicitly schema-qualified
--
-- pg_catalog is therefore the narrowest safe search_path.
--
-- Function bodies, permissions and behaviour are unchanged.

alter function public.slugify(text)
  set search_path = pg_catalog;


alter function visibility.jtext(jsonb, text)
  set search_path = pg_catalog;

alter function visibility.jint(jsonb, text)
  set search_path = pg_catalog;

alter function visibility.eq_if_present(jsonb, jsonb, text)
  set search_path = pg_catalog;

alter function visibility.level_match(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility.pillar_band_match(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility.pillar_extremes_match(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility.pattern_tags_match(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility.kb_match_ok(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility.tier_to_num(text)
  set search_path = pg_catalog;

alter function visibility.pillar_band(numeric)
  set search_path = pg_catalog;

alter function visibility._lower(text)
  set search_path = pg_catalog;

alter function visibility._matches_any(text, jsonb)
  set search_path = pg_catalog;

alter function visibility._tags_any(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility._level_in_range(integer, jsonb)
  set search_path = pg_catalog;

alter function visibility._pillar_band_match(jsonb, jsonb)
  set search_path = pg_catalog;

alter function visibility.kb_match_score(jsonb, jsonb)
  set search_path = pg_catalog;