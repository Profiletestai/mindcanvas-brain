// apps/web/app/api/public/visibility/[token]/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return createClient(url, key, { db: { schema: "portal" }, auth: { persistSession: false } });
}

function visibility() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { db: { schema: "visibility" }, auth: { persistSession: false } });
}

function safeString(x: any) {
  return typeof x === "string" ? x.trim() : "";
}

function defaultTitles(key: string) {
  const m: Record<string, string> = {
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
  return m[key] || key;
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

  const okScores =
    ps &&
    typeof ps === "object" &&
    (Object.keys(ps).length > 0 ||
      ["discoverability", "trust", "conversion"].some((k) => ps?.[k] != null));

  const okBands = pb && typeof pb === "object" && Object.keys(pb).length > 0;
  return Boolean(okScores || okBands || wp || sp);
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
  // default ON unless explicitly disabled
  return String(process.env.VISIBILITY_AI_ENABLED || "true").toLowerCase() !== "false";
}

function openaiModel() {
  return process.env.OPENAI_VISIBILITY_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
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
        strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 7 },
        friction: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 7 },
        strategic_opportunity: { type: "string" },
        plan_7_days: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 10 },
        plan_30_days: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 12 },
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
}) {
  const { orgName, testName, takerName, signals, graphs, sections } = input;

  // Keep context tight + deterministic base narrative for grounding.
  const baseNarrative = sections
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

  return [
    {
      role: "system",
      content: [
        "You are an expert business positioning strategist and report writer.",
        "Write in plain, confident language. No fluff. No hype. No therapy tone.",
        "Be specific, but never invent facts that are not in the provided signals.",
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
  // Responses API returns content in output[].content[] items.
  const out = Array.isArray(respJson?.output) ? respJson.output : [];
  for (const item of out) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    const t = content.find((c: any) => c?.type === "output_text")?.text;
    if (typeof t === "string" && t.trim()) return t.trim();
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
}): Promise<AiInsights> {
  const key = openaiKey();
  if (!key) throw new Error("Missing OPENAI_API_KEY");

  const model = openaiModel();
  const messages = buildAiPrompt(payload);

  // IMPORTANT:
  // Structured output in Responses API uses text.format (not response_format). :contentReference[oaicite:1]{index=1}
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

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
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

  // Because we requested json_schema, output_text should be valid JSON.
  const parsed = JSON.parse(text);
  return parsed as AiInsights;
}

/* ---------------- Route ---------------- */

export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const token = safeString(ctx.params?.token);
    const tid = safeString(req.nextUrl.searchParams.get("tid"));
    const sid = safeString(req.nextUrl.searchParams.get("sid"));
    const audience = safeString(req.nextUrl.searchParams.get("audience")) || "taker_report";

    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    if (!tid && !sid) return NextResponse.json({ ok: false, error: "Missing tid or sid" }, { status: 400 });

    const sb = portal();
    const vis = visibility();

    // 0) Load taker (required for public route)
    let taker: any = null;
    if (tid) {
      const { data: takerRow, error: takerErr } = await sb
        .from("test_takers")
        .select("id, org_id, test_id, link_token, first_name, last_name, email")
        .eq("id", tid)
        .eq("link_token", token)
        .maybeSingle();
      if (takerErr) throw new Error(takerErr.message);
      if (!takerRow) return NextResponse.json({ ok: false, error: "Taker not found for this token" }, { status: 404 });
      taker = takerRow;
    }

    // 1) Resolve submission_id
    let submissionId: string | null = sid || null;

    if (!submissionId) {
      const { data: subs, error: subsErr } = await vis
        .from("submissions")
        .select("id, created_at, token, taker_email, taker_name, metadata")
        .eq("token", token)
        .order("created_at", { ascending: false })
        .limit(80);

      if (subsErr) throw new Error(subsErr.message);

      const takerEmail = safeString(taker?.email).toLowerCase();
      const takerName = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim();

      const byMeta =
        (subs || []).find((s: any) => safeString(s?.metadata?.taker_id) === tid) || null;

      const byEmail =
        !byMeta && takerEmail
          ? (subs || []).find((s: any) => safeString(s?.taker_email).toLowerCase() === takerEmail) || null
          : null;

      const byName =
        !byMeta && !byEmail && takerName
          ? (subs || []).find((s: any) => safeString(s?.taker_name) === takerName) || null
          : null;

      const picked = byMeta || byEmail || byName;
      if (!picked?.id) {
        return NextResponse.json({ ok: false, error: "No visibility submission found for this token/taker yet." }, { status: 404 });
      }

      submissionId = String(picked.id);
    }

    // 2) Load latest results
    let { data: result, error: resErr } = await vis
      .from("results")
      .select(
        "id, created_at, engine_key, version, tier, level, readiness, personality_type, personality_points, tier_counts, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, pattern_tags"
      )
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (resErr) throw new Error(resErr.message);
    if (!result) return NextResponse.json({ ok: false, error: "Visibility results not found." }, { status: 404 });

    // 3) Ensure pillar signals exist (compute via RPC if missing)
    if (!hasPillarSignals(result)) {
      try {
        const pillarRpc = await callRpc<any>(vis, "compute_pillar_signals_for_submission", {
          p_submission_id: submissionId,
        });

        if (pillarRpc?.ok === true && pillarRpc?.computed) {
          const computed = pillarRpc.computed;

          await vis
            .from("results")
            .update({
              pillar_scores: computed.pillar_scores ?? {},
              pillar_bands: computed.pillar_bands ?? {},
              weakest_pillar: computed.weakest_pillar ?? null,
              strongest_pillar: computed.strongest_pillar ?? null,
              pattern_tags: Array.isArray(computed.pattern_tags) ? computed.pattern_tags : [],
            })
            .eq("id", result.id);

          const reread = await vis
            .from("results")
            .select(
              "id, created_at, engine_key, version, tier, level, readiness, personality_type, personality_points, tier_counts, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, pattern_tags"
            )
            .eq("id", result.id)
            .maybeSingle();

          if (!reread.error && reread.data) result = reread.data;
        }
      } catch (e) {
        console.warn("[visibility report] pillar RPC failed", e);
      }
    }

    const engineKey = String(result.engine_key || "visibility_v1");
    const version = Number(result.version || 1);

    // 4) Deterministic report cache lookup
    const cachedDet = await callRpc<any>(vis, "get_generated_report", {
      p_submission_id: submissionId,
      p_audience: audience,
      p_engine_key: engineKey,
      p_version: version,
    });

    if (cachedDet) {
      return NextResponse.json(
        {
          ok: true,
          data: cachedDet,
          __meta: { cached: true, submission_id: submissionId, engine_key: engineKey, version, audience },
        },
        { status: 200 }
      );
    }

    // 5) Signals for KB matching
    const signals = {
      tier: result.tier,
      level: Number(result.level ?? 0),
      style: result.personality_type,
      readiness: result.readiness,

      pillar_scores: result.pillar_scores || {},
      pillar_band: result.pillar_bands || {},
      weakest_pillar: result.weakest_pillar ?? null,
      strongest_pillar: result.strongest_pillar ?? null,
      pattern_tags: result.pattern_tags || [],
    };

    // 6) Build deterministic sections from KB
    const sectionKeys = [
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
        p_audience: audience,
        p_signals: signals,
        p_limit: 6,
      });

      if (!blocks || blocks.length === 0) {
        blocks = await callRpc<any[]>(vis, "kb_select_blocks", {
          p_section_key: key,
          p_audience: audience,
          p_signals: {},
          p_limit: 6,
        });
      }

      const contentBlocks = (blocks || []).map((b: any) => b.content).filter(Boolean);

      sections.push({
        key,
        title: contentBlocks?.[0]?.title || defaultTitles(key),
        blocks: contentBlocks,
      });

      selectedBlocks.push(
        (blocks || []).map((b: any) => ({
          id: b.id,
          match_score: b.match_score,
          priority: b.priority,
          triggers: b.triggers,
        }))
      );
    }

    // 7) Graphs
    const graphs = {
      tier_counts: result.tier_counts || {},
      personality_points: result.personality_points || {},
      ladder: { tier: result.tier, level: Number(result.level ?? 0) },
      pillars: result.pillar_scores || {},
      pillar_band: result.pillar_bands || {},
    };

    // 8) Meta for header
    const { data: orgRow } = await sb
      .from("orgs")
      .select("id, slug, name, logo_url")
      .eq("id", taker.org_id)
      .maybeSingle();

    const { data: testRow } = await sb
      .from("tests")
      .select("id, name, slug")
      .eq("id", taker.test_id)
      .maybeSingle();

    const orgName = (orgRow as any)?.name || (orgRow as any)?.slug || null;
    const testName = (testRow as any)?.name || "Visibility Ladder";
    const takerName = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim() || null;

    // 9) AI: auto-generate at report load, cached separately as taker_report_ai
    // This keeps the base deterministic report stable.
    let ai: AiInsights | null = null;
    let ai_meta: any = { enabled: false };

    if (aiEnabled()) {
      ai_meta.enabled = true;

      try {
        const cachedAi = await callRpc<any>(vis, "get_generated_report", {
          p_submission_id: submissionId,
          p_audience: "taker_report_ai",
          p_engine_key: engineKey,
          p_version: version,
        });

        if (cachedAi?.ai && typeof cachedAi.ai === "object") {
          ai = cachedAi.ai as AiInsights;
          ai_meta.cached = true;
          ai_meta.model = cachedAi?.ai_meta?.model || null;
          ai_meta.generated_at = cachedAi?.ai_meta?.generated_at || null;
        } else {
          // generate now (seamless)
          const aiOut = await generateAiInsights({
            orgName,
            testName,
            takerName,
            signals,
            graphs,
            sections,
          });

          ai = aiOut;
          ai_meta.cached = false;
          ai_meta.model = openaiModel();
          ai_meta.generated_at = new Date().toISOString();

          // store AI cache payload as a minimal report json
          const aiCacheJson = {
            token,
            tid: tid || null,
            sid: submissionId,
            submission_id: submissionId,
            engine_key: engineKey,
            version,
            audience: "taker_report_ai",
            meta: {
              org_name: orgName,
              org_logo_url: (orgRow as any)?.logo_url || null,
              test_name: testName,
              generated_at: ai_meta.generated_at,
              mode: "ai",
            },
            ai: aiOut,
            ai_meta,
          };

          await callRpc<any>(vis, "upsert_generated_report", {
            p_submission_id: submissionId,
            p_audience: "taker_report_ai",
            p_report_json: aiCacheJson,
            p_signals: signals,
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
      audience,

      meta: {
        org_name: orgName,
        org_logo_url: (orgRow as any)?.logo_url || null,
        test_name: testName,
        generated_at: new Date().toISOString(),
        mode: "deterministic",
      },

      signals,
      graphs,
      sections,

      // ✅ Seamless AI layer (may be null if disabled or error)
      ai,
      ai_meta,
    };

    // 10) Cache deterministic report
    await callRpc<any>(vis, "upsert_generated_report", {
      p_submission_id: submissionId,
      p_audience: audience,
      p_report_json: reportJson,
      p_signals: signals,
      p_selected_blocks: selectedBlocks,
      p_engine_key: engineKey,
      p_version: version,
    });

    return NextResponse.json(
      {
        ok: true,
        data: reportJson,
        __meta: { cached: false, submission_id: submissionId, engine_key: engineKey, version, audience },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}