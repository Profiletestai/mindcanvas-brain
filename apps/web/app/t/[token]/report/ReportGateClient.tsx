// apps/web/app/t/[token]/report/ReportGateClient.tsx
"use client";

import { useEffect, useState } from "react";
import AppBackground from "@/components/ui/AppBackground";

import LegacyReportClient from "./LegacyReportClient";
import LegacyOrgReportClient from "./LegacyOrgReportClient";

type GateMode = "loading" | "storage" | "legacy" | "error";

type GateAPI = {
  ok: boolean;
  data?: {
    sections?: any | null;
    debug?: { useStorageFramework?: boolean };
    version?: string;
  };
  error?: string;
};

export default function ReportGateClient(props: { token: string; tid: string; src?: string }) {
  const { token, tid } = props;
  const src = typeof props.src === "string" ? props.src : "";

  const [mode, setMode] = useState<GateMode>("loading");
  const [err, setErr] = useState<string | null>(null);

  const [decisionDebug, setDecisionDebug] = useState<{
    url?: string;
    version?: string;
    useStorageFramework?: boolean;
    decided?: "storage" | "legacy";
    src?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setMode("loading");
        setErr(null);
        setDecisionDebug(null);

        if (!tid) {
          setMode("error");
          setErr("This page expects a ?tid= parameter.");
          return;
        }

        const qs = new URLSearchParams();
        qs.set("tid", tid);
        if (src) qs.set("src", src); // ✅ forward src

        const url = `/api/public/test/${encodeURIComponent(token)}/report?${qs.toString()}`;

        const res = await fetch(url, { cache: "no-store" });
        const ct = res.headers.get("content-type") ?? "";

        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
        }

        const json = (await res.json()) as GateAPI;

        if (!res.ok || json.ok === false) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        const explicitStorageFlag = Boolean(json.data?.debug?.useStorageFramework);
        const version = String(json.data?.version || "");
        const versionSuggestsStorage =
          version.toLowerCase().includes("storage") || version.toLowerCase().includes("portal-v2");

        const useStorage = explicitStorageFlag || versionSuggestsStorage;

        if (cancelled) return;

        setDecisionDebug({
          url,
          version: json.data?.version,
          useStorageFramework: json.data?.debug?.useStorageFramework,
          decided: useStorage ? "storage" : "legacy",
          src,
        });

        setMode(useStorage ? "storage" : "legacy");
      } catch (e: any) {
        if (cancelled) return;
        setMode("error");
        setErr(String(e?.message || e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, tid, src]);

  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-4xl p-6">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="mt-4 text-sm text-slate-300">Loading your report…</p>
        </main>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="min-h-screen bg-[#050914] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-4xl p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Personalised report</h1>
          <p className="text-sm text-red-400">Could not load your report.</p>
          <details className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-50">
            <summary className="cursor-pointer font-medium">Debug information</summary>
            <div className="mt-2 space-y-2">
              <div>Error: {err ?? "Unknown"}</div>
              {decisionDebug?.url ? <div>URL: {decisionDebug.url}</div> : null}
              {decisionDebug?.src ? <div>src: {decisionDebug.src}</div> : <div>src: —</div>}
            </div>
          </details>
        </main>
      </div>
    );
  }

  if (mode === "storage") {
    return <LegacyReportClient token={token} tid={tid} />;
  }

  return <LegacyOrgReportClient token={token} tid={tid} />;
}

