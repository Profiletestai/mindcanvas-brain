// apps/web/app/api/public/visibility/[token]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

type ScoringPersonality = { type: "personality"; bucket: AB; points: number };
type ScoringTier = { type: "tier"; tier: Tier };
type Scoring = ScoringPersonality | ScoringTier;

function getKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY || // last-resort (should not be used for writes in prod)
    ""
  );
}

function sbPortal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    db: { schema: "portal" },
    auth: { persistSession: false },
  });
}

function sbVisibility() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    db: { schema: "visibility" },
    auth: { persistSession: false },
  });
}

function safeAB(v: any): AB | null {
  return v === "A" || v === "B" || v === "C" || v === "D" ? v : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeTierAndLevel(
  tierCounts: Record<Tier, number>,
  totalSignals: number
) {
  const tierRank: Record<Tier, number> = {
    Invisible: 1,
    Emerging: 2,
    Established: 3,
    Magnetic: 4,
  };
  const base: Record<Tier, number> = {
    Invisible: 0,
    Emerging: 5,
    Established: 10,
    Magnetic: 15,
  };

  const tiers: Tier[] = ["Invisible", "Emerging", "Established", "Magnetic"];

  // Dominant tier: highest count; tie-breaker: higher tier rank
  let dominant: Tier = "Invisible";
  let bestCount = -1;
  let bestRank = -1;
  for (const t of tiers) {
    const c = tierCounts[t] ?? 0;
    const r = tierRank[t];
    if (c > bestCount || (c === bestCount && r > bestRank)) {
      dominant = t;
      bestCount = c;
      bestRank = r;
    }
  }

  // Strength+distribution → tier level (1..5 inside tier)
  const support = tierCounts[dominant] ?? 0;
  const domRank = tierRank[dominant];

  const above = tiers
    .filter((t) => tierRank[t] > domRank)
    .reduce((s, t) => s + (tierCounts[t] ?? 0), 0);

  const below = tiers
    .filter((t) => tierRank[t] < domRank)
    .reduce((s, t) => s + (tierCounts[t] ?? 0), 0);

  const dominance = totalSignals ? (support + 0.5 * above) / totalSignals : 0;
  const tierLevel = clamp(Math.ceil(dominance * 5), 1, 5);
  const level = base[dominant] + tierLevel; // 1..20

  return { tier: dominant, level, tierLevel, support, above, below, dominance };
}

function computeReadiness(tierLevel: number, below: number): Readiness {
  // v1 defaults (tunable later)
  const minTierLevelReady = 4;
  const maxBelowAllowedReady = 3;

  if (tierLevel >= minTierLevelReady && below <= maxBelowAllowedReady) {
    return "ready_to_progress";
  }
  return "stabilise";
}

async function callRpc<T>(sb: any, fn: string, args: any): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const token = String(params?.token || "").trim();
  const portal = sbPortal();
  const vis = sbVisibility();

  try {
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({} as any));

    const answers: any = body?.answers ?? {};
    const taker_name: string | null =
      typeof body?.taker_name === "string" ? body.taker_name : null;
    const taker_email: string | null =
      typeof body?.taker_email === "string" ? body.taker_email : null;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json(
        { ok: false, error: "Invalid answers payload. Expected object: { QCODE: 'A'|'B'|'C'|'D' }" },
        { status: 400 }
      );
    }

    // 1) Resolve token in portal.test_links
    const { data: link, error: linkErr } = await portal
      .from("test_links")
      .select(
        "id, token, org_id, test_id, is_active, expires_at, max_uses, use_count, show_results, redirect_url, next_steps_url, hidden_results_message"
      )
      .eq("token", token)
      .maybeSingle();

    if (linkErr || !link) {
      return NextResponse.json(
        { ok: false, error: "Invalid token" },
        { status: 404 }
      );
    }

    if (!link.is_active) {
      return NextResponse.json(
        { ok: false, error: "Link inactive" },
        { status: 403 }
      );
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Link expired" },
        { status: 403 }
      );
    }

    if (link.max_uses != null && (link.use_count ?? 0) >= link.max_uses) {
      return NextResponse.json(
        { ok: false, error: "Link max uses reached" },
        { status: 403 }
      );
    }

    const org_id: string = link.org_id;
    const portal_test_id: string = link.test_id;
    const test_link_id: string = link.id;

    // 2) Find visibility.tests row linked to portal.test_id
    const { data: vTest, error: vTestErr } = await vis
      .from("tests")
      .select("id")
      .eq("portal_test_id", portal_test_id)
      .eq("org_id", org_id)
      .maybeSingle();

    if (vTestErr || !vTest?.id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Visibility engine test not linked (visibility.tests.portal_test_id missing)",
        },
        { status: 500 }
      );
    }

    const visibility_test_id: string = vTest.id;

    // 3) Load questions + options for this visibility test
    const { data: questions, error: qErr } = await vis
      .from("questions")
      .select("id, idx, code, pillar")
      .eq("test_id", visibility_test_id)
      .eq("is_active", true)
      .order("idx", { ascending: true });

    if (qErr || !questions?.length) {
      return NextResponse.json(
        { ok: false, error: "No questions found for visibility test" },
        { status: 500 }
      );
    }

    const qIds = questions.map((q: any) => q.id);

    const { data: options, error: oErr } = await vis
      .from("options")
      .select("question_id, option_code, scoring, is_active")
      .in("question_id", qIds)
      .eq("is_active", true);

    if (oErr || !options?.length) {
      return NextResponse.json(
        { ok: false, error: "No options found for visibility test" },
        { status: 500 }
      );
    }

    // Build lookup: scoringMap[QCODE][AB] => scoring json
    const qById = new Map<string, { code: string; idx: number; pillar: number }>();
    for (const q of questions) {
      qById.set(q.id, {
        code: String(q.code),
        idx: Number(q.idx),
        pillar: Number(q.pillar),
      });
    }

    const scoringMap: Record<string, Partial<Record<AB, Scoring>>> = {};
    for (const opt of options) {
      const meta = qById.get(opt.question_id);
      if (!meta) continue;

      const qCode = meta.code;
      const ab = safeAB(opt.option_code);
      if (!ab) continue;

      scoringMap[qCode] = scoringMap[qCode] || {};
      scoringMap[qCode]![ab] = opt.scoring as Scoring;
    }

    // 4) Score
    const personalityPoints: Record<AB, number> = { A: 0, B: 0, C: 0, D: 0 };
    const tierCounts: Record<Tier, number> = {
      Invisible: 0,
      Emerging: 0,
      Established: 0,
      Magnetic: 0,
    };

    let ladderSignals = 0;

    for (const q of questions) {
      const qCode = String(q.code);
      const ab = safeAB((answers as any)[qCode]);
      if (!ab) continue;

      const scoring = scoringMap[qCode]?.[ab];
      if (!scoring) continue;

      if (scoring.type === "personality") {
        personalityPoints[scoring.bucket] += scoring.points || 0;
      } else if (scoring.type === "tier") {
        tierCounts[scoring.tier] += 1;
        ladderSignals += 1;
      }
    }

    // Dominant personality type (tie-break A>B>C>D)
    const types: AB[] = ["A", "B", "C", "D"];
    let personality_type: AB = "A";
    let best = -1;
    for (const t of types) {
      if (personalityPoints[t] > best) {
        best = personalityPoints[t];
        personality_type = t;
      }
    }

    // Tier + level + readiness
    const { tier, level, tierLevel, below, dominance, support, above } =
      computeTierAndLevel(tierCounts, ladderSignals);

    const readiness = computeReadiness(tierLevel, below);

    // 5) Store submission + initial results (visibility schema)
    const { data: sub, error: subErr } = await vis
      .from("submissions")
      .insert({
        org_id,
        test_id: visibility_test_id,
        test_link_id,
        token,
        taker_name,
        taker_email,
        answers, // expects { QCODE: 'A'|'B'|'C'|'D' }
        metadata: {
          user_agent: req.headers.get("user-agent"),
          portal_test_id,
        },
      })
      .select("id")
      .single();

    if (subErr || !sub?.id) {
      console.error("visibility.submissions insert failed", subErr);
      throw subErr || new Error("Failed to insert visibility submission");
    }

    const { data: resRow, error: resErr } = await vis
      .from("results")
      .insert({
        submission_id: sub.id,
        engine_key: "visibility_v1",
        version: 1,
        personality_type,
        personality_points: personalityPoints,
        tier,
        level,
        tier_counts: tierCounts,
        readiness,
        computed: {
          portal_test_id,
          visibility_test_id,
          tier_level: tierLevel,
        },
        debug: {
          ladderSignals,
          support,
          above,
          below,
          dominance,
        },
      })
      .select("id, tier, level, readiness, personality_type, engine_key, version")
      .single();

    if (resErr || !resRow?.id) {
      console.error("visibility.results insert failed", resErr);
      throw resErr || new Error("Failed to insert visibility results");
    }

    // 5b) Compute pillar scores/bands/tags via RPC and persist into results
    try {
      const pillarRpc = await callRpc<any>(vis, "compute_pillar_signals_for_submission", {
        p_submission_id: sub.id,
      });

      const computed = pillarRpc?.computed || null;
      if (pillarRpc?.ok === true && computed) {
        await vis
          .from("results")
          .update({
            pillar_scores: computed.pillar_scores ?? {},
            pillar_bands: computed.pillar_bands ?? {},
            weakest_pillar: computed.weakest_pillar ?? null,
            strongest_pillar: computed.strongest_pillar ?? null,
            pattern_tags: Array.isArray(computed.pattern_tags) ? computed.pattern_tags : [],
          })
          .eq("id", resRow.id);
      }
    } catch (e) {
      // Don’t fail submit if pillar enrichment fails — report endpoint can recompute later
      console.warn("[visibility submit] pillar RPC failed", e);
    }

    // 6) Increment use_count in portal.test_links
    const { error: incErr } = await portal
      .from("test_links")
      .update({ use_count: (link.use_count ?? 0) + 1 })
      .eq("id", test_link_id);

    if (incErr) {
      console.warn("Failed to increment use_count:", incErr);
    }

    // Provide a clear report path for the client app to use
    const report_path = `/t/${encodeURIComponent(token)}/visibility/report?sid=${encodeURIComponent(
      sub.id
    )}`;

    return NextResponse.json({
      ok: true,
      token,
      org_id,
      portal_test_id,
      visibility_test_id,
      test_link_id,
      submission_id: sub.id,
      result: resRow,
      report_path,
      link_settings: {
        show_results: link.show_results,
        redirect_url: link.redirect_url,
        next_steps_url: link.next_steps_url,
        hidden_results_message: link.hidden_results_message,
      },
    });
  } catch (e: any) {
    console.error("Visibility submit error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}