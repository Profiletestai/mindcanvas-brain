// apps/web/app/api/public/mcas/[token]/submit/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type IncomingAnswer = {
  question_code: string;
  option_code: string;
};

type CandidatePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
};

type McasPartnerApplicationRow = {
  id: string;
  org_id: string;
  partner_key: string;
  application_id: string;
  public_token: string;
  test_link_id: string | null;
  framework_slug: string;
  framework_version: string;
  status: string;
  started_at: string | null;
};

type McasTestLinkRow = {
  id: string;
  public_token: string;
  link_type:
    "candidate_assessment" | "reverse_role_assessment" | "internal_validation";
  framework_slug: string;
  framework_version: string;
  name: string;
  report_version: "lite" | "full";
  show_results: boolean;
  email_report: boolean;
  next_steps_url: string | null;
  status: "active" | "paused" | "expired" | "archived";
};

type FrameworkOption = {
  code: string;
  label: string;
  points?: number;
  os?: string;
  core?: "C" | "O" | "R" | "E";
  vertical_band?: "1-2" | "3" | "4" | "5-6";
  flag?: string;
};

type FrameworkQuestion = {
  code: string;
  section: "operating_style" | "career_vertical";
  prompt: string;
  options: FrameworkOption[];
};

type McasFrameworkRow = {
  slug: string;
  version: string;
  definition: unknown;
};

type McasAssessmentRow = {
  id: string;
  report_token: string;
  status: string;
};

type GhlCustomField = {
  id?: string;
  key?: string;
  fieldValue: string;
};

type GhlSyncResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  message?: string;
  contactId?: string;
  tags?: string[];
};

type RankedOperatingStyle = {
  code: string;
  label: string;
  pct: number;
  rank: number;
};

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    db: { schema: "mcas" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function asStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, label]) => [cleanText(key), cleanText(label)])
      .filter(([key, label]) => Boolean(key && label)),
  );
}

function percentageValue(value: number | undefined) {
  return Number(((Number(value) || 0) * 100).toFixed(2));
}

function absoluteUrl(req: Request, value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";

  try {
    return new URL(cleaned, req.url).toString();
  } catch {
    return cleaned;
  }
}

function pushGhlCustomField(
  customFields: GhlCustomField[],
  identifier: string | undefined,
  value: unknown,
) {
  const fieldValue = cleanText(value);
  const token = cleanText(identifier);

  if (!token || !fieldValue) return;

  if (token.startsWith("key:")) {
    const key = cleanText(token.slice(4));
    if (key) customFields.push({ key, fieldValue });
    return;
  }

  if (token.startsWith("id:")) {
    const id = cleanText(token.slice(3));
    if (id) customFields.push({ id, fieldValue });
    return;
  }

  customFields.push({ id: token, fieldValue });
}

function uniqueTags(values: unknown[]) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values) {
    const tag = cleanText(value);
    if (!tag) continue;

    const comparisonKey = tag.toLowerCase();
    if (seen.has(comparisonKey)) continue;

    seen.add(comparisonKey);
    tags.push(tag);
  }

  return tags;
}

function readinessSignal(args: {
  verticalReadiness: boolean;
  verticalConfidence: "low" | "matched" | null;
  overreachRisk: boolean;
}) {
  if (args.overreachRisk) return "Overreach risk identified";
  if (args.verticalReadiness) return "Ready for broader responsibility";
  if (args.verticalConfidence === "matched") return "Current vertical matched";
  if (args.verticalConfidence === "low") return "Vertical confidence is low";
  return "No additional readiness signal";
}

async function syncMcasToProfiletestGhl(args: {
  orgId: string;
  candidate: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  applicationId: string;
  assessmentId: string;
  completedAt: string;
  testLinkName: string;
  reportVersion: "lite" | "full";
  reportUrl: string;
  resultUrl: string;
  primaryCareerVerticalCode: string;
  primaryCareerVerticalLabel: string;
  readinessSignal: string;
  operatingStyles: RankedOperatingStyle[];
  coreDistribution: Record<string, number>;
}): Promise<GhlSyncResult> {
  const profiletestOrgId = cleanText(process.env.MCAS_PROFILETEST_ORG_ID);

  if (!profiletestOrgId) {
    return {
      ok: false,
      skipped: true,
      message:
        "Skipped MCAS GHL sync because MCAS_PROFILETEST_ORG_ID is missing.",
    };
  }

  if (cleanText(args.orgId) !== profiletestOrgId) {
    return {
      ok: false,
      skipped: true,
      message: "Skipped MCAS GHL sync because this is not Profiletest.ai.",
    };
  }

  const endpoint =
    cleanText(process.env.MCAS_GHL_CONTACT_UPSERT_URL) ||
    cleanText(process.env.GHL_CONTACT_UPSERT_URL) ||
    "https://services.leadconnectorhq.com/contacts/upsert";

  const apiKey =
    cleanText(process.env.MCAS_GHL_API_KEY) ||
    cleanText(process.env.GHL_API_KEY);

  const locationId =
    cleanText(process.env.MCAS_GHL_LOCATION_ID) ||
    cleanText(process.env.GHL_LOCATION_ID);

  const apiVersion =
    cleanText(process.env.MCAS_GHL_API_VERSION) ||
    cleanText(process.env.GHL_API_VERSION) ||
    "2021-07-28";

  if (!endpoint || !apiKey || !locationId) {
    return {
      ok: false,
      skipped: true,
      message:
        "Skipped MCAS GHL sync because the GHL endpoint, API key, or location ID is missing.",
    };
  }

  const email = cleanEmail(args.candidate.email);
  const phone = cleanText(args.candidate.phone);

  if (!email && !phone) {
    return {
      ok: false,
      skipped: true,
      message:
        "Skipped MCAS GHL sync because the candidate has neither email nor phone.",
    };
  }

  const customFields: GhlCustomField[] = [];
  const primary = args.operatingStyles[0] || null;
  const secondary = args.operatingStyles[1] || null;
  const tertiary = args.operatingStyles[2] || null;

  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_PRIMARY_OPERATING_STYLE,
    primary?.label || primary?.code,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_SECONDARY_OPERATING_STYLE,
    secondary?.label || secondary?.code,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_TERTIARY_OPERATING_STYLE,
    tertiary?.label || tertiary?.code,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_PRIMARY_CAREER_VERTICAL,
    args.primaryCareerVerticalLabel,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_CAREER_VERTICAL_CODE,
    args.primaryCareerVerticalCode,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_READINESS_SIGNAL,
    args.readinessSignal,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_CORE_CREATE_PERCENTAGE,
    percentageValue(args.coreDistribution.C),
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_CORE_ORGANISE_PERCENTAGE,
    percentageValue(args.coreDistribution.O),
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_CORE_RESOLVE_PERCENTAGE,
    percentageValue(args.coreDistribution.R),
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_CORE_EXAMINE_PERCENTAGE,
    percentageValue(args.coreDistribution.E),
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_REPORT_URL,
    args.reportUrl,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_RESULT_URL,
    args.resultUrl,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_REPORT_VERSION,
    args.reportVersion,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_ASSESSMENT_NAME,
    args.testLinkName,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_APPLICATION_ID,
    args.applicationId,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_ASSESSMENT_ID,
    args.assessmentId,
  );
  pushGhlCustomField(
    customFields,
    process.env.GHL_CF_MCAS_COMPLETED_AT,
    args.completedAt,
  );

  const fullName = [args.candidate.first_name, args.candidate.last_name]
    .map(cleanText)
    .filter(Boolean)
    .join(" ")
    .trim();

  const payload = {
    locationId,
    firstName: cleanText(args.candidate.first_name) || undefined,
    lastName: cleanText(args.candidate.last_name) || undefined,
    name: fullName || undefined,
    email: email || undefined,
    phone: phone || undefined,
    source: "MindCanvas MCAS",
    customFields: customFields.length ? customFields : undefined,
  };

  try {
    const upsertResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: apiVersion,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const rawUpsertResponse = await upsertResponse.text();
    let parsedUpsertResponse: unknown = rawUpsertResponse;

    try {
      parsedUpsertResponse = rawUpsertResponse
        ? JSON.parse(rawUpsertResponse)
        : null;
    } catch {
      // Keep the raw response for logging.
    }

    if (!upsertResponse.ok) {
      console.error("[MCAS GHL] Contact upsert failed", {
        status: upsertResponse.status,
        response: parsedUpsertResponse,
      });

      return {
        ok: false,
        status: upsertResponse.status,
        message: `MCAS GHL contact upsert failed with status ${upsertResponse.status}.`,
      };
    }

    const responseRecord = isRecord(parsedUpsertResponse)
      ? parsedUpsertResponse
      : {};
    const responseContact = isRecord(responseRecord.contact)
      ? responseRecord.contact
      : {};
    const contactId =
      cleanText(responseContact.id) || cleanText(responseRecord.contactId);

    if (!contactId) {
      return {
        ok: false,
        status: upsertResponse.status,
        message:
          "MCAS GHL contact was upserted, but the response did not contain a contact ID.",
      };
    }

    const completionTag =
      cleanText(process.env.GHL_TAG_MCAS_COMPLETED_ASSESSMENT) ||
      "MCAS_completed_assessment";

    const tags = uniqueTags([completionTag, args.testLinkName]);

    if (!tags.length) {
      return {
        ok: true,
        status: upsertResponse.status,
        contactId,
        tags: [],
      };
    }

    let serviceOrigin = "https://services.leadconnectorhq.com";
    try {
      serviceOrigin = new URL(endpoint).origin;
    } catch {
      // Keep the standard LeadConnector service origin.
    }

    const tagsEndpoint = `${serviceOrigin}/contacts/${encodeURIComponent(
      contactId,
    )}/tags`;

    const tagResponse = await fetch(tagsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: apiVersion,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags }),
      cache: "no-store",
    });

    const rawTagResponse = await tagResponse.text();
    let parsedTagResponse: unknown = rawTagResponse;

    try {
      parsedTagResponse = rawTagResponse ? JSON.parse(rawTagResponse) : null;
    } catch {
      // Keep the raw response for logging.
    }

    if (!tagResponse.ok) {
      console.error("[MCAS GHL] Adding contact tags failed", {
        status: tagResponse.status,
        tags,
        response: parsedTagResponse,
      });

      return {
        ok: false,
        status: tagResponse.status,
        contactId,
        tags,
        message: `MCAS GHL contact was upserted, but adding tags failed with status ${tagResponse.status}.`,
      };
    }

    return {
      ok: true,
      status: tagResponse.status,
      contactId,
      tags,
    };
  } catch (caught) {
    return {
      ok: false,
      message: `MCAS GHL sync request failed: ${
        caught instanceof Error ? caught.message : String(caught)
      }`,
    };
  }
}

function verticalBandMidpoint(band: string): number | null {
  switch (band) {
    case "1-2":
      return 1.5;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5-6":
      return 5.5;
    default:
      return null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normaliseDistribution(totals: Record<string, number>) {
  const total =
    Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      Number((value / total).toFixed(4)),
    ]),
  ) as Record<string, number>;
}

function validateCandidate(candidate: CandidatePayload) {
  const first_name = cleanText(candidate.first_name);
  const last_name = cleanText(candidate.last_name);
  const email = cleanText(candidate.email);
  const phone = cleanText(candidate.phone);
  const consent = Boolean(candidate.consent);

  if (!first_name || !last_name || !email || !phone || !consent) {
    return {
      ok: false as const,
      error:
        "candidate fields required: first_name, last_name, email, phone, consent=true",
    };
  }

  return {
    ok: true as const,
    candidate: {
      first_name,
      last_name,
      email,
      phone,
    },
  };
}

function resultUrlsForLink(testLink: McasTestLinkRow, reportToken: string) {
  const encodedToken = encodeURIComponent(reportToken);
  const snapshotUrl = `/mcas/r/${encodedToken}/snapshot`;
  const fullReportUrl = `/mcas/r/${encodedToken}/full`;

  if (!testLink.show_results) {
    return {
      resultUrl: testLink.next_steps_url || snapshotUrl,
      snapshotUrl,
      fullReportUrl,
    };
  }

  return {
    resultUrl: testLink.report_version === "full" ? fullReportUrl : snapshotUrl,
    snapshotUrl,
    fullReportUrl,
  };
}

export async function POST(req: Request, ctx: RouteContext) {
  const sb = mcasSupa();

  try {
    const { token } = await ctx.params;
    const applicationPublicToken = cleanText(token);

    if (!applicationPublicToken) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const answers: IncomingAnswer[] = Array.isArray(body?.answers)
      ? body.answers
      : [];
    const candidatePayload: CandidatePayload =
      body?.candidate && typeof body.candidate === "object"
        ? body.candidate
        : {};

    if (answers.length === 0) {
      return NextResponse.json(
        { error: "answers[] required" },
        { status: 400 },
      );
    }

    const candidateCheck = validateCandidate(candidatePayload);

    if (!candidateCheck.ok) {
      return NextResponse.json(
        { error: candidateCheck.error },
        { status: 400 },
      );
    }

    const candidate = candidateCheck.candidate;

    /*
     * The token belongs to a partner_application created by:
     * /mcas/link/[test-link-token] → Start assessment.
     */
    const { data: applicationData, error: applicationError } = await sb
      .from("partner_applications")
      .select(
        [
          "id",
          "org_id",
          "partner_key",
          "application_id",
          "public_token",
          "test_link_id",
          "framework_slug",
          "framework_version",
          "status",
          "started_at",
        ].join(", "),
      )
      .eq("public_token", applicationPublicToken)
      .maybeSingle();

    const application = applicationData as McasPartnerApplicationRow | null;

    if (applicationError) {
      return NextResponse.json(
        {
          error: "failed to resolve candidate application",
          details: applicationError.message,
        },
        { status: 500 },
      );
    }

    if (!application) {
      return NextResponse.json(
        { error: "invalid candidate application token" },
        { status: 404 },
      );
    }

    if (!application.test_link_id) {
      return NextResponse.json(
        {
          error:
            "this candidate application is not connected to an MCAS reusable test link",
        },
        { status: 400 },
      );
    }

    const { data: testLinkData, error: testLinkError } = await sb
      .from("test_links")
      .select(
        [
          "id",
          "public_token",
          "link_type",
          "framework_slug",
          "framework_version",
          "name",
          "report_version",
          "show_results",
          "email_report",
          "next_steps_url",
          "status",
        ].join(", "),
      )
      .eq("id", application.test_link_id)
      .maybeSingle();

    const testLink = testLinkData as McasTestLinkRow | null;

    if (testLinkError) {
      return NextResponse.json(
        {
          error: "failed to resolve test link",
          details: testLinkError.message,
        },
        { status: 500 },
      );
    }

    if (!testLink) {
      return NextResponse.json(
        { error: "the test link for this application could not be found" },
        { status: 404 },
      );
    }

    if (testLink.status !== "active") {
      return NextResponse.json(
        { error: `test link is ${testLink.status}` },
        { status: 403 },
      );
    }

    if (testLink.link_type !== "candidate_assessment") {
      return NextResponse.json(
        { error: "this link is not a candidate assessment link" },
        { status: 400 },
      );
    }

    const { data: frameworkData, error: frameworkError } = await sb
      .from("frameworks")
      .select("slug, version, definition")
      .eq("slug", application.framework_slug)
      .eq("version", application.framework_version)
      .maybeSingle();

    const framework = frameworkData as McasFrameworkRow | null;

    if (frameworkError) {
      return NextResponse.json(
        {
          error: "failed to load framework",
          details: frameworkError.message,
        },
        { status: 500 },
      );
    }

    if (!framework || !isRecord(framework.definition)) {
      return NextResponse.json(
        { error: "framework not found" },
        { status: 404 },
      );
    }

    const questions: FrameworkQuestion[] = Array.isArray(
      framework.definition.questions,
    )
      ? (framework.definition.questions as FrameworkQuestion[])
      : [];

    const labels = isRecord(framework.definition.labels)
      ? framework.definition.labels
      : {};
    const operatingStyleLabels = asStringMap(labels.operating_styles);
    const careerVerticalLabels = asStringMap(labels.career_verticals);

    if (questions.length !== 25) {
      return NextResponse.json(
        {
          error: `framework must have 25 questions; found ${questions.length}`,
        },
        { status: 500 },
      );
    }

    const questionMap = new Map<string, FrameworkQuestion>();
    for (const question of questions) {
      questionMap.set(question.code, question);
    }

    const answerMap = new Map<string, string>();
    for (const answer of answers) {
      const questionCode = cleanText(answer.question_code);
      const optionCode = cleanText(answer.option_code);

      if (questionCode && optionCode) {
        answerMap.set(questionCode, optionCode);
      }
    }

    for (let number = 1; number <= 25; number += 1) {
      const questionCode = `Q${number}`;

      if (!answerMap.has(questionCode)) {
        return NextResponse.json(
          { error: `missing answer for ${questionCode}` },
          { status: 400 },
        );
      }
    }

    const startedAt = application.started_at || nowIso();

    const { error: applicationUpdateError } = await sb
      .from("partner_applications")
      .update({
        candidate_first_name: candidate.first_name,
        candidate_last_name: candidate.last_name,
        candidate_email: candidate.email,
        candidate_phone: candidate.phone,
        consent: true,
        status: "started",
        started_at: startedAt,
      })
      .eq("id", application.id);

    if (applicationUpdateError) {
      return NextResponse.json(
        {
          error: "failed to save candidate details",
          details: applicationUpdateError.message,
        },
        { status: 500 },
      );
    }

    const { data: existingIndividual, error: individualLookupError } = await sb
      .from("individuals")
      .select("id")
      .eq("org_id", application.org_id)
      .eq("email", candidate.email)
      .maybeSingle();

    if (individualLookupError) {
      return NextResponse.json(
        {
          error: "failed to look up candidate profile",
          details: individualLookupError.message,
        },
        { status: 500 },
      );
    }

    let individualId: string;

    if (existingIndividual?.id) {
      individualId = String(existingIndividual.id);

      const { error: updateIndividualError } = await sb
        .from("individuals")
        .update({
          first_name: candidate.first_name,
          last_name: candidate.last_name,
        })
        .eq("id", individualId);

      if (updateIndividualError) {
        return NextResponse.json(
          {
            error: "failed to update candidate profile",
            details: updateIndividualError.message,
          },
          { status: 500 },
        );
      }
    } else {
      const { data: createdIndividual, error: createIndividualError } = await sb
        .from("individuals")
        .insert({
          org_id: application.org_id,
          email: candidate.email,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          external_ref: `${application.partner_key}:${application.application_id}`,
        })
        .select("id")
        .single();

      if (createIndividualError || !createdIndividual?.id) {
        return NextResponse.json(
          {
            error: "failed to create candidate profile",
            details:
              createIndividualError?.message ?? "No candidate profile returned",
          },
          { status: 500 },
        );
      }

      individualId = String(createdIndividual.id);
    }

    const assessmentMeta = {
      source: "reusable_test_link",
      test_link_id: testLink.id,
      test_link_public_token: testLink.public_token,
      test_link_name: testLink.name,
      report_version: testLink.report_version,
      show_results: testLink.show_results,
      email_report: testLink.email_report,
      next_steps_url: testLink.next_steps_url,
      candidate: {
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: candidate.email,
        phone: candidate.phone,
        consent: true,
        consent_at: nowIso(),
      },
    };

    const { data: existingAssessmentData, error: existingAssessmentError } =
      await sb
        .from("assessments")
        .select("id, report_token, status")
        .eq("partner_application_id", application.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const existingAssessment =
      existingAssessmentData as McasAssessmentRow | null;

    if (existingAssessmentError) {
      return NextResponse.json(
        {
          error: "failed to look up assessment",
          details: existingAssessmentError.message,
        },
        { status: 500 },
      );
    }

    let assessmentId: string;
    let reportToken: string;

    if (existingAssessment?.id && existingAssessment.report_token) {
      assessmentId = existingAssessment.id;
      reportToken = existingAssessment.report_token;

      const { error: updateAssessmentError } = await sb
        .from("assessments")
        .update({
          test_link_id: testLink.id,
          individual_id: individualId,
          framework_slug: application.framework_slug,
          framework_version: application.framework_version,
          status: "started",
          meta: assessmentMeta,
        })
        .eq("id", assessmentId);

      if (updateAssessmentError) {
        return NextResponse.json(
          {
            error: "failed to update assessment",
            details: updateAssessmentError.message,
          },
          { status: 500 },
        );
      }
    } else {
      const { data: createdAssessmentData, error: createAssessmentError } =
        await sb
          .from("assessments")
          .insert({
            partner_application_id: application.id,
            test_link_id: testLink.id,
            individual_id: individualId,
            framework_slug: application.framework_slug,
            framework_version: application.framework_version,
            status: "started",
            meta: assessmentMeta,
          })
          .select("id, report_token")
          .single();

      const createdAssessment = createdAssessmentData as Pick<
        McasAssessmentRow,
        "id" | "report_token"
      > | null;

      if (
        createAssessmentError ||
        !createdAssessment?.id ||
        !createdAssessment.report_token
      ) {
        return NextResponse.json(
          {
            error: "failed to create assessment",
            details:
              createAssessmentError?.message ?? "No assessment token returned",
          },
          { status: 500 },
        );
      }

      assessmentId = createdAssessment.id;
      reportToken = createdAssessment.report_token;
    }

    const { error: deleteAnswersError } = await sb
      .from("assessment_answers")
      .delete()
      .eq("assessment_id", assessmentId);

    if (deleteAnswersError) {
      return NextResponse.json(
        {
          error: "failed to replace assessment answers",
          details: deleteAnswersError.message,
        },
        { status: 500 },
      );
    }

    const answerRows = Array.from(answerMap.entries()).map(
      ([question_code, option_code]) => ({
        assessment_id: assessmentId,
        question_code,
        option_code,
        response_time_ms: null,
      }),
    );

    const { error: insertAnswersError } = await sb
      .from("assessment_answers")
      .insert(answerRows);

    if (insertAnswersError) {
      return NextResponse.json(
        {
          error: "failed to save assessment answers",
          details: insertAnswersError.message,
        },
        { status: 500 },
      );
    }

    const coreTotals: Record<"C" | "O" | "R" | "E", number> = {
      C: 0,
      O: 0,
      R: 0,
      E: 0,
    };
    const osTotals: Record<string, number> = {};
    const verticalValues: number[] = [];
    const flags: Array<{
      code: string;
      severity: "low" | "medium" | "high";
    }> = [];

    let verticalConfidence: "low" | "matched" | null = null;
    let verticalReadiness = false;
    let overreachRisk = false;

    for (let number = 1; number <= 25; number += 1) {
      const questionCode = `Q${number}`;
      const optionCode = answerMap.get(questionCode);
      const question = questionMap.get(questionCode);

      if (!question || !optionCode) {
        return NextResponse.json(
          { error: `framework or answer missing for ${questionCode}` },
          { status: 500 },
        );
      }

      const option = question.options.find(
        (candidateOption) => candidateOption.code === optionCode,
      );

      if (!option) {
        return NextResponse.json(
          { error: `invalid option ${questionCode}:${optionCode}` },
          { status: 400 },
        );
      }

      if (question.section === "operating_style") {
        if (typeof option.points !== "number" || !option.os || !option.core) {
          return NextResponse.json(
            {
              error: `missing scoring metadata on ${questionCode}:${optionCode}`,
            },
            { status: 500 },
          );
        }

        coreTotals[option.core] += option.points;
        osTotals[option.os] = (osTotals[option.os] || 0) + option.points;
      }

      if (question.section === "career_vertical") {
        if (questionCode === "Q25") {
          if (option.flag === "overreach_risk") overreachRisk = true;
          if (option.flag === "vertical_confidence_low") {
            verticalConfidence = "low";
          }
          if (option.flag === "vertical_confidence_matched") {
            verticalConfidence = "matched";
          }
          if (option.flag === "vertical_readiness_signal") {
            verticalReadiness = true;
          }
        } else {
          const midpoint = option.vertical_band
            ? verticalBandMidpoint(option.vertical_band)
            : null;

          if (midpoint === null) {
            return NextResponse.json(
              {
                error: `missing vertical_band on ${questionCode}:${optionCode}`,
              },
              { status: 500 },
            );
          }

          verticalValues.push(midpoint);
        }
      }
    }

    if (overreachRisk) {
      flags.push({ code: "OVERREACH_RISK", severity: "high" });
    }
    if (verticalConfidence === "low") {
      flags.push({ code: "VERTICAL_CONFIDENCE_LOW", severity: "medium" });
    }
    if (verticalConfidence === "matched") {
      flags.push({ code: "VERTICAL_CONFIDENCE_MATCHED", severity: "low" });
    }
    if (verticalReadiness) {
      flags.push({ code: "VERTICAL_READINESS_SIGNAL", severity: "low" });
    }

    const coreDistribution = normaliseDistribution(coreTotals);

    const osDistributionRaw = Object.entries(osTotals)
      .map(([code, value]) => ({ code, pct: value }))
      .sort((left, right) => right.pct - left.pct);

    const osTotal =
      osDistributionRaw.reduce((sum, item) => sum + item.pct, 0) || 1;

    const osDistribution = osDistributionRaw.map((item) => ({
      code: item.code,
      pct: Number((item.pct / osTotal).toFixed(4)),
    }));

    const rankedOperatingStyles: RankedOperatingStyle[] = osDistribution.map(
      (item, index) => ({
        code: item.code,
        label: operatingStyleLabels[item.code] || item.code,
        pct: item.pct,
        rank: index + 1,
      }),
    );

    const verticalAverage =
      verticalValues.reduce((sum, value) => sum + value, 0) /
      (verticalValues.length || 1);

    const verticalLevel = clamp(Math.round(verticalAverage), 1, 6);
    const scoringModel = `mcas_${application.framework_version}_candidate_report_v1`;

    const confidence = {
      rating: "moderate",
      signals: {
        answered_count: 25,
        vertical_avg: Number(verticalAverage.toFixed(2)),
        vertical_level: verticalLevel,
        vertical_confidence: verticalConfidence,
        vertical_readiness: verticalReadiness,
        overreach_risk: overreachRisk,
      },
    };

    const { error: upsertResultError } = await sb.from("results").upsert(
      {
        assessment_id: assessmentId,
        scoring_model: scoringModel,
        core_distribution: coreDistribution,
        os_distribution: osDistribution,
        vertical_readiness: `V${verticalLevel}`,
        confidence,
        flags,
        computed_at: nowIso(),
      },
      { onConflict: "assessment_id" },
    );

    if (upsertResultError) {
      return NextResponse.json(
        {
          error: "failed to save assessment result",
          details: upsertResultError.message,
        },
        { status: 500 },
      );
    }

    const completedAt = nowIso();

    const { error: completeAssessmentError } = await sb
      .from("assessments")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", assessmentId);

    if (completeAssessmentError) {
      return NextResponse.json(
        {
          error: "failed to complete assessment",
          details: completeAssessmentError.message,
        },
        { status: 500 },
      );
    }

    const { error: completeApplicationError } = await sb
      .from("partner_applications")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", application.id);

    if (completeApplicationError) {
      return NextResponse.json(
        {
          error: "failed to complete candidate application",
          details: completeApplicationError.message,
        },
        { status: 500 },
      );
    }

    const { resultUrl, snapshotUrl, fullReportUrl } = resultUrlsForLink(
      testLink,
      reportToken,
    );

    const primaryCareerVerticalCode = `V${verticalLevel}`;
    const primaryCareerVerticalLabel =
      careerVerticalLabels[primaryCareerVerticalCode] ||
      primaryCareerVerticalCode;

    const reportPath =
      testLink.report_version === "full" ? fullReportUrl : snapshotUrl;

    const ghlSyncResult = await syncMcasToProfiletestGhl({
      orgId: application.org_id,
      candidate,
      applicationId: application.application_id,
      assessmentId,
      completedAt,
      testLinkName: testLink.name,
      reportVersion: testLink.report_version,
      reportUrl: absoluteUrl(req, reportPath),
      resultUrl: absoluteUrl(req, resultUrl),
      primaryCareerVerticalCode,
      primaryCareerVerticalLabel,
      readinessSignal: readinessSignal({
        verticalReadiness,
        verticalConfidence,
        overreachRisk,
      }),
      operatingStyles: rankedOperatingStyles,
      coreDistribution,
    });

    if (!ghlSyncResult.ok && !ghlSyncResult.skipped) {
      console.error(
        "[MCAS submit] Profiletest.ai GHL sync failed",
        ghlSyncResult,
      );
    } else if (ghlSyncResult.skipped) {
      console.warn(
        "[MCAS submit] Profiletest.ai GHL sync skipped",
        ghlSyncResult,
      );
    }

    return NextResponse.json({
      ok: true,
      status: "completed",
      application_id: application.application_id,
      assessmentId,
      reportToken,
      reportVersion: testLink.report_version,
      showResults: testLink.show_results,
      resultUrl,
      snapshotUrl,
      fullReportUrl,
      nextStepsUrl: testLink.next_steps_url,
      scoring_model: scoringModel,
      scores: {
        core: coreDistribution,
        operating_styles: rankedOperatingStyles,
        vertical_level: verticalLevel,
        vertical_code: primaryCareerVerticalCode,
        vertical_label: primaryCareerVerticalLabel,
      },
      confidence,
      flags,
      ghlSync: {
        ok: ghlSyncResult.ok,
        skipped: Boolean(ghlSyncResult.skipped),
        status: ghlSyncResult.status ?? null,
        message: ghlSyncResult.message ?? null,
        tags: ghlSyncResult.tags ?? [],
      },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}