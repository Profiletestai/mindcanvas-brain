// apps/web/app/api/portal/visibility/taker/[takerId]/snapshot/route.ts
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

function pickSummary(sections: any[]) {
  const pick = (k: string) => sections.find((s) => s?.key === k);

  const snap = pick("snapshot");
  const pillars = pick("pillars");
  const opp = pick("opportunity");
  const next = pick("next_move");

  const firstText = (sec: any) => {
    const b = sec?.blocks?.[0];
    if (!b) return "";
    if (typeof b.short_summary === "string" && b.short_summary.trim())
      return b.short_summary.trim();
    const p0 = Array.isArray(b.paragraphs)
      ? String(b.paragraphs[0] || "").trim()
      : "";
    return p0;
  };

  return {
    snapshot: firstText(snap),
    pillars: firstText(pillars),
    opportunity: firstText(opp),
    next_move: firstText(next),
  };
}

/** Detect if result row already has pillar signals */
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

/** Detect if cached report payload includes pillar scores */
function cachedHasPillars(cached: any) {
  const p =
    cached?.graphs?.pillars ||
    cached?.signals?.pillar_scores ||
    cached?.graphs?.pillar_band ||
    cached?.signals?.pillar_band;

  return p && typeof p === "object" && Object.keys(p).length > 0;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { takerId: string } }
) {
  try {
    const takerId = String(ctx.params?.takerId || "").trim();
    const orgSlug = String(req.nextUrl.searchParams.get("org") || "").trim(); // REQUIRED
    const audience = String(
      req.nextUrl.searchParams.get("audience") || "internal_snapshot"
    ).trim();

    if (!takerId)
      return NextResponse.json(
        { ok: false, error: "Missing takerId" },
        { status: 400 }
      );

    if (!orgSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing org slug. Pass ?org=whatswhats-global" },
        { status: 400 }
      );
    }

    const sb = portal();
    const vis = visibility();

    // 1) Load org by slug
    const { data: org, error: orgErr } = await sb
      .from("orgs")
      .select("id, slug, name, logo_url")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgErr) throw new Error(orgErr.message);
    if (!org)
      return NextResponse.json(
        { ok: false, error: "Org not found" },
        { status: 404 }
      );

    // 2) Load taker and validate belongs to org
    const { data: taker, error: takerErr } = await sb
      .from("test_takers")
      .select("id, org_id, test_id, first_name, last_name, email, link_token")
      .eq("id", takerId)
      .maybeSingle();

    if (takerErr) throw new Error(takerErr.message);
    if (!taker)
      return NextResponse.json(
        { ok: false, error: "Taker not found" },
        { status: 404 }
      );

    if (String(taker.org_id) !== String(org.id)) {
      return NextResponse.json(
        { ok: false, error: "Taker not in this org" },
        { status: 403 }
      );
    }

    // 3) Find latest visibility submission for this taker
    const { data: subs, error: subsErr } = await vis
      .from("submissions")
      .select("id, created_at, token, metadata")
      .order("created_at", { ascending: false })
      .limit(120);

    if (subsErr) throw new Error(subsErr.message);

    const submission = (subs || []).find(
      (s: any) => String(s?.metadata?.taker_id || "") === String(takerId)
    );

    if (!submission?.id) {
      return NextResponse.json(
        { ok: false, error: "No visibility submission found for this taker yet." },
        { status: 404 }
      );
    }

    const submissionId = submission.id as string;
    const token = String(submission.token || taker.link_token || "").trim() || null;

    // 4) Load latest visibility.results for that submission
    let { data: result, error: resErr } = await vis
      .from("results")
      .select(
        "id, created_at, engine_key, version, tier, level, readiness, personality_type, personality_points, tier_counts, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, pattern_tags"
      )
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (resErr) throw new Error(resErr.message);
    if (!result)
      return NextResponse.json(
        { ok: false, error: "Visibility results not found." },
        { status: 404 }
      );

    const engineKey = String(result.engine_key || "visibility_v1");
    const version = Number(result.version || 1);

    // 5) Cache lookup — but only return it if it has pillars (otherwise regenerate)
    const cached = await callRpc<any>(vis, "get_generated_report", {
      p_submission_id: submissionId,
      p_audience: audience,
      p_engine_key: engineKey,
      p_version: version,
    });

    if (cached && cachedHasPillars(cached)) {
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
          },
        },
        { status: 200 }
      );
    }

    // 6) Ensure pillar signals exist on results (compute via RPC if missing)
    if (!hasPillarSignals(result)) {
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

          // re-read updated result
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
        // Don’t fail snapshot if pillar RPC fails — keep going.
        console.warn("[visibility snapshot] pillar RPC failed", e);
      }
    }

    // 7) Signals used for KB matching
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

    // 8) Assemble INTERNAL snapshot sections
    const sectionKeys = [
      "snapshot",
      "pillars",
      "strengths",
      "friction",
      "opportunity",
      "next_move",
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

      const contentBlocks = (blocks || [])
        .map((b: any) => b.content)
        .filter(Boolean);

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

    // 9) Graph payload (now always reflects latest result row)
    const graphs = {
      tier_counts: result.tier_counts || {},
      personality_points: result.personality_points || {},
      ladder: { tier: result.tier, level: Number(result.level ?? 0) },
      pillars: result.pillar_scores || {},
      pillar_band: result.pillar_bands || {},
    };

    const reportJson = {
      org: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        logo_url: (org as any)?.logo_url || null,
      },
      token,
      tid: takerId,
      submission_id: submissionId,
      engine_key: engineKey,
      version,
      audience,

      meta: {
        generated_at: new Date().toISOString(),
        test_taker_name:
          [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() ||
          null,
        test_taker_email: taker.email || null,
      },

      signals,
      graphs,
      summary: pickSummary(sections),
      sections,
    };

    // 10) Cache write (overwrite old cached report that lacked pillars)
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