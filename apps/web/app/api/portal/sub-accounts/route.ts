import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { assertOrgOwner } from "@/app/_lib/portal";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_STATUS = new Set([
  "active",
  "suspended",
  "archived",
  "pending_activation",
]);

type RelationshipRow = {
  status: string;
  payer_mode: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  created_by_user_id: string | null;
  created_at: string;
  child:
    | {
        id: string;
        name: string | null;
        slug: string | null;
        status: string | null;
      }
    | null;
};

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const url = new URL(req.url);
    const parentOrgId = url.searchParams.get("parentOrgId")?.trim() ?? "";
    if (!UUID_RE.test(parentOrgId))
      return NextResponse.json(
        { ok: false, error: "parentOrgId must be a UUID" },
        { status: 400 }
      );

    const access = await assertOrgOwner(user.id, parentOrgId);
    if (!access.ok)
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );

    const statusParam = url.searchParams.get("status")?.trim() || "";
    const statusFilter = statusParam
      ? statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => ALLOWED_STATUS.has(s))
      : null;

    const admin = portalAdmin();
    let q = admin
      .from("org_relationships")
      .select(
        `status, payer_mode, owner_first_name, owner_last_name, owner_email,
         owner_phone, created_by_user_id, created_at,
         child:orgs!child_org_id(id, name, slug, status)`
      )
      .eq("parent_org_id", parentOrgId)
      .eq("relationship_type", "licensee")
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter.length > 0) {
      q = q.in("status", statusFilter);
    }

    const { data, error } = await q;
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );

    const rows = ((data ?? []) as unknown as RelationshipRow[])
      .filter((r) => r.child?.id)
      .map((r) => ({
        child_org_id: r.child!.id,
        name: r.child!.name,
        slug: r.child!.slug,
        org_status: r.child!.status,
        relationship_status: r.status,
        payer_mode: r.payer_mode,
        owner_email: r.owner_email,
        owner_first_name: r.owner_first_name,
        owner_last_name: r.owner_last_name,
        owner_phone: r.owner_phone,
        created_by_user_id: r.created_by_user_id,
        created_at: r.created_at,
      }));

    return NextResponse.json({ ok: true, items: rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
