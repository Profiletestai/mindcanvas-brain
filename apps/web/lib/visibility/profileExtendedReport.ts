// apps/web/lib/visibility/profileExtendedReport.ts
import { createClient } from "@supabase/supabase-js";

export type VisibilityTier =
  | "Invisible"
  | "Emerging"
  | "Established"
  | "Magnetic";

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

export type NormalizedReportBlock = {
  title?: string | null;
  short_summary?: string | null;
  paragraphs: string[];
  bullets?: string[];
  transition?: string | null;
};

export type AssembledReportSection = {
  key: string;
  section_key: string;
  title: string | null;
  heading: string | null;
  subheading: string | null;
  blocks: NormalizedReportBlock[];
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

const SECTION_TITLES: Record<string, string> = {
  result_interpretation_scripts: "Result Interpretation",
  level_progression_roadmap: "Level Progression Roadmap",
  visibility_signal_framework: "Visibility Signal Framework",
  visibility_audit_layer: "Visibility Audit Layer",
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
    throw new Error(
      "Missing Supabase credentials for visibility profile extended report"
    );
  }

  return createClient(url, key, {
    db: { schema: "visibility" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type VisibilityDbClient = ReturnType<typeof createVisibilityAdminClient>;

function asString(value: any): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function normalizeStringList(value: any): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => asString(v))
      .filter(Boolean);
  }
  const single = asString(value);
  return single ? [single] : [];
}

function readNumericTrigger(value: any): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function matchesArrayTrigger(
  value: string | null | undefined,
  allowedRaw: any
): boolean {
  const allowed = normalizeStringList(allowedRaw);
  if (!allowed.length) return true;

  const current = asString(value).toLowerCase();
  if (!current) return false;

  return allowed.some((item) => asString(item).toLowerCase() === current);
}

function matchesRange(
  value: number | null | undefined,
  min?: number,
  max?: number
): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  if (typeof min === "number" && value < min) return false;
  if (typeof max === "number" && value > max) return false;
  return true;
}

function rowMatchesInput(row: KbBlockRow, input: ProfileExtendedReportInput): boolean {
  const triggers = row.triggers || {};

  if (!matchesArrayTrigger(input.tier, triggers.tier)) return false;
  if (!matchesArrayTrigger(input.behaviour_style, triggers.behaviour_style)) {
    return false;
  }

  const readinessTriggerExists = normalizeStringList(triggers.readiness).length > 0;
  if (readinessTriggerExists) {
    if (!matchesArrayTrigger(input.readiness ?? null, triggers.readiness)) {
      return false;
    }
  }

  const levelMin = readNumericTrigger(triggers.level_min);
  const levelMax = readNumericTrigger(triggers.level_max);

  if (
    (levelMin !== undefined || levelMax !== undefined) &&
    !matchesRange(input.level, levelMin, levelMax)
  ) {
    return false;
  }

  return true;
}

function normalizeParagraphs(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean);
  }
  const single = asString(value);
  return single ? [single] : [];
}

function normalizeBullets(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

function normalizeSingleBlock(raw: any): NormalizedReportBlock | null {
  if (!raw || typeof raw !== "object") return null;

  const title = asString(raw.title || raw.heading) || null;
  const short_summary =
    asString(raw.short_summary || raw.summary || raw.subheading) || null;

  const paragraphs = normalizeParagraphs(
    raw.paragraphs ??
      raw.paragraph ??
      raw.body ??
      raw.text
  );

  const bullets = normalizeBullets(raw.bullets);
  const transition = asString(raw.transition) || null;

  const hasContent =
    Boolean(title) ||
    Boolean(short_summary) ||
    paragraphs.length > 0 ||
    bullets.length > 0 ||
    Boolean(transition);

  if (!hasContent) return null;

  return {
    title,
    short_summary,
    paragraphs,
    bullets: bullets.length ? bullets : undefined,
    transition,
  };
}

function normalizeBlocks(
  content: Record<string, any> | null | undefined
): NormalizedReportBlock[] {
  if (!content) return [];

  if (Array.isArray(content.blocks)) {
    return content.blocks
      .map((block) => normalizeSingleBlock(block))
      .filter(Boolean) as NormalizedReportBlock[];
  }

  const single = normalizeSingleBlock(content);
  return single ? [single] : [];
}

function resolveSectionMeta(rows: KbBlockRow[], sectionKey: string) {
  const firstWithMeta = rows.find(
    (r) =>
      r.content?.heading ||
      r.content?.title ||
      r.content?.subheading
  );

  const heading =
    asString(firstWithMeta?.content?.heading || firstWithMeta?.content?.title) ||
    SECTION_TITLES[sectionKey] ||
    sectionKey;

  const subheading =
    asString(firstWithMeta?.content?.subheading || firstWithMeta?.content?.summary) ||
    null;

  return {
    title: heading,
    heading,
    subheading,
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
    throw new Error(
      `Failed to load profile_extended_report KB blocks: ${error.message}`
    );
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

    const meta = resolveSectionMeta(sectionRows, sectionKey);

    const blocks = sectionRows.flatMap((row) => normalizeBlocks(row.content));

    if (!blocks.length) {
      continue;
    }

    sections.push({
      key: sectionKey,
      section_key: sectionKey,
      title: meta.title,
      heading: meta.heading,
      subheading: meta.subheading,
      blocks,
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