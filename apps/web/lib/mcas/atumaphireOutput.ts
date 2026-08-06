//apps/web/lib/mcas/atumaphireOutput.ts
import "server-only";

type JsonRecord = Record<string, any>;

export type AtumaphireOutputMode = "three_section" | "compact";

export type AtumaphireThreeSectionOutput = {
  trait_snapshot: string;
  how_they_work: string;
  what_to_verify: string;
};

export type AtumaphireCompactOutput = {
  profile_summary: string;
  verification_points: string;
};

export type AtumaphireNarrativeOutput =
  | AtumaphireThreeSectionOutput
  | AtumaphireCompactOutput;

type NarrativePerspective = "candidate" | "role";

type BuildSectionsInput = {
  scoring: any;
  operatingStyleSummary?: any;
  roleFitSummary?: any;
  careerVerticalSummary?: any;
  idealCandidateProfile?: any;
};

type ContentItem = {
  title: string | null;
  description: string | null;
};

type StyleBlueprint = {
  contribution: string;
  decision: string;
  team: string;
  influence: string;
};

type BlendAnalysis = {
  ranking: any[];
  top: any | null;
  exactTop: any[];
  nearTop: any[];
  supporting: any | null;
  mode: "single" | "near" | "tie";
};

const EXACT_TIE_EPSILON = 0.05;
const OPERATING_NEAR_TIE_POINTS = 6.8;
const CORE_NEAR_TIE_POINTS = 6.8;
const VERTICAL_NEAR_TIE_POINTS = 11.2;

const STYLE_BLUEPRINTS: Record<string, StyleBlueprint> = {
  OS1: {
    contribution:
      "spots future possibilities, frames direction and moves work toward opportunities that are not yet fully formed",
    decision:
      "They are likely to make forward-looking decisions quickly, using strategic possibility and expected value as key reference points.",
    team:
      "In teams, they tend to create direction, challenge current assumptions and encourage people to move toward a larger opportunity.",
    influence:
      "adds stronger future focus, opportunity sensing and strategic direction",
  },
  OS2: {
    contribution:
      "builds momentum by communicating with energy, engaging people and turning ideas into visible action",
    decision:
      "They are likely to decide quickly and favour movement, participation and practical traction over prolonged analysis.",
    team:
      "In teams, they tend to act as an activator who builds engagement, creates urgency and keeps attention on progress.",
    influence:
      "adds energy, influence and the ability to mobilise people around action",
  },
  OS3: {
    contribution:
      "strengthens commitment, morale and human sustainability so people can continue contributing under pressure",
    decision:
      "They are likely to consider the effect of decisions on people, trust and team commitment before moving forward.",
    team:
      "In teams, they tend to encourage participation, protect morale and help people stay connected to the work.",
    influence:
      "adds empathy, encouragement and stronger awareness of team commitment",
  },
  OS4: {
    contribution:
      "connects people, information and dependencies so complex work can move without fragmentation",
    decision:
      "They are likely to make decisions by considering stakeholder needs, interdependencies and the effect on wider alignment.",
    team:
      "In teams, they tend to bridge functions, translate information and create shared understanding across different groups.",
    influence:
      "adds cross-functional awareness, stakeholder alignment and relationship bridging",
  },
  OS5: {
    contribution:
      "protects delivery, resolves practical obstacles and creates confidence that important work will be completed",
    decision:
      "They are likely to favour practical decisions that protect delivery, continuity and dependable completion.",
    team:
      "In teams, they tend to steady execution, resolve immediate problems and keep commitments moving toward closure.",
    influence:
      "adds practical follow-through, delivery stability and calm under pressure",
  },
  OS6: {
    contribution:
      "turns complexity into structure, sequencing, ownership and repeatable operating rhythm",
    decision:
      "They are likely to make decisions by clarifying process, ownership, dependencies and the order in which work should happen.",
    team:
      "In teams, they tend to organise work, make responsibilities visible and create repeatable ways of operating.",
    influence:
      "adds structure, sequencing and stronger operational discipline",
  },
  OS7: {
    contribution:
      "tests evidence, protects quality, identifies risk and improves the reliability of important judgement",
    decision:
      "They are likely to make measured decisions based on evidence, standards, risk and the quality of available information.",
    team:
      "In teams, they tend to challenge assumptions, protect standards and make risks or weaknesses visible before action is taken.",
    influence:
      "adds evidence, risk awareness and stronger quality protection",
  },
  OS8: {
    contribution:
      "refines established systems, removes friction and improves quality or efficiency in controlled ways",
    decision:
      "They are likely to make improvement-focused decisions by identifying where effort, quality or workflow can be refined.",
    team:
      "In teams, they tend to spot recurring friction, strengthen standards and improve how work is delivered over time.",
    influence:
      "adds refinement, efficiency and a stronger continuous-improvement lens",
  },
};

const STYLE_BLEND_CONTRIBUTION: Record<string, string> = {
  OS1: "spotting future possibilities and framing direction",
  OS2: "building momentum through communication and engagement",
  OS3: "strengthening commitment, morale and human sustainability",
  OS4: "connecting people, information and dependencies",
  OS5: "protecting delivery and resolving practical obstacles",
  OS6: "turning complexity into structure, ownership and operating rhythm",
  OS7: "testing evidence, identifying risk and protecting quality",
  OS8: "refining systems, removing friction and improving efficiency",
};

const STYLE_BLEND_VALUE: Record<string, string> = {
  OS1: "future focus, opportunity sensing and strategic direction",
  OS2: "energy, communication and visible momentum",
  OS3: "empathy, commitment and human sustainability",
  OS4: "cross-functional alignment and relationship bridging",
  OS5: "delivery stability and practical problem-solving",
  OS6: "structure, sequencing and operational discipline",
  OS7: "evidence, risk judgement and quality protection",
  OS8: "refinement, efficiency and continuous improvement",
};

const VERTICAL_SCOPE: Record<string, string> = {
  CV1_2:
    "foundational-to-developing scope, where reliable individual ownership and growing independence matter most",
  CV3:
    "established scope, with accountability for broader outcomes and coordination beyond individual tasks",
  CV4:
    "senior cross-functional scope, requiring judgement across teams, priorities and trade-offs",
  CV5_6:
    "strategic-to-enterprise scope, where decisions influence multiple functions, long-term direction and outcomes delivered through others",
  V1: "foundational scope, centred on reliable individual contribution",
  V2: "developing scope, centred on growing ownership and consistency",
  V3: "established scope, with accountability beyond individual tasks",
  V4: "senior cross-functional scope, involving wider judgement and trade-offs",
  V5: "strategic scope, involving enterprise priorities and outcomes delivered through others",
  V6: "enterprise scope, involving long-horizon direction, renewal and organisational stewardship",
};

const STYLE_ENVIRONMENT_CONTEXT: Record<string, string> = {
  OS1: "where possibility, direction and strategic opportunity matter",
  OS2: "where communication, visibility and momentum matter",
  OS3: "where trust, commitment and human sustainability matter",
  OS4: "where cross-functional alignment and shared understanding matter",
  OS5: "where dependable delivery, continuity and practical problem-solving matter",
  OS6: "where structure, sequencing and operational discipline matter",
  OS7: "where evidence, risk awareness and quality protection matter",
  OS8: "where refinement, efficiency and continuous improvement matter",
};

const STYLE_VERIFICATION: Record<string, string> = {
  OS1: "translate vision into clear priorities, ownership and sustained delivery; narrow multiple possibilities into defensible choices; and test assumptions before committing the organisation to a direction",
  OS2: "sustain performance in repetitive, detail-heavy or low-visibility work; maintain effectiveness when autonomy or communication is limited; and balance momentum with structure and follow-through",
  OS3: "hold firm performance expectations, set healthy boundaries and handle difficult conversations without over-absorbing the emotional pressure of the team",
  OS4: "take a clear directional position when alignment is incomplete, establish decision rights and prevent coordination from becoming a substitute for action",
  OS5: "make workload and capacity visible, challenge weak direction when needed and maintain strategic perspective while protecting dependable delivery",
  OS6: "adapt structure when circumstances change, keep process connected to purpose and use judgement rather than adding control automatically",
  OS7: "make timely decisions with incomplete information, balance risk with opportunity and communicate safeguards without suppressing useful experimentation",
  OS8: "distinguish essential improvement from perfection, protect release momentum and assess whether local refinements improve the wider system",
};

const CORE_CAPABILITY: Record<string, string> = {
  C: "generate viable options, initiate direction and adapt beyond established methods",
  O: "plan and sequence work, clarify ownership and manage dependencies",
  R: "remove obstacles, sustain effort and carry work through to completion",
  E: "test assumptions, evaluate evidence, manage risk and protect quality",
};

const CORE_NOUN_PHRASE: Record<string, string> = {
  C: "idea generation, initiative and adaptation",
  O: "planning, sequencing, ownership and dependency management",
  R: "persistence, obstacle removal and dependable completion",
  E: "evidence testing, risk judgement and quality protection",
};

const READINESS_EVIDENCE: Record<string, string> = {
  CV1_2:
    "reliable ownership, growing independence and consistent performance when responsibility widens",
  CV3:
    "sustained accountability for broader outcomes and effective coordination beyond individual tasks",
  CV4:
    "cross-functional judgement, explicit trade-offs and influence across teams or functions",
  CV5_6:
    "strategic accountability, enterprise-level decisions and measurable outcomes delivered through others",
  V1: "reliable individual ownership and consistent delivery",
  V2: "growing independence and wider responsibility",
  V3: "accountability for broader outcomes beyond individual tasks",
  V4: "cross-functional judgement and trade-offs",
  V5: "strategic accountability and outcomes delivered through others",
  V6: "enterprise stewardship, long-horizon judgement and organisational renewal",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  return cleaned || null;
}

function ensureSentence(value: string): string {
  const cleaned = cleanText(value) || "";
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function stripTerminalPunctuation(value: string): string {
  return value.replace(/[.;,:!?]+$/g, "").trim();
}

function stripLeadingArticle(value: string): string {
  return value.replace(/^the\s+/i, "").trim();
}

function lowercaseFirst(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function firstSentences(value: string | null, count = 1): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence))
    .filter((sentence): sentence is string => Boolean(sentence));

  if (!sentences.length) return cleaned;
  return sentences.slice(0, count).join(" ");
}

function isHeadingLike(value: string): boolean {
  const text = stripTerminalPunctuation(value);

  if (/^career vertical expression\b/i.test(text)) return true;
  if (/^(operating style|role fit|capacity to perform)\b/i.test(text)) {
    return text.length < 100;
  }

  return false;
}

function proseFromValue(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null;

  if (typeof value === "string") {
    const text = cleanText(value);
    if (!text || isHeadingLike(text)) return null;
    return text;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => proseFromValue(item, depth + 1))
      .filter((item): item is string => Boolean(item));

    return parts.length ? parts.join(" ") : null;
  }

  if (!isRecord(value)) return null;

  const proseKeys = [
    "summary",
    "description",
    "interpretation",
    "narrative",
    "overview",
    "text",
    "content",
    "detail",
    "value",
  ];

  for (const key of proseKeys) {
    const candidate = proseFromValue(value[key], depth + 1);
    if (candidate) return candidate;
  }

  return null;
}

function dedupeTexts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = cleanText(value);
    if (!text) continue;

    const key = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function joinSentences(values: Array<string | null | undefined>): string {
  return dedupeTexts(values).map(ensureSentence).filter(Boolean).join(" ");
}

function naturalList(values: string[]): string | null {
  const cleaned = dedupeTexts(values)
    .map(stripTerminalPunctuation)
    .filter(Boolean);

  if (!cleaned.length) return null;
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function contentItems(value: unknown, limit = 4): ContentItem[] {
  if (value == null) return [];

  const source = Array.isArray(value) ? value : [value];
  const result: ContentItem[] = [];

  for (const item of source) {
    if (result.length >= limit) break;

    if (typeof item === "string") {
      const description = cleanText(item);
      if (description) result.push({ title: null, description });
      continue;
    }

    if (!isRecord(item)) continue;

    const title = cleanText(item.title ?? item.label ?? item.name);
    const description = cleanText(
      item.description ??
        item.summary ??
        item.interpretation ??
        item.text ??
        item.content,
    );

    if (title || description) result.push({ title, description });
  }

  const seen = new Set<string>();
  return result.filter((item) => {
    const key = `${item.title || ""}|${item.description || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9|]+/g, " ")
      .trim();

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPercentageValue(value: any): number {
  const raw = value?.pct ?? value?.percentage ?? value?.value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

function formatPercentage(value: any): string | null {
  const raw = value?.pct ?? value?.percentage ?? value?.value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  const normalised = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
  const rounded = Math.round(normalised * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function getLabel(value: any, fallback: string): string {
  return cleanText(value?.label ?? value?.name ?? value?.code) || fallback;
}

function getCode(value: any): string | null {
  return cleanText(value?.code) || null;
}

function styleName(value: any, fallback = "defined operating style"): string {
  return stripLeadingArticle(getLabel(value, fallback));
}

function styleBlueprint(value: any): StyleBlueprint | null {
  const code = getCode(value);
  return code ? STYLE_BLUEPRINTS[code] || null : null;
}

function verticalScope(value: any): string | null {
  const code = getCode(value);
  return code ? VERTICAL_SCOPE[code] || null : null;
}

function getOperatingRanking(scoring: any): any[] {
  if (Array.isArray(scoring?.operating_style_ranking)) {
    return scoring.operating_style_ranking;
  }
  return [];
}

function getCoreRanking(scoring: any): any[] {
  if (Array.isArray(scoring?.behavioural_approach_ranking)) {
    return scoring.behavioural_approach_ranking;
  }
  if (Array.isArray(scoring?.core_ranking)) return scoring.core_ranking;
  return [];
}

function getCareerRanking(scoring: any): any[] {
  if (Array.isArray(scoring?.career_vertical_ranking)) {
    return scoring.career_vertical_ranking;
  }
  return [];
}

function sortRanking(values: any[]): any[] {
  return [...values].sort((a, b) => {
    const difference = getPercentageValue(b) - getPercentageValue(a);
    if (Math.abs(difference) > EXACT_TIE_EPSILON) return difference;
    return Number(a?.rank ?? 999) - Number(b?.rank ?? 999);
  });
}

function analyseBlend(values: any[], nearTiePoints: number): BlendAnalysis {
  const ranking = sortRanking(values).filter((item) => getPercentageValue(item) > 0);
  const top = ranking[0] || null;

  if (!top) {
    return {
      ranking,
      top: null,
      exactTop: [],
      nearTop: [],
      supporting: null,
      mode: "single",
    };
  }

  const topPct = getPercentageValue(top);
  const exactTop = ranking.filter(
    (item) => Math.abs(getPercentageValue(item) - topPct) <= EXACT_TIE_EPSILON,
  );

  if (exactTop.length > 1) {
    return {
      ranking,
      top,
      exactTop: exactTop.slice(0, 4),
      nearTop: exactTop.slice(0, 4),
      supporting: ranking.find((item) => !exactTop.includes(item)) || null,
      mode: "tie",
    };
  }

  const nearTop = ranking.filter(
    (item) => topPct - getPercentageValue(item) <= nearTiePoints,
  );

  if (nearTop.length > 1) {
    return {
      ranking,
      top,
      exactTop,
      nearTop: nearTop.slice(0, 3),
      supporting: ranking.find((item) => !nearTop.includes(item)) || null,
      mode: "near",
    };
  }

  return {
    ranking,
    top,
    exactTop,
    nearTop: [top],
    supporting: ranking[1] || null,
    mode: "single",
  };
}

function getPrimaryOperatingStyle(scoring: any) {
  return (
    scoring?.primary_operating_style ||
    getOperatingRanking(scoring)[0] ||
    null
  );
}

function getSecondaryOperatingStyle(scoring: any) {
  return (
    scoring?.secondary_operating_style ||
    getOperatingRanking(scoring)[1] ||
    null
  );
}

function getTertiaryOperatingStyle(scoring: any) {
  return (
    scoring?.tertiary_operating_style ||
    getOperatingRanking(scoring)[2] ||
    null
  );
}

function getPrimaryCore(scoring: any) {
  return scoring?.primary_core || getCoreRanking(scoring)[0] || null;
}

function getLowestCores(scoring: any): any[] {
  const ranking = sortRanking(getCoreRanking(scoring));
  if (!ranking.length) return [];

  const minimum = Math.min(...ranking.map(getPercentageValue));
  return ranking.filter(
    (item) => Math.abs(getPercentageValue(item) - minimum) <= EXACT_TIE_EPSILON,
  );
}

function getCareerVertical(scoring: any) {
  return (
    scoring?.career_vertical ||
    scoring?.primary_career_vertical ||
    getCareerRanking(scoring)[0] ||
    null
  );
}

function getOperatingSummary(value: any): string | null {
  return (
    proseFromValue(value?.summary) ||
    proseFromValue(value?.operating_style?.summary) ||
    proseFromValue(value?.operatingStyle?.summary) ||
    null
  );
}

function getCapacity(value: any): string | null {
  return (
    proseFromValue(value?.capacity_to_perform) ||
    proseFromValue(value?.capacityToPerform) ||
    proseFromValue(value?.capacity) ||
    null
  );
}

function getNaturalStrengths(value: any): ContentItem[] {
  return contentItems(
    value?.natural_strengths ?? value?.naturalStrengths ?? value?.strengths,
    4,
  );
}

function getFrictionPoints(value: any): ContentItem[] {
  return contentItems(
    value?.friction_points ??
      value?.frictionPoints ??
      value?.blind_spots ??
      value?.blindSpots,
    4,
  );
}

function getRoleRisks(value: any): ContentItem[] {
  return contentItems(value?.role_risks ?? value?.roleRisks ?? value?.risks, 4);
}

function getDecisionStyle(value: any): string | null {
  return (
    proseFromValue(value?.decision_making_style) ||
    proseFromValue(value?.decisionMakingStyle) ||
    null
  );
}

function getTeamContribution(value: any): string | null {
  return (
    proseFromValue(value?.team_contribution_style) ||
    proseFromValue(value?.teamContributionStyle) ||
    null
  );
}

function getReadinessSignal(scoring: any): any {
  return scoring?.readiness_signal || null;
}

function normaliseSubjectSentence(value: string | null): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const patterns: Array<[RegExp, string]> = [
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+contributes\b/i, "They contribute"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+makes\b/i, "They make"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+creates\b/i, "They create"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+builds\b/i, "They build"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+drives\b/i, "They drive"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+supports\b/i, "They support"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+helps\b/i, "They help"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+operates\b/i, "They operate"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+works\b/i, "They work"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+is\b/i, "They are"],
    [/^(?:this|the)\s+(?:individual|applicant|candidate)\s+has\b/i, "They have"],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(cleaned)) return cleaned.replace(pattern, replacement);
  }

  return cleaned
    .replace(/^(?:this|the)\s+(?:individual|applicant|candidate)\s+/i, "They ")
    .replace(/^the person\s+/i, "They ");
}

function toGerundPhrase(value: string): string {
  let cleaned = stripTerminalPunctuation(value)
    .replace(/^they\s+/i, "")
    .replace(/^the candidate\s+/i, "")
    .replace(/^the applicant\s+/i, "")
    .trim();

  const match = cleaned.match(/^(\S+)(.*)$/);
  if (!match) return lowercaseFirst(cleaned);

  const verb = match[1];
  const rest = match[2] || "";
  const lower = verb.toLowerCase();

  if (/ing$/i.test(lower)) return lowercaseFirst(cleaned);

  const irregular: Record<string, string> = {
    activates: "activating",
    applies: "applying",
    balances: "balancing",
    builds: "building",
    challenges: "challenging",
    communicates: "communicating",
    connects: "connecting",
    creates: "creating",
    delivers: "delivering",
    drives: "driving",
    enables: "enabling",
    evaluates: "evaluating",
    identifies: "identifying",
    improves: "improving",
    initiates: "initiating",
    leads: "leading",
    maintains: "maintaining",
    manages: "managing",
    protects: "protecting",
    reduces: "reducing",
    refines: "refining",
    removes: "removing",
    resolves: "resolving",
    spots: "spotting",
    strengthens: "strengthening",
    sustains: "sustaining",
    tests: "testing",
    translates: "translating",
    turns: "turning",
  };

  const gerund = irregular[lower];
  return gerund ? `${gerund}${rest}` : lowercaseFirst(cleaned);
}

function candidateCapacitySentence(
  value: string | null,
  primaryCode: string | null,
): string | null {
  const cleaned = firstSentences(value, 1);
  const context = primaryCode ? STYLE_ENVIRONMENT_CONTEXT[primaryCode] || null : null;

  if (!cleaned) {
    return context
      ? `They are likely to perform most naturally in environments ${context}.`
      : null;
  }

  const normalised = normaliseSubjectSentence(cleaned) || cleaned;
  const highCapacityMatch = normalised.match(
    /^They have high capacity in\s+(.+?)[.!?]?$/i,
  );

  if (highCapacityMatch?.[1]) {
    return `They are likely to perform most naturally in ${stripTerminalPunctuation(
      highCapacityMatch[1],
    )}.`;
  }

  if (/^They are likely\b/i.test(normalised)) return normalised;
  if (/^They\b/i.test(normalised)) {
    return `The results suggest ${lowercaseFirst(normalised)}`;
  }

  return `The results suggest that ${lowercaseFirst(normalised)}`;
}

function roleCapacitySentence(
  value: string | null,
  primaryCode: string | null,
): string | null {
  const cleaned = firstSentences(value, 1);
  const context = primaryCode ? STYLE_ENVIRONMENT_CONTEXT[primaryCode] || null : null;

  if (!cleaned) {
    return context
      ? `The role is likely to favour candidates who perform naturally in environments ${context}.`
      : null;
  }

  const normalised = normaliseSubjectSentence(cleaned) || cleaned;
  const highCapacityMatch = normalised.match(
    /^They have high capacity in\s+(.+?)[.!?]?$/i,
  );

  if (highCapacityMatch?.[1]) {
    return `The role is likely to favour candidates who perform naturally in ${stripTerminalPunctuation(
      highCapacityMatch[1],
    )}.`;
  }

  const withoutSubject = normalised.replace(/^They\s+/i, "");
  return `The role-fit evidence indicates that strong candidates should ${lowercaseFirst(
    stripTerminalPunctuation(withoutSubject),
  )}.`;
}

const STYLE_ACTIONS: Record<string, string> = {
  OS1: "spot future possibilities, set direction and move work toward emerging opportunities",
  OS2: "build momentum through clear communication, engagement and visible action",
  OS3: "strengthen commitment, morale and sustainable team performance",
  OS4: "connect people, information and dependencies across teams",
  OS5: "protect delivery, resolve practical obstacles and keep commitments moving",
  OS6: "turn complexity into structure, clear ownership and repeatable ways of working",
  OS7: "test evidence, identify risk and protect quality",
  OS8: "refine systems, remove friction and improve quality or efficiency",
};

const RESPONSIBILITY_REQUIREMENTS: Record<string, string> = {
  CV1_2: "reliable individual ownership with growing independence",
  CV3: "broader outcomes and coordination beyond individual tasks",
  CV4: "senior cross-functional outcomes requiring judgement across teams, priorities and trade-offs",
  CV5_6: "strategic or enterprise-wide outcomes shaped through multiple functions, long-term decisions and delivery through others",
  V1: "reliable individual contribution",
  V2: "growing independence and wider responsibility",
  V3: "broader outcomes beyond individual tasks",
  V4: "cross-functional outcomes requiring wider judgement and trade-offs",
  V5: "strategic outcomes delivered through others",
  V6: "enterprise stewardship and long-horizon organisational responsibility",
};

function styleAction(value: any): string | null {
  const code = getCode(value);
  return code ? STYLE_ACTIONS[code] || null : null;
}

function styleValue(value: any): string | null {
  const code = getCode(value);
  return code ? STYLE_BLEND_VALUE[code] || null : null;
}

function narrativeStyles(scoring: any): any[] {
  const analysis = analyseBlend(
    getOperatingRanking(scoring),
    OPERATING_NEAR_TIE_POINTS,
  );

  const selected = analysis.mode === "single"
    ? [
        getPrimaryOperatingStyle(scoring) || analysis.top,
        getSecondaryOperatingStyle(scoring) || analysis.supporting,
        getTertiaryOperatingStyle(scoring),
      ]
    : [...analysis.nearTop, analysis.supporting];

  const seen = new Set<string>();
  return selected
    .filter(Boolean)
    .filter((item) => {
      const code = getCode(item) || JSON.stringify(item);
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .slice(0, 3);
}

function coreActions(items: any[]): string | null {
  return naturalList(
    items
      .map((item) => {
        const code = getCode(item);
        return code ? CORE_CAPABILITY[code] || null : null;
      })
      .filter((item): item is string => Boolean(item)),
  );
}

function coreNouns(items: any[]): string | null {
  return naturalList(
    items
      .map((item) => {
        const code = getCode(item);
        return code ? CORE_NOUN_PHRASE[code] || null : null;
      })
      .filter((item): item is string => Boolean(item)),
  );
}

function responsibilityScope(scoring: any): string | null {
  const analysis = analyseBlend(
    getCareerRanking(scoring),
    VERTICAL_NEAR_TIE_POINTS,
  );

  const selected = analysis.mode === "tie"
    ? analysis.exactTop
    : analysis.mode === "near"
      ? analysis.nearTop.slice(0, 2)
      : [analysis.top || getCareerVertical(scoring)];

  return naturalList(
    selected
      .filter(Boolean)
      .map((item) => {
        const code = getCode(item);
        return code ? RESPONSIBILITY_REQUIREMENTS[code] || null : null;
      })
      .filter((item): item is string => Boolean(item)),
  );
}

function toRoleExpectationSentence(value: string | null): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  return cleaned
    .replace(/^They are likely to\b/i, "They should")
    .replace(/^They tend to\b/i, "They should")
    .replace(/^In teams, they tend to\b/i, "In teams, they should be able to");
}

function operatingProfileSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string {
  const styles = narrativeStyles(scoring);
  const actions = styles
    .map(styleAction)
    .filter((item): item is string => Boolean(item));
  const values = styles
    .map(styleValue)
    .filter((item): item is string => Boolean(item));

  if (perspective === "role") {
    return actions.length
      ? `The ideal candidate is someone who can ${naturalList(actions)}.`
      : "The ideal candidate should be able to work effectively across people, priorities and delivery demands.";
  }

  return values.length
    ? `This applicant is likely to bring ${naturalList(values)} to the role.`
    : "This applicant is likely to bring a practical mix of workplace strengths to the role.";
}

function strongestCoreSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string | null {
  const analysis = analyseBlend(getCoreRanking(scoring), CORE_NEAR_TIE_POINTS);
  if (!analysis.top) return null;

  const selected = analysis.mode === "tie"
    ? analysis.exactTop
    : analysis.mode === "near"
      ? analysis.nearTop.slice(0, 2)
      : [analysis.top];
  const actions = coreActions(selected);
  if (!actions) return null;

  return perspective === "role"
    ? `The role particularly requires someone who can ${actions}.`
    : `Their results suggest a likely strength in the ability to ${actions}.`;
}

function careerVerticalSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string {
  const scope = responsibilityScope(scoring);

  if (!scope) {
    return perspective === "role"
      ? "The required level of responsibility should be confirmed through evidence from the role and hiring team."
      : "The level of responsibility indicated by the results should be confirmed through examples of work the applicant has genuinely owned.";
  }

  return perspective === "role"
    ? `This role requires responsibility for ${scope}.`
    : `Their results suggest they may be suited to work involving ${scope}.`;
}

function readinessTraitSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string | null {
  const signal = getReadinessSignal(scoring);
  if (!cleanText(signal?.label)) return null;

  return perspective === "role"
    ? "The role may require broader responsibility than a job title alone can prove, so the required scope should be confirmed through candidate evidence."
    : "They may also be ready for broader responsibility, but this should be confirmed through examples of what they have actually owned and delivered.";
}

function buildTraitSnapshot(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const primary = getPrimaryOperatingStyle(input.scoring);
  const primaryCode = getCode(primary);

  return joinSentences([
    operatingProfileSentence(perspective, input.scoring),
    strongestCoreSentence(perspective, input.scoring),
    careerVerticalSentence(perspective, input.scoring),
    readinessTraitSentence(perspective, input.scoring),
    perspective === "role"
      ? roleCapacitySentence(null, primaryCode)
      : candidateCapacitySentence(null, primaryCode),
  ]);
}

function buildHowTheyWork(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const styles = narrativeStyles(input.scoring);
  const primary = styles[0] || getPrimaryOperatingStyle(input.scoring);
  const primaryAction = styleAction(primary);
  const supportingActions = styles
    .slice(1)
    .map(styleAction)
    .filter((item): item is string => Boolean(item));
  const primaryBlueprint = styleBlueprint(primary);

  const opening = primaryAction
    ? perspective === "role"
      ? `The ideal candidate should ${primaryAction}.`
      : `This applicant is likely to create value by being able to ${primaryAction}.`
    : perspective === "role"
      ? "The ideal candidate should bring clarity to complex work and turn expectations into practical action."
      : "This applicant is likely to create value by bringing clarity to complex work and turning expectations into practical action.";

  const supporting = supportingActions.length
    ? supportingActions
        .map((action) =>
          perspective === "role"
            ? `They should also be able to ${action}.`
            : `They may also ${action}.`,
        )
        .join(" ")
    : null;

  const candidateDecision =
    primaryBlueprint?.decision ||
    firstSentences(getDecisionStyle(input.operatingStyleSummary), 1);
  const candidateTeam =
    primaryBlueprint?.team ||
    firstSentences(getTeamContribution(input.operatingStyleSummary), 1);

  const decision = perspective === "role"
    ? toRoleExpectationSentence(candidateDecision)
    : normaliseSubjectSentence(candidateDecision);
  const team = perspective === "role"
    ? toRoleExpectationSentence(candidateTeam)
    : normaliseSubjectSentence(candidateTeam);

  return joinSentences([
    opening,
    supporting,
    decision,
    team,
  ]);
}

function dominantCoreVerificationSentence(scoring: any): string | null {
  const analysis = analyseBlend(getCoreRanking(scoring), CORE_NEAR_TIE_POINTS);
  if (!analysis.top) return null;

  const selected = analysis.mode === "tie"
    ? analysis.exactTop
    : analysis.mode === "near"
      ? analysis.nearTop.slice(0, 2)
      : [analysis.top];
  const actions = coreActions(selected);

  return actions
    ? `Prioritise examples showing that the candidate can ${actions}.`
    : null;
}

function lowestCoreSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string | null {
  const ranking = getCoreRanking(scoring);
  const lowest = getLowestCores(scoring);
  if (!lowest.length || lowest.length === ranking.length) return null;

  const nouns = coreNouns(lowest);
  const capabilityItems = lowest
    .map((item) => {
      const code = getCode(item);
      return code ? CORE_CAPABILITY[code] || null : null;
    })
    .filter((item): item is string => Boolean(item));
  if (!capabilityItems.length && !nouns) return null;

  if (perspective === "role") {
    return joinSentences([
      `Although capability in ${nouns || "these areas"} is not the main focus of this role, it should not be treated as irrelevant.`,
      ...capabilityItems.map(
        (capability) =>
          `Confirm that candidates can still ${capability} when the work requires it.`,
      ),
    ]);
  }

  return joinSentences([
    `Do not assume that ${nouns || "these capabilities"} will come naturally to the applicant.`,
    ...capabilityItems.map(
      (capability) =>
        `Ask for examples showing how they can ${capability} when no established method or routine is available.`,
    ),
  ]);
}

function operatingRiskSentence(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const styles = narrativeStyles(input.scoring);
  const focuses = styles
    .map((style) => {
      const code = getCode(style);
      return code ? STYLE_VERIFICATION[code] || null : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);

  if (focuses.length === 1) {
    return perspective === "role"
      ? `Confirm that the candidate can ${focuses[0]}.`
      : `Confirm that the applicant can ${focuses[0]}.`;
  }

  if (focuses.length > 1) {
    return perspective === "role"
      ? `Confirm that the candidate can ${focuses[0]}. Also check that they can ${focuses[1]}.`
      : `Confirm that the applicant can ${focuses[0]}. Also check that they can ${focuses[1]}.`;
  }

  const fallback = [
    ...getFrictionPoints(input.operatingStyleSummary),
    ...getRoleRisks(input.roleFitSummary),
  ]
    .map((item) => item.description || item.title)
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);

  return fallback.length
    ? `Explore these points directly: ${naturalList(fallback) || "the documented risks"}.`
    : perspective === "role"
      ? "Confirm how the candidate handles pressure, ambiguity, competing priorities and accountability at the required level."
      : "Confirm how the applicant handles pressure, ambiguity, competing priorities and accountability at the indicated level.";
}

function verticalEvidenceSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string {
  const scope = responsibilityScope(scoring);

  return perspective === "role"
    ? `Ask for recent examples showing that the candidate has genuinely held responsibility for ${scope || "the required outcomes"}. Have them explain what they were personally responsible for, the decisions and trade-offs they made, the people or teams they influenced and the measurable results they achieved.`
    : `Ask for a recent example where the applicant was personally accountable for ${scope || "a significant outcome"}. Have them explain the decisions they made, the trade-offs they considered, the people or teams they influenced and the measurable result.`;
}

function readinessVerificationSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string | null {
  const signal = getReadinessSignal(scoring);
  if (!cleanText(signal?.label)) return null;

  const vertical = getCareerVertical(scoring);
  const code = getCode(vertical);
  const evidence = code ? READINESS_EVIDENCE[code] || null : null;

  return perspective === "role"
    ? `Do not assume that a previous job title proves the required level of responsibility. Confirm that the candidate has genuinely demonstrated ${evidence || "sustained accountability for broader outcomes"}.`
    : `The results suggest possible readiness for greater responsibility, but this is only something to investigate. Confirm it through evidence of ${evidence || "sound judgement, influence and responsibility for outcomes"}, not ambition or job title.`;
}

function buildWhatToVerify(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const parts: Array<string | null> = [
    operatingRiskSentence(perspective, input),
  ];

  if (perspective === "role") {
    parts.push(dominantCoreVerificationSentence(input.scoring));
  }

  parts.push(
    lowestCoreSentence(perspective, input.scoring),
    verticalEvidenceSentence(perspective, input.scoring),
    readinessVerificationSentence(perspective, input.scoring),
  );

  return joinSentences(parts);
}

function buildSections(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): AtumaphireThreeSectionOutput {
  return {
    trait_snapshot: buildTraitSnapshot(perspective, input),
    how_they_work: buildHowTheyWork(perspective, input),
    what_to_verify: buildWhatToVerify(perspective, input),
  };
}

function orderCoreRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const ordered: JsonRecord = {};
  const coreOrder = ["C", "O", "R", "E"] as const;

  for (const code of coreOrder) {
    if (Object.prototype.hasOwnProperty.call(value, code)) {
      ordered[code] = value[code];
    }
  }

  // Preserve any unexpected future keys after the standard CORE fields.
  for (const [key, entry] of Object.entries(value)) {
    if (!coreOrder.includes(key as (typeof coreOrder)[number])) {
      ordered[key] = entry;
    }
  }

  return ordered;
}

export function buildAtumaphireScoringPayload(input: {
  scoring: any;
  modelVersion?: string | null;
  careerVertical?: any;
  flags?: any;
}) {
  const scoring = input.scoring || {};

  return {
    model_version:
      input.modelVersion ||
      scoring.model_version ||
      scoring.scoring_model ||
      null,

    operating_style_counts: scoring.operating_style_counts,
    operating_style_distribution: scoring.operating_style_distribution,
    operating_style_ranking: scoring.operating_style_ranking,

    primary_operating_style: scoring.primary_operating_style,
    secondary_operating_style: scoring.secondary_operating_style,
    tertiary_operating_style: scoring.tertiary_operating_style,

    behavioural_approach_counts: orderCoreRecord(
      scoring.behavioural_approach_counts,
    ),
    behavioural_approach_distribution: orderCoreRecord(
      scoring.behavioural_approach_distribution,
    ),
    behavioural_approach_ranking: scoring.behavioural_approach_ranking,

    core_distribution: orderCoreRecord(scoring.core_distribution),

    career_vertical_counts: scoring.career_vertical_counts,
    career_vertical_distribution: scoring.career_vertical_distribution,
    career_vertical_ranking: scoring.career_vertical_ranking,

    primary_career_vertical: scoring.primary_career_vertical,
    secondary_career_vertical: scoring.secondary_career_vertical,
    career_vertical:
      input.careerVertical ||
      scoring.career_vertical ||
      scoring.primary_career_vertical ||
      null,

    readiness_signal: scoring.readiness_signal,
    flags: input.flags ?? scoring.flags ?? [],
    confidence: scoring.confidence,
  };
}

export function buildAtumaphireCandidateSections(
  input: BuildSectionsInput,
): AtumaphireThreeSectionOutput {
  return buildSections("candidate", input);
}

export function buildAtumaphireRoleSections(
  input: BuildSectionsInput,
): AtumaphireThreeSectionOutput {
  return buildSections("role", input);
}

export function normaliseAtumaphireOutputMode(
  value: unknown,
): AtumaphireOutputMode {
  const mode = cleanText(value)?.toLowerCase();
  return mode === "compact" || mode === "two_section"
    ? "compact"
    : "three_section";
}

export function formatAtumaphireNarrative(
  sections: AtumaphireThreeSectionOutput,
  mode: AtumaphireOutputMode = "three_section",
): AtumaphireNarrativeOutput {
  if (mode === "compact") {
    return {
      profile_summary: joinSentences([
        sections.trait_snapshot,
        sections.how_they_work,
      ]),
      verification_points: sections.what_to_verify,
    };
  }

  return sections;
}

export function buildAtumaphireExternalPayload(input: {
  sourcePayload: any;
  narrative: AtumaphireNarrativeOutput;
  scoring?: any;
  outputMode?: AtumaphireOutputMode;
}) {
  const source = isRecord(input.sourcePayload) ? input.sourcePayload : {};
  const sourceResult = isRecord(source.result) ? source.result : {};

  return {
    ...source,
    output_mode: input.outputMode || "three_section",
    result: {
      scoring: input.scoring ?? sourceResult.scoring ?? null,
      report: input.narrative,
    },
  };
}
