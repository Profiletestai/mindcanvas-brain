-- Grant org test access when a user skips payment and continues on free trials.
--
-- After successful Stripe payment the entitlement trigger
-- (trg_entitlements_sync_test_access) calls fn_sync_org_test_access, which
-- populates portal.org_test_access — the mapping the portal reads to decide
-- which tests an org can see and deploy.
--
-- The "skip for now" path creates the org and its per-engine trial credits
-- (fn_apply_onboarding_selection) but never creates an entitlement, so that
-- trigger never fires and org_test_access stays empty: the org has trial
-- credits it can spend but no tests mapped to spend them on.
--
-- fn_grant_onboarding_trial_access closes that gap. It resolves the org's
-- selected tier to its tier_definition and runs the same sync as payment, so
-- the org gets exactly the tests its plan + engine selection grant — without an
-- entitlement (the org stays pending_activation and can still upgrade later).

CREATE OR REPLACE FUNCTION portal.fn_grant_onboarding_trial_access(
  p_org_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE
  v_tier        int;
  v_tier_def_id uuid;
BEGIN
  SELECT selected_tier INTO v_tier FROM portal.orgs WHERE id = p_org_id;

  -- No tier picked yet: nothing to map. The onboarding plan step enforces a
  -- tier before skip is reachable, so this is a defensive no-op.
  IF v_tier IS NULL THEN
    RETURN;
  END IF;

  -- Current (open-ended) tier_definition for the chosen tier. Prefer the most
  -- recently created for determinism, mirroring fn_entitlements_sync_test_access.
  SELECT td.id
    INTO v_tier_def_id
    FROM portal.tier_definitions td
   WHERE td.tier = v_tier
     AND td.valid_until IS NULL
   ORDER BY td.created_at DESC, td.id DESC
   LIMIT 1;

  IF v_tier_def_id IS NULL THEN
    RAISE EXCEPTION
      'fn_grant_onboarding_trial_access: no tier_definition for tier % (org %)',
      v_tier, p_org_id;
  END IF;

  -- Same mapping payment would apply: tier tests, narrowed by selected engines.
  PERFORM portal.fn_sync_org_test_access(p_org_id, v_tier_def_id);
END;
$$;

GRANT EXECUTE ON FUNCTION portal.fn_grant_onboarding_trial_access(uuid) TO service_role;
