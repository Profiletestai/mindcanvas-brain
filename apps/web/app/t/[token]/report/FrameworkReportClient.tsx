// apps/web/app/t/[token]/report/FrameworkReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getBaseUrl } from "@/lib/server-url";
import AppBackground from "@/components/ui/AppBackground";
import FrameworkSectionsRenderer, { type ReportSections } from "./FrameworkSectionsRenderer";

type FrequencyCode = "A" | "B" | "C" | "D";

type FrameworkReportAPI = {
  ok: boolean;
  data?: {
    test_name?: string;
    taker?: { first_name?: string | null; last_name?: string | null; email?: string | null };
    top_profile_name?: string;
    frequency_labels?: Array<{ code: FrequencyCode; name: string }>;
    frequency_percentages?: Record<FrequencyCode, number>;
    profile_labels?: Array<{ code: string; name: string }>;
    profile_percentages?: Record<string, number>;
    sections?: ReportSections;
  };
  error?: string;
};

function fullName(taker: any) {
  const first = (taker?.first_name || "").trim();
  const last = (taker?.last_name || "").trim();
  const name = `${first} ${last}`.trim();
  return name || "Participant";
}

function normaliseWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function slugifyDashed(s: string) {
  // "Vision Engineer" -> "vision-engineer"
  return normaliseWhitespace(s)
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s\-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-")
    .trim();
}

function slugifyUnderscore(s: string) {
  // "Vision Engineer" -> "vision_engineer"
  return normaliseWhitespace(s)
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s\-_]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function filenameWithSpaces(s: string) {
  // "Vision Engineer" -> "vision engineer" (your current file)
  return normaliseWhitespace(s).toLowerCase();
}

function inferImageBase(reportFrameworkPath: string) {
  const p = String(reportFrameworkPath || "").toLowerCase();

  // OperatingFrame
  if (p.includes("operatingframe")) return "/images/operatingframe-full-test";

  // LEAD
  if (p.includes("lead")) return "/images/mindCanvas-LEAD-system";

  // Unknown framework: no auto images
  return "";
}

function ProfileCardImage({
  profileName,
  basePath,
  className,
}: {
  profileName?: string;
  basePath: string;
  className?: string;
}) {
  const name = String(profileName || "").trim();
  if (!name || !basePath) return null;

  const candidates = useMemo(() => {
    const dashed = slugifyDashed(name);
    const underscored = slugifyUnderscore(name);
    const spaced = filenameWithSpaces(name);

    // Try in a sensible order:
    // 1) exact “spaced” (matches your current "vision engineer.png")
    // 2) dashed (recommended)
    // 3) underscored (fallback)
    const files = [spaced, dashed, underscored]
      .filter(Boolean)
      .map((f) => `${basePath}/profile-cards/${encodeURIComponent(f)}.png`);

    // De-dupe (if name has no spaces, all three may match)
    return Array.from(new Set(files));
  }, [name, basePath]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // Reset if profile/base changes
    setIdx(0);
  }, [candidates.join("|")]);

  const src = candidates[idx];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={name}
      crossOrigin="anonymous"
      className={className}
      onError={(e) => {
        // Try next candidate. If none left, hide.
        if (idx < candidates.length - 1) {
          setIdx(idx + 1);
          return;
        }
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

export default function FrameworkReportClient({
  token,
  tid,
  reportFramework,
}: {
  token: string;
  tid: string;
  reportFramework: { bucket: string; path: string; version?: string };
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<FrameworkReportAPI["data"] | null>(null);

  const reportRef = useRef<HTMLDivElement | null>(null);

  const title = payload?.test_name || "Personalised report";
  const participant = useMemo(() => fullName(payload?.taker), [payload?.taker]);

  const imageBase = useMemo(() => inferImageBase(reportFramework?.path || ""), [reportFramework?.path]);

  async function downloadPdf() {
    const el = reportRef.current;
    if (!el) return;

    // Force full-height capture (prevents “half report missing”)
    const prevScroll = window.scrollY;
    window.scrollTo(0, 0);

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#050914",
      height: el.scrollHeight,
      windowHeight: el.scrollHeight,
      scrollY: -window.scrollY,
    });

    window.scrollTo(0, prevScroll);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`mindcanvas-report-${token}.pdf`);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const base = await getBaseUrl();
        const url = `${base}/api/public/test/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(tid)}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as FrameworkReportAPI | null;

        if (!res.ok || !json || json.ok === false || !json.data) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }

        if (cancelled) return;
        setPayload(json.data);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(String(e?.message || e));
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, tid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-5xl p-6">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="mt-3 text-sm text-slate-300">Loading…</p>
        </main>
      </div>
    );
  }

  if (err || !payload) {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-5xl p-6 space-y-3">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="text-sm text-red-400">Could not load your report. Please refresh.</p>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap">{err}</pre>
        </main>
      </div>
    );
  }

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-12 pt-8 md:px-6 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6">
          <div className="flex items-start gap-4">
            {/* NEW: top profile image (fail-soft, only if base path is known) */}
            {payload?.top_profile_name && imageBase ? (
              <div className="hidden sm:block">
                <ProfileCardImage
                  profileName={payload.top_profile_name}
                  basePath={imageBase}
                  className="h-16 w-auto rounded-xl border border-white/10 bg-white/5 p-1"
                />
              </div>
            ) : null}

            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-slate-300">PERSONALISED REPORT</p>
              <h1 className="mt-2 text-3xl font-bold">{title}</h1>
              <p className="mt-2 text-sm text-slate-200">
                For {participant}
                {payload?.top_profile_name ? (
                  <>
                    {" · "}
                    Top profile: <span className="font-semibold">{payload.top_profile_name}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <button
            onClick={downloadPdf}
            className="inline-flex items-center rounded-lg border border-slate-500 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm hover:bg-slate-800"
          >
            Download PDF
          </button>
        </header>

        <FrameworkSectionsRenderer sections={payload.sections} />
      </div>
    </div>
  );
}

