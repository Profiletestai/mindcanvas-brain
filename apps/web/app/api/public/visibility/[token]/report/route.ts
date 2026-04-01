// apps/web/app/api/public/visibility/[token]/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrimePillar = "visibility" | "trust" | "authority" | "dominance";
type ReportVariant = "full" | "lite";

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

function visibility() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    db: { schema: "visibility" },
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

function isPrimeMode(
  engineKey: string | null | undefined,
  version: number | null | undefined
) {
  return (
    String(engineKey || "").toLowerCase() === "visibility_prime_v1" ||
    Number(version || 0) >= 2
  );
}

function normalizeReportVariant(v: any): ReportVariant {
  return String(v || "").trim().toLowerCase() === "lite" ? "lite" : "full";
}

function resolveReportAudience(
  requestedAudience: string,
  reportVariant: ReportVariant
) {
  if (requestedAudience !== "taker_report") return requestedAudience;
  return reportVariant === "lite" ? "taker_report_lite" : "taker_report";
}

function resolveAiAudience(effectiveAudience: string) {
  return `${effectiveAudience}_ai`;
}

function defaultTitles(key: string, mode: "legacy" | "prime") {
  const legacy: Record<string, string> = {
    welcome: "A Personal Welcome From Bogdan Stan",
    how_to_use: "How To Use This Report",
    understanding: "Understanding the Visibility Ladder",
    tiers_levels: "Explanation of tiers and levels",
    behaviour_profiles: "Explanation of behaviour profiles",
    framework_foundation: "Framework foundation",
    snapshot: "Your visibility snapshot",
    pillars: "Your visibility pillars",
    level_meaning: "What your current level means",
    strengths: "What is already working",
    friction: "Where visibility friction exists",
    market_experience: "How the market is likely experiencing your business",
    opportunity: "Your strategic visibility opportunity",
    next_move: "Your most effective next move",
    possible_next: "What becomes possible next",
    closing: "Turning insight into strategy",
  };

  const prime: Record<string, string> = {
    welcome: "A Personal Welcome From Bogdan Stan",
    how_to_use: "How To Use This Report",
    understanding: "Understanding the WhatsWhat Prime Ladder",
    tiers_levels: "How tiers and levels work",
    framework_foundation: "The Prime framework",
    snapshot: "Your Prime visibility snapshot",
    pillars: "Your Prime visibility pillars",
    level_meaning: "What your current level means",
    strengths: "What is already working",
    friction: "Where strategic friction exists",
    market_experience: "How the market is likely experiencing your business",
    opportunity: "Your strategic Prime opportunity",
    next_move: "Your most effective next move",
    possible_next: "What becomes possible next",
    closing: "Turning insight into momentum",
  };

  const map = mode === "prime" ? prime : legacy;
  return map[key] || key;
}

async function callRpc<T>(sb: any, fn: string, args: any): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

function hasPillarSignals(result: any) {
  const ps = result?.pillar_scores;
  const pb = result?.pillar_bands;
  const wp = result?.weakest_pillar;
  const sp = result?.strongest_pillar;

  const knownKeys = [
    "discoverability",
    "trust",
    "conversion",
    "visibility",
    "authority",
    "dominance",
  ];

  const okScores =
    ps &&
    typeof ps === "object" &&
    (Object.keys(ps).length > 0 || knownKeys.some((k) => ps?.[k] != null));

  const okBands = pb && typeof pb === "object" && Object.keys(pb).length > 0;
  return Boolean(okScores || okBands || wp || sp);
}

function cachedMissingIntroOrEmptyBlocks(
  cached: any,
  mode: "legacy" | "prime",
  audience: string
) {
  if (audience !== "taker_report") return false;

  const want =
    mode === "prime"
      ? ["welcome", "how_to_use", "understanding", "tiers_levels"]
      : [
          "welcome",
          "how_to_use",
          "understanding",
          "tiers_levels",
          "behaviour_profiles",
        ];

  const secs = Array.isArray(cached?.sections) ? cached.sections : [];
  const byKey = new Map<string, any>();
  for (const s of secs) byKey.set(String(s?.key || ""), s);

  for (const k of want) {
    const s = byKey.get(k);
    if (!s) return true;
    const blocks = Array.isArray(s?.blocks) ? s.blocks : [];
    if (blocks.length === 0) return true;
  }

  return false;
}

function cachedNeedsPrimeRefresh(cached: any, audience: string) {
  if (audience !== "taker_report") return false;

  const signals = cached?.signals || {};
  const graphs = cached?.graphs || {};
  const sections = Array.isArray(cached?.sections) ? cached.sections : [];

  const hasPrimePillars =
    signals?.pillar_scores &&
    typeof signals.pillar_scores === "object" &&
    signals.pillar_scores.visibility != null &&
    signals.pillar_scores.trust != null &&
    signals.pillar_scores.authority != null &&
    signals.pillar_scores.dominance != null;

  const hasLegacyProfileSection = sections.some(
    (s: any) => String(s?.key || "") === "behaviour_profiles"
  );

  const exposesPersonalityGraph =
    graphs?.personality_points &&
    typeof graphs.personality_points === "object" &&
    Object.keys(graphs.personality_points).length > 0;

  if (!hasPrimePillars) return true;
  if (hasLegacyProfileSection) return true;
  if (exposesPersonalityGraph) return true;

  return false;
}

/* ---------------- AI (OpenAI Responses API) ---------------- */

type AiInsights = {
  executive_summary: string;
  what_this_means: string;
  strengths: string[];
  friction: string[];
  strategic_opportunity: string;
  plan_7_days: string[];
  plan_30_days: string[];
  closing_note: string;
};

function aiEnabled() {
  return (
    String(process.env.VISIBILITY_AI_ENABLED || "true").toLowerCase() !== "false"
  );
}

function openaiModel() {
  const m =
    process.env.OPENAI_VISIBILITY_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

  if (typeof m === "string" && m.trim().toLowerCase().startsWith("sk-")) {
    return "gpt-4.1-mini";
  }

  return m;
}

function openaiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function aiSchema() {
  return {
    name: "visibility_ai_insights_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        executive_summary: { type: "string" },
        what_this_means: { type: "string" },
        strengths: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 7,
        },
        friction: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 7,
        },
        strategic_opportunity: { type: "string" },
        plan_7_days: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 10,
        },
        plan_30_days: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 12,
        },
        closing_note: { type: "string" },
      },
      required: [
        "executive_summary",
        "what_this_means",
        "strengths",
        "friction",
        "strategic_opportunity",
        "plan_7_days",
        "plan_30_days",
        "closing_note",
      ],
    },
  };
}

function buildAiPrompt(input: {
  orgName: string | null;
  testName: string;
  takerName: string | null;
  signals: any;
  graphs: any;
  sections: any[];
  mode: "legacy" | "prime";
  audience: string;
  reportVariant: ReportVariant;
}) {
  const {
    orgName,
    testName,
    takerName,
    signals,
    graphs,
    sections,
    mode,
    audience,
    reportVariant,
  } = input;

  const baseNarrative = (sections || [])
    .map((s) => {
      const blocks = Array.isArray(s?.blocks) ? s.blocks : [];
      const text = blocks
        .flatMap((b: any) => {
          const paras = Array.isArray(b?.paragraphs) ? b.paragraphs : [];
          return paras.map((p: any) => String(p || "")).filter(Boolean);
        })
        .slice(0, 6)
        .join("\n");
      return `## ${String(s?.title || s?.key)}\n${text}`.trim();
    })
    .join("\n\n")
    .slice(0, 9000);

  const extraRules =
    mode === "prime" && audience === "taker_report"
      ? [
          "This is the Prime model.",
          "Prime public pillars are Visibility, Trust, Authority, and Dominance.",
          "Do not treat personality/behaviour style as part of the public scoring explanation.",
          "If strong dominance/authority appears, avoid overstating validation; keep claims grounded in the provided signals.",
        ].join(" ")
      : "Use the provided scoring model and signals as-is.";

  const variantRules =
    reportVariant === "lite"
      ? "This is a lite lead-generation report. Keep the output concise, commercially useful, and high-value without exhausting every detail."
      : "This is the full report. Provide fuller interpretation and progression guidance.";

  return [
    {
      role: "system",
      content: [
        "You are an expert business positioning strategist and report writer.",
        "Write in plain, confident language. No fluff. No hype.",
        "Do not invent facts. Only use the provided signals + narrative.",
        extraRules,
        variantRules,
        "Output MUST match the provided JSON schema exactly.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Create the AI insights layer for a Visibility Ladder report.`,
        "",
        `Org: ${orgName || "—"}`,
        `Test: ${testName}`,
        `Participant: ${takerName || "—"}`,
        `Mode: ${mode}`,
        `Audience: ${audience}`,
        `Report variant: ${reportVariant}`,
        "",
        `Signals JSON: ${JSON.stringify(signals)}`,
        `Graphs JSON: ${JSON.stringify(graphs)}`,
        "",
        `Deterministic narrative (ground truth context):`,
        baseNarrative || "(none)",
        "",
        "Requirements:",
        "- Summarise tier/level in plain language.",
        "- Interpret pillar patterns (strengths + friction).",
        "- Provide ONE strategic opportunity (not a list of tactics).",
        "- Provide a 7-day quick wins plan + 30-day stabilise/progress plan.",
        "- Keep it client-facing.",
      ].join("\n"),
    },
  ];
}

function extractOutputText(respJson: any): string {
  if (
    typeof respJson?.output_text === "string" &&
    respJson.output_text.trim()
  ) {
    return respJson.output_text.trim();
  }

  const out = Array.isArray(respJson?.output) ? respJson.output : [];
  for (const item of out) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (
        c?.type === "output_text" &&
        typeof c?.text === "string" &&
        c.text.trim()
      ) {
        return c.text.trim();
      }
    }
  }
  return "";
}

async function generateAiInsights(payload: {
  orgName: string | null;
  testName: string;
  takerName: string | null;
  signals: any;
  graphs: any;
  sections: any[];
  mode: "legacy" | "prime";
  audience: string;
  reportVariant: ReportVariant;
}): Promise<AiInsights> {
  const key = openaiKey();
  if (!key) throw new Error("Missing OPENAI_API_KEY");

  const model = openaiModel();
  const messages = buildAiPrompt(payload);

  const body = {
    model,
    input: messages,
    temperature: 0.4,
    text: {
      format: {
        type: "json_schema",
        ...aiSchema(),
      },
    },
  };

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 25_000);
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const j = await r.json().catch(() => ({} as any));
    if (!r.ok) {
      const msg = j?.error?.message || `OpenAI HTTP ${r.status}`;
      throw new Error(msg);
    }

    const text = extractOutputText(j);
    if (!text) throw new Error("OpenAI returned no output_text");

    return JSON.parse(text) as AiInsights;
  } finally {
    clearTimeout(t);
  }
}

function isBadAiCache(row: any): boolean {
  if (!row || typeof row !== "object") return true;
  if (!row.ai || typeof row.ai !== "object") return true;
  const aiErr = safeString(row?.ai_meta?.error) || safeString(row?.meta?.ai_error);
  if (aiErr) return true;
  return false;
}

function normalizePrimePillarScores(raw: any) {
  return {
    visibility: safeNumber(raw?.visibility),
    trust: safeNumber(raw?.trust),
    authority: safeNumber(raw?.authority),
    dominance: safeNumber(raw?.dominance),
  };
}

function normalizeLegacyPillarScores(raw: any) {
  return {
    discoverability: safeNumber(raw?.discoverability),
    trust: safeNumber(raw?.trust),
    conversion: safeNumber(raw?.conversion),
  };
}

/* ---------------- Route ---------------- */

export async function GET(
  req: NextRequest,
  ctx: { params: { token: string } }
) {
  try {
    const token = safeString(ctx.params?.token);
    const tid = safeString(req.nextUrl.searchParams.get("tid"));
    const sid = safeString(req.nextUrl.searchParams.get("sid"));
    const requestedAudience =
      safeString(req.nextUrl.searchParams.get("audience")) || "taker_report";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token" },
        { status: 400 }
      );
    }

    if (!tid && !sid) {
      return NextResponse.json(
        { ok: false, error: "Missing tid or sid" },
        { status: 400 }
      );
    }

    const sb = portal();
    const vis = visibility();

    const { data: linkRow, error: linkErr } = await sb
      .from("test_links")
      .select("id, test_id, meta, next_steps_url")
      .eq("token", token)
      .maybeSingle();

    if (linkErr) throw new Error(linkErr.message);

    // 0) Optional taker load (used when tid is present)
    let taker: any = null;
    if (tid) {
      const { data: takerRow, error: takerErr } = await sb
        .from("test_takers")
        .select("id, org_id, test_id, link_token, first_name, last_name, email")
        .eq("id", tid)
        .eq("link_token", token)
        .maybeSingle();

      if (takerErr) throw new Error(takerErr.message);
      if (!takerRow) {
        return NextResponse.json(
          { ok: false, error: "Taker not found for this token" },
          { status: 404 }
        );
      }
      taker = takerRow;
    }

    // 1) Resolve submission row
    let submissionId: string | null = sid || null;
    let submissionRow: any = null;

    if (submissionId) {
      const { data, error } = await vis
        .from("submissions")
        .select(
          "id, org_id, test_id, test_link_id, token, taker_email, taker_name, metadata, created_at"
        )
        .eq("id", submissionId)
        .eq("token", token)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        return NextResponse.json(
          { ok: false, error: "Submission not found for this token" },
          { status: 404 }
        );
      }
      submissionRow = data;
    } else {
      const { data: subs, error: subsErr } = await vis
        .from("submissions")
        .select(
          "id, org_id, test_id, test_link_id, token, taker_email, taker_name, metadata, created_at"
        )
        .eq("token", token)
        .order("created_at", { ascending: false })
        .limit(80);

      if (subsErr) throw new Error(subsErr.message);

      const takerEmail = safeString(taker?.email).toLowerCase();
      const takerName = [taker?.first_name, taker?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      const byMeta =
        (subs || []).find((s: any) => safeString(s?.metadata?.taker_id) === tid) ||
        null;

      const byEmail =
        !byMeta && takerEmail
          ? (subs || []).find(
              (s: any) => safeString(s?.taker_email).toLowerCase() === takerEmail
            ) || null
          : null;

      const byName =
        !byMeta && !byEmail && takerName
          ? (subs || []).find((s: any) => safeString(s?.taker_name) === takerName) ||
            null
          : null;

      const picked = byMeta || byEmail || byName || (subs || [])[0] || null;

      if (!picked?.id) {
        return NextResponse.json(
          {
            ok: false,
            error: "No visibility submission found for this token/taker yet.",
          },
          { status: 404 }
        );
      }

      submissionId = String(picked.id);
      submissionRow = picked;
    }

    // 2) Load latest result
    let { data: result, error: resErr } = await vis
      .from("results")
      .select(
        "id, created_at, engine_key, version, tier, level, readiness, personality_type, personality_points, personality_percent, tier_counts, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, balance_pattern, pattern_tags, computed, debug"
      )
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (resErr) throw new Error(resErr.message);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Visibility results not found." },
        { status: 404 }
      );
    }

    const engineKey = String(result.engine_key || "visibility_v1");
    const version = Number(result.version || 1);
    const mode: "legacy" | "prime" = isPrimeMode(engineKey, version)
      ? "prime"
      : "legacy";

    const portalTestId =
      taker?.test_id ||
      submissionRow?.metadata?.portal_test_id ||
      result?.computed?.portal_test_id ||
      linkRow?.test_id ||
      null;

    const testRowResp = portalTestId
      ? await sb
          .from("tests")
          .select("id, name, slug, meta")
          .eq("id", portalTestId)
          .maybeSingle()
      : { data: null as any, error: null as any };

    if (testRowResp.error) throw new Error(testRowResp.error.message);

    const portalTest = testRowResp.data || null;

    const reportVariant = normalizeReportVariant(
      linkRow?.meta?.report_variant || portalTest?.meta?.report_variant
    );

    const effectiveAudience = resolveReportAudience(
      requestedAudience,
      reportVariant
    );
    const aiAudience = resolveAiAudience(effectiveAudience);
    const isLiteReport =
      requestedAudience === "taker_report" && reportVariant === "lite";
    const kbAudience =
      requestedAudience === "taker_report" ? "taker_report" : effectiveAudience;

    // 3) Ensure pillar signals exist for legacy only.
    if (mode === "legacy" && !hasPillarSignals(result)) {
      try {
        const pillarRpc = await callRpc<any>(
          vis,
          "compute_pillar_signals_for_submission",
          { p_submission_id: submissionId }
        );

        if (pillarRpc?.ok === true && pillarRpc?.computed) {
          const computed = pillarRpc.computed;

          await vis
            .from("results")
            .update({
              pillar_scores: computed.pillar_scores ?? {},
              pillar_bands: computed.pillar_bands ?? {},
              weakest_pillar: computed.weakest_pillar ?? null,
              strongest_pillar: computed.strongest_pillar ?? null,
              pattern_tags: Array.isArray(computed.pattern_tags)
                ? computed.pattern_tags
                : [],
            })
            .eq("id", result.id);

          const reread = await vis
            .from("results")
            .select(
              "id, created_at, engine_key, version, tier, level, readiness, personality_type, personality_points, personality_percent, tier_counts, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, balance_pattern, pattern_tags, computed, debug"
            )
            .eq("id", result.id)
            .maybeSingle();

          if (!reread.error && reread.data) result = reread.data;
        }
      } catch (e) {
        console.warn("[visibility report] legacy pillar RPC failed", e);
      }
    }

    // 4) Cache lookup
    let cached = await callRpc<any>(vis, "get_generated_report", {
      p_submission_id: submissionId,
      p_audience: effectiveAudience,
      p_engine_key: engineKey,
      p_version: version,
    });

    if (cached) {
      if (cachedMissingIntroOrEmptyBlocks(cached, mode, effectiveAudience)) {
        cached = null;
      } else if (mode === "prime" && cachedNeedsPrimeRefresh(cached, effectiveAudience)) {
        cached = null;
      }
    }

    const buildDeterministic = async () => {
      const orgId = taker?.org_id || submissionRow?.org_id || null;

      const orgRowResp = orgId
        ? await sb
            .from("orgs")
            .select("id, slug, name, logo_url")
            .eq("id", orgId)
            .maybeSingle()
        : { data: null as any };

      const orgRow = orgRowResp.data || null;
      const testRow = portalTest || null;

      const orgName = orgRow?.name || orgRow?.slug || null;
      const testName =
        testRow?.name ||
        (mode === "prime"
          ? "WhatsWhat Prime Visibility Ladder"
          : "Visibility Ladder");

      const takerName =
        [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim() ||
        safeString(submissionRow?.taker_name) ||
        null;

      const isPrimePublic = mode === "prime" && requestedAudience === "taker_report";

      const primePillarScores =
        mode === "prime" ? normalizePrimePillarScores(result?.pillar_scores) : null;

      const legacyPillarScores =
        mode === "legacy" ? normalizeLegacyPillarScores(result?.pillar_scores) : null;

      const signals =
        mode === "prime"
          ? {
              mode,
              pillar_model: "prime",
              public_profile_model: isPrimePublic ? "hidden" : "visible",
              tier: result.tier,
              level: Number(result.level ?? 0),
              readiness: result.readiness,
              pillar_scores: primePillarScores,
              pillar_bands: result.pillar_bands || {},
              weakest_pillar: result.weakest_pillar ?? null,
              strongest_pillar: result.strongest_pillar ?? null,
              balance_pattern: result.balance_pattern ?? null,
              pattern_tags: result.pattern_tags || [],
              overall_pct: result?.computed?.overall_pct ?? null,
              validation_required: Boolean(result?.computed?.validation_required),
              validation_status: safeString(result?.computed?.validation_status) || null,
              ladder_question_count:
                safeNumber(result?.computed?.ladder_question_count) || 20,
            }
          : {
              mode,
              pillar_model: "legacy",
              tier: result.tier,
              level: Number(result.level ?? 0),
              style: result.personality_type,
              readiness: result.readiness,
              pillar_scores: legacyPillarScores,
              pillar_bands: result.pillar_bands || {},
              weakest_pillar: result.weakest_pillar ?? null,
              strongest_pillar: result.strongest_pillar ?? null,
              pattern_tags: result.pattern_tags || [],
            };

      const sectionKeys =
        isPrimePublic
          ? isLiteReport
            ? [
                "snapshot",
                "pillars",
                "level_meaning",
                "market_experience",
                "opportunity",
                "next_move",
                "closing",
              ]
            : [
                "welcome",
                "how_to_use",
                "understanding",
                "tiers_levels",
                "framework_foundation",
                "snapshot",
                "pillars",
                "level_meaning",
                "strengths",
                "friction",
                "market_experience",
                "opportunity",
                "next_move",
                "possible_next",
                "closing",
              ]
          : isLiteReport
            ? [
                "snapshot",
                "pillars",
                "level_meaning",
                "market_experience",
                "opportunity",
                "next_move",
                "closing",
              ]
            : [
                "welcome",
                "how_to_use",
                "understanding",
                "tiers_levels",
                "behaviour_profiles",
                "framework_foundation",
                "snapshot",
                "pillars",
                "level_meaning",
                "strengths",
                "friction",
                "market_experience",
                "opportunity",
                "next_move",
                "possible_next",
                "closing",
              ];

      const sections: any[] = [];
      const selectedBlocks: any[] = [];

      for (const key of sectionKeys) {
        let blocks = await callRpc<any[]>(vis, "kb_select_blocks", {
          p_section_key: key,
          p_audience: kbAudience,
          p_signals: signals,
          p_limit: 6,
        });

        if (!blocks || blocks.length === 0) {
          blocks = await callRpc<any[]>(vis, "kb_select_blocks", {
            p_section_key: key,
            p_audience: kbAudience,
            p_signals: {},
            p_limit: 6,
          });
        }

        const contentBlocks = (blocks || []).map((b: any) => b.content).filter(Boolean);

        sections.push({
          key,
          title: contentBlocks?.[0]?.title || defaultTitles(key, mode),
          blocks: contentBlocks,
        });

        selectedBlocks.push(
          ...(blocks || []).map((b: any) => ({
            section_key: key,
            id: b.id,
            match_score: b.match_score,
            priority: b.priority,
            triggers: b.triggers,
          }))
        );
      }

      const graphs =
        mode === "prime"
          ? {
              pillar_model: "prime",
              tier_counts: result.tier_counts || {},
              ladder: {
                tier: result.tier,
                level: Number(result.level ?? 0),
              },
              pillars: primePillarScores || {},
              pillar_bands: result.pillar_bands || {},
              personality_points: null,
            }
          : {
              pillar_model: "legacy",
              tier_counts: result.tier_counts || {},
              personality_points: result.personality_points || {},
              ladder: {
                tier: result.tier,
                level: Number(result.level ?? 0),
              },
              pillars: legacyPillarScores || {},
              pillar_bands: result.pillar_bands || {},
            };

      return {
        orgRow,
        orgName,
        testName,
        takerName,
        signals,
        graphs,
        sections,
        selectedBlocks,
      };
    };

    // 5) Cache miss → deterministic + optional AI
    if (!cached) {
      const det = await buildDeterministic();

      let ai: AiInsights | null = null;
      const ai_meta: any = { enabled: false };

      if (aiEnabled()) {
        ai_meta.enabled = true;

        try {
          const cachedAi = await callRpc<any>(vis, "get_generated_report", {
            p_submission_id: submissionId,
            p_audience: aiAudience,
            p_engine_key: engineKey,
            p_version: version,
          });

          if (cachedAi && !isBadAiCache(cachedAi)) {
            ai = cachedAi.ai as AiInsights;
            ai_meta.cached = true;
            ai_meta.model = cachedAi?.ai_meta?.model || null;
            ai_meta.generated_at = cachedAi?.ai_meta?.generated_at || null;
          } else {
            const aiOut = await generateAiInsights({
              orgName: det.orgName,
              testName: det.testName,
              takerName: det.takerName,
              signals: det.signals,
              graphs: det.graphs,
              sections: det.sections,
              mode,
              audience: effectiveAudience,
              reportVariant,
            });

            ai = aiOut;
            ai_meta.cached = false;
            ai_meta.model = openaiModel();
            ai_meta.generated_at = new Date().toISOString();

            const aiCacheJson = {
              token,
              tid: tid || null,
              sid: submissionId,
              submission_id: submissionId,
              engine_key: engineKey,
              version,
              audience: aiAudience,
              meta: {
                org_name: det.orgName,
                org_logo_url: det.orgRow?.logo_url || null,
                test_name: det.testName,
                generated_at: ai_meta.generated_at,
                mode: "ai",
                scoring_mode: mode,
                report_variant: reportVariant,
              },
              ai: aiOut,
              ai_meta,
            };

            await callRpc<any>(vis, "upsert_generated_report", {
              p_submission_id: submissionId,
              p_audience: aiAudience,
              p_report_json: aiCacheJson,
              p_signals: det.signals,
              p_selected_blocks: [],
              p_engine_key: engineKey,
              p_version: version,
            });
          }
        } catch (e: any) {
          ai_meta.error = String(e?.message || e);
          ai = null;
        }
      }

      const reportJson = {
        token,
        tid: tid || null,
        sid: submissionId,
        submission_id: submissionId,
        engine_key: engineKey,
        version,
        audience: effectiveAudience,
        meta: {
          org_name: det.orgName,
          org_logo_url: det.orgRow?.logo_url || null,
          test_name: det.testName,
          generated_at: new Date().toISOString(),
          mode: "deterministic",
          scoring_mode: mode,
          report_variant: reportVariant,
        },
        signals: det.signals,
        graphs: det.graphs,
        sections: det.sections,
        ai,
        ai_meta,
      };

      await callRpc<any>(vis, "upsert_generated_report", {
        p_submission_id: submissionId,
        p_audience: effectiveAudience,
        p_report_json: reportJson,
        p_signals: det.signals,
        p_selected_blocks: det.selectedBlocks,
        p_engine_key: engineKey,
        p_version: version,
      });

      return NextResponse.json(
        {
          ok: true,
          data: reportJson,
          __meta: {
            cached: false,
            submission_id: submissionId,
            engine_key: engineKey,
            version,
            audience: effectiveAudience,
            scoring_mode: mode,
            report_variant: reportVariant,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: cached,
        __meta: {
          cached: true,
          submission_id: submissionId,
          engine_key: engineKey,
          version,
          audience: effectiveAudience,
          scoring_mode: mode,
          report_variant: reportVariant,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}