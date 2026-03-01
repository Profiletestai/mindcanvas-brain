// apps/web/app/api/admin/org-rankings/route.ts
import "server-only";

import { NextResponse } from "next/server";
import { getServerSupabase, getAdminClient } from "@/app/_lib/portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

type OrgRow = { id: string; slug: string; name: string | null };

type OutRow = {
  orgId: string;
  slug: string;
  name: string | null;

  submissions: number;
  uniqueTakers: number;
  activeLinks: number;

  last7: number;
  prev7: number;
  growth: number; // -1..+inf (1 means "New" in client if prev=0 and last>0)

  lastUsedAt: string | null;

  utilization: number; // submissions per active link
  repeatRate: number; // 0..1
  status: "hot" | "at_risk" | "active" | "dormant";
};

type Totals = {
  submissions: number;
  uniqueTakers: number;
  activeLinks: number;
  activeOrgs: number;
  dormantOrgs: number;
  atRiskOrgs: number;
};

export async function GET(req: Request) {
  try {
    // ✅ Auth gating: match /admin/layout.tsx (superadmin)
    const sb = await getServerSupabase();
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const admin = await getAdminClient();
    const portal = admin.schema("portal");

    const { data: adminRow } = await portal
      .from("superadmin") // ✅ singular (matches your layout)
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRow?.user_id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Range
    const url = new URL(req.url);
    const fromQ = parseISO(url.searchParams.get("from"));
    const toQ = parseISO(url.searchParams.get("to"));
    const { from: defFrom, to: defTo } = defaultRange();
    const from = fromQ ?? defFrom;
    const to = toQ ?? defTo;

    // 1) Orgs
    const { data: orgs, error: orgErr } = await portal.from("orgs").select("id, slug, name");
    if (orgErr) {
      return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
    }

    const orgById = new Map<string, OrgRow>();
    (orgs ?? []).forEach((o: any) => orgById.set(o.id, { id: o.id, slug: o.slug, name: o.name ?? null }));

    // 2) Submissions in range (org_id + created_at)
    const { data: subs, error: subsErr } = await portal
      .from("v_usage_submissions")
      .select("org_id, created_at")
      .gte("created_at", from)
      .lte("created_at", to);

    if (subsErr) {
      return NextResponse.json({ ok: false, error: subsErr.message }, { status: 500 });
    }

    // 3) Unique takers in range (test_submissions -> tests to get org_id)
    const { data: takerRows, error: takerErr } = await portal
      .from("test_submissions")
      .select("taker_id, created_at, tests!inner(org_id)")
      .gte("created_at", from)
      .lte("created_at", to);

    if (takerErr) {
      return NextResponse.json({ ok: false, error: takerErr.message }, { status: 500 });
    }

    // 4) Active links (current usable links, not date-range usage)
    const nowIso = new Date().toISOString();
    const { data: links, error: linksErr } = await portal.from("test_links").select("org_id, is_active, expires_at");

    if (linksErr) {
      return NextResponse.json({ ok: false, error: linksErr.message }, { status: 500 });
    }

    // Growth windows (based on end "to")
    const end = new Date(to);
    const last7Start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const prev7Start = new Date(end.getTime() - 14 * 24 * 3600 * 1000);

    const agg = new Map<
      string,
      {
        submissions: number;
        uniqueTakers: Set<string>;
        activeLinks: number;
        last7: number;
        prev7: number;
        lastUsedAt: string | null;
      }
    >();

    function ensure(orgId: string) {
      if (!agg.has(orgId)) {
        agg.set(orgId, {
          submissions: 0,
          uniqueTakers: new Set<string>(),
          activeLinks: 0,
          last7: 0,
          prev7: 0,
          lastUsedAt: null,
        });
      }
      return agg.get(orgId)!;
    }

    // Submissions + growth + lastUsedAt
    for (const r of subs ?? []) {
      const orgId = (r as any).org_id as string;
      const createdAt = (r as any).created_at as string | null;

      if (!orgId) continue;
      const a = ensure(orgId);

      a.submissions += 1;

      if (createdAt) {
        // last used in range
        if (!a.lastUsedAt || createdAt > a.lastUsedAt) a.lastUsedAt = createdAt;

        const d = new Date(createdAt);
        if (Number.isFinite(d.getTime())) {
          if (d >= last7Start && d <= end) a.last7 += 1;
          else if (d >= prev7Start && d < last7Start) a.prev7 += 1;
        }
      }
    }

    // Unique takers
    for (const r of takerRows ?? []) {
      const orgId = (r as any)?.tests?.org_id as string | undefined;
      const takerId = (r as any)?.taker_id as string | undefined;
      if (!orgId || !takerId) continue;
      const a = ensure(orgId);
      a.uniqueTakers.add(takerId);
    }

    // Active links
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

    // Status rules (simple + useful)
    // - at_risk: activeLinks > 0 but submissions == 0 (within range)
    // - hot: submissions >= 10 AND (growth > 0 OR lastUsedAt within 48h)
    // - active: submissions > 0
    // - dormant: otherwise
    const now = new Date();
    const cutoff48h = new Date(now.getTime() - 48 * 3600 * 1000);

    const rows: OutRow[] = Array.from(orgById.values()).map((o) => {
      const a =
        agg.get(o.id) ?? ({
          submissions: 0,
          uniqueTakers: new Set<string>(),
          activeLinks: 0,
          last7: 0,
          prev7: 0,
          lastUsedAt: null,
        } as const);

      const prev = a.prev7;
      const last = a.last7;
      const growth = prev === 0 ? (last > 0 ? 1 : 0) : (last - prev) / prev;

      const submissions = a.submissions;
      const uniqueTakers = a.uniqueTakers.size;
      const activeLinks = a.activeLinks;

      const repeatRate = submissions > 0 ? clamp01(1 - uniqueTakers / submissions) : 0;
      const utilization = activeLinks > 0 ? submissions / activeLinks : submissions > 0 ? submissions : 0;

      const lastUsedAt = a.lastUsedAt;
      const lastUsedDate = lastUsedAt ? new Date(lastUsedAt) : null;
      const usedWithin48h = !!lastUsedDate && Number.isFinite(lastUsedDate.getTime()) && lastUsedDate >= cutoff48h;

      let status: OutRow["status"] = "dormant";
      if (activeLinks > 0 && submissions === 0) status = "at_risk";
      else if (submissions > 0) status = "active";
      if (submissions >= 10 && (growth > 0 || usedWithin48h)) status = "hot";

      return {
        orgId: o.id,
        slug: o.slug,
        name: o.name ?? null,

        submissions,
        uniqueTakers,
        activeLinks,

        last7: last,
        prev7: prev,
        growth,

        lastUsedAt,

        utilization,
        repeatRate,
        status,
      };
    });

    rows.sort((a, b) => b.submissions - a.submissions);

    const totals: Totals = {
      submissions: rows.reduce((s, r) => s + (r.submissions || 0), 0),
      uniqueTakers: rows.reduce((s, r) => s + (r.uniqueTakers || 0), 0),
      activeLinks: rows.reduce((s, r) => s + (r.activeLinks || 0), 0),
      activeOrgs: rows.filter((r) => (r.submissions || 0) > 0).length,
      dormantOrgs: rows.filter((r) => (r.submissions || 0) === 0 && (r.activeLinks || 0) === 0).length,
      atRiskOrgs: rows.filter((r) => (r.submissions || 0) === 0 && (r.activeLinks || 0) > 0).length,
    };

    return NextResponse.json(
      { ok: true, filters: { from, to }, totals, orgs: rows },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}