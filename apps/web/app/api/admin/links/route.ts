// apps/web/app/api/admin/links/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";
import { normalizeReportVariant } from "@/lib/links/normalize";
import { requireOrgAccess } from "@/lib/server/orgAccess";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    // Otherwise any caller could list another organisation's links by id.
    const access = await requireOrgAccess(orgId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const sb = createClient().schema("portal");

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
          "hidden_results_message",
          "use_count",
          "max_uses",
          "meta",
        ].join(",")
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    const safeLinks = links ?? [];

    const testIds = Array.from(
      new Set(safeLinks.map((r: any) => r.test_id).filter(Boolean))
    );

    let nameById: Record<string, string> = {};
    if (testIds.length) {
      const { data: tests, error: testErr } = await sb
        .from("tests")
        .select("id, name")
        .in("id", testIds);

      if (testErr) {
        return NextResponse.json({ error: testErr.message }, { status: 500 });
      }

      for (const t of tests ?? []) {
        nameById[t.id] = t.name ?? "Untitled test";
      }
    }

    const tokens = safeLinks.map((r: any) => r.token).filter(Boolean);
    const usesByToken: Record<string, number> = {};

    if (tokens.length) {
      const { data: subs, error: subsErr } = await sb
        .from("test_submissions")
        .select("id, link_token")
        .in("link_token", tokens);

      if (subsErr) {
        return NextResponse.json({ error: subsErr.message }, { status: 500 });
      }

      for (const s of subs ?? []) {
        const t = (s as any).link_token;
        if (!t) continue;
        usesByToken[t] = (usesByToken[t] || 0) + 1;
      }
    }

    const rows = safeLinks.map((r: any) => ({
      id: r.id,
      token: r.token,
      created_at: r.created_at,
      show_results: r.show_results,
      is_active: r.is_active,
      expires_at: r.expires_at,

      link_name: r.name || null,

      test_name: nameById[r.test_id] || "Untitled test",
      test_id: r.test_id,

      contact_owner: r.contact_owner || null,
      email_report: !!r.email_report,

      redirect_url: r.redirect_url || null,
      next_steps_url: r.next_steps_url || null,
      hidden_results_message: r.hidden_results_message || null,

      use_count:
        typeof usesByToken[r.token] === "number"
          ? usesByToken[r.token]
          : typeof r.use_count === "number"
          ? r.use_count
          : 0,

      max_uses: r.max_uses ?? null,

      report_variant: normalizeReportVariant(r?.meta?.report_variant),
    }));

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}