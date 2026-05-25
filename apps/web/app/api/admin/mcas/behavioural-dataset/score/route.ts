//apps/web/app/api/admin/mcas/behavioural-dataset/score/route.ts
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
  return getBearerToken(req) === expected;
}

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
  for (const k of Object.keys(obj)) {
    out[k] = Number((obj[k] / sum).toFixed(4));
  }
  return out;
}

function normalizeOs(value: unknown): string | null {
  const raw = String(value || "").toUpperCase().trim();
  const match = raw.match(/OS\s*([1-8])/);
  return match ? `OS${match[1]}` : raw || null;
}

function normalizeCv(value: unknown): string | null {
  const raw = String(value || "").toUpperCase().trim();
  const match = raw.match(/(?:CV|V)\s*([1-6])/);
  return match ? `V${match[1]}` : raw || null;
}

function scoreAnswers(params: {
  answers: Record<string, string>;
  questions: FrameworkQuestion[];
  osLabels: Record<string, string>;
  cvLabels: Record<string, string>;
}) {
  const { answers, questions, osLabels, cvLabels } = params;

  const qMap = new Map<string, FrameworkQuestion>();
  for (const q of questions) qMap.set(q.code, q);

  const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
  const osTotals: Record<string, number> = {};
  const verticalValues: number[] = [];

  let verticalConfidence: "low" | "matched" | null = null;
  let verticalReadinessSignal = false;
  let overreachRisk = false;

  const audit: Array<{
    question_code: string;
    option_code: string;
    prompt: string;
    option_label: string;
  }> = [];

  for (let i = 1; i <= 25; i++) {
    const qCode = `Q${i}`;
    const optionCode = String(answers?.[qCode] || "").trim().toUpperCase();

    if (!optionCode) {
      throw new Error(`Missing answer for ${qCode}`);
    }

    const q = qMap.get(qCode);
    if (!q) {
      throw new Error(`Question ${qCode} missing in framework`);
    }

    const opt = q.options?.find((o) => o.code === optionCode);
    if (!opt) {
      throw new Error(`Invalid option ${optionCode} for ${qCode}`);
    }

    audit.push({
      question_code: qCode,
      option_code: optionCode,
      prompt: q.prompt,
      option_label: opt.label,
    });

    if (q.section === "operating_style") {
      if (typeof opt.points !== "number" || !opt.os || !opt.core) {
        throw new Error(`Missing scoring metadata on ${qCode}:${optionCode}`);
      }

      coreTotals[opt.core] += opt.points;
      osTotals[opt.os] = (osTotals[opt.os] || 0) + opt.points;
    }

    if (q.section === "career_vertical") {
      if (qCode === "Q25") {
        if (opt.flag === "overreach_risk") overreachRisk = true;
        if (opt.flag === "vertical_confidence_low") verticalConfidence = "low";
        if (opt.flag === "vertical_confidence_matched") {
          verticalConfidence = "matched";
        }
        if (opt.flag === "vertical_readiness_signal") {
          verticalReadinessSignal = true;
        }
      } else {
        const mid = opt.vertical_band ? verticalBandMidpoint(opt.vertical_band) : null;
        if (mid == null) {
          throw new Error(`Missing vertical_band on ${qCode}:${optionCode}`);
        }
        verticalValues.push(mid);
      }
    }
  }

  const coreDistribution = normalize(coreTotals);

  const osRaw = Object.entries(osTotals)
    .map(([code, raw]) => ({ code, raw }))
    .sort((a, b) => b.raw - a.raw);

  const osSum = osRaw.reduce((acc, x) => acc + x.raw, 0) || 1;

  const operatingStyleRanking = osRaw.map((x, idx) => ({
    code: x.code,
    label: osLabels[x.code] || x.code,
    pct: Number((x.raw / osSum).toFixed(4)),
    rank: idx + 1,
  }));

  const primaryOperatingStyle = operatingStyleRanking[0] || null;

  const vAvg =
    verticalValues.reduce((acc, v) => acc + v, 0) /
    (verticalValues.length || 1);

  const verticalLevel = clamp(Math.round(vAvg), 1, 6);
  const careerVerticalCode = `V${verticalLevel}`;

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

  return {
    scoring: {
      model_version: "mcas-dataset-validation-v1",
      core_distribution: coreDistribution,
      primary_operating_style: primaryOperatingStyle,
      operating_style_ranking: operatingStyleRanking,
      career_vertical: {
        code: careerVerticalCode,
        label: cvLabels[careerVerticalCode] || careerVerticalCode,
        avg_score: Number(vAvg.toFixed(2)),
      },
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
    audit: {
      answers: audit,
    },
  };
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const datasetVersion = String(body?.dataset_version || "v1").trim();
    const limit = Number(body?.limit || 500);
    const onlyUnscored = body?.only_unscored !== false;

    const frameworkSlug =
      String(body?.framework_slug || "").trim() || "mcas-core-alignment";
    const frameworkVersion =
      String(body?.framework_version || "").trim() || "v1";

    const sb = supa();

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
      return NextResponse.json(
        { ok: false, error: "Framework not found" },
        { status: 404 }
      );
    }

    const definition = (fw.definition || {}) as any;
    const questions: FrameworkQuestion[] = Array.isArray(definition.questions)
      ? definition.questions
      : [];

    const labels = definition.labels || {};
    const osLabels: Record<string, string> = labels.operating_styles || {};
    const cvLabels: Record<string, string> = labels.career_verticals || {};

    let query = sb
      .from("behavioural_dataset")
      .select("*")
      .eq("dataset_version", datasetVersion)
      .order("row_number", { ascending: true })
      .limit(limit);

    if (onlyUnscored) {
      query = query.in("status", ["imported", "needs_review"]);
    }

    const { data: rows, error: rowsErr } = await query;

    if (rowsErr) {
      return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });
    }

    const datasetRows = rows || [];

    let scored = 0;
    let matchedOs = 0;
    let matchedCv = 0;
    let needsReview = 0;
    const errors: Array<{ id: string; row_number: number | null; error: string }> = [];

    for (const row of datasetRows as any[]) {
      try {
        const result = scoreAnswers({
          answers: row.answers || {},
          questions,
          osLabels,
          cvLabels,
        });

        const calculatedPrimaryOs =
          result.scoring.primary_operating_style?.code || null;
        const calculatedPrimaryCv =
          result.scoring.career_vertical?.code || null;

        const expectedOs = normalizeOs(row.expected_primary_os);
        const expectedCv = normalizeCv(row.expected_primary_cv);

        const osMatch =
          !!expectedOs &&
          !!calculatedPrimaryOs &&
          normalizeOs(calculatedPrimaryOs) === expectedOs;

        const cvMatch =
          !!expectedCv &&
          !!calculatedPrimaryCv &&
          normalizeCv(calculatedPrimaryCv) === expectedCv;

        const status = osMatch && cvMatch ? "scored" : "needs_review";

        const { error: updateErr } = await sb
          .from("behavioural_dataset")
          .update({
            calculated_result: result,
            calculated_primary_os: calculatedPrimaryOs,
            calculated_primary_cv: calculatedPrimaryCv,
            os_match: osMatch,
            cv_match: cvMatch,
            status,
          })
          .eq("id", row.id);

        if (updateErr) throw new Error(updateErr.message);

        scored++;
        if (osMatch) matchedOs++;
        if (cvMatch) matchedCv++;
        if (status === "needs_review") needsReview++;
      } catch (e: any) {
        errors.push({
          id: row.id,
          row_number: row.row_number ?? null,
          error: String(e?.message || e),
        });

        await sb
          .from("behavioural_dataset")
          .update({
            status: "needs_review",
            calculated_result: {
              error: String(e?.message || e),
            },
          })
          .eq("id", row.id);
      }
    }

    return NextResponse.json({
      ok: true,
      dataset_version: datasetVersion,
      processed_rows: datasetRows.length,
      scored_rows: scored,
      os_matches: matchedOs,
      cv_matches: matchedCv,
      needs_review: needsReview + errors.length,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}