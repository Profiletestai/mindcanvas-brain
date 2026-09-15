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
  "rounded-2xl border border-white/10 bg-white/[0.045] shadow-lg shadow-black/10";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-[#07111f]/80 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-sky-300/40 focus:ring-2 focus:ring-sky-300/10";

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
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
      : "border-amber-300/20 bg-amber-300/10 text-amber-200";

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
  emphasis = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`${card} relative overflow-hidden p-5 ${
        emphasis ? "border-sky-300/20" : ""
      }`}
    >
      {emphasis ? (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
      ) : null}

      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>

      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>

      {subtext ? (
        <div className="mt-2 text-xs leading-5 text-white/45">
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  helper,
  emphasis = false,
}: {
  label: string;
  value: number;
  helper: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-2xl border px-5 py-4 ${
        emphasis
          ? "border-sky-300/20 bg-sky-300/[0.07]"
          : "border-white/10 bg-black/10"
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-white/45">
        {helper}
      </div>
    </div>
  );
}

function FunnelArrow({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 px-1 py-1 text-xs text-sky-200/75 md:flex-col md:px-2">
      <span className="font-medium">{label}</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="rotate-90 md:rotate-0"
      >
        <path
          d="M5 12h14M14 7l5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
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
  const [showCreateModal, setShowCreateModal] =
    useState(false);
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

  const planMixRows = useMemo(() => {
    return [
      {
        label: "Starter",
        value: totals?.planMix.starter ?? 0,
      },
      {
        label: "Pro",
        value: totals?.planMix.pro ?? 0,
      },
      {
        label: "Growth",
        value: totals?.planMix.growth ?? 0,
      },
      {
        label: "Enterprise",
        value: totals?.planMix.enterprise ?? 0,
      },
    ];
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

  function openCreateModal() {
    setCreateError("");
    setCreateSuccess("");
    setForm(EMPTY_FORM);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    setCreateError("");
  }

  async function createPartner(event: FormEvent) {
    event.preventDefault();

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const partnerName = form.name;

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
        `Referral partner "${partnerName}" created.`
      );
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
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
      <div className="mx-auto max-w-7xl space-y-7 px-6 py-10">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">
              Admin - Commercial
            </div>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Referral Tracking
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Track referral acquisition, attributed sign-ups
              and paid conversion across MindCanvas partners.
              Commission management remains manual in this MVP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-white/10"
            >
              Back to Admin
            </Link>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-950/20 transition hover:brightness-110"
            >
              <PlusIcon />
              Create referral partner
            </button>
          </div>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 shadow-lg shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              Reporting period
            </div>
            <div className="mt-1 text-xs text-white/40">
              Partner count is all-time. Traffic and conversion
              metrics use the selected period.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = range === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? "border-sky-300/30 bg-sky-300/15 text-sky-100 shadow-sm"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {loadError ? (
          <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </div>
        ) : null}

        {createSuccess ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {createSuccess}
          </div>
        ) : null}

        {loading && !data ? (
          <div className={`${card} p-8 text-center text-white/55`}>
            Loading referral data...
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
                label="Referral clicks"
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
                emphasis
              />

              <StatCard
                label="Paid conversion"
                value={
                  totals
                    ? percent(totals.paidConversion)
                    : "0%"
                }
                subtext="Sign-up to currently paid"
                emphasis
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className={`${card} p-6`}>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Acquisition
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">
                    Referral funnel
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    How partner traffic is progressing from
                    referral visit to currently paid customer.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-stretch">
                  <FunnelStep
                    label="Clicks"
                    value={totals?.clicks ?? 0}
                    helper="Referral visits"
                  />

                  <FunnelArrow
                    label={
                      totals
                        ? percent(totals.signupConversion)
                        : "0%"
                    }
                  />

                  <FunnelStep
                    label="Sign-ups"
                    value={totals?.signups ?? 0}
                    helper="Attributed organisations"
                  />

                  <FunnelArrow
                    label={
                      totals
                        ? percent(totals.paidConversion)
                        : "0%"
                    }
                  />

                  <FunnelStep
                    label="Paid"
                    value={totals?.paidCustomers ?? 0}
                    helper="Active subscriptions"
                    emphasis
                  />
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-xs leading-5 text-white/40">
                  Attribution uses a 30-day first-touch window.
                  Current paid status is derived from Stripe
                  billing records.
                </div>
              </div>

              <div className={`${card} p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Customers
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">
                      Paid plan mix
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                      Current plan distribution for referred
                      customers with an active subscription.
                    </p>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50">
                    {planMixTotal} currently paid
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {planMixRows.map((row) => {
                    const share =
                      planMixTotal > 0
                        ? (row.value / planMixTotal) * 100
                        : 0;

                    return (
                      <div key={row.label}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/70">
                            {row.label}
                          </span>
                          <span className="font-medium text-white">
                            {row.value}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#64bae2] to-[#2d8fc4] transition-all"
                            style={{
                              width: `${share}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={`${card} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Partners
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">
                    Partner performance
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    Traffic, sign-up and paid conversion performance
                    for the selected reporting period.
                  </p>
                </div>

                <div className="text-xs text-white/40">
                  {(data?.partners ?? []).length} partner
                  {(data?.partners ?? []).length === 1
                    ? ""
                    : "s"}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/[0.08] text-[11px] uppercase tracking-[0.14em] text-white/35">
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
                        className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.025]"
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-white">
                              {partner.name}
                            </span>
                            <StatusPill
                              status={partner.status}
                            />
                          </div>

                          <div className="mt-1 text-xs text-white/40">
                            {partner.email || "No email"}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              copyReferralLink(
                                partner.code
                              )
                            }
                            className="mt-2 inline-flex items-center rounded-lg border border-sky-300/10 bg-sky-300/[0.05] px-2.5 py-1 font-mono text-xs text-sky-200/80 transition hover:bg-sky-300/10"
                            title="Copy referral link"
                          >
                            /r/{partner.code}
                          </button>
                        </td>

                        <td className="px-4 py-5 text-right text-white/80">
                          {partner.clicks}
                        </td>

                        <td className="px-4 py-5 text-right text-white/80">
                          {partner.signups}
                        </td>

                        <td className="px-4 py-5 text-right font-medium text-white">
                          {partner.paidCustomers}
                        </td>

                        <td className="px-4 py-5 text-right text-white/70">
                          {percent(
                            partner.signupConversion
                          )}
                        </td>

                        <td className="px-4 py-5 text-right font-medium text-sky-100">
                          {percent(
                            partner.paidConversion
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                copyReferralLink(
                                  partner.code
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
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
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                            >
                              {changingPartnerId ===
                              partner.id
                                ? "Saving..."
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
                          className="px-6 py-12 text-center text-white/40"
                        >
                          No referral partners yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={`${card} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Conversions
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">
                    Referred customer conversions
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    Original plan at sign-up alongside the
                    organisation&apos;s current plan and billing
                    state.
                  </p>
                </div>

                <div className="text-xs text-white/40">
                  {(data?.conversions ?? []).length} in period
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/[0.08] text-[11px] uppercase tracking-[0.14em] text-white/35">
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
                          className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.025]"
                        >
                          <td className="px-6 py-5">
                            <div className="font-medium text-white">
                              {conversion.orgName}
                            </div>
                            <div className="mt-1 text-xs text-white/35">
                              {conversion.orgSlug ||
                                conversion.orgId}
                            </div>
                          </td>

                          <td className="px-5 py-5 text-white/75">
                            {conversion.partnerName}
                          </td>

                          <td className="px-5 py-5 text-white/55">
                            {formatDate(
                              conversion.signupAt
                            )}
                          </td>

                          <td className="px-5 py-5">
                            <span className="inline-flex rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                              {conversion.signupPlan}
                            </span>
                          </td>

                          <td className="px-5 py-5">
                            <span className="inline-flex rounded-lg border border-sky-300/10 bg-sky-300/[0.05] px-2.5 py-1 text-xs text-sky-100/80">
                              {conversion.currentPlan}
                            </span>
                          </td>

                          <td className="px-6 py-5">
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
                          className="px-6 py-12 text-center text-white/40"
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

      {copyMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-xl border border-sky-300/20 bg-[#0b1724] px-4 py-3 text-center text-xs text-sky-100 shadow-2xl shadow-black/40">
          {copyMessage}
        </div>
      ) : null}

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-referral-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b1724] shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                  Referral partner
                </div>
                <h2
                  id="create-referral-title"
                  className="mt-1 text-xl font-semibold text-white"
                >
                  Create referral partner
                </h2>
                <p className="mt-1 text-sm leading-5 text-white/50">
                  Create a tracked MindCanvas link with a 30-day
                  first-touch attribution window.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                aria-label="Close create referral partner"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <CloseIcon />
              </button>
            </div>

            <form
              onSubmit={createPartner}
              className="space-y-5 px-6 py-6"
            >
              {createError ? (
                <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                  {createError}
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-white/80">
                  Partner name
                </label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    handleNameChange(event.target.value)
                  }
                  required
                  placeholder="e.g. Coach Network"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white/80">
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
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white/80">
                  Referral code
                </label>
                <input
                  value={form.code}
                  onChange={(event) =>
                    updateForm(
                      "code",
                      normaliseCode(
                        event.target.value
                      )
                    )
                  }
                  required
                  placeholder="coach-network"
                  className={`${inputClass} font-mono`}
                />

                <div className="mt-2 rounded-xl border border-sky-300/10 bg-sky-300/[0.05] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                    Link preview
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-sky-100/75">
                    {`${origin || "https://profiletest.ai"}/r/${form.code || "partner-code"}`}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-white/80">
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
                  className={`${inputClass} font-mono`}
                />
                <p className="mt-1.5 text-xs text-white/35">
                  Internal MindCanvas path only.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-950/20 transition hover:brightness-110 disabled:opacity-60"
                >
                  {creating
                    ? "Creating..."
                    : "Create referral partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}