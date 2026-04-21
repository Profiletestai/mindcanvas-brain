// apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/server/supabaseAdmin";
import { getBaseUrl } from "@/lib/baseUrl";
import ProfileExtendedReportClient from "./ProfileExtendedReportClient";

export const dynamic = "force-dynamic";

type ReportPanel = {
  panel_key: string;
  title: string;
  blocks: Array<Record<string, any>>;
  matched_rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, any>;
  }>;
};

type ReportSection = {
  section_key: string;
  heading: string;
  panels: ReportPanel[];
  matched_rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, any>;
  }>;
};

type ExtendedReportResponse = {
  ok: boolean;
  data?: {
    audience?: string;
    token?: string;
    tid?: string | null;
    sid?: string | null;
    submission_id?: string | null;
    engine_key?: string;
    version?: number;
    meta?: {
      org_name?: string | null;
      org_logo_url?: string | null;
      test_name?: string | null;
      generated_at?: string | null;
      mode?: string | null;
      scoring_mode?: string | null;
      report_variant?: string | null;
    } | null;
    input?: {
      tier?: string;
      level?: number;
      behaviour_style?: string;
      readiness?: string | null;
      pillar_scores?: Record<string, number> | null;
      tier_counts?: Record<string, number> | null;
    } | null;
    signals?: {
      tier?: string;
      level?: number;
      style?: string;
      readiness?: string | null;
      overall_pct?: number | null;
      pillar_scores?: Record<string, number> | null;
      weakest_pillar?: string | null;
      strongest_pillar?: string | null;
    } | null;
    graphs?: {
      tier_counts?: Record<string, number> | null;
      pillars?: Record<string, number> | null;
      pillar_bands?: Record<string, string> | null;
    } | null;
    sections?: ReportSection[];
  };
  error?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function ProfileExtendedReportPage({
  params,
}: {
  params: { slug: string; takerId: string };
}) {
  const { slug, takerId } = params;
  const sb = createClient().schema("portal");

  const { data: org } = await sb
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return notFound();

  const { data: taker } = await sb
    .from("test_takers")
    .select(
      "id, org_id, test_id, first_name, last_name, email, phone, company, role_title, link_token, created_at"
    )
    .eq("id", takerId)
    .maybeSingle();

  if (!taker) return notFound();

  let allowed = taker.org_id === org.id;

  if (!allowed) {
    const { data: subs } = await sb
      .from("test_submissions")
      .select("test_id")
      .eq("taker_id", taker.id)
      .order("created_at", { ascending: false })
      .limit(25);

    const testIds = Array.from(
      new Set((subs || []).map((s: any) => s?.test_id).filter(Boolean))
    ) as string[];

    if (testIds.length) {
      const { data: testsForSubs } = await sb
        .from("tests")
        .select("id, org_id")
        .in("id", testIds);

      allowed = (testsForSubs || []).some((t: any) => t?.org_id === org.id);
    }
  }

  if (!allowed) return notFound();

  const { data: test } = await sb
    .from("tests")
    .select("id, name, slug")
    .eq("id", taker.test_id)
    .maybeSingle();

  if (!taker.link_token) return notFound();

  const origin = getBaseUrl();
  const reportUrl = `${origin}/api/public/visibility/${encodeURIComponent(
    taker.link_token
  )}/report?tid=${encodeURIComponent(taker.id)}&audience=profile_extended_report`;

  const reportRes = await fetchJson<ExtendedReportResponse>(reportUrl);

  if (!reportRes?.ok || !reportRes?.data) return notFound();

  const fullName =
    [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown participant";

  return (
    <ProfileExtendedReportClient
      org={{
        id: org.id,
        slug: org.slug,
        name: org.name,
      }}
      taker={{
        id: taker.id,
        fullName,
        firstName: taker.first_name || "",
        lastName: taker.last_name || "",
        email: taker.email || "",
        phone: taker.phone || "",
        company: taker.company || "",
        roleTitle: taker.role_title || "",
        createdAt: taker.created_at || null,
      }}
      test={{
        id: test?.id || "",
        name: test?.name || "Visibility Ladder",
        slug: test?.slug || "",
      }}
      report={reportRes.data}
      backHref={`/portal/${slug}/database/${taker.id}`}
    />
  );
}