// apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { buildProfileExtendedReport } from "@/lib/visibility/profileExtendedReport";

type VisibilityInputs = {
  tier: string;
  level: number;
  behaviour_style?: string | null;
  readiness?: string | null;
  pillar_scores?: Record<string, number> | null;
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

  // Primary source: existing internal snapshot endpoint
  try {
    const baseUrl = await getBaseUrlFromHeaders();
    const h = await headers();
    const cookie = h.get("cookie") || "";

    const snapshotUrl = `${baseUrl}/api/portal/visibility/taker/${encodeURIComponent(
      takerId
    )}/snapshot?org=${encodeURIComponent(slug)}&audience=internal_snapshot`;

    const res = await fetch(snapshotUrl, {
      method: "GET",
      headers: {
        cookie,
      },
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

  // Fallback source: stored totals
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

function titleFromKey(key: string) {
  const map: Record<string, string> = {
    result_interpretation_scripts: "Result Interpretation",
    level_progression_roadmap: "Level Progression Roadmap",
    visibility_signal_framework: "Visibility Signal Framework",
    visibility_audit_layer: "Visibility Audit Layer",
  };
  return map[key] || key.replace(/_/g, " ");
}

export default async function ProfileExtendedReportPage({
  params,
}: {
  params: { slug: string; takerId: string };
}) {
  const portal = portalSb();

  const { data: org, error: orgErr } = await portal
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (orgErr || !org) notFound();

  const { data: taker, error: takerErr } = await portal
    .from("test_takers")
    .select(
      "id, org_id, test_id, first_name, last_name, email, company, role_title"
    )
    .eq("id", params.takerId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (takerErr || !taker) notFound();

  const { data: test } = await portal
    .from("tests")
    .select("id, name, slug")
    .eq("id", taker.test_id)
    .maybeSingle();

  const visibilityInputs = await loadVisibilityInputs(params.slug, params.takerId);

  if (!visibilityInputs) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <Link
            href={`/portal/${params.slug}/database/${params.takerId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to test taker profile
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Profile Extended Report
          </h1>
          <p className="mt-3 text-sm text-slate-700">
            We could not find the Visibility result inputs needed to build this
            report.
          </p>
        </div>
      </div>
    );
  }

  const report = await buildProfileExtendedReport({
    tier: visibilityInputs.tier,
    level: visibilityInputs.level,
    behaviour_style: visibilityInputs.behaviour_style ?? null,
    behavior_style: visibilityInputs.behaviour_style ?? null,
    readiness: visibilityInputs.readiness ?? null,
    pillar_scores: visibilityInputs.pillar_scores ?? null,
  } as any);

  const fullName =
    [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown test taker";

  const sections = Array.isArray((report as any)?.sections)
    ? (report as any).sections
    : [];
  const signals = (report as any)?.signals || {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href={`/portal/${params.slug}/database/${params.takerId}`}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back to test taker profile
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Profile Extended Report
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Internal visibility interpretation layer for {fullName}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Test taker
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {fullName}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {taker.email || "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Organisation
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {org.name || org.slug}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Assessment
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {test?.name || "Visibility Ladder"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Tier / Level
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {visibilityInputs.tier} • Level {visibilityInputs.level}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Style / Readiness
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {visibilityInputs.behaviour_style || "—"}
              {visibilityInputs.readiness
                ? ` • ${visibilityInputs.readiness}`
                : ""}
            </div>
          </div>
        </div>

        {visibilityInputs.pillar_scores &&
        Object.keys(visibilityInputs.pillar_scores).length > 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Pillar Scores
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {Object.entries(visibilityInputs.pillar_scores).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {key.replace(/_/g, " ")}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {safeNumber(value)}%
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Matched Report Signals
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
{JSON.stringify(
  {
    tier: visibilityInputs.tier,
    level: visibilityInputs.level,
    behaviour_style: visibilityInputs.behaviour_style,
    readiness: visibilityInputs.readiness,
    pillar_scores: visibilityInputs.pillar_scores,
    helper_signals: signals,
  },
  null,
  2
)}
          </pre>
        </div>

        <div className="mt-6 space-y-6">
          {sections.length ? (
            sections.map((section: any, index: number) => {
              const blocks = Array.isArray(section?.blocks) ? section.blocks : [];

              return (
                <section
                  key={section?.key || index}
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <div className="mb-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Section {index + 1}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                      {section?.title ||
                        titleFromKey(section?.key || `section_${index + 1}`)}
                    </h2>
                  </div>

                  <div className="space-y-5">
                    {blocks.map((block: any, blockIndex: number) => {
                      const paragraphs = Array.isArray(block?.paragraphs)
                        ? block.paragraphs
                        : [];
                      const shortSummary = safeString(block?.short_summary);
                      const blockTitle = safeString(block?.title);
                      const transition = safeString(block?.transition);

                      return (
                        <div
                          key={`${section?.key || index}-${blockIndex}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                        >
                          {blockTitle ? (
                            <h3 className="text-base font-semibold text-slate-900">
                              {blockTitle}
                            </h3>
                          ) : null}

                          {shortSummary ? (
                            <div className="mt-3 rounded-lg bg-white p-4 text-sm text-slate-700">
                              <span className="font-medium text-slate-900">
                                In short:
                              </span>{" "}
                              {shortSummary}
                            </div>
                          ) : null}

                          {paragraphs.length ? (
                            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700">
                              {paragraphs.map((p: string, pIndex: number) => (
                                <p key={pIndex}>{p}</p>
                              ))}
                            </div>
                          ) : null}

                          {transition ? (
                            <div className="mt-4 text-xs italic text-slate-500">
                              {transition}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                No extended report sections found
              </h2>
              <p className="mt-3 text-sm text-slate-700">
                The helper ran, but no matching KB blocks were returned for this
                test taker.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}