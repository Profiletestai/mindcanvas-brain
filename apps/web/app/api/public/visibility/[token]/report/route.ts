// apps/web/app/api/public/visibility/[token]/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- Supabase clients ---------------- */

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

/* ---------------- Small helpers ---------------- */

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

function safeString(x: any) {
  return typeof x === "string" ? x.trim() : "";
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

/* ---------------- OpenAI (AI Author) ----------------
   - No separate endpoint.
   - Called ONLY when mode=ai
   - Must return same "sections" shape used by your client:
     sections: [{ key, title, blocks: [{ title, short_summary?, paragraphs?, transition? }] }]
------------------------------------------------------ */

function getOpenAIKey() {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.OPENAI_APIKEY ||
    ""
  );
}

function getOpenAIModel() {
  // You can set OPENAI_VISIBILITY_MODEL to whatever you’re using in prod.
  // Fallbacks are safe.
  return (
    process.env.OPENAI_VISIBILITY_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini"
  );
}

function extractResponseText(respJson: any): string {
  // Responses API format (best-effort)
  const output = respJson?.output;
  if (Array.isArray(output)) {
    const texts: string[] = [];
    for (const item of output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (typeof c?.text === "string") texts.push(c.text);
        if (typeof c?.output_text === "string") texts.push(c.output_text);
      }
    }
    const joined = texts.join("\n").trim();
    if (joined) return joined;
  }

  // Some SDK wrappers return "output_text"
  if (typeof respJson?.output_text === "string") return respJson.output_text.trim();

  // Last resort:
  if (typeof respJson?.text === "string") return respJson.text.trim();

  return "";
}

function tryParseJsonObject(s: string): any | null {
  const t = String(s || "").trim();
  if (!t) return null;

  // Fast path
  try {
    return JSON.parse(t);
  } catch {}

  // Try to extract first {...} block
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) {
    const mid = t.slice(i, j + 1);
    try {
      return JSON.parse(mid);
    } catch {}
  }

  return null;
}

function normalizeAiSections(ai: any, sectionKeys: string[]) {
  // Expected:
  // { sections: [{ key, title, blocks:[{title, short_summary, paragraphs, transition}] }] }
  const raw = ai?.sections;
  if (!Array.isArray(raw)) return null;

  const out: any[] = [];
  const byKey = new Map<string, any>();

  for (const s of raw) {
    const k = safeString(s?.key);
    if (!k) continue;
    byKey.set(k, s);
  }

  for (const key of sectionKeys) {
    const s = byKey.get(key);
    if (!s) continue;

    const title = safeString(s?.title) || defaultTitles(key);

    let blocks = s?.blocks;
    if (!Array.isArray(blocks)) {
      // allow ai to return single block fields on the section
      blocks = [
        {
          title: safeString(s?.block_title) || title,
          short_summary: safeString(s?.short_summary) || undefined,
          paragraphs: Array.isArray(s?.paragraphs)
            ? s.paragraphs.map((p: any) => String(p || "")).filter(Boolean)
            : undefined,
          transition: safeString(s?.transition) || undefined,
        },
      ];
    }

    const cleanBlocks = (blocks as any[])
      .map((b) => {
        const bt = safeString(b?.title) || title;
        const ss = safeString(b?.short_summary) || "";
        const tr = safeString(b?.transition) || "";
        const paras = Array.isArray(b?.paragraphs)
          ? b.paragraphs.map((p: any) => String(p || "")).filter(Boolean)
          : [];

        return {
          title: bt,
          short_summary: ss || undefined,
          paragraphs: paras.length ? paras : undefined,
          transition: tr || undefined,
        };
      })
      .filter((b) => (b.paragraphs && b.paragraphs.length) || b.short_summary || b.transition);

    out.push({
      key,
      title,
      blocks: cleanBlocks.length ? cleanBlocks : [{ title }],
    });
  }

  if (!out.length) return null;
  return out;
}

async function aiAuthorReport(args: {
  token: string;
  tid: string | null;
  sid: string;
  meta: any;
  signals: any;
  graphs: any;
  sections: any[];
  sectionKeys: string[];
}) {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = getOpenAIModel();

  // Compact KB text for the author (keeps it grounded)
  const kb = args.sections.map((s: any) => {
    const key = safeString(s?.key);
    const title = safeString(s?.title);
    const blocks = Array.isArray(s?.blocks) ? s.blocks : [];
    const blockText = blocks
      .map((b: any) => {
        const bt = safeString(b?.title);
        const ss = safeString(b?.short_summary);
        const paras = Array.isArray(b?.paragraphs) ? b.paragraphs : [];
        const tr = safeString(b?.transition);

        return [
          bt ? `Title: ${bt}` : "",
          ss ? `Short summary: ${ss}` : "",
          paras.length ? `Paragraphs:\n- ${paras.map((p: any) => String(p)).join("\n- ")}` : "",
          tr ? `Transition: ${tr}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .filter(Boolean)
      .join("\n\n");

    return `## ${key} — ${title}\n${blockText}`.trim();
  });

  const instruction = `
You are an expert report author. Rewrite the Visibility Ladder report as a polished, high-impact narrative.
IMPORTANT CONSTRAINTS:
- Use ONLY the information in the provided signals + KB text. Do not invent pillar scores, tiers, levels, facts, claims, offers, or outcomes.
- Keep the SAME section keys and the SAME order.
- Remove repetition, remove double headings, and improve flow.
- Tone: premium, clear, supportive, strategic. No hype.
- Output MUST be valid JSON only (no markdown), matching this schema:

{
  "sections": [
    {
      "key": "framework_foundation",
      "title": "Framework foundation",
      "blocks": [
        {
          "title": "Framework foundation",
          "short_summary": "1 short sentence",
          "paragraphs": ["paragraph 1", "paragraph 2", "..."],
          "transition": "optional 1 sentence"
        }
      ]
    }
  ]
}

Rules:
- Exactly these keys in order:
${args.sectionKeys.map((k) => `- ${k}`).join("\n")}
- Each section MUST have 1 block (single block) in blocks[].
- paragraphs should be 2–5 paragraphs max per section (unless the KB content is extremely short).
- If pillar_scores is empty, keep pillar-related language neutral (no numbers, no “your trust is low” etc).
`.trim();

  const payload = {
    model,
    input: [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content:
          `META:\n${JSON.stringify(args.meta)}\n\n` +
          `SIGNALS:\n${JSON.stringify(args.signals)}\n\n` +
          `GRAPHS (for context; do not invent from this if empty):\n${JSON.stringify(args.graphs)}\n\n` +
          `KB SECTIONS:\n${kb.join("\n\n")}\n`,
      },
    ],
    // Force JSON object output (best-effort)
    response_format: { type: "json_object" as const },
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    const msg =
      safeString(j?.error?.message) ||
      safeString(j?.message) ||
      `OpenAI error (HTTP ${r.status})`;
    throw new Error(msg);
  }

  const text = extractResponseText(j);
  const obj = tryParseJsonObject(text) || j; // some responders may already be json_object
  const normalized = normalizeAiSections(obj, args.sectionKeys);
  if (!normalized) throw new Error("AI returned invalid sections JSON");

  return {
    model,
    sections: normalized,
  };
}

/* ---------------- Route ---------------- */

export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const token = safeString(ctx.params?.token);
    const tid = safeString(req.nextUrl.searchParams.get("tid"));
    const sid = safeString(req.nextUrl.searchParams.get("sid"));
    const mode = safeString(req.nextUrl.searchParams.get("mode")) || "deterministic";

    // Audience is used for caching in visibility.generated_reports
    const audienceParam = safeString(req.nextUrl.searchParams.get("audience"));
    const audience =
      audienceParam ||
      (mode === "ai" ? "taker_report_ai" : "taker_report");

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    // Support either tid OR sid
    if (!tid && !sid) {
      return NextResponse.json({ ok: false, error: "Missing tid or sid" }, { status: 400 });
    }

    const sb = portal();
    const vis = visibility();

    // If tid is present, validate taker belongs to this token
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
        return NextResponse.json({ ok: false, error: "Taker not found for this token" }, { status: 404 });
      }
      taker = takerRow;
    }

    // ---------------------------------------------------------
    // 1) Resolve submission_id
    // ---------------------------------------------------------
    let submissionId: string | null = null;

    if (sid) {
      submissionId = sid;
    } else {
      const { data: subs, error: subsErr } = await vis
        .from("submissions")
        .select("id, created_at, token, taker_email, taker_name, metadata")
        .eq("token", token)
        .order("created_at", { ascending: false })
        .limit(120);

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
        return NextResponse.json(
          { ok: false, error: "No visibility submission found for this token/taker yet." },
          { status: 404 }
        );
      }

      submissionId = String(picked.id);
    }

    if (!submissionId) {
      return NextResponse.json({ ok: false, error: "Failed to resolve submission_id" }, { status: 500 });
    }

    // ---------------------------------------------------------
    // 2) Load latest visibility.results for that submission
    // ---------------------------------------------------------
    let { data: result, error: resErr } = await vis
      .from("results")
      .select(
        "id, created_at, engine_key, version, tier, level, readiness, personality_type, personality_points, tier_counts, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, pattern_tags"
      )
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (resErr) throw new Error(resErr.message);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Visibility results not found." }, { status: 404 });
    }

    // ---------------------------------------------------------
    // 3) Ensure pillar signals exist (compute via RPC if missing)
    // ---------------------------------------------------------
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

          // re-read
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

    // ---------------------------------------------------------
    // 4) Cache lookup (audience controls deterministic vs AI version)
    // ---------------------------------------------------------
    const cached = await callRpc<any>(vis, "get_generated_report", {
      p_submission_id: submissionId,
      p_audience: audience,
      p_engine_key: engineKey,
      p_version: version,
    });

    if (cached) {
      return NextResponse.json(
        {
          ok: true,
          data: cached,
          __meta: {
            cached: true,
            submission_id: submissionId,
            engine_key: engineKey,
            version,
            audience,
            mode: cached?.meta?.mode || (audience === "taker_report_ai" ? "ai" : "deterministic"),
          },
        },
        { status: 200 }
      );
    }

    // ---------------------------------------------------------
    // 5) Signals for KB matching / AI authoring
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // 6) Assemble deterministic sections from KB
    // ---------------------------------------------------------
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
        p_audience: "taker_report", // KB audience stays "taker_report" for selection
        p_signals: signals,
        p_limit: 6,
      });

      if (!blocks || blocks.length === 0) {
        blocks = await callRpc<any[]>(vis, "kb_select_blocks", {
          p_section_key: key,
          p_audience: "taker_report",
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

    // ---------------------------------------------------------
    // 7) Graph payload (UI-ready)
    // ---------------------------------------------------------
    const graphs = {
      tier_counts: result.tier_counts || {},
      personality_points: result.personality_points || {},
      ladder: { tier: result.tier, level: Number(result.level ?? 0) },
      pillars: result.pillar_scores || {},
      pillar_band: result.pillar_bands || {},
    };

    // ---------------------------------------------------------
    // 8) Meta for header (best-effort)
    // ---------------------------------------------------------
    let orgRow: any = null;
    let testRow: any = null;

    if (taker?.org_id) {
      const orgRes = await sb
        .from("orgs")
        .select("id, slug, name, logo_url")
        .eq("id", taker.org_id)
        .maybeSingle();
      if (!orgRes.error) orgRow = orgRes.data || null;
    }

    if (taker?.test_id) {
      const testRes = await sb
        .from("tests")
        .select("id, name, slug")
        .eq("id", taker.test_id)
        .maybeSingle();
      if (!testRes.error) testRow = testRes.data || null;
    }

    const baseMeta = {
      org_name: orgRow?.name || orgRow?.slug || null,
      org_logo_url: orgRow?.logo_url || null,
      test_name: testRow?.name || "Visibility Ladder",
      generated_at: new Date().toISOString(),
      mode: audience === "taker_report_ai" ? "ai" : "deterministic",
    };

    // Base deterministic report JSON
    const reportJson: any = {
      token,
      tid: tid || null,
      sid: submissionId,
      submission_id: submissionId,
      engine_key: engineKey,
      version,
      audience,

      meta: baseMeta,

      signals,
      graphs,
      sections,
    };

    // ---------------------------------------------------------
    // 9) AI author layer (ONLY when mode=ai)
    // ---------------------------------------------------------
    if (audience === "taker_report_ai" || mode === "ai") {
      try {
        const ai = await aiAuthorReport({
          token,
          tid: tid || null,
          sid: submissionId,
          meta: baseMeta,
          signals,
          graphs,
          sections,
          sectionKeys,
        });

        reportJson.sections = ai.sections;
        reportJson.meta = {
          ...baseMeta,
          mode: "ai",
          ai: {
            provider: "openai",
            model: ai.model,
            generated_at: new Date().toISOString(),
          },
        };
      } catch (e) {
        // Don’t break report load. If AI fails, fall back to deterministic sections.
        console.warn("[visibility report] AI author failed, falling back to deterministic", e);
        reportJson.meta = { ...baseMeta, mode: "deterministic", ai_error: safeString((e as any)?.message) };
      }
    }

    // ---------------------------------------------------------
    // 10) Cache write (RPC upsert)
    // ---------------------------------------------------------
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
        __meta: {
          cached: false,
          submission_id: submissionId,
          engine_key: engineKey,
          version,
          audience,
          mode: reportJson?.meta?.mode || (audience === "taker_report_ai" ? "ai" : "deterministic"),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}