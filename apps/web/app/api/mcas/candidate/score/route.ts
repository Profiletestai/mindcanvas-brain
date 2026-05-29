// apps/web/app/api/mcas/candidate/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
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

type AnswersMap = Record<string, string>;

type CandidatePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
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

type ReportContentBlock = {
  section_key: "oss" | "rfs" | "cvs";
  content: any;
};

function nowIso() {
  return new Date().toISOString();
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

function verticalBandToCode(band: string): string | null {
  switch (band) {
    case "1-2":
      return "V2";
    case "3":
      return "V3";
    case "4":
      return "V4";
    case "5-6":
      return "V5";
    default:
      return null;
  }
}

function displayCvCode(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "V2") return "CV1-2";
  if (code === "V5") return "CV5-6";
  return code.replace(/^V/, "CV");
}

function cvSortOrder(code: string): number {
  switch (code) {
    case "V2":
      return 2;
    case "V3":
      return 3;
    case "V4":
      return 4;
    case "V5":
      return 5;
    default:
      return 99;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(obj: Record<string, number>) {
  const sum = Object.values(obj).reduce((acc, v) => acc + v, 0) || 1;
  const out: Record<string, number> = {};
  for (const k of Object.keys(obj)) {
    out[k] = Number((obj[k] / sum).toFixed(4));
  }
  return out;
}


function extractOptionCode(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^[A-D]/);
  return match ? match[0] : raw;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sb = mcasSupa();
    const body = await req.json();

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
    const email = String(candidate.email || "").trim().toLowerCase();
    const phone = String(candidate.phone || "").trim();
    const consent = Boolean(candidate.consent);

    const answers = (body?.answers || {}) as AnswersMap;

    if (!partner_key) {
      return NextResponse.json(
        { ok: false, error: "partner_key is required" },
        { status: 400 }
      );
    }

    if (!org_id) {
      return NextResponse.json(
        { ok: false, error: "org_id is required" },
        { status: 400 }
      );
    }

    if (!application_id) {
      return NextResponse.json(
        { ok: false, error: "application_id is required" },
        { status: 400 }
      );
    }

    if (!first_name || !last_name || !email || !phone || !consent) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "candidate fields required: first_name, last_name, email, phone, consent=true",
        },
        { status: 400 }
      );
    }

    for (let i = 1; i <= 25; i++) {
      const qCode = `Q${i}`;
      if (!answers[qCode]) {
        return NextResponse.json(
          { ok: false, error: `Missing answer for ${qCode}` },
          { status: 400 }
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
        { status: 500 }
      );
    }

    if (!partner || !partner.is_active) {
      return NextResponse.json(
        { ok: false, error: "Invalid or inactive partner_key" },
        { status: 400 }
      );
    }

    if (partner.allowed_org_id && partner.allowed_org_id !== org_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Partner is not authorised for this org_id",
        },
        { status: 403 }
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
        { status: 500 }
      );
    }

    if (!fw) {
      return NextResponse.json(
        { ok: false, error: "Framework not found" },
        { status: 404 }
      );
    }

    const definition = (fw.definition || {}) as any;
    const questions: FrameworkQuestion[] = Array.isArray(definition.questions)
      ? definition.questions
      : [];

    if (questions.length !== 25) {
      return NextResponse.json(
        {
          ok: false,
          error: `Framework must contain 25 questions. Found ${questions.length}.`,
        },
        { status: 500 }
      );
    }

    const labels = definition.labels || {};
    const osLabels: Record<string, string> = labels.operating_styles || {};
    const cvLabels: Record<string, string> = labels.career_verticals || {};

    const qLookup = new Map<string, FrameworkQuestion>();
    for (const q of questions) qLookup.set(q.code, q);

    const { data: existingApp, error: findAppErr } = await sb
      .from("partner_applications")
      .select("*")
      .eq("partner_key", partner_key)
      .eq("application_id", application_id)
      .maybeSingle();

    if (findAppErr) {
      return NextResponse.json(
        { ok: false, error: findAppErr.message },
        { status: 500 }
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
          { status: 500 }
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
          { status: 500 }
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
          { status: 500 }
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
        { status: 500 }
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
          { status: 500 }
        );
      }

      assessmentId = createdAssessment.id;
    }

    await sb.from("assessment_answers").delete().eq("assessment_id", assessmentId);

    const answerRows = Object.entries(answers).map(
      ([question_code, option_code]) => ({
        assessment_id: assessmentId!,
        question_code,
        option_code,
        response_time_ms: null,
      })
    );

    const { error: ansErr } = await sb
      .from("assessment_answers")
      .insert(answerRows);

    if (ansErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to save answers" },
        { status: 500 }
      );
    }

    const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
    const osTotals: Record<string, number> = {};
    const verticalValues: number[] = [];
    const verticalTotals: Record<string, number> = {};

    let verticalConfidence: "low" | "matched" | null = null;
    let verticalReadinessSignal = false;
    let overreachRisk = false;

    const answerAudit: Array<{
      question_code: string;
      option_code: string;
      prompt: string;
      option_label: string;
    }> = [];

    for (let i = 1; i <= 25; i++) {
      const qc = `Q${i}`;
      const oc = extractOptionCode(answers[qc]);
      const q = qLookup.get(qc);

      if (!q) {
        return NextResponse.json(
          { ok: false, error: `Framework missing ${qc}` },
          { status: 500 }
        );
      }

      const opt = q.options?.find((x) => x.code === oc);
      if (!opt) {
        return NextResponse.json(
          { ok: false, error: `Invalid option ${qc}:${oc}` },
          { status: 400 }
        );
      }

      answerAudit.push({
        question_code: qc,
        option_code: oc,
        prompt: q.prompt,
        option_label: opt.label,
      });

      if (q.section === "operating_style") {
        if (!opt.os || !opt.core) {
          return NextResponse.json(
            { ok: false, error: `Missing scoring meta on ${qc}:${oc}` },
            { status: 500 }
          );
        }

        coreTotals[opt.core] += 1;
        osTotals[opt.os] = (osTotals[opt.os] || 0) + 1;
      }

      if (q.section === "career_vertical") {
        if (qc === "Q25") {
          if (opt.flag === "overreach_risk") overreachRisk = true;
          if (opt.flag === "vertical_confidence_low") verticalConfidence = "low";
          if (opt.flag === "vertical_confidence_matched") {
            verticalConfidence = "matched";
          }
          if (opt.flag === "vertical_readiness_signal") {
            verticalReadinessSignal = true;
          }
        } else {
          const mid = opt.vertical_band
            ? verticalBandMidpoint(opt.vertical_band)
            : null;
          const verticalCode = opt.vertical_band
            ? verticalBandToCode(opt.vertical_band)
            : null;

          if (mid == null || !verticalCode) {
            return NextResponse.json(
              { ok: false, error: `Missing vertical_band on ${qc}:${oc}` },
              { status: 500 }
            );
          }

          verticalValues.push(mid);
          verticalTotals[verticalCode] = (verticalTotals[verticalCode] || 0) + 1;
        }
      }
    }

    const flags: Array<{ code: string; severity: string }> = [];

    if (overreachRisk) flags.push({ code: "OVERREACH_RISK", severity: "high" });
    if (verticalConfidence === "low") {
      flags.push({ code: "VERTICAL_CONFIDENCE_LOW", severity: "medium" });
    }
    if (verticalConfidence === "matched") {
      flags.push({ code: "VERTICAL_CONFIDENCE_MATCHED", severity: "low" });
    }
    if (verticalReadinessSignal) {
      flags.push({ code: "VERTICAL_READINESS_SIGNAL", severity: "low" });
    }

    const coreDist = normalize(coreTotals);

    const osDistArr = Object.entries(osTotals)
      .map(([code, raw]) => ({ code, raw }))
      .sort((a, b) => b.raw - a.raw);

    const osSum = osDistArr.reduce((acc, x) => acc + x.raw, 0) || 1;

    const osDist = osDistArr.map((x, idx) => ({
      code: x.code,
      label: osLabels[x.code] || x.code,
      pct: Number((x.raw / osSum).toFixed(4)),
      rank: idx + 1,
    }));

    const primaryOperatingStyle = osDist[0] || null;

    const vAvg =
      verticalValues.reduce((acc, v) => acc + v, 0) /
      (verticalValues.length || 1);

    const verticalRaw = Object.entries(verticalTotals)
      .map(([code, raw]) => ({ code, raw }))
      .sort((a, b) => b.raw - a.raw || cvSortOrder(a.code) - cvSortOrder(b.code));
    const verticalSum = verticalRaw.reduce((acc, x) => acc + x.raw, 0) || 1;
    const careerVerticalRanking = verticalRaw.map((item, idx) => ({
      code: item.code,
      display_code: displayCvCode(item.code),
      label: cvLabels[item.code] || displayCvCode(item.code) || item.code,
      pct: Number((item.raw / verticalSum).toFixed(4)),
      count: item.raw,
      rank: idx + 1,
    }));
    const primaryCareerVertical = careerVerticalRanking[0] || null;
    const careerVerticalCode =
      primaryCareerVertical?.code || `V${clamp(Math.round(vAvg), 1, 6)}`;
    const verticalLevel = Number(String(careerVerticalCode).replace("V", ""));

    const confidence = {
      rating: "moderate",
      signals: {
        answered_count: 25,
        vertical_avg: Number(vAvg.toFixed(2)),
        vertical_level: verticalLevel,
        vertical_confidence: verticalConfidence,
        vertical_readiness_signal: verticalReadinessSignal,
        overreach_risk: overreachRisk,
      },
    };

    const scoring_model_version = `mcas_${framework_version}_candidate_v2_distribution`;

    await sb.from("results").delete().eq("assessment_id", assessmentId);

    const resultRow = {
      assessment_id: assessmentId,
      scoring_model: scoring_model_version,
      core_distribution: coreDist,
      os_distribution: osDist.map((x) => ({ code: x.code, pct: x.pct })),
      vertical_readiness: careerVerticalCode,
      confidence,
      flags,
    };

    const { error: resErr } = await sb.from("results").insert(resultRow);

    if (resErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to save result" },
        { status: 500 }
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

    const careerVerticalLabel =
      cvLabels[careerVerticalCode] || displayCvCode(careerVerticalCode) || careerVerticalCode;

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
          { status: 500 }
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

    const responsePayload = {
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
        scoring: {
          model_version: scoring_model_version,
          core_distribution: coreDist,
          primary_operating_style: primaryOperatingStyle,
          operating_style_ranking: osDist,
          career_vertical: {
            code: careerVerticalCode,
            display_code: displayCvCode(careerVerticalCode),
            label: careerVerticalLabel,
            avg_score: Number(vAvg.toFixed(2)),
          },
          career_vertical_ranking: careerVerticalRanking,
          flags,
          confidence,
        },
        report: {
          operating_style_summary:
            reportContentBySection.oss || fallbackOperatingStyleSummary,

          role_fit_summary:
            reportContentBySection.rfs || fallbackRoleFitSummary,

          career_vertical_summary: {
            ...careerVerticalSummaryContent,
            current_vertical: {
              code: careerVerticalCode,
              label: careerVerticalLabel,
              avg_score: Number(vAvg.toFixed(2)),
              summary:
                careerVerticalSummaryContent?.levels?.[careerVerticalCode] ||
                careerVerticalSummaryContent?.levels?.[`CV${verticalLevel}`] ||
                null,
            },
          },
        },
        audit: {
          answers: answerAudit,
        },
      },
    };

    return NextResponse.json(responsePayload);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}