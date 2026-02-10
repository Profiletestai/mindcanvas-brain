// apps/web/app/api/portal-dashboard-v2/segments/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TopByCount = { code: string; name: string; count: number; pct: number };
type TopByAvg = { code: string; name: string; avgPoints: number; n: number };

type CompanySeg = { company: string; testsTaken: number; pct: number };
type PurposeSeg = { purpose: string; testsTaken: number; pct: number };

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

function clampRange(from: Date | null, to: Date | null) {
  const now = new Date();
  const toD = to ?? now;
  const fromD =
    from ??
    new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth(), toD.getUTCDate() - 30));
  if (fromD > toD) return { from: toD, to: fromD };
  return { from: fromD, to: toD };
}

type OrgRow = { id: string; slug: string };

type TestRow = { id: string };

type LinkFullRow = {
  id: string;
  org_id: string;
  test_id: string;
  token: string;
  name: string | null;
  label: string | null;
};

type UsageRow = {
  submission_id: string;
  test_id: string;
  link_token: string | null;
  created_at: string;
  org_id: string;
};

type SubmissionRow = {
  test_id: string;
  link_token: string;
  created_at: string;
  company: string | null;
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
    const testIdParam = url.searchParams.get("testId")?.trim() || null;

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

    // Resolve tests in scope (needed to query test_submissions safely without joins)
    let testIds: string[] = [];

    if (testIdParam) {
      testIds = [testIdParam];
    } else {
      const testsRes = await supa.from("tests").select("id").eq("org_id", orgId);
      if (testsRes.error) throw testsRes.error;
      testIds = ((testsRes.data || []) as TestRow[]).map((t) => t.id);
    }

    if (!testIds.length) {
      return NextResponse.json({
        ok: true,
        filters: {
          orgId,
          org: orgSlugParam || null,
          testId: testIdParam,
          from: toIso(from),
          to: toIso(to),
        },
        segments: {
          companies: [],
          purposes: [],
          profilesByCount: [],
          profilesByAvg: [],
          frequenciesByCount: [],
          frequenciesByAvg: [],
        },
      });
    }

    // 1) Usage submissions in range (to get total submissions + link_token distribution)
    let usageQ = supa
      .from("v_usage_submissions")
      .select("submission_id, test_id, link_token, created_at, org_id")
      .eq("org_id", orgId)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (testIdParam) usageQ = usageQ.eq("test_id", testIdParam);

    const usageRes = await usageQ;
    if (usageRes.error) throw usageRes.error;
    const usage = (usageRes.data || []) as UsageRow[];

    const totalSubs = usage.length;

    // 2) Links (for purpose labels)
    let linksQ = supa
      .from("v_test_links_full")
      .select("id, org_id, test_id, token, name, label")
      .eq("org_id", orgId);

    if (testIdParam) linksQ = linksQ.eq("test_id", testIdParam);

    const linksRes = await linksQ;
    if (linksRes.error) throw linksRes.error;
    const links = (linksRes.data || []) as LinkFullRow[];

    const linkLabelByToken = new Map<string, string>();
    for (const l of links) {
      const purpose = (l.label || l.name || "").trim();
      if (purpose) linkLabelByToken.set(l.token, purpose);
    }

    // 3) Company segmentation from test_submissions (scoped by test_id list + date range)
    // NOTE: this stays org-safe because we only include tests under orgId (or explicit testIdParam).
    let subsQ = supa
      .from("test_submissions")
      .select("test_id, link_token, created_at, company")
      .in("test_id", testIds)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    const subsRes = await subsQ;
    if (subsRes.error) throw subsRes.error;

    const subRows = (subsRes.data || []) as SubmissionRow[];

    const companyCounts = new Map<string, number>();
    for (const r of subRows) {
      const c = (r.company || "").trim() || "Unknown";
      companyCounts.set(c, (companyCounts.get(c) || 0) + 1);
    }

    const companies: CompanySeg[] = Array.from(companyCounts.entries())
      .map(([company, testsTaken]) => ({
        company,
        testsTaken,
        pct: totalSubs > 0 ? testsTaken / totalSubs : 0,
      }))
      .sort((a, b) => b.testsTaken - a.testsTaken)
      .slice(0, 12);

    // 4) Purpose/Label segmentation from usage (group by link label/name)
    const purposeCounts = new Map<string, number>();
    for (const u of usage) {
      if (!u.link_token) continue;
      const purpose =
        linkLabelByToken.get(u.link_token) ||
        "Untitled/Unlabelled link";
      purposeCounts.set(purpose, (purposeCounts.get(purpose) || 0) + 1);
    }

    const purposes: PurposeSeg[] = Array.from(purposeCounts.entries())
      .map(([purpose, testsTaken]) => ({
        purpose,
        testsTaken,
        pct: totalSubs > 0 ? testsTaken / totalSubs : 0,
      }))
      .sort((a, b) => b.testsTaken - a.testsTaken)
      .slice(0, 12);

    // 5) Expanded scores in range (overall, not per-link)
    let expQ = supa
      .from("v_submission_scores_expanded_submissions")
      .select(
        "org_id, test_id, link_token, submission_id, created_at, dimension_type, dimension_code, dimension_name, total_points"
      )
      .eq("org_id", orgId)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (testIdParam) expQ = expQ.eq("test_id", testIdParam);

    const expRes = await expQ;
    if (expRes.error) throw expRes.error;
    const expanded = (expRes.data || []) as ExpandedRow[];

    // Build label maps per test_id used
    const testIdsInPlay = new Set<string>();
    for (const tid of testIds) testIdsInPlay.add(tid);

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

    function labelName(test_id: string, type: "profile" | "frequency", code: string) {
      if (type === "profile") return profileNameByTest.get(test_id)?.get(code) || code;
      return freqNameByTest.get(test_id)?.get(code) || code;
    }

    // Overall aggregation by (test_id, dimension_type, dimension_code)
    type Agg = { sum: number; n: number; subs: Set<string> };
    const agg = new Map<string, Agg>();

    for (const r of expanded) {
      const key = `${r.test_id}||${r.dimension_type}||${r.dimension_code}`;
      const a = agg.get(key) || { sum: 0, n: 0, subs: new Set<string>() };
      a.sum += Number(r.total_points || 0);
      a.n += 1;
      a.subs.add(r.submission_id);
      agg.set(key, a);
    }

    function overallTopByAvg(type: "profile" | "frequency", n: number): TopByAvg[] {
      const items: TopByAvg[] = [];
      for (const [k, a] of agg.entries()) {
        const [tid, dt, code] = k.split("||");
        if (dt !== type) continue;
        const avg = a.n ? a.sum / a.n : 0;
        items.push({
          code,
          name: labelName(tid, type, code),
          avgPoints: Number.isFinite(avg) ? avg : 0,
          n: a.subs.size,
        });
      }
      items.sort((a, b) => b.avgPoints - a.avgPoints);
      return items.slice(0, n);
    }

    function overallTopByCount(type: "profile" | "frequency", n: number): TopByCount[] {
      const items: TopByCount[] = [];
      for (const [k, a] of agg.entries()) {
        const [tid, dt, code] = k.split("||");
        if (dt !== type) continue;
        const count = a.subs.size;
        items.push({
          code,
          name: labelName(tid, type, code),
          count,
          pct: totalSubs > 0 ? count / totalSubs : 0,
        });
      }
      items.sort((a, b) => b.count - a.count);
      return items.slice(0, n);
    }

    const profilesByCount = overallTopByCount("profile", 12);
    const profilesByAvg = overallTopByAvg("profile", 12);

    const frequenciesByCount = overallTopByCount("frequency", 8);
    const frequenciesByAvg = overallTopByAvg("frequency", 8);

    return NextResponse.json({
      ok: true,
      filters: {
        orgId,
        org: orgSlugParam || null,
        testId: testIdParam,
        from: toIso(from),
        to: toIso(to),
      },
      segments: {
        companies,
        purposes,
        profilesByCount,
        profilesByAvg,
        frequenciesByCount,
        frequenciesByAvg,
        totals: {
          submissions: totalSubs,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
