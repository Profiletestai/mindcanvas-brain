// apps/web/lib/inevitable-standard/buildInsiderInsightsReport.ts
//
// Pure selection + assembly for the Insider Insights report — the private,
// adviser-facing companion to the Inevitable Standard client reports.
//
// Input: the `inevitable_standard` object stored on portal.test_results.totals
// (score result + `constraints` sibling, including `context_answers`). Output:
// the renderer-ready report. No IO — importable from server components and unit
// tests alike.
//
// STRUCTURE — this matches the approved Figma design, not the master Build &
// Delivery Guide's much larger 30+-section scope. The report is a compact
// five-section document, roughly the length of Report 1 (Diagnostic Snapshot):
//
//   1. Insider Snapshot        — score/constraint data, minimal new content
//   2. Predictive Signals      — the 13-field table for the founder's PRIMARY
//                                Commercial Decision Approach only
//   3. Founder's Own Words     — Q13/Q29 verbatim, annotated for this founder's
//                                actual primary constraint and evidence
//   4. Suggested Sequence      — a 4-step talk-track for the dominant approach
//   5. The Objective           — one sentence: what this conversation must achieve
//
// The full extracted content layer (all 24 primary-constraint cells, all four
// approach profiles, the seven-stage PROSPER sequences, pre-call questions,
// post-sale coaching, …) stays in insiderInsights.data.json as the data source.
// This builder selects and compresses the slice that renders for one founder.

import {
  garFromRisk,
  getInsiderInsightsForApproach,
  INSIDER_INSIGHTS_SOURCE_VERSION,
  pillarIdFromKey,
  selectAvoidedQuestion,
  selectCoreProfile,
  selectObjection,
  selectPillarState,
  selectPrimaryConstraint,
  selectQuestionsByPrimary,
  selectStrongestPillar,
  type InsiderApproachCode,
  type InsiderApproachName,
  type InsiderGar,
  type InsiderPillarKey,
  type InsiderRiskSignal,
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

// Mirrors PILLARS in app/t/[token]/report/inevitableStandardShared.tsx. Duplicated
// here so the builder stays free of the client-only shared module (next/font).
const PILLAR_DESCRIPTOR: Record<InsiderPillarKey, string> = {
  identity: "Authority, commercial confidence and willingness to lead.",
  positioning: "How clearly the market understands and chooses you.",
  offer: "The clarity, boundaries and repeatability of what you sell.",
  sales: "Discovery, conversion and the quality of the buying path.",
  revenue_model: "Margin, retention, owner reward and transferability.",
  decision: "Commercial focus, follow-through and decision discipline.",
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

const APPROACH_NAME_BY_CODE: Record<InsiderApproachCode, InsiderApproachName> = {
  A: "FUTURE_LED",
  B: "CONNECTION_LED",
  C: "TIMING_LED",
  D: "EVIDENCE_LED",
};

const GAR_LABEL: Record<InsiderGar, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
};

/** false_constraint_rule_id (constraintEngine) -> founder-facing label. */
const FALSE_CONSTRAINT_LABEL: Record<string, string> = {
  lead_volume: "“We need more leads / more visibility”",
  price_too_high: "“The price is too high”",
  new_offer_needed: "“We need a new or bigger offer”",
  needs_systems: "“We need better systems first”",
};

/** false_constraint_rule_id -> insiderInsights core false-constraint key. */
const FALSE_CONSTRAINT_KEY: Record<
  string,
  "MORE_LEADS" | "PRICE_TOO_HIGH" | "NEW_OFFER" | "BETTER_SYSTEMS"
> = {
  lead_volume: "MORE_LEADS",
  price_too_high: "PRICE_TOO_HIGH",
  new_offer_needed: "NEW_OFFER",
  needs_systems: "BETTER_SYSTEMS",
};

/* -------------------------------------------------------------------------- */
/* Output types                                                                */
/* -------------------------------------------------------------------------- */

export type InsiderPillarSnapshot = {
  key: InsiderPillarKey;
  label: string;
  descriptor: string;
  percentage: number;
  gar: InsiderGar;
  garLabel: string;
};

export type InsiderSignalRow = { label: string; text: string };

export type InsiderTagKind =
  | "HYPOTHESIS TO VALIDATE"
  | "LISTEN FOR"
  | "DO NOT ASSUME"
  | "GREEN LEVERAGE";

export type InsiderTag = { kind: InsiderTagKind; text: string };

export type InsiderFounderWord = {
  prompt: string;
  quote: string;
  pillar: {
    label: string;
    gar: InsiderGar;
    garLabel: string;
    percentage: number;
  } | null;
  tags: InsiderTag[];
  riskSignal: { label: string; text: string; adviserResponse: string | null } | null;
};

export type InsiderSequenceStep = {
  step: number;
  title: string;
  instruction: string;
  example: string | null;
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
    sourceVersion: string;
    generatedAt: string | null;
    taker: { fullName: string; email: string; company: string };
    test: { name: string };
    org: { name: string };
  };
  snapshot: {
    readinessPercentage: number;
    readinessLabel: string | null;
    primaryApproach: { label: string; percentage: number };
    secondaryApproach: { label: string; percentage: number | null } | null;
    approachMix: Array<{ code: InsiderApproachCode; label: string; percentage: number }>;
    primaryConstraint: InsiderPillarSnapshot | null;
    secondaryConstraint: InsiderPillarSnapshot | null;
    strongestPillar: InsiderPillarSnapshot | null;
    falseConstraint: { label: string; note: string } | null;
    priorityOrder: Array<{ key: InsiderPillarKey; label: string }>;
    pillars: InsiderPillarSnapshot[];
  };
  predictiveSignals: InsiderSignalRow[];
  foundersWords: InsiderFounderWord[];
  suggestedSequence: InsiderSequenceStep[];
  objective: string | null;
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

/** First paragraph only — the compression used for the 13-field table. */
function firstParagraph(value: unknown): string {
  const text = cleanText(value);
  if (!text) return "";
  return (text.split(/\n{2,}/)[0] ?? "").trim();
}

/** First sentence only — the compression used for the talk-track instructions. */
function firstSentence(value: unknown): string {
  const para = firstParagraph(value);
  if (!para) return "";
  const match = para.match(/^.*?[.?!](?=\s|$)/);
  return (match ? match[0] : para).trim();
}

/** Real answer, not filler. Mirrors fullDiagnosticTemplates.isMeaningfulFreeText. */
const QUOTE_STOPLIST = new Set([
  "test", "testing", "tests", "na", "n/a", "none", "nothing", "asdf", "xxx",
  "todo", "tbd",
]);
function isMeaningfulFreeText(value: unknown): boolean {
  const text = cleanText(value);
  if (text.length < 5) return false;
  if (QUOTE_STOPLIST.has(text.toLowerCase())) return false;
  if (!/[a-z]{3,}/i.test(text)) return false;
  return true;
}

/** Token-overlap pick of the risk signal most relevant to this founder. */
function pickRiskSignal(
  signals: InsiderRiskSignal[],
  context: string,
): InsiderRiskSignal | null {
  const ctxTokens = new Set(context.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  if (ctxTokens.size === 0) return null;
  let best: { signal: InsiderRiskSignal; score: number } | null = null;
  for (const signal of signals) {
    const tokens = `${signal.label ?? ""} ${signal.text ?? ""}`
      .toLowerCase()
      .match(/[a-z]{4,}/g) ?? [];
    const score = tokens.filter((t) => ctxTokens.has(t)).length;
    if (!best || score > best.score) best = { signal, score };
  }
  return best && best.score >= 3 ? best.signal : null;
}

export type BuildInsiderInsightsInput = {
  score: unknown;
  taker?: { fullName?: string | null; email?: string | null; company?: string | null } | null;
  test?: { name?: string | null } | null;
  org?: { name?: string | null } | null;
  completedAt?: string | null;
};

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
  const contextAnswers = asRecord(score.context_answers);

  const qaFlags: string[] = [];

  /* --- approach ----------------------------------------------------------- */
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
    if (approachCode) qaFlags.push("approaches.dominant missing — inferred from percentages");
  }
  if (!approachCode) return null;

  const approachData = getInsiderInsightsForApproach(approachCode);
  if (!approachData) return null;
  const core = selectCoreProfile(approachCode);

  let secondaryInfluence: InsiderApproachName | null = null;
  if (approaches.secondary === "BALANCED") secondaryInfluence = "BALANCED";
  else if (isApproachCode(approaches.secondary)) {
    secondaryInfluence = APPROACH_NAME_BY_CODE[approaches.secondary];
  }

  /* --- pillars ---------------------------------------------------------------- */
  const pillars: InsiderPillarSnapshot[] = PILLAR_KEYS.map((key) => {
    const result = asRecord(pillarsRaw[key]);
    const gar = garFromRisk(result.risk as string | undefined);
    return {
      key,
      label: PILLAR_LABEL[key],
      descriptor: PILLAR_DESCRIPTOR[key],
      percentage: clampPct(result.percentage),
      gar,
      garLabel: GAR_LABEL[gar],
    };
  });
  const pillarByKey = new Map(pillars.map((p) => [p.key, p]));

  /* --- constraints --------------------------------------------------------- */
  const primaryKey: InsiderPillarKey | null = isPillarKey(constraints.primary_constraint)
    ? constraints.primary_constraint
    : null;
  const secondaryKey: InsiderPillarKey | null = isPillarKey(constraints.secondary_constraint)
    ? constraints.secondary_constraint
    : null;
  if (!primaryKey) {
    qaFlags.push("constraints.primary_constraint missing — objection, talk-track and objective fall back to approach-only content");
  }
  const primaryPillar = primaryKey ? pillarByKey.get(primaryKey) ?? null : null;
  const decisionPillar = pillarByKey.get("decision") ?? null;

  const falseConstraintRuleId =
    typeof constraints.false_constraint_rule_id === "string"
      ? constraints.false_constraint_rule_id
      : null;

  const strongest = [...pillars].sort((a, b) => b.percentage - a.percentage)[0] ?? null;

  const storedOrder = Array.isArray(constraints.priority_fix_order)
    ? (constraints.priority_fix_order as unknown[]).filter(isPillarKey)
    : [];
  const priorityKeys: InsiderPillarKey[] = [...storedOrder];
  for (const p of [...pillars].sort((a, b) => a.percentage - b.percentage)) {
    if (!priorityKeys.includes(p.key)) priorityKeys.push(p.key);
  }

  /* ====================================================================== */
  /* 1. INSIDER SNAPSHOT                                                     */
  /* ====================================================================== */

  let falseConstraint: { label: string; note: string } | null = null;
  if (falseConstraintRuleId && FALSE_CONSTRAINT_LABEL[falseConstraintRuleId]) {
    const fcBlock =
      approachData.falseConstraints?.core?.[FALSE_CONSTRAINT_KEY[falseConstraintRuleId]] ?? null;
    const fcExplanation = cleanText(asRecord(constraints.false_constraint).explanation);
    falseConstraint = {
      label: FALSE_CONSTRAINT_LABEL[falseConstraintRuleId],
      note: cleanText(fcBlock?.diagnosticDirection) || fcExplanation || firstParagraph(fcBlock?.text),
    };
  }

  const snapshot: InsiderInsightsReport["snapshot"] = {
    readinessPercentage: clampPct(overall.percentage),
    readinessLabel: cleanText(overall.label) || null,
    primaryApproach: {
      label: APPROACH_LABEL[approachCode],
      percentage: clampPct(percentages[approachCode]),
    },
    secondaryApproach: secondaryInfluence
      ? {
          label: APPROACH_NAME_LABEL[secondaryInfluence],
          percentage:
            secondaryInfluence === "BALANCED" || !isApproachCode(approaches.secondary)
              ? null
              : clampPct(percentages[approaches.secondary]),
        }
      : null,
    approachMix: (["A", "B", "C", "D"] as InsiderApproachCode[]).map((code) => ({
      code,
      label: APPROACH_LABEL[code],
      percentage: clampPct(percentages[code]),
    })),
    primaryConstraint: primaryPillar,
    secondaryConstraint: secondaryKey ? pillarByKey.get(secondaryKey) ?? null : null,
    strongestPillar: strongest,
    falseConstraint,
    priorityOrder: priorityKeys.map((key) => ({ key, label: PILLAR_LABEL[key] })),
    pillars,
  };

  /* ====================================================================== */
  /* 2. PREDICTIVE SIGNALS AT A GLANCE — 13 rows, primary approach only      */
  /* ====================================================================== */

  const objection = primaryKey ? selectObjection(approachCode, primaryKey) : null;
  const predictiveSignals: InsiderSignalRow[] = [];
  const pushSignal = (label: string, value: string) => {
    const text = value.trim();
    if (text) predictiveSignals.push({ label, text });
    else qaFlags.push(`predictive signal "${label}" has no source content — row omitted`);
  };
  pushSignal("How they think", firstParagraph(core?.howTheyThink));
  pushSignal("How they decide", firstParagraph(core?.howTheyDecide));
  pushSignal("How they buy", firstParagraph(core?.howTheyBuy));
  pushSignal("What builds trust", firstParagraph(core?.trustBuilders));
  pushSignal("What reduces trust", firstParagraph(core?.trustReducers));
  pushSignal("Best communication style", firstParagraph(core?.communicationStyle));
  if (primaryKey) {
    pushSignal("Likely objection", cleanText(objection?.possibleLanguage));
    pushSignal("What may really be underneath it", cleanText(objection?.whatMaySitUnderneath));
  } else {
    qaFlags.push("no primary constraint — 'Likely objection' / 'What may sit underneath' rows omitted");
  }
  pushSignal("Buying signals", firstParagraph(approachData.buyingResistance?.buying));
  pushSignal("Resistance signals", firstParagraph(approachData.buyingResistance?.resistance));
  pushSignal("What to challenge", firstParagraph(core?.challengeGuidance));
  pushSignal("What not to assume", firstParagraph(core?.whatNotToAssumeGeneral));
  pushSignal("Coaching style", firstParagraph(core?.coachingStyle));

  /* ====================================================================== */
  /* 3. FOUNDER'S OWN WORDS — Q13 / Q29 verbatim, annotated                  */
  /* ====================================================================== */

  const pc = primaryKey ? selectPrimaryConstraint(approachCode, primaryKey) : null;
  const primaryState =
    primaryKey && primaryPillar
      ? selectPillarState(approachCode, primaryKey, primaryPillar.gar)
      : null;
  const decisionState = decisionPillar
    ? selectPillarState(approachCode, "decision", decisionPillar.gar)
    : null;
  const strongestBlurb = strongest ? selectStrongestPillar(approachCode, strongest.key) : null;
  const greenLeverageTag: InsiderTag | null =
    strongest && strongest.gar !== "RED" && strongestBlurb
      ? { kind: "GREEN LEVERAGE", text: firstSentence(strongestBlurb) }
      : null;
  const hypothesisTag: InsiderTag | null = pc?.whatIsReallyHappening
    ? { kind: "HYPOTHESIS TO VALIDATE", text: cleanText(pc.whatIsReallyHappening) }
    : cleanText(asRecord(constraints.false_constraint).explanation)
      ? {
          kind: "HYPOTHESIS TO VALIDATE",
          text: cleanText(asRecord(constraints.false_constraint).explanation),
        }
      : null;

  const q13present = isMeaningfulFreeText(contextAnswers[13]);
  const q29present = isMeaningfulFreeText(contextAnswers[29]);
  const usedRiskLabels = new Set<string>();

  const pillarTags = (state: typeof primaryState): InsiderTag[] => {
    const out: InsiderTag[] = [];
    if (state?.whatToListenFor)
      out.push({ kind: "LISTEN FOR", text: firstParagraph(state.whatToListenFor) });
    if (state?.whatNotToAssume)
      out.push({ kind: "DO NOT ASSUME", text: firstSentence(state.whatNotToAssume) });
    return out;
  };

  const riskFor = (context: string): InsiderFounderWord["riskSignal"] => {
    const signals = (approachData.riskSignals ?? []).filter(
      (s) => !usedRiskLabels.has(cleanText(s.label)),
    );
    const card = toRiskSignalCard(pickRiskSignal(signals, context));
    if (card) usedRiskLabels.add(card.label);
    return card;
  };

  const foundersWords: InsiderFounderWord[] = [];

  if (q13present) {
    const tags: InsiderTag[] = [];
    if (hypothesisTag) tags.push(hypothesisTag);
    tags.push(...pillarTags(primaryState));
    if (!q29present && greenLeverageTag) tags.push(greenLeverageTag);
    foundersWords.push({
      prompt: "The biggest thing holding the business back",
      quote: cleanText(contextAnswers[13]),
      pillar: primaryPillar
        ? {
            label: primaryPillar.label,
            gar: primaryPillar.gar,
            garLabel: primaryPillar.garLabel,
            percentage: primaryPillar.percentage,
          }
        : null,
      tags,
      riskSignal: riskFor(
        [
          cleanText(contextAnswers[13]),
          primaryKey ? PILLAR_LABEL[primaryKey] : "",
          cleanText(pc?.approachMechanism),
        ].join(" "),
      ),
    });
  }

  if (q29present) {
    const tags: InsiderTag[] = [];
    if (!q13present && hypothesisTag) tags.push(hypothesisTag);
    tags.push(...pillarTags(decisionState));
    if (greenLeverageTag) tags.push(greenLeverageTag);
    foundersWords.push({
      prompt: "A decision you know you need to make but have not made",
      quote: cleanText(contextAnswers[29]),
      pillar: decisionPillar
        ? {
            label: decisionPillar.label,
            gar: decisionPillar.gar,
            garLabel: decisionPillar.garLabel,
            percentage: decisionPillar.percentage,
          }
        : null,
      tags,
      riskSignal: riskFor(
        [cleanText(contextAnswers[29]), "decision certainty analysis", cleanText(pc?.approachMechanism)].join(" "),
      ),
    });
  }

  if (foundersWords.length === 0) {
    qaFlags.push("Q13 / Q29 free text is empty or filler — Founder's Own Words section is empty");
  }

  /* ====================================================================== */
  /* 4. SUGGESTED SEQUENCE — 4 steps, compressed from PROSPER + primary cell */
  /* ====================================================================== */

  const prosper = approachData.prosper;
  const byPrimaryQuestions = primaryKey
    ? selectQuestionsByPrimary(approachCode, primaryKey) ?? []
    : [];
  const avoided = primaryKey ? selectAvoidedQuestion(approachCode, primaryKey) : null;
  const example = (i: number): string | null => cleanText(byPrimaryQuestions[i]) || null;

  const suggestedSequence: InsiderSequenceStep[] = [
    {
      step: 1,
      title: "Set the diagnostic frame",
      instruction: firstSentence(prosper?.PERMISSION),
      example: null,
    },
    {
      step: 2,
      title: primaryKey
        ? `Reframe toward ${PILLAR_LABEL[primaryKey]}`
        : "Reframe toward the constraint",
      instruction: firstSentence(prosper?.REFRAME),
      example: example(0),
    },
    {
      step: 3,
      title: "Surface it in their own evidence",
      instruction: firstSentence(prosper?.POWER_QUESTIONS),
      example: example(1) ?? (cleanText(avoided) || null),
    },
    {
      step: 4,
      title: "Move to one recommendation and one decision",
      instruction: [firstSentence(prosper?.RESULT), firstSentence(pc?.coachingPriority)]
        .filter(Boolean)
        .join(" "),
      example: example(2),
    },
  ].map((s) => ({ ...s, instruction: s.instruction.trim() }));

  const emptySteps = suggestedSequence.filter((s) => !s.instruction).map((s) => s.step);
  if (emptySteps.length) qaFlags.push(`suggested sequence step(s) ${emptySteps.join(", ")} have no PROSPER source`);

  /* ====================================================================== */
  /* 5. THE OBJECTIVE — one sentence                                         */
  /* ====================================================================== */

  let objective: string | null = null;
  if (pc?.conversationObjective) {
    objective = cleanText(pc.conversationObjective);
  } else if (pc?.coachingPriority) {
    objective = firstSentence(pc.coachingPriority);
  } else if (primaryKey) {
    objective = `Get this ${APPROACH_LABEL[approachCode]} founder to one diagnosed problem — ${PILLAR_LABEL[primaryKey]} — one recommendation, and one clean decision.`;
    qaFlags.push("objective composed from a template — no primary-constraint conversation objective available");
  } else {
    objective = `Get this ${APPROACH_LABEL[approachCode]} founder to one diagnosed problem, one recommendation, and one clean decision.`;
    qaFlags.push("objective composed from a template — no primary constraint");
  }

  /* ---------------------------------------------------------------------- */

  return {
    meta: {
      approachCode,
      approachLabel: APPROACH_LABEL[approachCode],
      secondaryInfluence,
      secondaryInfluenceLabel: secondaryInfluence
        ? APPROACH_NAME_LABEL[secondaryInfluence]
        : null,
      primaryConstraint: primaryKey ? { key: primaryKey, label: PILLAR_LABEL[primaryKey] } : null,
      secondaryConstraint: secondaryKey
        ? { key: secondaryKey, label: PILLAR_LABEL[secondaryKey] }
        : null,
      strongestPillar: strongest
        ? { key: strongest.key, label: strongest.label, percentage: strongest.percentage }
        : null,
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
    snapshot,
    predictiveSignals,
    foundersWords,
    suggestedSequence,
    objective,
    qaFlags,
  };
}

function toRiskSignalCard(
  signal: InsiderRiskSignal | null,
): InsiderFounderWord["riskSignal"] {
  if (!signal) return null;
  const text = cleanText(signal.text);
  if (!text) return null;
  return {
    label: cleanText(signal.label) || "Risk signal",
    text,
    adviserResponse: cleanText(signal.adviserResponse) || null,
  };
}

export { PILLAR_LABEL as INSIDER_PILLAR_LABEL, pillarIdFromKey };
