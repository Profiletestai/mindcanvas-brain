// apps/web/app/api/admin/org-rankings/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function parseISO(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Supabase env not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const fromQ = parseISO(url.searchParams.get("from"));
    const toQ = parseISO(url.searchParams.get("to"));
    const { from: defFrom, to: defTo } = defaultRange();
    const from = fromQ ?? defFrom;
    const to = toQ ?? defTo;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "portal" } });
    const portal = sb.schema("portal");

    // 1) Orgs
    const { data: orgs, error: orgErr } = await portal.from("orgs").select("id, slug, name");
    if (orgErr) return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });

    const orgById = new Map<string, { id: string; slug: string; name: string | null }>();
    (orgs ?? []).forEach((o: any) => orgById.set(o.id, o));

    // 2) Submissions in range (use v_usage_submissions for org_id + created_at)
    const { data: subs, error: subsErr } = await portal
      .from("v_usage_submissions")
      .select("org_id, created_at")
      .gte("created_at", from)
      .lte("created_at", to);

    if (subsErr) return NextResponse.json({ ok: false, error: subsErr.message }, { status: 500 });

    // 3) Unique takers in range (test_submissions -> tests to get org_id)
    const { data: takerRows, error: takerErr } = await portal
      .from("test_submissions")
      .select("taker_id, created_at, tests!inner(org_id)")
      .gte("created_at", from)
      .lte("created_at", to);

    if (takerErr) return NextResponse.json({ ok: false, error: takerErr.message }, { status: 500 });

    // 4) Active links (current state, not date-range usage)
    const nowIso = new Date().toISOString();
    const { data: links, error: linksErr } = await portal
      .from("test_links")
      .select("org_id, is_active, expires_at");

    if (linksErr) return NextResponse.json({ ok: false, error: linksErr.message }, { status: 500 });

    // 5) Growth: last 7 vs previous 7 within range window
    // We’ll compute based on submission created_at.
    const end = new Date(to);
    const last7Start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const prev7Start = new Date(end.getTime() - 14 * 24 * 3600 * 1000);

    // Aggregate
    const agg = new Map<
      string,
      { submissions: number; uniqueTakers: Set<string>; activeLinks: number; last7: number; prev7: number }
    >();

    function ensure(orgId: string) {
      if (!agg.has(orgId)) agg.set(orgId, { submissions: 0, uniqueTakers: new Set(), activeLinks: 0, last7: 0, prev7: 0 });
      return agg.get(orgId)!;
    }

    for (const r of subs ?? []) {
      const orgId = (r as any).org_id as string;
      if (!orgId) continue;
      const a = ensure(orgId);
      a.submissions += 1;

      const d = new Date((r as any).created_at);
      if (d >= last7Start && d <= end) a.last7 += 1;
      else if (d >= prev7Start && d < last7Start) a.prev7 += 1;
    }

    for (const r of takerRows ?? []) {
      const orgId = (r as any)?.tests?.org_id as string | undefined;
      const takerId = (r as any)?.taker_id as string | undefined;
      if (!orgId || !takerId) continue;
      const a = ensure(orgId);
      a.uniqueTakers.add(takerId);
    }

    for (const l of links ?? []) {
      const orgId = (l as any).org_id as string;
      if (!orgId) continue;
      const isActive = (l as any).is_active !== false;
      const expiresAt = (l as any).expires_at as string | null;
      const notExpired = !expiresAt || expiresAt > nowIso;

      if (isActive && notExpired) {
        const a = ensure(orgId);
        a.activeLinks += 1;
      }
    }

    const rows = Array.from(orgById.values()).map((o) => {
      const a = agg.get(o.id) ?? { submissions: 0, uniqueTakers: new Set<string>(), activeLinks: 0, last7: 0, prev7: 0 };
      const prev = a.prev7;
      const last = a.last7;
      const growth = prev === 0 ? (last > 0 ? 1 : 0) : (last - prev) / prev;

      return {
       orgId: o.id,
       slug: o.slug,
       name: o.name,
       submissions: a.submissions,
       uniqueTakers: a.uniqueTakers.size,
       activeLinks: a.activeLinks,
       last7: last,
       prev7: prev,
       growth,
     };
    });

    rows.sort((a, b) => b.submissions - a.submissions);

    return NextResponse.json({ ok: true, filters: { from, to }, orgs: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
