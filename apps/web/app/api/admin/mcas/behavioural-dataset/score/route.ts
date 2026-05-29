// apps/web/app/api/admin/mcas/behavioural-dataset/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scoreMcasV2,
  type McasAnswers,
  type McasQuestion,
} from "@/lib/mcas/scoreMcasV2";

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
  const raw = String(value || "").toUpperCase().trim();
  const match = raw.match(/OS\s*([1-8])/);
  return match ? `OS${match[1]}` : raw || null;
}

function normalizeCv(value: unknown): string | null {
  const raw = String(value || "").toUpperCase().trim();

  if (!raw) return null;

  if (raw.includes("1") && raw.includes("2")) return "CV1_2";
  if (raw.includes("5") && raw.includes("6")) return "CV5_6";

  const match = raw.match(/(?:CV|V)\s*([1-6])/);
  return match ? `CV${match[1]}` : raw;
}

function extractRankingCodes(ranking: any[]): string[] {
  if (!Array.isArray(ranking)) return [];

  return ranking
    .filter((item) => Number(item?.pct || 0) > 0)
    .map((item) => String(item?.code || "").trim())
    .filter(Boolean);
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

    const questions: McasQuestion[] = Array.isArray(definition.questions)
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
    const coreLabels: Record<string, string> = labels.core || {
      C: "Create",
      O: "Organise",
      R: "Resolve",
      E: "Examine",
    };
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
      return NextResponse.json(
        { ok: false, error: rowsErr.message },
        { status: 500 }
      );
    }

    const datasetRows = rows || [];

    let scored = 0;
    let matchedOs = 0;
    let matchedCv = 0;
    let needsReview = 0;

    const errors: Array<{
      id: string;
      row_number: number | null;
      error: string;
    }> = [];

    for (const row of datasetRows as any[]) {
      try {
        const scoring = scoreMcasV2({
          answers: (row.answers || {}) as McasAnswers,
          questions,
          osLabels,
          coreLabels,
          cvLabels,
        });

        const expectedOs = [
          normalizeOs(row.expected_primary_os),
          normalizeOs(row.expected_secondary_os),
          normalizeOs(row.expected_tertiary_os),
        ].filter(Boolean) as string[];

        const calculatedOs = extractRankingCodes(
          scoring.operating_style_ranking || []
        )
          .map(normalizeOs)
          .filter(Boolean)
          .slice(0, expectedOs.length) as string[];

        const expectedCv = [
          normalizeCv(row.expected_primary_cv),
          normalizeCv(row.expected_secondary_cv),
        ].filter(Boolean) as string[];

        const calculatedCv = extractRankingCodes(
          scoring.career_vertical_ranking || []
        )
          .map(normalizeCv)
          .filter(Boolean)
          .slice(0, expectedCv.length) as string[];

        const primaryOs = calculatedOs[0] || null;
        const primaryCv = calculatedCv[0] || null;

        const osMatch =
          expectedOs.length > 0 &&
          expectedOs.every((code, index) => calculatedOs[index] === code);

        const cvMatch =
          expectedCv.length > 0 &&
          expectedCv.every((code, index) => calculatedCv[index] === code);

        const status = osMatch && cvMatch ? "scored" : "needs_review";

        const calculatedResult = {
          scoring,
          audit: scoring.audit,
          expected_vs_actual: {
            expected_os: expectedOs,
            calculated_os: calculatedOs,
            expected_cv: expectedCv,
            calculated_cv: calculatedCv,
            os_match: osMatch,
            cv_match: cvMatch,
          },
        };

        const { error: updateErr } = await sb
          .from("behavioural_dataset")
          .update({
            calculated_result: calculatedResult,
            calculated_primary_os: primaryOs,
            calculated_primary_cv: primaryCv,
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
      scoring_model_version: "mcas-v2-distribution",
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