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
    | "candidate_assessment"
    | "reverse_role_assessment"
    | "internal_validation";
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
    ])
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
    resultUrl:
      testLink.report_version === "full" ? fullReportUrl : snapshotUrl,
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
        { status: 400 }
      );
    }

    const candidateCheck = validateCandidate(candidatePayload);

    if (!candidateCheck.ok) {
      return NextResponse.json({ error: candidateCheck.error }, { status: 400 });
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
        ].join(", ")
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
        { status: 500 }
      );
    }

    if (!application) {
      return NextResponse.json(
        { error: "invalid candidate application token" },
        { status: 404 }
      );
    }

    if (!application.test_link_id) {
      return NextResponse.json(
        {
          error:
            "this candidate application is not connected to an MCAS reusable test link",
        },
        { status: 400 }
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
        ].join(", ")
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
        { status: 500 }
      );
    }

    if (!testLink) {
      return NextResponse.json(
        { error: "the test link for this application could not be found" },
        { status: 404 }
      );
    }

    if (testLink.status !== "active") {
      return NextResponse.json(
        { error: `test link is ${testLink.status}` },
        { status: 403 }
      );
    }

    if (testLink.link_type !== "candidate_assessment") {
      return NextResponse.json(
        { error: "this link is not a candidate assessment link" },
        { status: 400 }
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
        { status: 500 }
      );
    }

    if (!framework || !isRecord(framework.definition)) {
      return NextResponse.json(
        { error: "framework not found" },
        { status: 404 }
      );
    }

    const questions: FrameworkQuestion[] = Array.isArray(
      framework.definition.questions
    )
      ? (framework.definition.questions as FrameworkQuestion[])
      : [];

    if (questions.length !== 25) {
      return NextResponse.json(
        { error: `framework must have 25 questions; found ${questions.length}` },
        { status: 500 }
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
          { status: 400 }
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
        { status: 500 }
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
        { status: 500 }
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
          { status: 500 }
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
          { status: 500 }
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
        { status: 500 }
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
          { status: 500 }
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
          { status: 500 }
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
        { status: 500 }
      );
    }

    const answerRows = Array.from(answerMap.entries()).map(
      ([question_code, option_code]) => ({
        assessment_id: assessmentId,
        question_code,
        option_code,
        response_time_ms: null,
      })
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
        { status: 500 }
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
          { status: 500 }
        );
      }

      const option = question.options.find(
        (candidateOption) => candidateOption.code === optionCode
      );

      if (!option) {
        return NextResponse.json(
          { error: `invalid option ${questionCode}:${optionCode}` },
          { status: 400 }
        );
      }

      if (question.section === "operating_style") {
        if (
          typeof option.points !== "number" ||
          !option.os ||
          !option.core
        ) {
          return NextResponse.json(
            { error: `missing scoring metadata on ${questionCode}:${optionCode}` },
            { status: 500 }
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
              { status: 500 }
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
      { onConflict: "assessment_id" }
    );

    if (upsertResultError) {
      return NextResponse.json(
        {
          error: "failed to save assessment result",
          details: upsertResultError.message,
        },
        { status: 500 }
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
        { status: 500 }
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
        { status: 500 }
      );
    }

    const { resultUrl, snapshotUrl, fullReportUrl } = resultUrlsForLink(
      testLink,
      reportToken
    );

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
        operating_styles: osDistribution,
        vertical_level: verticalLevel,
      },
      confidence,
      flags,
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : String(caught);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}