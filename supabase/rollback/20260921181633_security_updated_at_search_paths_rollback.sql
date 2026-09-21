-- ROLLBACK for:
-- 20260921181633_security_updated_at_search_paths.sql
--
-- Restores the functions to their previous mutable/default search_path.

alter function mcas.set_updated_at()
  reset search_path;


alter function portal.fn_set_updated_at()
  reset search_path;

alter function portal.set_qsc_entrepreneur_extended_reports_updated_at()
  reset search_path;

alter function portal.set_qsc_entrepreneur_owner_insights_updated_at()
  reset search_path;

alter function portal.set_qsc_leader_extended_reports_updated_at()
  reset search_path;

alter function portal.set_qsc_leader_personas_updated_at()
  reset search_path;

alter function portal.set_report_sections_updated_at()
  reset search_path;

alter function portal.set_updated_at()
  reset search_path;


alter function public.set_current_timestamp_updated_at()
  reset search_path;

alter function public.set_updated_at()
  reset search_path;


alter function visibility.set_updated_at()
  reset search_path;

alter function visibility.touch_updated_at()
  reset search_path;