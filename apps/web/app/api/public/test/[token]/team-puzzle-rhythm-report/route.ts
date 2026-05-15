// apps/web/app/api/public/test/[token]/team-puzzle-rhythm-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FrequencyCode = "A" | "B" | "C" | "D";

type LinkMeta = {
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  next_steps_url?: string | null;
  email_report?: boolean | null;
};

type FrequencyLabel = { code: FrequencyCode; name: string };
type ProfileLabel = { code: string; name: string; frequency_code?: FrequencyCode | null };

const DEFAULT_FREQUENCY_LABELS: FrequencyLabel[] = [
  { code: "A", name: "Innovation" },
  { code: "B", name: "Influence" },
  { code: "C", name: "Implementation" },
  { code: "D", name: "Insight" },
];

const DEFAULT_PROFILE_LABELS: ProfileLabel[] = [
  { code: "PROFILE_1", name: "Visionary", frequency_code: "A" },
  { code: "PROFILE_2", name: "Catalyst", frequency_code: "A" },
  { code: "PROFILE_3", name: "Motivator", frequency_code: "B" },
  { code: "PROFILE_4", name: "Connector", frequency_code: "B" },
  { code: "PROFILE_5", name: "Facilitator", frequency_code: "C" },
  { code: "PROFILE_6", name: "Coordinator", frequency_code: "C" },
  { code: "PROFILE_7", name: "Controller", frequency_code: "D" },
  { code: "PROFILE_8", name: "Optimiser", frequency_code: "D" },
];

function getKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

function portal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    db: { schema: "portal" },
    auth: { persistSession: false },
  });
}

function asNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseCode(code: any): string {
  const raw = String(code || "").trim().toUpperCase();
  if (/^P\d+$/.test(raw)) return raw.replace(/^P/, "PROFILE_");
  if (/^PROFILE[_\s-]?\d+$/.test(raw)) return raw.replace(/^PROFILE[_\s-]?/, "PROFILE_");
  return raw;
}

function profileCodeToShort(code: string) {
  const c = normaliseCode(code);
  const m = c.match(/^PROFILE_(\d+)$/);
  return m ? `P${m[1]}` : c;
}

function pctMap<T extends string>(raw: Partial<Record<T, any>> | null | undefined, keys: T[]): Record<T, number> {
  const cleaned = {} as Record<T, number>;

  for (const key of keys) {
    cleaned[key] = asNumber(raw?.[key], 0);
  }

  const total = keys.reduce((sum: number, key: T) => sum + cleaned[key], 0);

  if (!total) {
    const empty = {} as Record<T, number>;
    for (const key of keys) empty[key] = 0;
    return empty;
  }

  const percentages = {} as Record<T, number>;
  for (const key of keys) {
    percentages[key] = Math.round((cleaned[key] / total) * 100);
  }

  return percentages;
}

function profilePctMap(raw: Record<string, any>, labels: ProfileLabel[]) {
  const allCodes = labels.map((p) => p.code);
  const cleaned: Record<string, number> = {};

  for (const code of allCodes) {
    cleaned[code] = asNumber(raw?.[code], raw?.[profileCodeToShort(code)] ?? 0);
  }

  for (const [code, value] of Object.entries(raw || {})) {
    const normalised = normaliseCode(code);
    if (normalised && cleaned[normalised] == null) cleaned[normalised] = asNumber(value, 0);
  }

  const total = Object.values(cleaned).reduce((sum, value) => sum + value, 0);
  if (!total) return Object.fromEntries(Object.keys(cleaned).map((key) => [key, 0]));

  return Object.fromEntries(
    Object.entries(cleaned).map(([key, value]) => [key, Math.round((value / total) * 100)])
  );
}

function sortProfiles(profileLabels: ProfileLabel[], profilePercentages: Record<string, number>) {
  return [...profileLabels]
    .map((profile) => ({
      ...profile,
      pct: asNumber(profilePercentages[profile.code], 0),
      short_code: profileCodeToShort(profile.code),
    }))
    .sort((a, b) => b.pct - a.pct);
}

function getTopFrequency(frequencyPercentages: Record<FrequencyCode, number>): FrequencyCode {
  const order: FrequencyCode[] = ["A", "B", "C", "D"];
  return order.reduce((best, current) =>
    asNumber(frequencyPercentages[current], 0) > asNumber(frequencyPercentages[best], 0) ? current : best
  , "A" as FrequencyCode);
}

function safeArray(value: any): string[] {
  return Array.isArray(value) ? value.map((x) => String(x)).filter(Boolean) : [];
}

function getMetaProfiles(meta: any): ProfileLabel[] {
  if (!Array.isArray(meta?.profiles)) return [];
  return meta.profiles
    .map((p: any) => ({
      code: normaliseCode(p?.code),
      name: String(p?.name || "").trim(),
      frequency_code: ["A", "B", "C", "D"].includes(String(p?.frequency || "").toUpperCase())
        ? (String(p.frequency).toUpperCase() as FrequencyCode)
        : null,
    }))
    .filter((p: ProfileLabel) => p.code && p.name);
}

function getMetaFrequencies(meta: any): FrequencyLabel[] {
  if (!Array.isArray(meta?.frequencies)) return [];
  return meta.frequencies
    .map((f: any) => ({
      code: String(f?.code || "").trim().toUpperCase() as FrequencyCode,
      name: String(f?.label || f?.name || "").trim(),
    }))
    .filter((f: FrequencyLabel) => ["A", "B", "C", "D"].includes(f.code) && f.name);
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = params.token?.trim();
    const tid = req.nextUrl.searchParams.get("tid")?.trim() || "";
    const src = req.nextUrl.searchParams.get("src")?.trim() || "";

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    if (!tid) {
      return NextResponse.json({ ok: false, error: "Missing tid" }, { status: 400 });
    }

    const sb = portal();

    const { data: link, error: linkErr } = await sb
      .from("test_links")
      .select("id, token, test_id, org_id, show_results, redirect_url, hidden_results_message, next_steps_url, email_report")
      .eq("token", token)
      .maybeSingle();

    if (linkErr || !link) {
      return NextResponse.json({ ok: false, error: "Link not found" }, { status: 404 });
    }

    const { data: taker, error: takerErr } = await sb
      .from("test_takers")
      .select("id, org_id, test_id, link_token, first_name, last_name, email, company, role_title, phone, created_at")
      .eq("id", tid)
      .eq("link_token", token)
      .maybeSingle();

    if (takerErr || !taker) {
      return NextResponse.json({ ok: false, error: "Taker not found for this token" }, { status: 404 });
    }

    const testId = taker.test_id || link.test_id;

    const { data: test, error: testErr } = await sb
      .from("tests")
      .select("id, org_id, name, slug, meta")
      .eq("id", testId)
      .maybeSingle();

    if (testErr || !test) {
      return NextResponse.json({ ok: false, error: "Test not found" }, { status: 404 });
    }

    const meta = test.meta && typeof test.meta === "object" ? test.meta : {};
    const isRhythmReport =
      meta?.has_rhythm_layer === true ||
      meta?.rhythm?.enabled === true ||
      String(meta?.report_layout || "") === "team_puzzle_rhythm_v1" ||
      String(meta?.variant || "") === "rhythm_edition";

    if (!isRhythmReport) {
      return NextResponse.json(
        { ok: false, error: "This test is not configured for the Team Puzzle RHYTHM report." },
        { status: 400 }
      );
    }

    const { data: org } = await sb
      .from("orgs")
      .select("id, slug, name, support_email, notification_email, website_url")
      .eq("id", taker.org_id || test.org_id || link.org_id)
      .maybeSingle();

    const { data: resultRow } = await sb
      .from("test_results")
      .select("taker_id, totals, created_at")
      .eq("taker_id", taker.id)
      .maybeSingle();

    const { data: latestSubmission } = await sb
      .from("test_submissions")
      .select("id, totals, created_at")
      .eq("taker_id", taker.id)
      .eq("test_id", testId)
      .eq("link_token", token)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const totals =
      (latestSubmission?.totals && typeof latestSubmission.totals === "object" ? latestSubmission.totals : null) ||
      (resultRow?.totals && typeof resultRow.totals === "object" ? resultRow.totals : null) ||
      {};

    const { data: rhythmResult } = await sb
      .from("rhythm_results")
      .select("*")
      .eq("taker_id", taker.id)
      .eq("test_id", testId)
      .eq("link_token", token)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: profileLabelRows } = await sb
      .from("test_profile_labels")
      .select("profile_code, profile_name, frequency_code")
      .eq("test_id", testId);

    const { data: frequencyLabelRows } = await sb
      .from("test_frequency_labels")
      .select("frequency_code, frequency_name")
      .eq("test_id", testId);

    const metaProfiles = getMetaProfiles(meta);
    const metaFrequencies = getMetaFrequencies(meta);

    const profileLabels: ProfileLabel[] =
      Array.isArray(profileLabelRows) && profileLabelRows.length
        ? profileLabelRows
            .map((p: any) => ({
              code: normaliseCode(p.profile_code),
              name: String(p.profile_name || "").trim(),
              frequency_code: ["A", "B", "C", "D"].includes(String(p.frequency_code || "").toUpperCase())
                ? (String(p.frequency_code).toUpperCase() as FrequencyCode)
                : null,
            }))
            .filter((p: ProfileLabel) => p.code && p.name)
        : metaProfiles.length
          ? metaProfiles
          : DEFAULT_PROFILE_LABELS;

    const frequencyLabels: FrequencyLabel[] =
      Array.isArray(frequencyLabelRows) && frequencyLabelRows.length
        ? frequencyLabelRows
            .map((f: any) => ({
              code: String(f.frequency_code || "").trim().toUpperCase() as FrequencyCode,
              name: String(f.frequency_name || "").trim(),
            }))
            .filter((f: FrequencyLabel) => ["A", "B", "C", "D"].includes(f.code) && f.name)
        : metaFrequencies.length
          ? metaFrequencies
          : DEFAULT_FREQUENCY_LABELS;

    const rawFrequencies = (totals as any)?.frequencies || {};
    const rawProfiles = (totals as any)?.profiles || {};

    const frequencyPercentages = pctMap(rawFrequencies, ["A", "B", "C", "D"] as FrequencyCode[]);
    const profilePercentages = profilePctMap(rawProfiles, profileLabels);
    const topFreq = getTopFrequency(frequencyPercentages);
    const sortedProfiles = sortProfiles(profileLabels, profilePercentages);
    const topProfile = sortedProfiles[0] || profileLabels[0] || DEFAULT_PROFILE_LABELS[0];
    const secondaryProfile = sortedProfiles[1] || null;
    const tertiaryProfile = sortedProfiles[2] || null;

    const linkMeta: LinkMeta = {
      show_results: link.show_results ?? true,
      redirect_url: link.redirect_url ?? null,
      hidden_results_message: link.hidden_results_message ?? null,
      next_steps_url: link.next_steps_url ?? null,
      email_report: link.email_report ?? false,
    };

    const publicViewer = src !== "portal";
    if (publicViewer && linkMeta.show_results === false) {
      return NextResponse.json({
        ok: true,
        data: {
          hidden: true,
          link: linkMeta,
          taker,
          test,
          org,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        org: {
          id: org?.id ?? taker.org_id ?? null,
          slug: org?.slug ?? meta?.orgSlug ?? "team-puzzle",
          name: org?.name ?? "Life Puzzle",
          support_email: org?.support_email ?? null,
          website_url: org?.website_url ?? null,
        },
        test: {
          id: test.id,
          name: test.name,
          slug: test.slug,
          meta,
        },
        link: linkMeta,
        taker,
        submission: latestSubmission
          ? { id: latestSubmission.id, created_at: latestSubmission.created_at }
          : null,
        result: {
          totals,
          raw_frequencies: rawFrequencies,
          raw_profiles: rawProfiles,
          frequency_labels: frequencyLabels,
          frequency_percentages: frequencyPercentages,
          profile_labels: profileLabels,
          profile_percentages: profilePercentages,
          top_freq: topFreq,
          top_freq_name: frequencyLabels.find((f) => f.code === topFreq)?.name || topFreq,
          top_profile_code: topProfile.code,
          top_profile_name: topProfile.name,
          sorted_profiles: sortedProfiles,
          secondary_profile: secondaryProfile,
          tertiary_profile: tertiaryProfile,
        },
        rhythm: rhythmResult
          ? {
              id: rhythmResult.id,
              driver_raw_scores: rhythmResult.driver_raw_scores || {},
              driver_percentages: rhythmResult.driver_percentages || {},
              ranked_drivers: safeArray(rhythmResult.ranked_drivers),
              flow_drivers: safeArray(rhythmResult.flow_drivers),
              stabilising_drivers: safeArray(rhythmResult.stabilising_drivers),
              frustration_drivers: safeArray(rhythmResult.frustration_drivers),
              primary_driver: rhythmResult.primary_driver ?? null,
              secondary_driver: rhythmResult.secondary_driver ?? null,
              meta: rhythmResult.meta || {},
              created_at: rhythmResult.created_at ?? null,
            }
          : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err || "Unexpected error") },
      { status: 500 }
    );
  }
}

