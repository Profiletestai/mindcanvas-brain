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

  // ✅ NEW: report engine switching
  // Set this to "native_v2_blocks" for tests that should use the DB blocks + layout template engine.
  report_engine?: string;

  // ✅ NEW: framework selector for blocks engine
  // If tests.framework_id is null, we can resolve framework by this slug
  framework_slug?: string;

  // ✅ NEW: layout template selector for blocks engine
  // If present, we look up report_layout_templates.slug == this value (fallback to meta.report_layout)
  report_layout_template_slug?: string;

  // existing
  frameworkKey?: string;
  frameworkType?: string;
  frequencies?: Array<{ code: AB; label: string }>;
  profiles?: Array<{ code: string; name: string; frequency?: AB; description?: string }>;

  // legacy storage shape
  reportFramework?: ReportFrameworkMeta;

  // already used by OperatingFrame meta in your DB insert
  report_layout?: string;
};

type TestRow = {
  id: string;
  slug: string | null;
  name: string | null;
  meta: any | null;
  framework_id?: string | null;
  report_layout_template_id?: string | null;
};

type TakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type LayoutItem = {
  key: string;
  scope?: "global" | "profile" | "frequency";
};

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
    // include optional columns if present; harmless if null in data
    .select("id, slug, name, meta, framework_id, report_layout_template_id")
    .eq("id", test_id)
    .maybeSingle();
  if (q.error || !q.data) return null;
  return q.data as unknown as TestRow;
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

// --- Support LEAD v1 schema (storage JSON) ---

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

// ---------------- NEW: Native V2 Blocks + Layout Template engine ----------------

async function resolveFrameworkIdForBlocks(testRow: TestRow | null, testMeta: TestMeta | null | undefined) {
  // 1) prefer tests.framework_id when available
  const direct = (testRow as any)?.framework_id;
  if (typeof direct === "string" && direct) return direct;

  // 2) else use meta.framework_slug if present
  const slug = String((testMeta as any)?.framework_slug || "").trim();
  const fallbackSlug = slug || "native-4x8-core";

  const sb = sbAdmin();
  const q = await sb.from("frameworks").select("id, slug").eq("slug", fallbackSlug).maybeSingle();
  if (!q.error && q.data?.id) return q.data.id as string;

  return null;
}

async function resolveLayoutTemplate(testRow: TestRow | null, testMeta: TestMeta | null | undefined) {
  const sb = sbAdmin();

  // 1) If tests.report_layout_template_id is set, use it
  const tid = (testRow as any)?.report_layout_template_id;
  if (typeof tid === "string" && tid) {
    const q = await sb.from("report_layout_templates").select("id, slug, version, status, sections_json").eq("id", tid).maybeSingle();
    if (!q.error && q.data) return q.data as any;
  }

  // 2) Else resolve by slug: meta.report_layout_template_slug OR meta.report_layout OR "lead"
  const slug =
    String((testMeta as any)?.report_layout_template_slug || "").trim() ||
    String((testMeta as any)?.report_layout || "").trim() ||
    "lead";

  const q = await sb
    .from("report_layout_templates")
    .select("id, slug, version, status, sections_json")
    .eq("slug", slug)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!q.error && q.data) return q.data as any;

  return null;
}

function normaliseLayoutItems(sections_json: any): LayoutItem[] {
  const raw = Array.isArray(sections_json) ? sections_json : [];
  const out: LayoutItem[] = [];

  for (const it of raw) {
    if (!it) continue;
    if (typeof it === "string") out.push({ key: it, scope: "global" });
    else if (typeof it === "object") {
      const key = String((it as any).key || "").trim();
      if (!key) continue;
      const scopeRaw = String((it as any).scope || "").trim().toLowerCase();
      const scope =
        scopeRaw === "profile" ? "profile" : scopeRaw === "frequency" ? "frequency" : "global";
      out.push({ key, scope });
    }
  }

  return out;
}

async function fetchLatestActiveBlock(
  framework_id: string,
  entity_type: "global" | "profile" | "frequency",
  entity_code: string | null,
  block_key: string,
) {
  const sb = sbAdmin();

  const q = await sb
    .from("framework_content_blocks")
    .select("id, block_key, entity_type, entity_code, version, status, content_json, created_at")
    .eq("framework_id", framework_id)
    .eq("block_key", block_key)
    .eq("entity_type", entity_type)
    // entity_code handling
    .match(entity_code ? { entity_code } : {})
    .is(entity_code ? undefined : ("entity_code" as any), entity_code ? undefined : null)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (q.error || !q.data) return null;
  return q.data as any;
}

function blockToSection(block_key: string, content_json: any) {
  // Accept multiple shapes; normalize into: { id, title, blocks }
  const cj = content_json ?? {};

  // If content_json already looks like a section
  const title = typeof cj?.title === "string" ? cj.title : null;
  const blocks =
    Array.isArray(cj?.blocks) ? cj.blocks :
    Array.isArray(cj) ? cj :
    Array.isArray(cj?.content) ? cj.content :
    [];

  return {
    id: block_key,
    title: title || null,
    blocks,
  };
}

function insertAfterKey(sections: any[], afterId: string, toInsert: any) {
  if (!toInsert) return sections;
  const idx = sections.findIndex((s) => String(s?.id || "").trim().toLowerCase() === afterId.trim().toLowerCase());
  if (idx < 0) return [...sections, toInsert];
  const out = [...sections];
  out.splice(idx + 1, 0, toInsert);
  return out;
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
    let frameworkSource: "filesystem" | "storage" | "blocks" = "filesystem";

    // We'll decide engine later; storage json may still be used
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
    const profileTotals: Record<string, number> =
      savedRead.profileSum > 0 ? savedRead.profileTotals : comp.profileTotals;

    const frequency_percentages = toPercentages<AB>(freqTotals);
    const profile_percentages = toPercentages<string>(profileTotals);

    const top_freq =
      (Object.entries(freqTotals) as [AB, number][])
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "A";

    const top_profile_entry =
      Object.entries(profileTotals).sort((a, b) => b[1] - a[1])[0] || ["PROFILE_1", 0];

    const top_profile_code = String(top_profile_entry[0] || "PROFILE_1").toUpperCase();
    const top_profile_name =
      profile_labels.find((p) => p.code === top_profile_code)?.name ||
      look.profileByCode.get(top_profile_code)?.name ||
      top_profile_code;

    // --------------------------------------------
    // ✅ Sections payload:
    //  - Native V2 blocks engine when enabled
    //  - Else: existing storage JSON sections (Option A)
    // --------------------------------------------
    let sections: any = null;
    let removed_overlap_count = 0;

    const reportEngine = String((testMeta as any)?.report_engine || "").trim().toLowerCase();
    const useBlocksEngine = reportEngine === "native_v2_blocks";

    if (useBlocksEngine) {
      const frameworkId = await resolveFrameworkIdForBlocks(testRow, testMeta);
      const layout = await resolveLayoutTemplate(testRow, testMeta);

      const layoutItems = normaliseLayoutItems(layout?.sections_json);
      const hasLayout = layoutItems.length > 0;

      frameworkSource = "blocks";

      const commonOut: any[] = [];
      const profileOut: any[] = [];

      if (frameworkId && hasLayout) {
        for (const item of layoutItems) {
          const key = String(item.key || "").trim();
          if (!key) continue;

          const scope = item.scope || "global";

          let entity_type: "global" | "profile" | "frequency" = "global";
          let entity_code: string | null = null;

          if (scope === "profile") {
            entity_type = "profile";
            entity_code = top_profile_code;
          } else if (scope === "frequency") {
            entity_type = "frequency";
            entity_code = top_freq;
          } else {
            entity_type = "global";
            entity_code = null;
          }

          const row = await fetchLatestActiveBlock(frameworkId, entity_type, entity_code, key);
          if (!row) continue;

          const sec = blockToSection(key, row.content_json);
          if (scope === "profile") profileOut.push(sec);
          else commonOut.push(sec);
        }

        // Add segmentation section (qual questions) into common
        const qualQs = await fetchQualQuestions(meta.test_id);
        const segSection = buildSegmentationSection(qualQs, sub.answers_json);

        // Insert segmentation after summary.high_level if present, otherwise append
        const commonWithSeg = segSection
          ? insertAfterKey(commonOut, "summary.high_level", segSection)
          : commonOut;

        sections = {
          common: dedupeSectionsById(commonWithSeg),
          profile: dedupeSectionsById(profileOut),
          report_title: meta.test_name || testRow?.name || pickReportTitle(fw) || null,
          profile_missing: profileOut.length === 0,
          framework_version: null,
          framework_bucket: null,
          framework_path: null,
          layout_template: {
            id: layout?.id || null,
            slug: layout?.slug || null,
            version: layout?.version || null,
          },
          blocks_framework_id: frameworkId,
        };
      } else {
        // Fail-soft: no framework/template — return empty sections rather than crash
        sections = {
          common: [],
          profile: [],
          report_title: meta.test_name || testRow?.name || null,
          profile_missing: true,
          framework_version: null,
          framework_bucket: null,
          framework_path: null,
          layout_template: {
            id: layout?.id || null,
            slug: layout?.slug || null,
            version: layout?.version || null,
          },
          blocks_framework_id: frameworkId,
        };
      }
    } else if (useStorageFramework && frameworkSource === "storage") {
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
    }

    // ✅ Link behavior comes from resolveLinkMeta() columns
    const rawLinkMeta = meta.link_meta || null;
    const linkMeta = isPortalViewer ? sanitizeLinkMetaForPortal(rawLinkMeta) : rawLinkMeta;

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

        // ✅ clients use this for show/hide/redirect
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

          reportEngine,
          useBlocksEngine,

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

          src,
          isPortalViewer,
        },

        version: useBlocksEngine
          ? "portal-native-v2-blocks+layout+labels+qual"
          : useStorageFramework
            ? "portal-v2-storage-meta+labels+qual"
            : "portal-v1",
      },
    });
  } catch (e: any) {
    console.error("report route error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}