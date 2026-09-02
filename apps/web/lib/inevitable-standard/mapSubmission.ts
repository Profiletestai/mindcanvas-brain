import {
  scoreInevitableStandard,
  type InevitableStandardAnswer,
  type InevitableStandardCommercialContext,
  type InevitableStandardScoreResult,
} from "./scoreInevitableStandard";
import {
  INEVITABLE_STANDARD_QUESTIONS,
  getInevitableStandardOptionValue,
  type InevitableStandardQuestionDefinition,
} from "./questions";

export type InevitableStandardStoredQuestion = {
  id: string;
  idx?: number | null;
};

/**
 * Normalized route input. choice_index is always zero-based, matching the
 * public client's `selected` value and the scoring engine contract.
 */
export type InevitableStandardSubmittedAnswer = {
  question_id: string;
  choice_index?: number | null;
  text?: string | null;
};

export type InevitableStandardMappedSubmission = {
  scoring_answers: InevitableStandardAnswer[];
  commercial_context: InevitableStandardCommercialContext;
  score: InevitableStandardScoreResult;
  issues: string[];
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function findSubmittedAnswer(
  answerByQuestionId: Map<string, InevitableStandardSubmittedAnswer>,
  storedQuestion: InevitableStandardStoredQuestion,
) {
  return answerByQuestionId.get(storedQuestion.id) ?? null;
}

function mapChoice(
  definition: InevitableStandardQuestionDefinition,
  answer: InevitableStandardSubmittedAnswer,
): { choiceIndex: number; value: string } | null {
  const choiceIndex = answer.choice_index;
  if (
    typeof choiceIndex !== "number" ||
    !Number.isInteger(choiceIndex) ||
    choiceIndex < 0 ||
    choiceIndex >= definition.options.length
  ) {
    return null;
  }

  const value = getInevitableStandardOptionValue(definition, choiceIndex);
  return value ? { choiceIndex, value } : null;
}

export function mapInevitableStandardSubmission(args: {
  questions: InevitableStandardStoredQuestion[];
  answers: InevitableStandardSubmittedAnswer[];
  currency?: string | null;
}): InevitableStandardMappedSubmission {
  const issues: string[] = [];
  const questionByOrder = new Map<number, InevitableStandardStoredQuestion>();
  const answerByQuestionId = new Map<
    string,
    InevitableStandardSubmittedAnswer
  >();

  for (const question of args.questions) {
    const order = question.idx;
    if (typeof order !== "number" || !Number.isInteger(order)) continue;
    if (questionByOrder.has(order)) issues.push(`duplicate_question_order_${order}`);
    questionByOrder.set(order, question);
  }

  for (const answer of args.answers) {
    if (!answer.question_id) {
      issues.push("missing_answer_question_id");
      continue;
    }
    if (answerByQuestionId.has(answer.question_id)) {
      issues.push(`duplicate_answer_${answer.question_id}`);
    }
    answerByQuestionId.set(answer.question_id, answer);
  }

  const scoringAnswers: InevitableStandardAnswer[] = [];
  const commercialContext: InevitableStandardCommercialContext = {
    currency: cleanText(args.currency),
  };

  for (const definition of INEVITABLE_STANDARD_QUESTIONS) {
    const storedQuestion = questionByOrder.get(definition.order);
    if (!storedQuestion) {
      issues.push(`missing_stored_question_${definition.key}`);
      continue;
    }

    const submitted = findSubmittedAnswer(answerByQuestionId, storedQuestion);
    if (!submitted) {
      issues.push(`missing_answer_${definition.key}`);
      continue;
    }

    if (definition.type === "text") {
      const text = cleanText(submitted.text);
      if (!text) {
        issues.push(`invalid_text_answer_${definition.key}`);
        continue;
      }
      if (definition.question_index !== null) {
        scoringAnswers.push({
          question_index: definition.question_index,
          text,
        });
      }
      continue;
    }

    const mappedChoice = mapChoice(definition, submitted);
    if (!mappedChoice) {
      issues.push(`invalid_choice_${definition.key}`);
      continue;
    }

    if (definition.commercial_context_key) {
      commercialContext[definition.commercial_context_key] =
        mappedChoice.value;
      continue;
    }

    if (definition.question_index !== null) {
      scoringAnswers.push({
        question_index: definition.question_index,
        choice_index: mappedChoice.choiceIndex,
        value: mappedChoice.value,
      });
    }
  }

  const score = scoreInevitableStandard({
    answers: scoringAnswers,
    commercial_context: commercialContext,
  });

  if (!score.scoring_complete) issues.push("incomplete_inevitable_standard_score");

  return {
    scoring_answers: scoringAnswers,
    commercial_context: commercialContext,
    score,
    issues: [...new Set(issues)],
  };
}