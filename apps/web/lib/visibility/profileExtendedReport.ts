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
  pillar_scores?: {
    discoverability?: number | null;
    trust?: number | null;
    conversion?: number | null;
    visibility?: number | null;
    authority?: number | null;
    dominance?: number | null;
  } | null;
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

export type AssembledReportSection = {
  section_key:
    | "result_at_a_glance"
    | "what_this_tier_means"
    | "level_nuance"
    | "pillars_and_signals"
    | "behaviour_style"
    | "strategic_priority_now"
    | "progression_roadmap";
  heading: string | null;
  subheading: string | null;
  blocks: Array<Record<string, any>>;
  matched_rows: Array<{
    id: string;
    priority: number;
    triggers: Record<string, any>;
    source_section_key: string;
  }>;
};

export type AssembledProfileExtendedReport = {
  audience: "profile_extended_report";
  input: ProfileExtendedReportInput;
  sections: AssembledReportSection[];
};

const UI_SECTION_ORDER: AssembledReportSection["section_key"][] = [
  "result_at_a_glance",
  "what_this_tier_means",
  "level_nuance",
  "pillars_and_signals",
  "behaviour_style",
  "strategic_priority_now",
  "progression_roadmap",
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

  const readinessTrigger = Array.isArray(triggers.readiness) ? triggers.readiness : undefined;
  if (
    readinessTrigger &&
    readinessTrigger.length > 0 &&
    !matchesArrayTrigger(input.readiness ?? null, readinessTrigger)
  ) {
    return false;
  }

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
  if (Array.isArray(content.blocks)) return content.blocks;
  return [];
}

function safeString(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function rowHeading(row: KbBlockRow): string {
  return safeString(row.content?.heading).toLowerCase();
}

function rowSubheading(row: KbBlockRow): string {
  return safeString(row.content?.subheading).toLowerCase();
}

function blockSignature(block: Record<string, any>) {
  const heading = safeString(block.heading || block.title);
  const shortSummary = safeString(block.short_summary || block.summary);
  const paragraphs = Array.isArray(block.paragraphs)
    ? block.paragraphs.map((x: any) => safeString(x)).filter(Boolean).join(" | ")
    : "";
  const bullets = Array.isArray(block.bullets)
    ? block.bullets.map((x: any) => safeString(x)).filter(Boolean).join(" | ")
    : "";
  const transition = safeString(block.transition);
  return [heading, shortSummary, paragraphs, bullets, transition].join(" || ");
}

function dedupeBlocks(blocks: Array<Record<string, any>>): Array<Record<string, any>> {
  const seen = new Set<string>();
  const out: Array<Record<string, any>> = [];

  for (const block of blocks) {
    const sig = blockSignature(block);
    if (!sig) continue;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(block);
  }

  return out;
}

function firstHeading(rows: KbBlockRow[], fallbackHeading: string): { heading: string | null; subheading: string | null } {
  const first = rows.find((r) => r.content?.heading || r.content?.subheading);
  return {
    heading: safeString(first?.content?.heading) || fallbackHeading,
    subheading: safeString(first?.content?.subheading) || null,
  };
}

function includeAuditRowsForPillars(row: KbBlockRow) {
  const h = rowHeading(row);
  return h.includes("pillar reading guidance") || h.includes("final content rules");
}

function includeAuditRowsForBehaviour(row: KbBlockRow) {
  const h = rowHeading(row);
  const s = rowSubheading(row);
  return (
    h.includes("behaviour style layer") ||
    h.includes("behaviour strategy by tier") ||
    s.startsWith("type a") ||
    s.startsWith("type b") ||
    s.startsWith("type c") ||
    s.startsWith("type d")
  );
}

function buildUiSection(
  sectionKey: AssembledReportSection["section_key"],
  heading: string,
  sourceRows: KbBlockRow[]
): AssembledReportSection | null {
  const rows = [...sourceRows].sort((a, b) => b.priority - a.priority);
  if (!rows.length) return null;

  const resolved = firstHeading(rows, heading);

  return {
    section_key: sectionKey,
    heading: resolved.heading,
    subheading: resolved.subheading,
    blocks: dedupeBlocks(rows.flatMap((row) => normalizeBlocks(row.content))),
    matched_rows: rows.map((row) => ({
      id: row.id,
      priority: row.priority,
      triggers: row.triggers || {},
      source_section_key: row.section_key,
    })),
  };
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
    .filter((row) => rowMatchesInput(row, input))
    .sort((a, b) => b.priority - a.priority);

  const resultRows = matched.filter((row) => row.section_key === "result_interpretation_scripts");
  const roadmapRows = matched.filter((row) => row.section_key === "level_progression_roadmap");
  const signalRows = matched.filter((row) => row.section_key === "visibility_signal_framework");
  const auditRows = matched.filter((row) => row.section_key === "visibility_audit_layer");

  const sections: AssembledReportSection[] = [];

  const resultAtAGlance = buildUiSection(
    "result_at_a_glance",
    "Result at a glance",
    resultRows
  );

  const whatThisTierMeans = buildUiSection(
    "what_this_tier_means",
    "What this tier means",
    resultRows
  );

  const levelNuance = buildUiSection(
    "level_nuance",
    "Level nuance",
    roadmapRows
  );

  const pillarsAndSignals = buildUiSection(
    "pillars_and_signals",
    "Pillars and signals",
    [
      ...signalRows,
      ...auditRows.filter(includeAuditRowsForPillars),
    ]
  );

  const behaviourStyle = buildUiSection(
    "behaviour_style",
    "Behaviour style",
    auditRows.filter(includeAuditRowsForBehaviour)
  );

  const strategicPriorityNow = buildUiSection(
    "strategic_priority_now",
    "Strategic priority now",
    [...resultRows, ...roadmapRows]
  );

  const progressionRoadmap = buildUiSection(
    "progression_roadmap",
    "Progression roadmap",
    roadmapRows
  );

  const map: Partial<Record<AssembledReportSection["section_key"], AssembledReportSection | null>> = {
    result_at_a_glance: resultAtAGlance,
    what_this_tier_means: whatThisTierMeans,
    level_nuance: levelNuance,
    pillars_and_signals: pillarsAndSignals,
    behaviour_style: behaviourStyle,
    strategic_priority_now: strategicPriorityNow,
    progression_roadmap: progressionRoadmap,
  };

  for (const key of UI_SECTION_ORDER) {
    const section = map[key];
    if (section) sections.push(section);
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