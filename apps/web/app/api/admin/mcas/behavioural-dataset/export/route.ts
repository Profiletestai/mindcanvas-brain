//apps/web/app/api/admin/mcas/behavioural-dataset/export/route.ts
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

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function getCore(result: any, key: "C" | "O" | "R" | "E") {
  return result?.scoring?.core_distribution?.[key] ?? "";
}

function getOsRanking(result: any) {
  return result?.scoring?.operating_style_ranking || [];
}

function getOsRankValue(result: any, index: number, field: "code" | "label" | "pct") {
  const item = getOsRanking(result)?.[index];
  return item?.[field] ?? "";
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const datasetVersion = url.searchParams.get("version") || "v1";
    const status = url.searchParams.get("status") || "";
    const q = url.searchParams.get("q") || "";

    const sb = supa();

    let query = sb
      .from("behavioural_dataset")
      .select("*")
      .eq("dataset_version", datasetVersion)
      .order("row_number", { ascending: true })
      .limit(5000);

    if (status) query = query.eq("status", status);
    if (q) query = query.ilike("job_title", `%${q}%`);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = data || [];

    const headers = [
      "dataset_version",
      "row_number",
      "job_title",
      "job_description",
      "expected_primary_os",
      "expected_secondary_os",
      "expected_tertiary_os",
      "calculated_primary_os",
      "os_match",
      "expected_primary_cv",
      "expected_secondary_cv",
      "calculated_primary_cv",
      "cv_match",
      "status",
      "core_C",
      "core_O",
      "core_R",
      "core_E",
      "os_rank_1_code",
      "os_rank_1_label",
      "os_rank_1_pct",
      "os_rank_2_code",
      "os_rank_2_label",
      "os_rank_2_pct",
      "os_rank_3_code",
      "os_rank_3_label",
      "os_rank_3_pct",
      "career_vertical_code",
      "career_vertical_label",
      "career_vertical_avg_score",
      "validation_justification",
      "answers_json",
      "calculated_result_json",
    ];

    const csvRows = rows.map((row: any) => {
      const result = row.calculated_result || {};

      const values = [
        row.dataset_version,
        row.row_number,
        row.job_title,
        row.job_description,
        row.expected_primary_os,
        row.expected_secondary_os,
        row.expected_tertiary_os,
        row.calculated_primary_os,
        row.os_match,
        row.expected_primary_cv,
        row.expected_secondary_cv,
        row.calculated_primary_cv,
        row.cv_match,
        row.status,
        getCore(result, "C"),
        getCore(result, "O"),
        getCore(result, "R"),
        getCore(result, "E"),
        getOsRankValue(result, 0, "code"),
        getOsRankValue(result, 0, "label"),
        getOsRankValue(result, 0, "pct"),
        getOsRankValue(result, 1, "code"),
        getOsRankValue(result, 1, "label"),
        getOsRankValue(result, 1, "pct"),
        getOsRankValue(result, 2, "code"),
        getOsRankValue(result, 2, "label"),
        getOsRankValue(result, 2, "pct"),
        result?.scoring?.career_vertical?.code ?? "",
        result?.scoring?.career_vertical?.label ?? "",
        result?.scoring?.career_vertical?.avg_score ?? "",
        row.validation_justification,
        row.answers,
        row.calculated_result,
      ];

      return values.map(csvCell).join(",");
    });

    const csv = [headers.map(csvCell).join(","), ...csvRows].join("\n");

    const filename = `mcas-behavioural-dataset-${datasetVersion}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}