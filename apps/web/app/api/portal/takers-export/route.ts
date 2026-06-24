//apps/web/app/api/portal/takers-export/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";
import { getBaseUrl } from "@/lib/baseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExportTakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role_title: string | null;
  created_at: string | null;
  test_id: string | null;
  link_token: string | null;
  status: string | null;
  last_result_url: string | null;
};

type TestRow = {
  id: string;
  name: string | null;
  slug: string | null;
  meta: any;
};

type LinkRow = {
  token: string | null;
  name: string | null;
  report_version?: string | null;
};

type ResultRow = {
  taker_id: string | null;
  created_at: string | null;
  totals: any;
};

type SubmissionRow = {
  id: string | null;
  taker_id: string | null;
  test_id: string | null;
  created_at: string | null;
  totals: any;
};

type QscResultRow = {
  taker_id: string | null;
  test_id: string | null;
  created_at: string | null;
  audience: string | null;
  primary_personality: string | null;
  primary_mindset: string | null;
  combined_profile_code: string | null;
};

type GedChoiceAnswer = {
  question_id?: string | null;
  question_text?: string | null;
  value?: string | null;
  label?: string | null;
};

type GedDiagnostics = {
  business_stage: GedChoiceAnswer | null;
  core_constraint: GedChoiceAnswer | null;
  scale_readiness: GedChoiceAnswer | null;
  self_diagnosis: string | null;
};

function normaliseText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseMaybeJson(value: unknown): any {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (typeof parsed === "string") {
      return JSON.parse(parsed);
    }

    return parsed || {};
  } catch {
    return {};
  }
}

function dateToMs(value: string | null | undefined): number {
  if (!value) return 0;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function formatDisplay(value: string | null | undefined): string {
  const raw = normaliseText(value);

  if (!raw) return "";

  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normaliseStatus(status: string | null | undefined): string {
  return normaliseText(status).toLowerCase() === "completed"
    ? "Completed"
    : "Incomplete";
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function protectSpreadsheetValue(value: unknown): string {
  const text = value == null ? "" : String(value);

  if (/^[=+\-@]/.test(text.trim())) {
    return `'${text}`;
  }

  return text;
}

function csvEscape(value: unknown): string {
  const text = protectSpreadsheetValue(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toAbsoluteUrl(baseUrl: string, value: string | null | undefined): string {
  const path = normaliseText(value);

  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function getAssessmentType(test: TestRow | undefined): string {
  if (!test) return "Assessment";

  const meta = parseMaybeJson(test.meta);
  const slug = normaliseText(test.slug).toLowerCase();
  const name = normaliseText(test.name).toLowerCase();

  const isGed =
    meta?.is_ged === true ||
    normaliseText(meta?.assessment_name).toLowerCase() ===
      "growth engine diagnostic" ||
    normaliseText(meta?.report_brand).toLowerCase() === "ged" ||
    slug.includes("growth-engine-diagnostic") ||
    slug.startsWith("ged-") ||
    name.includes("growth engine diagnostic") ||
    name.startsWith("ged");

  if (isGed) return "GED";

  const isVisibility =
    slug.includes("visibility") ||
    normaliseText(meta?.frameworkType).toLowerCase() === "visibility" ||
    normaliseText(meta?.framework_type).toLowerCase() === "visibility";

  if (isVisibility) return "Visibility Ladder";

  const isQsc =
    slug.startsWith("qsc-") ||
    normaliseText(meta?.frameworkType).toLowerCase() === "qsc" ||
    normaliseText(meta?.framework_type).toLowerCase() === "qsc" ||
    normaliseText(meta?.kind).toLowerCase() === "qsc" ||
    normaliseText(meta?.test_family).toLowerCase() === "qsc";

  if (isQsc) return "QSC";

  return "Profile Assessment";
}

function getReportPath(args: {
  taker: ExportTakerRow;
  test?: TestRow;
  qsc?: QscResultRow | null;
}): string {
  const { taker, test, qsc } = args;

  if (normaliseText(taker.last_result_url)) {
    return normaliseText(taker.last_result_url);
  }

  const token = normaliseText(taker.link_token);

  if (!token) return "";

  const assessmentType = getAssessmentType(test);
  const tid = encodeURIComponent(taker.id);

  if (assessmentType === "GED") {
    return `/ged/${encodeURIComponent(token)}/entrepreneur?tid=${tid}`;
  }

  if (assessmentType === "QSC") {
    const audience = normaliseText(qsc?.audience).toLowerCase();

    return audience === "leader"
      ? `/qsc/${encodeURIComponent(token)}/leader?tid=${tid}`
      : `/qsc/${encodeURIComponent(token)}/entrepreneur?tid=${tid}`;
  }

  if (assessmentType === "Visibility Ladder") {
    return `/t/${encodeURIComponent(
      token
    )}/visibility/report?tid=${tid}&src=portal`;
  }

  return `/t/${encodeURIComponent(token)}/report?tid=${tid}&src=portal`;
}

function getNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, number> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    const numberValue = Number(rawValue);

    if (Number.isFinite(numberValue)) {
      result[String(key)] = numberValue;
    }
  }

  return result;
}

function getPercentMap(values: Record<string, number>): Record<string, number> {
  const total = Object.values(values).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  if (!total) return {};

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Math.round(((Number(value) || 0) / total) * 100),
    ])
  );
}

function sortScores(values: Record<string, number>): Array<[string, number]> {
  return Object.entries(values).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
}

function profileAliases(value: string): string[] {
  const raw = normaliseText(value).toUpperCase();

  if (!raw) return [];

  const aliases = new Set<string>([raw]);

  const match = raw.match(/^P(?:ROFILE)?[_\s-]?(\d+)$/i);

  if (match) {
    aliases.add(`P${match[1]}`);
    aliases.add(`PROFILE_${match[1]}`);
  }

  return Array.from(aliases);
}

function normaliseGedChoice(value: any): GedChoiceAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const questionId = normaliseText(value.question_id) || null;
  const questionText = normaliseText(value.question_text) || null;
  const answerValue = normaliseText(value.value) || null;
  const answerLabel = normaliseText(value.label) || null;

  if (!questionId && !questionText && !answerValue && !answerLabel) {
    return null;
  }

  return {
    question_id: questionId,
    question_text: questionText,
    value: answerValue,
    label: answerLabel,
  };
}

function extractGedDiagnostics(totals: any): GedDiagnostics | null {
  const parsed = parseMaybeJson(totals);
  const rawGed = parsed?.meta?.ged;

  if (!rawGed || typeof rawGed !== "object" || Array.isArray(rawGed)) {
    return null;
  }

  const diagnostics: GedDiagnostics = {
    business_stage: normaliseGedChoice(rawGed.business_stage),
    core_constraint: normaliseGedChoice(rawGed.core_constraint),
    scale_readiness: normaliseGedChoice(rawGed.scale_readiness),
    self_diagnosis: normaliseText(rawGed.self_diagnosis) || null,
  };

  const hasAnyValue = Boolean(
    diagnostics.business_stage ||
      diagnostics.core_constraint ||
      diagnostics.scale_readiness ||
      diagnostics.self_diagnosis
  );

  return hasAnyValue ? diagnostics : null;
}

function gedAnswerText(answer: GedChoiceAnswer | null): string {
  if (!answer) return "";

  return answer.label || answer.value || "";
}

function getLatestRow<T extends { created_at: string | null }>(
  existing: T | undefined,
  candidate: T
): T {
  if (!existing) return candidate;

  return dateToMs(candidate.created_at) >= dateToMs(existing.created_at)
    ? candidate
    : existing;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const orgSlug = normaliseText(url.searchParams.get("org"));
    const q = normaliseText(url.searchParams.get("q"));
    const selectedTestId = normaliseText(url.searchParams.get("testId"));
    const selectedPurpose = normaliseText(url.searchParams.get("purpose"));

    const sortKey = normaliseText(
      url.searchParams.get("sort") || "created_desc"
    ) as "created_desc" | "created_asc" | "company_asc" | "company_desc";

    if (!orgSlug) {
      return new NextResponse("Missing organisation slug.", {
        status: 400,
      });
    }

    const sb = createClient().schema("portal");
    const baseUrl = getBaseUrl();

    const { data: org, error: orgError } = await sb
      .from("orgs")
      .select("id, slug, name")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgError || !org) {
      return new NextResponse(
        orgError?.message || "Organisation not found.",
        { status: 404 }
      );
    }

    const { data: tests, error: testsError } = await sb
      .from("tests")
      .select("id, name, slug, meta")
      .eq("org_id", org.id)
      .order("name", { ascending: true });

    if (testsError) {
      return new NextResponse(`Unable to load tests: ${testsError.message}`, {
        status: 500,
      });
    }

    const testById = new Map<string, TestRow>();

    for (const test of tests ?? []) {
      const id = normaliseText((test as any)?.id);

      if (!id) continue;

      testById.set(id, {
        id,
        name: (test as any)?.name ?? null,
        slug: (test as any)?.slug ?? null,
        meta: (test as any)?.meta ?? {},
      });
    }

    let linkRows: LinkRow[] = [];

    const linksWithVersion = await sb
      .from("test_links")
      .select("token, name, report_version")
      .eq("org_id", org.id);

    if (linksWithVersion.error) {
      const fallbackLinks = await sb
        .from("test_links")
        .select("token, name")
        .eq("org_id", org.id);

      if (fallbackLinks.error) {
        return new NextResponse(
          `Unable to load test links: ${fallbackLinks.error.message}`,
          { status: 500 }
        );
      }

      linkRows = (fallbackLinks.data ?? []) as LinkRow[];
    } else {
      linkRows = (linksWithVersion.data ?? []) as LinkRow[];
    }

    const linkNameByToken = new Map<string, string>();
    const reportVersionByToken = new Map<string, string>();

    for (const link of linkRows) {
      const token = normaliseText(link.token);

      if (!token) continue;

      const name = normaliseText(link.name);
      const reportVersion = normaliseText(link.report_version);

      if (name) {
        linkNameByToken.set(token, name);
      }

      if (reportVersion) {
        reportVersionByToken.set(token, reportVersion);
      }
    }

    const matchingPurposeTokens = selectedPurpose
      ? linkRows
          .filter(
            (link) => normaliseText(link.name) === selectedPurpose
          )
          .map((link) => normaliseText(link.token))
          .filter(Boolean)
      : [];

    const testIds = Array.from(testById.keys());

    const profileLabelByTestAndCode = new Map<string, string>();
    const frequencyLabelByTestAndCode = new Map<string, string>();

    if (testIds.length) {
      const [profileLabelsResult, frequencyLabelsResult] = await Promise.all([
        sb
          .from("test_profile_labels")
          .select("test_id, profile_code, profile_name")
          .in("test_id", testIds),
        sb
          .from("test_frequency_labels")
          .select("test_id, frequency_code, frequency_name")
          .in("test_id", testIds),
      ]);

      if (!profileLabelsResult.error) {
        for (const row of profileLabelsResult.data ?? []) {
          const testId = normaliseText((row as any)?.test_id);
          const code = normaliseText((row as any)?.profile_code).toUpperCase();
          const name = normaliseText((row as any)?.profile_name);

          if (testId && code && name) {
            profileLabelByTestAndCode.set(`${testId}|${code}`, name);
          }
        }
      }

      if (!frequencyLabelsResult.error) {
        for (const row of frequencyLabelsResult.data ?? []) {
          const testId = normaliseText((row as any)?.test_id);
          const code = normaliseText(
            (row as any)?.frequency_code
          ).toUpperCase();
          const name = normaliseText((row as any)?.frequency_name);

          if (testId && code && name) {
            frequencyLabelByTestAndCode.set(`${testId}|${code}`, name);
          }
        }
      }
    }

    const getProfileLabel = (testId: string, rawCode: string): string => {
      for (const alias of profileAliases(rawCode)) {
        const label = profileLabelByTestAndCode.get(`${testId}|${alias}`);

        if (label) return label;
      }

      return rawCode;
    };

    const getFrequencyLabel = (testId: string, rawCode: string): string => {
      const code = normaliseText(rawCode).toUpperCase();

      return frequencyLabelByTestAndCode.get(`${testId}|${code}`) || code;
    };

    let orderColumn: "created_at" | "company" = "created_at";
    let ascending = false;

    if (sortKey === "created_asc") {
      orderColumn = "created_at";
      ascending = true;
    } else if (sortKey === "company_asc") {
      orderColumn = "company";
      ascending = true;
    } else if (sortKey === "company_desc") {
      orderColumn = "company";
      ascending = false;
    }

    const allTakers: ExportTakerRow[] = [];
    const latestResultByTaker = new Map<string, ResultRow>();
    const latestSubmissionByTaker = new Map<string, SubmissionRow>();
    const latestSubmissionByTakerAndTest = new Map<string, SubmissionRow>();
    const latestQscByTaker = new Map<string, QscResultRow>();
    const latestQscByTakerAndTest = new Map<string, QscResultRow>();

    const pageSize = 500;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let takerQuery = sb
        .from("test_takers")
        .select(
          "id, first_name, last_name, email, phone, company, role_title, created_at, test_id, link_token, status, last_result_url"
        )
        .eq("org_id", org.id)
        .order(orderColumn, { ascending })
        .order("id", { ascending });

      if (selectedTestId) {
        takerQuery = takerQuery.eq("test_id", selectedTestId);
      }

      if (q) {
        const safeQ = q.replace(/[%_,]/g, " ").trim();

        if (safeQ) {
          takerQuery = takerQuery.or(
            [
              `first_name.ilike.%${safeQ}%`,
              `last_name.ilike.%${safeQ}%`,
              `email.ilike.%${safeQ}%`,
              `company.ilike.%${safeQ}%`,
            ].join(",")
          );
        }
      }

      if (selectedPurpose) {
        if (!matchingPurposeTokens.length) {
          takerQuery = takerQuery.in("link_token", [
            "__no_matching_purpose__",
          ]);
        } else {
          takerQuery = takerQuery.in("link_token", matchingPurposeTokens);
        }
      }

      const { data: takerRows, error: takersError } = await takerQuery.range(
        from,
        to
      );

      if (takersError) {
        return new NextResponse(`Export failed: ${takersError.message}`, {
          status: 500,
        });
      }

      const batch = (takerRows ?? []) as ExportTakerRow[];

      allTakers.push(...batch);

      const takerIds = batch.map((taker) => taker.id).filter(Boolean);

      if (takerIds.length) {
        const [resultsResult, submissionsResult, qscResult] =
          await Promise.all([
            sb
              .from("test_results")
              .select("taker_id, created_at, totals")
              .in("taker_id", takerIds),
            sb
              .from("test_submissions")
              .select("id, taker_id, test_id, created_at, totals")
              .in("taker_id", takerIds),
            sb
              .from("qsc_results")
              .select(
                "taker_id, test_id, created_at, audience, primary_personality, primary_mindset, combined_profile_code"
              )
              .in("taker_id", takerIds),
          ]);

        if (!resultsResult.error) {
          for (const row of (resultsResult.data ?? []) as ResultRow[]) {
            const takerId = normaliseText(row.taker_id);

            if (!takerId) continue;

            latestResultByTaker.set(
              takerId,
              getLatestRow(latestResultByTaker.get(takerId), row)
            );
          }
        }

        if (!submissionsResult.error) {
          for (const row of (submissionsResult.data ?? []) as SubmissionRow[]) {
            const takerId = normaliseText(row.taker_id);
            const testId = normaliseText(row.test_id);

            if (!takerId) continue;

            latestSubmissionByTaker.set(
              takerId,
              getLatestRow(latestSubmissionByTaker.get(takerId), row)
            );

            if (testId) {
              const key = `${takerId}|${testId}`;

              latestSubmissionByTakerAndTest.set(
                key,
                getLatestRow(
                  latestSubmissionByTakerAndTest.get(key),
                  row
                )
              );
            }
          }
        }

        if (!qscResult.error) {
          for (const row of (qscResult.data ?? []) as QscResultRow[]) {
            const takerId = normaliseText(row.taker_id);
            const testId = normaliseText(row.test_id);

            if (!takerId) continue;

            latestQscByTaker.set(
              takerId,
              getLatestRow(latestQscByTaker.get(takerId), row)
            );

            if (testId) {
              const key = `${takerId}|${testId}`;

              latestQscByTakerAndTest.set(
                key,
                getLatestRow(latestQscByTakerAndTest.get(key), row)
              );
            }
          }
        }
      }

      hasMore = batch.length === pageSize;
      page += 1;
    }

    const header = [
      "Test Taker ID",
      "First Name",
      "Last Name",
      "Full Name",
      "Email",
      "Phone",
      "Company",
      "Role Title",
      "Created At",
      "Completion Status",
      "Completed At",
      "Latest Result At",
      "Submission ID",
      "Test ID",
      "Test Name",
      "Test Slug",
      "Assessment Type",
      "Test Name / Purpose",
      "Link Token",
      "Report Type",
      "Internal Profile URL",
      "Test-Taker Report URL",
      "Primary Frequency Code",
      "Primary Frequency",
      "Primary Frequency Score",
      "Primary Frequency Percent",
      "Frequency A Score",
      "Frequency A Percent",
      "Frequency B Score",
      "Frequency B Percent",
      "Frequency C Score",
      "Frequency C Percent",
      "Frequency D Score",
      "Frequency D Percent",
      "Frequency Mix",
      "Top Profile Code",
      "Top Profile",
      "Top Profile Score",
      "Top Profile Percent",
      "Profile Score Summary",
      "QSC Audience",
      "Personality Layer",
      "Mindset Layer",
      "Quantum Profile",
      "GED Business Stage",
      "GED Core Constraint",
      "GED Scale Readiness",
      "GED Strategic Self-Diagnosis",
    ];

    const csvRows = allTakers.map((taker) => {
      const testId = normaliseText(taker.test_id);
      const test = testById.get(testId);

      const submission =
        latestSubmissionByTakerAndTest.get(`${taker.id}|${testId}`) ||
        latestSubmissionByTaker.get(taker.id) ||
        null;

      const latestResult = latestResultByTaker.get(taker.id) || null;

      const qsc =
        latestQscByTakerAndTest.get(`${taker.id}|${testId}`) ||
        latestQscByTaker.get(taker.id) ||
        null;

      const totals =
        parseMaybeJson(latestResult?.totals) ||
        parseMaybeJson(submission?.totals);

      const frequencyScores = getNumberMap(totals?.frequencies);
      const profileScores = getNumberMap(totals?.profiles);

      const frequencyPercents = getPercentMap(frequencyScores);
      const profilePercents = getPercentMap(profileScores);

      const topFrequency = sortScores(frequencyScores)[0] || null;
      const topProfile = sortScores(profileScores)[0] || null;

      const topFrequencyCode = topFrequency?.[0] || "";
      const topProfileCode = topProfile?.[0] || "";

      const frequencyMix = sortScores(frequencyScores)
        .map(([code, score]) => {
          const label = getFrequencyLabel(testId, code);
          const percent = frequencyPercents[code] ?? 0;

          return `${label} (${code}): ${score} (${percent}%)`;
        })
        .join(" | ");

      const profileSummary = sortScores(profileScores)
        .map(([code, score]) => {
          const label = getProfileLabel(testId, code);
          const percent = profilePercents[code] ?? 0;

          return `${label} (${code}): ${score} (${percent}%)`;
        })
        .join(" | ");

      const gedDiagnostics =
        extractGedDiagnostics(submission?.totals) ||
        extractGedDiagnostics(latestResult?.totals) ||
        null;

      const fullName =
        [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() ||
        "";

      const reportPath = getReportPath({
        taker,
        test,
        qsc,
      });

      const reportUrl = toAbsoluteUrl(baseUrl, reportPath);
      const internalProfileUrl = `${baseUrl}/portal/${encodeURIComponent(
        org.slug
      )}/database/${encodeURIComponent(taker.id)}`;

      const reportType =
        reportVersionByToken.get(normaliseText(taker.link_token)) || "";

      const completedAt =
        submission?.created_at ||
        latestResult?.created_at ||
        (normaliseStatus(taker.status) === "Completed"
          ? taker.created_at
          : "");

      return [
        taker.id,
        taker.first_name || "",
        taker.last_name || "",
        fullName,
        taker.email || "",
        taker.phone || "",
        taker.company || "",
        taker.role_title || "",
        formatDate(taker.created_at),
        normaliseStatus(taker.status),
        formatDate(completedAt),
        formatDate(latestResult?.created_at),
        submission?.id || "",
        testId,
        test?.name || "",
        test?.slug || "",
        getAssessmentType(test),
        linkNameByToken.get(normaliseText(taker.link_token)) || "",
        taker.link_token || "",
        reportType,
        internalProfileUrl,
        reportUrl,
        topFrequencyCode,
        topFrequencyCode
          ? getFrequencyLabel(testId, topFrequencyCode)
          : "",
        topFrequency?.[1] ?? "",
        topFrequencyCode ? frequencyPercents[topFrequencyCode] ?? "" : "",
        frequencyScores.A ?? "",
        frequencyPercents.A ?? "",
        frequencyScores.B ?? "",
        frequencyPercents.B ?? "",
        frequencyScores.C ?? "",
        frequencyPercents.C ?? "",
        frequencyScores.D ?? "",
        frequencyPercents.D ?? "",
        frequencyMix,
        topProfileCode,
        topProfileCode ? getProfileLabel(testId, topProfileCode) : "",
        topProfile?.[1] ?? "",
        topProfileCode ? profilePercents[topProfileCode] ?? "" : "",
        profileSummary,
        qsc?.audience || "",
        formatDisplay(qsc?.primary_personality),
        formatDisplay(qsc?.primary_mindset),
        formatDisplay(qsc?.combined_profile_code),
        gedAnswerText(gedDiagnostics?.business_stage || null),
        gedAnswerText(gedDiagnostics?.core_constraint || null),
        gedAnswerText(gedDiagnostics?.scale_readiness || null),
        gedDiagnostics?.self_diagnosis || "",
      ]
        .map(csvEscape)
        .join(",");
    });

    const csv = [header.join(","), ...csvRows].join("\r\n");

    const orgFileName = safeFilenamePart(org.slug || orgSlug) || "organisation";
    const datePart = new Date().toISOString().slice(0, 10);

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mindcanvas-crm-export-${orgFileName}-${datePart}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return new NextResponse(
      `Export failed: ${error?.message || "Unknown server error"}`,
      {
        status: 500,
      }
    );
  }
}
