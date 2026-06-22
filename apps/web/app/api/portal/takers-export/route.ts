//apps/web/app/api/portal/takers-export/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExportRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  created_at: string | null;
  test_id: string | null;
  link_token: string | null;
  status: string | null;
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function normaliseStatus(status: string | null): string {
  return String(status || "").toLowerCase() === "completed"
    ? "Completed"
    : "Incomplete";
}

function formatDate(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const orgSlug = (url.searchParams.get("org") || "").trim();
    const q = (url.searchParams.get("q") || "").trim();

    // IMPORTANT:
    // testId is a UUID/string. Do not parse it as a number anywhere.
    const selectedTestId = (url.searchParams.get("testId") || "").trim();

    const selectedPurpose = (url.searchParams.get("purpose") || "").trim();

    const sortKey = (
      url.searchParams.get("sort") || "created_desc"
    ).trim() as
      | "created_desc"
      | "created_asc"
      | "company_asc"
      | "company_desc";

    if (!orgSlug) {
      return new NextResponse("Missing organisation slug.", {
        status: 400,
      });
    }

    const sb = createClient().schema("portal");

    const { data: org, error: orgError } = await sb
      .from("orgs")
      .select("id, slug, name")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgError || !org) {
      return new NextResponse(
        orgError?.message || "Organisation not found.",
        { status: 404 },
      );
    }

    const { data: tests, error: testsError } = await sb
      .from("tests")
      .select("id, name, slug")
      .eq("org_id", org.id);

    if (testsError) {
      return new NextResponse(`Unable to load tests: ${testsError.message}`, {
        status: 500,
      });
    }

    const testNameById = new Map<string, string>();

    for (const test of tests ?? []) {
      const id = String(test.id || "").trim();

      if (!id) continue;

      testNameById.set(
        id,
        String(test.name || test.slug || "Untitled test").trim(),
      );
    }

    const { data: linkRows, error: linksError } = await sb
      .from("test_links")
      .select("token, name")
      .eq("org_id", org.id);

    if (linksError) {
      return new NextResponse(
        `Unable to load test links: ${linksError.message}`,
        { status: 500 },
      );
    }

    const linkNameByToken = new Map<string, string>();

    for (const link of linkRows ?? []) {
      const token = String(link.token || "").trim();
      const name = String(link.name || "").trim();

      if (token && name) {
        linkNameByToken.set(token, name);
      }
    }

    const matchingPurposeTokens = selectedPurpose
      ? (linkRows ?? [])
          .filter(
            (link: any) =>
              String(link.name || "").trim() === selectedPurpose,
          )
          .map((link: any) => String(link.token || "").trim())
          .filter(Boolean)
      : [];

    let orderColumn: "created_at" | "company" = "created_at";
    let ascending = false;

    if (sortKey === "created_asc") {
      orderColumn = "created_at";
      ascending = true;
    }

    if (sortKey === "company_asc") {
      orderColumn = "company";
      ascending = true;
    }

    if (sortKey === "company_desc") {
      orderColumn = "company";
      ascending = false;
    }

    const pageSize = 1000;
    const allRows: ExportRow[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = sb
        .from("test_takers")
        .select(
          "id, first_name, last_name, email, company, created_at, test_id, link_token, status",
        )
        .eq("org_id", org.id)
        .order(orderColumn, { ascending })
        .order("id", { ascending });

      if (selectedTestId) {
        query = query.eq("test_id", selectedTestId);
      }

      if (q) {
        const safeQ = q.replace(/[%_,]/g, " ").trim();

        if (safeQ) {
          query = query.or(
            [
              `first_name.ilike.%${safeQ}%`,
              `last_name.ilike.%${safeQ}%`,
              `email.ilike.%${safeQ}%`,
              `company.ilike.%${safeQ}%`,
            ].join(","),
          );
        }
      }

      if (selectedPurpose) {
        if (matchingPurposeTokens.length === 0) {
          query = query.in("link_token", ["__no_matching_purpose__"]);
        } else {
          query = query.in("link_token", matchingPurposeTokens);
        }
      }

      const { data, error } = await query.range(from, to);

      if (error) {
        return new NextResponse(`Export failed: ${error.message}`, {
          status: 500,
        });
      }

      const batch = (data ?? []) as ExportRow[];

      allRows.push(...batch);

      hasMore = batch.length === pageSize;
      page += 1;
    }

    const header = [
      "Name",
      "Email",
      "Company",
      "Test",
      "Test Name / Purpose",
      "Test Status",
      "Created",
      "Test Taker ID",
      "Test ID",
      "Link Token",
    ];

    const csvRows = allRows.map((row) => {
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        "";

      const testId = String(row.test_id || "").trim();
      const linkToken = String(row.link_token || "").trim();

      return [
        name,
        row.email || "",
        row.company || "",
        testNameById.get(testId) || "",
        linkNameByToken.get(linkToken) || "",
        normaliseStatus(row.status),
        formatDate(row.created_at),
        row.id || "",
        testId,
        linkToken,
      ]
        .map(csvEscape)
        .join(",");
    });

    const csv = [header.join(","), ...csvRows].join("\r\n");

    const fileSlug = safeFilenamePart(org.slug || orgSlug) || "organisation";
    const datePart = new Date().toISOString().slice(0, 10);

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="test-takers-${fileSlug}-${datePart}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return new NextResponse(
      `Export failed: ${error?.message || "Unknown server error"}`,
      {
        status: 500,
      },
    );
  }
}
