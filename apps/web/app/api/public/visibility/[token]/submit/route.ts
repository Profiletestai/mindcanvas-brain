// apps/web/app/api/public/visibility/[token]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AB = "A" | "B" | "C" | "D";
type AnswerCode = "A" | "B" | "C" | "D" | "E";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";
type PrimePillar = "visibility" | "trust" | "authority" | "dominance";
type SectionCode =
  | "personality"
  | "visibility"
  | "trust"
  | "authority"
  | "dominance";

type ScoringPersonality = {
  type: "personality";
  bucket: AB;
  points: number;
};

type ScoringTier = {
  type: "tier";
  tier: Tier;
};

type ScoringPrime = {
  type: "prime";
  value?: number; // 0..4
  pillar?: PrimePillar;
  tier_weights?: Partial<Record<Tier, number>>;
};

type Scoring = ScoringPersonality | ScoringTier | ScoringPrime;

type QuestionRow = {
  id: string;
  idx: number;
  code: string;
  pillar: number;
  section_code: SectionCode | null;
  is_internal_only: boolean;
  is_scored: boolean;
};

type OptionRow = {
  question_id: string;
  option_code: string;
  scoring: Scoring;
  is_active: boolean;
};

const TIERS: Tier[] = ["Invisible", "Emerging", "Established", "Magnetic"];
const PRIME_PILLARS: PrimePillar[] = [
  "visibility",
  "trust",
  "authority",
  "dominance",
];

function getKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY ||
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundInt(n: number) {
  return Math.round(n);
}

function safeAB(v: any): AB | null {
  return v === "A" || v === "B" || v === "C" || v === "D" ? v : null;
}

function safeAnswerCode(v: any): AnswerCode | null {
  return v === "A" || v === "B" || v === "C" || v === "D" || v === "E"
    ? v
    : null;
}

function answerValue(code: AnswerCode): number {
  switch (code) {
    case "A":
      return 0;
    case "B":
      return 1;
    case "C":
      return 2;
    case "D":
      return 3;
    case "E":
      return 4;
  }
}

function emptyTierCounts(): Record<Tier, number> {
  return {
    Invisible: 0,
    Emerging: 0,
    Established: 0,
    Magnetic: 0,
  };
}

function emptyPersonalityPoints(): Record<AB, number> {
  return { A: 0, B: 0, C: 0, D: 0 };
}

function emptyPrimePillarTotals(): Record<PrimePillar, number> {
  return {
    visibility: 0,
    trust: 0,
    authority: 0,
    dominance: 0,
  };
}

function emptyPrimePillarCounts(): Record<PrimePillar, number> {
  return {
    visibility: 0,
    trust: 0,
    authority: 0,
    dominance: 0,
  };
}

function isPrimeMode(engineKey: string | null | undefined, version: number | null | undefined) {
  return String(engineKey || "").toLowerCase() === "visibility_prime_v1" || Number(version || 0) >= 2;
}

function getPrimePillarFromQuestion(q: QuestionRow): PrimePillar | null {
  if (q.section_code === "visibility") return "visibility";
  if (q.section_code === "trust") return "trust";
  if (q.section_code === "authority") return "authority";
  if (q.section_code === "dominance") return "dominance";

  const code = String(q.code || "").trim().toUpperCase();
  if (/^V[1-5]$/.test(code)) return "visibility";
  if (/^T[1-5]$/.test(code)) return "trust";
  if (/^A[1-5]$/.test(code)) return "authority";
  if (/^D[1-5]$/.test(code)) return "dominance";

  return null;
}

function isPersonalityQuestion(q: QuestionRow): boolean {
  if (q.section_code === "personality") return true;
  const code = String(q.code || "").trim().toUpperCase();
  return /^P[1-8]$/.test(code);
}

function buildPrimeTierWeights(value: number): Record<Tier, number> {
  const weights = emptyTierCounts();
  switch (value) {
    case 0:
      weights.Invisible = 1;
      break;
    case 1:
      weights.Invisible = 0.5;
      weights.Emerging = 0.5;
      break;
    case 2:
      weights.Emerging = 1;
      break;
    case 3:
      weights.Established = 1;
      break;
    case 4:
      weights.Magnetic = 1;
      break;
    default:
      weights.Emerging = 1;
      break;
  }
  return weights;
}

function normalizePersonalityScoring(raw: any): ScoringPersonality | null {
  if (!raw || raw.type !== "personality") return null;
  const bucket = safeAB(raw.bucket);
  if (!bucket) return null;
  return {
    type: "personality",
    bucket,
    points: Number(raw.points) || 0,
  };
}

function normalizeLegacyTierScoring(raw: any): ScoringTier | null {
  if (!raw || raw.type !== "tier") return null;
  if (!TIERS.includes(raw.tier)) return null;
  return { type: "tier", tier: raw.tier };
}

function normalizePrimeScoring(raw: any, q: QuestionRow, answerCode: AnswerCode) {
  const pillar = getPrimePillarFromQuestion(q);
  if (!pillar) return null;

  const value =
    raw?.type === "prime" && typeof raw?.value === "number"
      ? clamp(Number(raw.value), 0, 4)
      : answerValue(answerCode);

  const tier_weights =
    raw?.type === "prime" && raw?.tier_weights
      ? {
          Invisible: Number(raw.tier_weights?.Invisible || 0),
          Emerging: Number(raw.tier_weights?.Emerging || 0),
          Established: Number(raw.tier_weights?.Established || 0),
          Magnetic: Number(raw.tier_weights?.Magnetic || 0),
        }
      : buildPrimeTierWeights(value);

  return {
    pillar:
      raw?.type === "prime" && raw?.pillar ? (raw.pillar as PrimePillar) : pillar,
    value,
    tier_weights,
  };
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

  let dominant: Tier = "Invisible";
  let bestCount = -1;
  let bestRank = -1;

  for (const t of TIERS) {
    const c = tierCounts[t] ?? 0;
    const r = tierRank[t];
    if (c > bestCount || (c === bestCount && r > bestRank)) {
      dominant = t;
      bestCount = c;
      bestRank = r;
    }
  }

  const support = tierCounts[dominant] ?? 0;
  const domRank = tierRank[dominant];

  const above = TIERS.filter((t) => tierRank[t] > domRank).reduce(
    (sum, t) => sum + (tierCounts[t] ?? 0),
    0
  );

  const below = TIERS.filter((t) => tierRank[t] < domRank).reduce(
    (sum, t) => sum + (tierCounts[t] ?? 0),
    0
  );

  const dominance = totalSignals ? (support + 0.5 * above) / totalSignals : 0;
  const tierLevel = clamp(Math.ceil(dominance * 5), 1, 5);
  const level = base[dominant] + tierLevel;

  return { tier: dominant, level, tierLevel, support, above, below, dominance };
}

function computePersonalityPercent(
  personalityPoints: Record<AB, number>
): Record<AB, number> {
  const total = Object.values(personalityPoints).reduce((sum, n) => sum + n, 0);
  if (!total) return { A: 0, B: 0, C: 0, D: 0 };

  return {
    A: roundInt((personalityPoints.A / total) * 100),
    B: roundInt((personalityPoints.B / total) * 100),
    C: roundInt((personalityPoints.C / total) * 100),
    D: roundInt((personalityPoints.D / total) * 100),
  };
}

function computePrimePillarScores(
  pillarTotals: Record<PrimePillar, number>,
  pillarCounts: Record<PrimePillar, number>
): Record<PrimePillar, number> {
  const out = {
    visibility: 0,
    trust: 0,
    authority: 0,
    dominance: 0,
  };

  for (const pillar of PRIME_PILLARS) {
    const total = pillarTotals[pillar] || 0;
    const count = pillarCounts[pillar] || 0;
    out[pillar] = count ? roundInt((total / (count * 4)) * 100) : 0;
  }

  return out;
}

function bandFromPct(pct: number) {
  if (pct < 40) return "weak";
  if (pct < 60) return "developing";
  if (pct < 80) return "strong";
  return "dominant";
}

function computePrimePillarBands(pillarScores: Record<PrimePillar, number>) {
  return {
    visibility: bandFromPct(pillarScores.visibility),
    trust: bandFromPct(pillarScores.trust),
    authority: bandFromPct(pillarScores.authority),
    dominance: bandFromPct(pillarScores.dominance),
  };
}

function getWeakestStrongestPillar(pillarScores: Record<PrimePillar, number>) {
  let weakest: PrimePillar = "visibility";
  let strongest: PrimePillar = "visibility";

  for (const pillar of PRIME_PILLARS) {
    if (pillarScores[pillar] < pillarScores[weakest]) weakest = pillar;
    if (pillarScores[pillar] > pillarScores[strongest]) strongest = pillar;
  }

  return { weakest, strongest };
}

function computeBalancePattern(pillarScores: Record<PrimePillar, number>) {
  const values = PRIME_PILLARS.map((p) => pillarScores[p]);
  const spread = Math.max(...values) - Math.min(...values);
  const { strongest } = getWeakestStrongestPillar(pillarScores);

  if (spread <= 15) return "balanced";
  if (spread >= 35) return "volatile";
  return `${strongest}_led`;
}

function computePrimePatternTags(
  pillarScores: Record<PrimePillar, number>,
  tier: Tier
) {
  const tags: string[] = [];
  const values = PRIME_PILLARS.map((p) => pillarScores[p]);
  const spread = Math.max(...values) - Math.min(...values);

  if (spread <= 15) tags.push("balanced_profile");
  if (pillarScores.visibility >= 60 && pillarScores.trust < 40) {
    tags.push("visible_but_untrusted");
  }
  if (pillarScores.trust >= 60 && pillarScores.visibility < 40) {
    tags.push("credible_but_hidden");
  }
  if (
    pillarScores.visibility >= 60 &&
    pillarScores.trust >= 60 &&
    pillarScores.authority < 50
  ) {
    tags.push("authority_gap");
  }
  if (pillarScores.authority >= 60 && pillarScores.dominance < 50) {
    tags.push("decision_friction");
  }
  if (pillarScores.authority >= 70 && pillarScores.dominance >= 70) {
    tags.push("leadership_signal");
  }
  if (pillarScores.dominance >= 70 || tier === "Magnetic") {
    tags.push("validation_required");
  }

  return [...new Set(tags)];
}

function computePrimeReadiness(
  tier: Tier,
  tierLevel: number,
  pillarScores: Record<PrimePillar, number>
): Readiness {
  const minPillar = Math.min(
    pillarScores.visibility,
    pillarScores.trust,
    pillarScores.authority,
    pillarScores.dominance
  );

  if (tierLevel < 4) return "stabilise";

  switch (tier) {
    case "Invisible":
      return pillarScores.visibility >= 35 && pillarScores.trust >= 30
        ? "ready_to_progress"
        : "stabilise";

    case "Emerging":
      return (
        pillarScores.visibility >= 55 &&
        pillarScores.trust >= 55 &&
        pillarScores.authority >= 45 &&
        minPillar >= 35
      )
        ? "ready_to_progress"
        : "stabilise";

    case "Established":
      return (
        pillarScores.visibility >= 70 &&
        pillarScores.trust >= 70 &&
        pillarScores.authority >= 70 &&
        pillarScores.dominance >= 65 &&
        minPillar >= 55
      )
        ? "ready_to_progress"
        : "stabilise";

    case "Magnetic":
    default:
      return "stabilise";
  }
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

    const answers: Record<string, string> = body?.answers ?? {};
    const taker_name: string | null =
      typeof body?.taker_name === "string" ? body.taker_name : null;
    const taker_email: string | null =
      typeof body?.taker_email === "string" ? body.taker_email : null;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid answers payload. Expected object: { QCODE: 'A'|'B'|'C'|'D'|'E' }",
        },
        { status: 400 }
      );
    }

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

    const { data: vTest, error: vTestErr } = await vis
      .from("tests")
      .select("id, engine_key, version")
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
    const primeMode = isPrimeMode(vTest.engine_key, vTest.version);

    const { data: questionsRaw, error: qErr } = await vis
      .from("questions")
      .select(
        "id, idx, code, pillar, section_code, is_internal_only, is_scored"
      )
      .eq("test_id", visibility_test_id)
      .eq("is_active", true)
      .order("idx", { ascending: true });

    if (qErr || !questionsRaw?.length) {
      return NextResponse.json(
        { ok: false, error: "No questions found for visibility test" },
        { status: 500 }
      );
    }

    const questions: QuestionRow[] = (questionsRaw || []).map((q: any) => ({
      id: String(q.id),
      idx: Number(q.idx),
      code: String(q.code),
      pillar: Number(q.pillar),
      section_code: q.section_code ?? null,
      is_internal_only: Boolean(q.is_internal_only),
      is_scored: Boolean(q.is_scored),
    }));

    const qIds = questions.map((q) => q.id);

    const { data: optionsRaw, error: oErr } = await vis
      .from("options")
      .select("question_id, option_code, scoring, is_active")
      .in("question_id", qIds)
      .eq("is_active", true);

    if (oErr || !optionsRaw?.length) {
      return NextResponse.json(
        { ok: false, error: "No options found for visibility test" },
        { status: 500 }
      );
    }

    const options: OptionRow[] = (optionsRaw || []).map((o: any) => ({
      question_id: String(o.question_id),
      option_code: String(o.option_code),
      scoring: o.scoring as Scoring,
      is_active: Boolean(o.is_active),
    }));

    const qById = new Map<string, QuestionRow>();
    for (const q of questions) {
      qById.set(q.id, q);
    }

    const scoringMap: Record<string, Partial<Record<AnswerCode, Scoring>>> = {};
    for (const opt of options) {
      const q = qById.get(opt.question_id);
      if (!q) continue;

      const answerCode = safeAnswerCode(opt.option_code);
      if (!answerCode) continue;

      scoringMap[q.code] = scoringMap[q.code] || {};
      scoringMap[q.code]![answerCode] = opt.scoring;
    }

    const personalityPoints = emptyPersonalityPoints();
    const tierCounts = emptyTierCounts();
    const primePillarTotals = emptyPrimePillarTotals();
    const primePillarCounts = emptyPrimePillarCounts();

    let answeredQuestions = 0;
    let ladderSignals = 0;
    let answeredPersonalityQuestions = 0;

    for (const q of questions) {
      const qCode = String(q.code);
      const answerCode = safeAnswerCode(answers[qCode]);
      if (!answerCode) continue;

      answeredQuestions += 1;

      const rawScoring = scoringMap[qCode]?.[answerCode];

      if (isPersonalityQuestion(q) || q.is_internal_only || q.is_scored === false) {
        const personality = normalizePersonalityScoring(rawScoring);
        if (personality) {
          personalityPoints[personality.bucket] += personality.points || 0;
          answeredPersonalityQuestions += 1;
        }
        continue;
      }

      if (primeMode) {
        const prime = normalizePrimeScoring(rawScoring, q, answerCode);
        if (!prime) continue;

        primePillarTotals[prime.pillar] += prime.value;
        primePillarCounts[prime.pillar] += 1;

        for (const tier of TIERS) {
          tierCounts[tier] += prime.tier_weights[tier] ?? 0;
        }

        ladderSignals += 1;
        continue;
      }

      const legacyTier = normalizeLegacyTierScoring(rawScoring);
      if (legacyTier) {
        tierCounts[legacyTier.tier] += 1;
        ladderSignals += 1;
      }
    }

    const personality_percent = computePersonalityPercent(personalityPoints);
    const totalPersonalityPoints = Object.values(personalityPoints).reduce(
      (sum, n) => sum + n,
      0
    );

    let personality_type: AB | null = null;
    if (totalPersonalityPoints > 0) {
      let bestBucket: AB = "A";
      let bestPoints = -1;
      for (const bucket of ["A", "B", "C", "D"] as AB[]) {
        if (personalityPoints[bucket] > bestPoints) {
          bestPoints = personalityPoints[bucket];
          bestBucket = bucket;
        }
      }
      personality_type = bestBucket;
    }

    const { tier, level, tierLevel, below, dominance, support, above } =
      computeTierAndLevel(tierCounts, ladderSignals);

    let readiness: Readiness = "stabilise";
    let pillar_scores: Record<string, number> = {};
    let pillar_bands: Record<string, string> = {};
    let weakest_pillar: string | null = null;
    let strongest_pillar: string | null = null;
    let balance_pattern: string | null = null;
    let pattern_tags: string[] = [];
    let overall_pct: number | null = null;
    let validation_required = false;
    let validation_status: string | null = null;

    if (primeMode) {
      const primePillarScores = computePrimePillarScores(
        primePillarTotals,
        primePillarCounts
      );
      const primePillarBands = computePrimePillarBands(primePillarScores);
      const { weakest, strongest } = getWeakestStrongestPillar(primePillarScores);

      const totalPrimeValue = PRIME_PILLARS.reduce(
        (sum, p) => sum + primePillarTotals[p],
        0
      );

      overall_pct = ladderSignals
        ? roundInt((totalPrimeValue / (ladderSignals * 4)) * 100)
        : 0;

      readiness = computePrimeReadiness(tier, tierLevel, primePillarScores);
      balance_pattern = computeBalancePattern(primePillarScores);
      pattern_tags = computePrimePatternTags(primePillarScores, tier);

      validation_required =
        primePillarScores.dominance >= 70 ||
        (primePillarScores.authority >= 70 && tier === "Magnetic");

      validation_status = validation_required
        ? "self_report_validation_required"
        : "self_report_only";

      pillar_scores = primePillarScores;
      pillar_bands = primePillarBands;
      weakest_pillar = weakest;
      strongest_pillar = strongest;
    } else {
      const minTierLevelReady = 4;
      const maxBelowAllowedReady = 3;
      readiness =
        tierLevel >= minTierLevelReady && below <= maxBelowAllowedReady
          ? "ready_to_progress"
          : "stabilise";
    }

    const { data: sub, error: subErr } = await vis
      .from("submissions")
      .insert({
        org_id,
        test_id: visibility_test_id,
        test_link_id,
        token,
        taker_name,
        taker_email,
        answers,
        metadata: {
          user_agent: req.headers.get("user-agent"),
          portal_test_id,
          mode: primeMode ? "prime" : "legacy",
        },
      })
      .select("id")
      .single();

    if (subErr || !sub?.id) {
      console.error("visibility.submissions insert failed", subErr);
      throw subErr || new Error("Failed to insert visibility submission");
    }

    const resultInsert: any = {
      submission_id: sub.id,
      engine_key: primeMode ? "visibility_prime_v1" : "visibility_v1",
      version: primeMode ? 2 : 1,
      personality_type,
      personality_points: personalityPoints,
      personality_percent,
      tier,
      level,
      tier_counts: tierCounts,
      readiness,
      computed: {
        portal_test_id,
        visibility_test_id,
        mode: primeMode ? "prime" : "legacy",
        tier_level: tierLevel,
        overall_pct,
        ladder_question_count: ladderSignals,
        personality_question_count: answeredPersonalityQuestions,
        scoring_model: primeMode ? "prime_20q_v2" : "legacy_v1",
        validation_required,
        validation_status,
      },
      debug: {
        answeredQuestions,
        ladderSignals,
        support,
        above,
        below,
        dominance,
        primePillarTotals: primeMode ? primePillarTotals : undefined,
        primePillarCounts: primeMode ? primePillarCounts : undefined,
      },
    };

    if (primeMode) {
      resultInsert.pillar_scores = pillar_scores;
      resultInsert.pillar_bands = pillar_bands;
      resultInsert.weakest_pillar = weakest_pillar;
      resultInsert.strongest_pillar = strongest_pillar;
      resultInsert.balance_pattern = balance_pattern;
      resultInsert.pattern_tags = pattern_tags;
    }

    const { data: resRow, error: resErr } = await vis
      .from("results")
      .insert(resultInsert)
      .select(
        "id, tier, level, readiness, personality_type, personality_percent, engine_key, version, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, balance_pattern, pattern_tags, computed"
      )
      .single();

    if (resErr || !resRow?.id) {
      console.error("visibility.results insert failed", resErr);
      throw resErr || new Error("Failed to insert visibility results");
    }

    if (!primeMode) {
      try {
        const pillarRpc = await callRpc<any>(
          vis,
          "compute_pillar_signals_for_submission",
          { p_submission_id: sub.id }
        );

        const computed = pillarRpc?.computed || null;
        if (pillarRpc?.ok === true && computed) {
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
            .eq("id", resRow.id);
        }
      } catch (e) {
        console.warn("[visibility submit] legacy pillar RPC failed", e);
      }
    }

    const { error: incErr } = await portal
      .from("test_links")
      .update({ use_count: (link.use_count ?? 0) + 1 })
      .eq("id", test_link_id);

    if (incErr) {
      console.warn("Failed to increment use_count:", incErr);
    }

    const report_path = `/t/${encodeURIComponent(
      token
    )}/visibility/report?sid=${encodeURIComponent(sub.id)}`;

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