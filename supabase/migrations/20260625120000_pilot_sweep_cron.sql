-- =============================================================
-- Migration: Schedule the pilot grace sweeper (pg_cron)
--
-- fn_sweep_expired_pilots (20260624120000_pilot_onboarding.sql) suspends pilot
-- orgs whose grace window (entitlements.period_end = pilot_end + 48h) has passed
-- without a paid subscription. The function exists but nothing invoked it, so
-- expired pilots were never restricted. This wires it to pg_cron.
--
-- Runs entirely in-DB: the sweeper is a plain SQL function, so no pg_net / HTTP
-- is needed. The cron job executes as the postgres superuser, which can run the
-- SECURITY DEFINER function regardless of the service_role grant.
--
-- Cadence: every 15 minutes (<=15 min slop past grace before suspension).
-- Schedules evaluate in UTC, matching entitlements.period_end.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent (re)schedule: drop a prior job by name before recreating, so this
-- migration is safe to re-run and older pg_cron (which errors on duplicate
-- jobname) stays happy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-expired-pilots') THEN
    PERFORM cron.unschedule('sweep-expired-pilots');
  END IF;
END $$;

SELECT cron.schedule(
  'sweep-expired-pilots',
  '*/15 * * * *',
  $$ SELECT portal.fn_sweep_expired_pilots(); $$
);
