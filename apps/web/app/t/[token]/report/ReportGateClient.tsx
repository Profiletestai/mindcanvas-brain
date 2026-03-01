// apps/web/app/t/[token]/report/ReportGateClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import NativeBlocksReportClient from "./NativeBlocksReportClient";
import LegacyReportClient from "./LegacyReportClient";
import OperatingFrameReportClient from "./OperatingFrameReportClient";

type AB = "A" | "B" | "C" | "D";

type LinkMeta = {
  next_steps_url?: string | null;
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  email_report?: boolean | null;
  meta?: any;
};

type ResultData = {
  org_slug: string;
  org_name?: string | null;
  test_name: string;

  taker: { id: string; first_name?: string | null; last_name?: string | null };

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

  sections?: any;

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

function supabasePublicFrameworkUrlForOperatingFrame() {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/storage/v1/object/public/framework/operatingframe/operatingframe_report_content_v1.json`;
}

function isOperatingFrame(data: ResultData | null) {
  const key = String(data?.debug?.storageFrameworkPath || "").trim();
  return key === "operatingframe/operatingframe_report_content_v1.json";
}

// ✅ Absolute guards for orgs that must NEVER use native blocks engine in /t/ flow
function isLegacyOrgForced(data: ResultData | null) {
  const slug = String(data?.org_slug || "").toLowerCase().trim();
  return slug === "team-puzzle" || slug === "competency-coach";
}

export default function ReportGateClient(props: { token: string; tid: string; src?: string }) {
  const { token, tid, src } = props;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ResultData | null>(null);

  const [ofFramework, setOfFramework] = useState<any | null>(null);
  const [ofErr, setOfErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);
        setData(null);
        setOfFramework(null);
        setOfErr(null);

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

        // OperatingFrame loads framework JSON from bucket
        if (isOperatingFrame(json.data)) {
          const fwUrl = supabasePublicFrameworkUrlForOperatingFrame();
          if (!fwUrl) {
            setOfErr("Missing NEXT_PUBLIC_SUPABASE_URL (cannot load OperatingFrame framework JSON).");
            setLoading(false);
            return;
          }

          try {
            const fwRes = await fetch(fwUrl, { cache: "no-store" });
            if (!fwRes.ok) {
              const t = await fwRes.text();
              throw new Error(`Framework fetch failed (${fwRes.status}): ${t.slice(0, 200)}`);
            }
            const fwJson = await fwRes.json();
            if (cancelled) return;
            setOfFramework(fwJson);
          } catch (e: any) {
            if (cancelled) return;
            setOfErr(String(e?.message || e));
          }
        }

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

  const forcedLegacy = useMemo(() => isLegacyOrgForced(data), [data]);
  const isOF = useMemo(() => isOperatingFrame(data), [data]);

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

  // ✅ HARD GUARD: Team Puzzle & Competency Coach always use legacy in /t/ flow
  if (forcedLegacy) {
    return <LegacyReportClient token={token} tid={tid} />;
  }

  // ✅ OperatingFrame always wins (special renderer)
  if (isOF) {
    if (ofErr || !ofFramework) {
      return (
        <div className="min-h-screen bg-[#050914] text-white">
          <div className="mx-auto max-w-4xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Personalised report</h1>
            <p className="text-sm text-red-400">Could not load OperatingFrame report content.</p>
            <details className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-50">
              <summary className="cursor-pointer font-medium">Debug information</summary>
              <div className="mt-2 space-y-2">
                <div>Framework error: {safeText(ofErr ?? "Unknown")}</div>
                <div>Framework URL: {safeText(supabasePublicFrameworkUrlForOperatingFrame())}</div>
                <div>storageFrameworkPath: {safeText(data?.debug?.storageFrameworkPath || "")}</div>
              </div>
            </details>
          </div>
        </div>
      );
    }

    return <OperatingFrameReportClient token={token} tid={tid} src={src || ""} data={data as any} framework={ofFramework} />;
  }

  // ✅ Native blocks engine only for tests explicitly flagged (non-legacy orgs)
  if (useBlocksEngine) {
    return <NativeBlocksReportClient token={token} tid={tid} src={src || ""} data={data as any} />;
  }

  return <LegacyReportClient token={token} tid={tid} />;
}