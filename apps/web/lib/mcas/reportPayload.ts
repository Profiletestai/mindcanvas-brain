// apps/web/lib/mcas/reportPayload.ts

import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  getCoreLabel,
  getOperatingStyleDisplayLabel,
  getVerticalLabel,
  MCAS_CORE_LABELS,
  MCAS_OPERATING_STYLE_LABELS,
  MCAS_VERTICAL_LABELS,
} from "./reportConstants";
import type {
  McasBlindSpot,
  McasCareerVerticalCode,
  McasCoreCode,
  McasDistributionItem,
  McasEnvironmentFit,
  McasOperatingStyleCode,
  McasReportPayload,
  McasReportType,
  McasRoleRecommendation,
  McasStrength,
  McasSuccessGuideItem,
} from "./reportTypes";

type JsonRecord = Record<string, unknown>;

type AssessmentRow = {
  id: string;
  partner_application_id: string | null;
  test_link_id: string | null;
  individual_id: string | null;
  framework_slug: string;
  framework_version: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  meta: unknown;
  report_token: string;
};

type TestLinkRow = {
  id: string;
  org_id: string;
  public_token: string;
  link_type: string;
  framework_slug: string;
  framework_version: string;
  name: string;
  report_version: "lite" | "full";
  show_results: boolean;
  email_report: boolean;
  next_steps_url: string | null;
  settings: unknown;
};

type IndividualRow = {
  id: string;
  org_id: string;
  external_ref: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ResultRow = {
  id: string;
  assessment_id: string;
  scoring_model: string;
  core_distribution: unknown;
  os_distribution: unknown;
  vertical_readiness: unknown;
  confidence: unknown;
  flags: unknown;
  computed_at: string | null;
};

type BuildPayloadArgs =
  | { token: string; assessmentId?: never; reportType?: McasReportType }
  | { assessmentId: string; token?: never; reportType?: McasReportType };

const DEFAULT_REPORT_VERSION = "mcas_report_v1";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    db: { schema: "mcas" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function toPercentage(value: unknown) {
  const numberValue = toNumber(value, 0);
  const percentage = numberValue > 0 && numberValue <= 1 ? numberValue * 100 : numberValue;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

function toCandidateFullName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Candidate";
}

function rankBand(
  percentage: number,
  rank: number
): McasDistributionItem["band"] {
  if (rank === 1) return "dominant";
  if (rank === 2) return "secondary";
  if (rank === 3) return "tertiary";
  if (percentage <= 15) return "low";
  return "minimal";
}

function sortAndRank<TCode extends string>(
  items: Array<Omit<McasDistributionItem<TCode>, "rank" | "band">>
): McasDistributionItem<TCode>[] {
  return items
    .sort((a, b) => b.percentage - a.percentage)
    .map((item, index) => {
      const rank = index + 1;
      return {
        ...item,
        rank,
        band: rankBand(item.percentage, rank),
      };
    });
}

function maybeOperatingStyleCode(value: unknown): McasOperatingStyleCode | null {
  const raw = cleanString(value);
  if (!raw) return null;

  const upper = raw.toUpperCase();

  if (
    upper === "OS1" ||
    upper === "OS2" ||
    upper === "OS3" ||
    upper === "OS4" ||
    upper === "OS5" ||
    upper === "OS6" ||
    upper === "OS7" ||
    upper === "OS8"
  ) {
    return upper as McasOperatingStyleCode;
  }

  const compact = upper.replace(/\s+/g, "").replace(/[-_]/g, "");

  const labelMap: Record<string, McasOperatingStyleCode> = {
    VISIONARY: "OS1",
    TRAILBLAZER: "OS1",
    CATALYST: "OS2",
    SPARK: "OS2",
    MOTIVATOR: "OS3",
    UPLIFTER: "OS3",
    CONNECTOR: "OS4",
    BRIDGEBUILDER: "OS4",
    FACILITATOR: "OS5",
    STEADYHAND: "OS5",
    COORDINATOR: "OS6",
    ORGANISER: "OS6",
    ORGANIZER: "OS6",
    CONTROLLER: "OS7",
    ANALYST: "OS7",
    OPTIMISER: "OS8",
    OPTIMIZER: "OS8",
    REFINER: "OS8",
  };

  return labelMap[compact] ?? null;
}

function maybeCoreCode(value: unknown): McasCoreCode | null {
  const raw = cleanString(value);
  if (!raw) return null;

  const upper = raw.toUpperCase();

  if (
    upper === "CREATE" ||
    upper === "ORGANISE" ||
    upper === "RESOLVE" ||
    upper === "EXAMINE"
  ) {
    return upper as McasCoreCode;
  }

  if (upper === "ORGANIZE") return "ORGANISE";

  const letterMap: Record<string, McasCoreCode> = {
    C: "CREATE",
    O: "ORGANISE",
    R: "RESOLVE",
    E: "EXAMINE",
  };

  return letterMap[upper] ?? null;
}

function maybeVerticalCode(value: unknown): McasCareerVerticalCode | null {
  const raw = cleanString(value);
  if (!raw) return null;

  const upper = raw.toUpperCase();

  if (
    upper === "V1" ||
    upper === "V2" ||
    upper === "V3" ||
    upper === "V4" ||
    upper === "V5" ||
    upper === "V6"
  ) {
    return upper as McasCareerVerticalCode;
  }

  const numeric = upper.match(/[1-6]/)?.[0];
  return numeric ? (`V${numeric}` as McasCareerVerticalCode) : null;
}

function normaliseOperatingStyleDistribution(
  value: unknown
): McasDistributionItem<McasOperatingStyleCode>[] {
  const map = new Map<
    McasOperatingStyleCode,
    Omit<McasDistributionItem<McasOperatingStyleCode>, "rank" | "band">
  >();

  function add(code: McasOperatingStyleCode, valueToAdd: unknown) {
    const percentage = toPercentage(valueToAdd);
    const existing = map.get(code);

    if (!existing || percentage > existing.percentage) {
      map.set(code, {
        code,
        label: getOperatingStyleDisplayLabel(code),
        shortLabel: MCAS_OPERATING_STYLE_LABELS[code].label,
        percentage,
        description: MCAS_OPERATING_STYLE_LABELS[code].shortDescription,
      });
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const code =
        maybeOperatingStyleCode(item.code) ??
        maybeOperatingStyleCode(item.label) ??
        maybeOperatingStyleCode(item.name);
      if (code) add(code, item.percentage ?? item.pct ?? item.value ?? item.score);
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseOperatingStyleDistribution(value.distribution);
    }

    for (const [key, score] of Object.entries(value)) {
      const code = maybeOperatingStyleCode(key);
      if (code) add(code, score);
    }
  }

  for (const code of Object.keys(
    MCAS_OPERATING_STYLE_LABELS
  ) as McasOperatingStyleCode[]) {
    if (!map.has(code)) add(code, 0);
  }

  return sortAndRank(Array.from(map.values()));
}

function normaliseCoreDistribution(value: unknown): McasDistributionItem<McasCoreCode>[] {
  const map = new Map<
    McasCoreCode,
    Omit<McasDistributionItem<McasCoreCode>, "rank" | "band">
  >();

  function add(code: McasCoreCode, valueToAdd: unknown) {
    const percentage = toPercentage(valueToAdd);
    const existing = map.get(code);

    if (!existing || percentage > existing.percentage) {
      map.set(code, {
        code,
        label: getCoreLabel(code),
        percentage,
        description: MCAS_CORE_LABELS[code].shortDescription,
      });
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const code =
        maybeCoreCode(item.code) ??
        maybeCoreCode(item.label) ??
        maybeCoreCode(item.name);
      if (code) add(code, item.percentage ?? item.pct ?? item.value ?? item.score);
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseCoreDistribution(value.distribution);
    }

    for (const [key, score] of Object.entries(value)) {
      const code = maybeCoreCode(key);
      if (code) add(code, score);
    }
  }

  for (const code of Object.keys(MCAS_CORE_LABELS) as McasCoreCode[]) {
    if (!map.has(code)) add(code, 0);
  }

  return sortAndRank(Array.from(map.values()));
}

function normaliseCareerVerticalDistribution(
  value: unknown
): McasDistributionItem<McasCareerVerticalCode>[] {
  const map = new Map<
    McasCareerVerticalCode,
    Omit<McasDistributionItem<McasCareerVerticalCode>, "rank" | "band">
  >();

  function add(code: McasCareerVerticalCode, valueToAdd: unknown) {
    const percentage = toPercentage(valueToAdd);
    const existing = map.get(code);

    if (!existing || percentage > existing.percentage) {
      map.set(code, {
        code,
        label: getVerticalLabel(code),
        percentage,
        description: MCAS_VERTICAL_LABELS[code].shortDescription,
      });
    }
  }

  if (typeof value === "string") {
    const code = maybeVerticalCode(value);
    if (code) add(code, 100);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const code =
        maybeVerticalCode(item.code) ??
        maybeVerticalCode(item.label) ??
        maybeVerticalCode(item.name);
      if (code) add(code, item.percentage ?? item.pct ?? item.value ?? item.score);
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseCareerVerticalDistribution(value.distribution);
    }

    for (const [key, score] of Object.entries(value)) {
      const code = maybeVerticalCode(key);
      if (code) add(code, score);
    }
  }

  for (const code of Object.keys(MCAS_VERTICAL_LABELS) as McasCareerVerticalCode[]) {
    if (!map.has(code)) add(code, 0);
  }

  return sortAndRank(Array.from(map.values()));
}

function normaliseFlags(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (isRecord(item)) {
          return cleanString(item.label) ?? cleanString(item.title) ?? cleanString(item.code);
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key);
  }

  return [];
}

function normaliseConfidence(value: unknown) {
  if (isRecord(value)) {
    const scoreValue =
      value.score ?? value.percentage ?? value.confidence ?? value.confidence_score;
    const score = scoreValue === undefined ? undefined : toPercentage(scoreValue);
    const level = cleanString(value.level) ?? cleanString(value.rating) ?? cleanString(value.band);
    const normalisedLevel = level?.toLowerCase();

    return {
      level:
        normalisedLevel === "high"
          ? ("high" as const)
          : normalisedLevel === "low"
            ? ("low" as const)
            : ("moderate" as const),
      score,
      notes: [] as string[],
    };
  }

  return {
    level: "moderate" as const,
    score: undefined,
    notes: [] as string[],
  };
}

function getMetaCandidatePhone(meta: unknown): string | null {
  if (!isRecord(meta) || !isRecord(meta.candidate)) return null;
  return cleanString(meta.candidate.phone);
}

function getVerticalReadinessLabel(code: McasCareerVerticalCode) {
  return `${code} fit indicated`;
}

async function fetchAssessmentByReportToken(reportToken: string): Promise<AssessmentRow | null> {
  const { data, error } = await mcasSupa()
    .from("assessments")
    .select(
      [
        "id",
        "partner_application_id",
        "test_link_id",
        "individual_id",
        "framework_slug",
        "framework_version",
        "status",
        "started_at",
        "completed_at",
        "meta",
        "report_token",
      ].join(", ")
    )
    .eq("report_token", reportToken)
    .maybeSingle();

  if (error) throw new Error(`Unable to load MCAS assessment by report token: ${error.message}`);
  return data as AssessmentRow | null;
}

async function fetchAssessmentById(assessmentId: string): Promise<AssessmentRow | null> {
  const { data, error } = await mcasSupa()
    .from("assessments")
    .select(
      [
        "id",
        "partner_application_id",
        "test_link_id",
        "individual_id",
        "framework_slug",
        "framework_version",
        "status",
        "started_at",
        "completed_at",
        "meta",
        "report_token",
      ].join(", ")
    )
    .eq("id", assessmentId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load MCAS assessment by id: ${error.message}`);
  return data as AssessmentRow | null;
}

async function fetchTestLink(testLinkId: string): Promise<TestLinkRow | null> {
  const { data, error } = await mcasSupa()
    .from("test_links")
    .select(
      [
        "id",
        "org_id",
        "public_token",
        "link_type",
        "framework_slug",
        "framework_version",
        "name",
        "report_version",
        "show_results",
        "email_report",
        "next_steps_url",
        "settings",
      ].join(", ")
    )
    .eq("id", testLinkId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load MCAS test link: ${error.message}`);
  return data as TestLinkRow | null;
}

async function fetchIndividual(individualId: string | null): Promise<IndividualRow | null> {
  if (!individualId) return null;

  const { data, error } = await mcasSupa()
    .from("individuals")
    .select("id, org_id, external_ref, email, first_name, last_name")
    .eq("id", individualId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load MCAS individual: ${error.message}`);
  return data as IndividualRow | null;
}

async function fetchResultForAssessment(assessmentId: string): Promise<ResultRow | null> {
  const { data, error } = await mcasSupa()
    .from("results")
    .select(
      [
        "id",
        "assessment_id",
        "scoring_model",
        "core_distribution",
        "os_distribution",
        "vertical_readiness",
        "confidence",
        "flags",
        "computed_at",
      ].join(", ")
    )
    .eq("assessment_id", assessmentId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load MCAS result: ${error.message}`);
  return data as ResultRow | null;
}

function getStrengths(code: McasOperatingStyleCode): McasStrength[] {
  const label = getOperatingStyleDisplayLabel(code);
  return [
    {
      title: `${label} contribution`,
      description:
        "You have a clear natural pattern for moving work forward and creating value in the right environment.",
      icon: "✦",
    },
    {
      title: "Natural execution rhythm",
      description:
        "Your results show how you tend to create momentum, organise work, resolve priorities, and examine quality.",
      icon: "↗",
    },
    {
      title: "Best-fit awareness",
      description:
        "This profile helps you understand the conditions where your strongest work patterns are most sustainable.",
      icon: "◎",
    },
  ];
}

function getEnvironmentFit(code: McasOperatingStyleCode): McasEnvironmentFit {
  const label = getOperatingStyleDisplayLabel(code);
  return {
    pace: "Moderate to fast — enough movement to create momentum without losing clarity.",
    autonomy: "Moderate to high — you perform best when trusted to use your natural work pattern responsibly.",
    structure: "Semi-structured — clear goals with enough flexibility to apply your strengths.",
    workStyle: `${label}-aligned work — environments that value your natural contribution pattern.`,
  };
}

function getRoleRecommendations(code: McasOperatingStyleCode): McasRoleRecommendation[] {
  const label = getOperatingStyleDisplayLabel(code);
  return [
    {
      category: "Primary Fit",
      title: `${label}-aligned role`,
      description:
        "A role where your natural operating style is central to how value is created.",
    },
    {
      category: "Growth Pathway",
      title: "Cross-functional contributor",
      description:
        "A pathway where your work pattern can support collaboration, execution, and sustainable delivery.",
    },
    {
      category: "Development Fit",
      title: "Responsibility expansion role",
      description:
        "A role that lets you grow scope while strengthening your lower-scoring CORE areas.",
    },
  ];
}

function getBlindSpots(_code: McasOperatingStyleCode): McasBlindSpot[] {
  return [
    {
      title: "Overusing your strongest pattern",
      description:
        "Your strongest work pattern can become a limitation if it is applied automatically in every situation.",
      managementStrategy:
        "Pause before reacting and ask what this situation needs from the full work cycle, not only from your strongest pattern.",
    },
    {
      title: "Under-supporting lower CORE areas",
      description:
        "Lower scoring work-cycle areas may need conscious structure, partnership, or review.",
      managementStrategy:
        "Build simple checkpoints or partner with people whose natural strengths cover the areas you underuse.",
    },
  ];
}

function getSuccessGuide(code: McasOperatingStyleCode): McasSuccessGuideItem[] {
  const label = getOperatingStyleDisplayLabel(code);
  return [
    {
      period: "days_1_30",
      title: "Understand your operating context",
      description: `Notice where your ${label} pattern is useful and where the role may need support from other work-cycle strengths.`,
    },
    {
      period: "days_31_60",
      title: "Build your support structure",
      description:
        "Create simple habits, checkpoints, and partnerships that protect your strengths and reduce predictable friction.",
    },
    {
      period: "days_61_90",
      title: "Scale deliberately",
      description:
        "Use your strongest work pattern more intentionally. Expand responsibility without losing sustainability.",
    },
  ];
}

function getCandidateFacingContent(primaryCode: McasOperatingStyleCode) {
  const displayLabel = getOperatingStyleDisplayLabel(primaryCode);
  const knowledgeLabel = MCAS_OPERATING_STYLE_LABELS[primaryCode].label;
  const stage = MCAS_OPERATING_STYLE_LABELS[primaryCode].workCycleStage;

  return {
    workPatternSummary: `Your strongest pattern is ${displayLabel}. This means your work energy is most naturally expressed through ${stage.toLowerCase()}.`,
    operatingStyleNarrative: `The ${displayLabel} pattern, known in the MCAS knowledge base as ${knowledgeLabel}, describes how you most naturally move work forward. It is not a personality label. It is a practical view of the work conditions, contribution patterns, and responsibility levels where your strengths are most likely to create sustainable value.`,
    strengths: getStrengths(primaryCode),
    environmentFit: getEnvironmentFit(primaryCode),
    roleRecommendations: getRoleRecommendations(primaryCode),
    blindSpots: getBlindSpots(primaryCode),
    successGuide: getSuccessGuide(primaryCode),
    nextStepPathway: {
      current: "Current fit",
      next: "Next stage",
      future: "Future growth",
      developmentFocus: [
        "Build repeatable success habits around your natural pattern.",
        "Strengthen the areas that support sustainable scale.",
        "Use your strongest work pattern deliberately, not reactively.",
      ],
    },
  };
}

function buildInternalSummary(
  operatingStylePrimary: McasDistributionItem<McasOperatingStyleCode>,
  careerVerticalPrimary: McasDistributionItem<McasCareerVerticalCode>,
  confidenceScore?: number,
  flags: string[] = []
) {
  const riskLevel =
    flags.length >= 3 || (confidenceScore !== undefined && confidenceScore < 45)
      ? "high"
      : flags.length > 0 || (confidenceScore !== undefined && confidenceScore < 70)
        ? "moderate"
        : "low";

  return {
    riskLevel,
    riskNotes:
      flags.length > 0
        ? flags
        : ["No critical flags are currently indicated in the saved result."],
    recommendationSummary: `${operatingStylePrimary.label} is the dominant operating pattern. Current vertical indication is ${careerVerticalPrimary.code}. Validate role fit against a role blueprint before using this result for final decision support.`,
  } as const;
}

export async function buildMcasReportPayload(
  args: BuildPayloadArgs
): Promise<McasReportPayload> {
  const reportType = args.reportType ?? "snapshot";

  const assessment =
    typeof args.token === "string"
      ? await fetchAssessmentByReportToken(args.token)
      : await fetchAssessmentById(args.assessmentId);

  if (!assessment) throw new Error("MCAS assessment not found.");
  if (!assessment.test_link_id) {
    throw new Error(
      "This report route expects a candidate assessment created from mcas.test_links."
    );
  }

  const [testLink, individual, result] = await Promise.all([
    fetchTestLink(assessment.test_link_id),
    fetchIndividual(assessment.individual_id),
    fetchResultForAssessment(assessment.id),
  ]);

  if (!testLink) throw new Error("MCAS test link not found for this assessment.");
  if (!result) throw new Error("MCAS result not found for this assessment.");

  const osDistribution = normaliseOperatingStyleDistribution(result.os_distribution);
  const coreDistribution = normaliseCoreDistribution(result.core_distribution);
  const verticalDistribution = normaliseCareerVerticalDistribution(result.vertical_readiness);

  const primaryOperatingStyle = osDistribution[0];
  const secondaryOperatingStyle = osDistribution[1];
  const strongestCore = coreDistribution[0];
  const weakestCore = [...coreDistribution].sort((a, b) => a.percentage - b.percentage)[0];
  const primaryVertical = verticalDistribution[0];
  const nextVertical = verticalDistribution[1];

  if (!primaryOperatingStyle) {
    throw new Error("MCAS operating style distribution could not be resolved.");
  }
  if (!strongestCore) throw new Error("MCAS CORE distribution could not be resolved.");
  if (!primaryVertical) throw new Error("MCAS career vertical distribution could not be resolved.");

  const confidence = normaliseConfidence(result.confidence);
  const flags = normaliseFlags(result.flags);
  const candidateContent = getCandidateFacingContent(primaryOperatingStyle.code);
  const internalSummary = buildInternalSummary(
    primaryOperatingStyle,
    primaryVertical,
    confidence.score,
    flags
  );

  const firstName = individual?.first_name ?? null;
  const lastName = individual?.last_name ?? null;
  const fullReportUnlocked = testLink.report_version === "full";

  return {
    reportType,
    reportVersion: DEFAULT_REPORT_VERSION,

    organisation: {
      id: testLink.org_id,
      name: "MindCanvas MCAS",
      slug: undefined,
      branding: undefined,
    },

    candidate: {
      applicationId: assessment.id,
      firstName,
      lastName,
      fullName: toCandidateFullName(firstName, lastName),
      email: individual?.email ?? null,
      phone: getMetaCandidatePhone(assessment.meta),
    },

    assessment: {
      assessmentId: assessment.id,
      status: assessment.status,
      startedAt: assessment.started_at,
      completedAt: assessment.completed_at ?? result.computed_at,
    },

    result: {
      scoringModel: result.scoring_model,
      operatingStyle: {
        primary: primaryOperatingStyle,
        secondary: secondaryOperatingStyle,
        distribution: osDistribution,
      },
      core: {
        strongest: strongestCore,
        weakest: weakestCore,
        distribution: coreDistribution,
      },
      careerVertical: {
        primary: primaryVertical,
        next: nextVertical,
        distribution: verticalDistribution,
        readinessLabel: getVerticalReadinessLabel(primaryVertical.code),
        readinessPercentage: undefined,
      },
      confidence,
      flags,
    },

    candidateFacing: {
      workPatternSummary: candidateContent.workPatternSummary,
      operatingStyleNarrative: candidateContent.operatingStyleNarrative,
      strengths: candidateContent.strengths,
      environmentFit: candidateContent.environmentFit,
      roleRecommendations: candidateContent.roleRecommendations,
      blindSpots: candidateContent.blindSpots,
      successGuide: candidateContent.successGuide,
      nextStepPathway: candidateContent.nextStepPathway,
    },

    internal: {
      riskLevel: internalSummary.riskLevel,
      riskNotes: internalSummary.riskNotes,
      recommendationSummary: internalSummary.recommendationSummary,
    },

    access: {
      snapshotUnlocked: testLink.show_results,
      fullUnlocked: fullReportUnlocked,
      internalUnlocked: true,
      fullPurchaseEnabled: true,
    },
  };
}

export async function buildMcasReportPayloadByToken(
  token: string,
  reportType: McasReportType = "snapshot"
): Promise<McasReportPayload> {
  return buildMcasReportPayload({ token, reportType });
}

export async function buildMcasReportPayloadByApplicationId(
  applicationId: string,
  reportType: McasReportType = "internal_decision"
): Promise<McasReportPayload> {
  return buildMcasReportPayload({ assessmentId: applicationId, reportType });
}