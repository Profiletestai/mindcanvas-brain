// apps/web/app/api/billing/summary/route.ts
// GET — billing summary for the caller's org.

import "server-only";
import { NextResponse } from "next/server";

import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  getOrgRow,
  getOwnerBillingAccount,
  getSubmissionUsage,
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
        }
      : null,
    next_action: deriveNextAction(org.status),
  });
}
