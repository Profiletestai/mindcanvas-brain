// apps/web/app/api/stripe/webhook/route.ts
// POST — Stripe webhook receiver. Verifies signature, persists event, dispatches RPC.

import "server-only";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventMeta = {
  orgId: string | null;
  customer: string | null;
  subId: string | null;
  stripeStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

function toIso(unix: number | null | undefined): string | null {
  if (!unix && unix !== 0) return null;
  return new Date(unix * 1000).toISOString();
}

async function lookupOrgIdByCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await portalAdmin()
    .from("billing_accounts")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .eq("billing_type", "owner")
    .maybeSingle();
  if (error) return null;
  return (data as any)?.org_id ?? null;
}

async function extractMeta(event: Stripe.Event): Promise<EventMeta> {
  const obj: any = event.data.object;
  const meta: EventMeta = {
    orgId: null,
    customer: null,
    subId: null,
    stripeStatus: null,
    periodStart: null,
    periodEnd: null,
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = obj as Stripe.Checkout.Session;
      meta.orgId =
        (session.metadata?.org_id as string) ||
        (session.client_reference_id as string) ||
        null;
      meta.customer = (session.customer as string) ?? null;
      meta.subId = (session.subscription as string) ?? null;

      if (meta.subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(meta.subId);
          meta.stripeStatus = sub.status;
          meta.periodStart = toIso(sub.current_period_start);
          meta.periodEnd = toIso(sub.current_period_end);
          if (!meta.orgId && sub.metadata?.org_id) meta.orgId = sub.metadata.org_id as string;
        } catch {
          // leave nulls; webhook will retry if RPC complains
        }
      }
      if (!meta.orgId && meta.customer) meta.orgId = await lookupOrgIdByCustomer(meta.customer);
      return meta;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = obj as Stripe.Subscription;
      meta.subId = sub.id;
      meta.customer = (sub.customer as string) ?? null;
      meta.orgId = (sub.metadata?.org_id as string) || null;
      meta.stripeStatus = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
      meta.periodStart = toIso(sub.current_period_start);
      meta.periodEnd = toIso(sub.current_period_end);
      if (!meta.orgId && meta.customer) meta.orgId = await lookupOrgIdByCustomer(meta.customer);
      return meta;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = obj as Stripe.Invoice;
      meta.customer = (invoice.customer as string) ?? null;
      meta.subId = (invoice.subscription as string) ?? null;

      if (meta.subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(meta.subId);
          meta.orgId = (sub.metadata?.org_id as string) || null;
          meta.stripeStatus = sub.status;
          meta.periodStart = toIso(sub.current_period_start);
          meta.periodEnd = toIso(sub.current_period_end);
        } catch {
          // ignore
        }
      }
      if (!meta.orgId && meta.customer) meta.orgId = await lookupOrgIdByCustomer(meta.customer);
      // payment_failed often arrives before sub.updated flips status; force past_due as a hint.
      if (event.type === "invoice.payment_failed" && !meta.stripeStatus) meta.stripeStatus = "past_due";
      return meta;
    }
  }
  return meta;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "webhook_secret_unset" }, { status: 500 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `signature_failed:${e?.message}` }, { status: 400 });
  }

  const sb = portalAdmin();

  // Persist event row; UNIQUE on stripe_event_id makes duplicate deliveries a no-op.
  const insert = await sb
    .from("stripe_events")
    .insert({
      stripe_event_id: event.id,
      type: event.type,
      payload: event as any,
      status: "ok",
    })
    .select("id")
    .maybeSingle();

  if (insert.error) {
    const msg = String(insert.error.message || "");
    // Duplicate event: already processed.
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ ok: false, error: `persist_failed:${msg}` }, { status: 500 });
  }

  if (!HANDLED.has(event.type)) {
    await sb
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), status: "ok" })
      .eq("stripe_event_id", event.id);
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    const meta = await extractMeta(event);
    if (!meta.orgId) {
      await sb
        .from("stripe_events")
        .update({
          processed_at: new Date().toISOString(),
          status: "failed",
          error: "org_id_unresolved",
        })
        .eq("stripe_event_id", event.id);
      return NextResponse.json({ ok: false, error: "org_id_unresolved" }, { status: 500 });
    }

    const { error: rpcErr } = await sb.rpc("fn_apply_billing_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_org_id: meta.orgId,
      p_stripe_customer: meta.customer,
      p_stripe_sub_id: meta.subId,
      p_stripe_status: meta.stripeStatus,
      p_period_start: meta.periodStart,
      p_period_end: meta.periodEnd,
    } as any);

    if (rpcErr) {
      await sb
        .from("stripe_events")
        .update({
          processed_at: new Date().toISOString(),
          status: "failed",
          error: rpcErr.message,
        })
        .eq("stripe_event_id", event.id);
      return NextResponse.json({ ok: false, error: `rpc_failed:${rpcErr.message}` }, { status: 500 });
    }

    await sb
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), status: "ok" })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await sb
      .from("stripe_events")
      .update({
        processed_at: new Date().toISOString(),
        status: "failed",
        error: String(e?.message || e),
      })
      .eq("stripe_event_id", event.id);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
