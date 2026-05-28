//apps/web/app/api/admin/mcas/test-lab/[runId]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

type FrameworkOption = { code: string; label: string; points?: number; os?: string; core?: "C" | "O" | "R" | "E"; vertical_band?: "1-2" | "3" | "4" | "5-6"; flag?: string };
type FrameworkQuestion = { code: string; section: "operating_style" | "career_vertical"; prompt: string; options: FrameworkOption[] };

function extractOptionCode(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^[A-D]/);
  return match ? match[0] : raw;
}
function verticalBandMidpoint(band: string): number | null {
  switch (band) { case "1-2": return 1.5; case "3": return 3; case "4": return 4; case "5-6": return 5.5; default: return null; }
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

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function normalize(obj: Record<string, number>) {
  const sum = Object.values(obj).reduce((acc, v) => acc + v, 0) || 1;
  const out: Record<string, number> = {};
  for (const key of Object.keys(obj)) out[key] = Number((obj[key] / sum).toFixed(4));
  return out;
}

function scoreAnswers(params: { answers: Record<string, string>; questions: FrameworkQuestion[]; osLabels: Record<string, string>; cvLabels: Record<string, string> }) {
  const { answers, questions, osLabels, cvLabels } = params;
  const qMap = new Map<string, FrameworkQuestion>();
  for (const q of questions) qMap.set(q.code, q);

  const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
  const osTotals: Record<string, number> = {};
  const verticalValues: number[] = [];
  const verticalTotals: Record<string, number> = {};
  let verticalConfidence: "low" | "matched" | null = null;
  let verticalReadinessSignal = false;
  let overreachRisk = false;
  const audit: Array<{ question_code: string; option_code: string; prompt: string; option_label: string }> = [];

  for (let i = 1; i <= 25; i++) {
    const qCode = `Q${i}`;
    const optionCode = extractOptionCode(answers?.[qCode]);
    if (!optionCode) throw new Error(`Missing answer for ${qCode}`);

    const question = qMap.get(qCode);
    if (!question) throw new Error(`Question ${qCode} missing in framework`);

    const option = question.options?.find((o) => o.code === optionCode);
    if (!option) throw new Error(`Invalid option ${optionCode} for ${qCode}`);

    audit.push({ question_code: qCode, option_code: optionCode, prompt: question.prompt, option_label: option.label });

    if (question.section === "operating_style") {
      if (!option.os || !option.core) throw new Error(`Missing scoring metadata on ${qCode}:${optionCode}`);
      coreTotals[option.core] += 1;
      osTotals[option.os] = (osTotals[option.os] || 0) + 1;
    }

    if (question.section === "career_vertical") {
      if (qCode === "Q25") {
        if (option.flag === "overreach_risk") overreachRisk = true;
        if (option.flag === "vertical_confidence_low") verticalConfidence = "low";
        if (option.flag === "vertical_confidence_matched") verticalConfidence = "matched";
        if (option.flag === "vertical_readiness_signal") verticalReadinessSignal = true;
      } else {
        const mid = option.vertical_band ? verticalBandMidpoint(option.vertical_band) : null;
        const verticalCode = option.vertical_band ? verticalBandToCode(option.vertical_band) : null;
        if (mid == null || !verticalCode) throw new Error(`Missing vertical_band on ${qCode}:${optionCode}`);
        verticalValues.push(mid);
        verticalTotals[verticalCode] = (verticalTotals[verticalCode] || 0) + 1;
      }
    }
  }

  const coreDistribution = normalize(coreTotals);
  const operatingStyleRaw = Object.entries(osTotals).map(([code, raw]) => ({ code, raw })).sort((a, b) => b.raw - a.raw);
  const osSum = operatingStyleRaw.reduce((acc, x) => acc + x.raw, 0) || 1;
  const operatingStyleRanking = operatingStyleRaw.map((item, index) => ({ code: item.code, label: osLabels[item.code] || item.code, pct: Number((item.raw / osSum).toFixed(4)), rank: index + 1 }));
  const primaryOperatingStyle = operatingStyleRanking[0] || null;
  const verticalAverage = verticalValues.reduce((acc, value) => acc + value, 0) / (verticalValues.length || 1);
  const verticalRaw = Object.entries(verticalTotals)
    .map(([code, raw]) => ({ code, raw }))
    .sort((a, b) => b.raw - a.raw || cvSortOrder(a.code) - cvSortOrder(b.code));
  const verticalSum = verticalRaw.reduce((acc, x) => acc + x.raw, 0) || 1;
  const careerVerticalRanking = verticalRaw.map((item, index) => ({
    code: item.code,
    display_code: displayCvCode(item.code),
    label: cvLabels[item.code] || displayCvCode(item.code) || item.code,
    pct: Number((item.raw / verticalSum).toFixed(4)),
    count: item.raw,
    rank: index + 1,
  }));
  const primaryCareerVertical = careerVerticalRanking[0] || null;
  const verticalCode = primaryCareerVertical?.code || `V${clamp(Math.round(verticalAverage), 1, 6)}`;
  const verticalLevel = Number(String(verticalCode).replace("V", ""));
  const flags: Array<{ code: string; severity: string }> = [];
  if (overreachRisk) flags.push({ code: "OVERREACH_RISK", severity: "high" });
  if (verticalConfidence === "low") flags.push({ code: "VERTICAL_CONFIDENCE_LOW", severity: "medium" });
  if (verticalConfidence === "matched") flags.push({ code: "VERTICAL_CONFIDENCE_MATCHED", severity: "low" });
  if (verticalReadinessSignal) flags.push({ code: "VERTICAL_READINESS_SIGNAL", severity: "low" });

  return {
    scoring: {
      model_version: "mcas-test-lab-v2-distribution",
      core_distribution: coreDistribution,
      primary_operating_style: primaryOperatingStyle,
      operating_style_ranking: operatingStyleRanking,
      career_vertical: {
        code: verticalCode,
        display_code: displayCvCode(verticalCode),
        label: cvLabels[verticalCode] || displayCvCode(verticalCode) || verticalCode,
        avg_score: Number(verticalAverage.toFixed(2)),
      },
      career_vertical_ranking: careerVerticalRanking,
      flags,
      confidence: { rating: "moderate", signals: { answered_count: 25, vertical_avg: Number(verticalAverage.toFixed(2)), vertical_level: verticalLevel, vertical_confidence: verticalConfidence, vertical_readiness_signal: verticalReadinessSignal, overreach_risk: overreachRisk } },
    },
    audit: { answers: audit },
  };
}

export async function POST(req: Request, props: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await props.params;
    const body = await req.json().catch(() => ({}));
    const answers = (body?.answers || {}) as Record<string, string>;
    const sb = supa();
    const { data: framework, error } = await sb.from("frameworks").select("definition").eq("slug", "mcas-core-alignment").eq("version", "v1").maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!framework) return NextResponse.json({ ok: false, error: "Framework not found" }, { status: 404 });

    const definition = (framework.definition || {}) as any;
    const questions: FrameworkQuestion[] = Array.isArray(definition.questions) ? definition.questions : [];
    if (questions.length !== 25) return NextResponse.json({ ok: false, error: `Framework must contain 25 questions. Found ${questions.length}.` }, { status: 500 });

    const labels = definition.labels || {};
    const osLabels: Record<string, string> = labels.operating_styles || {};
    const cvLabels: Record<string, string> = labels.career_verticals || {};
    const result = scoreAnswers({ answers, questions, osLabels, cvLabels });

    return NextResponse.json({ ok: true, type: "mcas_test_lab_result", meta: { run_id: runId, completed_at: new Date().toISOString() }, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
