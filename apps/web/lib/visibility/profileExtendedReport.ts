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
  triggers: Record<string, any> | null;
  content: Record<string, any> | null;
  is_active: boolean;
};

export type ProfileExtendedPanelKey =
  | "plain_english_summary"
  | "core_diagnosis"
  | "market_happening"
  | "core_reading"
  | "level_meaning"
  | "meaning_in_practice"
  | "current_signal_pattern"
  | "wider_signal_pathway"
  | "progression_pattern"
  | "type_interpretation"
  | "how_to_use_this_layer"
  | "what_to_focus_on_now"
  | "what_progression_looks_like_next"
  | "how_to_recognise_readiness";

export type ProfileExtendedSectionKey =
  | "result_at_a_glance"
  | "what_this_tier_means"
  | "level_nuance"
  | "pillars_and_signals"
  | "behaviour_style"
  | "strategic_priority_now"
  | "progression_roadmap";

export type AssembledProfileExtendedBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  items?: Array<Record<string, any>>;
  transition?: string;
  meta?: Record<string, any>;
};

export type AssembledProfileExtendedPanel = {
  panel_key: ProfileExtendedPanelKey;
  title: string;
  blocks: AssembledProfileExtendedBlock[];
  matched_rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, any>;
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
    triggers: Record<string, any>;
  }>;
};

export type InternalSalesSnapshot = {
  visibility_score: number;
  level: number;
  tier: VisibilityTier;
  behaviour_style: BehaviourStyle;
  readiness: Readiness | null;
  correct_programme: string;
  primary_objective: string;
  secondary_objective: string;
};

export type InternalSalesObjection = {
  objection: string;
  response: string;
};

export type InternalSalesReport = {
  snapshot: InternalSalesSnapshot;
  real_situation: string[];
  core_pain: string[];
  real_problem: string[];
  what_not_to_do: string[];
  what_to_do: string[];
  why_this_offer: string[];
  objections: InternalSalesObjection[];
  conversion_signals: string[];
  close_line: string;
  long_term_value: string[];
};

export type AssembledProfileExtendedReport = {
  audience: "profile_extended_report";
  input: ProfileExtendedReportInput;
  internal_sales_report: InternalSalesReport;
  sections: AssembledProfileExtendedSection[];
};

type GenericBlock = Record<string, any>;

type PanelBucketItem = {
  block: AssembledProfileExtendedBlock;
  row: KbBlockRow | null;
};

const SALES_PROGRAMME_BY_TIER: Record<
  VisibilityTier,
  {
    correct_programme: string;
    primary_objective: string;
    secondary_objective: string;
    close_line: string;
    long_term_value: string;
    default_not_to_do: string[];
    default_why_offer: string[];
    default_objections: InternalSalesObjection[];
  }
> = {
  Invisible: {
    correct_programme: "Visibility Foundation",
    primary_objective: "Build discoverability and visible trust",
    secondary_objective: "Prepare for authority development",
    close_line:
      "You can keep hoping the market eventually discovers what is already true — or you can build the signals that make credibility visible before the conversation starts.",
    long_term_value:
      "If the business builds stable discoverability and visible proof, it becomes ready for authority-focused support in the next stage.",
    default_not_to_do: [
      "Do not position this as aggressive scale.",
      "Do not jump straight into authority branding.",
      "Do not suggest major campaign expansion before the signal base is stable.",
      "Do not frame the business as broken; frame it as under-signalled.",
    ],
    default_why_offer: [
      "The business needs visible signal structure before bigger growth strategies will hold.",
      "This stage is about discoverability, proof, and consistency — not scale for the sake of it.",
      "The right support should reduce hesitation by making credibility easier to see.",
    ],
    default_objections: [
      {
        objection: "I already know we need more visibility.",
        response:
          "This is not just about more visibility. It is about building the right trust signals so visibility actually converts.",
      },
      {
        objection: "I do not want to over-invest too early.",
        response:
          "That is exactly why this is the right stage to address now. A stronger foundation prevents wasted spend later.",
      },
    ],
  },
  Emerging: {
    correct_programme: "GROWTH",
    primary_objective: "Turn recognition into trust",
    secondary_objective: "Prepare for authority compounding",
    close_line:
      "You can keep letting prospects compare their way to uncertainty — or you can build the authority signals that make trust arrive earlier. That is what this stage is for.",
    long_term_value:
      "When authority and proof deepen at this stage, the business becomes ready for leadership-oriented positioning support next.",
    default_not_to_do: [
      "Do not talk about dominating the market too early.",
      "Do not suggest broad expansion before authority strengthens.",
      "Do not position this as fixing basics if the business is already visible.",
      "Do not let the conversation drift into price-led growth.",
    ],
    default_why_offer: [
      "The business is already visible; the real job now is reducing comparison and increasing expert trust.",
      "This offer should strengthen authority, proof depth, and differentiation.",
      "The goal is not more activity. The goal is clearer expertise in the market’s eyes.",
    ],
    default_objections: [
      {
        objection: "I feel like I am already doing most of this.",
        response:
          "You may already be doing it internally. The issue is whether the market is receiving those authority signals clearly enough before contact.",
      },
      {
        objection: "I just need more leads.",
        response:
          "More leads without stronger authority often creates more comparison. The better move is making the business the clearer expert choice.",
      },
    ],
  },
  Established: {
    correct_programme: "Market Authority Programme",
    primary_objective: "Turn credibility into leadership",
    secondary_objective: "Prepare for category influence",
    close_line:
      "You have already built credibility. The opportunity now is deciding whether the market keeps seeing you as one of several credible options — or as the leader they reference first.",
    long_term_value:
      "If leadership positioning consolidates here, the business becomes ready for broader influence and category-shaping opportunities.",
    default_not_to_do: [
      "Do not fall back into generic marketing language.",
      "Do not widen the offer in ways that dilute authority.",
      "Do not treat this like a visibility problem when credibility is already present.",
      "Do not recommend growth moves that weaken positioning.",
    ],
    default_why_offer: [
      "The business no longer needs basic visibility work. It needs clearer leadership perception.",
      "This stage is about category positioning, influence, and authority consolidation.",
      "The right support should help the market see leadership, not just competence.",
    ],
    default_objections: [
      {
        objection: "We already have a good reputation.",
        response:
          "Exactly — and the next step is turning reputation into leadership positioning that compounds rather than plateaus.",
      },
      {
        objection: "We are already getting inbound opportunities.",
        response:
          "That is a strong sign. This stage is about making sure those opportunities reinforce leadership instead of staying at a respected-but-broad level.",
      },
    ],
  },
  Magnetic: {
    correct_programme: "Category Leadership Advisory",
    primary_objective: "Protect authority while expanding influence",
    secondary_objective: "Prepare for scalable category leadership",
    close_line:
      "The market already recognises your authority. The real decision now is whether that authority stays localised — or becomes the platform for wider category influence.",
    long_term_value:
      "If influence expands without weakening positioning, the business can move into larger authority, partnership, and category-shaping opportunities.",
    default_not_to_do: [
      "Do not position this as ordinary marketing support.",
      "Do not recommend generic campaigns that dilute authority.",
      "Do not let short-term growth compromise leadership perception.",
      "Do not frame the issue as visibility alone when the real challenge is influence expansion.",
    ],
    default_why_offer: [
      "This stage is about extending influence without weakening authority.",
      "The right support should protect positioning while expanding category impact.",
      "The business is not solving for recognition anymore; it is solving for disciplined leadership growth.",
    ],
    default_objections: [
      {
        objection: "We are already doing well.",
        response:
          "That is true — and this stage is about making sure success evolves into wider influence rather than quiet plateau.",
      },
      {
        objection: "I do not want to dilute what already works.",
        response:
          "Exactly. The right next step should protect authority while extending it, not weaken it.",
      },
    ],
  },
};

function buildStructure(input: ProfileExtendedReportInput): Array<{
  section_key: ProfileExtendedSectionKey;
  heading: string;
  panels: Array<{ panel_key: ProfileExtendedPanelKey; title: string }>;
}> {
  return [
    {
      section_key: "result_at_a_glance",
      heading: "Result at a glance",
      panels: [{ panel_key: "plain_english_summary", title: "Plain-English summary" }],
    },
    {
      section_key: "what_this_tier_means",
      heading: "What this tier means",
      panels: [
        { panel_key: "core_diagnosis", title: "Core diagnosis" },
        { panel_key: "market_happening", title: "What is likely happening in the market" },
        { panel_key: "core_reading", title: "Core reading" },
      ],
    },
    {
      section_key: "level_nuance",
      heading: "Level nuance",
      panels: [
        { panel_key: "level_meaning", title: `Level ${input.level} meaning` },
        { panel_key: "meaning_in_practice", title: "Meaning in practice" },
      ],
    },
    {
      section_key: "pillars_and_signals",
      heading: "Pillars and signals",
      panels: [
        { panel_key: "current_signal_pattern", title: "Current signal pattern" },
        { panel_key: "wider_signal_pathway", title: "The wider signal pathway" },
        { panel_key: "progression_pattern", title: "Progression pattern" },
      ],
    },
    {
      section_key: "behaviour_style",
      heading: "Behaviour style",
      panels: [
        { panel_key: "type_interpretation", title: `Type ${input.behaviour_style} interpretation` },
        { panel_key: "how_to_use_this_layer", title: "How to use this layer" },
      ],
    },
    {
      section_key: "strategic_priority_now",
      heading: "Strategic priority now",
      panels: [{ panel_key: "what_to_focus_on_now", title: "What to focus on now" }],
    },
    {
      section_key: "progression_roadmap",
      heading: "Progression roadmap",
      panels: [
        {
          panel_key: "what_progression_looks_like_next",
          title: "What progression looks like next",
        },
        {
          panel_key: "how_to_recognise_readiness",
          title: "How to recognise readiness",
        },
      ],
    },
  ];
}

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
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const triggers = row.triggers || {};

  if (!matchesArrayTrigger(input.tier, triggers.tier)) return false;
  if (!matchesArrayTrigger(input.behaviour_style, triggers.behaviour_style)) return false;
  if (!matchesArrayTrigger(input.readiness ?? null, triggers.readiness)) return false;

  const levelMin = typeof triggers.level_min === "number" ? triggers.level_min : undefined;
  const levelMax = typeof triggers.level_max === "number" ? triggers.level_max : undefined;

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
    triggers: row.triggers || {},
  };
}

function uniqueRows(
  rows: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, any>;
  }>
) {
  const seen = new Set<string>();
  const out: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, any>;
  }> = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

function dedupeStrings(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const s = safeString(value);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out;
}

function makeBlock(src?: GenericBlock | null): AssembledProfileExtendedBlock {
  const item = src || {};

  const paragraphs = Array.isArray(item.paragraphs)
    ? (item.paragraphs as unknown[]).map((p: unknown) => safeString(p)).filter(Boolean)
    : [];

  const bullets = Array.isArray(item.bullets)
    ? (item.bullets as unknown[]).map((b: unknown) => safeString(b)).filter(Boolean)
    : [];

  const items = Array.isArray(item.items)
    ? (item.items as unknown[]).filter((x: unknown) => x && typeof x === "object") as GenericBlock[]
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
    meta: item.meta && typeof item.meta === "object" ? (item.meta as Record<string, any>) : undefined,
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
  buckets: Map<ProfileExtendedPanelKey, PanelBucketItem[]>,
  panelKey: ProfileExtendedPanelKey,
  block: AssembledProfileExtendedBlock,
  row: KbBlockRow | null
) {
  const current = buckets.get(panelKey) || [];
  current.push({ block, row });
  buckets.set(panelKey, current);
}

function getRowBlocks(row?: KbBlockRow | null): GenericBlock[] {
  const content = row?.content || {};
  return Array.isArray(content.blocks) ? (content.blocks as GenericBlock[]) : [];
}

function getRowByHeading(
  rows: KbBlockRow[],
  sectionKey: string,
  heading: string
): KbBlockRow | null {
  const wanted = normalizeText(heading);
  return (
    rows.find(
      (row: KbBlockRow) =>
        row.section_key === sectionKey &&
        normalizeText(row.content?.heading) === wanted
    ) || null
  );
}

function getBlockFromRow(row: KbBlockRow | null | undefined, heading: string): GenericBlock | null {
  const wanted = normalizeText(heading);
  return (
    getRowBlocks(row).find((block: GenericBlock) => normalizeText(block?.heading) === wanted) ||
    null
  );
}

function getBlockSummary(row: KbBlockRow | null | undefined, heading: string) {
  const block = getBlockFromRow(row, heading);
  return safeString(block?.summary || block?.short_summary);
}

function getBlockBullets(row: KbBlockRow | null | undefined, heading: string) {
  const block = getBlockFromRow(row, heading);
  return Array.isArray(block?.bullets)
    ? (block?.bullets as unknown[]).map((b: unknown) => safeString(b)).filter(Boolean)
    : [];
}

function selectedLevelItem(row: KbBlockRow | null, level: number): GenericBlock | null {
  const block = getBlockFromRow(row, "Levels");
  const items = Array.isArray(block?.items) ? (block?.items as GenericBlock[]) : [];
  return (
    items.find((item: GenericBlock) => safeNumber(item?.level, -1) === level) || null
  );
}

function strongestWeakest(input: ProfileExtendedReportInput) {
  const scores = input.pillar_scores || {};
  const items = [
    { key: "visibility", label: "Visibility", value: safeNumber(scores.visibility, 0) },
    { key: "trust", label: "Trust", value: safeNumber(scores.trust, 0) },
    { key: "authority", label: "Authority", value: safeNumber(scores.authority, 0) },
    { key: "dominance", label: "Dominance", value: safeNumber(scores.dominance, 0) },
  ].sort((a, b) => b.value - a.value);

  return {
    strongest: items[0],
    weakest: items[items.length - 1],
  };
}

function overallScore(input: ProfileExtendedReportInput) {
  const source = input.pillar_scores || {};
  const values = [
    safeNumber(source.visibility, NaN),
    safeNumber(source.trust, NaN),
    safeNumber(source.authority, NaN),
    safeNumber(source.dominance, NaN),
  ].filter((n) => Number.isFinite(n));

  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function weakestSignalProblem(key: string) {
  const k = normalizeText(key);

  if (k === "visibility") {
    return "The market is still not receiving enough discoverability and recognition signals consistently enough.";
  }
  if (k === "trust") {
    return "The market still needs stronger proof and reassurance before confidence settles early.";
  }
  if (k === "authority") {
    return "The market can see value, but it does not yet see strong enough expert positioning to reduce comparison behaviour.";
  }
  if (k === "dominance") {
    return "The business has not yet consolidated a strong enough leadership signal to shape preference consistently.";
  }

  return "The market is still missing one of the structural signals needed for smoother progression.";
}

function tierPainLines(tier: VisibilityTier) {
  if (tier === "Invisible") {
    return [
      "The pain at this stage is often uncertainty and inconsistency.",
      "The business may feel capable internally but under-recognised externally.",
    ];
  }
  if (tier === "Emerging") {
    return [
      "The pain at this stage is often comparison fatigue and fragile trust.",
      "The business can feel visible, but still not like the clear expert choice.",
    ];
  }
  if (tier === "Established") {
    return [
      "The pain at this stage is often plateau rather than absence of demand.",
      "The business is respected, but leadership is not yet fully consolidated in the market.",
    ];
  }
  return [
    "The pain at this stage is usually not visibility. It is how to expand influence without weakening authority.",
    "The business may be successful already, but still sense that broader category impact is not yet fully unlocked.",
  ];
}

function readinessSignalsFallback(tier: VisibilityTier) {
  if (tier === "Invisible") {
    return [
      "Customers can find the business reliably.",
      "Proof and credibility signals are visible across platforms.",
      "Discovery depends less on private referrals alone.",
    ];
  }
  if (tier === "Emerging") {
    return [
      "Customers begin referencing expertise before contact.",
      "Comparison behaviour starts dropping.",
      "Authority and proof feel stronger before the sales conversation starts.",
    ];
  }
  if (tier === "Established") {
    return [
      "Prospects arrive with stronger pre-existing trust.",
      "The business is referenced more specifically for expertise or outcomes.",
      "Leadership perception strengthens beyond existing audiences.",
    ];
  }
  return [
    "The business is referenced as a leading authority.",
    "Reputation creates higher-value introductions and strategic opportunities.",
    "Influence expands without weakening positioning.",
  ];
}

function buildObjections(
  input: ProfileExtendedReportInput,
  programmeConfig: (typeof SALES_PROGRAMME_BY_TIER)[VisibilityTier],
  typeRisk: string,
  strategicFocus: string
): InternalSalesObjection[] {
  const base = [...programmeConfig.default_objections];

  if (safeString(typeRisk)) {
    base.push({
      objection: "I do not want to lose what already works.",
      response: `That caution makes sense. The goal is not to replace strengths — it is to remove the pattern currently creating drag: ${typeRisk}`,
    });
  }

  if (safeString(strategicFocus)) {
    base.push({
      objection: "This feels like a lot right now.",
      response: `That is why the focus has to stay narrow. The priority is not everything at once. It is this: ${strategicFocus}`,
    });
  }

  return base.slice(0, 3);
}

function buildInternalSalesReport(
  input: ProfileExtendedReportInput,
  matched: KbBlockRow[]
): InternalSalesReport {
  const programmeConfig = SALES_PROGRAMME_BY_TIER[input.tier];

  const resultRow = getRowByHeading(
    matched,
    "result_interpretation_scripts",
    "Result Interpretation Scripts"
  );
  const levelBandRow = getRowByHeading(
    matched,
    "level_progression_roadmap",
    "Level Progression Roadmap"
  );
  const roadmapRow = getRowByHeading(
    matched,
    "level_progression_roadmap",
    "Progression roadmap language"
  );
  const behaviourTypeRow = getRowByHeading(
    matched,
    "visibility_audit_layer",
    "Behaviour style layer"
  );
  const behaviourTierRow = getRowByHeading(
    matched,
    "visibility_audit_layer",
    "Behaviour strategy by tier"
  );
  const pillarGuidanceRow = getRowByHeading(
    matched,
    "visibility_audit_layer",
    "Pillar reading guidance"
  );

  const levelItem = selectedLevelItem(levelBandRow, input.level);
  const strongestWeakestState = strongestWeakest(input);

  const coreReading = getBlockSummary(resultRow, "Core reading");
  const marketHappening = getBlockSummary(resultRow, "What is usually happening in the market");
  const whyStuck = getBlockSummary(resultRow, "Why businesses tend to get stuck here");
  const strategicFocus =
    getBlockSummary(resultRow, "Best-fit strategic focus") ||
    safeString(levelItem?.immediate_focus);
  const helpsMost = getBlockBullets(resultRow, "What usually helps most at this stage");
  const notToDo = getBlockBullets(resultRow, "What usually does not help yet");
  const readinessSignals = getBlockBullets(resultRow, "Signs the business is ready to progress");

  const meaningInPractice = getBlockSummary(levelBandRow, "Meaning in practice");
  const consultantRead = getBlockSummary(levelBandRow, "Consultant read");
  const nextMilestone = getBlockSummary(roadmapRow, "Next milestone");
  const roadmapLanguage = getBlockSummary(roadmapRow, "Language to use");

  const naturalStrengths = getBlockSummary(behaviourTypeRow, "Natural strengths");
  const mainRisk = getBlockSummary(behaviourTypeRow, "Main risk");
  const worksBest = getBlockSummary(behaviourTypeRow, "What usually works best");
  const watchOutFor = getBlockSummary(behaviourTypeRow, "Watch out for");
  const behaviourGuidance = getBlockSummary(behaviourTierRow, "Guidance");

  const pillarGuidanceSummary = safeString(pillarGuidanceRow?.content?.summary);
  const pillarInterpretationRule = getBlockSummary(pillarGuidanceRow, "Interpretation rule");

  return {
    snapshot: {
      visibility_score: overallScore(input),
      level: input.level,
      tier: input.tier,
      behaviour_style: input.behaviour_style,
      readiness: input.readiness ?? null,
      correct_programme: programmeConfig.correct_programme,
      primary_objective: programmeConfig.primary_objective,
      secondary_objective: programmeConfig.secondary_objective,
    },

    real_situation: dedupeStrings([
      `This business is currently operating in the ${input.tier} tier at Level ${input.level}.`,
      coreReading,
      marketHappening,
      safeString(levelItem?.market_position)
        ? `Current market position: ${safeString(levelItem?.market_position)}`
        : "",
      `${strongestWeakestState.strongest.label} is currently the strongest visible signal, while ${strongestWeakestState.weakest.label} looks like the main limiting factor.`,
    ]),

    core_pain: dedupeStrings([
      ...tierPainLines(input.tier),
      meaningInPractice ? `Meaning in practice: ${meaningInPractice}` : "",
      naturalStrengths ? `Natural strengths already present: ${naturalStrengths}` : "",
      mainRisk ? `The tension often shows up through this risk pattern: ${mainRisk}` : "",
    ]),

    real_problem: dedupeStrings([
      whyStuck,
      weakestSignalProblem(strongestWeakestState.weakest.key),
      pillarGuidanceSummary,
      pillarInterpretationRule,
      consultantRead,
    ]),

    what_not_to_do: dedupeStrings([
      ...notToDo,
      ...programmeConfig.default_not_to_do,
      watchOutFor ? `Watch out for: ${watchOutFor}` : "",
    ]).slice(0, 6),

    what_to_do: dedupeStrings([
      "Acknowledge that the business has already built something real and that the result is structural, not personal.",
      strategicFocus ? `Name the real strategic focus clearly: ${strategicFocus}` : "",
      safeString(levelItem?.immediate_focus)
        ? `Keep the immediate focus narrow: ${safeString(levelItem?.immediate_focus)}`
        : "",
      behaviourGuidance ? `Use the behaviour-led guidance in the conversation: ${behaviourGuidance}` : "",
      worksBest ? `Anchor the recommendation in what usually works best for this style: ${worksBest}` : "",
      nextMilestone ? `Tie the recommendation to the next milestone: ${nextMilestone}` : "",
    ]).slice(0, 6),

    why_this_offer: dedupeStrings([
      ...programmeConfig.default_why_offer,
      strategicFocus ? `This offer fits because the business now needs: ${strategicFocus}` : "",
      ...helpsMost.map((entry: string) => `This stage typically responds well to: ${entry}`),
      roadmapLanguage,
    ]).slice(0, 6),

    objections: buildObjections(input, programmeConfig, mainRisk, strategicFocus),

    conversion_signals: dedupeStrings([
      ...readinessSignals,
      ...readinessSignalsFallback(input.tier),
    ]).slice(0, 6),

    close_line: programmeConfig.close_line,

    long_term_value: dedupeStrings([
      nextMilestone ? `Next milestone: ${nextMilestone}` : "",
      roadmapLanguage,
      programmeConfig.long_term_value,
    ]).slice(0, 5),
  };
}

function addSyntheticBlocks(
  buckets: Map<ProfileExtendedPanelKey, PanelBucketItem[]>,
  input: ProfileExtendedReportInput
) {
  const readiness =
    input.readiness === "ready_to_progress"
      ? "Ready to progress"
      : input.readiness === "stabilise"
      ? "Stabilise"
      : "Stabilise";

  pushPanel(
    buckets,
    "plain_english_summary",
    makeSimpleBlock(
      "Plain-English summary",
      `You are in the ${input.tier} tier at Level ${input.level}, with behaviour style ${input.behaviour_style} and readiness set to ${readiness}.`,
      {
        paragraphs: [
          "Tier explains the current stage of market visibility.",
          "Level explains how stable or advanced that stage currently is.",
          "Behaviour style shows how this person is most likely to implement strategy consistently.",
        ],
        transition:
          "This gives the report its structural truth: tier explains the stage, while level explains how stable or advanced that stage currently is.",
      }
    ),
    null
  );

  const { strongest, weakest } = strongestWeakest(input);

  pushPanel(
    buckets,
    "current_signal_pattern",
    makeSimpleBlock(
      "Current signal pattern",
      `${strongest.label} is currently the strongest visible signal, while ${weakest.label} looks like the main limiting factor.`,
      {
        transition:
          "The same low pillar can mean different things at different levels, so the pillar pattern should always be read together with the tier and level.",
      }
    ),
    null
  );
}

function assembleExtendedSections(
  matched: KbBlockRow[],
  input: ProfileExtendedReportInput
): AssembledProfileExtendedSection[] {
  const structure = buildStructure(input);

  const buckets = new Map<ProfileExtendedPanelKey, PanelBucketItem[]>();

  const resultRow = getRowByHeading(
    matched,
    "result_interpretation_scripts",
    "Result Interpretation Scripts"
  );
  const levelRow = getRowByHeading(
    matched,
    "level_progression_roadmap",
    "Level Progression Roadmap"
  );
  const roadmapRow = getRowByHeading(
    matched,
    "level_progression_roadmap",
    "Progression roadmap language"
  );
  const frameworkIntroRow = getRowByHeading(
    matched,
    "visibility_signal_framework",
    "Visibility Signal Framework"
  );

  const frameworkRows = matched.filter(
    (row: KbBlockRow) =>
      row.section_key === "visibility_signal_framework" &&
      safeString(row.content?.subheading) !== ""
  );

  const behaviourTypeRow = getRowByHeading(
    matched,
    "visibility_audit_layer",
    "Behaviour style layer"
  );
  const behaviourTierRow = getRowByHeading(
    matched,
    "visibility_audit_layer",
    "Behaviour strategy by tier"
  );
  const pillarGuidanceRow = getRowByHeading(
    matched,
    "visibility_audit_layer",
    "Pillar reading guidance"
  );

  addSyntheticBlocks(buckets, input);

  if (resultRow) {
    for (const raw of getRowBlocks(resultRow)) {
      const block = makeBlock(raw);
      const h = normalizeText(raw?.heading);

      if (h === "core reading") {
        pushPanel(buckets, "core_diagnosis", block, resultRow);
        continue;
      }

      if (h === "what is usually happening in the market") {
        pushPanel(buckets, "market_happening", block, resultRow);
        continue;
      }

      if (h === "why businesses tend to get stuck here" || h === "report writing cue") {
        pushPanel(buckets, "core_reading", block, resultRow);
        continue;
      }

      if (
        h === "best fit strategic focus" ||
        h === "what usually helps most at this stage" ||
        h === "what usually does not help yet"
      ) {
        pushPanel(buckets, "what_to_focus_on_now", block, resultRow);
        continue;
      }

      if (h === "signs the business is ready to progress") {
        pushPanel(buckets, "how_to_recognise_readiness", block, resultRow);
        continue;
      }
    }
  }

  if (levelRow) {
    const selected = selectedLevelItem(levelRow, input.level);

    for (const raw of getRowBlocks(levelRow)) {
      const h = normalizeText(raw?.heading);

      if (h === "meaning in practice") {
        pushPanel(buckets, "meaning_in_practice", makeBlock(raw), levelRow);
        continue;
      }

      if (h === "consultant read") {
        pushPanel(buckets, "level_meaning", makeBlock(raw), levelRow);
        continue;
      }

      if (h === "levels" && selected) {
        pushPanel(
          buckets,
          "level_meaning",
          makeSimpleBlock(
            `Level ${safeNumber(selected.level, input.level)} meaning`,
            safeString(selected.meaning),
            {
              items: [
                {
                  level: safeNumber(selected.level, input.level),
                  market_position: safeString(selected.market_position),
                  immediate_focus: safeString(selected.immediate_focus),
                },
              ],
            }
          ),
          levelRow
        );
      }
    }
  }

  if (roadmapRow) {
    for (const raw of getRowBlocks(roadmapRow)) {
      pushPanel(buckets, "what_progression_looks_like_next", makeBlock(raw), roadmapRow);
    }
  }

  if (frameworkIntroRow) {
    const rowSummary = safeString(frameworkIntroRow.content?.summary);
    if (rowSummary) {
      pushPanel(
        buckets,
        "wider_signal_pathway",
        makeSimpleBlock("The wider signal pathway", rowSummary),
        frameworkIntroRow
      );
    }

    for (const raw of getRowBlocks(frameworkIntroRow)) {
      const h = normalizeText(raw?.heading);

      if (h === "progression pattern" || h === "interpretation") {
        pushPanel(buckets, "progression_pattern", makeBlock(raw), frameworkIntroRow);
      } else {
        pushPanel(buckets, "wider_signal_pathway", makeBlock(raw), frameworkIntroRow);
      }
    }
  }

  for (const row of frameworkRows) {
    const subheading = safeString(row.content?.subheading);
    const blocks = getRowBlocks(row);

    pushPanel(
      buckets,
      "wider_signal_pathway",
      makeSimpleBlock(subheading || "Signal framework", undefined, {
        items: blocks.map((item: GenericBlock) => ({
          label: safeString(item?.heading),
          value: safeString(item?.summary),
        })),
      }),
      row
    );
  }

  if (behaviourTypeRow) {
    for (const raw of getRowBlocks(behaviourTypeRow)) {
      pushPanel(buckets, "type_interpretation", makeBlock(raw), behaviourTypeRow);
    }
  }

  if (behaviourTierRow) {
    for (const raw of getRowBlocks(behaviourTierRow)) {
      pushPanel(buckets, "how_to_use_this_layer", makeBlock(raw), behaviourTierRow);
    }
  }

  if (pillarGuidanceRow) {
    const rowSummary = safeString(pillarGuidanceRow.content?.summary);
    if (rowSummary) {
      pushPanel(
        buckets,
        "current_signal_pattern",
        makeSimpleBlock("Pillar reading guidance", rowSummary),
        pillarGuidanceRow
      );
    }

    for (const raw of getRowBlocks(pillarGuidanceRow)) {
      pushPanel(buckets, "current_signal_pattern", makeBlock(raw), pillarGuidanceRow);
    }
  }

  const sections: AssembledProfileExtendedSection[] = [];

  for (const sectionDef of structure) {
    const panels: AssembledProfileExtendedPanel[] = [];

    for (const panelDef of sectionDef.panels) {
      const bucket: PanelBucketItem[] = buckets.get(panelDef.panel_key) || [];
      if (!bucket.length) continue;

      panels.push({
        panel_key: panelDef.panel_key,
        title: panelDef.title,
        blocks: bucket.map((item: PanelBucketItem) => item.block),
        matched_rows: uniqueRows(
          bucket
            .filter((item: PanelBucketItem) => item.row !== null)
            .map((item: PanelBucketItem) => rowRef(item.row as KbBlockRow))
        ),
      });
    }

    if (!panels.length) continue;

    sections.push({
      section_key: sectionDef.section_key,
      heading: sectionDef.heading,
      panels,
      matched_rows: uniqueRows(
        panels.flatMap(
          (panel: AssembledProfileExtendedPanel) => panel.matched_rows
        )
      ),
    });
  }

  return sections;
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
  const matched = rows
    .filter((row: KbBlockRow) => rowMatchesInput(row, input))
    .sort((a: KbBlockRow, b: KbBlockRow) => b.priority - a.priority);

  return {
    audience: "profile_extended_report",
    input,
    internal_sales_report: buildInternalSalesReport(input, matched),
    sections: assembleExtendedSections(matched, input),
  };
}

export async function buildProfileExtendedReport(
  input: ProfileExtendedReportInput,
  sb?: VisibilityDbClient
): Promise<AssembledProfileExtendedReport> {
  const rows = await fetchKbRows(sb);
  return assembleProfileExtendedReport(rows, input);
}