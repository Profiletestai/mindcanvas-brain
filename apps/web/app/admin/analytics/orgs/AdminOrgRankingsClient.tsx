// apps/web/app/admin/analytics/orgs/AdminOrgRankingsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = {
  orgId: string;
  slug: string;
  name: string | null;
  submissions: number;
  uniqueTakers: number;
  activeLinks: number;
  last7: number;
  prev7: number;
  growth: number; // -1..+inf (we clamp in UI)
};

type Payload = {
  ok: true;
  filters: { from: string; to: string };
  orgs: Row[];
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

function fmtPct(g: number) {
  if (!Number.isFinite(g)) return "—";
  if (g === 1) return "New";
  const v = g * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`;
}

function growthBadgeClass(g: number) {
  if (!Number.isFinite(g)) return "bg-white/5 text-white/70 border-white/10";
  if (g === 1) return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
  if (g > 0) return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
  if (g < 0) return "bg-red-500/10 text-red-200 border-red-500/20";
  return "bg-white/5 text-white/70 border-white/10";
}

function MindCanvasGrid() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,#113149_0%,#08121b_55%,#060e16_100%)]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute inset-0 bg-[#050914]/60" />
    </div>
  );
}

const card =
  "rounded-3xl border border-white/10 bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur";

export default function AdminOrgRankingsClient() {
  const now = new Date();
  const defaultTo = isoToDateInput(now.toISOString());
  const defaultFrom = isoToDateInput(new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString());

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<Payload | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const q = new URLSearchParams();
      const fromIso = dateInputToIsoStart(fromDate);
      const toIso = dateInputToIsoEnd(toDate);
      if (fromIso) q.set("from", fromIso);
      if (toIso) q.set("to", toIso);

      const res = await fetch(`/api/admin/org-rankings?${q.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      setData(j as Payload);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => data?.orgs ?? [], [data]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const slug = (r.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="min-h-screen p-6 text-white">
      <MindCanvasGrid />

      <div className={`${card} p-6`}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(900px_260px_at_20%_0%,rgba(100,186,226,0.35),transparent_65%)]" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(700px_220px_at_90%_30%,rgba(124,92,255,0.30),transparent_60%)]" />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">Admin · Analytics</div>
            <h1 className="text-2xl font-semibold mt-1">Organisation Performance</h1>
            <p className="text-sm text-white/60 mt-1">Highest performing organisations across the selected date range.</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
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

            <button
              onClick={load}
              className="h-10 rounded-xl bg-white text-black px-4 text-sm font-medium hover:bg-white/90"
            >
              Apply
            </button>

            <Link href="/admin" className="h-10 inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm hover:bg-white/10">
              Back
            </Link>
          </div>
        </div>

        <div className="relative mt-4">
          <label className="block text-xs text-white/60 mb-1">Search org</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type org name or slug…"
            className="h-11 w-full rounded-xl bg-white/10 border border-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
      </div>

      <div className="mt-5">
        {loading && <div className={`${card} p-6 text-white/70`}>Loading…</div>}
        {err && <div className={`${card} p-6 text-red-300`}>Error: {err}</div>}

        {!loading && !err && data?.ok && (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-white/[0.04] text-white/70">
                  <tr className="border-b border-white/10">
                    <th className="py-3 px-4 text-left font-medium">Org</th>
                    <th className="py-3 px-4 text-right font-medium">Submissions</th>
                    <th className="py-3 px-4 text-right font-medium">Unique takers</th>
                    <th className="py-3 px-4 text-right font-medium">Active links</th>
                    <th className="py-3 px-4 text-right font-medium">Growth (7d)</th>
                    <th className="py-3 px-4 text-left font-medium">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.orgId} className="border-b border-white/5 hover:bg-white/[0.04]">
                      <td className="py-4 px-4">
                        <div className="font-medium text-white/90">{r.name || r.slug}</div>
                        <div className="text-xs text-white/50">{r.slug}</div>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold">{r.submissions}</td>
                      <td className="py-4 px-4 text-right">{r.uniqueTakers}</td>
                      <td className="py-4 px-4 text-right">{r.activeLinks}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${growthBadgeClass(r.growth)}`}>
                          {fmtPct(r.growth)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                          href={`/portal/${r.slug}/dashboard`}
                          title="Open dashboard for this org"
                        >
                          Open dashboard →
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {!filteredRows.length && (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-white/60">
                        No organisations match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-white/50 border-t border-white/10">
              Showing {filteredRows.length} org(s). Date range: {isoToDateInput(data.filters.from)} → {isoToDateInput(data.filters.to)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


