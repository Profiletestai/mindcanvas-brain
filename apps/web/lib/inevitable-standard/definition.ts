export const INEVITABLE_STANDARD_MODEL_VERSION =
  "inevitable_standard_model_v1" as const;
export const INEVITABLE_STANDARD_SCORING_VERSION =
  "inevitable_standard_scoring_v1" as const;
export const INEVITABLE_STANDARD_CONSTRAINT_VERSION =
  "inevitable_standard_constraints_v1_draft" as const;

export const INEVITABLE_STANDARD_PILLARS = [
  "identity",
  "positioning",
  "offer",
  "sales",
  "revenue_model",
  "decision",
] as const;

export type InevitableStandardPillar =
  (typeof INEVITABLE_STANDARD_PILLARS)[number];

export const INEVITABLE_STANDARD_APPROACH_ORDER = ["A", "B", "C", "D"] as const;

export type InevitableStandardApproachCode =
  (typeof INEVITABLE_STANDARD_APPROACH_ORDER)[number];

export const INEVITABLE_STANDARD_APPROACH_LABELS: Record<
  InevitableStandardApproachCode,
  string
> = {
  A: "Future-Led",
  B: "Connection-Led",
  C: "Timing-Led",
  D: "Evidence-Led",
};

export type InevitableStandardScore = 0 | 1 | 2 | 3;

export type InevitableStandardScoringRule = {
  question_index: number;
  pillar: InevitableStandardPillar;
  dual_coded: boolean;
  option_scores: readonly [
    InevitableStandardScore,
    InevitableStandardScore,
    InevitableStandardScore,
    InevitableStandardScore,
  ];
};

/**
 * Scoring authority for the approved 29-question v0.4 assessment.
 *
 * Q2, Q6 and Q12 use Genene's approved replacement options. Their option order
 * remains a descending 3/2/1/0 readiness scale. Q3's wording change does not
 * change its score or approach mapping.
 *
 * Every dual-coded question uses option positions 1-4 for approaches A-D.
 * Readiness and approach are deliberately calculated as separate signals.
 */
export const INEVITABLE_STANDARD_SCORING_RULES = [
  { question_index: 1, pillar: "positioning", dual_coded: true, option_scores: [0, 2, 1, 3] },
  { question_index: 2, pillar: "sales", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 3, pillar: "offer", dual_coded: true, option_scores: [2, 1, 3, 0] },
  { question_index: 4, pillar: "identity", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 5, pillar: "decision", dual_coded: true, option_scores: [2, 3, 0, 1] },
  { question_index: 6, pillar: "revenue_model", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 7, pillar: "identity", dual_coded: true, option_scores: [3, 2, 1, 0] },
  { question_index: 8, pillar: "positioning", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 9, pillar: "sales", dual_coded: true, option_scores: [3, 0, 1, 2] },
  { question_index: 10, pillar: "offer", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 11, pillar: "revenue_model", dual_coded: true, option_scores: [1, 0, 2, 3] },
  { question_index: 12, pillar: "decision", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 14, pillar: "positioning", dual_coded: true, option_scores: [3, 1, 2, 0] },
  { question_index: 15, pillar: "sales", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 16, pillar: "offer", dual_coded: true, option_scores: [1, 2, 0, 3] },
  { question_index: 17, pillar: "identity", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 18, pillar: "revenue_model", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 19, pillar: "decision", dual_coded: true, option_scores: [1, 0, 3, 2] },
  { question_index: 20, pillar: "positioning", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 21, pillar: "sales", dual_coded: true, option_scores: [0, 3, 2, 1] },
  { question_index: 22, pillar: "offer", dual_coded: false, option_scores: [3, 2, 1, 0] },
  { question_index: 23, pillar: "revenue_model", dual_coded: true, option_scores: [2, 3, 1, 0] },
  { question_index: 24, pillar: "identity", dual_coded: true, option_scores: [0, 1, 2, 3] },
  { question_index: 25, pillar: "decision", dual_coded: false, option_scores: [3, 2, 1, 0] },
] as const satisfies readonly InevitableStandardScoringRule[];

export const INEVITABLE_STANDARD_CONTEXT_QUESTION_INDICES = [13, 26, 27, 28, 29] as const;
export const INEVITABLE_STANDARD_TEXT_CONTEXT_INDICES = [13, 29] as const;
export const INEVITABLE_STANDARD_CHOICE_CONTEXT_INDICES = [26, 27, 28] as const;

export const INEVITABLE_STANDARD_COMMERCIAL_CONTEXT_KEYS = [
  "revenue_band",
  "monthly_opportunity_band",
  "initial_customer_value_band",
] as const;

export type InevitableStandardCommercialContextKey =
  (typeof INEVITABLE_STANDARD_COMMERCIAL_CONTEXT_KEYS)[number];

export const INEVITABLE_STANDARD_EXPECTED_COUNTS = {
  diagnostic_questions: 29,
  scored_questions: 24,
  context_questions: 5,
  commercial_context_fields: 3,
  scored_questions_per_pillar: 4,
  dual_coded_questions: 12,
  pillar_max_raw_score: 12,
  overall_max_raw_score: 72,
} as const;

export function validateInevitableStandardDefinition(): string[] {
  const issues: string[] = [];
  const seen = new Set<number>();
  const pillarCounts = Object.fromEntries(
    INEVITABLE_STANDARD_PILLARS.map((pillar) => [pillar, 0]),
  ) as Record<InevitableStandardPillar, number>;
  const approachReadinessTotals = Object.fromEntries(
    INEVITABLE_STANDARD_APPROACH_ORDER.map((approach) => [approach, 0]),
  ) as Record<InevitableStandardApproachCode, number>;

  let dualCount = 0;

  for (const rule of INEVITABLE_STANDARD_SCORING_RULES) {
    if (seen.has(rule.question_index)) {
      issues.push(`Duplicate scoring rule for Q${rule.question_index}.`);
    }
    seen.add(rule.question_index);
    pillarCounts[rule.pillar] += 1;

    if (rule.option_scores.length !== 4) {
      issues.push(`Q${rule.question_index} must have four score values.`);
    }

    if (rule.dual_coded) {
      dualCount += 1;
      INEVITABLE_STANDARD_APPROACH_ORDER.forEach((approach, optionIndex) => {
        approachReadinessTotals[approach] += rule.option_scores[optionIndex];
      });
    }
  }

  if (
    INEVITABLE_STANDARD_SCORING_RULES.length !==
    INEVITABLE_STANDARD_EXPECTED_COUNTS.scored_questions
  ) {
    issues.push("The model must contain exactly 24 scored questions.");
  }

  if (dualCount !== INEVITABLE_STANDARD_EXPECTED_COUNTS.dual_coded_questions) {
    issues.push("The model must contain exactly 12 dual-coded questions.");
  }

  for (const pillar of INEVITABLE_STANDARD_PILLARS) {
    if (
      pillarCounts[pillar] !==
      INEVITABLE_STANDARD_EXPECTED_COUNTS.scored_questions_per_pillar
    ) {
      issues.push(`${pillar} must contain exactly four scored questions.`);
    }
  }

  for (const approach of INEVITABLE_STANDARD_APPROACH_ORDER) {
    if (approachReadinessTotals[approach] !== 18) {
      issues.push(
        `${approach} must carry a total dual-coded readiness weight of 18.`,
      );
    }
  }

  return issues;
}