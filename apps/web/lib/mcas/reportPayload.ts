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

type PartnerApplicationRow = {
  id: string;
  org_id: string | null;
  partner_key: string | null;
  application_id: string | null;
  public_token: string | null;
  status: string | null;
  candidate_first_name: string | null;
  candidate_last_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AssessmentRow = {
  id: string;
  partner_application_id: string | null;
  individual_id?: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ResultRow = {
  id: string;
  assessment_id: string | null;
  core_distribution: unknown;
  os_distribution: unknown;
  vertical_readiness: unknown;
  flags: unknown;
  confidence: unknown;
  scoring_model: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OrgSettingsRow = {
  id: string;
  org_id: string | null;
  slug: string | null;
  display_name: string | null;
  branding: unknown;
};

type ReportAccessRow = {
  snapshot_unlocked: boolean | null;
  full_unlocked: boolean | null;
  internal_unlocked: boolean | null;
  full_purchase_enabled?: boolean | null;
};

type BuildPayloadArgs =
  | {
      token: string;
      applicationId?: never;
      reportType?: McasReportType;
    }
  | {
      applicationId: string;
      token?: never;
      reportType?: McasReportType;
    };

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

  // If saved as 0.82 instead of 82, convert to 82.
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
    BRIDGEBUILDERP04: "OS4",

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

      const percentage = normalisePercentage(
        entry.percentage ?? entry.pct ?? entry.value ?? entry.score
      );

      items.push({
        code,
        label: getOperatingStyleDisplayLabel(code),
        shortLabel: MCAS_OPERATING_STYLE_LABELS[code].label,
        percentage,
        description: MCAS_OPERATING_STYLE_LABELS[code].shortDescription,
      });
    }
  }

  if (isRecord(value)) {
    for (const [key, percentageValue] of Object.entries(value)) {
      if (
        key === "primary" ||
        key === "secondary" ||
        key === "dominant" ||
        key === "distribution"
      ) {
        continue;
      }

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

    if (Array.isArray(value.distribution)) {
      return normaliseOperatingStyleDistribution(value.distribution);
    }
  }

  const merged = mergeDistributionItems(items);

  return ensureAllOperatingStyles(merged);
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

      const percentage = normalisePercentage(
        entry.percentage ?? entry.pct ?? entry.value ?? entry.score
      );

      items.push({
        code,
        label: getCoreLabel(code),
        percentage,
        description: MCAS_CORE_LABELS[code].shortDescription,
      });
    }
  }

  if (isRecord(value)) {
    for (const [key, percentageValue] of Object.entries(value)) {
      if (
        key === "primary" ||
        key === "strongest" ||
        key === "weakest" ||
        key === "distribution"
      ) {
        continue;
      }

      const code = maybeCoreCode(key);
      if (!code) continue;

      items.push({
        code,
        label: getCoreLabel(code),
        percentage: normalisePercentage(percentageValue),
        description: MCAS_CORE_LABELS[code].shortDescription,
      });
    }

    if (Array.isArray(value.distribution)) {
      return normaliseCoreDistribution(value.distribution);
    }
  }

  const merged = mergeDistributionItems(items);

  return ensureAllCoreCodes(merged);
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

      const percentage = normalisePercentage(
        entry.percentage ?? entry.pct ?? entry.value ?? entry.score
      );

      items.push({
        code,
        label: getVerticalLabel(code),
        percentage,
        description: MCAS_VERTICAL_LABELS[code].shortDescription,
      });
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.distribution)) {
      return normaliseCareerVerticalDistribution(value.distribution);
    }

    for (const [key, percentageValue] of Object.entries(value)) {
      if (
        key === "primary" ||
        key === "current" ||
        key === "current_vertical" ||
        key === "next" ||
        key === "readinessLabel" ||
        key === "readinessPercentage" ||
        key === "readiness_percentage" ||
        key === "distribution"
      ) {
        continue;
      }

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

  const merged = mergeDistributionItems(items);

  return ensureAllVerticalCodes(merged);
}

function mergeDistributionItems<TCode extends string>(
  items: Array<Omit<McasDistributionItem<TCode>, "rank" | "band">>
): Array<Omit<McasDistributionItem<TCode>, "rank" | "band">> {
  const map = new Map<TCode, Omit<McasDistributionItem<TCode>, "rank" | "band">>();

  for (const item of items) {
    const existing = map.get(item.code);

    if (!existing || item.percentage > existing.percentage) {
      map.set(item.code, item);
    }
  }

  return Array.from(map.values());
}

function ensureAllOperatingStyles(
  items: Array<Omit<McasDistributionItem<McasOperatingStyleCode>, "rank" | "band">>
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

function confidenceLevelFromScore(score: number) {
  if (score >= 75) return "high" as const;
  if (score >= 45) return "moderate" as const;
  return "low" as const;
}

function normaliseConfidenceLevel(level: string | null, score?: number) {
  const normalised = level?.toLowerCase();

  if (normalised === "high") return "high" as const;
  if (normalised === "moderate" || normalised === "medium") {
    return "moderate" as const;
  }
  if (normalised === "low") return "low" as const;

  if (typeof score === "number") return confidenceLevelFromScore(score);

  return "moderate" as const;
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
  verticalReadiness: unknown
): number | undefined {
  if (!isRecord(verticalReadiness)) return undefined;

  const value =
    verticalReadiness.readinessPercentage ??
    verticalReadiness.readiness_percentage ??
    verticalReadiness.next_readiness ??
    verticalReadiness.nextReadiness;

  if (value === undefined) return undefined;

  return normalisePercentage(value);
}

function getBranding(value: unknown) {
  if (!isRecord(value)) return undefined;

  return {
    logoUrl: cleanString(value.logoUrl) ?? cleanString(value.logo_url),
    primaryColor:
      cleanString(value.primaryColor) ?? cleanString(value.primary_color),
    secondaryColor:
      cleanString(value.secondaryColor) ?? cleanString(value.secondary_color),
    accentColor:
      cleanString(value.accentColor) ?? cleanString(value.accent_color),
  };
}

async function fetchOrgSettings(
  orgId: string | null,
  partnerKey: string | null
): Promise<OrgSettingsRow | null> {
  if (!orgId && !partnerKey) return null;

  const supa = mcasSupa();

  try {
    let query = supa
      .from("org_settings")
      .select("id, org_id, slug, display_name, branding")
      .limit(1);

    if (orgId) {
      query = query.eq("org_id", orgId);
    } else if (partnerKey) {
      query = query.eq("partner_key", partnerKey);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn("[MCAS] org_settings lookup skipped:", error.message);
      return null;
    }

    return data as OrgSettingsRow | null;
  } catch (error) {
    console.warn("[MCAS] org_settings lookup failed:", error);
    return null;
  }
}

async function fetchReportAccess(
  applicationId: string
): Promise<ReportAccessRow | null> {
  const supa = mcasSupa();

  try {
    const { data, error } = await supa
      .from("report_access")
      .select(
        "snapshot_unlocked, full_unlocked, internal_unlocked, full_purchase_enabled"
      )
      .eq("application_id", applicationId)
      .maybeSingle();

    if (error) {
      console.warn("[MCAS] report_access lookup skipped:", error.message);
      return null;
    }

    return data as ReportAccessRow | null;
  } catch (error) {
    console.warn("[MCAS] report_access lookup failed:", error);
    return null;
  }
}

async function fetchApplicationByToken(
  token: string
): Promise<PartnerApplicationRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
    .from("partner_applications")
    .select(
      [
        "id",
        "org_id",
        "partner_key",
        "application_id",
        "public_token",
        "status",
        "candidate_first_name",
        "candidate_last_name",
        "candidate_email",
        "candidate_phone",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load MCAS application by token: ${error.message}`);
  }

  return data as PartnerApplicationRow | null;
}

async function fetchApplicationById(
  applicationId: string
): Promise<PartnerApplicationRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
    .from("partner_applications")
    .select(
      [
        "id",
        "org_id",
        "partner_key",
        "application_id",
        "public_token",
        "status",
        "candidate_first_name",
        "candidate_last_name",
        "candidate_email",
        "candidate_phone",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load MCAS application by id: ${error.message}`);
  }

  return data as PartnerApplicationRow | null;
}

async function fetchAssessmentForApplication(
  applicationId: string
): Promise<AssessmentRow | null> {
  const supa = mcasSupa();

  const { data, error } = await supa
    .from("assessments")
    .select(
      [
        "id",
        "partner_application_id",
        "individual_id",
        "status",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("partner_application_id", applicationId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load MCAS assessment: ${error.message}`);
  }

  return data as AssessmentRow | null;
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
        "core_distribution",
        "os_distribution",
        "vertical_readiness",
        "flags",
        "confidence",
        "scoring_model",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("assessment_id", assessmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load MCAS result: ${error.message}`);
  }

  return data as ResultRow | null;
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

  const generic = {
    workPatternSummary: `Your strongest pattern is ${displayLabel}. This means your work energy is most naturally expressed through ${MCAS_OPERATING_STYLE_LABELS[
      primaryCode
    ].workCycleStage.toLowerCase()}.`,
    operatingStyleNarrative: `The ${displayLabel} pattern describes how you most naturally move work forward. It is not a personality label. It is a practical view of the work conditions, contribution patterns, and responsibility levels where your strengths are most likely to create sustainable value.`,
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

  if (primaryCode !== "OS4") return generic;

  return {
    workPatternSummary:
      "You succeed through people and process — not one or the other, but both working together. You are most effective when you understand the human side of a problem and then build the right structure around it.",
    operatingStyleNarrative:
      "You are a natural connector of people, priorities, and communication. You create alignment without forcing it — moving work forward through relationships, trust, and well-timed action. You are often the person others turn to when teams are stuck or communication has broken down.",
    strengths: getStrengths(primaryCode),
    environmentFit: getEnvironmentFit(primaryCode),
    roleRecommendations: getRoleRecommendations(primaryCode),
    blindSpots: getBlindSpots(primaryCode),
    successGuide: getSuccessGuide(primaryCode),
    nextStepPathway: {
      current: "V3 — Established execution",
      next: "V4 — Senior cross-functional scope",
      future: "V5 — Strategic leadership",
      developmentFocus: [
        "Authority clarity",
        "Analytical coverage",
        "Scope boundary management",
        "Strategic narrative",
      ],
    },
  };
}

function getStrengths(code: McasOperatingStyleCode): McasStrength[] {
  const map: Record<McasOperatingStyleCode, McasStrength[]> = {
    OS1: [
      {
        title: "Direction creation",
        description:
          "You naturally spot new opportunities and create forward movement before everything is fully certain.",
      },
      {
        title: "Fast initiation",
        description:
          "You are often comfortable starting work, testing ideas, and learning through movement.",
      },
      {
        title: "Opportunity awareness",
        description:
          "You notice gaps, possibilities, and future pathways others may not see yet.",
      },
    ],
    OS2: [
      {
        title: "Momentum building",
        description:
          "You bring energy, attention, and movement to ideas that need activation.",
      },
      {
        title: "Influence through energy",
        description:
          "You help people engage with a direction and feel ready to move.",
      },
      {
        title: "Fast mobilisation",
        description:
          "You are useful when work needs urgency, visibility, and early traction.",
      },
    ],
    OS3: [
      {
        title: "People commitment",
        description:
          "You help sustain morale, trust, and emotional investment in the work.",
      },
      {
        title: "Encouraging presence",
        description:
          "You often help people stay connected and motivated through pressure.",
      },
      {
        title: "Human-centred delivery",
        description:
          "You notice how work is affecting people and help keep energy sustainable.",
      },
    ],
    OS4: [
      {
        title: "Cross-team alignment",
        description:
          "You naturally bring people together across different priorities, styles, and perspectives.",
      },
      {
        title: "Timing and presence",
        description:
          "You sense when to step in, hold back, and how to move things forward with minimal friction.",
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
      {
        title: "Calm under pressure",
        description:
          "You are a stabilising presence when teams face uncertainty, tension, or competing demands.",
      },
      {
        title: "Gap identification",
        description:
          "You see where communication or trust is breaking down — often before others notice.",
      },
    ],
    OS5: [
      {
        title: "Reliable delivery",
        description:
          "You protect consistency, follow-through, and practical completion.",
      },
      {
        title: "Operational steadiness",
        description:
          "You help work stay stable when pressure or ambiguity increases.",
      },
      {
        title: "Supportive execution",
        description:
          "You create confidence by keeping work grounded, clear, and deliverable.",
      },
    ],
    OS6: [
      {
        title: "Structure building",
        description:
          "You naturally create process, order, and repeatable ways of working.",
      },
      {
        title: "Priority organisation",
        description:
          "You help convert moving parts into clear ownership, sequence, and rhythm.",
      },
      {
        title: "Scalable execution",
        description:
          "You make work easier to repeat, manage, and hand over.",
      },
    ],
    OS7: [
      {
        title: "Quality judgement",
        description:
          "You protect standards, evidence, and responsible decision-making.",
      },
      {
        title: "Risk awareness",
        description:
          "You notice weak points, assumptions, and areas that require validation.",
      },
      {
        title: "Analytical discipline",
        description:
          "You bring care, review, and rigour to work that must be accurate.",
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

  return map[code];
}

function getEnvironmentFit(code: McasOperatingStyleCode): McasEnvironmentFit {
  const map: Record<McasOperatingStyleCode, McasEnvironmentFit> = {
    OS1: {
      pace: "Fast — opportunity-led movement with room to test.",
      autonomy: "High — you perform best when trusted to initiate.",
      structure: "Flexible — enough direction to focus, not enough to restrict movement.",
      workStyle: "Entrepreneurial — growth, innovation, and new direction.",
    },
    OS2: {
      pace: "Fast — visible momentum and active engagement.",
      autonomy: "Moderate to high — room to activate people and ideas.",
      structure: "Light to semi-structured — clear goals with energetic movement.",
      workStyle: "Influence-led — communication, activation, and buy-in.",
    },
    OS3: {
      pace: "Moderate — sustainable progress with people connection.",
      autonomy: "Moderate — trusted ownership with relational awareness.",
      structure: "Supportive — clear expectations and healthy team rhythms.",
      workStyle: "Human-centred — engagement, support, and team commitment.",
    },
    OS4: {
      pace: "Moderate to fast — structured momentum with room for relationship-building.",
      autonomy: "High — you perform best when trusted to own your relationships and process.",
      structure: "Semi-structured — clear goals with flexibility in how you achieve them.",
      workStyle: "Collaborative — cross-functional, multi-stakeholder, purpose-aligned teams.",
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
      workStyle: "Analytical — quality, risk, validation, and responsible judgement.",
    },
    OS8: {
      pace: "Focused — improvement cycles with room to refine.",
      autonomy: "Moderate to high — best when trusted to improve the work.",
      structure: "Defined but adaptable — standards with room for iteration.",
      workStyle: "Improvement-led — optimisation, refinement, and quality elevation.",
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
      {
        category: "Customer Success",
        title: "CS Director",
        description: "Relationship-led retention and growth.",
      },
      {
        category: "Communications",
        title: "Comms Lead",
        description: "Narrative clarity, internal alignment.",
      },
      {
        category: "Consulting",
        title: "Senior Consultant",
        description: "Client alignment, delivery ownership.",
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
        description: "Iteration, quality improvement, and user outcome refinement.",
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
  const fallback: McasBlindSpot[] = [
    {
      title: "Overusing your strongest pattern",
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

  if (code !== "OS4") return fallback;

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
    {
      title: "Analytical coverage gap",
      description:
        "Deep analytical review and data-led quality assurance may require more conscious effort.",
      managementStrategy:
        "Partner intentionally with Analyst or Refiner patterns and build structured review checkpoints into your process.",
    },
    {
      title: "Conflict deferral",
      description:
        "Your preference for harmony can lead to delaying necessary direct conversations.",
      managementStrategy:
        'Reframe directness as care: "Saying this now protects the relationship and the outcome."',
    },
  ];
}

function getSuccessGuide(code: McasOperatingStyleCode): McasSuccessGuideItem[] {
  if (code !== "OS4") {
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

  return [
    {
      period: "days_1_30",
      title: "Map and listen",
      description:
        "Identify the key relationships and communication gaps in your environment. Build a simple map of who connects to whom and where misalignment exists. Do not fix yet — understand first.",
    },
    {
      period: "days_31_60",
      title: "Create your alignment structure",
      description:
        "Build the relational and process bridges your role requires. Establish your communication rhythms. Identify your Examine coverage gap and put a structure in place.",
    },
    {
      period: "days_61_90",
      title: "Lead with presence",
      description:
        "Shift attention to your authority pattern. Take at least one clear directional stance per week and begin reviewing your scope load.",
    },
  ];
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

let application: PartnerApplicationRow | null = null;

if (typeof args.token === "string") {
  application = await fetchApplicationByToken(args.token);
} else if (typeof args.applicationId === "string") {
  application = await fetchApplicationById(args.applicationId);
} else {
  throw new Error("Either token or applicationId is required.");
}

  if (!application) {
    throw new Error("MCAS application not found.");
  }

  const assessment = await fetchAssessmentForApplication(application.id);

  if (!assessment) {
    throw new Error("MCAS assessment not found for this application.");
  }

  const result = await fetchResultForAssessment(assessment.id);

  if (!result) {
    throw new Error("MCAS result not found for this assessment.");
  }

  const orgSettings = await fetchOrgSettings(
    application.org_id,
    application.partner_key
  );

  const reportAccess = await fetchReportAccess(application.id);

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

  const firstName = application.candidate_first_name;
  const lastName = application.candidate_last_name;

  return {
    reportType,
    reportVersion: DEFAULT_REPORT_VERSION,

    organisation: {
      id: application.org_id ?? "unknown-org",
      name:
        orgSettings?.display_name ??
        application.partner_key ??
        "MindCanvas MCAS",
      slug: orgSettings?.slug ?? application.partner_key,
      branding: getBranding(orgSettings?.branding),
    },

    candidate: {
      applicationId: application.id,
      firstName,
      lastName,
      fullName: toCandidateFullName(firstName, lastName),
      email: application.candidate_email,
      phone: application.candidate_phone,
    },

    assessment: {
      assessmentId: assessment.id,
      status: assessment.status ?? "unknown",
      startedAt: assessment.started_at,
      completedAt: assessment.completed_at,
    },

    result: {
      scoringModel: result.scoring_model ?? "mcas_v2",
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
          result.vertical_readiness
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
      snapshotUnlocked: reportAccess?.snapshot_unlocked ?? true,
      fullUnlocked: reportAccess?.full_unlocked ?? false,
      internalUnlocked: reportAccess?.internal_unlocked ?? true,
      fullPurchaseEnabled: reportAccess?.full_purchase_enabled ?? true,
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
  return buildMcasReportPayload({ applicationId, reportType });
}