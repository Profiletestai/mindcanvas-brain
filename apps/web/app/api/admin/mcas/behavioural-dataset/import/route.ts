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

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseDelimited(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      cell = "";

      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((x) => x.length > 0)) rows.push(row);

  return rows;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown) {
  return clean(value).toUpperCase();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const REQUIRED_HEADERS = [
  "Job Title",
  "Job Description",
  "Primary OS",
  "Secondary OS",
  "Tertiary OS",
  "Primary CV",
  "Secondary CV",
  "Validation / Justification",
];

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "CSV file is required as form-data field 'file'" },
        { status: 400 }
      );
    }

    const datasetVersion = clean(form.get("dataset_version")) || "v1";
    const replaceExisting = clean(form.get("replace_existing")) === "true";

    const text = await file.text();
    const parsed = parseDelimited(text);

    if (parsed.length < 2) {
      return NextResponse.json(
        { ok: false, error: "CSV has no data rows" },
        { status: 400 }
      );
    }

    const headers = parsed[0].map((h) => clean(h));
    const headerIndex = new Map(headers.map((h, idx) => [h, idx]));

    const missing = REQUIRED_HEADERS.filter((h) => !headerIndex.has(h));
    for (let i = 1; i <= 25; i++) {
      const q = `Q${i}`;
      if (!headerIndex.has(q)) missing.push(q);
    }

    if (missing.length) {
      return NextResponse.json(
        { ok: false, error: "Missing required headers", missing },
        { status: 400 }
      );
    }

    const get = (row: string[], header: string) => {
      const idx = headerIndex.get(header);
      return idx == null ? "" : clean(row[idx]);
    };

    const rows = parsed.slice(1).map((row, idx) => {
      const answers: Record<string, string> = {};
      for (let i = 1; i <= 25; i++) {
        answers[`Q${i}`] = normalizeCode(get(row, `Q${i}`));
      }

      return {
        dataset_version: datasetVersion,
        source_file_name: file.name,
        row_number: idx + 2,

        job_title: get(row, "Job Title"),
        job_description: get(row, "Job Description"),

        expected_primary_os: normalizeCode(get(row, "Primary OS")),
        expected_secondary_os: normalizeCode(get(row, "Secondary OS")),
        expected_tertiary_os: normalizeCode(get(row, "Tertiary OS")),

        expected_primary_cv: normalizeCode(get(row, "Primary CV")),
        expected_secondary_cv: normalizeCode(get(row, "Secondary CV")),

        answers,
        validation_justification: get(row, "Validation / Justification"),

        status: "imported",
      };
    });

    const validRows = rows.filter((r) => r.job_title);

    if (!validRows.length) {
      return NextResponse.json(
        { ok: false, error: "No valid rows found with Job Title" },
        { status: 400 }
      );
    }

    const sb = supa();

    if (replaceExisting) {
      const { error: deleteErr } = await sb
        .from("behavioural_dataset")
        .delete()
        .eq("dataset_version", datasetVersion);

      if (deleteErr) {
        return NextResponse.json(
          { ok: false, error: deleteErr.message },
          { status: 500 }
        );
      }
    }

    let inserted = 0;

    for (const batch of chunk(validRows, 100)) {
      const { error } = await sb.from("behavioural_dataset").insert(batch);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      inserted += batch.length;
    }

    return NextResponse.json({
      ok: true,
      dataset_version: datasetVersion,
      source_file_name: file.name,
      parsed_rows: rows.length,
      inserted_rows: inserted,
      replaced_existing: replaceExisting,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}