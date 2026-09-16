-- =============================================================
-- Migration: Referral Partner Profiles, Multi-Link Tracking
--            and Reconciliation Audit Trail
-- Date: 2026-09-15
--
-- Safe expansion of the existing Referral Tracking MVP.
--
-- IMPORTANT:
-- - Existing referral_partners.code and destination_path are retained
--   during the application migration so the current /r/[code] route
--   continues to work until the app is switched to referral_links.
-- - Existing clicks and attributions are backfilled to the new
--   referral link model.
-- - No commission calculation or payout automation is introduced.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Expand referral partner profile information
-- -------------------------------------------------------------

ALTER TABLE portal.referral_partners
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE portal.referral_partners
  ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE portal.referral_partners
  ADD COLUMN IF NOT EXISTS website_url text;

ALTER TABLE portal.referral_partners
  ADD COLUMN IF NOT EXISTS notes text;


-- -------------------------------------------------------------
-- 2. Referral links
--
-- A partner can own multiple tracked links/campaigns.
--
-- Examples:
--   Coach Network - Main
--   Coach Network - Webinar
--   Coach Network - LinkedIn
--
-- code remains globally unique because /r/{code} must resolve to
-- exactly one referral link.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  partner_id uuid NOT NULL
    REFERENCES portal.referral_partners(id)
    ON DELETE CASCADE,

  name text NOT NULL DEFAULT 'Primary link',

  code text NOT NULL,

  destination_path text NOT NULL
    DEFAULT '/onboarding/v2/account',

  status text NOT NULL DEFAULT 'active',

  created_by uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_links_name_not_blank
    CHECK (char_length(trim(name)) > 0),

  CONSTRAINT referral_links_code_lowercase
    CHECK (code = lower(code)),

  CONSTRAINT referral_links_code_format
    CHECK (
      code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),

  CONSTRAINT referral_links_destination_path_check
    CHECK (
      destination_path LIKE '/%'
      AND destination_path NOT LIKE '//%'
      AND position(chr(92) in destination_path) = 0
    ),

  CONSTRAINT referral_links_status_check
    CHECK (status IN ('active', 'paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS
  referral_links_code_uidx
ON portal.referral_links (code);

CREATE INDEX IF NOT EXISTS
  referral_links_partner_idx
ON portal.referral_links (
  partner_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  referral_links_partner_status_idx
ON portal.referral_links (
  partner_id,
  status
);


-- -------------------------------------------------------------
-- 3. Backfill one primary link for every existing referral partner
--
-- This preserves the current referral-test link and any other
-- partner links created before this migration.
-- -------------------------------------------------------------

INSERT INTO portal.referral_links (
  partner_id,
  name,
  code,
  destination_path,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  p.id,
  'Primary link',
  p.code,
  p.destination_path,
  p.status,
  p.created_by,
  p.created_at,
  p.updated_at
FROM portal.referral_partners p
WHERE NOT EXISTS (
  SELECT 1
  FROM portal.referral_links l
  WHERE l.code = p.code
)
ON CONFLICT (code) DO NOTHING;


-- -------------------------------------------------------------
-- 4. Attach clicks to the exact referral link
--
-- link_id stays nullable during the code migration so the currently
-- deployed route cannot break between database and app releases.
-- Once the application writes link_id for every new click, all
-- historical and future data will carry the exact originating link.
-- -------------------------------------------------------------

ALTER TABLE portal.referral_clicks
  ADD COLUMN IF NOT EXISTS link_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_clicks_link_id_fkey'
      AND conrelid = 'portal.referral_clicks'::regclass
  ) THEN
    ALTER TABLE portal.referral_clicks
      ADD CONSTRAINT referral_clicks_link_id_fkey
      FOREIGN KEY (link_id)
      REFERENCES portal.referral_links(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
  referral_clicks_link_date_idx
ON portal.referral_clicks (
  link_id,
  clicked_at DESC
);

UPDATE portal.referral_clicks c
SET link_id = l.id
FROM portal.referral_partners p
JOIN portal.referral_links l
  ON l.partner_id = p.id
 AND l.code = p.code
WHERE c.partner_id = p.id
  AND c.link_id IS NULL;


-- -------------------------------------------------------------
-- 5. Store the originating link on permanent attribution
--
-- The click remains the attribution source of truth; link_id is
-- stored here as a convenient immutable snapshot for reporting.
-- -------------------------------------------------------------

ALTER TABLE portal.referral_attributions
  ADD COLUMN IF NOT EXISTS link_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_attributions_link_id_fkey'
      AND conrelid = 'portal.referral_attributions'::regclass
  ) THEN
    ALTER TABLE portal.referral_attributions
      ADD CONSTRAINT referral_attributions_link_id_fkey
      FOREIGN KEY (link_id)
      REFERENCES portal.referral_links(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
  referral_attributions_link_date_idx
ON portal.referral_attributions (
  link_id,
  attributed_at DESC
);

UPDATE portal.referral_attributions a
SET link_id = c.link_id
FROM portal.referral_clicks c
WHERE a.click_id = c.id
  AND a.link_id IS NULL
  AND c.link_id IS NOT NULL;


-- -------------------------------------------------------------
-- 6. Reconciliation snapshots
--
-- A reconciliation is an immutable period-level audit record.
-- The dashboard may change later as customers upgrade/cancel, but
-- a saved reconciliation keeps the commercial state that existed
-- when the manual reconciliation was created.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  label text,

  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,

  partner_count integer NOT NULL DEFAULT 0,
  signup_count integer NOT NULL DEFAULT 0,
  paid_customer_count integer NOT NULL DEFAULT 0,

  notes text,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_reconciliations_period_check
    CHECK (period_end > period_start),

  CONSTRAINT referral_reconciliations_counts_check
    CHECK (
      partner_count >= 0
      AND signup_count >= 0
      AND paid_customer_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS
  referral_reconciliations_period_idx
ON portal.referral_reconciliations (
  period_end DESC,
  period_start DESC
);


-- -------------------------------------------------------------
-- 7. Reconciliation conversion snapshots
--
-- IDs below are deliberately snapshot UUID values rather than
-- foreign keys (except reconciliation_id). This preserves the audit
-- trail even if an organisation, partner, link, attribution or
-- billing record is changed or removed later.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reconciliation_id uuid NOT NULL
    REFERENCES portal.referral_reconciliations(id)
    ON DELETE CASCADE,

  attribution_id uuid NOT NULL,
  partner_id uuid NOT NULL,
  referral_link_id uuid,
  click_id uuid NOT NULL,
  org_id uuid NOT NULL,
  billing_account_id uuid,

  partner_name text NOT NULL,
  partner_email text,
  link_name text,
  link_code text,

  organisation_name text NOT NULL,
  organisation_slug text,

  click_at timestamptz,
  signup_at timestamptz NOT NULL,

  signup_tier smallint,
  signup_plan text NOT NULL,

  current_tier smallint,
  current_plan text NOT NULL,

  payment_state text NOT NULL,
  payment_label text NOT NULL,
  stripe_status text,

  billing_type text,
  billing_interval text,
  billing_source text,

  captured_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_reconciliation_items_signup_tier_check
    CHECK (
      signup_tier IS NULL
      OR signup_tier BETWEEN 1 AND 4
    ),

  CONSTRAINT referral_reconciliation_items_current_tier_check
    CHECK (
      current_tier IS NULL
      OR current_tier BETWEEN 1 AND 4
    ),

  CONSTRAINT referral_reconciliation_items_payment_state_check
    CHECK (
      payment_state IN (
        'paid',
        'trial',
        'overdue',
        'setup_required',
        'paused',
        'cancelled',
        'complimentary',
        'pending'
      )
    ),

  CONSTRAINT referral_reconciliation_items_unique_attribution
    UNIQUE (reconciliation_id, attribution_id)
);

CREATE INDEX IF NOT EXISTS
  referral_reconciliation_items_reconciliation_idx
ON portal.referral_reconciliation_items (
  reconciliation_id,
  signup_at DESC
);

CREATE INDEX IF NOT EXISTS
  referral_reconciliation_items_partner_idx
ON portal.referral_reconciliation_items (
  reconciliation_id,
  partner_id
);


-- -------------------------------------------------------------
-- 8. Export audit log
--
-- Each CSV generation can be recorded so there is a paper trail of
-- who exported which reconciliation and when.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal.referral_reconciliation_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reconciliation_id uuid NOT NULL
    REFERENCES portal.referral_reconciliations(id)
    ON DELETE CASCADE,

  export_type text NOT NULL,

  exported_by uuid,
  exported_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_reconciliation_exports_type_check
    CHECK (
      export_type IN (
        'partner_summary_csv',
        'conversion_detail_csv'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  referral_reconciliation_exports_reconciliation_idx
ON portal.referral_reconciliation_exports (
  reconciliation_id,
  exported_at DESC
);


-- -------------------------------------------------------------
-- 9. Security
--
-- Referral administration remains server-side / superadmin only.
-- Browser Supabase clients do not receive direct access.
-- -------------------------------------------------------------

ALTER TABLE portal.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.referral_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.referral_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.referral_reconciliation_exports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE portal.referral_links
  FROM anon, authenticated;

REVOKE ALL ON TABLE portal.referral_reconciliations
  FROM anon, authenticated;

REVOKE ALL ON TABLE portal.referral_reconciliation_items
  FROM anon, authenticated;

REVOKE ALL ON TABLE portal.referral_reconciliation_exports
  FROM anon, authenticated;

GRANT ALL ON TABLE portal.referral_links
  TO service_role;

GRANT ALL ON TABLE portal.referral_reconciliations
  TO service_role;

GRANT ALL ON TABLE portal.referral_reconciliation_items
  TO service_role;

GRANT ALL ON TABLE portal.referral_reconciliation_exports
  TO service_role;


-- -------------------------------------------------------------
-- 10. Documentation
-- -------------------------------------------------------------

COMMENT ON TABLE portal.referral_links IS
  'Tracked referral links/campaigns. A referral partner can own multiple links.';

COMMENT ON COLUMN portal.referral_clicks.link_id IS
  'Exact referral link that generated this click. Nullable only for migration/backward compatibility.';

COMMENT ON COLUMN portal.referral_attributions.link_id IS
  'Referral link associated with the immutable first-touch conversion snapshot.';

COMMENT ON TABLE portal.referral_reconciliations IS
  'Immutable period-level referral reconciliation records used for manual commercial reconciliation.';

COMMENT ON TABLE portal.referral_reconciliation_items IS
  'Snapshot of referred-customer commercial state at the time a reconciliation was created.';

COMMENT ON TABLE portal.referral_reconciliation_exports IS
  'Audit log of CSV exports generated from saved referral reconciliations.';

COMMENT ON COLUMN portal.referral_partners.notes IS
  'Internal admin notes about the referral partner.';
