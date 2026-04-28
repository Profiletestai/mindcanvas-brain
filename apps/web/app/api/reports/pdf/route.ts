//apps/web/app/api/reports/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium, type Browser, type Page } from "playwright-core";

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

const PDF_PRINT_CSS = `
  @page {
    size: A4;
    margin: 12mm;
  }

  html,
  body {
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box !important;
  }

  body {
    overflow: visible !important;
  }

  .no-print,
  .pdf-hide,
  [data-no-print="true"],
  [data-pdf-hide="true"],
  nav,
  header,
  footer,
  button,
  [role="navigation"],
  [aria-label="breadcrumb"],
  [aria-label="breadcrumbs"] {
    display: none !important;
    visibility: hidden !important;
  }

  a[href*="admin"],
  a[href*="database"],
  a[href*="settings"],
  a[href*="tests"],
  a[href*="communications"],
  a[href*="profile-settings"] {
    display: none !important;
    visibility: hidden !important;
  }

  .pdf-report-shell,
  .report-shell,
  main,
  article {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
  }

  .min-h-screen,
  .min-h-\\[240px\\],
  .bg-slate-100 {
    min-height: auto !important;
    background: #ffffff !important;
  }

  .mx-auto {
    max-width: 100% !important;
  }

  .max-w-\\[1440px\\],
  .max-w-7xl,
  .max-w-6xl,
  .max-w-5xl,
  .max-w-4xl {
    max-width: 100% !important;
  }

  .px-5,
  .px-6,
  .px-8 {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .py-4,
  .py-5,
  .py-6 {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  .pb-16 {
    padding-bottom: 0 !important;
  }

  .pt-5 {
    padding-top: 0 !important;
  }

  .sticky,
  .fixed {
    position: static !important;
  }

  .report-section,
  .report-card,
  .chart-card,
  .summary-card,
  .avoid-break,
  .pdf-avoid-break {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .pdf-page-break {
    break-before: page !important;
    page-break-before: always !important;
  }

  img,
  svg,
  canvas {
    max-width: 100% !important;
    height: auto !important;
  }

  .shadow,
  .shadow-sm,
  .shadow-md,
  .shadow-lg,
  .shadow-xl,
  .shadow-2xl {
    box-shadow: none !important;
  }

  .grid {
    page-break-inside: auto !important;
  }

  .print-clean-page {
    background: #ffffff !important;
  }
`;

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

function withPrintParam(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}print=1`;
}

function buildReportPath(params: URLSearchParams) {
  const type = getRequiredParam(params, "type") as ReportType;

  if (type === "native") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");

    return withPrintParam(
      `/t/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(tid)}`
    );
  }

  if (type === "qsc-entrepreneur") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");

    return withPrintParam(
      `/qsc/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(tid)}`
    );
  }

  if (type === "qsc-leader") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");

    return withPrintParam(
      `/qsc/${encodeURIComponent(token)}/leader-report?tid=${encodeURIComponent(
        tid
      )}`
    );
  }

  if (type === "five-d") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");

    return withPrintParam(
      `/t/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(tid)}`
    );
  }

  if (type === "visibility") {
    const token = getRequiredParam(params, "token");
    const tid = getRequiredParam(params, "tid");

    return withPrintParam(
      `/visibility/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
        tid
      )}`
    );
  }

  if (type === "profile-extended") {
    const slug = getRequiredParam(params, "slug");
    const takerId = getRequiredParam(params, "takerId");

    return withPrintParam(
      `/portal/${encodeURIComponent(slug)}/database/${encodeURIComponent(
        takerId
      )}/profile-extended-report`
    );
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

async function hideElementByText(page: Page, text: string) {
  await page
    .evaluate((targetText) => {
      const normalise = (value: string) =>
        value.replace(/\s+/g, " ").trim().toLowerCase();

      const target = normalise(targetText);

      const elements = Array.from(
        document.querySelectorAll("a, button, div, section, aside")
      );

      for (const element of elements) {
        const ownText = normalise(element.textContent || "");

        if (!ownText.includes(target)) continue;

        const htmlElement = element as HTMLElement;

        if (
          target === "report index" ||
          target === "dashboard database tests" ||
          target === "profile settings" ||
          target === "back to admin" ||
          target === "back to test taker profile" ||
          target === "download pdf"
        ) {
          const nearest =
            htmlElement.closest("aside") ||
            htmlElement.closest("nav") ||
            htmlElement.closest("header") ||
            htmlElement.closest("section") ||
            htmlElement.closest("div") ||
            htmlElement;

          (nearest as HTMLElement).style.display = "none";
          (nearest as HTMLElement).style.visibility = "hidden";
        }
      }
    }, text)
    .catch(() => {});
}

async function cleanPageForPdf(page: Page) {
  await page.addStyleTag({ content: PDF_PRINT_CSS }).catch(() => {});

  await page
    .evaluate(() => {
      document.documentElement.classList.add("print-clean-page");
      document.body.classList.add("print-clean-page");

      const selectorsToHide = [
        ".no-print",
        ".pdf-hide",
        "[data-no-print='true']",
        "[data-pdf-hide='true']",
        "nav",
        "header",
        "footer",
        "button",
        "[role='navigation']",
        "[aria-label='breadcrumb']",
        "[aria-label='breadcrumbs']",
        "aside",
      ];

      for (const selector of selectorsToHide) {
        document.querySelectorAll(selector).forEach((element) => {
          const htmlElement = element as HTMLElement;
          htmlElement.style.display = "none";
          htmlElement.style.visibility = "hidden";
        });
      }

      const links = Array.from(document.querySelectorAll("a"));

      for (const link of links) {
        const htmlLink = link as HTMLElement;
        const text = (htmlLink.textContent || "").toLowerCase();
        const href = (link.getAttribute("href") || "").toLowerCase();

        if (
          text.includes("back") ||
          text.includes("dashboard") ||
          text.includes("database") ||
          text.includes("tests") ||
          text.includes("profile settings") ||
          text.includes("communications") ||
          href.includes("admin") ||
          href.includes("settings")
        ) {
          htmlLink.style.display = "none";
          htmlLink.style.visibility = "hidden";
        }
      }
    })
    .catch(() => {});

  await hideElementByText(page, "Dashboard Database Tests");
  await hideElementByText(page, "Profile Settings");
  await hideElementByText(page, "Back to admin");
  await hideElementByText(page, "Back to test taker profile");
  await hideElementByText(page, "Download PDF");
  await hideElementByText(page, "Report Index");
}

async function waitForReportToSettle(page: Page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });

  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {
    // Some app pages keep small requests alive.
  });

  await page
    .evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
    })
    .catch(() => {});

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
        width: 1280,
        height: 1800,
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

    await page.emulateMedia({ media: "print" });

    await page.goto(reportUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await waitForReportToSettle(page);
    await cleanPageForPdf(page);
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(500);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm",
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