import { describe, expect, it } from "vitest";

import {
  buildDiagnosticAdds,
  buildNinetyDayPlan,
  isMeaningfulFreeText,
} from "./fullDiagnosticTemplates";
import { INEVITABLE_STANDARD_PILLARS } from "./definition";

describe("buildNinetyDayPlan", () => {
  const fullOrder = [
    "identity",
    "offer",
    "positioning",
    "revenue_model",
    "sales",
    "decision",
  ] as const;

  it("returns three windows following the priority fix order", () => {
    const plan = buildNinetyDayPlan({
      priorityOrder: [...fullOrder],
      primaryConstraint: "sales",
      secondaryConstraint: "identity",
      pillarPercentages: {},
    });

    expect(plan.map((p) => p.window)).toEqual([
      "Days 1–30",
      "Days 31–60",
      "Days 61–90",
    ]);
    expect(plan.map((p) => p.pillar)).toEqual(["identity", "offer", "positioning"]);
    expect(plan[0].actions.length).toBeGreaterThanOrEqual(2);
    expect(plan[0].outcome).toMatch(/\w/);
  });

  it("tags the constraint roles where they land in the sequence", () => {
    const plan = buildNinetyDayPlan({
      priorityOrder: ["identity", "sales", "offer", "positioning", "revenue_model", "decision"],
      primaryConstraint: "sales",
      secondaryConstraint: "identity",
      pillarPercentages: {},
    });

    expect(plan[0]).toMatchObject({ pillar: "identity", role: "secondary constraint" });
    expect(plan[1]).toMatchObject({ pillar: "sales", role: "primary constraint" });
    expect(plan[2]).toMatchObject({ pillar: "offer", role: "sequenced next" });
  });

  it("degrades to the three lowest-scoring pillars when there is no priority order", () => {
    const plan = buildNinetyDayPlan({
      priorityOrder: [],
      primaryConstraint: null,
      secondaryConstraint: null,
      pillarPercentages: {
        identity: 20,
        positioning: 80,
        offer: 35,
        sales: 10,
        revenue_model: 75,
        decision: 66,
      },
    });

    expect(plan.map((p) => p.pillar)).toEqual(["sales", "identity", "offer"]);
    expect(plan.every((p) => p.role === "focus area")).toBe(true);
  });

  it("only ever names real pillars", () => {
    const plan = buildNinetyDayPlan({
      priorityOrder: [...fullOrder],
      primaryConstraint: "identity",
      secondaryConstraint: "offer",
      pillarPercentages: {},
    });
    for (const phase of plan) {
      expect(INEVITABLE_STANDARD_PILLARS).toContain(phase.pillar);
    }
  });
});

describe("isMeaningfulFreeText", () => {
  it("rejects filler and placeholders", () => {
    for (const value of ["", "  ", "test", "Testing", "n/a", "none", "...", "x"]) {
      expect(isMeaningfulFreeText(value)).toBe(false);
    }
  });

  it("keeps real answers", () => {
    expect(isMeaningfulFreeText("Cash flow is tight")).toBe(true);
    expect(isMeaningfulFreeText("Not sure how to price the new package")).toBe(true);
  });
});

describe("buildDiagnosticAdds", () => {
  it("returns null when there is nothing to say", () => {
    expect(
      buildDiagnosticAdds({
        q13: "test",
        q29: null,
        primaryLabel: null,
        secondaryLabel: null,
        falseConstraint: null,
      }),
    ).toBeNull();
  });

  it("surfaces the quotes and links them to the primary constraint", () => {
    const result = buildDiagnosticAdds({
      q13: "We can't seem to raise prices without losing people",
      q29: "Whether to drop the lowest tier",
      primaryLabel: "Identity",
      secondaryLabel: "Offer",
      falseConstraint: null,
    });

    expect(result).not.toBeNull();
    expect(result!.toldUs).toHaveLength(2);
    expect(result!.adds).toContain("Identity");
    expect(result!.adds).toContain("held in place by Offer");
  });

  it("frames a false-constraint mismatch as the recognition moment", () => {
    const result = buildDiagnosticAdds({
      q13: "Marketing isn't bringing in enough leads",
      q29: null,
      primaryLabel: "Sales",
      secondaryLabel: null,
      falseConstraint: {
        stated_label: "Positioning",
        evidence_label: "Sales",
        mismatch: true,
        explanation: "The enquiries arrive; they are not being converted.",
      },
    });

    expect(result!.adds).toContain("points toward Positioning");
    expect(result!.adds).toContain("more consistently to Sales");
    expect(result!.adds).toContain("recognition this diagnostic is built to surface");
  });

  it("still returns interpretation when quotes are filler but a constraint exists", () => {
    const result = buildDiagnosticAdds({
      q13: "test",
      q29: "test",
      primaryLabel: "Decision",
      secondaryLabel: null,
      falseConstraint: null,
    });
    expect(result).not.toBeNull();
    expect(result!.toldUs).toHaveLength(0);
    expect(result!.adds).toContain("Decision");
  });
});
