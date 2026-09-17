-- ============================================================
-- SEC-002B: Restrict privileged SECURITY DEFINER functions
--
-- These functions are invoked by trusted server/service-role
-- code or are legacy administrative helpers. They must not be
-- directly executable by anon or authenticated Data API roles.
--
-- SECURITY DEFINER functions run with elevated database
-- privileges, so EXECUTE permission is part of the security
-- boundary.
-- ============================================================

-- ------------------------------------------------------------
-- Pilot / billing lifecycle
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  portal.fn_activate_pilot(uuid, timestamptz, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_activate_pilot(uuid, timestamptz, integer)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_apply_billing_event(
    text,
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_apply_billing_event(
    text,
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz
  )
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_apply_billing_event_v2(
    text,
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_apply_billing_event_v2(
    text,
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_sweep_expired_pilots()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_sweep_expired_pilots()
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_sweep_past_due_to_suspended(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_sweep_past_due_to_suspended(integer)
TO service_role;


-- ------------------------------------------------------------
-- Onboarding
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  portal.fn_apply_onboarding_selection(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_apply_onboarding_selection(uuid, uuid)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_create_onboarding_org(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_create_onboarding_org(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_grant_onboarding_trial_access(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_grant_onboarding_trial_access(uuid)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_save_onboarding_selection(uuid, text[], integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_save_onboarding_selection(uuid, text[], integer)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_engine_trial_summary(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_engine_trial_summary(uuid)
TO service_role;


-- ------------------------------------------------------------
-- Submission quota / usage
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  portal.fn_reserve_submission(uuid, text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_reserve_submission(uuid, text, uuid)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_submission_availability(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_submission_availability(uuid, uuid)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_submission_usage(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_submission_usage(uuid)
TO service_role;


-- ------------------------------------------------------------
-- Organisation test / engine access
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  portal.fn_suspend_org_test_access(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_suspend_org_test_access(uuid)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_reactivate_org_test_access(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_reactivate_org_test_access(uuid)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_sync_org_engines_for_tier(uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_sync_org_engines_for_tier(uuid, integer)
TO service_role;


REVOKE EXECUTE ON FUNCTION
  portal.fn_sync_org_test_access(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_sync_org_test_access(uuid, uuid)
TO service_role;


-- ------------------------------------------------------------
-- Legacy dashboard RPC
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  portal.fn_get_dashboard_data(text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  portal.fn_get_dashboard_data(text, uuid)
TO service_role;


-- ------------------------------------------------------------
-- Visibility generated-report cache
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  visibility.get_generated_report(
    uuid,
    text,
    text,
    integer
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  visibility.get_generated_report(
    uuid,
    text,
    text,
    integer
  )
TO service_role;


REVOKE EXECUTE ON FUNCTION
  visibility.upsert_generated_report(
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    text,
    integer
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  visibility.upsert_generated_report(
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    text,
    integer
  )
TO service_role;


-- ------------------------------------------------------------
-- Legacy public-schema administrative functions
--
-- These functions have no caller authorisation of their own.
-- Preserve them for backwards compatibility but make them
-- server-only.
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  public.create_test_link_by_id(
    text,
    uuid,
    text,
    integer,
    integer
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.create_test_link_by_id(
    text,
    uuid,
    text,
    integer,
    integer
  )
TO service_role;


REVOKE EXECUTE ON FUNCTION
  public.create_test_link_by_slug(
    text,
    text,
    text,
    integer,
    integer
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.create_test_link_by_slug(
    text,
    text,
    text,
    integer,
    integer
  )
TO service_role;


REVOKE EXECUTE ON FUNCTION
  public.seed_base_questions(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.seed_base_questions(text)
TO service_role;