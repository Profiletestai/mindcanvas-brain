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

// Always round percentages to whole numbers (e.g. 23%)
function fmtPct(p: number) {
  return `${Math.round(clampPct(p) * 100)}%`;
}

// Always round numbers to whole numbers (counts/averages)
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

function SimpleBars({ data }: { data: TimelinePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.submissions || 0));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-24">
        {data.map((p) => {
          const h = Math.round((p.submissions / max) * 96);
          return (
            <div key={p.date} className="flex-1 min-w-[6px]">
              <div
                className="w-full rounded-sm bg-white/70"
                style={{ height: `${h}px` }}
                title={`${p.date}: ${Math.round(p.submissions)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/60">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[data.length - 1]?.date ?? ""}</span>
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
      if (appliedFromIso) q.set("from", appliedFromIso);
      if (appliedToIso) q.set("to", appliedToIso);

      // API is token-only (org/testId not needed here)
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

  // ✅ Correct FULL analytics route (existing beta link page)
  const fullAnalyticsHref = useMemo(() => {
    if (!selectedToken) return null;

    const q = new URLSearchParams();
    if (appliedFromIso) q.set("from", appliedFromIso);
    if (appliedToIso) q.set("to", appliedToIso);
    if (selectedTestId) q.set("testId", selectedTestId);

    const qs = q.toString();
    return `/portal/${org}/dashboard/beta/link/${selectedToken}${qs ? `?${qs}` : ""}`;
  }, [selectedToken, org, appliedFromIso, appliedToIso, selectedTestId]);

  const FiltersRow = (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div className="min-w-[240px]">
        <label className="block text-xs text-white/60 mb-1">Test</label>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="h-10 w-full rounded-lg bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
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
          className="h-10 rounded-lg bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-10 rounded-lg bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
        />
      </div>

      <button
        onClick={loadMain}
        className="h-10 rounded-lg bg-white text-black px-4 text-sm font-medium hover:bg-white/90"
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
              <p className="text-sm text-white/70">Drill-down analytics for links, profiles, and frequencies.</p>
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Submissions</div>
              <div className="text-3xl font-semibold">{fmtNum(data.kpis.submissions)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="text-3xl font-semibold">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-1">
                {data.kpis.uniqueTakers != null && data.kpis.submissions
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.submissions)} unique`
                  : ""}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Active links</div>
              <div className="text-3xl font-semibold">{fmtNum(data.kpis.activeLinks)}</div>
            </div>
          </div>

          {/* Timeline + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Submissions over time</h2>
                <div className="text-xs text-white/50">
                  {data.filters.from ? isoToDateInput(data.filters.from) : ""} →{" "}
                  {data.filters.to ? isoToDateInput(data.filters.to) : ""}
                </div>
              </div>
              <div className="mt-3">
                {sortedTimeline.length ? <SimpleBars data={sortedTimeline} /> : <div className="text-sm text-white/60">No activity in this range.</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Insights (Beta)</h2>
                {insightsLoading ? <span className="text-xs text-white/50">Generating…</span> : null}
              </div>

              {!insights && !insightsLoading ? (
                <div className="mt-3 text-sm text-white/60">Insights unavailable (non-blocking).</div>
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

          {/* Links table */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Link performance</h2>
                <p className="text-sm text-white/60">Click a link to drill down into link-level insights.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-white/50">
                  {nonZeroLinks.length} links with usage · {zeroLinks.length} with zero usage
                </div>
                <button
                  onClick={downloadMainCsv}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
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
                          <button className="text-left hover:underline" onClick={() => openLink(l.token)}>
                            <div className="font-medium">{l.name || l.label || "Untitled link"}</div>
                            {l.label && l.name ? <div className="text-xs text-white/50">Label: {l.label}</div> : null}
                          </button>
                        </td>

                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeClass(l.isActive)}`}>
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
                        title="Open full analytics page"
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
                      Download CSV
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
