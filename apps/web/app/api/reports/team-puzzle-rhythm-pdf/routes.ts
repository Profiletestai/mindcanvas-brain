// apps/web/app/api/reports/team-puzzle-rhythm-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * This CSS is intentionally PDF-specific.
 * The problem we are fixing is not data/content — it is browser page slicing.
 * Without explicit print break rules, Playwright will split rounded report cards
 * wherever the A4 page ends, which makes the containers look cut off.
 */
const PDF_PRINT_CSS = `
  @page {
    size: A4;
    margin: 8mm;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    min-height: 100% !important;
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
  button,
  aside {
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
    padding: 0 !important;
  }

  /* When the sticky report index is hidden, force the report body back to a single column. */
  main [class*="260px_1fr"],
  main [class*="lg:grid-cols-[260px_1fr]"],
  main [class*="xl:grid-cols-[260px_1fr]"] {
    display: block !important;
  }

  img,
  svg,
  canvas {
    max-width: 100% !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  p,
  li {
    orphans: 3 !important;
    widows: 3 !important;
  }

  table,
  thead,
  tbody,
  tr,
  th,
  td {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* Keep the top-level report containers from starting at the bottom of a page. */
  main > section,
  main [class*="space-y-8"] > section {
    break-before: page !important;
    page-break-before: always !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    overflow: visible !important;
  }

  main > section:first-of-type {
    break-before: auto !important;
    page-break-before: auto !important;
  }

  main [class*="space-y-8"] > section:first-of-type {
    break-before: page !important;
    page-break-before: always !important;
  }

  /* Prevent inner white cards, graph cards, tables and profile cards from being sliced mid-card. */
  section > div,
  [class*="rounded-2xl"],
  [class*="rounded-3xl"],
  [class*="rounded-[18px]"],
  [class*="rounded-[24px]"],
  [class*="shadow"],
  .pdf-avoid-break,
  .avoid-break,
  .chart-card,
  .summary-card {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* The blue outer section card can span more than one page if the section is naturally long.
     The inner content cards should still avoid splitting. */
  main [class*="space-y-8"] > section {
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  /* Avoid a blank first page if the first printable section follows hidden content. */
  main [class*="space-y-8"] {
    display: block !important;
  }

  /* Slightly tighten vertical rhythm for PDF so sections fit more cleanly on A4. */
  main [class*="space-y-8"] > section {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }

  main [class*="space-y-8"] > section + section {
    margin-top: 0 !important;
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

async function waitForImagesAndFonts(page: import("playwright-core").Page) {
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
    await waitForImagesAndFonts(page);

    await page.addStyleTag({ content: PDF_PRINT_CSS });
    await page.emulateMedia({ media: "print" });

    // Let CSS, images and layout settle before Playwright snapshots the PDF.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(750);

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