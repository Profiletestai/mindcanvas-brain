-- SEC-002Z
-- Pin search_path for the final application-specific functions.
--
-- Scope:
--   - MCAS reverse-profile run number
--   - Portal assessment totals
--   - Portal token generation
--   - Legacy profile lookup
--   - Legacy membership/RLS helper
--   - Visibility pillar signal calculation
--   - Visibility result signal updater
--
-- This migration changes search_path only.
-- It intentionally does NOT change function bodies, permissions,
-- RLS behaviour, or repair pre-existing function defects.

alter function mcas.next_reverse_profile_run_number()
  set search_path = pg_catalog;


alter function portal.compute_and_upsert_totals(uuid)
  set search_path = pg_catalog;

alter function portal.gen_token(integer)
  set search_path = pg_catalog, extensions;


alter function public.mc_get_profiles_with_approved(uuid, uuid)
  set search_path = pg_catalog, public;

alter function public.is_member(uuid)
  set search_path = pg_catalog;


alter function visibility.compute_pillar_signals_for_submission(uuid)
  set search_path = pg_catalog;

alter function visibility.update_results_signals(uuid)
  set search_path = pg_catalog;