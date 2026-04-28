import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReportType =
  | "native"
  | "qsc-entrepreneur"
  | "qsc-leader"
  | "five-d"
  | "visibility"
  | "profile-extended";

function safeFileName(value: string) {
  return value
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
}

function getRequiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value || !value.trim()) {
    throw new Error(`Missing required parameter: ${key}`);
  }
  return value.trim();
}

function buildReportPath(params: URLSearchParams) {
  const type = getRequiredParam(params, "type") as ReportType;

  if (type === "native") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");
    return `/t/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
      tid
    )}&print=1`;
  }

  if (type === "qsc-entrepreneur") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");
    return `/qsc/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
      tid
    )}&print=1`;
  }

  if (type === "qsc-leader") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");
    return `/qsc/${encodeURIComponent(
      token
    )}/leader-report?tid=${encodeURIComponent(tid)}&print=1`;
  }

  if (type === "five-d") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");
    return `/t/${encodeURIComponent(
      token
    )}/report?tid=${encodeURIComponent(tid)}&print=1`;
  }

  if (type === "visibility") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");
    return `/visibility/${encodeURIComponent(
      token
    )}/report?tid=${encodeURIComponent(tid)}&print=1`;
  }

  if (type === "profile-extended") {
    const slug = getRequiredParam(params, "slug");
    const takerId = getRequiredParam(params, "takerId");
    return `/portal/${encodeURIComponent(
      slug
    )}/database/${encodeURIComponent(takerId)}/profile-extended-report?print=1`;
  }

  throw new Error(`Unsupported report type: ${type}`);
}

export async function GET(req: NextRequest) {
  let browser: Awaited<ReturnType<typeof import("playwright").chromium.launch>> | null =
    null;

  try {
    const params = req.nextUrl.searchParams;
    const reportPath = buildReportPath(params);

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.nextUrl.origin;

    const reportUrl = new URL(reportPath, origin).toString();

    const filenameParam = params.get("filename") || "mindcanvas-report";
    const filename = `${safeFileName(filenameParam)}.pdf`;

    const { chromium } = await import("playwright");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: {
        width: 1200,
        height: 1600,
      },
    });

    const page = await context.newPage();

    await page.goto(reportUrl, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    await page.emulateMedia({ media: "print" });

    await page.waitForTimeout(1000);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
    });

    await browser.close();
    browser = null;

    const arrayBuffer = new ArrayBuffer(pdfBuffer.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(pdfBuffer);

   return new NextResponse(arrayBuffer, {
   status: 200,
   headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
     },
     });
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}