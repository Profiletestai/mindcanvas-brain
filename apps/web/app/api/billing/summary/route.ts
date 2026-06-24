// apps/web/app/api/billing/summary/route.ts
// GET — billing summary for the caller's org.

import "server-only";
import { NextResponse } from "next/server";

import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  getActiveEntitlement,
  getOrgRow,
  getOwnerBillingAccount,
  getSubmissionUsage,
  PILOT_GRACE_HOURS,
  PILOT_TIER,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

function deriveNextAction(orgStatus: string): "checkout" | "reactivate" | "none" {
  if (orgStatus === "pending_activation") return "checkout";
  if (orgStatus === "past_due") return "reactivate";
  return "none";
}

export async function GET(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;
  const user = auth.user;

  const url = new URL(req.url);
  const orgIdHint = url.searchParams.get("orgId");

  const resolved = await resolveOwnerOrgId(user.id, orgIdHint);
  if (!resolved.ok) return jerr(resolved.error, resolved.code, resolved.status);
  const { orgId } = resolved;

  const org = await getOrgRow(orgId);
  if (!org) return jerr("Org not found", "org_not_found", 404);

  const ba = await getOwnerBillingAccount(orgId);
  const usage = await getSubmissionUsage(orgId);
  const ent = await getActiveEntitlement(orgId);

  // Pilot status is derived from the active tier-0 entitlement. Its period_end
  // already = pilot_end + grace, so pilot_end is period_end - PILOT_GRACE_HOURS.
  const isPilot = ent?.tier === PILOT_TIER;
  const graceEndsAt = isPilot ? ent?.period_end ?? null : null;
  const pilotEndDate =
    isPilot && ent?.period_end
      ? new Date(
          new Date(ent.period_end).getTime() - PILOT_GRACE_HOURS * 60 * 60 * 1000
        ).toISOString()
      : null;

  return NextResponse.json({
    ok: true,
    org: { id: org.id, name: org.name, slug: org.slug, status: org.status },
    usage,
    billing: ba
      ? {
          tier: ba.tier,
          stripe_status: ba.stripe_status,
          stripe_customer_id: ba.stripe_customer_id,
          stripe_subscription_id: ba.stripe_subscription_id,
          period_start: ba.period_start,
          period_end: ba.period_end,
          past_due_since: ba.past_due_since,
          is_pilot: isPilot,
          pilot_end_date: pilotEndDate,
          pilot_grace_ends_at: graceEndsAt,
        }
      : null,
    next_action: deriveNextAction(org.status),
  });
}
