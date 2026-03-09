// apps/web/lib/visibility/scoring.ts
export type AB = "A" | "B" | "C" | "D";
export type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
export type Readiness = "stabilise" | "ready_to_progress";

export type VisibilityEngineConfig = {
  engine_key: string;
  version: number;
  personality: {
    weights: Record<AB, number>;
    questions: Record<string, Record<AB, AB>>; // Q1..Q8: answer -> type bucket
  };
  ladder: {
    questions: Record<string, Record<AB, Tier>>; // Q9..Q25: answer -> tier signal
    tier_rank: Record<Tier, number>;
    tier_bases: Record<Tier, number>; // base offsets: 0/5/10/15
  };
  readiness: {
    min_tier_level_ready: number; // e.g. 4
    max_below_allowed_ready: number; // e.g. 3
  };
};

export type VisibilityAnswers = Record<string, AB | null | undefined>; // {"Q1":"A", ...}

export type VisibilityResult = {
  engine_key: string;
  version: number;

  personality_type: AB | null;
  personality_points: Record<AB, number>;
  personality_percent: Record<AB, number>;

  tier: Tier | null;
  level: number | null; // 1..20
  tier_counts: Record<Tier, number>;

  readiness: Readiness | null;

  pillar_scores: Record<string, any>;
  computed: Record<string, any>;
  debug: Record<string, any>;
};

const TIERS: Tier[] = ["Invisible", "Emerging", "Established", "Magnetic"];
const TYPES: AB[] = ["A", "B", "C", "D"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeAB(v: any): AB | null {
  if (v === "A" || v === "B" || v === "C" || v === "D") return v;
  return null;
}

export function calculateVisibilityResults(
  answers: VisibilityAnswers,
  config: VisibilityEngineConfig
): VisibilityResult {
  const engine_key = config.engine_key || "visibility_v1";
  const version = config.version ?? 1;

  // ------------------------
  // Pillar 1: Personality
  // ------------------------
  const personality_points: Record<AB, number> = { A: 0, B: 0, C: 0, D: 0 };

  const personalityQuestions = Object.keys(config.personality.questions);
  for (const q of personalityQuestions) {
    const ans = safeAB(answers[q]);
    if (!ans) continue;

    const bucket = config.personality.questions[q]?.[ans];
    if (!bucket) continue;

    const w = config.personality.weights[bucket] ?? 0;
    personality_points[bucket] += w;
  }

  // Dominant personality type (tie-breaker: highest points, then A>B>C>D stable order)
  let personality_type: AB | null = null;
  let maxP = -Infinity;
  for (const t of TYPES) {
    const p = personality_points[t];
    if (p > maxP) {
      maxP = p;
      personality_type = t;
    }
  }

  const totalP = TYPES.reduce((s, t) => s + personality_points[t], 0) || 0;
  const personality_percent: Record<AB, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const t of TYPES) {
    personality_percent[t] = totalP ? Math.round((personality_points[t] / totalP) * 100) : 0;
  }

  // ------------------------
  // Pillars 2-4: Ladder signals
  // ------------------------
  const tier_counts: Record<Tier, number> = {
    Invisible: 0,
    Emerging: 0,
    Established: 0,
    Magnetic: 0,
  };

  const ladderQuestions = Object.keys(config.ladder.questions);
  for (const q of ladderQuestions) {
    const ans = safeAB(answers[q]);
    if (!ans) continue;

    const tier = config.ladder.questions[q]?.[ans];
    if (!tier) continue;

    tier_counts[tier] += 1;
  }

  // Dominant tier: highest count; tie-breaker: higher tier_rank wins
  let tier: Tier | null = null;
  let bestCount = -Infinity;
  let bestRank = -Infinity;

  for (const t of TIERS) {
    const c = tier_counts[t];
    const r = config.ladder.tier_rank[t] ?? 0;

    if (c > bestCount || (c === bestCount && r > bestRank)) {
      bestCount = c;
      bestRank = r;
      tier = t;
    }
  }

  const nSignals = ladderQuestions.length || 0;

  // Compute tier_level (1..5) using “strength + distribution”
  // dominance = (support + 0.5*above) / total
  let level: number | null = null;
  let readiness: Readiness | null = null;

  if (tier && nSignals > 0) {
    const support = tier_counts[tier];
    const tierRank = config.ladder.tier_rank[tier] ?? 1;

    const above = TIERS.filter((t) => (config.ladder.tier_rank[t] ?? 0) > tierRank)
      .reduce((s, t) => s + tier_counts[t], 0);

    const below = TIERS.filter((t) => (config.ladder.tier_rank[t] ?? 0) < tierRank)
      .reduce((s, t) => s + tier_counts[t], 0);

    const dominance = (support + 0.5 * above) / nSignals; // 0..1
    const tier_level = clamp(Math.ceil(dominance * 5), 1, 5);

    const base = config.ladder.tier_bases[tier] ?? 0;
    level = base + tier_level; // 1..20

    // Readiness gates (config-driven)
    if (
      tier_level >= (config.readiness.min_tier_level_ready ?? 4) &&
      below <= (config.readiness.max_below_allowed_ready ?? 3)
    ) {
      readiness = "ready_to_progress";
    } else {
      readiness = "stabilise";
    }

    // Debug payload helps QA quickly
    const debug = {
      nSignals,
      support,
      above,
      below,
      dominance,
      tier_level,
      tie_break: { bestCount, bestRank },
    };

    return {
      engine_key,
      version,
      personality_type,
      personality_points,
      personality_percent,
      tier,
      level,
      tier_counts,
      readiness,
      pillar_scores: {
        personality_total: totalP,
        ladder_total_signals: nSignals,
      },
      computed: {
        tier_level,
      },
      debug,
    };
  }

  // fallback if missing ladder answers
  return {
    engine_key,
    version,
    personality_type,
    personality_points,
    personality_percent,
    tier: tier ?? null,
    level: null,
    tier_counts,
    readiness: null,
    pillar_scores: {},
    computed: {},
    debug: { nSignals, reason: "No ladder signals computed (missing answers or config)" },
  };
}