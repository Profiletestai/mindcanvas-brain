// apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import ProfileExtendedReportClient from "./ProfileExtendedReportClient";
import { buildProfileExtendedReport } from "@/lib/visibility/profileExtendedReport";

type VisibilityInputs = {
  tier: string;
  level: number;
  behaviour_style?: string | null;
  readiness?: string | null;
  pillar_scores?: Record<string, number> | null;
};

type ReportBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  transition?: string;
};

type ReportSection = {
  key: string;
  title?: string;
  blocks?: ReportBlock[];
};

function getKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

function portalSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    db: { schema: "portal" },
    auth: { persistSession: false },
  });
}

function safeString(x: any) {
  return typeof x === "string" ? x.trim() : "";
}

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseObject(x: any) {
  return x && typeof x === "object" ? x : {};
}

async function getBaseUrlFromHeaders() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (!host) throw new Error("Could not determine host");
  return `${proto}://${host}`;
}

function normaliseSnapshotPayload(payload: any): VisibilityInputs | null {
  const root = normaliseObject(payload?.data ?? payload);
  const candidates = [
    root,
    root.visibility,
    root.snapshot,
    root.result,
    root.signals,
    root.visibility_result,
    root.visibility_snapshot,
  ].filter(Boolean);

  for (const c of candidates) {
    const obj = normaliseObject(c);
    const tier = safeString(obj.tier ?? obj.visibility_tier ?? obj.result_tier);
    const level = safeNumber(obj.level ?? obj.visibility_level ?? obj.result_level, 0);
    const behaviour_style =
      safeString(
        obj.behaviour_style ??
          obj.behavior_style ??
          obj.style ??
          obj.personality_type
      ) || null;
    const readiness = safeString(obj.readiness) || null;
    const pillar_scores = normaliseObject(obj.pillar_scores);

    if (tier && level > 0) {
      return {
        tier,
        level,
        behaviour_style,
        readiness,
        pillar_scores: Object.keys(pillar_scores).length ? pillar_scores : null,
      };
    }
  }

  return null;
}

function normaliseTotalsPayload(totals: any): VisibilityInputs | null {
  const root = normaliseObject(totals?.visibility ?? totals);
  const tier = safeString(root.tier);
  const level = safeNumber(root.level, 0);
  const behaviour_style =
    safeString(
      root.behaviour_style ??
        root.behavior_style ??
        root.style ??
        root.personality_type
    ) || null;
  const readiness = safeString(root.readiness) || null;
  const pillar_scores = normaliseObject(root.pillar_scores);

  if (!tier || level <= 0) return null;

  return {
    tier,
    level,
    behaviour_style,
    readiness,
    pillar_scores: Object.keys(pillar_scores).length ? pillar_scores : null,
  };
}

async function loadVisibilityInputs(
  slug: string,
  takerId: string
): Promise<VisibilityInputs | null> {
  const portal = portalSb();

  try {
    const baseUrl = await getBaseUrlFromHeaders();
    const h = await headers();
    const cookie = h.get("cookie") || "";

    const snapshotUrl = `${baseUrl}/api/portal/visibility/taker/${encodeURIComponent(
      takerId
    )}/snapshot?org=${encodeURIComponent(slug)}&audience=internal_snapshot`;

    const res = await fetch(snapshotUrl, {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      const normalised = normaliseSnapshotPayload(json);
      if (normalised) return normalised;
    }
  } catch (err) {
    console.warn(
      "[profile-extended-report] snapshot fetch failed, using fallback",
      err
    );
  }

  const { data: testResult, error } = await portal
    .from("test_results")
    .select("totals")
    .eq("taker_id", takerId)
    .maybeSingle();

  if (error) {
    console.warn("[profile-extended-report] test_results fallback failed", error);
    return null;
  }

  return normaliseTotalsPayload(testResult?.totals);
}

function normaliseSections(rawReport: any): ReportSection[] {
  const raw = rawReport?.sections;

  if (Array.isArray(raw)) {
    return raw.map((s: any, idx: number) => ({
      key: safeString(s?.key) || `section_${idx + 1}`,
      title: safeString(s?.title) || undefined,
      blocks: Array.isArray(s?.blocks)
        ? s.blocks.map((b: any) => ({
            title: safeString(b?.title) || undefined,
            short_summary: safeString(b?.short_summary) || undefined,
            paragraphs: Array.isArray(b?.paragraphs)
              ? b.paragraphs.map((p: any) => String(p))
              : [],
            transition: safeString(b?.transition) || undefined,
          }))
        : [],
    }));
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([key, value]: [string, any]) => ({
      key,
      title: safeString(value?.title) || undefined,
      blocks: Array.isArray(value?.blocks)
        ? value.blocks.map((b: any) => ({
            title: safeString(b?.title) || undefined,
            short_summary: safeString(b?.short_summary) || undefined,
            paragraphs: Array.isArray(b?.paragraphs)
              ? b.paragraphs.map((p: any) => String(p))
              : [],
            transition: safeString(b?.transition) || undefined,
          }))
        : [],
    }));
  }

  return [];
}

export default async function ProfileExtendedReportPage({
  params,
}: {
  params: Promise<{ slug: string; takerId: string }>;
}) {
  const { slug, takerId } = await params;
  const portal = portalSb();

  const { data: org, error: orgErr } = await portal
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (orgErr || !org) notFound();

  const { data: taker, error: takerErr } = await portal
    .from("test_takers")
    .select(
      "id, org_id, test_id, first_name, last_name, email, company, role_title"
    )
    .eq("id", takerId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (takerErr || !taker) notFound();

  const { data: test } = await portal
    .from("tests")
    .select("id, name, slug")
    .eq("id", taker.test_id)
    .maybeSingle();

  const visibilityInputs = await loadVisibilityInputs(slug, takerId);

  if (!visibilityInputs) {
    notFound();
  }

  const rawReport = await buildProfileExtendedReport({
    tier: visibilityInputs.tier,
    level: visibilityInputs.level,
    behaviour_style: visibilityInputs.behaviour_style ?? null,
    behavior_style: visibilityInputs.behaviour_style ?? null,
    readiness: visibilityInputs.readiness ?? null,
    pillar_scores: visibilityInputs.pillar_scores ?? null,
  } as any);

  const sections = normaliseSections(rawReport);

  const fullName =
    [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown test taker";

  return (
    <ProfileExtendedReportClient
      orgSlug={slug}
      takerId={takerId}
      orgName={org.name || org.slug}
      testName={test?.name || "Visibility Ladder"}
      takerName={fullName}
      takerEmail={taker.email || ""}
      company={taker.company || ""}
      roleTitle={taker.role_title || ""}
      inputs={visibilityInputs}
      sections={sections}
    />
  );
}