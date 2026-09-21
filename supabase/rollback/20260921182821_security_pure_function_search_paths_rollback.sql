-- ROLLBACK for:
-- 20260921182821_security_pure_function_search_paths.sql
--
-- Restores the previous mutable/default search_path.

alter function public.slugify(text)
  reset search_path;


alter function visibility.jtext(jsonb, text)
  reset search_path;

alter function visibility.jint(jsonb, text)
  reset search_path;

alter function visibility.eq_if_present(jsonb, jsonb, text)
  reset search_path;

alter function visibility.level_match(jsonb, jsonb)
  reset search_path;

alter function visibility.pillar_band_match(jsonb, jsonb)
  reset search_path;

alter function visibility.pillar_extremes_match(jsonb, jsonb)
  reset search_path;

alter function visibility.pattern_tags_match(jsonb, jsonb)
  reset search_path;

alter function visibility.kb_match_ok(jsonb, jsonb)
  reset search_path;

alter function visibility.tier_to_num(text)
  reset search_path;

alter function visibility.pillar_band(numeric)
  reset search_path;

alter function visibility._lower(text)
  reset search_path;

alter function visibility._matches_any(text, jsonb)
  reset search_path;

alter function visibility._tags_any(jsonb, jsonb)
  reset search_path;

alter function visibility._level_in_range(integer, jsonb)
  reset search_path;

alter function visibility._pillar_band_match(jsonb, jsonb)
  reset search_path;

alter function visibility.kb_match_score(jsonb, jsonb)
  reset search_path;