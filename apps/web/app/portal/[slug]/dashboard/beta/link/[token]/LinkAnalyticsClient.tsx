// apps/web/app/portal/[slug]/dashboard/beta/link/[token]/LinkAnalyticsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

/** MindCanvas grid overlay (self contained for wow-factor consistency) */
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

/** Neon sparkline (curve + area glow) */
function SparklineNeon({
  data,
  height = 140,
}: {
  data: TimelinePoint[];
  height?: number;
}) {
  const width = 900;
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
    const baseline = height - 10;
    return `${path} L ${p[p.length - 1].x} ${baseline} L ${p[0].x} ${baseline} Z`;
  }, [path, pts.points, height]);

  const leftLabel = pts.items[0]?.date ?? "";
  const rightLabel = pts.items[pts.items.length - 1]?.date ?? "";

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 900 ${height}`}
        className="w-full h-[170px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
        role="img"
        aria-label="Activity over time"
      >
        <defs>
          <linearGradient id="mcLine2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#64bae2" />
            <stop offset="45%" stopColor="#2d8fc4" />
            <stop offset="100%" stopColor="#7c5cff" />
          </linearGradient>

          <linearGradient id="mcArea2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64bae2" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#2d8fc4" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#050914" stopOpacity="0" />
          </linearGradient>

          <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <pattern id="mcGrid2" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>

          <radialGradient id="mcRad2" cx="30%" cy="10%" r="80%">
            <stop offset="0%" stopColor="rgba(100,186,226,0.20)" />
            <stop offset="40%" stopColor="rgba(45,143,196,0.10)" />
            <stop offset="100%" stopColor="rgba(5,9,20,0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="900" height={height} fill="url(#mcRad2)" />
        <rect x="0" y="0" width="900" height={height} fill="url(#mcGrid2)" opacity="0.55" />

        {area ? <path d={area} fill="url(#mcArea2)" /> : null}

        {path ? (
          <>
            <path d={path} stroke="url(#mcLine2)" strokeWidth="3.2" fill="none" filter="url(#glow2)" />
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

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs border transition",
        active
          ? "bg-white text-black border-white"
          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
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

  // Company drilldown drawer
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [companyDrawerCompany, setCompanyDrawerCompany] = useState<string>("");
  const [companyDrawerLoading, setCompanyDrawerLoading] = useState(false);
  const [companyDrawerErr, setCompanyDrawerErr] = useState<string>("");
  const [companyDrawerData, setCompanyDrawerData] = useState<CompanySubmissionsPayload | null>(null);

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
    return `/portal/${orgSlug}/dashboard/beta${qs ? `?${qs}` : ""}`;
  }, [orgSlug, testId]);

  const timelineSorted = useMemo(() => {
    const t = (data?.timeline || []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  function downloadAllCsv() {
    if (!data?.ok) return;

    const lines: string[] = [];

    const pushSection = (sectionTitle: string, header: string[], rows: any[][]) => {
      lines.push(csvEscape(sectionTitle));
      lines.push(header.map(csvEscape).join(","));
      for (const r of rows) lines.push(r.map(csvEscape).join(","));
      lines.push("");
    };

    const companies = (data.segments?.companies || []).map((c) => [
      c.company || "",
      fmtNum(c.testsTaken),
      Math.round(clampPct(c.pct) * 100),
    ]);

    const profiles = (data.distributions?.profiles || []).map((p) => [
      p.name || "",
      p.code || "",
      fmtNum(p.count),
      Math.round(clampPct(p.pct) * 100),
      fmtNum(p.avgPoints),
    ]);

    const freqs = (data.distributions?.frequencies || []).map((f) => [
      f.name || "",
      f.code || "",
      fmtNum(f.count),
      Math.round(clampPct(f.pct) * 100),
      fmtNum(f.avgPoints),
    ]);

    pushSection("Companies", ["company", "tests_taken", "pct"], companies);
    pushSection("Profiles", ["profile_name", "profile_code", "count", "pct", "avg_points"], profiles);
    pushSection("Frequencies", ["frequency_name", "frequency_code", "count", "pct", "avg_points"], freqs);

    const filename = `link_analytics_${orgSlug}_${safeName}.csv`;
    downloadCsvLines(filename, lines);
  }

  async function openCompany(company: string) {
    const c = (company || "").trim() || "Unknown";
    setCompanyDrawerCompany(c);
    setCompanyDrawerOpen(true);
    setCompanyDrawerLoading(true);
    setCompanyDrawerErr("");
    setCompanyDrawerData(null);

    try {
      const q = new URLSearchParams();
      q.set("token", token);
      q.set("company", c);
      if (from) q.set("from", from);
      if (to) q.set("to", to);

      const res = await fetch(`/api/portal-dashboard-v2/link/company-submissions?${q.toString()}`, {
        cache: "no-store",
      });

      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);

      setCompanyDrawerData(j as CompanySubmissionsPayload);
    } catch (e: any) {
      setCompanyDrawerErr(String(e?.message || e));
    } finally {
      setCompanyDrawerLoading(false);
    }
  }

  function downloadCompanyCsv() {
    if (!companyDrawerData?.ok) return;

    const rows = (companyDrawerData.submissions || []).map((r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
      return [
        companyDrawerData.company || "",
        r.createdAt || "",
        name,
        r.email || "",
        r.phone || "",
        r.submissionId || "",
        r.takerId || "",
      ];
    });

    const lines: string[] = [];
    lines.push(csvEscape("Company submissions"));
    lines.push(["company", "created_at", "name", "email", "phone", "submission_id", "taker_id"].map(csvEscape).join(","));
    for (const r of rows) lines.push(r.map(csvEscape).join(","));

    const fileSafeCompany = String(companyDrawerData.company || "company").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
    downloadCsvLines(`company_submissions_${orgSlug}_${fileSafeCompany}.csv`, lines);
  }

  return (
    <div className="relative min-h-screen p-6 text-white space-y-6">
      <MindCanvasGrid />

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-white/60">Beta</div>
            <h1 className="text-2xl font-semibold truncate">{title}</h1>
            <div className="text-sm text-white/60 mt-1">
              {data?.filters?.from && data?.filters?.to ? (
                <>
                  Date range: <span className="text-white/80">{fmtDateTime(data.filters.from)}</span> →{" "}
                  <span className="text-white/80">{fmtDateTime(data.filters.to)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadAllCsv}
              disabled={!data?.ok}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              title="Download as CSV"
              type="button"
            >
              Download CSV
            </button>
            <Link
              href={backHref}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>

      {loading && <div className="text-white/70">Loading…</div>}
      {err && <div className="text-red-300">Error: {err}</div>}

      {!loading && !err && data?.ok && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Tests taken</div>
              <div className="text-4xl font-semibold mt-1">{fmtNum(data.kpis.testsTaken)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="text-4xl font-semibold mt-1">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-1">
                {data.kpis.uniqueTakers != null && data.kpis.testsTaken
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.testsTaken)} unique`
                  : ""}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Last used</div>
              <div className="text-sm text-white/80 mt-2">{fmtDateTime(data.kpis.lastUsedAt)}</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Activity over time</h2>
              <div className="text-xs text-white/50">Sparkline · daily submissions</div>
            </div>
            <div className="mt-4">
              {timelineSorted.length ? (
                <SparklineNeon data={timelineSorted} />
              ) : (
                <div className="text-sm text-white/60">No activity in this range.</div>
              )}
            </div>
          </div>

          {/* Segmentation */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Segmentation</h2>
                <p className="text-sm text-white/60">
                  Click a company to drill down into takers and export a targeted list.
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

            <div className="mt-5">
              {tab === "companies" ? (
                <div className="space-y-2">
                  {(data.segments?.companies || []).length ? (
                    (data.segments.companies || []).slice(0, 30).map((c) => (
                      <button
                        key={c.company || "Unknown"}
                        onClick={() => openCompany(c.company || "Unknown")}
                        className="w-full text-left flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/10 transition"
                        type="button"
                        title="View submissions for this company"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.company || "Unknown"}</div>
                          <div className="text-xs text-white/50">
                            {fmtNum(c.testsTaken)} submissions · {fmtPct(c.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">
                          View →
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No company data captured for this link.</div>
                  )}
                </div>
              ) : null}

              {tab === "profiles" ? (
                <div className="space-y-2">
                  {(data.distributions?.profiles || []).length ? (
                    (data.distributions.profiles || []).slice(0, 40).map((p) => (
                      <div
                        key={p.code}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-white/50">
                            {fmtNum(p.count)} · {fmtPct(p.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">avg {fmtNum(p.avgPoints)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No profile data.</div>
                  )}
                </div>
              ) : null}

              {tab === "frequencies" ? (
                <div className="space-y-2">
                  {(data.distributions?.frequencies || []).length ? (
                    (data.distributions.frequencies || []).slice(0, 20).map((f) => (
                      <div
                        key={f.code}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{f.name}</div>
                          <div className="text-xs text-white/50">
                            {fmtNum(f.count)} · {fmtPct(f.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">avg {fmtNum(f.avgPoints)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No frequency data.</div>
                  )}
                </div>
              ) : null}
            </div>
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

          <div className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-[#050914] border-l border-white/10 p-5 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-white/50">Company submissions</div>
                <div className="text-xl font-semibold truncate">{companyDrawerCompany || "Unknown"}</div>
                <div className="text-xs text-white/50 mt-1">
                  Targeted export list (for coaching programmes / CRM sync later)
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={downloadCompanyCsv}
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

            {companyDrawerLoading ? <div className="mt-5 text-white/70">Loading submissions…</div> : null}
            {companyDrawerErr ? <div className="mt-5 text-red-300">Error: {companyDrawerErr}</div> : null}

            {!companyDrawerLoading && !companyDrawerErr && companyDrawerData?.ok ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Total submissions</div>
                    <div className="text-3xl font-semibold mt-1">{fmtNum(companyDrawerData.total)}</div>
                  </div>
                  <div className="text-xs text-white/50">
                    Showing newest first
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px] w-full text-sm">
                      <thead className="text-white/70">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-4 text-left font-medium">Name</th>
                          <th className="py-3 px-4 text-left font-medium">Email</th>
                          <th className="py-3 px-4 text-left font-medium">Phone</th>
                          <th className="py-3 px-4 text-left font-medium">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(companyDrawerData.submissions || []).map((r) => {
                          const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || "—";
                          return (
                            <tr key={r.submissionId} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 px-4">
                                <div className="font-medium">{name}</div>
                                <div className="text-xs text-white/40">ID: {String(r.submissionId).slice(0, 8)}…</div>
                              </td>
                              <td className="py-3 px-4 text-white/80">{r.email || "—"}</td>
                              <td className="py-3 px-4 text-white/80">{r.phone || "—"}</td>
                              <td className="py-3 px-4 text-white/70">{fmtDateTime(r.createdAt)}</td>
                            </tr>
                          );
                        })}

                        {!(companyDrawerData.submissions || []).length ? (
                          <tr>
                            <td colSpan={4} className="py-6 px-4 text-white/60">
                              No submissions found for this company in the selected range.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
