// apps/web/lib/qsc-scoring.ts

export type QscProfileMapEntry = {
  points: number;
  profile: string; // can be many shapes, e.g.:
// "QSC_PERSONALITY_FIRE"
// "QSC_MINDSET_VECTOR"
// "FIRE"
// "FIELD"
// "A"
// "D"
// "ORIGIN"
// "QUANTUM"
// "4"
// "5"
// "Orbit/Quantum"
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

type Layer = "personality" | "mindset";
type ExtractResult = { layer: Layer | null; key: string | null };

const PERSONALITY_KEYS = ["FIRE", "FLOW", "FORM", "FIELD"] as const;
const MINDSET_KEYS = [
  "ORIGIN",
  "MOMENTUM",
  "VECTOR",
  "ORBIT",
  "QUANTUM",
] as const;

type PersonalityKey = (typeof PERSONALITY_KEYS)[number];
type MindsetKey = (typeof MINDSET_KEYS)[number];

const PERSONALITY_ALIASES: Record<string, PersonalityKey> = {
  FIRE: "FIRE",
  A: "FIRE",

  FLOW: "FLOW",
  B: "FLOW",

  FORM: "FORM",
  C: "FORM",

  FIELD: "FIELD",
  D: "FIELD",
};

const MINDSET_ALIASES: Record<string, MindsetKey> = {
  ORIGIN: "ORIGIN",
  "1": "ORIGIN",

  MOMENTUM: "MOMENTUM",
  "2": "MOMENTUM",

  VECTOR: "VECTOR",
  "3": "VECTOR",

  ORBIT: "ORBIT",
  "4": "ORBIT",

  QUANTUM: "QUANTUM",
  "5": "QUANTUM",
};

function normaliseRaw(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function questionLayerHint(question: QscQuestion): Layer | null {
  const idx =
    typeof question.idx === "number"
      ? question.idx
      : Number.isFinite(Number(question.idx))
      ? Number(question.idx)
      : null;

  if (!idx || idx <= 0) return null;

  // QSC framework:
  // Questions 1–8   = Personality
  // Questions 9–20  = Mindset
  if (idx >= 1 && idx <= 8) return "personality";
  if (idx >= 9) return "mindset";

  return null;
}

function detectPersonalityKey(rawNorm: string): PersonalityKey | null {
  // Exact alias
  if (PERSONALITY_ALIASES[rawNorm]) return PERSONALITY_ALIASES[rawNorm];

  // Common prefixed shapes
  if (rawNorm.startsWith("QSC_PERSONALITY_")) {
    const tail = rawNorm.replace("QSC_PERSONALITY_", "");
    if (PERSONALITY_ALIASES[tail]) return PERSONALITY_ALIASES[tail];
  }

  if (rawNorm.startsWith("PERSONALITY_")) {
    const tail = rawNorm.replace("PERSONALITY_", "");
    if (PERSONALITY_ALIASES[tail]) return PERSONALITY_ALIASES[tail];
  }

  if (rawNorm.startsWith("QSC_LEADER_PERSONALITY_")) {
    const tail = rawNorm.replace("QSC_LEADER_PERSONALITY_", "");
    if (PERSONALITY_ALIASES[tail]) return PERSONALITY_ALIASES[tail];
  }

  // Contained token match
  for (const key of PERSONALITY_KEYS) {
    if (rawNorm === key || rawNorm.includes(`_${key}`) || rawNorm.includes(`${key}_`)) {
      return key;
    }
  }

  // Single letter token match inside compound values
  const parts = rawNorm.split("_").filter(Boolean);
  for (const p of parts) {
    if (PERSONALITY_ALIASES[p]) return PERSONALITY_ALIASES[p];
  }

  return null;
}

function detectMindsetKey(rawNorm: string): MindsetKey | null {
  // Exact alias
  if (MINDSET_ALIASES[rawNorm]) return MINDSET_ALIASES[rawNorm];

  // Common prefixed shapes
  if (rawNorm.startsWith("QSC_MINDSET_")) {
    const tail = rawNorm.replace("QSC_MINDSET_", "");
    if (MINDSET_ALIASES[tail]) return MINDSET_ALIASES[tail];
  }

  if (rawNorm.startsWith("MINDSET_")) {
    const tail = rawNorm.replace("MINDSET_", "");
    if (MINDSET_ALIASES[tail]) return MINDSET_ALIASES[tail];
  }

  if (rawNorm.startsWith("QSC_LEADER_MINDSET_")) {
    const tail = rawNorm.replace("QSC_LEADER_MINDSET_", "");
    if (MINDSET_ALIASES[tail]) return MINDSET_ALIASES[tail];
  }

  // Prefer higher maturity if compound contains more than one, e.g. ORBIT_QUANTUM
  const priority: MindsetKey[] = ["QUANTUM", "ORBIT", "VECTOR", "MOMENTUM", "ORIGIN"];
  for (const key of priority) {
    if (rawNorm === key || rawNorm.includes(`_${key}`) || rawNorm.includes(`${key}_`)) {
      return key;
    }
  }

  // Numeric parts inside compound values
  const parts = rawNorm.split("_").filter(Boolean);
  for (const p of parts) {
    if (MINDSET_ALIASES[p]) return MINDSET_ALIASES[p];
  }

  return null;
}

function extractKey(question: QscQuestion, raw: string): ExtractResult {
  const rawNorm = normaliseRaw(raw);
  const layerHint = questionLayerHint(question);

  if (!rawNorm) return { layer: null, key: null };

  // 1) Strong / explicit matches first
  if (rawNorm.startsWith("QSC_PERSONALITY_") || rawNorm.startsWith("PERSONALITY_")) {
    const personality = detectPersonalityKey(rawNorm);
    return { layer: personality ? "personality" : null, key: personality };
  }

  if (rawNorm.startsWith("QSC_MINDSET_") || rawNorm.startsWith("MINDSET_")) {
    const mindset = detectMindsetKey(rawNorm);
    return { layer: mindset ? "mindset" : null, key: mindset };
  }

  // 2) If question index tells us the layer, trust that hint
  if (layerHint === "personality") {
    const personality = detectPersonalityKey(rawNorm);
    if (personality) return { layer: "personality", key: personality };

    // fallback for bare single letters or simple values
    const first = rawNorm.split("_")[0];
    if (PERSONALITY_ALIASES[first]) {
      return { layer: "personality", key: PERSONALITY_ALIASES[first] };
    }
  }

  if (layerHint === "mindset") {
    const mindset = detectMindsetKey(rawNorm);
    if (mindset) return { layer: "mindset", key: mindset };

    const first = rawNorm.split("_")[0];
    if (MINDSET_ALIASES[first]) {
      return { layer: "mindset", key: MINDSET_ALIASES[first] };
    }
  }

  // 3) No hint or hint failed — try both
  const personality = detectPersonalityKey(rawNorm);
  if (personality) return { layer: "personality", key: personality };

  const mindset = detectMindsetKey(rawNorm);
  if (mindset) return { layer: "mindset", key: mindset };

  return { layer: null, key: null };
}

function toPercentages(totals: QscLayerTotals): QscLayerPercentages {
  const result: QscLayerPercentages = {};
  const totalPoints = Object.values(totals).reduce((sum, v) => sum + v, 0);

  if (totalPoints <= 0) return result;

  for (const [key, value] of Object.entries(totals)) {
    result[key] = +((value / totalPoints) * 100).toFixed(1);
  }

  return result;
}

function findPrimaryAndSecondary(totals: QscLayerTotals): {
  primary: string | null;
  secondary: string | null;
} {
  const entries = Object.entries(totals).filter(([, v]) => Number(v) > 0);

  if (entries.length === 0) {
    return { primary: null, secondary: null };
  }

  entries.sort((a, b) => b[1] - a[1]);

  return {
    primary: entries[0]?.[0] ?? null,
    secondary: entries[1]?.[0] ?? null,
  };
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
    if (!question || !Array.isArray(question.profile_map)) continue;

    const mapEntry = question.profile_map[answer.choice];
    if (!mapEntry) continue;

    const points = Number(mapEntry.points ?? 0);
    const profile = String(mapEntry.profile ?? "").trim();

    if (!profile || !Number.isFinite(points) || points <= 0) continue;

    const { layer, key } = extractKey(question, profile);
    if (!layer || !key) continue;

    if (layer === "personality") {
      personalityTotals[key] = (personalityTotals[key] ?? 0) + points;
    } else {
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