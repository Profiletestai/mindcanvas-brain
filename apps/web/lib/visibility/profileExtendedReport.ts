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

const SOURCE_SECTION_ORDER = [
  "result_interpretation_scripts",
  "level_progression_roadmap",
  "visibility_signal_framework",
  "visibility_audit_layer",
] as const;

const REPORT_STRUCTURE: Array<{
  section_key: ProfileExtendedSectionKey;
  heading: string;
  panels: Array<{
    panel_key: ProfileExtendedPanelKey;
    title: string;
  }>;
}> = [
  {
    section_key: "result_at_a_glance",
    heading: "Result at a glance",
    panels: [
      { panel_key: "plain_english_summary", title: "Plain-English summary" },
    ],
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
    panels: [
      { panel_key: "what_to_focus_on_now", title: "What to focus on now" },
    ],
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

function makeBlock(partial?: Record<string, any> | null): Record<string, any> {
  const src = partial || {};
  const title =
    safeString(src.title) ||
    safeString(src.heading) ||
    safeString(src.subheading) ||
    "";
  const shortSummary =
    safeString(src.short_summary) ||
    safeString(src.summary) ||
    "";
  const paragraphs = Array.isArray(src.paragraphs)
    ? src.paragraphs.map((p: any) => safeString(p)).filter(Boolean)
    : [];
  const bullets = Array.isArray(src.bullets)
    ? src.bullets.map((b: any) => safeString(b)).filter(Boolean)
    : [];
  const transition = safeString(src.transition);

  const out: Record<string, any> = {
    ...src,
    title,
    short_summary: shortSummary || undefined,
    paragraphs,
    bullets,
    transition: transition || undefined,
  };

  return out;
}

function normalizeBlocks(content: Record<string, any> | null | undefined): Array<Record<string, any>> {
  if (!content) return [];

  if (Array.isArray(content.blocks)) {
    return content.blocks
      .filter((block): block is Record<string, any> => !!block && typeof block === "object")
      .map((block) => makeBlock(block));
  }

  const hasSingleBlockFields =
    content.title != null ||
    content.heading != null ||
    content.subheading != null ||
    content.short_summary != null ||
    content.summary != null ||
    Array.isArray(content.paragraphs) ||
    Array.isArray(content.bullets) ||
    content.transition != null;

  if (hasSingleBlockFields) {
    return [makeBlock(content)];
  }

  return [];
}

function buildSyntheticBlocksFromRow(row: KbBlockRow): Array<Record<string, any>> {
  const content = row.content || {};
  const block = makeBlock(content);

  if (
    !safeString(block.title) &&
    !safeString(block.short_summary) &&
    !(Array.isArray(block.paragraphs) && block.paragraphs.length) &&
    !(Array.isArray(block.bullets) && block.bullets.length) &&
    !safeString(block.transition)
  ) {
    return [];
  }

  return [block];
}

function panelToSection(panelKey: ProfileExtendedPanelKey): ProfileExtendedSectionKey {
  const lookup: Record<ProfileExtendedPanelKey, ProfileExtendedSectionKey> = {
    plain_english_summary: "result_at_a_glance",
    core_diagnosis: "what_this_tier_means",
    market_happening: "what_this_tier_means",
    core_reading: "what_this_tier_means",
    level_meaning: "level_nuance",
    meaning_in_practice: "level_nuance",
    current_signal_pattern: "pillars_and_signals",
    wider_signal_pathway: "pillars_and_signals",
    progression_pattern: "pillars_and_signals",
    type_interpretation: "behaviour_style",
    how_to_use_this_layer: "behaviour_style",
    what_to_focus_on_now: "strategic_priority_now",
    what_progression_looks_like_next: "progression_roadmap",
    how_to_recognise_readiness: "progression_roadmap",
  };

  return lookup[panelKey];
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
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function classifyPanelTitle(title: string): ProfileExtendedPanelKey | null {
  const t = normalizeText(title);
  if (!t) return null;

  if (t === "plain english summary") return "plain_english_summary";

  if (t === "core diagnosis") return "core_diagnosis";
  if (t === "what is likely happening in the market") return "market_happening";
  if (t === "core reading") return "core_reading";

  if (/^level \d+ meaning$/.test(t) || t === "level meaning") return "level_meaning";
  if (t === "meaning in practice") return "meaning_in_practice";

  if (t === "current signal pattern") return "current_signal_pattern";
  if (t === "the wider signal pathway") return "wider_signal_pathway";
  if (t === "progression pattern") return "progression_pattern";

  if (/^type [abcd] interpretation$/.test(t) || t === "type interpretation") {
    return "type_interpretation";
  }
  if (t === "how to use this layer") return "how_to_use_this_layer";

  if (t === "what to focus on now") return "what_to_focus_on_now";

  if (t === "what progression looks like next") return "what_progression_looks_like_next";
  if (t === "how to recognise readiness") return "how_to_recognise_readiness";

  return null;
}

function resolvePanelForRow(
  row: KbBlockRow,
  block: Record<string, any>
): ProfileExtendedPanelKey | null {
  const candidates = [
    safeString(block.title),
    safeString((row.content || {}).subheading),
    safeString((row.content || {}).heading),
  ];

  for (const candidate of candidates) {
    const direct = classifyPanelTitle(candidate);
    if (direct) return direct;
  }

  const source = row.section_key;
  const rowHeading = normalizeText((row.content || {}).heading);
  const rowSubheading = normalizeText((row.content || {}).subheading);
  const blockTitle = normalizeText(block.title);
  const blockSummary = normalizeText(block.short_summary);

  if (source === "result_interpretation_scripts") {
    if (blockTitle.includes("market") || blockSummary.includes("market")) {
      return "market_happening";
    }
    if (blockTitle.includes("core reading")) {
      return "core_reading";
    }
    if (
      blockTitle.includes("best fit strategic focus") ||
      blockTitle.includes("what usually helps") ||
      blockTitle.includes("what usually does not help") ||
      blockTitle.includes("signs the business is ready")
    ) {
      return "what_to_focus_on_now";
    }
    return "core_diagnosis";
  }

  if (source === "level_progression_roadmap") {
    if (
      blockTitle.includes("recognise readiness") ||
      rowSubheading.includes("expanded influence")
    ) {
      return "how_to_recognise_readiness";
    }
    if (
      blockTitle.includes("progression") ||
      rowHeading.includes("progression roadmap language")
    ) {
      return "what_progression_looks_like_next";
    }
    if (rowSubheading.includes("levels") || rowHeading.includes("level progression roadmap")) {
      return "level_meaning";
    }
    return "meaning_in_practice";
  }

  if (source === "visibility_signal_framework") {
    if (rowHeading.includes("pillar reading guidance")) {
      return "current_signal_pattern";
    }
    if (
      rowSubheading === "discoverability" ||
      rowSubheading === "credibility" ||
      rowSubheading === "authority" ||
      rowSubheading === "positioning" ||
      rowSubheading === "influence"
    ) {
      return "wider_signal_pathway";
    }
    if (rowHeading.includes("final content rules")) {
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

function buildAtAGlanceBlock(input: ProfileExtendedReportInput): Record<string, any> {
  const readiness = safeString(input.readiness || "");
  const readinessText =
    readiness === "ready_to_progress"
      ? "ready to progress"
      : readiness === "stabilise"
      ? "stabilise"
      : "stabilise";

  return makeBlock({
    title: "Plain-English summary",
    short_summary: `You are in the ${input.tier} tier at Level ${input.level}, with behaviour style ${input.behaviour_style} and readiness set to ${readinessText}.`,
    paragraphs: [
      `Tier explains the current stage of market visibility. Level explains how stable or advanced that stage currently is.`,
      `Behaviour style shows how this person is most likely to sustain strategy in practice, while readiness helps guide how aggressive the next move should be.`,
    ],
    transition:
      "This section gives the report its structural truth before moving into deeper interpretation.",
  });
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
  const matchedRows = rows
    .filter((row) => SOURCE_SECTION_ORDER.includes(row.section_key as any))
    .filter((row) => rowMatchesInput(row, input))
    .sort((a, b) => b.priority - a.priority);

  const bucketMap = new Map<
    ProfileExtendedPanelKey,
    Array<{
      block: Record<string, any>;
      row: KbBlockRow | null;
    }>
  >();

  const pushToBucket = (
    panelKey: ProfileExtendedPanelKey,
    block: Record<string, any>,
    row: KbBlockRow | null
  ) => {
    const existing = bucketMap.get(panelKey) || [];
    existing.push({ block, row });
    bucketMap.set(panelKey, existing);
  };

  // always seed the at-a-glance panel so the report is never empty at the top
  pushToBucket("plain_english_summary", buildAtAGlanceBlock(input), null);

  for (const row of matchedRows) {
    const blocks = normalizeBlocks(row.content).length
      ? normalizeBlocks(row.content)
      : buildSyntheticBlocksFromRow(row);

    for (const block of blocks) {
      const panelKey = resolvePanelForRow(row, block);
      if (!panelKey) continue;
      pushToBucket(panelKey, block, row);
    }
  }

  const sections: AssembledProfileExtendedSection[] = [];

  for (const sectionDef of REPORT_STRUCTURE) {
    const panels: AssembledProfileExtendedPanel[] = [];

    for (const panelDef of sectionDef.panels) {
      const bucket = bucketMap.get(panelDef.panel_key) || [];
      if (!bucket.length) continue;

      const blocks: Array<Record<string, any>> = bucket.map(({ block }) =>
        makeBlock({
          ...block,
          title: safeString(block.title) || panelDef.title,
          short_summary: safeString(block.short_summary || block.summary) || undefined,
        })
      );

      const matched_rows = uniqueRows(
        bucket
          .filter((item) => item.row !== null)
          .map((item) => {
            const row = item.row as KbBlockRow;
            return {
              id: row.id,
              priority: row.priority,
              source_section_key: row.section_key,
              triggers: row.triggers || {},
            };
          })
      );

      panels.push({
        panel_key: panelDef.panel_key,
        title: panelDef.title,
        blocks,
        matched_rows,
      });
    }

    if (!panels.length) continue;

    const matched_rows = uniqueRows(
      panels.flatMap((panel) => panel.matched_rows)
    );

    sections.push({
      section_key: sectionDef.section_key,
      heading: sectionDef.heading,
      panels,
      matched_rows,
    });
  }

  return {
    audience: "profile_extended_report",
    input,
    sections,
  };
}

export function getProfileExtendedSection(
  report: AssembledProfileExtendedReport | null | undefined,
  sectionKey: ProfileExtendedSectionKey
): AssembledProfileExtendedSection | null {
  if (!report) return null;
  return report.sections.find((section) => section.section_key === sectionKey) || null;
}

export function getProfileExtendedPanel(
  report: AssembledProfileExtendedReport | null | undefined,
  panelKey: ProfileExtendedPanelKey
): AssembledProfileExtendedPanel | null {
  if (!report) return null;

  for (const section of report.sections) {
    const panel = section.panels.find((item) => item.panel_key === panelKey);
    if (panel) return panel;
  }

  return null;
}

export function getProfileExtendedPanelBySection(
  report: AssembledProfileExtendedReport | null | undefined,
  sectionKey: ProfileExtendedSectionKey,
  panelKey: ProfileExtendedPanelKey
): AssembledProfileExtendedPanel | null {
  const section = getProfileExtendedSection(report, sectionKey);
  if (!section) return null;
  return section.panels.find((panel) => panel.panel_key === panelKey) || null;
}

export function panelHasContent(
  panel: AssembledProfileExtendedPanel | null | undefined
): boolean {
  return !!panel && Array.isArray(panel.blocks) && panel.blocks.length > 0;
}

export function sectionHasContent(
  section: AssembledProfileExtendedSection | null | undefined
): boolean {
  return !!section && Array.isArray(section.panels) && section.panels.length > 0;
}

export function getPanelTitle(
  panel: AssembledProfileExtendedPanel | null | undefined,
  panelKey: ProfileExtendedPanelKey
): string {
  return safeString(panel?.title) || defaultPanelTitle(panelKey);
}

export async function buildProfileExtendedReport(
  input: ProfileExtendedReportInput,
  sb?: VisibilityDbClient
): Promise<AssembledProfileExtendedReport> {
  const rows = await fetchKbRows(sb);
  return assembleProfileExtendedReport(rows, input);
}