// apps/web/app/t/[token]/report/ReportGateClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import NativeBlocksReportClient from "./NativeBlocksReportClient";
import LegacyReportClient from "./LegacyReportClient";

type AB = "A" | "B" | "C" | "D";

type LinkMeta = {
  next_steps_url?: string | null;
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  email_report?: boolean | null;
};

type ReportSectionBlock =
  | { type: "p"; text?: string }
  | { type: "ul"; items?: string[] }
  | { type: "ol"; items?: string[] }
  | { type: "quote"; text?: string; cite?: string }
  | { type: "divider" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | { type: "image"; src?: string; alt?: string; caption?: string; align?: "left" | "center" | "right"; max_h?: number }
  | { type: string; [k: string]: any };

type ReportSection = {
  id?: string;
  title?: string;
  blocks?: ReportSectionBlock[];
};

type SectionsPayload = {
  common?: ReportSection[] | null;
  profile?: ReportSection[] | null;
  report_title?: string | null;
  profile_missing?: boolean;
  framework_version?: string | null;
  framework_bucket?: string | null;
  framework_path?: string | null;
};

type ResultData = {
  org_slug: string;
  org_name?: string | null;
  test_name: string;

  taker: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  };

  link?: LinkMeta;

  frequency_labels: Array<{ code: AB; name: string }>;
  frequency_percentages: Record<AB, number>;
  frequency_totals?: Record<AB, number>;

  profile_labels: Array<{ code: string; name: string }>;
  profile_percentages: Record<string, number>;
  profile_totals?: Record<string, number>;

  top_freq: AB;
  top_profile_code: string;
  top_profile_name: string;

  sections?: SectionsPayload | null;

  debug?: any;
  version?: string;
};

type ApiResponse = { ok: boolean; data?: ResultData; error?: string };

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

export default function ReportGateClient(props: { token: string; tid: string; src?: string }) {
  const { token, tid, src } = props;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ResultData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        if (!tid) {
          setErr("Missing tid");
          setLoading(false);
          return;
        }

        const qs = new URLSearchParams();
        qs.set("tid", tid);
        if (src) qs.set("src", src);

        const url = `/api/public/test/${encodeURIComponent(token)}/report?${qs.toString()}`;

        const res = await fetch(url, { cache: "no-store" });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
        }

        const json = (await res.json()) as ApiResponse;
        if (!res.ok || json.ok === false || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        if (cancelled) return;
        setData(json.data);
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
  }, [token, tid, src]);

  const useBlocksEngine = useMemo(() => {
    const flag = data?.debug?.useBlocksEngine;
    return flag === true;
  }, [data?.debug]);

  if (!tid) {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <div className="mx-auto max-w-4xl p-6">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="mt-4 text-sm text-slate-300">
            This page expects a <code>?tid=</code> parameter.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <div className="mx-auto max-w-4xl p-6">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="mt-4 text-sm text-slate-300">Loading your report…</p>
        </div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <div className="mx-auto max-w-4xl p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="text-sm text-red-400">Could not load your report.</p>
          <details className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-50">
            <summary className="cursor-pointer font-medium">Debug information</summary>
            <div className="mt-2 space-y-2">
              <div>Error: {safeText(err ?? "Unknown")}</div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ✅ Native v2 blocks renderer (your scalable path)
  if (useBlocksEngine) {
    return <NativeBlocksReportClient token={token} tid={tid} src={src || ""} data={data} />;
  }

  // ✅ Legacy fallback for anything not using the blocks engine
  return <LegacyReportClient token={token} tid={tid} />;
}