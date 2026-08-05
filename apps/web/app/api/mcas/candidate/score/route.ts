// apps/web/app/api/mcas/candidate/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scoreMcasV2,
  type McasAnswers,
  type McasQuestion,
} from "@/lib/mcas/scoreMcasV2";
import {
  buildAtumaphireCandidateSections,
  buildAtumaphireExternalPayload,
  formatAtumaphireNarrative,
  normaliseAtumaphireOutputMode,
} from "@/lib/mcas/atumaphireOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } },
  );
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.MCAS_API_BEARER_TOKEN || "";
  if (!expected) return false;
  const received = getBearerToken(req);
  return !!received && received === expected;
}

type CandidatePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
};

type ReportContentBlock = {
  section_key: "oss" | "rfs" | "cvs";
  content: any;
};

function nowIso() {
  return new Date().toISOString();
}

function displayCvCode(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "CV1_2") return "CV1-2";
  if (code === "CV5_6") return "CV5-6";
  return code;
}

function legacyVerticalCode(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "CV1_2") return "V2";
  if (code === "CV3") return "V3";
  if (code === "CV4") return "V4";
  if (code === "CV5_6") return "V5";
  return code.replace(/^CV/, "V");
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const sb = mcasSupa();
    const body = await req.json();
    const outputMode = normaliseAtumaphireOutputMode(body?.output_mode);

    const partner_key = String(body?.partner_key || "").trim();
    const org_id = body?.org_id ? String(body.org_id).trim() : "";
    const application_id = String(body?.application_id || "").trim();
    const job_id = body?.job_id ? String(body.job_id).trim() : null;
    const campaign_id = body?.campaign_id
      ? String(body.campaign_id).trim()
      : null;

    const framework_slug =
      String(body?.framework_slug || "").trim() || "mcas-core-alignment";
    const framework_version =
      String(body?.framework_version || "").trim() || "v1";

    const candidate: CandidatePayload =
      body?.candidate && typeof body.candidate === "object"
        ? body.candidate
        : {};

    const first_name = String(candidate.first_name || "").trim();
    const last_name = String(candidate.last_name || "").trim();
    const email = String(candidate.email || "")
      .trim()
      .toLowerCase();
    const phone = String(candidate.phone || "").trim();
    const consent = Boolean(candidate.consent);

    const answers = (body?.answers || {}) as McasAnswers;

    if (!partner_key) {
      return NextResponse.json(
        { ok: false, error: "partner_key is required" },
        { status: 400 },
      );
    }

    if (!org_id) {
      return NextResponse.json(
        { ok: false, error: "org_id is required" },
        { status: 400 },
      );
    }

    if (!application_id) {
      return NextResponse.json(
        { ok: false, error: "application_id is required" },
        { status: 400 },
      );
    }

    if (!first_name || !last_name || !email || !phone || !consent) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "candidate fields required: first_name, last_name, email, phone, consent=true",
        },
        { status: 400 },
      );
    }

    for (let i = 1; i <= 25; i++) {
      const qCode = `Q${i}`;
      if (!answers[qCode]) {
        return NextResponse.json(
          { ok: false, error: `Missing answer for ${qCode}` },
          { status: 400 },
        );
      }
    }

    const { data: partner, error: partnerErr } = await sb
      .from("partners")
      .select("partner_key, is_active, allowed_org_id")
      .eq("partner_key", partner_key)
      .maybeSingle();

    if (partnerErr) {
      return NextResponse.json(
        { ok: false, error: partnerErr.message },
        { status: 500 },
      );
    }

    if (!partner || !partner.is_active) {
      return NextResponse.json(
        { ok: false, error: "Invalid or inactive partner_key" },
        { status: 400 },
      );
    }

    if (partner.allowed_org_id && partner.allowed_org_id !== org_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Partner is not authorised for this org_id",
        },
        { status: 403 },
      );
    }

    const { data: fw, error: fwErr } = await sb
      .from("frameworks")
      .select("slug, version, definition")
      .eq("slug", framework_slug)
      .eq("version", framework_version)
      .maybeSingle();

    if (fwErr) {
      return NextResponse.json(
        { ok: false, error: fwErr.message },
        { status: 500 },
      );
    }

    if (!fw) {
      return NextResponse.json(
        { ok: false, error: "Framework not found" },
        { status: 404 },
      );
    }

    const definition = (fw.definition || {}) as any;

    const questions: McasQuestion[] = Array.isArray(definition.questions)
      ? definition.questions
      : [];

    if (questions.length !== 25) {
      return NextResponse.json(
        {
          ok: false,
          error: `Framework must contain 25 questions. Found ${questions.length}.`,
        },
        { status: 500 },
      );
    }

    const labels = definition.labels || {};
    const osLabels: Record<string, string> = labels.operating_styles || {};
    const coreLabels: Record<string, string> = labels.core || {
      C: "Create",
      O: "Organise",
      R: "Resolve",
      E: "Examine",
    };
    const cvLabels: Record<string, string> = labels.career_verticals || {};

    const { data: existingApp, error: findAppErr } = await sb
      .from("partner_applications")
      .select("*")
      .eq("partner_key", partner_key)
      .eq("application_id", application_id)
      .maybeSingle();

    if (findAppErr) {
      return NextResponse.json(
        { ok: false, error: findAppErr.message },
        { status: 500 },
      );
    }

    let applicationRow: any = existingApp;

    if (!applicationRow) {
      const { data: createdApp, error: createAppErr } = await sb
        .from("partner_applications")
        .insert({
          partner_key,
          application_id,
          org_id,
          framework_slug,
          framework_version,
          status: "started",
          started_at: nowIso(),
          candidate_first_name: first_name,
          candidate_last_name: last_name,
          candidate_email: email,
          candidate_phone: phone,
          consent: true,
        })
        .select("*")
        .single();

      if (createAppErr || !createdApp) {
        return NextResponse.json(
          {
            ok: false,
            error:
              createAppErr?.message || "Failed to create partner application",
          },
          { status: 500 },
        );
      }

      applicationRow = createdApp;
    } else {
      const { data: updatedApp, error: updateAppErr } = await sb
        .from("partner_applications")
        .update({
          org_id,
          framework_slug,
          framework_version,
          candidate_first_name: first_name,
          candidate_last_name: last_name,
          candidate_email: email,
          candidate_phone: phone,
          consent: true,
          status: applicationRow.started_at ? applicationRow.status : "started",
          started_at: applicationRow.started_at || nowIso(),
        })
        .eq("id", applicationRow.id)
        .select("*")
        .single();

      if (updateAppErr || !updatedApp) {
        return NextResponse.json(
          {
            ok: false,
            error:
              updateAppErr?.message || "Failed to update partner application",
          },
          { status: 500 },
        );
      }

      applicationRow = updatedApp;
    }

    let individualId: string | null = null;

    const { data: existingInd } = await sb
      .from("individuals")
      .select("id")
      .eq("org_id", org_id)
      .eq("email", email)
      .maybeSingle();

    if (existingInd?.id) {
      individualId = existingInd.id;
      await sb
        .from("individuals")
        .update({ first_name, last_name })
        .eq("id", individualId);
    } else {
      const { data: createdInd, error: indErr } = await sb
        .from("individuals")
        .insert({
          org_id,
          email,
          first_name,
          last_name,
          external_ref: `${partner_key}:${application_id}`,
        })
        .select("id")
        .single();

      if (indErr) {
        return NextResponse.json(
          { ok: false, error: "Failed to create individual" },
          { status: 500 },
        );
      }

      individualId = createdInd.id;
    }

    const { data: existingAssessment, error: findAssessmentErr } = await sb
      .from("assessments")
      .select("id, status")
      .eq("partner_application_id", applicationRow.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findAssessmentErr) {
      return NextResponse.json(
        { ok: false, error: findAssessmentErr.message },
        { status: 500 },
      );
    }

    let assessmentId = existingAssessment?.id as string | undefined;

    if (!assessmentId) {
      const { data: createdAssessment, error: createAssessmentErr } = await sb
        .from("assessments")
        .insert({
          partner_application_id: applicationRow.id,
          individual_id: individualId,
          framework_slug,
          framework_version,
          status: "started",
        })
        .select("id")
        .single();

      if (createAssessmentErr || !createdAssessment) {
        return NextResponse.json(
          {
            ok: false,
            error:
              createAssessmentErr?.message || "Failed to create assessment",
          },
          { status: 500 },
        );
      }

      assessmentId = createdAssessment.id;
    }

    await sb
      .from("assessment_answers")
      .delete()
      .eq("assessment_id", assessmentId);

    const answerRows = Object.entries(answers).map(
      ([question_code, option_code]) => ({
        assessment_id: assessmentId!,
        question_code,
        option_code,
        response_time_ms: null,
      }),
    );

    const { error: ansErr } = await sb
      .from("assessment_answers")
      .insert(answerRows);

    if (ansErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to save answers" },
        { status: 500 },
      );
    }

    const scoring = scoreMcasV2({
      answers,
      questions,
      osLabels,
      coreLabels,
      cvLabels,
    });

    const scoring_model_version = "mcas-v2-distribution";

    const primaryOperatingStyle = scoring.primary_operating_style;
    const primaryCareerVertical = scoring.primary_career_vertical;

    const careerVerticalCode = primaryCareerVertical?.code || null;
    const careerVerticalDisplayCode = displayCvCode(careerVerticalCode);
    const careerVerticalLabel =
      primaryCareerVertical?.label ||
      careerVerticalDisplayCode ||
      careerVerticalCode ||
      null;

    const flags: Array<{ code: string; severity: string }> = [];

    if (scoring.readiness_signal?.code) {
      const readinessCode = String(scoring.readiness_signal.code).toUpperCase();

      let severity = "low";
      if (readinessCode === "OVERREACH_RISK") severity = "high";
      if (readinessCode === "VERTICAL_CONFIDENCE_LOW") severity = "medium";

      flags.push({
        code: readinessCode,
        severity,
      });
    }

    await sb.from("results").delete().eq("assessment_id", assessmentId);

    const resultRow = {
      assessment_id: assessmentId,
      scoring_model: scoring_model_version,
      core_distribution: scoring.behavioural_approach_distribution,
      os_distribution: scoring.operating_style_ranking.map((x: any) => ({
        code: x.code,
        pct: x.pct,
      })),
      vertical_readiness:
        legacyVerticalCode(careerVerticalCode) || careerVerticalDisplayCode,
      confidence: scoring.confidence,
      flags,
    };

    const { error: resErr } = await sb.from("results").insert(resultRow);

    if (resErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to save result" },
        { status: 500 },
      );
    }

    const completedAt = nowIso();

    await sb
      .from("assessments")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", assessmentId);

    await sb
      .from("partner_applications")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", applicationRow.id);

    let reportContentBySection: Record<"oss" | "rfs" | "cvs", any> = {
      oss: null,
      rfs: null,
      cvs: null,
    };

    if (primaryOperatingStyle?.code) {
      const { data: reportBlocks, error: reportErr } = await sb
        .from("report_content_blocks")
        .select("section_key, content")
        .eq("framework_slug", framework_slug)
        .eq("framework_version", framework_version)
        .eq("operating_style_code", primaryOperatingStyle.code)
        .eq("is_active", true)
        .in("section_key", ["oss", "rfs", "cvs"]);

      if (reportErr) {
        return NextResponse.json(
          { ok: false, error: reportErr.message },
          { status: 500 },
        );
      }

      for (const block of (reportBlocks || []) as ReportContentBlock[]) {
        reportContentBySection[block.section_key] = block.content;
      }
    }

    const fallbackOperatingStyleSummary = {
      operating_style: primaryOperatingStyle
        ? {
            code: primaryOperatingStyle.code,
            label: primaryOperatingStyle.label,
          }
        : null,
      summary: null,
      natural_strengths: [],
      team_contribution_style: null,
      decision_making_style: null,
      friction_points: [],
    };

    const fallbackRoleFitSummary = {
      top_role_alignment: null,
      ideal_role_types: [],
      capacity_to_perform: null,
      role_risks: [],
    };

    const fallbackCareerVerticalSummary = {
      career_vertical_expression: null,
      levels: {},
    };

    const careerVerticalSummaryContent =
      reportContentBySection.cvs || fallbackCareerVerticalSummary;

    const scoringPayload = {
      model_version: scoring_model_version,

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

      career_vertical: {
        code: careerVerticalCode,
        display_code: careerVerticalDisplayCode,
        label: careerVerticalLabel,
        pct: primaryCareerVertical?.pct ?? null,
      },

      readiness_signal: scoring.readiness_signal,
      flags,
      confidence: scoring.confidence,
    };

    const operatingStyleSummary =
      reportContentBySection.oss || fallbackOperatingStyleSummary;
    const roleFitSummary = reportContentBySection.rfs || fallbackRoleFitSummary;
    const careerVerticalSummary = {
      ...careerVerticalSummaryContent,
      current_vertical: {
        code: careerVerticalCode,
        display_code: careerVerticalDisplayCode,
        label: careerVerticalLabel,
        pct: primaryCareerVertical?.pct ?? null,
        summary:
          careerVerticalSummaryContent?.levels?.[careerVerticalCode || ""] ||
          careerVerticalSummaryContent?.levels?.[
            displayCvCode(careerVerticalCode) || ""
          ] ||
          null,
      },
      readiness_signal: scoring.readiness_signal,
    };

    const threeSectionNarrative = buildAtumaphireCandidateSections({
      scoring: scoringPayload,
      operatingStyleSummary,
      roleFitSummary,
      careerVerticalSummary,
    });

    const narrative = formatAtumaphireNarrative(
      threeSectionNarrative,
      outputMode,
    );

    const internalPayload = {
      ok: true,
      type: "candidate_profile_result",
      meta: {
        application_id: applicationRow.application_id,
        partner_application_id: applicationRow.id,
        assessment_id: assessmentId,
        scoring_model_version,
        completed_at: completedAt,
      },
      candidate: {
        first_name,
        last_name,
        email,
        phone,
      },
      partner: {
        partner_key,
      },
      org: {
        org_id,
      },
      job: {
        job_id,
        campaign_id,
      },
      framework: {
        slug: framework_slug,
        version: framework_version,
      },
      result: {
        scoring: scoringPayload,
        report: {
          operating_style_summary: operatingStyleSummary,
          role_fit_summary: roleFitSummary,
          career_vertical_summary: careerVerticalSummary,
        },
        audit: scoring.audit,
      },
    };

    const responsePayload = buildAtumaphireExternalPayload({
      sourcePayload: internalPayload,
      scoring: scoringPayload,
      narrative,
      outputMode,
    });

    return NextResponse.json(responsePayload);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
