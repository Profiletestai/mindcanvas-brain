// apps/web/app/api/portal-dashboard-v2/link/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TimelinePoint = { date: string; submissions: number };

type DistItem = {
  code: string;
  name: string;
  count: number;
  pct: number;
  avgPoints: number;
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
  redirect_url: string | null;
  next_steps_url: string | null;
  show_results: boolean | null;
  meta: any;
};

type UsageRow = {
  submission_id: string;
  taker_id?: string | null;
  created_at: string;
  link_token: string | null;
};

type ExpandedRow = {
  submission_id: string;
  created_at: string;
  company: string | null;
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
    const token = url.searchParams.get("token")?.trim() || "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const fromQ = parseDateParam(url.searchParams.get("from"));
    const toQ = parseDateParam(url.searchParams.get("to"));
    const { from, to } = clampRange(fromQ, toQ);

    const supa = supaAdmin();

    // Link meta
    const linkRes = await supa
      .from("v_test_links_full")
      .select(
        "id, org_id, test_id, token, name, label, is_active, use_count, max_uses, created_at, expires_at, redirect_url, next_steps_url, show_results, meta"
      )
      .eq("token", token)
      .limit(1);

    if (linkRes.error) throw linkRes.error;
    const link = (linkRes.data?.[0] || null) as LinkFullRow | null;
    if (!link) return NextResponse.json({ ok: false, error: "Link not found" }, { status: 404 });

    // Load labels for this test
    const [profilesLblRes, freqsLblRes] = await Promise.all([
      supa
        .from("test_profile_labels")
        .select("test_id, profile_code, profile_name, frequency_code")
        .eq("test_id", link.test_id),
      supa
        .from("test_frequency_labels")
        .select("test_id, frequency_code, frequency_name")
        .eq("test_id", link.test_id),
    ]);

    if (profilesLblRes.error) throw profilesLblRes.error;
    if (freqsLblRes.error) throw freqsLblRes.error;

    const profileName = new Map<string, string>();
    for (const r of (profilesLblRes.data || []) as ProfileLabelRow[]) {
      profileName.set(r.profile_code, r.profile_name);
    }
    const freqName = new Map<string, string>();
    for (const r of (freqsLblRes.data || []) as FreqLabelRow[]) {
      freqName.set(r.frequency_code, r.frequency_name);
    }

    const labelName = (type: "profile" | "frequency", code: string) => {
      return type === "profile" ? profileName.get(code) || code : freqName.get(code) || code;
    };

    // Usage in range
    const usageRes = await supa
      .from("v_usage_submissions")
      .select("submission_id, taker_id, created_at, link_token")
      .eq("link_token", token)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (usageRes.error) throw usageRes.error;
    const usage = (usageRes.data || []) as UsageRow[];

    const testsTaken = usage.length;

    // Unique takers (if taker_id exists)
    let uniqueTakers: number | null = null;
    if (usage.some((u) => !!u.taker_id)) {
      const set = new Set<string>();
      for (const u of usage) if (u.taker_id) set.add(u.taker_id);
      uniqueTakers = set.size;
    }

    const lastUsedAt =
      usage.length > 0
        ? usage.reduce((max, r) => (r.created_at > max ? r.created_at : max), usage[0].created_at)
        : null;

    // Timeline
    const timelineMap = new Map<string, number>();
    for (const u of usage) {
      const d = ymd(new Date(u.created_at));
      timelineMap.set(d, (timelineMap.get(d) || 0) + 1);
    }
    const timeline: TimelinePoint[] = Array.from(timelineMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, submissions]) => ({ date, submissions }));

    // Expanded scores for this link
    const expRes = await supa
      .from("v_submission_scores_expanded_submissions")
      .select("submission_id, created_at, company, dimension_type, dimension_code, dimension_name, total_points")
      .eq("link_token", token)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    if (expRes.error) throw expRes.error;
    const expanded = (expRes.data || []) as ExpandedRow[];

    // Aggregate: distinct submissions (count), avg points
    type Agg = { subs: Set<string>; sum: number; n: number };
    const agg = new Map<string, Agg>();

    for (const r of expanded) {
      const key = `${r.dimension_type}||${r.dimension_code}`;
      const a = agg.get(key) || { subs: new Set<string>(), sum: 0, n: 0 };
      a.subs.add(r.submission_id);
      a.sum += Number(r.total_points || 0);
      a.n += 1;
      agg.set(key, a);
    }

    const buildDist = (type: "profile" | "frequency"): DistItem[] => {
      const items: DistItem[] = [];
      for (const [k, a] of agg.entries()) {
        const [dt, code] = k.split("||");
        if (dt !== type) continue;

        const count = a.subs.size;
        const avg = a.n ? a.sum / a.n : 0;

        items.push({
          code,
          name: labelName(type, code),
          count,
          pct: testsTaken > 0 ? count / testsTaken : 0,
          avgPoints: Number.isFinite(avg) ? avg : 0,
        });
      }
      // Sort by count (most common first) — best for UX
      items.sort((a, b) => b.count - a.count);
      return items;
    };

    // Company segmentation
    const companyMap = new Map<string, Set<string>>();
    for (const r of expanded) {
      const c = (r.company || "").trim() || "Unknown";
      const set = companyMap.get(c) || new Set<string>();
      set.add(r.submission_id);
      companyMap.set(c, set);
    }

    const companies = Array.from(companyMap.entries())
      .map(([company, subs]) => ({
        company,
        testsTaken: subs.size,
        pct: testsTaken > 0 ? subs.size / testsTaken : 0,
      }))
      .sort((a, b) => b.testsTaken - a.testsTaken)
      .slice(0, 20);

    return NextResponse.json({
      ok: true,
      filters: { token, from: toIso(from), to: toIso(to) },
      link: {
        linkId: link.id,
        orgId: link.org_id,
        testId: link.test_id,
        token: link.token,
        name: link.name ?? null,
        label: link.label ?? null,
        isActive: link.is_active ?? null,
        createdAt: link.created_at,
        expiresAt: link.expires_at ?? null,
        redirectUrl: link.redirect_url ?? null,
        nextStepsUrl: link.next_steps_url ?? null,
        showResults: link.show_results ?? null,
        meta: link.meta ?? {},
      },
      kpis: { testsTaken, uniqueTakers, lastUsedAt },
      timeline,
      distributions: {
        profiles: buildDist("profile"),
        frequencies: buildDist("frequency"),
      },
      segments: { companies },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

