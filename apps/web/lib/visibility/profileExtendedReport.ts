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

function classifyPanel(
  row: KbBlockRow,
  block: Record<string, any>
): ProfileExtendedPanelKey | null {
  const source = row.section_key;
  const title = normalizeText(block.title);
  const rowHeading = normalizeText(row.content?.heading);
  const rowSubheading = normalizeText(row.content?.subheading);

  if (source === "result_interpretation_scripts") {
    if (title.includes("market")) return "market_happening";
    if (title.includes("core reading")) return "core_reading";
    return "core_diagnosis";
  }

  if (source === "level_progression_roadmap") {
    if (title.includes("readiness") || rowSubheading.includes("expanded influence")) {
      return "how_to_recognise_readiness";
    }
    if (title.includes("progression") || rowHeading.includes("progression roadmap language")) {
      return "what_progression_looks_like_next";
    }
    if (rowHeading.includes("level progression roadmap") || rowSubheading.includes("levels")) {
      return "level_meaning";
    }
    return "meaning_in_practice";
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
    if (title.includes("progression pattern")) return "progression_pattern";
    return "current_signal_pattern";
  }

  if (source === "visibility_audit_layer") {
    if (rowHeading.includes("behaviour strategy by tier")) return "how_to_use_this_layer";
    return "type_interpretation";
  }

  return null;
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

function buildAtAGlanceBlock(input: ProfileExtendedReportInput): Record<string, any> {
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

async function fetchKbRows(): Promise<KbBlockRow[]> {
  const client = createVisibilityAdminClient();

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
    .filter((row) => rowMatchesInput(row, input))
    .sort((a, b) => b.priority - a.priority);

  const panelBuckets = new Map<
    ProfileExtendedPanelKey,
    Array<{ block: Record<string, any>; row: KbBlockRow | null }>
  >();

  const pushBucket = (
    panelKey: ProfileExtendedPanelKey,
    block: Record<string, any>,
    row: KbBlockRow | null
  ) => {
    const current = panelBuckets.get(panelKey) || [];
    current.push({ block, row });
    panelBuckets.set(panelKey, current);
  };

  pushBucket("plain_english_summary", buildAtAGlanceBlock(input), null);

  for (const row of matchedRows) {
    const blocks = extractBlocks(row);

    for (const block of blocks) {
      const panelKey = classifyPanel(row, block);
      if (!panelKey) continue;
      pushBucket(panelKey, block, row);
    }
  }

  const sections: AssembledProfileExtendedSection[] = [];

  for (const sectionDef of REPORT_STRUCTURE) {
    const panels: AssembledProfileExtendedPanel[] = [];

    for (const panelDef of sectionDef.panels) {
      const bucket = panelBuckets.get(panelDef.panel_key) || [];
      if (!bucket.length) continue;

      const blocks: Array<Record<string, any>> = [];
      const rowRefs: Array<{
        id: string;
        priority: number;
        source_section_key: string;
        triggers: Record<string, any>;
      }> = [];

      for (const item of bucket) {
        blocks.push(
          makeBlock({
            ...item.block,
            title: safeString(item.block.title) || panelDef.title,
          })
        );

        if (item.row) {
          rowRefs.push({
            id: item.row.id,
            priority: item.row.priority,
            source_section_key: item.row.section_key,
            triggers: item.row.triggers || {},
          });
        }
      }

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
      matched_rows: uniqueRows(panels.flatMap((p) => p.matched_rows)),
    });
  }

  return {
    audience: "profile_extended_report",
    input,
    sections,
  };
}

export async function buildProfileExtendedReport(
  input: ProfileExtendedReportInput
): Promise<AssembledProfileExtendedReport> {
  const rows = await fetchKbRows();
  return assembleProfileExtendedReport(rows, input);
}