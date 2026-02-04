// apps/web/app/api/portal-dashboard-v2/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TimelinePoint = { date: string; submissions: number };

type TopByCount = { code: string; name: string; count: number; pct: number };
type TopByAvg = { code: string; name: string; avgPoints: number; n: number };

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

  topProfilesByCount: TopByCount[];
  topProfilesByAvg: TopByAvg[];

  topFrequencyByCount: TopByCount | null;
  topFrequencyByAvg: TopByAvg | null;
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
  taker_id?: string | null; // only present if you updated v_usage_submissions
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

type ProfileLabelRow = {
  test_id: string;
  profile_code: string;
  profile_name: string;
  frequency_code: string | null;
};

type FreqLabelRow = {
  test_id: string;
  frequency_code: string;
  frequency_name: string;
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
      const orgRes = await supa.from("orgs").select("id, slug").eq("slug", orgSlugParam).limit(1);
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

    // 1) Links
    let linksQ = supa
      .from("v_test_links_full")
      .select("id, org_id, test_id, token, name, label, is_active, use_count, max_uses, created_at, expires_at")
      .eq("org_id", orgId);

    if (testId) linksQ = linksQ.eq("test_id", testId);

    const linksRes = await linksQ;
    if (linksRes.error) throw linksRes.error;
    const links = (linksRes.data || []) as LinkFullRow[];

    // 2) Usage in range (include taker_id if your view has it)
    let usageQ = supa
      .from("v_usage_submissions")
      .select(
        "submission_id, taker_id, test_id, test_slug, test_name, link_id, link_token, link_name, org_id, org_slug, created_at"
      )
      .eq("org_id", orgId)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (testId) usageQ = usageQ.eq("test_id", testId);

    const usageRes = await usageQ;
    if (usageRes.error) throw usageRes.error;
    const usage = (usageRes.data || []) as UsageRow[];

    const submissions = usage.length;

    // Unique takers (only if taker_id is present)
    let uniqueTakers: number | null = null;
    const anyTakerId = usage.some((u) => !!u.taker_id);
    if (anyTakerId) {
      const set = new Set<string>();
      for (const u of usage) if (u.taker_id) set.add(u.taker_id);
      uniqueTakers = set.size;
    }

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

    // Per-link counts
    const linkCounts = new Map<string, number>();
    for (const u of usage) {
      if (!u.link_token) continue;
      linkCounts.set(u.link_token, (linkCounts.get(u.link_token) || 0) + 1);
    }

    // 3) Expanded scores in range
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

    // Build label maps per test_id used in this payload
    const testIdsInPlay = new Set<string>();
    for (const l of links) testIdsInPlay.add(l.test_id);

    // Fetch labels for those tests
    const testIdsArr = Array.from(testIdsInPlay);

    const [profilesLblRes, freqsLblRes] = await Promise.all([
      supa
        .from("test_profile_labels")
        .select("test_id, profile_code, profile_name, frequency_code")
        .in("test_id", testIdsArr),
      supa
        .from("test_frequency_labels")
        .select("test_id, frequency_code, frequency_name")
        .in("test_id", testIdsArr),
    ]);

    if (profilesLblRes.error) throw profilesLblRes.error;
    if (freqsLblRes.error) throw freqsLblRes.error;

    const profileLblRows = (profilesLblRes.data || []) as ProfileLabelRow[];
    const freqLblRows = (freqsLblRes.data || []) as FreqLabelRow[];

    const profileNameByTest = new Map<string, Map<string, string>>();
    const freqNameByTest = new Map<string, Map<string, string>>();

    for (const r of profileLblRows) {
      const m = profileNameByTest.get(r.test_id) || new Map<string, string>();
      m.set(r.profile_code, r.profile_name);
      profileNameByTest.set(r.test_id, m);
    }

    for (const r of freqLblRows) {
      const m = freqNameByTest.get(r.test_id) || new Map<string, string>();
      m.set(r.frequency_code, r.frequency_name);
      freqNameByTest.set(r.test_id, m);
    }

    // Aggregate per link + type + code
    type Agg = { sum: number; n: number; subs: Set<string> };
    const agg = new Map<string, Agg>();

    for (const r of expanded) {
      if (!r.link_token) continue;
      const key = `${r.link_token}||${r.test_id}||${r.dimension_type}||${r.dimension_code}`;
      const a = agg.get(key) || { sum: 0, n: 0, subs: new Set<string>() };
      a.sum += Number(r.total_points || 0);
      a.n += 1;
      a.subs.add(r.submission_id);
      agg.set(key, a);
    }

    function labelName(test_id: string, type: "profile" | "frequency", code: string) {
      if (type === "profile") return profileNameByTest.get(test_id)?.get(code) || code;
      return freqNameByTest.get(test_id)?.get(code) || code;
    }

    function topByAvg(linkToken: string, test_id: string, type: "profile" | "frequency", n: number): TopByAvg[] {
      const items: TopByAvg[] = [];
      for (const [k, a] of agg.entries()) {
        const [lt, tid, dt, code] = k.split("||");
        if (lt !== linkToken) continue;
        if (tid !== test_id) continue;
        if (dt !== type) continue;

        const avg = a.n ? a.sum / a.n : 0;
        items.push({
          code,
          name: labelName(test_id, type, code),
          avgPoints: Number.isFinite(avg) ? avg : 0,
          n: a.subs.size,
        });
      }
      items.sort((a, b) => b.avgPoints - a.avgPoints);
      return items.slice(0, n);
    }

    function topByCount(linkToken: string, test_id: string, type: "profile" | "frequency", n: number, totalSubs: number): TopByCount[] {
      const items: TopByCount[] = [];
      for (const [k, a] of agg.entries()) {
        const [lt, tid, dt, code] = k.split("||");
        if (lt !== linkToken) continue;
        if (tid !== test_id) continue;
        if (dt !== type) continue;

        const count = a.subs.size;
        items.push({
          code,
          name: labelName(test_id, type, code),
          count,
          pct: totalSubs > 0 ? count / totalSubs : 0,
        });
      }
      items.sort((a, b) => b.count - a.count);
      return items.slice(0, n);
    }

    const linkRows: LinkRow[] = links
      .map((l) => {
        const testsTaken = linkCounts.get(l.token) || 0;

        const topProfilesByCount = testsTaken ? topByCount(l.token, l.test_id, "profile", 3, testsTaken) : [];
        const topProfilesByAvg = testsTaken ? topByAvg(l.token, l.test_id, "profile", 3) : [];

        const topFreqByCountArr = testsTaken ? topByCount(l.token, l.test_id, "frequency", 1, testsTaken) : [];
        const topFrequencyByCount = topFreqByCountArr[0] || null;

        const topFreqByAvgArr = testsTaken ? topByAvg(l.token, l.test_id, "frequency", 1) : [];
        const topFrequencyByAvg = topFreqByAvgArr[0] || null;

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

          topProfilesByCount,
          topProfilesByAvg,

          topFrequencyByCount,
          topFrequencyByAvg,
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
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}


