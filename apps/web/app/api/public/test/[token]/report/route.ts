// apps/web/app/api/public/test/[token]/report/route.ts
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
  profile_map: MapEntry[] | null;
  // Some orgs may store scoring here instead of profile_map
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

  // Preferred (meta-driven storage framework)
  report_framework_key?: string;
  report_framework_bucket?: string;
  report_framework_version?: string;

  // legacy
  frameworkKey?: string;
  frameworkType?: string;
  frequencies?: Array<{ code: AB; label: string }>;
  profiles?: Array<{ code: string; name: string; frequency?: AB; description?: string }>;

  // legacy storage shape
  reportFramework?: ReportFrameworkMeta;
};

type TestRow = {
  id: string;
  slug: string | null;
  name: string | null;
  meta: any | null;

  // ✅ NEW: Native v2 wiring (non-breaking; nullable)
  framework_id: string | null;
  report_layout_template_id: string | null;
};

type TakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ReportSection = {
  id?: string;
  title?: string;
  blocks?: any[];
};

type SectionsPayload = {
  common?: ReportSection[] | null;
  profile?: ReportSection[] | null;
  report_title?: string | null;
  profile_missing?: boolean;
  framework_version?: string | null;
  framework_bucket?: string | null;
  framework_path?: string | null;

  // helpful for debugging/visibility
  template_slug?: string | null;
  template_version?: string | null;
  native_v2?: boolean;
};

type ReportLayoutTemplateRow = {
  id: string;
  slug: string;
  version: string;
  status: string;
  sections_json: any;
};

type FrameworkBlockRow = {
  id: string;
  framework_id: string;
  block_key: string;
  entity_type: "global" | "frequency" | "profile";
  entity_code: string | null;
  version: string;
  status: string;
  content_json: any;
  created_at: string;
};

// ---------------- utils ----------------

function safeNumber(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
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

function profileCodeToAB(pcode: string): AB | null {
  const pc = String(pcode || "").toUpperCase();
  const m = pc.match(/^P(?:ROFILE)?[_\s-]?([1-8])$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 2) return "A";
  if (n <= 4) return "B";
  if (n <= 6) return "C";
  return "D";
}

function selectedIndex(a: any): number {
  // We allow various shapes; numeric answers should resolve to 0..N-1
  const raw = a?.value ?? a?.index ?? a?.selected ?? a?.selected_index ?? undefined;

  const n = Number(raw);
  // If answer stored as 1..N (radio), convert to 0-based:
  if (Number.isFinite(n)) {
    // If it's a "value" field and looks 1-based, shift:
    if (a?.value != null) return Math.max(0, n - 1);
    return Math.max(0, n);
  }
  return 0;
}

function coerceMapEntries(x: any): MapEntry[] {
  if (Array.isArray(x)) {
    return x
      .map((e) => ({
        points: safeNumber((e as any)?.points, 0),
        profile: String((e as any)?.profile || "").toUpperCase(),
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
    const pcode = String(entry.profile || "").toUpperCase();
    if (pts <= 0 || !pcode) continue;

    usedAny = true;

    profileTotals[pcode] = (profileTotals[pcode] || 0) + pts;
    const ab = profileCodeToAB(pcode);
    if (ab) freqTotals[ab] = (freqTotals[ab] || 0) + pts;
  }

  return { freqTotals, profileTotals, used: usedAny ? ("qmap" as const) : ("none" as const) };
}

/**
 * Read saved totals from submission.totals, supporting BOTH shapes:
 *  - Legacy flat: totals.A / totals.PROFILE_1
 *  - Nested: totals.frequencies.A / totals.profiles.PROFILE_1
 */
function readSavedTotals(totals: any) {
  const raw = totals && typeof totals === "object" ? totals : {};

  const nestedFreq = raw?.frequencies && typeof raw.frequencies === "object" ? raw.frequencies : null;
  const nestedProfiles = raw?.profiles && typeof raw.profiles === "object" ? raw.profiles : null;

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
    const key = String(k || "").toUpperCase().trim();
    if (key.startsWith("PROFILE_")) profileTotals[key] = safeNumber(v, 0);
  }
  const profileSum = Object.values(profileTotals).reduce((a, b) => a + (Number(b) || 0), 0);

  const meta = raw?.meta && typeof raw.meta === "object" ? raw.meta : null;
  const wrapper_test_id = typeof meta?.wrapper_test_id === "string" ? meta.wrapper_test_id : null;
  const effective_test_id = typeof meta?.effective_test_id === "string" ? meta.effective_test_id : null;

  return {
    freqTotals,
    freqSum,
    profileTotals,
    profileSum,
    wrapper_test_id,
    effective_test_id,
    shape: nestedFreq || nestedProfiles ? ("nested" as const) : ("flat" as const),
  };
}

// ✅ Portal bypass helper
function sanitizeLinkMetaForPortal(linkMeta: any) {
  const link = linkMeta && typeof linkMeta === "object" ? { ...linkMeta } : {};

  if ("redirect_url" in link) link.redirect_url = null;
  if ("redirectUrl" in link) link.redirectUrl = null;

  if ("next_steps_url" in link) link.next_steps_url = null;
  if ("nextStepsUrl" in link) link.nextStepsUrl = null;

  if ("show_results" in link) link.show_results = true;
  if ("showResults" in link) link.showResults = true;

  if (link?.meta && typeof link.meta === "object") {
    const m = { ...link.meta };
    if ("redirect_url" in m) m.redirect_url = null;
    if ("next_steps_url" in m) m.next_steps_url = null;
    if ("show_results" in m) m.show_results = true;
    link.meta = m;
  }

  return link;
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

// ✅ Resolve org/test for a token (use COLUMN flags as truth)
async function resolveLinkMeta(token: string): Promise<LinkMeta | null> {
  const sb = sbAdmin();

  const q = await sb
    .from("test_links")
    .select(
      `
      test_id,
      token,
      show_results,
      redirect_url,
      hidden_results_message,
      next_steps_url,
      email_report,
      tests:tests (
        id,
        name,
        org_id,
        orgs:orgs ( slug )
      )
    `,
    )
    .eq("token", token)
    .limit(1)
    .maybeSingle();

  if (q.error || !q.data?.test_id) return null;

  const testName = (q.data as any)?.tests?.name ?? null;
  const orgSlug = (q.data as any)?.tests?.orgs?.slug ?? null;

  const link_meta = {
    show_results: (q.data as any)?.show_results ?? true,
    redirect_url: ((q.data as any)?.redirect_url as string | null) ?? null,
    hidden_results_message: ((q.data as any)?.hidden_results_message as string | null) ?? null,
    next_steps_url: ((q.data as any)?.next_steps_url as string | null) ?? null,
    email_report: (q.data as any)?.email_report ?? false,
  };

  return {
    test_id: q.data.test_id,
    org_slug: orgSlug,
    test_name: testName,
    link_meta,
  };
}

// Fetch latest submission for (taker_id, token)
// ✅ Accept legacy rows where link_token is NULL
async function fetchLatestSubmission(
  taker_id: string,
  token: string,
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

// Minimal questions map (id, profile_map, weights) for this test
async function fetchQuestionMaps(test_id: string): Promise<Map<string, QuestionMapRow>> {
  const sb = sbAdmin();

  const q = (await sb
    .from("test_questions")
    .select("id, profile_map, weights")
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
          code: String(r.profile_code || "").toUpperCase(),
          name: String(r.profile_name || ""),
          frequency_code: (r.frequency_code ? (String(r.frequency_code).toUpperCase() as AB) : null),
        }))
      : [];

  return { freqs, profiles };
}

async function fetchTestRow(test_id: string): Promise<TestRow | null> {
  const sb = sbAdmin();
  const q = await sb
    .from("tests")
    .select("id, slug, name, meta, framework_id, report_layout_template_id")
    .eq("id", test_id)
    .maybeSingle();
  if (q.error || !q.data) return null;
  return q.data as TestRow;
}

async function fetchTakerRow(taker_id: string): Promise<TakerRow | null> {
  const sb = sbAdmin();
  const q = await sb.from("test_takers").select("id, first_name, last_name").eq("id", taker_id).maybeSingle();
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

// ✅ resolve which storage framework to use (test meta driven)
function resolveStorageFramework(testMeta: TestMeta | null | undefined) {
  const meta = (testMeta || {}) as any;

  const key = typeof meta.report_framework_key === "string" ? meta.report_framework_key.trim() : "";
  const bucketOverride = typeof meta.report_framework_bucket === "string" ? meta.report_framework_bucket.trim() : "";

  if (key) {
    const bucket = bucketOverride || "framework";
    return {
      use: true as const,
      bucket,
      path: key,
      version: typeof meta.report_framework_version === "string" ? meta.report_framework_version : null,
      source: "meta.report_framework_key" as const,
    };
  }

  // Legacy: reportFramework: { bucket, path, version }
  const rf: ReportFrameworkMeta | null = meta?.reportFramework || null;
  const bucket = typeof rf?.bucket === "string" ? rf.bucket.trim() : "";
  const path = typeof rf?.path === "string" ? rf.path.trim() : "";
  if (bucket && path) {
    return {
      use: true as const,
      bucket,
      path,
      version: typeof rf?.version === "string" ? rf.version : null,
      source: "meta.reportFramework" as const,
    };
  }

  return { use: false as const, bucket: "", path: "", version: null as any, source: "none" as const };
}

// --- Support LEAD v1 schema ---

function pickCommonSections(frameworkJson: any): any[] | null {
  const fw = frameworkJson?.framework || frameworkJson;
  if (fw?.common?.sections && Array.isArray(fw.common.sections)) return fw.common.sections;
  if (fw?.framework?.common?.sections && Array.isArray(fw.framework.common.sections))
    return fw.framework.common.sections;
  return null;
}

function pickReportTitle(frameworkJson: any): string | null {
  const fw = frameworkJson?.framework || frameworkJson;
  return fw?.common?.report_title || fw?.report_title || null;
}

function findProfileReport(frameworkJson: any, profileCode: string) {
  const fw = frameworkJson?.framework || frameworkJson;
  const pc = String(profileCode || "").toUpperCase();

  if (fw?.profiles && typeof fw.profiles === "object") {
    const hit = fw.profiles[pc];
    if (hit) return hit;
  }

  const reportsByProfile = fw?.reports_by_profile;
  if (reportsByProfile && typeof reportsByProfile === "object") {
    const hit = reportsByProfile[pc];
    if (hit) return hit;
  }

  const reports = fw?.reports;
  if (reports && typeof reports === "object") {
    for (const v of Object.values(reports)) {
      const p = (v as any)?.profile_code || (v as any)?.profileCode || (v as any)?.code || "";
      if (String(p).toUpperCase() === pc) return v;
    }
  }

  return null;
}

function normaliseSectionId(x: any): string {
  return String(x || "").trim().toLowerCase();
}

function dedupeSectionsById(arr: any[]): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const s of arr || []) {
    const key = normaliseSectionId(s?.id || s?.title);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function enforceOptionA(commonIn: any[], profileIn: any[]) {
  const common = Array.isArray(commonIn) ? commonIn : [];
  const profile = Array.isArray(profileIn) ? profileIn : [];

  const commonIds = new Set(common.map((s) => normaliseSectionId(s?.id)).filter(Boolean));

  const filteredProfile = profile.filter((s) => {
    const id = normaliseSectionId(s?.id);
    if (!id) return true;
    return !commonIds.has(id);
  });

  return {
    common: dedupeSectionsById(common),
    profile: dedupeSectionsById(filteredProfile),
    removed_overlap_count: profile.length - filteredProfile.length,
  };
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
    const questionText = safeText(q.text).trim();
    const a = ansByQid.get(q.id);

    let answerText = "";

    if (String(q.type || "").toLowerCase() === "text") {
      answerText =
        safeText((a as any)?.text) || safeText((a as any)?.value) || safeText((a as any)?.answer) || "";
    } else {
      const opts = Array.isArray(q.options) ? q.options : [];
      const sel = selectedIndex(a);
      const picked = opts[sel];
      answerText = safeText(picked);
      if (!answerText && (a as any) != null) {
        answerText = safeText((a as any)?.value ?? (a as any)?.selected ?? "");
      }
    }

    const line = `${captureKey}: ${answerText || "—"}`;
    if (answerText || questionText) rows.push(line);
  }

  if (rows.length === 0) return null;

  return {
    id: "segmentation-responses",
    title: "Your responses",
    blocks: [{ type: "p", text: "These are the answers you provided to the initial questions." }, { type: "ul", items: rows }],
  };
}

// ---------------- Native v2 helpers ----------------

function parseVersion(v: string) {
  const parts = String(v || "0").split(".").map((n) => Number(n));
  return parts.map((n) => (Number.isFinite(n) ? n : 0));
}

function isVersionNewer(a: string, b: string) {
  // true if a > b
  const A = parseVersion(a);
  const B = parseVersion(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const av = A[i] ?? 0;
    const bv = B[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

async function fetchLayoutTemplate(id: string): Promise<ReportLayoutTemplateRow | null> {
  const sb = sbAdmin();
  const q = await sb
    .from("report_layout_templates")
    .select("id, slug, version, status, sections_json")
    .eq("id", id)
    .maybeSingle();
  if (q.error || !q.data) return null;
  return q.data as ReportLayoutTemplateRow;
}

async function fetchFrameworkBlocks(framework_id: string): Promise<FrameworkBlockRow[]> {
  const sb = sbAdmin();
  const q = await sb
    .from("framework_content_blocks")
    .select("id, framework_id, block_key, entity_type, entity_code, version, status, content_json, created_at")
    .eq("framework_id", framework_id)
    .in("status", ["active"])
    .order("created_at", { ascending: false });

  if (q.error || !Array.isArray(q.data)) return [];
  return q.data as FrameworkBlockRow[];
}

function buildBlockIndex(rows: FrameworkBlockRow[]) {
  // pick latest per (block_key, entity_type, entity_code) with version as tie-break
  const idx = new Map<string, FrameworkBlockRow>();

  for (const r of rows) {
    const key = `${r.block_key}::${r.entity_type}::${String(r.entity_code || "").toUpperCase()}`;
    const cur = idx.get(key);
    if (!cur) {
      idx.set(key, r);
      continue;
    }
    // rows already ordered by created_at desc; but keep safe version logic
    if (isVersionNewer(r.version, cur.version)) {
      idx.set(key, r);
    }
  }
  return idx;
}

function getBlock(
  idx: Map<string, FrameworkBlockRow>,
  block_key: string,
  entity_type: FrameworkBlockRow["entity_type"],
  entity_code?: string | null,
) {
  const key = `${block_key}::${entity_type}::${String(entity_code || "").toUpperCase()}`;
  return idx.get(key)?.content_json ?? null;
}

function ensureNextStepsSection(text?: string | null) {
  const body = safeText(text).trim();
  const blocks: any[] = [];

  if (body) blocks.push({ type: "p", text: body });

  // always have something so scroll-to works even if no URL
  if (!blocks.length) {
    blocks.push({
      type: "p",
      text: "If you have access to a Next Steps link, use the button above. Otherwise, return to this report and choose one small action to focus on this week.",
    });
  }

  return {
    id: "next-steps",
    title: "Next Steps",
    blocks,
  } satisfies ReportSection;
}

function nativeV2BuildSections(args: {
  template: ReportLayoutTemplateRow;
  blockIdx: Map<string, FrameworkBlockRow>;
  frequency_labels: Array<{ code: AB; name: string }>;
  frequency_percentages: Record<AB, number>;
  profile_labels: Array<{ code: string; name: string }>;
  profile_percentages: Record<string, number>;
  top_freq: AB;
  top_profile_code: string;
  top_profile_name: string;
  test_name: string;
}) {
  const {
    template,
    blockIdx,
    frequency_labels,
    frequency_percentages,
    profile_labels,
    profile_percentages,
    top_freq,
    top_profile_code,
    top_profile_name,
    test_name,
  } = args;

  const sectionsCfg = Array.isArray(template.sections_json) ? template.sections_json : [];
  const common: ReportSection[] = [];
  const profile: ReportSection[] = [];

  // Pull global blocks (fail-soft)
  const welcome = getBlock(blockIdx, "global.welcome_letter", "global", null);
  const howTo = getBlock(blockIdx, "global.how_to_use", "global", null);
  const cta = getBlock(blockIdx, "global.cta_next_steps", "global", null);

  // Frequency descriptions
  const freqDesc = (code: AB) => getBlock(blockIdx, "frequency.description", "frequency", code);

  // Primary profile blocks (by top_profile_code)
  const profIdentity = getBlock(blockIdx, "profile.identity", "profile", top_profile_code);
  const profStrengths = getBlock(blockIdx, "profile.strengths", "profile", top_profile_code);
  const profDev = getBlock(blockIdx, "profile.development_areas", "profile", top_profile_code);
  const profComms = getBlock(blockIdx, "profile.communication_style", "profile", top_profile_code);
  const profReflect = getBlock(blockIdx, "profile.reflection_questions", "profile", top_profile_code);
  const profCollab = getBlock(blockIdx, "profile.collaboration", "profile", top_profile_code);

  // Helpers to build blocks
  const pctLabel = (v: number | undefined) => `${Math.round((Number.isFinite(v as any) ? (v as any) : 0) * 100)}%`;

  const buildSummarySection = (): ReportSection => {
    const topFreqName = frequency_labels.find((f) => f.code === top_freq)?.name || top_freq;
    const freqLines = frequency_labels.map((f) => `${f.name} (${f.code}): ${pctLabel(frequency_percentages?.[f.code] ?? 0)}`);

    // Sort top 3 profiles for a “mix”
    const sortedProfiles = [...profile_labels]
      .map((p) => ({ ...p, pct: profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0))
      .slice(0, 3);

    const mixLine = sortedProfiles
      .map((p) => `${p.name} (${pctLabel(p.pct)})`)
      .join(" · ");

    return {
      id: "high-level-summary",
      title: "High Level Summary",
      blocks: [
        { type: "h3", text: "Your dominant frequency" },
        { type: "p", text: `${topFreqName} (${top_freq})` },
        { type: "ul", items: freqLines },

        { type: "divider" },

        { type: "h3", text: "Your profile mix" },
        { type: "p", text: mixLine || `${top_profile_name}` },
      ],
    };
  };

  const buildFrameworkSection = (): ReportSection => {
    const freqBlocks: any[] = [];

    freqBlocks.push({ type: "p", text: "The framework is made up of 4 Frequencies and 8 Profiles. Frequencies explain your operating energy; Profiles explain your behavioural pattern." });

    freqBlocks.push({ type: "h3", text: "The 4 Frequencies" });

    const freqItems = (["A", "B", "C", "D"] as AB[]).map((code) => {
      const name = frequency_labels.find((f) => f.code === code)?.name || code;
      const d = freqDesc(code);
      const summary = safeText(d?.summary || d?.description || "").trim();
      return summary ? `${name} (${code}): ${summary}` : `${name} (${code})`;
    });

    freqBlocks.push({ type: "ul", items: freqItems });

    freqBlocks.push({ type: "h3", text: "The 8 Profiles" });

    const profItems = profile_labels.map((p) => `${p.name}`);
    freqBlocks.push({ type: "ul", items: profItems });

    return {
      id: "framework",
      title: "The Framework",
      blocks: freqBlocks,
    };
  };

  const buildPrimaryProfileSection = (): ReportSection => {
    const blocks: any[] = [];

    blocks.push({ type: "p", text: `Your primary profile is ${top_profile_name}. Use this section as your personal operating guide.` });

    const title = safeText(profIdentity?.title || top_profile_name).trim();
    const coreIdentity = safeText(profIdentity?.core_identity || profIdentity?.body || profIdentity?.summary || "").trim();

    if (title) blocks.push({ type: "h3", text: title });
    if (coreIdentity) blocks.push({ type: "p", text: coreIdentity });

    // strengths
    const strengths = Array.isArray(profStrengths?.items) ? profStrengths.items : Array.isArray(profStrengths?.strengths) ? profStrengths.strengths : null;
    if (Array.isArray(strengths) && strengths.length) {
      blocks.push({ type: "h4", text: "Strengths" });
      blocks.push({ type: "ul", items: strengths.map(safeText) });
    }

    // development
    const dev = Array.isArray(profDev?.items) ? profDev.items : Array.isArray(profDev?.development_areas) ? profDev.development_areas : null;
    if (Array.isArray(dev) && dev.length) {
      blocks.push({ type: "h4", text: "Development areas" });
      blocks.push({ type: "ul", items: dev.map(safeText) });
    }

    // comms
    const commsText = safeText(profComms?.body || profComms?.summary || "").trim();
    const commsBullets = Array.isArray(profComms?.items) ? profComms.items : null;
    if (commsText || (Array.isArray(commsBullets) && commsBullets.length)) {
      blocks.push({ type: "h4", text: "Communication style" });
      if (commsText) blocks.push({ type: "p", text: commsText });
      if (Array.isArray(commsBullets) && commsBullets.length) blocks.push({ type: "ul", items: commsBullets.map(safeText) });
    }

    // reflection
    const refl = Array.isArray(profReflect?.items) ? profReflect.items : Array.isArray(profReflect?.questions) ? profReflect.questions : null;
    if (Array.isArray(refl) && refl.length) {
      blocks.push({ type: "h4", text: "Reflection questions" });
      blocks.push({ type: "ol", items: refl.map(safeText) });
    }

    // collaboration
    const collabText = safeText(profCollab?.body || profCollab?.summary || "").trim();
    const collabItems = Array.isArray(profCollab?.items) ? profCollab.items : null;
    if (collabText || (Array.isArray(collabItems) && collabItems.length)) {
      blocks.push({ type: "h4", text: "Collaboration" });
      if (collabText) blocks.push({ type: "p", text: collabText });
      if (Array.isArray(collabItems) && collabItems.length) blocks.push({ type: "ul", items: collabItems.map(safeText) });
    }

    if (!blocks.length) {
      blocks.push({
        type: "p",
        text: "Profile content is being built for this framework. Check back soon for a deeper breakdown of your strengths, development areas, and collaboration guidance.",
      });
    }

    return {
      id: "primary-profile",
      title: "Your Primary Profile",
      blocks,
    };
  };

  const buildIntro = (): ReportSection => {
    const title = safeText(welcome?.title || "Welcome").trim();
    const body = safeText(welcome?.body || welcome?.text || "").trim();
    return {
      id: "welcome",
      title,
      blocks: body ? [{ type: "p", text: body }] : [{ type: "p", text: `Welcome to your ${test_name} report.` }],
    };
  };

  const buildHowTo = (): ReportSection => {
    const title = safeText(howTo?.title || "How to Use This Report").trim();
    const steps = Array.isArray(howTo?.steps) ? howTo.steps : Array.isArray(howTo?.items) ? howTo.items : null;
    const body = safeText(howTo?.body || "").trim();

    const blocks: any[] = [];
    if (body) blocks.push({ type: "p", text: body });
    if (Array.isArray(steps) && steps.length) blocks.push({ type: "ol", items: steps.map(safeText) });

    if (!blocks.length) {
      blocks.push({
        type: "ol",
        items: [
          "Start with the High Level Summary.",
          "Read the Framework section to understand the model.",
          "Go deep into your Primary Profile.",
          "Use the reflection questions to choose one action to practise this week.",
        ],
      });
    }

    return { id: "how-to-use", title, blocks };
  };

  const buildConclusion = (): ReportSection => {
    return {
      id: "conclusion",
      title: "Conclusion",
      blocks: [
        {
          type: "p",
          text: "Awareness creates choice. Use this report as a practical guide — not just something to read once. Pick one strength to leverage and one development area to work on over the next 30 days.",
        },
      ],
    };
  };

  const buildCTA = (): ReportSection => {
    const title = safeText(cta?.title || "Next Steps").trim();
    const note = safeText(cta?.note || "").trim();
    const label = safeText(cta?.button_label || "").trim();

    const blocks: any[] = [];
    if (note) blocks.push({ type: "p", text: note });
    if (label) blocks.push({ type: "p", text: `Use the “${label}” button above when you’re ready.` });

    if (!blocks.length) blocks.push({ type: "p", text: "Use the Next Steps button above when you’re ready." });

    // Ensure there is also a scroll target section for fallback
    // We keep this separate section with id next-steps so LegacyReportClient scroll logic works even if URL missing.
    return {
      id: "cta",
      title,
      blocks,
    };
  };

  // Build by template ordering, but always ensure next-steps exists.
  for (const s of sectionsCfg) {
    const key = String(s?.key || s?.id || "").trim();

    if (key === "cover") {
      common.push({
        id: "cover",
        title: "Index",
        blocks: [{ type: "p", text: "Use the quick index to jump to any section." }],
      });
      continue;
    }

    if (key === "intro") {
      common.push(buildIntro());
      continue;
    }

    if (key === "summary_dashboard") {
      common.push(buildSummarySection());
      continue;
    }

    if (key === "how_to_use") {
      common.push(buildHowTo());
      continue;
    }

    if (key === "framework_explainer") {
      common.push(buildFrameworkSection());
      continue;
    }

    if (key === "primary_profile") {
      profile.push(buildPrimaryProfileSection());
      continue;
    }

    if (key === "applied_insights") {
      // For now, applied insights are included in the primary profile section via blocks.
      // Keep a placeholder that can be expanded later without changing UI.
      profile.push({
        id: "applied-insights",
        title: "Applied Growth Insights",
        blocks: [
          {
            type: "p",
            text: "Use the strengths and development areas above to choose one behaviour to practise over the next 7 days. Small consistency beats big intention.",
          },
        ],
      });
      continue;
    }

    if (key === "conclusion") {
      common.push(buildConclusion());
      continue;
    }

    if (key === "cta") {
      common.push(buildCTA());
      continue;
    }
  }

  // Always include a Next Steps scroll target section (for LegacyReportClient fallback)
  // The UI button first tries link.next_steps_url, else scrolls to this.
  common.push(ensureNextStepsSection(safeText(cta?.note || "").trim() || null));

  return {
    common,
    profile,
    report_title: `${test_name} Report`,
    profile_missing: profile.length === 0,
    template_slug: template.slug,
    template_version: template.version,
    native_v2: true,
  } satisfies SectionsPayload;
}

// ---------------- Handler ----------------

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const token = params.token;
    const takerId = searchParams.get("tid");

    // ✅ portal bypass flag
    const src = (searchParams.get("src") || "").trim().toLowerCase();
    const isPortalViewer = src === "portal";

    if (!takerId) {
      return NextResponse.json({ ok: false, error: "Missing tid" }, { status: 400 });
    }

    const meta = await resolveLinkMeta(token);
    if (!meta) {
      return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 404 });
    }

    const testRow = await fetchTestRow(meta.test_id);
    const testMeta = (testRow?.meta || {}) as TestMeta;

    const storageChoice = resolveStorageFramework(testMeta);
    const useStorageFramework = storageChoice.use;

    const orgSlug = String(
      meta.org_slug || testMeta?.orgSlug || process.env.DEFAULT_ORG_SLUG || "competency-coach",
    ).trim();

    // Default: filesystem framework (by org)
    let fw: any = await loadFrameworkBySlug(orgSlug);
    let frameworkSource: "filesystem" | "storage" = "filesystem";

    if (useStorageFramework && storageChoice.bucket && storageChoice.path) {
      const storageFw = await downloadFrameworkJSON(storageChoice.bucket, storageChoice.path);
      if (storageFw) {
        fw = storageFw;
        frameworkSource = "storage";
      } else {
        console.log("Storage framework missing; falling back to filesystem", {
          bucket: storageChoice.bucket,
          path: storageChoice.path,
        });
      }
    }

    const look = buildLookups(fw);

    // Prefer DB labels
    const dbLabels = await fetchDbLabels(meta.test_id);

    const metaFreqs = Array.isArray(testMeta?.frequencies) ? testMeta.frequencies : null;
    const metaProfiles = Array.isArray(testMeta?.profiles) ? testMeta.profiles : null;

    const frequency_labels = (["A", "B", "C", "D"] as AB[]).map((code) => {
      const fromDb = dbLabels.freqs.find((f) => f.code === code)?.name;
      const fromMeta = metaFreqs?.find((f) => f.code === code)?.label;
      const fromLegacy = look.freqByCode.get(code as FrequencyCode)?.name;
      return { code, name: fromDb || fromMeta || fromLegacy || `Frequency ${code}` };
    });

    const profile_labels = Array.from({ length: 8 }).map((_, i) => {
      const n = i + 1;
      const code = `PROFILE_${n}`;
      const fromDb = dbLabels.profiles.find((p) => p.code === code)?.name;
      const fromMeta = metaProfiles?.find((p) => String(p.code).toUpperCase() === code)?.name;
      const fromLegacy = look.profileByCode.get(code)?.name;
      return { code, name: fromDb || fromMeta || fromLegacy || `Profile ${n}` };
    });

    const subRes = await fetchLatestSubmission(takerId, token);
    const sub = subRes.row;

    if (!sub) {
      return NextResponse.json(
        {
          ok: false,
          error: "Submission not found for this taker/token.",
          debug: { takerId, token, test_id: meta.test_id },
        },
        { status: 404 },
      );
    }

    const taker = await fetchTakerRow(takerId);

    const savedRead = readSavedTotals(sub.totals);
    const qmap = await fetchQuestionMaps(meta.test_id);
    const comp = computeFromAnswers(sub.answers_json, qmap);

    const freqTotals: Record<AB, number> = savedRead.freqSum > 0 ? savedRead.freqTotals : comp.freqTotals;
    const profileTotals: Record<string, number> = savedRead.profileSum > 0 ? savedRead.profileTotals : comp.profileTotals;

    const frequency_percentages = toPercentages<AB>(freqTotals);
    const profile_percentages = toPercentages<string>(profileTotals);

    const top_freq = (Object.entries(freqTotals) as [AB, number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "A";

    const top_profile_entry = Object.entries(profileTotals)
      .sort((a, b) => b[1] - a[1])[0] || ["PROFILE_1", 0];

    const top_profile_code = String(top_profile_entry[0] || "PROFILE_1").toUpperCase();
    const top_profile_name =
      profile_labels.find((p) => p.code === top_profile_code)?.name ||
      look.profileByCode.get(top_profile_code)?.name ||
      top_profile_code;

    // ✅ Link behavior comes from resolveLinkMeta() columns
    const rawLinkMeta = meta.link_meta || null;
    const linkMeta = isPortalViewer ? sanitizeLinkMetaForPortal(rawLinkMeta) : rawLinkMeta;

    // ---------------- SECTIONS BUILDER ----------------
    // 1) If storage framework (LEAD meta) is used, keep existing behavior.
    // 2) Else, if test has native-v2 wiring (framework_id + report_layout_template_id), build sections from DB blocks.
    // 3) Else no sections (legacy client will show "No sections returned" but still has the dashboard summary)

    let sections: SectionsPayload | null = null;
    let removed_overlap_count = 0;

    if (useStorageFramework && frameworkSource === "storage") {
      // Storage sections payload (LEAD) — enforce Option A here
      const commonRaw = pickCommonSections(fw) || [];
      const rep = findProfileReport(fw, top_profile_code);

      const profileSections = rep?.sections;
      const profileRaw = Array.isArray(profileSections) ? profileSections : [];

      const fixed = enforceOptionA(commonRaw, profileRaw);
      removed_overlap_count = fixed.removed_overlap_count;

      const qualQs = await fetchQualQuestions(meta.test_id);
      const segSection = buildSegmentationSection(qualQs, sub.answers_json);
      const commonWithSeg = segSection ? [...fixed.common, segSection] : fixed.common;

      sections = {
        common: commonWithSeg,
        profile: fixed.profile,
        report_title: rep?.title || pickReportTitle(fw) || null,
        profile_missing: fixed.profile.length === 0,
        framework_version: storageChoice.version || null,
        framework_bucket: storageChoice.bucket || null,
        framework_path: storageChoice.path || null,
      };
    } else {
      // ✅ Native v2 builder (no snapshots; DB-driven blocks)
      const nativeFrameworkId = testRow?.framework_id || null;
      const nativeTemplateId = testRow?.report_layout_template_id || null;

      if (nativeFrameworkId && nativeTemplateId) {
        const tpl = await fetchLayoutTemplate(nativeTemplateId);
        if (!tpl) {
          console.log("Native v2: missing report_layout_template", { nativeTemplateId });
        } else {
          const rows = await fetchFrameworkBlocks(nativeFrameworkId);
          const blockIdx = buildBlockIndex(rows);

          sections = nativeV2BuildSections({
            template: tpl,
            blockIdx,
            frequency_labels,
            frequency_percentages,
            profile_labels,
            profile_percentages,
            top_freq,
            top_profile_code,
            top_profile_name,
            test_name: meta.test_name || testRow?.name || testMeta?.test || "Profile Test",
          });
        }
      }
    }

    const answersCount = Array.isArray(sub.answers_json) ? sub.answers_json.length : 0;
    const computedSum = Object.values(profileTotals || {}).reduce((a, b) => a + (Number(b) || 0), 0);

    const scoringWarning =
      savedRead.freqSum <= 0 &&
      savedRead.profileSum <= 0 &&
      (qmap.size === 0 || comp.used === "none") &&
      answersCount > 0 &&
      computedSum === 0
        ? "Scores are zero because no question scoring map was found for this test_id (test_questions missing, or no profile_map/weights set)."
        : null;

    return NextResponse.json({
      ok: true,
      data: {
        org_slug: orgSlug,
        org_name: null,
        test_name: meta.test_name || testRow?.name || testMeta?.test || "Profile Test",

        taker: {
          id: takerId,
          first_name: taker?.first_name ?? null,
          last_name: taker?.last_name ?? null,
        },

        // ✅ clients use this for show/hide/redirect/next steps url
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

        sections,

        debug: {
          frameworkSource,
          useStorageFramework,
          storageFrameworkSource: storageChoice.source,
          storageFrameworkBucket: storageChoice.bucket || null,
          storageFrameworkPath: storageChoice.path || null,

          schema: "portal",
          test_id: meta.test_id,
          submission_id: sub.id,
          submission_link_token: sub.link_token,
          submission_match: subRes.matched,
          qmap_size: qmap.size,
          answers_count: answersCount,

          totals_shape: savedRead.shape,
          wrapper_test_id: savedRead.wrapper_test_id,
          effective_test_id: savedRead.effective_test_id,

          used_saved_profiles: savedRead.profileSum > 0,
          used_saved_frequencies: savedRead.freqSum > 0,
          computed_from_qmap: comp.used,
          scoring_warning: scoringWarning,

          removed_common_profile_overlap: removed_overlap_count,
          db_labels: {
            freq_count: dbLabels.freqs.length,
            profile_count: dbLabels.profiles.length,
          },

          native_v2_enabled: !!(testRow?.framework_id && testRow?.report_layout_template_id) && !(useStorageFramework && frameworkSource === "storage"),

          src,
          isPortalViewer,
        },

        version:
          useStorageFramework && frameworkSource === "storage"
            ? "portal-v2-storage-meta+labels+qual"
            : sections?.native_v2
              ? "portal-v2-native-db-blocks"
              : "portal-v1",
      },
    });
  } catch (e: any) {
    console.error("report route error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}