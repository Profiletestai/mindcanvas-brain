// apps/web/app/api/admin/links/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    if (!orgId)
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const sb = createClient().schema("portal");

    // 1) Recent links for this org (include fields we need for the table)
    const { data: links, error: linkErr } = await sb
      .from("test_links")
      .select(
        [
          "id",
          "token",
          "created_at",
          "show_results",
          "is_active",
          "expires_at",
          "name",
          "contact_owner",
          "email_report",
          "test_id",
          "org_id",
          "redirect_url",
          "next_steps_url",
          "use_count",
          "max_uses",
        ].join(",")
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (linkErr)
      return NextResponse.json({ error: linkErr.message }, { status: 500 });

    // 2) Fetch actual test names for those test_ids
    const testIds = Array.from(
      new Set((links ?? []).map((r: any) => r.test_id).filter(Boolean))
    );

    let nameById: Record<string, string> = {};
    if (testIds.length) {
      const { data: tests, error: testErr } = await sb
        .from("tests")
        .select("id, name")
        .in("id", testIds);

      if (testErr)
        return NextResponse.json({ error: testErr.message }, { status: 500 });

      for (const t of tests ?? []) {
        nameById[t.id] = t.name ?? "Untitled test";
      }
    }

    // 3) Shape response
    const rows = (links ?? []).map((r: any) => ({
      id: r.id,
      token: r.token,
      created_at: r.created_at,
      show_results: r.show_results,
      is_active: r.is_active,
      expires_at: r.expires_at,

      // Your "purpose/name" saved on the link
      link_name: r.name || null,

      // Actual test name from portal.tests.name
      test_name: nameById[r.test_id] || "Untitled test",
      test_id: r.test_id,

      contact_owner: r.contact_owner || null,
      email_report: !!r.email_report,

      redirect_url: r.redirect_url || null,
      next_steps_url: r.next_steps_url || null,

      use_count: typeof r.use_count === "number" ? r.use_count : 0,
      max_uses: r.max_uses ?? null,
    }));

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

