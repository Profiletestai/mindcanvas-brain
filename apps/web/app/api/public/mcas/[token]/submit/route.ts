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

type McasTestLinkRow = {
  id: string;
  org_id: string;
  public_token: string;
  link_type: "candidate_assessment" | "reverse_role_assessment" | "internal_validation";
  framework_slug: string;
  framework_version: string;
  name: string;
  report_version: "lite" | "full";
  show_results: boolean;
  email_report: boolean;
  next_steps_url: string | null;
  usage_limit_type: "unlimited" | "limited";
  usage_limit_count: number | null;
  status: "active" | "paused" | "expired" | "archived";
  settings: Record<string, unknown>;
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

type CreatedAssessmentRow = {
  id: string;
  report_token: string;
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

function cleanText(value: unknown) {
  return String(value || "").trim();
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
      consent,
    },
  };
}

function buildReportUrls(reportToken: string) {
  return {
    snapshotUrl: `/mcas/r/${encodeURIComponent(reportToken)}/snapshot`,
    fullReportUrl: `/mcas/r/${encodeURIComponent(reportToken)}/full`,
  };
}

export async function POST(req: Request, ctx: RouteContext) {
  const sb = mcasSupa();

  try {
    const { token } = await ctx.params;
    const publicToken = (token || "").trim();

    if (!publicToken) {
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

    if (!answers.length) {
      return NextResponse.json({ error: "answers[] required" }, { status: 400 });
    }

    const candidateCheck = validateCandidate(candidatePayload);

    if (!candidateCheck.ok) {
      return NextResponse.json({ error: candidateCheck.error }, { status: 400 });
    }

    const candidate = candidateCheck.candidate;

    const { data: linkData, error: linkError } = await sb
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
          "usage_limit_type",
          "usage_limit_count",
          "status",
          "settings",
        ].join(", ")
      )
      .eq("public_token", publicToken)
      .maybeSingle();

    const testLink = linkData as McasTestLinkRow | null;

    if (linkError) {
      return NextResponse.json(
        { error: "failed to resolve test link", details: linkError.message },
        { status: 500 }
      );
    }

    if (!testLink) {
      return NextResponse.json({ error: "invalid token" }, { status: 404 });
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

    if (
      testLink.usage_limit_type === "limited" &&
      typeof testLink.usage_limit_count === "number"
    ) {
      const { count, error: countError } = await sb
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("test_link_id", testLink.id);

      if (countError) {
        return NextResponse.json(
          { error: "failed to check link usage", details: countError.message },
          { status: 500 }
        );
      }

      if ((count ?? 0) >= testLink.usage_limit_count) {
        return NextResponse.json(
          { error: "test link usage limit reached" },
          { status: 403 }
        );
      }
    }

    const { data: frameworkData, error: frameworkError } = await sb
      .from("frameworks")
      .select("slug, version, definition")
      .eq("slug", testLink.framework_slug)
      .eq("version", testLink.framework_version)
      .maybeSingle();

    const framework = frameworkData as McasFrameworkRow | null;

    if (frameworkError) {
      return NextResponse.json(
        { error: "failed to load framework", details: frameworkError.message },
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

    const qLookup = new Map<string, FrameworkQuestion>();

    for (const q of questions) qLookup.set(q.code, q);

    const aMap = new Map<string, string>();

    for (const a of answers) {
      const qc = cleanText(a.question_code);
      const oc = cleanText(a.option_code);

      if (qc && oc) aMap.set(qc, oc);
    }

    for (let i = 1; i <= 25; i++) {
      const qc = `Q${i}`;

      if (!aMap.has(qc)) {
        return NextResponse.json(
          { error: `missing answer for ${qc}` },
          { status: 400 }
        );
      }
    }

    let individualId: string | null = null;

    const { data: existingIndividual } = await sb
      .from("individuals")
      .select("id")
      .eq("org_id", testLink.org_id)
      .eq("email", candidate.email)
      .maybeSingle();

    if (existingIndividual?.id) {
      individualId = String(existingIndividual.id);

      await sb
        .from("individuals")
        .update({
          first_name: candidate.first_name,
          last_name: candidate.last_name,
        })
        .eq("id", individualId);
    } else {
      const { data: createdIndividual, error: individualError } = await sb
        .from("individuals")
        .insert({
          org_id: testLink.org_id,
          email: candidate.email,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          external_ref: `mcas-test-link:${testLink.id}:${candidate.email}`,
        })
        .select("id")
        .single();

      if (individualError) {
        return NextResponse.json(
          {
            error: "failed to create individual",
            details: individualError.message,
          },
          { status: 500 }
        );
      }

      individualId = String(createdIndividual.id);
    }

    const assessmentMeta = {
      source: "test_link",
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
        consent: candidate.consent,
        consent_at: nowIso(),
      },
    };

    const { data: createdAssessmentData, error: assessmentError } = await sb
      .from("assessments")
      .insert({
        partner_application_id: null,
        test_link_id: testLink.id,
        individual_id: individualId,
        framework_slug: testLink.framework_slug,
        framework_version: testLink.framework_version,
        status: "started",
        meta: assessmentMeta,
      })
      .select("id, report_token")
      .single();

    const createdAssessment =
      createdAssessmentData as CreatedAssessmentRow | null;

    if (assessmentError || !createdAssessment) {
      return NextResponse.json(
        {
          error: "failed to create assessment",
          details: assessmentError?.message ?? "No assessment returned",
        },
        { status: 500 }
      );
    }

    const assessmentId = createdAssessment.id;
    const reportToken = createdAssessment.report_token;

    const answerRows = Array.from(aMap.entries()).map(
      ([question_code, option_code]) => ({
        assessment_id: assessmentId,
        question_code,
        option_code,
        response_time_ms: null,
      })
    );

    const { error: answersError } = await sb
      .from("assessment_answers")
      .insert(answerRows);

    if (answersError) {
      return NextResponse.json(
        { error: "failed to save answers", details: answersError.message },
        { status: 500 }
      );
    }

    const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
    const osTotals: Record<string, number> = {};
    const verticalValues: number[] = [];
    const flags: Array<{ code: string; severity: string }> = [];

    let verticalConfidence: "low" | "matched" | null = null;
    let verticalReadiness = false;
    let overreachRisk = false;

    for (let i = 1; i <= 25; i++) {
      const qc = `Q${i}`;
      const oc = aMap.get(qc)!;
      const q = qLookup.get(qc);

      if (!q) {
        return NextResponse.json(
          { error: `framework missing ${qc}` },
          { status: 500 }
        );
      }

      const opt = q.options?.find((x) => x.code === oc);

      if (!opt) {
        return NextResponse.json(
          { error: `invalid option ${qc}:${oc}` },
          { status: 400 }
        );
      }

      if (q.section === "operating_style") {
        const points = typeof opt.points === "number" ? opt.points : null;

        if (!points || !opt.os || !opt.core) {
          return NextResponse.json(
            { error: `missing scoring meta on ${qc}:${oc}` },
            { status: 500 }
          );
        }

        coreTotals[opt.core] += points;
        osTotals[opt.os] = (osTotals[opt.os] || 0) + points;
      }

      if (q.section === "career_vertical") {
        if (qc === "Q25") {
          if (opt.flag === "overreach_risk") overreachRisk = true;
          if (opt.flag === "vertical_confidence_low") verticalConfidence = "low";
          if (opt.flag === "vertical_confidence_matched") verticalConfidence = "matched";
          if (opt.flag === "vertical_readiness_signal") verticalReadiness = true;
        } else {
          const midpoint = opt.vertical_band
            ? verticalBandMidpoint(opt.vertical_band)
            : null;

          if (midpoint == null) {
            return NextResponse.json(
              { error: `missing vertical_band on ${qc}:${oc}` },
              { status: 500 }
            );
          }

          verticalValues.push(midpoint);
        }
      }
    }

    if (overreachRisk) flags.push({ code: "OVERREACH_RISK", severity: "high" });
    if (verticalConfidence === "low") flags.push({ code: "VERTICAL_CONFIDENCE_LOW", severity: "medium" });
    if (verticalConfidence === "matched") flags.push({ code: "VERTICAL_CONFIDENCE_MATCHED", severity: "low" });
    if (verticalReadiness) flags.push({ code: "VERTICAL_READINESS_SIGNAL", severity: "low" });

    const coreDistribution = normalize(coreTotals);

    const osDistributionRaw = Object.entries(osTotals)
      .map(([code, value]) => ({ code, pct: value }))
      .sort((a, b) => b.pct - a.pct);

    const osSum =
      osDistributionRaw.reduce((acc, item) => acc + item.pct, 0) || 1;

    const osDistribution = osDistributionRaw.map((item) => ({
      code: item.code,
      pct: Number((item.pct / osSum).toFixed(4)),
    }));

    const verticalAverage =
      verticalValues.reduce((acc, value) => acc + value, 0) /
      (verticalValues.length || 1);

    const verticalLevel = clamp(Math.round(verticalAverage), 1, 6);
    const scoringModel = `mcas_${testLink.framework_version}_candidate_report_v1`;

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

    const { error: resultError } = await sb.from("results").insert({
      assessment_id: assessmentId,
      scoring_model: scoringModel,
      core_distribution: coreDistribution,
      os_distribution: osDistribution,
      vertical_readiness: `V${verticalLevel}`,
      confidence,
      flags,
    });

    if (resultError) {
      return NextResponse.json(
        { error: "failed to save result", details: resultError.message },
        { status: 500 }
      );
    }

    const completedAt = nowIso();

    await sb
      .from("assessments")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", assessmentId);

    const { snapshotUrl, fullReportUrl } = buildReportUrls(reportToken);

    const resultUrl = testLink.show_results
      ? testLink.report_version === "full"
        ? fullReportUrl
        : snapshotUrl
      : testLink.next_steps_url || snapshotUrl;

    return NextResponse.json({
      ok: true,
      status: "completed",
      assessment_id: assessmentId,
      reportToken,
      resultUrl,
      snapshotUrl,
      fullReportUrl,
      nextStepsUrl: testLink.next_steps_url,
      reportVersion: testLink.report_version,
      showResults: testLink.show_results,
      scoring_model: scoringModel,
      scores: {
        core: coreDistribution,
        operating_styles: osDistribution,
        vertical_level: verticalLevel,
      },
      confidence,
      flags,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}