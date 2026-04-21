// apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/page.tsx
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/server/supabaseAdmin";
import ProfileExtendedReportClient from "./ProfileExtendedReportClient";
import {
  buildProfileExtendedReport,
  type BehaviourStyle,
  type ProfileExtendedReportInput,
  type Readiness,
  type VisibilityTier,
} from "@/lib/visibility/profileExtendedReport";

export const dynamic = "force-dynamic";

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

function visibilityAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getServiceRoleKey();

  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }

  return createSupabaseClient(url, key, {
    db: { schema: "visibility" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeString(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNumber(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTier(v: any): VisibilityTier {
  const s = safeString(v);
  if (s === "Invisible" || s === "Emerging" || s === "Established" || s === "Magnetic") {
    return s;
  }
  return "Invisible";
}

function normalizeStyle(v: any): BehaviourStyle {
  const s = safeString(v).toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D") return s;
  return "A";
}

function normalizeReadiness(v: any): Readiness | null {
  const s = safeString(v).toLowerCase();
  if (s === "stabilise") return "stabilise";
  if (s === "ready_to_progress") return "ready_to_progress";
  return null;
}

function normalizePillarScores(raw: any) {
  return {
    visibility: safeNumber(raw?.visibility, 0),
    trust: safeNumber(raw?.trust, 0),
    authority: safeNumber(raw?.authority, 0),
    dominance: safeNumber(raw?.dominance, 0),
  };
}

function normalizeTierCounts(raw: any) {
  return {
    Invisible: safeNumber(raw?.Invisible, 0),
    Emerging: safeNumber(raw?.Emerging, 0),
    Established: safeNumber(raw?.Established, 0),
    Magnetic: safeNumber(raw?.Magnetic, 0),
  };
}

export default async function ProfileExtendedReportPage({
  params,
}: {
  params: { slug: string; takerId: string };
}) {
  const portal = createClient().schema("portal");
  const vis = visibilityAdmin();

  const { slug, takerId } = params;

  const { data: org } = await portal
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return notFound();

  const { data: taker } = await portal
    .from("test_takers")
    .select(
      "id, org_id, test_id, link_token, first_name, last_name, email, phone, company, role_title, created_at"
    )
    .eq("id", takerId)
    .maybeSingle();

  if (!taker) return notFound();

  const { data: test } = await portal
    .from("tests")
    .select("id, name, slug")
    .eq("id", taker.test_id)
    .maybeSingle();

  if (!test) return notFound();

  const { data: submissions } = await vis
    .from("submissions")
    .select("id, token, taker_email, taker_name, metadata, created_at")
    .eq("token", taker.link_token || "")
    .order("created_at", { ascending: false })
    .limit(50);

  const fullName = [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim();
  const takerEmail = safeString(taker.email).toLowerCase();

  const submission =
    (submissions || []).find((s: any) => safeString(s?.metadata?.taker_id) === taker.id) ||
    (submissions || []).find(
      (s: any) => safeString(s?.taker_email).toLowerCase() === takerEmail
    ) ||
    (submissions || []).find((s: any) => safeString(s?.taker_name) === fullName) ||
    (submissions || [])[0] ||
    null;

  if (!submission?.id) return notFound();

  const { data: result } = await vis
    .from("results")
    .select(
      "id, created_at, tier, level, readiness, personality_type, pillar_scores, tier_counts, engine_key, version"
    )
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!result) return notFound();

  const input: ProfileExtendedReportInput = {
    tier: normalizeTier(result.tier),
    level: safeNumber(result.level, 1),
    behaviour_style: normalizeStyle(result.personality_type),
    readiness: normalizeReadiness(result.readiness),
    pillar_scores: normalizePillarScores(result.pillar_scores),
    tier_counts: normalizeTierCounts(result.tier_counts),
  };

  const assembled = await buildProfileExtendedReport(input);

  const report = {
    audience: "profile_extended_report",
    meta: {
      org_name: org.name,
      test_name: test.name,
      generated_at: result.created_at || null,
      mode: "internal",
      scoring_mode: "prime",
      report_variant: "extended",
    },
    input,
    signals: {
      tier: input.tier,
      level: input.level,
      style: input.behaviour_style,
      readiness: input.readiness,
      pillar_scores: input.pillar_scores,
    },
    graphs: {
      pillars: input.pillar_scores,
      tier_counts: input.tier_counts,
    },
    sections: assembled.sections,
  };

  return (
    <ProfileExtendedReportClient
      org={{
        id: org.id,
        slug: org.slug,
        name: org.name,
      }}
      taker={{
        id: taker.id,
        fullName: fullName || "Unknown",
        firstName: safeString(taker.first_name),
        lastName: safeString(taker.last_name),
        email: safeString(taker.email),
        phone: safeString(taker.phone),
        company: safeString(taker.company),
        roleTitle: safeString(taker.role_title),
        createdAt: taker.created_at || null,
      }}
      test={{
        id: test.id,
        name: test.name,
        slug: test.slug,
      }}
      report={report}
      backHref={`/portal/${slug}/database/${takerId}`}
    />
  );
}