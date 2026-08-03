// apps/web/app/api/billing/summary/route.ts

import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  getActiveEntitlement,
  getOrgRow,
  getOwnerBillingAccount,
  getSubmissionUsage,
  PILOT_GRACE_HOURS,
  PILOT_TIER,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingDisplayStatus =
  | "active"
  | "past_due"
  | "payment_required"
  | "cancelled";

type SafeInvoice = {
  id: string;
  number: string | null;
  created_at: string;
  status: string | null;
  amount_cents: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

function jerr(
  error: string,
  code: string,
  status: number
) {
  return NextResponse.json(
    { ok: false, error, code },
    { status }
  );
}

function getStripeSecretKey(): string {
  const isProduction =
    process.env.VERCEL_ENV === "production";

  const key = isProduction
    ? process.env.STRIPE_SECRET_KEY
    : process.env.SANDBOX_STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      isProduction
        ? "Missing STRIPE_SECRET_KEY"
        : "Missing SANDBOX_STRIPE_SECRET_KEY"
    );
  }

  return key;
}

function deriveDisplayStatus(
  orgStatus: string,
  stripeStatus: string | null | undefined
): BillingDisplayStatus {
  const status =
    stripeStatus?.trim().toLowerCase() ?? "";

  if (status === "active" || status === "trialing") {
    return "active";
  }

  if (status === "past_due" || status === "unpaid") {
    return "past_due";
  }

  if (
    status === "canceled" ||
    status === "cancelled" ||
    orgStatus === "archived"
  ) {
    return "cancelled";
  }

  return "payment_required";
}

function deriveNextAction(
  status: BillingDisplayStatus
): "checkout" | "reactivate" | "none" {
  if (status === "active") {
    return "none";
  }

  if (status === "past_due") {
    return "reactivate";
  }

  return "checkout";
}

function unixTimestampToIso(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

async function loadStripeDetails({
  customerId,
  subscriptionId,
  isLegacy,
}: {
  customerId: string | null;
  subscriptionId: string | null;
  isLegacy: boolean;
}) {
  const fallbackPlan = {
    name: isLegacy
      ? "MindCanvas Pro"
      : "MindCanvas subscription",
    interval: isLegacy ? "month" : null,
    amount_cents: isLegacy ? 34700 : null,
    currency: isLegacy ? "usd" : null,
  };

  if (!customerId) {
    return {
      plan: fallbackPlan,
      payment_method: null,
      invoices: [] as SafeInvoice[],
    };
  }

  try {
    const stripe = new Stripe(getStripeSecretKey());

    const [
      subscription,
      paymentMethods,
      invoices,
    ] = await Promise.all([
      subscriptionId
        ? stripe.subscriptions.retrieve(
            subscriptionId,
            {
              expand: [
                "items.data.price.product",
              ],
            }
          )
        : Promise.resolve(null),
      stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      }),
      stripe.invoices.list({
        customer: customerId,
        limit: 12,
      }),
    ]);

    const price =
      subscription?.items.data[0]?.price ?? null;

    const product = price?.product;

    const productName =
      product &&
      typeof product === "object" &&
      "name" in product &&
      typeof product.name === "string"
        ? product.name
        : null;

    const card = paymentMethods.data[0]?.card;

    return {
      plan: {
        name:
          productName ||
          price?.nickname ||
          fallbackPlan.name,
        interval:
          price?.recurring?.interval ??
          fallbackPlan.interval,
        amount_cents:
          price?.unit_amount ??
          fallbackPlan.amount_cents,
        currency:
          price?.currency ??
          fallbackPlan.currency,
      },
      payment_method: card
        ? {
            brand: card.brand,
            last4: card.last4,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
          }
        : null,
      invoices: invoices.data.map(
        (invoice): SafeInvoice => ({
          id: invoice.id,
          number: invoice.number,
          created_at: unixTimestampToIso(
            invoice.created
          ),
          status: invoice.status,
          amount_cents:
            invoice.amount_paid ||
            invoice.total ||
            invoice.amount_due,
          currency: invoice.currency,
          hosted_invoice_url:
            invoice.hosted_invoice_url ?? null,
          invoice_pdf:
            invoice.invoice_pdf ?? null,
        })
      ),
    };
  } catch (error) {
    console.error(
      "[billing-summary] Unable to load Stripe display details:",
      error
    );

    /*
     * The database remains the status source of truth. A
     * temporary Stripe read failure must not hide the
     * organisation's saved billing status.
     */
    return {
      plan: fallbackPlan,
      payment_method: null,
      invoices: [] as SafeInvoice[],
    };
  }
}

export async function GET(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) {
    return auth.error;
  }

  const user = auth.user;
  const url = new URL(req.url);
  const orgIdHint = url.searchParams.get("orgId");

  const resolved = await resolveOwnerOrgId(
    user.id,
    orgIdHint
  );

  if (!resolved.ok) {
    return jerr(
      resolved.error,
      resolved.code,
      resolved.status
    );
  }

  const { orgId } = resolved;

  const org = await getOrgRow(orgId);

  if (!org) {
    return jerr(
      "Org not found",
      "org_not_found",
      404
    );
  }

  const billingAccount =
    await getOwnerBillingAccount(orgId);

  const usage = await getSubmissionUsage(orgId);
  const entitlement =
    await getActiveEntitlement(orgId);

  const isPilot =
    entitlement?.tier === PILOT_TIER;

  const graceEndsAt = isPilot
    ? entitlement?.period_end ?? null
    : null;

  const pilotEndDate =
    isPilot && entitlement?.period_end
      ? new Date(
          new Date(
            entitlement.period_end
          ).getTime() -
            PILOT_GRACE_HOURS * 60 * 60 * 1000
        ).toISOString()
      : null;

  const displayStatus = deriveDisplayStatus(
    org.status,
    billingAccount?.stripe_status
  );

  const stripeDetails = await loadStripeDetails({
    customerId:
      billingAccount?.stripe_customer_id ?? null,
    subscriptionId:
      billingAccount?.stripe_subscription_id ??
      null,
    isLegacy:
      billingAccount?.billing_source === "legacy",
  });

  return NextResponse.json({
    ok: true,
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
    },
    usage,
    billing: billingAccount
      ? {
          tier: billingAccount.tier,
          stripe_status:
            billingAccount.stripe_status,
          display_status: displayStatus,
          period_start:
            billingAccount.period_start,
          period_end: billingAccount.period_end,
          past_due_since:
            billingAccount.past_due_since,
          billing_source:
            billingAccount.billing_source,
          billing_interval:
            billingAccount.billing_interval,
          is_pilot: isPilot,
          pilot_end_date: pilotEndDate,
          pilot_grace_ends_at: graceEndsAt,
          plan: stripeDetails.plan,
          payment_method:
            stripeDetails.payment_method,
          invoices: stripeDetails.invoices,
        }
      : null,
    next_action: deriveNextAction(displayStatus),
  });
}
