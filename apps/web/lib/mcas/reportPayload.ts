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

type PartnerApplicationRow = {
  id: string;
  org_id: string | null;
  partner_key: string | null;
  application_id: string | null;
  status: string | null;
  candidate_first_name: string | null;
  candidate_last_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
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
  | {
      token: string;
      assessmentId?: never;
      partnerApplicationId?: never;
      reportType?: McasReportType;
    }
  | {
      assessmentId: string;
      token?: never;
      partnerApplicationId?: never;
      reportType?: McasReportType;
    }
  | {
      partnerApplicationId: string;
      token?: never;
      assessmentId?: never;
      reportType?: McasReportType;
    };

type DistributionBand = NonNullable<McasDistributionItem<string>["band"]>;

const DEFAULT_REPORT_VERSION = "mcas_report_v1";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

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

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace("%", "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function normalisePercentage(value: unknown): number {
  const numberValue = asNumber(value, 0);

  if (numberValue > 0 && numberValue <= 1) {
    return clampPercentage(numberValue * 100);
  }

  return clampPercentage(numberValue);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toCandidateFullName(firstName: string | null, lastName: string | null) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || "Candidate";
}

function rankBand(percentage: number, rank: number): DistributionBand {
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
    .map((item) => ({
      ...item,
      percentage: clampPercentage(item.percentage),
    }))
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
  if (numeric) return `V${numeric}` as McasCareerVerticalCode;

  return null;
}

function mergeDistributionItems<TCode extends string>(
  items: Array<Omit<McasDistributionItem<TCode>, "rank" | "band">>
): Array<Omit<McasDistributionItem<TCode>, "rank" | "band">> {
  const map = new Map<
    TCode,
    Omit<McasDistributionItem<TCode>, "rank" | "band">
  >();

  for (const item of items) {
    const existing = map.get(item.code);

    if (!existing || item.percentage > existing.percentage) {
      map.set(item.code, item);
    }
  }

  return Array.from(map.values());
}

function ensureAllOperatingStyles(
  items: Array<
    Omit<McasDistributionItem<McasOperatingStyleCode>, "rank" | "band">
  >
): McasDistributionItem<McasOperatingStyleCode>[] {
  const existing = new Set(items.map((item) => item.code));
  const completed = [...items];

  for (const code of Object.keys(
    MCAS_OPERATING_STYLE_LABELS
  ) as McasOperatingStyleCode[]) {
    if (existing.has(code)) continue;

    completed.push({
      code,
      label: getOperatingStyleDisplayLabel(code),
      shortLabel: MCAS_OPERATING_STYLE_LABELS[code].label,
      percentage: 0,
      description: MCAS_OPERATING_STYLE_LABELS[code].shortDescription,
    });
  }

  return sortAndRank(completed);
}

function ensureAllCoreCodes(
  items: Array<Omit<McasDistributionItem<McasCoreCode>, "rank" | "band">>
): McasDistributionItem<McasCoreCode>[] {
  const existing = new Set(items.map((item) => item.code));
  const completed = [...items];

  for (const code of Object.keys(MCAS_CORE_LABELS) as McasCoreCode[]) {
    if (existing.has(code)) continue;

    completed.push({
      code,
      label: getCoreLabel(code),
      percentage: 0,
      description: MCAS_CORE_LABELS[code].shortDescription,
    });
  }

  return sortAndRank(completed);
}

function ensureAllVerticalCodes(
  items: Array<
    Omit<McasDistributionItem<McasCareerVerticalCode>, "rank" | "band">
  >
): McasDistributionItem<McasCareerVerticalCode>[] {
  const existing = new Set(items.map((item) => item.code));
  const completed = [...items];

  for (const code of Object.keys(
    MCAS_VERTICAL_LABELS
  ) as McasCareerVerticalCode[]) {
    if (existing.has(code)) continue;

    completed.push({
      code,
      label: getVerticalLabel(code),
      percentage: 0,
      description: MCAS_VERTICAL_LABELS[code].shortDescription,
    });
  }

  return sortAndRank(completed);
}

function normaliseOperatingStyleDistribution(
  value: unknown
): McasDistributionItem<McasOperatingStyleCode>[] {
  const items: Array<
    Omit<McasDistributionItem<McasOperatingStyleCode>, "rank" | "band">
  > = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) continue;

      const code =
        maybeOperatingStyleCode(entry.code) ??
        maybeOperatingStyleCode(entry.os_code) ??
        maybeOperatingStyleCode(entry.operating_style) ??
        maybeOperatingStyleCode(entry.label) ??
        maybeOperatingStyleCode(entry.name);

      if (!code) continue;

      items.push({
        code,
        label: getOperatingStyleDisplayLabel(code),
        shortLabel: MCAS_OPERATING_STYLE_LABELS[code].label,
        percentage: normalisePercentage(
          entry.percentage ?? entry.pct ?? entry.value ?? entry.score
        ),
        description: MCAS_OPERATING_STYLE_LABELS[code].shortDescription,
      });
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseOperatingStyleDistribution(value.distribution);
    }

    for (const [key, percentageValue] of Object.entries(value)) {
      const code = maybeOperatingStyleCode(key);
      if (!code) continue;

      items.push({
        code,
        label: getOperatingStyleDisplayLabel(code),
        shortLabel: MCAS_OPERATING_STYLE_LABELS[code].label,
        percentage: normalisePercentage(percentageValue),
        description: MCAS_OPERATING_STYLE_LABELS[code].shortDescription,
      });
    }
  }

  return ensureAllOperatingStyles(mergeDistributionItems(items));
}

function normaliseCoreDistribution(
  value: unknown
): McasDistributionItem<McasCoreCode>[] {
  const items: Array<Omit<McasDistributionItem<McasCoreCode>, "rank" | "band">> =
    [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) continue;

      const code =
        maybeCoreCode(entry.code) ??
        maybeCoreCode(entry.core_code) ??
        maybeCoreCode(entry.label) ??
        maybeCoreCode(entry.name);

      if (!code) continue;

      items.push({
        code,
        label: getCoreLabel(code),
        percentage: normalisePercentage(
          entry.percentage ?? entry.pct ?? entry.value ?? entry.score
        ),
        description: MCAS_CORE_LABELS[code].shortDescription,
      });
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseCoreDistribution(value.distribution);
    }

    for (const [key, percentageValue] of Object.entries(value)) {
      const code = maybeCoreCode(key);
      if (!code) continue;

      items.push({
        code,
        label: getCoreLabel(code),
        percentage: normalisePercentage(percentageValue),
        description: MCAS_CORE_LABELS[code].shortDescription,
      });
    }
  }

  return ensureAllCoreCodes(mergeDistributionItems(items));
}

function normaliseCareerVerticalDistribution(
  value: unknown
): McasDistributionItem<McasCareerVerticalCode>[] {
  const items: Array<
    Omit<McasDistributionItem<McasCareerVerticalCode>, "rank" | "band">
  > = [];

  if (typeof value === "string") {
    const code = maybeVerticalCode(value);
    if (code) {
      items.push({
        code,
        label: getVerticalLabel(code),
        percentage: 100,
        description: MCAS_VERTICAL_LABELS[code].shortDescription,
      });
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) continue;

      const code =
        maybeVerticalCode(entry.code) ??
        maybeVerticalCode(entry.cv_code) ??
        maybeVerticalCode(entry.vertical) ??
        maybeVerticalCode(entry.label) ??
        maybeVerticalCode(entry.name);

      if (!code) continue;

      items.push({
        code,
        label: getVerticalLabel(code),
        percentage: normalisePercentage(
          entry.percentage ?? entry.pct ?? entry.value ?? entry.score
        ),
        description: MCAS_VERTICAL_LABELS[code].shortDescription,
      });
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseCareerVerticalDistribution(value.distribution);
    }

    for (const [key, percentageValue] of Object.entries(value)) {
      const code = maybeVerticalCode(key);
      if (!code) continue;

      items.push({
        code,
        label: getVerticalLabel(code),
        percentage: normalisePercentage(percentageValue),
        description: MCAS_VERTICAL_LABELS[code].shortDescription,
      });
    }

    const primaryCode =
      maybeVerticalCode(value.primary) ??
      maybeVerticalCode(value.current) ??
      maybeVerticalCode(value.current_vertical);

    if (primaryCode && !items.some((item) => item.code === primaryCode)) {
      items.push({
        code: primaryCode,
        label: getVerticalLabel(primaryCode),
        percentage: 100,
        description: MCAS_VERTICAL_LABELS[primaryCode].shortDescription,
      });
    }
  }

  return ensureAllVerticalCodes(mergeDistributionItems(items));
}

function getNextCareerVertical(
  distribution: McasDistributionItem<McasCareerVerticalCode>[],
  primaryCode: McasCareerVerticalCode
): McasDistributionItem<McasCareerVerticalCode> | undefined {
  const currentLevel = Number(primaryCode.replace("V", ""));

  if (!Number.isFinite(currentLevel) || currentLevel >= 6) {
    return undefined;
  }

  const nextCode = `V${currentLevel + 1}` as McasCareerVerticalCode;

  return distribution.find((item) => item.code === nextCode);
}

function normaliseFlags(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();

        if (isRecord(item)) {
          return (
            cleanString(item.label) ??
            cleanString(item.title) ??
            cleanString(item.code) ??
            null
          );
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key);
  }

  return [];
}

function confidenceLevelFromScore(score: number) {
  if (score >= 75) return "high" as const;
  if (score >= 45) return "moderate" as const;
  return "low" as const;
}

function normaliseConfidenceLevel(level: string | null, score?: number) {
  const normalised = level?.toLowerCase();

  if (normalised === "high") return "high" as const;
  if (
    normalised === "moderate" ||
    normalised === "medium" ||
    normalised === "matched" ||
    normalised === "distribution_based"
  ) {
    return "moderate" as const;
  }
  if (normalised === "low") return "low" as const;

  if (typeof score === "number") return confidenceLevelFromScore(score);

  return "moderate" as const;
}

function normaliseConfidence(value: unknown) {
  if (!value) {
    return {
      level: "moderate" as const,
      score: undefined,
      notes: ["Confidence could not be determined from the saved result."],
    };
  }

  if (typeof value === "number" || typeof value === "string") {
    const score = normalisePercentage(value);

    return {
      level: confidenceLevelFromScore(score),
      score,
      notes: [],
    };
  }

  if (isRecord(value)) {
    const scoreValue =
      value.score ??
      value.percentage ??
      value.confidence ??
      value.confidence_score ??
      value.overall;

    const score =
      scoreValue === undefined ? undefined : normalisePercentage(scoreValue);

    const level =
      cleanString(value.level) ??
      cleanString(value.band) ??
      cleanString(value.rating) ??
      cleanString(value.confidence_level);

    const notesValue = value.notes ?? value.reasons ?? value.messages;

    const notes = Array.isArray(notesValue)
      ? notesValue
          .map((note) => (typeof note === "string" ? note.trim() : null))
          .filter((note): note is string => Boolean(note))
      : [];

    return {
      level: normaliseConfidenceLevel(level, score),
      score,
      notes,
    };
  }

  return {
    level: "moderate" as const,
    score: undefined,
    notes: [],
  };
}

function getVerticalReadinessLabel(
  verticalReadiness: unknown,
  primaryCode: McasCareerVerticalCode
): string {
  if (isRecord(verticalReadiness)) {
    return (
      cleanString(verticalReadiness.readinessLabel) ??
      cleanString(verticalReadiness.readiness_label) ??
      cleanString(verticalReadiness.label) ??
      `${primaryCode} fit indicated`
    );
  }

  return `${primaryCode} fit indicated`;
}

function getVerticalReadinessPercentage(
  verticalReadiness: unknown,
  confidence: unknown
): number | undefined {
  if (isRecord(verticalReadiness)) {
    const value =
      verticalReadiness.readinessPercentage ??
      verticalReadiness.readiness_percentage ??
      verticalReadiness.next_readiness ??
      verticalReadiness.nextReadiness;

    if (value !== undefined) return normalisePercentage(value);
  }

  if (isRecord(confidence) && isRecord(confidence.signals)) {
    const value =
      confidence.signals.vertical_readiness_score ??
      confidence.signals.vertical_readiness_percentage;

    if (value !== undefined) return normalisePercentage(value);
  }

  return undefined;
}

function getMetaCandidateValue(meta: unknown, key: string): string | null {
  if (!isRecord(meta) || !isRecord(meta.candidate)) return null;
  return cleanString(meta.candidate[key]);
}

async function fetchAssessmentByReportToken(
  reportToken: string
): Promise<AssessmentRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
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

  if (error) {
    throw new Error(
      `Unable to load MCAS assessment by report token: ${error.message}`
    );
  }

  return data as AssessmentRow | null;
}

async function fetchAssessmentById(
  assessmentId: string
): Promise<AssessmentRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
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

  if (error) {
    throw new Error(`Unable to load MCAS assessment by id: ${error.message}`);
  }

  return data as AssessmentRow | null;
}

async function fetchLatestAssessmentByPartnerApplicationId(
  partnerApplicationId: string
): Promise<AssessmentRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
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
    .eq("partner_application_id", partnerApplicationId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load MCAS assessment by partner application id: ${error.message}`
    );
  }

  return data as AssessmentRow | null;
}

async function fetchTestLink(testLinkId: string | null): Promise<TestLinkRow | null> {
  if (!testLinkId) return null;

  const supa = mcasSupa();

  const { data, error } = await supa
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

  if (error) {
    throw new Error(`Unable to load MCAS test link: ${error.message}`);
  }

  return data as TestLinkRow | null;
}

async function fetchPartnerApplication(
  partnerApplicationId: string | null
): Promise<PartnerApplicationRow | null> {
  if (!partnerApplicationId) return null;

  const supa = mcasSupa();

  const { data, error } = await supa
    .from("partner_applications")
    .select(
      [
        "id",
        "org_id",
        "partner_key",
        "application_id",
        "status",
        "candidate_first_name",
        "candidate_last_name",
        "candidate_email",
        "candidate_phone",
      ].join(", ")
    )
    .eq("id", partnerApplicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load MCAS partner application: ${error.message}`);
  }

  return data as PartnerApplicationRow | null;
}

async function fetchIndividual(
  individualId: string | null
): Promise<IndividualRow | null> {
  if (!individualId) return null;

  const supa = mcasSupa();

  const { data, error } = await supa
    .from("individuals")
    .select("id, org_id, external_ref, email, first_name, last_name")
    .eq("id", individualId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load MCAS individual: ${error.message}`);
  }

  return data as IndividualRow | null;
}

async function fetchResultForAssessment(
  assessmentId: string
): Promise<ResultRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
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

  if (error) {
    throw new Error(`Unable to load MCAS result: ${error.message}`);
  }

  return data as ResultRow | null;
}

type CandidateContentContext = {
  primaryCode: McasOperatingStyleCode;
  secondaryCode?: McasOperatingStyleCode;
  strongestCore: McasDistributionItem<McasCoreCode>;
  secondCore?: McasDistributionItem<McasCoreCode>;
  weakestCore: McasDistributionItem<McasCoreCode>;
  primaryVertical: McasDistributionItem<McasCareerVerticalCode>;
  nextVertical?: McasDistributionItem<McasCareerVerticalCode>;
  readinessPercentage?: number;
};

function getOperatingStyleStrengths(
  code: McasOperatingStyleCode
): McasStrength[] {
  const map: Record<McasOperatingStyleCode, McasStrength[]> = {
    OS1: [
      {
        title: "Direction creation",
        description:
          "You see emerging possibilities early and turn uncertainty into a direction people can begin to act on.",
      },
      {
        title: "Opportunity sensing",
        description:
          "You notice openings, future value, and strategic movement before they are obvious to everyone else.",
      },
      {
        title: "Strategic framing",
        description:
          "You help people understand why a new direction matters and what the larger opportunity could become.",
      },
      {
        title: "Decisive initiation",
        description:
          "You are willing to move first, test an idea, and create the initial momentum that turns possibility into work.",
      },
    ],
    OS2: [
      {
        title: "Momentum creation",
        description:
          "You create visible energy around priorities and help people move from discussion into action.",
      },
      {
        title: "Influence and buy-in",
        description:
          "You communicate with urgency and conviction, making it easier for others to engage with a direction.",
      },
      {
        title: "Rapid activation",
        description:
          "You shorten the distance between an idea and its first practical action, especially when progress has stalled.",
      },
      {
        title: "Change energy",
        description:
          "You help teams find movement during uncertainty by making the next step feel immediate and achievable.",
      },
    ],
    OS3: [
      {
        title: "People engagement",
        description:
          "You understand what helps people feel involved, valued, and willing to contribute consistently.",
      },
      {
        title: "Morale stabilisation",
        description:
          "You bring encouragement and human awareness when pressure, change, or uncertainty begins to affect the team.",
      },
      {
        title: "Supportive influence",
        description:
          "You build commitment through trust and encouragement rather than relying only on authority or instruction.",
      },
      {
        title: "Team resilience",
        description:
          "You help people recover, reconnect, and maintain effort when the work becomes demanding.",
      },
    ],
    OS4: [
      {
        title: "Cross-team alignment",
        description:
          "You create shared understanding across people and teams, reducing duplication, confusion, and conflicting priorities.",
      },
      {
        title: "Communication clarity",
        description:
          "You translate complex information into clear, usable direction for different stakeholders.",
      },
      {
        title: "Relationship bridging",
        description:
          "You connect the people and groups who need to collaborate, reducing silos and improving the flow of work.",
      },
      {
        title: "Dependency visibility",
        description:
          "You make interdependencies visible early, helping teams prevent delays, duplicated effort, and missed handoffs.",
      },
    ],
    OS5: [
      {
        title: "Reliable delivery",
        description:
          "You protect progress by keeping commitments visible and making sure important work reaches completion.",
      },
      {
        title: "Practical problem resolution",
        description:
          "You bring attention back to what must be solved, completed, or stabilised so work can continue.",
      },
      {
        title: "Steady execution",
        description:
          "You create confidence through consistency, especially when other people become distracted or priorities shift.",
      },
      {
        title: "Operational calm",
        description:
          "You remain grounded under pressure and help the team keep moving through practical, manageable actions.",
      },
    ],
    OS6: [
      {
        title: "Structure creation",
        description:
          "You turn complex work into organised steps, ownership, sequencing, and repeatable operating rhythm.",
      },
      {
        title: "Process visibility",
        description:
          "You make the path of work easier to understand, reducing ambiguity about what happens next and who owns it.",
      },
      {
        title: "Resource coordination",
        description:
          "You align time, people, information, and dependencies so work can progress in the right order.",
      },
      {
        title: "Repeatability",
        description:
          "You build methods that reduce reliance on memory, improvisation, and individual heroics.",
      },
    ],
    OS7: [
      {
        title: "Evidence-based judgement",
        description:
          "You improve decisions by testing assumptions, checking facts, and separating evidence from enthusiasm.",
      },
      {
        title: "Risk visibility",
        description:
          "You notice weaknesses, exposure, and quality concerns before they become expensive or difficult to reverse.",
      },
      {
        title: "Quality protection",
        description:
          "You create confidence by holding work against clear standards and identifying what still needs validation.",
      },
      {
        title: "Analytical depth",
        description:
          "You investigate beyond the obvious answer and help teams understand the real cause, implication, or trade-off.",
      },
    ],
    OS8: [
      {
        title: "Continuous improvement",
        description:
          "You identify practical opportunities to refine work over time, helping systems evolve rather than stagnate.",
      },
      {
        title: "Efficiency optimisation",
        description:
          "You notice wasted effort, repeated steps, and workflow friction that can be removed without lowering standards.",
      },
      {
        title: "Quality enhancement",
        description:
          "You spot weak points in outputs and processes, then improve the standard of delivery deliberately.",
      },
      {
        title: "Controlled change",
        description:
          "You improve the way work is done while protecting stability, consistency, and the team’s ability to keep delivering.",
      },
    ],
  };

  return map[code];
}

function getCoreStrength(
  item: McasDistributionItem<McasCoreCode>
): McasStrength {
  const map: Record<McasCoreCode, McasStrength> = {
    CREATE: {
      title: "Create advantage",
      description:
        "Your Create coverage helps you introduce new direction, alternatives, and forward movement when the work needs fresh thinking.",
    },
    ORGANISE: {
      title: "Organise advantage",
      description:
        "Your Organise coverage helps you align people, expectations, ownership, and dependencies around the work.",
    },
    RESOLVE: {
      title: "Resolve advantage",
      description:
        "Your Resolve coverage supports completion, consistency, practical problem-solving, and dependable follow-through.",
    },
    EXAMINE: {
      title: "Examine advantage",
      description:
        "Your Examine coverage strengthens evidence, quality, risk awareness, learning, and responsible judgement.",
    },
  };

  const strength = map[item.code];

  return {
    title: strength.title,
    description: `${strength.description} At ${item.percentage}%, this is a meaningful part of how you create value.`,
  };
}

function getStrengths(context: CandidateContentContext): McasStrength[] {
  const coreStrengths = [context.strongestCore, context.secondCore]
    .filter(
      (item): item is McasDistributionItem<McasCoreCode> => Boolean(item)
    )
    .map(getCoreStrength);

  return [
    ...getOperatingStyleStrengths(context.primaryCode),
    ...coreStrengths,
  ].slice(0, 6);
}

function getEnvironmentFit(code: McasOperatingStyleCode): McasEnvironmentFit {
  const map: Record<McasOperatingStyleCode, McasEnvironmentFit> = {
    OS1: {
      pace: "Fast — opportunity-led movement with room to test.",
      autonomy: "High — you perform best when trusted to initiate.",
      structure:
        "Flexible — enough direction to focus, not enough to restrict movement.",
      workStyle: "Entrepreneurial — growth, innovation, and new direction.",
    },
    OS2: {
      pace: "Fast — visible momentum and active engagement.",
      autonomy: "Moderate to high — room to activate people and ideas.",
      structure:
        "Light to semi-structured — clear goals with energetic movement.",
      workStyle: "Influence-led — communication, activation, and buy-in.",
    },
    OS3: {
      pace: "Moderate — sustainable progress with people connection.",
      autonomy: "Moderate — trusted ownership with relational awareness.",
      structure: "Supportive — clear expectations and healthy team rhythms.",
      workStyle: "Human-centred — engagement, support, and team commitment.",
    },
    OS4: {
      pace:
        "Moderate to fast — structured momentum with room for relationship-building.",
      autonomy:
        "High — you perform best when trusted to own relationships, coordination, and process.",
      structure:
        "Semi-structured — clear goals with flexibility in how alignment is created.",
      workStyle:
        "Collaborative — cross-functional, multi-stakeholder, purpose-aligned teams.",
    },
    OS5: {
      pace: "Steady — consistent delivery with clear priorities.",
      autonomy: "Moderate — ownership works best when expectations are clear.",
      structure: "Clear — stable systems, defined outputs, and dependable rhythm.",
      workStyle: "Delivery-led — practical execution and reliable completion.",
    },
    OS6: {
      pace: "Structured — organised movement with clear sequencing.",
      autonomy: "Moderate to high — best when trusted to build process.",
      structure: "High — clear frameworks, repeatability, and operational rhythm.",
      workStyle: "System-building — process, coordination, and scalable execution.",
    },
    OS7: {
      pace: "Measured — enough time to validate, review, and protect quality.",
      autonomy: "High — best when trusted for judgement and rigour.",
      structure: "Clear — evidence, standards, and decision criteria matter.",
      workStyle:
        "Analytical — quality, risk, validation, and responsible judgement.",
    },
    OS8: {
      pace: "Focused — improvement cycles with room to refine.",
      autonomy: "Moderate to high — best when trusted to improve the work.",
      structure: "Defined but adaptable — standards with room for iteration.",
      workStyle:
        "Improvement-led — optimisation, refinement, and quality elevation.",
    },
  };

  return map[code];
}

function getRoleRecommendations(
  code: McasOperatingStyleCode
): McasRoleRecommendation[] {
  const map: Record<McasOperatingStyleCode, McasRoleRecommendation[]> = {
    OS1: [
      {
        category: "Growth & Innovation",
        title: "Innovation Lead",
        description: "New direction, opportunity testing, and strategic movement.",
      },
      {
        category: "Strategy",
        title: "Venture Builder",
        description: "New initiatives, experimentation, and future-facing work.",
      },
      {
        category: "Commercial",
        title: "Business Development Director",
        description: "Market openings, partnerships, and opportunity creation.",
      },
      {
        category: "Product",
        title: "Product Strategy Lead",
        description: "Future product direction, market relevance, and strategic choices.",
      },
      {
        category: "Transformation",
        title: "Transformation Sponsor",
        description: "Creates direction and senior momentum for meaningful change.",
      },
      {
        category: "Corporate Strategy",
        title: "Strategy Director",
        description: "Long-range choices, strategic positioning, and growth priorities.",
      },
    ],
    OS2: [
      {
        category: "Sales & Growth",
        title: "Growth Manager",
        description: "Activation, visibility, traction, and commercial momentum.",
      },
      {
        category: "Marketing",
        title: "Campaign Lead",
        description: "Audience energy, communication, and rapid market engagement.",
      },
      {
        category: "Change",
        title: "Change Activation Lead",
        description: "Mobilises people around a new direction and immediate action.",
      },
      {
        category: "Commercial",
        title: "Sales Enablement Lead",
        description: "Builds energy, confidence, and practical movement across sales teams.",
      },
      {
        category: "Partnerships",
        title: "Partnerships Lead",
        description: "Creates external momentum, visibility, and collaborative opportunity.",
      },
      {
        category: "Community",
        title: "Community Growth Lead",
        description: "Activates participation, engagement, and visible contribution.",
      },
    ],
    OS3: [
      {
        category: "People & Culture",
        title: "Employee Experience Lead",
        description: "Engagement, morale, belonging, and human sustainability.",
      },
      {
        category: "Leadership",
        title: "People Manager",
        description: "Team support, trust, development, and sustained commitment.",
      },
      {
        category: "Learning",
        title: "Learning & Development Lead",
        description: "Growth, confidence, capability, and supportive learning environments.",
      },
      {
        category: "Customer",
        title: "Customer Experience Lead",
        description: "Human-centred service, relationship quality, and customer trust.",
      },
      {
        category: "Change",
        title: "Change Engagement Lead",
        description: "Supports people through transition, uncertainty, and adoption.",
      },
      {
        category: "Community",
        title: "Community Director",
        description: "Builds belonging, participation, and long-term relational value.",
      },
    ],
    OS4: [
      {
        category: "Programme Management",
        title: "Programme Lead",
        description:
          "Cross-functional delivery, stakeholder coordination, and dependency management.",
      },
      {
        category: "People & Culture",
        title: "People Partner",
        description:
          "Connects organisational priorities, talent needs, and leadership decisions.",
      },
      {
        category: "Strategy & Operations",
        title: "Chief of Staff",
        description:
          "Executive alignment, decision flow, and cross-functional follow-through.",
      },
      {
        category: "Customer Success",
        title: "Customer Success Director",
        description:
          "Relationship-led retention, internal alignment, and growth ownership.",
      },
      {
        category: "Communications",
        title: "Communications Lead",
        description:
          "Narrative clarity, stakeholder understanding, and internal alignment.",
      },
      {
        category: "Consulting",
        title: "Senior Consultant",
        description:
          "Client alignment, complex stakeholder work, and delivery ownership.",
      },
    ],
    OS5: [
      {
        category: "Operations",
        title: "Operations Lead",
        description: "Reliable delivery, consistency, and practical execution.",
      },
      {
        category: "Service Delivery",
        title: "Delivery Manager",
        description: "Output ownership, follow-through, and delivery rhythm.",
      },
      {
        category: "Customer Operations",
        title: "Client Delivery Lead",
        description: "Dependable execution, service continuity, and issue resolution.",
      },
      {
        category: "Projects",
        title: "Project Delivery Lead",
        description: "Milestones, practical problem-solving, and completion discipline.",
      },
      {
        category: "Implementation",
        title: "Implementation Manager",
        description: "Turns plans into stable delivery and successful adoption.",
      },
      {
        category: "Business Continuity",
        title: "Business Continuity Lead",
        description: "Protects essential delivery through disruption and pressure.",
      },
    ],
    OS6: [
      {
        category: "Operations",
        title: "Operations Manager",
        description: "Process, structure, and repeatable delivery.",
      },
      {
        category: "Project Management",
        title: "PMO Lead",
        description: "Coordination, governance, sequencing, and execution systems.",
      },
      {
        category: "Business Systems",
        title: "Business Systems Manager",
        description: "Workflow design, information flow, and scalable operations.",
      },
      {
        category: "Planning",
        title: "Resource Planning Lead",
        description: "Capacity, timing, dependencies, and structured allocation.",
      },
      {
        category: "Process",
        title: "Process Design Lead",
        description: "Clear operating methods, ownership, and repeatability.",
      },
      {
        category: "Governance",
        title: "Portfolio Coordinator",
        description: "Portfolio visibility, prioritisation, and structured decision support.",
      },
    ],
    OS7: [
      {
        category: "Risk & Quality",
        title: "Quality Assurance Lead",
        description: "Evidence, standards, validation, and review.",
      },
      {
        category: "Analysis",
        title: "Senior Business Analyst",
        description: "Analytical review, data-led decisions, and judgement.",
      },
      {
        category: "Governance",
        title: "Risk Manager",
        description: "Control, risk visibility, and responsible decision support.",
      },
      {
        category: "Audit",
        title: "Internal Audit Lead",
        description: "Independent review, control effectiveness, and assurance.",
      },
      {
        category: "Data",
        title: "Insights Lead",
        description: "Evidence interpretation, decision intelligence, and performance insight.",
      },
      {
        category: "Compliance",
        title: "Compliance Director",
        description: "Standards, accountability, and defensible organisational practice.",
      },
    ],
    OS8: [
      {
        category: "Improvement",
        title: "Continuous Improvement Lead",
        description:
          "Leads targeted refinement that improves quality, efficiency, and performance over time.",
      },
      {
        category: "Process Excellence",
        title: "Process Excellence Lead",
        description:
          "Removes workflow friction and strengthens operational consistency.",
      },
      {
        category: "Quality",
        title: "Quality Improvement Lead",
        description:
          "Builds standards, feedback loops, and improvement practices that raise delivery quality.",
      },
      {
        category: "Operations",
        title: "Operational Excellence Manager",
        description:
          "Improves measurable performance while protecting reliable day-to-day delivery.",
      },
      {
        category: "Product",
        title: "Product Optimisation Lead",
        description:
          "Uses evidence and feedback to refine product and customer outcomes.",
      },
      {
        category: "Service Improvement",
        title: "Service Improvement Lead",
        description:
          "Converts recurring service friction into sustainable improvement.",
      },
    ],
  };

  return map[code];
}

function getOperatingStyleBlindSpots(
  code: McasOperatingStyleCode
): McasBlindSpot[] {
  const map: Record<McasOperatingStyleCode, McasBlindSpot[]> = {
    OS1: [
      {
        title: "Idea proliferation",
        description:
          "Your ability to see possibilities can create too many competing directions, leaving the team uncertain about what matters most.",
        managementStrategy:
          "Translate opportunity into one stated priority, one owner, and one measurable outcome before opening another direction.",
      },
      {
        title: "Execution handoff gap",
        description:
          "You may move mentally to the next opportunity before the current direction has enough structure, ownership, or follow-through.",
        managementStrategy:
          "Use a formal handoff: define the decision, success measure, owner, dependencies, and review point before stepping away.",
      },
    ],
    OS2: [
      {
        title: "Pace pressure",
        description:
          "Your urgency can create movement, but it can also make slower stakeholders feel rushed, unheard, or unable to keep up.",
        managementStrategy:
          "Separate urgency from pressure. State the deadline and decision clearly, then make space for the minimum input needed.",
      },
      {
        title: "Novelty bias",
        description:
          "Visible momentum can feel more valuable than patient consolidation, causing you to shift focus before gains become sustainable.",
        managementStrategy:
          "Set a stability threshold before changing direction: define what must be embedded, measured, or completed first.",
      },
    ],
    OS3: [
      {
        title: "Performance discomfort",
        description:
          "Your care for people can make firm accountability conversations feel harsher than they are, delaying necessary correction.",
        managementStrategy:
          "Frame clear feedback as support: name the expectation, evidence, impact, and specific change required.",
      },
      {
        title: "Emotional overextension",
        description:
          "You may absorb the energy, concerns, or wellbeing of the team until your own capacity and objectivity begin to reduce.",
        managementStrategy:
          "Define what support you can provide, what the individual owns, and when an issue needs formal escalation or specialist help.",
      },
    ],
    OS4: [
      {
        title: "Authority understatement",
        description:
          "You may delay taking a clear directional position when alignment is incomplete, which can read as indecision in high-stakes moments.",
        managementStrategy:
          'State your recommendation before inviting input: "My recommendation is X — here is why, and here is the decision needed."',
      },
      {
        title: "Coordination replacing action",
        description:
          "Too much time spent aligning people can slow decisions and make the system dependent on you as the central bridge.",
        managementStrategy:
          "Build clear decision rights, handoffs, forums, and escalation paths so work can move without constant intervention.",
      },
    ],
    OS5: [
      {
        title: "Invisible workload absorption",
        description:
          "Your reliability can attract more delivery work than is sustainable, especially when other people assume you will quietly resolve the gap.",
        managementStrategy:
          "Make capacity visible early. Name the trade-off, impact, and decision required before taking on additional scope.",
      },
      {
        title: "Under-challenging direction",
        description:
          "A strong focus on getting work completed can keep you executing a weak or outdated direction for too long.",
        managementStrategy:
          "Add a regular question before delivery: is this still the right outcome, or are we only continuing because the work has already started?",
      },
    ],
    OS6: [
      {
        title: "Process over purpose",
        description:
          "A well-organised process can become the goal, even when the business outcome has changed or the structure no longer adds value.",
        managementStrategy:
          "Connect every major process to an outcome, owner, and measure. Remove steps that no longer protect value.",
      },
      {
        title: "Rigidity under change",
        description:
          "Unexpected movement can trigger additional control or planning when the situation actually requires adaptation and judgement.",
        managementStrategy:
          "Define which parts of the process are fixed and which are deliberately flexible. Review the structure after significant change.",
      },
    ],
    OS7: [
      {
        title: "Analysis delay",
        description:
          "Your need for evidence can extend the decision cycle beyond the point where more information will materially improve the choice.",
        managementStrategy:
          "Set an evidence threshold and decision deadline. Distinguish information that could change the decision from information that is merely interesting.",
      },
      {
        title: "Risk-first communication",
        description:
          "Leading with what could fail can reduce confidence or innovation before people understand the opportunity you are trying to protect.",
        managementStrategy:
          "Present the opportunity, the relevant risk, and the practical safeguard together rather than communicating risk in isolation.",
      },
    ],
    OS8: [
      {
        title: "Perfection drag",
        description:
          "Your improvement instinct can slow momentum when good enough would create value faster.",
        managementStrategy:
          "Separate refinement work from release work. Decide what must be excellent now and what can improve after feedback.",
      },
      {
        title: "Local optimisation trap",
        description:
          "You may improve one part of a system without checking whether that change creates friction, delay, or cost elsewhere.",
        managementStrategy:
          "Review upstream and downstream effects before changing a process. Define the system-level outcome, not only the local improvement.",
      },
    ],
  };

  return map[code];
}

function getCoreGapBlindSpot(
  item: McasDistributionItem<McasCoreCode>
): McasBlindSpot {
  const map: Record<McasCoreCode, McasBlindSpot> = {
    CREATE: {
      title: "Create coverage gap",
      description:
        "When new direction is needed, you may default too quickly to improving or executing what already exists instead of generating alternatives.",
      managementStrategy:
        "Build a short option-creation step into important work: ask what else is possible, what assumption can be challenged, and who brings strong Create coverage.",
    },
    ORGANISE: {
      title: "Organise coverage gap",
      description:
        "Ownership, dependencies, timing, or communication may remain implicit, creating avoidable confusion around otherwise strong work.",
      managementStrategy:
        "Use a simple operating map for important work: accountable owner, contributors, dependencies, due date, and escalation route.",
    },
    RESOLVE: {
      title: "Resolve coverage gap",
      description:
        "Work may begin strongly but lose consistency, closure, or practical follow-through when the final delivery phase requires sustained attention.",
      managementStrategy:
        "Define completion criteria at the start and use visible checkpoints until the outcome is fully delivered, adopted, and closed.",
    },
    EXAMINE: {
      title: "Analytical coverage gap",
      description:
        "Evidence review, quality assurance, risk testing, or deeper analysis may receive less attention than direction and movement.",
      managementStrategy:
        "Add structured review checkpoints and partner deliberately with strong Examine contributors for high-risk or high-impact decisions.",
    },
  };

  const blindSpot = map[item.code];

  return {
    ...blindSpot,
    description: `${blindSpot.description} Your ${item.label} result is ${item.percentage}%, making this a conscious development area rather than an automatic contribution.`,
  };
}

function getVerticalBlindSpot(
  vertical: McasDistributionItem<McasCareerVerticalCode>
): McasBlindSpot {
  const map: Record<McasCareerVerticalCode, McasBlindSpot> = {
    V1: {
      title: "Responsibility confidence",
      description:
        "At foundational scope, strong potential can be limited by waiting for instruction instead of making small ownership decisions independently.",
      managementStrategy:
        "Clarify your decision boundary, then practise owning one complete outcome from instruction through completion and review.",
    },
    V2: {
      title: "Inconsistent ownership",
      description:
        "Developing scope can create periods of strong ownership followed by reliance on guidance when the work becomes ambiguous.",
      managementStrategy:
        "Use a weekly ownership rhythm: priority, decision, risk, dependency, and next action. Escalate with a recommendation, not only a problem.",
    },
    V3: {
      title: "Scope boundary management",
      description:
        "Established contributors often absorb cross-team complexity without making the growing scope, trade-offs, or capacity risk visible early enough.",
      managementStrategy:
        "Review scope weekly. Name what has expanded, what must move, and which decision or support is required before overload affects delivery.",
    },
    V4: {
      title: "Strategic narrative gap",
      description:
        "Senior-scope work requires more than strong execution; others must understand the direction, trade-offs, and organisational value of your decisions.",
      managementStrategy:
        "Practise a concise strategic narrative: context, recommendation, business value, trade-off, risk, and decision required.",
    },
    V5: {
      title: "Enterprise leverage gap",
      description:
        "Strategic leadership becomes constrained when too much value still depends on your direct involvement rather than systems, leaders, and distributed judgement.",
      managementStrategy:
        "Identify decisions and relationships that must no longer depend on you. Build leadership ownership, governance, and clear decision principles.",
    },
    V6: {
      title: "Long-horizon renewal",
      description:
        "Enterprise leaders can become over-identified with the current model, even when future relevance requires renewal beyond existing structures and assumptions.",
      managementStrategy:
        "Create protected long-horizon review: external change, strategic assumptions, future capability, succession, and enterprise renewal.",
    },
  };

  return map[vertical.code];
}

function getBlindSpots(context: CandidateContentContext): McasBlindSpot[] {
  return [
    ...getOperatingStyleBlindSpots(context.primaryCode),
    getCoreGapBlindSpot(context.weakestCore),
    getVerticalBlindSpot(context.primaryVertical),
  ].slice(0, 4);
}

function getOperatingStyleNarrative(context: CandidateContentContext): string {
  const primaryLabel = getOperatingStyleDisplayLabel(context.primaryCode);
  const secondaryLabel = context.secondaryCode
    ? getOperatingStyleDisplayLabel(context.secondaryCode)
    : null;
  const secondarySentence = secondaryLabel
    ? ` Your secondary ${secondaryLabel} pattern adds a supporting contribution that becomes especially useful when the situation needs a wider response.`
    : "";

  const patternNarratives: Record<McasOperatingStyleCode, string> = {
    OS1: "You create value by seeing direction early, framing possibility, and moving work toward a future that does not yet fully exist.",
    OS2: "You create value by activating movement, building visible momentum, and helping people engage with a direction quickly.",
    OS3: "You create value by strengthening commitment, morale, and human sustainability so people can continue contributing under pressure.",
    OS4: "You create value by connecting people, priorities, communication, and dependencies so complex work can move without fragmentation.",
    OS5: "You create value by protecting delivery, resolving practical obstacles, and creating confidence that important work will be completed.",
    OS6: "You create value by turning complexity into structure, sequencing, ownership, and repeatable operating rhythm.",
    OS7: "You create value by testing evidence, protecting quality, identifying risk, and improving the reliability of important judgement.",
    OS8: "You create value by refining established systems, removing friction, and improving quality or efficiency in controlled, sustainable ways.",
  };

  return `${patternNarratives[context.primaryCode]} Your strongest CORE area is ${context.strongestCore.label} at ${context.strongestCore.percentage}%, while ${context.weakestCore.label} at ${context.weakestCore.percentage}% is the part of the work cycle that will need the most deliberate structure or partnership. At ${context.primaryVertical.code} ${context.primaryVertical.label}, your pattern needs to operate with the scope, judgement, and accountability expected at that level.${secondarySentence}`;
}

function getWorkPatternSummary(context: CandidateContentContext): string {
  const primaryLabel = getOperatingStyleDisplayLabel(context.primaryCode);
  const contribution = MCAS_OPERATING_STYLE_LABELS[
    context.primaryCode
  ].workCycleStage.toLowerCase();
  const nextStage = context.nextVertical
    ? `${context.nextVertical.code} ${context.nextVertical.label}`
    : "the next level of sustainable responsibility";

  return `Your strongest Operating Style is ${primaryLabel}, so your work energy is most naturally expressed through ${contribution}. Your CORE balance is led by ${context.strongestCore.label}, while ${context.weakestCore.label} is the area least likely to happen automatically. Your current Career Vertical is ${context.primaryVertical.code} ${context.primaryVertical.label}. This combination explains both where you create value now and what must become more deliberate as you prepare for ${nextStage}.`;
}

function getSuccessGuide(
  context: CandidateContentContext
): McasSuccessGuideItem[] {
  const primaryLabel = getOperatingStyleDisplayLabel(context.primaryCode);
  const nextStage = context.nextVertical
    ? `${context.nextVertical.code} ${context.nextVertical.label}`
    : "your next stage";

  const firstStep: Record<McasOperatingStyleCode, string> = {
    OS1: "Choose the one direction where your opportunity sensing can create the greatest value, and define the outcome before opening further possibilities.",
    OS2: "Identify where momentum is genuinely needed and where pace could create pressure, confusion, or shallow adoption.",
    OS3: "Map the people, expectations, and emotional pressure in your environment without taking responsibility for every concern yourself.",
    OS4: "Map the most important stakeholders, decisions, dependencies, and communication gaps. Notice where coordination is replacing clear ownership.",
    OS5: "Map the delivery commitments, recurring obstacles, and invisible workload you are carrying. Clarify which outcomes you truly own.",
    OS6: "Map the current workflow, ownership, dependencies, and exceptions. Identify which structure adds value and which only adds effort.",
    OS7: "Clarify the decisions that genuinely require deeper evidence and define the threshold at which analysis must turn into action.",
    OS8: "Identify the few improvements that would materially change quality, efficiency, or performance rather than refining everything that could be better.",
  };

  const secondStep: Record<McasCoreCode, string> = {
    CREATE: "Introduce an option-generation checkpoint and involve strong Create contributors before important direction choices are closed.",
    ORGANISE: "Build a visible ownership and dependency structure so people know the decision, owner, handoff, date, and escalation route.",
    RESOLVE: "Define completion criteria and install practical follow-through checkpoints that protect closure, consistency, and adoption.",
    EXAMINE: "Add review, evidence, and quality checkpoints or partner with strong Examine contributors where the risk or consequence is meaningful.",
  };

  return [
    {
      period: "days_1_30",
      title: "Clarify your operating context",
      description: `${firstStep[context.primaryCode]} Confirm what ${context.primaryVertical.code} ${context.primaryVertical.label} accountability requires from you now.`,
    },
    {
      period: "days_31_60",
      title: `Strengthen ${context.weakestCore.label} coverage`,
      description: secondStep[context.weakestCore.code],
    },
    {
      period: "days_61_90",
      title: `Demonstrate ${nextStage} readiness`,
      description: `Use your ${primaryLabel} contribution deliberately at broader scope. Make one visible decision, system, or leadership practice repeatable so your value no longer depends only on personal effort.`,
    },
  ];
}

function getNextStepPathway(context: CandidateContentContext): {
  current: string;
  next: string;
  future: string;
  developmentFocus: string[];
} {
  const primaryLabel = getOperatingStyleDisplayLabel(context.primaryCode);
  const next = context.nextVertical;

  const operatingDevelopment: Record<McasOperatingStyleCode, string> = {
    OS1: "Strategic focus — convert possibility into a limited number of explicit choices, ownership, and measurable outcomes.",
    OS2: "Sustainable activation — create movement without allowing urgency, novelty, or personal energy to become the operating system.",
    OS3: "Caring accountability — combine trust and support with firm expectations, feedback, boundaries, and performance decisions.",
    OS4: "Decisive alignment — state recommendations earlier and build coordination systems that do not depend on you as the permanent bridge.",
    OS5: "Scalable delivery — protect completion without absorbing every operational gap or carrying unsustainable invisible workload.",
    OS6: "Adaptive structure — build repeatability while keeping process connected to purpose, judgement, and changing business needs.",
    OS7: "Timely judgement — preserve evidence and quality while setting clear thresholds for decision, experimentation, and action.",
    OS8: "System-level improvement — prioritise high-impact refinement and show measurable value across the whole system, not only one part.",
  };

  const coreDevelopment: Record<McasCoreCode, string> = {
    CREATE: "Create coverage — generate alternatives and future options before committing only to the existing path.",
    ORGANISE: "Organise coverage — make ownership, dependencies, timing, and communication explicit.",
    RESOLVE: "Resolve coverage — strengthen completion discipline, consistency, practical closure, and adoption.",
    EXAMINE: "Examine coverage — add evidence, risk, review, and quality protection to important work.",
  };

  const verticalDevelopment: Record<McasCareerVerticalCode, string> = {
    V1: "Ownership confidence — complete small outcomes independently and escalate with a recommendation.",
    V2: "Consistency — stabilise ownership, routines, and decisions when the work becomes less defined.",
    V3: "Scope management — make cross-team complexity, trade-offs, and capacity visible before overload affects delivery.",
    V4: "Strategic narrative — communicate business value, direction, trade-offs, and decisions at senior scope.",
    V5: "Enterprise leverage — distribute judgement through leaders, systems, governance, and decision principles.",
    V6: "Enterprise renewal — protect long-horizon relevance, succession, strategic assumptions, and future capability.",
  };

  return {
    current: `${context.primaryVertical.code} ${context.primaryVertical.label} — current fit`,
    next: next
      ? `${next.code} ${next.label} — next-stage responsibility`
      : "Sustain enterprise contribution at your current level",
    future: next
      ? `Build beyond ${next.code} through wider scope, complexity, and accountability`
      : "Create enterprise renewal and leadership continuity",
    developmentFocus: [
      operatingDevelopment[context.primaryCode],
      coreDevelopment[context.weakestCore.code],
      verticalDevelopment[context.primaryVertical.code],
    ],
  };
}

function getCandidateFacingContent(context: CandidateContentContext): {
  workPatternSummary: string;
  operatingStyleNarrative: string;
  strengths: McasStrength[];
  environmentFit: McasEnvironmentFit;
  roleRecommendations: McasRoleRecommendation[];
  blindSpots: McasBlindSpot[];
  successGuide: McasSuccessGuideItem[];
  nextStepPathway: {
    current: string;
    next: string;
    future: string;
    developmentFocus: string[];
  };
} {
  return {
    workPatternSummary: getWorkPatternSummary(context),
    operatingStyleNarrative: getOperatingStyleNarrative(context),
    strengths: getStrengths(context),
    environmentFit: getEnvironmentFit(context.primaryCode),
    roleRecommendations: getRoleRecommendations(context.primaryCode),
    blindSpots: getBlindSpots(context),
    successGuide: getSuccessGuide(context),
    nextStepPathway: getNextStepPathway(context),
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

  let assessment: AssessmentRow | null = null;

  if (typeof args.token === "string") {
    assessment = await fetchAssessmentByReportToken(args.token);
  } else if (typeof args.assessmentId === "string") {
    assessment = await fetchAssessmentById(args.assessmentId);
  } else if (typeof args.partnerApplicationId === "string") {
    assessment = await fetchLatestAssessmentByPartnerApplicationId(
      args.partnerApplicationId
    );
  } else {
    throw new Error("Either token, assessmentId, or partnerApplicationId is required.");
  }

  if (!assessment) {
    throw new Error("MCAS assessment not found.");
  }

  const [testLink, partnerApplication, individual, result] = await Promise.all([
    fetchTestLink(assessment.test_link_id),
    fetchPartnerApplication(assessment.partner_application_id),
    fetchIndividual(assessment.individual_id),
    fetchResultForAssessment(assessment.id),
  ]);

  if (!result) {
    throw new Error("MCAS result not found for this assessment.");
  }

  const osDistribution = normaliseOperatingStyleDistribution(
    result.os_distribution
  );
  const coreDistribution = normaliseCoreDistribution(result.core_distribution);
  const verticalDistribution = normaliseCareerVerticalDistribution(
    result.vertical_readiness
  );

  const primaryOperatingStyle = osDistribution[0];
  const secondaryOperatingStyle = osDistribution[1];
  const strongestCore = coreDistribution[0];
  const weakestCore = [...coreDistribution].sort(
    (a, b) => a.percentage - b.percentage
  )[0];

  const primaryVertical = verticalDistribution[0];
  const nextVertical = primaryVertical
    ? getNextCareerVertical(verticalDistribution, primaryVertical.code)
    : undefined;

  if (!primaryOperatingStyle) {
    throw new Error("MCAS operating style distribution could not be resolved.");
  }

  if (!strongestCore) {
    throw new Error("MCAS CORE distribution could not be resolved.");
  }

  if (!primaryVertical) {
    throw new Error("MCAS career vertical distribution could not be resolved.");
  }

  const confidence = normaliseConfidence(result.confidence);
  const flags = normaliseFlags(result.flags);
  const candidateContent = getCandidateFacingContent({
    primaryCode: primaryOperatingStyle.code,
    secondaryCode: secondaryOperatingStyle?.code,
    strongestCore,
    secondCore: coreDistribution[1],
    weakestCore,
    primaryVertical,
    nextVertical,
    readinessPercentage: getVerticalReadinessPercentage(
      result.vertical_readiness,
      result.confidence
    ),
  });
  const internalSummary = buildInternalSummary(
    primaryOperatingStyle,
    primaryVertical,
    confidence.score,
    flags
  );

  const firstName =
    individual?.first_name ??
    partnerApplication?.candidate_first_name ??
    getMetaCandidateValue(assessment.meta, "first_name");

  const lastName =
    individual?.last_name ??
    partnerApplication?.candidate_last_name ??
    getMetaCandidateValue(assessment.meta, "last_name");

  const email =
    individual?.email ??
    partnerApplication?.candidate_email ??
    getMetaCandidateValue(assessment.meta, "email");

  const phone =
    partnerApplication?.candidate_phone ??
    getMetaCandidateValue(assessment.meta, "phone");

  const orgId =
    testLink?.org_id ??
    partnerApplication?.org_id ??
    individual?.org_id ??
    "unknown-org";

  const organisationName = testLink?.name
    ? `MindCanvas MCAS — ${testLink.name}`
    : partnerApplication?.partner_key
      ? `MindCanvas MCAS — ${partnerApplication.partner_key}`
      : "MindCanvas MCAS";

  const isTestLinkReport = Boolean(testLink);
  const fullReportUnlocked = isTestLinkReport
    ? testLink?.report_version === "full"
    : true;

  return {
    reportType,
    reportVersion: DEFAULT_REPORT_VERSION,

    organisation: {
      id: orgId,
      name: organisationName,
      slug: testLink?.public_token ?? partnerApplication?.partner_key ?? undefined,
      branding: undefined,
    },

    candidate: {
      applicationId: assessment.id,
      firstName,
      lastName,
      fullName: toCandidateFullName(firstName, lastName),
      email,
      phone,
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
        readinessLabel: getVerticalReadinessLabel(
          result.vertical_readiness,
          primaryVertical.code
        ),
        readinessPercentage: getVerticalReadinessPercentage(
          result.vertical_readiness,
          result.confidence
        ),
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
      snapshotUnlocked: testLink?.show_results ?? true,
      fullUnlocked: fullReportUnlocked,
      internalUnlocked: true,
      fullPurchaseEnabled: true,
      nextStepsUrl: testLink?.next_steps_url ?? null,
    } as McasReportPayload["access"] & { nextStepsUrl: string | null },
  };
}

export async function buildMcasReportPayloadByToken(
  token: string,
  reportType: McasReportType = "snapshot"
): Promise<McasReportPayload> {
  return buildMcasReportPayload({ token, reportType });
}

export async function buildMcasReportPayloadByAssessmentId(
  assessmentId: string,
  reportType: McasReportType = "internal_decision"
): Promise<McasReportPayload> {
  return buildMcasReportPayload({ assessmentId, reportType });
}

export async function buildMcasReportPayloadByApplicationId(
  applicationId: string,
  reportType: McasReportType = "internal_decision"
): Promise<McasReportPayload> {
  return buildMcasReportPayload({
    partnerApplicationId: applicationId,
    reportType,
  });
}
