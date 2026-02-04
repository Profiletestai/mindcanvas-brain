// apps/web/app/api/portal-dashboard-v2/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TimelinePoint = { date: string; submissions: number };

type TopItem = {
  code: string;
  name: string;
  avgPoints: number;
  submissions: number;
};

type LinkRow = {
  linkId: string;
  token: string;
  name: string | null;
  label: string | null;
  isActive: boolean | null;
  createdAt: string;
  expiresAt: string | null;
  useCount: number;
  maxUses: number | null;

  testsTaken: number;
  topProfiles: TopItem[];
  topFrequency: TopItem | null;
};

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "portal" } });
}

function parseDateParam(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function ymd(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampRange(from: Date | null, to: Date | null) {
  const now = new Date();
  const toD = to ?? now;
  const fromD =
    from ??
    new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth(), toD.getUTCDate() - 30));
  if (fromD > toD) return { from: toD, to: fromD };
  return { from: fromD, to: toD };
}

function isLinkActive(row: {
  is_active?: boolean | null;
  expires_at?: string | null;
  max_uses?: number | null;
  use_count?: number | null;
}) {
  const activeFlag = row.is_active ?? true;
  if (!activeFlag) return false;

  if (row.expires_at) {
    const exp = new Date(row.expires_at);
    if (Number.isFinite(exp.getTime()) && exp.getTime() <= Date.now()) return false;
  }

  const max = row.max_uses ?? null;
  const used = row.use_count ?? 0;
  if (max != null && used >= max) return false;

  return true;
}

type OrgRow = { id: string; slug: string };

type UsageRow = {
  submission_id: string;
  test_id: string;
  test_slug: string | null;
  test_name: string | null;
  link_id: string | null;
  link_token: string | null;
  link_name: string | null;
  org_id: string;
  org_slug: string | null;
  created_at: string;
};

type LinkFullRow = {
  id: string;
  org_id: string;
  test_id: string;
  token: string;
  name: string | null;
  label: string | null;
  is_active: boolean | null;
  use_count: number;
  max_uses: number | null;
  created_at: string;
  expires_at: string | null;
};

type ExpandedRow = {
  org_id: string;
  test_id: string;
  link_token: string | null;
  submission_id: string;
  created_at: string;
  dimension_type: "profile" | "frequency";
  dimension_code: string;
  dimension_name: string;
  total_points: number;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const orgIdParam = url.searchParams.get("orgId")?.trim() || "";
    const orgSlugParam = url.searchParams.get("org")?.trim() || "";
    const testId = url.searchParams.get("testId")?.trim() || null;

    const supa = supaAdmin();

    // Resolve org_id
    let orgId = orgIdParam;

    if (!orgId && orgSlugParam) {
      const orgRes = await supa
        .from("orgs")
        .select("id, slug")
        .eq("slug", orgSlugParam)
        .limit(1);

      if (orgRes.error) throw orgRes.error;
      const row = (orgRes.data?.[0] || null) as OrgRow | null;
      if (!row) {
        return NextResponse.json(
          { ok: false, error: `Unknown org slug: ${orgSlugParam}` },
          { status: 404 }
        );
      }
      orgId = row.id;
    }

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Missing orgId (or org slug via ?org=...)" },
        { status: 400 }
      );
    }

    const fromQ = parseDateParam(url.searchParams.get("from"));
    const toQ = parseDateParam(url.searchParams.get("to"));
    const { from, to } = clampRange(fromQ, toQ);

    // 1) Links (meta/status)
    let linksQ = supa
      .from("v_test_links_full")
      .select("id, org_id, test_id, token, name, label, is_active, use_count, max_uses, created_at, expires_at")
      .eq("org_id", orgId);

    if (testId) linksQ = linksQ.eq("test_id", testId);

    const linksRes = await linksQ;
    if (linksRes.error) throw linksRes.error;

    const links = (linksRes.data || []) as LinkFullRow[];

    // 2) Usage in range
    let usageQ = supa
      .from("v_usage_submissions")
      .select(
        "submission_id, test_id, test_slug, test_name, link_id, link_token, link_name, org_id, org_slug, created_at"
      )
      .eq("org_id", orgId)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (testId) usageQ = usageQ.eq("test_id", testId);

    const usageRes = await usageQ;
    if (usageRes.error) throw usageRes.error;

    const usage = (usageRes.data || []) as UsageRow[];

    const submissions = usage.length;

    // Optional KPI: unique takers (not available in v_usage_submissions yet)
    const uniqueTakers = null as number | null;

    const activeLinks = links.filter((l) =>
      isLinkActive({
        is_active: l.is_active,
        expires_at: l.expires_at,
        max_uses: l.max_uses,
        use_count: l.use_count,
      })
    ).length;

    // Timeline (daily)
    const timelineMap = new Map<string, number>();
    for (const u of usage) {
      const d = ymd(new Date(u.created_at));
      timelineMap.set(d, (timelineMap.get(d) || 0) + 1);
    }
    const timeline: TimelinePoint[] = Array.from(timelineMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, submissions]) => ({ date, submissions }));

    // Per-link submission counts
    const linkCounts = new Map<string, number>();
    for (const u of usage) {
      if (!u.link_token) continue;
      linkCounts.set(u.link_token, (linkCounts.get(u.link_token) || 0) + 1);
    }

    // 3) Expanded scores in range (profiles + frequencies)
    let expQ = supa
      .from("v_submission_scores_expanded_submissions")
      .select(
        "org_id, test_id, link_token, submission_id, created_at, dimension_type, dimension_code, dimension_name, total_points"
      )
      .eq("org_id", orgId)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (testId) expQ = expQ.eq("test_id", testId);

    const expRes = await expQ;
    if (expRes.error) throw expRes.error;

    const expanded = (expRes.data || []) as ExpandedRow[];

    // Aggregate avg points per link + type + code
    type Agg = { sum: number; n: number; name: string; submissions: Set<string> };
    const agg = new Map<string, Agg>();

    for (const r of expanded) {
      if (!r.link_token) continue;
      const key = `${r.link_token}||${r.dimension_type}||${r.dimension_code}`;
      const existing = agg.get(key) || { sum: 0, n: 0, name: r.dimension_name, submissions: new Set<string>() };
      existing.sum += Number(r.total_points || 0);
      existing.n += 1;
      existing.name = r.dimension_name || existing.name;
      existing.submissions.add(r.submission_id);
      agg.set(key, existing);
    }

    function topNForLink(linkToken: string, type: "profile" | "frequency", n: number): TopItem[] {
      const items: TopItem[] = [];
      for (const [k, a] of agg.entries()) {
        const [lt, dt, code] = k.split("||");
        if (lt !== linkToken) continue;
        if (dt !== type) continue;
        const avgPoints = a.n ? a.sum / a.n : 0;
        items.push({
          code,
          name: a.name,
          avgPoints: Number.isFinite(avgPoints) ? avgPoints : 0,
          submissions: a.submissions.size,
        });
      }
      items.sort((a, b) => b.avgPoints - a.avgPoints);
      return items.slice(0, n);
    }

    const linkRows: LinkRow[] = links
      .map((l) => {
        const testsTaken = linkCounts.get(l.token) || 0;
        const topProfiles = testsTaken > 0 ? topNForLink(l.token, "profile", 3) : [];
        const topFreqArr = testsTaken > 0 ? topNForLink(l.token, "frequency", 1) : [];
        const topFrequency = topFreqArr[0] || null;

        return {
          linkId: l.id,
          token: l.token,
          name: l.name ?? null,
          label: l.label ?? null,
          isActive: l.is_active ?? null,
          createdAt: l.created_at,
          expiresAt: l.expires_at ?? null,
          useCount: l.use_count ?? 0,
          maxUses: l.max_uses ?? null,
          testsTaken,
          topProfiles,
          topFrequency,
        };
      })
      .sort((a, b) => b.testsTaken - a.testsTaken);

    return NextResponse.json({
      ok: true,
      filters: {
        orgId,
        org: orgSlugParam || null,
        testId,
        from: toIso(from),
        to: toIso(to),
      },
      kpis: {
        submissions,
        uniqueTakers,
        activeLinks,
      },
      timeline,
      links: linkRows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

