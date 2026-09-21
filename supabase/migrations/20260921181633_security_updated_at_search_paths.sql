-- SEC-002X
-- Pin search_path for timestamp-only trigger functions.
--
-- These functions perform only:
--   NEW.updated_at = now();
--   RETURN NEW;
--
-- They do not access application tables or other application functions.
-- pg_catalog is therefore the narrowest safe search_path.
--
-- No function bodies, permissions, trigger bindings or business logic
-- are changed by this migration.

alter function mcas.set_updated_at()
  set search_path = pg_catalog;


alter function portal.fn_set_updated_at()
  set search_path = pg_catalog;

alter function portal.set_qsc_entrepreneur_extended_reports_updated_at()
  set search_path = pg_catalog;

alter function portal.set_qsc_entrepreneur_owner_insights_updated_at()
  set search_path = pg_catalog;

alter function portal.set_qsc_leader_extended_reports_updated_at()
  set search_path = pg_catalog;

alter function portal.set_qsc_leader_personas_updated_at()
  set search_path = pg_catalog;

alter function portal.set_report_sections_updated_at()
  set search_path = pg_catalog;

alter function portal.set_updated_at()
  set search_path = pg_catalog;


alter function public.set_current_timestamp_updated_at()
  set search_path = pg_catalog;

alter function public.set_updated_at()
  set search_path = pg_catalog;


alter function visibility.set_updated_at()
  set search_path = pg_catalog;

alter function visibility.touch_updated_at()
  set search_path = pg_catalog;