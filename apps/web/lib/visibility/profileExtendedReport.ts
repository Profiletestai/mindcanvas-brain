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

export type PresenterNote = {
  section_key: string;
  title: string;
  cue: string;
  emphasise: string[];
  avoid: string[];
  transition_line?: string | null;
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
  presenter_notes: PresenterNote[];
};

const FINAL_SECTION_TITLES: Record<string, string> = {
  result_at_a_glance: "Your result at a glance",
  what_this_tier_means: "What this tier means",
  your_level_nuance: "Your level nuance",
  pillars_and_signals: "Pillars and signals",
  your_behaviour_style: "Your behaviour style",
  strategic_priority_now: "Strategic priority now",
  progression_roadmap: "Progression roadmap",
};

type TierGuide = {
  diagnosis: string;
  strategic_focus: string;
  not_yet: string[];
  progression_cue: string;
};

type LevelGuide = {
  meaning: string;
  typical_position: string;
  immediate_focus: string;
};

type StyleGuide = {
  natural_strengths: string;
  main_risk: string;
  works_best: string;
  watch_out_for: string;
  tier_strategy: Record<VisibilityTier, string>;
};

type SignalGuide = {
  what_it_tells_market: string;
  strongest_impact: string;
  weak_signals: string;
  strong_signals: string;
};

const TIER_GUIDE: Record<VisibilityTier, TierGuide> = {
  Invisible: {
    diagnosis:
      "The market cannot reliably find or trust the business yet.",
    strategic_focus:
      "Build discoverability and credibility foundations.",
    not_yet: [
      "Large campaigns",
      "Authority branding",
      "Broad scale",
    ],
    progression_cue:
      "Customers can find the business consistently and trust signals are visible.",
  },
  Emerging: {
    diagnosis:
      "The business is visible, but customers still compare options and authority is not fully established.",
    strategic_focus:
      "Strengthen expertise, proof, and authority positioning.",
    not_yet: [
      "Mass visibility expansion",
      "Price competition",
    ],
    progression_cue:
      "Customers begin approaching with stronger confidence and clear expertise expectations.",
  },
  Established: {
    diagnosis:
      "The market recognises the business, but leadership positioning is not fully consolidated.",
    strategic_focus:
      "Sharpen category leadership and expand influence.",
    not_yet: [
      "Generic marketing",
      "Unrelated expansion",
    ],
    progression_cue:
      "The brand becomes associated with leadership and stronger pre-existing trust.",
  },
  Magnetic: {
    diagnosis:
      "Authority is strong and the market is already attracted. The challenge is sustaining and extending influence.",
    strategic_focus:
      "Protect authority while scaling category impact.",
    not_yet: [
      "Price-led growth",
      "Diluted positioning",
    ],
    progression_cue:
      "Reputation creates opportunities naturally and the brand shapes the category.",
  },
};

const LEVEL_GUIDE: Record<number, LevelGuide> = {
  1: {
    meaning: "Visibility absence",
    typical_position: "Customers cannot reliably find the business.",
    immediate_focus: "Create basic discoverability.",
  },
  2: {
    meaning: "Fragmented visibility",
    typical_position: "Some presence exists, but it is inconsistent.",
    immediate_focus: "Align platforms and presence.",
  },
  3: {
    meaning: "Emerging discoverability",
    typical_position: "Visible occasionally, but not yet dependable.",
    immediate_focus: "Strengthen credibility and trust signals.",
  },
  4: {
    meaning: "Recognisable presence",
    typical_position: "Considered a legitimate option.",
    immediate_focus: "Increase proof and credibility depth.",
  },
  5: {
    meaning: "Visibility foundation",
    typical_position: "Discoverability is stable enough for the next shift.",
    immediate_focus: "Prepare for authority development.",
  },
  6: {
    meaning: "Consistent discoverability",
    typical_position: "Credible competitor.",
    immediate_focus: "Strengthen authority signals.",
  },
  7: {
    meaning: "Professional competitor",
    typical_position: "One of several strong options.",
    immediate_focus: "Improve differentiation.",
  },
  8: {
    meaning: "Emerging specialist",
    typical_position: "Expertise is beginning to show.",
    immediate_focus: "Expand case studies and thought leadership.",
  },
  9: {
    meaning: "Trusted option",
    typical_position: "Approached with moderate trust.",
    immediate_focus: "Strengthen positioning.",
  },
  10: {
    meaning: "Authority threshold",
    typical_position: "Recognised expert, not yet dominant.",
    immediate_focus: "Consolidate expertise and visibility.",
  },
  11: {
    meaning: "Recognised provider",
    typical_position: "Credible and respected in market.",
    immediate_focus: "Define category positioning.",
  },
  12: {
    meaning: "Market competitor",
    typical_position: "Strong credibility among peers.",
    immediate_focus: "Sharpen differentiation.",
  },
  13: {
    meaning: "Trusted specialist",
    typical_position: "Higher confidence before contact.",
    immediate_focus: "Expand influence.",
  },
  14: {
    meaning: "Respected authority",
    typical_position: "Industry respect is visible.",
    immediate_focus: "Increase market voice.",
  },
  15: {
    meaning: "Leadership candidate",
    typical_position: "Approaching leadership status.",
    immediate_focus: "Strengthen leadership positioning.",
  },
  16: {
    meaning: "Established authority",
    typical_position: "Authority inside a niche or market.",
    immediate_focus: "Expand influence.",
  },
  17: {
    meaning: "Preferred provider",
    typical_position: "Customers seek the business directly.",
    immediate_focus: "Strengthen brand leadership.",
  },
  18: {
    meaning: "Category voice",
    typical_position: "The market begins to echo the brand’s ideas.",
    immediate_focus: "Scale influence.",
  },
  19: {
    meaning: "Industry authority",
    typical_position: "One of the leading voices.",
    immediate_focus: "Expand leadership reach.",
  },
  20: {
    meaning: "Magnetic leader",
    typical_position:
      "Dominant authority that attracts opportunity through reputation.",
    immediate_focus: "Protect and extend influence.",
  },
};

const STYLE_GUIDE: Record<BehaviourStyle, StyleGuide> = {
  A: {
    natural_strengths: "Momentum, visibility comfort, experimentation.",
    main_risk: "Scaling exposure before structure.",
    works_best:
      "Direct growth goals, fast action, proof-backed authority building.",
    watch_out_for:
      "Too many initiatives can dilute credibility or authority.",
    tier_strategy: {
      Invisible: "Slow the pace slightly and build proof before scale.",
      Emerging: "Focus on authority signals before pushing exposure.",
      Established: "Prioritise category leadership over new ventures.",
      Magnetic: "Expand only in ways that reinforce authority.",
    },
  },
  B: {
    natural_strengths: "Trust, relationships, referrals, community.",
    main_risk: "Visibility may stay trapped inside the network.",
    works_best:
      "Testimonials, case studies, personal brand visibility, partnership-led growth.",
    watch_out_for:
      "Do not rely only on word of mouth once scale is needed.",
    tier_strategy: {
      Invisible: "Turn private trust into visible trust signals.",
      Emerging: "Convert relationships into scalable authority assets.",
      Established: "Extend influence beyond the current network.",
      Magnetic: "Leverage community trust to shape the wider industry.",
    },
  },
  C: {
    natural_strengths: "Quality, systems, consistency, delivery strength.",
    main_risk: "Staying hidden too long or waiting for perfection.",
    works_best:
      "Frameworks, methodology-led content, structured visibility.",
    watch_out_for:
      "Deep expertise must be made visible, not only operational.",
    tier_strategy: {
      Invisible: "Make strong internal work more visible to the market.",
      Emerging: "Translate operational strength into visible frameworks.",
      Established: "Publish and share expertise more openly.",
      Magnetic: "Convert systems and methodologies into intellectual property.",
    },
  },
  D: {
    natural_strengths: "Precision, control, positioning, strategic authority.",
    main_risk: "Overly cautious expansion or excessive control.",
    works_best:
      "Clear authority building, strong positioning, controlled influence growth.",
    watch_out_for:
      "Influence can stall when control becomes too tight.",
    tier_strategy: {
      Invisible: "Frame visibility as controlled authority building.",
      Emerging: "Sharpen differentiation and strategic positioning.",
      Established: "Expand influence without losing authority discipline.",
      Magnetic: "Shape the category while maintaining strategic control.",
    },
  },
};

const SIGNAL_GUIDE: Record<string, SignalGuide> = {
  Discoverability: {
    what_it_tells_market:
      "Whether people can reliably find the business at all.",
    strongest_impact: "Levels 1–5",
    weak_signals:
      "Referral dependence, weak search presence, inconsistent listings.",
    strong_signals:
      "Easy to find, platform consistency, clear category alignment.",
  },
  Credibility: {
    what_it_tells_market:
      "Whether the business feels trustworthy and proven once found.",
    strongest_impact: "Levels 3–8",
    weak_signals:
      "Few reviews, weak proof, heavy reassurance questions.",
    strong_signals:
      "Stronger trust, shorter sales conversations, more confidence.",
  },
  Authority: {
    what_it_tells_market:
      "Whether the business is seen as a clear expert rather than just capable.",
    strongest_impact: "Levels 6–12",
    weak_signals:
      "Competent but not distinctive, continued comparison.",
    strong_signals:
      "Expert recognition, lower price sensitivity, reputation-led enquiries.",
  },
  Positioning: {
    what_it_tells_market:
      "Whether the market understands exactly why this business is the right choice.",
    strongest_impact: "Levels 10–15",
    weak_signals:
      "Unclear differentiation, similar-looking competitors.",
    strong_signals:
      "Clear niche or category association, stronger expectations before contact.",
  },
  Influence: {
    what_it_tells_market:
      "Whether the business shapes the category beyond client delivery.",
    strongest_impact: "Levels 15–20",
    weak_signals:
      "Respected but not widely recognised.",
    strong_signals:
      "Partnerships, thought leadership, media presence, category voice.",
  },
};

const PROGRESSION_LANGUAGE: Record<
  VisibilityTier,
  { next_milestone: string; language: string }
> = {
  Invisible: {
    next_milestone: "Reliable discoverability and visible trust",
    language:
      "Your next milestone is not bigger promotion. It is stronger visibility foundations that make the market take you seriously sooner.",
  },
  Emerging: {
    next_milestone: "Recognised expertise and reduced comparison",
    language:
      "Your next milestone is not more leads for the sake of it. It is becoming the clear expert choice.",
  },
  Established: {
    next_milestone: "Leadership position and influence",
    language:
      "Your next milestone is moving from respected provider to recognised leader.",
  },
  Magnetic: {
    next_milestone: "Category-shaping authority",
    language:
      "Your next milestone is protecting authority while extending influence in a deliberate way.",
  },
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

function blockSignature(block: NormalizedReportBlock) {
  return JSON.stringify({
    title: block.title || "",
    short_summary: block.short_summary || "",
    paragraphs: block.paragraphs || [],
    transition: block.transition || "",
  });
}

function dedupeBlocks(blocks: Array<NormalizedReportBlock | null | undefined>) {
  const out: NormalizedReportBlock[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    if (!block) continue;
    const sig = blockSignature(block);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(block);
  }

  return out;
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
    return { strongest: null as string | null, weakest: null as string | null };
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return {
    strongest: sorted[0]?.[0] || null,
    weakest: sorted[sorted.length - 1]?.[0] || null,
  };
}

function pillarLabel(raw: string) {
  const key = asString(raw).toLowerCase();
  if (key === "visibility") return "Visibility";
  if (key === "trust") return "Trust";
  if (key === "authority") return "Authority";
  if (key === "dominance") return "Dominance";
  if (key === "discoverability") return "Discoverability";
  if (key === "conversion") return "Conversion";
  return capitalizeLabel(raw);
}

function buildSignalInterpretationLines(
  pillarScores?: ProfileExtendedReportInput["pillar_scores"]
): string[] {
  if (!pillarScores) return [];

  const lines: string[] = [];
  const entries = Object.entries(pillarScores)
    .map(([key, value]) => [key, Number(value) || 0] as const)
    .filter(([_, value]) => Number.isFinite(value))
    .sort((a, b) => b[1] - a[1]);

  for (const [key, value] of entries) {
    const label = pillarLabel(key);

    if (key === "visibility" || key === "discoverability") {
      lines.push(
        `${label}: ${value}% — this is about how reliably the market can find and recognise the business.`
      );
    } else if (key === "trust") {
      lines.push(
        `${label}: ${value}% — this reflects whether the business feels credible and proven once found.`
      );
    } else if (key === "authority" || key === "conversion") {
      lines.push(
        `${label}: ${value}% — this reflects whether the business is seen as a clear expert rather than just capable.`
      );
    } else if (key === "dominance") {
      lines.push(
        `${label}: ${value}% — this suggests how strongly the business is beginning to lead attention and preference in the market.`
      );
    } else {
      lines.push(`${label}: ${value}%`);
    }
  }

  return lines;
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

function supplementalBlocksForSection(
  rows: KbBlockRow[],
  input: ProfileExtendedReportInput,
  sectionKey: string,
  limit = 2
): NormalizedReportBlock[] {
  const matched = rows
    .filter((row) => row.section_key === sectionKey)
    .filter((row) => rowMatchesInput(row, input))
    .sort((a, b) => b.priority - a.priority)
    .flatMap((row) => normalizeBlocks(row.content));

  return dedupeBlocks(matched).slice(0, limit);
}

function buildNarrativeSections(
  rows: KbBlockRow[],
  input: ProfileExtendedReportInput
): AssembledReportSection[] {
  const tierGuide = TIER_GUIDE[input.tier];
  const levelGuide = LEVEL_GUIDE[input.level];
  const styleGuide = STYLE_GUIDE[input.behaviour_style];
  const progressionGuide = PROGRESSION_LANGUAGE[input.tier];

  const { strongest, weakest } = strongestWeakestPillars(input.pillar_scores);
  const strongestLabel = strongest ? pillarLabel(strongest) : null;
  const weakestLabel = weakest ? pillarLabel(weakest) : null;

  const signalLines = Object.entries(SIGNAL_GUIDE).map(([name, guide]) => {
    return `${name}: ${guide.what_it_tells_market} Strongest impact at ${guide.strongest_impact}. Weak signals look like ${guide.weak_signals} Stronger signals look like ${guide.strong_signals}`;
  });

  const section1 = {
    key: "result_at_a_glance",
    title: FINAL_SECTION_TITLES.result_at_a_glance,
    blocks: dedupeBlocks([
      {
        title: "Plain-English summary",
        short_summary: `You are in the ${input.tier} tier at Level ${input.level}, with behaviour style ${input.behaviour_style} and readiness set to ${readinessLabel(
          input.readiness
        )}.`,
        paragraphs: [
          tierGuide.diagnosis,
          `At Level ${input.level}, this currently looks like ${levelGuide.meaning.toLowerCase()}: ${levelGuide.typical_position}`,
          `The immediate focus at this level is ${levelGuide.immediate_focus.toLowerCase()}`,
        ],
        transition:
          "This gives the report its structural truth: tier explains the stage, while level explains how stable or advanced that stage currently is.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const section2 = {
    key: "what_this_tier_means",
    title: FINAL_SECTION_TITLES.what_this_tier_means,
    blocks: dedupeBlocks([
      {
        title: "Core diagnosis",
        short_summary: tierGuide.diagnosis,
        paragraphs: [
          `At the ${input.tier} stage, the strategic task is to ${tierGuide.strategic_focus.toLowerCase()}`,
          `This is not a judgment of the business. It is a visibility maturity reading that explains what the market is likely seeing right now.`,
        ],
        transition:
          "The goal here is not to dramatise the result, but to explain the current pattern calmly and clearly.",
      },
      {
        title: "What is likely happening in the market",
        short_summary:
          input.tier === "Invisible"
            ? "The business may not yet have enough visible evidence to be prioritised."
            : input.tier === "Emerging"
              ? "The business is being noticed, but customers still compare options and need more reassurance before choosing."
              : input.tier === "Established"
                ? "Trust is stronger, but the market may not yet place the business in the leadership position it is aiming for."
                : "Trust is already present, so the challenge shifts to influence expansion and authority protection.",
        paragraphs: [
          `The strategic focus for this stage is ${tierGuide.strategic_focus.toLowerCase()}`,
          `What does not help yet: ${tierGuide.not_yet.join(", ").toLowerCase()}.`,
        ],
        transition:
          "This helps explain why effort alone does not move the business forward if the wrong visibility problem is being solved.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const section3 = {
    key: "your_level_nuance",
    title: FINAL_SECTION_TITLES.your_level_nuance,
    blocks: dedupeBlocks([
      {
        title: `Level ${input.level} meaning`,
        short_summary: levelGuide.meaning,
        paragraphs: [
          `Typical market position: ${levelGuide.typical_position}`,
          `Immediate focus: ${levelGuide.immediate_focus}`,
          `Inside the ${input.tier} tier, Level ${input.level} shows how stable and advanced this stage currently is. Higher levels in the tier usually mean the next shift is closer and the current stage is more consolidated.`,
        ],
        transition:
          "The level acts as the precision layer. It shows not just where the business is, but how developed that stage currently is.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const section4 = {
    key: "pillars_and_signals",
    title: FINAL_SECTION_TITLES.pillars_and_signals,
    blocks: dedupeBlocks([
      {
        title: "Your current signal pattern",
        short_summary:
          strongestLabel && weakestLabel
            ? `${strongestLabel} is currently the strongest visible signal, while ${weakestLabel} looks like the main limiting factor.`
            : "The current pillar pattern shows where visibility is already supported and where signal gaps are still holding progress back.",
        paragraphs: [
          ...buildSignalInterpretationLines(input.pillar_scores),
          "Pillar percentages should be used as interpretive clues rather than isolated verdicts. A lower pillar usually points to missing or weak signals that need strengthening before the next step will hold.",
        ],
        transition:
          "The same low pillar can mean different things at different levels, so the pillar pattern should always be read together with the tier and level.",
      },
      {
        title: "The wider signal pathway",
        short_summary:
          "Visibility Ladder progression is not driven by effort alone. It is driven by the strength and alignment of the signals the market can see.",
        paragraphs: [
          "Progression pattern: Discoverability → Credibility → Authority → Positioning → Influence",
          ...signalLines,
        ],
        transition:
          "Each stage builds on the one before it. Businesses that try to skip a stage usually create unstable growth.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const section5 = {
    key: "your_behaviour_style",
    title: FINAL_SECTION_TITLES.your_behaviour_style,
    blocks: dedupeBlocks([
      {
        title: `Type ${input.behaviour_style} interpretation`,
        short_summary:
          "Behaviour style explains how the client naturally approaches visibility and growth, which changes what strategies they are most likely to implement consistently.",
        paragraphs: [
          `Natural strengths: ${styleGuide.natural_strengths}`,
          `Main risk: ${styleGuide.main_risk}`,
          `What usually works best: ${styleGuide.works_best}`,
          `Watch out for: ${styleGuide.watch_out_for}`,
          `At the ${input.tier} stage, the most suitable behaviour-led focus is: ${styleGuide.tier_strategy[input.tier]}`,
        ],
        transition:
          "Two businesses can be in the same tier but still need very different implementation paths depending on how the founder naturally operates.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const section6 = {
    key: "strategic_priority_now",
    title: FINAL_SECTION_TITLES.strategic_priority_now,
    blocks: dedupeBlocks([
      {
        title: "What to focus on now",
        short_summary: tierGuide.strategic_focus,
        paragraphs: [
          `At this stage, what usually helps most is the work that strengthens the signals needed for the next shift.`,
          input.tier === "Invisible"
            ? "Typical priorities include discoverability, trust signals, professional presentation, and visible proof."
            : input.tier === "Emerging"
              ? "Typical priorities include authority positioning, case studies, proof systems, thought leadership content, and sharper specialisation messaging."
              : input.tier === "Established"
                ? "Typical priorities include category positioning, methodology development, thought leadership expansion, and influence-focused visibility."
                : "Typical priorities include thought leadership scaling, strategic partnerships, influence platform development, and category-shaping initiatives.",
          `What does not help yet: ${tierGuide.not_yet.join(", ").toLowerCase()}.`,
        ],
        transition:
          "The goal is not to do more everywhere. It is to strengthen the part of the system that is currently limiting progress.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const section7 = {
    key: "progression_roadmap",
    title: FINAL_SECTION_TITLES.progression_roadmap,
    blocks: dedupeBlocks([
      {
        title: "What progression looks like next",
        short_summary: progressionGuide.next_milestone,
        paragraphs: [
          progressionGuide.language,
          `The progression cue for this stage is: ${tierGuide.progression_cue}`,
          `The immediate level focus remains: ${levelGuide.immediate_focus}`,
        ],
        transition:
          "A useful report should explain movement, not just diagnosis.",
      },
      {
        title: "How to recognise readiness",
        short_summary:
          input.readiness === "ready_to_progress"
            ? "The current pattern suggests that some next-stage signals are beginning to consolidate."
            : "The current pattern suggests that the base still needs to stabilise before aggressive next-stage moves will hold.",
        paragraphs:
          input.tier === "Invisible"
            ? [
                "Customers can find the business reliably.",
                "Digital presence looks professional and consistent.",
                "Reviews, testimonials, and proof are visible.",
                "Discovery depends less on private referrals alone.",
              ]
            : input.tier === "Emerging"
              ? [
                  "Customers begin referencing expertise before contact.",
                  "Comparison behaviour drops.",
                  "The business is recognised for specific outcomes or a clear niche.",
                  "Trust starts accumulating through reputation, not only effort.",
                ]
              : input.tier === "Established"
                ? [
                    "Customers seek the business out more specifically.",
                    "Prospects arrive with strong pre-existing trust.",
                    "The brand becomes associated with leadership in the category.",
                    "Reputation spreads beyond existing audiences.",
                  ]
                : [
                    "The business is referenced as a leading authority.",
                    "Reputation routinely creates introductions and strategic opportunities.",
                    "Its ideas influence how the category is discussed.",
                    "Influence expands without weakening positioning.",
                  ],
        transition:
          "Readiness is there to guide how aggressive the next move should be. Stabilise means strengthen the base first. Ready to progress means the next-stage signals are beginning to consolidate.",
      },
    ]),
    matched_rows: [],
  } satisfies AssembledReportSection;

  const supplemental = {
    result_interpretation_scripts: supplementalBlocksForSection(
      rows,
      input,
      "result_interpretation_scripts",
      1
    ),
    level_progression_roadmap: supplementalBlocksForSection(
      rows,
      input,
      "level_progression_roadmap",
      1
    ),
    visibility_signal_framework: supplementalBlocksForSection(
      rows,
      input,
      "visibility_signal_framework",
      1
    ),
    visibility_audit_layer: supplementalBlocksForSection(
      rows,
      input,
      "visibility_audit_layer",
      1
    ),
  };

  section2.blocks = dedupeBlocks([
    ...section2.blocks,
    ...supplemental.result_interpretation_scripts,
  ]);
  section3.blocks = dedupeBlocks([
    ...section3.blocks,
    ...supplemental.level_progression_roadmap,
  ]);
  section4.blocks = dedupeBlocks([
    ...section4.blocks,
    ...supplemental.visibility_signal_framework,
  ]);
  section5.blocks = dedupeBlocks([
    ...section5.blocks,
    ...supplemental.visibility_audit_layer,
  ]);

  return [
    section1,
    section2,
    section3,
    section4,
    section5,
    section6,
    section7,
  ];
}

function buildPresenterNotes(
  input: ProfileExtendedReportInput
): PresenterNote[] {
  const tierGuide = TIER_GUIDE[input.tier];
  const levelGuide = LEVEL_GUIDE[input.level];
  const styleGuide = STYLE_GUIDE[input.behaviour_style];
  const progressionGuide = PROGRESSION_LANGUAGE[input.tier];
  const { strongest, weakest } = strongestWeakestPillars(input.pillar_scores);

  const strongestLabel = strongest ? pillarLabel(strongest) : null;
  const weakestLabel = weakest ? pillarLabel(weakest) : null;

  return [
    {
      section_key: "result_at_a_glance",
      title: "Presenter note",
      cue:
        "Frame the result as a stage of visibility maturity, not as a personal or business failure.",
      emphasise: [
        `Tier gives the stage; level ${input.level} gives how stable that stage currently is.`,
        `Readiness is a pacing signal: ${readinessLabel(input.readiness)}.`,
        `Keep the tone calm, specific, and practical.`,
      ],
      avoid: [
        "Do not dramatise the result.",
        "Do not imply the business lacks capability.",
      ],
      transition_line:
        "What this result really tells us is not whether the business is good or bad — it tells us what visibility problem needs solving next.",
    },
    {
      section_key: "what_this_tier_means",
      title: "Presenter note",
      cue:
        "Explain what the market is likely seeing right now, and why effort alone may not have been moving the business forward.",
      emphasise: [
        tierGuide.diagnosis,
        `Strategic task: ${tierGuide.strategic_focus}.`,
      ],
      avoid: [
        "Do not make the client feel behind or broken.",
        "Do not frame this as a motivation issue.",
      ],
      transition_line:
        "So this section helps us separate activity from the actual visibility problem underneath it.",
    },
    {
      section_key: "your_level_nuance",
      title: "Presenter note",
      cue:
        "Use the level as the precision layer inside the wider tier.",
      emphasise: [
        `Level ${input.level} means: ${levelGuide.meaning}.`,
        `Typical position: ${levelGuide.typical_position}`,
        `Immediate focus: ${levelGuide.immediate_focus}`,
      ],
      avoid: [
        "Do not treat all businesses in the same tier as if they need the same next step.",
      ],
      transition_line:
        "The tier tells us the stage. The level tells us how developed that stage currently is.",
    },
    {
      section_key: "pillars_and_signals",
      title: "Presenter note",
      cue:
        "Use pillar percentages as interpretive clues, not as isolated verdicts.",
      emphasise: [
        strongestLabel
          ? `${strongestLabel} is the strongest current signal.`
          : "Identify the strongest visible signal.",
        weakestLabel
          ? `${weakestLabel} is the main limiting signal right now.`
          : "Identify the weakest signal carefully.",
        "Read the pillar pattern together with the tier and level.",
      ],
      avoid: [
        "Do not create alarm around a low pillar score.",
        "Do not treat percentages as a judgment of business quality.",
      ],
      transition_line:
        "The pillar scores help us see where the signal system is already strong and where progress is still being held back.",
    },
    {
      section_key: "your_behaviour_style",
      title: "Presenter note",
      cue:
        "Use behaviour style to personalise the delivery path, not to label the founder.",
      emphasise: [
        `Natural strengths: ${styleGuide.natural_strengths}`,
        `Main risk: ${styleGuide.main_risk}`,
        `At the ${input.tier} stage, the most sustainable behaviour-led focus is: ${styleGuide.tier_strategy[input.tier]}`,
      ],
      avoid: [
        "Do not present behaviour style as fixed identity.",
        "Do not imply one style is better than another.",
      ],
      transition_line:
        "This is the part that explains why two businesses at the same stage may still need different implementation paths.",
    },
    {
      section_key: "strategic_priority_now",
      title: "Presenter note",
      cue:
        "Use the tier to choose the right strategic problem, then use style to shape how it should be implemented.",
      emphasise: [
        `Best-fit focus now: ${tierGuide.strategic_focus}`,
        `What does not help yet: ${tierGuide.not_yet.join(", ")}`,
      ],
      avoid: [
        "Do not give the client ten priorities at once.",
        "Do not recommend scaling tactics before the right signal problem is solved.",
      ],
      transition_line:
        "The goal now is not to do more everywhere. It is to strengthen the part of the system that will unlock the next stage.",
    },
    {
      section_key: "progression_roadmap",
      title: "Presenter note",
      cue:
        "Always connect the current stage to the next milestone. Explain movement, not just diagnosis.",
      emphasise: [
        `Next milestone: ${progressionGuide.next_milestone}`,
        progressionGuide.language,
        `Progression cue: ${tierGuide.progression_cue}`,
      ],
      avoid: [
        "Do not leave the client with only a diagnosis.",
        "Do not make progression sound like a generic growth target.",
      ],
      transition_line:
        "What we want to leave the client with is a clear sense of what stronger signals look like next.",
    },
  ];
}

export function assembleProfileExtendedReport(
  rows: KbBlockRow[],
  input: ProfileExtendedReportInput
): AssembledProfileExtendedReport {
  const sections = buildNarrativeSections(rows, input);
  const presenter_notes = buildPresenterNotes(input);

  return {
    audience: "profile_extended_report",
    input,
    sections,
    presenter_notes,
  };
}

export async function buildProfileExtendedReport(
  input: ProfileExtendedReportInput,
  sb?: VisibilityDbClient
): Promise<AssembledProfileExtendedReport> {
  const rows = await fetchKbRows(sb);
  return assembleProfileExtendedReport(rows, input);
}