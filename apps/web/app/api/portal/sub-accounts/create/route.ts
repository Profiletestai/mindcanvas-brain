import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { assertOrgOwner } from "@/app/_lib/portal";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import { generateUniqueSlug } from "@/app/api/onboarding/v2/_lib/slug";
import { createSubAccountSchema } from "../_lib/schema";
import { CREATE_RPC_ERRORS, mapRpcError, parseOr400 } from "../_lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const parsed = parseOr400(createSubAccountSchema, raw);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const access = await assertOrgOwner(user.id, data.parent_org_id);
    if (!access.ok)
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status },
      );

    const admin = portalAdmin();

    const requestedSlug =
      typeof data.org_slug === "string" ? data.org_slug : "";
    let org_slug: string;
    if (requestedSlug) {
      const { data: existing } = await admin
        .from("orgs")
        .select("id")
        .eq("slug", requestedSlug)
        .maybeSingle();
      if (existing)
        return NextResponse.json(
          { ok: false, error: "slug_taken" },
          { status: 409 },
        );
      org_slug = requestedSlug;
    } else {
      org_slug = await generateUniqueSlug(data.org_name);
    }

    const { data: childOrgId, error: rpcError } = await admin.rpc(
      "fn_create_sub_org",
      {
        p_caller_user_id: user.id,
        p_parent_org_id: data.parent_org_id,
        p_child_name: data.org_name,
        p_child_slug: org_slug,
        p_country_code: data.country_code,
        p_website: data.website,
        p_industry: data.industry,
        p_payer_mode: data.payer_mode,
        p_tier: 1,
        p_owner_first_name: data.owner_first_name,
        p_owner_last_name: data.owner_last_name,
        p_owner_email: data.owner_email,
        p_owner_phone: data.owner_phone,
      },
    );

    if (rpcError) {
      const mapped = mapRpcError(
        rpcError.message,
        (rpcError as any).code,
        CREATE_RPC_ERRORS,
      );
      if (mapped) return mapped;
      return NextResponse.json(
        { ok: false, error: rpcError.message },
        { status: 500 },
      );
    }

    const status =
      data.payer_mode === "parent_paid" ? "active" : "pending_activation";
    return NextResponse.json(
      { ok: true, child_org_id: childOrgId, org_slug, status },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 },
    );
  }
}
