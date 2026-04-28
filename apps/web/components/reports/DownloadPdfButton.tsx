//apps/web/components/reports/DownloadPdfButton.tsx
"use client";

import { useState } from "react";

type PdfReportType =
  | "native"
  | "qsc-entrepreneur"
  | "qsc-leader"
  | "five-d"
  | "visibility"
  | "profile-extended";

type Props = {
  type: PdfReportType;
  token?: string;
  tid?: string;
  slug?: string;
  takerId?: string;
  filename?: string;
  label?: string;
  className?: string;
};

function cleanDownloadFilename(filename: string) {
  const cleaned = filename
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  return cleaned || "mindcanvas-report";
}

export default function DownloadPdfButton({
  type,
  token,
  tid,
  slug,
  takerId,
  filename = "mindcanvas-report",
  label = "Download PDF",
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("type", type);
      params.set("filename", filename);

      if (token) params.set("token", token);
      if (tid) params.set("tid", tid);
      if (slug) params.set("slug", slug);
      if (takerId) params.set("takerId", takerId);

      const url = `/api/reports/pdf?${params.toString()}`;

      console.log("PDF download URL:", url);

      const res = await fetch(url);

      if (!res.ok) {
        let message = "Could not generate PDF";

        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const json = await res.json();
          message = json?.error || JSON.stringify(json);
        } else {
          message = await res.text();
        }

        throw new Error(message);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${cleanDownloadFilename(filename)}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("PDF generation failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Sorry, the PDF could not be generated.";

      alert(`PDF generation failed:\n\n${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`no-print rounded-xl px-4 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? "Preparing PDF..." : label}
    </button>
  );
}