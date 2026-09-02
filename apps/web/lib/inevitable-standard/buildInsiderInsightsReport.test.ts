import { describe, expect, it } from "vitest";

import { buildInsiderInsightsReport } from "./buildInsiderInsightsReport";

/**
 * A minimal stand-in for the object stored on
 * portal.test_results.totals.inevitable_standard: score result plus the
 * `constraints` sibling.
 */
function fakeScore(overrides: Record<string, unknown> = {}) {
  return {
    overall: { percentage: 41.5, label: "Inconsistent" },
    pillars: {
      identity: { percentage: 78, risk: "low_risk" },
      positioning: { percentage: 55, risk: "medium_risk" },
      offer: { percentage: 60, risk: "medium_risk" },
      sales: { percentage: 22, risk: "high_risk" },
      revenue_model: { percentage: 40, risk: "medium_risk" },
      decision: { percentage: 33, risk: "high_risk" },
    },
    approaches: {
      percentages: { A: 44, B: 20, C: 12, D: 24 },
      dominant: "A",
      secondary: "D",
    },
    constraints: {
      primary_constraint: "sales",
      secondary_constraint: "decision",
      false_constraint: null,
      false_constraint_rule_id: null,
      priority_fix_order: ["sales", "decision", "revenue_model"],
    },
    ...overrides,
  };
}

describe("buildInsiderInsightsReport", () => {
  it("selects the dominant approach's content and the derived constraints", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;

    expect(report.meta.approachCode).toBe("A");
    expect(report.meta.approachLabel).toBe("Future-Led");
    expect(report.meta.secondaryInfluence).toBe("EVIDENCE_LED");
    expect(report.meta.primaryConstraint).toEqual({ key: "sales", label: "Sales" });
    expect(report.meta.secondaryConstraint).toEqual({ key: "decision", label: "Decision" });
    // Identity is the highest pillar.
    expect(report.meta.strongestPillar?.key).toBe("identity");
  });

  it("renders exactly one pillar-state block per pillar, matching the taker's band", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;
    const pillarSections = report.sections.filter((s) => s.id.startsWith("pillar-"));
    expect(pillarSections.map((s) => s.id)).toEqual([
      "pillar-identity",
      "pillar-positioning",
      "pillar-offer",
      "pillar-sales",
      "pillar-revenue_model",
      "pillar-decision",
    ]);
    expect(report.sections.find((s) => s.id === "pillar-identity")?.title).toBe(
      "Identity — Green",
    );
    expect(report.sections.find((s) => s.id === "pillar-sales")?.title).toBe(
      "Sales — Red",
    );
  });

  it("drives the primary-constraint, loop, objection and questions sections off the primary pillar", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(report.sections.find((s) => s.id === "primary-constraint")?.title).toBe(
      "Primary constraint — Sales",
    );
    expect(report.sections.find((s) => s.id === "constraint-loop")).toBeTruthy();
    expect(report.sections.find((s) => s.id === "questions-by-primary")?.title).toContain(
      "Sales",
    );
  });

  it("omits the false-constraint section when no rule matched (an optional block)", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(report.sections.find((s) => s.id === "false-constraint")).toBeUndefined();
  });

  it("renders the false-constraint section when a rule id is present", () => {
    const report = buildInsiderInsightsReport({
      score: fakeScore({
        constraints: {
          primary_constraint: "sales",
          secondary_constraint: "decision",
          false_constraint_rule_id: "lead_volume",
          priority_fix_order: ["sales", "decision"],
        },
      }),
    })!;
    const fc = report.sections.find((s) => s.id === "false-constraint");
    expect(fc).toBeTruthy();
    expect(fc?.blocks.some((b) => b.type === "prose")).toBe(true);
  });

  it("keeps sections in the spec's recommended order", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;
    const ids = report.sections.map((s) => s.id);
    const expectedOrder = [
      "core-profile",
      "secondary-influence",
      "pillar-identity",
      "pillar-decision",
      "strongest-pillar",
      "primary-constraint",
      "constraint-loop",
      "risk-signals",
      "objections",
      "conversation-strategy",
      "pre-call",
      "questions-by-primary",
      "avoided-question",
      "challenge-guidance",
      "buying-resistance",
      "next-step",
      "follow-up",
      "post-sale-coaching",
      "accountability",
      "progress-signals",
      "adviser-flags",
    ];
    const positions = expectedOrder.map((id) => ids.indexOf(id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("infers the approach from percentages when dominant is absent", () => {
    const report = buildInsiderInsightsReport({
      score: fakeScore({
        approaches: { percentages: { A: 10, B: 55, C: 20, D: 15 }, secondary: "A" },
      }),
    })!;
    expect(report.meta.approachCode).toBe("B");
    expect(report.qaFlags.join(" ")).toContain("dominant");
  });

  it("never emits a source citation into a rendered section block", () => {
    const banned = [
      /SOURCE ANCHOR/i,
      /CONTENT ID:/i,
      /\bchapter\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d)/i,
      /\bappendix\s+[a-z]\b/i,
    ];
    for (const primary of ["identity", "sales", "revenue_model", "decision"]) {
      for (const dominant of ["A", "B", "C", "D"]) {
        const report = buildInsiderInsightsReport({
          score: fakeScore({
            approaches: { percentages: { A: 40, B: 25, C: 20, D: 15 }, dominant, secondary: "D" },
            constraints: {
              primary_constraint: primary,
              secondary_constraint: primary === "sales" ? "decision" : "sales",
              false_constraint_rule_id: "lead_volume",
              priority_fix_order: [primary],
            },
          }),
        })!;
        for (const section of report.sections) {
          for (const block of section.blocks) {
            const text = block.type === "list" ? block.items.join(" ") : block.text;
            for (const pattern of banned) {
              expect(text, `${dominant}/${primary} ${section.id}`).not.toMatch(pattern);
            }
          }
        }
      }
    }
  });

  it("returns null when there is no usable score", () => {
    expect(buildInsiderInsightsReport({ score: null })).toBeNull();
    expect(buildInsiderInsightsReport({ score: {} })).toBeNull();
  });
});
