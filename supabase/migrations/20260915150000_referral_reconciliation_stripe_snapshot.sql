-- =============================================================
-- Migration: Referral Reconciliation Stripe Snapshot Fields
-- Date: 2026-09-15
--
-- Adds immutable Stripe/billing-period identifiers to referral
-- reconciliation snapshots so historical exports can be reconciled
-- directly against Stripe even if the live billing account changes later.
--
-- Safe additive migration:
-- - no existing columns removed or changed
-- - all new columns are nullable for backward compatibility
-- =============================================================

ALTER TABLE portal.referral_reconciliation_items
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE portal.referral_reconciliation_items
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE portal.referral_reconciliation_items
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz;

ALTER TABLE portal.referral_reconciliation_items
  ADD COLUMN IF NOT EXISTS billing_period_end timestamptz;

COMMENT ON COLUMN portal.referral_reconciliation_items.stripe_customer_id IS
  'Stripe customer identifier snapshotted when the reconciliation was created.';

COMMENT ON COLUMN portal.referral_reconciliation_items.stripe_subscription_id IS
  'Stripe subscription identifier snapshotted when the reconciliation was created.';

COMMENT ON COLUMN portal.referral_reconciliation_items.billing_period_start IS
  'Billing period start snapshotted when the reconciliation was created.';

COMMENT ON COLUMN portal.referral_reconciliation_items.billing_period_end IS
  'Billing period end snapshotted when the reconciliation was created.';
