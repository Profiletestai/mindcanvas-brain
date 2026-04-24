import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { generateUniqueSlug } from "../_lib/slug";
import type { CreateOrgRequestBody } from "../_lib/types";
import type { PortalOrg } from "@/types/database.types";

type OrgRef = { id: string; slug: string | null; name: string | null };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body: Partial<CreateOrgRequestBody> = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const country = String(body?.country || "").trim();
    const billing_region = String(body?.billing_region || "").trim();

    if (!name || !country || !billing_region) {
      return NextResponse.json(
        { ok: false, error: "name, country, and billing_region are required" },
        { status: 400 }
      );
    }

    let website_url: string | null = null;
    const rawWebsite = typeof body?.website_url === "string" ? body.website_url.trim() : "";
    if (rawWebsite) {
      try {
        const u = new URL(rawWebsite);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return NextResponse.json(
            { ok: false, error: "website_url must be http(s) URL" },
            { status: 400 }
          );
        }
        website_url = u.toString();
      } catch {
        return NextResponse.json(
          { ok: false, error: "website_url is not a valid URL" },
          { status: 400 }
        );
      }
    }

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
      p_address: body?.address || null,
      p_country: country,
      p_billing_region: billing_region,
      p_website_url: website_url,
      p_industry: body?.industry || null,
      p_logo_url: body?.logo_url || null,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 });
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
