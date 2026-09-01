import { describe, expect, it } from "vitest";

import {
  INEVITABLE_STANDARD_QUESTIONS,
  getInevitableStandardQuestion,
  getInevitableStandardOptionValue,
  toInevitableStandardDatabaseQuestions,
  validateInevitableStandardQuestionBank,
} from "./questions";
import { mapInevitableStandardSubmission } from "./mapSubmission";

describe("The Inevitable Standard approved question bank", () => {
  it("passes all structural integrity checks", () => {
    expect(validateInevitableStandardQuestionBank()).toEqual([]);
  });

  it("contains 29 diagnostic questions followed by three commercial fields", () => {
    expect(INEVITABLE_STANDARD_QUESTIONS).toHaveLength(32);
    expect(INEVITABLE_STANDARD_QUESTIONS.slice(0, 29).every(
      (question) => question.question_index !== null,
    )).toBe(true);
    expect(INEVITABLE_STANDARD_QUESTIONS.slice(29).map(
      (question) => question.key,
    )).toEqual(["c1", "c2", "c3"]);
  });

  it("locks the approved Q2, Q3, Q6 and Q12 revisions", () => {
    expect(getInevitableStandardQuestion("q02")?.text).toContain(
      "Two weeks have passed",
    );
    expect(getInevitableStandardQuestion("q03")?.options[2]?.text).toContain(
      "sequence of work",
    );
    expect(getInevitableStandardQuestion("q03")?.options[2]?.text).not.toContain(
      "journey",
    );
    expect(getInevitableStandardQuestion("q06")?.options[0]?.text).toContain(
      "assets I own personally",
    );
    expect(getInevitableStandardQuestion("q12")?.text).toContain(
      "a website rebuild",
    );
  });

  it("preserves stable context values separately from participant wording", () => {
    const q26 = getInevitableStandardQuestion("q26");
    expect(q26).not.toBeNull();
    expect(getInevitableStandardOptionValue(q26!, 3)).toBe(
      "personal_wealth_choice_freedom",
    );

    const c1 = getInevitableStandardQuestion("c1");
    expect(c1).not.toBeNull();
    expect(getInevitableStandardOptionValue(c1!, 7)).toBe("10m_plus");
  });

  it("produces rows compatible with the live questions API", () => {
    const rows = toInevitableStandardDatabaseQuestions();
    expect(rows).toHaveLength(32);
    expect(rows[0]).toMatchObject({
      idx: 1,
      order: 1,
      type: "single_choice",
      category: "scored",
    });
    expect(rows[0]?.options).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    expect(rows[12]).toMatchObject({
      idx: 13,
      type: "text",
      options: [],
      category: "context",
    });
    expect(rows[29]?.weights).toMatchObject({
      inevitable_standard_key: "c1",
      commercial_context_key: "revenue_band",
      question_bank_version: "inevitable_standard_questions_v0_4",
    });
  });

  it("seeds a test that a public submission can score with zero issues", () => {
    // Mirrors what /api/admin/inevitable-standard/seed writes to
    // portal.test_questions and what /submit then reads back.
    const rows = toInevitableStandardDatabaseQuestions();

    const storedQuestions = rows.map((row) => ({
      id: `seeded_${row.idx}`,
      idx: row.idx,
    }));

    const answers = rows.map((row) =>
      row.type === "text"
        ? { question_id: `seeded_${row.idx}`, text: "placeholder answer" }
        : { question_id: `seeded_${row.idx}`, choice_index: 0 },
    );

    const mapped = mapInevitableStandardSubmission({
      questions: storedQuestions,
      answers,
      currency: "AUD",
    });

    expect(mapped.issues).toEqual([]);
    expect(mapped.score.scoring_complete).toBe(true);
    expect(mapped.score.answered_scored_questions).toBe(24);
  });
});