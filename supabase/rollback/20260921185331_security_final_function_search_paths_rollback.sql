-- ROLLBACK for:
-- 20260921185331_security_final_function_search_paths.sql
--
-- Restores the previous mutable/default search_path.

alter function mcas.next_reverse_profile_run_number()
  reset search_path;


alter function portal.compute_and_upsert_totals(uuid)
  reset search_path;

alter function portal.gen_token(integer)
  reset search_path;


alter function public.mc_get_profiles_with_approved(uuid, uuid)
  reset search_path;

alter function public.is_member(uuid)
  reset search_path;


alter function visibility.compute_pillar_signals_for_submission(uuid)
  reset search_path;

alter function visibility.update_results_signals(uuid)
  reset search_path;