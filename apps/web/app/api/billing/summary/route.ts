import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  getActiveEntitlement,
  getOrgRow,
  getOwnerPricesForTier,
  getSubmissionUsage,
  PILOT_GRACE_HOURS,
  PILOT_TIER,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingDisplayStatus =
  | "active"
  | "past_due"
  | "payment_required"
  | "cancelled";

type BillingAccountRow = {
  id: string;
  org_id: string;
  billing_type: "owner" | "licensee";
  tier: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  period_start: string | null;
  period_end: string | null;
  past_due_since: string | null;
  billing_source: "onboarding" | "legacy";
  billing_interval: "monthly" | "annual";
  billing_required_from: string | null;
  created_at: string;
  updated_at: string;
};

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

type FallbackPlan = {
  name: string;
  interval: string | null;
  amount_cents: number | null;
  currency: string | null;
};

const TIER_NAMES: Record<number, string> = {
  1: "MindCanvas Starter",
  2: "MindCanvas Pro",
  3: "MindCanvas Niche",
  4: "MindCanvas Enterprise",
};

const FALLBACK_MONTHLY_AMOUNTS: Record<
  number,
  number
> = {
  1: 14700,
  2: 34700,
  3: 54700,
  4: 99700,
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

  if (
    status === "active" ||
    status === "trialing"
  ) {
    return "active";
  }

  if (
    status === "past_due" ||
    status === "unpaid"
  ) {
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

function billingPriority(
  account: BillingAccountRow
) {
  const status =
    account.stripe_status?.toLowerCase() ?? "";

  const statusPriority: Record<string, number> = {
    active: 100,
    trialing: 90,
    past_due: 80,
    unpaid: 75,
    incomplete: 70,
    incomplete_expired: 65,
    paused: 60,
    canceled: 20,
    cancelled: 20,
  };

  return statusPriority[status] ?? 40;
}

function pickCurrentBillingAccount(
  rows: BillingAccountRow[]
): BillingAccountRow | null {
  if (!rows.length) {
    return null;
  }

  return rows.slice().sort((a, b) => {
    const priorityDifference =
      billingPriority(b) - billingPriority(a);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (
      new Date(b.updated_at).getTime() -
      new Date(a.updated_at).getTime()
    );
  })[0];
}

function unixTimestampToIso(
  timestamp: number
): string {
  return new Date(
    timestamp * 1000
  ).toISOString();
}

function getDefaultFallbackPlan(
  tier: number | null,
  isLegacy: boolean,
  billingInterval: string | null
): FallbackPlan {
  if (!isLegacy || tier === null) {
    return {
      name: "MindCanvas subscription",
      interval: null,
      amount_cents: null,
      currency: null,
    };
  }

  return {
    name:
      TIER_NAMES[tier] ??
      `MindCanvas Tier ${tier}`,
    interval:
      billingInterval === "annual" ||
      billingInterval === "year"
        ? "year"
        : "month",
    amount_cents:
      billingInterval === "annual" ||
      billingInterval === "year"
        ? null
        : FALLBACK_MONTHLY_AMOUNTS[
            tier
          ] ?? null,
    currency: "usd",
  };
}

async function resolveFallbackPlan({
  tier,
  isLegacy,
  billingInterval,
}: {
  tier: number | null;
  isLegacy: boolean;
  billingInterval: string | null;
}): Promise<FallbackPlan> {
  const fallback = getDefaultFallbackPlan(
    tier,
    isLegacy,
    billingInterval
  );

  if (
    !isLegacy ||
    tier === null ||
    (billingInterval !== "monthly" &&
      billingInterval !== "month")
  ) {
    return fallback;
  }

  try {
    const { monthly } =
      await getOwnerPricesForTier(tier);

    if (!monthly) {
      return fallback;
    }

    return {
      name:
        TIER_NAMES[tier] ??
        `MindCanvas Tier ${tier}`,
      interval: monthly.interval,
      amount_cents: monthly.amount_cents,
      currency: monthly.currency,
    };
  } catch (error) {
    console.error(
      "[billing-summary] Unable to load configured tier price:",
      error
    );

    return fallback;
  }
}

async function getIncludedTrialAllowance(
  orgId: string,
  tier: number | null
): Promise<number | null> {
  if (tier === null) {
    return null;
  }

  const { data, error } = await portalAdmin()
    .from("entitlements")
    .select(
      "included_trials_per_month, updated_at"
    )
    .eq("org_id", orgId)
    .eq("tier", tier)
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[billing-summary] Unable to load configured test allowance:",
      error
    );

    return null;
  }

  const allowance =
    data?.included_trials_per_month;

  return typeof allowance === "number"
    ? allowance
    : null;
}

async function loadStripeDetails({
  customerId,
  subscriptionId,
  fallbackPlan,
}: {
  customerId: string | null;
  subscriptionId: string | null;
  fallbackPlan: FallbackPlan;
}) {
  if (!customerId) {
    return {
      plan: fallbackPlan,
      payment_method: null,
      invoices: [] as SafeInvoice[],
    };
  }

  try {
    const stripe = new Stripe(
      getStripeSecretKey()
    );

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
      subscription?.items.data[0]?.price ??
      null;

    const product = price?.product;

    const productName =
      product &&
      typeof product === "object" &&
      "name" in product &&
      typeof product.name === "string"
        ? product.name
        : null;

    const card =
      paymentMethods.data[0]?.card;

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
            invoice.hosted_invoice_url ??
            null,
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
  const orgIdHint =
    url.searchParams.get("orgId");

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

  const { data: billingData, error: billingError } =
    await portalAdmin()
      .from("billing_accounts")
      .select(
        "id, org_id, billing_type, tier, stripe_customer_id, stripe_subscription_id, stripe_status, period_start, period_end, past_due_since, billing_source, billing_interval, billing_required_from, created_at, updated_at"
      )
      .eq("org_id", orgId)
      .eq("billing_type", "owner")
      .order("updated_at", {
        ascending: false,
      });

  if (billingError) {
    return jerr(
      billingError.message,
      "billing_account_lookup_failed",
      500
    );
  }

  const billingRows = (billingData ?? []) as unknown as
    BillingAccountRow[];

  const billingAccount =
    pickCurrentBillingAccount(billingRows);

  const usage =
    await getSubmissionUsage(orgId);

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
            PILOT_GRACE_HOURS *
              60 *
              60 *
              1000
        ).toISOString()
      : null;

  const displayStatus = deriveDisplayStatus(
    org.status,
    billingAccount?.stripe_status
  );

  const isLegacy =
    billingAccount?.billing_source ===
    "legacy";

  const fallbackPlan =
    await resolveFallbackPlan({
      tier: billingAccount?.tier ?? null,
      isLegacy,
      billingInterval:
        billingAccount?.billing_interval ??
        null,
    });

  const includedTrialsPerMonth =
    billingAccount
      ? await getIncludedTrialAllowance(
          orgId,
          billingAccount.tier
        )
      : null;

  const stripeDetails =
    await loadStripeDetails({
      customerId:
        billingAccount?.stripe_customer_id ??
        null,
      subscriptionId:
        billingAccount
          ?.stripe_subscription_id ?? null,
      fallbackPlan,
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
          id: billingAccount.id,
          tier: billingAccount.tier,
          billing_type:
            billingAccount.billing_type,
          stripe_status:
            billingAccount.stripe_status,
          stripe_customer_id:
            billingAccount.stripe_customer_id,
          stripe_subscription_id:
            billingAccount.stripe_subscription_id,
          display_status: displayStatus,
          period_start:
            billingAccount.period_start,
          period_end:
            billingAccount.period_end,
          past_due_since:
            billingAccount.past_due_since,
          billing_source:
            billingAccount.billing_source,
          billing_interval:
            billingAccount.billing_interval,
          billing_required_from:
            billingAccount.billing_required_from,
          included_trials_per_month:
            includedTrialsPerMonth,
          is_pilot: isPilot,
          pilot_end_date: pilotEndDate,
          pilot_grace_ends_at: graceEndsAt,
          plan: stripeDetails.plan,
          payment_method:
            stripeDetails.payment_method,
          invoices:
            stripeDetails.invoices,
        }
      : null,

    next_action:
      deriveNextAction(displayStatus),
  });
}
