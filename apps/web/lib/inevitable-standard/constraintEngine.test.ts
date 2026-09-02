import { describe, expect, it } from "vitest";

import {
  INEVITABLE_STANDARD_PILLARS,
  INEVITABLE_STANDARD_SCORING_RULES,
  type InevitableStandardPillar,
} from "./definition";
import {
  scoreInevitableStandard,
  type InevitableStandardAnswer,
  type InevitableStandardScoreResult,
} from "./scoreInevitableStandard";
import {
  deriveInevitableStandardConstraints,
  methodLayerFor,
  validateInevitableStandardConstraintModel,
} from "./constraintEngine";

/**
 * Splits a target pillar raw score (0-12) into four per-question scores (each
 * 0-3). Order within the pillar does not matter for the raw sum.
 */
function splitRaw(target: number): number[] {
  const parts = [0, 0, 0, 0];
  let remaining = Math.max(0, Math.min(12, Math.round(target)));
  for (let i = 0; i < parts.length && remaining > 0; i += 1) {
    const take = Math.min(3, remaining);
    parts[i] = take;
    remaining -= take;
  }
  return parts;
}

/**
 * Builds a real InevitableStandardScoreResult with each pillar landing on a
 * chosen raw score, by selecting the matching option for every scored question.
 */
function scoreWithPillarRaws(
  raws: Partial<Record<InevitableStandardPillar, number>>,
  context: { q13?: string; q29?: string } = {},
): InevitableStandardScoreResult {
  const queues = Object.fromEntries(
    INEVITABLE_STANDARD_PILLARS.map((pillar) => [
      pillar,
      splitRaw(raws[pillar] ?? 0),
    ]),
  ) as Record<InevitableStandardPillar, number[]>;

  const answers: InevitableStandardAnswer[] =
    INEVITABLE_STANDARD_SCORING_RULES.map((rule) => {
      const desired = queues[rule.pillar].shift() ?? 0;
      const choiceIndex = rule.option_scores.findIndex(
        (optionScore) => optionScore === desired,
      );
      return { question_index: rule.question_index, choice_index: choiceIndex };
    });

  if (context.q13) answers.push({ question_index: 13, text: context.q13 });
  if (context.q29) answers.push({ question_index: 29, text: context.q29 });

  return scoreInevitableStandard({ answers });
}

describe("The Inevitable Standard constraint model", () => {
  it("passes the model integrity checks", () => {
    expect(validateInevitableStandardConstraintModel()).toEqual([]);
  });

  it("maps pillars to the correct Method layers", () => {
    expect(methodLayerFor("identity")).toBe("identity");
    expect(methodLayerFor("positioning")).toBe("identity");
    expect(methodLayerFor("offer")).toBe("structure");
    expect(methodLayerFor("revenue_model")).toBe("structure");
    expect(methodLayerFor("sales")).toBe("execution");
    expect(methodLayerFor("decision")).toBe("execution");
  });
});

describe("deriveInevitableStandardConstraints", () => {
  it("picks the clearly weakest pillar as the primary constraint", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 9,
        positioning: 10,
        offer: 8,
        sales: 2,
        revenue_model: 9,
        decision: 8,
      },
      { q13: "We just need more leads coming in." },
    );

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("sales");
    expect(result.secondary_constraint).toBe("offer");
    expect(result.identity_decision_override).toBe(false);
    expect(result.false_constraint).toMatchObject({
      stated_pillar: "positioning",
      evidence_pillar: "sales",
      mismatch: true,
    });
    expect(result.false_constraint_rule_id).toBe("lead_volume");
    // Primary first, Secondary second, then remaining pillars by severity.
    expect(result.priority_fix_order).toEqual([
      "sales",
      "offer",
      "decision",
      "identity",
      "revenue_model",
      "positioning",
    ]);
    expect(result.confidence).toBe("High");
  });

  it("promotes a materially-low Identity pillar over a marginally-lower pillar", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 4, // 33.3%
        positioning: 10,
        offer: 9,
        sales: 3, // 25% - numerically lowest, but only 8.3 points below Identity
        revenue_model: 9,
        decision: 10,
      },
      { q13: "Our price is too high and we need to lower our prices." },
    );

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("identity");
    expect(result.identity_decision_override).toBe(true);
    expect(result.secondary_constraint).toBe("sales");
    expect(result.false_constraint).toEqual({
      stated_pillar: "offer",
      evidence_pillar: "identity",
      mismatch: true,
      explanation: expect.stringContaining("Identity"),
    });
    expect(result.false_constraint_rule_id).toBe("price_too_high");
    // The override makes Identity Primary; Sales is the reinforcing Secondary.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "sales",
      "offer",
      "revenue_model",
      "positioning",
      "decision",
    ]);
    // Override is an inherent judgement call - confidence never reaches High.
    expect(result.confidence).toBe("Medium");
  });

  it("does not override when the lowest pillar is clearly below Identity/Decision", () => {
    const score = scoreWithPillarRaws({
      identity: 4, // 33.3%
      positioning: 10,
      offer: 10,
      sales: 2, // 16.7% - 16.6 points below Identity, past the proximity window
      revenue_model: 10,
      decision: 10,
    });

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("sales");
    expect(result.identity_decision_override).toBe(false);
  });

  it("returns a false constraint that agrees with the evidence (no mismatch)", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 9,
        positioning: 2, // primary
        offer: 8,
        sales: 9,
        revenue_model: 9,
        decision: 8,
      },
      { q13: "We need more leads." },
    );

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("positioning");
    expect(result.false_constraint).toEqual({
      stated_pillar: "positioning",
      evidence_pillar: "positioning",
      mismatch: false,
      explanation: expect.stringContaining("agrees"),
    });
    expect(result.confidence).toBe("High");
  });

  it("returns null when the free text matches no keyword rule", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 9,
        positioning: 9,
        offer: 8,
        sales: 8,
        revenue_model: 9,
        decision: 3, // primary
      },
      {
        q13: "Not sure honestly, maybe my own focus.",
        q29: "Whether to bring someone on.",
      },
    );

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("decision");
    expect(result.false_constraint).toBeNull();
    expect(result.false_constraint_rule_id).toBeNull();
    // Decision is Primary; Offer is Secondary; the rest follow by severity.
    expect(result.priority_fix_order).toEqual([
      "decision",
      "offer",
      "sales",
      "identity",
      "positioning",
      "revenue_model",
    ]);
    expect(result.confidence).toBe("Medium");
  });

  it("grades flat / blended pillar scores as Directional", () => {
    const score = scoreWithPillarRaws({
      identity: 6,
      positioning: 6,
      offer: 6,
      sales: 6,
      revenue_model: 6,
      decision: 6,
    });

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("identity");
    expect(result.secondary_constraint).toBe("positioning");
    // All equal -> Primary and Secondary first, then canonical order for the tie.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "positioning",
      "offer",
      "sales",
      "revenue_model",
      "decision",
    ]);
    expect(result.confidence).toBe("Directional");
    expect(result.false_constraint).toBeNull();
  });

  it("always returns the full 6-pillar diagnosis-led ranking", () => {
    const score = scoreWithPillarRaws({
      identity: 7, // 58.3
      positioning: 8, // 66.7
      offer: 6, // 50
      sales: 7, // 58.3
      revenue_model: 8, // 66.7
      decision: 3, // 25
    });

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.priority_fix_order).toHaveLength(6);
    expect([...result.priority_fix_order].sort()).toEqual(
      [...INEVITABLE_STANDARD_PILLARS].sort(),
    );
    // Decision Primary, Offer Secondary, then remaining pillars by severity.
    expect(result.priority_fix_order).toEqual([
      "decision",
      "offer",
      "identity",
      "sales",
      "positioning",
      "revenue_model",
    ]);
  });

  it("caps confidence at Directional when there is no usable free-text signal", () => {
    const score = scoreWithPillarRaws({
      identity: 9,
      positioning: 9,
      offer: 9,
      sales: 2, // clearly separated primary
      revenue_model: 9,
      decision: 9,
    });

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("sales");
    expect(result.confidence).toBe("Directional");
    expect(result.false_constraint).toBeNull();
  });

  it("starts the priority fix order with Primary then Secondary regardless of Method layer", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 4, // 33.3% - secondary, Identity layer
        positioning: 10,
        offer: 10,
        sales: 2, // 16.7% - primary, Execution layer
        revenue_model: 10,
        decision: 10,
      },
      { q13: "We need better systems and more structure in the business." },
    );

    const result = deriveInevitableStandardConstraints({ score });

    expect(result.primary_constraint).toBe("sales");
    expect(result.secondary_constraint).toBe("identity");
    // Sales is the intervention point; Identity is the reinforcing Secondary.
    // The remaining tied pillars use canonical order.
    expect(result.priority_fix_order).toEqual([
      "sales",
      "identity",
      "positioning",
      "offer",
      "revenue_model",
      "decision",
    ]);
    expect(result.priority_fix_order.slice(0, 3)).toEqual([
      "sales",
      "identity",
      "positioning",
    ]);
    expect(result.false_constraint?.stated_pillar).toBe("revenue_model");
    expect(result.false_constraint?.evidence_pillar).toBe("sales");
    expect(result.confidence).toBe("High");
  });

  it("falls back to the score's stored Q13/Q29 context answers", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 9,
        positioning: 10,
        offer: 9,
        sales: 2,
        revenue_model: 9,
        decision: 9,
      },
      { q13: "Honestly we just need more leads." },
    );

    // No q13_text / q29_text passed - the engine reads score.context_answers.
    const result = deriveInevitableStandardConstraints({ score });

    expect(result.false_constraint_rule_id).toBe("lead_volume");
    expect(result.false_constraint).toMatchObject({
      stated_pillar: "positioning",
      mismatch: true,
    });
  });

  it("prefers the explicit free-text arguments over the stored context answers", () => {
    const score = scoreWithPillarRaws(
      {
        identity: 9,
        positioning: 10,
        offer: 9,
        sales: 2,
        revenue_model: 9,
        decision: 9,
      },
      { q13: "We need more leads." },
    );

    const result = deriveInevitableStandardConstraints({
      score,
      q13_text: "Our prices are too high.",
      q29_text: null,
    });

    expect(result.false_constraint_rule_id).toBe("price_too_high");
  });
});
