from pathlib import Path
import sys

ROOT = Path.cwd()

def replace(path, old, new, count=1):
    old = old.replace("\\n", "\n")
    new = new.replace("\\n", "\n")
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Context not found in {path}:\n{old[:180]}")
    p.write_text(text.replace(old, new, count))
    print(f"updated {path}")

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        raise SystemExit(f"Refusing to overwrite existing file: {path}")
    p.write_text(content)
    print(f"created {path}")

# 1. Shared form types
replace(
    "apps/web/components/portal/create-test-link/types.ts",
    'export type ReportVariant = "lite" | "full";\n',
    'export type ReportVariant = "lite" | "full";\nexport type ReportCurrency = "GBP" | "USD" | "EUR" | "ZAR";\n',
)
replace(
    "apps/web/components/portal/create-test-link/types.ts",
    '  emailReport: boolean;\n  reportVariant: ReportVariant;\n};',
    '  emailReport: boolean;\n  reportVariant: ReportVariant;\n  reportPaywallEnabled: boolean;\n  reportPrice: string;\n  reportCurrency: ReportCurrency;\n};',
)
replace(
    "apps/web/components/portal/create-test-link/types.ts",
    '// Wizard step indexes — 5 input steps followed by the success screen.\n',
    '''export function reportPriceToCents(value: string): number | null {\n  const normalized = value.trim().replace(/,/g, ".");\n  if (!/^\\d+(?:\\.\\d{1,2})?$/.test(normalized)) return null;\n  const amount = Number(normalized);\n  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return null;\n  return Math.round(amount * 100);\n}\n\n// Wizard step indexes — 5 input steps followed by the success screen.\n''',
)

# 2. Advanced UI
replace(
    "apps/web/components/portal/create-test-link/AdvancedFields.tsx",
    '''      <OptionRow\n        selected={values.emailReport}\n        title="Email the report to the host"\n        hint="Sends the completed report to your organisation"\n        onClick={() => onChange("emailReport", !values.emailReport)}\n      />\n\n      {supportsLite && (''',
    '''      <OptionRow\n        selected={values.emailReport}\n        title="Email the report to the host"\n        hint="Sends the completed report to your organisation"\n        onClick={() => onChange("emailReport", !values.emailReport)}\n      />\n\n      {showResults && (\n        <div className="rounded-xl border border-white/[0.1] bg-white/[0.025] p-4">\n          <OptionRow\n            selected={values.reportPaywallEnabled}\n            title="Charge for the full report"\n            hint="The test taker sees their results, then pays MindCanvas to unlock the full report"\n            onClick={() => onChange("reportPaywallEnabled", !values.reportPaywallEnabled)}\n          />\n          {values.reportPaywallEnabled && (\n            <div className="mt-4 grid grid-cols-[110px_1fr] gap-3">\n              <select\n                className={darkInputClass}\n                value={values.reportCurrency}\n                onChange={(e) => onChange("reportCurrency", e.target.value as any)}\n              >\n                <option value="GBP">GBP</option>\n                <option value="USD">USD</option>\n                <option value="EUR">EUR</option>\n                <option value="ZAR">ZAR</option>\n              </select>\n              <input\n                type="text"\n                inputMode="decimal"\n                placeholder="49.00"\n                className={darkInputClass}\n                value={values.reportPrice}\n                onChange={(e) => onChange("reportPrice", e.target.value)}\n              />\n              <p className="col-span-2 text-[11.5px] font-light text-white/[0.36]">\n                MindCanvas receives the payment. Access is granted only to the completed submission that was purchased.\n              </p>\n            </div>\n          )}\n        </div>\n      )}\n\n      {supportsLite && (''',
)

# 3. StepAdvanced
replace(
    "apps/web/components/portal/create-test-link/StepAdvanced.tsx",
    '    emailReport: watch("emailReport"),\n    reportVariant: watch("reportVariant"),\n',
    '    emailReport: watch("emailReport"),\n    reportVariant: watch("reportVariant"),\n    reportPaywallEnabled: watch("reportPaywallEnabled"),\n    reportPrice: watch("reportPrice"),\n    reportCurrency: watch("reportCurrency"),\n',
)

# 4. Create modal
replace(
    "apps/web/components/portal/CreateTestLinkModal.tsx",
    '  supportsLiteReport,\n  type CreateTestLinkFormValues,',
    '  supportsLiteReport,\n  reportPriceToCents,\n  type CreateTestLinkFormValues,',
)
replace(
    "apps/web/components/portal/CreateTestLinkModal.tsx",
    '        emailReport: true,\n        reportVariant: "full",\n',
    '        emailReport: true,\n        reportVariant: "full",\n        reportPaywallEnabled: false,\n        reportPrice: "49.00",\n        reportCurrency: "GBP",\n',
)
replace(
    "apps/web/components/portal/CreateTestLinkModal.tsx",
    '  const redirectUrl = watch("redirectUrl");\n',
    '  const redirectUrl = watch("redirectUrl");\n  const reportPaywallEnabled = watch("reportPaywallEnabled");\n  const reportPrice = watch("reportPrice");\n',
)
replace(
    "apps/web/components/portal/CreateTestLinkModal.tsx",
    '''      if (!isValidUrl(nextStepsUrl)) return false;\n      if (!showResults && !isValidUrl(redirectUrl)) return false;\n      return true;''',
    '''      if (!isValidUrl(nextStepsUrl)) return false;\n      if (!showResults && !isValidUrl(redirectUrl)) return false;\n      if (reportPaywallEnabled && reportPriceToCents(reportPrice) == null) return false;\n      return true;''',
)
replace(
    "apps/web/components/portal/CreateTestLinkModal.tsx",
    '    redirectUrl,\n    showResults,\n  ]);',
    '    redirectUrl,\n    showResults,\n    reportPaywallEnabled,\n    reportPrice,\n  ]);',
)
replace(
    "apps/web/components/portal/CreateTestLinkModal.tsx",
    '        report_variant: supportsLite ? values.reportVariant : "full",\n',
    '''        report_variant: supportsLite ? values.reportVariant : "full",\n        reportPaywallEnabled: values.reportPaywallEnabled,\n        reportPriceCents: values.reportPaywallEnabled\n          ? reportPriceToCents(values.reportPrice)\n          : null,\n        reportCurrency: values.reportCurrency,\n''',
)

# 5. Link schemas
replace(
    "apps/web/lib/links/schema.ts",
    'const maxUsesInput = z\n  .union([z.number(), z.string(), z.null()])\n  .optional();\n',
    'const maxUsesInput = z\n  .union([z.number(), z.string(), z.null()])\n  .optional();\n\nconst reportCurrencySchema = z.enum(["GBP", "USD", "EUR", "ZAR"]);\n',
)
replace(
    "apps/web/lib/links/schema.ts",
    '    reportVariant: reportVariantSchema.nullish(),\n    report_variant: reportVariantSchema.nullish(),\n\n    max_uses: maxUsesInput,',
    '    reportVariant: reportVariantSchema.nullish(),\n    report_variant: reportVariantSchema.nullish(),\n    reportPaywallEnabled: z.boolean().optional().default(false),\n    reportPriceCents: z.number().int().min(100).max(1000000).nullable().optional(),\n    reportCurrency: reportCurrencySchema.optional().default("GBP"),\n\n    max_uses: maxUsesInput,',
)
replace(
    "apps/web/lib/links/schema.ts",
    '''    if (!value.showResults && !isValidUrl(value.redirectUrl ?? "")) {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["redirectUrl"],\n        message: "Redirect URL is required when results are hidden",\n      });\n    }\n  });''',
    '''    if (!value.showResults && !isValidUrl(value.redirectUrl ?? "")) {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["redirectUrl"],\n        message: "Redirect URL is required when results are hidden",\n      });\n    }\n    if (value.reportPaywallEnabled && !value.reportPriceCents) {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["reportPriceCents"],\n        message: "A report price is required when charging for the full report",\n      });\n    }\n  });''',
)
replace(
    "apps/web/lib/links/schema.ts",
    '  reportVariant: reportVariantSchema.nullish(),\n  report_variant: reportVariantSchema.nullish(),\n\n  max_uses: maxUsesInput,',
    '  reportVariant: reportVariantSchema.nullish(),\n  report_variant: reportVariantSchema.nullish(),\n  reportPaywallEnabled: z.boolean().optional(),\n  reportPriceCents: z.number().int().min(100).max(1000000).nullable().optional(),\n  reportCurrency: reportCurrencySchema.optional(),\n\n  max_uses: maxUsesInput,',
)

# 6. Create link persistence
replace(
    "apps/web/app/api/admin/create-link/route.ts",
    '''      meta: {\n        report_variant: reportVariant,\n      },''',
    '''      meta: {\n        report_variant: reportVariant,\n        report_paywall_enabled: !!body.reportPaywallEnabled,\n        report_price_cents: body.reportPaywallEnabled ? body.reportPriceCents : null,\n        report_currency: (body.reportCurrency || "GBP").toLowerCase(),\n      },''',
)

# 7. Edit link API metadata merge
replace(
    "apps/web/app/api/admin/links/[linkId]/route.ts",
    '''    const variantInput = body.report_variant ?? body.reportVariant;\n    if (variantInput !== undefined && variantInput !== null) {\n      update.meta = {\n        ...((existing.meta as Record<string, any> | null) ?? {}),\n        report_variant: normalizeReportVariant(variantInput),\n      };\n    }''',
    '''    const variantInput = body.report_variant ?? body.reportVariant;\n    const touchesReportMeta =\n      variantInput !== undefined ||\n      body.reportPaywallEnabled !== undefined ||\n      body.reportPriceCents !== undefined ||\n      body.reportCurrency !== undefined;\n\n    if (touchesReportMeta) {\n      const nextMeta = { ...((existing.meta as Record<string, any> | null) ?? {}) };\n      if (variantInput !== undefined && variantInput !== null) {\n        nextMeta.report_variant = normalizeReportVariant(variantInput);\n      }\n      if (body.reportPaywallEnabled !== undefined) {\n        nextMeta.report_paywall_enabled = body.reportPaywallEnabled;\n      }\n      if (body.reportPriceCents !== undefined) {\n        nextMeta.report_price_cents = body.reportPriceCents;\n      }\n      if (body.reportCurrency !== undefined) {\n        nextMeta.report_currency = body.reportCurrency.toLowerCase();\n      }\n      if (nextMeta.report_paywall_enabled && !nextMeta.report_price_cents) {\n        return NextResponse.json(\n          { ok: false, error: "A report price is required when charging for the full report" },\n          { status: 400 },\n        );\n      }\n      update.meta = nextMeta;\n    }''',
)

# 8. Links API returns metadata
replace(
    "apps/web/app/api/admin/links/route.ts",
    '      report_variant: normalizeReportVariant(r?.meta?.report_variant),\n    }));',
    '''      report_variant: normalizeReportVariant(r?.meta?.report_variant),\n      report_paywall_enabled: r?.meta?.report_paywall_enabled === true,\n      report_price_cents:\n        typeof r?.meta?.report_price_cents === "number"\n          ? r.meta.report_price_cents\n          : null,\n      report_currency:\n        typeof r?.meta?.report_currency === "string"\n          ? r.meta.report_currency.toUpperCase()\n          : "GBP",\n    }));''',
)

# 9. Edit modal data and submit
replace(
    "apps/web/components/portal/EditTestLinkModal.tsx",
    '  report_variant?: ReportVariant | null;\n};',
    '  report_variant?: ReportVariant | null;\n  report_paywall_enabled?: boolean;\n  report_price_cents?: number | null;\n  report_currency?: "GBP" | "USD" | "EUR" | "ZAR";\n};',
)
replace(
    "apps/web/components/portal/EditTestLinkModal.tsx",
    '    reportVariant: link.report_variant === "lite" ? "lite" : "full",\n  });',
    '''    reportVariant: link.report_variant === "lite" ? "lite" : "full",\n    reportPaywallEnabled: !!link.report_paywall_enabled,\n    reportPrice:\n      typeof link.report_price_cents === "number"\n        ? (link.report_price_cents / 100).toFixed(2)\n        : "49.00",\n    reportCurrency: link.report_currency || "GBP",\n  });''',
)
replace(
    "apps/web/components/portal/EditTestLinkModal.tsx",
    '          report_variant: supportsLite ? values.reportVariant : "full",\n',
    '''          report_variant: supportsLite ? values.reportVariant : "full",\n          reportPaywallEnabled: values.reportPaywallEnabled,\n          reportPriceCents: values.reportPaywallEnabled\n            ? Math.round(Number(values.reportPrice) * 100)\n            : null,\n          reportCurrency: values.reportCurrency,\n''',
)

# 10. Created links table typing
replace(
    "apps/web/app/portal/[slug]/links/CreatedTestLinksTable.tsx",
    '  report_variant?: ReportVariant | null;\n};',
    '  report_variant?: ReportVariant | null;\n  report_paywall_enabled?: boolean;\n  report_price_cents?: number | null;\n  report_currency?: "GBP" | "USD" | "EUR" | "ZAR";\n};',
)

# 11. Checkout endpoint
write("apps/web/app/api/public/test/[token]/report-upgrade/checkout/route.ts", r'''import "server-only";

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
''')

# 12. Paywall UI
write("apps/web/app/t/[token]/full-report/ReportPaywall.tsx", r'''"use client";

import { useState } from "react";

export default function ReportPaywall({
  token,
  tid,
  amountCents,
  currency,
}: {
  token: string;
  tid: string;
  amountCents: number;
  currency: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/test/${encodeURIComponent(token)}/report-upgrade/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tid }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Unable to start checkout");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#041731] px-6 py-20 text-white">
      <div className="mx-auto max-w-[720px] rounded-[24px] border border-white/10 bg-white/[0.05] p-8 shadow-2xl sm:p-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c8aa6e]">
          Your Diagnostic Snapshot is ready
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          Unlock your Full Diagnostic Report
        </h1>
        <p className="mt-5 text-[16px] leading-7 text-white/70">
          Continue into the complete diagnostic, including your detailed constraint analysis,
          Revenue-To-Freedom pathway and recommended priorities.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/10 p-5">
          <div className="text-sm text-white/55">One-time payment</div>
          <div className="mt-1 text-3xl font-semibold">{price}</div>
          <div className="mt-2 text-sm text-white/55">
            Secure payment processed by MindCanvas via Stripe. Your report remains unlocked after purchase.
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-6 py-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Opening secure checkout…" : `Unlock Full Report — ${price}`}
        </button>
      </div>
    </main>
  );
}
''')

# 13. Full report server gate
p = ROOT / "apps/web/app/t/[token]/full-report/page.tsx"
p.write_text(r'''// apps/web/app/t/[token]/full-report/page.tsx
import InevitableStandardFullDiagnosticClient from "./InevitableStandardFullDiagnosticClient";
import ReportPaywall from "./ReportPaywall";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function InevitableStandardFullReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string };
}) {
  const tid = typeof searchParams?.tid === "string" ? searchParams.tid : "";

  if (tid) {
    const sb = portalAdmin();
    const link = await sb
      .from("test_links")
      .select("id, meta")
      .eq("token", params.token)
      .maybeSingle();

    const meta = (link.data?.meta || {}) as Record<string, any>;
    if (meta.report_paywall_enabled === true) {
      const submission = await sb
        .from("test_submissions")
        .select("id")
        .eq("taker_id", tid)
        .eq("link_token", params.token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const paid = submission.data?.id
        ? await sb
            .from("purchases")
            .select("id")
            .eq("purchase_type", "report_upgrade")
            .eq("submission_id", submission.data.id)
            .eq("status", "paid")
            .limit(1)
            .maybeSingle()
        : { data: null };

      if (!paid.data) {
        return (
          <ReportPaywall
            token={params.token}
            tid={tid}
            amountCents={Number(meta.report_price_cents || 0)}
            currency={String(meta.report_currency || "gbp")}
          />
        );
      }
    }
  }

  return <InevitableStandardFullDiagnosticClient token={params.token} tid={tid} />;
}
''')
print("updated apps/web/app/t/[token]/full-report/page.tsx")

# 14. Webhook report fulfilment
replace(
    "apps/web/app/api/stripe/webhook/route.ts",
    '''async function handleOneOffCheckoutEvent(\n  event: Stripe.Event,\n): Promise<OneOffEventResult> {''',
    '''async function fulfillReportUpgrade(\n  purchaseId: string,\n  eventId: string,\n  session: Stripe.Checkout.Session,\n): Promise<unknown> {\n  const sb = portalAdmin();\n  const purchase = await sb\n    .from("purchases")\n    .select("id, purchase_type, stripe_mode, gross_amount, currency, status, metadata")\n    .eq("id", purchaseId)\n    .maybeSingle();\n\n  if (purchase.error) {\n    throw new Error(`report_purchase_lookup_failed:${purchase.error.message}`);\n  }\n  if (!purchase.data) throw new Error("report_purchase_not_found");\n  if (purchase.data.purchase_type !== "report_upgrade") {\n    throw new Error("report_purchase_type_mismatch");\n  }\n  if (purchase.data.stripe_mode !== getStripeMode()) {\n    throw new Error("purchase_stripe_mode_mismatch");\n  }\n  if (session.amount_total !== purchase.data.gross_amount) {\n    throw new Error("purchase_amount_mismatch");\n  }\n  if ((session.currency || "").toLowerCase() !== purchase.data.currency) {\n    throw new Error("purchase_currency_mismatch");\n  }\n  if (purchase.data.status === "paid") return { ok: true, duplicate: true };\n  if (["refunded", "disputed"].includes(purchase.data.status)) {\n    throw new Error(`purchase_not_fulfillable:${purchase.data.status}`);\n  }\n\n  const paymentIntentId = getExpandableId(session.payment_intent);\n  if (!paymentIntentId) throw new Error("payment_intent_unresolved");\n\n  const updated = await sb\n    .from("purchases")\n    .update({\n      status: "paid",\n      stripe_checkout_session_id: session.id,\n      stripe_payment_intent_id: paymentIntentId,\n      paid_at: new Date().toISOString(),\n      failed_at: null,\n      reconciliation_required: false,\n      metadata: {\n        ...((purchase.data.metadata as Record<string, unknown> | null) || {}),\n        paid_event_id: eventId,\n      },\n    })\n    .eq("id", purchaseId);\n\n  if (updated.error) {\n    throw new Error(`report_purchase_fulfilment_failed:${updated.error.message}`);\n  }\n\n  return {\n    ok: true,\n    duplicate: false,\n    purchase_id: purchaseId,\n    purchase_type: "report_upgrade",\n  };\n}\n\nasync function handleOneOffCheckoutEvent(\n  event: Stripe.Event,\n): Promise<OneOffEventResult> {''',
)
replace(
    "apps/web/app/api/stripe/webhook/route.ts",
    '  if (!purchaseId || purchaseType !== "usage_bundle") {',
    '  if (!purchaseId || !["usage_bundle", "report_upgrade"].includes(purchaseType || "")) {',
)
replace(
    "apps/web/app/api/stripe/webhook/route.ts",
    '''  if (!session.currency) throw new Error("currency_unresolved");\n\n  const result = await callPurchaseRpc("fn_fulfill_one_off_purchase", {''',
    '''  if (!session.currency) throw new Error("currency_unresolved");\n\n  if (purchaseType === "report_upgrade") {\n    const result = await fulfillReportUpgrade(purchaseId, event.id, session);\n    return { handled: true, result };\n  }\n\n  const result = await callPurchaseRpc("fn_fulfill_one_off_purchase", {''',
)

print("\nReport monetisation patch applied successfully.")
print("Next: pnpm --filter @mindcanvas/web typecheck && pnpm --filter @mindcanvas/web build")
