-- =============================================================
-- Normalise Stripe billing intervals
--
-- Stripe uses "month" and "year".
-- MindCanvas stores "monthly" and "annual".
-- Normalise external values before the billing_accounts constraint runs.
-- =============================================================

CREATE OR REPLACE FUNCTION
  portal.fn_normalize_billing_interval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = portal
AS $$
BEGIN
  NEW.billing_interval := CASE NEW.billing_interval
    WHEN 'month' THEN 'monthly'
    WHEN 'year' THEN 'annual'
    ELSE NEW.billing_interval
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_billing_accounts_normalize_interval
ON portal.billing_accounts;

CREATE TRIGGER
  trg_billing_accounts_normalize_interval
BEFORE INSERT OR UPDATE OF billing_interval
ON portal.billing_accounts
FOR EACH ROW
EXECUTE FUNCTION
  portal.fn_normalize_billing_interval();