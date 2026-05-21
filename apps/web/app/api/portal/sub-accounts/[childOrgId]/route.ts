import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { assertOrgOwner } from "@/app/_lib/portal";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import { patchSubAccountSchema, uuidWithMsg } from "../_lib/schema";
import { PATCH_RPC_ERRORS, mapRpcError, parseOr400 } from "../_lib/errors";

export const dynamic = "force-dynamic";

const childOrgIdSchema = uuidWithMsg("childOrgId must be a UUID");

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ childOrgId: string }> },
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { childOrgId } = await ctx.params;
    const idParsed = childOrgIdSchema.safeParse(childOrgId);
    if (!idParsed.success)
      return NextResponse.json(
        { ok: false, error: idParsed.error.issues[0].message },
        { status: 400 },
      );

    const raw = await req.json().catch(() => ({}));
    const parsed = parseOr400(patchSubAccountSchema, raw);
    if (!parsed.ok) return parsed.response;
    const { action } = parsed.data;

    const admin = portalAdmin();

    const { data: rel, error: relError } = await admin
      .from("org_relationships")
      .select("parent_org_id")
      .eq("child_org_id", childOrgId)
      .eq("relationship_type", "licensee")
      .maybeSingle<{ parent_org_id: string }>();

    if (relError)
      return NextResponse.json(
        { ok: false, error: relError.message },
        { status: 500 },
      );
    if (!rel)
      return NextResponse.json(
        { ok: false, error: "child_not_found" },
        { status: 404 },
      );

    const access = await assertOrgOwner(user.id, rel.parent_org_id);
    if (!access.ok)
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status },
      );

    const { data: newStatus, error: rpcError } = await admin.rpc(
      "fn_update_sub_org_status",
      {
        p_caller_user_id: user.id,
        p_child_org_id: childOrgId,
        p_action: action,
      },
    );

    if (rpcError) {
      const mapped = mapRpcError(
        rpcError.message,
        (rpcError as any).code,
        PATCH_RPC_ERRORS,
      );
      if (mapped) return mapped;
      return NextResponse.json(
        { ok: false, error: rpcError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      child_org_id: childOrgId,
      status: newStatus,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 },
    );
  }
}
