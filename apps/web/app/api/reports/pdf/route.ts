//apps/web/app/api/reports/pdf/route.ts

import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium, type Browser } from "playwright-core";

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
  const cleaned = value
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);

  return cleaned || "mindcanvas-report";
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

    return `/t/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
      tid
    )}&print=1`;
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

async function launchBrowser() {
  const executablePath = await chromium.executablePath();

  return playwrightChromium.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
    executablePath,
    headless: true,
  });
}

function getOrigin(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.nextUrl.origin
  );
}

async function waitForReportToSettle(page: Awaited<ReturnType<Browser["newPage"]>>) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });

  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {
    // Some report pages keep small network activity alive.
    // This should not block PDF generation.
  });

  await page
    .evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
    })
    .catch(() => {
      // Font loading is helpful, but PDF generation should continue if this fails.
    });

  await page.waitForTimeout(1200);
}

export async function GET(req: NextRequest) {
  let browser: Browser | null = null;

  try {
    const params = req.nextUrl.searchParams;
    const reportPath = buildReportPath(params);
    const origin = getOrigin(req);
    const reportUrl = new URL(reportPath, origin).toString();

    const filenameParam = params.get("filename") || "mindcanvas-report";
    const filename = `${safeFileName(filenameParam)}.pdf`;

    const cookieHeader = req.headers.get("cookie");
    const authorizationHeader = req.headers.get("authorization");

    console.log("Generating PDF for:", reportUrl);

    browser = await launchBrowser();

    const context = await browser.newContext({
      viewport: {
        width: 1200,
        height: 1600,
      },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
      },
    });

    const page = await context.newPage();

    page.on("console", (message) => {
      const text = message.text();

      if (
        text.toLowerCase().includes("error") ||
        text.toLowerCase().includes("failed")
      ) {
        console.log("PDF page console:", text);
      }
    });

    page.on("pageerror", (error) => {
      console.error("PDF page error:", error);
    });

    await page.goto(reportUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await page.emulateMedia({ media: "print" });

    await waitForReportToSettle(page);

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

    await context.close();
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

    console.error("PDF generation route failed:", error);

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