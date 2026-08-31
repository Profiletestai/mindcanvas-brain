import {
  INEVITABLE_STANDARD_CONSTRAINT_VERSION,
  INEVITABLE_STANDARD_PILLARS,
  type InevitableStandardPillar,
} from "./definition";
import type { InevitableStandardScoreResult } from "./scoreInevitableStandard";

/**
 * Constraint Engine for The Inevitable Standard Diagnostic.
 *
 * Implements docs/inevitable-standard-spec.md section 3:
 *  - Primary Constraint   - the highest-leverage issue now (lowest pillar, with
 *    an Identity/Decision override).
 *  - Secondary Constraint - the next-lowest pillar, the reinforcing issue.
 *  - False Constraint     - what the founder's Q13/Q29 free text says the
 *    problem is, versus what the evidence shows.
 *  - Priority Fix Order   - the constrained pillars sequenced by Method layer
 *    (Identity -> Structure -> Execution).
 *  - Confidence           - High / Medium / Directional.
 *
 * This is a pure function: it reads only the scored pillar percentages and the
 * two free-text answers, performs no IO, and makes no model calls.
 */

/* -------------------------------------------------------------------------- */
/* Tunable thresholds - documented constants, easy to calibrate later.         */
/* -------------------------------------------------------------------------- */

/**
 * An Identity or Decision pillar at or below this percentage is "materially
 * low" and becomes eligible to override a numerically-lower pillar as the
 * primary constraint. The spec notes a weak Identity/Decision pillar suppresses
 * the value of otherwise-strong pillars even when it is not the lowest score.
 */
export const IDENTITY_DECISION_OVERRIDE_MAX_PCT = 40;

/**
 * The override only applies when the Identity/Decision pillar is within this
 * many points of the numerically-lowest pillar - i.e. the lowest pillar is only
 * "slightly lower". A wider gap means the lowest pillar is clearly the real
 * primary constraint and should stand.
 */
export const IDENTITY_DECISION_OVERRIDE_PROXIMITY_PCT = 10;

/**
 * Minimum gap between the primary and secondary constraint percentages for the
 * primary to count as "clearly separated" when grading confidence.
 */
export const CONFIDENCE_CLEAR_PRIMARY_GAP_PCT = 12;

/**
 * If the spread between the strongest and weakest pillar is below this, the
 * profile is "flat / blended" and confidence is capped at Directional.
 */
export const CONFIDENCE_FLAT_SPREAD_PCT = 15;

/* -------------------------------------------------------------------------- */
/* Method layers - spec section 3: Identity -> Structure -> Execution.         */
/* -------------------------------------------------------------------------- */

export type InevitableStandardMethodLayer =
  | "identity"
  | "structure"
  | "execution";

export const INEVITABLE_STANDARD_METHOD_LAYERS: readonly {
  layer: InevitableStandardMethodLayer;
  pillars: readonly InevitableStandardPillar[];
}[] = [
  { layer: "identity", pillars: ["identity"] },
  { layer: "structure", pillars: ["positioning", "offer", "revenue_model"] },
  { layer: "execution", pillars: ["sales", "decision"] },
];

/** Pillars that can be promoted over a numerically-lower pillar, in priority order. */
const OVERRIDE_PILLARS: readonly InevitableStandardPillar[] = [
  "identity",
  "decision",
];

const PILLAR_LABELS: Record<InevitableStandardPillar, string> = {
  identity: "Identity",
  positioning: "Positioning",
  offer: "Offer",
  sales: "Sales",
  revenue_model: "Revenue Model",
  decision: "Decision",
};

/* -------------------------------------------------------------------------- */
/* False-constraint keyword table.                                             */
/* -------------------------------------------------------------------------- */

export type InevitableStandardFalseConstraintRule = {
  id: string;
  /** Lowercase substrings matched against the combined Q13 + Q29 text. */
  keywords: readonly string[];
  /** The pillar the founder's language implies they blame. */
  stated_pillar: InevitableStandardPillar;
  /** The pillar the evidence typically points to instead (spec section 9.3). */
  evidence_pillar: InevitableStandardPillar;
  /** Report-facing copy used when the stated pillar is not the real primary. */
  explanation: string;
};

/**
 * v1 deterministic keyword matching, seeded from the four worked examples in
 * the Framework doc section 9.3. Matching is case-insensitive substring.
 *
 * This is a clean seam: a later version can swap `matchFalseConstraintRule` for
 * an LLM classification pass without changing the engine's contract. Extend the
 * table by adding rules here.
 */
export const INEVITABLE_STANDARD_FALSE_CONSTRAINT_RULES: readonly InevitableStandardFalseConstraintRule[] =
  [
    {
      id: "lead_volume",
      keywords: [
        "need more leads",
        "not enough leads",
        "more leads",
        "lead volume",
        "not enough enquiries",
        "not enough inquiries",
        "generate more leads",
        "lead generation",
        "more traffic",
      ],
      stated_pillar: "positioning",
      evidence_pillar: "sales",
      explanation:
        "The stated blocker is lead volume, which points at Positioning. The evidence points at Sales: opportunities are arriving, but follow-up and conversion are not turning them into decisions.",
    },
    {
      id: "price_too_high",
      keywords: [
        "pricing too high",
        "price is too high",
        "prices are too high",
        "prices too high",
        "price too high",
        "need to lower prices",
        "need to lower our prices",
        "need to lower the price",
        "lower our prices",
        "lower my prices",
        "too expensive",
        "reduce the price",
      ],
      stated_pillar: "offer",
      evidence_pillar: "identity",
      explanation:
        "The stated blocker is price, which points at the Offer. The evidence points at Identity: the price is being discounted rather than held, so the real issue is commercial conviction, not the number.",
    },
    {
      id: "new_offer_needed",
      keywords: [
        "need a new offer",
        "offer isn't working",
        "offer isnt working",
        "offer is not working",
        "need a new product",
        "new offer",
        "rework the offer",
        "rebuild the offer",
      ],
      stated_pillar: "offer",
      evidence_pillar: "decision",
      explanation:
        "The stated blocker is the offer itself. The evidence points at Decision and Sales: the existing offer is not being promoted or followed through consistently enough to know whether it works.",
    },
    {
      id: "needs_systems",
      keywords: [
        "need better systems",
        "need more structure",
        "need systems",
        "better processes",
        "more processes",
        "need to systemise",
        "need to systematise",
        "need to systematize",
        "lack of structure",
      ],
      stated_pillar: "revenue_model",
      evidence_pillar: "sales",
      explanation:
        "The stated blocker is systems and structure, which points at the Revenue Model. The evidence points at Sales: the conversation is not reaching a clear decision, and no system fixes that on its own.",
    },
  ];

/* -------------------------------------------------------------------------- */
/* Result contract.                                                            */
/* -------------------------------------------------------------------------- */

export type InevitableStandardConstraintConfidence =
  | "High"
  | "Medium"
  | "Directional";

export type InevitableStandardFalseConstraint = {
  stated_pillar: InevitableStandardPillar;
  evidence_pillar: InevitableStandardPillar;
  mismatch: boolean;
  explanation: string;
};

export type InevitableStandardConstraintResult = {
  constraint_version: typeof INEVITABLE_STANDARD_CONSTRAINT_VERSION;
  primary_constraint: InevitableStandardPillar;
  secondary_constraint: InevitableStandardPillar;
  false_constraint: InevitableStandardFalseConstraint | null;
  /** Which keyword rule matched, or null. Diagnostic aid, mirrors qa_flags. */
  false_constraint_rule_id: string | null;
  /** 2-3 pillars, ordered Identity -> Structure -> Execution. */
  priority_fix_order: InevitableStandardPillar[];
  confidence: InevitableStandardConstraintConfidence;
  /** True when Identity/Decision was promoted over a numerically-lower pillar. */
  identity_decision_override: boolean;
};

export type InevitableStandardConstraintInput = {
  score: InevitableStandardScoreResult;
  /** Founder's Q13 free text. Falls back to score.context_answers[13]. */
  q13_text?: string | null;
  /** Founder's Q29 free text. Falls back to score.context_answers[29]. */
  q29_text?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function pillarPercentage(
  score: InevitableStandardScoreResult,
  pillar: InevitableStandardPillar,
): number {
  const value = Number(score.pillars?.[pillar]?.percentage);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function pillarOrderIndex(pillar: InevitableStandardPillar): number {
  return INEVITABLE_STANDARD_PILLARS.indexOf(pillar);
}

function methodLayerIndex(pillar: InevitableStandardPillar): number {
  return INEVITABLE_STANDARD_METHOD_LAYERS.findIndex((entry) =>
    entry.pillars.includes(pillar),
  );
}

export function methodLayerFor(
  pillar: InevitableStandardPillar,
): InevitableStandardMethodLayer {
  return (
    INEVITABLE_STANDARD_METHOD_LAYERS[methodLayerIndex(pillar)]?.layer ??
    "structure"
  );
}

function matchFalseConstraintRule(
  combinedText: string,
): InevitableStandardFalseConstraintRule | null {
  const haystack = combinedText.toLowerCase();
  if (haystack.trim().length === 0) return null;

  return (
    INEVITABLE_STANDARD_FALSE_CONSTRAINT_RULES.find((rule) =>
      rule.keywords.some((keyword) => haystack.includes(keyword)),
    ) ?? null
  );
}

function buildFalseConstraintExplanation(
  rule: InevitableStandardFalseConstraintRule,
  primaryConstraint: InevitableStandardPillar,
  mismatch: boolean,
): string {
  if (!mismatch) {
    return `The founder names ${PILLAR_LABELS[rule.stated_pillar]} as the blocker, and the evidence agrees. Treat this as a real constraint, not a false one.`;
  }

  if (primaryConstraint === rule.evidence_pillar) {
    return rule.explanation;
  }

  return `The founder points to ${PILLAR_LABELS[rule.stated_pillar]}, but the evidence identifies ${PILLAR_LABELS[primaryConstraint]} as the primary constraint holding the business back.`;
}

/* -------------------------------------------------------------------------- */
/* Engine.                                                                     */
/* -------------------------------------------------------------------------- */

export function deriveInevitableStandardConstraints(
  input: InevitableStandardConstraintInput,
): InevitableStandardConstraintResult {
  const { score } = input;

  const q13 =
    cleanText(input.q13_text) ?? cleanText(score.context_answers?.[13]) ?? "";
  const q29 =
    cleanText(input.q29_text) ?? cleanText(score.context_answers?.[29]) ?? "";
  const combinedText = `${q13} ${q29}`.trim();

  // Rank pillars weakest -> strongest. Ties break on the canonical pillar order
  // so the result is deterministic.
  const rankedPillars = [...INEVITABLE_STANDARD_PILLARS].sort(
    (a, b) =>
      pillarPercentage(score, a) - pillarPercentage(score, b) ||
      pillarOrderIndex(a) - pillarOrderIndex(b),
  );

  const numericLowest = rankedPillars[0];

  // 1) Primary constraint: the weakest pillar, unless a materially-low Identity
  //    or Decision pillar sits just above it (spec section 3).
  let primaryConstraint = numericLowest;
  let identityDecisionOverride = false;

  for (const candidate of OVERRIDE_PILLARS) {
    if (candidate === numericLowest) break;

    const candidatePct = pillarPercentage(score, candidate);
    const gapAboveLowest =
      candidatePct - pillarPercentage(score, numericLowest);

    if (
      candidatePct <= IDENTITY_DECISION_OVERRIDE_MAX_PCT &&
      gapAboveLowest <= IDENTITY_DECISION_OVERRIDE_PROXIMITY_PCT
    ) {
      primaryConstraint = candidate;
      identityDecisionOverride = true;
      break;
    }
  }

  // 2) Secondary constraint: the next weakest pillar that is not the primary.
  const secondaryConstraint =
    rankedPillars.find((pillar) => pillar !== primaryConstraint) ??
    rankedPillars[1];

  // 3) False constraint: the stated blocker versus the evidence.
  const matchedRule = matchFalseConstraintRule(combinedText);
  let falseConstraint: InevitableStandardFalseConstraint | null = null;

  if (matchedRule) {
    const mismatch = matchedRule.stated_pillar !== primaryConstraint;
    falseConstraint = {
      stated_pillar: matchedRule.stated_pillar,
      evidence_pillar: primaryConstraint,
      mismatch,
      explanation: buildFalseConstraintExplanation(
        matchedRule,
        primaryConstraint,
        mismatch,
      ),
    };
  }

  // 4) Priority fix order: the FULL 6-pillar ranking, sequenced strictly by
  //    Method layer (Identity -> Structure -> Execution) regardless of which
  //    pillar is numerically lowest, then by severity (lowest % first) within
  //    each layer. Reports slice this single list: the Diagnostic Snapshot
  //    shows the top 3, the Full Diagnostic shows all 6 (spec section 3).
  const priorityFixOrder = [...INEVITABLE_STANDARD_PILLARS].sort(
    (a, b) =>
      methodLayerIndex(a) - methodLayerIndex(b) ||
      pillarPercentage(score, a) - pillarPercentage(score, b) ||
      pillarOrderIndex(a) - pillarOrderIndex(b),
  );

  // 5) Confidence.
  const allPercentages = INEVITABLE_STANDARD_PILLARS.map((pillar) =>
    pillarPercentage(score, pillar),
  );
  const spread = Math.max(...allPercentages) - Math.min(...allPercentages);
  const primaryGap =
    pillarPercentage(score, secondaryConstraint) -
    pillarPercentage(score, primaryConstraint);

  const hasFreeTextSignal = combinedText.length > 0;
  const clearlySeparated =
    !identityDecisionOverride && primaryGap >= CONFIDENCE_CLEAR_PRIMARY_GAP_PCT;
  const decisiveFalseConstraint =
    falseConstraint !== null &&
    (!falseConstraint.mismatch ||
      primaryConstraint === matchedRule?.evidence_pillar);

  let confidence: InevitableStandardConstraintConfidence;
  if (spread < CONFIDENCE_FLAT_SPREAD_PCT || !hasFreeTextSignal) {
    confidence = "Directional";
  } else if (clearlySeparated && decisiveFalseConstraint) {
    confidence = "High";
  } else {
    confidence = "Medium";
  }

  return {
    constraint_version: INEVITABLE_STANDARD_CONSTRAINT_VERSION,
    primary_constraint: primaryConstraint,
    secondary_constraint: secondaryConstraint,
    false_constraint: falseConstraint,
    false_constraint_rule_id: matchedRule?.id ?? null,
    priority_fix_order: priorityFixOrder,
    confidence,
    identity_decision_override: identityDecisionOverride,
  };
}

/* -------------------------------------------------------------------------- */
/* Model integrity check - mirrors the validators in definition.ts / questions.ts. */
/* -------------------------------------------------------------------------- */

export function validateInevitableStandardConstraintModel(): string[] {
  const issues: string[] = [];

  const layerPillars = INEVITABLE_STANDARD_METHOD_LAYERS.flatMap(
    (entry) => entry.pillars,
  );
  for (const pillar of INEVITABLE_STANDARD_PILLARS) {
    const count = layerPillars.filter((entry) => entry === pillar).length;
    if (count !== 1) {
      issues.push(`${pillar} must belong to exactly one method layer.`);
    }
  }
  if (layerPillars.length !== INEVITABLE_STANDARD_PILLARS.length) {
    issues.push("Method layers must reference each pillar exactly once.");
  }

  const seenRuleIds = new Set<string>();
  for (const rule of INEVITABLE_STANDARD_FALSE_CONSTRAINT_RULES) {
    if (seenRuleIds.has(rule.id)) {
      issues.push(`Duplicate false-constraint rule id ${rule.id}.`);
    }
    seenRuleIds.add(rule.id);

    if (rule.keywords.length === 0) {
      issues.push(`${rule.id} must define at least one keyword.`);
    }
    for (const keyword of rule.keywords) {
      if (keyword.trim().length === 0) {
        issues.push(`${rule.id} contains an empty keyword.`);
      }
      if (keyword !== keyword.toLowerCase()) {
        issues.push(`${rule.id} keyword "${keyword}" must be lowercase.`);
      }
    }
    if (!INEVITABLE_STANDARD_PILLARS.includes(rule.stated_pillar)) {
      issues.push(`${rule.id} has an invalid stated pillar.`);
    }
    if (!INEVITABLE_STANDARD_PILLARS.includes(rule.evidence_pillar)) {
      issues.push(`${rule.id} has an invalid evidence pillar.`);
    }
  }

  return issues;
}
