import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getStripeMode } from "@/app/_lib/billing";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripeSecret(): string {
  const mode = getStripeMode();
  const key =
    mode === "live"
      ? process.env.STRIPE_SECRET_KEY
      : process.env.SANDBOX_STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      mode === "live" ? "Missing STRIPE_SECRET_KEY" : "Missing SANDBOX_STRIPE_SECRET_KEY",
    );
  }
  return key;
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } },
) {
  try {
    const body = await req.json().catch(() => ({}));
    const tid = String(body?.tid || "").trim();
    if (!tid) {
      return NextResponse.json({ ok: false, error: "Missing taker id" }, { status: 400 });
    }

    const sb = portalAdmin();
    const linkRes = await sb
      .from("test_links")
      .select("id, org_id, test_id, token, meta")
      .eq("token", params.token)
      .maybeSingle();
    if (linkRes.error) throw new Error(linkRes.error.message);
    if (!linkRes.data) {
      return NextResponse.json({ ok: false, error: "Test link not found" }, { status: 404 });
    }

    const meta = (linkRes.data.meta || {}) as Record<string, any>;
    const reportUrl = `/t/${encodeURIComponent(params.token)}/full-report?tid=${encodeURIComponent(tid)}`;
    if (meta.report_paywall_enabled !== true) {
      return NextResponse.json({ ok: true, already_unlocked: true, url: reportUrl });
    }

    const amount = Number(meta.report_price_cents || 0);
    const currency = String(meta.report_currency || "gbp").toLowerCase();
    if (!Number.isInteger(amount) || amount < 100) {
      throw new Error("Report price is not configured correctly");
    }
    if (!/^[a-z]{3}$/.test(currency)) {
      throw new Error("Report currency is not configured correctly");
    }

    const takerRes = await sb
      .from("test_takers")
      .select("id, email, link_token")
      .eq("id", tid)
      .eq("link_token", params.token)
      .maybeSingle();
    if (takerRes.error) throw new Error(takerRes.error.message);
    if (!takerRes.data) {
      return NextResponse.json(
        { ok: false, error: "Test taker not found for this link" },
        { status: 404 },
      );
    }

    const subRes = await sb
      .from("test_submissions")
      .select("id, created_at")
      .eq("taker_id", tid)
      .eq("link_token", params.token)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subRes.error) throw new Error(subRes.error.message);
    if (!subRes.data) {
      return NextResponse.json(
        { ok: false, error: "Completed submission not found" },
        { status: 404 },
      );
    }

    const paidRes = await sb
      .from("purchases")
      .select("id")
      .eq("purchase_type", "report_upgrade")
      .eq("submission_id", subRes.data.id)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();
    if (paidRes.error) throw new Error(paidRes.error.message);
    if (paidRes.data) {
      return NextResponse.json({ ok: true, already_unlocked: true, url: reportUrl });
    }

    const mode = getStripeMode();
    const purchaseRes = await sb
      .from("purchases")
      .insert({
        purchase_type: "report_upgrade",
        org_id: linkRes.data.org_id,
        test_link_id: linkRes.data.id,
        submission_id: subRes.data.id,
        buyer_email: takerRes.data.email || null,
        stripe_mode: mode,
        stripe_price_id: "dynamic_report_upgrade",
        gross_amount: amount,
        currency,
        status: "pending",
        metadata: {
          token: params.token,
          taker_id: tid,
          configured_price_cents: amount,
          configured_currency: currency,
        },
      })
      .select("id")
      .single();
    if (purchaseRes.error) throw new Error(purchaseRes.error.message);

    const stripe = new Stripe(stripeSecret());
    const origin = new URL(req.url).origin;
    const absoluteReportUrl = `${origin}${reportUrl}`;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: { name: "MindCanvas Full Diagnostic Report" },
            },
          },
        ],
        customer_email: takerRes.data.email || undefined,
        client_reference_id: linkRes.data.org_id,
        success_url: `${absoluteReportUrl}&payment=success`,
        cancel_url: `${absoluteReportUrl}&payment=cancelled`,
        metadata: {
          purchase_id: purchaseRes.data.id,
          purchase_type: "report_upgrade",
          org_id: linkRes.data.org_id,
          submission_id: subRes.data.id,
          token: params.token,
          taker_id: tid,
          stripe_mode: mode,
        },
        payment_intent_data: {
          metadata: {
            purchase_id: purchaseRes.data.id,
            purchase_type: "report_upgrade",
            org_id: linkRes.data.org_id,
            submission_id: subRes.data.id,
          },
        },
      },
      { idempotencyKey: `mc-report-upgrade-${purchaseRes.data.id}` },
    );

    const upd = await sb
      .from("purchases")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", purchaseRes.data.id);
    if (upd.error) throw new Error(upd.error.message);

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unable to create report checkout" },
      { status: 500 },
    );
  }
}
