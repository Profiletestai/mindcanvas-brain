import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await getServerSupabase();
    const { data: auth, error: authError } = await sb.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = auth.user;
    const admin = portalAdmin();

    type OrgProgress = { slug: string | null; last_completed_step: number | null };

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id, orgs(slug, last_completed_step)")
      .eq("user_id", user.id)
      .maybeSingle<{ org_id: string; orgs: OrgProgress | null }>();

    if (!membership?.org_id) {
      // No org yet: the client is on step 3 (engines + plan) until a selection
      // has been saved, then step 4 (organisation) creates the org.
      const { data: selection } = await admin
        .from("onboarding_selections")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle<{ user_id: string }>();

      return NextResponse.json({ ok: true, step: selection ? 4 : 3 });
    }

    const org = membership.orgs;
    const last = org?.last_completed_step ?? 0;
    const org_slug = org?.slug ?? null;

    if (last >= 8) {
      return NextResponse.json({ ok: true, step: "complete", org_id: membership.org_id, org_slug });
    }

    return NextResponse.json({ ok: true, step: last + 1, org_id: membership.org_id, org_slug });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
