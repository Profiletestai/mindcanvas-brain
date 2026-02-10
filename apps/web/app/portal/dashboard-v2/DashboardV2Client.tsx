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

/** MindCanvas background layer (grid + glow) */
function MindCanvasBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-10%,rgba(17,49,73,0.95)_0%,rgba(8,18,27,0.92)_55%,rgba(6,14,22,0.96)_100%)]" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-40 bg-[radial-gradient(circle_at_center,rgba(100,186,226,0.45),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/50" />
    </div>
  );
}

/** Neon sparkline with area glow */
function Sparkline({
  data,
  height = 140,
}: {
  data: TimelinePoint[];
  height?: number;
}) {
  const width = 920; // virtual width for consistent geometry
  const padX = 10;
  const padY = 12;

  const values = data.map((d) => Math.max(0, d.submissions || 0));
  const max = Math.max(1, ...values);
  const min = 0;

  const n = Math.max(2, data.length);
  const dx = (width - padX * 2) / (n - 1);

  // Build points
  const pts = data.map((d, i) => {
    const v = Math.max(0, d.submissions || 0);
    const t = (v - min) / (max - min || 1); // 0..1
    const x = padX + i * dx;
    const y = padY + (1 - t) * (height - padY * 2);
    return { x, y, v, date: d.date };
  });

  // Smoothing: Catmull-Rom to Bezier
  function pathSmooth(points: { x: number; y: number }[]) {
    if (points.length < 2) return "";
    const p = points;
    let d = `M ${p[0].x} ${p[0].y}`;

    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;

      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const linePath = pathSmooth(pts);
  const baselineY = height - padY;

  const areaPath =
    pts.length >= 2
      ? `${linePath} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`
      : "";

  const leftLabel = data[0]?.date ?? "";
  const rightLabel = data[data.length - 1]?.date ?? "";

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        {/* subtle inner glow */}
        <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(800px_220px_at_50%_0%,rgba(100,186,226,0.18),transparent_60%)]" />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full"
          role="img"
          aria-label="Submissions timeline"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="mcLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(100,186,226,0.95)" />
              <stop offset="50%" stopColor="rgba(45,143,196,0.95)" />
              <stop offset="100%" stopColor="rgba(1,90,139,0.95)" />
            </linearGradient>

            <linearGradient id="mcArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(100,186,226,0.30)" />
              <stop offset="60%" stopColor="rgba(45,143,196,0.14)" />
              <stop offset="100%" stopColor="rgba(1,90,139,0.0)" />
            </linearGradient>

            <filter id="glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.9 0"
                result="coloredBlur"
              />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* grid-ish horizontal guides */}
          {[0.2, 0.4, 0.6, 0.8].map((t, i) => {
            const y = padY + t * (height - padY * 2);
            return (
              <line
                key={i}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            );
          })}

          {/* area */}
          {areaPath ? <path d={areaPath} fill="url(#mcArea)" /> : null}

          {/* glow line (under) */}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke="url(#mcLine)"
              strokeWidth="6"
              opacity="0.22"
              filter="url(#glow)"
            />
          ) : null}

          {/* main line */}
          {linePath ? (
            <path d={linePath} fill="none" stroke="url(#mcLine)" strokeWidth="2.8" />
          ) : null}

          {/* dots */}
          {pts.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3.4" fill="rgba(255,255,255,0.85)" opacity="0.35" />
              <circle
                cx={p.x}
                cy={p.y}
                r="2.0"
                fill="rgba(100,186,226,0.95)"
              >
                <title>
                  {p.date}: {Math.round(p.v)}
                </title>
              </circle>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-white/60">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
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

export default function DashboardV2Client({
  orgSlug,
  embedded = false,
}: {
  orgSlug?: string;
  embedded?: boolean;
}) {
  const sp = useSearchParams();
  const org = orgSlug ?? sp?.get("org") ?? "team-puzzle";

  // Default: last 30 days
  const now = new Date();
  const defaultTo = isoToDateInput(now.toISOString());
  const defaultFrom = isoToDateInput(new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString());

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

  const [testsLoading, setTestsLoading] = useState(false);
  const [testsErr, setTestsErr] = useState("");
  const [tests, setTests] = useState<PortalTestsPayload["tests"]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(""); // empty = all tests

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

  // ✅ FIX: point to the existing full analytics page route you already have
  const fullAnalyticsHref = useMemo(() => {
    if (!selectedToken) return null;
    const q = new URLSearchParams();
    if (selectedTestId) q.set("testId", selectedTestId);
    if (appliedFromIso) q.set("from", appliedFromIso);
    if (appliedToIso) q.set("to", appliedToIso);
    const qs = q.toString();
    return `/portal/${encodeURIComponent(org)}/dashboard/beta/link/${encodeURIComponent(selectedToken)}${qs ? `?${qs}` : ""}`;
  }, [selectedToken, org, selectedTestId, appliedFromIso, appliedToIso]);

  const FiltersRow = (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div className="min-w-[260px]">
        <label className="block text-xs text-white/60 mb-1">Test</label>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="h-10 w-full rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/12"
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
          className="h-10 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-10 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20"
        />
      </div>

      <button
        onClick={loadMain}
        className="h-10 rounded-xl bg-white text-black px-4 text-sm font-medium hover:bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        Apply
      </button>
    </div>
  );

  const Card = ({ children }: { children: any }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen p-6 space-y-6 text-white">
      <MindCanvasBackdrop />

      {!embedded ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-40 bg-[radial-gradient(circle_at_center,rgba(100,186,226,0.35),transparent_60%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Beta</div>
              <h1 className="text-2xl font-semibold">Dashboard v2</h1>
              <p className="text-sm text-white/70">Link analytics console (drill-down + export).</p>
            </div>
            {FiltersRow}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-xs text-white/60">Submissions</div>
              <div className="mt-1 text-3xl font-semibold">{fmtNum(data.kpis.submissions)}</div>
              <div className="mt-3 h-[3px] w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,rgba(100,186,226,0.85),rgba(45,143,196,0.85),rgba(1,90,139,0.85))]" />
              </div>
            </Card>

            <Card>
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="mt-1 text-3xl font-semibold">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-1">
                {data.kpis.uniqueTakers != null && data.kpis.submissions
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.submissions)} unique`
                  : ""}
              </div>
            </Card>

            <Card>
              <div className="text-xs text-white/60">Active links</div>
              <div className="mt-1 text-3xl font-semibold">{fmtNum(data.kpis.activeLinks)}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Submissions over time</h2>
                <div className="text-xs text-white/50">
                  {data.filters.from ? isoToDateInput(data.filters.from) : ""} →{" "}
                  {data.filters.to ? isoToDateInput(data.filters.to) : ""}
                </div>
              </div>
              <div className="mt-3">
                {sortedTimeline.length ? (
                  <Sparkline data={sortedTimeline} height={150} />
                ) : (
                  <div className="text-sm text-white/60">No activity in this range.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Links</h2>
                <p className="text-sm text-white/60">Search, sort, drill down, export.</p>
                <div className="text-xs text-white/50 mt-1">
                  Showing {links.length} · {nonZeroLinks.length} with usage · {zeroLinks.length} with zero usage
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={downloadMainCsv}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  title="Download link table as CSV"
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
                          <button className="text-left" onClick={() => openLink(l.token)}>
                            <div className="font-medium hover:underline">{l.name || l.label || "Untitled link"}</div>
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
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                        title="Open full analytics page"
                      >
                        Open full analytics
                      </Link>
                    ) : null}

                    <button
                      onClick={downloadDrawerCsv}
                      disabled={!drawerData?.ok}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                      title="Download link analytics as CSV"
                    >
                      Download CSV
                    </button>

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

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h3 className="font-semibold">Company segmentation</h3>
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

