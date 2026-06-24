"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type OrgStatus = "pending_activation" | "active" | "past_due" | "suspended" | "archived";

type Summary = {
  ok: true;
  org: { id: string; name: string; slug: string | null; status: OrgStatus };
  billing: {
    tier: number | null;
    stripe_status: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    period_start: string | null;
    period_end: string | null;
    past_due_since: string | null;
  } | null;
  next_action: "checkout" | "reactivate" | "none";
};

const STATUS_STYLE: Record<OrgStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending_activation: {
    bg: "rgba(64,150,220,0.15)",
    text: "rgb(170,210,250)",
    dot: "rgb(80,160,230)",
    label: "Pending activation",
  },
  active: {
    bg: "rgba(72,200,140,0.15)",
    text: "rgb(160,240,200)",
    dot: "rgb(64,210,140)",
    label: "Active",
  },
  past_due: {
    bg: "rgba(240,160,60,0.15)",
    text: "rgb(245,205,140)",
    dot: "rgb(240,170,70)",
    label: "Past due",
  },
  suspended: {
    bg: "rgba(240,80,110,0.15)",
    text: "rgb(255,180,200)",
    dot: "rgb(240,90,120)",
    label: "Suspended",
  },
  archived: {
    bg: "rgba(140,160,185,0.15)",
    text: "rgb(190,205,230)",
    dot: "rgb(160,180,210)",
    label: "Archived",
  },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function BillingClient({ orgId = null }: { orgId?: string | null }) {
  const sp = useSearchParams();
  const successFlag = sp?.get("status") === "success";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string>("");

  const pollAbort = useRef<{ stop: boolean }>({ stop: false });

  const load = useCallback(async () => {
    try {
      const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
      const res = await fetch(`/api/billing/summary${qs}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      setSummary(j as Summary);
      return j as Summary;
    } catch (e: any) {
      setErr(String(e?.message || e));
      return null;
    }
  }, [orgId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Poll for up to 30s after a successful checkout return to catch webhook → active.
  useEffect(() => {
    if (!successFlag) return;
    pollAbort.current.stop = false;
    let elapsed = 0;
    const id = setInterval(async () => {
      if (pollAbort.current.stop) {
        clearInterval(id);
        return;
      }
      elapsed += 3000;
      const s = await load();
      if (s?.org.status === "active" || elapsed >= 30_000) {
        pollAbort.current.stop = true;
        clearInterval(id);
      }
    }, 3000);
    return () => {
      pollAbort.current.stop = true;
      clearInterval(id);
    };
  }, [successFlag, load]);

  async function startCheckout() {
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orgId ? { orgId } : {}),
      });
      const j = await res.json();
      if (!res.ok || !j?.url) {
        setActionErr(j?.error || "Could not start checkout");
        setBusy(false);
        return;
      }
      window.location.href = j.url as string;
    } catch (e: any) {
      setActionErr(String(e?.message || e));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
          <div className="text-white/70">Loading billing…</div>
        </div>
      </div>
    );
  }

  if (err || !summary) {
    return (
      <div className="min-h-screen p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
          <div className="text-red-300">Error: {err || "Failed to load billing"}</div>
        </div>
      </div>
    );
  }

  const { org, billing, next_action } = summary;
  const style = STATUS_STYLE[org.status] ?? STATUS_STYLE.pending_activation;

  return (
    <div className="min-h-screen p-6 space-y-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">MindCanvas</div>
            <h1 className="text-2xl font-semibold">Billing</h1>
            <p className="text-sm text-white/70">Subscription status, period, and activation.</p>
          </div>
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ background: style.bg, color: style.text, borderColor: style.dot }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: style.dot }}
            />
            {style.label}
          </span>
        </div>
      </div>

      {successFlag && org.status !== "active" ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
          Payment received. Activating your account…
        </div>
      ) : null}

      {successFlag && org.status === "active" ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Payment successful. Your account is active.</span>
          {org.slug ? (
            <Link
              href={`/portal/${org.slug}/dashboard`}
              className="inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow"
              style={{
                background:
                  "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
              }}
            >
              Go to dashboard
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
        <h2 className="font-semibold mb-3">{org.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Detail label="Tier" value={billing?.tier ? `Tier ${billing.tier}` : "—"} />
          <Detail label="Stripe status" value={billing?.stripe_status ?? "—"} />
          <Detail label="Period start" value={fmtDate(billing?.period_start ?? null)} />
          <Detail label="Period end" value={fmtDate(billing?.period_end ?? null)} />
          <Detail
            label="Past due since"
            value={billing?.past_due_since ? fmtDate(billing.past_due_since) : "—"}
          />
        </div>

        {actionErr ? (
          <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {actionErr}
          </div>
        ) : null}

        {next_action !== "none" ? (
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            className="mt-5 w-full sm:w-auto rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              background:
                "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            }}
          >
            {busy
              ? "Starting checkout…"
              : next_action === "reactivate"
              ? "Pay outstanding balance"
              : "Pay & activate"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
