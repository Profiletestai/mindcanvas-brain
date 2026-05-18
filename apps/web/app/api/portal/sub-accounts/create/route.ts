import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { assertOrgOwner } from "@/app/_lib/portal";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import { generateUniqueSlug } from "@/app/api/onboarding/v2/_lib/slug";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9_]{2,60}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateBody = {
  parent_org_id?: string;
  org_name?: string;
  org_slug?: string;
  country_code?: string;
  website?: string | null;
  industry?: string | null;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_email?: string;
  owner_phone?: string | null;
  payer_mode?: "parent_paid" | "self_paid";
  tier?: number;
};

function badRequest(error: string, field?: string) {
  return NextResponse.json({ ok: false, error, field }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body = (await req.json().catch(() => ({}))) as CreateBody;

    const parent_org_id = String(body.parent_org_id || "").trim();
    if (!UUID_RE.test(parent_org_id))
      return badRequest("parent_org_id must be a UUID", "parent_org_id");

    const org_name = String(body.org_name || "").trim();
    if (!org_name || org_name.length > 200)
      return badRequest("org_name is required (1-200 chars)", "org_name");

    const country_code = String(body.country_code || "").trim();
    if (!country_code) return badRequest("country_code is required", "country_code");

    const owner_first_name = String(body.owner_first_name || "").trim();
    if (!owner_first_name)
      return badRequest("owner_first_name is required", "owner_first_name");
    const owner_last_name = String(body.owner_last_name || "").trim();
    if (!owner_last_name)
      return badRequest("owner_last_name is required", "owner_last_name");

    const owner_email = String(body.owner_email || "").trim();
    if (!EMAIL_RE.test(owner_email))
      return badRequest("owner_email must be a valid email", "owner_email");

    const payer_mode = body.payer_mode;
    if (payer_mode !== "parent_paid" && payer_mode !== "self_paid")
      return badRequest(
        "payer_mode must be 'parent_paid' or 'self_paid'",
        "payer_mode"
      );

    if (body.tier !== 1) return badRequest("tier must be 1 in v1", "tier");

    let website: string | null = null;
    const rawWebsite =
      typeof body.website === "string" ? body.website.trim() : "";
    if (rawWebsite) {
      try {
        const u = new URL(rawWebsite);
        if (u.protocol !== "http:" && u.protocol !== "https:")
          return badRequest("website must be http(s) URL", "website");
        website = u.toString();
      } catch {
        return badRequest("website is not a valid URL", "website");
      }
    }

    const industry =
      typeof body.industry === "string" && body.industry.trim()
        ? body.industry.trim()
        : null;
    const owner_phone =
      typeof body.owner_phone === "string" && body.owner_phone.trim()
        ? body.owner_phone.trim()
        : null;

    // AuthZ: caller must be org_owner of parent_org_id (or superadmin)
    const access = await assertOrgOwner(user.id, parent_org_id);
    if (!access.ok)
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );

    const admin = portalAdmin();

    // Resolve slug
    let org_slug: string;
    const rawSlug =
      typeof body.org_slug === "string" ? body.org_slug.trim().toLowerCase() : "";
    if (rawSlug) {
      if (!SLUG_RE.test(rawSlug))
        return badRequest(
          "org_slug must match /^[a-z0-9_]{2,60}$/",
          "org_slug"
        );
      const { data: existing } = await admin
        .from("orgs")
        .select("id")
        .eq("slug", rawSlug)
        .maybeSingle();
      if (existing)
        return NextResponse.json(
          { ok: false, error: "slug_taken" },
          { status: 409 }
        );
      org_slug = rawSlug;
    } else {
      org_slug = await generateUniqueSlug(org_name);
    }

    const { data: childOrgId, error: rpcError } = await admin.rpc(
      "fn_create_sub_org",
      {
        p_caller_user_id: user.id,
        p_parent_org_id: parent_org_id,
        p_child_name: org_name,
        p_child_slug: org_slug,
        p_country_code: country_code,
        p_website: website,
        p_industry: industry,
        p_payer_mode: payer_mode,
        p_tier: 1,
        p_owner_first_name: owner_first_name,
        p_owner_last_name: owner_last_name,
        p_owner_email: owner_email,
        p_owner_phone: owner_phone,
      }
    );

    if (rpcError) {
      const msg = rpcError.message || "";
      if (msg.includes("parent_not_found"))
        return NextResponse.json(
          { ok: false, error: "parent_not_found" },
          { status: 404 }
        );
      if (msg.includes("parent_archived"))
        return NextResponse.json(
          { ok: false, error: "parent_archived" },
          { status: 409 }
        );
      if (msg.includes("tier_unavailable"))
        return NextResponse.json(
          { ok: false, error: "tier_definition_missing" },
          { status: 500 }
        );
      if (msg.includes("invalid_payer_mode"))
        return badRequest("invalid_payer_mode", "payer_mode");
      // unique_violation on slug (race after the pre-check)
      if ((rpcError as any).code === "23505")
        return NextResponse.json(
          { ok: false, error: "slug_taken" },
          { status: 409 }
        );
      return NextResponse.json(
        { ok: false, error: rpcError.message },
        { status: 500 }
      );
    }

    const status = payer_mode === "parent_paid" ? "active" : "pending_activation";
    return NextResponse.json(
      { ok: true, child_org_id: childOrgId, org_slug, status },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
