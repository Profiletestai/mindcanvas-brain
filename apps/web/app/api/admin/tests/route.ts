//apps/web/app/api/admin/tests/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

type Out = {
  id: string;
  name: string;
  test_type?: string | null;
  is_active?: boolean | null;
};

type TestRow = {
  id?: string | null;
  test_id?: string | null;
  tid?: string | null;
  name?: string | null;
  test_name?: string | null;
  test_type?: string | null;
  type?: string | null;
  mode?: string | null;
  is_active?: boolean | null;
  active?: boolean | null;
  status?: string | null;
  created_at?: string | null;
};

function pickId(row: TestRow): string | null {
  return row?.id ?? row?.test_id ?? row?.tid ?? null;
}

function pickName(row: TestRow): string {
  return row?.name ?? row?.test_name ?? "Untitled test";
}

function toOutput(row: TestRow): Out | null {
  const id = pickId(row);
  if (!id) return null;

  return {
    id,
    name: pickName(row),
    test_type: row?.test_type ?? row?.type ?? row?.mode ?? null,
    is_active:
      row?.is_active ??
      row?.active ??
      (typeof row?.status === "string" ? row.status === "active" : null),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const sb = createClient().schema("portal");

    const { data: billingAccount, error: billingErr } = await sb
      .from("billing_accounts")
      .select("billing_source")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (billingErr) {
      return NextResponse.json({ error: billingErr.message }, { status: 500 });
    }

    const isLegacyBilling = billingAccount?.billing_source === "legacy";

    // Every organisation can use active tests it owns.
    const { data: ownedRows, error: ownedErr } = await sb
      .from("tests")
      .select("id, name, mode, status, org_id, created_at")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (ownedErr) {
      return NextResponse.json({ error: ownedErr.message }, { status: 500 });
    }

    const { data: accessRows, error: accessErr } = await sb
      .from("user_test_access")
      .select("test_id")
      .eq("org_id", orgId);

    if (accessErr) {
      return NextResponse.json({ error: accessErr.message }, { status: 500 });
    }

    const assignedIds = Array.from(
      new Set(
        (accessRows ?? [])
          .map((row: { test_id?: string | null }) => row.test_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let assignedRows: TestRow[] = [];

    if (assignedIds.length > 0) {
      const { data, error } = await sb
        .from("tests")
        .select("id, name, mode, status, org_id, created_at")
        .in("id", assignedIds)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      assignedRows = data ?? [];
    }

    // Modern billing provisions tests through org_test_access. Legacy billing
    // must preserve the organisation's explicit assignments instead of gaining
    // the complete tier bundle.
    let billingAccessRows: TestRow[] = [];

    if (!isLegacyBilling) {
      const { data: orgAccessRows, error: orgAccessErr } = await sb
        .from("org_test_access")
        .select("test_id")
        .eq("org_id", orgId)
        .eq("status", "active");

      if (orgAccessErr) {
        return NextResponse.json(
          { error: orgAccessErr.message },
          { status: 500 },
        );
      }

      const billingAccessIds = Array.from(
        new Set(
          (orgAccessRows ?? [])
            .map((row: { test_id?: string | null }) => row.test_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      if (billingAccessIds.length > 0) {
        const { data, error } = await sb
          .from("tests")
          .select("id, name, mode, status, org_id, created_at")
          .in("id", billingAccessIds)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        billingAccessRows = data ?? [];
      }
    }

    // De-duplicate tests that may be both owned and explicitly assigned.
    const accessibleTests = new Map<string, TestRow>();

    for (const row of [
      ...(ownedRows ?? []),
      ...assignedRows,
      ...billingAccessRows,
    ]) {
      const id = pickId(row);
      if (id && !accessibleTests.has(id)) {
        accessibleTests.set(id, row);
      }
    }

    const out = Array.from(accessibleTests.values())
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .map(toOutput)
      .filter((row): row is Out => row !== null);

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 },
    );
  }
}
