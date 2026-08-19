// apps/web/app/api/billing/usage-bundles/checkout/route.ts
// POST — create a one-off Stripe Checkout Session for 20 extra usages.

import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import {
  getActiveEntitlement,
  getOrgRow,
  getOwnerBillingAccount,
  getStripeMode,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRequest = {
  orgId?: string;
};

type UsageBundleCatalogRow = {
  id: string;
  bundle_code: string;
  display_name: string;
  tier: number;
  quantity: number;
  currency: string;
  amount_cents: number;
  stripe_mode: "sandbox" | "live";
  stripe_price_id: string | null;
  active: boolean;
  expires_after_days: number | null;
};

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

function getStripeClient(): Stripe {
  const stripeMode = getStripeMode();
  const key =
    stripeMode === "live"
      ? process.env.STRIPE_SECRET_KEY
      : process.env.SANDBOX_STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      stripeMode === "live"
        ? "Missing STRIPE_SECRET_KEY"
        : "Missing SANDBOX_STRIPE_SECRET_KEY",
    );
  }

  const expectedPrefix = stripeMode === "live" ? "sk_live_" : "sk_test_";

  if (!key.startsWith(expectedPrefix)) {
    throw new Error(
      `STRIPE_MODE is ${stripeMode}, but the configured Stripe secret key is not a ${stripeMode} key.`,
    );
  }

  return new Stripe(key);
}

function isMissingStripeResource(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    raw?: { code?: string };
  };

  return (
    candidate.code === "resource_missing" ||
    candidate.raw?.code === "resource_missing"
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to create usage-bundle checkout.";
}

async function readRequest(req: Request): Promise<CheckoutRequest> {
  try {
    return (await req.json()) as CheckoutRequest;
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  if (process.env.REVENUE_USAGE_BUNDLES_ENABLED !== "true") {
    return jerr(
      "Usage-bundle purchases are not currently available.",
      "feature_disabled",
      503,
    );
  }

  const auth = await getAuthUser();
  if (auth.error) return auth.error;

  const body = await readRequest(req);
  const resolved = await resolveOwnerOrgId(auth.user.id, body.orgId ?? null);

  if (!resolved.ok) {
    return jerr(resolved.error, resolved.code, resolved.status);
  }

  const org = await getOrgRow(resolved.orgId);

  if (!org) return jerr("Organisation not found.", "org_not_found", 404);
  if (org.status !== "active") {
    return jerr(
      "The organisation must be active before purchasing extra usages.",
      "org_not_active",
      409,
    );
  }

  const entitlement = await getActiveEntitlement(org.id);

  if (!entitlement || entitlement.tier < 1 || entitlement.tier > 4) {
    return jerr(
      "An active paid subscription is required to purchase extra usages.",
      "paid_subscription_required",
      409,
    );
  }

  const billingAccount = await getOwnerBillingAccount(org.id);

  if (!billingAccount) {
    return jerr("Billing account not found.", "billing_account_missing", 409);
  }

  const stripeStatus = billingAccount.stripe_status?.trim().toLowerCase() ?? "";

  if (stripeStatus !== "active" && stripeStatus !== "trialing") {
    return jerr(
      "The subscription must be active before purchasing extra usages.",
      "subscription_not_active",
      409,
    );
  }

  if (!auth.user.email) {
    return jerr("Your account has no email address.", "email_required", 400);
  }

  const stripeMode = getStripeMode();
  const { data: catalogData, error: catalogError } = await portalAdmin()
    .from("usage_bundle_catalog")
    .select(
      "id, bundle_code, display_name, tier, quantity, currency, amount_cents, stripe_mode, stripe_price_id, active, expires_after_days",
    )
    .eq("bundle_code", "extra_20")
    .eq("tier", entitlement.tier)
    .eq("stripe_mode", stripeMode)
    .eq("active", true)
    .maybeSingle();

  if (catalogError) {
    return jerr(catalogError.message, "bundle_lookup_failed", 500);
  }

  const catalog = catalogData as UsageBundleCatalogRow | null;

  if (!catalog?.stripe_price_id) {
    return jerr(
      `The Tier ${entitlement.tier} usage bundle is not configured for ${stripeMode}.`,
      "bundle_not_configured",
      409,
    );
  }

  if (catalog.expires_after_days !== null) {
    return jerr(
      "The configured usage bundle does not match the no-expiry policy.",
      "invalid_bundle_policy",
      409,
    );
  }

  let stripe: Stripe;

  try {
    stripe = getStripeClient();
  } catch (error) {
    return jerr(getErrorMessage(error), "stripe_configuration_error", 500);
  }

  let stripePrice: Stripe.Price;

  try {
    stripePrice = await stripe.prices.retrieve(catalog.stripe_price_id);
  } catch (error) {
    if (isMissingStripeResource(error)) {
      return jerr(
        `The configured Price ID does not exist in the ${stripeMode} Stripe account.`,
        "stripe_price_mode_mismatch",
        409,
      );
    }

    return jerr(getErrorMessage(error), "stripe_price_lookup_failed", 502);
  }

  if (
    !stripePrice.active ||
    stripePrice.type !== "one_time" ||
    stripePrice.currency.toLowerCase() !== catalog.currency ||
    stripePrice.unit_amount !== catalog.amount_cents
  ) {
    return jerr(
      "The Stripe Price does not match the configured one-time bundle price.",
      "stripe_price_mismatch",
      409,
    );
  }

  let usableCustomerId: string | null = null;

  if (billingAccount.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(
        billingAccount.stripe_customer_id,
      );

      if (!customer.deleted) usableCustomerId = customer.id;
    } catch (error) {
      if (!isMissingStripeResource(error)) {
        return jerr(getErrorMessage(error), "customer_lookup_failed", 502);
      }

      // A Preview deployment can share the database with Production while
      // using a sandbox Stripe account. Do not overwrite the live customer ID.
      usableCustomerId = null;
    }
  }

  const purchaseInsert = await portalAdmin()
    .from("purchases")
    .insert({
      purchase_type: "usage_bundle",
      org_id: org.id,
      buyer_user_id: auth.user.id,
      buyer_email: auth.user.email,
      stripe_mode: stripeMode,
      stripe_price_id: catalog.stripe_price_id,
      gross_amount: catalog.amount_cents,
      currency: catalog.currency,
      status: "pending",
      metadata: {
        bundle_catalog_id: catalog.id,
        bundle_code: catalog.bundle_code,
        quantity: catalog.quantity,
        tier: catalog.tier,
      },
    })
    .select("id")
    .single();

  if (purchaseInsert.error || !purchaseInsert.data?.id) {
    return jerr(
      purchaseInsert.error?.message || "Unable to create purchase record.",
      "purchase_create_failed",
      500,
    );
  }

  const purchaseId = String(purchaseInsert.data.id);
  const origin = new URL(req.url).origin;
  const billingPath =
    `/portal/billing?orgId=${encodeURIComponent(org.id)}`;

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: catalog.stripe_price_id, quantity: 1 }],
        ...(usableCustomerId
          ? { customer: usableCustomerId }
          : { customer_email: auth.user.email }),
        client_reference_id: org.id,
        success_url:
          `${origin}${billingPath}&bundle=success` +
          `&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${billingPath}&bundle=cancelled`,
        metadata: {
          purchase_id: purchaseId,
          purchase_type: "usage_bundle",
          org_id: org.id,
          bundle_catalog_id: catalog.id,
          quantity: String(catalog.quantity),
          tier: String(catalog.tier),
          stripe_mode: stripeMode,
        },
        payment_intent_data: {
          metadata: {
            purchase_id: purchaseId,
            purchase_type: "usage_bundle",
            org_id: org.id,
            stripe_mode: stripeMode,
          },
        },
      },
      { idempotencyKey: `mc-usage-bundle-${purchaseId}` },
    );
  } catch (error) {
    await portalAdmin()
      .from("purchases")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        metadata: {
          bundle_catalog_id: catalog.id,
          bundle_code: catalog.bundle_code,
          quantity: catalog.quantity,
          tier: catalog.tier,
          checkout_error: getErrorMessage(error),
        },
      })
      .eq("id", purchaseId);

    return jerr(getErrorMessage(error), "stripe_checkout_failed", 502);
  }

  if (!session.url) {
    return jerr(
      "Stripe did not return a Checkout URL.",
      "checkout_url_missing",
      502,
    );
  }

  const purchaseUpdate = await portalAdmin()
    .from("purchases")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", purchaseId);

  if (purchaseUpdate.error) {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // The purchase remains pending and the URL is not returned to the user.
    }

    return jerr(
      purchaseUpdate.error.message,
      "purchase_session_update_failed",
      500,
    );
  }

  return NextResponse.json({
    ok: true,
    url: session.url,
    sessionId: session.id,
    purchaseId,
  });
}