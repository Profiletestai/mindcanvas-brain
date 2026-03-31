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
  transition?: string | null;
};

export type AssembledReportSection = {
  key: string;
  title: string | null;
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

const SOURCE_SECTION_KEYS = [
  "result_interpretation_scripts",
  "level_progression_roadmap",
  "visibility_signal_framework",
  "visibility_audit_layer",
] as const;

const FINAL_SECTION_TITLES: Record<string, string> = {
  result_at_a_glance: "Your result at a glance",
  what_this_tier_means: "What this tier means",
  your_level_nuance: "Your level nuance",
  pillars_and_signals: "Pillars and signals",
  your_behaviour_style: "Your behaviour style",
  strategic_priority_now: "Strategic priority now",
  progression_roadmap: "Progression roadmap",
};

const SIGNAL_NAMES = [
  "Discoverability",
  "Credibility",
  "Authority",
  "Positioning",
  "Influence",
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

type SourceLibrarySection = {
  key: string;
  blocks: NormalizedReportBlock[];
  matched_rows: Array<{
    id: string;
    priority: number;
    triggers: Record<string, any>;
  }>;
};

function asString(value: any): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function normalizeStringList(value: any): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean);
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

  const readinessTriggers = normalizeStringList(triggers.readiness);
  if (readinessTriggers.length) {
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
    raw.paragraphs ?? raw.paragraph ?? raw.body ?? raw.text
  );

  const bullets = normalizeBullets(raw.bullets);
  const bulletParagraphs = bullets.map((b) => `• ${b}`);

  const transition = asString(raw.transition) || null;

  const combinedParagraphs = [...paragraphs, ...bulletParagraphs].filter(Boolean);

  const hasContent =
    Boolean(title) ||
    Boolean(short_summary) ||
    combinedParagraphs.length > 0 ||
    Boolean(transition);

  if (!hasContent) return null;

  return {
    title,
    short_summary,
    paragraphs: combinedParagraphs,
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

function blockText(block: NormalizedReportBlock | null | undefined): string {
  if (!block) return "";
  return [
    asString(block.title),
    asString(block.short_summary),
    ...(Array.isArray(block.paragraphs) ? block.paragraphs : []),
    asString(block.transition),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function blockMatches(block: NormalizedReportBlock, terms: string[]): boolean {
  const hay = blockText(block);
  return terms.some((term) => hay.includes(term.toLowerCase()));
}

function dedupeBlocks(blocks: NormalizedReportBlock[]): NormalizedReportBlock[] {
  const seen = new Set<string>();
  const out: NormalizedReportBlock[] = [];

  for (const block of blocks) {
    const sig = JSON.stringify({
      title: block.title || "",
      short_summary: block.short_summary || "",
      paragraphs: block.paragraphs || [],
      transition: block.transition || "",
    });

    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(block);
  }

  return out;
}

function getFirstSentence(block: NormalizedReportBlock | null | undefined): string {
  if (!block) return "";
  if (block.short_summary) return block.short_summary;
  if (block.paragraphs?.length) return block.paragraphs[0];
  return "";
}

function capitalizeLabel(value: string) {
  const s = asString(value).replace(/_/g, " ");
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function readinessLabel(readiness?: Readiness | null) {
  if (readiness === "ready_to_progress") return "Ready to progress";
  if (readiness === "stabilise") return "Stabilise";
  return "—";
}

function strongestWeakestPillars(
  pillarScores?: ProfileExtendedReportInput["pillar_scores"]
) {
  const entries = Object.entries(pillarScores || {})
    .map(([key, value]) => [key, Number(value) || 0] as const)
    .filter(([_, value]) => Number.isFinite(value));

  if (!entries.length) {
    return {
      strongest: null as string | null,
      weakest: null as string | null,
    };
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return {
    strongest: sorted[0]?.[0] || null,
    weakest: sorted[sorted.length - 1]?.[0] || null,
  };
}

function buildSourceLibraries(
  rows: KbBlockRow[],
  input: ProfileExtendedReportInput
): Record<string, SourceLibrarySection> {
  const matched = rows
    .filter((row) => rowMatchesInput(row, input))
    .sort((a, b) => b.priority - a.priority);

  const out: Record<string, SourceLibrarySection> = {};

  for (const key of SOURCE_SECTION_KEYS) {
    const sectionRows = matched.filter((row) => row.section_key === key);
    out[key] = {
      key,
      blocks: dedupeBlocks(
        sectionRows.flatMap((row) => normalizeBlocks(row.content))
      ),
      matched_rows: sectionRows.map((row) => ({
        id: row.id,
        priority: row.priority,
        triggers: row.triggers || {},
      })),
    };
  }

  return out;
}

function pickBlocks(
  source: SourceLibrarySection | undefined,
  terms: string[]
): NormalizedReportBlock[] {
  if (!source) return [];
  return source.blocks.filter((block) => blockMatches(block, terms));
}

function pickFirstBlock(
  source: SourceLibrarySection | undefined,
  terms: string[]
): NormalizedReportBlock | null {
  return pickBlocks(source, terms)[0] || null;
}

function buildAtGlanceBlock(
  input: ProfileExtendedReportInput,
  coreReading: NormalizedReportBlock | null
): NormalizedReportBlock {
  const summary = `You are in the ${input.tier} tier at Level ${input.level}, with behaviour style ${input.behaviour_style} and readiness set to ${readinessLabel(
    input.readiness
  )}.`;

  const core = getFirstSentence(coreReading);

  return {
    title: "Plain-English summary",
    short_summary: summary,
    paragraphs: core ? [core] : [],
    transition: null,
  };
}

function buildPillarPatternBlock(
  input: ProfileExtendedReportInput
): NormalizedReportBlock | null {
  const scores = input.pillar_scores || null;
  if (!scores || !Object.keys(scores).length) return null;

  const { strongest, weakest } = strongestWeakestPillars(scores);

  const rows = Object.entries(scores)
    .map(([key, value]) => ({
      key,
      value: Number(value) || 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    title: "Your current signal pattern",
    short_summary:
      weakest && strongest
        ? `${capitalizeLabel(strongest)} is currently the strongest signal, while ${capitalizeLabel(
            weakest
          )} looks like the main limiting factor.`
        : "Your pillar pattern shows where visibility is already supported and where signal gaps are still limiting progress.",
    paragraphs: rows.map(
      (row) => `${capitalizeLabel(row.key)}: ${row.value}%`
    ),
    transition: null,
  };
}

function buildSignalProfiles(
  source: SourceLibrarySection | undefined
): NormalizedReportBlock[] {
  if (!source) return [];

  const introTerms = ["progression pattern", "interpretation"];
  const introBlocks = source.blocks.filter((b) => blockMatches(b, introTerms));
  const remaining = source.blocks.filter((b) => !blockMatches(b, introTerms));

  if (!remaining.length) return introBlocks;

  const groups: NormalizedReportBlock[][] = [];
  for (let i = 0; i < remaining.length; i += 4) {
    groups.push(remaining.slice(i, i + 4));
  }

  const signalBlocks = groups.map((group, idx) => {
    const name = SIGNAL_NAMES[idx] || `Signal ${idx + 1}`;

    const paragraphs = group
      .map((block) => {
        const title = asString(block.title) || "Signal note";
        const body =
          block.short_summary ||
          (block.paragraphs && block.paragraphs.length
            ? block.paragraphs.join(" ")
            : "");
        return body ? `${title}: ${body}` : title;
      })
      .filter(Boolean);

    return {
      title: `${name} signal`,
      short_summary: null,
      paragraphs,
      transition: null,
    } satisfies NormalizedReportBlock;
  });

  return dedupeBlocks([...introBlocks, ...signalBlocks]);
}

function buildProgressionLanguageBlock(
  input: ProfileExtendedReportInput
): NormalizedReportBlock {
  const map: Record<
    VisibilityTier,
    { milestone: string; language: string }
  > = {
    Invisible: {
      milestone: "Reliable discoverability and visible trust",
      language:
        "Your next milestone is not bigger promotion. It is stronger visibility foundations that make the market take you seriously sooner.",
    },
    Emerging: {
      milestone: "Recognised expertise and reduced comparison",
      language:
        "Your next milestone is not more leads for the sake of it. It is becoming the clear expert choice.",
    },
    Established: {
      milestone: "Leadership position and influence",
      language:
        "Your next milestone is moving from respected provider to recognised leader.",
    },
    Magnetic: {
      milestone: "Category-shaping authority",
      language:
        "Your next milestone is protecting authority while extending influence in a deliberate way.",
    },
  };

  const current = map[input.tier];

  return {
    title: "What progression looks like next",
    short_summary: current.milestone,
    paragraphs: [current.language],
    transition: null,
  };
}

function matchedRowsFor(
  libraries: Record<string, SourceLibrarySection>,
  keys: string[]
) {
  return keys.flatMap((key) => libraries[key]?.matched_rows || []);
}

function buildComposedSections(
  libraries: Record<string, SourceLibrarySection>,
  input: ProfileExtendedReportInput
): AssembledReportSection[] {
  const resultScripts = libraries.result_interpretation_scripts;
  const levelRoadmap = libraries.level_progression_roadmap;
  const signalFramework = libraries.visibility_signal_framework;
  const auditLayer = libraries.visibility_audit_layer;

  const coreReading = pickFirstBlock(resultScripts, ["core reading"]);
  const bestFitFocus = pickFirstBlock(resultScripts, [
    "best-fit strategic focus",
    "best fit strategic focus",
  ]);
  const marketPattern = pickFirstBlock(resultScripts, [
    "what is usually happening in the market",
  ]);
  const stuckPattern = pickFirstBlock(resultScripts, [
    "why businesses tend to get stuck here",
  ]);
  const helpsNow = pickFirstBlock(resultScripts, [
    "what usually helps most at this stage",
  ]);
  const notYet = pickFirstBlock(resultScripts, [
    "what usually does not help yet",
  ]);
  const readinessCue = pickFirstBlock(resultScripts, [
    "signs the business is ready to progress",
  ]);

  const meaningInPractice = pickFirstBlock(levelRoadmap, ["meaning in practice"]);
  const currentStage = pickFirstBlock(levelRoadmap, ["current stage"]);
  const consultantRead = pickFirstBlock(levelRoadmap, ["consultant read"]);
  const nextMilestone = pickFirstBlock(levelRoadmap, ["next milestone"]);
  const languageToUse = pickFirstBlock(levelRoadmap, ["language to use"]);

  const howToUseLayer = pickFirstBlock(auditLayer, ["how to use this layer"]);
  const guidance = pickFirstBlock(auditLayer, ["guidance"]);
  const naturalStrengths = pickFirstBlock(auditLayer, ["natural strengths"]);
  const mainRisk = pickFirstBlock(auditLayer, ["main risk"]);
  const worksBest = pickFirstBlock(auditLayer, ["what usually works best"]);
  const watchOutFor = pickFirstBlock(auditLayer, ["watch out for"]);
  const lowerDiscoverability = pickFirstBlock(auditLayer, [
    "lower discoverability",
  ]);
  const lowerTrust = pickFirstBlock(auditLayer, ["lower trust", "lower trust / credibility"]);
  const lowerAuthority = pickFirstBlock(auditLayer, [
    "lower conversion",
    "lower conversion / authority",
  ]);
  const interpretationRule = pickFirstBlock(auditLayer, ["interpretation rule"]);

  const signalBlocks = buildSignalProfiles(signalFramework);
  const pillarPattern = buildPillarPatternBlock(input);
  const progressionLanguage = buildProgressionLanguageBlock(input);

  const sections: AssembledReportSection[] = [
    {
      key: "result_at_a_glance",
      title: FINAL_SECTION_TITLES.result_at_a_glance,
      blocks: dedupeBlocks(
        [
          buildAtGlanceBlock(input, coreReading),
          coreReading,
          currentStage,
          bestFitFocus,
        ].filter(Boolean) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, [
        "result_interpretation_scripts",
        "level_progression_roadmap",
      ]),
    },
    {
      key: "what_this_tier_means",
      title: FINAL_SECTION_TITLES.what_this_tier_means,
      blocks: dedupeBlocks(
        [coreReading, marketPattern, stuckPattern].filter(
          Boolean
        ) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, ["result_interpretation_scripts"]),
    },
    {
      key: "your_level_nuance",
      title: FINAL_SECTION_TITLES.your_level_nuance,
      blocks: dedupeBlocks(
        [meaningInPractice, consultantRead, currentStage, nextMilestone].filter(
          Boolean
        ) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, ["level_progression_roadmap"]),
    },
    {
      key: "pillars_and_signals",
      title: FINAL_SECTION_TITLES.pillars_and_signals,
      blocks: dedupeBlocks(
        [
          pillarPattern,
          interpretationRule,
          lowerDiscoverability,
          lowerTrust,
          lowerAuthority,
          ...signalBlocks,
        ].filter(Boolean) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, [
        "visibility_signal_framework",
        "visibility_audit_layer",
      ]),
    },
    {
      key: "your_behaviour_style",
      title: FINAL_SECTION_TITLES.your_behaviour_style,
      blocks: dedupeBlocks(
        [
          howToUseLayer,
          guidance,
          naturalStrengths,
          mainRisk,
          worksBest,
          watchOutFor,
        ].filter(Boolean) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, ["visibility_audit_layer"]),
    },
    {
      key: "strategic_priority_now",
      title: FINAL_SECTION_TITLES.strategic_priority_now,
      blocks: dedupeBlocks(
        [bestFitFocus, helpsNow, notYet].filter(
          Boolean
        ) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, ["result_interpretation_scripts"]),
    },
    {
      key: "progression_roadmap",
      title: FINAL_SECTION_TITLES.progression_roadmap,
      blocks: dedupeBlocks(
        [readinessCue, nextMilestone, languageToUse, progressionLanguage].filter(
          Boolean
        ) as NormalizedReportBlock[]
      ),
      matched_rows: matchedRowsFor(libraries, [
        "result_interpretation_scripts",
        "level_progression_roadmap",
      ]),
    },
  ];

  return sections.filter((section) => section.blocks.length > 0);
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
  const libraries = buildSourceLibraries(rows, input);
  const sections = buildComposedSections(libraries, input);

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