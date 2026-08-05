-- 1a. New columns on portal.orgs
ALTER TABLE portal.orgs
  ADD COLUMN IF NOT EXISTS address                    text,
  ADD COLUMN IF NOT EXISTS country                    text,
  ADD COLUMN IF NOT EXISTS billing_region             text,
  ADD COLUMN IF NOT EXISTS status                     text NOT NULL DEFAULT 'pending_activation'
    CHECK (status IN ('pending_activation','active','suspended','archived')),
  ADD COLUMN IF NOT EXISTS last_completed_step        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_accepted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS primary_contact_first_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_last_name  text;

-- 1b. org_status_history table
CREATE TABLE IF NOT EXISTS portal.org_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES portal.orgs(id),
  status     text NOT NULL,
  changed_by uuid,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_status_history_org ON portal.org_status_history(org_id);
ALTER TABLE portal.org_status_history ENABLE ROW LEVEL SECURITY;

-- 1c. Atomic org creation function
CREATE OR REPLACE FUNCTION portal.fn_create_onboarding_org(
  p_user_id        uuid,
  p_name           text,
  p_slug           text,
  p_address        text DEFAULT NULL,
  p_country        text DEFAULT NULL,
  p_billing_region text DEFAULT NULL,
  p_website_url    text DEFAULT NULL,
  p_industry       text DEFAULT NULL,
  p_logo_url       text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal
AS $$
DECLARE v_org_id uuid;
BEGIN
  INSERT INTO portal.orgs (name, slug, address, country, billing_region, website_url, industry, logo_url, status, last_completed_step)
  VALUES (p_name, p_slug, p_address, p_country, p_billing_region, p_website_url, p_industry, p_logo_url, 'pending_activation', 3)
  RETURNING id INTO v_org_id;

  INSERT INTO portal.user_orgs (user_id, org_id, role) VALUES (p_user_id, v_org_id, 'org_owner');
  INSERT INTO portal.org_status_history (org_id, status, changed_by, reason)
    VALUES (v_org_id, 'pending_activation', p_user_id, 'Org created during onboarding');

  RETURN v_org_id;
END;
$$;
