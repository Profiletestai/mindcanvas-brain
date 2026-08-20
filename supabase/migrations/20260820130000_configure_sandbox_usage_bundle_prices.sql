-- =============================================================
-- Configure MindCanvas sandbox usage-bundle Stripe Prices
--
-- Activates only the four sandbox rows for the 20-usage bundle.
-- Live catalogue rows remain inactive and unconfigured.
-- =============================================================

BEGIN;

UPDATE portal.usage_bundle_catalog AS catalog
   SET stripe_price_id = configured.stripe_price_id,
       active = true
  FROM (
    VALUES
      (1, 29700, 'price_1U6TgpCRKgpNz1SSf8cLipO3'),
      (2, 24700, 'price_1U6Tm4CRKgpNz1SSXlxO1TFu'),
      (3, 19700, 'price_1U6TmkCRKgpNz1SS6cIj3k6u'),
      (4, 14700, 'price_1U6TnHCRKgpNz1SSoP5OcK7M')
  ) AS configured(tier, amount_cents, stripe_price_id)
 WHERE catalog.bundle_code = 'extra_20'
   AND catalog.stripe_mode = 'sandbox'
   AND catalog.tier = configured.tier
   AND catalog.amount_cents = configured.amount_cents
   AND catalog.quantity = 20
   AND catalog.currency = 'usd'
   AND catalog.expires_after_days IS NULL;

DO $verify$
DECLARE
  v_configured_count integer;
  v_live_active_count integer;
BEGIN
  SELECT count(*)::integer
    INTO v_configured_count
    FROM portal.usage_bundle_catalog
   WHERE bundle_code = 'extra_20'
     AND stripe_mode = 'sandbox'
     AND active = true
     AND expires_after_days IS NULL
     AND (tier, amount_cents, stripe_price_id) IN (
       (1, 29700, 'price_1U6TgpCRKgpNz1SSf8cLipO3'),
       (2, 24700, 'price_1U6Tm4CRKgpNz1SSXlxO1TFu'),
       (3, 19700, 'price_1U6TmkCRKgpNz1SS6cIj3k6u'),
       (4, 14700, 'price_1U6TnHCRKgpNz1SSoP5OcK7M')
     );

  IF v_configured_count <> 4 THEN
    RAISE EXCEPTION
      'sandbox_usage_bundle_configuration_failed: expected 4 rows, found %',
      v_configured_count;
  END IF;

  SELECT count(*)::integer
    INTO v_live_active_count
    FROM portal.usage_bundle_catalog
   WHERE bundle_code = 'extra_20'
     AND stripe_mode = 'live'
     AND active = true;

  IF v_live_active_count <> 0 THEN
    RAISE EXCEPTION
      'live_usage_bundle_rows_must_remain_inactive: found %',
      v_live_active_count;
  END IF;
END;
$verify$;

COMMIT;

SELECT
  tier,
  quantity,
  currency,
  amount_cents,
  stripe_mode,
  stripe_price_id,
  active,
  expires_after_days
FROM portal.usage_bundle_catalog
WHERE bundle_code = 'extra_20'
ORDER BY stripe_mode, tier;
