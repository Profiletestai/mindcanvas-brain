import { describe, expect, it } from "vitest";

import {
  INSIDER_APPROACH_CODES,
  INSIDER_INSIGHTS_DATA,
  garFromRisk,
  selectDirectionalPair,
  selectFalseConstraint,
  selectPillarState,
  selectPrimaryConstraint,
} from "./insiderInsights";

const PILLAR_IDS = [
  "IDENTITY",
  "POSITIONING",
  "OFFER",
  "SALES",
  "REVENUE_MODEL",
  "DECISION",
] as const;

describe("insiderInsights data integrity", () => {
  it("holds all four approaches", () => {
    expect(Object.keys(INSIDER_INSIGHTS_DATA).sort()).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  for (const code of INSIDER_APPROACH_CODES) {
    describe(`approach ${code}`, () => {
      const data = INSIDER_INSIGHTS_DATA[code];

      it("has 18 pillar-state blocks (6 pillars × 3 states)", () => {
        expect(Object.keys(data.pillarStates)).toHaveLength(18);
        for (const pillar of PILLAR_IDS) {
          for (const state of ["GREEN", "AMBER", "RED"]) {
            expect(data.pillarStates[`${pillar}_${state}`]).toBeTruthy();
          }
        }
      });

      it("has 6 primary constraints and 30 directional pairs", () => {
        expect(Object.keys(data.primaryConstraints)).toHaveLength(6);
        expect(Object.keys(data.directionalPairs)).toHaveLength(30);
      });

      it("has 4 core false constraints", () => {
        expect(Object.keys(data.falseConstraints.core).sort()).toEqual([
          "BETTER_SYSTEMS",
          "MORE_LEADS",
          "NEW_OFFER",
          "PRICE_TOO_HIGH",
        ]);
      });

      it("has 8 pre-call questions", () => {
        expect(data.preCall.questions).toHaveLength(8);
      });

      it("carries no leftover bullet markers in any string value", () => {
        const offenders: string[] = [];
        const walk = (node: unknown, path: string) => {
          if (typeof node === "string") {
            if (/^\s*[•*]\s/.test(node) || /^\s*-\s/.test(node)) {
              offenders.push(`${path}: ${JSON.stringify(node.slice(0, 50))}`);
            }
          } else if (Array.isArray(node)) {
            node.forEach((v, i) => walk(v, `${path}[${i}]`));
          } else if (node && typeof node === "object") {
            for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
          }
        };
        walk(data, code);
        expect(offenders).toEqual([]);
      });
    });
  }
});

describe("insiderInsights selectors", () => {
  it("maps risk bands to GAR suffixes", () => {
    expect(garFromRisk("low_risk")).toBe("GREEN");
    expect(garFromRisk("medium_risk")).toBe("AMBER");
    expect(garFromRisk("high_risk")).toBe("RED");
    expect(garFromRisk(undefined)).toBe("RED");
  });

  it("round-trips a pillar-state lookup from lower-snake keys", () => {
    const block = selectPillarState("A", "revenue_model", "AMBER");
    expect(block?.contentId).toBe(
      INSIDER_INSIGHTS_DATA.A.pillarStates.REVENUE_MODEL_AMBER.contentId,
    );
  });

  it("builds the directional-pair key from primary + secondary", () => {
    const block = selectDirectionalPair("B", "sales", "identity");
    expect(block).toBe(INSIDER_INSIGHTS_DATA.B.directionalPairs.SALES_IDENTITY);
    expect(block?.text).toBeTruthy();
  });

  it("selects a primary constraint and a core false constraint", () => {
    expect(selectPrimaryConstraint("C", "offer")?.whatIsReallyHappening).toBeTruthy();
    expect(selectFalseConstraint("D", "PRICE_TOO_HIGH")?.text).toBeTruthy();
  });
});
