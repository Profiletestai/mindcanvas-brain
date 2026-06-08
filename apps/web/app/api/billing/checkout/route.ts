// apps/web/app/api/billing/checkout/route.ts
// POST — create a Stripe Checkout Session for the caller's org.

import "server-only";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  ensureStripeCustomer,
  getOrgRow,
  getOwnerBillingAccount,
  getOwnerPricesForTier,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";
import { getBaseUrl } from "@/lib/baseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

export async function POST(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;
  const user = auth.user;

  let body: { orgId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const resolved = await resolveOwnerOrgId(user.id, body.orgId ?? null);
  if (!resolved.ok) return jerr(resolved.error, resolved.code, resolved.status);
  const { orgId } = resolved;

  const org = await getOrgRow(orgId);
  if (!org) return jerr("Org not found", "org_not_found", 404);
  if (org.status === "archived") return jerr("Org archived", "org_archived", 409);
  if (org.status === "active") return jerr("Org already active", "org_already_active", 409);
  if (org.status === "suspended") return jerr("Org suspended", "org_suspended", 409);

  const ba = await getOwnerBillingAccount(orgId);
  if (!ba) return jerr("Billing account missing", "billing_account_missing", 500);
  if (!ba.tier) return jerr("Billing account has no tier", "tier_missing", 409);

  let prices;
  try {
    prices = await getOwnerPricesForTier(ba.tier);
  } catch (e: any) {
    return jerr(e?.message || "Price lookup failed", "price_lookup_failed", 500);
  }
  if (
    !prices.monthly?.stripe_price_id ||
    prices.monthly.stripe_price_id.endsWith("_PLACEHOLDER") ||
    !prices.monthly.amount_cents ||
    prices.monthly.amount_cents <= 0
  ) {
    return jerr(`No active priced plan for tier ${ba.tier}`, "prices_not_configured", 502);
  }
  if (!user.email) return jerr("User has no email", "email_required", 400);

  let customerId: string;
  try {
    customerId = await ensureStripeCustomer(orgId, user.email, org.name);
  } catch (e: any) {
    return jerr(e?.message || "Customer create failed", "customer_create_failed", 502);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: prices.monthly.stripe_price_id, quantity: 1 },
  ];

  const baseUrl = getBaseUrl();
  const orgQs = `orgId=${encodeURIComponent(orgId)}`;
  const successBase =
    process.env.STRIPE_CHECKOUT_SUCCESS_URL || `${baseUrl}/portal/billing?status=success`;
  const cancelBase =
    process.env.STRIPE_CHECKOUT_CANCEL_URL || `${baseUrl}/portal/billing?status=cancelled`;
  const successUrl = `${successBase}${successBase.includes("?") ? "&" : "?"}${orgQs}`;
  const cancelUrl = `${cancelBase}${cancelBase.includes("?") ? "&" : "?"}${orgQs}`;

  // Per-minute idempotency bucket: collapse accidental double-submits, allow legitimate retries.
  const bucket = Math.floor(Date.now() / 60_000);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: lineItems,
        success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        allow_promotion_codes: false,
        subscription_data: {
          metadata: { org_id: orgId, billing_account_id: ba.id },
        },
        client_reference_id: orgId,
        metadata: { org_id: orgId, billing_account_id: ba.id },
      },
      { idempotencyKey: `mc-checkout-${orgId}-${ba.id}-${bucket}` }
    );
  } catch (e: any) {
    if (e?.type === "StripeInvalidRequestError") return jerr(e.message, "stripe_invalid_request", 400);
    if (e?.type === "StripeRateLimitError") return jerr("Stripe is busy, try again", "stripe_rate_limit", 429);
    return jerr(e?.message || "Stripe error", "stripe_error", 502);
  }

  return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
}
