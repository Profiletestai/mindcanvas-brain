// apps/web/app/api/billing/summary/route.ts
// GET — billing summary for the caller's org.

import "server-only";

import { NextResponse } from "next/server";

import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  getActiveEntitlement,
  getOrgRow,
  getSubmissionUsage,
  PILOT_GRACE_HOURS,
  PILOT_TIER,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";
import { createClient as createAdminClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingAccountRow = {
  id: string;
  org_id: string;
  billing_type: "owner" | "licensee";
  tier: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  period_start: string | null;
  period_end: string | null;
  past_due_since: string | null;
  billing_source: "onboarding" | "legacy";
  billing_interval: "monthly" | "annual";
  billing_required_from: string | null;
  created_at: string;
  updated_at: string;
};

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

function deriveNextAction(
  orgStatus: string
): "checkout" | "reactivate" | "none" {
  if (orgStatus === "pending_activation") return "checkout";
  if (orgStatus === "past_due") return "reactivate";
  return "none";
}

function billingPriority(account: BillingAccountRow) {
  const status = account.stripe_status?.toLowerCase() ?? "";

  const statusPriority: Record<string, number> = {
    active: 100,
    trialing: 90,
    past_due: 80,
    unpaid: 75,
    incomplete: 70,
    incomplete_expired: 65,
    paused: 60,
    canceled: 20,
    cancelled: 20,
  };

  return statusPriority[status] ?? 40;
}

function pickCurrentBillingAccount(
  rows: BillingAccountRow[]
): BillingAccountRow | null {
  if (!rows.length) return null;

  return rows.slice().sort((a, b) => {
    const priorityDifference =
      billingPriority(b) - billingPriority(a);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (
      new Date(b.updated_at).getTime() -
      new Date(a.updated_at).getTime()
    );
  })[0];
}

export async function GET(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;
  const user = auth.user;

  const url = new URL(req.url);
  const orgIdHint = url.searchParams.get("orgId");

  const resolved = await resolveOwnerOrgId(user.id, orgIdHint);
  if (!resolved.ok) {
    return jerr(resolved.error, resolved.code, resolved.status);
  }

  const { orgId } = resolved;

  const org = await getOrgRow(orgId);
  if (!org) {
    return jerr("Org not found", "org_not_found", 404);
  }

  const sb = createAdminClient().schema("portal");

  const { data: billingData, error: billingError } = await sb
    .from("billing_accounts")
    .select(
      "id, org_id, billing_type, tier, stripe_customer_id, stripe_subscription_id, stripe_status, period_start, period_end, past_due_since, billing_source, billing_interval, billing_required_from, created_at, updated_at"
    )
    .eq("org_id", orgId)
    .eq("billing_type", "owner")
    .order("updated_at", { ascending: false });

  if (billingError) {
    return jerr(
      billingError.message,
      "billing_account_lookup_failed",
      500
    );
  }

  const billingRows =
    (billingData ?? []) as unknown as BillingAccountRow[];

  const billingAccount =
    pickCurrentBillingAccount(billingRows);

  const usage = await getSubmissionUsage(orgId);
  const entitlement = await getActiveEntitlement(orgId);

  // Pilot status is derived from the active tier-0 entitlement. Its period_end
  // already equals pilot_end + grace, so pilot_end is period_end minus
  // PILOT_GRACE_HOURS.
  const isPilot = entitlement?.tier === PILOT_TIER;
  const graceEndsAt = isPilot
    ? entitlement?.period_end ?? null
    : null;

  const pilotEndDate =
    isPilot && entitlement?.period_end
      ? new Date(
          new Date(entitlement.period_end).getTime() -
            PILOT_GRACE_HOURS * 60 * 60 * 1000
        ).toISOString()
      : null;

  return NextResponse.json({
    ok: true,
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
    },
    usage,
    billing: billingAccount
      ? {
          id: billingAccount.id,
          tier: billingAccount.tier,
          billing_type: billingAccount.billing_type,
          billing_interval: billingAccount.billing_interval,
          billing_source: billingAccount.billing_source,
          stripe_status: billingAccount.stripe_status,
          stripe_customer_id:
            billingAccount.stripe_customer_id,
          stripe_subscription_id:
            billingAccount.stripe_subscription_id,
          period_start: billingAccount.period_start,
          period_end: billingAccount.period_end,
          past_due_since:
            billingAccount.past_due_since,
          billing_required_from:
            billingAccount.billing_required_from,
          is_pilot: isPilot,
          pilot_end_date: pilotEndDate,
          pilot_grace_ends_at: graceEndsAt,
        }
      : null,
    next_action: deriveNextAction(org.status),
  });
}
