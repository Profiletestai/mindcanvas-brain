//apps/web/app/api/admin/mcas/behavioural-dataset/alignment/score/route.ts
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

function normalizeOs(value: unknown): string | null {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/OS\s*([1-8])/);
  return match ? `OS${match[1]}` : raw || null;
}

function normalizeCv(value: unknown): string | null {
  const raw = String(value || "").trim().toUpperCase();

  if (!raw) return null;

  if (raw.includes("1") && raw.includes("2")) return "CV1_2";
  if (raw.includes("5") && raw.includes("6")) return "CV5_6";

  const match = raw.match(/(?:CV|V)\s*([1-6])/);
  return match ? `CV${match[1]}` : raw;
}

function labelCv(code: string | null) {
  if (!code) return null;
  if (code === "CV1_2") return "CV1–2";
  if (code === "CV5_6") return "CV5–6";
  return code;
}

function getActualOsRanking(result: any): string[] {
  const ranking = result?.scoring?.operating_style_ranking;

  if (Array.isArray(ranking)) {
    return ranking
      .map((item: any) => normalizeOs(item?.code))
      .filter(Boolean) as string[];
  }

  const primary = normalizeOs(result?.scoring?.primary_operating_style?.code);
  return primary ? [primary] : [];
}

function getActualCvRanking(result: any): string[] {
  const ranking = result?.scoring?.career_vertical_ranking;

  if (Array.isArray(ranking)) {
    return ranking
      .map((item: any) => normalizeCv(item?.code))
      .filter(Boolean) as string[];
  }

  const distribution = result?.scoring?.career_vertical_distribution;

  if (distribution && typeof distribution === "object") {
    return Object.entries(distribution)
      .map(([code, pct]) => ({
        code: normalizeCv(code),
        pct: Number(pct || 0),
      }))
      .filter((item) => item.code)
      .sort((a, b) => b.pct - a.pct)
      .map((item) => item.code as string);
  }

  const primary = normalizeCv(result?.scoring?.career_vertical?.code);
  return primary ? [primary] : [];
}

function scoreRankAlignment(params: {
  expected: Array<string | null>;
  actual: Array<string | null>;
  weights: number[];
}) {
  const expected = params.expected.filter(Boolean) as string[];
  const actual = params.actual.filter(Boolean) as string[];
  const weights = params.weights;

  let score = 0;

  const detail = expected.map((expectedCode, expectedIndex) => {
    const actualIndex = actual.findIndex((actualCode) => actualCode === expectedCode);

    const expectedWeight = weights[expectedIndex] || 0;
    const actualWeight = actualIndex >= 0 ? weights[actualIndex] || 0 : 0;

    const awarded = actualIndex >= 0 ? Math.min(expectedWeight, actualWeight) : 0;

    score += awarded;

    return {
      expected_code: expectedCode,
      expected_position: expectedIndex + 1,
      expected_weight: expectedWeight,
      actual_position: actualIndex >= 0 ? actualIndex + 1 : null,
      actual_weight: actualWeight,
      awarded,
      matched: actualIndex >= 0,
    };
  });

  const maxScore = expected.reduce((sum, _code, index) => sum + (weights[index] || 0), 0) || 1;
  const pct = Number(((score / maxScore) * 100).toFixed(2));

  return {
    score,
    max_score: maxScore,
    pct,
    detail,
  };
}

function fitBand(score: number) {
  if (score >= 90) return "excellent_fit";
  if (score >= 75) return "strong_fit";
  if (score >= 60) return "moderate_fit";
  if (score >= 40) return "low_fit";
  return "poor_fit";
}

function buildRoleAlignment(row: any) {
  const result = row.calculated_result || {};

  const expectedOs = [
    normalizeOs(row.expected_primary_os),
    normalizeOs(row.expected_secondary_os),
    normalizeOs(row.expected_tertiary_os),
  ];

  const actualOs = getActualOsRanking(result).slice(0, 3);

  const expectedCv = [
    normalizeCv(row.expected_primary_cv),
    normalizeCv(row.expected_secondary_cv),
  ];

  const actualCv = getActualCvRanking(result).slice(0, 2);

  const osAlignment = scoreRankAlignment({
    expected: expectedOs,
    actual: actualOs,
    weights: [50, 35, 15],
  });

  const cvAlignment = scoreRankAlignment({
    expected: expectedCv,
    actual: actualCv,
    weights: [65, 35],
  });

  const overall = Number(
    (osAlignment.pct * 0.7 + cvAlignment.pct * 0.3).toFixed(2)
  );

  return {
    model_version: "mcas-role-alignment-v1",
    weights: {
      os_rank_weights: {
        primary: 50,
        secondary: 35,
        tertiary: 15,
      },
      cv_rank_weights: {
        primary: 65,
        secondary: 35,
      },
      overall_weights: {
        os: 70,
        cv: 30,
      },
    },
    expected: {
      os: expectedOs,
      cv: expectedCv.map(labelCv),
    },
    actual: {
      os: actualOs,
      cv: actualCv.map(labelCv),
    },
    os_alignment: osAlignment,
    cv_alignment: cvAlignment,
    overall_alignment_pct: overall,
    fit_band: fitBand(overall),
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

    const sb = supa();

    const { data: rows, error } = await sb
      .from("behavioural_dataset")
      .select("*")
      .eq("dataset_version", datasetVersion)
      .not("calculated_result", "is", null)
      .order("row_number", { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    let processed = 0;
    let excellent = 0;
    let strong = 0;
    let moderate = 0;
    let low = 0;
    let poor = 0;

    const errors: Array<{ id: string; row_number: number | null; error: string }> = [];

    for (const row of rows || []) {
      try {
        const roleAlignment = buildRoleAlignment(row);

        const nextCalculatedResult = {
          ...(row.calculated_result || {}),
          role_alignment: roleAlignment,
        };

        const { error: updateErr } = await sb
          .from("behavioural_dataset")
          .update({
            calculated_result: nextCalculatedResult,
          })
          .eq("id", row.id);

        if (updateErr) throw new Error(updateErr.message);

        processed++;

        if (roleAlignment.fit_band === "excellent_fit") excellent++;
        else if (roleAlignment.fit_band === "strong_fit") strong++;
        else if (roleAlignment.fit_band === "moderate_fit") moderate++;
        else if (roleAlignment.fit_band === "low_fit") low++;
        else poor++;
      } catch (err: any) {
        errors.push({
          id: row.id,
          row_number: row.row_number ?? null,
          error: String(err?.message || err),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      dataset_version: datasetVersion,
      processed_rows: processed,
      bands: {
        excellent_fit: excellent,
        strong_fit: strong,
        moderate_fit: moderate,
        low_fit: low,
        poor_fit: poor,
      },
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}