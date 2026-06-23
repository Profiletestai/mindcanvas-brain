import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

type Out = { id: string; name: string; test_type?: string | null; is_active?: boolean | null };

function pickId(row: any): string | null {
  return row?.id ?? row?.test_id ?? row?.tid ?? null;
}
function pickName(row: any): string {
  return row?.name ?? row?.test_name ?? "Untitled test";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const sb = createClient().schema("portal");

    // Tests granted to this org via billing (portal.org_test_access).
    // Tests live in template orgs; access is the source of truth per-org.
    let rows: any[] = [];
    {
      const { data: accessRows, error: accessErr } = await sb
        .from("org_test_access")
        .select("test_id")
        .eq("org_id", orgId)
        .eq("status", "active");

      if (accessErr) return NextResponse.json({ error: accessErr.message }, { status: 500 });

      const ids = (accessRows ?? []).map((r: any) => r.test_id).filter(Boolean);

      if (ids.length) {
        const { data: testRows, error: testsErr } = await sb
          .from("tests")
          .select("id, name, mode, status, org_id, created_at")
          .in("id", ids)
          .order("created_at", { ascending: false });

        if (testsErr) return NextResponse.json({ error: testsErr.message }, { status: 500 });
        rows = testRows ?? [];
      }
    }

    // Legacy fallback: org owns its own test rows (pre-billing-access model).
    if (!rows.length) {
      const { data, error } = await sb
        .from("tests")
        .select("id, name, mode, status, org_id, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows = data ?? [];
    }

    const out: Out[] = (rows || [])
      .map((r: any) => {
        const id = pickId(r);
        if (!id) return null;
        return {
          id,
          name: pickName(r),
          test_type: r?.test_type ?? r?.type ?? r?.mode ?? null,
          is_active:
            r?.is_active ??
            r?.active ??
            (typeof r?.status === "string" ? r.status === "active" : null),
        };
      })
      .filter(Boolean) as Out[];

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
