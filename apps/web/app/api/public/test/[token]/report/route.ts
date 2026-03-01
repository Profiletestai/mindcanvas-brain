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

  // ✅ org display fields for header
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

  // report engine selector
  report_engine?: string;

  // Preferred (meta-driven storage framework)
  report_framework_key?: string;
  report_framework_bucket?: string;
  report_framework_version?: string;

  // legacy storage shape
  reportFramework?: ReportFrameworkMeta;

  // legacy: labels in meta
  frequencies?: Array<{ code: AB; label: string }>;
  profiles?: Array<{ code: string; name: string; frequency?: AB; description?: string }>;
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
  | { type: "image"; src?: string; alt?: string; caption?: string; align?: "left" | "center" | "right"; max_h?: number }
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
  const raw = a?.value ?? a?.index ?? a?.selected ?? a?.selected_index ?? undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) {
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
    const maybe = (x as any)?.profile_map || (x as any)?.weights || (x as any)?.map || (x as any)?.options || null;
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

// ✅ Resolve org/test for a token (now includes org name/logo)
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
        orgs:orgs ( slug, name, logo_url )
      )
    `,
    )
    .eq("token", token)
    .limit(1)
    .maybeSingle();

  if (q.error || !q.data?.test_id) return null;

  const testName = (q.data as any)?.tests?.name ?? null;
  const org = (q.data as any)?.tests?.orgs ?? null;

  const orgSlug = org?.slug ?? null;
  const orgName = org?.name ?? null;
  const orgLogoUrl = org?.logo_url ?? null;

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
    org_name: orgName,
    org_logo_url: orgLogoUrl,
    link_meta,
  };
}

// Fetch latest submission for (taker_id, token)
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
    .select("id, slug, name, meta, org_id, report_layout_template_id")
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

// ---------- Blocks Engine helpers ----------

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
      scope: (String(s?.scope || "global").trim().toLowerCase() === "profile" ? "profile" : "global") as
        | "global"
        | "profile",
    }))
    .filter((s) => !!s.key);
}

async function fetchBlocksForKeys(opts: {
  keys: string[];
  entity_type: "global" | "profile";
  entity_code: string; // "GLOBAL" or top_profile_code
  version?: string; // "1.0"
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

  // choose newest/highest version if duplicates exist
  const map = new Map<string, BlockRow>();
  for (const r of q.data as any[]) {
    const key = String(r.block_key || "");
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, r as BlockRow);
      continue;
    }
    const vPrev = String(prev.version || "");
    const vNow = String(r.version || "");
    if (vNow > vPrev) map.set(key, r as BlockRow);
  }

  return map;
}

/**
 * Token replacement that preserves the input type.
 */
function replaceTokensDeep<T>(x: T, ctx: Record<string, string>): T {
  const walk = (v: any): any => {
    if (typeof v === "string") {
      let s = v;
      for (const [k, val] of Object.entries(ctx)) {
        s = s.split(`{{${k}}}`).join(val);
      }
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

  // Preferred shape: { title, blocks: [...] }
  if (Array.isArray(cj.blocks)) {
    return {
      title: safeText(cj.title) || fallbackTitle,
      blocks: cj.blocks as ReportSectionBlock[],
    };
  }

  // Support older “fields” shapes
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
      answerText = safeText((a as any)?.text) || safeText((a as any)?.value) || safeText((a as any)?.answer) || "";
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
    blocks: [{ type: "p", text: "These are the answers you provided to the initial questions." }, { type: "ul", items: rows }],
  };
}

// These MUST appear at the END of the whole report (after profile sections)
const GLOBAL_POST_PROFILE_KEYS = new Set<string>(["global.conclusion", "global.cta_next_steps"]);

// ---------------- Handler ----------------

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const token = params.token;
    const takerId = searchParams.get("tid");

    const src = (searchParams.get("src") || "").trim().toLowerCase();
    const isPortalViewer = src === "portal";

    if (!takerId) return NextResponse.json({ ok: false, error: "Missing tid" }, { status: 400 });

    const meta = await resolveLinkMeta(token);
    if (!meta) return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 404 });

    const testRow = await fetchTestRow(meta.test_id);
    const testMeta = (testRow?.meta || {}) as TestMeta;

    const reportEngine = String((testMeta as any)?.report_engine || "").trim();
    const useBlocksEngine = reportEngine === "native_v2_blocks";

    const storageChoice = resolveStorageFramework(testMeta);
    const useStorageFramework = storageChoice.use;

    const orgSlug = String(
      meta.org_slug || testMeta?.orgSlug || process.env.DEFAULT_ORG_SLUG || "competency-coach",
    ).trim();

    // Default: filesystem framework (by org)
    let fw: any = await loadFrameworkBySlug(orgSlug);
    let frameworkSource: "filesystem" | "storage" | "blocks" = "filesystem";

    // If storage framework chosen, download it
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

    const top_profile_entry =
      Object.entries(profileTotals).sort((a, b) => b[1] - a[1])[0] || ["PROFILE_1", 0];
    const top_profile_code = String(top_profile_entry[0] || "PROFILE_1").toUpperCase();
    const top_profile_name =
      profile_labels.find((p) => p.code === top_profile_code)?.name ||
      look.profileByCode.get(top_profile_code)?.name ||
      top_profile_code;

    // Secondary / Tertiary
    const sortedProfiles = [...profile_labels]
      .map((p) => ({ ...p, pct: profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));

    const secondary = sortedProfiles[1]?.name || "";
    const tertiary = sortedProfiles[2]?.name || "";

    const topFreqName = frequency_labels.find((f) => f.code === top_freq)?.name || top_freq;

    // ✅ token context for block JSON
    const tokenCtx: Record<string, string> = {
      TEST_NAME: meta.test_name || testRow?.name || "Profile Test",
      ORG_SLUG: orgSlug,
      PRIMARY_FREQ_NAME: topFreqName,
      PRIMARY_PROFILE_NAME: top_profile_name,
      SECONDARY_PROFILE_NAME: secondary,
      TERTIARY_PROFILE_NAME: tertiary,
      PROFILE_IMAGE_PRIMARY: `/images/operatingframe-full-test/profile-cards/${String(top_profile_name).toLowerCase()}.png`,
      PROFILE_IMAGE_SECONDARY: secondary ? `/images/operatingframe-full-test/profile-cards/${String(secondary).toLowerCase()}.png` : "",
      PROFILE_IMAGE_TERTIARY: tertiary ? `/images/operatingframe-full-test/profile-cards/${String(tertiary).toLowerCase()}.png` : "",
    };

    // Sections payload
    let sections: SectionsPayload | null = null;

    if (useBlocksEngine) {
      // Layout controls order
      const layoutSections = await fetchLayoutSections(testRow?.report_layout_template_id);

      const globalKeys = layoutSections.filter((s) => s.scope === "global").map((s) => s.key);
      const profileKeys = layoutSections.filter((s) => s.scope === "profile").map((s) => s.key);

      // Blocks live under entity_code = 'GLOBAL' and entity_code = top_profile_code
      const globalBlocks = await fetchBlocksForKeys({ keys: globalKeys, entity_type: "global", entity_code: "GLOBAL" });
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
            blocks: Array.isArray((merged as any)?.blocks) ? ((merged as any).blocks as ReportSectionBlock[]) : [],
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
            blocks: Array.isArray((merged as any)?.blocks) ? ((merged as any).blocks as ReportSectionBlock[]) : [],
          });
        }
      }

      // Insert segmentation responses after How To Use (if present)
      const qualQs = await fetchQualQuestions(meta.test_id);
      const segSection = buildSegmentationSection(qualQs, sub.answers_json);
      if (segSection) {
        const insertAfterId = "global.how_to_use";
        const idx = common.findIndex((c) => String(c.id) === insertAfterId);
        if (idx >= 0) common.splice(idx + 1, 0, segSection as any);
        else common.push(segSection as any);
      }

      // Append "post profile" global sections at the VERY end
      profile.push(...postProfile);

      sections = {
        common,
        profile,
        report_title: null,
        profile_missing: profile.length === 0,
        framework_version: storageChoice.version || null,
        framework_bucket: storageChoice.bucket || null,
        framework_path: storageChoice.path || null,
      };
    } else {
      sections = null;
    }

    // ✅ Link behavior comes from resolveLinkMeta() columns
    const rawLinkMeta = meta.link_meta || null;

    // ✅ Critical fix: portal viewer usually strips redirect URL,
    // but OperatingFrame must keep it so Next Steps works in src=portal.
    const isOperatingFrame = String(storageChoice.path || "").toLowerCase().includes("operatingframe/");
    const linkMeta =
      isPortalViewer && !isOperatingFrame
        ? sanitizeLinkMetaForPortal(rawLinkMeta)
        : rawLinkMeta;

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
        org_name: meta.org_name || null,
        test_name: meta.test_name || testRow?.name || testMeta?.test || "Profile Test",

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

        sections,

        debug: {
          reportEngine,
          useBlocksEngine,

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

          db_labels: {
            freq_count: dbLabels.freqs.length,
            profile_count: dbLabels.profiles.length,
          },

          blocks: useBlocksEngine
            ? {
                layout_sections_count: (sections?.common?.length || 0) + (sections?.profile?.length || 0),
                common_sections_count: sections?.common?.length || 0,
                profile_sections_count: sections?.profile?.length || 0,
                top_profile_code,
                moved_global_post_profile_keys: Array.from(GLOBAL_POST_PROFILE_KEYS),
              }
            : null,

          // helpful org debug
          org_name: meta.org_name || null,
          org_logo_url: meta.org_logo_url || null,

          src,
          isPortalViewer,
          isOperatingFrame,
        },

        version: useBlocksEngine ? "portal-native-v2-blocks+layout+labels+qual" : "portal-v1",
      },
    });
  } catch (e: any) {
    console.error("report route error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
