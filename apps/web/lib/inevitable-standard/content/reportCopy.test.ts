import { describe, expect, it } from "vitest";

import { INEVITABLE_STANDARD_PILLARS } from "../definition";
import {
  INEVITABLE_STANDARD_CONTENT_BANDS,
  INEVITABLE_STANDARD_CONTENT_SECTIONS,
  INEVITABLE_STANDARD_REPORT_CONTENT,
  getInevitableStandardContentEntry,
  getInevitableStandardPillarBandContent,
} from "./reportCopy";

const SECTION_SET = new Set<string>(INEVITABLE_STANDARD_CONTENT_SECTIONS);
const BAND_SET = new Set<string>(INEVITABLE_STANDARD_CONTENT_BANDS);

describe("The Inevitable Standard report copy content layer", () => {
  it("records the source document it is drawn from", () => {
    expect(INEVITABLE_STANDARD_REPORT_CONTENT.source_version).toBe(
      "The Inevitable Standard - Knowledge Base v1, 6 August 2026",
    );
    expect(INEVITABLE_STANDARD_REPORT_CONTENT.authoring_standard).toMatch(
      /direct-quote-or-labeled-application/,
    );
  });

  it("covers every pillar", () => {
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      expect(INEVITABLE_STANDARD_REPORT_CONTENT.pillars[pillar]).toBeDefined();
    }
  });

  it("only uses known band and section keys", () => {
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      const { bands } = INEVITABLE_STANDARD_REPORT_CONTENT.pillars[pillar];
      for (const [band, sections] of Object.entries(bands)) {
        expect(BAND_SET.has(band)).toBe(true);
        for (const section of Object.keys(sections ?? {})) {
          expect(SECTION_SET.has(section)).toBe(true);
        }
      }
    }
  });

  it("every entry has non-empty, trimmed copy and a valid provenance", () => {
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      const { bands } = INEVITABLE_STANDARD_REPORT_CONTENT.pillars[pillar];
      for (const sections of Object.values(bands)) {
        for (const entry of Object.values(sections ?? {})) {
          expect(entry.text.length).toBeGreaterThan(0);
          expect(entry.text).toBe(entry.text.trim());
          expect(["direct", "applied"]).toContain(entry.provenance);
        }
      }
    }
  });

  it("keeps source-document references out of rendered text", () => {
    // `text` is customer-facing prose only. Citations, chapter references and
    // meta-commentary about the source belong in `note`.
    const banned: RegExp[] = [
      /\bthe book\b/i,
      /\bthe source\b/i,
      /knowledge base/i,
      /\(ch\.?\s?\d/i,
      /\bch\.?\s?\d+\b/i,
      /\bchapter\s+\d/i,
    ];
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      const { bands } = INEVITABLE_STANDARD_REPORT_CONTENT.pillars[pillar];
      for (const [band, sections] of Object.entries(bands)) {
        for (const [section, entry] of Object.entries(sections ?? {})) {
          for (const pattern of banned) {
            expect(
              entry.text,
              `${pillar}/${band}/${section} contains a source reference: ${pattern}`,
            ).not.toMatch(pattern);
          }
        }
      }
    }
  });

  it("keeps Positioning provisional with only the three sourced sections", () => {
    const positioning = INEVITABLE_STANDARD_REPORT_CONTENT.pillars.positioning;
    expect(positioning.status).toBe("provisional");
    expect(positioning.note).toBeTruthy();
    expect(Object.keys(positioning.bands.amber ?? {}).sort()).toEqual(
      ["focus_now", "what_this_means", "where_leaking"].sort(),
    );
  });

  it("marks the other five pillars complete", () => {
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      if (pillar === "positioning") continue;
      expect(INEVITABLE_STANDARD_REPORT_CONTENT.pillars[pillar].status).toBe(
        "complete",
      );
    }
  });

  it("has no Red-band content for any pillar (report keeps its current fallback sentence)", () => {
    // Regression guard: the Diagnostic Snapshot falls back to PILLAR_CONSTRAINT_COPY
    // whenever the content layer has no entry for the primary-constraint pillar's
    // band. Most primary constraints are Red, so Red must stay empty here.
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      expect(getInevitableStandardPillarBandContent(pillar, "red")).toEqual({});
    }
  });

  it("has Green-band content only for identity", () => {
    for (const pillar of INEVITABLE_STANDARD_PILLARS) {
      const green = getInevitableStandardPillarBandContent(pillar, "green");
      if (pillar === "identity") {
        expect(Object.keys(green).length).toBeGreaterThan(0);
      } else {
        expect(green).toEqual({});
      }
    }
  });

  it("returns an empty object / null for bands and sections with no content", () => {
    expect(getInevitableStandardPillarBandContent("offer", "red")).toEqual({});
    expect(
      getInevitableStandardContentEntry("positioning", "amber", "progress_looks_like"),
    ).toBeNull();
    expect(
      getInevitableStandardContentEntry("identity", "amber", "what_this_means")?.text,
    ).toMatch(/People rarely fail to convert/);
  });
});
