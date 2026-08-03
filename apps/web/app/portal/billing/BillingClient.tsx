"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type BillingDisplayStatus =
  | "active"
  | "past_due"
  | "payment_required"
  | "cancelled";

type Invoice = {
  id: string;
  number: string | null;
  created_at: string;
  status: string | null;
  amount_cents: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

type Summary = {
  ok: true;
  org: {
    id: string;
    name: string;
    slug: string | null;
    status: string;
  };
  usage: {
    allowance: number | null;
    used: number;
    remaining: number | null;
    period_start: string | null;
    period_end: string | null;
  };
  billing: {
    tier: number | null;
    stripe_status: string | null;
    display_status: BillingDisplayStatus;
    period_start: string | null;
    period_end: string | null;
    past_due_since: string | null;
    billing_source: string | null;
    billing_interval: string | null;
    plan: {
      name: string;
      interval: string | null;
      amount_cents: number | null;
      currency: string | null;
    };
    payment_method: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    } | null;
    invoices: Invoice[];
  } | null;
};

const STATUS_STYLE: Record<
  BillingDisplayStatus,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  active: {
    label: "Active",
    className:
      "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    dotClassName: "bg-emerald-400",
  },
  past_due: {
    label: "Past due",
    className:
      "border-amber-400/30 bg-amber-400/10 text-amber-100",
    dotClassName: "bg-amber-400",
  },
  payment_required: {
    label: "Payment required",
    className:
      "border-amber-400/30 bg-amber-400/10 text-amber-100",
    dotClassName: "bg-amber-400",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-red-400/30 bg-red-400/10 text-red-100",
    dotClassName: "bg-red-400",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMoney(
  amountCents: number | null,
  currency: string | null
): string {
  if (
    amountCents === null ||
    !currency
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(
      amountCents / 100
    ).toFixed(2)}`;
  }
}

function formatInterval(
  interval: string | null
): string {
  if (interval === "month" || interval === "monthly") {
    return "Monthly";
  }

  if (interval === "year" || interval === "annual") {
    return "Annual";
  }

  return interval
    ? interval.charAt(0).toUpperCase() +
        interval.slice(1)
    : "—";
}

function formatCardBrand(brand: string): string {
  if (brand.toLowerCase() === "amex") {
    return "American Express";
  }

  return (
    brand.charAt(0).toUpperCase() +
    brand.slice(1)
  );
}

export default function BillingClient({
  orgId = null,
}: {
  orgId?: string | null;
}) {
  const [summary, setSummary] =
    useState<Summary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manageBusy, setManageBusy] =
    useState(false);
  const [manageError, setManageError] =
    useState("");

  const load = useCallback(async () => {
    const query = orgId
      ? `?orgId=${encodeURIComponent(orgId)}`
      : "";

    const response = await fetch(
      `/api/billing/summary${query}`,
      {
        cache: "no-store",
        credentials: "include",
      }
    );

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          "Unable to load billing information."
      );
    }

    setSummary(data as Summary);
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
              : "Unable to load billing information."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  async function managePaymentMethod() {
    try {
      setManageBusy(true);
      setManageError("");

      const response = await fetch(
        "/api/billing/customer-portal",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(
            orgId ? { orgId } : {}
          ),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.url) {
        throw new Error(
          data?.error ||
            "Unable to open secure billing management."
        );
      }

      window.location.assign(data.url as string);
    } catch (managePaymentError) {
      setManageError(
        managePaymentError instanceof Error
          ? managePaymentError.message
          : "Unable to open secure billing management."
      );
      setManageBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
          Loading billing information…
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 text-white">
        <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-6 text-red-100">
          {error ||
            "Unable to load billing information."}
        </div>
      </div>
    );
  }

  const {
    org,
    billing,
    usage,
  } = summary;

  const displayStatus =
    billing?.display_status ??
    "payment_required";

  const statusStyle =
    STATUS_STYLE[displayStatus];

  const allowance =
    usage.allowance ??
    (billing?.billing_source === "legacy"
      ? 50
      : null);

  const invoices = billing?.invoices ?? [];

  return (
    <div className="space-y-6 p-6 text-white">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64bae2]">
              MindCanvas
            </p>

            <h1 className="mt-2 text-2xl font-semibold">
              Billing
            </h1>

            <p className="mt-1 text-sm text-white/60">
              Subscription, payment and invoice details
              for {org.name}.
            </p>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyle.className}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusStyle.dotClassName}`}
            />
            {statusStyle.label}
          </span>
        </div>
      </header>

      {displayStatus !== "active" && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          {displayStatus === "past_due"
            ? "Your latest payment is past due. Please update your payment method to restore normal billing."
            : displayStatus === "cancelled"
              ? "This subscription has been cancelled. Please contact MindCanvas support."
              : "Payment is required to activate this subscription."}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">
            Current subscription
          </h2>

          <div className="mt-5 space-y-4">
            <DetailRow
              label="Plan"
              value={
                billing?.plan.name ??
                "MindCanvas subscription"
              }
            />

            <DetailRow
              label="Billing cycle"
              value={formatInterval(
                billing?.plan.interval ??
                  billing?.billing_interval ??
                  null
              )}
            />

            <DetailRow
              label="Amount"
              value={
                <>
                  {formatMoney(
                    billing?.plan.amount_cents ??
                      null,
                    billing?.plan.currency ?? null
                  )}
                  {billing?.plan.interval ===
                    "month" && (
                    <span className="text-white/50">
                      {" "}
                      / month
                    </span>
                  )}
                </>
              }
            />

            <DetailRow
              label="Next payment"
              value={formatDate(
                billing?.period_end ?? null
              )}
            />

            <DetailRow
              label="Test allocation"
              value={
                allowance === null
                  ? "Unlimited"
                  : `${allowance} usages per month`
              }
            />

            <DetailRow
              label="Usage this period"
              value={
                usage.remaining === null
                  ? `${usage.used} used`
                  : `${usage.used} used · ${usage.remaining} remaining`
              }
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">
            Payment method
          </h2>

          {billing?.payment_method ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#06182a] p-5">
              <p className="font-medium">
                {formatCardBrand(
                  billing.payment_method.brand
                )}{" "}
                ending in{" "}
                {billing.payment_method.last4}
              </p>

              <p className="mt-1 text-sm text-white/55">
                Expires{" "}
                {String(
                  billing.payment_method.exp_month
                ).padStart(2, "0")}
                /
                {billing.payment_method.exp_year}
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/60">
              No saved card details are available yet.
            </p>
          )}

          {manageError && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {manageError}
            </div>
          )}

          {billing && (
            <button
              type="button"
              onClick={managePaymentMethod}
              disabled={manageBusy}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#247baa] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {manageBusy
                ? "Opening secure billing…"
                : "Manage payment method"}
            </button>
          )}

          <p className="mt-3 text-xs leading-5 text-white/45">
            Payment details are securely managed by
            Stripe. Plan changes and cancellation are not
            available here.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Invoice history
            </h2>

            <p className="mt-1 text-sm text-white/55">
              View or download receipts issued by Stripe.
            </p>
          </div>

          {org.slug && (
            <Link
              href={`/portal/${org.slug}/dashboard`}
              className="text-sm font-medium text-[#64bae2] hover:text-white"
            >
              Back to dashboard
            </Link>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
            No invoices are available yet.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                  <th className="px-3 py-3 font-medium">
                    Invoice
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Date
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Amount
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Status
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Receipt
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-white/[0.07] last:border-0"
                  >
                    <td className="px-3 py-4 font-medium">
                      {invoice.number ??
                        invoice.id}
                    </td>

                    <td className="px-3 py-4 text-white/65">
                      {formatDate(
                        invoice.created_at
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {formatMoney(
                        invoice.amount_cents,
                        invoice.currency
                      )}
                    </td>

                    <td className="px-3 py-4 capitalize text-white/65">
                      {invoice.status ?? "—"}
                    </td>

                    <td className="px-3 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        {invoice.hosted_invoice_url && (
                          <a
                            href={
                              invoice.hosted_invoice_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#64bae2] hover:text-white"
                          >
                            View
                          </a>
                        )}

                        {invoice.invoice_pdf && (
                          <a
                            href={invoice.invoice_pdf}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#64bae2] hover:text-white"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-white/[0.07] pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-white/55">
        {label}
      </span>

      <span className="text-right text-sm font-medium">
        {value}
      </span>
    </div>
  );
}
