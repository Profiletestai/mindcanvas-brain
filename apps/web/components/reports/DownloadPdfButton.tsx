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

      const res = await fetch(`/api/reports/pdf?${params.toString()}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Could not generate PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename.replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Sorry, the PDF could not be generated. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`no-print rounded-xl px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 ${className}`}
    >
      {loading ? "Preparing PDF..." : label}
    </button>
  );
}