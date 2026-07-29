//apps/web/app/api/billing/stripe-webhook/route.tspnpm --dir apps/web typecheck

import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getAdminClient } from "@/app/_lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BillingAccountLookupRow = {
  id: string;
  past_due_since: string | null;
};

type SubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

type SubscriptionItemWithPeriods = Stripe.SubscriptionItem & {
  current_period_start?: number;
  current_period_end?: number;
};

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  parent?: {
    subscription_details?: {
      subscription?: string | Stripe.Subscription | null;
    } | null;
  } | null;
};

type BillingAccountLookup =
  | {
      column: "id";
      value: string;
    }
  | {
      column: "stripe_subscription_id";
      value: string;
    }
  | {
      column: "stripe_customer_id";
      value: string;
    };

function getStripeSecretKey(): string {
  const isProduction = process.env.VERCEL_ENV === "production";

  const secretKey = isProduction
    ? process.env.STRIPE_SECRET_KEY
    : process.env.SANDBOX_STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      isProduction
        ? "Missing STRIPE_SECRET_KEY"
        : "Missing SANDBOX_STRIPE_SECRET_KEY"
    );
  }

  return secretKey;
}

function getStripeWebhookSecret(): string {
  const isProduction = process.env.VERCEL_ENV === "production";

  const webhookSecret = isProduction
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.SANDBOX_STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      isProduction
        ? "Missing STRIPE_WEBHOOK_SECRET"
        : "Missing SANDBOX_STRIPE_WEBHOOK_SECRET"
    );
  }

  return webhookSecret;
}

function getExpandableId(
  value:
    | string
    | {
        id: string;
      }
    | null
    | undefined
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id || null;
}

function unixTimestampToIso(
  timestamp: number | null | undefined
): string | null {
  if (
    timestamp === null ||
    timestamp === undefined ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  periodStart: string | null;
  periodEnd: string | null;
} {
  const subscriptionWithPeriods =
    subscription as SubscriptionWithPeriods;

  const firstItem = subscription.items.data[0] as
    | SubscriptionItemWithPeriods
    | undefined;

  const periodStart =
    subscriptionWithPeriods.current_period_start ??
    firstItem?.current_period_start ??
    null;

  const periodEnd =
    subscriptionWithPeriods.current_period_end ??
    firstItem?.current_period_end ??
    null;

  return {
    periodStart: unixTimestampToIso(periodStart),
    periodEnd: unixTimestampToIso(periodEnd),
  };
}

function getInvoiceSubscriptionId(
  invoice: Stripe.Invoice
): string | null {
  const invoiceWithSubscription =
    invoice as InvoiceWithSubscription;

  const directSubscriptionId = getExpandableId(
    invoiceWithSubscription.subscription
  );

  if (directSubscriptionId) {
    return directSubscriptionId;
  }

  return getExpandableId(
    invoiceWithSubscription.parent?.subscription_details
      ?.subscription
  );
}

async function findLegacyBillingAccount(
  subscription: Stripe.Subscription,
  preferredBillingAccountId?: string | null
): Promise<BillingAccountLookupRow | null> {
  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const customerId = getExpandableId(subscription.customer);

  const lookups: BillingAccountLookup[] = [];

  if (preferredBillingAccountId) {
    lookups.push({
      column: "id",
      value: preferredBillingAccountId,
    });
  }

  const metadataBillingAccountId =
    subscription.metadata?.billing_account_id?.trim();

  if (
    metadataBillingAccountId &&
    metadataBillingAccountId !== preferredBillingAccountId
  ) {
    lookups.push({
      column: "id",
      value: metadataBillingAccountId,
    });
  }

  lookups.push({
    column: "stripe_subscription_id",
    value: subscription.id,
  });

  if (customerId) {
    lookups.push({
      column: "stripe_customer_id",
      value: customerId,
    });
  }

  for (const lookup of lookups) {
    const { data, error } = await portal
      .from("billing_accounts")
      .select("id, past_due_since")
      .eq("billing_type", "owner")
      .eq("billing_source", "legacy")
      .eq(lookup.column, lookup.value)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to find billing account: ${error.message}`
      );
    }

    if (data) {
      return data as BillingAccountLookupRow;
    }
  }

  return null;
}

async function syncLegacySubscription(
  subscription: Stripe.Subscription,
  preferredBillingAccountId?: string | null
): Promise<boolean> {
  const billingAccount = await findLegacyBillingAccount(
    subscription,
    preferredBillingAccountId
  );

  if (!billingAccount) {
    console.info(
      `[stripe-webhook] No legacy billing account matched subscription ${subscription.id}.`
    );

    return false;
  }

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const customerId = getExpandableId(subscription.customer);
  const { periodStart, periodEnd } =
    getSubscriptionPeriod(subscription);

  const now = new Date().toISOString();

  const isPastDue =
    subscription.status === "past_due" ||
    subscription.status === "unpaid";

  const { error } = await portal
    .from("billing_accounts")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_status: subscription.status,
      period_start: periodStart,
      period_end: periodEnd,
      past_due_since: isPastDue
        ? billingAccount.past_due_since ?? now
        : null,
      updated_at: now,
    })
    .eq("id", billingAccount.id)
    .eq("billing_source", "legacy");

  if (error) {
    throw new Error(
      `Unable to update billing account: ${error.message}`
    );
  }

  console.info(
    `[stripe-webhook] Synced subscription ${subscription.id} with status ${subscription.status}.`
  );

  return true;
}

async function syncCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId = getExpandableId(session.subscription);

  if (!subscriptionId) {
    console.info(
      `[stripe-webhook] Checkout Session ${session.id} has no subscription.`
    );

    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    subscriptionId
  );

  await syncLegacySubscription(
    subscription,
    session.metadata?.billing_account_id ?? null
  );
}

async function syncInvoiceSubscription(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    console.info(
      `[stripe-webhook] Invoice ${invoice.id} has no subscription.`
    );

    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    subscriptionId
  );

  await syncLegacySubscription(subscription);
}

async function syncSubscriptionEvent(
  stripe: Stripe,
  eventType: string,
  eventSubscription: Stripe.Subscription
): Promise<void> {
  /*
   * A deleted subscription is synced directly from the event because its
   * canceled status is already represented in the event payload.
   */
  if (eventType === "customer.subscription.deleted") {
    await syncLegacySubscription(eventSubscription);
    return;
  }

  /*
   * Retrieve the latest Stripe state rather than assuming events always
   * arrive in chronological order.
   */
  const currentSubscription =
    await stripe.subscriptions.retrieve(eventSubscription.id);

  await syncLegacySubscription(currentSubscription);
}

export async function POST(request: Request) {
  let stripe: Stripe;

  try {
    stripe = new Stripe(getStripeSecretKey());
  } catch (error) {
    console.error("[stripe-webhook] Stripe configuration error:", error);

    return NextResponse.json(
      {
        received: false,
        error:
          error instanceof Error
            ? error.message
            : "Stripe is not configured.",
      },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        received: false,
        error: "Missing Stripe signature.",
      },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    console.error(
      "[stripe-webhook] Signature verification failed:",
      error
    );

    return NextResponse.json(
      {
        received: false,
        error: "Invalid Stripe webhook signature.",
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        await syncCheckoutSession(stripe, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscription =
          event.data.object as Stripe.Subscription;

        await syncSubscriptionEvent(
          stripe,
          event.type,
          subscription
        );

        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const invoice = event.data.object as Stripe.Invoice;

        await syncInvoiceSubscription(stripe, invoice);
        break;
      }

      default:
        console.info(
          `[stripe-webhook] Ignoring event ${event.type}.`
        );
    }
  } catch (error) {
    console.error(
      `[stripe-webhook] Failed to process ${event.type}:`,
      error
    );

    return NextResponse.json(
      {
        received: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Stripe event.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    received: true,
  });
}