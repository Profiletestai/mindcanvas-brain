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
  section_key: string;
  heading: string | null;
  subheading: string | null;
  blocks: Array<Record<string, any>>;
  matched_rows: Array<{
    id: string;
    priority: number;
    triggers: Record<string, any>;
  }>;
};

export type AssembledProfileExtendedReport = {
  audience: "profile_extended_report";
  input: ProfileExtendedReportInput;
  sections: AssembledReportSection[];
};

const SECTION_ORDER = [
  "result_interpretation_scripts",
  "level_progression_roadmap",
  "visibility_signal_framework",
  "visibility_audit_layer",
] as const;

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
  if (Array.isArray(content.blocks)) return content.blocks;
  return [];
}

function firstHeading(rows: KbBlockRow[]): { heading: string | null; subheading: string | null } {
  const first = rows.find((r) => r.content?.heading || r.content?.subheading);
  return {
    heading: (first?.content?.heading as string) ?? null,
    subheading: (first?.content?.subheading as string) ?? null,
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

  const sections: AssembledReportSection[] = [];

  for (const sectionKey of SECTION_ORDER) {
    const sectionRows = matched.filter((row) => row.section_key === sectionKey);
    if (!sectionRows.length) continue;

    const { heading, subheading } = firstHeading(sectionRows);

    sections.push({
      section_key: sectionKey,
      heading,
      subheading,
      blocks: sectionRows.flatMap((row) => normalizeBlocks(row.content)),
      matched_rows: sectionRows.map((row) => ({
        id: row.id,
        priority: row.priority,
        triggers: row.triggers || {},
      })),
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