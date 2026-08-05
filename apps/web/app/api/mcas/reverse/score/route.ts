// apps/web/app/api/mcas/reverse/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scoreMcasV2,
  type McasAnswers,
  type McasQuestion,
} from "@/lib/mcas/scoreMcasV2";
import {
  buildAtumaphireExternalPayload,
  buildAtumaphireRoleSections,
  buildAtumaphireScoringPayload,
  formatAtumaphireNarrative,
  normaliseAtumaphireOutputMode,
} from "@/lib/mcas/atumaphireOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function supa() {
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

type ReportContentBlock = {
  section_key: "oss" | "rfs" | "cvs";
  content: any;
};

async function getWordMappings(
  sb: ReturnType<typeof supa>,
  frameworkSlug: string,
  frameworkVersion: string,
  mappingType: string,
  mappingCode: string,
): Promise<string[]> {
  const { data, error } = await sb
    .from("word_mappings")
    .select("word_or_phrase, sort_order")
    .eq("framework_slug", frameworkSlug)
    .eq("framework_version", frameworkVersion)
    .eq("mapping_type", mappingType)
    .eq("mapping_code", mappingCode)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || [])
    .map((x: any) => String(x.word_or_phrase || "").trim())
    .filter(Boolean);
}

async function nextRunNumber(sb: ReturnType<typeof supa>): Promise<string> {
  const { data, error } = await sb.rpc("next_reverse_profile_run_number");

  if (error || !data) {
    throw new Error(error?.message || "Failed to generate run number");
  }

  return String(data);
}

function legacyVerticalMappingCode(code: string | null | undefined) {
  if (!code) return "V3";
  if (code === "CV1_2") return "V2";
  if (code === "CV5_6") return "V5";
  const match = String(code).match(/CV([1-6])/);
  return match ? `V${match[1]}` : String(code).replace(/^CV/, "V");
}

function buildIdealCandidateProfile(input: {
  primaryOperatingStyle: any;
  careerVertical: any;
  operatingWords: string[];
  careerWords: string[];
}) {
  const primaryStyle = input.primaryOperatingStyle?.label || "this profile";
  const careerVertical =
    input.careerVertical?.label || "the required level of responsibility";

  const operatingWords = Array.isArray(input.operatingWords)
    ? input.operatingWords.filter(Boolean)
    : [];

  const careerWords = Array.isArray(input.careerWords)
    ? input.careerWords.filter(Boolean)
    : [];

  const operatingPhrase = operatingWords.length
    ? operatingWords.join(", ")
    : "clear behavioural strengths";

  const careerPhrase = careerWords.length
    ? careerWords.join(", ")
    : "perform consistently at the required career vertical";

  return {
    thinking_style: {
      title: "How this ideal candidate thinks",
      summary:
        `This ideal candidate shows the thinking pattern of ${primaryStyle}. ` +
        `They are likely to approach work through ${operatingPhrase} and will naturally focus on what creates movement, clarity, and useful outcomes. ` +
        `At ${careerVertical} level, they need to think beyond isolated tasks and consider the broader impact of decisions, priorities, and trade-offs.`,
    },
    execution_style: {
      title: "How they execute and perform",
      summary:
        `This ideal candidate is expected to execute through ${operatingPhrase}. ` +
        `They should be able to turn direction into action, maintain momentum, and produce outcomes that match the level of responsibility required. ` +
        `The role is likely to need someone who can ${careerPhrase}.`,
    },
    team_style: {
      title: "How they operate in a team",
      summary:
        `In a team context, this ideal candidate should contribute through the behavioural strengths associated with ${primaryStyle}. ` +
        `They are expected to support the system by bringing the right balance of contribution, ownership, and collaboration for the role. ` +
        `At ${careerVertical} level, their team impact should extend beyond personal delivery and support wider alignment, performance, and execution.`,
    },
  };
}

async function fetchReportSections(input: {
  sb: ReturnType<typeof supa>;
  frameworkSlug: string;
  frameworkVersion: string;
  operatingStyleCode: string | null;
  careerVertical: any;
}) {
  const fallback = {
    operating_style_summary: null,
    role_fit_summary: null,
    career_vertical_summary: input.careerVertical
      ? {
          current_vertical: {
            code: input.careerVertical.code,
            label: input.careerVertical.label,
            pct: input.careerVertical.pct,
            summary: null,
          },
        }
      : null,
  };

  if (!input.operatingStyleCode) return fallback;

  const { data, error } = await input.sb
    .from("report_content_blocks")
    .select("section_key, content")
    .eq("framework_slug", input.frameworkSlug)
    .eq("framework_version", input.frameworkVersion)
    .eq("operating_style_code", input.operatingStyleCode)
    .eq("is_active", true)
    .in("section_key", ["oss", "rfs", "cvs"]);

  if (error) throw new Error(error.message);

  const bySection: Record<"oss" | "rfs" | "cvs", any> = {
    oss: null,
    rfs: null,
    cvs: null,
  };

  for (const block of (data || []) as ReportContentBlock[]) {
    bySection[block.section_key] = block.content;
  }

  const cvsContent = bySection.cvs || {};
  const currentCode = input.careerVertical?.code || null;

  return {
    operating_style_summary: bySection.oss,
    role_fit_summary: bySection.rfs,
    career_vertical_summary: {
      ...cvsContent,
      current_vertical: input.careerVertical
        ? {
            code: input.careerVertical.code,
            label: input.careerVertical.label,
            pct: input.careerVertical.pct,
            summary:
              cvsContent?.levels?.[currentCode] ||
              cvsContent?.levels?.[legacyVerticalMappingCode(currentCode)] ||
              null,
          }
        : null,
    },
  };
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const outputMode = normaliseAtumaphireOutputMode(body?.output_mode);

    const partner_key = String(body?.partner_key || "").trim();
    const job_id = String(body?.job_id || "").trim();
    const campaign_id = body?.campaign_id
      ? String(body.campaign_id).trim()
      : null;
    const title = String(body?.title || "").trim();
    const framework_slug =
      String(body?.framework_slug || "").trim() || "mcas-core-alignment";
    const framework_version =
      String(body?.framework_version || "").trim() || "v1";
    const source = String(body?.source || "").trim() || "ai";
    const notes = body?.notes ? String(body.notes).trim() : null;
    const answers = (body?.answers || {}) as McasAnswers;

    if (!partner_key) {
      return NextResponse.json(
        { ok: false, error: "partner_key is required" },
        { status: 400 },
      );
    }

    if (!job_id) {
      return NextResponse.json(
        { ok: false, error: "job_id is required" },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "title is required" },
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

    const sb = supa();

    const { data: partner, error: partnerErr } = await sb
      .from("partners")
      .select("partner_key, is_active")
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

    const { data: fw, error: fwErr } = await sb
      .from("frameworks")
      .select("definition")
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
    const coreLabels: Record<string, string> = labels.core || {
      C: "Create",
      O: "Organise",
      R: "Resolve",
      E: "Examine",
    };
    const osLabels: Record<string, string> = labels.operating_styles || {};
    const cvLabels: Record<string, string> = labels.career_verticals || {};

    const run_number = await nextRunNumber(sb);

    const { data: createdRun, error: createErr } = await sb
      .from("reverse_profile_runs")
      .insert({
        partner_key,
        job_id,
        campaign_id,
        title,
        framework_slug,
        framework_version,
        input_mode: "api",
        run_type: "reverse_profile_ai",
        source,
        notes,
        job_title_snapshot: title,
        run_number,
        status: "submitted",
        submitted_answers: answers,
        submitted_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (createErr || !createdRun) {
      return NextResponse.json(
        {
          ok: false,
          error: createErr?.message || "Failed to create reverse profile run",
        },
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

    const topOperatingStyle = scoring.primary_operating_style || null;
    const primaryCareerVertical = scoring.primary_career_vertical || null;

    const careerVertical = primaryCareerVertical
      ? {
          code: primaryCareerVertical.code,
          label: primaryCareerVertical.label,
          pct: primaryCareerVertical.pct,
        }
      : null;

    const topOsWords = topOperatingStyle
      ? await getWordMappings(
          sb,
          framework_slug,
          framework_version,
          "operating_style",
          topOperatingStyle.code,
        )
      : [];

    const cvWords = careerVertical
      ? await getWordMappings(
          sb,
          framework_slug,
          framework_version,
          "career_vertical",
          legacyVerticalMappingCode(careerVertical.code),
        )
      : [];

    const wording = {
      primary_core: scoring.behavioural_approach_ranking?.[0]
        ? {
            code: scoring.behavioural_approach_ranking[0].code,
            label:
              coreLabels[scoring.behavioural_approach_ranking[0].code] ||
              scoring.behavioural_approach_ranking[0].code,
            pct: scoring.behavioural_approach_ranking[0].pct,
          }
        : null,
      secondary_core: scoring.behavioural_approach_ranking?.[1]
        ? {
            code: scoring.behavioural_approach_ranking[1].code,
            label:
              coreLabels[scoring.behavioural_approach_ranking[1].code] ||
              scoring.behavioural_approach_ranking[1].code,
            pct: scoring.behavioural_approach_ranking[1].pct,
          }
        : null,
      operating_style: topOperatingStyle
        ? {
            code: topOperatingStyle.code,
            label: topOperatingStyle.label,
            words: topOsWords,
          }
        : null,
      career_vertical: careerVertical
        ? {
            code: careerVertical.code,
            label: careerVertical.label,
            words: cvWords,
          }
        : null,
    };

    const idealCandidateProfile = buildIdealCandidateProfile({
      primaryOperatingStyle: topOperatingStyle,
      careerVertical,
      operatingWords: topOsWords,
      careerWords: cvWords,
    });

    const reportSections = await fetchReportSections({
      sb,
      frameworkSlug: framework_slug,
      frameworkVersion: framework_version,
      operatingStyleCode: topOperatingStyle?.code || null,
      careerVertical,
    });

    const externalScoring = buildAtumaphireScoringPayload({
      scoring,
      modelVersion: scoring.model_version,
      careerVertical,
    });

    const resultPayload = {
      scoring,
      wording,
      ideal_candidate_profile: idealCandidateProfile,
      report: {
        operating_style_summary: reportSections.operating_style_summary,
        role_fit_summary: reportSections.role_fit_summary,
        career_vertical_summary: reportSections.career_vertical_summary,
      },
      audit: scoring.audit,
    };

    const exportPayload = {
      ok: true,
      type: "reverse_profile_export",
      meta: {
        run_id: createdRun.id,
        run_number: createdRun.run_number,
        run_type: createdRun.run_type || "reverse_profile_ai",
        source: createdRun.source || source,
        exported_at: new Date().toISOString(),
      },
      partner: {
        partner_key: createdRun.partner_key,
      },
      job: {
        job_id: createdRun.job_id,
        campaign_id: createdRun.campaign_id,
        title: createdRun.title,
      },
      framework: {
        slug: framework_slug,
        version: framework_version,
      },
      scoring_model_version: scoring.model_version,
      result: resultPayload,
    };

    const now = new Date().toISOString();

    const { error: updateErr } = await sb
      .from("reverse_profile_runs")
      .update({
        score_payload: resultPayload,
        word_mapping_payload: wording,
        export_payload: exportPayload,
        scoring_model_version: scoring.model_version,
        status: "scored",
        scored_at: now,
      })
      .eq("id", createdRun.id);

    if (updateErr) {
      return NextResponse.json(
        { ok: false, error: updateErr.message },
        { status: 500 },
      );
    }

    const threeSectionNarrative = buildAtumaphireRoleSections({
      scoring: externalScoring,
      operatingStyleSummary: reportSections.operating_style_summary,
      roleFitSummary: reportSections.role_fit_summary,
      careerVerticalSummary: reportSections.career_vertical_summary,
      idealCandidateProfile,
    });

    const narrative = formatAtumaphireNarrative(
      threeSectionNarrative,
      outputMode,
    );

    const responsePayload = buildAtumaphireExternalPayload({
      sourcePayload: exportPayload,
      scoring: externalScoring,
      narrative,
      outputMode,
    });

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}