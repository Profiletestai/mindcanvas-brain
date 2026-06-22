// apps/web/app/admin/mcas/[org]/database/[candidateId]/summary/CandidateSummaryDownloadButton.tsx

"use client";

import { useState } from "react";

export default function CandidateSummaryDownloadButton() {
  const [isPreparing, setIsPreparing] = useState(false);

  function cleanUp() {
    document.body.classList.remove("mcas-summary-printing");
    setIsPreparing(false);
  }

  function printSummary() {
    setIsPreparing(true);
    document.body.classList.add("mcas-summary-printing");

    const afterPrint = () => {
      window.removeEventListener("afterprint", afterPrint);
      cleanUp();
    };

    window.addEventListener("afterprint", afterPrint);

    window.setTimeout(() => {
      window.print();
    }, 80);

    window.setTimeout(() => {
      window.removeEventListener("afterprint", afterPrint);
      cleanUp();
    }, 3000);
  }

  return (
    <>
      <button
        type="button"
        onClick={printSummary}
        disabled={isPreparing}
        className="mcas-summary-no-print inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      >
        {isPreparing ? "Preparing PDF…" : "Download PDF"}
      </button>

      <style jsx global>{`
        @media print {
          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .mcas-summary-no-print {
            display: none !important;
          }

          .mcas-summary-page {
            background: #ffffff !important;
            padding: 0 !important;
          }

          .mcas-summary-shell {
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .mcas-summary-grid {
            display: block !important;
          }

          .mcas-summary-grid > * {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 18px !important;
          }
        }
      `}</style>
    </>
  );
}