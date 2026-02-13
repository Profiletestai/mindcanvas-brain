// apps/web/app/portal/[slug]/dashboard/link/[token]/LinkAnalyticsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type TimelinePoint = { date: string; submissions: number };

type DistItem = {
  code: string;
  name: string;
  count: number;
  pct: number;
  avgPoints: number;
};

type CompanyItem = {
  company: string;
  testsTaken: number;
  pct: number;
};

type LinkApiPayload = {
  ok: true;
  filters: { token: string; from: string; to: string };
  link: {
    linkId: string;
    orgId: string;
    testId: string;
    token: string;
    name: string | null;
    label: string | null;
    isActive: boolean | null;
    createdAt: string;
    expiresAt: string | null;
    redirectUrl: string | null;
    nextStepsUrl: string | null;
    showResults: boolean | null;
    meta: any;
  };
  kpis: { testsTaken: number; uniqueTakers: number | null; lastUsedAt: string | null };
  timeline: TimelinePoint[];
  distributions: { profiles: DistItem[]; frequencies: DistItem[] };
  segments: { companies: CompanyItem[] };
};

type CompanySubmissionsPayload = {
  ok: true;
  token: string;
  company: string;
  from: string;
  to: string;
  total: number;
  submissions: Array<{
    submissionId: string;
    createdAt: string | null;
    takerId: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    meta: any | null;
  }>;
};

type AllSubmissionsPayload = {
  ok: true;
  token: string;
  from: string;
  to: string;
  total: number;
  submissions: Array<{
    submissionId: string;
    createdAt: string | null;
    takerId: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    meta: any | null;
  }>;
};

function clampPct(p: number) {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

function fmtPct(p: number) {
  return `${Math.round(clampPct(p) * 100)}%`;
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

function ymd(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** CSV helpers */
function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsvLines(filename: string, lines: string[]) {
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

/** MindCanvas grid overlay (self contained) */
function MindCanvasGrid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,#113149_0%,#08121b_55%,#060e16_100%)]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute inset-0 bg-[#050914]/55" />
    </div>
  );
}

/** Neon sparkline curve + glow */
function SparklineNeon({
  data,
  height = 140,
  compact = false,
}: {
  data: TimelinePoint[];
  height?: number;
  compact?: boolean;
}) {
  const width = compact ? 220 : 900;
  const padX = compact ? 10 : 14;
  const padY = compact ? 10 : 14;

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
  }, [data, height, width, padX, padY]);

  const path = useMemo(() => {
    const p = pts.points;
    if (!p.length) return "";
    if (p.length === 1) return `M ${p[0].x} ${p[0].y}`;
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      const prev = p[i - 1];
      const cur = p[i];
      const midX = (prev.x + cur.x) / 2;
      const midY = (prev.y + cur.y) / 2;
      d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    const last = p[p.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  }, [pts.points]);

  const area = useMemo(() => {
    const p = pts.points;
    if (!p.length) return "";
    const baseline = height - (compact ? 8 : 10);
    return `${path} L ${p[p.length - 1].x} ${baseline} L ${p[0].x} ${baseline} Z`;
  }, [path, pts.points, height, compact]);

  const leftLabel = pts.items[0]?.date ?? "";
  const rightLabel = pts.items[pts.items.length - 1]?.date ?? "";

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={[
          "w-full rounded-2xl border border-white/10 bg-white/5 overflow-hidden",
          compact ? "h-[54px]" : "h-[170px]",
        ].join(" ")}
        role="img"
        aria-label="Activity sparkline"
      >
        <defs>
          <linearGradient id={compact ? "mcLineMini" : "mcLine"} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#64bae2" />
            <stop offset="45%" stopColor="#2d8fc4" />
            <stop offset="100%" stopColor="#7c5cff" />
          </linearGradient>

          <linearGradient id={compact ? "mcAreaMini" : "mcArea"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64bae2" stopOpacity={compact ? 0.22 : 0.28} />
            <stop offset="60%" stopColor="#2d8fc4" stopOpacity={compact ? 0.07 : 0.1} />
            <stop offset="100%" stopColor="#050914" stopOpacity={0} />
          </linearGradient>

          <filter id={compact ? "glowMini" : "glow"} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={compact ? 3 : 4} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {area ? <path d={area} fill={`url(#${compact ? "mcAreaMini" : "mcArea"})`} /> : null}

        {path ? (
          <>
            <path
              d={path}
              stroke={`url(#${compact ? "mcLineMini" : "mcLine"})`}
              strokeWidth={compact ? 2.6 : 3.2}
              fill="none"
              filter={`url(#${compact ? "glowMini" : "glow"})`}
            />
            <path d={path} stroke="rgba(255,255,255,0.30)" strokeWidth={1} fill="none" />
          </>
        ) : null}
      </svg>

      {!compact ? (
        <div className="mt-2 flex justify-between text-[11px] text-white/60">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs border transition",
        active ? "bg-white text-black border-white" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

/** Build daily timeline from raw submissions */
function buildTimelineFromSubmissions(subs: Array<{ createdAt: string | null }>, maxDays = 14): TimelinePoint[] {
  const map = new Map<string, number>();
  for (const s of subs || []) {
    if (!s.createdAt) continue;
    const key = ymd(s.createdAt);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const items = Array.from(map.entries())
    .map(([date, submissions]) => ({ date, submissions }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (items.length > maxDays) return items.slice(items.length - maxDays);
  return items;
}

export default function LinkAnalyticsClient({
  orgSlug,
  token,
  from,
  to,
  testId,
}: {
  orgSlug: string;
  token: string;
  from?: string;
  to?: string;
  testId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<LinkApiPayload | null>(null);

  const [tab, setTab] = useState<"companies" | "profiles" | "frequencies">("companies");

  // Company list UX
  const [companyQuery, setCompanyQuery] = useState("");
  const [companySort, setCompanySort] = useState<"most" | "az">("most");

  // Company micro-sparkline cache (real data)
  const companySparkCache = useRef<Map<string, TimelinePoint[]>>(new Map());
  const [sparkVersion, setSparkVersion] = useState(0);

  // Company drilldown drawer
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [companyDrawerCompany, setCompanyDrawerCompany] = useState<string>("");
  const [companyDrawerLoading, setCompanyDrawerLoading] = useState(false);
  const [companyDrawerErr, setCompanyDrawerErr] = useState<string>("");
  const [companyDrawerData, setCompanyDrawerData] = useState<CompanySubmissionsPayload | null>(null);

  // Drawer filters
  const [takerQuery, setTakerQuery] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);

  // Export ALL takers loading state
  const [exportAllLoading, setExportAllLoading] = useState(false);

  // force rerender when sparklines warm
  const _sparkTick = sparkVersion;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const q = new URLSearchParams();
        q.set("token", token);
        if (from) q.set("from", from);
        if (to) q.set("to", to);

        const res = await fetch(`/api/portal-dashboard-v2/link?${q.toString()}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);

        if (alive) setData(j as LinkApiPayload);
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, from, to]);

  const title = useMemo(() => {
    const l = data?.link;
    if (!l) return "Link analytics";
    return l.name || l.label || "Link analytics";
  }, [data]);

  const safeName = useMemo(() => {
    const base = title || "link";
    return String(base).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
  }, [title]);

  const backHref = useMemo(() => {
    const q = new URLSearchParams();
    if (testId) q.set("testId", testId);
    const qs = q.toString();
    return `/portal/${orgSlug}/dashboard${qs ? `?${qs}` : ""}`;
  }, [orgSlug, testId]);

  const timelineSorted = useMemo(() => {
    const t = (data?.timeline || []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  const companiesFilteredSorted = useMemo(() => {
    const list = (data?.segments?.companies || []).slice();
    const q = companyQuery.trim().toLowerCase();
    const filtered = q ? list.filter((c) => String(c.company || "Unknown").toLowerCase().includes(q)) : list;

    if (companySort === "az") {
      filtered.sort((a, b) => String(a.company || "Unknown").localeCompare(String(b.company || "Unknown")));
    } else {
      filtered.sort((a, b) => (b.testsTaken || 0) - (a.testsTaken || 0));
    }
    return filtered;
  }, [data, companyQuery, companySort]);

  async function fetchCompanySubmissions(company: string) {
    const c = (company || "").trim() || "Unknown";
    const q = new URLSearchParams();
    q.set("token", token);
    q.set("company", c);
    if (from) q.set("from", from);
    if (to) q.set("to", to);

    const res = await fetch(`/api/portal-dashboard-v2/link/company-submissions?${q.toString()}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j as CompanySubmissionsPayload;
  }

  async function fetchAllSubmissions() {
    const q = new URLSearchParams();
    q.set("token", token);
    if (from) q.set("from", from);
    if (to) q.set("to", to);

    const res = await fetch(`/api/portal-dashboard-v2/link/all-submissions?${q.toString()}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j as AllSubmissionsPayload;
  }

  async function warmCompanySpark(company: string) {
    const key = (company || "").trim() || "Unknown";
    if (companySparkCache.current.has(key)) return;

    try {
      const payload = await fetchCompanySubmissions(key);
      const tl = buildTimelineFromSubmissions(payload.submissions || [], 14);
      companySparkCache.current.set(key, tl);
      setSparkVersion((v) => v + 1);
    } catch {
      // non-blocking
    }
  }

  async function openCompany(company: string) {
    const c = (company || "").trim() || "Unknown";
    setCompanyDrawerCompany(c);
    setCompanyDrawerOpen(true);
    setCompanyDrawerLoading(true);
    setCompanyDrawerErr("");
    setCompanyDrawerData(null);

    setTakerQuery("");
    setFilterHasEmail(false);
    setFilterHasPhone(false);

    try {
      const payload = await fetchCompanySubmissions(c);
      setCompanyDrawerData(payload);

      const tl = buildTimelineFromSubmissions(payload.submissions || [], 14);
      companySparkCache.current.set(c, tl);
      setSparkVersion((v) => v + 1);
    } catch (e: any) {
      setCompanyDrawerErr(String(e?.message || e));
    } finally {
      setCompanyDrawerLoading(false);
    }
  }

  const drawerFilteredSubmissions = useMemo(() => {
    const subs = (companyDrawerData?.submissions || []).slice();
    const q = takerQuery.trim().toLowerCase();

    const filtered = subs.filter((r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(" ").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const phone = (r.phone || "").toLowerCase();

      if (filterHasEmail && !r.email) return false;
      if (filterHasPhone && !r.phone) return false;

      if (!q) return true;
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });

    filtered.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return filtered;
  }, [companyDrawerData, takerQuery, filterHasEmail, filterHasPhone]);

  function downloadCompanyCsvFiltered() {
    if (!companyDrawerData?.ok) return;

    const rows = drawerFilteredSubmissions.map((r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
      return [
        companyDrawerData.company || "",
        r.createdAt || "",
        name || "",
        r.email || "",
        r.phone || "",
        r.submissionId || "",
        r.takerId || "",
      ];
    });

    const lines: string[] = [];
    lines.push(csvEscape("Company submissions (filtered)"));
    lines.push(["company", "created_at", "name", "email", "phone", "submission_id", "taker_id"].map(csvEscape).join(","));
    for (const r of rows) lines.push(r.map(csvEscape).join(","));

    const fileSafeCompany = String(companyDrawerData.company || "company").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
    downloadCsvLines(`company_submissions_${orgSlug}_${fileSafeCompany}_filtered.csv`, lines);
  }

  async function exportAllTakersCsv() {
    try {
      setExportAllLoading(true);
      const payload = await fetchAllSubmissions();

      const lines: string[] = [];
      lines.push(csvEscape("All link submissions"));
      lines.push(["company", "created_at", "name", "email", "phone", "submission_id", "taker_id"].map(csvEscape).join(","));

      for (const r of payload.submissions || []) {
        const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
        lines.push(
          [
            r.company || "",
            r.createdAt || "",
            name || "",
            r.email || "",
            r.phone || "",
            r.submissionId || "",
            r.takerId || "",
          ].map(csvEscape).join(",")
        );
      }

      downloadCsvLines(`all_takers_${orgSlug}_${safeName}.csv`, lines);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setExportAllLoading(false);
    }
  }

  const wowCard =
    "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";

  return (
    <div className="relative min-h-screen p-6 text-white space-y-6">
      <MindCanvasGrid />

      <div className={`${wowCard} p-6`}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(900px_260px_at_20%_0%,rgba(100,186,226,0.35),transparent_65%)]" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(700px_220px_at_90%_30%,rgba(124,92,255,0.30),transparent_60%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-white/60">MindCanvas · Analytics</div>
            <h1 className="text-3xl font-semibold truncate mt-1">{title}</h1>
            <div className="text-sm text-white/60 mt-2">
              {data?.filters?.from && data?.filters?.to ? (
                <>
                  Date range: <span className="text-white/80">{fmtDateTime(data.filters.from)}</span> →{" "}
                  <span className="text-white/80">{fmtDateTime(data.filters.to)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <Link href={backHref} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>

      {loading && (
        <div className={`${wowCard} p-6`}>
          <div className="animate-pulse text-white/60">Loading analytics…</div>
        </div>
      )}
      {err && (
        <div className={`${wowCard} p-6`}>
          <div className="text-red-300">Error: {err}</div>
        </div>
      )}

      {!loading && !err && data?.ok && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${wowCard} p-5`}>
              <div className="text-xs text-white/60">Tests taken</div>
              <div className="text-5xl font-semibold mt-2">{fmtNum(data.kpis.testsTaken)}</div>
              <div className="text-xs text-white/50 mt-2">Across this link in the selected range</div>
            </div>
            <div className={`${wowCard} p-5`}>
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="text-5xl font-semibold mt-2">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-2">
                {data.kpis.uniqueTakers != null && data.kpis.testsTaken
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.testsTaken)} unique`
                  : ""}
              </div>
            </div>
            <div className={`${wowCard} p-5`}>
              <div className="text-xs text-white/60">Last used</div>
              <div className="text-sm text-white/85 mt-3">{fmtDateTime(data.kpis.lastUsedAt)}</div>
              <div className="text-xs text-white/50 mt-2">Most recent submission timestamp</div>
            </div>
          </div>

          <div className={`${wowCard} p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Activity over time</h2>
                <div className="text-xs text-white/50 mt-1">Neon sparkline · daily submissions</div>
              </div>
            </div>
            <div className="mt-4">
              {timelineSorted.length ? <SparklineNeon data={timelineSorted} /> : <div className="text-sm text-white/60">No activity in this range.</div>}
            </div>
          </div>

          <div className={`${wowCard} p-5`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Segmentation</h2>
                <p className="text-sm text-white/60">
                  Companies show real micro-sparklines based on submission timestamps. Click to drill down + export.
                </p>
              </div>

              <div className="flex gap-2">
                <TabButton active={tab === "companies"} onClick={() => setTab("companies")}>
                  Companies
                </TabButton>
                <TabButton active={tab === "profiles"} onClick={() => setTab("profiles")}>
                  Profiles
                </TabButton>
                <TabButton active={tab === "frequencies"} onClick={() => setTab("frequencies")}>
                  Frequencies
                </TabButton>
              </div>
            </div>

            {tab === "companies" ? (
              <>
                <div className="mt-5 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1">
                    <input
                      value={companyQuery}
                      onChange={(e) => setCompanyQuery(e.target.value)}
                      placeholder="Search company…"
                      className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40"
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setCompanySort("most")}
                      className={[
                        "h-11 rounded-xl px-4 text-sm border transition",
                        companySort === "most"
                          ? "bg-white text-black border-white"
                          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10",
                      ].join(" ")}
                      type="button"
                    >
                      Sort: Most
                    </button>
                    <button
                      onClick={() => setCompanySort("az")}
                      className={[
                        "h-11 rounded-xl px-4 text-sm border transition",
                        companySort === "az"
                          ? "bg-white text-black border-white"
                          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10",
                      ].join(" ")}
                      type="button"
                    >
                      Sort: A–Z
                    </button>

                    {/* ✅ Export ALL takers across the whole link */}
                    <button
                      onClick={exportAllTakersCsv}
                      disabled={exportAllLoading}
                      className="h-11 rounded-xl px-4 text-sm border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                      type="button"
                      title="Export all takers across all companies for this link"
                    >
                      {exportAllLoading ? "Exporting…" : "Export ALL takers"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {companiesFilteredSorted.length ? (
                    companiesFilteredSorted.slice(0, 40).map((c) => {
                      const name = (c.company || "Unknown").trim() || "Unknown";
                      const mini = companySparkCache.current.get(name);

                      return (
                        <button
                          key={name}
                          onClick={() => openCompany(name)}
                          onMouseEnter={() => warmCompanySpark(name)}
                          className="group relative w-full text-left rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition overflow-hidden"
                          type="button"
                          title="View takers + export"
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition opacity-20 bg-[radial-gradient(420px_160px_at_20%_0%,rgba(100,186,226,0.40),transparent_65%)]" />
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition opacity-15 bg-[radial-gradient(360px_160px_at_90%_70%,rgba(124,92,255,0.35),transparent_65%)]" />

                          <div className="relative flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate text-white/95">{name}</div>
                              <div className="text-xs text-white/55 mt-1">
                                {fmtNum(c.testsTaken)} submissions · {fmtPct(c.pct)}
                              </div>
                            </div>

                            <div className="w-[240px] max-w-[45%]">
                              {mini && mini.length ? (
                                <SparklineNeon data={mini} compact />
                              ) : (
                                <div className="h-[54px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/40">
                                  hover to preview
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="relative mt-3 flex items-center justify-between text-xs text-white/50">
                            <span>Targeted taker list</span>
                            <span className="text-white/70">Open →</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-white/60">No companies match your search.</div>
                  )}
                </div>

                {/* keep _sparkTick referenced so sparklines refresh */}
                <span className="hidden">{_sparkTick}</span>
              </>
            ) : null}

            {tab === "profiles" ? (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(data.distributions?.profiles || []).length ? (
                  (data.distributions.profiles || []).slice(0, 50).map((p) => (
                    <div key={p.code} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.name}</div>
                          <div className="text-xs text-white/50 mt-1">
                            {fmtNum(p.count)} · {fmtPct(p.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">avg {fmtNum(p.avgPoints)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60">No profile data.</div>
                )}
              </div>
            ) : null}

            {tab === "frequencies" ? (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(data.distributions?.frequencies || []).length ? (
                  (data.distributions.frequencies || []).slice(0, 30).map((f) => (
                    <div key={f.code} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{f.name}</div>
                          <div className="text-xs text-white/50 mt-1">
                            {fmtNum(f.count)} · {fmtPct(f.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">avg {fmtNum(f.avgPoints)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60">No frequency data.</div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Company submissions drawer */}
      {companyDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setCompanyDrawerOpen(false);
              setCompanyDrawerCompany("");
              setCompanyDrawerData(null);
              setCompanyDrawerErr("");
            }}
          />

          <div className="absolute right-0 top-0 h-full w-full max-w-[820px] bg-[#050914] border-l border-white/10 overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#050914]/90 backdrop-blur p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-white/50">Company submissions</div>
                  <div className="text-2xl font-semibold truncate">{companyDrawerCompany || "Unknown"}</div>
                  <div className="text-xs text-white/50 mt-1">
                    {companyDrawerData?.ok
                      ? `${fmtNum(drawerFilteredSubmissions.length)} shown · ${fmtNum(companyDrawerData.total)} total`
                      : "Targeted export list for coaching & CRM sync"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={downloadCompanyCsvFiltered}
                    disabled={!companyDrawerData?.ok}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      setCompanyDrawerOpen(false);
                      setCompanyDrawerCompany("");
                      setCompanyDrawerData(null);
                      setCompanyDrawerErr("");
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1">
                  <input
                    value={takerQuery}
                    onChange={(e) => setTakerQuery(e.target.value)}
                    placeholder="Search name / email / phone…"
                    className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={filterHasEmail}
                    onChange={(e) => setFilterHasEmail(e.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                  Has email
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={filterHasPhone}
                    onChange={(e) => setFilterHasPhone(e.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                  Has phone
                </label>
              </div>
            </div>

            <div className="p-5">
              {companyDrawerLoading ? <div className="text-white/70">Loading submissions…</div> : null}
              {companyDrawerErr ? <div className="text-red-300">Error: {companyDrawerErr}</div> : null}

              {!companyDrawerLoading && !companyDrawerErr && companyDrawerData?.ok ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-[980px] w-full text-sm">
                        <thead className="text-white/70">
                          <tr className="border-b border-white/10">
                            <th className="py-3 px-4 text-left font-medium">Name</th>
                            <th className="py-3 px-4 text-left font-medium">Email</th>
                            <th className="py-3 px-4 text-left font-medium">Phone</th>
                            <th className="py-3 px-4 text-left font-medium">Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drawerFilteredSubmissions.map((r) => {
                            const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || "—";
                            return (
                              <tr key={r.submissionId} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-4">
                                  <div className="font-medium">{name}</div>
                                  <div className="text-xs text-white/40">ID: {String(r.submissionId).slice(0, 8)}…</div>
                                </td>
                                <td className="py-3 px-4 text-white/85">{r.email || "—"}</td>
                                <td className="py-3 px-4 text-white/85">{r.phone || "—"}</td>
                                <td className="py-3 px-4 text-white/70">{fmtDateTime(r.createdAt)}</td>
                              </tr>
                            );
                          })}

                          {!drawerFilteredSubmissions.length ? (
                            <tr>
                              <td colSpan={4} className="py-8 px-4 text-white/60">
                                No submissions match your filters.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="text-xs text-white/50">
                    Export will include <span className="text-white/80">only the filtered rows</span>.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

