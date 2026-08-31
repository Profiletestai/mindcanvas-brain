import {
  INEVITABLE_STANDARD_COMMERCIAL_CONTEXT_KEYS,
  INEVITABLE_STANDARD_CONTEXT_QUESTION_INDICES,
  INEVITABLE_STANDARD_EXPECTED_COUNTS,
  INEVITABLE_STANDARD_MODEL_VERSION,
  INEVITABLE_STANDARD_SCORING_RULES,
  INEVITABLE_STANDARD_SCORING_VERSION,
  type InevitableStandardCommercialContextKey,
} from "./definition";

export const INEVITABLE_STANDARD_QUESTION_BANK_VERSION =
  "inevitable_standard_questions_v0_4" as const;

export const INEVITABLE_STANDARD_TEST = {
  name: "The Inevitable Standard Diagnostic",
  slug: "inevitable-standard",
  type: "inevitable_standard",
  description:
    "A commercial diagnostic for founders across six pillars of business readiness.",
  instruction:
    "Choose the answer that is closest to what would most naturally happen in your business today, not the answer you think should happen.",
  model_version: INEVITABLE_STANDARD_MODEL_VERSION,
  scoring_version: INEVITABLE_STANDARD_SCORING_VERSION,
  question_bank_version: INEVITABLE_STANDARD_QUESTION_BANK_VERSION,
} as const;

export type InevitableStandardQuestionCategory =
  | "scored"
  | "context"
  | "commercial_context";

export type InevitableStandardQuestionType = "single_choice" | "text";

export type InevitableStandardQuestionOption = {
  value: string;
  text: string;
};

export type InevitableStandardQuestionDefinition = {
  key: string;
  /** Display and database order across the full 32-field experience. */
  order: number;
  /** Q1-Q29 index. Null for the post-Q29 C1-C3 fields. */
  question_index: number | null;
  commercial_context_key?: InevitableStandardCommercialContextKey;
  category: InevitableStandardQuestionCategory;
  type: InevitableStandardQuestionType;
  required: true;
  text: string;
  options: readonly InevitableStandardQuestionOption[];
};

function option(value: string, text: string): InevitableStandardQuestionOption {
  return { value, text };
}

const numberedOptions = (...texts: string[]) =>
  texts.map((text, index) => option(String(index + 1), text));

export const INEVITABLE_STANDARD_QUESTIONS: readonly InevitableStandardQuestionDefinition[] = [
  {
    key: "q01",
    order: 1,
    question_index: 1,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Your business is attracting interest from several different types of customer, but only some become strong, profitable relationships. What are you most likely to do next?",
    options: numberedOptions(
      "Explore whether the wider interest points to a bigger market opportunity and adjust the message to leave room for it.",
      "Talk with the customers who get the most value and sharpen the message around what they say mattered most.",
      "Watch which types of demand keep appearing over the next few cycles before narrowing the message too far.",
      "Compare fit, conversion, profitability and outcomes, then focus the message on the pattern that performs best.",
    ),
  },
  {
    key: "q02",
    order: 2,
    question_index: 2,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A promising conversation ended well. No decision was made and no date was set. Two weeks have passed. What is most likely to have happened?",
    options: numberedOptions(
      "There is a defined follow-up sequence and they have already been contacted at the point it specifies.",
      "I have followed up once, and I know what the next contact is and roughly when.",
      "I have been meaning to follow up and will get to it when the week allows.",
      "I have left it with them, because chasing feels like pressure and they know how to reach me.",
    ),
  },
  {
    key: "q03",
    order: 3,
    question_index: 3,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A valuable customer asks for something that sits outside what they originally agreed to buy. What are you most likely to do?",
    options: numberedOptions(
      "Look at whether the request reveals a bigger outcome or a stronger version of the offer worth creating.",
      "Talk it through with them and adapt the solution where it improves the relationship and the result.",
      "Check where they are in the sequence of work and either include it at the right point or make it a clear next step.",
      "Rebuild the scope and price around the request so every requirement is fully accounted for before proceeding.",
    ),
  },
  {
    key: "q04",
    order: 4,
    question_index: 4,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A strong-fit buyer wants to move forward but asks whether you can reduce the price. What are you most likely to do?",
    options: numberedOptions(
      "Keep the value and price intact, but change scope, timing or payment structure if that solves the real issue.",
      "Explain the value and why the price is set where it is, then hold the figure.",
      "Keep the price but add something small that makes the decision easier.",
      "Make a modest adjustment if it protects a valuable long-term opportunity.",
    ),
  },
  {
    key: "q05",
    order: 5,
    question_index: 5,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A significant opportunity appears unexpectedly and you have only a few days to decide whether to pursue it. What are you most likely to do?",
    options: numberedOptions(
      "Judge whether the opportunity matters enough for where the business is going, then commit if the upside justifies the stretch.",
      "Speak to the people most affected, get the essential input, then make the decision and communicate it clearly.",
      "Keep the opportunity open while I see whether current commitments ease enough to make the timing feel right.",
      "Build the case, test the assumptions and risks, and decide once the evidence feels sufficiently complete.",
    ),
  },
  {
    key: "q06",
    order: 6,
    question_index: 6,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "The business has a stronger-than-usual month. After tax and immediate obligations are covered, what is most likely to happen to the remaining cash?",
    options: numberedOptions(
      "A set amount moves out to me or into assets I own personally, on a schedule that does not depend on how the month went.",
      "It follows a pre-agreed allocation across reserves, reinvestment and money that moves to the owner.",
      "The business keeps what it needs, then I decide what to take from the balance.",
      "Most goes back into the business, into growth or into future needs.",
    ),
  },
  {
    key: "q07",
    order: 7,
    question_index: 7,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "You are given a much bigger platform than usual to represent the business and its point of view. What are you most likely to do?",
    options: numberedOptions(
      "Use the opportunity to state a clear point of view and claim the position I want the business to be known for.",
      "Shape the message around what will be most useful and relevant to the audience.",
      "Keep the message grounded in what I know is working now and avoid making claims that feel ahead of the business.",
      "Strengthen the evidence, examples and proof first so I can be certain every claim will stand up to scrutiny.",
    ),
  },
  {
    key: "q08",
    order: 8,
    question_index: 8,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Someone who could become a customer asks, 'So what does your business actually help people do?' Which response is closest to how you would answer?",
    options: numberedOptions(
      "I name the type of customer, the problem we solve and the result we help them reach.",
      "I explain our main offer and who it is designed for, then give a quick example.",
      "I describe the different ways we can help and emphasise the parts most relevant to them.",
      "I keep the explanation broad because the business can solve several different problems depending on the customer.",
    ),
  },
  {
    key: "q09",
    order: 9,
    question_index: 9,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A potential customer says, 'I like this, but I am not sure now is the right time.' What are you most likely to do next?",
    options: numberedOptions(
      "Reconnect them to the result they said they wanted, explore what waiting changes, and help them reach a clear decision.",
      "Reduce the pressure, keep the relationship positive and give them space to come back when they feel ready.",
      "Ask what would need to change for the timing to feel right and agree when it makes sense to revisit.",
      "Ask what specifically is uncertain, separate the real issue from the general hesitation, and deal with that point.",
    ),
  },
  {
    key: "q10",
    order: 10,
    question_index: 10,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A customer has just achieved a good result from your core offer. What is most likely to happen next?",
    options: numberedOptions(
      "There is already a defined next step or deeper offer, and we discuss whether it is relevant before the current stage finishes.",
      "I review what they have achieved and recommend from a small number of clear next options.",
      "I keep the relationship active and reconnect when another need naturally appears.",
      "If they want more help, I build the next piece around whatever they need at that point.",
    ),
  },
  {
    key: "q11",
    order: 11,
    question_index: 11,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "The business is growing, but too many important things still depend on you personally. What are you most likely to change first?",
    options: numberedOptions(
      "Build new capacity around where the business is heading so I can move into higher-value work faster.",
      "Keep personal ownership of the key customer relationships and delegate the work around them.",
      "Transfer repeatable responsibilities at natural handover points so the business changes without disrupting delivery.",
      "Document the critical work, assign clear ownership and track whether it can run reliably without me.",
    ),
  },
  {
    key: "q12",
    order: 12,
    question_index: 12,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "You have four worthwhile pieces of work open at once: a set of sales conversations you have not started, a website rebuild, a new offer to finish designing, and a proposal waiting to be sent. What usually gets your attention?",
    options: numberedOptions(
      "The two that put me in front of a buyer, the conversations and the proposal, before anything else moves.",
      "The proposal, because it is nearly done, then the conversations once that is clear.",
      "Whichever I have most energy for that week, which is usually the building work.",
      "The website and the offer, because I want those right before I put myself in front of anyone.",
    ),
  },
  {
    key: "q13",
    order: 13,
    question_index: 13,
    category: "context",
    type: "text",
    required: true,
    text: "In one or two sentences, what feels like the biggest thing holding your business back right now?",
    options: [],
  },
  {
    key: "q14",
    order: 14,
    question_index: 14,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Customers can choose from several businesses that appear to offer something similar to yours. What are you most likely to strengthen?",
    options: numberedOptions(
      "A bolder, more specific position around the outcome or future the business is uniquely trying to create.",
      "The trust, experience and relationships that make people feel confident choosing us.",
      "The message that is most relevant to what customers need in the market right now.",
      "The detail, proof and comparison points that show exactly how our approach differs from other options.",
    ),
  },
  {
    key: "q15",
    order: 15,
    question_index: 15,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "You have enough information to know that your offer is a strong fit for a potential customer. What are you most likely to do next?",
    options: numberedOptions(
      "Make a clear recommendation, explain why it fits and ask whether they want to move forward.",
      "Summarise what I have heard, show the option I think fits best and ask how it lands with them.",
      "Explain the best option and give them space to come back once they have had time to consider it.",
      "Send the relevant options and information afterwards so they can compare them without pressure.",
    ),
  },
  {
    key: "q16",
    order: 16,
    question_index: 16,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Your main offer is attracting interest but fewer people are choosing it than you expected. What are you most likely to do first?",
    options: numberedOptions(
      "Strengthen the future outcome or reposition the offer around a more ambitious result.",
      "Talk to customers and prospects to understand what feels missing, unclear or hard to buy.",
      "Give it more time in the market and avoid changing too much until the pattern is more settled.",
      "Identify where the buying decision is breaking, then change the smallest part of the offer that addresses that evidence.",
    ),
  },
  {
    key: "q17",
    order: 17,
    question_index: 17,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "You make a clear commercial offer to someone you expected to say yes, and they decline. What is most likely to happen next?",
    options: numberedOptions(
      "I take any useful evidence from the decision, keep my commercial position and continue making the offer to the right people.",
      "I try to understand what influenced the decision and only change something if the same pattern appears again.",
      "I strengthen the proof, examples or explanation before putting the offer in front of more people.",
      "I reconsider whether the price, position or offer may be too ambitious before I push it further.",
    ),
  },
  {
    key: "q18",
    order: 18,
    question_index: 18,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A good customer reaches the end of what they originally bought from you. What is most likely to happen?",
    options: numberedOptions(
      "Their next logical purchase, renewal or progression is already clear and we raise it before the current stage finishes.",
      "We review what they need next and recommend from a defined set of ways to continue.",
      "We stay in touch and wait for the next need or buying moment to emerge naturally.",
      "Most of our focus moves back to acquiring new customers, because the original outcome has been delivered.",
    ),
  },
  {
    key: "q19",
    order: 19,
    question_index: 19,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "An unexpected problem disrupts a week that already had important growth activity planned. What are you most likely to do?",
    options: numberedOptions(
      "Protect the activity with the biggest upside and let the rest move while I solve the problem.",
      "Respond to the people who need me most first, then return to the commercial work once everyone is supported.",
      "Reschedule the essential growth activity into specific times that week so the rhythm continues despite the disruption.",
      "Re-plan the week around the new facts, protect the highest-value actions and remove anything that no longer matters.",
    ),
  },
  {
    key: "q20",
    order: 20,
    question_index: 20,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Someone who should be an ideal customer discovers the business but comes away with a very different idea of what you actually do. What are you most likely to examine?",
    options: numberedOptions(
      "Whether our core message makes the problem, customer and outcome specific enough to be repeated accurately by other people.",
      "Whether our examples and proof are showing the right use cases clearly enough.",
      "Whether the channel or touchpoint they came through needs a clearer explanation.",
      "Whether we should keep the message broader and rely on the first conversation to clarify fit.",
    ),
  },
  {
    key: "q21",
    order: 21,
    question_index: 21,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A potential customer asks you to explain your solution before they have told you much about what is happening for them. What are you most likely to do?",
    options: numberedOptions(
      "Paint the picture of what becomes possible with the solution so they can see the opportunity before we get into the detail.",
      "Turn the conversation back to them, ask what they are trying to change and listen until the real need is clear.",
      "Ask enough about their current situation and timing to understand what would be useful before explaining the relevant parts.",
      "Work through a structured set of questions so I can diagnose the situation thoroughly before recommending anything.",
    ),
  },
  {
    key: "q22",
    order: 22,
    question_index: 22,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Two customers want the same core result, but one needs substantially more support or complexity. How is the commercial difference most likely to be handled?",
    options: numberedOptions(
      "They move into different defined levels or scopes, with a clear reason for the price difference.",
      "There is a standard core price, with transparent additions for extra support or complexity.",
      "I build the solution around each customer and price it based on the work I expect it to require.",
      "I use judgement across the relationship, budget, potential value and complexity to arrive at a fair figure.",
    ),
  },
  {
    key: "q23",
    order: 23,
    question_index: 23,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "Revenue is rising, but profit is not improving at the same pace. Where does your attention go first?",
    options: numberedOptions(
      "Look for a higher-value version of what already works so growth creates more room rather than more volume.",
      "Review where long-standing customer arrangements, discounts or added value are no longer commercially balanced, and reset them clearly.",
      "Make gradual changes to cost, capacity and pricing over the next few cycles so delivery is not destabilised.",
      "Analyse the full cost base, margins and performance data before deciding which part of the model should change.",
    ),
  },
  {
    key: "q24",
    order: 24,
    question_index: 24,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "A potential customer is clearly interested and appears to be a strong fit. The conversation reaches the point where a decision could be made. What are you most likely to do?",
    options: numberedOptions(
      "Reinforce the bigger result they could create and leave them with the opportunity to decide when they are ready.",
      "Check how they are feeling about it, answer any concerns and invite them to let me know what they want to do.",
      "Ask whether the timing is right to move forward and, if not, agree when a decision should be revisited.",
      "Make the recommendation clearly, ask for the decision and deal directly with anything that still prevents a yes or no.",
    ),
  },
  {
    key: "q25",
    order: 25,
    question_index: 25,
    category: "scored",
    type: "single_choice",
    required: true,
    text: "You have chosen a strategic direction and started implementing it. A new idea appears that could also be valuable. What are you most likely to do?",
    options: numberedOptions(
      "Capture the idea and keep the current direction intact until the review point I already set.",
      "Run a small test of the new idea without changing the main plan.",
      "Re-open the comparison if the new idea appears to have stronger upside than the path I chose.",
      "Shift attention quickly while the opportunity is fresh, then decide which direction deserves the bigger commitment.",
    ),
  },
  {
    key: "q26",
    order: 26,
    question_index: 26,
    category: "context",
    type: "single_choice",
    required: true,
    text: "If the next 12 months went exceptionally well, which change would matter most to you?",
    options: [
      option("predictable_revenue", "Revenue becomes much more predictable and the right customers arrive more consistently."),
      option("greater_profit_owner_reward", "More of the revenue we already create becomes profit and rewards me more properly."),
      option("reduced_founder_dependency", "The business can perform and grow without needing me in the middle of so much of it."),
      option("personal_wealth_choice_freedom", "The business creates more personal wealth, choice and freedom outside the business itself."),
      option("scale_without_weakening", "We can grow into a bigger opportunity without weakening the quality or stability we already have."),
    ],
  },
  {
    key: "q27",
    order: 27,
    question_index: 27,
    category: "context",
    type: "single_choice",
    required: true,
    text: "Where have you put the most time, money or attention into improving the business recently?",
    options: [
      option("marketing_visibility_leads", "Marketing, visibility, content or generating more leads."),
      option("positioning_pricing_offer", "Positioning, pricing, refining the offer or changing what we sell."),
      option("sales_conversion_follow_up", "Sales conversations, conversion, offers or follow-up."),
      option("team_systems_delivery", "Team, systems, delivery or making the business run better."),
      option("profitability_recurring_revenue_retention", "Profitability, recurring revenue, retention or what the business actually keeps."),
      option("strategy_priorities_direction", "Strategy, priorities, direction or deciding what to focus on next."),
    ],
  },
  {
    key: "q28",
    order: 28,
    question_index: 28,
    category: "context",
    type: "single_choice",
    required: true,
    text: "Which statement feels closest to the business today?",
    options: [
      option("demand_not_predictable", "We can create demand, but it is not yet predictable enough."),
      option("revenue_not_profit_or_owner_value", "We earn revenue, but not enough of it becomes profit or meaningful value for me."),
      option("founder_dependency", "The business works, but too much of what makes it work still depends on me."),
      option("too_many_open_priorities", "There are good opportunities, but too many priorities or important decisions stay open."),
      option("market_clarity_or_choice", "We do valuable work, but the market does not understand or choose us as quickly as it should."),
      option("scale_without_weakening", "The foundations are strong; the challenge is growing without weakening what already works."),
    ],
  },
  {
    key: "q29",
    order: 29,
    question_index: 29,
    category: "context",
    type: "text",
    required: true,
    text: "What is one business decision you know you probably need to make, but have not made yet?",
    options: [],
  },
  {
    key: "c1",
    order: 30,
    question_index: null,
    commercial_context_key: "revenue_band",
    category: "commercial_context",
    type: "single_choice",
    required: true,
    text: "Which range is closest to your business revenue over the last 12 months?",
    options: [
      option("under_100k", "Under 100k - Early traction or a smaller specialist business. A small number of wins can still move the annual number materially."),
      option("100k_250k", "100k-250k - Established demand, with consistency often still concentrated around a smaller number of customers, offers or the founder."),
      option("250k_500k", "250k-500k - Proven revenue with enough commercial activity for structural strengths and gaps to show up clearly."),
      option("500k_1m", "500k-1m - An established operating business where margin, conversion, retention and founder dependency can materially change what the owner keeps."),
      option("1m_2m", "1m-2m - A mature growth business where relatively small structural improvements can create meaningful absolute value."),
      option("2m_5m", "2m-5m - A scaled business with more commercial complexity, team leverage and a larger absolute cost of inconsistency."),
      option("5m_10m", "5m-10m - A larger established business where repeatability, margin, ownership and decision quality increasingly drive value."),
      option("10m_plus", "10m+ - A significant operating business. The diagnostic remains useful strategically, while the financial estimate should be validated against actual management accounts."),
    ],
  },
  {
    key: "c2",
    order: 31,
    question_index: null,
    commercial_context_key: "monthly_opportunity_band",
    category: "commercial_context",
    type: "single_choice",
    required: true,
    text: "In a typical month, how many new buying opportunities reach a meaningful point where a customer could realistically choose to buy?",
    options: [
      option("0_2", "0-2 - Low-volume model, early demand, or a business built around a small number of high-value opportunities."),
      option("3_5", "3-5 - A small but regular flow of meaningful buying opportunities."),
      option("6_10", "6-10 - A consistent flow with enough volume for patterns in conversion to become visible."),
      option("11_20", "11-20 - An active buying flow where conversion consistency starts to compound."),
      option("21_50", "21-50 - High opportunity volume, where small changes in conversion can have a meaningful annual effect."),
      option("51_plus", "51+ - High-volume model. Use this mainly as commercial context rather than assuming one-to-one sales conversations."),
    ],
  },
  {
    key: "c3",
    order: 32,
    question_index: null,
    commercial_context_key: "initial_customer_value_band",
    category: "commercial_context",
    type: "single_choice",
    required: true,
    text: "What is the typical value of a new customer, account, order or sale when they first buy?",
    options: [
      option("under_1k", "Under 1k - Lower-value or higher-volume purchase."),
      option("1k_5k", "1k-5k - Accessible core purchase or smaller commercial engagement."),
      option("5k_15k", "5k-15k - Mid-value purchase, account or engagement."),
      option("15k_50k", "15k-50k - Higher-value purchase or meaningful commercial engagement."),
      option("50k_100k", "50k-100k - Major customer, contract or account value."),
      option("100k_plus", "100k+ - Enterprise, large-account or high-value commercial model."),
    ],
  },
];

export function getInevitableStandardQuestion(
  key: string,
): InevitableStandardQuestionDefinition | null {
  return (
    INEVITABLE_STANDARD_QUESTIONS.find((question) => question.key === key) ??
    null
  );
}

export function getInevitableStandardQuestionByOrder(
  order: number,
): InevitableStandardQuestionDefinition | null {
  return (
    INEVITABLE_STANDARD_QUESTIONS.find(
      (question) => question.order === order,
    ) ?? null
  );
}

export function getInevitableStandardOptionValue(
  question: InevitableStandardQuestionDefinition,
  choiceIndex: number,
): string | null {
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) return null;
  return question.options[choiceIndex]?.value ?? null;
}

export function toInevitableStandardDatabaseQuestions() {
  return INEVITABLE_STANDARD_QUESTIONS.map((question) => ({
    idx: question.order,
    order: question.order,
    type: question.type,
    text: question.text,
    options: question.options.map((item) => item.text),
    category: question.category,
    weights: {
      inevitable_standard_key: question.key,
      question_index: question.question_index,
      commercial_context_key: question.commercial_context_key ?? null,
      option_values: question.options.map((item) => item.value),
      question_bank_version: INEVITABLE_STANDARD_QUESTION_BANK_VERSION,
    },
    profile_map: [],
  }));
}

export function validateInevitableStandardQuestionBank(): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  const orders = new Set<number>();
  const diagnosticIndices = new Set<number>();

  for (const question of INEVITABLE_STANDARD_QUESTIONS) {
    if (keys.has(question.key)) issues.push(`Duplicate key ${question.key}.`);
    if (orders.has(question.order)) {
      issues.push(`Duplicate order ${question.order}.`);
    }
    keys.add(question.key);
    orders.add(question.order);

    if (question.question_index !== null) {
      if (diagnosticIndices.has(question.question_index)) {
        issues.push(`Duplicate diagnostic Q${question.question_index}.`);
      }
      diagnosticIndices.add(question.question_index);
    }

    if (question.type === "text" && question.options.length !== 0) {
      issues.push(`${question.key} text questions cannot contain options.`);
    }
    if (question.type === "single_choice" && question.options.length === 0) {
      issues.push(`${question.key} must contain answer options.`);
    }
    if (new Set(question.options.map((item) => item.value)).size !== question.options.length) {
      issues.push(`${question.key} contains duplicate option values.`);
    }
  }

  const expectedOrders = Array.from({ length: 32 }, (_value, index) => index + 1);
  if (expectedOrders.some((order) => !orders.has(order))) {
    issues.push("Question orders must be contiguous from 1 to 32.");
  }

  if (diagnosticIndices.size !== INEVITABLE_STANDARD_EXPECTED_COUNTS.diagnostic_questions) {
    issues.push("The bank must contain exactly 29 diagnostic questions.");
  }

  const scored = INEVITABLE_STANDARD_QUESTIONS.filter(
    (question) => question.category === "scored",
  );
  const context = INEVITABLE_STANDARD_QUESTIONS.filter(
    (question) => question.category === "context",
  );
  const commercial = INEVITABLE_STANDARD_QUESTIONS.filter(
    (question) => question.category === "commercial_context",
  );

  if (scored.length !== INEVITABLE_STANDARD_EXPECTED_COUNTS.scored_questions) {
    issues.push("The bank must contain exactly 24 scored questions.");
  }
  if (context.length !== INEVITABLE_STANDARD_EXPECTED_COUNTS.context_questions) {
    issues.push("The bank must contain exactly five contextual questions.");
  }
  if (
    commercial.length !==
    INEVITABLE_STANDARD_EXPECTED_COUNTS.commercial_context_fields
  ) {
    issues.push("The bank must contain exactly three commercial context fields.");
  }

  const scoredIndices = scored
    .map((question) => question.question_index)
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);
  const ruleIndices = INEVITABLE_STANDARD_SCORING_RULES.map(
    (rule) => rule.question_index,
  ).sort((a, b) => a - b);

  if (JSON.stringify(scoredIndices) !== JSON.stringify(ruleIndices)) {
    issues.push("Scored question indices do not match the scoring authority.");
  }

  const contextIndices = context
    .map((question) => question.question_index)
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);
  const expectedContextIndices = [...INEVITABLE_STANDARD_CONTEXT_QUESTION_INDICES].sort(
    (a, b) => a - b,
  );
  if (JSON.stringify(contextIndices) !== JSON.stringify(expectedContextIndices)) {
    issues.push("Context question indices do not match the approved model.");
  }

  const commercialKeys = commercial.map(
    (question) => question.commercial_context_key,
  );
  for (const key of INEVITABLE_STANDARD_COMMERCIAL_CONTEXT_KEYS) {
    if (!commercialKeys.includes(key)) {
      issues.push(`Missing commercial context field ${key}.`);
    }
  }

  for (const question of scored) {
    if (question.options.length !== 4) {
      issues.push(`${question.key} must contain exactly four scored options.`);
    }
  }

  const q13 = getInevitableStandardQuestion("q13");
  const q29 = getInevitableStandardQuestion("q29");
  if (q13?.type !== "text" || q29?.type !== "text") {
    issues.push("Q13 and Q29 must remain text questions.");
  }

  return issues;
}