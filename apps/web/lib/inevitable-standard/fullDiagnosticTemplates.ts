/* -------------------------------------------------------------------------- */
/* The Inevitable Standard — Full Diagnostic Report: templated content         */
/* -------------------------------------------------------------------------- */
/*
 * IMPORTANT: this module is DATA-DRIVEN / TEMPLATED text, NOT Knowledge Base
 * content.
 *
 * The Report 2 spec calls for a 30/60/90-day plan and "What Your Diagnostic
 * Adds" interpretive paragraphs. Neither has a source in the Knowledge Base
 * (reportCopy.ts). Rather than invent "book voice" prose for sections with no
 * real source, this module assembles plain, honest sentences from the
 * diagnostic's own outputs — the primary/secondary constraint pillars, the
 * priority fix order, and the founder's free-text answers.
 *
 * The wording here is deliberately operational and neutral. It must not be
 * mistaken for, or promoted to, Genene's authored content. If real authored
 * 30/60/90 or interpretive material is supplied later, replace this wholesale.
 */

import type { InevitableStandardPillar } from "./definition";

export type NinetyDayWindow = "Days 1–30" | "Days 31–60" | "Days 61–90";

export type NinetyDayPhase = {
  window: NinetyDayWindow;
  pillar: InevitableStandardPillar;
  layer: "Identity" | "Structure" | "Execution";
  /** How this pillar relates to the constraint findings, for the phase label. */
  role: "primary constraint" | "secondary constraint" | "sequenced next" | "focus area";
  /** 2–3 concrete, plain actions. Templated, not sourced prose. */
  actions: string[];
  /** One templated "what changes when this holds" line. */
  outcome: string;
};

const METHOD_LAYER: Record<
  InevitableStandardPillar,
  "Identity" | "Structure" | "Execution"
> = {
  identity: "Identity",
  positioning: "Structure",
  offer: "Structure",
  revenue_model: "Structure",
  sales: "Execution",
  decision: "Execution",
};

const PILLAR_ACTIONS: Record<InevitableStandardPillar, string[]> = {
  identity: [
    "State the real price once in each sales conversation, then stop talking and let the silence sit.",
    "Remove the pre-emptive discount — no reduction offered until someone actually asks for one.",
    "Track how often the price holds across a set number of real conversations, and review the count.",
  ],
  positioning: [
    "Write one sentence naming exactly who the work is for and the outcome it produces.",
    "Test that sentence against the last ten enquiries — would the right people recognise themselves in it?",
    "Put the same sentence everywhere the business introduces itself, and cut competing descriptions.",
  ],
  offer: [
    "Give the core offer a name, a stated promise and a described end state the client can picture.",
    "Sketch a three-rung ladder — entry, core, premium — with a clear reason to move up each rung.",
    "Retire any option that exists only because it was never removed.",
  ],
  sales: [
    "Run the same short conversation structure every time, in the same order.",
    "Spend more of each conversation asking than pitching — aim to listen for most of it.",
    "Close every open 'maybe' into a clear yes or a clear no before the conversation ends.",
  ],
  revenue_model: [
    "Work out what each offer actually costs to deliver, in time and money.",
    "Reprice or restructure anything that cannot carry a real margin above that cost.",
    "Check margin per offer on a fixed date each month rather than assuming it is fine.",
  ],
  decision: [
    "Write a short list of the few revenue actions that matter most — keep it to a handful.",
    "Decide in advance the exact day and time each action happens, so there is no daily choice to avoid.",
    "Do them on the days they feel dull or exposing — that is precisely what the list is for.",
  ],
};

const PILLAR_OUTCOME: Record<InevitableStandardPillar, string> = {
  identity:
    "The price stops drifting downward before anyone objects, and strong work stops being discounted inside the room.",
  positioning:
    "The right buyers arrive already understanding what the business does and why it is built for them.",
  offer:
    "Each sale stops being negotiated from scratch, and revenue per client has room to rise instead of a ceiling the founder set.",
  sales:
    "Conversations resolve into decisions instead of settling into open 'maybes' that cost both sides clarity.",
  revenue_model:
    "More of the revenue the business already earns is kept as profit rather than absorbed on the way through.",
  decision:
    "The few actions that actually produce revenue happen on a rhythm rather than in bursts that stop.",
};

/* -------------------------------------------------------------------------- */
/* 30 / 60 / 90-day plan                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Three phases, one per 30-day window, following the resolved 6-pillar priority
 * fix order (Method-layer sequenced) — the same order the reports show. Each
 * phase is tagged with how its pillar relates to the constraint findings.
 *
 * Degraded input (no priority order): falls back to the three lowest-scoring
 * pillars, ascending.
 */
export function buildNinetyDayPlan(args: {
  priorityOrder: InevitableStandardPillar[];
  primaryConstraint: InevitableStandardPillar | null;
  secondaryConstraint: InevitableStandardPillar | null;
  pillarPercentages: Partial<Record<InevitableStandardPillar, number>>;
}): NinetyDayPhase[] {
  const { priorityOrder, primaryConstraint, secondaryConstraint } = args;

  let chosen = priorityOrder.filter(
    (pillar, index) => priorityOrder.indexOf(pillar) === index,
  );

  if (chosen.length < 3) {
    const byScore = (
      Object.keys(PILLAR_ACTIONS) as InevitableStandardPillar[]
    ).sort(
      (a, b) =>
        (args.pillarPercentages[a] ?? 0) - (args.pillarPercentages[b] ?? 0),
    );
    for (const pillar of byScore) {
      if (!chosen.includes(pillar)) chosen.push(pillar);
    }
  }

  const windows: NinetyDayWindow[] = ["Days 1–30", "Days 31–60", "Days 61–90"];
  const fromPriorityOrder = priorityOrder.length >= 3;

  return chosen.slice(0, 3).map((pillar, index) => {
    let role: NinetyDayPhase["role"];
    if (pillar === primaryConstraint) role = "primary constraint";
    else if (pillar === secondaryConstraint) role = "secondary constraint";
    else role = fromPriorityOrder ? "sequenced next" : "focus area";

    return {
      window: windows[index],
      pillar,
      layer: METHOD_LAYER[pillar],
      role,
      actions: PILLAR_ACTIONS[pillar],
      outcome: PILLAR_OUTCOME[pillar],
    };
  });
}

/* -------------------------------------------------------------------------- */
/* "In Your Words" — connecting Q13 / Q29 free text to the constraint findings */
/* -------------------------------------------------------------------------- */

export type DiagnosticAdds = {
  toldUs: Array<{ prompt: string; quote: string }>;
  /** Templated interpretive paragraph. Empty string when nothing useful to add. */
  adds: string;
} | null;

const QUOTE_STOPLIST = new Set([
  "test",
  "testing",
  "tests",
  "na",
  "n/a",
  "none",
  "nothing",
  "asdf",
  "xxx",
  "todo",
  "tbd",
]);

/** Keep a free-text answer only if it looks like a real sentence, not filler. */
export function isMeaningfulFreeText(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim();
  if (text.length < 5) return false;
  if (QUOTE_STOPLIST.has(text.toLowerCase())) return false;
  if (!/[a-z]{3,}/i.test(text)) return false;
  return true;
}

export function buildDiagnosticAdds(args: {
  q13?: string | null;
  q29?: string | null;
  primaryLabel: string | null;
  secondaryLabel: string | null;
  falseConstraint: {
    stated_label?: string | null;
    evidence_label?: string | null;
    mismatch?: boolean | null;
    explanation?: string | null;
  } | null;
}): DiagnosticAdds {
  const { q13, q29, primaryLabel, secondaryLabel, falseConstraint } = args;

  const toldUs: Array<{ prompt: string; quote: string }> = [];
  if (isMeaningfulFreeText(q13)) {
    toldUs.push({
      prompt: "The biggest thing holding the business back",
      quote: String(q13).trim(),
    });
  }
  if (isMeaningfulFreeText(q29)) {
    toldUs.push({
      prompt: "A decision you know you need to make but have not made",
      quote: String(q29).trim(),
    });
  }

  let adds = "";

  const fcActive =
    !!falseConstraint?.mismatch &&
    !!falseConstraint?.stated_label &&
    !!falseConstraint?.evidence_label &&
    falseConstraint.stated_label !== falseConstraint.evidence_label;

  if (fcActive) {
    adds =
      `What you described points toward ${falseConstraint!.stated_label}. ` +
      `The pattern across your answers points more consistently to ${falseConstraint!.evidence_label}.` +
      (falseConstraint!.explanation ? ` ${falseConstraint!.explanation}` : "") +
      ` That shift — from where the pressure is felt to where it originates — is the` +
      ` recognition this diagnostic is built to surface.`;
  } else if (primaryLabel) {
    adds =
      `Your own words describe the pressure as you experience it day to day. ` +
      `The diagnostic locates where that pressure originates: ${primaryLabel}` +
      (secondaryLabel ? `, held in place by ${secondaryLabel}` : "") +
      `. Working there first is what changes how the rest of the picture behaves.`;
  }

  if (toldUs.length === 0 && !adds) return null;
  return { toldUs, adds };
}
