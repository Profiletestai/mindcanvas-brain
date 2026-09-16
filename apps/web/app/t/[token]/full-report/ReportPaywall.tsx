"use client";

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
