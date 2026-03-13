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

async function loadLinkMeta(sb: ReturnType<typeof portal>, token: string) {
  // Try canonical column set first
  const a1 = await sb
    .from("test_links")
    .select("show_results, redirect_url, hidden_results_message, next_steps_url, email_report")
    .eq("token", token)
    .maybeSingle();

  if (!a1.error && a1.data) {
    const d: any = a1.data;
    return {
      show_results: d.show_results ?? true,
      redirect_url: d.redirect_url ?? null,
      hidden_results_message: d.hidden_results_message ?? null,
      next_steps_url: d.next_steps_url ?? null,
      email_report: d.email_report ?? false,
    };
  }

  // Fallback for older schema
  const a2 = await sb
    .from("test_links")
    .select("show_results, redirect_url, hidden_results_message, next_steps_url, email_results")
    .eq("token", token)
    .maybeSingle();

  if (!a2.error && a2.data) {
    const d: any = a2.data;
    return {
      show_results: d.show_results ?? true,
      redirect_url: d.redirect_url ?? null,
      hidden_results_message: d.hidden_results_message ?? null,
      next_steps_url: d.next_steps_url ?? null,
      email_report: d.email_results ?? false,
    };
  }

  return {
    show_results: true,
    redirect_url: null,
    hidden_results_message: null,
    next_steps_url: null,
    email_report: false,
  };
}

export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const token = safeString(ctx.params?.token);
    const tid = safeString(req.nextUrl.searchParams.get("tid"));
    const sid = safeString(req.nextUrl.searchParams.get("sid")); // submission id optional
    const audience = safeString(req.nextUrl.searchParams.get("audience")) || "taker_report";

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }
    if (!tid && !sid) {
      return NextResponse.json({ ok: false, error: "Missing tid or sid" }, { status: 400 });
    }

    const sb = portal();
    const vis = visibility();

    // Link meta (Next Steps, etc.)
    const linkMeta = await loadLinkMeta(sb, token);

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

    // 1) Resolve submission_id
    let submissionId: string | null = null;

    if (sid) {
      submissionId = sid;
    } else {
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

    // 2) Load latest visibility.results for that submission
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

    // 4) Cache lookup
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
          __meta: { cached: true, submission_id: submissionId, engine_key: engineKey, version, audience },
        },
        { status: 200 }
      );
    }

    // 5) Signals used for KB matching
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

    // 6) Assemble from KB blocks
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

    // 7) Graph payload (UI-ready)
    const graphs = {
      tier_counts: result.tier_counts || {},
      personality_points: result.personality_points || {},
      ladder: { tier: result.tier, level: Number(result.level ?? 0) },
      pillars: result.pillar_scores || {},
      pillar_band: result.pillar_bands || {},
    };

    // 8) Meta for header
    let orgRow: any = null;
    let testRow: any = null;

    if (taker?.org_id) {
      const orgRes = await sb.from("orgs").select("id, slug, name, logo_url").eq("id", taker.org_id).maybeSingle();
      if (!orgRes.error) orgRow = orgRes.data || null;
    }

    if (taker?.test_id) {
      const testRes = await sb.from("tests").select("id, name, slug").eq("id", taker.test_id).maybeSingle();
      if (!testRes.error) testRow = testRes.data || null;
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
        org_name: orgRow?.name || orgRow?.slug || null,
        org_logo_url: orgRow?.logo_url || null,
        test_name: testRow?.name || "Visibility Ladder",
        generated_at: new Date().toISOString(),
        // ✅ expose link meta so UI can show Next Step and keep behaviour consistent
        link_meta: linkMeta,
      },

      signals,
      graphs,
      sections,
    };

    // 9) Cache write
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