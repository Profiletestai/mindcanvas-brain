-- =============================================================
-- MindCanvas one-off purchase fulfilment
--
-- Adds transaction-safe, idempotent database functions for:
--   1. successful one-off payment fulfilment
--   2. asynchronous payment failure
--   3. refunds
--   4. disputes
--
-- Only usage_bundle fulfilment is enabled in this phase. The shared purchase
-- record remains ready for paid_test and report_upgrade handlers later.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Operational reconciliation fields
-- -------------------------------------------------------------
ALTER TABLE portal.purchases
  ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN failed_at timestamptz,
  ADD COLUMN disputed_at timestamptz,
  ADD COLUMN reconciliation_required boolean NOT NULL DEFAULT false;

ALTER TABLE portal.purchases
  ADD CONSTRAINT purchases_refunded_amount_range
  CHECK (
    refunded_amount >= 0
    AND refunded_amount <= gross_amount
  );

CREATE INDEX idx_purchases_reconciliation
  ON portal.purchases (created_at DESC)
  WHERE reconciliation_required = true;

-- A dispute or partial refund can hold unused units without deleting them.
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
    'usage_bundle_refunded',
    'usage_bundle_held'
  ));

CREATE UNIQUE INDEX uq_usage_ledger_bundle_hold
  ON portal.usage_ledger (purchase_id, event_type)
  WHERE purchase_id IS NOT NULL
    AND event_type = 'usage_bundle_held';

-- -------------------------------------------------------------
-- 2. Successful one-off payment fulfilment
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_fulfill_one_off_purchase(
  p_purchase_id          uuid,
  p_stripe_event_id      text,
  p_stripe_mode          text,
  p_checkout_session_id  text,
  p_payment_intent_id    text,
  p_amount               integer,
  p_currency             text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal
AS $$
DECLARE
  v_purchase           portal.purchases%ROWTYPE;
  v_catalog            portal.usage_bundle_catalog%ROWTYPE;
  v_allocation         portal.usage_bundle_allocations%ROWTYPE;
  v_catalog_id         uuid;
  v_quantity           integer;
  v_billing_account_id uuid;
BEGIN
  IF p_stripe_mode IS NULL
     OR p_stripe_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'invalid_stripe_mode';
  END IF;

  IF p_stripe_event_id IS NULL OR btrim(p_stripe_event_id) = '' THEN
    RAISE EXCEPTION 'stripe_event_id_required';
  END IF;

  IF p_checkout_session_id IS NULL OR btrim(p_checkout_session_id) = '' THEN
    RAISE EXCEPTION 'checkout_session_id_required';
  END IF;

  IF p_payment_intent_id IS NULL OR btrim(p_payment_intent_id) = '' THEN
    RAISE EXCEPTION 'payment_intent_id_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_purchase_amount';
  END IF;

  IF p_currency IS NULL OR btrim(p_currency) = '' THEN
    RAISE EXCEPTION 'purchase_currency_required';
  END IF;

  SELECT p.*
    INTO v_purchase
    FROM portal.purchases p
   WHERE p.id = p_purchase_id
   FOR UPDATE OF p;

  IF v_purchase.id IS NULL THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;

  -- All payment facts are compared with the server-created purchase record.
  IF v_purchase.stripe_mode <> p_stripe_mode THEN
    RAISE EXCEPTION 'stripe_mode_mismatch';
  END IF;

  IF v_purchase.gross_amount <> p_amount THEN
    RAISE EXCEPTION 'purchase_amount_mismatch';
  END IF;

  IF v_purchase.currency <> lower(p_currency) THEN
    RAISE EXCEPTION 'purchase_currency_mismatch';
  END IF;

  IF v_purchase.stripe_checkout_session_id IS NOT NULL
     AND v_purchase.stripe_checkout_session_id <> p_checkout_session_id THEN
    RAISE EXCEPTION 'checkout_session_mismatch';
  END IF;

  IF v_purchase.stripe_payment_intent_id IS NOT NULL
     AND v_purchase.stripe_payment_intent_id <> p_payment_intent_id THEN
    RAISE EXCEPTION 'payment_intent_mismatch';
  END IF;

  -- checkout.session.completed and async_payment_succeeded may both arrive.
  -- A previously committed fulfilment is returned without granting again.
  IF v_purchase.status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'purchase_id', v_purchase.id,
      'purchase_type', v_purchase.purchase_type
    );
  END IF;

  IF v_purchase.status IN ('refunded', 'disputed') THEN
    RAISE EXCEPTION 'purchase_not_fulfillable:%', v_purchase.status;
  END IF;

  IF v_purchase.purchase_type <> 'usage_bundle' THEN
    RAISE EXCEPTION 'purchase_type_not_enabled:%', v_purchase.purchase_type;
  END IF;

  BEGIN
    v_catalog_id :=
      nullif(v_purchase.metadata->>'bundle_catalog_id', '')::uuid;
    v_quantity :=
      nullif(v_purchase.metadata->>'quantity', '')::integer;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_usage_bundle_snapshot';
  END;

  IF v_catalog_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
    RAISE EXCEPTION 'missing_usage_bundle_snapshot';
  END IF;

  SELECT c.*
    INTO v_catalog
    FROM portal.usage_bundle_catalog c
   WHERE c.id = v_catalog_id;

  IF v_catalog.id IS NULL THEN
    RAISE EXCEPTION 'usage_bundle_catalog_not_found';
  END IF;

  -- Insert the persistent balance first. A unique purchase_id prevents a
  -- second allocation even if another Stripe event is delivered.
  INSERT INTO portal.usage_bundle_allocations (
    purchase_id,
    org_id,
    bundle_catalog_id,
    quantity_purchased,
    quantity_remaining,
    status,
    expires_at
  ) VALUES (
    v_purchase.id,
    v_purchase.org_id,
    v_catalog.id,
    v_quantity,
    v_quantity,
    'active',
    NULL
  )
  ON CONFLICT (purchase_id) DO NOTHING;

  SELECT a.*
    INTO v_allocation
    FROM portal.usage_bundle_allocations a
   WHERE a.purchase_id = v_purchase.id;

  IF v_allocation.id IS NULL
     OR v_allocation.org_id <> v_purchase.org_id
     OR v_allocation.quantity_purchased <> v_quantity THEN
    RAISE EXCEPTION 'usage_bundle_allocation_mismatch';
  END IF;

  SELECT ba.id
    INTO v_billing_account_id
    FROM portal.billing_accounts ba
   WHERE ba.org_id = v_purchase.org_id
     AND ba.billing_type = 'owner'
   ORDER BY
     CASE lower(coalesce(ba.stripe_status, ''))
       WHEN 'active' THEN 1
       WHEN 'trialing' THEN 2
       WHEN 'pilot' THEN 3
       WHEN 'pending' THEN 4
       ELSE 5
     END,
     ba.updated_at DESC
   LIMIT 1;

  INSERT INTO portal.usage_ledger (
    org_id,
    billing_account_id,
    event_type,
    quantity,
    reference_type,
    reference_id,
    purchase_id
  ) VALUES (
    v_purchase.org_id,
    v_billing_account_id,
    'usage_bundle_purchased',
    v_quantity,
    'purchase',
    v_purchase.id::text,
    v_purchase.id
  )
  ON CONFLICT DO NOTHING;

  UPDATE portal.purchases
     SET status = 'paid',
         stripe_checkout_session_id = p_checkout_session_id,
         stripe_payment_intent_id = p_payment_intent_id,
         paid_at = COALESCE(paid_at, now()),
         failed_at = NULL,
         reconciliation_required = false,
         metadata = metadata || jsonb_build_object(
           'paid_event_id', p_stripe_event_id,
           'fulfilled_quantity', v_quantity
         )
   WHERE id = v_purchase.id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'purchase_id', v_purchase.id,
    'purchase_type', v_purchase.purchase_type,
    'quantity_granted', v_quantity,
    'purchased_remaining',
      portal.fn_purchased_usage_remaining(v_purchase.org_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION portal.fn_fulfill_one_off_purchase(
  uuid, text, text, text, text, integer, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION portal.fn_fulfill_one_off_purchase(
  uuid, text, text, text, text, integer, text
) TO service_role;

-- -------------------------------------------------------------
-- 3. Asynchronous payment failure
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_fail_one_off_purchase(
  p_purchase_id         uuid,
  p_stripe_event_id     text,
  p_checkout_session_id text,
  p_failure_reason      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal
AS $$
DECLARE
  v_purchase portal.purchases%ROWTYPE;
BEGIN
  IF p_stripe_event_id IS NULL OR btrim(p_stripe_event_id) = '' THEN
    RAISE EXCEPTION 'stripe_event_id_required';
  END IF;

  IF p_checkout_session_id IS NULL OR btrim(p_checkout_session_id) = '' THEN
    RAISE EXCEPTION 'checkout_session_id_required';
  END IF;

  SELECT p.*
    INTO v_purchase
    FROM portal.purchases p
   WHERE p.id = p_purchase_id
   FOR UPDATE OF p;

  IF v_purchase.id IS NULL THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;

  IF v_purchase.stripe_checkout_session_id IS NOT NULL
     AND v_purchase.stripe_checkout_session_id <> p_checkout_session_id THEN
    RAISE EXCEPTION 'checkout_session_mismatch';
  END IF;

  IF v_purchase.status IN ('paid', 'refunded', 'disputed') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ignored', true,
      'status', v_purchase.status
    );
  END IF;

  IF v_purchase.status = 'failed' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE portal.purchases
     SET status = 'failed',
         stripe_checkout_session_id = COALESCE(
           stripe_checkout_session_id,
           p_checkout_session_id
         ),
         failed_at = now(),
         metadata = metadata || jsonb_build_object(
           'failed_event_id', p_stripe_event_id,
           'failure_reason', p_failure_reason
         )
   WHERE id = v_purchase.id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION portal.fn_fail_one_off_purchase(
  uuid, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION portal.fn_fail_one_off_purchase(
  uuid, text, text, text
) TO service_role;

-- -------------------------------------------------------------
-- 4. Refund handling
--
-- Full refund:
--   - unused units are revoked
--   - consumed units remain in history
--   - consumed benefits are flagged for reconciliation
--
-- Partial refund:
--   - remaining units are held without being deleted
--   - manual reconciliation is required
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_refund_one_off_purchase(
  p_purchase_id     uuid,
  p_stripe_event_id text,
  p_refunded_amount integer,
  p_currency        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal
AS $$
DECLARE
  v_purchase           portal.purchases%ROWTYPE;
  v_allocation         portal.usage_bundle_allocations%ROWTYPE;
  v_billing_account_id uuid;
  v_unused_quantity    integer := 0;
  v_consumed_quantity  integer := 0;
  v_is_full_refund     boolean := false;
BEGIN
  IF p_stripe_event_id IS NULL OR btrim(p_stripe_event_id) = '' THEN
    RAISE EXCEPTION 'stripe_event_id_required';
  END IF;

  IF p_refunded_amount IS NULL OR p_refunded_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_refunded_amount';
  END IF;

  IF p_currency IS NULL OR btrim(p_currency) = '' THEN
    RAISE EXCEPTION 'purchase_currency_required';
  END IF;

  SELECT p.*
    INTO v_purchase
    FROM portal.purchases p
   WHERE p.id = p_purchase_id
   FOR UPDATE OF p;

  IF v_purchase.id IS NULL THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;

  IF v_purchase.status NOT IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'purchase_not_paid:%', v_purchase.status;
  END IF;

  IF v_purchase.currency <> lower(p_currency) THEN
    RAISE EXCEPTION 'purchase_currency_mismatch';
  END IF;

  IF p_refunded_amount > v_purchase.gross_amount THEN
    RAISE EXCEPTION 'invalid_refunded_amount';
  END IF;

  IF p_refunded_amount <= v_purchase.refunded_amount THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'refunded_amount', v_purchase.refunded_amount
    );
  END IF;

  v_is_full_refund :=
    p_refunded_amount = v_purchase.gross_amount;

  IF v_purchase.purchase_type = 'usage_bundle' THEN
    SELECT a.*
      INTO v_allocation
      FROM portal.usage_bundle_allocations a
     WHERE a.purchase_id = v_purchase.id
     FOR UPDATE OF a;

    IF v_allocation.id IS NULL THEN
      RAISE EXCEPTION 'usage_bundle_allocation_not_found';
    END IF;

    v_unused_quantity := v_allocation.quantity_remaining;
    v_consumed_quantity :=
      v_allocation.quantity_purchased - v_allocation.quantity_remaining;

    SELECT ba.id
      INTO v_billing_account_id
      FROM portal.billing_accounts ba
     WHERE ba.org_id = v_purchase.org_id
       AND ba.billing_type = 'owner'
     ORDER BY ba.updated_at DESC
     LIMIT 1;

    IF v_is_full_refund THEN
      UPDATE portal.usage_bundle_allocations
         SET quantity_remaining = 0,
             status = CASE
                        WHEN v_consumed_quantity > 0 THEN 'held'
                        ELSE 'refunded'
                      END
       WHERE id = v_allocation.id;

      INSERT INTO portal.usage_ledger (
        org_id,
        billing_account_id,
        event_type,
        quantity,
        reference_type,
        reference_id,
        purchase_id
      ) VALUES (
        v_purchase.org_id,
        v_billing_account_id,
        'usage_bundle_refunded',
        v_unused_quantity,
        'purchase',
        v_purchase.id::text,
        v_purchase.id
      )
      ON CONFLICT DO NOTHING;
    ELSE
      UPDATE portal.usage_bundle_allocations
         SET status = 'held'
       WHERE id = v_allocation.id;

      INSERT INTO portal.usage_ledger (
        org_id,
        billing_account_id,
        event_type,
        quantity,
        reference_type,
        reference_id,
        purchase_id
      ) VALUES (
        v_purchase.org_id,
        v_billing_account_id,
        'usage_bundle_held',
        v_unused_quantity,
        'purchase',
        v_purchase.id::text,
        v_purchase.id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE portal.purchases
     SET status = CASE
                    WHEN v_is_full_refund THEN 'refunded'
                    ELSE status
                  END,
         refunded_amount = p_refunded_amount,
         refunded_at = CASE
                         WHEN v_is_full_refund THEN now()
                         ELSE refunded_at
                       END,
         reconciliation_required =
           (NOT v_is_full_refund) OR v_consumed_quantity > 0,
         metadata = metadata || jsonb_build_object(
           'refund_event_id', p_stripe_event_id,
           'refunded_amount', p_refunded_amount,
           'unused_quantity_reversed',
             CASE WHEN v_is_full_refund THEN v_unused_quantity ELSE 0 END,
           'consumed_quantity', v_consumed_quantity
         )
   WHERE id = v_purchase.id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'full_refund', v_is_full_refund,
    'unused_quantity', v_unused_quantity,
    'consumed_quantity', v_consumed_quantity,
    'reconciliation_required',
      (NOT v_is_full_refund) OR v_consumed_quantity > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION portal.fn_refund_one_off_purchase(
  uuid, text, integer, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION portal.fn_refund_one_off_purchase(
  uuid, text, integer, text
) TO service_role;

-- -------------------------------------------------------------
-- 5. Dispute handling
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.fn_dispute_one_off_purchase(
  p_purchase_id     uuid,
  p_stripe_event_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal
AS $$
DECLARE
  v_purchase           portal.purchases%ROWTYPE;
  v_allocation         portal.usage_bundle_allocations%ROWTYPE;
  v_billing_account_id uuid;
  v_unused_quantity    integer := 0;
  v_consumed_quantity  integer := 0;
BEGIN
  IF p_stripe_event_id IS NULL OR btrim(p_stripe_event_id) = '' THEN
    RAISE EXCEPTION 'stripe_event_id_required';
  END IF;

  SELECT p.*
    INTO v_purchase
    FROM portal.purchases p
   WHERE p.id = p_purchase_id
   FOR UPDATE OF p;

  IF v_purchase.id IS NULL THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;

  IF v_purchase.status = 'disputed' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  IF v_purchase.status NOT IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'purchase_not_paid:%', v_purchase.status;
  END IF;

  IF v_purchase.purchase_type = 'usage_bundle' THEN
    SELECT a.*
      INTO v_allocation
      FROM portal.usage_bundle_allocations a
     WHERE a.purchase_id = v_purchase.id
     FOR UPDATE OF a;

    IF v_allocation.id IS NOT NULL THEN
      v_unused_quantity := v_allocation.quantity_remaining;
      v_consumed_quantity :=
        v_allocation.quantity_purchased - v_allocation.quantity_remaining;

      SELECT ba.id
        INTO v_billing_account_id
        FROM portal.billing_accounts ba
       WHERE ba.org_id = v_purchase.org_id
         AND ba.billing_type = 'owner'
       ORDER BY ba.updated_at DESC
       LIMIT 1;

      UPDATE portal.usage_bundle_allocations
         SET status = 'held'
       WHERE id = v_allocation.id;

      INSERT INTO portal.usage_ledger (
        org_id,
        billing_account_id,
        event_type,
        quantity,
        reference_type,
        reference_id,
        purchase_id
      ) VALUES (
        v_purchase.org_id,
        v_billing_account_id,
        'usage_bundle_held',
        v_unused_quantity,
        'purchase',
        v_purchase.id::text,
        v_purchase.id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE portal.purchases
     SET status = 'disputed',
         disputed_at = now(),
         reconciliation_required = true,
         metadata = metadata || jsonb_build_object(
           'dispute_event_id', p_stripe_event_id,
           'unused_quantity_held', v_unused_quantity,
           'consumed_quantity', v_consumed_quantity
         )
   WHERE id = v_purchase.id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'unused_quantity_held', v_unused_quantity,
    'consumed_quantity', v_consumed_quantity,
    'reconciliation_required', true
  );
END;
$$;

REVOKE ALL ON FUNCTION portal.fn_dispute_one_off_purchase(uuid, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION portal.fn_dispute_one_off_purchase(uuid, text)
  TO service_role;

-- -------------------------------------------------------------
-- Rollback notes
-- -------------------------------------------------------------
-- Before any one-off payment is accepted, these functions may be dropped and
-- the added reconciliation columns/indexes removed. After money is accepted,
-- never delete purchase, allocation or ledger history during rollback. Disable
-- checkout and keep these audit functions/tables in place instead.
