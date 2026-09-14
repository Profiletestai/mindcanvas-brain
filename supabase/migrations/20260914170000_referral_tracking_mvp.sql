-- =============================================================
-- Migration: Referral Tracking MVP
-- Date: 2026-09-14
--
-- Purpose:
--   Lightweight referral attribution for MindCanvas.
--
--   Phase 1 deliberately DOES NOT calculate commission or payouts.
--   It tracks:
--     referral partner
--     -> referral link click
--     -> organisation signup
--     -> plan selected at signup
--
--   Current payment / subscription status is derived from the
--   existing portal.billing_accounts table.
--
-- Attribution rule:
--   First referral click wins for the attribution window.
--   The browser cookie controls the 30-day window; the database
--   stores the original click and immutable signup attribution.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Referral partners
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  email text,

  -- Human-readable referral identifier used in:
  -- https://profiletest.ai/r/{code}
  code text NOT NULL,

  -- Allows us to support other destinations in future while
  -- defaulting new partners to the normal onboarding flow.
  destination_path text NOT NULL
    DEFAULT '/onboarding/v2/account',

  status text NOT NULL DEFAULT 'active',

  -- Stored for audit purposes. This is the superadmin user id
  -- that created the referral partner.
  created_by uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_partners_name_not_blank
    CHECK (char_length(trim(name)) > 0),

  CONSTRAINT referral_partners_code_lowercase
    CHECK (code = lower(code)),

  CONSTRAINT referral_partners_code_format
    CHECK (
      code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),

  CONSTRAINT referral_partners_destination_path_check
  CHECK (
    destination_path LIKE '/%'
    AND destination_path NOT LIKE '//%'
    AND position(chr(92) in destination_path) = 0
  ),

  CONSTRAINT referral_partners_status_check
    CHECK (status IN ('active', 'paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS
  referral_partners_code_uidx
ON portal.referral_partners (code);

CREATE INDEX IF NOT EXISTS
  referral_partners_status_idx
ON portal.referral_partners (status);


-- -------------------------------------------------------------
-- 2. Referral clicks
--
-- Every visit to /r/{code} can be recorded.
--
-- is_first_touch tells us whether this click established the
-- attribution cookie. A subsequent referral click can therefore
-- still count towards click analytics without stealing attribution
-- from the original partner.
--
-- No IP address, user-agent or fingerprint is stored.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  partner_id uuid NOT NULL
    REFERENCES portal.referral_partners(id)
    ON DELETE CASCADE,

  destination_path text NOT NULL,

  is_first_touch boolean NOT NULL DEFAULT false,

  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  referral_clicks_partner_date_idx
ON portal.referral_clicks (
  partner_id,
  clicked_at DESC
);

CREATE INDEX IF NOT EXISTS
  referral_clicks_first_touch_idx
ON portal.referral_clicks (
  partner_id,
  clicked_at DESC
)
WHERE is_first_touch = true;


-- -------------------------------------------------------------
-- 3. Referral attribution
--
-- Created when onboarding produces the organisation.
--
-- signup_tier is intentionally stored as a SNAPSHOT.
--
-- This means:
--   Partner refers someone on Starter
--   Customer later upgrades to Pro
--
-- We can still see that the original referral converted through
-- Starter, while the dashboard can separately show their current
-- Pro billing account.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  partner_id uuid NOT NULL
    REFERENCES portal.referral_partners(id)
    ON DELETE RESTRICT,

  click_id uuid NOT NULL
    REFERENCES portal.referral_clicks(id)
    ON DELETE RESTRICT,

  user_id uuid NOT NULL,

  org_id uuid NOT NULL
    REFERENCES portal.orgs(id)
    ON DELETE CASCADE,

  signup_tier smallint,

  attributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_attributions_signup_tier_check
    CHECK (
      signup_tier IS NULL
      OR signup_tier BETWEEN 1 AND 4
    ),

  -- An organisation can only belong to one referral attribution.
  CONSTRAINT referral_attributions_org_unique
    UNIQUE (org_id),

  -- One first-touch click cannot create multiple conversions.
  CONSTRAINT referral_attributions_click_unique
    UNIQUE (click_id)
);

CREATE INDEX IF NOT EXISTS
  referral_attributions_partner_date_idx
ON portal.referral_attributions (
  partner_id,
  attributed_at DESC
);

CREATE INDEX IF NOT EXISTS
  referral_attributions_user_idx
ON portal.referral_attributions (user_id);


-- -------------------------------------------------------------
-- 4. Security
--
-- All referral operations in the MVP go through server-side
-- MindCanvas routes using the service-role client.
--
-- There is no reason for browser Supabase clients to query or
-- mutate these tables directly.
-- -------------------------------------------------------------

ALTER TABLE portal.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.referral_attributions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE portal.referral_partners
  FROM anon, authenticated;

REVOKE ALL ON TABLE portal.referral_clicks
  FROM anon, authenticated;

REVOKE ALL ON TABLE portal.referral_attributions
  FROM anon, authenticated;

GRANT ALL ON TABLE portal.referral_partners
  TO service_role;

GRANT ALL ON TABLE portal.referral_clicks
  TO service_role;

GRANT ALL ON TABLE portal.referral_attributions
  TO service_role;


-- -------------------------------------------------------------
-- 5. Documentation
-- -------------------------------------------------------------

COMMENT ON TABLE portal.referral_partners IS
  'MindCanvas referral partners and their trackable referral links.';

COMMENT ON TABLE portal.referral_clicks IS
  'Referral-link clicks. First-touch clicks can establish 30-day attribution.';

COMMENT ON TABLE portal.referral_attributions IS
  'Permanent first-touch referral attribution between a referral partner and an organisation signup.';

COMMENT ON COLUMN portal.referral_attributions.signup_tier IS
  'Subscription tier selected when the referred organisation signed up; retained as an immutable conversion-plan snapshot.';