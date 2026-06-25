// POST /api/onboarding/pilot/activate
// Final pilot onboarding step: provisions the pilot billing_account + entitlement
// (GED-only, 13 submissions, pilot window + 48h grace) via fn_activate_pilot.
import "server-only";
import { NextResponse } from "next/server";

import { getAuthUser } from "../../v2/_lib/auth";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getActiveEntitlement, PILOT_TIER, resolveOwnerOrgId } from "@/app/_lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Operator-configurable pilot end (grace is added on top inside the RPC).
const DEFAULT_PILOT_END = "2026-07-20T23:59:59Z";
const GRACE_HOURS = 48;

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

export async function POST(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;
  const user = auth.user;

  const resolved = await resolveOwnerOrgId(user.id);
  if (!resolved.ok) return jerr(resolved.error, resolved.code, resolved.status);
  const { orgId } = resolved;

  const admin = portalAdmin();
  const { data: org, error: orgErr } = await admin
    .from("orgs")
    .select("id, slug, status, account_type")
    .eq("id", orgId)
    .maybeSingle<{ id: string; slug: string | null; status: string; account_type: string }>();
  if (orgErr) return jerr(orgErr.message, "org_lookup_failed", 500);
  if (!org) return jerr("Org not found", "org_not_found", 404);
  if (org.account_type !== "pilot") {
    return jerr("Org is not a pilot account", "not_pilot_org", 409);
  }

  // Reject if the org already converted to a paid subscription (active
  // entitlement on a non-pilot tier). A re-run while still on the pilot is fine
  // — fn_activate_pilot is idempotent.
  const ent = await getActiveEntitlement(orgId);
  if (ent && ent.tier !== PILOT_TIER) {
    return jerr("Org already on a paid plan", "already_paid", 409);
  }

  const pilotEnd = process.env.PILOT_END_DATE || DEFAULT_PILOT_END;

  const { error: rpcErr } = await admin.rpc("fn_activate_pilot", {
    p_org_id: orgId,
    p_pilot_end: pilotEnd,
    p_grace_hours: GRACE_HOURS,
  });
  if (rpcErr) return jerr(rpcErr.message, "pilot_activation_failed", 500);

  // TODO(pilot-emails): trigger the `pilot_welcome` templated email once the
  // OneSignal pilot templates are wired up.

  const redirect = org.slug ? `/portal/${org.slug}/dashboard` : "/portal";
  return NextResponse.json({ ok: true, redirect, pilot_end_date: pilotEnd });
}
