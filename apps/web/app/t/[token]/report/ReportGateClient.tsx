// apps/web/app/t/[token]/report/ReportGateClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import NativeBlocksReportClient from "./NativeBlocksReportClient";
import LegacyReportClient from "./LegacyReportClient";
import LegacyOrgReportClient from "./LegacyOrgReportClient";
import OperatingFrameReportClient from "./OperatingFrameReportClient";
import FiveDLeadershipReportClient from "./FiveDLeadershipReportClient";

type AB = "A" | "B" | "C" | "D";

type LinkMeta = {
  next_steps_url?: string | null;
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  email_report?: boolean | null;
  meta?: any;
};

type RaisonDetreData = {
  raw_score: number;
  percentage: number;
  eligible_count?: number;
  answered_count?: number;
};

type ResultData = {
  org_slug: string;
  org_name?: string | null;
  org_logo_url?: string | null;
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

  raison_detre?: RaisonDetreData;
  raison_detre_raw_score?: number;
  raison_detre_percentage?: number;

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

function supabasePublicFrameworkUrl(bucket: string, path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) return "";

  const cleanBucket = String(bucket || "framework").trim();
  const cleanPath = String(path || "").replace(/^\/+/, "");
  if (!cleanPath) return "";

  return `${base}/storage/v1/object/public/${cleanBucket}/${cleanPath}`;
}

function getStorageFrameworkPath(data: ResultData | null) {
  const p1 = String(data?.debug?.storageFrameworkPath || "").trim();
  if (p1) return p1;

  const p2 = String(data?.sections?.framework_path || "").trim();
  if (p2) return p2;

  const p3 = String(data?.sections?.reportFramework?.path || "").trim();
  if (p3) return p3;

  const p4 = String(data?.debug?.reportFramework?.path || "").trim();
  if (p4) return p4;

  return "";
}

function getStorageFrameworkBucket(data: ResultData | null) {
  const b1 = String(data?.debug?.storageFrameworkBucket || "").trim();
  if (b1) return b1;

  const b2 = String(data?.sections?.framework_bucket || "").trim();
  if (b2) return b2;

  const b3 = String(data?.sections?.reportFramework?.bucket || "").trim();
  if (b3) return b3;

  const b4 = String(data?.debug?.reportFramework?.bucket || "").trim();
  if (b4) return b4;

  return "framework";
}

function normaliseProfileCode(code: any) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return "";

  if (/^PROFILE_\d+$/.test(c)) return c;

  if (/^P\d+$/.test(c)) {
    return `PROFILE_${c.replace("P", "")}`;
  }

  if (/^\d+$/.test(c)) {
    return `PROFILE_${c}`;
  }

  return c;
}

function unwrapFrameworkRoot(frameworkJson: any) {
  if (!frameworkJson) return null;

  // LEAD framework public JSON shape:
  // { framework: { common: { sections: [] }, profiles: { PROFILE_1: { sections: [] } } } }
  if (frameworkJson.framework && typeof frameworkJson.framework === "object") {
    return frameworkJson.framework;
  }

  // Some older loaders used reportFramework as the root.
  if (frameworkJson.reportFramework && typeof frameworkJson.reportFramework === "object") {
    return frameworkJson.reportFramework;
  }

  return frameworkJson;
}

function getSectionsArray(value: any) {
  if (Array.isArray(value)) return value.filter(Boolean);

  if (Array.isArray(value?.sections)) {
    return value.sections.filter(Boolean);
  }

  return [];
}

function getProfileSectionsFromFramework(root: any, profileCode: string) {
  const code = normaliseProfileCode(profileCode);
  const profiles = root?.profiles || {};

  const direct = profiles?.[profileCode];
  const normalised = profiles?.[code];

  const directSections = getSectionsArray(direct);
  if (directSections.length > 0) return directSections;

  const normalisedSections = getSectionsArray(normalised);
  if (normalisedSections.length > 0) return normalisedSections;

  return [];
}

function hasUsableFrameworkProfileSections(data: ResultData | null) {
  if (!data?.sections) return false;

  const root = unwrapFrameworkRoot(data.sections);
  const profileSections = getProfileSectionsFromFramework(root, data.top_profile_code);

  return profileSections.length > 0;
}

function applyFrameworkToReportData(data: ResultData, frameworkJson: any): ResultData {
  const root = unwrapFrameworkRoot(frameworkJson);
  if (!root) return data;

  const profileCode = normaliseProfileCode(data.top_profile_code);
  const commonSections = getSectionsArray(root?.common);
  const profileSections = getProfileSectionsFromFramework(root, profileCode);

  // Keep the original API data, but replace/augment the sections object so
  // NativeBlocksReportClient receives the real framework sections instead of
  // empty placeholder profile sections.
  return {
    ...data,
    sections: {
      ...(data.sections || {}),
      framework: root,
      common: commonSections.length > 0 ? commonSections : data.sections?.common,
      profile: profileSections.length > 0 ? profileSections : data.sections?.profile,
      profiles: root?.profiles || data.sections?.profiles,
      framework_path: getStorageFrameworkPath(data) || data.sections?.framework_path,
      framework_bucket: getStorageFrameworkBucket(data) || data.sections?.framework_bucket,
    },
    debug: {
      ...(data.debug || {}),
      clientLoadedFramework: true,
      clientFrameworkProfileCode: profileCode,
      clientFrameworkCommonSectionsCount: commonSections.length,
      clientFrameworkProfileSectionsCount: profileSections.length,
    },
  };
}

function isOperatingFrame(data: ResultData | null) {
  const path = getStorageFrameworkPath(data).toLowerCase();
  return path.startsWith("operatingframe/");
}

function isLegacyOrgForced(data: ResultData | null) {
  const slug = String(data?.org_slug || "").toLowerCase().trim();
  return slug === "team-puzzle" || slug === "competency-coach";
}

function isFiveDLeadership(data: ResultData | null) {
  const slug = String(data?.org_slug || "").toLowerCase().trim();
  const orgName = String(data?.org_name || "").toLowerCase().trim();
  const testName = String(data?.test_name || "").toLowerCase().trim();
  const frameworkPath = String(data?.sections?.framework_path || data?.debug?.storageFrameworkPath || "")
    .toLowerCase()
    .trim();

  return (
    slug.includes("5d") ||
    orgName.includes("5d") ||
    testName.includes("5d leadership") ||
    testName.includes("5d leadership compass") ||
    frameworkPath.includes("5dleadershipcompass") ||
    frameworkPath.includes("5d-leadership")
  );
}

async function fetchPublicFramework(data: ResultData) {
  const storagePath = getStorageFrameworkPath(data);
  const bucket = getStorageFrameworkBucket(data);
  const fwUrl = supabasePublicFrameworkUrl(bucket, storagePath);

  if (!fwUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or storage framework path.");
  }

  const fwRes = await fetch(fwUrl, { cache: "no-store" });

  if (!fwRes.ok) {
    const t = await fwRes.text();
    throw new Error(`Framework fetch failed (${fwRes.status}): ${t.slice(0, 200)}`);
  }

  return fwRes.json();
}

export default function ReportGateClient(props: { token: string; tid: string; src?: string }) {
  const { token, tid, src } = props;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ResultData | null>(null);

  const [ofFramework, setOfFramework] = useState<any | null>(null);
  const [ofErr, setOfErr] = useState<string | null>(null);

  const [nativeBlocksFramework, setNativeBlocksFramework] = useState<any | null>(null);
  const [nativeBlocksFrameworkErr, setNativeBlocksFrameworkErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);
        setData(null);
        setOfFramework(null);
        setOfErr(null);
        setNativeBlocksFramework(null);
        setNativeBlocksFrameworkErr(null);

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

        const shouldUseBlocksEngine = json.data.debug?.useBlocksEngine === true;
        const shouldLoadOperatingFrame = isOperatingFrame(json.data);
        const shouldLoadNativeBlocksFramework =
          shouldUseBlocksEngine &&
          !shouldLoadOperatingFrame &&
          !!getStorageFrameworkPath(json.data) &&
          !hasUsableFrameworkProfileSections(json.data);

        if (shouldLoadOperatingFrame) {
          try {
            const fwJson = await fetchPublicFramework(json.data);

            if (cancelled) return;
            setOfFramework(fwJson);
          } catch (e: any) {
            if (cancelled) return;
            setOfErr(String(e?.message || e));
          }
        }

        if (shouldLoadNativeBlocksFramework) {
          try {
            const fwJson = await fetchPublicFramework(json.data);

            if (cancelled) return;
            setNativeBlocksFramework(fwJson);
          } catch (e: any) {
            if (cancelled) return;
            setNativeBlocksFrameworkErr(String(e?.message || e));
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

  const useBlocksEngine = useMemo(() => data?.debug?.useBlocksEngine === true, [data?.debug]);
  const forcedLegacy = useMemo(() => isLegacyOrgForced(data), [data]);
  const isOF = useMemo(() => isOperatingFrame(data), [data]);
  const isFiveD = useMemo(() => isFiveDLeadership(data), [data]);

  const nativeBlocksData = useMemo(() => {
    if (!data) return null;

    if (!nativeBlocksFramework) {
      if (!nativeBlocksFrameworkErr) return data;

      return {
        ...data,
        debug: {
          ...(data.debug || {}),
          clientLoadedFramework: false,
          clientFrameworkError: nativeBlocksFrameworkErr,
        },
      };
    }

    return applyFrameworkToReportData(data, nativeBlocksFramework);
  }, [data, nativeBlocksFramework, nativeBlocksFrameworkErr]);

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
              <div>org_slug: {safeText(data?.org_slug || "")}</div>
              <div>test_name: {safeText(data?.test_name || "")}</div>
              <div>useBlocksEngine: {safeText(String(data?.debug?.useBlocksEngine ?? ""))}</div>
              <div>storageFrameworkPath: {safeText(getStorageFrameworkPath(data))}</div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  if (forcedLegacy) {
    return <LegacyOrgReportClient token={token} tid={tid} />;
  }

  if (isFiveD) {
    return <FiveDLeadershipReportClient token={token} tid={tid} src={src || ""} data={data as any} />;
  }

  if (isOF) {
    if (ofErr || !ofFramework) {
      const bucket = getStorageFrameworkBucket(data);
      const path = getStorageFrameworkPath(data);

      return (
        <div className="min-h-screen bg-[#050914] text-white">
          <div className="mx-auto max-w-4xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Personalised report</h1>
            <p className="text-sm text-red-400">Could not load OperatingFrame report content.</p>

            <details className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-50">
              <summary className="cursor-pointer font-medium">Debug information</summary>
              <div className="mt-2 space-y-2">
                <div>Framework error: {safeText(ofErr ?? "Unknown")}</div>
                <div>Framework bucket: {safeText(bucket)}</div>
                <div>Framework path: {safeText(path)}</div>
                <div>Framework URL: {safeText(supabasePublicFrameworkUrl(bucket, path))}</div>
              </div>
            </details>
          </div>
        </div>
      );
    }

    return (
      <OperatingFrameReportClient
        token={token}
        tid={tid}
        src={src || ""}
        data={data as any}
        framework={ofFramework}
      />
    );
  }

  if (useBlocksEngine) {
    return (
      <NativeBlocksReportClient
        token={token}
        tid={tid}
        src={src || ""}
        data={(nativeBlocksData || data) as any}
      />
    );
  }

  return <LegacyReportClient token={token} tid={tid} />;
}