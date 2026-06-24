import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { generateUniqueSlug } from "../_lib/slug";
import { orgSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import type { PortalOrg } from "@/types/database.types";

type OrgRef = { id: string; slug: string | null; name: string | null };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const parsed = orgSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, country, address, industry, logo_url } = parsed.data;
    const website_url = parsed.data.website_url ?? null;

    const admin = portalAdmin();

    // Idempotency: return existing org if user already has one
    const { data: existing } = await admin
      .from("user_orgs")
      .select("org_id, orgs(id, slug, name)")
      .eq("user_id", user.id)
      .maybeSingle<{ org_id: string; orgs: OrgRef | null }>();

    if (existing?.org_id) {
      const org = existing.orgs;
      return NextResponse.json({
        ok: true,
        org: { id: existing.org_id, slug: org?.slug ?? null, name: org?.name ?? null },
      });
    }

    const slug = await generateUniqueSlug(name);

    const { data: orgId, error: rpcError } = await admin.rpc("fn_create_onboarding_org", {
      p_user_id: user.id,
      p_name: name,
      p_slug: slug,
      p_address: address ?? null,
      p_country: country,
      p_billing_region: null,
      p_website_url: website_url,
      p_industry: industry ?? null,
      p_logo_url: logo_url ?? null,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const { error: consentError } = await admin
      .from("orgs")
      .update({ terms_accepted_at: nowIso, privacy_accepted_at: nowIso })
      .eq("id", orgId);
    if (consentError) {
      console.error("[onboarding/org] consent timestamps update failed", consentError);
    }

    return NextResponse.json({ ok: true, org: { id: orgId, slug, name } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { data } = await portalAdmin()
      .from("user_orgs")
      .select("org_id, orgs(*)")
      .eq("user_id", user.id)
      .maybeSingle<{ org_id: string; orgs: PortalOrg | null }>();

    if (!data?.org_id) {
      return NextResponse.json({ ok: true, org: null });
    }

    return NextResponse.json({ ok: true, org: data.orgs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
