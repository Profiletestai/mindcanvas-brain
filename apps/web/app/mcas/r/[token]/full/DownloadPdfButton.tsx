// apps/web/app/mcas/r/[token]/full/DownloadPdfButton.tsx

"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type DownloadPdfButtonProps = {
  children?: ReactNode;
  className?: string;
};

export default function DownloadPdfButton({
  children = "Download PDF",
  className = "",
}: DownloadPdfButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  function cleanUpPrintMode() {
    document.body.classList.remove("mcas-print-mode");
    setIsPreparing(false);
  }

  function handleDownload() {
    if (typeof window === "undefined") return;

    setIsPreparing(true);
    document.body.classList.add("mcas-print-mode");

    const afterPrint = () => {
      window.removeEventListener("afterprint", afterPrint);
      cleanUpPrintMode();
    };

    window.addEventListener("afterprint", afterPrint);

    window.setTimeout(() => {
      window.print();
    }, 80);

    window.setTimeout(() => {
      cleanUpPrintMode();
      window.removeEventListener("afterprint", afterPrint);
    }, 3000);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPreparing}
        className={[
          className,
          "mcas-no-print cursor-pointer disabled:cursor-wait disabled:opacity-70",
        ].join(" ")}
      >
        {isPreparing ? "Preparing PDF…" : children}
      </button>

      <style jsx global>{`
        @media print {
          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .mcas-no-print {
            display: none !important;
          }

          .mcas-report-page {
            background: #ffffff !important;
            padding: 0 !important;
          }

          .mcas-report-shell {
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          .mcas-report-content-grid {
            display: block !important;
            padding: 24px !important;
          }

          .mcas-report-content-grid > div {
            width: 100% !important;
          }

          section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          a {
            text-decoration: none !important;
          }
        }
      `}</style>
    </>
  );
}