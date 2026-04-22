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

export type AssembledProfileExtendedReport = {
  audience: "profile_extended_report";
  input: ProfileExtendedReportInput;
  sections: AssembledProfileExtendedSection[];
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

function makeBlock(src?: Record<string, any> | null): AssembledProfileExtendedBlock {
  const item = src || {};

  const paragraphs = Array.isArray(item.paragraphs)
    ? item.paragraphs.map((p: any) => safeString(p)).filter(Boolean)
    : [];

  const bullets = Array.isArray(item.bullets)
    ? item.bullets.map((b: any) => safeString(b)).filter(Boolean)
    : [];

  const items = Array.isArray(item.items)
    ? item.items.filter((x: any) => x && typeof x === "object")
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
    meta: item.meta && typeof item.meta === "object" ? item.meta : undefined,
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
  const existing = buckets.get(panelKey) || [];
  existing.push({ block, row });
  buckets.set(panelKey, existing);
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

function selectedLevelItem(row: KbBlockRow, level: number) {
  const blocks = Array.isArray(row.content?.blocks) ? row.content?.blocks : [];
  const levelsBlock = blocks.find(
    (b: any) => normalizeText(b?.heading) === "levels" && Array.isArray(b?.items)
  );
  if (!levelsBlock) return null;

  const items = Array.isArray(levelsBlock.items) ? levelsBlock.items : [];
  return items.find((item: any) => safeNumber(item?.level, -1) === level) || null;
}

function addSyntheticPanels(
  buckets: Map<
    ProfileExtendedPanelKey,
    Array<{ block: AssembledProfileExtendedBlock; row: KbBlockRow | null }>
  >,
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
      `${strongest.label} is currently the strongest visible signal, while ${weakest.label} looks like the main limiting factor.`
    ),
    null
  );
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

  addSyntheticPanels(buckets, input);

  let resultRow: KbBlockRow | null = null;
  let levelRoadmapRow: KbBlockRow | null = null;
  let roadmapLanguageRow: KbBlockRow | null = null;
  let frameworkIntroRow: KbBlockRow | null = null;
  const frameworkStageRows: KbBlockRow[] = [];
  let behaviourTypeRow: KbBlockRow | null = null;
  let behaviourTierRow: KbBlockRow | null = null;
  let pillarGuidanceRow: KbBlockRow | null = null;

  for (const row of matched) {
    const heading = normalizeText(row.content?.heading);
    const subheading = safeString(row.content?.subheading);

    if (row.section_key === "result_interpretation_scripts" && !resultRow) {
      resultRow = row;
      continue;
    }

    if (row.section_key === "level_progression_roadmap" && heading === "level progression roadmap") {
      if (!levelRoadmapRow) levelRoadmapRow = row;
      continue;
    }

    if (row.section_key === "level_progression_roadmap" && heading === "progression roadmap language") {
      if (!roadmapLanguageRow) roadmapLanguageRow = row;
      continue;
    }

    if (row.section_key === "visibility_signal_framework" && !subheading) {
      if (!frameworkIntroRow) frameworkIntroRow = row;
      continue;
    }

    if (row.section_key === "visibility_signal_framework" && subheading) {
      frameworkStageRows.push(row);
      continue;
    }

    if (row.section_key === "visibility_audit_layer" && heading === "behaviour style layer") {
      if (!behaviourTypeRow) behaviourTypeRow = row;
      continue;
    }

    if (row.section_key === "visibility_audit_layer" && heading === "behaviour strategy by tier") {
      if (!behaviourTierRow) behaviourTierRow = row;
      continue;
    }

    if (row.section_key === "visibility_audit_layer" && heading === "pillar reading guidance") {
      if (!pillarGuidanceRow) pillarGuidanceRow = row;
      continue;
    }
  }

  if (resultRow) {
    const blocks = Array.isArray(resultRow.content?.blocks) ? resultRow.content?.blocks : [];

    for (const raw of blocks) {
      const heading = normalizeText(raw?.heading);

      if (heading === "core reading") {
        pushPanel(buckets, "core_diagnosis", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "what is usually happening in the market") {
        pushPanel(buckets, "market_happening", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "why businesses tend to get stuck here") {
        pushPanel(buckets, "core_reading", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "report writing cue") {
        pushPanel(buckets, "core_reading", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "best fit strategic focus" || heading === "best-fit strategic focus") {
        pushPanel(buckets, "what_to_focus_on_now", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "what usually helps most at this stage") {
        pushPanel(buckets, "what_to_focus_on_now", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "what usually does not help yet") {
        pushPanel(buckets, "what_to_focus_on_now", makeBlock(raw), resultRow);
        continue;
      }

      if (heading === "signs the business is ready to progress") {
        pushPanel(buckets, "how_to_recognise_readiness", makeBlock(raw), resultRow);
        continue;
      }
    }
  }

  if (levelRoadmapRow) {
    const blocks = Array.isArray(levelRoadmapRow.content?.blocks)
      ? levelRoadmapRow.content?.blocks
      : [];

    for (const raw of blocks) {
      const heading = normalizeText(raw?.heading);

      if (heading === "meaning in practice") {
        pushPanel(buckets, "meaning_in_practice", makeBlock(raw), levelRoadmapRow);
        continue;
      }

      if (heading === "consultant read") {
        pushPanel(buckets, "level_meaning", makeBlock(raw), levelRoadmapRow);
        continue;
      }
    }

    const selected = selectedLevelItem(levelRoadmapRow, input.level);
    if (selected) {
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
        levelRoadmapRow
      );
    }
  }

  if (roadmapLanguageRow) {
    const blocks = Array.isArray(roadmapLanguageRow.content?.blocks)
      ? roadmapLanguageRow.content?.blocks
      : [];

    for (const raw of blocks) {
      pushPanel(
        buckets,
        "what_progression_looks_like_next",
        makeBlock(raw),
        roadmapLanguageRow
      );
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

    const blocks = Array.isArray(frameworkIntroRow.content?.blocks)
      ? frameworkIntroRow.content?.blocks
      : [];

    for (const raw of blocks) {
      const heading = normalizeText(raw?.heading);
      if (heading === "progression pattern") {
        pushPanel(buckets, "progression_pattern", makeBlock(raw), frameworkIntroRow);
      } else {
        pushPanel(buckets, "wider_signal_pathway", makeBlock(raw), frameworkIntroRow);
      }
    }
  }

  for (const row of frameworkStageRows) {
    const blocks = Array.isArray(row.content?.blocks) ? row.content?.blocks : [];
    const subheading = safeString(row.content?.subheading) || "Framework";

    const items: Array<Record<string, any>> = [];
    for (const raw of blocks) {
      const label = safeString(raw?.heading);
      const value = safeString(raw?.summary);
      if (label || value) {
        items.push({ label, value });
      }
    }

    if (items.length) {
      pushPanel(
        buckets,
        "wider_signal_pathway",
        makeSimpleBlock(subheading, undefined, { items }),
        row
      );
    }
  }

  if (behaviourTypeRow) {
    const blocks = Array.isArray(behaviourTypeRow.content?.blocks)
      ? behaviourTypeRow.content?.blocks
      : [];

    for (const raw of blocks) {
      pushPanel(buckets, "type_interpretation", makeBlock(raw), behaviourTypeRow);
    }
  }

  if (behaviourTierRow) {
    const blocks = Array.isArray(behaviourTierRow.content?.blocks)
      ? behaviourTierRow.content?.blocks
      : [];

    for (const raw of blocks) {
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

    const blocks = Array.isArray(pillarGuidanceRow.content?.blocks)
      ? pillarGuidanceRow.content?.blocks
      : [];

    for (const raw of blocks) {
      pushPanel(buckets, "current_signal_pattern", makeBlock(raw), pillarGuidanceRow);
    }
  }

  const structure = buildStructure(input);
  const sections: AssembledProfileExtendedSection[] = [];

  for (const sectionDef of structure) {
    const panels: AssembledProfileExtendedPanel[] = [];

    for (const panelDef of sectionDef.panels) {
      const bucket = buckets.get(panelDef.panel_key) || [];
      if (!bucket.length) continue;

      const matchedRows = uniqueRows(
        bucket
          .filter((item) => item.row !== null)
          .map((item) => rowRef(item.row as KbBlockRow))
      );

      panels.push({
        panel_key: panelDef.panel_key,
        title: panelDef.title,
        blocks: bucket.map((item) => item.block),
        matched_rows: matchedRows,
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