// Pilot contact step — the v2 handler plus the step write it used to do.
//
// In the v2 flow contact details are half of step 5 (the other half is
// payment), so saving them no longer advances the flow. The pilot flow has no
// payment step: saving contact details is the whole of its step, so it records
// the step here instead.

import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../../v2/_lib/auth";
import { PATCH as patchContact } from "../../v2/contact/route";

export const dynamic = "force-dynamic";

const PILOT_CONTACT_STEP = 5;

export async function PATCH(req: Request) {
  const res = await patchContact(req);
  if (res.status !== 200) return res;

  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  const admin = portalAdmin();
  const { data: membership } = await admin
    .from("user_orgs")
    .select("org_id, orgs(last_completed_step)")
    .eq("user_id", user.id)
    .maybeSingle<{
      org_id: string;
      orgs: { last_completed_step: number | null } | null;
    }>();

  if (membership?.org_id) {
    const current = membership.orgs?.last_completed_step ?? 0;
    if (current < PILOT_CONTACT_STEP) {
      await admin
        .from("orgs")
        .update({ last_completed_step: PILOT_CONTACT_STEP })
        .eq("id", membership.org_id);
    }
  }

  return NextResponse.json(await res.json());
}
