import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import type { ContactRequestBody } from "../_lib/types";
import type { PortalOrgUpdate } from "@/types/database.types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body: Partial<ContactRequestBody> = await req.json().catch(() => ({}));
    const contact_first_name = String(body?.contact_first_name || "").trim();
    const contact_last_name = String(body?.contact_last_name || "").trim();
    const contact_email = String(body?.contact_email || "").trim().toLowerCase();

    if (!contact_first_name || !contact_last_name || !contact_email) {
      return NextResponse.json(
        { ok: false, error: "contact_first_name, contact_last_name, and contact_email are required" },
        { status: 400 }
      );
    }

    const admin = portalAdmin();

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.org_id) {
      return NextResponse.json({ ok: false, error: "No org found for user" }, { status: 404 });
    }

    const updates: PortalOrgUpdate = {
      primary_contact_first_name: contact_first_name,
      primary_contact_last_name: contact_last_name,
      primary_contact_email: contact_email,
      last_completed_step: 4,
    };

    if (body?.phone_number !== undefined) updates.phone_number = String(body.phone_number).trim() || null;
    if (body?.support_email !== undefined) updates.support_email = String(body.support_email).trim().toLowerCase() || null;
    if (body?.notification_email !== undefined) updates.notification_email = String(body.notification_email).trim().toLowerCase() || null;

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
