// apps/web/app/api/stripe/webhook/route.ts
// POST — canonical Stripe webhook for onboarding and legacy billing.

import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getStripeMode } from "@/app/_lib/billing";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventMeta = {
  orgId: string | null;
  customer: string | null;
  subId: string | null;
  stripeStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
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

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
]);

function getStripeSecretKey(): string {
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

  return key;
}

function getStripeWebhookSecret(): string {
  const stripeMode = getStripeMode();
  const secret =
    stripeMode === "live"
      ? process.env.STRIPE_WEBHOOK_SECRET
      : process.env.SANDBOX_STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      stripeMode === "live"
        ? "Missing STRIPE_WEBHOOK_SECRET"
        : "Missing SANDBOX_STRIPE_WEBHOOK_SECRET",
    );
  }

  return secret;
}

function getExpandableId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function toIso(unix: number | null | undefined): string | null {
  if (unix === null || unix === undefined || !Number.isFinite(unix)) {
    return null;
  }

  return new Date(unix * 1000).toISOString();
}

function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  periodStart: string | null;
  periodEnd: string | null;
} {
  const subscriptionWithPeriods = subscription as SubscriptionWithPeriods;
  const firstItem = subscription.items.data[0] as
    | SubscriptionItemWithPeriods
    | undefined;

  return {
    periodStart: toIso(
      subscriptionWithPeriods.current_period_start ??
        firstItem?.current_period_start ??
        null,
    ),
    periodEnd: toIso(
      subscriptionWithPeriods.current_period_end ??
        firstItem?.current_period_end ??
        null,
    ),
  };
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const invoiceWithSubscription = invoice as InvoiceWithSubscription;

  return (
    getExpandableId(invoiceWithSubscription.subscription) ??
    getExpandableId(
      invoiceWithSubscription.parent?.subscription_details?.subscription,
    )
  );
}

function applySubscriptionMeta(
  meta: EventMeta,
  subscription: Stripe.Subscription,
): void {
  const { periodStart, periodEnd } = getSubscriptionPeriod(subscription);

  meta.subId = subscription.id;
  meta.customer = getExpandableId(subscription.customer);
  meta.orgId = subscription.metadata?.org_id?.trim() || meta.orgId;
  meta.stripeStatus = subscription.status;
  meta.periodStart = periodStart;
  meta.periodEnd = periodEnd;
}

async function lookupOrgId(
  subscriptionId: string | null,
  customerId: string | null,
): Promise<string | null> {
  const sb = portalAdmin();

  if (subscriptionId) {
    const { data, error } = await sb
      .from("billing_accounts")
      .select("org_id")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("billing_type", "owner")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`subscription_org_lookup_failed:${error.message}`);
    }

    if (data?.org_id) return String(data.org_id);
  }

  if (customerId) {
    const { data, error } = await sb
      .from("billing_accounts")
      .select("org_id")
      .eq("stripe_customer_id", customerId)
      .eq("billing_type", "owner")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`customer_org_lookup_failed:${error.message}`);
    }

    if (data?.org_id) return String(data.org_id);
  }

  return null;
}

async function extractMeta(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<EventMeta> {
  const obj = event.data.object;
  const meta: EventMeta = {
    orgId: null,
    customer: null,
    subId: null,
    stripeStatus: null,
    periodStart: null,
    periodEnd: null,
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = obj as Stripe.Checkout.Session;

      meta.orgId =
        session.metadata?.org_id?.trim() || session.client_reference_id || null;
      meta.customer = getExpandableId(session.customer);
      meta.subId = getExpandableId(session.subscription);

      if (meta.subId) {
        const subscription = await stripe.subscriptions.retrieve(meta.subId);
        applySubscriptionMeta(meta, subscription);
      }

      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const eventSubscription = obj as Stripe.Subscription;
      const subscription = await stripe.subscriptions.retrieve(
        eventSubscription.id,
      );

      applySubscriptionMeta(meta, subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = obj as Stripe.Subscription;

      applySubscriptionMeta(meta, subscription);
      meta.stripeStatus = "canceled";
      break;
    }

    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required": {
      const invoice = obj as Stripe.Invoice;

      meta.customer = getExpandableId(invoice.customer);
      meta.subId = getInvoiceSubscriptionId(invoice);

      if (meta.subId) {
        const subscription = await stripe.subscriptions.retrieve(meta.subId);
        applySubscriptionMeta(meta, subscription);
      }

      if (event.type === "invoice.payment_failed" && !meta.stripeStatus) {
        meta.stripeStatus = "past_due";
      }

      break;
    }
  }

  if (!meta.orgId) {
    meta.orgId = await lookupOrgId(meta.subId, meta.customer);
  }

  return meta;
}

function isDuplicateInsert(error: {
  code?: string;
  message?: string;
}): boolean {
  const message = String(error.message || "").toLowerCase();

  return (
    error.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  );
}

async function prepareEvent(event: Stripe.Event): Promise<{
  shouldProcess: boolean;
}> {
  const sb = portalAdmin();
  const insert = await sb
    .from("stripe_events")
    .insert({
      stripe_event_id: event.id,
      type: event.type,
      payload: event as never,
      status: "ok",
    })
    .select("id")
    .maybeSingle();

  if (!insert.error) return { shouldProcess: true };

  if (!isDuplicateInsert(insert.error)) {
    throw new Error(`persist_failed:${insert.error.message}`);
  }

  const existing = await sb
    .from("stripe_events")
    .select("status, processed_at")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing.error || !existing.data) {
    throw new Error(
      `duplicate_lookup_failed:${existing.error?.message || "event_not_found"}`,
    );
  }

  if (existing.data.status === "ok" && existing.data.processed_at) {
    return { shouldProcess: false };
  }

  const retry = await sb
    .from("stripe_events")
    .update({
      type: event.type,
      payload: event as never,
      status: "ok",
      processed_at: null,
      error: null,
    })
    .eq("stripe_event_id", event.id);

  if (retry.error) {
    throw new Error(`retry_prepare_failed:${retry.error.message}`);
  }

  return { shouldProcess: true };
}

async function finishEvent(
  eventId: string,
  status: "ok" | "failed",
  error: string | null = null,
): Promise<void> {
  const result = await portalAdmin()
    .from("stripe_events")
    .update({
      processed_at: new Date().toISOString(),
      status,
      error,
    })
    .eq("stripe_event_id", eventId);

  if (result.error) {
    throw new Error(`event_finish_failed:${result.error.message}`);
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing_signature" },
      { status: 400 },
    );
  }

  let stripe: Stripe;
  let webhookSecret: string;

  try {
    stripe = new Stripe(getStripeSecretKey());
    webhookSecret = getStripeWebhookSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe is not configured.";

    console.error("[stripe-webhook] Stripe configuration error:", error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    return NextResponse.json(
      { ok: false, error: `signature_failed:${message}` },
      { status: 400 },
    );
  }

  try {
    const prepared = await prepareEvent(event);

    if (!prepared.shouldProcess) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!HANDLED.has(event.type)) {
      await finishEvent(event.id, "ok");
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    const meta = await extractMeta(stripe, event);

    if (!meta.orgId) {
      await finishEvent(event.id, "failed", "org_id_unresolved");
      return NextResponse.json(
        { ok: false, error: "org_id_unresolved" },
        { status: 500 },
      );
    }

    const { error: rpcError } = await portalAdmin().rpc(
      "fn_apply_billing_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_org_id: meta.orgId,
        p_stripe_customer: meta.customer,
        p_stripe_sub_id: meta.subId,
        p_stripe_status: meta.stripeStatus,
        p_period_start: meta.periodStart,
        p_period_end: meta.periodEnd,
      } as never,
    );

    if (rpcError) {
      await finishEvent(event.id, "failed", rpcError.message);
      return NextResponse.json(
        { ok: false, error: `rpc_failed:${rpcError.message}` },
        { status: 500 },
      );
    }

    // The RPC marks the event complete transactionally. This is a harmless
    // second write and preserves compatibility if an older RPC is still live
    // during a rolling deployment.
    await finishEvent(event.id, "ok");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[stripe-webhook] Failed to process ${event.type}:`, error);

    try {
      await finishEvent(event.id, "failed", message);
    } catch (finishError) {
      console.error("[stripe-webhook] Unable to record failure:", finishError);
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
