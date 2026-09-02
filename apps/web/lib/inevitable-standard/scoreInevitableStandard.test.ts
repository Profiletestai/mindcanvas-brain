import { describe, expect, it } from "vitest";

import {
  INEVITABLE_STANDARD_PILLARS,
  INEVITABLE_STANDARD_SCORING_RULES,
  validateInevitableStandardDefinition,
} from "./definition";
import {
  scoreInevitableStandard,
  type InevitableStandardAnswer,
} from "./scoreInevitableStandard";

function answersWithReadinessScore(
  targetScore: 0 | 1 | 2 | 3,
): InevitableStandardAnswer[] {
  return INEVITABLE_STANDARD_SCORING_RULES.map((rule) => {
    const choiceIndex = rule.option_scores.findIndex(
      (optionScore) => optionScore === targetScore,
    );

    if (choiceIndex < 0) {
      throw new Error(
        `Q${rule.question_index} has no option worth ${targetScore} points.`,
      );
    }

    return {
      question_index: rule.question_index,
      choice_index: choiceIndex,
    };
  });
}

describe("The Inevitable Standard definition", () => {
  it("passes the model integrity checks", () => {
    expect(validateInevitableStandardDefinition()).toEqual([]);
  });
});

describe("scoreInevitableStandard", () => {
  it("returns the maximum result when every highest-readiness option is selected", () => {
    const result = scoreInevitableStandard({
      answers: answersWithReadinessScore(3),
    });

    expect(result.scoring_complete).toBe(true);
    expect(result.answered_scored_questions).toBe(24);

    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      expect(result.pillars[pillar]).toMatchObject({
        raw: 12,
        max: 12,
        answered: 4,
        percentage: 100,
        risk: "low_risk",
        risk_label: "Low Risk",
      });
    }

    expect(result.overall).toEqual({
      raw: 72,
      max: 72,
      percentage: 100,
      level: "deliberate_and_repeatable",
      label: "Deliberate and Repeatable",
    });
  });

  it("returns the minimum result when every lowest-readiness option is selected", () => {
    const result = scoreInevitableStandard({
      answers: answersWithReadinessScore(0),
    });

    expect(result.scoring_complete).toBe(true);

    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      expect(result.pillars[pillar]).toMatchObject({
        raw: 0,
        answered: 4,
        percentage: 0,
        risk: "high_risk",
        risk_label: "High Risk",
      });
    }

    expect(result.overall).toEqual({
      raw: 0,
      max: 72,
      percentage: 0,
      level: "chance_based",
      label: "Chance-Based",
    });
  });

  it("applies the medium pillar band and partly structured overall band", () => {
    const result = scoreInevitableStandard({
      answers: answersWithReadinessScore(2),
    });

    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      expect(result.pillars[pillar]).toMatchObject({
        raw: 8,
        percentage: 66.7,
        risk: "medium_risk",
        risk_label: "Medium Risk",
      });
    }

    expect(result.overall).toMatchObject({
      raw: 48,
      percentage: 66.7,
      level: "partly_structured",
      label: "Partly Structured",
    });
  });

  it("resolves a four-way approach tie deterministically and records the tie", () => {
    let dualCodedIndex = 0;
    const answers: InevitableStandardAnswer[] =
      INEVITABLE_STANDARD_SCORING_RULES.map((rule) => {
        if (rule.dual_coded) {
          const choiceIndex = dualCodedIndex % 4;
          dualCodedIndex += 1;
          return { question_index: rule.question_index, choice_index: choiceIndex };
        }

        const choiceIndex = rule.option_scores.findIndex(
          (optionScore) => optionScore === 3,
        );
        return { question_index: rule.question_index, choice_index: choiceIndex };
      });

    const result = scoreInevitableStandard({ answers });

    expect(result.approaches.counts).toEqual({ A: 3, B: 3, C: 3, D: 3 });
    expect(result.approaches.percentages).toEqual({
      A: 25,
      B: 25,
      C: 25,
      D: 25,
    });
    expect(result.approaches.dominant).toBe("A");
    expect(result.approaches.dominant_tied).toBe(true);
    expect(result.approaches.dominant_tied_codes).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(result.approaches.secondary).toBe("BALANCED");
    expect(result.approaches.map).toEqual({
      x_people_trust_minus_evidence_proof: 0,
      y_future_possibility_minus_timing_certainty: 0,
    });
    expect(result.qa_flags).toEqual(
      expect.arrayContaining([
        "dominant_approach_tie_abcd",
        "secondary_approach_balanced",
      ]),
    );
  });

  it("flags incomplete and invalid scored answers", () => {
    const result = scoreInevitableStandard({
      answers: [
        { question_index: 1, choice_index: 0 },
        { question_index: 2, choice_index: 99 },
      ],
    });

    expect(result.scoring_complete).toBe(false);
    expect(result.answered_scored_questions).toBe(1);
    expect(result.approaches.answered_dual_coded_questions).toBe(1);
    expect(result.qa_flags).toEqual(
      expect.arrayContaining([
        "invalid_choice_q2",
        "incomplete_scored_answers",
        "incomplete_approach_answers",
      ]),
    );
  });

  it("preserves contextual answers without changing the score", () => {
    const result = scoreInevitableStandard({
      answers: [
        ...answersWithReadinessScore(3),
        { question_index: 13, text: "  Founder-led delivery  " },
        { question_index: 26, value: "under_100k" },
        { question_index: 27, value: "five_to_ten" },
        { question_index: 28, value: "high_value" },
        { question_index: 29, text: "  Build repeatable sales  " },
      ],
      commercial_context: {
        revenue_band: "  100k_to_250k  ",
        monthly_opportunity_band: "ten_to_twenty",
        initial_customer_value_band: "five_to_ten_thousand",
        currency: "  AUD  ",
      },
    });

    expect(result.overall.raw).toBe(72);
    expect(result.context_answers).toEqual({
      13: "Founder-led delivery",
      26: "under_100k",
      27: "five_to_ten",
      28: "high_value",
      29: "Build repeatable sales",
    });
    expect(result.commercial_context).toEqual({
      revenue_band: "100k_to_250k",
      monthly_opportunity_band: "ten_to_twenty",
      initial_customer_value_band: "five_to_ten_thousand",
      currency: "AUD",
    });
  });
});