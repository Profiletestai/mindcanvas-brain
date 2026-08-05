import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { contactSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import type { PortalOrgUpdate } from "@/types/database.types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const {
      contact_first_name,
      contact_last_name,
      contact_email,
      phone_number,
      support_email,
      notification_email,
    } = parsed.data;

    const admin = portalAdmin();

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.org_id) {
      return NextResponse.json({ ok: false, error: "No org found for user" }, { status: 404 });
    }

    // Step 5 is contact details *and* payment: it is only marked complete once
    // Stripe confirms, via POST /api/onboarding/v2/step. Saving contact
    // details on their own must not advance the flow past checkout.
    const updates: PortalOrgUpdate = {
      primary_contact_first_name: contact_first_name,
      primary_contact_last_name: contact_last_name,
      primary_contact_email: contact_email,
    };

    updates.phone_number = phone_number ?? null;
    updates.support_email = support_email ?? null;
    updates.notification_email = notification_email ?? null;

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
