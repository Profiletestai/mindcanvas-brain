"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type PartnerStatus =
  | "active"
  | "paused";

type PaymentState =
  | "paid"
  | "trial"
  | "overdue"
  | "setup_required"
  | "paused"
  | "cancelled"
  | "complimentary"
  | "pending";

type Partner = {
  id: string;
  name: string;
  email: string | null;
  contactName: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  notes: string | null;
  status: PartnerStatus;
  legacyCode: string;
  legacyDestinationPath: string;
  createdAt: string;
  updatedAt: string;
};

type Totals = {
  links: number;
  activeLinks: number;
  clicks: number;
  firstTouchClicks: number;
  signups: number;
  paidCustomers: number;
  signupConversion: number;
  paidConversion: number;
};

type ReferralLink = {
  id: string;
  name: string;
  code: string;
  destinationPath: string;
  status: PartnerStatus;
  createdAt: string;
  clicks: number;
  firstTouchClicks: number;
  signups: number;
  paidCustomers: number;
  signupConversion: number;
  paidConversion: number;
};

type Conversion = {
  id: string;
  attributionId: string;
  clickId: string;
  partnerId: string;
  linkId: string | null;
  linkName: string | null;
  linkCode: string | null;
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
  billingAccountId: string | null;
  billingType: string | null;
  billingInterval: string | null;
  billingSource: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
};

type RecentClick = {
  id: string;
  linkId: string | null;
  linkName: string | null;
  linkCode: string | null;
  destinationPath: string;
  isFirstTouch: boolean;
  clickedAt: string;
};

type Payload = {
  ok: true;
  partner: Partner;
  totals: Totals;
  links: ReferralLink[];
  conversions: Conversion[];
  recentClicks: RecentClick[];
};

type PartnerForm = {
  name: string;
  email: string;
  contactName: string;
  phoneNumber: string;
  websiteUrl: string;
  notes: string;
};

type LinkForm = {
  name: string;
  code: string;
  destinationPath: string;
};

const EMPTY_LINK_FORM: LinkForm = {
  name: "",
  code: "",
  destinationPath:
    "/onboarding/v2/account",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function percent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function normaliseCode(
  value: string
) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(
      /[^a-z0-9-]/g,
      ""
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
}

function StatusPill({
  status,
}: {
  status: PartnerStatus;
}) {
  const classes =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {status === "active"
        ? "Active"
        : "Paused"}
    </span>
  );
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : state === "trial"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : state === "overdue"
          ? "border-red-200 bg-red-50 text-red-700"
          : state ===
              "setup_required"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : state ===
                "complimentary"
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value:
    | string
    | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      {helper ? (
        <div className="mt-2 text-xs leading-5 text-slate-500">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function SmallCopyButton({
  text,
  label = "Copy",
  onCopied,
}: {
  text: string;
  label?: string;
  onCopied: (
    message: string
  ) => void;
}) {
  async function copy() {
    try {
      await navigator
        .clipboard
        .writeText(text);

      onCopied(
        `Copied ${text}`
      );
    } catch {
      onCopied(text);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

export default function PartnerDetailClient({
  partnerId,
}: {
  partnerId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<Payload | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    origin,
    setOrigin,
  ] =
    useState("");

  const [
    editing,
    setEditing,
  ] =
    useState(false);

  const [
    savingPartner,
    setSavingPartner,
  ] =
    useState(false);

  const [
    partnerForm,
    setPartnerForm,
  ] =
    useState<PartnerForm>({
      name: "",
      email: "",
      contactName: "",
      phoneNumber: "",
      websiteUrl: "",
      notes: "",
    });

  const [
    showLinkForm,
    setShowLinkForm,
  ] =
    useState(false);

  const [
    linkForm,
    setLinkForm,
  ] =
    useState<LinkForm>(
      EMPTY_LINK_FORM
    );

  const [
    creatingLink,
    setCreatingLink,
  ] =
    useState(false);

  const [
    changingLinkId,
    setChangingLinkId,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    setOrigin(
      window.location.origin
    );
  }, []);

  const load =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const response =
            await fetch(
              `/api/admin/referrals/${partnerId}`,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            json?.ok === false
          ) {
            throw new Error(
              json?.error ||
                `HTTP ${response.status}`
            );
          }

          const payload =
            json as Payload;

          setData(payload);

          setPartnerForm({
            name:
              payload
                .partner
                .name,
            email:
              payload
                .partner
                .email ?? "",
            contactName:
              payload
                .partner
                .contactName ??
              "",
            phoneNumber:
              payload
                .partner
                .phoneNumber ??
              "",
            websiteUrl:
              payload
                .partner
                .websiteUrl ??
              "",
            notes:
              payload
                .partner
                .notes ?? "",
          });
        } catch (
          loadError
        ) {
          setData(null);

          setError(
            loadError instanceof
              Error
              ? loadError
                  .message
              : "Could not load referral partner."
          );
        } finally {
          setLoading(false);
        }
      },
      [partnerId]
    );

  useEffect(() => {
    load();
  }, [load]);

  const sortedConversions =
    useMemo(() => {
      return [
        ...(
          data
            ?.conversions ??
          []
        ),
      ].sort(
        (a, b) =>
          new Date(
            b.signupAt
          ).getTime() -
          new Date(
            a.signupAt
          ).getTime()
      );
    }, [data]);

  function flash(
    message: string
  ) {
    setSuccess(message);

    window.setTimeout(
      () => {
        setSuccess("");
      },
      3000
    );
  }

  function updatePartnerForm<
    K extends
      keyof PartnerForm,
  >(
    key: K,
    value:
      PartnerForm[K]
  ) {
    setPartnerForm(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  }

  function updateLinkForm<
    K extends keyof LinkForm,
  >(
    key: K,
    value:
      LinkForm[K]
  ) {
    setLinkForm(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  }

  function handleLinkNameChange(
    value: string
  ) {
    setLinkForm(
      (current) => ({
        ...current,
        name: value,
        code:
          current.code
            .length === 0
            ? normaliseCode(
                `${data?.partner.name ?? "partner"}-${value}`
              )
            : current.code,
      })
    );
  }

  async function savePartner(
    event: FormEvent
  ) {
    event.preventDefault();

    setSavingPartner(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/referrals/${partnerId}`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                name:
                  partnerForm.name,
                email:
                  partnerForm.email,
                contact_name:
                  partnerForm.contactName,
                phone_number:
                  partnerForm.phoneNumber,
                website_url:
                  partnerForm.websiteUrl,
                notes:
                  partnerForm.notes,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        json?.ok === false
      ) {
        throw new Error(
          json?.error ||
            "Could not update referral partner."
        );
      }

      setEditing(false);

      await load();

      flash(
        "Partner record updated."
      );
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof
          Error
          ? saveError
              .message
          : "Could not update referral partner."
      );
    } finally {
      setSavingPartner(false);
    }
  }

  async function createLink(
    event: FormEvent
  ) {
    event.preventDefault();

    setCreatingLink(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/referrals/${partnerId}/links`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                name:
                  linkForm.name,
                code:
                  linkForm.code,
                destination_path:
                  linkForm.destinationPath,
                status:
                  "active",
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        json?.ok === false
      ) {
        throw new Error(
          json?.error ||
            "Could not create referral link."
        );
      }

      setShowLinkForm(false);

      setLinkForm(
        EMPTY_LINK_FORM
      );

      await load();

      flash(
        "Referral link created."
      );
    } catch (
      createError
    ) {
      setError(
        createError instanceof
          Error
          ? createError
              .message
          : "Could not create referral link."
      );
    } finally {
      setCreatingLink(false);
    }
  }

  async function toggleLink(
    link: ReferralLink
  ) {
    const nextStatus =
      link.status ===
      "active"
        ? "paused"
        : "active";

    setChangingLinkId(
      link.id
    );

    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/referrals/${partnerId}/links`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                link_id:
                  link.id,
                status:
                  nextStatus,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        json?.ok === false
      ) {
        throw new Error(
          json?.error ||
            "Could not update referral link."
        );
      }

      await load();

      flash(
        `Referral link ${
          nextStatus ===
          "active"
            ? "reactivated"
            : "paused"
        }.`
      );
    } catch (
      statusError
    ) {
      setError(
        statusError instanceof
          Error
          ? statusError
              .message
          : "Could not update referral link."
      );
    } finally {
      setChangingLinkId(
        null
      );
    }
  }

  if (
    loading &&
    !data
  ) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading partner
          record...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">
            Referral partner
            could not be
            loaded
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error ||
              "Unknown error"}
          </p>

          <Link
            href="/admin/referrals"
            className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            Back to Referral
            Tracking
          </Link>
        </div>
      </div>
    );
  }

  const {
    partner,
    totals,
    links,
    recentClicks,
  } = data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/referrals"
                className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
              >
                ← Referral
                Tracking
              </Link>

              <StatusPill
                status={
                  partner.status
                }
              />
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {partner.name}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Internal referral
              partner record. This
              page is for
              MindCanvas admin use
              only and does not
              create partner portal
              access.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(
                  true
                );
                setError("");
              }}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Edit partner record
            </button>

            <button
              type="button"
              onClick={() => {
                setShowLinkForm(
                  true
                );
                setError("");
              }}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
            >
              + Create referral
              link
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Links"
            value={
              totals.links
            }
            helper={`${totals.activeLinks} active`}
          />

          <StatCard
            label="Clicks"
            value={
              totals.clicks
            }
            helper={`${totals.firstTouchClicks} first-touch`}
          />

          <StatCard
            label="Sign-ups"
            value={
              totals.signups
            }
            helper={`${percent(
              totals.signupConversion
            )} of clicks`}
          />

          <StatCard
            label="Paid customers"
            value={
              totals.paidCustomers
            }
            helper="Active Stripe subscriptions"
          />

          <StatCard
            label="Paid conversion"
            value={percent(
              totals.paidConversion
            )}
            helper="Sign-up to paid"
          />

          <StatCard
            label="Created"
            value={formatDate(
              partner.createdAt
            )}
            helper="Partner record"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Internal record
                </div>

                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Partner details
                </h2>
              </div>

              <StatusPill
                status={
                  partner.status
                }
              />
            </div>

            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Contact name
                </dt>
                <dd className="mt-1 text-slate-800">
                  {partner.contactName ||
                    "-"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Email
                </dt>
                <dd className="mt-1 break-all text-slate-800">
                  {partner.email ||
                    "-"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Phone
                </dt>
                <dd className="mt-1 text-slate-800">
                  {partner.phoneNumber ||
                    "-"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Website
                </dt>
                <dd className="mt-1 break-all text-slate-800">
                  {partner.websiteUrl ? (
                    <a
                      href={
                        partner.websiteUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 hover:underline"
                    >
                      {
                        partner.websiteUrl
                      }
                    </a>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Internal notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">
                  {partner.notes ||
                    "No internal notes yet."}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Multi-link
                  tracking
                </div>

                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Referral links
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Each link has
                  independent traffic
                  and conversion
                  activity.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowLinkForm(
                    true
                  )
                }
                className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
              >
                + Add link
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3">
                      Link
                    </th>
                    <th className="px-5 py-3">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right">
                      Clicks
                    </th>
                    <th className="px-5 py-3 text-right">
                      Sign-ups
                    </th>
                    <th className="px-5 py-3 text-right">
                      Paid
                    </th>
                    <th className="px-5 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {links.map(
                    (link) => {
                      const publicLink =
                        `${
                          origin ||
                          "https://profiletest.ai"
                        }/r/${
                          link.code
                        }`;

                      return (
                        <tr
                          key={
                            link.id
                          }
                          className="align-top"
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {
                                link.name
                              }
                            </div>

                            <div className="mt-1 font-mono text-xs text-slate-500">
                              /r/
                              {
                                link.code
                              }
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {
                                link.destinationPath
                              }
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <StatusPill
                              status={
                                link.status
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right font-medium text-slate-800">
                            {
                              link.clicks
                            }
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="font-medium text-slate-800">
                              {
                                link.signups
                              }
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {percent(
                                link.signupConversion
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="font-medium text-slate-800">
                              {
                                link.paidCustomers
                              }
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {percent(
                                link.paidConversion
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <SmallCopyButton
                                text={
                                  publicLink
                                }
                                label="Copy"
                                onCopied={
                                  flash
                                }
                              />

                              <button
                                type="button"
                                disabled={
                                  changingLinkId ===
                                  link.id
                                }
                                onClick={() =>
                                  toggleLink(
                                    link
                                  )
                                }
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                {changingLinkId ===
                                link.id
                                  ? "Saving..."
                                  : link.status ===
                                      "active"
                                    ? "Pause"
                                    : "Reactivate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {links.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-sm text-slate-500"
                      >
                        No referral
                        links found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Commercial
              activity
            </div>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Attributed
              customers
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current billing
              status and Stripe
              identifiers for manual
              reconciliation.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-3">
                    Organisation
                  </th>
                  <th className="px-5 py-3">
                    Referral link
                  </th>
                  <th className="px-5 py-3">
                    Sign-up
                  </th>
                  <th className="px-5 py-3">
                    Plan
                  </th>
                  <th className="px-5 py-3">
                    Payment
                  </th>
                  <th className="px-5 py-3">
                    Stripe customer
                  </th>
                  <th className="px-5 py-3">
                    Subscription
                  </th>
                  <th className="px-5 py-3">
                    Billing period
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {sortedConversions.map(
                  (
                    conversion
                  ) => (
                    <tr
                      key={
                        conversion.id
                      }
                      className="align-top"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {
                            conversion.orgName
                          }
                        </div>

                        <div className="mt-1 font-mono text-[11px] text-slate-400">
                          {
                            conversion.orgId
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-700">
                          {conversion.linkName ||
                            "-"}
                        </div>

                        <div className="mt-1 font-mono text-xs text-slate-400">
                          {conversion.linkCode
                            ? `/r/${conversion.linkCode}`
                            : "-"}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {formatDateTime(
                          conversion.signupAt
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">
                          {
                            conversion.currentPlan
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Signed up:
                          {" "}
                          {
                            conversion.signupPlan
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <PaymentPill
                          state={
                            conversion.paymentState
                          }
                          label={
                            conversion.paymentLabel
                          }
                        />

                        {conversion.stripeStatus ? (
                          <div className="mt-2 font-mono text-[11px] text-slate-400">
                            {
                              conversion.stripeStatus
                            }
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-4">
                        {conversion.stripeCustomerId ? (
                          <div className="flex items-center gap-2">
                            <span className="max-w-[190px] truncate font-mono text-xs text-slate-600">
                              {
                                conversion.stripeCustomerId
                              }
                            </span>

                            <SmallCopyButton
                              text={
                                conversion.stripeCustomerId
                              }
                              onCopied={
                                flash
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {conversion.stripeSubscriptionId ? (
                          <div className="flex items-center gap-2">
                            <span className="max-w-[190px] truncate font-mono text-xs text-slate-600">
                              {
                                conversion.stripeSubscriptionId
                              }
                            </span>

                            <SmallCopyButton
                              text={
                                conversion.stripeSubscriptionId
                              }
                              onCopied={
                                flash
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs leading-5 text-slate-600">
                        <div>
                          {formatDate(
                            conversion.billingPeriodStart
                          )}
                          {" → "}
                          {formatDate(
                            conversion.billingPeriodEnd
                          )}
                        </div>

                        {conversion.billingInterval ? (
                          <div className="mt-1 text-slate-400">
                            {
                              conversion.billingInterval
                            }
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                )}

                {sortedConversions.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No attributed
                      customers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Traffic
            </div>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Recent referral
              clicks
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-3">
                    Date
                  </th>
                  <th className="px-5 py-3">
                    Link
                  </th>
                  <th className="px-5 py-3">
                    Touch
                  </th>
                  <th className="px-5 py-3">
                    Destination
                  </th>
                  <th className="px-5 py-3">
                    Click ID
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {recentClicks.map(
                  (click) => (
                    <tr
                      key={
                        click.id
                      }
                    >
                      <td className="px-5 py-4 text-slate-700">
                        {formatDateTime(
                          click.clickedAt
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">
                          {click.linkName ||
                            "-"}
                        </div>

                        <div className="mt-1 font-mono text-xs text-slate-400">
                          {click.linkCode
                            ? `/r/${click.linkCode}`
                            : "-"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                            click.isFirstTouch
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {click.isFirstTouch
                            ? "First touch"
                            : "Repeat"}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {
                          click.destinationPath
                        }
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[180px] truncate font-mono text-[11px] text-slate-400">
                            {
                              click.id
                            }
                          </span>

                          <SmallCopyButton
                            text={
                              click.id
                            }
                            onCopied={
                              flash
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {recentClicks.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No referral
                      clicks yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Edit partner
                  record
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Internal
                  commercial/contact
                  information only.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  savingPartner
                }
                onClick={() =>
                  setEditing(
                    false
                  )
                }
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                savePartner
              }
              className="space-y-5 p-6"
            >
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Partner/company
                  name
                </label>

                <input
                  required
                  value={
                    partnerForm.name
                  }
                  onChange={(
                    event
                  ) =>
                    updatePartnerForm(
                      "name",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Contact name
                  </label>

                  <input
                    value={
                      partnerForm.contactName
                    }
                    onChange={(
                      event
                    ) =>
                      updatePartnerForm(
                        "contactName",
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={
                      partnerForm.email
                    }
                    onChange={(
                      event
                    ) =>
                      updatePartnerForm(
                        "email",
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <input
                    value={
                      partnerForm.phoneNumber
                    }
                    onChange={(
                      event
                    ) =>
                      updatePartnerForm(
                        "phoneNumber",
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Website
                  </label>

                  <input
                    type="url"
                    placeholder="https://..."
                    value={
                      partnerForm.websiteUrl
                    }
                    onChange={(
                      event
                    ) =>
                      updatePartnerForm(
                        "websiteUrl",
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Internal notes
                </label>

                <textarea
                  rows={5}
                  value={
                    partnerForm.notes
                  }
                  onChange={(
                    event
                  ) =>
                    updatePartnerForm(
                      "notes",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={
                    savingPartner
                  }
                  onClick={() =>
                    setEditing(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    savingPartner
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingPartner
                    ? "Saving..."
                    : "Save partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showLinkForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Create referral
                  link
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create another
                  tracked source for
                  this partner.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  creatingLink
                }
                onClick={() =>
                  setShowLinkForm(
                    false
                  )
                }
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                createLink
              }
              className="space-y-5 p-6"
            >
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Link label
                </label>

                <input
                  required
                  placeholder="e.g. September webinar"
                  value={
                    linkForm.name
                  }
                  onChange={(
                    event
                  ) =>
                    handleLinkNameChange(
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Referral code
                </label>

                <div className="mt-1.5 flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    /r/
                  </span>

                  <input
                    required
                    value={
                      linkForm.code
                    }
                    onChange={(
                      event
                    ) =>
                      updateLinkForm(
                        "code",
                        normaliseCode(
                          event.target
                            .value
                        )
                      )
                    }
                    className="min-w-0 flex-1 px-3.5 py-2.5 text-sm text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Destination
                </label>

                <input
                  required
                  value={
                    linkForm.destinationPath
                  }
                  onChange={(
                    event
                  ) =>
                    updateLinkForm(
                      "destinationPath",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClass
                  }
                />

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Internal
                  MindCanvas path
                  only. The standard
                  onboarding
                  destination is
                  /onboarding/v2/account.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={
                    creatingLink
                  }
                  onClick={() =>
                    setShowLinkForm(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creatingLink
                  }
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {creatingLink
                    ? "Creating..."
                    : "Create link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
