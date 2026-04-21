// apps/web/lib/visibility/profileExtendedReport.ts
import { createClient } from "@supabase/supabase-js";

export type VisibilityTier = "Invisible" | "Emerging" | "Established" | "Magnetic";
export type BehaviourStyle = "A" | "B" | "C" | "D";
export type Readiness = "stabilise" | "ready_to_progress";

export type VisibilityPillarKey =
  | "discoverability"
  | "trust"
  | "conversion"
  | "visibility"
  | "authority"
  | "dominance";

export type ProfileExtendedReportInput = {
  tier: VisibilityTier;
  level: number;
  behaviour_style: BehaviourStyle;
  readiness?: Readiness | null;
  pillar_scores?: Partial<Record<VisibilityPillarKey, number | null>> | null;
  tier_counts?: Partial<Record<VisibilityTier, number | null>> | null;
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

export type ProfileExtendedSectionKey =
  | "result_at_a_glance"
  | "what_this_tier_means"
  | "level_nuance"
  | "pillars_and_signals"
  | "behaviour_style"
  | "strategic_priority_now"
  | "progression_roadmap";

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

export type AssembledProfileExtendedPanel = {
  panel_key: ProfileExtendedPanelKey;
  title: string;
  blocks: Array<Record<string, any>>;
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

export type AssembledProfileExtendedReport = {
  audience: "profile_extended_report";
  input: ProfileExtendedReportInput;
  sections: AssembledProfileExtendedSection[];
};

const REPORT_STRUCTURE: Array<{
  section_key: ProfileExtendedSectionKey;
  heading: string;
  panels: Array<{ panel_key: ProfileExtendedPanelKey; title: string }>;
}> = [
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
      {
        panel_key: "market_happening",
        title: "What is likely happening in the market",
      },
      { panel_key: "core_reading", title: "Core reading" },
    ],
  },
  {
    section_key: "level_nuance",
    heading: "Level nuance",
    panels: [
      { panel_key: "level_meaning", title: "Level meaning" },
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
      { panel_key: "type_interpretation", title: "Type interpretation" },
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

const LEVEL_LABELS: Record<number, string> = {
  1: "Foundational",
  2: "Early visibility",
  3: "Emerging recognition",
  4: "Initial traction",
  5: "Visible but inconsistent",
  6: "Early market movement",
  7: "Growing credibility",
  8: "More consistent demand",
  9: "Increasing trust",
  10: "Stabilising recognition",
  11: "Established presence",
  12: "Respected and recognised",
  13: "Trusted category participant",
  14: "Recognised authority",
  15: "Leadership edge forming",
  16: "Authority with pull",
  17: "Preferred provider",
  18: "Recognised market leader",
  19: "Category influence",
  20: "Category-shaping authority",
};

const STYLE_SUMMARIES: Record<BehaviourStyle, string> = {
  A: "Momentum, visibility comfort, experimentation.",
  B: "Relationship-led influence, trust-building, connection.",
  C: "Structure, consistency, process-led credibility.",
  D: "Authority focus, control, decisive positioning.",
};

const STYLE_USAGE: Record<BehaviourStyle, string> = {
  A: "Use the tier to choose the right strategic problem. Use the behaviour style to choose the delivery style and the type of work the client is most likely to sustain.",
  B: "Relationship-driven clients sustain strategies that build trust and visibility through consistent connection, proof, and conversation-led momentum.",
  C: "Structure-driven clients sustain strategies that rely on systems, repeatability, process discipline, and clear operational follow-through.",
  D: "Authority-driven clients sustain strategies that reinforce expertise, positioning, standards, and category leadership.",
};

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

function makeBlock(src?: Record<string, any> | null): Record<string, any> {
  const item = src || {};
  return {
    ...item,
    title:
      safeString(item.title) ||
      safeString(item.heading) ||
      safeString(item.subheading) ||
      "",
    short_summary:
      safeString(item.short_summary) ||
      safeString(item.summary) ||
      undefined,
    paragraphs: Array.isArray(item.paragraphs)
      ? item.paragraphs.map((p: any) => safeString(p)).filter(Boolean)
      : [],
    bullets: Array.isArray(item.bullets)
      ? item.bullets.map((b: any) => safeString(b)).filter(Boolean)
      : [],
    transition: safeString(item.transition) || undefined,
  };
}

function extractBlocks(row: KbBlockRow): Record<string, any>[] {
  const content = row.content || {};

  if (Array.isArray(content.blocks)) {
    return content.blocks
      .filter((b): b is Record<string, any> => !!b && typeof b === "object")
      .map((b) => makeBlock(b));
  }

  const single = makeBlock(content);
  const hasContent =
    single.title ||
    single.short_summary ||
    single.paragraphs.length ||
    single.bullets.length ||
    single.transition;

  return hasContent ? [single] : [];
}

function strongestWeakest(input: ProfileExtendedReportInput) {
  const scores = input.pillar_scores || {};
  const items = [
    { key: "visibility", label: "Visibility", value: safeNumber(scores.visibility) },
    { key: "trust", label: "Trust", value: safeNumber(scores.trust) },
    { key: "authority", label: "Authority", value: safeNumber(scores.authority) },
    { key: "dominance", label: "Dominance", value: safeNumber(scores.dominance) },
  ];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  return {
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    items,
  };
}

function defaultPanelTitle(panelKey: ProfileExtendedPanelKey): string {
  for (const section of REPORT_STRUCTURE) {
    const panel = section.panels.find((p) => p.panel_key === panelKey);
    if (panel) return panel.title;
  }
  return panelKey;
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

function pushBucket(
  buckets: Map<
    ProfileExtendedPanelKey,
    Array<{ block: Record<string, any>; row: KbBlockRow | null }>
  >,
  panelKey: ProfileExtendedPanelKey,
  block: Record<string, any>,
  row: KbBlockRow | null
) {
  const current = buckets.get(panelKey) || [];
  current.push({ block, row });
  buckets.set(panelKey, current);
}

function classifyBlock(
  row: KbBlockRow,
  block: Record<string, any>
): ProfileExtendedPanelKey | null {
  const source = row.section_key;
  const title = normalizeText(block.title);
  const rowHeading = normalizeText(row.content?.heading);
  const rowSubheading = normalizeText(row.content?.subheading);

  if (source === "result_interpretation_scripts") {
    if (title.includes("what is usually happening in the market")) {
      return "market_happening";
    }
    if (title.includes("core reading")) {
      return "core_reading";
    }
    if (
      title.includes("best fit strategic focus") ||
      title.includes("what usually helps") ||
      title.includes("what usually does not help") ||
      title.includes("signs the business is ready")
    ) {
      return "what_to_focus_on_now";
    }
    return "core_diagnosis";
  }

  if (source === "level_progression_roadmap") {
    if (rowHeading.includes("progression roadmap language")) {
      return "what_progression_looks_like_next";
    }
    if (title.includes("readiness")) {
      return "how_to_recognise_readiness";
    }
    if (rowSubheading.includes("levels")) {
      return "level_meaning";
    }
    return "level_meaning";
  }

  if (source === "visibility_signal_framework") {
    if (
      rowSubheading === "discoverability" ||
      rowSubheading === "credibility" ||
      rowSubheading === "authority" ||
      rowSubheading === "positioning" ||
      rowSubheading === "influence"
    ) {
      return "wider_signal_pathway";
    }
    if (title.includes("progression pattern")) {
      return "progression_pattern";
    }
    return "current_signal_pattern";
  }

  if (source === "visibility_audit_layer") {
    if (rowHeading.includes("behaviour strategy by tier")) {
      return "how_to_use_this_layer";
    }
    if (rowHeading.includes("behaviour style layer")) {
      return "type_interpretation";
    }
    if (rowHeading.includes("pillar reading guidance")) {
      return "current_signal_pattern";
    }
    return "type_interpretation";
  }

  return null;
}

function buildSyntheticAtAGlance(input: ProfileExtendedReportInput): Record<string, any> {
  const readiness =
    input.readiness === "ready_to_progress"
      ? "Ready to progress"
      : input.readiness === "stabilise"
      ? "Stabilise"
      : "Stabilise";

  return makeBlock({
    title: "Plain-English summary",
    summary: `You are in the ${input.tier} tier at Level ${input.level}, with behaviour style ${input.behaviour_style} and readiness set to ${readiness}.`,
    paragraphs: [
      "Tier explains the current stage of market visibility. Level explains how stable or advanced that stage currently is.",
      "Behaviour style shows how this person is most likely to implement strategy consistently, while readiness guides how aggressive the next move should be.",
    ],
    transition:
      "This section anchors the internal interpretation before moving into deeper diagnosis.",
  });
}

function buildSyntheticCurrentSignalPattern(
  input: ProfileExtendedReportInput
): Record<string, any> {
  const { strongest, weakest } = strongestWeakest(input);

  return makeBlock({
    title: "Current signal pattern",
    summary: `${strongest.label} is currently the strongest visible signal, while ${weakest.label} looks like the main limiting factor.`,
    paragraphs: [
      "Pillar percentages should be used as interpretive clues rather than isolated verdicts.",
      "A lower pillar usually points to missing or weak signals that need strengthening before the next step will hold.",
    ],
    transition:
      "The same low pillar can mean different things at different levels, so the pillar pattern should always be read together with the tier and level.",
  });
}

function buildSyntheticProgressionPattern(): Record<string, any> {
  return makeBlock({
    title: "Progression pattern",
    summary: "Discoverability → Credibility → Authority → Positioning → Influence",
    paragraphs: [
      "Each stage builds on the one before it.",
      "Businesses that try to skip a stage usually create unstable growth.",
    ],
  });
}

function buildSyntheticLevelMeaning(
  input: ProfileExtendedReportInput
): Record<string, any> {
  return makeBlock({
    title: `Level ${input.level} meaning`,
    summary: LEVEL_LABELS[input.level] || `Level ${input.level}`,
    paragraphs: [
      `Inside the ${input.tier} tier, Level ${input.level} shows how stable and advanced this stage currently is.`,
      "The level acts as the precision layer. It shows not just where the business is, but how developed that stage currently is.",
    ],
  });
}

function buildSyntheticMeaningInPractice(
  input: ProfileExtendedReportInput
): Record<string, any> {
  const summary =
    input.tier === "Invisible"
      ? "Visibility is still fragile and inconsistent."
      : input.tier === "Emerging"
      ? "The business is gaining recognition but is not yet the default choice."
      : input.tier === "Established"
      ? "The business is respected and recognised."
      : "The business has visible authority and category pull.";

  return makeBlock({
    title: "Meaning in practice",
    summary,
  });
}

function buildSyntheticTypeInterpretation(
  input: ProfileExtendedReportInput
): Record<string, any> {
  return makeBlock({
    title: `Type ${input.behaviour_style} interpretation`,
    summary: STYLE_SUMMARIES[input.behaviour_style],
  });
}

function buildSyntheticHowToUseLayer(
  input: ProfileExtendedReportInput
): Record<string, any> {
  return makeBlock({
    title: "How to use this layer",
    summary: STYLE_USAGE[input.behaviour_style],
  });
}

function buildSyntheticStrategicPriority(
  input: ProfileExtendedReportInput
): Record<string, any> {
  const summary =
    input.tier === "Invisible"
      ? "Build discoverability and credibility first."
      : input.tier === "Emerging"
      ? "Strengthen trust and conversion consistency."
      : input.tier === "Established"
      ? "Consolidate authority into visible leadership and influence."
      : "Protect authority while scaling category impact.";

  return makeBlock({
    title: "What to focus on now",
    summary,
    paragraphs: [
      "The goal is not to do more everywhere. It is to strengthen the part of the system that is currently limiting progress.",
    ],
  });
}

function buildSyntheticNextProgression(
  input: ProfileExtendedReportInput
): Record<string, any> {
  const next =
    input.tier === "Invisible"
      ? "Emerging"
      : input.tier === "Emerging"
      ? "Established"
      : input.tier === "Established"
      ? "Magnetic"
      : "Expanded influence";

  return makeBlock({
    title: "What progression looks like next",
    summary: next,
    paragraphs: [
      "A useful report should explain movement, not just diagnosis.",
    ],
  });
}

function buildSyntheticReadiness(
  input: ProfileExtendedReportInput
): Record<string, any> {
  const summary =
    input.readiness === "ready_to_progress"
      ? "The current pattern suggests the next-stage signals are beginning to consolidate."
      : "The current pattern suggests that the base still needs to stabilise before aggressive next-stage moves will hold.";

  return makeBlock({
    title: "How to recognise readiness",
    summary,
    paragraphs: [
      "Readiness is there to guide how aggressive the next move should be.",
      "Stabilise means strengthen the base first. Ready to progress means the next-stage signals are beginning to consolidate.",
    ],
  });
}

function ensureRequiredPanels(
  buckets: Map<
    ProfileExtendedPanelKey,
    Array<{ block: Record<string, any>; row: KbBlockRow | null }>
  >,
  input: ProfileExtendedReportInput
) {
  if (!(buckets.get("plain_english_summary") || []).length) {
    pushBucket(buckets, "plain_english_summary", buildSyntheticAtAGlance(input), null);
  }
  if (!(buckets.get("current_signal_pattern") || []).length) {
    pushBucket(
      buckets,
      "current_signal_pattern",
      buildSyntheticCurrentSignalPattern(input),
      null
    );
  }
  if (!(buckets.get("progression_pattern") || []).length) {
    pushBucket(buckets, "progression_pattern", buildSyntheticProgressionPattern(), null);
  }
  if (!(buckets.get("level_meaning") || []).length) {
    pushBucket(buckets, "level_meaning", buildSyntheticLevelMeaning(input), null);
  }
  if (!(buckets.get("meaning_in_practice") || []).length) {
    pushBucket(
      buckets,
      "meaning_in_practice",
      buildSyntheticMeaningInPractice(input),
      null
    );
  }
  if (!(buckets.get("type_interpretation") || []).length) {
    pushBucket(
      buckets,
      "type_interpretation",
      buildSyntheticTypeInterpretation(input),
      null
    );
  }
  if (!(buckets.get("how_to_use_this_layer") || []).length) {
    pushBucket(
      buckets,
      "how_to_use_this_layer",
      buildSyntheticHowToUseLayer(input),
      null
    );
  }
  if (!(buckets.get("what_to_focus_on_now") || []).length) {
    pushBucket(
      buckets,
      "what_to_focus_on_now",
      buildSyntheticStrategicPriority(input),
      null
    );
  }
  if (!(buckets.get("what_progression_looks_like_next") || []).length) {
    pushBucket(
      buckets,
      "what_progression_looks_like_next",
      buildSyntheticNextProgression(input),
      null
    );
  }
  if (!(buckets.get("how_to_recognise_readiness") || []).length) {
    pushBucket(
      buckets,
      "how_to_recognise_readiness",
      buildSyntheticReadiness(input),
      null
    );
  }
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
  const matchedRows = rows.filter((row) => rowMatchesInput(row, input));

  const buckets = new Map<
    ProfileExtendedPanelKey,
    Array<{ block: Record<string, any>; row: KbBlockRow | null }>
  >();

  for (const row of matchedRows) {
    const blocks = extractBlocks(row);
    for (const block of blocks) {
      const panelKey = classifyBlock(row, block);
      if (!panelKey) continue;
      pushBucket(buckets, panelKey, block, row);
    }
  }

  ensureRequiredPanels(buckets, input);

  const sections: AssembledProfileExtendedSection[] = [];

  for (const sectionDef of REPORT_STRUCTURE) {
    const panels: AssembledProfileExtendedPanel[] = [];

    for (const panelDef of sectionDef.panels) {
      const bucket = buckets.get(panelDef.panel_key) || [];
      if (!bucket.length) continue;

      const blocks: Array<Record<string, any>> = bucket.map((item) =>
        makeBlock({
          ...item.block,
          title: safeString(item.block.title) || panelDef.title,
        })
      );

      const rowRefs = bucket
        .filter((item) => item.row !== null)
        .map((item) => {
          const row = item.row as KbBlockRow;
          return {
            id: row.id,
            priority: row.priority,
            source_section_key: row.section_key,
            triggers: row.triggers || {},
          };
        });

      panels.push({
        panel_key: panelDef.panel_key,
        title: defaultPanelTitle(panelDef.panel_key),
        blocks,
        matched_rows: uniqueRows(rowRefs),
      });
    }

    if (!panels.length) continue;

    sections.push({
      section_key: sectionDef.section_key,
      heading: sectionDef.heading,
      panels,
      matched_rows: uniqueRows(panels.flatMap((panel) => panel.matched_rows)),
    });
  }

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