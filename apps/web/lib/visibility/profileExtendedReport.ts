// apps/web/lib/visibility/profileExtendedReport.ts
import { createClient } from "@supabase/supabase-js";

export type VisibilityTier = "Invisible" | "Emerging" | "Established" | "Magnetic";
export type BehaviourStyle = "A" | "B" | "C" | "D";
export type Readiness = "stabilise" | "ready_to_progress";

export type ProfileExtendedReportInput = {
  tier: VisibilityTier;
  level: number;
  behaviour_style: BehaviourStyle;
  readiness?: Readiness | null;
  pillar_scores?: Record<string, number | null> | null;
  tier_counts?: Record<string, number | null> | null;
};

export type KbBlockRow = {
  id: string;
  section_key: string;
  audience: string;
  priority: number;
  triggers: Record<string, unknown> | null;
  content: Record<string, unknown> | null;
  is_active: boolean;
};

export type ProfileExtendedPanelKey =
  | "snapshot"
  | "real_situation"
  | "core_pain"
  | "real_problem"
  | "what_not_to_do_on_call"
  | "what_to_do_on_call"
  | "why_the_offer_is_the_right_offer"
  | "objections"
  | "conversion_signals"
  | "close_line"
  | "long_term_value";

export type ProfileExtendedSectionKey = ProfileExtendedPanelKey;

export type AssembledProfileExtendedBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  items?: Array<Record<string, unknown>>;
  transition?: string;
  meta?: Record<string, unknown>;
};

export type AssembledProfileExtendedPanel = {
  panel_key: ProfileExtendedPanelKey;
  title: string;
  blocks: AssembledProfileExtendedBlock[];
  matched_rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, unknown>;
  }>;
};

export type AssembledProfileExtendedSection = {
  section_key: ProfileExtendedSectionKey;
  heading: string;
  panels: AssembledProfileExtendedPanel[];
  matched_rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, unknown>;
  }>;
};

export type AssembledProfileExtendedReport = {
  audience: "profile_extended_report";
  input: ProfileExtendedReportInput;
  sections: AssembledProfileExtendedSection[];
};

const STRUCTURE: Array<{
  section_key: ProfileExtendedSectionKey;
  heading: string;
  panel_key: ProfileExtendedPanelKey;
  panel_title: string;
}> = [
  {
    section_key: "snapshot",
    heading: "Snapshot",
    panel_key: "snapshot",
    panel_title: "Snapshot",
  },
  {
    section_key: "real_situation",
    heading: "REAL Situation",
    panel_key: "real_situation",
    panel_title: "REAL Situation",
  },
  {
    section_key: "core_pain",
    heading: "Core Pain",
    panel_key: "core_pain",
    panel_title: "Core Pain",
  },
  {
    section_key: "real_problem",
    heading: "Real Problem",
    panel_key: "real_problem",
    panel_title: "Real Problem",
  },
  {
    section_key: "what_not_to_do_on_call",
    heading: "What NOT to Do on the Call",
    panel_key: "what_not_to_do_on_call",
    panel_title: "What NOT to Do on the Call",
  },
  {
    section_key: "what_to_do_on_call",
    heading: "What TO Do on the Call",
    panel_key: "what_to_do_on_call",
    panel_title: "What TO Do on the Call",
  },
  {
    section_key: "why_the_offer_is_the_right_offer",
    heading: "Why the Offer Is the Right Offer",
    panel_key: "why_the_offer_is_the_right_offer",
    panel_title: "Why the Offer Is the Right Offer",
  },
  {
    section_key: "objections",
    heading: "Objections",
    panel_key: "objections",
    panel_title: "Objections",
  },
  {
    section_key: "conversion_signals",
    heading: "Conversion Signals",
    panel_key: "conversion_signals",
    panel_title: "Conversion Signals",
  },
  {
    section_key: "close_line",
    heading: "Close Line",
    panel_key: "close_line",
    panel_title: "Close Line",
  },
  {
    section_key: "long_term_value",
    heading: "Long-Term Value",
    panel_key: "long_term_value",
    panel_title: "Long-Term Value",
  },
];

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

function createVisibilityAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getServiceRoleKey();

  if (!url || !key) {
    throw new Error("Missing Supabase credentials for visibility profile extended report");
  }

  return createClient(url, key, {
    db: { schema: "visibility" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type VisibilityDbClient = ReturnType<typeof createVisibilityAdminClient>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value: unknown): string {
  return safeString(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return safeString(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function decapitalizeSentence(value: string): string {
  const text = safeString(value);
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function trimTrailingPunctuation(value: string): string {
  return safeString(value).replace(/[.\s]+$/g, "");
}

function readinessLabel(value?: Readiness | null): string {
  if (value === "ready_to_progress") return "Ready to progress";
  if (value === "stabilise") return "Stabilise";
  return "Stabilise";
}

function uniqueRows(
  rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, unknown>;
  }>
) {
  const seen = new Set<string>();
  const out: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, unknown>;
  }> = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

function matchesArrayTrigger<T>(value: T | null | undefined, allowed?: T[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (value == null) return false;
  return allowed.includes(value);
}

function matchesRange(value: number | null | undefined, min?: number, max?: number): boolean {
  if (value == null) return false;
  if (typeof min === "number" && value < min) return false;
  if (typeof max === "number" && value > max) return false;
  return true;
}

function rowMatchesInput(row: KbBlockRow, input: ProfileExtendedReportInput): boolean {
  const triggers = (row.triggers || {}) as Record<string, unknown>;

  const tierAllowed = Array.isArray(triggers.tier)
    ? (triggers.tier as VisibilityTier[])
    : undefined;
  const behaviourAllowed = Array.isArray(triggers.behaviour_style)
    ? (triggers.behaviour_style as BehaviourStyle[])
    : undefined;
  const readinessAllowed = Array.isArray(triggers.readiness)
    ? (triggers.readiness as Array<Readiness | null>)
    : undefined;

  if (!matchesArrayTrigger(input.tier, tierAllowed)) return false;
  if (!matchesArrayTrigger(input.behaviour_style, behaviourAllowed)) return false;
  if (!matchesArrayTrigger(input.readiness ?? null, readinessAllowed)) return false;

  const levelMin =
    typeof triggers.level_min === "number" ? (triggers.level_min as number) : undefined;
  const levelMax =
    typeof triggers.level_max === "number" ? (triggers.level_max as number) : undefined;

  if (
    (levelMin !== undefined || levelMax !== undefined) &&
    !matchesRange(input.level, levelMin, levelMax)
  ) {
    return false;
  }

  return true;
}

function rowRef(row: KbBlockRow) {
  return {
    id: row.id,
    priority: row.priority,
    source_section_key: row.section_key,
    triggers: (row.triggers || {}) as Record<string, unknown>,
  };
}

function getRowBlocks(row?: KbBlockRow | null): Record<string, unknown>[] {
  const blocks = row?.content?.blocks;
  return Array.isArray(blocks)
    ? blocks.filter((block): block is Record<string, unknown> => !!block && typeof block === "object")
    : [];
}

function findBlock(
  row: KbBlockRow | null | undefined,
  headings: string[]
): Record<string, unknown> | null {
  if (!row) return null;

  const wanted = headings.map((heading) => normalizeText(heading)).filter(Boolean);
  if (!wanted.length) return null;

  for (const block of getRowBlocks(row)) {
    const heading = normalizeText(block.heading);
    if (wanted.includes(heading)) {
      return block;
    }
  }

  return null;
}

function getBlockSummary(row: KbBlockRow | null | undefined, headings: string[]): string {
  const block = findBlock(row, headings);
  return safeString(block?.summary) || safeString(block?.short_summary);
}

function getBlockBullets(row: KbBlockRow | null | undefined, headings: string[]): string[] {
  const block = findBlock(row, headings);
  return Array.isArray(block?.bullets)
    ? (block.bullets as unknown[])
        .map((item) => safeString(item))
        .filter(Boolean)
    : [];
}

function getBlockItems(row: KbBlockRow | null | undefined, headings: string[]): Array<Record<string, unknown>> {
  const block = findBlock(row, headings);
  return Array.isArray(block?.items)
    ? (block.items as unknown[]).filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object"
      )
    : [];
}

function makeBlock(src?: Record<string, unknown> | null): AssembledProfileExtendedBlock {
  const item = src || {};

  const paragraphs = Array.isArray(item.paragraphs)
    ? (item.paragraphs as unknown[]).map((p) => safeString(p)).filter(Boolean)
    : [];

  const bullets = Array.isArray(item.bullets)
    ? (item.bullets as unknown[]).map((b) => safeString(b)).filter(Boolean)
    : [];

  const items = Array.isArray(item.items)
    ? (item.items as unknown[]).filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object"
      )
    : [];

  return {
    title:
      safeString(item.title) ||
      safeString(item.heading) ||
      safeString(item.subheading) ||
      undefined,
    short_summary:
      safeString(item.short_summary) ||
      safeString(item.summary) ||
      undefined,
    paragraphs,
    bullets,
    items,
    transition: safeString(item.transition) || undefined,
    meta: item.meta && typeof item.meta === "object"
      ? (item.meta as Record<string, unknown>)
      : undefined,
  };
}

function makeSimpleBlock(
  title: string,
  summary?: string,
  extras?: Partial<AssembledProfileExtendedBlock>
): AssembledProfileExtendedBlock {
  return {
    title,
    short_summary: safeString(summary) || undefined,
    paragraphs: extras?.paragraphs || [],
    bullets: extras?.bullets || [],
    items: extras?.items || [],
    transition: extras?.transition,
    meta: extras?.meta,
  };
}

function pushPanel(
  buckets: Map<
    ProfileExtendedPanelKey,
    Array<{ block: AssembledProfileExtendedBlock; row: KbBlockRow | null }>
  >,
  panelKey: ProfileExtendedPanelKey,
  block: AssembledProfileExtendedBlock,
  row: KbBlockRow | null
) {
  const current = buckets.get(panelKey) || [];
  current.push({ block, row });
  buckets.set(panelKey, current);
}

function selectedLevelItem(row: KbBlockRow | null | undefined, level: number) {
  if (!row) return null;

  const levelsBlock = findBlock(row, ["Levels"]);
  if (!levelsBlock || !Array.isArray(levelsBlock.items)) return null;

  const items = levelsBlock.items as unknown[];
  const match = items.find((item) => {
    if (!item || typeof item !== "object") return false;
    return safeNumber((item as Record<string, unknown>).level, -1) === level;
  });

  return match && typeof match === "object"
    ? (match as Record<string, unknown>)
    : null;
}

function strongestWeakest(input: ProfileExtendedReportInput) {
  const scores = input.pillar_scores || {};

  const items = [
    {
      key: "visibility",
      label: "Visibility",
      value: safeNumber(scores.visibility, 0),
    },
    {
      key: "trust",
      label: "Trust",
      value: safeNumber(scores.trust, 0),
    },
    {
      key: "authority",
      label: "Authority",
      value: safeNumber(scores.authority, 0),
    },
    {
      key: "dominance",
      label: "Dominance",
      value: safeNumber(scores.dominance, 0),
    },
  ].sort((a, b) => b.value - a.value);

  return {
    strongest: items[0],
    weakest: items[items.length - 1],
    all: items,
  };
}

function getWeakestPillarNarrative(
  pillarGuidanceRow: KbBlockRow | null,
  weakestKey: string
): string {
  if (!pillarGuidanceRow) return "";

  const map: Record<string, string[]> = {
    visibility: ["Lower discoverability", "Lower visibility"],
    trust: ["Lower trust / credibility", "Lower trust", "Lower credibility"],
    authority: ["Lower conversion / authority", "Lower authority", "Lower conversion"],
    dominance: ["Lower dominance", "Lower influence", "Lower authority / dominance"],
  };

  return getBlockSummary(pillarGuidanceRow, map[weakestKey] || []);
}

function buildOfferFitLine(tier: VisibilityTier, focus: string, nextMilestone: string) {
  const cleanFocus = safeString(focus);
  const cleanMilestone = safeString(nextMilestone);

  if (cleanFocus && cleanMilestone) {
    return `The right offer is the one that directly solves ${decapitalizeSentence(
      trimTrailingPunctuation(cleanFocus)
    )} and moves them toward ${decapitalizeSentence(
      trimTrailingPunctuation(cleanMilestone)
    )}.`;
  }

  if (cleanFocus) {
    return `The right offer is the one that directly solves ${decapitalizeSentence(
      trimTrailingPunctuation(cleanFocus)
    )}.`;
  }

  if (cleanMilestone) {
    return `The right offer is the one that helps them move toward ${decapitalizeSentence(
      trimTrailingPunctuation(cleanMilestone)
    )}.`;
  }

  if (tier === "Invisible") {
    return "The right offer is the one that builds discoverability, credibility, and basic structural trust first.";
  }

  if (tier === "Emerging") {
    return "The right offer is the one that strengthens authority, proof, and expert positioning before more exposure is added.";
  }

  if (tier === "Established") {
    return "The right offer is the one that converts credibility into stronger category leadership and market authority.";
  }

  return "The right offer is the one that protects authority while expanding influence in a deliberate, disciplined way.";
}

function buildObjectionBullets(args: {
  whatDoesNotHelp: string[];
  behaviourMainRisk: string;
  behaviourWatchOut: string;
  weakestNarrative: string;
}) {
  const out: string[] = [];

  for (const item of args.whatDoesNotHelp) {
    const clean = trimTrailingPunctuation(item);
    if (!clean) continue;
    out.push(`Resistance usually rises when the recommendation feels like ${decapitalizeSentence(clean)}.`);
  }

  if (args.behaviourMainRisk) {
    out.push(`A likely objection or hesitation point is ${decapitalizeSentence(trimTrailingPunctuation(args.behaviourMainRisk))}.`);
  }

  if (args.behaviourWatchOut) {
    out.push(`Implementation confidence can drop when ${decapitalizeSentence(trimTrailingPunctuation(args.behaviourWatchOut))}.`);
  }

  if (!out.length && args.weakestNarrative) {
    out.push(args.weakestNarrative);
  }

  return Array.from(new Set(out.filter(Boolean)));
}

function buildSignalPathItems(frameworkRows: KbBlockRow[]) {
  const items: Array<Record<string, unknown>> = [];

  for (const row of frameworkRows) {
    const stage = safeString(row.content?.subheading);
    if (!stage) continue;

    const strongestImpact =
      getBlockSummary(row, ["Strongest ladder impact"]) ||
      getBlockSummary(row, ["What stronger signals look like"]) ||
      getBlockSummary(row, ["What it tells the market"]);

    if (!strongestImpact) continue;

    items.push({
      stage,
      focus: strongestImpact,
    });
  }

  return items;
}

async function fetchKbRows(sb?: VisibilityDbClient): Promise<KbBlockRow[]> {
  const client = sb ?? createVisibilityAdminClient();

  const { data, error } = await client
    .from("kb_blocks")
    .select("id, section_key, audience, priority, triggers, content, is_active")
    .eq("audience", "profile_extended_report")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(`Failed to load profile_extended_report KB blocks: ${error.message}`);
  }

  return (data ?? []) as KbBlockRow[];
}

export function assembleProfileExtendedReport(
  rows: KbBlockRow[],
  input: ProfileExtendedReportInput
): AssembledProfileExtendedReport {
  const matched = rows.filter((row) => rowMatchesInput(row, input));

  const buckets = new Map<
    ProfileExtendedPanelKey,
    Array<{ block: AssembledProfileExtendedBlock; row: KbBlockRow | null }>
  >();

  const resultRow =
    matched.find((row) => row.section_key === "result_interpretation_scripts") || null;

  const levelRoadmapRow =
    matched.find(
      (row) =>
        row.section_key === "level_progression_roadmap" &&
        normalizeText(row.content?.heading) === "level progression roadmap"
    ) || null;

  const progressionLanguageRow =
    matched.find(
      (row) =>
        row.section_key === "level_progression_roadmap" &&
        normalizeText(row.content?.heading) === "progression roadmap language"
    ) || null;

  const frameworkIntroRow =
    matched.find(
      (row) =>
        row.section_key === "visibility_signal_framework" &&
        safeString(row.content?.subheading) === ""
    ) || null;

  const frameworkRows = matched.filter(
    (row) =>
      row.section_key === "visibility_signal_framework" &&
      safeString(row.content?.subheading) !== ""
  );

  const behaviourTypeRow =
    matched.find(
      (row) =>
        row.section_key === "visibility_audit_layer" &&
        normalizeText(row.content?.heading) === "behaviour style layer"
    ) || null;

  const behaviourTierRow =
    matched.find(
      (row) =>
        row.section_key === "visibility_audit_layer" &&
        normalizeText(row.content?.heading) === "behaviour strategy by tier"
    ) || null;

  const pillarGuidanceRow =
    matched.find(
      (row) =>
        row.section_key === "visibility_audit_layer" &&
        normalizeText(row.content?.heading) === "pillar reading guidance"
    ) || null;

  const { strongest, weakest, all } = strongestWeakest(input);

  const currentStage = getBlockSummary(progressionLanguageRow, ["Current stage"]);
  const nextMilestone = getBlockSummary(progressionLanguageRow, ["Next milestone"]);
  const languageToUse = getBlockSummary(progressionLanguageRow, ["Language to use"]);

  const coreReading = getBlockSummary(resultRow, ["Core reading"]);
  const bestFitFocus = getBlockSummary(resultRow, ["Best-fit strategic focus"]);
  const marketHappening = getBlockSummary(resultRow, [
    "What is usually happening in the market",
  ]);
  const stuckReason = getBlockSummary(resultRow, ["Why businesses tend to get stuck here"]);
  const whatHelps = getBlockBullets(resultRow, ["What usually helps most at this stage"]);
  const whatDoesNotHelp = getBlockBullets(resultRow, ["What usually does not help yet"]);
  const signsReady = getBlockBullets(resultRow, ["Signs the business is ready to progress"]);

  const meaningInPractice = getBlockSummary(levelRoadmapRow, ["Meaning in practice"]);
  const consultantRead = getBlockSummary(levelRoadmapRow, ["Consultant read"]);
  const selectedLevel = selectedLevelItem(levelRoadmapRow, input.level);

  const behaviourStrengths = getBlockSummary(behaviourTypeRow, ["Natural strengths"]);
  const behaviourMainRisk = getBlockSummary(behaviourTypeRow, ["Main risk"]);
  const behaviourWorksBest = getBlockSummary(behaviourTypeRow, ["What usually works best"]);
  const behaviourWatchOut = getBlockSummary(behaviourTypeRow, ["Watch out for"]);

  const howToUseLayer = getBlockSummary(behaviourTierRow, ["How to use this layer"]);
  const tierGuidance = getBlockSummary(behaviourTierRow, ["Guidance"]);

  const frameworkSummary = safeString(frameworkIntroRow?.content?.summary);
  const progressionPattern = getBlockSummary(frameworkIntroRow, ["Progression pattern"]);
  const frameworkInterpretation = getBlockSummary(frameworkIntroRow, ["Interpretation"]);

  const weakestNarrative = getWeakestPillarNarrative(pillarGuidanceRow, weakest.key);
  const interpretationRule = getBlockSummary(pillarGuidanceRow, ["Interpretation rule"]);

  const signalPathItems = buildSignalPathItems(frameworkRows);
  const objections = buildObjectionBullets({
    whatDoesNotHelp,
    behaviourMainRisk,
    behaviourWatchOut,
    weakestNarrative,
  });

  pushPanel(
    buckets,
    "snapshot",
    makeSimpleBlock(
      "Internal snapshot",
      `${input.tier} • Level ${input.level} • Type ${input.behaviour_style} • ${readinessLabel(
        input.readiness
      )}`,
      {
        items: [
          {
            label: "Current stage",
            value: currentStage || input.tier,
          },
          {
            label: "Next milestone",
            value: nextMilestone || bestFitFocus || "—",
          },
          {
            label: "Strongest signal",
            value: `${strongest.label} (${strongest.value}%)`,
          },
          {
            label: "Weakest signal",
            value: `${weakest.label} (${weakest.value}%)`,
          },
        ],
      }
    ),
    null
  );

  pushPanel(
    buckets,
    "snapshot",
    makeSimpleBlock(
      `Level ${input.level} summary`,
      safeString(selectedLevel?.meaning) || meaningInPractice || consultantRead,
      {
        paragraphs: [
          safeString(selectedLevel?.market_position),
          safeString(selectedLevel?.immediate_focus),
        ].filter(Boolean),
      }
    ),
    levelRoadmapRow
  );

  if (coreReading) {
    pushPanel(
      buckets,
      "real_situation",
      makeSimpleBlock("Core reading", coreReading),
      resultRow
    );
  }

  if (marketHappening) {
    pushPanel(
      buckets,
      "real_situation",
      makeSimpleBlock("What is usually happening in the market", marketHappening),
      resultRow
    );
  }

  if (meaningInPractice || consultantRead) {
    pushPanel(
      buckets,
      "real_situation",
      makeSimpleBlock("Level reality", meaningInPractice || consultantRead, {
        paragraphs: consultantRead && consultantRead !== meaningInPractice ? [consultantRead] : [],
      }),
      levelRoadmapRow
    );
  }

  if (behaviourMainRisk) {
    pushPanel(
      buckets,
      "core_pain",
      makeSimpleBlock("Behaviour-level pain", behaviourMainRisk),
      behaviourTypeRow
    );
  }

  if (stuckReason) {
    pushPanel(
      buckets,
      "core_pain",
      makeSimpleBlock("Why they feel stuck", stuckReason),
      resultRow
    );
  }

  if (weakestNarrative) {
    pushPanel(
      buckets,
      "core_pain",
      makeSimpleBlock(`Pressure point: ${weakest.label}`, weakestNarrative),
      pillarGuidanceRow
    );
  }

  pushPanel(
    buckets,
    "real_problem",
    makeSimpleBlock(
      "Structural problem",
      coreReading ||
        `This is not mainly a motivation problem. It is a structural signal problem centred on ${weakest.label.toLowerCase()}.`,
      {
        paragraphs: [
          weakestNarrative
            ? `${weakest.label} is the main limiting signal right now. ${weakestNarrative}`
            : "",
          interpretationRule,
        ].filter(Boolean),
      }
    ),
    resultRow
  );

  if (whatDoesNotHelp.length || behaviourWatchOut) {
    pushPanel(
      buckets,
      "what_not_to_do_on_call",
      makeSimpleBlock(
        "What not to do",
        "Avoid recommendations that skip the real stage problem or create extra friction.",
        {
          bullets: Array.from(
            new Set([
              ...whatDoesNotHelp,
              behaviourWatchOut ? `Watch out for: ${behaviourWatchOut}` : "",
            ]).values()
          ).filter(Boolean),
        }
      ),
      resultRow
    );
  }

  pushPanel(
    buckets,
    "what_to_do_on_call",
    makeSimpleBlock(
      "How to position the call",
      bestFitFocus || "Position the conversation around the structural move that fits this stage.",
      {
        paragraphs: [howToUseLayer, tierGuidance, behaviourWorksBest].filter(Boolean),
        bullets: whatHelps,
      }
    ),
    resultRow
  );

  pushPanel(
    buckets,
    "why_the_offer_is_the_right_offer",
    makeSimpleBlock(
      "Offer fit",
      buildOfferFitLine(input.tier, bestFitFocus, nextMilestone),
      {
        paragraphs: [
          currentStage ? `Current stage: ${currentStage}.` : "",
          nextMilestone ? `Next milestone: ${nextMilestone}.` : "",
          tierGuidance,
        ].filter(Boolean),
      }
    ),
    progressionLanguageRow
  );

  if (objections.length) {
    pushPanel(
      buckets,
      "objections",
      makeSimpleBlock(
        "Likely objections or hesitations",
        "These are the resistance patterns most likely to appear on the call.",
        {
          bullets: objections,
        }
      ),
      resultRow
    );
  }

  if (signsReady.length) {
    pushPanel(
      buckets,
      "conversion_signals",
      makeSimpleBlock(
        "Signals they are ready to move",
        "Look for these cues during the conversation.",
        {
          bullets: signsReady,
        }
      ),
      resultRow
    );
  }

  pushPanel(
    buckets,
    "close_line",
    makeSimpleBlock(
      "Recommended close line",
      languageToUse ||
        "The close should reinforce the next structural move, not add pressure or complexity."
    ),
    progressionLanguageRow
  );

  pushPanel(
    buckets,
    "long_term_value",
    makeSimpleBlock(
      "Why this matters beyond the first sale",
      frameworkSummary ||
        "Each stage builds on the one before it. Long-term value comes from strengthening the right signal in the right order.",
      {
        paragraphs: [progressionPattern, frameworkInterpretation, behaviourStrengths].filter(Boolean),
        items: signalPathItems,
      }
    ),
    frameworkIntroRow
  );

  const sections: AssembledProfileExtendedSection[] = STRUCTURE.map((sectionDef) => {
    const bucket = buckets.get(sectionDef.panel_key) || [];
    if (!bucket.length) return null;

    const panel: AssembledProfileExtendedPanel = {
      panel_key: sectionDef.panel_key,
      title: sectionDef.panel_title,
      blocks: bucket.map((item) => item.block),
      matched_rows: uniqueRows(
        bucket
          .filter((item) => item.row !== null)
          .map((item) => rowRef(item.row as KbBlockRow))
      ),
    };

    return {
      section_key: sectionDef.section_key,
      heading: sectionDef.heading,
      panels: [panel],
      matched_rows: uniqueRows(panel.matched_rows),
    };
  }).filter(
    (section): section is AssembledProfileExtendedSection => section !== null
  );

  return {
    audience: "profile_extended_report",
    input,
    sections,
  };
}

export async function buildProfileExtendedReport(
  input: ProfileExtendedReportInput,
  sb?: VisibilityDbClient
): Promise<AssembledProfileExtendedReport> {
  const rows = await fetchKbRows(sb);
  return assembleProfileExtendedReport(rows, input);
}