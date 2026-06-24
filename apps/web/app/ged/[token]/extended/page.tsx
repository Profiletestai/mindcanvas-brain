// apps/web/app/ged/[token]/extended/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import AppBackground from "@/components/ui/AppBackground";

type PersonalityKey = "FIRE" | "FLOW" | "FORM" | "FIELD";
type MindsetKey = "ORIGIN" | "MOMENTUM" | "VECTOR" | "ORBIT" | "QUANTUM";

type QscResultsRow = {
  id: string;
  test_id: string;
  token: string;
  taker_id: string | null;
  audience: "entrepreneur" | "leader" | null;
  combined_profile_code: string | null;
  qsc_profile_id: string | null;
  created_at: string;
  primary_personality?: PersonalityKey | null;
  secondary_personality?: PersonalityKey | null;
  primary_mindset?: MindsetKey | null;
  secondary_mindset?: MindsetKey | null;
  personality_percentages?: Partial<Record<PersonalityKey, number>> | null;
  mindset_percentages?: Partial<Record<MindsetKey, number>> | null;
};

type QscProfileRow = {
  id: string;
  personality_code: string | null;
  mindset_level: number | null;
  profile_code: string | null;
  profile_label: string | null;
};

type TakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  role_title: string | null;
};

type EntrepreneurExtendedRow = {
  persona_label: string | null;
  personality_label: string | null;
  mindset_label: string | null;
  profile_code: string | null;
  personality_layer: string | null;
  mindset_layer: string | null;
  combined_quantum_pattern: string | null;
  how_to_communicate: string | null;
  how_they_make_decisions: string | null;
  core_business_problems: string | null;
  what_builds_trust: string | null;
  what_offer_ready_for: string | null;
  what_blocks_sale: string | null;
  pre_call_questions: string | null;
  micro_scripts: string | null;
  green_red_flags: string | null;
  real_life_example: string | null;
  final_summary: string | null;
};

type GedImpactLevel = "critical" | "significant" | "moderate" | "low";

type GedOperationalImpact = {
  label?: string;
  summary?: string;
  level?: GedImpactLevel;
  score?: number;
};

type PersonalityLayerView = {
  overview: string;
  traits: string[];
  keyInsights: string[];
  exampleBehaviours: string[];
  listenFor: string[];
  role: string;
};

type MindsetLayerView = {
  overview: string;
  focusSignals: string[];
  exampleStatements: string[];
  perceivedProblems: string[];
  realProblems: string[];
};

type CombinedPatternView = {
  overview: string;
  realWorldExamples: string[];
  vulnerabilities: string[];
  positioningLine: string;
};

type CommunicationView = {
  doItems: string[];
  dontItems: string[];
  effectiveLines: string[];
};

type DecisionView = {
  overview: string;
  yesItems: string[];
  hesitateItems: string[];
  takeaway: string;
};

type TrustPlan = {
  buildItems: string[];
  breakItems: string[];
  effectiveLine: string;
};

type OfferFitPlan = {
  fitsWell: string[];
  doesNotFit: string[];
};

type CoreBusinessProblem = {
  title: string;
  description: string | null;
};

type GedEngineDiagnostic = {
  primary_priority?: string;
  priority_label?: string;
  priority_summary?: string;
  business_stage?: { label?: string; summary?: string };
  core_constraint?: { label?: string; summary?: string };
  scale_readiness_signal?: { label?: string; summary?: string };
  self_diagnosis?: string | null;
  scale_readiness_level?: string;
  primary_bottleneck?: {
    label?: string;
    summary?: string;
    why_it_matters?: string;
    first_fix?: string;
  };
  urgency?: { label?: string; window?: string; summary?: string };
  confidence?: string;
  scores?: {
    growth_engine?: number;
    sales_engine?: number;
    scale_readiness?: number;
    founder_dependency?: number;
    overall_engine?: number;
  };
  operational_impact?: GedOperationalImpact[];
  action_plan?: Array<{
    week?: number;
    title?: string;
    actions?: string[];
  }>;
  recommended_next_step?: { title?: string; summary?: string };
};

type LinkMeta = {
  next_steps_url?: string | null;
  redirect_url?: string | null;
};

type QscExtendedPayload = {
  ok?: boolean;
  results?: QscResultsRow | null;
  profile?: QscProfileRow | null;
  extended?: EntrepreneurExtendedRow | null;
  taker?: TakerRow | null;
  error?: string;
};

type GedPayload = {
  ok?: boolean;
  results?: QscResultsRow | null;
  profile?: QscProfileRow | null;
  taker?: TakerRow | null;
  link?: LinkMeta | null;
  ged?: {
    engine_diagnostic?: GedEngineDiagnostic | null;
  } | null;
  error?: string;
};

type Tone = "emerald" | "cyan" | "sky" | "orange" | "rose" | "amber" | "violet";

const ASSET_BASE = "/ged/predictive-selling-icons";
const SECTION_ICON_BASE = `${ASSET_BASE}/section-icons`;

const PERSONALITY_LABELS: Record<PersonalityKey, string> = {
  FIRE: "Fire",
  FLOW: "Flow",
  FORM: "Form",
  FIELD: "Field",
};

const MINDSET_LABELS: Record<MindsetKey, string> = {
  ORIGIN: "Origin",
  MOMENTUM: "Momentum",
  VECTOR: "Vector",
  ORBIT: "Orbit",
  QUANTUM: "Quantum",
};

const PERSONALITY_TONES: Record<PersonalityKey, string> = {
  FIRE: "text-orange-400",
  FLOW: "text-sky-400",
  FORM: "text-emerald-400",
  FIELD: "text-violet-400",
};

const TONE_STYLE: Record<
  Tone,
  { label: string; top: string; panel: string; border: string; icon: string; dot: string }
> = {
  emerald: {
    label: "text-emerald-600",
    top: "bg-emerald-500",
    panel: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "bg-emerald-100 border-emerald-300",
    dot: "bg-emerald-500",
  },
  cyan: {
    label: "text-cyan-600",
    top: "bg-cyan-500",
    panel: "bg-cyan-50",
    border: "border-cyan-200",
    icon: "bg-cyan-100 border-cyan-300",
    dot: "bg-cyan-500",
  },
  sky: {
    label: "text-sky-600",
    top: "bg-sky-500",
    panel: "bg-sky-50",
    border: "border-sky-200",
    icon: "bg-sky-100 border-sky-300",
    dot: "bg-sky-500",
  },
  orange: {
    label: "text-orange-600",
    top: "bg-orange-500",
    panel: "bg-orange-50",
    border: "border-orange-200",
    icon: "bg-orange-100 border-orange-300",
    dot: "bg-orange-500",
  },
  rose: {
    label: "text-rose-600",
    top: "bg-rose-500",
    panel: "bg-rose-50",
    border: "border-rose-200",
    icon: "bg-rose-100 border-rose-300",
    dot: "bg-rose-500",
  },
  amber: {
    label: "text-amber-600",
    top: "bg-amber-500",
    panel: "bg-amber-50",
    border: "border-amber-200",
    icon: "bg-amber-100 border-amber-300",
    dot: "bg-amber-500",
  },
  violet: {
    label: "text-violet-600",
    top: "bg-violet-500",
    panel: "bg-violet-50",
    border: "border-violet-200",
    icon: "bg-violet-100 border-violet-300",
    dot: "bg-violet-500",
  },
};

function safeText(value: unknown, fallback = "Not available for this profile."): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalisePercent(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n > 0 && n <= 1.5 ? n * 100 : n));
}

function formatProfilePart(value: unknown): string {
  const raw = safeText(value, "");
  if (!raw) return "";
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getName(taker: TakerRow | null | undefined): string {
  const name = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim();
  return name || taker?.email?.trim() || "Buyer";
}

function sentence(value: unknown, maxLength = 180): string {
  const text = safeText(value, "").replace(/\s+/g, " ").trim();
  if (!text) return "Not recorded";
  const first = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1] || text;
  return first.length > maxLength ? `${first.slice(0, maxLength - 1).trim()}…` : first;
}

function textItems(value: unknown, limit = 8): string[] {
  const raw = safeText(value, "");
  if (!raw) return [];

  const lines = raw
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-Z“])/))
    .map((line) => line.replace(/^[\s•✓✔✕✗❌➜▸\-–—]+/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, limit);

  return raw
    .split(/(?<=[.!?])\s+(?=[A-Z“])/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function firstAction(steps: GedEngineDiagnostic["action_plan"]): string {
  for (const step of steps || []) {
    const action = step?.actions?.find((item) => item?.trim());
    if (action) return action.trim();
  }
  return "Use the diagnostic evidence to agree a clear first move.";
}

function compactDecisionStyle(value: unknown): string {
  const text = safeText(value, "").toLowerCase();
  if (/instant|immediate|fast decision|quick decision|decisive/.test(text)) return "Instant";
  if (/evidence|proof|data|logic/.test(text)) return "Evidence-led";
  if (/relationship|consensus|collaborative/.test(text)) return "Collaborative";
  if (/careful|deliberate|considered/.test(text)) return "Considered";
  return "Strategic";
}

function compactBuyerMode(value: unknown): string {
  const text = safeText(value, "").toLowerCase();
  if (/scale|expansion|leverage|ecosystem/.test(text)) return "Buys scale, not improvement";
  if (/clarity|certainty|confidence|safety/.test(text)) return "Buys confidence and clarity";
  if (/strategy|advisory|framework/.test(text)) return "Buys strategic leverage";
  return "Buys outcomes, not tactics";
}

function splitFlags(value: unknown): { green: string[]; red: string[] } {
  const all = textItems(value, 16);
  const green: string[] = [];
  const red: string[] = [];
  let side: "green" | "red" = "green";

  for (const item of all) {
    const lower = item.toLowerCase();
    if (lower.includes("red flag") || lower.includes("pause") || lower.includes("weaker fit")) {
      side = "red";
      continue;
    }
    if (lower.includes("green flag") || lower.includes("stronger fit") || lower.includes("strong fit")) {
      side = "green";
      continue;
    }
    if (side === "green") green.push(item);
    else red.push(item);
  }

  if (!red.length && green.length > 3) {
    return { green: green.slice(0, Math.ceil(green.length / 2)), red: green.slice(Math.ceil(green.length / 2)) };
  }

  return { green, red };
}

function cleanPlaybookCopy(value: unknown): string {
  return safeText(value, "")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—]\s*/g, " - ")
    .trim();
}

function splitPlaybookBullets(value: string, limit = 8): string[] {
  const items = value
    .replace(/\r/g, "")
    .split(/(?:\n+|\s+[•✓✔➜▸]\s*|\s+-\s+)/)
    .map((item) => item.replace(/^[\s•✓✔✕✗❌➜▸\-–—]+/, "").trim())
    .filter(Boolean)
    .filter((item) => !/^(key insights|example behaviours|when you hear this|if you hear this,? it means|your role)\b/i.test(item));

  return uniqueStrings(items).slice(0, limit);
}

function sliceBetweenHeadings(raw: string, start: RegExp, endings: RegExp[]): string {
  const startMatch = start.exec(raw);
  if (!startMatch || startMatch.index == null) return "";

  const contentStart = startMatch.index + startMatch[0].length;
  let contentEnd = raw.length;

  for (const ending of endings) {
    const tail = raw.slice(contentStart);
    const endingMatch = ending.exec(tail);
    if (endingMatch?.index != null) {
      contentEnd = Math.min(contentEnd, contentStart + endingMatch.index);
    }
  }

  return raw.slice(contentStart, contentEnd).trim();
}

function parsePersonalityLayer(value: unknown): PersonalityLayerView {
  const raw = cleanPlaybookCopy(value)
    .replace(/^how they think,? behave and decide\s*/i, "")
    .trim();

  if (!raw) {
    return {
      overview: "Not recorded for this profile.",
      traits: [],
      keyInsights: [],
      exampleBehaviours: [],
      listenFor: [],
      role: "",
    };
  }

  const keyHeading = /\bkey\s+insights\s*[:\-–—]?/i;
  const exampleHeading = /\bexample\s+behaviou?rs?\s*[:\-–—]?/i;
  const listenHeading = /\b(?:when you hear this|if you hear this,? it means)\s*[:\-–—]?/i;
  const roleHeading = /\byour role\s*[:\-–—]?/i;

  const headingPositions = [keyHeading, exampleHeading, listenHeading, roleHeading]
    .map((pattern) => {
      const match = pattern.exec(raw);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0);

  const firstHeading = headingPositions.length ? Math.min(...headingPositions) : raw.length;
  const introductoryBlock = raw.slice(0, firstHeading).trim();

  const traitsMarker = /(?:they are|they tend to be|they are often|key traits)\s*:/i;
  const traitsMatch = traitsMarker.exec(introductoryBlock);
  const overview = traitsMatch?.index != null
    ? introductoryBlock.slice(0, traitsMatch.index).trim()
    : sentence(introductoryBlock, 330);
  const traits = traitsMatch
    ? splitPlaybookBullets(introductoryBlock.slice(traitsMatch.index + traitsMatch[0].length), 6)
    : [];

  const keyInsights = splitPlaybookBullets(
    sliceBetweenHeadings(raw, keyHeading, [exampleHeading, listenHeading, roleHeading]),
    5
  );
  const exampleBehaviours = splitPlaybookBullets(
    sliceBetweenHeadings(raw, exampleHeading, [listenHeading, roleHeading]),
    6
  );
  const listenFor = splitPlaybookBullets(
    sliceBetweenHeadings(raw, listenHeading, [roleHeading]),
    3
  );
  const role = sliceBetweenHeadings(raw, roleHeading, []);

  return {
    overview: overview || sentence(raw, 330),
    traits,
    keyInsights,
    exampleBehaviours,
    listenFor,
    role,
  };
}


function cleanStructuredPlaybookCopy(value: unknown): string {
  return safeText(value, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function structuredListItems(value: unknown, limit = 8): string[] {
  const raw = cleanStructuredPlaybookCopy(value);
  if (!raw) return [];

  const chunks = raw
    .replace(/[•✓✔➜▸]/g, "\n")
    .replace(/\s+[–—]\s+(?=[A-Z“"])/g, "\n")
    .replace(/\s+-\s+(?=[A-Z“"])/g, "\n")
    .replace(/\s+(?=[“"])/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z“"])/))
    .map((item) =>
      item
        .replace(/^[\s•✓✔✕✗❌➜▸\-–—]+/, "")
        .replace(/^["“]|["”]$/g, "")
        .trim()
    )
    .filter(Boolean);

  return uniqueStrings(chunks).slice(0, limit);
}

function parseMindsetLayer(value: unknown): MindsetLayerView {
  const raw = cleanStructuredPlaybookCopy(value)
    .replace(/^where they are in (?:their|the) current business journey\.?\s*/i, "")
    .trim();

  if (!raw) {
    return {
      overview: "Not recorded for this profile.",
      focusSignals: [],
      exampleStatements: [],
      perceivedProblems: [],
      realProblems: [],
    };
  }

  const exampleHeading = /\bexample\s+statements?\s+(?:they\s+)?make\s*[:\-–—]?/i;
  const perceivedHeading = /\bwhat\s+they\s+think\s+the\s+problem\s+is\s*[:\-–—]?/i;
  const realHeading = /\bwhat\s+the\s+real\s+problem\s+is\s*[:\-–—]?/i;

  const positions = [exampleHeading, perceivedHeading, realHeading]
    .map((pattern) => {
      const match = pattern.exec(raw);
      return match?.index ?? -1;
    })
    .filter((position) => position >= 0);

  const introEnd = positions.length ? Math.min(...positions) : raw.length;
  const introItems = structuredListItems(raw.slice(0, introEnd), 8);

  const exampleStatements = structuredListItems(
    sliceBetweenHeadings(raw, exampleHeading, [perceivedHeading, realHeading]),
    6
  );

  const perceivedProblems = structuredListItems(
    sliceBetweenHeadings(raw, perceivedHeading, [realHeading]),
    6
  );

  const realProblems = structuredListItems(
    sliceBetweenHeadings(raw, realHeading, []),
    7
  );

  return {
    overview: introItems[0] || sentence(raw, 260),
    focusSignals: introItems.slice(1, 4),
    exampleStatements,
    perceivedProblems,
    realProblems,
  };
}

function parseCombinedQuantumPattern(
  value: unknown,
  fallback: {
    realWorldExample?: unknown;
    vulnerability?: unknown;
    positioningLine?: unknown;
  } = {}
): CombinedPatternView {
  const raw = cleanStructuredPlaybookCopy(value);

  if (!raw) {
    return {
      overview: "No combined-pattern narrative is recorded for this profile.",
      realWorldExamples: structuredListItems(fallback.realWorldExample, 6),
      vulnerabilities: structuredListItems(fallback.vulnerability, 6),
      positioningLine: safeText(fallback.positioningLine, "Use the diagnostic evidence to position the next conversation with clarity."),
    };
  }

  const realWorldHeading = /\breal\s*world\s*example\b\s*[:\-–—]?/i;
  const vulnerabilityHeading = /\b(?:their\s+)?vulnerabilit(?:y|ies)\b\s*[:\-–—]?/i;
  const positioningHeading = /\bpositioning\s+line\s+that\s+works\b\s*[:\-–—]?/i;

  const markerPositions = [realWorldHeading, vulnerabilityHeading, positioningHeading]
    .map((pattern) => {
      const match = pattern.exec(raw);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0);

  const introEnd = markerPositions.length ? Math.min(...markerPositions) : raw.length;
  const overview = raw.slice(0, introEnd).trim() || sentence(raw, 520);

  const realWorldRaw = sliceBetweenHeadings(raw, realWorldHeading, [vulnerabilityHeading, positioningHeading]);
  const vulnerabilityRaw = sliceBetweenHeadings(raw, vulnerabilityHeading, [positioningHeading]);
  const positioningRaw = sliceBetweenHeadings(raw, positioningHeading, []);

  const realWorldExamples = structuredListItems(realWorldRaw, 6);
  const vulnerabilities = structuredListItems(vulnerabilityRaw, 6);

  const fallbackExamples = structuredListItems(fallback.realWorldExample, 6);
  const fallbackVulnerabilities = structuredListItems(fallback.vulnerability, 6);

  return {
    overview,
    realWorldExamples: realWorldExamples.length ? realWorldExamples : fallbackExamples,
    vulnerabilities: vulnerabilities.length ? vulnerabilities : fallbackVulnerabilities,
    positioningLine: safeText(
      positioningRaw,
      safeText(fallback.positioningLine, "Use the diagnostic evidence to position the next conversation with clarity.")
    ),
  };
}

function parseCommunicationPlan(
  communicationValue: unknown,
  blockerValue: unknown,
  microScriptsValue: unknown
): CommunicationView {
  const raw = cleanStructuredPlaybookCopy(communicationValue);

  const doHeading = /(?:^|\n)\s*do\s*[:\-–—]?/im;
  const dontHeading = /(?:^|\n)\s*(?:don['’]?t|do\s+not|avoid)\s*[:\-–—]?/im;
  const effectiveHeading = /(?:^|\n)\s*(?:effective\s+lines?|lines?\s+that\s+work)\s*[:\-–—]?/im;

  const doRaw = sliceBetweenHeadings(raw, doHeading, [dontHeading, effectiveHeading]);
  const dontRaw = sliceBetweenHeadings(raw, dontHeading, [effectiveHeading]);
  const effectiveRaw = sliceBetweenHeadings(raw, effectiveHeading, []);

  let doItems = structuredListItems(doRaw, 6);
  if (!doItems.length) {
    const firstHeadingPositions = [dontHeading, effectiveHeading]
      .map((pattern) => pattern.exec(raw)?.index ?? -1)
      .filter((index) => index >= 0);
    const beforeOtherHeadings = firstHeadingPositions.length
      ? raw.slice(0, Math.min(...firstHeadingPositions))
      : raw;
    doItems = structuredListItems(beforeOtherHeadings, 6);
  }

  const dontItems = structuredListItems(dontRaw, 6).length
    ? structuredListItems(dontRaw, 6)
    : structuredListItems(blockerValue, 6);

  const effectiveLines = structuredListItems(effectiveRaw, 3).length
    ? structuredListItems(effectiveRaw, 3)
    : structuredListItems(microScriptsValue, 3);

  return {
    doItems: uniqueStrings(doItems).slice(0, 6),
    dontItems: uniqueStrings(dontItems).slice(0, 6),
    effectiveLines: uniqueStrings(effectiveLines).slice(0, 3),
  };
}

function isTrustHeading(value: string): boolean {
  return /^(?:what\s+builds\s+trust|build\s+trust\s+through|break\s+trust\s+through|what\s+breaks\s+trust|effective\s+lines?)\b/i.test(
    value.trim()
  );
}

function trustListItems(value: unknown, limit = 6): string[] {
  const raw = cleanStructuredPlaybookCopy(value);
  if (!raw) return [];

  const cleaned = raw
    .replace(/(?:^|\n)\s*(?:what\s+builds\s+trust|build\s+trust\s+through|break\s+trust\s+through|what\s+breaks\s+trust|effective\s+lines?)\s*[:\-–—]?/gim, "\n")
    .trim();

  const parsed = structuredListItems(cleaned, limit + 2)
    .map((item) => item.replace(/^(?:build|break)\s+trust\s+(?:with|through)\s*[:\-–—]?\s*/i, "").trim())
    .filter((item) => item && !isTrustHeading(item));

  return uniqueStrings(parsed).slice(0, limit);
}

function parseTrustPlan(
  trustValue: unknown,
  blockerValue: unknown,
  microScriptsValue: unknown
): TrustPlan {
  const buildItems = trustListItems(trustValue, 6);
  const breakItems = trustListItems(blockerValue, 6);
  const effectiveLine = trustListItems(microScriptsValue, 1)[0] || "";

  return {
    buildItems,
    breakItems,
    effectiveLine,
  };
}

function offerFitItems(value: unknown, limit = 6): string[] {
  const items = structuredListItems(value, limit + 4)
    .map((item) =>
      item
        .replace(
          /^(?:fits?\s+well|best\s+offer\s+fit|does\s+not\s+fit|doesn['’]?t\s+fit|not\s+a\s+fit|avoid)\s*[:\-–—]?\s*/i,
          ""
        )
        .trim()
    )
    .filter(
      (item) =>
        item &&
        !/^(?:fits?\s+well|best\s+offer\s+fit|does\s+not\s+fit|doesn['’]?t\s+fit|not\s+a\s+fit|avoid)$/i.test(
          item
        )
    );

  return uniqueStrings(items).slice(0, limit);
}

function parseOfferFitPlan(value: unknown): OfferFitPlan {
  const raw = cleanStructuredPlaybookCopy(value);
  if (!raw) return { fitsWell: [], doesNotFit: [] };

  const fitsHeading = /\b(?:fits?\s+well|best\s+offer\s+fit)\b\s*[:\-–—]?/i;
  const doesNotFitHeading = /\b(?:does\s+not\s+fit|doesn['’]?t\s+fit|not\s+a\s+fit|does\s+not\s+suit)\b\s*[:\-–—]?/i;

  const fitsMatch = fitsHeading.exec(raw);
  const doesNotFitMatch = doesNotFitHeading.exec(raw);

  const fitsRaw = fitsMatch
    ? sliceBetweenHeadings(raw, fitsHeading, [doesNotFitHeading])
    : doesNotFitMatch?.index != null
      ? raw.slice(0, doesNotFitMatch.index).trim()
      : raw;

  const doesNotFitRaw = doesNotFitMatch
    ? sliceBetweenHeadings(raw, doesNotFitHeading, [])
    : "";

  return {
    fitsWell: offerFitItems(fitsRaw, 6),
    doesNotFit: offerFitItems(doesNotFitRaw, 6),
  };
}

function parseDecisionPlan(value: unknown): DecisionView {
  const raw = cleanStructuredPlaybookCopy(value)
    .replace(/^how they make decisions\.?\s*/i, "")
    .trim();

  const fallback: DecisionView = {
    overview: raw ? sentence(raw, 360) : "No profile-specific decision guidance is recorded.",
    yesItems: [],
    hesitateItems: [],
    takeaway: "Use the buyer’s decision logic to frame the conversation at the right level.",
  };

  if (!raw) return fallback;

  const yesHeading = /\bthey\s+say\s+yes\s+when\s*[:\-–—]?/i;
  const hesitateHeading = /\bthey\s+hesitate\s+when\s*[:\-–—]?/i;
  const takeawayHeading = /\bthey\s+don['’]?t\s+buy\b/i;

  const yesMatch = yesHeading.exec(raw);
  const hesitateMatch = hesitateHeading.exec(raw);
  const takeawayMatch = takeawayHeading.exec(raw);

  const firstMarker = [yesMatch?.index, hesitateMatch?.index, takeawayMatch?.index]
    .filter((index): index is number => typeof index === "number")
    .sort((a, b) => a - b)[0];

  const overview = (typeof firstMarker === "number" ? raw.slice(0, firstMarker) : raw).trim();

  const yesRaw = yesMatch
    ? sliceBetweenHeadings(raw, yesHeading, [hesitateHeading, takeawayHeading])
    : "";
  const hesitateRaw = hesitateMatch
    ? sliceBetweenHeadings(raw, hesitateHeading, [takeawayHeading])
    : "";
  const takeaway = takeawayMatch?.index != null
    ? raw.slice(takeawayMatch.index).trim()
    : "";

  const allItems = structuredListItems(raw, 14);
  const yesItems = structuredListItems(yesRaw, 6);
  const hesitateItems = structuredListItems(hesitateRaw, 6);

  return {
    overview: overview || fallback.overview,
    yesItems: yesItems.length ? yesItems : allItems.slice(0, 5),
    hesitateItems: hesitateItems.length
      ? hesitateItems
      : allItems.slice(yesItems.length ? yesItems.length : 5, 10),
    takeaway: takeaway || "Position the offer around the outcome this buyer wants to create, not around incremental fixes.",
  };
}

function normaliseCoreProblemLine(value: string): string {
  return value
    .replace(/^[\s•✓✔✕✗❌➜▸\-–—]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .trim();
}

function isLikelyCoreProblemTitle(value: string): boolean {
  const compact = value.replace(/\s+/g, " ").trim();
  return (
    compact.length >= 3 &&
    compact.length <= 72 &&
    !/[.!?]$/.test(compact) &&
    !/^\s*(?:what|they|this|the|a|an|their|our|you)\b/i.test(compact)
  );
}

function parseCoreBusinessProblems(value: unknown): CoreBusinessProblem[] {
  const raw = cleanStructuredPlaybookCopy(value);
  if (!raw) return [];

  const lines = raw
    .replace(/[•✓✔✕✗❌➜▸]/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z“"])/))
    .map(normaliseCoreProblemLine)
    .filter(Boolean);

  const parsed: CoreBusinessProblem[] = [];

  for (let index = 0; index < lines.length; ) {
    const current = lines[index];
    const next = lines[index + 1];

    const headingMatch = current.match(/^(.{3,72}?)(?:\s*[:–—-]\s+)(.+)$/);
    if (headingMatch) {
      parsed.push({
        title: headingMatch[1].trim(),
        description: headingMatch[2].trim() || null,
      });
      index += 1;
      continue;
    }

    if (isLikelyCoreProblemTitle(current)) {
      const title = current.replace(/:$/, "").trim();
      const description = next && next.length > 18 ? next : null;
      parsed.push({ title, description });
      index += description ? 2 : 1;
      continue;
    }

    parsed.push({
      title: `Commercial pressure ${parsed.length + 1}`,
      description: current,
    });
    index += 1;
  }

  const seen = new Set<string>();
  return parsed
    .filter((item) => {
      const key = `${item.title}::${item.description || ""}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function SectionIcon({ file, alt }: { file: string; alt: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/20 p-2 shadow-inner shadow-cyan-950/20">
      <img src={`${SECTION_ICON_BASE}/${file}`} alt={alt} className="h-full w-full object-contain" />
    </span>
  );
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex gap-4">
      <SectionIcon file={icon} alt="" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white md:text-3xl">{title}</h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{description}</p> : null}
      </div>
    </header>
  );
}

function PageSection({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-8 rounded-[1.6rem] border border-white/10 bg-[#0c1d1a] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.18)] md:p-7 ${className}`}>
      {children}
    </section>
  );
}

function InfoCard({
  label,
  value,
  detail,
  tone = "emerald",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  const style = TONE_STYLE[tone];
  return (
    <article className={`relative overflow-hidden rounded-xl border ${style.border} bg-white p-4 shadow-sm`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${style.top}`} />
      <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${style.label}`}>{label}</p>
      <p className="mt-2 text-base font-extrabold text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p> : null}
    </article>
  );
}

function NarrativeCard({
  eyebrow,
  title,
  content,
  tone = "emerald",
  bullets = false,
}: {
  eyebrow?: string;
  title: string;
  content: unknown;
  tone?: Tone;
  bullets?: boolean;
}) {
  const style = TONE_STYLE[tone];
  const lines = textItems(content);

  return (
    <article className={`relative overflow-hidden rounded-xl border ${style.border} ${style.panel} p-5`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${style.top}`} />
      {eyebrow ? <p className={`text-[10px] font-bold uppercase tracking-[0.17em] ${style.label}`}>{eyebrow}</p> : null}
      <h3 className="mt-2 text-base font-extrabold text-slate-950">{title}</h3>
      {bullets ? (
        <ul className="mt-3 space-y-2.5">
          {lines.map((line, index) => (
            <li key={`${title}-${index}`} className="flex gap-2 text-sm leading-5 text-slate-600">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {lines.map((line, index) => <p key={`${title}-${index}`}>{line}</p>)}
        </div>
      )}
    </article>
  );
}

function FastReadCard({
  title,
  content,
}: {
  title: string;
  content: unknown;
}) {
  return (
    <article className="min-h-[106px] rounded-xl border border-emerald-300/10 bg-[#062c23] px-4 py-3 shadow-inner shadow-black/20">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300">{title}</h3>
      <p className="mt-2 text-[12px] leading-5 text-slate-200/85">{sentence(content, 190)}</p>
    </article>
  );
}

function ProgressBar({ label, value, tone = "emerald", description }: { label: string; value: number; tone?: Tone; description?: string }) {
  const safe = normalisePercent(value);
  const style = TONE_STYLE[tone];
  return (
    <div>
      <div className="flex items-end justify-between gap-4 text-sm">
        <div>
          <p className="font-bold text-slate-900">{label}</p>
          {description ? <p className="mt-1 text-xs leading-4 text-slate-500">{description}</p> : null}
        </div>
        <span className={`font-extrabold ${style.label}`}>{Math.round(safe)}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${style.top}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function Donut({ score }: { score: number }) {
  const safe = normalisePercent(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-extrabold text-slate-950">{Math.round(safe)}%</p>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Call readiness</p>
      </div>
    </div>
  );
}

export default function GedPredictiveSellingPlaybookPage({
  params,
}: {
  params: { token: string };
}) {
  const token = String(params?.token || "").trim();
  const searchParams = useSearchParams();
  const tid = String(searchParams.get("tid") || "").trim();
  const reportRef = useRef<HTMLDivElement>(null);

  const [extendedPayload, setExtendedPayload] = useState<QscExtendedPayload | null>(null);
  const [gedPayload, setGedPayload] = useState<GedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const suffix = tid ? `?tid=${encodeURIComponent(tid)}` : "";
        const [extendedResponse, gedResponse] = await Promise.all([
          fetch(`/api/public/qsc/${encodeURIComponent(token)}/extended${suffix}`, { cache: "no-store" }),
          fetch(`/api/public/ged/${encodeURIComponent(token)}/result${suffix}`, { cache: "no-store" }),
        ]);

        const [extendedJson, gedJson] = await Promise.all([
          extendedResponse.json().catch(() => ({})),
          gedResponse.json().catch(() => ({})),
        ]);

        if (!active) return;

        const extended = extendedJson as QscExtendedPayload;
        const ged = gedJson as GedPayload;

        if (!extendedResponse.ok || extended.ok === false) {
          throw new Error(extended.error || "The Playbook content could not be loaded.");
        }

        setExtendedPayload(extended);
        setGedPayload(gedResponse.ok && ged.ok !== false ? ged : null);
      } catch (loadError: any) {
        if (!active) return;
        setError(String(loadError?.message || "Unexpected error while loading the Playbook."));
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) load();
    else {
      setError("Missing report token.");
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [token, tid]);

  async function handleDownloadPdf() {
    if (!reportRef.current || downloading) return;
    setDownloading(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#06111b",
        windowWidth: reportRef.current.scrollWidth,
      });
      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let position = 0;
      let heightLeft = imageHeight;

      pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`predictive-selling-playbook-${token}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  const result = extendedPayload?.results || gedPayload?.results || null;
  const extended = extendedPayload?.extended || null;
  const taker = extendedPayload?.taker || gedPayload?.taker || null;
  const diagnostic = gedPayload?.ged?.engine_diagnostic || null;

  const profile = useMemo(() => {
    const personality = formatProfilePart(result?.primary_personality || extended?.personality_label);
    const mindset = formatProfilePart(result?.primary_mindset || extended?.mindset_label);
    const stored = safeText(extended?.persona_label || extended?.profile_code || "", "");
    return stored || [personality, mindset].filter(Boolean).join(" ") || "Quantum Profile";
  }, [extended?.mindset_label, extended?.persona_label, extended?.personality_label, extended?.profile_code, result?.primary_mindset, result?.primary_personality]);

  const personality = useMemo<PersonalityKey | null>(() => {
    const raw = String(result?.primary_personality || extended?.personality_label || "").trim().toUpperCase();
    return raw === "FIRE" || raw === "FLOW" || raw === "FORM" || raw === "FIELD" ? raw : null;
  }, [extended?.personality_label, result?.primary_personality]);

  const mindset = useMemo<MindsetKey | null>(() => {
    const raw = String(result?.primary_mindset || extended?.mindset_label || "").trim().toUpperCase();
    return raw === "ORIGIN" || raw === "MOMENTUM" || raw === "VECTOR" || raw === "ORBIT" || raw === "QUANTUM" ? raw : null;
  }, [extended?.mindset_label, result?.primary_mindset]);

  const fullName = getName(taker);
  const company = safeText(taker?.company, "");
  const role = safeText(taker?.role_title, "");
  const completedOn = formatDate(result?.created_at);
  const nextStepsHref = safeText(gedPayload?.link?.next_steps_url || gedPayload?.link?.redirect_url, "");
  const readiness = normalisePercent(diagnostic?.scores?.scale_readiness);
  const callReadiness = Math.round((readiness + (100 - normalisePercent(diagnostic?.scores?.founder_dependency))) / 2);
  const decisionStyle = sentence(extended?.how_they_make_decisions, 115);
  const buyerMode = sentence(extended?.what_offer_ready_for, 115);
  const compactDecision = compactDecisionStyle(extended?.how_they_make_decisions);
  const compactBuyer = compactBuyerMode(extended?.what_offer_ready_for);
  const personalityLabel = personality ? PERSONALITY_LABELS[personality] : safeText(extended?.personality_label, "Not recorded");
  const mindsetLabel = mindset ? MINDSET_LABELS[mindset] : safeText(extended?.mindset_label, "Not recorded");
  const frameworkLabel = mindsetLabel || "—";
  const strategicPriorities = uniqueStrings([
    firstAction(diagnostic?.action_plan),
    diagnostic?.primary_bottleneck?.first_fix || "",
    diagnostic?.recommended_next_step?.title || "",
  ]).slice(0, 3);

  const combinedPattern = useMemo(
    () =>
      parseCombinedQuantumPattern(extended?.combined_quantum_pattern, {
        realWorldExample: extended?.real_life_example,
        vulnerability:
          diagnostic?.primary_bottleneck?.summary ||
          diagnostic?.core_constraint?.summary ||
          extended?.core_business_problems,
        positioningLine:
          diagnostic?.recommended_next_step?.summary ||
          diagnostic?.primary_bottleneck?.first_fix ||
          extended?.how_to_communicate,
      }),
    [
      diagnostic?.core_constraint?.summary,
      diagnostic?.primary_bottleneck?.first_fix,
      diagnostic?.primary_bottleneck?.summary,
      diagnostic?.recommended_next_step?.summary,
      extended?.combined_quantum_pattern,
      extended?.core_business_problems,
      extended?.how_to_communicate,
      extended?.real_life_example,
    ]
  );

  const fastReadWhatTheyNeed =
    diagnostic?.primary_bottleneck?.first_fix ||
    diagnostic?.recommended_next_step?.summary ||
    extended?.core_business_problems ||
    extended?.what_offer_ready_for;

  const communication = useMemo(
    () =>
      parseCommunicationPlan(
        extended?.how_to_communicate,
        extended?.what_blocks_sale,
        extended?.micro_scripts
      ),
    [extended?.how_to_communicate, extended?.micro_scripts, extended?.what_blocks_sale]
  );


  const trustPlan = useMemo(
    () =>
      parseTrustPlan(
        extended?.what_builds_trust,
        extended?.what_blocks_sale,
        extended?.micro_scripts
      ),
    [extended?.micro_scripts, extended?.what_blocks_sale, extended?.what_builds_trust]
  );

  const decisionPlan = useMemo(
    () => parseDecisionPlan(extended?.how_they_make_decisions),
    [extended?.how_they_make_decisions]
  );

  const coreBusinessProblems = useMemo(
    () => parseCoreBusinessProblems(extended?.core_business_problems),
    [extended?.core_business_problems]
  );

  const offerFitPlan = useMemo(
    () => parseOfferFitPlan(extended?.what_offer_ready_for),
    [extended?.what_offer_ready_for]
  );

  // The signed-off Playbook index begins with the detailed intelligence
  // sections. Fast Read is intentionally not repeated here because it sits
  // immediately above this navigation panel.
  const reportIndex = [
    ["personality", "Their Personality Layer"],
    ["mindset", "Their Mindset Layer"],
    ["quantum-profile", "Understand The Quantum Profile"],
    ["combined-pattern", "Combined Quantum Pattern"],
    ["communicate", "How To Communicate"],
    ["decisions", "How They Make Decisions"],
    ["problems", "Their Core Business Problems"],
    ["trust", "What Builds Trust"],
    ["offer", "What Offer They Are Ready For"],
    ["blockers", "What Blocks The Sale"],
    ["pre-call", "Pre Call Questions"],
    ["scripts", "Micro Scripts"],
    ["flags", "Green Flag & Red Flag"],
    ["example", "Real Life Examples"],
    ["next-step", "Recommended Next Steps"],
    ["follow-up", "Follow Up Guidance"],
    ["final-summary", "Final Sale Summary"],
  ] as const;

  const handleReportIndexNextSteps = () => {
    if (nextStepsHref) {
      window.location.assign(nextStepsHref);
      return;
    }

    document.getElementById("next-step")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#06111b] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Growth Engine Diagnostic</p>
          <h1 className="mt-3 text-3xl font-extrabold">Preparing your Predictive Selling Playbook…</h1>
        </main>
      </div>
    );
  }

  if (error || !result || !extended) {
    return (
      <div className="relative min-h-screen bg-[#06111b] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Predictive Selling Playbook</p>
          <h1 className="mt-3 text-3xl font-extrabold">We could not prepare this Playbook</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            This internal report needs a completed QSC result and a matching entrepreneur extended-report record.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-300">{error || "Extended report content was not available."}</pre>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06111b] text-slate-900">
      <AppBackground />
      <main ref={reportRef} className="relative mx-auto max-w-[1440px] space-y-7 px-3 py-4 md:space-y-9 md:px-6 md:py-7">
        <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0c1d1a] text-white shadow-2xl shadow-black/30">
          <header className="border-b border-white/10 bg-[#14483f] px-5 py-4 md:px-7 md:py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/15 p-2">
                  <img
                    src="/ged/report-icons/section-icons/profiletest.ai-Insignia.png"
                    alt="ProfileTest.ai"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div>
                  <p className="text-xl font-extrabold uppercase tracking-[0.18em] text-white md:text-2xl">
                    Predictive Selling Playbook
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                    <span>Growth Engine Diagnostic</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 normal-case tracking-normal text-white/75">
                      Powered by ProfileTest.ai
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="min-w-[132px] rounded-xl border border-white/25 bg-white/[0.04] px-3 py-2.5">
                  <p className="text-[9px] text-white/50">Prepared for</p>
                  <p className="mt-1 font-bold text-white">{fullName}</p>
                </div>
                <div className="min-w-[120px] rounded-xl border border-white/25 bg-white/[0.04] px-3 py-2.5">
                  <p className="text-[9px] text-white/50">Date</p>
                  <p className="mt-1 font-bold text-white">{completedOn}</p>
                </div>
                <div className="min-w-[104px] rounded-xl border border-white/25 bg-white/[0.04] px-3 py-2.5">
                  <p className="text-[9px] text-white/50">Framework</p>
                  <p className="mt-1 font-bold text-white">{frameworkLabel}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
                >
                  {downloading ? "Preparing PDF…" : "Download PDF"}
                </button>
                {nextStepsHref ? (
                  <a
                    href={nextStepsHref}
                    className="rounded-lg bg-gradient-to-r from-cyan-400 to-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:from-cyan-300 hover:to-indigo-500"
                  >
                    Next steps
                  </a>
                ) : null}
              </div>
            </div>
          </header>

          <div className="p-5 md:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.22fr)_minmax(320px,0.78fr)] lg:items-start">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">{fullName}</h1>
                <p className="mt-1 text-sm text-white/70">{[role, company].filter(Boolean).join(" · ") || "Completed diagnostic"}</p>

                <div className="mt-5 max-w-2xl border-l-4 border-emerald-400 pl-4 text-sm font-medium leading-6 text-white/90">
                  An advisor-only guide to how this buyer thinks, communicates, decides and buys — built to be read before the call, not during it.
                </div>

                <div className="mt-5 grid max-w-xl gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Buyer profile</p>
                    <p className="mt-1 text-lg font-extrabold text-emerald-300">{profile}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Report type</p>
                    <p className="mt-1 text-sm font-extrabold text-emerald-300">Internal Sales Intelligence</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-xl border border-emerald-300/25 bg-[#164d42] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Personality layer</p>
                  <p className="mt-1 text-base font-extrabold text-white">{personalityLabel}</p>
                </article>
                <article className="rounded-xl border border-emerald-300/25 bg-[#164d42] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Mindset layer</p>
                  <p className="mt-1 text-base font-extrabold text-white">{mindsetLabel}</p>
                </article>
                <article className="rounded-xl border border-emerald-300/25 bg-[#164d42] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Decision style</p>
                  <p className="mt-1 text-base font-extrabold text-white">{compactDecision}</p>
                </article>
                <article className="rounded-xl border border-emerald-300/25 bg-[#164d42] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Buyer mode</p>
                  <p className="mt-1 text-base font-extrabold leading-5 text-white">{compactBuyer}</p>
                </article>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-white/10 bg-white/[0.12] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Business stage</p>
                <p className="mt-2 text-sm font-extrabold text-white">{safeText(diagnostic?.business_stage?.label, "Not recorded")}</p>
                <p className="mt-2 text-xs leading-5 text-white/70">{safeText(diagnostic?.business_stage?.summary, "No qualifying answer recorded.")}</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-white/[0.12] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Core constraint</p>
                <p className="mt-2 text-sm font-extrabold text-white">{safeText(diagnostic?.core_constraint?.label, "Not recorded")}</p>
                <p className="mt-2 text-xs leading-5 text-white/70">{safeText(diagnostic?.core_constraint?.summary, "No qualifying answer recorded.")}</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-white/[0.12] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Scale readiness</p>
                <p className="mt-2 text-sm font-extrabold text-white">{safeText(diagnostic?.scale_readiness_signal?.label || diagnostic?.scale_readiness_level, `${Math.round(readiness)}%`)}</p>
                <p className="mt-2 text-xs leading-5 text-white/70">{safeText(diagnostic?.scale_readiness_signal?.summary, "Current readiness signal from the Growth Engine Diagnostic.")}</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-white/[0.12] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Strategic self-diagnosis</p>
                <p className="mt-2 text-xs leading-5 text-white/80">{safeText(diagnostic?.self_diagnosis, "No self-diagnosis was recorded.")}</p>
              </article>
            </div>
          </div>
        </section>

        <PageSection
          id="fast-read"
          className="border-emerald-300/10 bg-[linear-gradient(135deg,rgba(255,138,61,0.12),rgba(45,212,191,0.12))]"
        >
          <header>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-300">
              Read this before you dial in
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white md:text-xl">
              Fast-Read Sales Summary
            </h2>
          </header>

          <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            <FastReadCard
              title="Who they are"
              content={extended.combined_quantum_pattern || extended.personality_layer}
            />
            <FastReadCard title="How they think" content={extended.personality_layer} />
            <FastReadCard
              title="Where they are now"
              content={diagnostic?.business_stage?.summary || extended.mindset_layer || diagnostic?.scale_readiness_signal?.summary}
            />
            <FastReadCard title="Combined pattern" content={extended.combined_quantum_pattern} />
            <FastReadCard title="How to communicate" content={extended.how_to_communicate} />
            <FastReadCard title="How they decide" content={extended.how_they_make_decisions} />
            <FastReadCard title="What they need" content={fastReadWhatTheyNeed} />
            <FastReadCard title="What blocks the sale" content={extended.what_blocks_sale} />
            <FastReadCard title="Best offer fit" content={extended.what_offer_ready_for} />
          </div>
        </PageSection>

        <div className="grid gap-7 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="h-fit w-full max-w-[240px] rounded-[24px] border border-white/10 bg-[#0c1d1a] p-[15px] text-white xl:sticky xl:top-5">
            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.24em] text-white/80">
              Report Index
            </p>

            <nav className="mt-3 space-y-1.5" aria-label="Playbook report index">
              {reportIndex.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-[9px] border border-white/80 px-3 py-1.5 text-[11px] font-medium leading-4 text-white transition hover:border-emerald-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="mt-4 flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="w-[122px] rounded-[6px] border border-white/10 bg-emerald-400 px-3 py-2 text-[11px] font-bold leading-none text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
              >
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={handleReportIndexNextSteps}
                className="w-[95px] rounded-[6px] bg-gradient-to-r from-orange-300 via-emerald-400 to-emerald-400 px-3 py-2 text-[11px] font-bold leading-none text-slate-950 transition hover:brightness-105"
              >
                Next steps
              </button>
            </div>
          </aside>

          <div className="space-y-7">
            <PageSection id="personality">
              {(() => {
                const personalityView = parsePersonalityLayer(extended.personality_layer);
                const insightItems = personalityView.keyInsights.length
                  ? personalityView.keyInsights
                  : textItems(extended.personality_layer, 4);
                const exampleItems = personalityView.exampleBehaviours.length
                  ? personalityView.exampleBehaviours
                  : textItems(extended.personality_layer, 5).slice(-5);

                return (
                  <>
                    <header className="flex gap-3">
                      <SectionIcon file="personality-layer.png" alt="" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Their personality layer</p>
                        <h2 className="mt-1 text-base font-extrabold text-white md:text-lg">How they think, behave and decide</h2>
                      </div>
                    </header>

                    <div className="mt-5 rounded-2xl bg-white p-5 md:p-7">
                      <div className="max-w-5xl text-sm leading-6 text-slate-800">
                        <p>{personalityView.overview}</p>
                        {personalityView.traits.length ? (
                          <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-800">
                            {personalityView.traits.map((trait, index) => (
                              <li key={`personality-trait-${index}`} className="flex gap-2">
                                <span className="mt-1.5 text-emerald-500">›</span>
                                <span>{trait}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {personalityView.role ? (
                          <p className="mt-2 text-slate-700">{personalityView.role}</p>
                        ) : null}
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <article className="rounded-xl bg-slate-100 p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-500">Key insights</p>
                          <div className="mt-3 space-y-3">
                            {insightItems.slice(0, 3).map((item, index) => (
                              <div key={`personality-insight-${index}`} className="flex gap-2.5">
                                <span className="mt-1 inline-flex h-3 w-3 shrink-0 rounded-full bg-emerald-300" />
                                <p className="text-sm leading-5 text-slate-700">{item}</p>
                              </div>
                            ))}
                            {personalityView.listenFor.length ? (
                              <div className="flex gap-2.5">
                                <span className="mt-1 inline-flex h-3 w-3 shrink-0 rounded-full bg-emerald-300" />
                                <div>
                                  <p className="text-sm font-bold text-slate-950">When you hear this</p>
                                  <p className="mt-1 text-sm leading-5 text-slate-700">{personalityView.listenFor.join(" ")}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </article>

                        <article className="rounded-xl bg-[#0c2a22] p-5 text-white">
                          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-300">Example behaviours</p>
                          <ul className="mt-4 space-y-3">
                            {exampleItems.slice(0, 6).map((item, index) => (
                              <li key={`personality-behaviour-${index}`} className="flex gap-2.5 text-sm leading-5 text-slate-100/90">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </article>
                      </div>
                    </div>
                  </>
                );
              })()}
            </PageSection>

            <PageSection id="mindset">
              {(() => {
                const mindsetView = parseMindsetLayer(extended.mindset_layer);

                const fallbackSignals = uniqueStrings([
                  diagnostic?.business_stage?.summary || "",
                  diagnostic?.scale_readiness_signal?.summary || "",
                ]).slice(0, 3);

                const exampleStatements = mindsetView.exampleStatements.length
                  ? mindsetView.exampleStatements
                  : uniqueStrings([
                      diagnostic?.self_diagnosis || "",
                      diagnostic?.primary_bottleneck?.summary || "",
                    ]).slice(0, 4);

                const perceivedProblems = mindsetView.perceivedProblems.length
                  ? mindsetView.perceivedProblems
                  : uniqueStrings([
                      diagnostic?.self_diagnosis || "",
                      diagnostic?.core_constraint?.label || "",
                      diagnostic?.scale_readiness_signal?.summary || "",
                    ]).slice(0, 5);

                const realProblems = mindsetView.realProblems.length
                  ? mindsetView.realProblems
                  : textItems(extended.core_business_problems, 6);

                const leftStatements = exampleStatements.slice(
                  0,
                  Math.max(1, Math.ceil(exampleStatements.length / 2))
                );
                const rightStatements = exampleStatements.slice(leftStatements.length);

                return (
                  <>
                    <header className="flex items-center gap-3">
                      <SectionIcon file="mindset-layer.png" alt="" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                          Their mindset layer
                        </p>
                        <h2 className="mt-1 text-base font-extrabold text-white md:text-lg">
                          Where they are in their current business journey.
                        </h2>
                      </div>
                    </header>

                    <div className="mt-5 rounded-2xl bg-white p-5 md:p-7">
                      <div className="text-sm leading-5 text-slate-800">
                        <p>{mindsetView.overview}</p>
                        {(mindsetView.focusSignals.length
                          ? mindsetView.focusSignals
                          : fallbackSignals
                        ).length ? (
                          <ul className="mt-2 space-y-1">
                            {(mindsetView.focusSignals.length
                              ? mindsetView.focusSignals
                              : fallbackSignals
                            ).map((signal, index) => (
                              <li key={`mindset-signal-${index}`} className="flex gap-2">
                                <span className="mt-0.5 text-emerald-500">›</span>
                                <span>{signal}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      {exampleStatements.length ? (
                        <div className="mt-6">
                          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-500">
                            Example statements they make
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <article className="rounded-xl bg-[#0c2a22] px-5 py-4">
                              <ul className="space-y-3">
                                {leftStatements.map((statement, index) => (
                                  <li
                                    key={`mindset-example-left-${index}`}
                                    className="flex gap-2.5 text-sm leading-5 text-white/90"
                                  >
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                                    <span>“{statement.replace(/^["“]|["”]$/g, "")}”</span>
                                  </li>
                                ))}
                              </ul>
                            </article>
                            <article className="rounded-xl bg-[#0c2a22] px-5 py-4">
                              <ul className="space-y-3">
                                {(rightStatements.length ? rightStatements : leftStatements).map(
                                  (statement, index) => (
                                    <li
                                      key={`mindset-example-right-${index}`}
                                      className="flex gap-2.5 text-sm leading-5 text-white/90"
                                    >
                                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                                      <span>“{statement.replace(/^["“]|["”]$/g, "")}”</span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </article>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-8 grid gap-5 lg:grid-cols-2">
                        <article>
                          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">
                            What they think the problem is
                          </p>
                          <div className="mt-3 space-y-2">
                            {perceivedProblems.length ? (
                              perceivedProblems.map((problem, index) => (
                                <div
                                  key={`perceived-problem-${index}`}
                                  className="rounded-lg border-l-[3px] border-[#0c2a22] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900"
                                >
                                  {problem}
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border-l-[3px] border-[#0c2a22] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
                                Not recorded.
                              </div>
                            )}
                          </div>
                        </article>

                        <article>
                          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-rose-500">
                            What the real problem is
                          </p>
                          <div className="mt-3 space-y-2">
                            {realProblems.length ? (
                              realProblems.map((problem, index) => (
                                <div
                                  key={`real-problem-${index}`}
                                  className="rounded-lg border-l-[3px] border-rose-500 bg-rose-200/80 px-4 py-3 text-sm font-semibold text-slate-900"
                                >
                                  {problem}
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border-l-[3px] border-rose-500 bg-rose-200/80 px-4 py-3 text-sm font-semibold text-slate-900">
                                Not recorded.
                              </div>
                            )}
                          </div>
                        </article>
                      </div>
                    </div>
                  </>
                );
              })()}
            </PageSection>

            <PageSection id="quantum-profile">
              <header className="flex items-center gap-3">
                <SectionIcon file="understand-quantum-profile.png" alt="" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                    Understand the quantum profile
                  </p>
                  <h2 className="mt-1 text-base font-extrabold text-white md:text-lg">
                    Your Quantum Profile
                  </h2>
                </div>
              </header>

              <div className="mt-5 overflow-hidden rounded-2xl bg-white p-4 md:p-6">
                <div className="flex min-h-[260px] items-center justify-center md:min-h-[300px]">
                  <img
                    src={`${ASSET_BASE}/quantum-profile-graphic.png`}
                    alt="Quantum profile framework showing Fire Origin, Flow Momentum, Form Vector and Field Orbit"
                    className="mx-auto h-auto w-full max-w-[760px] object-contain"
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      code: "FIRE_ORIGIN",
                      profile: "Fire Origin",
                      title: "Activation Entrepreneur",
                      description:
                        "Drives through energy, urgency and visible action. Creates momentum where none exists.",
                      tone: "border-t-orange-500",
                      iconClass: "bg-orange-500",
                      icon: "✦",
                    },
                    {
                      code: "FLOW_MOMENTUM",
                      profile: "Flow Momentum",
                      title: "Adaptive Entrepreneur",
                      description:
                        "Moves with market signals, pivots intelligently and builds through relationships and trust.",
                      tone: "border-t-sky-400",
                      iconClass: "bg-sky-400",
                      icon: "≈",
                    },
                    {
                      code: "FORM_VECTOR",
                      profile: "Form Vector",
                      title: "Structural Entrepreneur",
                      description:
                        "Builds with precision and systems. Creates the operational foundations that scale requires.",
                      tone: "border-t-emerald-500",
                      iconClass: "bg-emerald-500",
                      icon: "◇",
                    },
                    {
                      code: "FIELD_ORBIT",
                      profile: "Field Orbit",
                      title: "Ecosystem Entrepreneur",
                      description:
                        "Creates through networks, positioning and strategic ecosystem building at scale.",
                      tone: "border-t-violet-500",
                      iconClass: "bg-violet-500",
                      icon: "✧",
                    },
                  ].map((card) => {
                    const isPrimary = card.code === `${personality || ""}_${mindset || ""}`;

                    return (
                      <article
                        key={card.code}
                        className={`relative rounded-xl border border-slate-200 border-t-4 ${card.tone} bg-white p-4 shadow-sm`}
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-10 w-10 place-items-center rounded-lg ${card.iconClass} text-lg font-bold text-white`}
                        >
                          {card.icon}
                        </span>
                        <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          {card.profile}
                        </p>
                        <h3 className="mt-1 text-base font-extrabold leading-5 text-slate-950">
                          {card.title}
                        </h3>
                        <p className="mt-3 text-xs leading-5 text-slate-500">{card.description}</p>
                        {isPrimary ? (
                          <span className="mt-3 inline-flex rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white">
                            Your primary
                          </span>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            </PageSection>

            <PageSection id="combined-pattern">
              <SectionHeader
                icon="combined-quantum-pattern.png"
                eyebrow="Their combined quantum pattern"
                title="How their behaviour and mindset interact to create specific patterns."
              />

              <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm md:p-6">
                <p className="max-w-6xl text-sm leading-6 text-slate-700">
                  {combinedPattern.overview}
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <article className="rounded-xl bg-[#0c1d1a] p-5 text-white shadow-inner shadow-black/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                      Real-world example
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {(combinedPattern.realWorldExamples.length
                        ? combinedPattern.realWorldExamples
                        : ["No profile-specific example is recorded."]
                      ).map((item, index) => (
                        <li
                          key={`combined-example-${index}`}
                          className="flex gap-2 text-sm leading-5 text-white/90"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-xl border border-slate-200 bg-slate-100 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-500">
                      Their vulnerability
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {(combinedPattern.vulnerabilities.length
                        ? combinedPattern.vulnerabilities
                        : ["No profile-specific vulnerability is recorded."]
                      ).map((item, index) => (
                        <li
                          key={`combined-vulnerability-${index}`}
                          className="flex gap-2 text-sm leading-5 text-slate-700"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-extrabold text-slate-950">Positioning Line That Works</p>
                  <blockquote className="mt-2 rounded-r-md border-l-2 border-cyan-400 bg-cyan-50 px-4 py-3 text-sm italic leading-6 text-slate-700">
                    {combinedPattern.positioningLine}
                  </blockquote>
                </div>
              </div>
            </PageSection>

            <PageSection id="communicate">
              <header className="flex gap-3">
                <SectionIcon file="how-to-communicate.png" alt="" />
                <div className="min-w-0 pt-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
                    How to communicate
                  </p>
                  <h2 className="mt-1 text-sm font-extrabold leading-5 text-white md:text-base">
                    Tone, language and delivery style that makes them feel understood and safe.
                  </h2>
                </div>
              </header>

              <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm md:p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <article className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-100/75 p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">Do</p>
                    <ul className="mt-3 space-y-2.5">
                      {(communication.doItems.length
                        ? communication.doItems
                        : ["No profile-specific communication guidance is recorded."]
                      ).map((item, index) => (
                        <li key={`communication-do-${index}`} className="flex gap-2 text-sm leading-5 text-slate-700">
                          <span className="mt-0.5 shrink-0 text-base font-bold leading-5 text-emerald-500">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-100/80 p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-rose-400" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-500">Don&apos;t</p>
                    <ul className="mt-3 space-y-2.5">
                      {(communication.dontItems.length
                        ? communication.dontItems
                        : ["No profile-specific communication risks are recorded."]
                      ).map((item, index) => (
                        <li key={`communication-dont-${index}`} className="flex gap-2 text-sm leading-5 text-slate-700">
                          <span className="mt-0.5 shrink-0 text-base font-bold leading-5 text-rose-400">×</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-extrabold text-slate-950">Effective Lines</p>
                  <div className="mt-2 space-y-2">
                    {(communication.effectiveLines.length
                      ? communication.effectiveLines
                      : ["Use the buyer&apos;s own language to frame the next strategic conversation."]
                    ).map((line, index) => (
                      <blockquote
                        key={`communication-line-${index}`}
                        className="rounded-r-md border-l-2 border-cyan-400 bg-cyan-50 px-4 py-3 text-sm italic leading-6 text-slate-700"
                      >
                        “{line.replace(/^['“]|['”]$/g, "")}”
                      </blockquote>
                    ))}
                  </div>
                </div>
              </div>
            </PageSection>

            <PageSection id="decisions">
              <header className="flex items-start gap-3">
                <SectionIcon file="how-they-make-decisions.png" alt="" />
                <div className="pt-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                    How they make decisions
                  </p>
                  <h2 className="mt-1 text-sm font-extrabold leading-6 text-white md:text-base">
                    What helps them say yes, makes them hesitate, and the decision filters they use.
                  </h2>
                </div>
              </header>

              <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm md:p-6">
                <p className="max-w-5xl text-xs leading-5 text-slate-700 md:text-sm md:leading-6">
                  {decisionPlan.overview}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <article className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-100/80 p-4 md:p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                      They say yes when
                    </p>
                    <ul className="mt-3 space-y-2">
                      {(decisionPlan.yesItems.length
                        ? decisionPlan.yesItems
                        : ["The offer is framed around a clear, high-value outcome."]
                      ).map((item, index) => (
                        <li
                          key={`decision-yes-${index}`}
                          className="flex gap-2 text-xs leading-5 text-slate-700 md:text-sm"
                        >
                          <span className="mt-0.5 shrink-0 text-base font-bold leading-5 text-emerald-500">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-100/80 p-4 md:p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-rose-400" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-500">
                      They hesitate when
                    </p>
                    <ul className="mt-3 space-y-2">
                      {(decisionPlan.hesitateItems.length
                        ? decisionPlan.hesitateItems
                        : ["The offer feels unclear, low-confidence or misaligned with the decision they need to make."]
                      ).map((item, index) => (
                        <li
                          key={`decision-hesitate-${index}`}
                          className="flex gap-2 text-xs leading-5 text-slate-700 md:text-sm"
                        >
                          <span className="mt-0.5 shrink-0 text-base font-bold leading-5 text-rose-400">×</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>

                <p className="mt-4 max-w-5xl text-xs leading-5 text-slate-700 md:text-sm md:leading-6">
                  {decisionPlan.takeaway}
                </p>
              </div>
            </PageSection>

            <PageSection id="problems">
              <header className="flex items-start gap-3">
                <SectionIcon file="core-business-problems.png" alt="" />
                <div className="pt-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                    Their core business problems
                  </p>
                  <h2 className="mt-1 text-sm font-extrabold leading-6 text-white md:text-base">
                    The recurring patterns and friction points that show up most often for this buyer.
                  </h2>
                </div>
              </header>

              <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm md:p-5">
                {coreBusinessProblems.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {coreBusinessProblems.map((problem, index) => (
                      <article
                        key={`${problem.title}-${index}`}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 bg-rose-300/75 p-1.5">
                          <img
                            src={`${ASSET_BASE}/business-problems.png`}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </span>
                        <h3 className="mt-3 text-sm font-extrabold text-slate-950">
                          {problem.title}
                        </h3>
                        {problem.description ? (
                          <p className="mt-2 text-xs leading-5 text-slate-600 md:text-sm md:leading-5">
                            {problem.description}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    No profile-specific core business problems have been recorded for this buyer.
                  </p>
                )}
              </div>
            </PageSection>

            <PageSection id="trust" className="p-4 md:p-5">
              <header className="flex items-start gap-3">
                <SectionIcon file="what-builds-trust.png" alt="" />
                <div className="pt-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                    What builds trust
                  </p>
                  <h2 className="mt-1 text-sm font-extrabold leading-6 text-white md:text-base">
                    Signals, proof and experiences that help them feel safe moving forward with you.
                  </h2>
                </div>
              </header>

              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm md:p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-xl border border-emerald-200 bg-emerald-100/90 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                      Build trust through
                    </p>
                    {trustPlan.buildItems.length ? (
                      <ul className="mt-3 space-y-2">
                        {trustPlan.buildItems.map((item, index) => (
                          <li
                            key={`trust-build-${index}`}
                            className="flex gap-2 text-xs leading-5 text-slate-700 md:text-sm"
                          >
                            <span className="font-bold text-emerald-500" aria-hidden="true">
                              ✓
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        No profile-specific trust signals have been recorded.
                      </p>
                    )}
                  </article>

                  <article className="rounded-xl border border-rose-200 bg-rose-100/90 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-500">
                      Break trust through
                    </p>
                    {trustPlan.breakItems.length ? (
                      <ul className="mt-3 space-y-2">
                        {trustPlan.breakItems.map((item, index) => (
                          <li
                            key={`trust-break-${index}`}
                            className="flex gap-2 text-xs leading-5 text-slate-700 md:text-sm"
                          >
                            <span className="font-bold text-rose-500" aria-hidden="true">
                              ✕
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        No profile-specific trust risks have been recorded.
                      </p>
                    )}
                  </article>
                </div>

                {trustPlan.effectiveLine ? (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                      Effective line
                    </p>
                    <blockquote className="mt-2 rounded-md border-l-2 border-cyan-400 bg-cyan-50 px-3 py-2 text-xs italic leading-5 text-slate-700 md:text-sm">
                      “{trustPlan.effectiveLine}”
                    </blockquote>
                  </div>
                ) : null}
              </div>
            </PageSection>

            <PageSection id="offer">
              <SectionHeader
                icon="what-offer-they-are-ready.png"
                eyebrow="What offer they are ready for"
                title="The pricing, structure and level of support most likely to help them say yes and get results"
              />

              <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm md:p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-xl border border-emerald-200 bg-emerald-100/90 p-4 md:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-600">Fits well</p>
                    {offerFitPlan.fitsWell.length ? (
                      <ul className="mt-3 space-y-2">
                        {offerFitPlan.fitsWell.map((item, index) => (
                          <li
                            key={`offer-fit-${index}`}
                            className="flex gap-2 text-xs leading-5 text-slate-700 md:text-sm"
                          >
                            <span className="font-bold text-emerald-500" aria-hidden="true">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        No profile-specific offer-fit guidance has been recorded.
                      </p>
                    )}
                  </article>

                  <article className="rounded-xl border border-rose-200 bg-rose-100/90 p-4 md:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-rose-500">Does not fit</p>
                    {offerFitPlan.doesNotFit.length ? (
                      <ul className="mt-3 space-y-2">
                        {offerFitPlan.doesNotFit.map((item, index) => (
                          <li
                            key={`offer-misfit-${index}`}
                            className="flex gap-2 text-xs leading-5 text-slate-700 md:text-sm"
                          >
                            <span className="font-bold text-rose-500" aria-hidden="true">✕</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        No profile-specific mismatch guidance has been recorded.
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </PageSection>

            <PageSection id="blockers">
              <SectionHeader icon="what-block-sale.png" eyebrow="What blocks the sale completely" title="Fear triggers, misalignments and role perceptions to watch" />
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
                <NarrativeCard title="Complete sale blockers" content={extended.what_blocks_sale} tone="rose" bullets />
              </div>
            </PageSection>

            <PageSection id="pre-call">
              <SectionHeader icon="pre-call-questions.png" eyebrow="Pre-call questions" title="Conversation starters that unlock the real strategic gap" />
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {textItems(extended.pre_call_questions, 5).map((item, index) => (
                  <article key={`question-${index}`} className="rounded-xl bg-white p-5 shadow-sm">
                    <p className="text-xs font-extrabold text-emerald-600">{String(index + 1).padStart(2, "0")}</p>
                    <p className="mt-3 text-sm font-bold leading-6 text-slate-950">{item}</p>
                  </article>
                ))}
              </div>
            </PageSection>

            <PageSection id="scripts">
              <SectionHeader icon="micro-scripts-section.png" eyebrow="Their micro scripts" title="Short lines that keep your language at the right strategic altitude" />
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {textItems(extended.micro_scripts, 6).map((item, index) => (
                  <blockquote key={`script-${index}`} className="rounded-xl border border-cyan-200 bg-cyan-50 p-5 text-base font-bold leading-7 text-slate-800">“{item.replace(/^“|”$/g, "")}”</blockquote>
                ))}
              </div>
            </PageSection>

            <PageSection id="flags">
              <SectionHeader icon="green-red-flag.png" eyebrow="Green & red flags" title="What signals fit, and what signals a need to pause or reframe" />
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <NarrativeCard eyebrow="Green flags" title="Signals of stronger fit" content={splitFlags(extended.green_red_flags).green.join("\n")} tone="emerald" bullets />
                <NarrativeCard eyebrow="Red flags" title="Pause, qualify or reframe" content={splitFlags(extended.green_red_flags).red.join("\n") || extended.what_blocks_sale} tone="rose" bullets />
              </div>
            </PageSection>

            <PageSection id="example">
              <SectionHeader icon="real-life-example.png" eyebrow="Real-life example" title="A narrative to hold in mind when speaking to this profile" />
              <div className="mt-6 rounded-2xl bg-white p-6">
                <NarrativeCard title="What this can sound like in the real world" content={extended.real_life_example} tone="cyan" />
              </div>
            </PageSection>

            <PageSection id="next-step">
              <SectionHeader icon="recommended-next-step.png" eyebrow="Recommended next step" title="What to offer, and how to position it" />
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <NarrativeCard title={safeText(diagnostic?.recommended_next_step?.title, "Lead with the highest-leverage next move")} content={diagnostic?.recommended_next_step?.summary || diagnostic?.primary_bottleneck?.first_fix} tone="emerald" />
                <article className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-orange-600">How to position it</p>
                  <p className="mt-2 text-base font-extrabold text-slate-950">Use their diagnosed constraint as the opening frame.</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {strategicPriorities.map((item, index) => <li key={`priority-${index}`} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />{item}</li>)}
                  </ul>
                </article>
              </div>
            </PageSection>

            <PageSection id="follow-up">
              <SectionHeader icon="follow-up-guidance.png" eyebrow="Follow-up guidance" title="How to keep the message relevant after the call" description="This section uses the existing communication, trust and blocker intelligence. It does not introduce new profile content." />
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <NarrativeCard eyebrow="What works" title="Anchor the follow-up in the strategic insight" content={uniqueStrings([sentence(extended.what_builds_trust), sentence(extended.how_to_communicate), sentence(diagnostic?.recommended_next_step?.summary)]).join("\n")} tone="emerald" bullets />
                <NarrativeCard eyebrow="What kills the follow-up" title="Do not repeat the blockers in a new format" content={extended.what_blocks_sale} tone="rose" bullets />
              </div>
            </PageSection>

            <PageSection id="final-summary">
              <SectionHeader icon="final-summary.png" eyebrow="Final sale summary" title="The short version to hold in mind before you design the offer" />
              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
                <article className="rounded-2xl bg-gradient-to-br from-emerald-100 via-cyan-50 to-violet-100 p-7">
                  <p className="text-sm leading-7 text-slate-800">{safeText(extended.final_summary)}</p>
                </article>
                <article className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center">
                  <Donut score={callReadiness} />
                  <p className="mt-1 text-base font-extrabold text-slate-950">{safeText(diagnostic?.urgency?.label, "Strategic call priority")}</p>
                  <p className="mt-1 text-sm text-slate-600">{safeText(diagnostic?.urgency?.window, "Use the Playbook to prepare the next conversation.")}</p>
                </article>
              </div>
            </PageSection>
          </div>
        </div>

        <footer className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0c1d1a] px-5 py-4 text-xs text-slate-300 md:flex-row md:items-center md:justify-between">
          <span>ProfileTest.ai · Predictive Selling Playbook</span>
          <span>Confidential internal sales intelligence · {fullName}</span>
        </footer>
      </main>
    </div>
  );
}