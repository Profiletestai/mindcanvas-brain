import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import type { BrandingRequestBody, BrandingResponse } from "../_lib/types";
import type { PortalOrgUpdate } from "@/types/database.types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body: Partial<BrandingRequestBody> = await req.json().catch(() => ({}));

    const admin = portalAdmin();

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.org_id) {
      return NextResponse.json({ ok: false, error: "No org found for user" }, { status: 404 });
    }

    const updates: PortalOrgUpdate = { last_completed_step: 6 };

    if (body?.primary_colour !== undefined) updates.brand_primary = String(body.primary_colour).trim() || null;
    if (body?.secondary_colour !== undefined) updates.brand_secondary = String(body.secondary_colour).trim() || null;
    if (body?.background_colour !== undefined) updates.brand_background = String(body.background_colour).trim() || null;
    if (body?.text_colour !== undefined) updates.brand_text = String(body.text_colour).trim() || null;

    const { data: org, error } = await admin
      .from("orgs")
      .update(updates)
      .eq("id", membership.org_id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, org });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
