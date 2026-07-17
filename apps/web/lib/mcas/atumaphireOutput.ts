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
      "creates momentum by communicating with energy, engaging people and turning ideas into visible action",
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

function readinessNounPhrase(value: string): string {
  const cleaned = stripTerminalPunctuation(value);
  const readyMatch = cleaned.match(/^ready for\s+(.+)$/i);
  if (readyMatch?.[1]) return `readiness for ${readyMatch[1]}`;
  return lowercaseFirst(cleaned);
}

function normaliseSubjectSentence(value: string | null): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const subjectPatterns: Array<[RegExp, string]> = [
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

  for (const [pattern, replacement] of subjectPatterns) {
    if (pattern.test(cleaned)) return cleaned.replace(pattern, replacement);
  }

  return cleaned
    .replace(/^(?:this|the)\s+(?:individual|applicant|candidate)\s+/i, "They ")
    .replace(/^the person\s+/i, "They ");
}

function toGerundPhrase(value: string): string {
  const cleaned = stripTerminalPunctuation(value);
  const match = cleaned.match(/^(\S+)(.*)$/);
  if (!match) return lowercaseFirst(cleaned);

  const verb = match[1];
  const rest = match[2] || "";
  const lower = verb.toLowerCase();

  const irregular: Record<string, string> = {
    activates: "activating",
    communicates: "communicating",
    builds: "building",
    creates: "creating",
    strengthens: "strengthening",
    protects: "protecting",
    turns: "turning",
    tests: "testing",
    identifies: "identifying",
    improves: "improving",
    connects: "connecting",
    translates: "translating",
    aligns: "aligning",
    supports: "supporting",
    leads: "leading",
    maintains: "maintaining",
    spots: "spotting",
    removes: "removing",
    refines: "refining",
    drives: "driving",
    enables: "enabling",
  };

  const gerund = irregular[lower];
  return gerund ? `${gerund}${rest}` : lowercaseFirst(cleaned);
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

/**
 * Extracts prose only. It intentionally does not fall back to title/label/name,
 * because report block headings such as "Career Vertical Expression for OS2"
 * are not usable narrative sentences.
 */
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
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned.at(-1)}`;
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

function getPrimaryOperatingStyle(scoring: any) {
  return (
    scoring?.primary_operating_style ||
    scoring?.operating_style_ranking?.[0] ||
    null
  );
}

function getSecondaryOperatingStyle(scoring: any) {
  return (
    scoring?.secondary_operating_style ||
    scoring?.operating_style_ranking?.[1] ||
    null
  );
}

function getTertiaryOperatingStyle(scoring: any) {
  return (
    scoring?.tertiary_operating_style ||
    scoring?.operating_style_ranking?.[2] ||
    null
  );
}

function getCoreRanking(scoring: any): any[] {
  if (Array.isArray(scoring?.behavioural_approach_ranking)) {
    return scoring.behavioural_approach_ranking;
  }

  if (Array.isArray(scoring?.core_ranking)) return scoring.core_ranking;
  return [];
}

function getPrimaryCore(scoring: any) {
  return scoring?.primary_core || getCoreRanking(scoring)[0] || null;
}

function getLowestCores(scoring: any): any[] {
  const ranking = getCoreRanking(scoring);
  if (!ranking.length) return [];

  const sorted = [...ranking].sort(
    (a, b) => getPercentageValue(a) - getPercentageValue(b),
  );
  const minimum = getPercentageValue(sorted[0]);

  return sorted
    .filter((item) => Math.abs(getPercentageValue(item) - minimum) < 0.000001)
    .slice(0, 2);
}

function getCareerVertical(scoring: any) {
  return (
    scoring?.career_vertical ||
    scoring?.primary_career_vertical ||
    scoring?.career_vertical_ranking?.[0] ||
    null
  );
}

function getLabel(value: any, fallback: string): string {
  return cleanText(value?.label ?? value?.name ?? value?.code) || fallback;
}

function getCode(value: any): string | null {
  return cleanText(value?.code) || null;
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
  return contentItems(
    value?.role_risks ?? value?.roleRisks ?? value?.risks,
    4,
  );
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

function readinessSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string | null {
  const signal = getReadinessSignal(scoring);
  const label = cleanText(signal?.label);
  if (!label) return null;

  const phrase = readinessNounPhrase(label);
  return perspective === "role"
    ? `The ideal profile should also demonstrate ${phrase}.`
    : `The assessment also signals ${phrase}.`;
}

function strongestCoreSentence(
  perspective: NarrativePerspective,
  core: any,
): string | null {
  if (!core) return null;

  const label = getLabel(core, "the strongest CORE contribution");
  const pct = formatPercentage(core);

  return perspective === "role"
    ? `The required CORE emphasis is ${label}${pct ? ` (${pct})` : ""}, so the person should naturally use this contribution to create value.`
    : `The CORE result is strongly weighted toward ${label}${pct ? ` (${pct})` : ""}, indicating that this is the applicant's most natural route for creating value.`;
}

function buildTraitSnapshot(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const primary = getPrimaryOperatingStyle(input.scoring);
  const secondary = getSecondaryOperatingStyle(input.scoring);
  const tertiary = getTertiaryOperatingStyle(input.scoring);
  const core = getPrimaryCore(input.scoring);
  const vertical = getCareerVertical(input.scoring);

  const primaryName = styleName(primary);
  const secondaryName = secondary ? styleName(secondary) : null;
  const tertiaryName = tertiary ? styleName(tertiary) : null;
  const verticalLabel = getLabel(vertical, "the indicated career vertical");
  const verticalPct = formatPercentage(vertical);
  const scope = verticalScope(vertical);

  const profileSentence =
    perspective === "role"
      ? `The ideal profile is led by a ${primaryName} operating style${secondaryName ? `, with ${secondaryName} as a secondary influence` : ""}${tertiaryName ? ` and ${tertiaryName} as a tertiary pattern` : ""}.`
      : `This applicant is led by a ${primaryName} operating style${secondaryName ? `, with ${secondaryName} as a secondary influence` : ""}${tertiaryName ? ` and ${tertiaryName} as a tertiary pattern` : ""}.`;

  const verticalSentence =
    perspective === "role"
      ? `The role profile is concentrated at ${verticalLabel}${verticalPct ? ` (${verticalPct})` : ""}${scope ? `, indicating ${scope}` : ""}.`
      : `Career Vertical results are concentrated at ${verticalLabel}${verticalPct ? ` (${verticalPct})` : ""}${scope ? `, pointing to ${scope}` : ""}.`;

  const capacity = firstSentences(getCapacity(input.roleFitSummary), 1);
  const capacitySentence = capacity
    ? perspective === "role"
      ? `The ideal person should be able to perform in the conditions described by the role-fit evidence: ${lowercaseFirst(capacity)}`
      : capacity
    : null;

  return joinSentences([
    profileSentence,
    strongestCoreSentence(perspective, core),
    verticalSentence,
    readinessSentence(perspective, input.scoring),
    capacitySentence,
  ]);
}

function buildHowTheyWork(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const primary = getPrimaryOperatingStyle(input.scoring);
  const secondary = getSecondaryOperatingStyle(input.scoring);
  const tertiary = getTertiaryOperatingStyle(input.scoring);
  const primaryName = styleName(primary);
  const primaryBlueprint = styleBlueprint(primary);
  const secondaryBlueprint = styleBlueprint(secondary);
  const tertiaryBlueprint = styleBlueprint(tertiary);

  const opening = primaryBlueprint
    ? perspective === "role"
      ? `The ideal candidate should create value through a ${primaryName} pattern that ${primaryBlueprint.contribution}.`
      : `This applicant is likely to create value through a ${primaryName} pattern that ${primaryBlueprint.contribution}.`
    : firstSentences(getOperatingSummary(input.operatingStyleSummary), 1);

  let influenceSentence: string | null = null;
  if (secondary && secondaryBlueprint && tertiary && tertiaryBlueprint) {
    influenceSentence = `The ${styleName(secondary)} influence ${secondaryBlueprint.influence}, while the ${styleName(tertiary)} pattern ${tertiaryBlueprint.influence}.`;
  } else if (secondary && secondaryBlueprint) {
    influenceSentence = `The ${styleName(secondary)} influence ${secondaryBlueprint.influence}.`;
  } else if (tertiary && tertiaryBlueprint) {
    influenceSentence = `The ${styleName(tertiary)} pattern ${tertiaryBlueprint.influence}.`;
  }

  const strengths = getNaturalStrengths(input.operatingStyleSummary);
  const strengthTitles = strengths
    .map((item) => item.title || item.description)
    .filter((item): item is string => Boolean(item))
    .slice(0, 3)
    .map(toGerundPhrase);

  const strengthSentence = strengthTitles.length
    ? perspective === "role"
      ? `Evidence should show strengths in ${naturalList(strengthTitles)}.`
      : `Likely strengths include ${naturalList(strengthTitles)}.`
    : null;

  const decision = normaliseSubjectSentence(
    firstSentences(getDecisionStyle(input.operatingStyleSummary), 1) ||
      primaryBlueprint?.decision ||
      null,
  );

  const team = normaliseSubjectSentence(
    firstSentences(getTeamContribution(input.operatingStyleSummary), 1) ||
      primaryBlueprint?.team ||
      null,
  );

  return joinSentences([opening, influenceSentence, strengthSentence, decision, team]);
}

function riskText(items: ContentItem[], limit = 3): string[] {
  return items
    .map((item) => item.description || item.title)
    .filter((item): item is string => Boolean(item))
    .map((item) => stripTerminalPunctuation(item))
    .slice(0, limit);
}

function lowestCoreSentence(
  perspective: NarrativePerspective,
  scoring: any,
): string | null {
  const lowest = getLowestCores(scoring);
  if (!lowest.length) return null;

  const labels = lowest.map((item) => getLabel(item, "a lower CORE area"));
  const pct = formatPercentage(lowest[0]);
  const labelPhrase = naturalList(labels) || "the lowest CORE area";
  const subject = perspective === "role" ? "the candidate" : "the applicant";

  if (lowest.length > 1) {
    return `Because ${labelPhrase} are tied as the lowest CORE areas${pct ? ` (${pct} each)` : ""}, verify how ${subject} creates structure, tracks dependencies, tests assumptions and protects quality when these demands are central to the work.`;
  }

  return `Because ${labelPhrase} is the lowest CORE area${pct ? ` (${pct})` : ""}, verify what systems, habits or complementary support ${subject} uses to protect this part of the work cycle.`;
}

function verticalEvidenceSentence(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const vertical = getCareerVertical(input.scoring);
  const verticalLabel = getLabel(vertical, "the indicated scope");
  const scope = verticalScope(vertical);
  const subject = perspective === "role" ? "the candidate" : "the applicant";

  return `Ask for a recent example showing ${subject}'s personal responsibility, decisions, trade-offs and measurable outcomes at ${verticalLabel}${scope ? ` — ${scope}` : ""}.`;
}

function readinessVerificationSentence(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string | null {
  const signal = getReadinessSignal(input.scoring);
  const label = cleanText(signal?.label);
  if (!label) return null;

  const subject = perspective === "role" ? "the candidate" : "the applicant";
  return `Although the result signals ${readinessNounPhrase(label)}, verify this through ${subject}'s evidence of sustained accountability and outcomes delivered through others rather than relying on aspiration or role title alone.`;
}

function buildWhatToVerify(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const primary = getPrimaryOperatingStyle(input.scoring);
  const primaryCode = getCode(primary);
  const verificationFocus = primaryCode
    ? STYLE_VERIFICATION[primaryCode] || null
    : null;

  const fallbackRisks = riskText(
    [
      ...getFrictionPoints(input.operatingStyleSummary),
      ...getRoleRisks(input.roleFitSummary),
    ],
    2,
  );

  const riskSentence = verificationFocus
    ? perspective === "role"
      ? `Verify whether candidates can ${verificationFocus}.`
      : `Use the interview to verify whether the applicant can ${verificationFocus}.`
    : fallbackRisks.length
      ? perspective === "role"
        ? `Explore the documented friction and role risks directly: ${naturalList(fallbackRisks)}.`
        : `Use the interview to explore the documented friction and role risks directly: ${naturalList(fallbackRisks)}.`
      : perspective === "role"
        ? "Verify how the candidate handles pressure, ambiguity, competing priorities and accountability at the required scope."
        : "Use the interview to verify how the applicant handles pressure, ambiguity, competing priorities and accountability at the indicated scope.";

  return joinSentences([
    riskSentence,
    lowestCoreSentence(perspective, input.scoring),
    verticalEvidenceSentence(perspective, input),
    readinessVerificationSentence(perspective, input),
  ]);
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

    behavioural_approach_counts: scoring.behavioural_approach_counts,
    behavioural_approach_distribution:
      scoring.behavioural_approach_distribution,
    behavioural_approach_ranking: scoring.behavioural_approach_ranking,

    core_distribution: scoring.core_distribution,

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
