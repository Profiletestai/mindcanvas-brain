// apps/web/app/t/[token]/report/ReportGateClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type MetaAPI = {
  ok?: boolean;
  data?: any;
  error?: string;
  // sometimes endpoints return raw meta without {ok,data}
  [k: string]: any;
};

function norm(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function detectQsc(meta: any): { isQsc: boolean; variant: "entrepreneur" | "leader" } {
  const frameworkType = norm(meta?.framework_type || meta?.test?.framework_type);
  const resultType = norm(meta?.result_type || meta?.test?.result_type);

  const qscVariantRaw =
    meta?.qsc_variant ||
    meta?.test?.qsc_variant ||
    meta?.meta?.qsc_variant ||
    meta?.link?.meta?.qsc_variant ||
    meta?.meta?.variant ||
    meta?.variant;

  const qscVariant = norm(qscVariantRaw);

  const isQsc =
    frameworkType === "qsc" ||
    resultType === "qsc" ||
    qscVariant === "entrepreneur" ||
    qscVariant === "leader" ||
    // extra safety: name/slug sometimes includes it
    norm(meta?.test_name).includes("qsc") ||
    norm(meta?.test?.name).includes("qsc") ||
    norm(meta?.test_slug).includes("qsc") ||
    norm(meta?.test?.slug).includes("qsc");

  const variant: "entrepreneur" | "leader" = qscVariant === "leader" ? "leader" : "entrepreneur";
  return { isQsc, variant };
}

export default function ReportGateClient(props: { token: string; tid: string; src?: string }) {
  const router = useRouter();

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
    qscDetected?: boolean;
    qscVariant?: string;
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

        // --- existing report endpoint (keep exactly as your current approach) ---
        const qs = new URLSearchParams();
        qs.set("tid", tid);
        if (src) qs.set("src", src); // forward src

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

        // --- NEW: QSC detection (narrow + fail-soft) ---
        // Only redirect when we can positively identify QSC.
        let qscDetected = false;
        let qscVariant: "entrepreneur" | "leader" = "entrepreneur";

        try {
          const metaRes = await fetch(`/api/public/test/${encodeURIComponent(token)}`, {
            cache: "no-store",
          });

          const metaCt = metaRes.headers.get("content-type") ?? "";
          if (metaCt.includes("application/json")) {
            const metaJson = (await metaRes.json()) as MetaAPI;
            const meta = (metaJson?.data ?? metaJson) as any;

            const q = detectQsc(meta);
            qscDetected = q.isQsc;
            qscVariant = q.variant;
          }
        } catch {
          // Fail-soft: if meta check fails, do nothing and continue with existing logic.
          qscDetected = false;
          qscVariant = "entrepreneur";
        }

        if (cancelled) return;

        setDecisionDebug({
          url,
          version: json.data?.version,
          useStorageFramework: json.data?.debug?.useStorageFramework,
          decided: useStorage ? "storage" : "legacy",
          src,
          qscDetected,
          qscVariant,
        });

        // If QSC → redirect to the QSC report route and stop.
        if (qscDetected) {
          const qsp = new URLSearchParams();
          qsp.set("tid", tid);
          if (src) qsp.set("src", src);

          router.replace(
            `/qsc/${encodeURIComponent(token)}/${encodeURIComponent(qscVariant)}?${qsp.toString()}`
          );
          return;
        }

        // Otherwise: preserve existing behavior.
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
  }, [token, tid, src, router]);

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
              {decisionDebug?.qscDetected ? (
                <div>QSC detected: yes ({decisionDebug.qscVariant})</div>
              ) : (
                <div>QSC detected: no</div>
              )}
            </div>
          </details>
        </main>
      </div>
    );
  }

  // NOTE: keep your original mapping exactly:
  // "storage" → LegacyReportClient
  // "legacy"  → LegacyOrgReportClient
  if (mode === "storage") {
    return <LegacyReportClient token={token} tid={tid} />;
  }

  return <LegacyOrgReportClient token={token} tid={tid} />;
}

