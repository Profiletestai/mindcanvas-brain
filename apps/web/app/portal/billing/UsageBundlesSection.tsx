// apps/web/app/portal/billing/UsageBundlesSection.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type UsageSnapshot = {
  allowance: number | null;
  used: number;
  remaining: number | null;
  included_limit?: number | null;
  included_used?: number;
  included_remaining?: number | null;
  purchased_remaining?: number | null;
  total_remaining?: number | null;
  trial_remaining?: number | null;
};

type BundleOffer = {
  display_name: string;
  tier: number;
  quantity: number;
  currency: string;
  amount_cents: number;
  expires: boolean;
};

type BundlePurchase = {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded" | "disputed";
  quantity: number;
  amount_cents: number;
  refunded_amount_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
};

type BundleSummary = {
  ok: true;
  feature_enabled: boolean;
  can_purchase: boolean;
  offer: BundleOffer | null;
  purchases: BundlePurchase[];
};

const STATUS_STYLE: Record<
  BundlePurchase["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  },
  paid: {
    label: "Paid",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  },
  failed: {
    label: "Failed",
    className: "border-red-400/30 bg-red-400/10 text-red-100",
  },
  refunded: {
    label: "Refunded",
    className: "border-white/15 bg-white/[0.06] text-white/65",
  },
  disputed: {
    label: "Disputed",
    className: "border-red-400/30 bg-red-400/10 text-red-100",
  },
};

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBalance(value: number | null): string {
  return value === null ? "Unlimited" : String(value);
}

export default function UsageBundlesSection({
  orgId,
  usage,
}: {
  orgId: string;
  usage: UsageSnapshot;
}) {
  const [bundleSummary, setBundleSummary] = useState<BundleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [returnStatus, setReturnStatus] = useState<"success" | "cancelled" | null>(
    null,
  );

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/billing/usage-bundles?orgId=${encodeURIComponent(orgId)}`,
      {
        cache: "no-store",
        credentials: "include",
      },
    );
    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Unable to load additional usage.");
    }

    setBundleSummary(data as BundleSummary);
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        await load();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load additional usage.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("bundle");

    if (status !== "success" && status !== "cancelled") return;

    setReturnStatus(status);

    if (status !== "success") return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void load().catch(() => undefined);

      if (attempts >= 6) window.clearInterval(timer);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [load]);

  async function buyBundle() {
    try {
      setCheckoutBusy(true);
      setCheckoutError("");

      const response = await fetch(
        "/api/billing/usage-bundles/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orgId }),
        },
      );
      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Unable to open secure checkout.");
      }

      window.location.assign(data.url as string);
    } catch (purchaseError) {
      setCheckoutError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Unable to open secure checkout.",
      );
      setCheckoutBusy(false);
    }
  }

  if (loading) return null;

  if (error) {
    return (
      <section className="rounded-3xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-100">
        Additional usage is temporarily unavailable: {error}
      </section>
    );
  }

  if (!bundleSummary) return null;

  const includedLimit = usage.included_limit ?? usage.allowance;
  const includedUsed = usage.included_used ?? usage.used;
  const includedRemaining = usage.included_remaining ?? usage.remaining;
  const purchasedRemaining = usage.purchased_remaining ?? 0;
  const totalRemaining =
    usage.total_remaining ??
    (includedRemaining === null ? null : includedRemaining + purchasedRemaining);
  const trialRemaining = usage.trial_remaining ?? 0;
  const hasHistory = bundleSummary.purchases.length > 0;
  const shouldShow =
    bundleSummary.feature_enabled || hasHistory || purchasedRemaining > 0;

  if (!shouldShow) return null;

  return (
    <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64bae2]">
          Test capacity
        </p>
        <h2 className="mt-2 text-lg font-semibold">Additional test usage</h2>
        <p className="mt-1 text-sm text-white/55">
          Included usages reset with the billing period. Purchased usages remain
          available until they are used.
        </p>
      </div>

      {returnStatus === "success" && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          Payment submitted successfully. Stripe is confirming the payment and
          the balance will refresh automatically.
        </div>
      )}

      {returnStatus === "cancelled" && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          Checkout was cancelled. No usages were added and no payment was
          recorded.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#06182a] p-5">
          <h3 className="font-semibold">Available balance</h3>

          <div className="mt-4 space-y-3">
            <BalanceRow
              label="Included monthly"
              value={formatBalance(includedRemaining)}
              helper={
                includedLimit === null
                  ? "Unlimited plan"
                  : `${includedUsed} of ${includedLimit} used`
              }
            />
            <BalanceRow
              label="Purchased"
              value={String(purchasedRemaining)}
              helper="Does not expire"
            />
            <BalanceRow
              label="Total available"
              value={formatBalance(totalRemaining)}
              helper="Included plus purchased"
              strong
            />

            {trialRemaining > 0 && (
              <BalanceRow
                label="Onboarding trial"
                value={String(trialRemaining)}
                helper="Used before paid allowances"
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#2d8fc4]/40 bg-[#2d8fc4]/10 p-5">
          {bundleSummary.offer ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64bae2]">
                Tier {bundleSummary.offer.tier} bundle
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                {bundleSummary.offer.quantity} additional usages
              </h3>
              <p className="mt-2 text-3xl font-semibold">
                {formatMoney(
                  bundleSummary.offer.amount_cents,
                  bundleSummary.offer.currency,
                )}
              </p>
              <p className="mt-2 text-sm text-white/60">
                One-time payment. The usages are added after Stripe confirms the
                payment and do not expire.
              </p>

              {checkoutError && (
                <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                  {checkoutError}
                </div>
              )}

              {bundleSummary.can_purchase ? (
                <button
                  type="button"
                  onClick={buyBundle}
                  disabled={checkoutBusy}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#247baa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutBusy
                    ? "Opening secure checkout…"
                    : `Buy ${bundleSummary.offer.quantity} usages`}
                </button>
              ) : (
                <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60">
                  An active paid subscription is required to purchase this
                  bundle.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-white/60">
              No bundle is currently available for this subscription tier.
            </p>
          )}
        </div>
      </div>

      {hasHistory && (
        <div>
          <h3 className="text-base font-semibold">Bundle purchase history</h3>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Usages</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {bundleSummary.purchases.map((purchase) => {
                  const statusStyle = STATUS_STYLE[purchase.status];

                  return (
                    <tr
                      key={purchase.id}
                      className="border-b border-white/[0.07] last:border-0"
                    >
                      <td className="px-3 py-4 text-white/65">
                        {formatDate(purchase.paid_at ?? purchase.created_at)}
                      </td>
                      <td className="px-3 py-4 font-medium">
                        {purchase.quantity || "—"}
                      </td>
                      <td className="px-3 py-4">
                        {formatMoney(purchase.amount_cents, purchase.currency)}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle.className}`}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right font-mono text-xs text-white/45">
                        {purchase.id.slice(0, 8)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function BalanceRow({
  label,
  value,
  helper,
  strong = false,
}: {
  label: string;
  value: string;
  helper: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3 last:border-0 last:pb-0">
      <div>
        <p className="text-sm text-white/70">{label}</p>
        <p className="mt-0.5 text-xs text-white/40">{helper}</p>
      </div>
      <span className={strong ? "text-2xl font-semibold" : "text-lg font-semibold"}>
        {value}
      </span>
    </div>
  );
}