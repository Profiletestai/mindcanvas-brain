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

/** Premium UI building blocks */
function GradientCard({
  children,
  className = "",
  glow = true,
}: {
  children: any;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl p-[1px]",
        "bg-gradient-to-br from-white/14 via-white/6 to-white/10",
        glow ? "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_50px_rgba(0,0,0,0.45)]" : "",
        className,
      ].join(" ")}
    >
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        {/* subtle radial highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
          style={{
            background:
              "radial-gradient(900px 400px at 15% 0%, rgba(100,186,226,0.16), transparent 55%), radial-gradient(700px 360px at 100% 0%, rgba(45,143,196,0.10), transparent 60%)",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = "cyan",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "cyan" | "blue" | "emerald";
}) {
  const accentClass =
    accent === "emerald"
      ? "from-emerald-400/25"
      : accent === "blue"
      ? "from-blue-400/25"
      : "from-cyan-400/25";

  return (
    <GradientCard className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-wide uppercase text-white/55">{label}</div>
            <div className="mt-2 text-4xl font-semibold leading-none text-white">{value}</div>
            {sub ? <div className="mt-2 text-xs text-white/55">{sub}</div> : null}
          </div>

          <div
            className={[
              "h-10 w-10 rounded-xl border border-white/10",
              "bg-gradient-to-br",
              accentClass,
              "to-transparent",
            ].join(" ")}
          />
        </div>
      </div>

      {/* bottom sheen */}
      <div
        aria-hidden
        className="h-[1px] w-full"
        style={{
          background:
            "linear-gradient(90deg, rgba(100,186,226,0.0), rgba(100,186,226,0.35), rgba(45,143,196,0.0))",
        }}
      />
    </GradientCard>
  );
}

function Pill({ children, title }: { children: any; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/85"
    >
      {children}
    </span>
  );
}

function MiniBars({ data }: { data: TimelinePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.submissions || 0));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-24">
        {data.map((p) => {
          const h = Math.max(2, Math.round((p.submissions / max) * 96));
          return (
            <div key={p.date} className="flex-1 min-w-[6px]">
              <div
                className="w-full rounded-sm bg-white/75"
                style={{ height: `${h}px` }}
                title={`${p.date}: ${Math.round(p.submissions)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/55">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[data.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

export default function DashboardV2Client({ orgSlug, embedded = false }: { orgSlug?: string; embedded?: boolean }) {
  const sp = useSearchParams();
  const org = orgSlug ?? sp?.get("org") ?? "team-puzzle";
  const debug = sp?.get("debug") === "1";

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

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"tests_desc" | "created_desc" | "name_asc">("tests_desc");

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

  const sortedTimeline = useMemo(() => {
    const t = (data?.timeline ?? []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  const linksFiltered = useMemo(() => {
    const list = (data?.links ?? []).slice();

    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((l) => ((l.name || "") + " " + (l.label || "")).toLowerCase().includes(q))
      : list;

    filtered.sort((a, b) => {
      if (sort === "tests_desc") return (b.testsTaken || 0) - (a.testsTaken || 0);
      if (sort === "created_desc") return (b.createdAt || "").localeCompare(a.createdAt || "");
      const an = (a.name || a.label || "").toLowerCase();
      const bn = (b.name || b.label || "").toLowerCase();
      return an.localeCompare(bn);
    });

    return filtered;
  }, [data, query, sort]);

  const nonZeroCount = useMemo(() => linksFiltered.filter((l) => (l.testsTaken || 0) > 0).length, [linksFiltered]);
  const zeroCount = useMemo(() => linksFiltered.filter((l) => (l.testsTaken || 0) === 0).length, [linksFiltered]);

  const fullAnalyticsHref = useMemo(() => {
    if (!selectedToken) return null;
    const q = new URLSearchParams();
    if (selectedTestId) q.set("testId", selectedTestId);
    if (appliedFromIso) q.set("from", appliedFromIso);
    if (appliedToIso) q.set("to", appliedToIso);
    const qs = q.toString();
    return `/portal/${org}/dashboard/beta/link/${selectedToken}${qs ? `?${qs}` : ""}`;
  }, [selectedToken, org, selectedTestId, appliedFromIso, appliedToIso]);

  const FiltersRow = (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div className="min-w-[260px]">
        <label className="block text-[11px] uppercase tracking-widest text-white/55 mb-2">Test</label>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="h-11 w-full rounded-xl bg-white/8 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">All tests</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {testsLoading ? <div className="mt-2 text-xs text-white/45">Loading tests…</div> : null}
        {testsErr ? <div className="mt-2 text-xs text-red-300">Tests error: {testsErr}</div> : null}
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-white/55 mb-2">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-11 rounded-xl bg-white/8 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-white/55 mb-2">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-11 rounded-xl bg-white/8 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20"
        />
      </div>

      <button
        onClick={loadMain}
        className="h-11 rounded-xl bg-white text-black px-5 text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition"
      >
        Apply
      </button>
    </div>
  );

  return (
    <div className="min-h-screen p-6 space-y-6 text-white">
      {/* Premium header */}
      <GradientCard className="overflow-hidden">
        <div className="px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">Beta</div>
                <div className="h-[1px] w-10 bg-white/10" />
                <div className="text-[11px] text-white/45">Analytics Console</div>
              </div>

              <div className="mt-2">
                <div className="text-3xl font-semibold tracking-tight">Dashboard v2</div>
                <div className="mt-1 text-sm text-white/60">
                  Drill-down link analytics that feels like a product — not a spreadsheet.
                </div>
              </div>

              {debug ? (
                <div className="mt-3 text-xs text-white/40 font-mono">
                  org={org}
                  {data?.filters?.orgId ? ` · orgId=${data.filters.orgId}` : ""}
                  {selectedTestId ? ` · testId=${selectedTestId}` : ""}
                </div>
              ) : null}
            </div>

            {FiltersRow}
          </div>
        </div>
      </GradientCard>

      {loading && <div className="text-white/70">Loading…</div>}
      {err && (
        <GradientCard glow={false}>
          <div className="p-5 text-red-200">Error: {err}</div>
        </GradientCard>
      )}

      {!loading && !err && data?.ok && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Submissions" value={fmtNum(data.kpis.submissions)} accent="cyan" />
            <StatCard
              label="Unique takers"
              value={fmtNum(data.kpis.uniqueTakers)}
              sub={
                data.kpis.uniqueTakers != null && data.kpis.submissions
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.submissions)} unique`
                  : undefined
              }
              accent="blue"
            />
            <StatCard label="Active links" value={fmtNum(data.kpis.activeLinks)} accent="emerald" />
          </div>

          {/* Timeline + insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GradientCard className="lg:col-span-2">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Submissions over time</div>
                    <div className="mt-1 text-xs text-white/55">
                      {data.filters.from ? isoToDateInput(data.filters.from) : ""} →{" "}
                      {data.filters.to ? isoToDateInput(data.filters.to) : ""}
                    </div>
                  </div>
                  <Pill>Daily</Pill>
                </div>

                <div className="mt-4">
                  {sortedTimeline.length ? (
                    <MiniBars data={sortedTimeline} />
                  ) : (
                    <div className="text-sm text-white/60">No activity in this range.</div>
                  )}
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Insights</div>
                  {insightsLoading ? <span className="text-xs text-white/50">Generating…</span> : null}
                </div>

                {!insights && !insightsLoading ? (
                  <div className="mt-3 text-sm text-white/60">
                    Insights unavailable (non-blocking). Dashboard data is still valid.
                  </div>
                ) : null}

                {insights ? (
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="text-xs text-white/55">
                      Confidence: <span className="font-semibold text-white/80">{insights.confidence.level}</span> · n=
                      {fmtNum(insights.confidence.sampleSize)}
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-white/55 mb-2">What you’re seeing</div>
                      <ul className="list-disc pl-5 space-y-1 text-white/85">
                        {insights.whatYoureSeeing.slice(0, 4).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-white/55 mb-2">
                        Recommended next steps
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-white/85">
                        {insights.recommendedNextSteps.slice(0, 3).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </GradientCard>
          </div>

          {/* Links console */}
          <GradientCard>
            <div className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Links</div>
                  <div className="text-sm text-white/60">Search, sort, drill down, export.</div>
                  <div className="mt-2 text-xs text-white/50">
                    Showing {linksFiltered.length} · {nonZeroCount} with usage · {zeroCount} with zero usage
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="min-w-[280px]">
                    <label className="block text-[11px] uppercase tracking-widest text-white/55 mb-2">Search</label>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search link name or label…"
                      className="h-11 w-full rounded-xl bg-white/8 border border-white/10 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/20"
                    />
                  </div>

                  <div className="min-w-[210px]">
                    <label className="block text-[11px] uppercase tracking-widest text-white/55 mb-2">Sort</label>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as any)}
                      className="h-11 w-full rounded-xl bg-white/8 border border-white/10 px-3 text-sm text-white outline-none focus:border-white/20"
                    >
                      <option value="tests_desc">Most tests taken</option>
                      <option value="created_desc">Newest created</option>
                      <option value="name_asc">Name (A→Z)</option>
                    </select>
                  </div>

                  <button
                    onClick={downloadMainCsv}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold hover:bg-white/10 active:scale-[0.99] transition"
                    title="Download links as CSV"
                  >
                    Download CSV
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {linksFiltered.length === 0 ? (
                  <div className="text-sm text-white/60">No links match your search.</div>
                ) : (
                  linksFiltered.map((l) => {
                    const title = l.name || l.label || "Untitled link";
                    const subtitle = l.label && l.name ? l.label : null;
                    const topP = l.topProfilesByCount?.slice(0, 2) || [];
                    const topF = l.topFrequencyByCount;

                    const accent =
                      l.isActive === false
                        ? "from-red-400/35"
                        : (l.testsTaken || 0) > 0
                        ? "from-cyan-400/35"
                        : "from-white/15";

                    return (
                      <button
                        key={l.linkId}
                        onClick={() => openLink(l.token)}
                        className={[
                          "w-full text-left group rounded-2xl p-[1px]",
                          "bg-gradient-to-r",
                          accent,
                          "to-transparent",
                          "hover:to-white/5 transition",
                        ].join(" ")}
                        type="button"
                      >
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-5 py-4 hover:bg-white/[0.05] transition">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-base font-semibold truncate">{title}</div>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] ${badgeClass(
                                    l.isActive
                                  )}`}
                                >
                                  {l.isActive === false ? "Inactive" : "Active"}
                                </span>
                                {debug ? <span className="text-[11px] text-white/35 font-mono">{l.token}</span> : null}
                              </div>

                              {subtitle ? <div className="text-xs text-white/50 truncate mt-1">{subtitle}</div> : null}

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Pill title="Tests taken">
                                  <span className="text-white/60 mr-1">Tests</span>
                                  <span className="font-semibold text-white/90">{fmtNum(l.testsTaken)}</span>
                                </Pill>

                                {topF ? (
                                  <Pill title={`${fmtNum(topF.count)} · ${fmtPct(topF.pct)}`}>
                                    <span className="text-white/60 mr-1">Top freq</span>
                                    <span className="text-white/90">{topF.name}</span>
                                    <span className="ml-2 text-white/50">{fmtPct(topF.pct)}</span>
                                  </Pill>
                                ) : null}

                                {topP.map((p) => (
                                  <Pill key={p.code} title={`${fmtNum(p.count)} · ${fmtPct(p.pct)}`}>
                                    <span className="text-white/60 mr-1">Top</span>
                                    <span className="text-white/90">{p.name}</span>
                                    <span className="ml-2 text-white/50">{fmtPct(p.pct)}</span>
                                  </Pill>
                                ))}
                              </div>

                              <div className="mt-3 text-xs text-white/45">
                                Created: <span className="text-white/60">{fmtDateTime(l.createdAt)}</span>
                                {l.expiresAt ? (
                                  <>
                                    {" "}
                                    · Expires: <span className="text-white/60">{fmtDateTime(l.expiresAt)}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <div className="shrink-0 text-sm text-white/65 group-hover:text-white transition">
                              View →
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </GradientCard>

          {/* Drawer */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/65"
                onClick={() => {
                  setDrawerOpen(false);
                  setSelectedToken(null);
                  setDrawerData(null);
                }}
              />
              <div className="absolute right-0 top-0 h-full w-full max-w-[600px] p-[1px] bg-gradient-to-b from-white/12 via-white/6 to-white/10">
                <div className="h-full bg-[#050914] border-l border-white/10 backdrop-blur-xl overflow-y-auto">
                  <div className="p-5 border-b border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-widest text-white/55">Link analytics</div>
                        <div className="mt-1 text-xl font-semibold truncate">
                          {drawerData?.link?.name || drawerData?.link?.label || "Untitled link"}
                        </div>
                        {debug && selectedToken ? (
                          <div className="mt-2 text-xs text-white/35 font-mono break-all">{selectedToken}</div>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        {fullAnalyticsHref ? (
                          <Link
                            href={fullAnalyticsHref}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
                            title="Open full analytics page"
                          >
                            Open full analytics
                          </Link>
                        ) : null}

                        <button
                          onClick={downloadDrawerCsv}
                          disabled={!drawerData?.ok}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50 transition"
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
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {drawerLoading && <div className="text-white/70">Loading link analytics…</div>}
                    {drawerErr && <div className="text-red-300">Error: {drawerErr}</div>}

                    {!drawerLoading && !drawerErr && drawerData?.ok && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <StatCard label="Tests" value={fmtNum(drawerData?.kpis?.testsTaken)} accent="cyan" />
                          <StatCard label="Unique" value={fmtNum(drawerData?.kpis?.uniqueTakers)} accent="blue" />
                          <GradientCard glow={false}>
                            <div className="p-5">
                              <div className="text-xs uppercase tracking-wide text-white/55">Last used</div>
                              <div className="mt-3 text-sm text-white/85">{fmtDateTime(drawerData?.kpis?.lastUsedAt)}</div>
                            </div>
                          </GradientCard>
                        </div>

                        <GradientCard>
                          <div className="p-5">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">Insights</div>
                              {drawerData?._insights?.confidence ? (
                                <div className="text-xs text-white/55">
                                  {drawerData._insights.confidence.level} · n={fmtNum(drawerData._insights.confidence.sampleSize)}
                                </div>
                              ) : (
                                <div className="text-xs text-white/55">Generating…</div>
                              )}
                            </div>

                            {drawerData?._insights ? (
                              <div className="mt-4 text-sm">
                                <ul className="list-disc pl-5 space-y-1 text-white/85">
                                  {(drawerData._insights.whatYoureSeeing || []).slice(0, 4).map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </GradientCard>

                        <GradientCard>
                          <div className="p-5">
                            <div className="text-sm font-semibold">Top profiles</div>
                            <div className="mt-4 space-y-2">
                              {(drawerData?.distributions?.profiles || []).slice(0, 10).map((p: any) => (
                                <div key={p.code} className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{p.name}</div>
                                    <div className="text-xs text-white/50">
                                      {fmtNum(p.count)} · {fmtPct(p.pct)}
                                    </div>
                                  </div>
                                  <Pill>avg {fmtNum(p.avgPoints || 0)}</Pill>
                                </div>
                              ))}
                            </div>
                          </div>
                        </GradientCard>

                        <GradientCard>
                          <div className="p-5">
                            <div className="text-sm font-semibold">Top frequencies</div>
                            <div className="mt-4 space-y-2">
                              {(drawerData?.distributions?.frequencies || []).slice(0, 8).map((f: any) => (
                                <div key={f.code} className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{f.name}</div>
                                    <div className="text-xs text-white/50">
                                      {fmtNum(f.count)} · {fmtPct(f.pct)}
                                    </div>
                                  </div>
                                  <Pill>avg {fmtNum(f.avgPoints || 0)}</Pill>
                                </div>
                              ))}
                            </div>
                          </div>
                        </GradientCard>

                        <GradientCard>
                          <div className="p-5">
                            <div className="text-sm font-semibold">Company segmentation</div>
                            <div className="mt-4 space-y-2">
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
                        </GradientCard>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

