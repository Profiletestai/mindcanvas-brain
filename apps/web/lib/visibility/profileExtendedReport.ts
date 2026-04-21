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
      {
        panel_key: "plain_english_summary",
        title: "Plain-English summary",
      },
    ],
  },
  {
    section_key: "what_this_tier_means",
    heading: "What this tier means",
    panels: [
      {
        panel_key: "core_diagnosis",
        title: "Core diagnosis",
      },
      {
        panel_key: "market_happening",
        title: "What is likely happening in the market",
      },
      {
        panel_key: "core_reading",
        title: "Core reading",
      },
    ],
  },
  {
    section_key: "level_nuance",
    heading: "Level nuance",
    panels: [
      {
        panel_key: "level_meaning",
        title: "Level meaning",
      },
      {
        panel_key: "meaning_in_practice",
        title: "Meaning in practice",
      },
    ],
  },
  {
    section_key: "pillars_and_signals",
    heading: "Pillars and signals",
    panels: [
      {
        panel_key: "current_signal_pattern",
        title: "Current signal pattern",
      },
      {
        panel_key: "wider_signal_pathway",
        title: "The wider signal pathway",
      },
      {
        panel_key: "progression_pattern",
        title: "Progression pattern",
      },
    ],
  },
  {
    section_key: "behaviour_style",
    heading: "Behaviour style",
    panels: [
      {
        panel_key: "type_interpretation",
        title: "Type interpretation",
      },
      {
        panel_key: "how_to_use_this_layer",
        title: "How to use this layer",
      },
    ],
  },
  {
    section_key: "strategic_priority_now",
    heading: "Strategic priority now",
    panels: [
      {
        panel_key: "what_to_focus_on_now",
        title: "What to focus on now",
      },
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

function normalizeBlocks(content: Record<string, any> | null | undefined): Array<Record<string, any>> {
  if (!content) return [];

  if (Array.isArray(content.blocks)) {
    return content.blocks.filter((block): block is Record<string, any> => {
      return !!block && typeof block === "object";
    });
  }

  const looksLikeSingleBlock =
    content.title != null ||
    content.short_summary != null ||
    Array.isArray(content.paragraphs) ||
    Array.isArray(content.bullets) ||
    content.transition != null;

  if (looksLikeSingleBlock) {
    return [content];
  }

  return [];
}

function buildSyntheticBlocksFromRow(row: KbBlockRow): Array<Record<string, any>> {
  const content = row.content || {};
  const title = safeString(content.subheading) || safeString(content.heading);
  const paragraphs = Array.isArray(content.paragraphs) ? content.paragraphs : [];
  const bullets = Array.isArray(content.bullets) ? content.bullets : [];
  const shortSummary = safeString(content.short_summary);
  const transition = safeString(content.transition);

  if (!title && !paragraphs.length && !bullets.length && !shortSummary && !transition) {
    return [];
  }

  return [
    {
      title,
      short_summary: shortSummary || undefined,
      paragraphs,
      bullets,
      transition: transition || undefined,
    },
  ];
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

function fallbackPanelFromRow(
  row: KbBlockRow,
  block: Record<string, any>
): ProfileExtendedPanelKey | null {
  const rowHeading = normalizeText(row.content?.heading);
  const rowSubheading = normalizeText(row.content?.subheading);
  const blockTitle = normalizeText(block.title);

  const candidates = [blockTitle, rowSubheading, rowHeading].filter(Boolean);

  for (const candidate of candidates) {
    const direct = classifyPanelTitle(candidate);
    if (direct) return direct;
  }

  if (rowHeading === "result at a glance") return "plain_english_summary";
  if (rowHeading === "what this tier means") return "core_diagnosis";
  if (rowHeading === "level nuance") return "level_meaning";
  if (rowHeading === "pillars and signals") return "current_signal_pattern";
  if (rowHeading === "behaviour style") return "type_interpretation";
  if (rowHeading === "strategic priority now") return "what_to_focus_on_now";
  if (rowHeading === "progression roadmap") return "what_progression_looks_like_next";

  return null;
}

function defaultPanelTitle(panelKey: ProfileExtendedPanelKey): string {
  for (const section of REPORT_STRUCTURE) {
    const hit = section.panels.find((panel) => panel.panel_key === panelKey);
    if (hit) return hit.title;
  }
  return panelKey;
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

  const panelBuckets = new Map<
    ProfileExtendedPanelKey,
    Array<{
      block: Record<string, any>;
      row: KbBlockRow;
    }>
  >();

  for (const row of matchedRows) {
    const normalized = normalizeBlocks(row.content);
    const blocks = normalized.length ? normalized : buildSyntheticBlocksFromRow(row);

    for (const block of blocks) {
      const explicitTitle =
        safeString(block.title) ||
        safeString(block.subheading) ||
        safeString(row.content?.subheading) ||
        safeString(row.content?.heading);

      const panelKey = classifyPanelTitle(explicitTitle) || fallbackPanelFromRow(row, block);
      if (!panelKey) continue;

      const bucket = panelBuckets.get(panelKey) || [];
      bucket.push({ block, row });
      panelBuckets.set(panelKey, bucket);
    }
  }

  const sections: AssembledProfileExtendedSection[] = REPORT_STRUCTURE.map((section) => {
    const panels: AssembledProfileExtendedPanel[] = section.panels
      .map((panel) => {
        const bucket = panelBuckets.get(panel.panel_key) || [];
        if (!bucket.length) return null;

        const matchedRowsForPanel = uniqueRows(
          bucket.map(({ row }) => ({
            id: row.id,
            priority: row.priority,
            source_section_key: row.section_key,
            triggers: row.triggers || {},
          }))
        );

        const firstTitledBlock = bucket.find(({ block }) => safeString(block.title));
        const title = safeString(firstTitledBlock?.block?.title) || panel.title;

        return {
          panel_key: panel.panel_key,
          title,
          blocks: bucket.map(({ block }) => block),
          matched_rows: matchedRowsForPanel,
        };
      })
      .filter((panel): panel is AssembledProfileExtendedPanel => !!panel);

    const matchedRowsForSection = uniqueRows(
      panels.flatMap((panel) => panel.matched_rows)
    );

    return {
      section_key: section.section_key,
      heading: section.heading,
      panels,
      matched_rows: matchedRowsForSection,
    };
  }).filter((section) => section.panels.length > 0);

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