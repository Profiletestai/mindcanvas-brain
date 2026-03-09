//apps/web/app/api/mcas/reverse/submit/route.ts
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

async function getWordMappings(
  sb: ReturnType<typeof supa>,
  frameworkSlug: string,
  frameworkVersion: string,
  mappingType: string,
  mappingCode: string
): Promise<string[]> {
  const { data } = await sb
    .from("word_mappings")
    .select("word_or_phrase, sort_order")
    .eq("framework_slug", frameworkSlug)
    .eq("framework_version", frameworkVersion)
    .eq("mapping_type", mappingType)
    .eq("mapping_code", mappingCode)
    .order("sort_order", { ascending: true });

  return (data || []).map((x: any) => String(x.word_or_phrase || "").trim()).filter(Boolean);
}

function getTopTwoCore(coreDistribution: Record<string, number>) {
  return Object.entries(coreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, pct]) => ({ code, pct }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const runId = String(body?.runId || "").trim();
    const answers = (body?.answers || {}) as AnswersMap;

    if (!runId) {
      return NextResponse.json({ ok: false, error: "runId is required" }, { status: 400 });
    }

    const sb = supa();

    const { data: run, error: runErr } = await sb
      .from("reverse_profile_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (runErr) {
      return NextResponse.json({ ok: false, error: runErr.message }, { status: 500 });
    }
    if (!run) {
      return NextResponse.json({ ok: false, error: "Reverse profile run not found" }, { status: 404 });
    }

    const frameworkSlug = run.framework_slug || "mcas-core-alignment";
    const frameworkVersion = run.framework_version || "v1";

    const { data: fw, error: fwErr } = await sb
      .from("frameworks")
      .select("definition")
      .eq("slug", frameworkSlug)
      .eq("version", frameworkVersion)
      .maybeSingle();

    if (fwErr) {
      return NextResponse.json({ ok: false, error: fwErr.message }, { status: 500 });
    }
    if (!fw) {
      return NextResponse.json({ ok: false, error: "Framework not found" }, { status: 404 });
    }

    const definition = (fw.definition || {}) as any;
    const questions: FrameworkQuestion[] = Array.isArray(definition.questions)
      ? definition.questions
      : [];

    if (questions.length !== 25) {
      return NextResponse.json(
        { ok: false, error: `Framework must contain 25 questions. Found ${questions.length}.` },
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

    for (let i = 1; i <= 25; i++) {
      const qCode = `Q${i}`;
      if (!answers[qCode]) {
        return NextResponse.json({ ok: false, error: `Missing answer for ${qCode}` }, { status: 400 });
      }
    }

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
        return NextResponse.json({ ok: false, error: `Question ${qCode} missing in framework` }, { status: 500 });
      }

      const opt = q.options?.find((o) => o.code === optionCode);
      if (!opt) {
        return NextResponse.json({ ok: false, error: `Invalid option ${optionCode} for ${qCode}` }, { status: 400 });
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

    const vAvg = verticalValues.reduce((acc, v) => acc + v, 0) / (verticalValues.length || 1);
    const verticalLevel = clamp(Math.round(vAvg), 1, 6);
    const verticalCode = `V${verticalLevel}`;

    const careerVertical = {
      code: verticalCode,
      label: cvLabels[verticalCode] || verticalCode,
      avg_score: Number(vAvg.toFixed(2)),
    };

    const flags: Array<{ code: string; severity: string }> = [];
    if (overreachRisk) flags.push({ code: "OVERREACH_RISK", severity: "high" });
    if (verticalConfidence === "low") flags.push({ code: "VERTICAL_CONFIDENCE_LOW", severity: "medium" });
    if (verticalConfidence === "matched") flags.push({ code: "VERTICAL_CONFIDENCE_MATCHED", severity: "low" });
    if (verticalReadinessSignal) flags.push({ code: "VERTICAL_READINESS_SIGNAL", severity: "low" });

    const [primaryCore, secondaryCore] = getTopTwoCore(coreDistribution);

    const topOsWords = topOperatingStyle
      ? await getWordMappings(sb, frameworkSlug, frameworkVersion, "operating_style", topOperatingStyle.code)
      : [];

    const cvWords = await getWordMappings(
      sb,
      frameworkSlug,
      frameworkVersion,
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
      type: "reverse_profile_result",
      meta: {
        run_id: run.id,
        run_number: run.run_number,
        run_type: run.run_type || "reverse_profile_ai",
        source: run.source || "manual",
      },
      partner: {
        partner_key: run.partner_key,
      },
      job: {
        job_id: run.job_id,
        campaign_id: run.campaign_id,
        title: run.title,
      },
      framework: {
        slug: frameworkSlug,
        version: frameworkVersion,
      },
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
        run_id: run.id,
        run_number: run.run_number,
        run_type: run.run_type || "reverse_profile_ai",
        source: run.source || "manual",
        exported_at: new Date().toISOString(),
      },
      partner: {
        partner_key: run.partner_key,
      },
      job: {
        job_id: run.job_id,
        campaign_id: run.campaign_id,
        title: run.title,
      },
      framework: {
        slug: frameworkSlug,
        version: frameworkVersion,
      },
      scoring_model_version: "mcas-score-v1",
      result: resultPayload,
    };

    const now = new Date().toISOString();

    const { error: updateErr } = await sb
      .from("reverse_profile_runs")
      .update({
        submitted_answers: answers,
        score_payload: resultPayload,
        word_mapping_payload: wording,
        export_payload: exportPayload,
        scoring_model_version: "mcas-score-v1",
        status: "scored",
        submitted_at: now,
        scored_at: now,
      })
      .eq("id", runId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      run_id: runId,
      run_number: run.run_number,
      payload: resultPayload,
      export_payload: exportPayload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}