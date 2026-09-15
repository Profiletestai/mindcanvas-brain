-- =============================================================
-- Migration: Referral attribution link snapshot trigger
-- Date: 2026-09-15
--
-- Ensures every new referral attribution automatically snapshots
-- the exact referral_links.id carried by its originating click.
--
-- This keeps attribution immutable without requiring onboarding
-- routes to know about the referral link schema.
-- =============================================================

CREATE OR REPLACE FUNCTION portal.fn_referral_attribution_set_link_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal, public
AS $$
BEGIN
  IF NEW.click_id IS NOT NULL THEN
    SELECT c.link_id
      INTO NEW.link_id
    FROM portal.referral_clicks c
    WHERE c.id = NEW.click_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  referral_attributions_set_link_id
ON portal.referral_attributions;

CREATE TRIGGER referral_attributions_set_link_id
BEFORE INSERT OR UPDATE OF click_id
ON portal.referral_attributions
FOR EACH ROW
EXECUTE FUNCTION portal.fn_referral_attribution_set_link_id();

REVOKE ALL
ON FUNCTION portal.fn_referral_attribution_set_link_id()
FROM PUBLIC;

COMMENT ON FUNCTION portal.fn_referral_attribution_set_link_id() IS
  'Copies the originating referral click link_id onto referral_attributions as an immutable reporting snapshot.';
