/**
 * Insider Insights content extractor.
 *
 * Parses the four master source reports (docs/insider-insights-source/report-
 * {A,B,C,D}-*.txt) into structured, verbatim content keyed by the Content ID
 * scheme from build-delivery-guide-source.txt §39, and writes the result to
 * apps/web/lib/inevitable-standard/content/insiderInsights.data.json.
 *
 * Why a parser and not hand-transcription: the four masters run to ~11,000
 * lines and ~1,500+ discrete content fields. A deterministic parser is
 * verbatim-faithful by construction (no retyping risk) and its output is
 * checkable by count against the guide's §14 coverage table. Re-run this
 * script whenever the master .txt files change.
 *
 * Usage: npx tsx scripts/insider-insights/extract.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SOURCE_DIR = join(__dirname, "../../docs/insider-insights-source");
const OUT_PATH = join(
  __dirname,
  "../../apps/web/lib/inevitable-standard/content/insiderInsights.data.json",
);

const REPORTS = [
  { code: "A", approach: "FUTURE_LED", file: "report-A-future-led-source.txt" },
  { code: "B", approach: "CONNECTION_LED", file: "report-B-connection-led-source.txt" },
  { code: "C", approach: "TIMING_LED", file: "report-C-timing-led-source.txt" },
  { code: "D", approach: "EVIDENCE_LED", file: "report-D-evidence-led-source.txt" },
] as const;

const PILLARS = [
  "IDENTITY",
  "POSITIONING",
  "OFFER",
  "SALES",
  "REVENUE_MODEL",
  "DECISION",
] as const;
const STATES = ["GREEN", "AMBER", "RED"] as const;
const SECONDARY_CODES = [
  "FUTURE_LED",
  "CONNECTION_LED",
  "TIMING_LED",
  "EVIDENCE_LED",
  "BALANCED",
] as const;

/* -------------------------------------------------------------------------- */
/* Generic heading-tree parser                                                 */
/* -------------------------------------------------------------------------- */

type Node = {
  level: number;
  title: string;
  normTitle: string;
  contentId: string | null;
  body: string;
  children: Node[];
  parent: Node | null;
};

function normalise(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normTitleKey(s: string): string {
  return normalise(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanBody(lines: string[]): string {
  const kept: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/^\|\s*-{2,}/.test(trimmed)) continue; // table separator row
    let line = normalise(trimmed);
    // Single-cell callout/table rows ("| **LABEL** text |") lose their
    // decorative outer pipes; genuine multi-column table rows (risk-signal
    // tables) keep theirs so extractRiskSignals can still split on "|".
    if (line.startsWith("|") && line.endsWith("|")) {
      const pipeCount = (line.match(/\|/g) || []).length;
      if (pipeCount === 2) line = line.slice(1, -1).trim();
    }
    kept.push(line);
  }
  return kept.join("\n\n");
}

/** Parses markdown-ish heading structure (#, ##, ###) into a tree. */
function parseDocument(text: string): Node {
  const lines = text.split(/\r?\n/);
  const root: Node = {
    level: 0,
    title: "ROOT",
    normTitle: "root",
    contentId: null,
    body: "",
    children: [],
    parent: null,
  };
  const stack: Node[] = [root];
  let bodyLines: string[] = [];
  let current: Node = root;

  function flush() {
    current.body = cleanBody(bodyLines);
    bodyLines = [];
  }

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      const title = normalise(heading[2]).replace(/^\d+\.\s*/, "");
      const node: Node = {
        level,
        title,
        normTitle: normTitleKey(title),
        contentId: null,
        body: "",
        children: [],
        parent,
      };
      parent.children.push(node);
      stack.push(node);
      current = node;
      continue;
    }

    const cid = /^\*\*CONTENT ID:\s*([A-Z0-9_.\-]+)\*\*\s*$/.exec(line.trim());
    if (cid && bodyLines.every((l) => !l.trim())) {
      current.contentId = cid[1];
      continue;
    }

    bodyLines.push(line);
  }
  flush();
  return root;
}

/** Depth-first search for the first descendant whose normalised title matches. */
function find(node: Node, matcher: (n: Node) => boolean): Node | null {
  for (const child of node.children) {
    if (matcher(child)) return child;
    const nested = find(child, matcher);
    if (nested) return nested;
  }
  return null;
}

function findAll(node: Node, matcher: (n: Node) => boolean): Node[] {
  const out: Node[] = [];
  for (const child of node.children) {
    if (matcher(child)) out.push(child);
    out.push(...findAll(child, matcher));
  }
  return out;
}

function titleIncludes(node: Node, ...phrases: string[]): boolean {
  return phrases.every((p) => node.normTitle.includes(normTitleKey(p)));
}

function child(node: Node | null, ...phrases: string[]): Node | null {
  if (!node) return null;
  return node.children.find((c) => titleIncludes(c, ...phrases)) ?? null;
}

function text(node: Node | null | undefined): string | null {
  return node && node.body ? node.body : null;
}

/**
 * A provenance paragraph the master documents append to prose blocks — e.g.
 * "SOURCE ANCHOR Chapter Two, The Identity Gap; …" or "CONTENT ID: II-A-…".
 * These must never reach a rendered field.
 */
const PROVENANCE_PARAGRAPH = /^\s*(SOURCE ANCHOR|CONTENT ID)\b/i;

/**
 * Recursively strip every provenance paragraph from every string in `node`.
 * Where the containing object carries a `sourceAnchor` slot the stripped text is
 * moved there; everything else is collected into `sink` so the approach keeps a
 * complete, non-rendered `provenance` record. Mutates `node` in place.
 */
function hoistProvenance(node: unknown, sink: string[]): unknown {
  if (typeof node === "string") {
    const kept: string[] = [];
    for (const para of node.split(/\n{2,}/)) {
      if (PROVENANCE_PARAGRAPH.test(para)) sink.push(para.trim());
      else kept.push(para);
    }
    return kept.join("\n\n").trim();
  }
  if (Array.isArray(node)) {
    return node.map((item) => hoistProvenance(item, sink));
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const hasAnchorSlot = "sourceAnchor" in obj;
    const local: string[] = [];
    for (const key of Object.keys(obj)) {
      if (key === "sourceAnchor") continue;
      obj[key] = hoistProvenance(obj[key], hasAnchorSlot ? local : sink);
    }
    if (hasAnchorSlot) {
      const existing =
        typeof obj.sourceAnchor === "string" ? [obj.sourceAnchor] : [];
      const unique = [...new Set([...existing, ...local].map((s) => s.trim()).filter(Boolean))];
      obj.sourceAnchor = unique.length ? unique.join("\n\n") : null;
      for (const anchor of local) sink.push(anchor);
    }
    return obj;
  }
  return node;
}

/**
 * Body text with any bullet list flattened to a single paragraph. Some reports
 * write a section as prose and others as a `* ` / `• ` list (e.g. D's adviser
 * green/red flags); this normalises both to the prose shape the data layer
 * expects.
 */
function prose(node: Node | null | undefined): string | null {
  const body = text(node);
  if (!body) return body;
  const paragraphs = body.split("\n\n").map((p) => p.trim()).filter(Boolean);
  const hasBullets = paragraphs.some((p) => /^[•\-*]\s+/.test(p));
  if (!hasBullets) return body;
  const flattened = paragraphs.map((p) => p.replace(/^[•\-*]\s+/, "").trim());
  return flattened.length ? flattened.join(" ") : null;
}

/* -------------------------------------------------------------------------- */
/* PILLAR_KEY <-> title text mapping                                           */
/* -------------------------------------------------------------------------- */

const PILLAR_TITLE: Record<(typeof PILLARS)[number], string> = {
  IDENTITY: "Identity",
  POSITIONING: "Positioning",
  OFFER: "Offer",
  SALES: "Sales",
  REVENUE_MODEL: "Revenue Model",
  DECISION: "Decision",
};

function pillarFromTitleFragment(fragment: string): (typeof PILLARS)[number] | null {
  const norm = normTitleKey(fragment);
  for (const p of PILLARS) {
    if (normTitleKey(PILLAR_TITLE[p]) === norm) return p;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Family extractors                                                           */
/* -------------------------------------------------------------------------- */

type Issues = string[];

function extractCoreProfile(root: Node, reportCode: string, issues: Issues) {
  const coreSection = find(root, (n) => n.level === 1 && titleIncludes(n, "core") && titleIncludes(n, "insider profile"));
  const howThink = find(root, (n) => n.level === 1 && n.normTitle === "6 how they think") ?? find(root, (n) => n.level === 1 && titleIncludes(n, "how they think"));
  const howDecide = find(root, (n) => n.level === 1 && titleIncludes(n, "how they decide"));
  const howBuy = find(root, (n) => n.level === 1 && titleIncludes(n, "how they buy"));
  const priceValue = find(root, (n) => n.level === 1 && titleIncludes(n, "price") && titleIncludes(n, "value"));
  const trustBuilders = find(root, (n) => n.level === 1 && titleIncludes(n, "what builds trust"));
  const trustReducers = find(root, (n) => n.level === 1 && titleIncludes(n, "what reduces trust"));
  const communication = find(root, (n) => n.level === 1 && (titleIncludes(n, "communication style") || titleIncludes(n, "how to communicate with them")));
  const coachingStyle = find(root, (n) => n.level === 1 && titleIncludes(n, "how to coach"));
  const challenge = find(root, (n) => n.level === 1 && n.normTitle.startsWith("14 how to challenge") || (n.level === 1 && titleIncludes(n, "how to challenge them")));
  const notAssume = find(root, (n) => n.level === 1 && titleIncludes(n, "what not to assume") && !titleIncludes(n, "pillar"));

  if (!coreSection) issues.push(`[${reportCode}] core profile section not found`);
  if (!howThink) issues.push(`[${reportCode}] How They Think not found`);
  if (!howDecide) issues.push(`[${reportCode}] How They Decide not found`);
  if (!howBuy) issues.push(`[${reportCode}] How They Buy not found`);
  if (!priceValue) issues.push(`[${reportCode}] Price/Value not found`);
  if (!trustBuilders) issues.push(`[${reportCode}] Trust Builders not found`);
  if (!trustReducers) issues.push(`[${reportCode}] Trust Reducers not found`);
  if (!communication) issues.push(`[${reportCode}] Communication style not found`);
  if (!coachingStyle) issues.push(`[${reportCode}] Coaching style not found`);

  return {
    contentId: coreSection?.contentId ?? null,
    whatApproachMeansInternally: text(child(coreSection, "what") && child(coreSection, "means internally")) ?? text(coreSection?.children[0]),
    whatTheyNaturallyNotice: text(child(coreSection, "what they naturally notice")),
    whatMotivatesThem: text(child(coreSection, "what motivates them")),
    behaviourUnderPressure: text(child(coreSection, "behaviour under pressure")),
    howTheyThink: text(howThink),
    howTheyDecide: text(howDecide),
    howTheyBuy: text(howBuy),
    priceAndValue: text(priceValue),
    trustBuilders: text(trustBuilders),
    trustReducers: text(trustReducers),
    communicationStyle: text(communication),
    coachingStyle: text(coachingStyle),
    challengeGuidance: text(challenge),
    whatNotToAssumeGeneral: text(notAssume),
  };
}

function extractSecondaryInfluences(
  root: Node,
  reportCode: string,
  ownApproach: string,
  issues: Issues,
) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "secondary influence variants"));
  const out: Record<string, any> = {};
  if (!section) {
    issues.push(`[${reportCode}] secondary influence variants section not found`);
    return out;
  }
  for (const secCode of SECONDARY_CODES) {
    if (secCode === ownApproach) continue; // a report's own approach cannot be its secondary
    const label = secCode === "BALANCED" ? "Balanced" : PILLAR_TITLE_FOR_APPROACH(secCode);
    // The heading is "{Primary}-Led + {Secondary}"; match on the suffix so
    // e.g. "Future-Led" doesn't also match inside "Future-Led + Connection-Led".
    const node = section.children.find((c) => c.level === 2 && c.normTitle.endsWith(normTitleKey(label)));
    if (!node) {
      issues.push(`[${reportCode}] secondary influence variant missing: ${secCode}`);
      continue;
    }
    const buying = child(node, "buying implication");
    const coaching = child(node, "coaching implication");
    out[secCode] = {
      contentId: node.contentId,
      intro: node.body || null,
      buyingImplication: text(buying),
      coachingImplication: text(coaching),
    };
  }
  return out;
}

function APPROACH_LABEL(code: string): string {
  return (
    {
      FUTURE_LED: "Future-Led",
      CONNECTION_LED: "Connection-Led",
      TIMING_LED: "Timing-Led",
      EVIDENCE_LED: "Evidence-Led",
    } as Record<string, string>
  )[code];
}
function PILLAR_TITLE_FOR_APPROACH(code: string): string {
  return APPROACH_LABEL(code);
}

const PILLAR_STATE_FIELD_MATCHERS: Array<{ key: string; phrases: string[] }> = [
  { key: "whatThisResultTellsYou", phrases: ["what this result tells you"] },
  { key: "howApproachShapesIt", phrases: ["is likely to shape it"] },
  { key: "howThisAffectsThinking", phrases: ["affect how they think"] },
  { key: "howThisAffectsDeciding", phrases: ["affect how they decide"] },
  { key: "howThisAffectsBuying", phrases: ["affect how they buy"] },
  { key: "howToCommunicate", phrases: ["how to communicate this result"] },
  { key: "whatToListenFor", phrases: ["what to listen for"] },
  { key: "whatToChallenge", phrases: ["what to challenge"] },
  { key: "whatNotToAssume", phrases: ["what not to assume"] },
  { key: "sellingImplication", phrases: ["selling implication"] },
  { key: "coachingImplication", phrases: ["coaching implication"] },
  { key: "commercialConsequence", phrases: ["commercial consequence"] },
];

function extractPillarStateFields(stateNode: Node) {
  const out: Record<string, string | null> = {};
  for (const m of PILLAR_STATE_FIELD_MATCHERS) {
    const found = stateNode.children.find((c) => titleIncludes(c, ...m.phrases));
    out[m.key] = text(found);
  }
  return out;
}

function extractPillarStates(root: Node, reportCode: string, issues: Issues) {
  const out: Record<string, any> = {};
  for (const pillar of PILLARS) {
    const pillarLabel = PILLAR_TITLE[pillar];
    // Master pillar section: "Identity: Dynamic Coaching Intelligence" (A/B/C)
    // or "Identity: Evidence-Led Internal Interpretation" (D).
    const masterSection = find(
      root,
      (n) => n.level === 1 && n.normTitle.startsWith(normTitleKey(pillarLabel) + " ") && (titleIncludes(n, "coaching intelligence") || titleIncludes(n, "internal interpretation")),
    );
    if (!masterSection) {
      issues.push(`[${reportCode}] pillar master section missing: ${pillar}`);
      continue;
    }
    const pillarMasterIntro = masterSection.body || null;
    const commercialRole = text(child(masterSection, "commercial role in the system"));
    const approachCoachingPrinciple = text(
      masterSection.children.find((c) => titleIncludes(c, "coaching principle")) ?? null,
    );

    for (const state of STATES) {
      // "Identity | Green" (A/B/C) or "Identity: Green Internal State" (D)
      const stateNode = masterSection.children.find(
        (c) =>
          c.level === 2 &&
          c.normTitle.startsWith(normTitleKey(pillarLabel)) &&
          c.normTitle.includes(normTitleKey(state)),
      );
      if (!stateNode) {
        issues.push(`[${reportCode}] pillar state block missing: ${pillar}-${state}`);
        continue;
      }
      const fields = extractPillarStateFields(stateNode);
      const sourceAnchor = stateNode.children.find((c) => titleIncludes(c, "source anchor"));
      out[`${pillar}_${state}`] = {
        contentId: stateNode.contentId ?? `II-${reportCode}-PILLAR-${pillar}-${state}`,
        pillarMasterIntro,
        commercialRoleInSystem: commercialRole,
        approachCoachingPrinciple,
        ...fields,
        sourceAnchor: text(sourceAnchor),
      };
    }
  }
  return out;
}

function extractStrongestPillar(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "strongest pillar") && titleIncludes(n, "leverage"));
  const out: Record<string, string | null> = {};
  if (!section) {
    issues.push(`[${reportCode}] strongest pillar section not found`);
    return out;
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, "if", PILLAR_TITLE[pillar], "is strongest"));
    if (!node) issues.push(`[${reportCode}] strongest-pillar block missing: ${pillar}`);
    out[pillar] = text(node);
  }
  return out;
}

const PRIMARY_CONSTRAINT_FIELD_MATCHERS: Array<{ key: string; phrases: string[] }> = [
  { key: "whatIsReallyHappening", phrases: ["what is really happening"] },
  { key: "approachMechanism", phrases: ["mechanism to validate"] },
  { key: "commercialCost", phrases: ["commercial cost"] },
  { key: "conversationObjective", phrases: ["conversation objective"] },
  { key: "coachingPriority", phrases: ["coaching priority"] },
  { key: "likelyBuyingObjectionTheme", phrases: ["likely buying objection theme"] },
];

function extractPrimaryConstraints(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "primary constraint") && titleIncludes(n, "adviser interpretation"));
  const out: Record<string, any> = {};
  if (!section) {
    issues.push(`[${reportCode}] primary constraint section not found`);
    return out;
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, "primary constraint", PILLAR_TITLE[pillar]));
    if (!node) {
      issues.push(`[${reportCode}] primary constraint block missing: ${pillar}`);
      continue;
    }
    const fields: Record<string, string | null> = {};
    for (const m of PRIMARY_CONSTRAINT_FIELD_MATCHERS) {
      fields[m.key] = text(node.children.find((c) => titleIncludes(c, ...m.phrases)));
    }
    const sourceAnchor = node.children.find((c) => titleIncludes(c, "source anchor"));
    out[pillar] = {
      contentId: node.contentId ?? `II-${reportCode}-PRIMARY-${pillar}`,
      ...fields,
      sourceAnchor: text(sourceAnchor),
    };
  }
  return out;
}

/**
 * Parses "{Primary} Primary + {Secondary} Secondary" into its two pillar keys.
 * Anchored to the exact "X Primary + Y Secondary" shape (not loose substring
 * matching) because both pillar names can legitimately appear in the *other*
 * direction's heading too (e.g. "Identity Primary + Positioning Secondary"
 * contains both "Identity" and "Positioning" just like its reverse would) —
 * direction is exactly what the guide says must never be confused.
 */
function parsePairTitle(rawTitle: string): { primary: (typeof PILLARS)[number]; secondary: (typeof PILLARS)[number] } | null {
  const match = /^(.+?)\s+Primary\s*\+\s*(.+?)\s+Secondary$/i.exec(rawTitle.trim());
  if (!match) return null;
  const primary = pillarFromTitleFragment(match[1]);
  const secondary = pillarFromTitleFragment(match[2]);
  if (!primary || !secondary) return null;
  return { primary, secondary };
}

function extractDirectionalPairs(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "all primary") && titleIncludes(n, "secondary constraint combinations"));
  const out: Record<string, any> = {};
  if (!section) {
    issues.push(`[${reportCode}] directional pairs section not found`);
    return out;
  }
  let count = 0;
  const seen = new Set<string>();
  for (const node of section.children) {
    const parsed = parsePairTitle(node.title);
    if (!parsed) {
      issues.push(`[${reportCode}] unparsed directional pair heading: "${node.title}"`);
      continue;
    }
    const { primary, secondary } = parsed;
    const key = `${primary}_${secondary}`;
    if (seen.has(key)) issues.push(`[${reportCode}] duplicate directional pair heading for ${key}`);
    seen.add(key);
    out[key] = {
      contentId: node.contentId ?? `II-${reportCode}-PAIR-${primary}-${secondary}`,
      text: node.body || null,
    };
    count++;
  }
  for (const primary of PILLARS) {
    for (const secondary of PILLARS) {
      if (primary === secondary) continue;
      if (!out[`${primary}_${secondary}`]) {
        issues.push(`[${reportCode}] directional pair missing: ${primary}+${secondary}`);
      }
    }
  }
  if (count !== 30) issues.push(`[${reportCode}] expected 30 directional pairs, found ${count}`);
  return out;
}

function extractFalseConstraints(root: Node, reportCode: string, issues: Issues) {
  const section = find(
    root,
    (n) => n.level === 1 && (titleIncludes(n, "false constraint guidance") || (titleIncludes(n, "false constraint") && titleIncludes(n, "intelligence"))),
  );
  if (!section) {
    issues.push(`[${reportCode}] false constraint section not found`);
    return { core: {}, proposed: [] };
  }

  const CORE_CODES: Array<{ code: string; phrase: string }> = [
    { code: "MORE_LEADS", phrase: "more leads" },
    { code: "PRICE_TOO_HIGH", phrase: "too high" },
    { code: "NEW_OFFER", phrase: "new offer" },
    { code: "BETTER_SYSTEMS", phrase: "better systems" },
  ];

  // A/B/C: core items are direct ## children. D: nested under "## Framework-Supported False Constraints".
  const frameworkContainer = section.children.find((c) => titleIncludes(c, "framework-supported false constraints"));
  const coreParent = frameworkContainer ?? section;

  const core: Record<string, any> = {};
  for (const { code, phrase } of CORE_CODES) {
    const node = coreParent.children.find((c) => c.normTitle.includes(normTitleKey(phrase)) && !c.normTitle.includes("proposed"));
    if (!node) {
      issues.push(`[${reportCode}] core False Constraint missing: ${code}`);
      continue;
    }
    // A/B/C fold a "DIAGNOSTIC DIRECTION ..." callout into the body as
    // trailing text (no heading of its own); split it out where present.
    const directionMatch = /\n\nDIAGNOSTIC DIRECTION\s+(.+)$/s.exec(node.body || "");
    core[code] = {
      contentId: node.contentId ?? `II-${reportCode}-FALSE-${code}`,
      text: directionMatch ? node.body.slice(0, directionMatch.index) : node.body || null,
      diagnosticDirection: directionMatch ? directionMatch[1].trim() : null,
    };
  }

  const proposedContainer = section.children.find((c) => titleIncludes(c, "proposed") && titleIncludes(c, "false constraint"));
  const proposed: any[] = [];
  if (proposedContainer) {
    const items = proposedContainer.level === 2 ? proposedContainer.children : [];
    for (const item of items) {
      proposed.push({
        contentId: item.contentId ?? null,
        label: item.title,
        text: item.body || null,
      });
    }
  } else {
    issues.push(`[${reportCode}] proposed False Constraint extensions container not found`);
  }

  return { core, proposed };
}

function extractRiskSignals(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "risk signals") && (titleIncludes(n, "commercial") || titleIncludes(n, "dynamic")));
  const out: any[] = [];
  if (!section) {
    issues.push(`[${reportCode}] risk signals section not found`);
    return out;
  }

  // A/B/C: a single markdown table in section.body. D: itemized ## blocks.
  if (section.children.length > 0) {
    for (const item of section.children) {
      if (titleIncludes(item, "risk-flag rule")) continue;
      const response = item.children.find((c) => titleIncludes(c, "adviser response"));
      out.push({
        contentId: item.contentId ?? null,
        label: item.title,
        text: item.body || null,
        adviserResponse: text(response),
      });
    }
  } else if (section.body) {
    const rows = section.body
      .split("\n\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && !/risk flag/i.test(l));
    for (const row of rows) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length < 3) continue;
      out.push({
        contentId: null,
        label: cells[0],
        text: cells[1],
        adviserResponse: cells[2],
      });
    }
  }
  if (out.length === 0) issues.push(`[${reportCode}] no risk signals parsed`);
  return out;
}

function extractObjections(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "likely objections"));
  const out: Record<string, any> = {};
  if (!section) {
    issues.push(`[${reportCode}] objections section not found`);
    return out;
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar], "is primary") || titleIncludes(c, PILLAR_TITLE[pillar], "primary is") || (c.normTitle.includes("when") && titleIncludes(c, PILLAR_TITLE[pillar])) );
    if (!node) {
      issues.push(`[${reportCode}] objection block missing: ${pillar}`);
      continue;
    }
    const language = node.children.find((c) => titleIncludes(c, "possible language"));
    const underneath = node.children.find((c) => titleIncludes(c, "what may sit underneath"));
    const posture = node.children.find((c) => titleIncludes(c, "response posture"));
    // D has no ### subheadings; language is the first quoted line of the body, rest is meaning.
    out[pillar] = {
      possibleLanguage: text(language) ?? (node.body ? node.body.split("\n\n")[0] : null),
      whatMaySitUnderneath: text(underneath) ?? (node.body ? node.body.split("\n\n").slice(1).join("\n\n") || null : null),
      responsePosture: text(posture),
    };
  }
  return out;
}

function extractProsper(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && (titleIncludes(n, "conversation strategy") || titleIncludes(n, "predictive conversation strategy")));
  const stages = ["Permission", "Reframe", "Ownership", "Structure", "Power Questions", "Embodiment", "Result"];
  const out: Record<string, string | null> = {};
  if (!section) {
    issues.push(`[${reportCode}] PROSPER conversation strategy section not found`);
    return out;
  }
  for (const stage of stages) {
    const node = section.children.find((c) => titleIncludes(c, stage));
    if (!node) issues.push(`[${reportCode}] PROSPER stage missing: ${stage}`);
    out[stage.toUpperCase().replace(/\s+/g, "_")] = text(node);
  }
  return out;
}

function splitIntroAndBullets(body: string | null): { intro: string | null; items: string[] } {
  const paragraphs = (body || "").split("\n\n").map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  const introParts: string[] = [];
  for (const p of paragraphs) {
    if (/^[•\-*]\s+/.test(p)) items.push(p.replace(/^[•\-*]\s+/, "").trim());
    else if (items.length === 0) introParts.push(p);
    else items.push(p); // a stray non-bulleted line after bullets started
  }
  return { intro: introParts.length ? introParts.join("\n\n") : null, items };
}

function extractPreCall(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "pre-call preparation"));
  if (!section) {
    issues.push(`[${reportCode}] pre-call preparation section not found`);
    return { intro: null, questions: [] };
  }
  const { intro, items } = splitIntroAndBullets(section.body);
  if (items.length === 0) issues.push(`[${reportCode}] pre-call preparation had no bulleted questions`);
  return { intro, questions: items };
}

function extractQuestionsByPrimary(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "questions to ask by primary constraint"));
  const out: Record<string, string[]> = {};
  if (!section) {
    issues.push(`[${reportCode}] questions-by-primary section not found`);
    return out;
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar], "primary"));
    if (!node) {
      issues.push(`[${reportCode}] questions-by-primary missing: ${pillar}`);
      continue;
    }
    out[pillar] = (node.body || "")
      .split("\n\n")
      .map((l) => l.replace(/^[•\-*]\s+/, "").trim())
      .filter(Boolean);
  }
  return out;
}

function extractAvoidedQuestion(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "question they may be avoiding"));
  const out: Record<string, string | null> = {};
  if (!section) {
    issues.push(`[${reportCode}] avoided-question section not found`);
    return out;
  }
  if (section.children.length > 0) {
    for (const pillar of PILLARS) {
      const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar]));
      out[pillar] = text(node);
      if (!node) issues.push(`[${reportCode}] avoided question missing: ${pillar}`);
    }
  } else {
    issues.push(`[${reportCode}] avoided-question has no per-pillar breakdown (flat text only)`);
  }
  return out;
}

function extractChallengeSequence(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "what to challenge") && titleIncludes(n, "not to challenge too early"));
  if (!section) {
    issues.push(`[${reportCode}] challenge sequence section not found`);
    return { intro: null, byPillar: {} };
  }
  const byPillar: Record<string, string | null> = {};
  if (section.children.length > 0) {
    for (const pillar of PILLARS) {
      const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar]));
      byPillar[pillar] = text(node);
    }
  }
  return { intro: section.body || null, byPillar };
}

function extractBuyingResistance(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "buying") && titleIncludes(n, "resistance signals"));
  if (!section) {
    issues.push(`[${reportCode}] buying/resistance signals section not found`);
    return { buying: null, resistance: null };
  }
  const buying = section.children.find((c) => titleIncludes(c, "buying signal"));
  const resistance = section.children.find((c) => titleIncludes(c, "resistance signal"));
  if (!buying || !resistance) issues.push(`[${reportCode}] buying/resistance sub-blocks incomplete`);
  return { buying: text(buying), resistance: text(resistance) };
}

function extractNextStepPositioning(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && (titleIncludes(n, "recommended next step") || titleIncludes(n, "position the recommended next step") || titleIncludes(n, "positioning the recommended next step")));
  const out: Record<string, string | null> = {};
  if (!section) {
    issues.push(`[${reportCode}] next-step positioning section not found`);
    return out;
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar], "primary") || titleIncludes(c, "if", PILLAR_TITLE[pillar], "is primary"));
    out[pillar] = text(node);
    if (!node) issues.push(`[${reportCode}] next-step positioning missing: ${pillar}`);
  }
  return out;
}

function extractFollowUp(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "follow-up guidance"));
  if (!section) issues.push(`[${reportCode}] follow-up guidance section not found`);
  return text(section);
}

function extractPostSaleCoaching(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && (titleIncludes(n, "coaching priorities after the sale") || titleIncludes(n, "post-sale coaching priorities")));
  if (!section) {
    issues.push(`[${reportCode}] post-sale coaching section not found`);
    return { intro: null, byPillar: {} };
  }
  const byPillar: Record<string, string | null> = {};
  if (section.children.length > 0) {
    for (const pillar of PILLARS) {
      const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar]));
      byPillar[pillar] = text(node);
    }
  }
  return { intro: section.body || null, byPillar };
}

function extractAccountability(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && (titleIncludes(n, "accountability by pillar state") || titleIncludes(n, "how to hold them accountable")));
  if (!section) {
    issues.push(`[${reportCode}] accountability section not found`);
    return { byState: {}, byPillar: {} };
  }
  const byState: Record<string, string | null> = {};
  const byPillar: Record<string, string | null> = {};
  for (const state of STATES) {
    const node = section.children.find((c) => c.normTitle === normTitleKey(state));
    if (node) byState[state] = text(node);
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar]));
    if (node) byPillar[pillar] = text(node);
  }
  if (Object.keys(byState).length === 0 && Object.keys(byPillar).length === 0) {
    issues.push(`[${reportCode}] accountability section had no recognisable sub-blocks`);
  }
  return { byState, byPillar };
}

function extractProgressSignals(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && (titleIncludes(n, "progress signals by pillar") || titleIncludes(n, "progress signals to watch")));
  const out: Record<string, string | null> = {};
  if (!section) {
    issues.push(`[${reportCode}] progress signals section not found`);
    return out;
  }
  for (const pillar of PILLARS) {
    const node = section.children.find((c) => titleIncludes(c, PILLAR_TITLE[pillar]));
    out[pillar] = text(node);
    if (!node) issues.push(`[${reportCode}] progress signal missing: ${pillar}`);
  }
  return out;
}

function extractAdviserFlags(root: Node, reportCode: string, issues: Issues) {
  const section = find(root, (n) => n.level === 1 && titleIncludes(n, "green") && titleIncludes(n, "red") && titleIncludes(n, "flags"));
  if (!section) {
    issues.push(`[${reportCode}] adviser green/red flags section not found`);
    return { green: null, red: null };
  }
  const green = section.children.find((c) => titleIncludes(c, "green flags"));
  const red = section.children.find((c) => titleIncludes(c, "red flags"));
  return { green: prose(green), red: prose(red) };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

function main() {
  const issues: Issues = [];
  const result: Record<string, any> = {};
  const counts: Record<string, any> = {};

  for (const report of REPORTS) {
    const raw = readFileSync(join(SOURCE_DIR, report.file), "utf8");
    const root = parseDocument(raw);

    const coreProfile = extractCoreProfile(root, report.code, issues);
    const secondaryInfluences = extractSecondaryInfluences(root, report.code, report.approach, issues);
    const pillarStates = extractPillarStates(root, report.code, issues);
    const strongestPillar = extractStrongestPillar(root, report.code, issues);
    const primaryConstraints = extractPrimaryConstraints(root, report.code, issues);
    const directionalPairs = extractDirectionalPairs(root, report.code, issues);
    const falseConstraints = extractFalseConstraints(root, report.code, issues);
    const riskSignals = extractRiskSignals(root, report.code, issues);
    const objections = extractObjections(root, report.code, issues);
    const prosper = extractProsper(root, report.code, issues);
    const preCall = extractPreCall(root, report.code, issues);
    const questionsByPrimary = extractQuestionsByPrimary(root, report.code, issues);
    const avoidedQuestion = extractAvoidedQuestion(root, report.code, issues);
    const challengeSequence = extractChallengeSequence(root, report.code, issues);
    const buyingResistance = extractBuyingResistance(root, report.code, issues);
    const nextStepPositioning = extractNextStepPositioning(root, report.code, issues);
    const followUp = extractFollowUp(root, report.code, issues);
    const postSaleCoaching = extractPostSaleCoaching(root, report.code, issues);
    const accountability = extractAccountability(root, report.code, issues);
    const progressSignals = extractProgressSignals(root, report.code, issues);
    const adviserFlags = extractAdviserFlags(root, report.code, issues);

    result[report.code] = {
      approach: report.approach,
      coreProfile,
      secondaryInfluences,
      pillarStates,
      strongestPillar,
      primaryConstraints,
      directionalPairs,
      falseConstraints,
      riskSignals,
      objections,
      prosper,
      preCall,
      questionsByPrimary,
      avoidedQuestion,
      challengeSequence,
      buyingResistance,
      nextStepPositioning,
      followUp,
      postSaleCoaching,
      accountability,
      progressSignals,
      adviserFlags,
    };

    // Move every "SOURCE ANCHOR …" / "CONTENT ID: …" provenance paragraph the
    // master documents append to prose blocks out of the rendered fields. Fills
    // the per-block `sourceAnchor` slots; the remainder is kept, deduped, as a
    // non-rendered `provenance` record on the approach.
    const provenance: string[] = [];
    hoistProvenance(result[report.code], provenance);
    result[report.code].provenance = [...new Set(provenance)];

    counts[report.code] = {
      pillarStates: Object.keys(pillarStates).length,
      primaryConstraints: Object.keys(primaryConstraints).length,
      directionalPairs: Object.keys(directionalPairs).length,
      falseConstraintsCore: Object.keys(falseConstraints.core).length,
      falseConstraintsProposed: falseConstraints.proposed.length,
      riskSignals: riskSignals.length,
      strongestPillar: Object.keys(strongestPillar).filter((k) => strongestPillar[k]).length,
      objections: Object.keys(objections).length,
      questionsByPrimary: Object.keys(questionsByPrimary).length,
      avoidedQuestion: Object.keys(avoidedQuestion).length,
      nextStepPositioning: Object.keys(nextStepPositioning).length,
      progressSignals: Object.keys(progressSignals).length,
    };
  }

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log("=== Insider Insights extraction coverage ===");
  console.table(counts);
  console.log(`\nTotal pillar-state blocks: ${Object.values(counts).reduce((s: number, c: any) => s + c.pillarStates, 0)} / 72`);
  console.log(`Total primary constraints: ${Object.values(counts).reduce((s: number, c: any) => s + c.primaryConstraints, 0)} / 24`);
  console.log(`Total directional pairs: ${Object.values(counts).reduce((s: number, c: any) => s + c.directionalPairs, 0)} / 120`);
  console.log(`Total risk signals: ${Object.values(counts).reduce((s: number, c: any) => s + c.riskSignals, 0)}`);
  console.log(`Total proposed False Constraint extensions: ${Object.values(counts).reduce((s: number, c: any) => s + c.falseConstraintsProposed, 0)}`);

  if (issues.length) {
    console.log(`\n=== ${issues.length} extraction issues ===`);
    for (const issue of issues) console.log(" -", issue);
  } else {
    console.log("\nNo extraction issues flagged.");
  }

  writeFileSync(
    join(__dirname, "extraction-report.json"),
    JSON.stringify({ counts, issues }, null, 2) + "\n",
    "utf8",
  );
}

main();
