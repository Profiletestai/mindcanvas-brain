// apps/web/app/portal/[slug]/dashboard/DashboardClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TimelinePoint = { date: string; submissions: number };

type TopByCount = { code: string; name: string; count: number; pct: number };
type TopByAvg = { code: string; name: string; avgPoints: number; n: number };

type LinkRow = {
  linkId: string;
  token: string;
  name: string | null;
  label: string | null;
  isActive: boolean | null;
  createdAt: string;
  expiresAt: string | null;
  useCount: number;
  maxUses: number | null;
  testsTaken: number;

  topProfilesByCount: TopByCount[];
  topProfilesByAvg: TopByAvg[];

  topFrequencyByCount: TopByCount | null;
  topFrequencyByAvg: TopByAvg | null;
};

type DashboardV2Payload = {
  ok: true;
  filters: { orgId: string; org: string | null; testId: string | null; from: string; to: string };
  kpis: { submissions: number; uniqueTakers: number | null; activeLinks: number };
  timeline: TimelinePoint[];
  links: LinkRow[];
};

type PortalTestsPayload = {
  ok: true;
  org: string;
  tests: { id: string; name: string; slug: string; is_default_dashboard?: boolean | null; status?: string | null }[];
};

type InsightsPayload = {
  ok: true;
  summary: {
    whatYoureSeeing: string[];
    whatItSuggests: string[];
    recommendedNextSteps: string[];
    watchOuts: string[];
    confidence: { sampleSize: number; level: "low" | "medium" | "high" };
  };
};

function isoToDateInput(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIsoStart(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
}

function dateInputToIsoEnd(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString();
}

function clampPct(p: number) {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

function fmtPct(p: number) {
  const v = Math.round(clampPct(p) * 100);
  return `${v}%`;
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

function badgeClass(active: boolean | null) {
  if (active === false) return "bg-red-500/10 text-red-200 border-red-500/20";
  if (active === true) return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
  return "bg-white/5 text-white/70 border-white/10";
}

/** CSV helpers */
function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, header: string[], rows: any[][]) {
  const lines = [header.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** MindCanvas background (self-contained, no dependency) */
function MindCanvasGrid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* depth gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,#113149_0%,#08121b_55%,#060e16_100%)]" />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* slight vignette */}
      <div className="absolute inset-0 bg-[#050914]/55" />
    </div>
  );
}

/** Neon sparkline with area glow */
function SparklineGlow({ data, height = 130 }: { data: TimelinePoint[]; height?: number }) {
  const w = 900;
  const h = height;
  const padX = 10;
  const padY = 12;

  const sorted = (data || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const values = sorted.map((d) => Number(d.submissions || 0));
  const maxV = Math.max(1, ...values);
  const n = Math.max(2, sorted.length);
  const step = (w - padX * 2) / (n - 1);

  const points = sorted.map((d, i) => {
    const x = padX + i * step;
    const t = Number(d.submissions || 0) / (maxV || 1);
    const y = padY + (1 - t) * (h - padY * 2);
    return { x, y };
  });

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const areaD =
    lineD +
    ` L ${(padX + (n - 1) * step).toFixed(2)} ${(h - padY).toFixed(2)}` +
    ` L ${padX.toFixed(2)} ${(h - padY).toFixed(2)} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label="Submissions over time">
        <defs>
          <linearGradient id="mc-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#64bae2" />
            <stop offset="0.45" stopColor="#8b6cff" />
            <stop offset="1" stopColor="#2d8fc4" />
          </linearGradient>

          <linearGradient id="mc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#64bae2" stopOpacity="0.35" />
            <stop offset="0.65" stopColor="#8b6cff" stopOpacity="0.10" />
            <stop offset="1" stopColor="#050914" stopOpacity="0" />
          </linearGradient>

          <filter id="mc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.85 0"
              result="colored"
            />
            <feMerge>
              <feMergeNode in="colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* subtle chart grid */}
        <g opacity="0.14">
          {Array.from({ length: 12 }).map((_, i) => {
            const x = (i / 11) * w;
            return <line key={`vx-${i}`} x1={x} y1={0} x2={x} y2={h} stroke="white" strokeWidth="1" />;
          })}
          {Array.from({ length: 6 }).map((_, i) => {
            const y = (i / 5) * h;
            return <line key={`hy-${i}`} x1={0} y1={y} x2={w} y2={y} stroke="white" strokeWidth="1" />;
          })}
        </g>

        <path d={areaD} fill="url(#mc-area)" />
        <path d={lineD} stroke="url(#mc-line)" strokeWidth="6" fill="none" filter="url(#mc-glow)" strokeLinecap="round" />
        <path d={lineD} stroke="url(#mc-line)" strokeWidth="2.75" fill="none" strokeLinecap="round" />
      </svg>

      <div className="mt-2 flex justify-between text-[11px] text-white/60">
        <span>{sorted[0]?.date ?? ""}</span>
        <span>{sorted[sorted.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

export default function DashboardClient({ orgSlug }: { orgSlug: string }) {
  const org = orgSlug;
  const sp = useSearchParams();
  const router = useRouter();
  const createdSlugInitial = sp?.get("created") ?? null;
  const [createdSlug, setCreatedSlug] = useState<string | null>(createdSlugInitial);

  useEffect(() => {
    if (!createdSlugInitial) return;
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("created");
    const qs = params.toString();
    router.replace(
      qs
        ? `/portal/${orgSlug}/dashboard?${qs}`
        : `/portal/${orgSlug}/dashboard`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const defaultTo = isoToDateInput(now.toISOString());
  const defaultFrom = isoToDateInput(new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString());

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

  const [testsLoading, setTestsLoading] = useState(false);
  const [testsErr, setTestsErr] = useState("");
  const [tests, setTests] = useState<PortalTestsPayload["tests"]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [data, setData] = useState<DashboardV2Payload | null>(null);

  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsPayload["summary"] | null>(null);

  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerErr, setDrawerErr] = useState<string>("");
  const [drawerData, setDrawerData] = useState<any>(null);

  const appliedFromIso = useMemo(() => dateInputToIsoStart(fromDate), [fromDate]);
  const appliedToIso = useMemo(() => dateInputToIsoEnd(toDate), [toDate]);

  async function loadTests() {
    try {
      setTestsLoading(true);
      setTestsErr("");
      const res = await fetch(`/api/portal-tests?org=${encodeURIComponent(org)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);

      const payload = j as PortalTestsPayload;
      setTests(payload.tests || []);

      if (!selectedTestId) {
        const def = (payload.tests || []).find((t) => t.is_default_dashboard) || (payload.tests || [])[0] || null;
        if (def?.id) setSelectedTestId(def.id);
      }
    } catch (e: any) {
      setTestsErr(String(e?.message || e));
      setTests([]);
    } finally {
      setTestsLoading(false);
    }
  }

  async function loadMain() {
    try {
      setLoading(true);
      setErr("");
      setInsights(null);

      const q = new URLSearchParams();
      q.set("org", org);
      if (selectedTestId) q.set("testId", selectedTestId);
      if (appliedFromIso) q.set("from", appliedFromIso);
      if (appliedToIso) q.set("to", appliedToIso);

      const res = await fetch(`/api/portal-dashboard-v2?${q.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      setData(j as DashboardV2Payload);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadInsights(d: DashboardV2Payload) {
    try {
      setInsightsLoading(true);

      const topLink = (d.links || []).slice().sort((a, b) => b.testsTaken - a.testsTaken)[0] || null;

      const payload = {
        scope: selectedTestId ? "test" : "org",
        orgId: d.filters.orgId,
        testId: d.filters.testId,
        linkToken: null,
        from: d.filters.from,
        to: d.filters.to,
        metrics: {
          kpis: d.kpis,
          timeline: d.timeline,
          topProfiles: topLink?.topProfilesByCount || [],
          topFrequency: topLink?.topFrequencyByCount || null,
          topCompanies: [],
        },
      };

      const res = await fetch(`/api/portal-dashboard-v2/insights`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      setInsights((j as InsightsPayload).summary);
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function openLink(token: string) {
    setSelectedToken(token);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerErr("");
    setDrawerData(null);

    try {
      const q = new URLSearchParams();
      q.set("token", token);
      if (appliedFromIso) q.set("from", appliedFromIso);
      if (appliedToIso) q.set("to", appliedToIso);

      const res = await fetch(`/api/portal-dashboard-v2/link?${q.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      setDrawerData(j);

      // link insights (non-blocking)
      const linkTopProfiles = j?.distributions?.profiles?.slice?.(0, 3) || [];
      const linkTopFrequency = j?.distributions?.frequencies?.[0] || null;
      const topCompanies = j?.segments?.companies?.slice?.(0, 5) || [];

      const insightPayload = {
        scope: "link",
        orgId: j?.link?.orgId,
        testId: j?.link?.testId,
        linkToken: token,
        from: j?.filters?.from,
        to: j?.filters?.to,
        metrics: {
          kpis: { testsTaken: j?.kpis?.testsTaken ?? 0, submissions: j?.kpis?.testsTaken ?? 0 },
          timeline: j?.timeline ?? [],
          topProfiles: linkTopProfiles,
          topFrequency: linkTopFrequency,
          topCompanies,
        },
      };

      fetch(`/api/portal-dashboard-v2/insights`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(insightPayload),
      })
        .then((r) => r.json())
        .then((jj) => {
          if (jj?.ok) setDrawerData((prev: any) => ({ ...prev, _insights: jj.summary }));
        })
        .catch(() => {});
    } catch (e: any) {
      setDrawerErr(String(e?.message || e));
    } finally {
      setDrawerLoading(false);
    }
  }

  function downloadMainCsv() {
    const d = data;
    if (!d?.ok) return;

    const header = [
      "link_name",
      "label",
      "status",
      "tests_taken",
      "top_profile_1",
      "top_profile_1_pct",
      "top_profile_2",
      "top_profile_2_pct",
      "top_profile_3",
      "top_profile_3_pct",
      "top_frequency",
      "top_frequency_pct",
      "created_at",
      "expires_at",
    ];

    const rows = (d.links || []).map((l) => {
      const topP = l.topProfilesByCount?.slice(0, 3) || [];
      const p1 = topP[0],
        p2 = topP[1],
        p3 = topP[2];
      const topF = l.topFrequencyByCount;

      return [
        l.name || "",
        l.label || "",
        l.isActive === false ? "inactive" : "active",
        Math.round(l.testsTaken || 0),
        p1?.name || "",
        p1 ? Math.round(clampPct(p1.pct) * 100) : "",
        p2?.name || "",
        p2 ? Math.round(clampPct(p2.pct) * 100) : "",
        p3?.name || "",
        p3 ? Math.round(clampPct(p3.pct) * 100) : "",
        topF?.name || "",
        topF ? Math.round(clampPct(topF.pct) * 100) : "",
        l.createdAt || "",
        l.expiresAt || "",
      ];
    });

    const filename = `dashboard_links_${org}_${fromDate}_to_${toDate}${selectedTestId ? `_test_${selectedTestId}` : ""}.csv`;
    downloadCsv(filename, header, rows);
  }

  // Full analytics route (NO beta, and matches your new folder structure)
  const fullAnalyticsHref = useMemo(() => {
    if (!selectedToken) return null;
    const q = new URLSearchParams();
    if (selectedTestId) q.set("testId", selectedTestId);
    if (appliedFromIso) q.set("from", appliedFromIso);
    if (appliedToIso) q.set("to", appliedToIso);
    const qs = q.toString();
    return `/portal/${org}/dashboard/link/${selectedToken}${qs ? `?${qs}` : ""}`;
  }, [selectedToken, org, selectedTestId, appliedFromIso, appliedToIso]);

  useEffect(() => {
    loadTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  useEffect(() => {
    loadMain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, selectedTestId]);

  useEffect(() => {
    if (data?.ok) loadInsights(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.filters?.from, data?.filters?.to, data?.kpis?.submissions, data?.filters?.testId]);

  const links = useMemo(() => data?.links ?? [], [data]);

  const sortedTimeline = useMemo(() => {
    const t = (data?.timeline ?? []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  const wowCard =
    "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur";

  return (
    <div className="relative min-h-screen p-6 space-y-6 text-white">
      <MindCanvasGrid />

      {createdSlug && (
        <div
          role="status"
          className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-4"
          style={{
            background: "rgba(34,197,94,0.10)",
            borderColor: "rgba(34,197,94,0.35)",
            color: "rgb(187,247,208)",
          }}
        >
          <span className="text-sm">
            Sub-account <span className="font-semibold">{createdSlug}</span> created.
          </span>
          <button
            type="button"
            onClick={() => setCreatedSlug(null)}
            className="text-xs uppercase tracking-widest text-white/70 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className={wowCard}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(900px_260px_at_20%_0%,rgba(100,186,226,0.35),transparent_65%)]" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(700px_220px_at_90%_30%,rgba(124,92,255,0.30),transparent_60%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-sm text-white/70">Link analytics console (drill-down + export).</p>
            {data?.filters?.orgId && (
              <div className="mt-3 flex gap-2 flex-wrap">
                <Link
                  href={`/portal/sub-accounts/new/organisation?parentOrgId=${encodeURIComponent(data.filters.orgId)}&parentOrgSlug=${encodeURIComponent(org)}`}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
                    boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
                  }}
                >
                  + Create sub-account
                </Link>
                <Link
                  href={`/portal/${encodeURIComponent(org)}/sub-accounts`}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold text-white border border-white/15 bg-white/[0.06] hover:bg-white/[0.1]"
                >
                  Manage sub-accounts
                </Link>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="min-w-[240px]">
              <label className="block text-xs text-white/60 mb-1">Test</label>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="h-10 w-full rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
              >
                <option value="">All tests</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {testsLoading ? <div className="mt-1 text-xs text-white/50">Loading tests…</div> : null}
              {testsErr ? <div className="mt-1 text-xs text-red-300">Tests error: {testsErr}</div> : null}
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
              />
            </div>

            <button onClick={loadMain} className="h-10 rounded-xl bg-white text-black px-4 text-sm font-medium hover:bg-white/90">
              Apply
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-white/70">Loading…</div>}
      {err && <div className="text-red-300">Error: {err}</div>}

      {!loading && !err && data?.ok && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={wowCard}>
              <div className="text-xs text-white/60">Submissions</div>
              <div className="text-5xl font-semibold mt-2">{fmtNum(data.kpis.submissions)}</div>
              <div className="mt-4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="mt-3 text-xs text-white/55">Total across selected range</div>
            </div>

            <div className={wowCard}>
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="text-5xl font-semibold mt-2">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="mt-4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="mt-3 text-xs text-white/55">
                {data.kpis.uniqueTakers != null && data.kpis.submissions
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.submissions)} unique`
                  : "—"}
              </div>
            </div>

            <div className={wowCard}>
              <div className="text-xs text-white/60">Active links</div>
              <div className="text-5xl font-semibold mt-2">{fmtNum(data.kpis.activeLinks)}</div>
              <div className="mt-4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="mt-3 text-xs text-white/55">Currently usable links</div>
            </div>
          </div>

          {/* Timeline + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`${wowCard} lg:col-span-2`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-lg">Submissions over time</h2>
                  <div className="text-xs text-white/50 mt-1">
                    {data.filters.from ? isoToDateInput(data.filters.from) : ""} to {data.filters.to ? isoToDateInput(data.filters.to) : ""}
                  </div>
                </div>
                <div className="text-xs text-white/50 rounded-full border border-white/10 bg-white/5 px-3 py-1">Neon</div>
              </div>

              <div className="mt-4">
                {sortedTimeline.length ? <SparklineGlow data={sortedTimeline} height={130} /> : <div className="text-sm text-white/60">No activity in this range.</div>}
              </div>
            </div>

            <div className={wowCard}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Insights</h2>
                {insightsLoading ? <span className="text-xs text-white/50">Generating…</span> : null}
              </div>

              {!insights && !insightsLoading ? (
                <div className="mt-3 text-sm text-white/60">Insights unavailable (non-blocking). Dashboard data is still valid.</div>
              ) : null}

              {insights ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="text-xs text-white/50">
                    Confidence: <span className="font-medium text-white/80">{insights.confidence.level}</span> · n={fmtNum(insights.confidence.sampleSize)}
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-1">What you’re seeing</div>
                    <ul className="list-disc pl-5 space-y-1 text-white/85">
                      {insights.whatYoureSeeing.slice(0, 4).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Recommended next steps</div>
                    <ul className="list-disc pl-5 space-y-1 text-white/85">
                      {insights.recommendedNextSteps.slice(0, 3).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Links */}
          <div className={wowCard}>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Links</h2>
                <p className="text-sm text-white/60">Click a link to drill down into link-level insights + segmentation.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={downloadMainCsv}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                  title="Download link table as CSV"
                >
                  Download CSV
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {links.map((l) => {
                const topP = l.topProfilesByCount?.slice(0, 3) || [];
                const topF = l.topFrequencyByCount;

                return (
                  <button
                    key={l.linkId}
                    onClick={() => openLink(l.token)}
                    className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition px-4 py-4"
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold truncate">{l.name || l.label || "Untitled link"}</div>
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] ${badgeClass(l.isActive)}`}>
                            {l.isActive === false ? "Inactive" : "Active"}
                          </span>
                        </div>

                        <div className="text-xs text-white/50 mt-1">
                          Created {fmtDateTime(l.createdAt)} · Expires {fmtDateTime(l.expiresAt)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-white/60">Tests</div>
                        <div className="text-2xl font-semibold">{fmtNum(l.testsTaken)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {topF ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">
                          Top freq <span className="ml-2 text-white/85">{topF.name}</span>
                          <span className="ml-2 text-white/50">{fmtPct(topF.pct)}</span>
                        </span>
                      ) : null}

                      {topP.map((p) => (
                        <span key={p.code} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">
                          {p.name} <span className="ml-2 text-white/50">{fmtPct(p.pct)}</span>
                        </span>
                      ))}

                      {!topP.length && !topF ? <span className="text-white/50 text-sm">—</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawer */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => {
                  setDrawerOpen(false);
                  setSelectedToken(null);
                  setDrawerData(null);
                }}
              />

              <div className="absolute right-0 top-0 h-full w-full max-w-[600px] bg-[#050914] border-l border-white/10 p-5 overflow-y-auto">
                {/* local grid + glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)",
                    backgroundSize: "64px 64px",
                    maskImage: "radial-gradient(circle at 30% 10%, black 0%, transparent 70%)",
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-40 left-1/2 h-[80vh] w-[120vw] -translate-x-1/2 blur-3xl opacity-30"
                  style={{
                    background:
                      "radial-gradient(60% 40% at 50% 0%, rgba(100,186,226,.35), transparent 60%), radial-gradient(45% 35% at 20% 10%, rgba(139,108,255,.25), transparent 55%)",
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-white/50">Link deep dive</div>
                      <div className="text-lg font-semibold truncate">{drawerData?.link?.name || drawerData?.link?.label || "Untitled link"}</div>
                    </div>

                    <div className="flex gap-2">
                      {fullAnalyticsHref ? (
                        <Link
                          href={fullAnalyticsHref}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                          title="Open full analytics page"
                        >
                          Open full analytics
                        </Link>
                      ) : null}

                      <button
                        onClick={() => {
                          setDrawerOpen(false);
                          setSelectedToken(null);
                          setDrawerData(null);
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {drawerLoading && <div className="mt-4 text-white/70">Loading link analytics…</div>}
                  {drawerErr && <div className="mt-4 text-red-300">Error: {drawerErr}</div>}

                  {!drawerLoading && !drawerErr && drawerData?.ok && (
                    <div className="mt-5 space-y-4">
                      {/* KPIs */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                          <div className="text-xs text-white/60">Tests taken</div>
                          <div className="text-2xl font-semibold mt-1">{fmtNum(drawerData?.kpis?.testsTaken)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                          <div className="text-xs text-white/60">Unique takers</div>
                          <div className="text-2xl font-semibold mt-1">{fmtNum(drawerData?.kpis?.uniqueTakers)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                          <div className="text-xs text-white/60">Last used</div>
                          <div className="text-xs text-white/80 mt-2">{fmtDateTime(drawerData?.kpis?.lastUsedAt)}</div>
                        </div>
                      </div>

                      {/* Insights */}
                      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Insights</h3>
                          {drawerData?._insights?.confidence ? (
                            <div className="text-xs text-white/50">
                              {drawerData._insights.confidence.level} · n={fmtNum(drawerData._insights.confidence.sampleSize)}
                            </div>
                          ) : null}
                        </div>

                        {drawerData?._insights ? (
                          <div className="mt-3 text-sm">
                            <ul className="list-disc pl-5 space-y-1 text-white/85">
                              {(drawerData._insights.whatYoureSeeing || []).slice(0, 4).map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-white/60">Generating link insights…</div>
                        )}
                      </div>

                      {/* Top profiles */}
                      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                        <h3 className="font-semibold">Top profiles</h3>
                        <div className="mt-3 space-y-2">
                          {(drawerData?.distributions?.profiles || []).slice(0, 10).map((p: any) => (
                            <div key={p.code} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{p.name}</div>
                                <div className="text-xs text-white/50">
                                  {fmtNum(p.count)} · {fmtPct(p.pct)}
                                </div>
                              </div>
                              <div className="text-xs text-white/70">avg {fmtNum(p.avgPoints || 0)}</div>
                            </div>
                          ))}
                          {!((drawerData?.distributions?.profiles || []).length) ? (
                            <div className="text-sm text-white/60">No profile data.</div>
                          ) : null}
                        </div>
                      </div>

                      {/* Top frequencies */}
                      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                        <h3 className="font-semibold">Top frequencies</h3>
                        <div className="mt-3 space-y-2">
                          {(drawerData?.distributions?.frequencies || []).slice(0, 8).map((f: any) => (
                            <div key={f.code} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{f.name}</div>
                                <div className="text-xs text-white/50">
                                  {fmtNum(f.count)} · {fmtPct(f.pct)}
                                </div>
                              </div>
                              <div className="text-xs text-white/70">avg {fmtNum(f.avgPoints || 0)}</div>
                            </div>
                          ))}
                          {!((drawerData?.distributions?.frequencies || []).length) ? (
                            <div className="text-sm text-white/60">No frequency data.</div>
                          ) : null}
                        </div>
                      </div>

                      {/* Top companies */}
                      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                        <h3 className="font-semibold">Top companies</h3>
                        <div className="mt-3 space-y-2">
                          {(drawerData?.segments?.companies || []).length ? (
                            (drawerData.segments.companies || []).slice(0, 12).map((c: any) => (
                              <div key={c.company} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{c.company}</div>
                                  <div className="text-xs text-white/50">
                                    {fmtNum(c.testsTaken)} · {fmtPct(c.pct)}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-white/60">No company data captured for this link.</div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-white/50">
                        Full exports (including takers) live on the full analytics page.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
