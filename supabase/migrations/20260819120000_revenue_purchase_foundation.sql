-- =============================================================
-- MindCanvas revenue foundation
--
-- Adds the shared one-off purchase record used by:
--   1. usage bundles
--   2. paid test links
--   3. lite-to-full report upgrades
--
-- This migration is schema-only. It does not change the live submission,
-- billing, checkout, webhook, or report behaviour by itself.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Shared one-off purchase record
-- -------------------------------------------------------------
CREATE TABLE portal.purchases (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_type              text NOT NULL
                               CHECK (purchase_type IN (
                                 'usage_bundle',
                                 'paid_test',
                                 'report_upgrade'
                               )),
  org_id                     uuid NOT NULL REFERENCES portal.orgs(id),
  test_link_id               uuid REFERENCES portal.test_links(id),
  submission_id              uuid REFERENCES portal.test_submissions(id),
  buyer_user_id              uuid,
  buyer_email                text,
  stripe_mode                text NOT NULL
                               CHECK (stripe_mode IN ('sandbox', 'live')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_price_id            text NOT NULL,
  gross_amount               integer NOT NULL CHECK (gross_amount > 0),
  currency                   text NOT NULL
                               CHECK (
                                 currency = lower(currency)
                                 AND currency ~ '^[a-z]{3}$'
                               ),
  status                     text NOT NULL DEFAULT 'pending'
                               CHECK (status IN (
                                 'pending',
                                 'paid',
                                 'failed',
                                 'refunded',
                                 'disputed'
                               )),
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  paid_at                    timestamptz,
  refunded_at                timestamptz,

  CONSTRAINT purchases_paid_test_link_required
    CHECK (purchase_type <> 'paid_test' OR test_link_id IS NOT NULL),
  CONSTRAINT purchases_report_submission_required
    CHECK (purchase_type <> 'report_upgrade' OR submission_id IS NOT NULL),
  CONSTRAINT purchases_usage_bundle_scope
    CHECK (
      purchase_type <> 'usage_bundle'
      OR (test_link_id IS NULL AND submission_id IS NULL)
    ),
  CONSTRAINT purchases_id_org_unique UNIQUE (id, org_id)
);

CREATE UNIQUE INDEX uq_purchases_checkout_session
  ON portal.purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX uq_purchases_payment_intent
  ON portal.purchases (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX idx_purchases_org_created
  ON portal.purchases (org_id, created_at DESC);

CREATE INDEX idx_purchases_type_status
  ON portal.purchases (purchase_type, status);

CREATE INDEX idx_purchases_test_link
  ON portal.purchases (test_link_id)
  WHERE test_link_id IS NOT NULL;

CREATE INDEX idx_purchases_submission
  ON portal.purchases (submission_id)
  WHERE submission_id IS NOT NULL;

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON portal.purchases
  FOR EACH ROW EXECUTE FUNCTION portal.fn_set_updated_at();

ALTER TABLE portal.purchases ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE portal.purchases IS
  'Authoritative audit record for MindCanvas one-off Stripe purchases.';

-- -------------------------------------------------------------
-- 2. Usage-bundle catalogue
--
-- A row is seeded for each subscription tier and Stripe mode. Rows remain
-- inactive until the matching Stripe Price ID has been added and verified.
-- -------------------------------------------------------------
CREATE TABLE portal.usage_bundle_catalog (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_code        text NOT NULL,
  display_name       text NOT NULL,
  tier               integer NOT NULL CHECK (tier BETWEEN 1 AND 4),
  quantity           integer NOT NULL CHECK (quantity > 0),
  currency           text NOT NULL
                       CHECK (
                         currency = lower(currency)
                         AND currency ~ '^[a-z]{3}$'
                       ),
  amount_cents       integer NOT NULL CHECK (amount_cents > 0),
  stripe_mode        text NOT NULL
                       CHECK (stripe_mode IN ('sandbox', 'live')),
  stripe_price_id    text,
  active             boolean NOT NULL DEFAULT false,
  expires_after_days integer CHECK (
                       expires_after_days IS NULL
                       OR expires_after_days > 0
                     ),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usage_bundle_catalog_code_format
    CHECK (bundle_code ~ '^[a-z0-9_]+$'),
  CONSTRAINT usage_bundle_catalog_tier_mode_unique
    UNIQUE (bundle_code, tier, stripe_mode)
);

CREATE UNIQUE INDEX uq_usage_bundle_catalog_stripe_price
  ON portal.usage_bundle_catalog (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

CREATE INDEX idx_usage_bundle_catalog_lookup
  ON portal.usage_bundle_catalog (
    tier,
    stripe_mode,
    currency,
    active
  );

CREATE TRIGGER trg_usage_bundle_catalog_updated_at
  BEFORE UPDATE ON portal.usage_bundle_catalog
  FOR EACH ROW EXECUTE FUNCTION portal.fn_set_updated_at();

ALTER TABLE portal.usage_bundle_catalog ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE portal.usage_bundle_catalog IS
  'Server-controlled Stripe catalogue for additional test-usage bundles.';

INSERT INTO portal.usage_bundle_catalog (
  bundle_code,
  display_name,
  tier,
  quantity,
  currency,
  amount_cents,
  stripe_mode,
  stripe_price_id,
  active,
  expires_after_days
)
VALUES
  ('extra_20', '20 additional test usages', 1, 20, 'usd', 29700, 'sandbox', NULL, false, NULL),
  ('extra_20', '20 additional test usages', 2, 20, 'usd', 24700, 'sandbox', NULL, false, NULL),
  ('extra_20', '20 additional test usages', 3, 20, 'usd', 19700, 'sandbox', NULL, false, NULL),
  ('extra_20', '20 additional test usages', 4, 20, 'usd', 14700, 'sandbox', NULL, false, NULL),
  ('extra_20', '20 additional test usages', 1, 20, 'usd', 29700, 'live',    NULL, false, NULL),
  ('extra_20', '20 additional test usages', 2, 20, 'usd', 24700, 'live',    NULL, false, NULL),
  ('extra_20', '20 additional test usages', 3, 20, 'usd', 19700, 'live',    NULL, false, NULL),
  ('extra_20', '20 additional test usages', 4, 20, 'usd', 14700, 'live',    NULL, false, NULL);

-- -------------------------------------------------------------
-- 3. Persistent purchased-usage allocations
--
-- quantity_remaining is not tied to an entitlement period, which means a
-- monthly subscription renewal/reset cannot erase purchased units.
-- -------------------------------------------------------------
CREATE TABLE portal.usage_bundle_allocations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id          uuid NOT NULL,
  org_id               uuid NOT NULL,
  bundle_catalog_id    uuid NOT NULL REFERENCES portal.usage_bundle_catalog(id),
  quantity_purchased   integer NOT NULL CHECK (quantity_purchased > 0),
  quantity_remaining   integer NOT NULL,
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN (
                           'active',
                           'exhausted',
                           'refunded',
                           'held'
                         )),
  expires_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usage_bundle_allocations_purchase_unique
    UNIQUE (purchase_id),
  CONSTRAINT usage_bundle_allocations_quantity_range
    CHECK (
      quantity_remaining >= 0
      AND quantity_remaining <= quantity_purchased
    ),
  CONSTRAINT usage_bundle_allocations_purchase_org_fkey
    FOREIGN KEY (purchase_id, org_id)
    REFERENCES portal.purchases(id, org_id)
);

CREATE INDEX idx_usage_bundle_allocations_available
  ON portal.usage_bundle_allocations (
    org_id,
    expires_at,
    created_at
  )
  WHERE status = 'active' AND quantity_remaining > 0;

CREATE TRIGGER trg_usage_bundle_allocations_updated_at
  BEFORE UPDATE ON portal.usage_bundle_allocations
  FOR EACH ROW EXECUTE FUNCTION portal.fn_set_updated_at();

ALTER TABLE portal.usage_bundle_allocations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE portal.usage_bundle_allocations IS
  'Persistent purchased submission balances, fulfilled only from verified Stripe webhooks.';

-- -------------------------------------------------------------
-- 4. Extend the existing usage ledger for bundle audit entries
-- -------------------------------------------------------------
ALTER TABLE portal.usage_ledger
  ADD COLUMN purchase_id uuid REFERENCES portal.purchases(id);

ALTER TABLE portal.usage_ledger
  DROP CONSTRAINT IF EXISTS usage_ledger_event_type_check;

ALTER TABLE portal.usage_ledger
  ADD CONSTRAINT usage_ledger_event_type_check
  CHECK (event_type IN (
    'trial_consumed',
    'extra_trials_purchased',
    'period_reset',
    'engine_trial_consumed',
    'usage_bundle_purchased',
    'usage_bundle_consumed',
    'usage_bundle_refunded'
  ));

ALTER TABLE portal.usage_ledger
  DROP CONSTRAINT IF EXISTS usage_ledger_reference_type_check;

ALTER TABLE portal.usage_ledger
  ADD CONSTRAINT usage_ledger_reference_type_check
  CHECK (reference_type IN (
    'submission',
    'stripe_invoice',
    'manual',
    'purchase'
  ));

CREATE INDEX idx_usage_ledger_purchase
  ON portal.usage_ledger (purchase_id)
  WHERE purchase_id IS NOT NULL;

CREATE UNIQUE INDEX uq_usage_ledger_bundle_purchase
  ON portal.usage_ledger (purchase_id, event_type)
  WHERE purchase_id IS NOT NULL
    AND event_type IN ('usage_bundle_purchased', 'usage_bundle_refunded');

-- -------------------------------------------------------------
-- Rollback notes
-- -------------------------------------------------------------
-- Only roll this migration back before any one-off purchase has been created.
-- Restore the previous usage_ledger check constraints first, then drop the
-- purchase_id column and drop the new tables in this order:
--   usage_bundle_allocations -> usage_bundle_catalog -> purchases.
-- Never delete purchase or ledger history after the feature has accepted money.
