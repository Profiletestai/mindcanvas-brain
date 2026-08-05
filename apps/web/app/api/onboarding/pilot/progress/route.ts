// Pilot progress — the v2 handler with the pilot's own terminal step.
//
// The v2 flow now ends at step 9 (payment plus the three closing screens); the
// pilot flow still ends at branding, which writes 6. Sharing the v2 handler
// would leave finished pilot orgs stuck one step short of complete forever.

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PILOT_TERMINAL_STEP = 6;

export async function GET() {
  try {
    const sb = await getServerSupabase();
    const { data: auth, error: authError } = await sb.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = portalAdmin();

    type OrgProgress = { slug: string | null; last_completed_step: number | null };

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id, orgs(slug, last_completed_step)")
      .eq("user_id", auth.user.id)
      .maybeSingle<{ org_id: string; orgs: OrgProgress | null }>();

    if (!membership?.org_id) {
      return NextResponse.json({ ok: true, step: 3 });
    }

    const org = membership.orgs;
    const last = org?.last_completed_step ?? 0;
    const org_slug = org?.slug ?? null;

    if (last >= PILOT_TERMINAL_STEP) {
      return NextResponse.json({
        ok: true,
        step: "complete",
        org_id: membership.org_id,
        org_slug,
      });
    }

    return NextResponse.json({
      ok: true,
      step: last + 1,
      org_id: membership.org_id,
      org_slug,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
