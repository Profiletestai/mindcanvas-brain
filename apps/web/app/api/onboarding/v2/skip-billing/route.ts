// POST — proceed through onboarding without paying.
//
// Creating the placeholder org applies the step-3 selection (engines + tier +
// per-engine trial credits) and marks step 4 (billing) done, dropping the
// client onto the organisation step next.
//
// Trial credits alone aren't usable: the portal reads portal.org_test_access to
// decide which tests an org can see and deploy, and that mapping is only written
// by the entitlement trigger on successful payment. So skip also runs
// fn_grant_onboarding_trial_access, which applies the same tier + engine test
// mapping payment would — without an entitlement, so the org stays
// pending_activation and can still upgrade later.
//
// Idempotent: an org already created (e.g. by a cancelled checkout attempt) is
// reused rather than duplicated, and the test-access sync is safe to re-run.

import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { createOnboardingPlaceholderOrg, getOrgRow, resolveOwnerOrgId } from "@/app/_lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

export async function POST() {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;
  const user = auth.user;

  const resolved = await resolveOwnerOrgId(user.id, null);
  let orgId: string;
  if (resolved.ok) {
    orgId = resolved.orgId;
  } else if (resolved.code === "no_owned_org") {
    const created = await createOnboardingPlaceholderOrg(user);
    if (!created.ok) return jerr(created.error, created.code, created.status);
    orgId = created.orgId;
  } else {
    return jerr(resolved.error, resolved.code, resolved.status);
  }

  // Map the selected tier + engine tests onto the org, same as payment does.
  const { error: grantErr } = await portalAdmin().rpc(
    "fn_grant_onboarding_trial_access",
    { p_org_id: orgId }
  );
  if (grantErr) return jerr(grantErr.message, "test_access_grant_failed", 500);

  const org = await getOrgRow(orgId);
  return NextResponse.json({ ok: true, org_slug: org?.slug ?? null });
}
