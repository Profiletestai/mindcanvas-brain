//apps/web/app/api/public/test/[token]/report/route.ts
/* eslint-disable no-console */
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { loadFrameworkBySlug, buildLookups, type FrequencyCode } from "@/lib/frameworks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- Types ---
type AB = "A" | "B" | "C" | "D";

type AnswerShape =
  | { question_id: string; value: number | string }
  | { question_id: string; index: number | string }
  | { question_id: string; selected: number | string }
  | { question_id: string; selected_index: number | string }
  | { question_id: string; text: string };

type MapEntry = { points: number; profile: string };

type QuestionMapRow = {
  id: string;
  idx: number | null;
  category: string | null;
  profile_map: MapEntry[] | null;
  weights: any | null;
};

type QualQuestionRow = {
  id: string;
  idx: number | null;
  category: string | null;
  type: string | null;
  text: string | null;
  options: any | null;
  weights: any | null;
};

type SubmissionRow = {
  id: string;
  taker_id: string;
  link_token: string | null;
  totals: any | null;
  answers_json: AnswerShape[] | null;
  created_at: string;
};

type LinkMeta = {
  test_id: string;
  org_slug: string | null;
  test_name: string | null;

  org_name?: string | null;
  org_logo_url?: string | null;

  link_meta?: any | null;
};

type ReportFrameworkMeta = {
  bucket?: string;
  path?: string;
  version?: string;
};

type TestMeta = {
  orgSlug?: string;
  test?: string;

  report_engine?: string;

  framework_id?: string;
  frameworkId?: string;
  framework_slug?: string;
  frameworkSlug?: string;

  report_framework_key?: string;
  report_framework_bucket?: string;
  report_framework_version?: string;

  reportFramework?: ReportFrameworkMeta;

  frequencies?: Array<{ code: AB; label: string }>;
  profiles?: Array<{ code: string; name: string; frequency?: AB; description?: string }>;

  wrapper?: boolean;
  source_test_id?: string;
  default_source_test?: string;
  source_tests?: string[];
};

type TestRow = {
  id: string;
  slug: string | null;
  name: string | null;
  meta: any | null;
  org_id?: string | null;
  report_layout_template_id?: string | null;
};

type TakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ReportSectionBlock =
  | { type: "p"; text?: string }
  | { type: "ul"; items?: string[] }
  | { type: "ol"; items?: string[] }
  | { type: "quote"; text?: string; cite?: string }
  | { type: "divider" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | {
      type: "image";
      src?: string;
      alt?: string;
      caption?: string;
      align?: "left" | "center" | "right";
      max_h?: number;
    }
  | { type: string; [k: string]: any };

type ReportSection = {
  id?: string;
  title?: string;
  blocks?: ReportSectionBlock[];
};

type SectionsPayload = {
  common?: ReportSection[] | null;
  profile?: ReportSection[] | null;

  report_title?: string | null;
  profile_missing?: boolean;

  framework_version?: string | null;
  framework_bucket?: string | null;
  framework_path?: string | null;

  framework_id?: string | null;
  framework_slug?: string | null;
};

type LayoutSection = { key: string; scope: "global" | "profile" };

// ---------------- utils ----------------

function safeNumber(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (x == null) return "";
  return String(x);
}

function titleCaseWords(s: string) {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toPercentages<T extends string>(totals: Partial<Record<T, number>>): Record<T, number> {
  const vals = Object.values(totals || {}) as number[];
  const sum = vals.reduce((a, b) => a + (Number(b) || 0), 0);
  const out: Record<string, number> = {};
  for (const k of Object.keys(totals || {})) {
    const v = Number((totals as any)[k] || 0);
    out[k] = sum > 0 ? v / sum : 0;
  }
  return out as Record<T, number>;
}

function normalizeProfileCode(input: any): string {
  const s = String(input || "").trim().toUpperCase();
  const m = s.match(/^P(?:ROFILE)?[_\s-]?([1-8])$/i);
  if (m) return `P${m[1]}`;
  return s;
}

function legacyProfileCode(input: any): string {
  const p = normalizeProfileCode(input);
  const m = p.match(/^P([1-8])$/i);
  return m ? `PROFILE_${m[1]}` : p;
}

function getLookProfileName(look: any, code: string): string | undefined {
  const normalized = normalizeProfileCode(code);
  return (
    look.profileByCode.get(normalized)?.name ||
    look.profileByCode.get(legacyProfileCode(normalized))?.name
  );
}

function profileCodeToAB(pcode: string): AB | null {
  const pc = normalizeProfileCode(pcode);
  const m = pc.match(/^P([1-8])$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 2) return "A";
  if (n <= 4) return "B";
  if (n <= 6) return "C";
  return "D";
}

function selectedIndex(a: any): number {
  const raw = a?.value ?? a?.index ?? a?.selected ?? a?.selected_index ?? undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (a?.value != null) return Math.max(0, n - 1);
    return Math.max(0, n);
  }
  return 0;
}

function resolveWeightedPoints(answer: any, weights: Record<string, any>): number | null {
  const raw =
    answer?.value ??
    answer?.selected ??
    answer?.selected_index ??
    answer?.index ??
    answer?.text ??
    null;

  if (raw == null) return null;

  const exactKey = String(raw);
  if (Object.prototype.hasOwnProperty.call(weights, exactKey)) {
    const pts = Number(weights[exactKey]);
    return Number.isFinite(pts) ? pts : null;
  }

  const n = Number(raw);
  if (Number.isFinite(n)) {
    const plusOne = String(n + 1);
    if (Object.prototype.hasOwnProperty.call(weights, plusOne)) {
      const pts = Number(weights[plusOne]);
      return Number.isFinite(pts) ? pts : null;
    }
  }

  return null;
}

function computeSecondaryMetrics(
  answers: AnswerShape[] | null | undefined,
  qmap: Map<string, QuestionMapRow>
) {
  const ansList = Array.isArray(answers) ? answers : [];
  const ansByQid = new Map<string, any>();

  for (const a of ansList) {
    const qid = (a as any)?.question_id;
    if (qid) ansByQid.set(String(qid), a);
  }

  let raw_score = 0;
  let min_score = 0;
  let max_score = 0;
  let eligible_count = 0;
  let answered_count = 0;

  for (const row of qmap.values()) {
    const hasProfileMap = Array.isArray(row.profile_map) && row.profile_map.length > 0;
    const weights = row.weights && typeof row.weights === "object" ? row.weights : null;

    if (hasProfileMap) continue;
    if (!weights || Array.isArray(weights)) continue;

    const numericValues = Object.values(weights)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    if (numericValues.length === 0) continue;

    eligible_count += 1;
    min_score += Math.min(...numericValues);
    max_score += Math.max(...numericValues);

    const answer = ansByQid.get(String(row.id));
    if (!answer) continue;

    const pts = resolveWeightedPoints(answer, weights);
    if (pts == null) continue;

    raw_score += pts;
    answered_count += 1;
  }

  const percentage =
    answered_count > 0 && max_score > min_score
      ? Math.round(((raw_score - min_score) / (max_score - min_score)) * 100)
      : 0;

  return {
    raison_detre: {
      raw_score,
      percentage,
      eligible_count,
      answered_count,
    },
  };
}

function coerceMapEntries(x: any): MapEntry[] {
  if (Array.isArray(x)) {
    return x
      .map((e) => ({
        points: safeNumber((e as any)?.points, 0),
        profile: normalizeProfileCode((e as any)?.profile),
      }))
      .filter((e) => e.points > 0 && !!e.profile);
  }

  if (x && typeof x === "object") {
    const maybe =
      (x as any)?.profile_map ||
      (x as any)?.weights ||
      (x as any)?.map ||
      (x as any)?.options ||
      null;
    if (Array.isArray(maybe)) return coerceMapEntries(maybe);
  }

  return [];
}

function computeFromAnswers(answers: AnswerShape[] | null | undefined, qmap: Map<string, QuestionMapRow>) {
  const freqTotals: Record<AB, number> = { A: 0, B: 0, C: 0, D: 0 };
  const profileTotals: Record<string, number> = {};

  if (!Array.isArray(answers) || answers.length === 0) {
    return { freqTotals, profileTotals, used: "none" as const };
  }

  let usedAny = false;

  for (const a of answers) {
    const qid = (a as any)?.question_id;
    if (!qid) continue;

    const row = qmap.get(String(qid));
    if (!row) continue;

    const pm = coerceMapEntries(row.profile_map);
    const entries = pm.length > 0 ? pm : coerceMapEntries(row.weights);
    if (!Array.isArray(entries) || entries.length === 0) continue;

    const sel = selectedIndex(a);
    const entry = entries[sel];
    if (!entry) continue;

    const pts = safeNumber(entry.points, 0);
    const pcode = normalizeProfileCode(entry.profile);
    if (pts <= 0 || !pcode) continue;

    usedAny = true;

    profileTotals[pcode] = (profileTotals[pcode] || 0) + pts;
    const ab = profileCodeToAB(pcode);
    if (ab) freqTotals[ab] = (freqTotals[ab] || 0) + pts;
  }

  return { freqTotals, profileTotals, used: usedAny ? ("qmap" as const) : ("none" as const) };
}

function readSavedTotals(totals: any) {
  const raw = totals && typeof totals === "object" ? totals : {};

  const nestedFreq =
    raw?.frequencies && typeof raw.frequencies === "object" ? raw.frequencies : null;
  const nestedProfiles =
    raw?.profiles && typeof raw.profiles === "object" ? raw.profiles : null;

  const freqSrc = nestedFreq || raw;
  const freqTotals: Record<AB, number> = {
    A: safeNumber(freqSrc?.A, 0),
    B: safeNumber(freqSrc?.B, 0),
    C: safeNumber(freqSrc?.C, 0),
    D: safeNumber(freqSrc?.D, 0),
  };
  const freqSum = freqTotals.A + freqTotals.B + freqTotals.C + freqTotals.D;

  const profSrc = nestedProfiles || raw;
  const profileTotals: Record<string, number> = {};
  for (const [k, v] of Object.entries(profSrc || {})) {
    const key = normalizeProfileCode(k);
    if (/^P[1-8]$/i.test(key)) profileTotals[key] = safeNumber(v, 0);
  }
  const profileSum = Object.values(profileTotals).reduce((a, b) => a + (Number(b) || 0), 0);

  const raison = raw?.secondary_scores?.raison_detre || raw?.raison_detre || null;

  const meta = raw?.meta && typeof raw.meta === "object" ? raw.meta : null;
  const wrapper_test_id = typeof meta?.wrapper_test_id === "string" ? meta.wrapper_test_id : null;
  const effective_test_id = typeof meta?.effective_test_id === "string" ? meta.effective_test_id : null;

  return {
    freqTotals,
    freqSum,
    profileTotals,
    profileSum,
    raison_detre: {
      raw_score: safeNumber(raison?.raw_score ?? raw?.raison_detre_raw_score, 0),
      percentage: safeNumber(raison?.percentage ?? raw?.raison_detre_percentage, 0),
      eligible_count: safeNumber(raison?.eligible_count, 0),
      answered_count: safeNumber(raison?.answered_count, 0),
    },
    wrapper_test_id,
    effective_test_id,
    shape: nestedFreq || nestedProfiles ? ("nested" as const) : ("flat" as const),
  };
}

/**
 * Portal viewer should ignore redirect behavior, but should still receive
 * next_steps_url so the report can render the CTA button.
 */
function sanitizeLinkMetaForPortal(linkMeta: any) {
  const link = linkMeta && typeof linkMeta === "object" ? { ...linkMeta } : {};

  if ("redirect_url" in link) link.redirect_url = null;
  if ("redirectUrl" in link) link.redirectUrl = null;

  if ("show_results" in link) link.show_results = true;
  if ("showResults" in link) link.showResults = true;

  if (link?.meta && typeof link.meta === "object") {
    const m = { ...link.meta };
    if ("redirect_url" in m) m.redirect_url = null;
    if ("redirectUrl" in m) m.redirectUrl = null;
    if ("show_results" in m) m.show_results = true;
    if ("showResults" in m) m.showResults = true;
    link.meta = m;
  }

  return link;
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );
}

// --- Supabase client (admin) ---
function sbAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("SUPABASE_URL is required (or NEXT_PUBLIC_SUPABASE_URL).");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (or an anon key fallback).");

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "portal" },
  });
}

// ✅ Resolve org/test for a token
async function resolveLinkMeta(token: string): Promise<LinkMeta | null> {
  const sb = sbAdmin();

  const q = await sb
    .from("test_links")
    .select(
      `
      test_id,
      token,
      org_id,
      show_results,
      redirect_url,
      hidden_results_message,
      next_steps_url,
      email_report,

      orgs:orgs!fk_test_links_org ( slug, name, logo_url ),

      tests:tests (
        id,
        name,
        org_id,
        slug
      )
    `
    )
    .eq("token", token)
    .limit(1)
    .maybeSingle();

  if (q.error || !q.data?.test_id) return null;

  const testName = (q.data as any)?.tests?.name ?? null;
  const org = (q.data as any)?.orgs ?? null;

  const orgSlug = org?.slug ?? null;
  const orgName = org?.name ?? null;
  const orgLogoUrl = org?.logo_url ?? null;

  const link_meta = {
    show_results: (q.data as any)?.show_results ?? true,
    redirect_url: ((q.data as any)?.redirect_url as string | null) ?? null,
    hidden_results_message: ((q.data as any)?.hidden_results_message as string | null) ?? null,
    next_steps_url: ((q.data as any)?.next_steps_url as string | null) ?? null,
    email_report: ((q.data as any)?.email_report as boolean | null) ?? false,
  };

  return {
    test_id: q.data.test_id,
    org_slug: orgSlug,
    test_name: testName,
    org_name: orgName,
    org_logo_url: orgLogoUrl,
    link_meta,
  };
}

async function fetchLatestSubmission(
  taker_id: string,
  token: string
): Promise<{ row: SubmissionRow | null; matched: "token" | "null" | "none" }> {
  const sb = sbAdmin();

  const strict = await sb
    .from("test_submissions")
    .select("id, taker_id, link_token, totals, answers_json, created_at")
    .eq("taker_id", taker_id)
    .eq("link_token", token)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!strict.error && strict.data) return { row: strict.data as SubmissionRow, matched: "token" };

  const legacy = await sb
    .from("test_submissions")
    .select("id, taker_id, link_token, totals, answers_json, created_at")
    .eq("taker_id", taker_id)
    .is("link_token", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!legacy.error && legacy.data) return { row: legacy.data as SubmissionRow, matched: "null" };

  return { row: null, matched: "none" };
}

async function fetchQuestionMaps(test_id: string): Promise<Map<string, QuestionMapRow>> {
  const sb = sbAdmin();

  const q = (await sb
    .from("test_questions")
    .select("id, idx, category, profile_map, weights")
    .eq("test_id", test_id)
    .order("idx", { ascending: true })) as PostgrestSingleResponse<QuestionMapRow[]>;

  if (q.error || !Array.isArray(q.data)) return new Map();
  const map = new Map<string, QuestionMapRow>();
  for (const row of q.data) map.set(row.id, row);
  return map;
}

async function fetchQualQuestions(test_id: string): Promise<QualQuestionRow[]> {
  const sb = sbAdmin();
  const q = await sb
    .from("test_questions")
    .select("id, idx, category, type, text, options, weights")
    .eq("test_id", test_id)
    .eq("category", "qual")
    .order("idx", { ascending: true });

  if (q.error || !Array.isArray(q.data)) return [];
  return q.data as QualQuestionRow[];
}

async function fetchDbLabels(test_id: string): Promise<{
  freqs: Array<{ code: AB; name: string }>;
  profiles: Array<{ code: string; name: string; frequency_code?: AB | null }>;
}> {
  const sb = sbAdmin();

  const freqsRes = await sb
    .from("test_frequency_labels")
    .select("frequency_code, frequency_name")
    .eq("test_id", test_id);

  const profRes = await sb
    .from("test_profile_labels")
    .select("profile_code, profile_name, frequency_code")
    .eq("test_id", test_id);

  const freqs =
    Array.isArray(freqsRes.data)
      ? (freqsRes.data as any[]).map((r) => ({
          code: String(r.frequency_code || "").toUpperCase() as AB,
          name: String(r.frequency_name || ""),
        }))
      : [];

  const profiles =
    Array.isArray(profRes.data)
      ? (profRes.data as any[]).map((r) => ({
          code: normalizeProfileCode(r.profile_code),
          name: String(r.profile_name || ""),
          frequency_code: r.frequency_code
            ? (String(r.frequency_code).toUpperCase() as AB)
            : null,
        }))
      : [];

  return { freqs, profiles };
}

async function fetchTestRow(test_id: string): Promise<TestRow | null> {
  const sb = sbAdmin();
  const q = await sb
    .from("tests")
    .select("id, slug, name, meta, org_id, report_layout_template_id")
    .eq("id", test_id)
    .maybeSingle();

  if (q.error || !q.data) return null;
  return q.data as TestRow;
}

async function fetchTakerRow(taker_id: string): Promise<TakerRow | null> {
  const sb = sbAdmin();
  const q = await sb
    .from("test_takers")
    .select("id, first_name, last_name")
    .eq("id", taker_id)
    .maybeSingle();

  if (q.error || !q.data) return null;
  return q.data as TakerRow;
}

async function downloadFrameworkJSON(bucket: string, path: string): Promise<any | null> {
  const sb = sbAdmin();
  const { data, error } = await sb.storage.from(bucket).download(path);

  if (error || !data) {
    console.log("Storage framework download failed:", { bucket, path, error: error?.message });
    return null;
  }

  const text = await data.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log("Storage framework JSON parse failed:", { bucket, path });
    return null;
  }
}

function parseSupabaseStorageRef(input: string, fallbackBucket = "framework") {
  const raw = String(input || "").trim();
  if (!raw) return { bucket: fallbackBucket, path: "" };

  try {
    const url = new URL(raw);
    const marker = "/storage/v1/object/public/";
    const idx = url.pathname.indexOf(marker);

    if (idx >= 0) {
      const rest = decodeURIComponent(url.pathname.slice(idx + marker.length));
      const parts = rest.split("/").filter(Boolean);
      const bucket = parts.shift() || fallbackBucket;
      const path = parts.join("/");
      return { bucket, path };
    }
  } catch {
    // Not a URL. Treat as a bucket path.
  }

  let path = raw.replace(/^\/+/, "");
  const bucketPrefix = `${fallbackBucket}/`;
  if (path.startsWith(bucketPrefix)) path = path.slice(bucketPrefix.length);

  return { bucket: fallbackBucket, path };
}

function resolveStorageFramework(testMeta: TestMeta | null | undefined) {
  const meta = (testMeta || {}) as any;

  const key = typeof meta.report_framework_key === "string" ? meta.report_framework_key.trim() : "";
  const bucketOverride =
    typeof meta.report_framework_bucket === "string" ? meta.report_framework_bucket.trim() : "";

  if (key) {
    const parsed = parseSupabaseStorageRef(key, bucketOverride || "framework");
    return {
      use: true as const,
      bucket: parsed.bucket,
      path: parsed.path,
      version:
        typeof meta.report_framework_version === "string" ? meta.report_framework_version : null,
      source: "meta.report_framework_key" as const,
    };
  }

  const rf: ReportFrameworkMeta | null = meta?.reportFramework || null;
  const rawBucket = typeof rf?.bucket === "string" ? rf.bucket.trim() : "";
  const rawPath = typeof rf?.path === "string" ? rf.path.trim() : "";

  if (rawPath) {
    const parsed = parseSupabaseStorageRef(rawPath, rawBucket || "framework");
    return {
      use: true as const,
      bucket: parsed.bucket,
      path: parsed.path,
      version: typeof rf?.version === "string" ? rf.version : null,
      source: "meta.reportFramework" as const,
    };
  }

  return {
    use: false as const,
    bucket: "",
    path: "",
    version: null as any,
    source: "none" as const,
  };
}

function normalizeReportSectionArray(input: any): ReportSection[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((section: any, index: number) => {
      const s = section && typeof section === "object" ? section : {};
      const blocks = Array.isArray(s.blocks) ? (s.blocks as ReportSectionBlock[]) : [];
      const title = safeText(s.title).trim();
      const id = safeText(s.id).trim() || (title ? sectionTitleToSafeId(title) : `section-${index + 1}`);

      return {
        id,
        title: title || `Section ${index + 1}`,
        blocks,
      } as ReportSection;
    })
    .filter((section) => safeText(section.title).trim() || Array.isArray(section.blocks));
}

function sectionTitleToSafeId(title: string) {
  return safeText(title)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function findProfilePayloadInStorageFramework(fw: any, topProfileCode: string, topProfileName: string) {
  const code = normalizeProfileCode(topProfileCode || "P1");
  const legacy = legacyProfileCode(code);
  const name = safeText(topProfileName).toLowerCase();

  const profilesObj =
    fw?.profiles && typeof fw.profiles === "object" && !Array.isArray(fw.profiles)
      ? fw.profiles
      : null;

  if (profilesObj) {
    const direct = profilesObj[code] || profilesObj[legacy] || profilesObj[String(code).toLowerCase()];
    if (direct) return direct;

    for (const value of Object.values(profilesObj)) {
      const v = value && typeof value === "object" ? (value as any) : null;
      if (!v) continue;

      const candidateCode = normalizeProfileCode(v.profile_code || v.code || v.id || "");
      const candidateName = safeText(v.profile_name || v.name || v.title).toLowerCase();

      if (candidateCode === code || (!!name && candidateName.includes(name))) return v;
    }
  }

  const profileList = Array.isArray(fw?.profile) ? fw.profile : [];
  for (const item of profileList) {
    const v = item && typeof item === "object" ? item : null;
    if (!v) continue;

    const candidateCode = normalizeProfileCode((v as any).profile_code || (v as any).code || (v as any).id || "");
    const candidateTitle = safeText((v as any).profile_name || (v as any).name || (v as any).title).toLowerCase();

    if (candidateCode === code || (!!name && candidateTitle.includes(name))) return v;
  }

  return null;
}

function buildStorageFrameworkSections(opts: {
  fw: any;
  top_profile_code: string;
  top_profile_name: string;
  tokenCtx: Record<string, string>;
  frameworkId: string;
  bucket: string | null;
  path: string | null;
  version: string | null;
}): SectionsPayload | null {
  const fw = opts.fw && typeof opts.fw === "object" ? opts.fw : null;
  if (!fw) return null;

  const common = normalizeReportSectionArray(fw.common);
  const selectedProfilePayload = findProfilePayloadInStorageFramework(
    fw,
    opts.top_profile_code,
    opts.top_profile_name
  );

  let profile: ReportSection[] = [];
  if (selectedProfilePayload) {
    if (Array.isArray((selectedProfilePayload as any).sections)) {
      profile = normalizeReportSectionArray((selectedProfilePayload as any).sections);
    } else if (Array.isArray((selectedProfilePayload as any).blocks)) {
      profile = normalizeReportSectionArray([selectedProfilePayload]);
    }
  }

  if (common.length === 0 && profile.length === 0) return null;

  const replaced = replaceTokensDeep(
    {
      common,
      profile,
    },
    opts.tokenCtx
  ) as { common: ReportSection[]; profile: ReportSection[] };

  return {
    common: replaced.common,
    profile: replaced.profile,
    report_title: safeText(fw.report_title).trim() || null,
    profile_missing: replaced.profile.length === 0,
    framework_version:
      safeText(fw?.meta?.version).trim() ||
      safeText(fw.version).trim() ||
      opts.version ||
      null,
    framework_bucket: opts.bucket,
    framework_path: opts.path,
    framework_id: opts.frameworkId || null,
    framework_slug:
      safeText(fw?.meta?.framework).trim() ||
      safeText(fw.framework_slug).trim() ||
      safeText(fw.slug).trim() ||
      null,
  };
}

// ---------- report_blocks + layout templates ----------

type BlockRow = {
  block_key: string;
  entity_type: string;
  entity_code: string | null;
  version: string;
  status: string;
  content_json: any;
};

async function fetchLayoutSections(layoutId: string | null | undefined): Promise<LayoutSection[]> {
  if (!layoutId) return [];
  const sb = sbAdmin();
  const q = await sb
    .from("report_layout_templates")
    .select("id, sections_json")
    .eq("id", layoutId)
    .maybeSingle();

  if (q.error || !q.data) return [];
  const sections = (q.data as any)?.sections_json;
  if (!Array.isArray(sections)) return [];
  return sections
    .map((s: any) => ({
      key: String(s?.key || "").trim(),
      scope:
        (String(s?.scope || "global").trim().toLowerCase() === "profile"
          ? "profile"
          : "global") as "global" | "profile",
    }))
    .filter((s) => !!s.key);
}

async function fetchBlocksForKeys(opts: {
  keys: string[];
  entity_type: "global" | "profile";
  entity_code: string;
}) {
  const sb = sbAdmin();
  const keys = opts.keys.filter(Boolean);
  if (keys.length === 0) return new Map<string, BlockRow>();

  const q = await sb
    .from("report_blocks")
    .select("block_key, entity_type, entity_code, version, status, content_json, created_at")
    .eq("entity_type", opts.entity_type)
    .eq("entity_code", opts.entity_code)
    .eq("status", "active")
    .in("block_key", keys);

  if (q.error || !Array.isArray(q.data)) return new Map<string, BlockRow>();

  const map = new Map<string, BlockRow>();
  for (const r of q.data as any[]) {
    const key = String(r.block_key || "");
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) map.set(key, r as BlockRow);
    else if (String(r.version || "") > String(prev.version || "")) map.set(key, r as BlockRow);
  }
  return map;
}

// ---------- framework_content_blocks ----------

type FrameworkRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  version: string;
  status: string;
  structure_json: any;
};

type FrameworkBlockRow = {
  block_key: string;
  entity_type: "global" | "profile" | "frequency";
  entity_code: string | null;
  version: string;
  status: string;
  content_json: any;
};

async function fetchFrameworkById(frameworkId: string): Promise<FrameworkRow | null> {
  const sb = sbAdmin();
  const q = await sb
    .from("frameworks")
    .select("id, slug, name, type, version, status, structure_json")
    .eq("id", frameworkId)
    .maybeSingle();

  if (q.error || !q.data) return null;
  return q.data as any;
}

async function fetchFrameworkBlocksForKeys(opts: {
  framework_id: string;
  keys: string[];
  entity_type: "global" | "profile";
  entity_code: string | null;
}) {
  const sb = sbAdmin();
  const keys = opts.keys.filter(Boolean);
  if (keys.length === 0) return new Map<string, FrameworkBlockRow>();

  let q = sb
    .from("framework_content_blocks")
    .select(
      "block_key, entity_type, entity_code, version, status, content_json, created_at, updated_at"
    )
    .eq("framework_id", opts.framework_id)
    .eq("entity_type", opts.entity_type)
    .eq("status", "active")
    .in("block_key", keys);

  if (opts.entity_code == null) q = q.is("entity_code", null);
  else q = q.eq("entity_code", opts.entity_code);

  const res = await q;
  if (res.error || !Array.isArray(res.data)) return new Map<string, FrameworkBlockRow>();

  const map = new Map<string, any>();
  for (const r of res.data as any[]) {
    const key = String(r.block_key || "");
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) map.set(key, r);
    else {
      const pv = String(prev.version || "");
      const nv = String(r.version || "");
      if (nv > pv) map.set(key, r);
      else if (nv === pv) {
        const pAt = new Date(prev.updated_at || prev.created_at || 0).getTime();
        const nAt = new Date(r.updated_at || r.created_at || 0).getTime();
        if (nAt > pAt) map.set(key, r);
      }
    }
  }
  return map as any;
}

function replaceTokensDeep<T>(x: T, ctx: Record<string, string>): T {
  const walk = (v: any): any => {
    if (typeof v === "string") {
      let s = v;
      for (const [k, val] of Object.entries(ctx)) s = s.split(`{{${k}}}`).join(val);
      return s;
    }
    if (Array.isArray(v)) return v.map((it) => walk(it));
    if (v && typeof v === "object") {
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(x) as T;
}

function contentJsonToSection(content_json: any, fallbackTitle?: string): { title?: string; blocks: ReportSectionBlock[] } {
  const cj = content_json && typeof content_json === "object" ? content_json : {};
  if (Array.isArray(cj.blocks))
    return {
      title: safeText(cj.title) || fallbackTitle,
      blocks: cj.blocks as ReportSectionBlock[],
    };

  const blocks: ReportSectionBlock[] = [];
  const core = safeText((cj as any).core_identity || "").trim();
  if (core) blocks.push({ type: "p", text: core });
  const desc = safeText((cj as any).description || "").trim();
  if (desc) blocks.push({ type: "p", text: desc });
  return { title: safeText((cj as any).title) || fallbackTitle, blocks };
}

function buildSegmentationSection(qualQs: QualQuestionRow[], answers: AnswerShape[] | null | undefined) {
  const ansList = Array.isArray(answers) ? answers : [];
  const ansByQid = new Map<string, any>();
  for (const a of ansList) {
    const qid = (a as any)?.question_id;
    if (qid) ansByQid.set(String(qid), a);
  }

  const rows: string[] = [];

  for (const q of qualQs) {
    const w = q.weights && typeof q.weights === "object" ? q.weights : {};
    const captureKey = safeText((w as any).capture_key || "").trim() || `S${q.idx ?? ""}`.trim();
    const a = ansByQid.get(q.id);

    let answerText = "";
    if (String(q.type || "").toLowerCase() === "text") {
      answerText =
        safeText((a as any)?.text) ||
        safeText((a as any)?.value) ||
        safeText((a as any)?.answer) ||
        "";
    } else {
      const opts = Array.isArray(q.options) ? q.options : [];
      const sel = selectedIndex(a);
      const picked = (opts as any[])[sel];
      answerText = safeText(picked);
      if (!answerText && (a as any) != null) {
        answerText = safeText((a as any)?.value ?? (a as any)?.selected ?? "");
      }
    }

    const line = `${captureKey}: ${answerText || "—"}`;
    if (answerText) rows.push(line);
  }

  if (rows.length === 0) return null;

  return {
    id: "segmentation-responses",
    title: "Your responses",
    blocks: [
      { type: "p", text: "These are the answers you provided to the initial questions." },
      { type: "ul", items: rows },
    ],
  };
}

const GLOBAL_POST_PROFILE_KEYS = new Set<string>(["global.conclusion", "global.cta_next_steps"]);

// -------- wrapper resolution --------

function resolveSourceTestIdFromMeta(meta: any): string | null {
  const m = meta && typeof meta === "object" ? meta : {};

  const direct =
    typeof m.default_source_test === "string"
      ? m.default_source_test
      : typeof m.source_test_id === "string"
      ? m.source_test_id
      : null;

  if (direct && isUuidLike(direct)) return direct;

  if (Array.isArray(m.source_tests)) {
    const first = m.source_tests.find((x: any) => typeof x === "string" && isUuidLike(x));
    if (first) return first;
  }

  return null;
}

async function resolveEffectiveTestRow(opts: {
  wrapperTestRow: TestRow | null;
  savedEffectiveTestId?: string | null;
}) {
  const wrapperTestRow = opts.wrapperTestRow;
  if (!wrapperTestRow) {
    return {
      effectiveTestId: null,
      effectiveTestRow: null,
      resolvedBy: "no_wrapper_test",
    };
  }

  const savedId = String(opts.savedEffectiveTestId || "").trim();
  if (savedId && isUuidLike(savedId)) {
    const savedRow = await fetchTestRow(savedId);
    if (savedRow) {
      return {
        effectiveTestId: savedRow.id,
        effectiveTestRow: savedRow,
        resolvedBy: "submission.meta.effective_test_id",
      };
    }
  }

  const wrapperMeta = (wrapperTestRow.meta || {}) as TestMeta;
  const fromMeta = resolveSourceTestIdFromMeta(wrapperMeta);
  if (fromMeta) {
    const sourceRow = await fetchTestRow(fromMeta);
    if (sourceRow) {
      return {
        effectiveTestId: sourceRow.id,
        effectiveTestRow: sourceRow,
        resolvedBy: "wrapper.meta.source",
      };
    }
  }

  return {
    effectiveTestId: wrapperTestRow.id,
    effectiveTestRow: wrapperTestRow,
    resolvedBy: "wrapper_self",
  };
}

// ---------------- Handler ----------------

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const token = params.token;
    const takerId = searchParams.get("tid");

    const src = (searchParams.get("src") || "").trim().toLowerCase();
    const isPortalViewer = src === "portal";

    if (!takerId) {
      return NextResponse.json({ ok: false, error: "Missing tid" }, { status: 400 });
    }

    const meta = await resolveLinkMeta(token);
    if (!meta) {
      return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 404 });
    }

    const wrapperTestRow = await fetchTestRow(meta.test_id);
    const wrapperTestMeta = (wrapperTestRow?.meta || {}) as TestMeta;

    const subRes = await fetchLatestSubmission(takerId, token);
    const sub = subRes.row;
    if (!sub) {
      return NextResponse.json(
        { ok: false, error: "Submission not found for this taker/token." },
        { status: 404 }
      );
    }

    const savedRead = readSavedTotals(sub.totals);

    const effectiveResolved = await resolveEffectiveTestRow({
      wrapperTestRow,
      savedEffectiveTestId: savedRead.effective_test_id,
    });

    const effectiveTestRow = effectiveResolved.effectiveTestRow || wrapperTestRow;
    const effectiveTestId = effectiveResolved.effectiveTestId || wrapperTestRow?.id || meta.test_id;
    const effectiveTestMeta = ((effectiveTestRow?.meta || {}) as TestMeta) || {};

    const testMeta = {
      ...effectiveTestMeta,
      ...wrapperTestMeta,
    } as TestMeta;

    const frameworkId =
      (typeof wrapperTestMeta?.framework_id === "string" && wrapperTestMeta.framework_id.trim()) ||
      (typeof (wrapperTestMeta as any)?.frameworkId === "string" &&
        (wrapperTestMeta as any).frameworkId.trim()) ||
      (typeof effectiveTestMeta?.framework_id === "string" && effectiveTestMeta.framework_id.trim()) ||
      (typeof (effectiveTestMeta as any)?.frameworkId === "string" &&
        (effectiveTestMeta as any).frameworkId.trim()) ||
      "";

    const storageChoice = (() => {
      const wrapperChoice = resolveStorageFramework(wrapperTestMeta);
      if (wrapperChoice.use) return wrapperChoice;
      return resolveStorageFramework(effectiveTestMeta);
    })();

    const useStorageFramework = storageChoice.use;

    const slugLower = String(wrapperTestRow?.slug || "").toLowerCase();
    const nameLower = String(wrapperTestRow?.name || "").toLowerCase();
    const storagePathLower = String(storageChoice.path || "").toLowerCase();

    const isOperatingFrame =
      storagePathLower.startsWith("operatingframe/") ||
      storagePathLower.includes("/operatingframe/") ||
      slugLower.includes("operatingframe") ||
      nameLower.includes("operatingframe");

    const reportEngine =
      String(wrapperTestMeta?.report_engine || "").trim() ||
      String(effectiveTestMeta?.report_engine || "").trim();

    const useBlocksEngine = !isOperatingFrame && reportEngine === "native_v2_blocks";

    const orgSlug = String(
      meta.org_slug || testMeta?.orgSlug || process.env.DEFAULT_ORG_SLUG || "competency-coach"
    ).trim();

    let fw: any = await loadFrameworkBySlug(orgSlug);
    let frameworkSource: "filesystem" | "storage" | "blocks" | "framework_blocks" = "filesystem";

    if (useStorageFramework && storageChoice.bucket && storageChoice.path) {
      const storageFw = await downloadFrameworkJSON(storageChoice.bucket, storageChoice.path);
      if (storageFw) {
        fw = storageFw;
        frameworkSource = useBlocksEngine ? "blocks" : "storage";
      } else {
        console.log("Storage framework missing; falling back to filesystem", {
          bucket: storageChoice.bucket,
          path: storageChoice.path,
        });
      }
    }

    const look = buildLookups(fw);

    const dbLabels = await fetchDbLabels(effectiveTestId);
    const qmap = await fetchQuestionMaps(effectiveTestId);
    const qualQs = await fetchQualQuestions(effectiveTestId);

    const metaFreqs = Array.isArray(testMeta?.frequencies) ? testMeta.frequencies : null;
    const metaProfiles = Array.isArray(testMeta?.profiles) ? testMeta.profiles : null;

    const frequency_labels = (["A", "B", "C", "D"] as AB[]).map((code) => {
      const fromDb = dbLabels.freqs.find((f) => f.code === code)?.name;
      const fromMeta = metaFreqs?.find((f) => f.code === code)?.label;
      const fromLegacy = look.freqByCode.get(code as FrequencyCode)?.name;
      return { code, name: fromDb || fromMeta || fromLegacy || `Frequency ${code}` };
    });

    const profileNameMap = new Map<string, string>();

    for (let i = 1; i <= 8; i++) {
      profileNameMap.set(`P${i}`, `Profile ${i}`);
    }

    for (const p of dbLabels.profiles) {
      const code = normalizeProfileCode(p.code);
      if (code) profileNameMap.set(code, p.name);
    }

    for (const p of metaProfiles || []) {
      const code = normalizeProfileCode(p.code);
      if (code && p.name) profileNameMap.set(code, p.name);
    }

    for (const [k, v] of look.profileByCode.entries()) {
      const code = normalizeProfileCode(k);
      const name = safeText((v as any)?.name);
      if (code && name && !profileNameMap.get(code)?.trim()) {
        profileNameMap.set(code, name);
      }
    }

    const profile_labels = Array.from({ length: 8 }).map((_, i) => {
      const code = `P${i + 1}`;
      return {
        code,
        name: profileNameMap.get(code) || `Profile ${i + 1}`,
      };
    });

    const taker = await fetchTakerRow(takerId);

    const comp = computeFromAnswers(sub.answers_json, qmap);

    const freqTotals: Record<AB, number> =
      savedRead.freqSum > 0 ? savedRead.freqTotals : comp.freqTotals;
    const profileTotals: Record<string, number> =
      savedRead.profileSum > 0 ? savedRead.profileTotals : comp.profileTotals;

    const secondary = computeSecondaryMetrics(sub.answers_json, qmap);
    const raisonDetre =
      savedRead.raison_detre?.raw_score > 0 || savedRead.raison_detre?.percentage > 0
        ? savedRead.raison_detre
        : secondary.raison_detre;

    const frequency_percentages = toPercentages<AB>(freqTotals);
    const profile_percentages = toPercentages<string>(profileTotals);

    const top_freq =
      (Object.entries(freqTotals) as [AB, number][])
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "A";

    const top_profile_entry =
      Object.entries(profileTotals).sort((a, b) => b[1] - a[1])[0] || ["P1", 0];
    const top_profile_code = normalizeProfileCode(String(top_profile_entry[0] || "P1"));

    const top_profile_name =
      profile_labels.find((p) => p.code === normalizeProfileCode(top_profile_code))?.name ||
      getLookProfileName(look, top_profile_code) ||
      top_profile_code;

    const sortedProfiles = [...profile_labels]
      .map((p) => ({ ...p, pct: profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));

    const secondaryProfile = sortedProfiles[1]?.name || "";
    const tertiary = sortedProfiles[2]?.name || "";
    const topFreqName = frequency_labels.find((f) => f.code === top_freq)?.name || top_freq;

    const tokenCtx: Record<string, string> = {
      TEST_NAME:
        meta.test_name ||
        wrapperTestRow?.name ||
        effectiveTestRow?.name ||
        testMeta?.test ||
        "Profile Test",
      ORG_SLUG: orgSlug,
      PRIMARY_FREQ_NAME: topFreqName,
      PRIMARY_PROFILE_NAME: top_profile_name,
      SECONDARY_PROFILE_NAME: secondaryProfile,
      TERTIARY_PROFILE_NAME: tertiary,
      PROFILE_IMAGE_PRIMARY: "",
      PROFILE_IMAGE_SECONDARY: "",
      PROFILE_IMAGE_TERTIARY: "",
      RAISON_DETRE_RAW_SCORE: String(raisonDetre.raw_score || 0),
      RAISON_DETRE_PERCENTAGE: String(raisonDetre.percentage || 0),
    };

    const storageReportSections =
      useStorageFramework && storageChoice.bucket && storageChoice.path
        ? buildStorageFrameworkSections({
            fw,
            top_profile_code,
            top_profile_name,
            tokenCtx,
            frameworkId,
            bucket: storageChoice.bucket,
            path: storageChoice.path,
            version: storageChoice.version,
          })
        : null;

    let sections: SectionsPayload | null = null;

    if (storageReportSections) {
      sections = storageReportSections;
      frameworkSource = "storage";
    } else if (useBlocksEngine) {
      if (frameworkId) {
        const fwRow = await fetchFrameworkById(frameworkId);
        const structure =
          fwRow?.structure_json && typeof fwRow.structure_json === "object"
            ? fwRow.structure_json
            : {};
        const sec = structure?.sections && typeof structure.sections === "object" ? structure.sections : {};

        const globalKeys: string[] = Array.isArray(sec?.global) ? sec.global.map(String) : [];
        const profileKeys: string[] = Array.isArray(sec?.profile) ? sec.profile.map(String) : [];

        const fallbackGlobal = [
          "global.cover",
          "global.welcome_letter",
          "global.how_to_use",
          "global.lead_introduction",
          "global.cta_next_steps",
        ];
        const fallbackProfile = [
          "profile.identity",
          "profile.strengths",
          "profile.development_areas",
          "profile.communication_style",
          "profile.reflection_questions",
          "profile.collaboration",
        ];

        const gKeys = globalKeys.length ? globalKeys : fallbackGlobal;
        const pKeys = profileKeys.length ? profileKeys : fallbackProfile;

        const globalBlocks = await fetchFrameworkBlocksForKeys({
          framework_id: frameworkId,
          keys: gKeys,
          entity_type: "global",
          entity_code: null,
        });

        const profileBlocks = await fetchFrameworkBlocksForKeys({
          framework_id: frameworkId,
          keys: pKeys,
          entity_type: "profile",
          entity_code: top_profile_code,
        });

        const common: ReportSection[] = [];
        const profile: ReportSection[] = [];
        const postProfile: ReportSection[] = [];

        for (const key of gKeys) {
          const row = globalBlocks.get(key);
          const content = row?.content_json || null;
          const built = contentJsonToSection(content, undefined);
          const merged = replaceTokensDeep({ title: built.title, blocks: built.blocks }, tokenCtx);

          const sectionObj: ReportSection = {
            id: key,
            title: safeText((merged as any)?.title) || undefined,
            blocks: Array.isArray((merged as any)?.blocks)
              ? ((merged as any).blocks as ReportSectionBlock[])
              : [],
          };

          if (GLOBAL_POST_PROFILE_KEYS.has(key)) postProfile.push(sectionObj);
          else common.push(sectionObj);
        }

        for (const key of pKeys) {
          const row = profileBlocks.get(key);
          const content = row?.content_json || null;

          const defaultTitle =
            key === "profile.identity"
              ? top_profile_name
              : key.startsWith("profile.")
              ? titleCaseWords(key.replace("profile.", "").replaceAll("_", " "))
              : undefined;

          const built = contentJsonToSection(content, defaultTitle);
          const merged = replaceTokensDeep({ title: built.title, blocks: built.blocks }, tokenCtx);

          profile.push({
            id: key,
            title: safeText((merged as any)?.title) || defaultTitle,
            blocks: Array.isArray((merged as any)?.blocks)
              ? ((merged as any).blocks as ReportSectionBlock[])
              : [],
          });
        }

        const segSection = buildSegmentationSection(qualQs, sub.answers_json);
        if (segSection) {
          const insertAfterId = "global.how_to_use";
          const idx = common.findIndex((c) => String(c.id) === insertAfterId);
          if (idx >= 0) common.splice(idx + 1, 0, segSection as any);
          else common.push(segSection as any);
        }

        profile.push(...postProfile);

        sections = {
          common,
          profile,
          report_title: null,
          profile_missing: profile.length === 0,
          framework_version: fwRow?.version || null,
          framework_bucket: null,
          framework_path: null,
          framework_id: fwRow?.id || frameworkId,
          framework_slug: fwRow?.slug || null,
        };

        frameworkSource = "framework_blocks";
      } else {
        const layoutId =
          wrapperTestRow?.report_layout_template_id ||
          effectiveTestRow?.report_layout_template_id ||
          null;
        const layoutSections = await fetchLayoutSections(layoutId);

        const globalKeys = layoutSections.filter((s) => s.scope === "global").map((s) => s.key);
        const profileKeys = layoutSections.filter((s) => s.scope === "profile").map((s) => s.key);

        const globalBlocks = await fetchBlocksForKeys({
          keys: globalKeys,
          entity_type: "global",
          entity_code: "GLOBAL",
        });
        const profileBlocks = await fetchBlocksForKeys({
          keys: profileKeys,
          entity_type: "profile",
          entity_code: top_profile_code,
        });

        const common: ReportSection[] = [];
        const profile: ReportSection[] = [];
        const postProfile: ReportSection[] = [];

        for (const s of layoutSections) {
          const key = s.key;

          if (s.scope === "global") {
            const row = globalBlocks.get(key);
            const content = row?.content_json || null;

            const built = contentJsonToSection(content, undefined);
            const merged = replaceTokensDeep({ title: built.title, blocks: built.blocks }, tokenCtx);

            const sectionObj: ReportSection = {
              id: key,
              title: safeText((merged as any)?.title) || undefined,
              blocks: Array.isArray((merged as any)?.blocks)
                ? ((merged as any).blocks as ReportSectionBlock[])
                : [],
            };

            if (GLOBAL_POST_PROFILE_KEYS.has(key)) postProfile.push(sectionObj);
            else common.push(sectionObj);
          } else {
            const row = profileBlocks.get(key);
            const content = row?.content_json || null;

            const defaultTitle =
              key === "profile.identity"
                ? top_profile_name
                : key.startsWith("profile.")
                ? titleCaseWords(key.replace("profile.", "").replaceAll("_", " "))
                : undefined;

            const built = contentJsonToSection(content, defaultTitle);
            const merged = replaceTokensDeep({ title: built.title, blocks: built.blocks }, tokenCtx);

            profile.push({
              id: key,
              title: safeText((merged as any)?.title) || defaultTitle,
              blocks: Array.isArray((merged as any)?.blocks)
                ? ((merged as any).blocks as ReportSectionBlock[])
                : [],
            });
          }
        }

        const segSection = buildSegmentationSection(qualQs, sub.answers_json);
        if (segSection) {
          const insertAfterId = "global.how_to_use";
          const idx = common.findIndex((c) => String(c.id) === insertAfterId);
          if (idx >= 0) common.splice(idx + 1, 0, segSection as any);
          else common.push(segSection as any);
        }

        profile.push(...postProfile);

        sections = {
          common,
          profile,
          report_title: null,
          profile_missing: profile.length === 0,
          framework_version: storageChoice.version || null,
          framework_bucket: storageChoice.bucket || null,
          framework_path: storageChoice.path || null,
          framework_id: frameworkId || null,
          framework_slug: null,
        };
      }
    } else {
      sections = null;
    }

    const rawLinkMeta = meta.link_meta || null;

    const isLead = slugLower.includes("lead") || nameLower.includes("lead");
    const allowRedirectInPortal = isOperatingFrame || isLead;

    const linkMeta =
      isPortalViewer && !allowRedirectInPortal
        ? sanitizeLinkMetaForPortal(rawLinkMeta)
        : rawLinkMeta;

    return NextResponse.json({
      ok: true,
      data: {
        org_slug: orgSlug,
        org_name: meta.org_name || null,
        org_logo_url: meta.org_logo_url || null,
        test_name:
          meta.test_name ||
          wrapperTestRow?.name ||
          effectiveTestRow?.name ||
          testMeta?.test ||
          "Profile Test",

        taker: {
          id: takerId,
          first_name: taker?.first_name ?? null,
          last_name: taker?.last_name ?? null,
        },

        link: linkMeta || undefined,

        frequency_labels,
        frequency_totals: freqTotals,
        frequency_percentages,

        profile_labels,
        profile_totals: profileTotals,
        profile_percentages,

        top_freq,
        top_profile_code,
        top_profile_name,

        raison_detre: raisonDetre,
        raison_detre_raw_score: Number(raisonDetre.raw_score || 0),
        raison_detre_percentage: Number(raisonDetre.percentage || 0),

        sections,

        debug: {
          reportEngine,
          useBlocksEngine,
          frameworkSource,
          framework_id: frameworkId || null,

          storageFrameworkBucket: storageChoice.bucket || null,
          storageFrameworkPath: storageChoice.path || null,

          src,
          isPortalViewer,
          allowRedirectInPortal,
          isOperatingFrame,
          isLead,

          wrapper_test_id: wrapperTestRow?.id || null,
          effective_test_id: effectiveTestId || null,
          effective_test_slug: effectiveTestRow?.slug || null,
          effective_resolved_by: effectiveResolved.resolvedBy,
          submission_match: subRes.matched,
          saved_wrapper_test_id: savedRead.wrapper_test_id || null,
          saved_effective_test_id: savedRead.effective_test_id || null,
        },

        version: storageReportSections
          ? "portal-storage-framework-v2+selected-profile-sections+raison-detre"
          : useBlocksEngine
          ? "portal-native-v2-blocks+effective_test_resolution+raison-detre"
          : "portal-v1+raison-detre",
      },
    });
  } catch (e: any) {
    console.error("report route error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}