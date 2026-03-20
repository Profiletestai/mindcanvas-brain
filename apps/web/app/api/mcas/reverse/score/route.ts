//apps/web/app/api/mcas/reverse/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supa() {
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
  for (const k of Object.keys(obj)) out[k] = Number((obj[k] / sum).toFixed(4));
  return out;
}

function getTopTwoCore(coreDistribution: Record<string, number>) {
  return Object.entries(coreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, pct]) => ({ code, pct }));
}

async function getWordMappings(
  sb: ReturnType<typeof supa>,
  frameworkSlug: string,
  frameworkVersion: string,
  mappingType: string,
  mappingCode: string
): Promise<string[]> {
  const { data, error } = await sb
    .from("word_mappings")
    .select("word_or_phrase, sort_order")
    .eq("framework_slug", frameworkSlug)
    .eq("framework_version", frameworkVersion)
    .eq("mapping_type", mappingType)
    .eq("mapping_code", mappingCode)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

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

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const partner_key = String(body?.partner_key || "").trim();
    const job_id = String(body?.job_id || "").trim();
    const campaign_id = body?.campaign_id ? String(body.campaign_id).trim() : null;
    const title = String(body?.title || "").trim();
    const framework_slug =
      String(body?.framework_slug || "").trim() || "mcas-core-alignment";
    const framework_version =
      String(body?.framework_version || "").trim() || "v1";
    const source = String(body?.source || "").trim() || "ai";
    const notes = body?.notes ? String(body.notes).trim() : null;
    const answers = (body?.answers || {}) as AnswersMap;

    if (!partner_key) {
      return NextResponse.json(
        { ok: false, error: "partner_key is required" },
        { status: 400 }
      );
    }

    if (!job_id) {
      return NextResponse.json(
        { ok: false, error: "job_id is required" },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "title is required" },
        { status: 400 }
      );
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
        { status: 500 }
      );
    }

    if (!partner || !partner.is_active) {
      return NextResponse.json(
        { ok: false, error: "Invalid or inactive partner_key" },
        { status: 400 }
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

    for (let i = 1; i <= 25; i++) {
      const qCode = `Q${i}`;
      if (!answers[qCode]) {
        return NextResponse.json(
          { ok: false, error: `Missing answer for ${qCode}` },
          { status: 400 }
        );
      }
    }

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
        { status: 500 }
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

    const qMap = new Map<string, FrameworkQuestion>();
    for (const q of questions) qMap.set(q.code, q);

    const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
    const osTotals: Record<string, number> = {};
    const verticalValues: number[] = [];

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
      const qCode = `Q${i}`;
      const optionCode = String(answers[qCode]).trim();
      const q = qMap.get(qCode);

      if (!q) {
        return NextResponse.json(
          { ok: false, error: `Question ${qCode} missing in framework` },
          { status: 500 }
        );
      }

      const opt = q.options?.find((o) => o.code === optionCode);
      if (!opt) {
        return NextResponse.json(
          { ok: false, error: `Invalid option ${optionCode} for ${qCode}` },
          { status: 400 }
        );
      }

      answerAudit.push({
        question_code: qCode,
        option_code: optionCode,
        prompt: q.prompt,
        option_label: opt.label,
      });

      if (q.section === "operating_style") {
        if (typeof opt.points !== "number" || !opt.os || !opt.core) {
          return NextResponse.json(
            { ok: false, error: `Missing scoring metadata on ${qCode}:${optionCode}` },
            { status: 500 }
          );
        }

        coreTotals[opt.core] += opt.points;
        osTotals[opt.os] = (osTotals[opt.os] || 0) + opt.points;
      }

      if (q.section === "career_vertical") {
        if (qCode === "Q25") {
          if (opt.flag === "overreach_risk") overreachRisk = true;
          if (opt.flag === "vertical_confidence_low") verticalConfidence = "low";
          if (opt.flag === "vertical_confidence_matched") verticalConfidence = "matched";
          if (opt.flag === "vertical_readiness_signal") verticalReadinessSignal = true;
        } else {
          const mid = opt.vertical_band ? verticalBandMidpoint(opt.vertical_band) : null;
          if (mid == null) {
            return NextResponse.json(
              { ok: false, error: `Missing vertical_band on ${qCode}:${optionCode}` },
              { status: 500 }
            );
          }
          verticalValues.push(mid);
        }
      }
    }

    const coreDistribution = normalize(coreTotals);

    const operatingStyleRanking = Object.entries(osTotals)
      .map(([code, raw]) => ({ code, raw }))
      .sort((a, b) => b.raw - a.raw);

    const osSum = operatingStyleRanking.reduce((acc, x) => acc + x.raw, 0) || 1;
    const operatingStyleEnriched = operatingStyleRanking.map((x, idx) => ({
      code: x.code,
      label: osLabels[x.code] || x.code,
      pct: Number((x.raw / osSum).toFixed(4)),
      rank: idx + 1,
    }));

    const topOperatingStyle = operatingStyleEnriched[0] || null;

    const vAvg =
      verticalValues.reduce((acc, v) => acc + v, 0) / (verticalValues.length || 1);
    const verticalLevel = clamp(Math.round(vAvg), 1, 6);
    const verticalCode = `V${verticalLevel}`;

    const careerVertical = {
      code: verticalCode,
      label: cvLabels[verticalCode] || verticalCode,
      avg_score: Number(vAvg.toFixed(2)),
    };

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

    const [primaryCore, secondaryCore] = getTopTwoCore(coreDistribution);

    const topOsWords = topOperatingStyle
      ? await getWordMappings(
          sb,
          framework_slug,
          framework_version,
          "operating_style",
          topOperatingStyle.code
        )
      : [];

    const cvWords = await getWordMappings(
      sb,
      framework_slug,
      framework_version,
      "career_vertical",
      careerVertical.code
    );

    const wording = {
      primary_core: primaryCore
        ? {
            code: primaryCore.code,
            label: coreLabels[primaryCore.code] || primaryCore.code,
            pct: primaryCore.pct,
          }
        : null,
      secondary_core: secondaryCore
        ? {
            code: secondaryCore.code,
            label: coreLabels[secondaryCore.code] || secondaryCore.code,
            pct: secondaryCore.pct,
          }
        : null,
      operating_style: topOperatingStyle
        ? {
            code: topOperatingStyle.code,
            label: topOperatingStyle.label,
            words: topOsWords,
          }
        : null,
      career_vertical: {
        code: careerVertical.code,
        label: careerVertical.label,
        words: cvWords,
      },
    };

    const resultPayload = {
      scoring: {
        model_version: "mcas-score-v1",
        core_distribution: coreDistribution,
        primary_operating_style: topOperatingStyle,
        operating_style_ranking: operatingStyleEnriched,
        career_vertical: careerVertical,
        flags,
        confidence: {
          rating: "moderate",
          signals: {
            answered_count: 25,
            vertical_avg: Number(vAvg.toFixed(2)),
            vertical_level: verticalLevel,
            vertical_confidence: verticalConfidence,
            vertical_readiness_signal: verticalReadinessSignal,
            overreach_risk: overreachRisk,
          },
        },
      },
      wording,
      audit: {
        answers: answerAudit,
      },
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
      scoring_model_version: "mcas-score-v1",
      result: resultPayload,
    };

    const now = new Date().toISOString();

    const { error: updateErr } = await sb
      .from("reverse_profile_runs")
      .update({
        score_payload: resultPayload,
        word_mapping_payload: wording,
        export_payload: exportPayload,
        scoring_model_version: "mcas-score-v1",
        status: "scored",
        scored_at: now,
      })
      .eq("id", createdRun.id);

    if (updateErr) {
      return NextResponse.json(
        { ok: false, error: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(exportPayload);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}