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

function SimpleBars({ data }: { data: TimelinePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.submissions || 0));

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-28">
        {data.map((p, idx) => {
          const v = Math.max(0, p.submissions || 0);
          const h = Math.round((v / max) * 108);

          const glow =
            idx % 3 === 0 ? "rgba(100,186,226,0.45)" : idx % 3 === 1 ? "rgba(45,143,196,0.42)" : "rgba(1,90,139,0.38)";

          return (
            <div key={p.date} className="flex-1 min-w-[6px] group">
              <div className="relative w-full">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-sm blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ height: `${Math.max(6, h)}px`, background: `linear-gradient(180deg, ${glow}, transparent 75%)` }}
                />
                <div
                  className="w-full rounded-sm border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                  style={{
                    height: `${Math.max(2, h)}px`,
                    background:
                      "linear-gradient(180deg, rgba(100,186,226,0.90) 0%, rgba(45,143,196,0.75) 45%, rgba(1,90,139,0.60) 100%)",
                  }}
                  title={`${p.date}: ${Math.round(v)}`}
                />
              </div>
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
        "rounded-full px-3 py-1 text-xs border transition-all",
        active
          ? "bg-white text-black border-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
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

  const timelineSorted = useMemo(() => {
    const t = (data?.timeline || []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  const backHref = useMemo(() => {
    const q = new URLSearchParams();
    if (testId) q.set("testId", testId);
    const qs = q.toString();
    return `/portal/${orgSlug}/dashboard/beta${qs ? `?${qs}` : ""}`;
  }, [orgSlug, testId]);

  function downloadCsv() {
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

    downloadCsvLines(`link_analytics_${orgSlug}_${safeName}.csv`, lines);
  }

  const Card = ({ children }: { children: any }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen p-6 text-white space-y-6">
      <MindCanvasBackdrop />

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-40 bg-[radial-gradient(circle_at_center,rgba(100,186,226,0.35),transparent_60%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              onClick={downloadCsv}
              disabled={!data?.ok}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              type="button"
            >
              Download CSV
            </button>
            <Link href={backHref} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
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
            <Card>
              <div className="text-xs text-white/60">Tests taken</div>
              <div className="mt-1 text-3xl font-semibold">{fmtNum(data.kpis.testsTaken)}</div>
              <div className="mt-3 h-[3px] w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,rgba(100,186,226,0.85),rgba(45,143,196,0.85),rgba(1,90,139,0.85))]" />
              </div>
            </Card>

            <Card>
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="mt-1 text-3xl font-semibold">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-1">
                {data.kpis.uniqueTakers != null && data.kpis.testsTaken
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.testsTaken)} unique`
                  : ""}
              </div>
            </Card>

            <Card>
              <div className="text-xs text-white/60">Last used</div>
              <div className="text-sm text-white/80 mt-2">{fmtDateTime(data.kpis.lastUsedAt)}</div>
            </Card>
          </div>

          {/* Timeline */}
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Activity over time</h2>
              <div className="text-xs text-white/50">Daily submissions</div>
            </div>
            <div className="mt-3">
              {timelineSorted.length ? <SimpleBars data={timelineSorted} /> : <div className="text-sm text-white/60">No activity in this range.</div>}
            </div>
          </Card>

          {/* Segmentation */}
          <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Segmentation</h2>
                <p className="text-sm text-white/60">Switch tabs to explore companies, profiles, and frequencies.</p>
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

            <div className="mt-4">
              {tab === "companies" ? (
                <div className="space-y-2">
                  {(data.segments?.companies || []).length ? (
                    (data.segments.companies || []).slice(0, 25).map((c) => (
                      <div
                        key={c.company}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7 transition"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.company || "Unknown"}</div>
                          <div className="text-xs text-white/50">
                            {fmtNum(c.testsTaken)} · {fmtPct(c.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">tests {fmtNum(c.testsTaken)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No company data captured for this link.</div>
                  )}
                </div>
              ) : null}

              {tab === "profiles" ? (
                <div className="space-y-2">
                  {(data.distributions?.profiles || []).length ? (
                    (data.distributions.profiles || []).slice(0, 30).map((p) => (
                      <div
                        key={p.code}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7 transition"
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
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7 transition"
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
          </Card>
        </>
      )}
    </div>
  );
}

