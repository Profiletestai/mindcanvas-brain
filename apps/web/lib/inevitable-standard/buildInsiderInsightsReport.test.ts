import { describe, expect, it } from "vitest";

import { buildInsiderInsightsReport } from "./buildInsiderInsightsReport";

/**
 * A minimal stand-in for the object stored on
 * portal.test_results.totals.inevitable_standard: score result plus the
 * `constraints` and `context_answers` siblings.
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
    context_answers: {
      13: "We keep having great conversations that go nowhere. People love the vision but I never actually close.",
      29: "Whether to raise prices on the new package. I keep putting it off.",
    },
    ...overrides,
  };
}

describe("buildInsiderInsightsReport — five-section structure", () => {
  it("returns exactly the five report parts, nothing else", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(Object.keys(report).sort()).toEqual(
      [
        "foundersWords",
        "meta",
        "objective",
        "predictiveSignals",
        "qaFlags",
        "snapshot",
        "suggestedSequence",
      ].sort(),
    );
    // No leftover deep-document section list.
    expect(report).not.toHaveProperty("sections");
  });

  it("1. Snapshot carries the score/constraint data", () => {
    const { snapshot, meta } = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(meta.approachLabel).toBe("Future-Led");
    expect(snapshot.primaryApproach).toEqual({ label: "Future-Led", percentage: 44 });
    expect(snapshot.secondaryApproach).toEqual({ label: "Evidence-Led", percentage: 24 });
    expect(snapshot.primaryConstraint?.label).toBe("Sales");
    expect(snapshot.primaryConstraint?.gar).toBe("RED");
    expect(snapshot.secondaryConstraint?.label).toBe("Decision");
    expect(snapshot.strongestPillar?.label).toBe("Identity");
    expect(snapshot.pillars).toHaveLength(6);
    expect(snapshot.pillars[0]).toHaveProperty("descriptor");
    expect(snapshot.priorityOrder.map((p) => p.label)).toEqual([
      "Sales",
      "Decision",
      "Revenue Model",
      "Positioning",
      "Offer",
      "Identity",
    ]);
  });

  it("1. Snapshot renders a false constraint only when a rule matched", () => {
    expect(buildInsiderInsightsReport({ score: fakeScore() })!.snapshot.falseConstraint).toBeNull();
    const withFc = buildInsiderInsightsReport({
      score: fakeScore({
        constraints: {
          primary_constraint: "sales",
          secondary_constraint: "decision",
          false_constraint: { explanation: "The pattern points to Sales, not lead volume." },
          false_constraint_rule_id: "lead_volume",
          priority_fix_order: ["sales", "decision"],
        },
      }),
    })!;
    expect(withFc.snapshot.falseConstraint?.label).toContain("more leads");
    expect(withFc.snapshot.falseConstraint?.note).toBeTruthy();
  });

  it("2. Predictive Signals is the 13-row table for the primary approach", () => {
    const { predictiveSignals } = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(predictiveSignals.map((r) => r.label)).toEqual([
      "How they think",
      "How they decide",
      "How they buy",
      "What builds trust",
      "What reduces trust",
      "Best communication style",
      "Likely objection",
      "What may really be underneath it",
      "Buying signals",
      "Resistance signals",
      "What to challenge",
      "What not to assume",
      "Coaching style",
    ]);
    for (const row of predictiveSignals) expect(row.text.length).toBeGreaterThan(0);
    // Compressed to the lead paragraph, not the whole section.
    const think = predictiveSignals.find((r) => r.label === "How they think")!;
    expect(think.text).not.toContain("\n\n");
  });

  it("2. every approach fills all 13 rows (D's challenge / not-assume fallbacks work)", () => {
    for (const dominant of ["A", "B", "C", "D"]) {
      const report = buildInsiderInsightsReport({
        score: fakeScore({
          approaches: { percentages: { A: 40, B: 25, C: 20, D: 15 }, dominant, secondary: "A" },
        }),
      })!;
      expect(report.predictiveSignals, `approach ${dominant}`).toHaveLength(13);
    }
  });

  it("3. Founder's Own Words annotates each verbatim answer", () => {
    const { foundersWords } = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(foundersWords.map((w) => w.prompt)).toEqual([
      "The biggest thing holding the business back",
      "A decision you know you need to make but have not made",
    ]);
    const q13 = foundersWords[0];
    expect(q13.quote).toContain("great conversations that go nowhere");
    expect(q13.pillar?.label).toBe("Sales");
    expect(q13.tags.map((t) => t.kind)).toContain("HYPOTHESIS TO VALIDATE");
    expect(q13.tags.map((t) => t.kind)).toContain("LISTEN FOR");
    // Q29 is keyed to the Decision pillar and carries the single GREEN LEVERAGE tag.
    const q29 = foundersWords[1];
    expect(q29.pillar?.label).toBe("Decision");
    expect(q29.tags.map((t) => t.kind)).toContain("GREEN LEVERAGE"); // Identity is Green
    // GREEN LEVERAGE appears once across the section, not on every card.
    const greenCount = foundersWords
      .flatMap((w) => w.tags)
      .filter((t) => t.kind === "GREEN LEVERAGE").length;
    expect(greenCount).toBe(1);
    // The two cards do not surface the same risk signal.
    expect(q13.riskSignal?.label).not.toBe(q29.riskSignal?.label);
  });

  it("3. filler / empty free text produces no cards", () => {
    const report = buildInsiderInsightsReport({
      score: fakeScore({ context_answers: { 13: "n/a", 29: "" } }),
    })!;
    expect(report.foundersWords).toHaveLength(0);
    expect(report.qaFlags.join(" ")).toContain("Founder's Own Words");
  });

  it("4. Suggested Sequence is exactly four steps with instructions", () => {
    const { suggestedSequence } = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(suggestedSequence.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    for (const step of suggestedSequence) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.instruction.length).toBeGreaterThan(0);
    }
    // Steps 2–4 quote a real by-primary question; step 1 does not.
    expect(suggestedSequence[0].example).toBeNull();
    expect(suggestedSequence[1].example).toBeTruthy();
    expect(suggestedSequence[3].example).toBeTruthy();
  });

  it("5. The Objective is a single tailored line", () => {
    const { objective } = buildInsiderInsightsReport({ score: fakeScore() })!;
    expect(objective).toBeTruthy();
    expect(objective!.length).toBeLessThan(320);
  });

  it("degrades without a primary constraint: 11 signal rows, template objective, no crash", () => {
    const report = buildInsiderInsightsReport({
      score: fakeScore({
        constraints: { primary_constraint: null, secondary_constraint: null, priority_fix_order: [] },
      }),
    })!;
    expect(report.predictiveSignals).toHaveLength(11); // objection rows dropped
    expect(report.suggestedSequence).toHaveLength(4);
    expect(report.objective).toBeTruthy();
    expect(report.qaFlags.join(" ")).toContain("primary constraint");
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

  it("returns null when there is no usable score", () => {
    expect(buildInsiderInsightsReport({ score: null })).toBeNull();
    expect(buildInsiderInsightsReport({ score: {} })).toBeNull();
  });

  it("never emits a source citation into any rendered string", () => {
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
              false_constraint: { explanation: "x" },
              priority_fix_order: [primary],
            },
          }),
        })!;
        const strings: string[] = [
          ...report.predictiveSignals.map((r) => r.text),
          ...report.foundersWords.flatMap((w) => [
            ...w.tags.map((t) => t.text),
            w.riskSignal?.text ?? "",
            w.riskSignal?.adviserResponse ?? "",
          ]),
          ...report.suggestedSequence.flatMap((s) => [s.instruction, s.example ?? ""]),
          report.objective ?? "",
          report.snapshot.falseConstraint?.note ?? "",
        ];
        for (const value of strings) {
          for (const pattern of banned) {
            expect(value, `${dominant}/${primary}`).not.toMatch(pattern);
          }
        }
      }
    }
  });
});
