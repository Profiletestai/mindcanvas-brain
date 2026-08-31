import { describe, expect, it } from "vitest";

import { INEVITABLE_STANDARD_QUESTIONS } from "./questions";
import {
  mapInevitableStandardSubmission,
  type InevitableStandardStoredQuestion,
  type InevitableStandardSubmittedAnswer,
} from "./mapSubmission";

function storedQuestions(): InevitableStandardStoredQuestion[] {
  return INEVITABLE_STANDARD_QUESTIONS.map((question) => ({
    id: `id_${question.key}`,
    idx: question.order,
  }));
}

function completeAnswers(
  choiceIndex = 0,
): InevitableStandardSubmittedAnswer[] {
  return INEVITABLE_STANDARD_QUESTIONS.map((question) => {
    if (question.type === "text") {
      return {
        question_id: `id_${question.key}`,
        text: question.key === "q13" ? "  Sales consistency  " : "  Decide the offer  ",
      };
    }

    return {
      question_id: `id_${question.key}`,
      choice_index: Math.min(choiceIndex, question.options.length - 1),
    };
  });
}

describe("mapInevitableStandardSubmission", () => {
  it("maps a complete public submission into the scoring contract", () => {
    const mapped = mapInevitableStandardSubmission({
      questions: storedQuestions(),
      answers: completeAnswers(0),
      currency: "  AUD  ",
    });

    expect(mapped.issues).toEqual([]);
    expect(mapped.score.scoring_complete).toBe(true);
    expect(mapped.score.answered_scored_questions).toBe(24);
    expect(mapped.score.context_answers).toMatchObject({
      13: "Sales consistency",
      26: "predictable_revenue",
      27: "marketing_visibility_leads",
      28: "demand_not_predictable",
      29: "Decide the offer",
    });
    expect(mapped.commercial_context).toEqual({
      currency: "AUD",
      revenue_band: "under_100k",
      monthly_opportunity_band: "0_2",
      initial_customer_value_band: "under_1k",
    });
  });

  it("fails closed when a required commercial answer is missing", () => {
    const answers = completeAnswers().filter(
      (answer) => answer.question_id !== "id_c3",
    );
    const mapped = mapInevitableStandardSubmission({
      questions: storedQuestions(),
      answers,
    });

    expect(mapped.issues).toContain("missing_answer_c3");
    expect(mapped.commercial_context.initial_customer_value_band).toBeUndefined();
  });

  it("flags an out-of-range scored choice and produces an incomplete score", () => {
    const answers = completeAnswers();
    const q1 = answers.find((answer) => answer.question_id === "id_q01");
    if (!q1) throw new Error("Q1 fixture missing");
    q1.choice_index = 4;

    const mapped = mapInevitableStandardSubmission({
      questions: storedQuestions(),
      answers,
    });

    expect(mapped.issues).toEqual(
      expect.arrayContaining([
        "invalid_choice_q01",
        "incomplete_inevitable_standard_score",
      ]),
    );
    expect(mapped.score.scoring_complete).toBe(false);
    expect(mapped.score.answered_scored_questions).toBe(23);
  });

  it("detects duplicate stored orders and duplicate submitted answers", () => {
    const questions = storedQuestions();
    questions.push({ id: "duplicate_q1", idx: 1 });
    const answers = completeAnswers();
    answers.push({ question_id: "id_q01", choice_index: 1 });

    const mapped = mapInevitableStandardSubmission({ questions, answers });

    expect(mapped.issues).toEqual(
      expect.arrayContaining([
        "duplicate_question_order_1",
        "duplicate_answer_id_q01",
      ]),
    );
  });
});