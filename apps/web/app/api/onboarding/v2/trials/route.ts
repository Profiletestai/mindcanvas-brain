// GET — per-engine trial allocation for the caller's org.
// Backs the "Trial tests included" row on the confirmation screen and the
// remaining-credits strip on the portal usage page.

import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import type { EngineTrialSummary } from "../_lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const admin = portalAdmin();

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle<{ org_id: string }>();

    if (!membership?.org_id) {
      return NextResponse.json({ ok: false, error: "No org found for user" }, { status: 404 });
    }

    const { data, error } = await admin.rpc("fn_engine_trial_summary", {
      p_org_id: membership.org_id,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // The function returns no row when the org has no allocations at all.
    const summary = (data ?? {
      ok: true,
      engines: [],
      total_allocated: 0,
      total_remaining: 0,
    }) as EngineTrialSummary;

    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
