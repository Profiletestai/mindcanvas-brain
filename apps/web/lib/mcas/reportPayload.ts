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
    CATALYST: "OS2",
    MOTIVATOR: "OS3",
    CONNECTOR: "OS4",
    FACILITATOR: "OS5",
    COORDINATOR: "OS6",
    CONTROLLER: "OS7",
    OPTIMISER: "OS8",
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

function getStrengths(code: McasOperatingStyleCode): McasStrength[] {
  const stage = MCAS_OPERATING_STYLE_LABELS[code].workCycleStage;
  const displayLabel = getOperatingStyleDisplayLabel(code);

  const generic: McasStrength[] = [
    {
      title: `${stage} strength`,
      description: `You naturally contribute through ${stage.toLowerCase()}, making this one of the clearest ways you create value.`,
    },
    {
      title: `${displayLabel} execution pattern`,
      description:
        "Your strongest pattern helps explain where work feels most natural, energising, and sustainable.",
    },
    {
      title: "Situational contribution",
      description:
        "You are likely to create strong value when your role gives you room to use this pattern deliberately.",
    },
  ];

  const specific: Partial<Record<McasOperatingStyleCode, McasStrength[]>> = {
    OS4: [
      {
        title: "Cross-team alignment",
        description:
          "You naturally bring people together across different priorities, styles, and perspectives.",
      },
      {
        title: "Communication clarity",
        description:
          "You translate complexity into clear, actionable direction different stakeholders can understand.",
      },
      {
        title: "Relational execution",
        description:
          "You build trust as a working tool — relationships directly accelerate your output.",
      },
    ],
    OS8: [
      {
        title: "Continuous improvement",
        description:
          "You naturally see how work can be refined, sharpened, and improved.",
      },
      {
        title: "Standards elevation",
        description:
          "You help teams raise quality and avoid settling for average execution.",
      },
      {
        title: "Optimisation thinking",
        description:
          "You identify better ways to make outcomes cleaner, stronger, or more effective.",
      },
    ],
  };

  return specific[code] ?? generic;
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
        "High — you perform best when trusted to own your relationships and process.",
      structure:
        "Semi-structured — clear goals with flexibility in how you achieve them.",
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
        description: "New direction, opportunity testing, strategic movement.",
      },
      {
        category: "Commercial",
        title: "Business Development Lead",
        description: "Market openings, opportunity creation, early momentum.",
      },
      {
        category: "Strategy",
        title: "Venture Builder",
        description: "New initiatives, experimentation, future-facing work.",
      },
    ],
    OS2: [
      {
        category: "Sales & Growth",
        title: "Growth Manager",
        description: "Activation, visibility, and momentum building.",
      },
      {
        category: "Marketing",
        title: "Campaign Lead",
        description: "Audience energy, communication, and traction.",
      },
      {
        category: "Change",
        title: "Change Activation Lead",
        description: "Mobilising people around a new direction.",
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
        title: "Team Lead",
        description: "People support, trust, and team commitment.",
      },
      {
        category: "Customer",
        title: "Community Manager",
        description: "Relationship energy, care, and sustained engagement.",
      },
    ],
    OS4: [
      {
        category: "People & Culture",
        title: "People Partner",
        description: "Cross-functional alignment, talent advocacy.",
      },
      {
        category: "Programme Management",
        title: "Programme Lead",
        description: "Multi-team delivery, stakeholder management.",
      },
      {
        category: "Strategy & Operations",
        title: "Chief of Staff",
        description: "Executive alignment, operational bridging.",
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
        description: "Dependable execution and service stability.",
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
        description: "Coordination, governance, and execution systems.",
      },
      {
        category: "Business Systems",
        title: "Process Improvement Lead",
        description: "Workflow design, structure, and scalable operations.",
      },
    ],
    OS7: [
      {
        category: "Risk & Quality",
        title: "Quality Assurance Lead",
        description: "Evidence, standards, validation, and review.",
      },
      {
        category: "Finance / Analysis",
        title: "Business Analyst",
        description: "Analytical review, data-led decisions, and judgement.",
      },
      {
        category: "Governance",
        title: "Risk Manager",
        description: "Control, risk visibility, and responsible decision support.",
      },
    ],
    OS8: [
      {
        category: "Improvement",
        title: "Continuous Improvement Lead",
        description: "Refinement, optimisation, and standards elevation.",
      },
      {
        category: "Product",
        title: "Product Optimisation Lead",
        description:
          "Iteration, quality improvement, and user outcome refinement.",
      },
      {
        category: "Operations",
        title: "Performance Improvement Manager",
        description: "Efficiency, quality, and better operating outcomes.",
      },
    ],
  };

  return map[code];
}

function getBlindSpots(code: McasOperatingStyleCode): McasBlindSpot[] {
  const displayLabel = getOperatingStyleDisplayLabel(code);

  const fallback: McasBlindSpot[] = [
    {
      title: `Overusing the ${displayLabel} pattern`,
      description:
        "Your strongest work pattern can become a limitation if it is applied automatically in every situation.",
      managementStrategy:
        "Pause before reacting and ask: what does this situation need from the full work cycle, not only from my strongest pattern?",
    },
    {
      title: "Under-supporting weaker work areas",
      description:
        "Some parts of the work cycle may need conscious structure, partnership, or review.",
      managementStrategy:
        "Build simple checkpoints or partner with people whose natural strengths cover the areas you underuse.",
    },
  ];

  if (code === "OS8") {
    return [
      {
        title: "Perfection drag",
        description:
          "Your improvement instinct can slow momentum when good enough would create value faster.",
        managementStrategy:
          "Separate refinement work from release work. Decide what must be excellent now and what can improve after feedback.",
      },
      {
        title: "Standards frustration",
        description:
          "You may become frustrated when others move work forward before quality has been fully improved.",
        managementStrategy:
          "Name the standard clearly, then agree the level of quality needed for the current stage of work.",
      },
    ];
  }

  if (code === "OS4") {
    return [
      {
        title: "Authority understatement",
        description:
          "You may avoid taking a clear directional position when one is needed. Your instinct to maintain harmony can read as indecision in high-stakes moments.",
        managementStrategy:
          'Practice stating your position clearly before inviting input: "My recommendation is X — here is why, and I want to hear your concerns."',
      },
      {
        title: "Silent overload absorption",
        description:
          "You may absorb more relational and organisational complexity than is sustainable without flagging it.",
        managementStrategy:
          'Build a weekly check-in practice: "What am I carrying that is not mine to hold?" Name scope creep early and escalate with evidence.',
      },
    ];
  }

  return fallback;
}

function getSuccessGuide(code: McasOperatingStyleCode): McasSuccessGuideItem[] {
  if (code === "OS8") {
    return [
      {
        period: "days_1_30",
        title: "Identify the quality standard",
        description:
          "Clarify which outcomes require precision and which outcomes only need progress. This prevents improvement energy from slowing the wrong work.",
      },
      {
        period: "days_31_60",
        title: "Create the improvement rhythm",
        description:
          "Build a repeatable way to capture issues, prioritise refinements, and improve without overwhelming the team.",
      },
      {
        period: "days_61_90",
        title: "Scale the standard",
        description:
          "Translate your improvements into shared standards, templates, and practices other people can use.",
      },
    ];
  }

  if (code === "OS4") {
    return [
      {
        period: "days_1_30",
        title: "Map and listen",
        description:
          "Identify the key relationships and communication gaps in your environment. Build a simple map of who connects to whom and where misalignment exists.",
      },
      {
        period: "days_31_60",
        title: "Create your alignment structure",
        description:
          "Build the relational and process bridges your role requires. Establish your communication rhythms.",
      },
      {
        period: "days_61_90",
        title: "Lead with presence",
        description:
          "Shift attention to your authority pattern. Take at least one clear directional stance per week and review your scope load.",
      },
    ];
  }

  return [
    {
      period: "days_1_30",
      title: "Understand your operating context",
      description:
        "Map what the role or environment needs from you. Notice where your strongest pattern is useful and where support may be needed.",
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

function getCandidateFacingContent(primaryCode: McasOperatingStyleCode): {
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
  const displayLabel = getOperatingStyleDisplayLabel(primaryCode);
  const knowledgeLabel = MCAS_OPERATING_STYLE_LABELS[primaryCode].label;
  const stage = MCAS_OPERATING_STYLE_LABELS[primaryCode].workCycleStage;

  return {
    workPatternSummary: `Your strongest pattern is ${displayLabel}. This means your work energy is most naturally expressed through ${stage.toLowerCase()}. This is not a fixed personality label. It is a practical view of how you are most likely to create value through work.`,
    operatingStyleNarrative: `The ${displayLabel} pattern, also known in the MCAS knowledge base as ${knowledgeLabel}, describes how you most naturally move work forward. It shows the conditions, contribution patterns, and responsibility levels where your strengths are most likely to be sustainable.`,
    strengths: getStrengths(primaryCode),
    environmentFit: getEnvironmentFit(primaryCode),
    roleRecommendations: getRoleRecommendations(primaryCode),
    blindSpots: getBlindSpots(primaryCode),
    successGuide: getSuccessGuide(primaryCode),
    nextStepPathway: {
      current: "Current fit indicated by your MCAS result",
      next: "Next stage responsibility readiness",
      future: "Longer-term growth pathway",
      developmentFocus: [
        "Use your strongest pattern deliberately.",
        "Strengthen the weaker parts of the CORE work cycle.",
        "Build repeatable habits that make your contribution sustainable.",
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
  const nextVertical = verticalDistribution[1];

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
  const candidateContent = getCandidateFacingContent(primaryOperatingStyle.code);
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
    },
  } as unknown as McasReportPayload;
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
