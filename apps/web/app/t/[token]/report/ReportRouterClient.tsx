"use client";

import { useEffect, useState } from "react";
import { getBaseUrl } from "@/lib/server-url";

import LegacyReportClient from "./LegacyReportClient";
import FrameworkReportClient from "./FrameworkReportClient";
import InevitableStandardReportClient from "./InevitableStandardReportClient";

type AnyJson = any;

function getReportMeta(metaJson: AnyJson) {
  const root = metaJson?.data ?? metaJson ?? {};
  return root?.meta ?? root?.test?.meta ?? root?.row?.meta ?? root?.test_meta ?? null;
}

function isInevitableStandard(metaJson: AnyJson): boolean {
  const root = metaJson?.data ?? metaJson ?? {};
  const meta = getReportMeta(metaJson) || {};
  const engineKey = String(meta?.engine_key || root?.engine_key || "")
    .toLowerCase()
    .trim();
  const slug = String(meta?.slug || root?.slug || root?.test?.slug || "")
    .toLowerCase()
    .trim();
  const name = String(meta?.assessment_name || root?.test_name || root?.test?.name || "")
    .toLowerCase()
    .trim();

  return (
    meta?.is_inevitable_standard === true ||
    engineKey === "inevitable_standard" ||
    engineKey === "inevitable-standard" ||
    slug === "inevitable-standard" ||
    slug.startsWith("inevitable-standard-") ||
    name.includes("inevitable standard")
  );
}

function pickReportFramework(metaJson: AnyJson) {
  const root = metaJson?.data ?? metaJson ?? {};
  const meta = getReportMeta(metaJson);
  const rf =
    meta?.reportFramework ||
    root?.reportFramework ||
    root?.meta?.reportFramework ||
    null;

  const bucket = rf?.bucket ? String(rf.bucket) : "";
  const path = rf?.path ? String(rf.path) : "";
  const version = rf?.version ? String(rf.version) : "";

  if (!bucket || !path) return null;
  return { bucket, path, version };
}

export default function ReportRouterClient({ token, tid }: { token: string; tid: string }) {
  const [mode, setMode] = useState<
    "loading" | "inevitable_standard" | "framework" | "legacy"
  >("loading");
  const [rf, setRf] = useState<{ bucket: string; path: string; version?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const base = await getBaseUrl();
        const metaRes = await fetch(`${base}/api/public/test/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });

        if (!metaRes.ok) {
          if (!cancelled) setMode("legacy");
          return;
        }

        const metaJson = await metaRes.json().catch(() => null);

        if (isInevitableStandard(metaJson)) {
          if (!cancelled) setMode("inevitable_standard");
          return;
        }

        const reportFramework = pickReportFramework(metaJson);
        if (reportFramework) {
          if (cancelled) return;
          setRf(reportFramework);
          setMode("framework");
          return;
        }

        if (!cancelled) setMode("legacy");
      } catch {
        if (!cancelled) setMode("legacy");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!tid) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-white">
        <h1 className="text-2xl font-semibold">Personalised report</h1>
        <p className="mt-3 text-sm text-slate-300">
          This page expects a <code>?tid=</code> parameter.
        </p>
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="mx-auto max-w-4xl p-6 text-white">
        <h1 className="text-2xl font-semibold">Personalised report</h1>
        <p className="mt-3 text-sm text-slate-300">Loading…</p>
      </div>
    );
  }

  if (mode === "inevitable_standard") {
    return <InevitableStandardReportClient token={token} tid={tid} />;
  }

  if (mode === "framework" && rf) {
    return <FrameworkReportClient token={token} tid={tid} reportFramework={rf} />;
  }

  return <LegacyReportClient token={token} tid={tid} />;
}