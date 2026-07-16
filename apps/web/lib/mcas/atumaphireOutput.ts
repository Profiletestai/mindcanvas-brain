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
  AtumaphireThreeSectionOutput | AtumaphireCompactOutput;

type NarrativePerspective = "candidate" | "role";

type BuildSectionsInput = {
  scoring: any;
  operatingStyleSummary?: any;
  roleFitSummary?: any;
  careerVerticalSummary?: any;
  idealCandidateProfile?: any;
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

function ensureSentence(value: string): string {
  const cleaned = cleanText(value) || "";
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function stripTerminalPunctuation(value: string): string {
  return value.replace(/[.;,:!?]+$/g, "").trim();
}

function textFromValue(value: unknown, depth = 0): string | null {
  if (depth > 3 || value == null) return null;

  const direct = cleanText(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => textFromValue(item, depth + 1))
      .filter((item): item is string => Boolean(item));

    return parts.length ? parts.join("; ") : null;
  }

  if (!isRecord(value)) return null;

  const preferredKeys = [
    "summary",
    "description",
    "text",
    "content",
    "value",
    "label",
    "title",
    "name",
  ];

  for (const key of preferredKeys) {
    const candidate = textFromValue(value[key], depth + 1);
    if (candidate) return candidate;
  }

  return null;
}

function listFromValue(value: unknown, limit = 4): string[] {
  if (value == null) return [];

  const source = Array.isArray(value) ? value : [value];
  const result: string[] = [];

  for (const item of source) {
    if (result.length >= limit) break;

    if (typeof item === "string") {
      const text = cleanText(item);
      if (text) result.push(text);
      continue;
    }

    if (!isRecord(item)) continue;

    const title = cleanText(item.title ?? item.label ?? item.name);
    const description = cleanText(
      item.description ?? item.summary ?? item.text ?? item.content,
    );

    if (
      title &&
      description &&
      title.toLowerCase() !== description.toLowerCase()
    ) {
      result.push(`${title}: ${description}`);
      continue;
    }

    const text = description || title || textFromValue(item);
    if (text) result.push(text);
  }

  return dedupeTexts(result).slice(0, limit);
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

function compactJoin(values: string[]): string | null {
  const cleaned = dedupeTexts(values)
    .map(stripTerminalPunctuation)
    .filter(Boolean);

  if (!cleaned.length) return null;
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join("; ")}; and ${cleaned.at(-1)}`;
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

function getPrimaryCore(scoring: any) {
  return (
    scoring?.primary_core ||
    scoring?.behavioural_approach_ranking?.[0] ||
    scoring?.core_ranking?.[0] ||
    null
  );
}

function getWeakestCore(scoring: any) {
  const ranking = Array.isArray(scoring?.behavioural_approach_ranking)
    ? scoring.behavioural_approach_ranking
    : Array.isArray(scoring?.core_ranking)
      ? scoring.core_ranking
      : [];

  if (!ranking.length) return null;
  return [...ranking].sort(
    (a, b) =>
      Number(a?.pct ?? a?.percentage ?? 0) -
      Number(b?.pct ?? b?.percentage ?? 0),
  )[0];
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

function getPercentage(value: any): number | null {
  const raw = value?.pct ?? value?.percentage ?? value?.value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function percentagePhrase(value: any): string | null {
  const pct = getPercentage(value);
  return pct == null ? null : `${pct}%`;
}

function currentVerticalSummary(careerVerticalSummary: any, vertical: any) {
  return (
    textFromValue(careerVerticalSummary?.current_vertical?.summary) ||
    textFromValue(careerVerticalSummary?.currentVertical?.summary) ||
    textFromValue(careerVerticalSummary?.career_vertical_expression) ||
    textFromValue(careerVerticalSummary?.summary) ||
    (vertical?.code && isRecord(careerVerticalSummary?.levels)
      ? textFromValue(
          careerVerticalSummary.levels[vertical.code] ||
            careerVerticalSummary.levels[
              String(vertical.code).replace(/^CV/, "V")
            ],
        )
      : null)
  );
}

function getOperatingSummary(operatingStyleSummary: any): string | null {
  return (
    textFromValue(operatingStyleSummary?.summary) ||
    textFromValue(operatingStyleSummary?.operating_style?.summary) ||
    textFromValue(operatingStyleSummary?.operatingStyle?.summary) ||
    textFromValue(operatingStyleSummary)
  );
}

function getCapacity(roleFitSummary: any): string | null {
  return (
    textFromValue(roleFitSummary?.capacity_to_perform) ||
    textFromValue(roleFitSummary?.capacityToPerform) ||
    textFromValue(roleFitSummary?.capacity) ||
    null
  );
}

function getTopRoleAlignment(roleFitSummary: any): string | null {
  return (
    textFromValue(roleFitSummary?.top_role_alignment) ||
    textFromValue(roleFitSummary?.topRoleAlignment) ||
    textFromValue(roleFitSummary?.ideal_role_types?.[0]) ||
    null
  );
}

function getNaturalStrengths(operatingStyleSummary: any): string[] {
  return listFromValue(
    operatingStyleSummary?.natural_strengths ??
      operatingStyleSummary?.naturalStrengths ??
      operatingStyleSummary?.strengths,
    4,
  );
}

function getFrictionPoints(operatingStyleSummary: any): string[] {
  return listFromValue(
    operatingStyleSummary?.friction_points ??
      operatingStyleSummary?.frictionPoints ??
      operatingStyleSummary?.blind_spots ??
      operatingStyleSummary?.blindSpots,
    4,
  );
}

function getRoleRisks(roleFitSummary: any): string[] {
  return listFromValue(
    roleFitSummary?.role_risks ??
      roleFitSummary?.roleRisks ??
      roleFitSummary?.risks,
    4,
  );
}

function getDecisionStyle(operatingStyleSummary: any): string | null {
  return (
    textFromValue(operatingStyleSummary?.decision_making_style) ||
    textFromValue(operatingStyleSummary?.decisionMakingStyle) ||
    null
  );
}

function getTeamContribution(operatingStyleSummary: any): string | null {
  return (
    textFromValue(operatingStyleSummary?.team_contribution_style) ||
    textFromValue(operatingStyleSummary?.teamContributionStyle) ||
    null
  );
}

function getIdealProfileSummary(
  idealCandidateProfile: any,
  key: "thinking_style" | "execution_style" | "team_style",
): string | null {
  return (
    textFromValue(idealCandidateProfile?.[key]?.summary) ||
    textFromValue(idealCandidateProfile?.[key]) ||
    null
  );
}

function buildTraitSnapshot(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const primaryStyle = getPrimaryOperatingStyle(input.scoring);
  const secondaryStyle = getSecondaryOperatingStyle(input.scoring);
  const primaryCore = getPrimaryCore(input.scoring);
  const vertical = getCareerVertical(input.scoring);

  const styleLabel = getLabel(primaryStyle, "a defined operating style");
  const secondaryLabel = secondaryStyle
    ? getLabel(secondaryStyle, "a secondary operating influence")
    : null;
  const coreLabel = getLabel(primaryCore, "a balanced CORE contribution");
  const verticalLabel = getLabel(vertical, "the required career vertical");

  const opening =
    perspective === "role"
      ? `The ideal candidate should show a ${styleLabel} operating pattern, supported by ${coreLabel} and the judgement expected at ${verticalLabel}.`
      : `This applicant's results indicate a ${styleLabel} operating pattern, supported by ${coreLabel} and currently expressed at ${verticalLabel}.`;

  const secondarySentence = secondaryLabel
    ? perspective === "role"
      ? `A secondary ${secondaryLabel} influence should broaden how the person responds when the role requires a different contribution.`
      : `A secondary ${secondaryLabel} influence may broaden how the applicant responds when the situation requires a different contribution.`
    : null;

  return joinSentences([
    opening,
    firstSentences(getOperatingSummary(input.operatingStyleSummary), 1),
    firstSentences(
      currentVerticalSummary(input.careerVerticalSummary, vertical),
      1,
    ),
    firstSentences(getCapacity(input.roleFitSummary), 1),
    secondarySentence,
  ]);
}

function buildHowTheyWork(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const primaryStyle = getPrimaryOperatingStyle(input.scoring);
  const primaryCore = getPrimaryCore(input.scoring);
  const styleLabel = getLabel(primaryStyle, "their dominant operating pattern");
  const coreLabel = getLabel(primaryCore, "their strongest CORE contribution");

  const strengths = getNaturalStrengths(input.operatingStyleSummary);
  const strengthPhrase = compactJoin(strengths.slice(0, 3));
  const decisionStyle = getDecisionStyle(input.operatingStyleSummary);
  const teamContribution = getTeamContribution(input.operatingStyleSummary);

  const roleOpening = `They should think and execute through the strengths associated with ${styleLabel}, using ${coreLabel} to turn those strengths into useful contribution.`;
  const candidateOpening = `They are likely to think and execute through the strengths associated with ${styleLabel}, using ${coreLabel} as the most natural route for creating value.`;

  const strengthSentence = strengthPhrase
    ? perspective === "role"
      ? `Key strengths to look for include ${strengthPhrase}.`
      : `Likely natural strengths include ${strengthPhrase}.`
    : null;

  const decisionSentence = decisionStyle
    ? perspective === "role"
      ? `Required decision-making pattern: ${firstSentences(decisionStyle, 1)}`
      : `Likely decision-making pattern: ${firstSentences(decisionStyle, 1)}`
    : null;

  const teamSentence = teamContribution
    ? perspective === "role"
      ? `Required team contribution: ${firstSentences(teamContribution, 1)}`
      : `Likely team contribution: ${firstSentences(teamContribution, 1)}`
    : null;

  return joinSentences([
    perspective === "role" ? roleOpening : candidateOpening,
    firstSentences(
      getIdealProfileSummary(input.idealCandidateProfile, "thinking_style"),
      1,
    ),
    firstSentences(
      getIdealProfileSummary(input.idealCandidateProfile, "execution_style"),
      1,
    ),
    firstSentences(
      getIdealProfileSummary(input.idealCandidateProfile, "team_style"),
      1,
    ),
    strengthSentence,
    decisionSentence,
    teamSentence,
  ]);
}

function normaliseRiskPhrase(value: string): string {
  const cleaned = stripTerminalPunctuation(value).trim();
  if (!cleaned) return "";

  const conditional = cleaned.match(
    /^(?:(?:the applicant|the candidate|they)\s+)?(?:may|can|could)\s+(.+)$/i,
  );

  if (conditional?.[1]) {
    return `a tendency to ${conditional[1].trim()}`;
  }

  return cleaned;
}

function buildWhatToVerify(
  perspective: NarrativePerspective,
  input: BuildSectionsInput,
): string {
  const frictionPoints = getFrictionPoints(input.operatingStyleSummary);
  const roleRisks = getRoleRisks(input.roleFitSummary);
  const allRisks = dedupeTexts([...frictionPoints, ...roleRisks])
    .map(normaliseRiskPhrase)
    .filter(Boolean)
    .slice(0, 4);
  const riskPhrase = compactJoin(allRisks.slice(0, 3));

  const weakestCore = getWeakestCore(input.scoring);
  const weakestCoreLabel = weakestCore
    ? getLabel(weakestCore, "the least automatic CORE area")
    : null;
  const weakestCorePct = weakestCore ? percentagePhrase(weakestCore) : null;

  const vertical = getCareerVertical(input.scoring);
  const verticalLabel = getLabel(vertical, "the indicated career vertical");
  const topRoleAlignment = getTopRoleAlignment(input.roleFitSummary);

  const riskSentence = riskPhrase
    ? perspective === "role"
      ? `Verify evidence in these risk and friction areas: ${riskPhrase}.`
      : `Use the interview to test these risk and friction areas: ${riskPhrase}.`
    : perspective === "role"
      ? "Verify how the candidate handles pressure, ambiguity, competing priorities, and accountability at the required scope."
      : "Use the interview to verify how the applicant handles pressure, ambiguity, competing priorities, and accountability at the indicated scope.";

  const evidenceSentence =
    perspective === "role"
      ? `Ask for recent examples with clear context, personal responsibility, decisions made, trade-offs considered, and measurable outcomes at ${verticalLabel}.`
      : `Ask for recent examples with clear context, personal responsibility, decisions made, trade-offs considered, and measurable outcomes at ${verticalLabel}.`;

  const coreSentence = weakestCoreLabel
    ? perspective === "role"
      ? `Because ${weakestCoreLabel}${weakestCorePct ? ` is the lowest CORE area (${weakestCorePct})` : " may be less automatic"}, confirm what systems, habits, or complementary support the person uses to protect this part of the work cycle.`
      : `Because ${weakestCoreLabel}${weakestCorePct ? ` is the lowest CORE area (${weakestCorePct})` : " may be less automatic"}, confirm what systems, habits, or complementary support the applicant uses to protect this part of the work cycle.`
    : null;

  const alignmentSentence = topRoleAlignment
    ? perspective === "role"
      ? `Confirm that prior experience demonstrates the expected alignment with ${topRoleAlignment}, rather than relying only on role title or self-description.`
      : `Confirm whether the applicant's evidence genuinely supports alignment with ${topRoleAlignment}, rather than relying only on role title or self-description.`
    : null;

  return joinSentences([
    riskSentence,
    evidenceSentence,
    coreSentence,
    alignmentSentence,
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
