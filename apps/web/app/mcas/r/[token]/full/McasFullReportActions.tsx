// apps/web/app/mcas/r/[token]/full/McasFullReportActions.tsx
"use client";

type McasFullReportActionsProps =
  | {
      variant: "header";
      pdfFilename: string;
      nextStepsUrl: string | null;
    }
  | {
      variant: "sidebar";
      pdfFilename: string;
      nextStepsUrl: string | null;
    };

function safeExternalOrRelativeUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page {
          size: A4 portrait;
          margin: 7mm;
        }

        html,
        body {
          width: 100%;
          min-width: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          margin: 0 !important;
        }

        .mcas-full-report-no-print {
          display: none !important;
        }

        .mcas-full-report-print-only {
          display: block !important;
        }

        .mcas-full-report-print-shell {
          width: 100% !important;
          max-width: none !important;
          overflow: visible !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .mcas-full-report-header {
          border-radius: 0 !important;
          padding: 5mm 6mm !important;
          box-shadow: none !important;
        }

        .mcas-full-report-header-layout {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 80mm !important;
          gap: 5mm !important;
          align-items: start !important;
        }

        .mcas-full-report-header-title {
          max-width: 115mm !important;
          font-size: 18px !important;
          line-height: 1.1 !important;
        }

        .mcas-full-report-header-subtitle {
          margin-top: 2mm !important;
          font-size: 8px !important;
        }

        .mcas-full-report-header-meta {
          grid-template-columns: 1fr !important;
          gap: 1.5mm !important;
        }

        .mcas-full-report-header-meta > div {
          border-radius: 8px !important;
          padding: 1.5mm 2.5mm !important;
        }

        .mcas-full-report-header-meta p:first-child {
          font-size: 6.5px !important;
        }

        .mcas-full-report-header-meta p:last-child {
          margin-top: 0.7mm !important;
          font-size: 9px !important;
          line-height: 1.2 !important;
        }

        .mcas-full-report-hero {
          padding: 5mm 6mm !important;
        }

        .mcas-full-report-hero-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) 48mm !important;
          gap: 4mm !important;
          align-items: start !important;
        }

        .mcas-full-report-hero-copy h1 {
          margin-top: 1.5mm !important;
          font-size: 24px !important;
          line-height: 1 !important;
        }

        .mcas-full-report-hero-copy > p:nth-of-type(2) {
          margin-top: 2.5mm !important;
          font-size: 8.5px !important;
          line-height: 1.45 !important;
        }

        .mcas-full-report-hero-metrics {
          margin-top: 3mm !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 2mm !important;
        }

        .mcas-full-report-hero-metrics > div {
          border-radius: 7px !important;
          padding: 2mm !important;
        }

        .mcas-full-report-hero-metrics p:nth-child(1) {
          font-size: 6px !important;
        }

        .mcas-full-report-hero-metrics p:nth-child(2) {
          margin-top: 1mm !important;
          font-size: 12px !important;
        }

        .mcas-full-report-hero-metrics p:nth-child(3) {
          margin-top: 0.8mm !important;
          font-size: 7.5px !important;
          line-height: 1.25 !important;
        }

        .mcas-full-report-os-card {
          padding: 3mm !important;
        }

        .mcas-full-report-os-card > div:first-child {
          margin-bottom: 2mm !important;
        }

        .mcas-full-report-os-card .space-y-3 {
          row-gap: 1.5mm !important;
        }

        .mcas-full-report-os-card img {
          width: 5mm !important;
          height: 5mm !important;
        }

        .mcas-full-report-os-card p,
        .mcas-full-report-os-card span {
          font-size: 6.5px !important;
          line-height: 1.15 !important;
        }

        .mcas-full-report-os-card [class*="grid-cols"] {
          grid-template-columns: 5mm minmax(0, 1fr) 9mm 16mm !important;
          gap: 1.5mm !important;
        }

        .mcas-full-report-core-chart {
          padding: 2.5mm !important;
        }

        .mcas-full-report-core-chart > div:nth-child(2) {
          transform: scale(0.72);
          transform-origin: top center;
          margin-bottom: -15mm !important;
        }

        .mcas-full-report-top-strip {
          display: none !important;
        }

        .mcas-full-report-after-hero {
          padding: 4mm 6mm !important;
        }

        .mcas-full-report-after-hero > div {
          display: grid !important;
          grid-template-columns: 72mm minmax(0, 1fr) !important;
          gap: 5mm !important;
        }

        .mcas-full-report-after-hero .grid.sm\\:grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 2mm !important;
        }

        .mcas-full-report-after-hero .grid.sm\\:grid-cols-2 > div {
          padding: 2.5mm !important;
        }

        .mcas-full-report-after-hero .grid.sm\\:grid-cols-2 > div > div {
          width: 7mm !important;
          height: 7mm !important;
          margin-bottom: 1.5mm !important;
          border-radius: 5px !important;
          font-size: 10px !important;
        }

        .mcas-full-report-after-hero p {
          font-size: 7.5px !important;
          line-height: 1.35 !important;
        }

        .mcas-full-report-after-hero ul {
          margin-top: 2mm !important;
          row-gap: 1mm !important;
        }

        .mcas-full-report-print-index {
          display: block !important;
          padding: 4mm 6mm !important;
          background: #ffffff !important;
        }

        .mcas-full-report-print-index-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 1.5mm 3mm !important;
        }

        .mcas-full-report-content-grid {
          display: block !important;
          padding: 4mm 0 0 !important;
        }

        .mcas-full-report-content-grid > div {
          row-gap: 4mm !important;
        }

        .mcas-report-section {
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
          margin: 0 0 4mm !important;
          border-radius: 10px !important;
          box-shadow: none !important;
        }

        .mcas-report-section > div {
          border-radius: 7px !important;
        }

        .mcas-report-section h2 {
          font-size: 14px !important;
          line-height: 1.2 !important;
        }

        .mcas-print-avoid {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .mcas-print-row {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .mcas-print-page-break-before {
          break-before: page !important;
          page-break-before: always !important;
        }

        img {
          max-width: 100% !important;
        }

        a {
          color: inherit !important;
          text-decoration: none !important;
        }
      }

      @media screen {
        .mcas-full-report-print-only {
          display: none;
        }
      }
    `}</style>
  );
}

export default function McasFullReportActions(
  props: McasFullReportActionsProps,
) {
  const handleDownloadPdf = () => {
    const previousTitle = document.title;

    document.title = props.pdfFilename;

    window.print();

    window.setTimeout(() => {
      document.title = previousTitle;
    }, 750);
  };

  const configuredNextStepsUrl = safeExternalOrRelativeUrl(props.nextStepsUrl);
  const nextStepsUrl = configuredNextStepsUrl ?? "#pathway";
  const isExternal = Boolean(configuredNextStepsUrl?.startsWith("http"));

  if (props.variant === "header") {
    return (
      <>
        <PrintStyles />

        <div className="mcas-full-report-no-print flex flex-wrap gap-3 xl:justify-end">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex h-10 items-center rounded-lg bg-[#191733] px-5 text-sm font-bold text-white transition hover:bg-[#2B2858]"
          >
            Download PDF
          </button>

          <a
            href={nextStepsUrl}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
            className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-5 text-sm font-bold text-white transition hover:brightness-105"
          >
            Next steps
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <PrintStyles />

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="block w-full rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-[#111827] transition hover:bg-slate-100"
        >
          Download PDF
        </button>

        <a
          href={nextStepsUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className="block rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-4 py-3 text-center text-sm font-bold text-white transition hover:brightness-105"
        >
          Next steps
        </a>
      </div>
    </>
  );
}
