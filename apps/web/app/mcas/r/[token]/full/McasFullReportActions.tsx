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
          size: auto;
          margin: 10mm;
        }

        html {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          background: #ffffff !important;
        }

        .mcas-full-report-no-print {
          display: none !important;
        }

        .mcas-full-report-print-shell {
          max-width: none !important;
          overflow: visible !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .mcas-full-report-content-grid {
          display: block !important;
          padding: 12mm 0 0 !important;
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

  if (props.variant === "header") {
    const nextStepsUrl = safeExternalOrRelativeUrl(props.nextStepsUrl);
    const isExternal = Boolean(nextStepsUrl?.startsWith("http"));

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

          {nextStepsUrl ? (
            <a
              href={nextStepsUrl}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noreferrer" : undefined}
              className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-5 text-sm font-bold text-white transition hover:brightness-105"
            >
              Next steps
            </a>
          ) : null}
        </div>
      </>
    );
  }

  const nextStepsUrl = safeExternalOrRelativeUrl(props.nextStepsUrl);
  const isExternal = Boolean(nextStepsUrl?.startsWith("http"));

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

        {nextStepsUrl ? (
          <a
            href={nextStepsUrl}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
            className="block rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-4 py-3 text-center text-sm font-bold text-white transition hover:brightness-105"
          >
            Next steps
          </a>
        ) : null}
      </div>
    </>
  );
}
