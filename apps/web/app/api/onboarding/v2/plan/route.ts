import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import type { PlanRequestBody } from "../_lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body: Partial<PlanRequestBody> = await req.json().catch(() => ({}));
    const tier = Number(body?.tier);
    const terms_accepted = body?.terms_accepted === true;
    const privacy_accepted = body?.privacy_accepted === true;

    if (!Number.isInteger(tier) || tier < 1 || tier > 4) {
      return NextResponse.json(
        { ok: false, error: "tier must be an integer between 1 and 4" },
        { status: 400 }
      );
    }

    if (!terms_accepted || !privacy_accepted) {
      return NextResponse.json(
        { ok: false, error: "terms_accepted and privacy_accepted must be true" },
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

    const org_id = membership.org_id;

    // Idempotency: unique constraint only applies when stripe_status = 'active', so query manually
    const { data: existing } = await admin
      .from("billing_accounts")
      .select("id")
      .eq("org_id", org_id)
      .eq("billing_type", "owner")
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("billing_accounts")
        .update({ tier })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await admin.from("billing_accounts").insert({
        org_id,
        billing_type: "owner",
        tier,
        stripe_status: null,
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    const { data: currentOrg } = await admin
      .from("orgs")
      .select("terms_accepted_at, privacy_accepted_at")
      .eq("id", org_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const orgUpdate: Record<string, unknown> = { last_completed_step: 5 };
    if (!currentOrg?.terms_accepted_at) orgUpdate.terms_accepted_at = nowIso;
    if (!currentOrg?.privacy_accepted_at) orgUpdate.privacy_accepted_at = nowIso;

    const { error: orgError } = await admin
      .from("orgs")
      .update(orgUpdate)
      .eq("id", org_id);

    if (orgError) {
      return NextResponse.json({ ok: false, error: orgError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
