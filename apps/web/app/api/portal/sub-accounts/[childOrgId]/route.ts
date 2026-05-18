import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { assertOrgOwner } from "@/app/_lib/portal";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PatchBody = { action?: "suspend" | "reactivate" | "archive" };

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ childOrgId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { childOrgId } = await ctx.params;
    if (!UUID_RE.test(childOrgId))
      return NextResponse.json(
        { ok: false, error: "childOrgId must be a UUID" },
        { status: 400 }
      );

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const action = body.action;
    if (action !== "suspend" && action !== "reactivate" && action !== "archive")
      return NextResponse.json(
        {
          ok: false,
          error: "action must be 'suspend', 'reactivate', or 'archive'",
          field: "action",
        },
        { status: 400 }
      );

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
        { status: 500 }
      );
    if (!rel)
      return NextResponse.json(
        { ok: false, error: "child_not_found" },
        { status: 404 }
      );

    const access = await assertOrgOwner(user.id, rel.parent_org_id);
    if (!access.ok)
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );

    const { data: newStatus, error: rpcError } = await admin.rpc(
      "fn_update_sub_org_status",
      {
        p_caller_user_id: user.id,
        p_child_org_id: childOrgId,
        p_action: action,
      }
    );

    if (rpcError) {
      const msg = rpcError.message || "";
      if (msg.includes("invalid_transition"))
        return NextResponse.json(
          { ok: false, error: "invalid_transition" },
          { status: 409 }
        );
      if (msg.includes("child_not_found"))
        return NextResponse.json(
          { ok: false, error: "child_not_found" },
          { status: 404 }
        );
      if (msg.includes("invalid_action"))
        return NextResponse.json(
          { ok: false, error: "invalid_action", field: "action" },
          { status: 400 }
        );
      return NextResponse.json(
        { ok: false, error: rpcError.message },
        { status: 500 }
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
      { status: 500 }
    );
  }
}
