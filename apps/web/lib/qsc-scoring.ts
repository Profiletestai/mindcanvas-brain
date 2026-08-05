// apps/web/lib/qsc-scoring.ts

// apps/web/lib/qsc-scoring.ts

export type QscProfileMapEntry = {
  points: number;
  profile: string; // e.g. "QSC_PERSONALITY_FIRE" or "QSC_MINDSET_VECTOR"
};

export type QscQuestion = {
  id: string;
  idx: number | null;
  profile_map: QscProfileMapEntry[] | null;
};

export type QscAnswer = {
  question_id: string;
  choice: number; // index into options/profile_map array (0-based)
};

export type QscLayerTotals = Record<string, number>;
export type QscLayerPercentages = Record<string, number>;

export type QscScoringResult = {
  personalityTotals: QscLayerTotals;
  mindsetTotals: QscLayerTotals;

  personalityPercentages: QscLayerPercentages;
  mindsetPercentages: QscLayerPercentages;

  primaryPersonality: string | null;
  secondaryPersonality: string | null;
  primaryMindset: string | null;
  secondaryMindset: string | null;

  combinedProfileCode: string | null;
};

/**
 * "QSC_PERSONALITY_FIRE" => { layer:"personality", key:"FIRE" }
 * "QSC_MINDSET_VECTOR"   => { layer:"mindset", key:"VECTOR" }
 */
function extractKey(raw: string): {
  layer: "personality" | "mindset" | null;
  key: string;
} {
  if (raw.startsWith("QSC_PERSONALITY_")) {
    return { layer: "personality", key: raw.replace("QSC_PERSONALITY_", "") };
  }
  if (raw.startsWith("QSC_MINDSET_")) {
    return { layer: "mindset", key: raw.replace("QSC_MINDSET_", "") };
  }
  return { layer: null, key: raw };
}

function toPercentages(totals: QscLayerTotals): QscLayerPercentages {
  const result: QscLayerPercentages = {};
  const totalPoints = Object.values(totals).reduce((sum, v) => sum + v, 0);

  if (totalPoints <= 0) {
    return result;
  }

  for (const [key, value] of Object.entries(totals)) {
    result[key] = +(((value / totalPoints) * 100).toFixed(1));
  }

  return result;
}

function findPrimaryAndSecondary(totals: QscLayerTotals): {
  primary: string | null;
  secondary: string | null;
} {
  const entries = Object.entries(totals).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    return { primary: null, secondary: null };
  }

  entries.sort((a, b) => b[1] - a[1]);

  return {
    primary: entries[0]?.[0] ?? null,
    secondary: entries[1]?.[0] ?? null,
  };
}

/**
 * Defensive index normaliser.
 *
 * This is the key fix:
 * - Some QSC personality questions only have 4 mapped options.
 * - If the UI ever sends choice=4 for those rows, old logic skipped scoring entirely.
 * - We now clamp out-of-range values to the last valid option.
 *
 * That means:
 *   len=4 and choice=4  -> 3
 *   len=5 and choice=4  -> 4
 */
function normaliseChoiceIndex(choice: number, optionCount: number): number | null {
  const n = Number(choice);

  if (!Number.isFinite(n)) return null;
  if (optionCount <= 0) return null;
  if (n < 0) return null;

  const whole = Math.trunc(n);
  return Math.min(whole, optionCount - 1);
}

export function calculateQscScores(
  questions: QscQuestion[],
  answers: QscAnswer[]
): QscScoringResult {
  const personalityTotals: QscLayerTotals = {};
  const mindsetTotals: QscLayerTotals = {};

  const questionsById = new Map<string, QscQuestion>();
  for (const q of questions) {
    questionsById.set(q.id, q);
  }

  for (const answer of answers) {
    const question = questionsById.get(answer.question_id);
    if (!question || !Array.isArray(question.profile_map) || question.profile_map.length === 0) {
      continue;
    }

    const safeChoice = normaliseChoiceIndex(answer.choice, question.profile_map.length);
    if (safeChoice == null) continue;

    const mapEntry = question.profile_map[safeChoice];
    if (!mapEntry) continue;

    const { points, profile } = mapEntry;
    if (typeof points !== "number" || !profile) continue;

    const { layer, key } = extractKey(profile);

    if (layer === "personality") {
      personalityTotals[key] = (personalityTotals[key] ?? 0) + points;
    } else if (layer === "mindset") {
      mindsetTotals[key] = (mindsetTotals[key] ?? 0) + points;
    }
  }

  const personalityPercentages = toPercentages(personalityTotals);
  const mindsetPercentages = toPercentages(mindsetTotals);

  const { primary: primaryPersonality, secondary: secondaryPersonality } =
    findPrimaryAndSecondary(personalityTotals);

  const { primary: primaryMindset, secondary: secondaryMindset } =
    findPrimaryAndSecondary(mindsetTotals);

  const combinedProfileCode =
    primaryPersonality && primaryMindset
      ? `${primaryPersonality}_${primaryMindset}`
      : null;

  return {
    personalityTotals,
    mindsetTotals,
    personalityPercentages,
    mindsetPercentages,
    primaryPersonality,
    secondaryPersonality,
    primaryMindset,
    secondaryMindset,
    combinedProfileCode,
  };
}