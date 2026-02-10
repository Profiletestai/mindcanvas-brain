// apps/web/app/portal/dashboard-v2/DashboardV2Client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

/** Neon sparkline (minimal, wow-factor, no libs) */
function SparklineNeon({
  data,
  height = 120,
}: {
  data: TimelinePoint[];
  height?: number;
}) {
  const width = 820; // virtual viewBox width
  const padX = 14;
  const padY = 14;

  const pts = useMemo(() => {
    const items = (data || []).slice();
    items.sort((a, b) => (a.date < b.date ? -1 : 1));
    const n = items.length;
    if (!n) return { items, points: [] as { x: number; y: number; v: number }[] };

    const maxV = Math.max(1, ...items.map((d) => d.submissions || 0));
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const points = items.map((d, i) => {
      const x = padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const v = d.submissions || 0;
      const y = padY + (1 - v / maxV) * innerH;
      return { x, y, v };
    });

    return { items, points };
  }, [data, height]);

  const path = useMemo(() => {
    const p = pts.points;
    if (!p.length) return "";
    if (p.length === 1) return `M ${p[0].x} ${p[0].y}`;
    // Smooth curve (Catmull-Rom-ish via quadratic)
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      const prev = p[i - 1];
      const cur = p[i];
      const midX = (prev.x + cur.x) / 2;
      const midY = (prev.y + cur.y) / 2;
      d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    // last segment
    const last = p[p.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  }, [pts.points]);

  const area = useMemo(() => {
    const p = pts.points;
    if (!p.length) return "";
    const baseline = height - 10;
    return `${path} L ${p[p.length - 1].x} ${baseline} L ${p[0].x} ${baseline} Z`;
  }, [path, pts.points, height]);

  const leftLabel = pts.items[0]?.date ?? "";
  const rightLabel = pts.items[pts.items.length - 1]?.date ?? "";

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[140px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
        role="img"
        aria-label="Submissions over time"
      >
        <defs>
          <linearGradient id="mcLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#64bae2" />
            <stop offset="45%" stopColor="#2d8fc4" />
            <stop offset="100%" stopColor="#7c5cff" />
          </linearGradient>

          <linearGradient id="mcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64bae2" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#2d8fc4" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#050914" stopOpacity="0" />
          </linearGradient>

          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <pattern id="mcGrid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>

          <radialGradient id="mcRad" cx="30%" cy="10%" r="80%">
            <stop offset="0%" stopColor="rgba(100,186,226,0.20)" />
            <stop offset="40%" stopColor="rgba(45,143,196,0.10)" />
            <stop offset="100%" stopColor="rgba(5,9,20,0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="url(#mcRad)" />
        <rect x="0" y="0" width={width} height={height} fill="url(#mcGrid)" opacity="0.55" />

        {area ? <path d={area} fill="url(#mcArea)" /> : null}

        {path ? (
          <>
            <path d={path} stroke="url(#mcLine)" strokeWidth="3.2" fill="none" filter="url(#glow)" />
            <path d={path} stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" />
          </>
        ) : null}
      </svg>

      <div className="mt-2 flex justify-between text-[11px] text-white/60">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export default function DashboardV2Client({
  orgSlug,
  embedded = false,
}: {
  orgSlug?: string;
  embedded?: boolean;
}) {
  const sp = useSearchParams();
  const org = orgSlug ?? sp?.get("org") ?? "team-puzzle";

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
        const def = (payload.tests || []).find((t) => t.is_default_dashboard) || null;
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
      q.set("org", org);
      if (selectedTestId) q.set("testId", selectedTestId);
      if (appliedFromIso) q.set("from", appliedFromIso);
      if (appliedToIso) q.set("to", appliedToIso);

      const res = await fetch(`/api/portal-dashboard-v2/link?${q.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      setDrawerData(j);

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

  function downloadDrawerCsv() {
    if (!drawerData?.ok) return;

    const linkName = drawerData?.link?.name || drawerData?.link?.label || "link";
    const safeName = String(linkName).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);

    const lines: string[] = [];

    const pushSection = (title: string, header: string[], rows: any[][]) => {
      lines.push(csvEscape(title));
      lines.push(header.map(csvEscape).join(","));
      for (const r of rows) lines.push(r.map(csvEscape).join(","));
      lines.push("");
    };

    const profiles = (drawerData?.distributions?.profiles || []).map((p: any) => [
      p.name || "",
      p.code || "",
      Math.round(p.count || 0),
      Math.round(clampPct(p.pct || 0) * 100),
      Math.round(p.avgPoints || 0),
    ]);

    const freqs = (drawerData?.distributions?.frequencies || []).map((f: any) => [
      f.name || "",
      f.code || "",
      Math.round(f.count || 0),
      Math.round(clampPct(f.pct || 0) * 100),
      Math.round(f.avgPoints || 0),
    ]);

    const companies = (drawerData?.segments?.companies || []).map((c: any) => [
      c.company || "",
      Math.round(c.testsTaken || c.count || 0),
      Math.round(clampPct(c.pct || 0) * 100),
    ]);

    pushSection("Top profiles", ["profile_name", "profile_code", "count", "pct", "avg_points"], profiles);
    pushSection("Top frequencies", ["frequency_name", "frequency_code", "count", "pct", "avg_points"], freqs);
    pushSection("Companies", ["company", "tests_taken", "pct"], companies);

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `link_analytics_${org}_${safeName}_${fromDate}_to_${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
  const nonZeroLinks = useMemo(() => links.filter((l) => (l.testsTaken || 0) > 0), [links]);
  const zeroLinks = useMemo(() => links.filter((l) => (l.testsTaken || 0) === 0), [links]);

  const sortedTimeline = useMemo(() => {
    const t = (data?.timeline ?? []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  // ✅ FIX: Open full analytics must go to /portal/[slug]/dashboard/beta/link/[token]
  const fullAnalyticsHref = useMemo(() => {
    if (!selectedToken) return null;
    const q = new URLSearchParams();
    // keep filters so the link page uses the same window
    if (selectedTestId) q.set("testId", selectedTestId);
    if (appliedFromIso) q.set("from", appliedFromIso);
    if (appliedToIso) q.set("to", appliedToIso);
    const qs = q.toString();
    return `/portal/${org}/dashboard/beta/link/${selectedToken}${qs ? `?${qs}` : ""}`;
  }, [selectedToken, org, selectedTestId, appliedFromIso, appliedToIso]);

  const FiltersRow = (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div className="min-w-[260px]">
        <label className="block text-xs text-white/60 mb-1">Test</label>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="h-11 w-full rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
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
          className="h-11 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-11 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
        />
      </div>

      <button
        onClick={loadMain}
        className="h-11 rounded-xl bg-white text-black px-4 text-sm font-semibold hover:bg-white/90"
      >
        Apply
      </button>
    </div>
  );

  return (
    <div className="min-h-screen p-6 space-y-6 text-white">
      {!embedded ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Beta</div>
              <h1 className="text-2xl font-semibold">Dashboard v2</h1>
              <p className="text-sm text-white/70">
                Link analytics console (drill-down + export).
              </p>
            </div>
            {FiltersRow}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Beta</div>
              <div className="text-lg font-semibold">Dashboard v2</div>
            </div>
            {FiltersRow}
          </div>
        </div>
      )}

      {loading && <div className="text-white/70">Loading…</div>}
      {err && <div className="text-red-300">Error: {err}</div>}

      {!loading && !err && data?.ok && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Submissions</div>
              <div className="text-4xl font-semibold mt-1">{fmtNum(data.kpis.submissions)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="text-4xl font-semibold mt-1">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-1">
                {data.kpis.uniqueTakers != null && data.kpis.submissions
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.submissions)} unique`
                  : ""}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Active links</div>
              <div className="text-4xl font-semibold mt-1">{fmtNum(data.kpis.activeLinks)}</div>
            </div>
          </div>

          {/* Timeline + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Submissions over time</h2>
                <div className="text-xs text-white/50">
                  {isoToDateInput(data.filters.from)} → {isoToDateInput(data.filters.to)}
                </div>
              </div>
              <div className="mt-4">
                {sortedTimeline.length ? (
                  <SparklineNeon data={sortedTimeline} />
                ) : (
                  <div className="text-sm text-white/60">No activity in this range.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Insights (Beta)</h2>
                {insightsLoading ? <span className="text-xs text-white/50">Generating…</span> : null}
              </div>

              {!insights && !insightsLoading ? (
                <div className="mt-3 text-sm text-white/60">
                  Insights unavailable (non-blocking). Dashboard data is still valid.
                </div>
              ) : null}

              {insights ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="text-xs text-white/50">
                    Confidence: <span className="font-medium text-white/80">{insights.confidence.level}</span> · n=
                    {fmtNum(insights.confidence.sampleSize)}
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
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Links</h2>
                <p className="text-sm text-white/60">Search, sort, drill down, export.</p>
                <div className="text-xs text-white/50 mt-1">
                  {links.length} links · {nonZeroLinks.length} with usage · {zeroLinks.length} with zero usage
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={downloadMainCsv}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                  title="Download the link table as CSV"
                >
                  Download CSV
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left font-medium">Link</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Tests taken</th>
                    <th className="py-2 text-left font-medium">Top profiles</th>
                    <th className="py-2 text-left font-medium">Top frequency</th>
                    <th className="py-2 text-left font-medium">Created</th>
                    <th className="py-2 text-left font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => {
                    const topP = l.topProfilesByCount?.slice(0, 3) || [];
                    const topF = l.topFrequencyByCount;

                    return (
                      <tr key={l.linkId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 pr-3">
                          <button className="text-left hover:underline" onClick={() => openLink(l.token)}>
                            <div className="font-medium">{l.name || l.label || "Untitled link"}</div>
                            {l.label && l.name ? <div className="text-xs text-white/50">Label: {l.label}</div> : null}
                          </button>
                        </td>

                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeClass(
                              l.isActive
                            )}`}
                          >
                            {l.isActive === false ? "Inactive" : "Active"}
                          </span>
                        </td>

                        <td className="py-3 pr-3 text-right font-semibold">{fmtNum(l.testsTaken)}</td>

                        <td className="py-3 pr-3">
                          {topP.length ? (
                            <div className="flex flex-wrap gap-2">
                              {topP.map((p) => (
                                <span
                                  key={p.code}
                                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs"
                                  title={`${fmtNum(p.count)} (${fmtPct(p.pct)})`}
                                >
                                  {p.name} <span className="ml-2 text-white/50">{fmtPct(p.pct)}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-white/50">—</span>
                          )}
                        </td>

                        <td className="py-3 pr-3">
                          {topF ? (
                            <span
                              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs"
                              title={`${fmtNum(topF.count)} (${fmtPct(topF.pct)})`}
                            >
                              {topF.name} <span className="ml-2 text-white/50">{fmtPct(topF.pct)}</span>
                            </span>
                          ) : (
                            <span className="text-white/50">—</span>
                          )}
                        </td>

                        <td className="py-3 pr-3 text-white/70">{fmtDateTime(l.createdAt)}</td>
                        <td className="py-3 pr-3 text-white/70">{fmtDateTime(l.expiresAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
              <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-[#050914] border-l border-white/10 p-4 overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-white/50">Link deep dive</div>
                    <div className="text-lg font-semibold truncate">
                      {drawerData?.link?.name || drawerData?.link?.label || "Untitled link"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {fullAnalyticsHref ? (
                      <Link
                        href={fullAnalyticsHref}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                      >
                        Open full analytics
                      </Link>
                    ) : null}

                    <button
                      onClick={downloadDrawerCsv}
                      disabled={!drawerData?.ok}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                      title="Download link analytics as CSV"
                    >
                      CSV
                    </button>

                    <button
                      onClick={() => {
                        setDrawerOpen(false);
                        setSelectedToken(null);
                        setDrawerData(null);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {drawerLoading && <div className="mt-4 text-white/70">Loading link analytics…</div>}
                {drawerErr && <div className="mt-4 text-red-300">Error: {drawerErr}</div>}

                {!drawerLoading && !drawerErr && drawerData?.ok && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60">Tests taken</div>
                        <div className="text-xl font-semibold">{fmtNum(drawerData?.kpis?.testsTaken)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60">Unique takers</div>
                        <div className="text-xl font-semibold">{fmtNum(drawerData?.kpis?.uniqueTakers)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60">Last used</div>
                        <div className="text-xs text-white/80 mt-1">{fmtDateTime(drawerData?.kpis?.lastUsedAt)}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Insights (Beta)</h3>
                        {drawerData?._insights?.confidence ? (
                          <div className="text-xs text-white/50">
                            {drawerData._insights.confidence.level} · n=
                            {fmtNum(drawerData._insights.confidence.sampleSize)}
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
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

