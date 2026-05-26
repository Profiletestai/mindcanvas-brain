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
  return auth.replace("Bearer ", "").trim();
}

function isAuthorized(req: Request): boolean {
  return getBearerToken(req) === process.env.MCAS_API_BEARER_TOKEN;
}

/* -------------------------------
   Helpers
--------------------------------*/

function extractOptionCode(value: any): string {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^[A-D]/);
  return match ? match[0] : raw;
}

function normalize(obj: Record<string, number>) {
  const sum = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const k in obj) {
    out[k] = Number((obj[k] / sum).toFixed(4));
  }
  return out;
}

function normalizeOS(value: string | null) {
  if (!value) return null;
  const match = value.toUpperCase().match(/OS\s*([1-8])/);
  return match ? `OS${match[1]}` : value.toUpperCase();
}

function normalizeCV(value: string | null) {
  if (!value) return null;
  const match = value.toUpperCase().match(/(?:CV|V)\s*([1-6])/);
  return match ? `V${match[1]}` : value.toUpperCase();
}

/* -------------------------------
   MCAS SCORING
--------------------------------*/

function scoreAnswers(answers: Record<string, string>) {
  const coreTotals = { C: 0, O: 0, R: 0, E: 0 };
  const osTotals: Record<string, number> = {};
  const verticalValues: number[] = [];

  for (let i = 1; i <= 25; i++) {
    const q = `Q${i}`;
    const val = answers[q];

    if (!val) throw new Error(`Missing answer ${q}`);

    /* -------------------------
       SIMPLE SCORING LOGIC
       (You can refine later)
    --------------------------*/

    // OS mapping
    const osMap: Record<string, string> = {
      A: "OS1",
      B: "OS2",
      C: "OS3",
      D: "OS4",
    };

    const os = osMap[val] || "OS1";

    osTotals[os] = (osTotals[os] || 0) + 1;

    // CORE mapping (simple balanced placeholder)
    const coreMap: Record<string, "C" | "O" | "R" | "E"> = {
      A: "C",
      B: "O",
      C: "R",
      D: "E",
    };

    const core = coreMap[val];
    coreTotals[core]++;

    // Career vertical (Q16–Q24)
    if (i >= 16 && i <= 24) {
      const vMap: Record<string, number> = {
        A: 2,
        B: 3,
        C: 4,
        D: 5,
      };
      verticalValues.push(vMap[val] || 3);
    }
  }

  const coreDistribution = normalize(coreTotals);

  const osRanking = Object.entries(osTotals)
    .map(([code, value]) => ({ code, value }))
    .sort((a, b) => b.value - a.value);

  const primaryOS = osRanking[0]?.code || null;

  const avgVertical =
    verticalValues.reduce((a, b) => a + b, 0) /
    (verticalValues.length || 1);

  const verticalLevel = Math.round(avgVertical);
  const primaryCV = `V${verticalLevel}`;

  return {
    scoring: {
      core_distribution: coreDistribution,
      primary_operating_style: {
        code: primaryOS,
        pct: 1,
        rank: 1,
      },
      career_vertical: {
        code: primaryCV,
        avg_score: Number(avgVertical.toFixed(2)),
      },
    },
  };
}

/* -------------------------------
   ROUTE
--------------------------------*/

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const datasetVersion = body?.dataset_version;
    const limit = Number(body?.limit || 500);
    const onlyUnscored = body?.only_unscored === true;

    if (!datasetVersion) {
      return NextResponse.json(
        { ok: false, error: "dataset_version required" },
        { status: 400 }
      );
    }

    const sb = supa();

    let query = sb
      .from("behavioural_dataset")
      .select("*")
      .eq("dataset_version", datasetVersion)
      .limit(limit);

    if (onlyUnscored) {
      query = query.eq("status", "imported");
    }

    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    let scored = 0;
    let osMatches = 0;
    let cvMatches = 0;
    let needsReview = 0;

    const errors: any[] = [];

    for (const row of rows || []) {
      try {
        const cleaned: Record<string, string> = {};

        for (let i = 1; i <= 25; i++) {
          const q = `Q${i}`;
          cleaned[q] = extractOptionCode(row.answers?.[q]);
        }

        const result = scoreAnswers(cleaned);

        const calculatedOS =
          result.scoring.primary_operating_style.code;

        const calculatedCV =
          result.scoring.career_vertical.code;

        const expectedOS = normalizeOS(row.expected_primary_os);
        const expectedCV = normalizeCV(row.expected_primary_cv);

        const osMatch = calculatedOS === expectedOS;
        const cvMatch = calculatedCV === expectedCV;

        if (osMatch) osMatches++;
        if (cvMatch) cvMatches++;
        if (!osMatch || !cvMatch) needsReview++;

        await sb
          .from("behavioural_dataset")
          .update({
            calculated_result: result,
            calculated_primary_os: calculatedOS,
            calculated_primary_cv: calculatedCV,
            os_match: osMatch,
            cv_match: cvMatch,
            status: osMatch && cvMatch ? "scored" : "needs_review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        scored++;
      } catch (err: any) {
        errors.push({
          id: row.id,
          row_number: row.row_number,
          error: err.message,
        });

        await sb
          .from("behavioural_dataset")
          .update({
            status: "needs_review",
          })
          .eq("id", row.id);
      }
    }

    return NextResponse.json({
      ok: true,
      dataset_version: datasetVersion,
      processed_rows: rows?.length || 0,
      scored_rows: scored,
      os_matches: osMatches,
      cv_matches: cvMatches,
      needs_review: needsReview,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}