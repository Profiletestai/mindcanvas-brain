// apps/web/app/api/portal-dashboard-v2/link/company-submissions/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

type ExpandedRow = {
  submission_id: string;
  created_at: string;
  company: string | null;
  link_token: string | null;
};

type UsageRow = {
  submission_id: string;
  taker_id?: string | null;
  created_at: string;
  link_token: string | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const token = url.searchParams.get("token")?.trim() || "";
    const companyParamRaw = url.searchParams.get("company")?.trim() || "";

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }
    if (!companyParamRaw) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const companyParam = companyParamRaw.trim();
    const wantUnknown =
      companyParam.toLowerCase() === "unknown" || companyParam === "—" || companyParam === "-";

    const fromQ = parseDateParam(url.searchParams.get("from"));
    const toQ = parseDateParam(url.searchParams.get("to"));
    const { from, to } = clampRange(fromQ, toQ);

    const supa = supaAdmin();

    // 1) Find submissions for this link+company within range
    // NOTE: v_submission_scores_expanded_submissions already has company.
    let expQuery = supa
      .from("v_submission_scores_expanded_submissions")
      .select("submission_id, created_at, company, link_token")
      .eq("link_token", token)
      .gte("created_at", toIso(from))
      .lte("created_at", toIso(to));

    // If "Unknown": treat as NULL or empty or whitespace
    // Supabase JS can't express complex OR easily without .or()
    // We'll use .or() to match company is null OR company.eq.'' OR company.ilike.'   '
    // (the ilike part is best-effort; whitespace-only still tricky without SQL)
    if (wantUnknown) {
      expQuery = expQuery.or("company.is.null,company.eq.");
    } else {
      expQuery = expQuery.eq("company", companyParam);
    }

    const expRes = await expQuery;
    if (expRes.error) throw expRes.error;
    const expanded = (expRes.data || []) as ExpandedRow[];

    const submissionIds = Array.from(new Set(expanded.map((r) => r.submission_id).filter(Boolean)));

    if (!submissionIds.length) {
      return NextResponse.json({
        ok: true,
        token,
        company: companyParam,
        from: toIso(from),
        to: toIso(to),
        total: 0,
        submissions: [],
      });
    }

    // 2) Pull usage rows for those submissions to get taker_id + created_at
    const usageRes = await supa
      .from("v_usage_submissions")
      .select("submission_id, taker_id, created_at, link_token")
      .eq("link_token", token)
      .in("submission_id", submissionIds);

    if (usageRes.error) throw usageRes.error;
    const usage = (usageRes.data || []) as UsageRow[];

    const usageBySub = new Map<string, { takerId: string | null; createdAt: string }>();
    for (const u of usage) {
      if (!u.submission_id) continue;
      usageBySub.set(u.submission_id, {
        takerId: (u.taker_id as any) ?? null,
        createdAt: u.created_at,
      });
    }

    // 3) Fetch taker rows (best-effort)
    const takerIds = Array.from(new Set(usage.map((u) => (u.taker_id ? String(u.taker_id) : "")).filter(Boolean)));

    let takersById = new Map<string, any>();
    if (takerIds.length) {
      const takersRes = await supa.from("test_takers").select("*").in("id", takerIds);
      if (takersRes.error) throw takersRes.error;

      for (const t of takersRes.data || []) {
        if (t?.id) takersById.set(String(t.id), t);
      }
    }

    // 4) Build payload rows
    const submissions = submissionIds
      .map((sid) => {
        const u = usageBySub.get(sid);
        const takerId = u?.takerId ?? null;
        const t = takerId ? takersById.get(String(takerId)) : null;

        const firstName = t?.first_name ?? t?.firstname ?? t?.firstName ?? t?.name_first ?? null;
        const lastName = t?.last_name ?? t?.lastname ?? t?.lastName ?? t?.name_last ?? null;
        const email = t?.email ?? t?.Email ?? null;
        const phone = t?.phone ?? t?.mobile ?? t?.tel ?? null;

        const company =
          t?.company ?? t?.company_name ?? t?.organisation ?? t?.organization ?? (wantUnknown ? "Unknown" : companyParam);

        return {
          submissionId: sid,
          createdAt: u?.createdAt ?? null,
          takerId,
          firstName,
          lastName,
          email,
          phone,
          company,
          meta: t?.meta ?? t?.metadata ?? null,
        };
      })
      .filter((r) => !!r.submissionId)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return NextResponse.json({
      ok: true,
      token,
      company: wantUnknown ? "Unknown" : companyParam,
      from: toIso(from),
      to: toIso(to),
      total: submissions.length,
      submissions,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

