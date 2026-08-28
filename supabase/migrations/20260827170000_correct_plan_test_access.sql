-- Correct the public subscription tier → assessment catalogue.
--
-- Tier 1: Growth Engine Diagnostic
-- Tier 2: GED + MindCanvas LEAD System (MPS Coaching)
-- Tier 3: GED + MindCanvas LEAD System + MCAS
--
-- Then resynchronise every active entitlement so existing upgraded
-- organisations receive their missing assessments immediately.

DO $$
DECLARE
  v_ged_test_id   uuid;
  v_mps_test_id   uuid;
  v_mcas_test_id  uuid;

  v_tier_1_id     uuid;
  v_tier_2_id     uuid;
  v_tier_3_id     uuid;
BEGIN
  SELECT t.id
    INTO STRICT v_ged_test_id
    FROM portal.tests t
    JOIN portal.orgs o ON o.id = t.org_id
   WHERE o.slug = 'profiletest-ai'
     AND t.name = 'Growth Engine Diagnostic'
     AND t.status = 'active';

  SELECT t.id
    INTO STRICT v_mps_test_id
    FROM portal.tests t
    JOIN portal.orgs o ON o.id = t.org_id
   WHERE o.slug = 'profiletest-ai'
     AND t.name = 'MindCanvas LEAD System'
     AND t.status = 'active';

  SELECT t.id
    INTO STRICT v_mcas_test_id
    FROM portal.tests t
    JOIN portal.orgs o ON o.id = t.org_id
   WHERE o.slug = 'profiletest-ai'
     AND t.name = 'MCAS — Core Alignment'
     AND t.status = 'active';

  SELECT id
    INTO STRICT v_tier_1_id
    FROM portal.tier_definitions
   WHERE tier = 1
     AND valid_until IS NULL;

  SELECT id
    INTO STRICT v_tier_2_id
    FROM portal.tier_definitions
   WHERE tier = 2
     AND valid_until IS NULL;

  SELECT id
    INTO STRICT v_tier_3_id
    FROM portal.tier_definitions
   WHERE tier = 3
     AND valid_until IS NULL;

  -- Replace the incorrect catalogue, including the unintended
  -- Quantum Source Code Entrepreneur mappings.
  DELETE FROM portal.plan_test_access
   WHERE tier_definition_id IN (
     v_tier_1_id,
     v_tier_2_id,
     v_tier_3_id
   );

  INSERT INTO portal.plan_test_access (
    tier_definition_id,
    test_id,
    active
  )
  VALUES
    (v_tier_1_id, v_ged_test_id,  true),

    (v_tier_2_id, v_ged_test_id,  true),
    (v_tier_2_id, v_mps_test_id,  true),

    (v_tier_3_id, v_ged_test_id,  true),
    (v_tier_3_id, v_mps_test_id,  true),
    (v_tier_3_id, v_mcas_test_id, true);
END;
$$;

-- Apply the corrected catalogue to existing active subscriptions.
DO $$
DECLARE
  v_entitlement record;
BEGIN
  FOR v_entitlement IN
    SELECT DISTINCT
      e.org_id,
      e.tier_definition_id
    FROM portal.entitlements e
    WHERE e.status = 'active'
      AND e.tier_definition_id IS NOT NULL
      AND e.tier BETWEEN 1 AND 3
  LOOP
    PERFORM portal.fn_sync_org_test_access(
      v_entitlement.org_id,
      v_entitlement.tier_definition_id
    );
  END LOOP;
END;
$$;