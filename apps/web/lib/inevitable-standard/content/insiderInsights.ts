// apps/web/lib/inevitable-standard/content/insiderInsights.ts
//
// Typed accessor over insiderInsights.data.json — the private, adviser-facing
// Insider Insights content extracted from the four master source reports
// (scripts/insider-insights/extract.ts).
//
// Data only. No scoring, constraint or selection logic — that lives in
// buildInsiderInsightsReport.ts, which is the sole consumer. The JSON keys the
// families by the upper-snake Content ID scheme; this module bridges that to the
// lower-snake pillar / risk vocabulary the scoring engine uses.

import rawData from "./insiderInsights.data.json";

/* -------------------------------------------------------------------------- */
/* Vocabulary bridges                                                          */
/* -------------------------------------------------------------------------- */

export const INSIDER_APPROACH_CODES = ["A", "B", "C", "D"] as const;
export type InsiderApproachCode = (typeof INSIDER_APPROACH_CODES)[number];

/** Secondary influence may also be BALANCED. */
export type InsiderApproachName =
  | "FUTURE_LED"
  | "CONNECTION_LED"
  | "TIMING_LED"
  | "EVIDENCE_LED"
  | "BALANCED";

export const INSIDER_APPROACH_NAME_BY_CODE: Record<
  InsiderApproachCode,
  Exclude<InsiderApproachName, "BALANCED">
> = {
  A: "FUTURE_LED",
  B: "CONNECTION_LED",
  C: "TIMING_LED",
  D: "EVIDENCE_LED",
};

/** Engine pillar key (lower-snake) -> JSON pillar key (upper-snake). */
export type InsiderPillarKey =
  | "identity"
  | "positioning"
  | "offer"
  | "sales"
  | "revenue_model"
  | "decision";

export type InsiderPillarId =
  | "IDENTITY"
  | "POSITIONING"
  | "OFFER"
  | "SALES"
  | "REVENUE_MODEL"
  | "DECISION";

export function pillarIdFromKey(key: InsiderPillarKey): InsiderPillarId {
  return key.toUpperCase() as InsiderPillarId;
}

export type InsiderGar = "GREEN" | "AMBER" | "RED";

/** Engine risk band -> JSON pillar-state suffix. */
export function garFromRisk(
  risk: string | null | undefined,
): InsiderGar {
  if (risk === "low_risk") return "GREEN";
  if (risk === "medium_risk") return "AMBER";
  return "RED";
}

/** Constraint-engine false-constraint rule id -> JSON core false-constraint key. */
export const INSIDER_FALSE_CONSTRAINT_KEY_BY_RULE_ID: Record<
  string,
  InsiderFalseConstraintCode
> = {
  lead_volume: "MORE_LEADS",
  price_too_high: "PRICE_TOO_HIGH",
  new_offer_needed: "NEW_OFFER",
  needs_systems: "BETTER_SYSTEMS",
};

export type InsiderFalseConstraintCode =
  | "MORE_LEADS"
  | "PRICE_TOO_HIGH"
  | "NEW_OFFER"
  | "BETTER_SYSTEMS";

/* -------------------------------------------------------------------------- */
/* JSON shape                                                                  */
/* -------------------------------------------------------------------------- */

export type InsiderCoreProfile = {
  contentId: string | null;
  whatApproachMeansInternally: string | null;
  whatTheyNaturallyNotice: string | null;
  whatMotivatesThem: string | null;
  behaviourUnderPressure: string | null;
  howTheyThink: string | null;
  howTheyDecide: string | null;
  howTheyBuy: string | null;
  priceAndValue: string | null;
  trustBuilders: string | null;
  trustReducers: string | null;
  communicationStyle: string | null;
  coachingStyle: string | null;
  /** Absent in report D's source. */
  challengeGuidance: string | null;
  /** Absent in report D's source. */
  whatNotToAssumeGeneral: string | null;
};

export type InsiderSecondaryInfluence = {
  contentId: string | null;
  intro: string | null;
  buyingImplication: string | null;
  coachingImplication: string | null;
};

export type InsiderPillarState = {
  contentId: string | null;
  pillarMasterIntro: string | null;
  /** Populated only in report D's source. */
  commercialRoleInSystem: string | null;
  /** Populated only in report D's source. */
  approachCoachingPrinciple: string | null;
  whatThisResultTellsYou: string | null;
  /** Populated in reports A/B/C. */
  howApproachShapesIt: string | null;
  howThisAffectsThinking: string | null;
  howThisAffectsDeciding: string | null;
  howThisAffectsBuying: string | null;
  howToCommunicate: string | null;
  whatToListenFor: string | null;
  whatToChallenge: string | null;
  whatNotToAssume: string | null;
  sellingImplication: string | null;
  coachingImplication: string | null;
  commercialConsequence: string | null;
  sourceAnchor: string | null;
};

export type InsiderPrimaryConstraint = {
  contentId: string | null;
  whatIsReallyHappening: string | null;
  approachMechanism: string | null;
  commercialCost: string | null;
  conversationObjective: string | null;
  coachingPriority: string | null;
  likelyBuyingObjectionTheme: string | null;
  sourceAnchor: string | null;
};

export type InsiderDirectionalPair = {
  contentId: string | null;
  text: string | null;
};

export type InsiderFalseConstraintBlock = {
  contentId: string | null;
  text: string | null;
  diagnosticDirection: string | null;
};

export type InsiderProposedFalseConstraint = {
  contentId: string | null;
  label: string | null;
  text: string | null;
};

export type InsiderRiskSignal = {
  contentId: string | null;
  label: string | null;
  text: string | null;
  adviserResponse: string | null;
};

export type InsiderObjection = {
  possibleLanguage: string | null;
  whatMaySitUnderneath: string | null;
  responsePosture: string | null;
};

export type InsiderProsper = {
  PERMISSION: string | null;
  REFRAME: string | null;
  OWNERSHIP: string | null;
  STRUCTURE: string | null;
  POWER_QUESTIONS: string | null;
  EMBODIMENT: string | null;
  RESULT: string | null;
};

export type InsiderPreCall = {
  intro: string | null;
  questions: string[];
};

export type InsiderChallengeSequence = {
  intro: string | null;
  /** Per-pillar detail only in report D's source; {} for A/B/C. */
  byPillar: Partial<Record<InsiderPillarId, string>>;
};

export type InsiderBuyingResistance = {
  buying: string | null;
  resistance: string | null;
};

export type InsiderPostSaleCoaching = {
  intro: string | null;
  /** Per-pillar detail only in report D's source; {} for A/B/C. */
  byPillar: Partial<Record<InsiderPillarId, string>>;
};

export type InsiderAccountability = {
  /** Keyed by pillar state in reports A/B/C. */
  byState: Partial<Record<InsiderGar, string>>;
  /** Keyed by pillar in report D. */
  byPillar: Partial<Record<InsiderPillarId, string>>;
};

export type InsiderAdviserFlags = {
  green: string | null;
  red: string | null;
};

export type InsiderInsightsApproachData = {
  approach: string;
  coreProfile: InsiderCoreProfile;
  secondaryInfluences: Partial<
    Record<InsiderApproachName, InsiderSecondaryInfluence>
  >;
  pillarStates: Record<string, InsiderPillarState>;
  strongestPillar: Partial<Record<InsiderPillarId, string>>;
  primaryConstraints: Partial<
    Record<InsiderPillarId, InsiderPrimaryConstraint>
  >;
  directionalPairs: Record<string, InsiderDirectionalPair>;
  falseConstraints: {
    core: Record<InsiderFalseConstraintCode, InsiderFalseConstraintBlock>;
    proposed: InsiderProposedFalseConstraint[];
  };
  riskSignals: InsiderRiskSignal[];
  objections: Partial<Record<InsiderPillarId, InsiderObjection>>;
  prosper: InsiderProsper;
  preCall: InsiderPreCall;
  questionsByPrimary: Partial<Record<InsiderPillarId, string[]>>;
  avoidedQuestion: Partial<Record<InsiderPillarId, string>>;
  challengeSequence: InsiderChallengeSequence;
  buyingResistance: InsiderBuyingResistance;
  nextStepPositioning: Partial<Record<InsiderPillarId, string>>;
  followUp: string | null;
  postSaleCoaching: InsiderPostSaleCoaching;
  accountability: InsiderAccountability;
  progressSignals: Partial<Record<InsiderPillarId, string>>;
  adviserFlags: InsiderAdviserFlags;
  /**
   * Non-rendered. Every "SOURCE ANCHOR …" / "CONTENT ID: …" provenance
   * paragraph the extractor lifted out of the prose fields. Kept for
   * traceability; never shown to a coach or a founder. The `sourceAnchor`
   * slots on pillar states / primary constraints hold the same text scoped to
   * their block.
   */
  provenance: string[];
};

export type InsiderInsightsData = Record<
  InsiderApproachCode,
  InsiderInsightsApproachData
>;

export const INSIDER_INSIGHTS_DATA = rawData as unknown as InsiderInsightsData;

/**
 * Source document this content was extracted from. Bump when the master reports
 * in docs/insider-insights-source/ are revised and the extractor re-run.
 */
export const INSIDER_INSIGHTS_SOURCE_VERSION =
  "Inevitable Standard Insider Insights master reports A–D, 1 September 2026" as const;

/* -------------------------------------------------------------------------- */
/* Selectors — every one returns the block or null                            */
/* -------------------------------------------------------------------------- */

export function getInsiderInsightsForApproach(
  code: InsiderApproachCode,
): InsiderInsightsApproachData | null {
  return INSIDER_INSIGHTS_DATA[code] ?? null;
}

export function selectCoreProfile(
  code: InsiderApproachCode,
): InsiderCoreProfile | null {
  return INSIDER_INSIGHTS_DATA[code]?.coreProfile ?? null;
}

export function selectSecondaryInfluence(
  code: InsiderApproachCode,
  influence: InsiderApproachName,
): InsiderSecondaryInfluence | null {
  return INSIDER_INSIGHTS_DATA[code]?.secondaryInfluences?.[influence] ?? null;
}

export function selectPillarState(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
  gar: InsiderGar,
): InsiderPillarState | null {
  const key = `${pillarIdFromKey(pillar)}_${gar}`;
  return INSIDER_INSIGHTS_DATA[code]?.pillarStates?.[key] ?? null;
}

export function selectStrongestPillar(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.strongestPillar?.[pillarIdFromKey(pillar)] ??
    null
  );
}

export function selectPrimaryConstraint(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): InsiderPrimaryConstraint | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.primaryConstraints?.[
      pillarIdFromKey(pillar)
    ] ?? null
  );
}

export function selectDirectionalPair(
  code: InsiderApproachCode,
  primary: InsiderPillarKey,
  secondary: InsiderPillarKey,
): InsiderDirectionalPair | null {
  const key = `${pillarIdFromKey(primary)}_${pillarIdFromKey(secondary)}`;
  return INSIDER_INSIGHTS_DATA[code]?.directionalPairs?.[key] ?? null;
}

export function selectFalseConstraint(
  code: InsiderApproachCode,
  falseConstraint: InsiderFalseConstraintCode,
): InsiderFalseConstraintBlock | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.falseConstraints?.core?.[falseConstraint] ??
    null
  );
}

export function selectObjection(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): InsiderObjection | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.objections?.[pillarIdFromKey(pillar)] ?? null
  );
}

export function selectQuestionsByPrimary(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string[] | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.questionsByPrimary?.[
      pillarIdFromKey(pillar)
    ] ?? null
  );
}

export function selectAvoidedQuestion(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.avoidedQuestion?.[pillarIdFromKey(pillar)] ??
    null
  );
}

export function selectNextStepPositioning(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.nextStepPositioning?.[
      pillarIdFromKey(pillar)
    ] ?? null
  );
}

export function selectProgressSignal(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.progressSignals?.[pillarIdFromKey(pillar)] ??
    null
  );
}

/**
 * Accountability guidance for a taker. Reports A/B/C key it by the pillar's
 * state; report D keys it by the pillar. Prefer the state entry, fall back to
 * the pillar entry.
 */
export function selectAccountability(
  code: InsiderApproachCode,
  primaryPillar: InsiderPillarKey,
  primaryGar: InsiderGar,
): string | null {
  const family = INSIDER_INSIGHTS_DATA[code]?.accountability;
  if (!family) return null;
  return (
    family.byState?.[primaryGar] ??
    family.byPillar?.[pillarIdFromKey(primaryPillar)] ??
    null
  );
}

/** Challenge-sequence detail for the primary pillar — report D only; null otherwise. */
export function selectChallengeSequenceForPillar(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.challengeSequence?.byPillar?.[
      pillarIdFromKey(pillar)
    ] ?? null
  );
}

/** Post-sale coaching detail for the primary pillar — report D only; null otherwise. */
export function selectPostSaleCoachingForPillar(
  code: InsiderApproachCode,
  pillar: InsiderPillarKey,
): string | null {
  return (
    INSIDER_INSIGHTS_DATA[code]?.postSaleCoaching?.byPillar?.[
      pillarIdFromKey(pillar)
    ] ?? null
  );
}
