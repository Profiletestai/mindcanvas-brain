// apps/web/lib/inevitable-standard/buildInsiderInsightsReport.ts
//
// Pure selection + assembly for the Insider Insights report — the private,
// adviser-facing companion to the Inevitable Standard client reports.
//
// Input: the `inevitable_standard` object stored on portal.test_results.totals
// (score result + `constraints` sibling). Output: an ordered, renderer-ready
// report. No IO — importable from server components and unit tests alike.
//
// Selection follows the source's "Dynamic Selection Rules" (master report §43):
// exactly one block per dynamic family, the primary constraint drives the
// conversation-facing families, and any block whose input is missing is
// suppressed and recorded in `qaFlags` rather than rendered as a placeholder.

import {
  garFromRisk,
  getInsiderInsightsForApproach,
  INSIDER_APPROACH_NAME_BY_CODE,
  INSIDER_FALSE_CONSTRAINT_KEY_BY_RULE_ID,
  INSIDER_INSIGHTS_SOURCE_VERSION,
  pillarIdFromKey,
  selectAccountability,
  selectAvoidedQuestion,
  selectChallengeSequenceForPillar,
  selectCoreProfile,
  selectDirectionalPair,
  selectFalseConstraint,
  selectNextStepPositioning,
  selectObjection,
  selectPillarState,
  selectPostSaleCoachingForPillar,
  selectPrimaryConstraint,
  selectProgressSignal,
  selectQuestionsByPrimary,
  selectSecondaryInfluence,
  selectStrongestPillar,
  type InsiderApproachCode,
  type InsiderApproachName,
  type InsiderGar,
  type InsiderPillarKey,
} from "./content/insiderInsights";

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

const PILLAR_KEYS: InsiderPillarKey[] = [
  "identity",
  "positioning",
  "offer",
  "sales",
  "revenue_model",
  "decision",
];

const PILLAR_LABEL: Record<InsiderPillarKey, string> = {
  identity: "Identity",
  positioning: "Positioning",
  offer: "Offer",
  sales: "Sales",
  revenue_model: "Revenue Model",
  decision: "Decision",
};

const APPROACH_LABEL: Record<InsiderApproachCode, string> = {
  A: "Future-Led",
  B: "Connection-Led",
  C: "Timing-Led",
  D: "Evidence-Led",
};

const APPROACH_NAME_LABEL: Record<InsiderApproachName, string> = {
  FUTURE_LED: "Future-Led",
  CONNECTION_LED: "Connection-Led",
  TIMING_LED: "Timing-Led",
  EVIDENCE_LED: "Evidence-Led",
  BALANCED: "Balanced",
};

const GAR_LABEL: Record<InsiderGar, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
};

/* -------------------------------------------------------------------------- */
/* Output types                                                                */
/* -------------------------------------------------------------------------- */

export type InsiderBlock =
  | { type: "prose"; label?: string; text: string }
  | { type: "list"; label?: string; items: string[] }
  | { type: "callout"; label?: string; text: string };

export type InsiderSection = {
  id: string;
  title: string;
  subtitle?: string;
  blocks: InsiderBlock[];
};

export type InsiderPillarSnapshot = {
  key: InsiderPillarKey;
  label: string;
  percentage: number;
  gar: InsiderGar;
  garLabel: string;
};

export type InsiderInsightsReport = {
  meta: {
    approachCode: InsiderApproachCode;
    approachLabel: string;
    secondaryInfluence: InsiderApproachName | null;
    secondaryInfluenceLabel: string | null;
    primaryConstraint: { key: InsiderPillarKey; label: string } | null;
    secondaryConstraint: { key: InsiderPillarKey; label: string } | null;
    strongestPillar: { key: InsiderPillarKey; label: string; percentage: number } | null;
    falseConstraintRuleId: string | null;
    sourceVersion: string;
    generatedAt: string | null;
    taker: { fullName: string; email: string; company: string };
    test: { name: string };
    org: { name: string };
  };
  snapshot: {
    readinessPercentage: number;
    readinessLabel: string | null;
    pillars: InsiderPillarSnapshot[];
    approachMix: Array<{ code: InsiderApproachCode; label: string; percentage: number }>;
    priorityOrder: InsiderPillarKey[];
  };
  sections: InsiderSection[];
  qaFlags: string[];
};

/* -------------------------------------------------------------------------- */
/* Input normalisation                                                         */
/* -------------------------------------------------------------------------- */

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : {};
}

function clampPct(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function isPillarKey(value: unknown): value is InsiderPillarKey {
  return typeof value === "string" && PILLAR_KEYS.includes(value as InsiderPillarKey);
}

function isApproachCode(value: unknown): value is InsiderApproachCode {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type BuildInsiderInsightsInput = {
  score: unknown;
  taker?: { fullName?: string | null; email?: string | null; company?: string | null } | null;
  test?: { name?: string | null } | null;
  org?: { name?: string | null } | null;
  completedAt?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Section assembly helpers                                                    */
/* -------------------------------------------------------------------------- */

function prose(text: string | null | undefined, label?: string): InsiderBlock | null {
  const value = cleanText(text);
  if (!value) return null;
  return label ? { type: "prose", label, text: value } : { type: "prose", text: value };
}

function callout(text: string | null | undefined, label?: string): InsiderBlock | null {
  const value = cleanText(text);
  if (!value) return null;
  return label ? { type: "callout", label, text: value } : { type: "callout", text: value };
}

function list(items: Array<string | null | undefined> | null | undefined, label?: string): InsiderBlock | null {
  const clean = (items ?? []).map(cleanText).filter(Boolean);
  if (clean.length === 0) return null;
  return label ? { type: "list", label, items: clean } : { type: "list", items: clean };
}

function compact(blocks: Array<InsiderBlock | null>): InsiderBlock[] {
  return blocks.filter((b): b is InsiderBlock => b !== null);
}

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

export function buildInsiderInsightsReport(
  input: BuildInsiderInsightsInput,
): InsiderInsightsReport | null {
  const score = asRecord(input.score);
  const approaches = asRecord(score.approaches);
  const constraints = asRecord(score.constraints);
  const overall = asRecord(score.overall);
  const pillarsRaw = asRecord(score.pillars);

  const qaFlags: string[] = [];

  // --- approach ---------------------------------------------------------------
  const percentages = asRecord(approaches.percentages);
  let approachCode: InsiderApproachCode | null = isApproachCode(approaches.dominant)
    ? approaches.dominant
    : null;
  if (!approachCode) {
    let best: { code: InsiderApproachCode; pct: number } | null = null;
    for (const code of ["A", "B", "C", "D"] as InsiderApproachCode[]) {
      const pct = Number(percentages[code]);
      if (Number.isFinite(pct) && (!best || pct > best.pct)) best = { code, pct };
    }
    approachCode = best?.code ?? null;
    if (approachCode) qaFlags.push("approach.dominant missing — inferred from percentages");
  }
  if (!approachCode) return null;

  const approachData = getInsiderInsightsForApproach(approachCode);
  if (!approachData) return null;

  // --- secondary influence --------------------------------------------------
  let secondaryInfluence: InsiderApproachName | null = null;
  const rawSecondary = approaches.secondary;
  if (rawSecondary === "BALANCED") {
    secondaryInfluence = "BALANCED";
  } else if (isApproachCode(rawSecondary)) {
    secondaryInfluence = INSIDER_APPROACH_NAME_BY_CODE[rawSecondary];
  }

  // --- pillars ------------------------------------------------------------------
  const pillars: InsiderPillarSnapshot[] = PILLAR_KEYS.map((key) => {
    const result = asRecord(pillarsRaw[key]);
    const gar = garFromRisk(result.risk as string | undefined);
    return {
      key,
      label: PILLAR_LABEL[key],
      percentage: clampPct(result.percentage),
      gar,
      garLabel: GAR_LABEL[gar],
    };
  });
  const pillarByKey = new Map(pillars.map((p) => [p.key, p]));

  // --- constraints -----------------------------------------------------------
  const primaryKey: InsiderPillarKey | null = isPillarKey(constraints.primary_constraint)
    ? constraints.primary_constraint
    : null;
  const secondaryKey: InsiderPillarKey | null = isPillarKey(constraints.secondary_constraint)
    ? constraints.secondary_constraint
    : null;
  if (!primaryKey) qaFlags.push("constraints.primary_constraint missing — constraint-driven sections suppressed");
  if (!secondaryKey) qaFlags.push("constraints.secondary_constraint missing — primary→secondary loop suppressed");

  const primaryGar: InsiderGar = primaryKey
    ? (pillarByKey.get(primaryKey)?.gar ?? "RED")
    : "RED";

  const falseConstraintRuleId =
    typeof constraints.false_constraint_rule_id === "string"
      ? constraints.false_constraint_rule_id
      : null;

  // --- strongest pillar ------------------------------------------------------
  const strongest = [...pillars].sort((a, b) => b.percentage - a.percentage)[0] ?? null;

  // --- priority order ------------------------------------------------------------
  const storedOrder = Array.isArray(constraints.priority_fix_order)
    ? (constraints.priority_fix_order as unknown[]).filter(isPillarKey)
    : [];
  const priorityOrder: InsiderPillarKey[] = [...storedOrder];
  for (const p of [...pillars].sort((a, b) => a.percentage - b.percentage)) {
    if (!priorityOrder.includes(p.key)) priorityOrder.push(p.key);
  }

  /* ---------------------------------------------------------------------- */
  /* Sections                                                               */
  /* ---------------------------------------------------------------------- */

  const sections: InsiderSection[] = [];
  const add = (
    id: string,
    title: string,
    blocks: Array<InsiderBlock | null>,
    subtitle?: string,
  ) => {
    const clean = compact(blocks);
    if (clean.length === 0) {
      qaFlags.push(`section "${id}" suppressed — no content available`);
      return;
    }
    sections.push(subtitle ? { id, title, subtitle, blocks: clean } : { id, title, blocks: clean });
  };

  // Core profile ----------------------------------------------------------------
  const core = selectCoreProfile(approachCode);
  add("core-profile", `The ${APPROACH_LABEL[approachCode]} founder`, [
    prose(core?.whatApproachMeansInternally, "What this approach means internally"),
    prose(core?.whatTheyNaturallyNotice, "What they naturally notice"),
    prose(core?.whatMotivatesThem, "What motivates them"),
    prose(core?.behaviourUnderPressure, "Behaviour under pressure"),
    prose(core?.howTheyThink, "How they think"),
    prose(core?.howTheyDecide, "How they decide"),
    prose(core?.howTheyBuy, "How they buy"),
    prose(core?.priceAndValue, "Price and value"),
    prose(core?.trustBuilders, "What builds trust"),
    prose(core?.trustReducers, "What reduces trust"),
    prose(core?.communicationStyle, "Communication style"),
    prose(core?.coachingStyle, "Coaching style"),
    prose(core?.whatNotToAssumeGeneral, "What not to assume"),
  ]);

  // Secondary influence -------------------------------------------------------
  if (secondaryInfluence) {
    const si = selectSecondaryInfluence(approachCode, secondaryInfluence);
    add(
      "secondary-influence",
      `Secondary influence — ${APPROACH_NAME_LABEL[secondaryInfluence]}`,
      [
        prose(si?.intro),
        prose(si?.buyingImplication, "What this means for buying"),
        prose(si?.coachingImplication, "What this means for coaching"),
      ],
    );
  } else {
    qaFlags.push("approaches.secondary missing — secondary influence section suppressed");
  }

  // Six pillar-state blocks -------------------------------------------------------
  for (const pillar of pillars) {
    const state = selectPillarState(approachCode, pillar.key, pillar.gar);
    add(
      `pillar-${pillar.key}`,
      `${pillar.label} — ${pillar.garLabel}`,
      [
        prose(state?.pillarMasterIntro),
        prose(state?.whatThisResultTellsYou, "What this result tells you"),
        prose(state?.howApproachShapesIt, "How the approach shapes it"),
        prose(state?.commercialRoleInSystem, "Commercial role in the system"),
        prose(state?.approachCoachingPrinciple, "Coaching principle"),
        prose(state?.howThisAffectsThinking, "How this affects thinking"),
        prose(state?.howThisAffectsDeciding, "How this affects deciding"),
        prose(state?.howThisAffectsBuying, "How this affects buying"),
        prose(state?.howToCommunicate, "How to communicate"),
        prose(state?.whatToListenFor, "What to listen for"),
        prose(state?.whatToChallenge, "What to challenge"),
        prose(state?.whatNotToAssume, "What not to assume"),
        prose(state?.sellingImplication, "Selling implication"),
        prose(state?.coachingImplication, "Coaching implication"),
        callout(state?.commercialConsequence, "Commercial consequence"),
      ],
      `${pillar.percentage}% · ${pillar.garLabel}`,
    );
  }

  // Strongest pillar -----------------------------------------------------------
  if (strongest) {
    add(
      "strongest-pillar",
      `Strongest pillar — ${strongest.label}`,
      [prose(selectStrongestPillar(approachCode, strongest.key))],
      `${strongest.percentage}%`,
    );
  }

  // Primary constraint -------------------------------------------------------------
  if (primaryKey) {
    const pc = selectPrimaryConstraint(approachCode, primaryKey);
    add(
      "primary-constraint",
      `Primary constraint — ${PILLAR_LABEL[primaryKey]}`,
      [
        prose(pc?.whatIsReallyHappening, "What is really happening"),
        prose(pc?.approachMechanism, "The approach mechanism"),
        prose(pc?.commercialCost, "Commercial cost"),
        callout(pc?.conversationObjective, "Conversation objective"),
        prose(pc?.coachingPriority, "Coaching priority"),
        prose(pc?.likelyBuyingObjectionTheme, "Likely buying-objection theme"),
      ],
    );

    // Primary → Secondary loop -------------------------------------------------
    if (secondaryKey) {
      const pair = selectDirectionalPair(approachCode, primaryKey, secondaryKey);
      add(
        "constraint-loop",
        `How ${PILLAR_LABEL[primaryKey]} and ${PILLAR_LABEL[secondaryKey]} reinforce each other`,
        [prose(pair?.text)],
      );
    }
  }

  // False constraint ---------------------------------------------------------------
  if (falseConstraintRuleId) {
    const key = INSIDER_FALSE_CONSTRAINT_KEY_BY_RULE_ID[falseConstraintRuleId];
    const fc = key ? selectFalseConstraint(approachCode, key) : null;
    if (fc) {
      add("false-constraint", "False constraint the founder may bring", [
        prose(fc.text),
        callout(fc.diagnosticDirection, "Where the evidence points"),
      ]);
    } else {
      qaFlags.push(
        `false_constraint_rule_id "${falseConstraintRuleId}" has no Insider block — section suppressed`,
      );
    }
  }

  // Risk signals -----------------------------------------------------------------
  const riskBlocks = (approachData.riskSignals ?? []).flatMap((signal): InsiderBlock[] => {
    const label = cleanText(signal.label);
    const text = cleanText(signal.text);
    const response = cleanText(signal.adviserResponse);
    if (!text && !response) return [];
    const body = [text, response ? `Adviser response: ${response}` : ""]
      .filter(Boolean)
      .join("\n\n");
    return [label ? { type: "prose", label, text: body } : { type: "prose", text: body }];
  });
  if (riskBlocks.length > 0) {
    sections.push({
      id: "risk-signals",
      title: "Behavioural and commercial risk signals",
      subtitle: "All signals for this approach — not yet filtered to this founder's evidence",
      blocks: riskBlocks,
    });
    qaFlags.push(
      "risk signals are not yet filtered to supported flags — the constraint engine emits no per-taker risk scoring",
    );
  }

  // Objections -------------------------------------------------------------------
  if (primaryKey) {
    const obj = selectObjection(approachCode, primaryKey);
    add("objections", `Likely objection when ${PILLAR_LABEL[primaryKey]} is primary`, [
      obj?.possibleLanguage ? callout(obj.possibleLanguage, "Possible language") : null,
      prose(obj?.whatMaySitUnderneath, "What may sit underneath"),
      prose(obj?.responsePosture, "Response posture"),
    ]);
  }

  // PROSPER conversation strategy ----------------------------------------------
  const prosper = approachData.prosper;
  add("conversation-strategy", "Predictive conversation strategy (PROSPER)", [
    prose(prosper?.PERMISSION, "Permission"),
    prose(prosper?.REFRAME, "Reframe"),
    prose(prosper?.OWNERSHIP, "Ownership"),
    prose(prosper?.STRUCTURE, "Structure"),
    prose(prosper?.POWER_QUESTIONS, "Power questions"),
    prose(prosper?.EMBODIMENT, "Embodiment"),
    prose(prosper?.RESULT, "Result"),
  ]);

  // Pre-call questions ---------------------------------------------------------
  add("pre-call", "Pre-call preparation", [
    prose(approachData.preCall?.intro),
    list(approachData.preCall?.questions),
  ]);

  // Questions by primary constraint -----------------------------------------------
  if (primaryKey) {
    add(
      "questions-by-primary",
      `Questions to ask when ${PILLAR_LABEL[primaryKey]} is primary`,
      [list(selectQuestionsByPrimary(approachCode, primaryKey))],
    );
    const avoided = selectAvoidedQuestion(approachCode, primaryKey);
    add("avoided-question", "The question they may be avoiding", [prose(avoided)]);
  }

  // Challenge guidance -------------------------------------------------------------
  add("challenge-guidance", "What to challenge, and how", [
    prose(approachData.challengeSequence?.intro),
    prose(core?.challengeGuidance, "Challenge guidance for this approach"),
    primaryKey
      ? prose(
          selectChallengeSequenceForPillar(approachCode, primaryKey),
          `When ${PILLAR_LABEL[primaryKey]} is the constraint`,
        )
      : null,
  ]);

  // Buying and resistance signals -----------------------------------------------
  add("buying-resistance", "Buying signals and resistance signals", [
    prose(approachData.buyingResistance?.buying, "Buying signals"),
    prose(approachData.buyingResistance?.resistance, "Resistance signals"),
  ]);

  // Recommended next step -------------------------------------------------------
  if (primaryKey) {
    add("next-step", "Positioning the recommended next step", [
      prose(selectNextStepPositioning(approachCode, primaryKey)),
    ]);
  }

  // Follow-up -------------------------------------------------------------------
  add("follow-up", "Follow-up guidance", [prose(approachData.followUp)]);

  // Post-sale coaching -------------------------------------------------------------
  add("post-sale-coaching", "Coaching priorities after the sale", [
    prose(approachData.postSaleCoaching?.intro),
    primaryKey
      ? prose(
          selectPostSaleCoachingForPillar(approachCode, primaryKey),
          `Priority when ${PILLAR_LABEL[primaryKey]} is the constraint`,
        )
      : null,
  ]);

  // Accountability -------------------------------------------------------------
  if (primaryKey) {
    add("accountability", "How to hold them accountable", [
      prose(selectAccountability(approachCode, primaryKey, primaryGar)),
    ]);
  }

  // Progress signals ---------------------------------------------------------------
  const progressItems = pillars
    .map((p) => {
      const text = selectProgressSignal(approachCode, p.key);
      return text ? `${p.label}: ${text}` : "";
    })
    .filter(Boolean);
  add("progress-signals", "Progress signals by pillar", [list(progressItems)]);

  // Adviser green / red flags -----------------------------------------------------
  add("adviser-flags", "Green flags and red flags for the adviser", [
    prose(approachData.adviserFlags?.green, "Green flags"),
    prose(approachData.adviserFlags?.red, "Red flags"),
  ]);

  /* ---------------------------------------------------------------------- */

  return {
    meta: {
      approachCode,
      approachLabel: APPROACH_LABEL[approachCode],
      secondaryInfluence,
      secondaryInfluenceLabel: secondaryInfluence
        ? APPROACH_NAME_LABEL[secondaryInfluence]
        : null,
      primaryConstraint: primaryKey
        ? { key: primaryKey, label: PILLAR_LABEL[primaryKey] }
        : null,
      secondaryConstraint: secondaryKey
        ? { key: secondaryKey, label: PILLAR_LABEL[secondaryKey] }
        : null,
      strongestPillar: strongest
        ? { key: strongest.key, label: strongest.label, percentage: strongest.percentage }
        : null,
      falseConstraintRuleId,
      sourceVersion: INSIDER_INSIGHTS_SOURCE_VERSION,
      generatedAt: input.completedAt ?? null,
      taker: {
        fullName: cleanText(input.taker?.fullName) || "Unknown",
        email: cleanText(input.taker?.email),
        company: cleanText(input.taker?.company),
      },
      test: { name: cleanText(input.test?.name) || "The Inevitable Standard" },
      org: { name: cleanText(input.org?.name) },
    },
    snapshot: {
      readinessPercentage: clampPct(overall.percentage),
      readinessLabel: cleanText(overall.label) || null,
      pillars,
      approachMix: (["A", "B", "C", "D"] as InsiderApproachCode[]).map((code) => ({
        code,
        label: APPROACH_LABEL[code],
        percentage: clampPct(percentages[code]),
      })),
      priorityOrder,
    },
    sections,
    qaFlags,
  };
}

export { PILLAR_LABEL as INSIDER_PILLAR_LABEL, pillarIdFromKey };
