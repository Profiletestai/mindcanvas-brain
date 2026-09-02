import {
  INEVITABLE_STANDARD_APPROACH_LABELS,
  INEVITABLE_STANDARD_APPROACH_ORDER,
  INEVITABLE_STANDARD_COMMERCIAL_CONTEXT_KEYS,
  INEVITABLE_STANDARD_CONSTRAINT_VERSION,
  INEVITABLE_STANDARD_CONTEXT_QUESTION_INDICES,
  INEVITABLE_STANDARD_EXPECTED_COUNTS,
  INEVITABLE_STANDARD_MODEL_VERSION,
  INEVITABLE_STANDARD_PILLARS,
  INEVITABLE_STANDARD_SCORING_RULES,
  INEVITABLE_STANDARD_SCORING_VERSION,
  type InevitableStandardApproachCode,
  type InevitableStandardCommercialContextKey,
  type InevitableStandardPillar,
} from "./definition";

export type InevitableStandardAnswer = {
  question_index: number;
  /** Zero-based option index for choice questions. */
  choice_index?: number | null;
  /** Stable option value for contextual questions. */
  value?: string | null;
  /** Free-text response for Q13 or Q29. */
  text?: string | null;
};

export type InevitableStandardCommercialContext = Partial<
  Record<InevitableStandardCommercialContextKey, string | null>
> & {
  currency?: string | null;
};

export type InevitableStandardPillarRisk =
  | "high_risk"
  | "medium_risk"
  | "low_risk";

export type InevitableStandardOverallLevel =
  | "chance_based"
  | "inconsistent"
  | "partly_structured"
  | "deliberate_and_repeatable";

export type InevitableStandardScoreResult = {
  model_version: typeof INEVITABLE_STANDARD_MODEL_VERSION;
  scoring_version: typeof INEVITABLE_STANDARD_SCORING_VERSION;
  constraint_version: typeof INEVITABLE_STANDARD_CONSTRAINT_VERSION;
  scoring_complete: boolean;
  answered_scored_questions: number;
  expected_scored_questions: number;
  pillars: Record<
    InevitableStandardPillar,
    {
      raw: number;
      max: 12;
      answered: number;
      percentage: number;
      risk: InevitableStandardPillarRisk;
      risk_label: "High Risk" | "Medium Risk" | "Low Risk";
    }
  >;
  overall: {
    raw: number;
    max: 72;
    percentage: number;
    level: InevitableStandardOverallLevel;
    label:
      | "Chance-Based"
      | "Inconsistent"
      | "Partly Structured"
      | "Deliberate and Repeatable";
  };
  approaches: {
    counts: Record<InevitableStandardApproachCode, number>;
    percentages: Record<InevitableStandardApproachCode, number>;
    labels: typeof INEVITABLE_STANDARD_APPROACH_LABELS;
    answered_dual_coded_questions: number;
    expected_dual_coded_questions: 12;
    dominant: InevitableStandardApproachCode | null;
    dominant_tied: boolean;
    dominant_tied_codes: InevitableStandardApproachCode[];
    secondary: InevitableStandardApproachCode | "BALANCED" | null;
    secondary_tied_codes: InevitableStandardApproachCode[];
    map: {
      x_people_trust_minus_evidence_proof: number;
      y_future_possibility_minus_timing_certainty: number;
    };
  };
  context_answers: Partial<Record<13 | 26 | 27 | 28 | 29, string | null>>;
  commercial_context: InevitableStandardCommercialContext;
  qa_flags: string[];
};

const roundOne = (value: number) => Math.round(value * 10) / 10;

function pillarRisk(raw: number): {
  risk: InevitableStandardPillarRisk;
  label: "High Risk" | "Medium Risk" | "Low Risk";
} {
  if (raw >= 9) return { risk: "low_risk", label: "Low Risk" };
  if (raw >= 5) return { risk: "medium_risk", label: "Medium Risk" };
  return { risk: "high_risk", label: "High Risk" };
}

function overallLevel(percentage: number): {
  level: InevitableStandardOverallLevel;
  label:
    | "Chance-Based"
    | "Inconsistent"
    | "Partly Structured"
    | "Deliberate and Repeatable";
} {
  if (percentage >= 80) {
    return {
      level: "deliberate_and_repeatable",
      label: "Deliberate and Repeatable",
    };
  }
  if (percentage >= 60) {
    return { level: "partly_structured", label: "Partly Structured" };
  }
  if (percentage >= 40) {
    return { level: "inconsistent", label: "Inconsistent" };
  }
  return { level: "chance_based", label: "Chance-Based" };
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function scoreInevitableStandard(args: {
  answers: InevitableStandardAnswer[];
  commercial_context?: InevitableStandardCommercialContext | null;
}): InevitableStandardScoreResult {
  const qaFlags: string[] = [];
  const answerByIndex = new Map<number, InevitableStandardAnswer>();

  for (const answer of args.answers) {
    if (!Number.isInteger(answer.question_index)) {
      qaFlags.push("invalid_question_index");
      continue;
    }
    if (answerByIndex.has(answer.question_index)) {
      qaFlags.push(`duplicate_answer_q${answer.question_index}`);
    }
    answerByIndex.set(answer.question_index, answer);
  }

  const rawByPillar = Object.fromEntries(
    INEVITABLE_STANDARD_PILLARS.map((pillar) => [pillar, 0]),
  ) as Record<InevitableStandardPillar, number>;
  const answeredByPillar = Object.fromEntries(
    INEVITABLE_STANDARD_PILLARS.map((pillar) => [pillar, 0]),
  ) as Record<InevitableStandardPillar, number>;
  const approachCounts = Object.fromEntries(
    INEVITABLE_STANDARD_APPROACH_ORDER.map((approach) => [approach, 0]),
  ) as Record<InevitableStandardApproachCode, number>;

  let answeredScoredQuestions = 0;
  let answeredDualCodedQuestions = 0;

  for (const rule of INEVITABLE_STANDARD_SCORING_RULES) {
    const answer = answerByIndex.get(rule.question_index);
    const choiceIndex = answer?.choice_index;

    if (
      typeof choiceIndex !== "number" ||
      !Number.isInteger(choiceIndex) ||
      choiceIndex < 0 ||
      choiceIndex >= rule.option_scores.length
    ) {
      if (answer) qaFlags.push(`invalid_choice_q${rule.question_index}`);
      continue;
    }

    const score = rule.option_scores[choiceIndex];
    rawByPillar[rule.pillar] += score;
    answeredByPillar[rule.pillar] += 1;
    answeredScoredQuestions += 1;

    if (rule.dual_coded) {
      const approach = INEVITABLE_STANDARD_APPROACH_ORDER[choiceIndex];
      approachCounts[approach] += 1;
      answeredDualCodedQuestions += 1;
    }
  }

  const pillars = Object.fromEntries(
    INEVITABLE_STANDARD_PILLARS.map((pillar) => {
      const raw = rawByPillar[pillar];
      const risk = pillarRisk(raw);
      return [
        pillar,
        {
          raw,
          max: 12 as const,
          answered: answeredByPillar[pillar],
          percentage: roundOne((raw / 12) * 100),
          risk: risk.risk,
          risk_label: risk.label,
        },
      ];
    }),
  ) as InevitableStandardScoreResult["pillars"];

  const overallRaw = INEVITABLE_STANDARD_PILLARS.reduce(
    (total, pillar) => total + rawByPillar[pillar],
    0,
  );
  const overallPercentage = roundOne(
    INEVITABLE_STANDARD_PILLARS.reduce(
      (total, pillar) => total + pillars[pillar].percentage,
      0,
    ) / INEVITABLE_STANDARD_PILLARS.length,
  );
  const overallBand = overallLevel(overallPercentage);

  const approachPercentages = Object.fromEntries(
    INEVITABLE_STANDARD_APPROACH_ORDER.map((approach) => [
      approach,
      roundOne(
        (approachCounts[approach] /
          INEVITABLE_STANDARD_EXPECTED_COUNTS.dual_coded_questions) *
          100,
      ),
    ]),
  ) as Record<InevitableStandardApproachCode, number>;

  const highestCount = Math.max(...Object.values(approachCounts));
  const dominantTiedCodes =
    highestCount > 0
      ? INEVITABLE_STANDARD_APPROACH_ORDER.filter(
          (approach) => approachCounts[approach] === highestCount,
        )
      : [];
  const dominant = dominantTiedCodes[0] ?? null;

  let secondary: InevitableStandardApproachCode | "BALANCED" | null = null;
  let secondaryTiedCodes: InevitableStandardApproachCode[] = [];

  if (dominant) {
    const remaining = INEVITABLE_STANDARD_APPROACH_ORDER.filter(
      (approach) => approach !== dominant,
    );
    const secondCount = Math.max(
      ...remaining.map((approach) => approachCounts[approach]),
    );
    secondaryTiedCodes = remaining.filter(
      (approach) => approachCounts[approach] === secondCount,
    );
    secondary =
      secondaryTiedCodes.length === 1 ? secondaryTiedCodes[0]! : "BALANCED";
  }

  const contextAnswers: InevitableStandardScoreResult["context_answers"] = {};
  for (const questionIndex of INEVITABLE_STANDARD_CONTEXT_QUESTION_INDICES) {
    const answer = answerByIndex.get(questionIndex);
    if (!answer) continue;
    contextAnswers[questionIndex] =
      cleanOptionalText(answer.text) ?? cleanOptionalText(answer.value);
  }

  const commercialContext: InevitableStandardCommercialContext = {};
  for (const key of INEVITABLE_STANDARD_COMMERCIAL_CONTEXT_KEYS) {
    commercialContext[key] = cleanOptionalText(args.commercial_context?.[key]);
  }
  commercialContext.currency = cleanOptionalText(
    args.commercial_context?.currency,
  );

  const scoringComplete =
    answeredScoredQuestions ===
    INEVITABLE_STANDARD_EXPECTED_COUNTS.scored_questions;

  if (!scoringComplete) qaFlags.push("incomplete_scored_answers");
  if (
    answeredDualCodedQuestions !==
    INEVITABLE_STANDARD_EXPECTED_COUNTS.dual_coded_questions
  ) {
    qaFlags.push("incomplete_approach_answers");
  }
  if (dominantTiedCodes.length > 1) {
    qaFlags.push(`dominant_approach_tie_${dominantTiedCodes.join("").toLowerCase()}`);
  }
  if (secondary === "BALANCED") qaFlags.push("secondary_approach_balanced");

  return {
    model_version: INEVITABLE_STANDARD_MODEL_VERSION,
    scoring_version: INEVITABLE_STANDARD_SCORING_VERSION,
    constraint_version: INEVITABLE_STANDARD_CONSTRAINT_VERSION,
    scoring_complete: scoringComplete,
    answered_scored_questions: answeredScoredQuestions,
    expected_scored_questions:
      INEVITABLE_STANDARD_EXPECTED_COUNTS.scored_questions,
    pillars,
    overall: {
      raw: overallRaw,
      max: 72,
      percentage: overallPercentage,
      level: overallBand.level,
      label: overallBand.label,
    },
    approaches: {
      counts: approachCounts,
      percentages: approachPercentages,
      labels: INEVITABLE_STANDARD_APPROACH_LABELS,
      answered_dual_coded_questions: answeredDualCodedQuestions,
      expected_dual_coded_questions: 12,
      dominant,
      dominant_tied: dominantTiedCodes.length > 1,
      dominant_tied_codes: [...dominantTiedCodes],
      secondary,
      secondary_tied_codes: [...secondaryTiedCodes],
      map: {
        x_people_trust_minus_evidence_proof: roundOne(
          approachPercentages.B - approachPercentages.D,
        ),
        y_future_possibility_minus_timing_certainty: roundOne(
          approachPercentages.A - approachPercentages.C,
        ),
      },
    },
    context_answers: contextAnswers,
    commercial_context: commercialContext,
    qa_flags: [...new Set(qaFlags)],
  };
}
