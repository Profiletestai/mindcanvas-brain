// apps/web/app/api/reports/team-puzzle-rhythm-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PDF_PRINT_CSS = `
  @page {
    size: A4;
    margin: 8mm;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #061A3A !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    overflow: visible !important;
  }

  [data-html2canvas-ignore="true"],
  [data-no-print="true"],
  [data-pdf-hide="true"],
  button {
    display: none !important;
    visibility: hidden !important;
  }

  .sticky,
  .fixed {
    position: static !important;
  }

  main {
    width: 100% !important;
    max-width: 1280px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  img,
  svg,
  canvas {
    max-width: 100% !important;
  }

  section,
  article,
  .pdf-avoid-break,
  .avoid-break,
  .chart-card,
  .summary-card {
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
`;

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);

  return cleaned || "team-puzzle-rhythm-report";
}

function getRequiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key);

  if (!value || !value.trim()) {
    throw new Error(`Missing required parameter: ${key}`);
  }

  return value.trim();
}

function getOrigin(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.nextUrl.origin
  );
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

async function waitForImages(page: import("playwright-core").Page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images || []);

    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }),
    );

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
}

export async function GET(req: NextRequest) {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    const params = req.nextUrl.searchParams;
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");
    const origin = getOrigin(req);

    const reportParams = new URLSearchParams({
      tid,
      src: "portal",
      print: "1",
    });

    const reportUrl = new URL(
      `/t/${encodeURIComponent(token)}/team-puzzle-rhythm-report?${reportParams.toString()}`,
      origin,
    );

    browser = await launchBrowser();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1800 },
      deviceScaleFactor: 1,
    });

    page.setDefaultNavigationTimeout(55_000);
    page.setDefaultTimeout(30_000);

    await page.goto(reportUrl.toString(), {
      waitUntil: "networkidle",
      timeout: 55_000,
    });

    await page.waitForSelector("main", { timeout: 30_000 });
    await waitForImages(page);
    await page.addStyleTag({ content: PDF_PRINT_CSS });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    const fileName = `${safeFileName(`team-puzzle-rhythm-report-${token}`)}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Team Puzzle RHYTHM PDF failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate Team Puzzle RHYTHM PDF",
      },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}