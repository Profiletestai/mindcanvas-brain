// apps/web/app/admin/page.tsx
import "server-only";

import Link from "next/link";
import { createClient as createAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganisationStatus = "active" | "pending_activation";
type OrganisationAccountType = "standard" | "pilot";

type Organisation = {
  id: string;
  slug: string;
  name: string;
  status: OrganisationStatus;
  created_at: string;
  last_completed_step: number;
  account_type: OrganisationAccountType;
  selected_tier: number | null;
};

type BillingAccount = {
  id: string;
  org_id: string;
  billing_type: "owner" | "licensee";
  tier: number;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  billing_interval: "monthly" | "annual";
  billing_source: "onboarding" | "legacy";
  period_end: string | null;
  updated_at: string;
};

type BillingBadgeDetails = {
  label: string;
  className: string;
  title: string;
};

const billingBadgeStyles = {
  paid: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  trial: "border-sky-300/20 bg-sky-300/10 text-sky-200",
  warning: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  overdue: "border-red-300/20 bg-red-300/10 text-red-200",
  complimentary:
    "border-violet-300/20 bg-violet-300/10 text-violet-200",
  neutral: "border-white/10 bg-white/5 text-white/60",
};

function formatBillingInterval(
  interval: BillingAccount["billing_interval"]
) {
  return interval === "annual" ? "Annual" : "Monthly";
}

function formatStripeStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getTierLabel(
  billingAccount: BillingAccount | null,
  organisation: Organisation
) {
  const tier = billingAccount?.tier ?? organisation.selected_tier;

  if (tier === null || tier === undefined) {
    return null;
  }

  return `Tier ${tier}`;
}

function getBillingBadgeDetails(
  organisation: Organisation,
  billingAccount: BillingAccount | null
): BillingBadgeDetails {
  const tierLabel = getTierLabel(billingAccount, organisation);
  const stripeStatus =
    billingAccount?.stripe_status?.toLowerCase() ?? null;

  if (billingAccount && stripeStatus === "active") {
    return {
      label: [
        "Paid",
        tierLabel,
        formatBillingInterval(billingAccount.billing_interval),
      ]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.paid,
      title: `Active ${billingAccount.billing_type} subscription. Billing source: ${billingAccount.billing_source}.`,
    };
  }

  if (billingAccount && stripeStatus === "trialing") {
    return {
      label: [
        "Trial",
        tierLabel,
        formatBillingInterval(billingAccount.billing_interval),
      ]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.trial,
      title: `Trial subscription. Billing source: ${billingAccount.billing_source}.`,
    };
  }

  if (
    billingAccount &&
    (stripeStatus === "past_due" || stripeStatus === "unpaid")
  ) {
    return {
      label: ["Payment overdue", tierLabel].filter(Boolean).join(" · "),
      className: billingBadgeStyles.overdue,
      title: `Stripe subscription status: ${formatStripeStatus(
        stripeStatus
      )}.`,
    };
  }

  if (
    billingAccount &&
    (stripeStatus === "incomplete" ||
      stripeStatus === "incomplete_expired")
  ) {
    return {
      label: ["Billing setup required", tierLabel]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.warning,
      title: `Stripe subscription status: ${formatStripeStatus(
        stripeStatus
      )}.`,
    };
  }

  if (billingAccount && stripeStatus === "paused") {
    return {
      label: ["Subscription paused", tierLabel]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.warning,
      title: "The organisation's subscription is currently paused.",
    };
  }

  if (
    billingAccount &&
    (stripeStatus === "canceled" || stripeStatus === "cancelled")
  ) {
    return {
      label: ["Subscription cancelled", tierLabel]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.neutral,
      title: "The organisation's subscription has been cancelled.",
    };
  }

  if (billingAccount && stripeStatus === "complimentary") {
    return {
      label: ["Complimentary", tierLabel].filter(Boolean).join(" · "),
      className: billingBadgeStyles.complimentary,
      title: "This organisation has complimentary platform access.",
    };
  }

  if (organisation.account_type === "pilot") {
    return {
      label: ["Pilot", "Complimentary", tierLabel]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.complimentary,
      title: "Pilot account with complimentary access.",
    };
  }

  if (billingAccount && !stripeStatus) {
    return {
      label: ["Billing setup required", tierLabel]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.warning,
      title:
        "A billing account exists, but no Stripe subscription status has been recorded.",
    };
  }

  if (billingAccount && stripeStatus) {
    return {
      label: [
        `Billing: ${formatStripeStatus(stripeStatus)}`,
        tierLabel,
      ]
        .filter(Boolean)
        .join(" · "),
      className: billingBadgeStyles.neutral,
      title: `Stripe subscription status: ${formatStripeStatus(
        stripeStatus
      )}.`,
    };
  }

  return {
    label: tierLabel
      ? `Billing not set up · ${tierLabel}`
      : "Billing not set up",
    className: billingBadgeStyles.neutral,
    title: "No billing account was found for this organisation.",
  };
}

function getBillingAccountPriority(account: BillingAccount) {
  const stripeStatus = account.stripe_status?.toLowerCase();

  const statusPriority: Record<string, number> = {
    active: 100,
    trialing: 90,
    past_due: 80,
    unpaid: 75,
    incomplete: 70,
    incomplete_expired: 60,
    paused: 50,
    canceled: 20,
    cancelled: 20,
  };

  const billingTypePriority =
    account.billing_type === "owner" ? 2 : 1;

  return (
    (stripeStatus ? statusPriority[stripeStatus] ?? 40 : 30) * 10 +
    billingTypePriority
  );
}

function createBillingAccountMap(
  billingAccounts: BillingAccount[]
) {
  const billingAccountMap = new Map<string, BillingAccount>();

  for (const billingAccount of billingAccounts) {
    const existingAccount = billingAccountMap.get(
      billingAccount.org_id
    );

    if (!existingAccount) {
      billingAccountMap.set(
        billingAccount.org_id,
        billingAccount
      );
      continue;
    }

    const currentPriority =
      getBillingAccountPriority(billingAccount);

    const existingPriority =
      getBillingAccountPriority(existingAccount);

    if (currentPriority > existingPriority) {
      billingAccountMap.set(
        billingAccount.org_id,
        billingAccount
      );
      continue;
    }

    if (
      currentPriority === existingPriority &&
      new Date(billingAccount.updated_at).getTime() >
        new Date(existingAccount.updated_at).getTime()
    ) {
      billingAccountMap.set(
        billingAccount.org_id,
        billingAccount
      );
    }
  }

  return billingAccountMap;
}

function BillingBadge({
  organisation,
  billingAccount,
}: {
  organisation: Organisation;
  billingAccount: BillingAccount | null;
}) {
  const badge = getBillingBadgeDetails(
    organisation,
    billingAccount
  );

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-center text-xs font-medium ${badge.className}`}
      title={badge.title}
    >
      {badge.label}
    </span>
  );
}

function OrganisationCard({
  organisation,
  billingAccount,
}: {
  organisation: Organisation;
  billingAccount: BillingAccount | null;
}) {
  const isPending =
    organisation.status === "pending_activation";

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate font-medium">
          {organisation.name}
        </div>

        <div className="mt-1 truncate text-xs text-slate-300">
          {organisation.slug}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isPending ? (
            <>
              <span className="inline-flex items-center rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200">
                Pending activation
              </span>

              <span className="text-xs text-white/40">
                Onboarding step{" "}
                {organisation.last_completed_step}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
              Active
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
        <BillingBadge
          organisation={organisation}
          billingAccount={billingAccount}
        />

        <Link
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2 text-sm font-medium text-white shadow transition hover:brightness-110 sm:w-auto"
          href={`/portal/${organisation.slug}/dashboard`}
        >
          Open portal
        </Link>
      </div>
    </li>
  );
}

export default async function AdminOrgsPage() {
  // /admin is already protected by apps/web/app/admin/layout.tsx.
  const sb = createAdminClient().schema("portal");

  const {
    data: organisationData,
    error: organisationError,
  } = await sb
    .from("orgs")
    .select(
      "id, slug, name, status, created_at, last_completed_step, account_type, selected_tier"
    )
    .in("status", ["active", "pending_activation"])
    .order("name", { ascending: true });

  if (organisationError) {
    return (
      <div className="fixed inset-0 mc-bg flex items-center justify-center px-6 text-red-400">
        <div>Load error: {organisationError.message}</div>
      </div>
    );
  }

  const organisations =
    (organisationData ?? []) as unknown as Organisation[];

  const organisationIds = organisations.map(
    (organisation) => organisation.id
  );

  let billingAccounts: BillingAccount[] = [];

  if (organisationIds.length > 0) {
    const {
      data: billingData,
      error: billingError,
    } = await sb
      .from("billing_accounts")
      .select(
        "id, org_id, billing_type, tier, stripe_subscription_id, stripe_status, billing_interval, billing_source, period_end, updated_at"
      )
      .in("org_id", organisationIds)
      .order("updated_at", { ascending: false });

    if (billingError) {
      return (
        <div className="fixed inset-0 mc-bg flex items-center justify-center px-6 text-red-400">
          <div>
            Billing load error: {billingError.message}
          </div>
        </div>
      );
    }

    billingAccounts =
      (billingData ?? []) as unknown as BillingAccount[];
  }

  const billingAccountMap =
    createBillingAccountMap(billingAccounts);

  const activeOrganisations = organisations.filter(
    (organisation) => organisation.status === "active"
  );

  const pendingOrganisations = organisations.filter(
    (organisation) =>
      organisation.status === "pending_activation"
  );

  return (
    <div className="fixed inset-0 mc-bg overflow-auto text-white">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Admin</h1>

            <div className="text-sm text-white/60">
              Platform console
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/analytics/orgs"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
              title="View organisation performance across the platform"
            >
              Organisation Performance
            </Link>

            <Link
              href="/admin/orgs/new"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:brightness-110"
            >
              + Add organisation
            </Link>

            <Link
              href="/"
              className="text-sm text-sky-300 underline-offset-4 hover:text-sky-100 hover:underline"
            >
              Back to home
            </Link>
          </div>
        </header>

        {/* Engines */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Engines
              </h2>

              <p className="mt-1 text-sm text-white/60">
                Platform-level engines used across organisations
                and partners.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* MCAS */}
            <div className="rounded-2xl border border-sky-300/20 bg-[#0b1724]/60 p-5 shadow-lg shadow-sky-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-white/60">
                    Recruitment Engine
                  </div>

                  <div className="mt-1 text-xl font-semibold">
                    MCAS
                  </div>

                  <div className="mt-1 text-sm text-white/60">
                    MindCanvas CORE Alignment System for
                    recruitment, candidate assessments, role
                    alignment, and validation.
                  </div>
                </div>

                <div className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-200">
                  Platform
                </div>
              </div>

              <div className="mt-5">
                <Link
                  href="/admin/mcas"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-3 text-sm font-semibold text-white shadow transition hover:brightness-110"
                >
                  Open MCAS Platform →
                </Link>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                  Legacy / Direct Tools
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/admin/mcas/applications"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  >
                    Candidate Applications
                  </Link>

                  <Link
                    href="/admin/mcas/create-link"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  >
                    Create Candidate Link
                  </Link>

                  <Link
                    href="/admin/mcas/reverse-profiles"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  >
                    Reverse Profile Sandbox
                  </Link>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/40">
                Open the MCAS Platform to manage organisations,
                candidate databases, reusable test links, and the
                Validation Centre.
              </div>
            </div>

            {/* QSC */}
            <div className="rounded-2xl border border-white/10 bg-[#0b1724]/60 p-5">
              <div className="text-xs text-white/60">
                Diagnostics Engine
              </div>

              <div className="mt-1 text-xl font-semibold">
                QSC
              </div>

              <div className="mt-1 text-sm text-white/60">
                Quantum Source Code diagnostics across
                entrepreneurs and leaders.
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/admin/analytics/orgs"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                >
                  Performance View
                </Link>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  title="Placeholder - add QSC admin console later"
                >
                  Admin Console (Coming)
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/40">
                A dedicated QSC admin console can be added later.
              </div>
            </div>
          </div>
        </section>

        {/* Active organisations */}
        <section className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                Active organisations
              </h2>

              <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                {activeOrganisations.length}
              </span>
            </div>

            <div className="mt-1 text-sm text-white/60">
              Organisations that currently have active platform
              access.
            </div>
          </div>

          {activeOrganisations.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {activeOrganisations.map((organisation) => (
                <OrganisationCard
                  key={organisation.id}
                  organisation={organisation}
                  billingAccount={
                    billingAccountMap.get(organisation.id) ?? null
                  }
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-8 text-sm text-white/50">
              There are currently no active organisations.
            </div>
          )}
        </section>

        {/* Pending activation */}
        <section className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                Pending activation
              </h2>

              <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                {pendingOrganisations.length}
              </span>
            </div>

            <div className="mt-1 text-sm text-white/60">
              Organisations that have been created but have not
              completed activation.
            </div>
          </div>

          {pendingOrganisations.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {pendingOrganisations.map((organisation) => (
                <OrganisationCard
                  key={organisation.id}
                  organisation={organisation}
                  billingAccount={
                    billingAccountMap.get(organisation.id) ?? null
                  }
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-8 text-sm text-white/50">
              There are currently no organisations awaiting
              activation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}