"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type RangeKey = "7d" | "30d" | "90d" | "all";

type PaymentState =
  | "paid"
  | "trial"
  | "overdue"
  | "setup_required"
  | "paused"
  | "cancelled"
  | "complimentary"
  | "pending";

type Totals = {
  partners: number;
  activePartners: number;
  clicks: number;
  signups: number;
  paidCustomers: number;
  signupConversion: number;
  paidConversion: number;
  planMix: {
    starter: number;
    pro: number;
    growth: number;
    enterprise: number;
  };
};

type PartnerRow = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  destinationPath: string;
  status: "active" | "paused";
  createdAt: string;
  clicks: number;
  signups: number;
  paidCustomers: number;
  signupConversion: number;
  paidConversion: number;
};

type ConversionRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  signupAt: string;
  signupTier: number | null;
  signupPlan: string;
  currentTier: number | null;
  currentPlan: string;
  paymentState: PaymentState;
  paymentLabel: string;
  isPaid: boolean;
  orgStatus: string | null;
};

type Payload = {
  ok: true;
  filters: {
    range: RangeKey;
    from: string | null;
    to: string;
  };
  totals: Totals;
  partners: PartnerRow[];
  conversions: ConversionRow[];
};

type CreatePartnerForm = {
  name: string;
  email: string;
  code: string;
  destination_path: string;
};

const EMPTY_FORM: CreatePartnerForm = {
  name: "",
  email: "",
  code: "",
  destination_path: "/onboarding/v2/account",
};

const RANGE_OPTIONS: {
  key: RangeKey;
  label: string;
}[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

const card =
  "rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normaliseCode(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function PaymentPill({
  state,
  label,
}: {
  state: PaymentState;
  label: string;
}) {
  const classes =
    state === "paid"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : state === "trial"
      ? "border-sky-300/25 bg-sky-300/10 text-sky-200"
      : state === "overdue"
      ? "border-red-300/25 bg-red-300/10 text-red-200"
      : state === "setup_required"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
      : state === "paused"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
      : state === "complimentary"
      ? "border-violet-300/25 bg-violet-300/10 text-violet-200"
      : "border-white/10 bg-white/5 text-white/60";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function StatusPill({
  status,
}: {
  status: "active" | "paused";
}) {
  const classes =
    status === "active"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : "border-white/10 bg-white/5 text-white/60";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {status === "active" ? "Active" : "Paused"}
    </span>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className={`${card} p-5`}>
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>

      <div className="mt-2 text-3xl font-semibold text-white">
        {value}
      </div>

      {subtext ? (
        <div className="mt-2 text-xs text-white/45">
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

export default function ReferralDashboardClient() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] =
    useState<CreatePartnerForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [changingPartnerId, setChangingPartnerId] =
    useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(
        `/api/admin/referrals?range=${range}`,
        {
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (!response.ok || json?.ok === false) {
        throw new Error(
          json?.error || `HTTP ${response.status}`
        );
      }

      setData(json as Payload);
    } catch (error) {
      setData(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load referral data."
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals;

  const planMixTotal = useMemo(() => {
    if (!totals) return 0;

    return (
      totals.planMix.starter +
      totals.planMix.pro +
      totals.planMix.growth +
      totals.planMix.enterprise
    );
  }, [totals]);

  function updateForm<K extends keyof CreatePartnerForm>(
    key: K,
    value: CreatePartnerForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      code:
        current.code.length === 0
          ? normaliseCode(value)
          : current.code,
    }));
  }

  async function createPartner(event: FormEvent) {
    event.preventDefault();

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch(
        "/api/admin/referrals",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            code: form.code,
            destination_path:
              form.destination_path,
            status: "active",
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || json?.ok === false) {
        throw new Error(
          json?.error ||
            "Could not create referral partner."
        );
      }

      setCreateSuccess(
        `Referral partner "${form.name}" created.`
      );
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Could not create referral partner."
      );
    } finally {
      setCreating(false);
    }
  }

  async function changePartnerStatus(
    partner: PartnerRow
  ) {
    const nextStatus =
      partner.status === "active"
        ? "paused"
        : "active";

    setChangingPartnerId(partner.id);
    setLoadError("");

    try {
      const response = await fetch(
        "/api/admin/referrals",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            partner_id: partner.id,
            status: nextStatus,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || json?.ok === false) {
        throw new Error(
          json?.error ||
            "Could not update referral partner."
        );
      }

      await load();
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not update referral partner."
      );
    } finally {
      setChangingPartnerId(null);
    }
  }

  async function copyReferralLink(code: string) {
    const base =
      origin || "https://profiletest.ai";

    const link = `${base}/r/${code}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage(`Copied ${link}`);
    } catch {
      setCopyMessage(link);
    }

    window.setTimeout(() => {
      setCopyMessage("");
    }, 3000);
  }

  return (
    <div className="fixed inset-0 mc-bg overflow-auto text-white">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">
              Admin · Commercial
            </div>

            <h1 className="mt-1 text-3xl font-semibold">
              Referral Tracking
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Create referral links and track partner traffic,
              attributed sign-ups, plan selection and current
              payment status. Commissions remain manual in this
              MVP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              Back to Admin
            </Link>
          </div>
        </header>

        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Reporting period</h2>
              <p className="mt-1 text-xs text-white/45">
                Partner count is all-time. Clicks and conversions
                respect the selected reporting period.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => {
                const active = range === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRange(option.key)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-sky-300/30 bg-sky-300/15 text-sky-100"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </div>
        ) : null}

        {loading && !data ? (
          <div className={`${card} p-8 text-center text-white/55`}>
            Loading referral data…
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Partners"
                value={totals?.partners ?? 0}
                subtext={`${totals?.activePartners ?? 0} active`}
              />

              <StatCard
                label="Clicks"
                value={totals?.clicks ?? 0}
                subtext="Tracked referral-link visits"
              />

              <StatCard
                label="Sign-ups"
                value={totals?.signups ?? 0}
                subtext={`${
                  totals
                    ? percent(totals.signupConversion)
                    : "0%"
                } of clicks`}
              />

              <StatCard
                label="Paid customers"
                value={totals?.paidCustomers ?? 0}
                subtext="Active Stripe subscriptions"
              />

              <StatCard
                label="Paid conversion"
                value={
                  totals
                    ? percent(totals.paidConversion)
                    : "0%"
                }
                subtext="Sign-up → currently paid"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
              <div className={`${card} p-6`}>
                <div>
                  <h2 className="text-lg font-semibold">
                    Create referral partner
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    This creates a first-party tracked link with a
                    30-day first-touch attribution window.
                  </p>
                </div>

                <form
                  onSubmit={createPartner}
                  className="mt-6 space-y-4"
                >
                  {createError ? (
                    <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                      {createError}
                    </div>
                  ) : null}

                  {createSuccess ? (
                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                      {createSuccess}
                    </div>
                  ) : null}

                  <div>
                    <label className="text-sm font-medium">
                      Partner name
                    </label>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        handleNameChange(event.target.value)
                      }
                      required
                      placeholder="e.g. Coach Network"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-sky-300/40"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateForm(
                          "email",
                          event.target.value
                        )
                      }
                      placeholder="Optional"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-sky-300/40"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Referral code
                    </label>
                    <input
                      value={form.code}
                      onChange={(event) =>
                        updateForm(
                          "code",
                          normaliseCode(event.target.value)
                        )
                      }
                      required
                      placeholder="coach-network"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 font-mono text-sm outline-none focus:border-sky-300/40"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Link:{" "}
                      <span className="font-mono">
                        {origin || "https://profiletest.ai"}/r/
                        {form.code || "partner-code"}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Destination
                    </label>
                    <input
                      value={form.destination_path}
                      onChange={(event) =>
                        updateForm(
                          "destination_path",
                          event.target.value
                        )
                      }
                      required
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 font-mono text-sm outline-none focus:border-sky-300/40"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Internal MindCanvas path only.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-medium shadow transition hover:brightness-110 disabled:opacity-60"
                  >
                    {creating
                      ? "Creating…"
                      : "Create referral link"}
                  </button>
                </form>
              </div>

              <div className={`${card} overflow-hidden`}>
                <div className="border-b border-white/10 px-6 py-5">
                  <h2 className="text-lg font-semibold">
                    Partner performance
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Traffic and conversion performance for the
                    selected period.
                  </p>
                </div>

                {copyMessage ? (
                  <div className="border-b border-sky-300/15 bg-sky-300/10 px-6 py-2 text-xs text-sky-100">
                    {copyMessage}
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="px-6 py-3 font-medium">
                          Partner
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Clicks
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Sign-ups
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Paid
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Sign-up %
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Paid %
                        </th>
                        <th className="px-6 py-3 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(data?.partners ?? []).map((partner) => (
                        <tr
                          key={partner.id}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {partner.name}
                              </span>
                              <StatusPill
                                status={partner.status}
                              />
                            </div>

                            <div className="mt-1 text-xs text-white/45">
                              {partner.email || "No email"}
                            </div>

                            <div className="mt-1 font-mono text-xs text-sky-200/80">
                              /r/{partner.code}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right">
                            {partner.clicks}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {partner.signups}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {partner.paidCustomers}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {percent(
                              partner.signupConversion
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {percent(
                              partner.paidConversion
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  copyReferralLink(
                                    partner.code
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10"
                              >
                                Copy link
                              </button>

                              <button
                                type="button"
                                disabled={
                                  changingPartnerId ===
                                  partner.id
                                }
                                onClick={() =>
                                  changePartnerStatus(
                                    partner
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10 disabled:opacity-50"
                              >
                                {changingPartnerId ===
                                partner.id
                                  ? "Saving…"
                                  : partner.status ===
                                    "active"
                                  ? "Pause"
                                  : "Reactivate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {(data?.partners ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-6 py-10 text-center text-white/45"
                          >
                            No referral partners yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className={`${card} p-6`}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Paid plan mix
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Current plan distribution across referred
                    customers with an active Stripe subscription.
                  </p>
                </div>

                <div className="text-sm text-white/45">
                  {planMixTotal} currently paid
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs text-white/45">
                    Starter
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {totals?.planMix.starter ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs text-white/45">
                    Pro
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {totals?.planMix.pro ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs text-white/45">
                    Growth
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {totals?.planMix.growth ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs text-white/45">
                    Enterprise
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {totals?.planMix.enterprise ?? 0}
                  </div>
                </div>
              </div>
            </section>

            <section className={`${card} overflow-hidden`}>
              <div className="border-b border-white/10 px-6 py-5">
                <h2 className="text-lg font-semibold">
                  Referred customer conversions
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  Original plan at sign-up alongside the
                  organisation&apos;s current plan and billing
                  state.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-6 py-3 font-medium">
                        Organisation
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Partner
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Signed up
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Sign-up plan
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Current plan
                      </th>
                      <th className="px-6 py-3 font-medium">
                        Payment
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(data?.conversions ?? []).map(
                      (conversion) => (
                        <tr
                          key={conversion.id}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium">
                              {conversion.orgName}
                            </div>
                            <div className="mt-1 text-xs text-white/40">
                              {conversion.orgSlug ||
                                conversion.orgId}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {conversion.partnerName}
                          </td>

                          <td className="px-5 py-4 text-white/70">
                            {formatDate(
                              conversion.signupAt
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {conversion.signupPlan}
                          </td>

                          <td className="px-5 py-4">
                            {conversion.currentPlan}
                          </td>

                          <td className="px-6 py-4">
                            <PaymentPill
                              state={
                                conversion.paymentState
                              }
                              label={
                                conversion.paymentLabel
                              }
                            />
                          </td>
                        </tr>
                      )
                    )}

                    {(data?.conversions ?? []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-10 text-center text-white/45"
                        >
                          No attributed sign-ups in this reporting
                          period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}