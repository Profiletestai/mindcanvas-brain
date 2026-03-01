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
  growth: number;

  lastUsedAt: string | null;

  utilization: number; // submissions per active link
  repeatRate: number; // 0..1
  status: "hot" | "at_risk" | "active" | "dormant";
};

type Totals = {
  submissions: number;
  uniqueTakers: number;
  activeLinks: number;
  activeOrgs: number;
  dormantOrgs: number;
  atRiskOrgs: number;
};

type Payload = {
  ok: true;
  filters: { from: string; to: string };
  totals: Totals;
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

function fmtRate01(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
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

function StatusPill({ status }: { status: Row["status"] }) {
  const label =
    status === "hot" ? "Hot" : status === "at_risk" ? "At risk" : status === "active" ? "Active" : "Dormant";

  const cls =
    status === "hot"
      ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/30"
      : status === "at_risk"
      ? "bg-amber-400/15 text-amber-200 border-amber-400/30"
      : status === "active"
      ? "bg-sky-400/15 text-sky-200 border-sky-400/30"
      : "bg-white/5 text-white/60 border-white/10";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
}

type SortKey =
  | "submissions"
  | "uniqueTakers"
  | "activeLinks"
  | "growth"
  | "utilization"
  | "repeatRate"
  | "lastUsedAt";

type SortDir = "desc" | "asc";

export default function AdminOrgRankingsClient() {
  const now = new Date();
  const defaultTo = isoToDateInput(now.toISOString());
  const defaultFrom = isoToDateInput(new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString());

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<Payload | null>(null);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submissions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const totals = data?.totals;

  const rows = useMemo(() => {
    const list = (data?.orgs ?? []).slice();

    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((r) => {
          const name = (r.name || "").toLowerCase();
          const slug = (r.slug || "").toLowerCase();
          return name.includes(q) || slug.includes(q);
        })
      : list;

    const dir = sortDir === "desc" ? -1 : 1;

    filtered.sort((a, b) => {
      const av =
        sortKey === "lastUsedAt"
          ? String(a.lastUsedAt || "")
          : (a as any)[sortKey] ?? 0;
      const bv =
        sortKey === "lastUsedAt"
          ? String(b.lastUsedAt || "")
          : (b as any)[sortKey] ?? 0;

      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });

    return filtered;
  }, [data, query, sortKey, sortDir]);

  const card =
    "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className={`${card} p-6`}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(900px_260px_at_20%_0%,rgba(100,186,226,0.35),transparent_65%)]" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(700px_220px_at_90%_30%,rgba(124,92,255,0.30),transparent_60%)]" />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">Admin · Analytics</div>
            <h1 className="text-3xl font-semibold mt-1">Organisation Performance</h1>
            <p className="text-sm text-white/60 mt-1">
              Highest performing organisations across the selected date range.
            </p>
          </div>

          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="block text-xs text-white/60 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
              />
            </div>
            <button
              onClick={load}
              className="h-10 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-medium hover:bg-white/15"
            >
              Apply
            </button>
            <Link
              href="/admin"
              className="h-10 inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm hover:bg-white/10"
            >
              Back
            </Link>
          </div>
        </div>

        {/* Search + sort row */}
        <div className="relative mt-5 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-white/60 mb-1">Search org</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type org name or slug..."
              className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <div>
              <label className="block text-xs text-white/60 mb-1">Sort</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-11 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white"
              >
                <option value="submissions">Submissions</option>
                <option value="uniqueTakers">Unique takers</option>
                <option value="activeLinks">Active links</option>
                <option value="growth">Growth (7d)</option>
                <option value="utilization">Utilisation</option>
                <option value="repeatRate">Repeat rate</option>
                <option value="lastUsedAt">Last used</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Dir</label>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as SortDir)}
                className="h-11 rounded-xl bg-white/10 border border-white/10 px-3 text-sm text-white"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      {totals ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className={`${card} p-5`}>
            <div className="text-xs text-white/60">Platform submissions</div>
            <div className="text-4xl font-semibold mt-2">{fmtNum(totals.submissions)}</div>
            <div className="text-xs text-white/45 mt-2">In selected range</div>
          </div>

          <div className={`${card} p-5`}>
            <div className="text-xs text-white/60">Platform unique takers</div>
            <div className="text-4xl font-semibold mt-2">{fmtNum(totals.uniqueTakers)}</div>
            <div className="text-xs text-white/45 mt-2">In selected range</div>
          </div>

          <div className={`${card} p-5`}>
            <div className="text-xs text-white/60">Active links</div>
            <div className="text-4xl font-semibold mt-2">{fmtNum(totals.activeLinks)}</div>
            <div className="text-xs text-white/45 mt-2">Usable now</div>
          </div>

          <div className={`${card} p-5`}>
            <div className="text-xs text-white/60">Active orgs</div>
            <div className="text-4xl font-semibold mt-2">{fmtNum(totals.activeOrgs)}</div>
            <div className="text-xs text-white/45 mt-2">≥1 submission</div>
          </div>

          <div className={`${card} p-5`}>
            <div className="text-xs text-white/60">At-risk orgs</div>
            <div className="text-4xl font-semibold mt-2">{fmtNum(totals.atRiskOrgs)}</div>
            <div className="text-xs text-white/45 mt-2">Links but no usage</div>
          </div>
        </div>
      ) : null}

      {loading && <div className={`${card} p-6 text-white/60`}>Loading…</div>}
      {err && <div className={`${card} p-6 text-red-300`}>Error: {err}</div>}

      {!loading && !err && (
        <div className={`${card} overflow-x-auto`}>
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 text-left font-medium">Org</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>

                <th className="py-3 px-4 text-right font-medium">Submissions</th>
                <th className="py-3 px-4 text-right font-medium">Unique takers</th>
                <th className="py-3 px-4 text-right font-medium">Active links</th>

                <th className="py-3 px-4 text-right font-medium">Utilisation</th>
                <th className="py-3 px-4 text-right font-medium">Repeat rate</th>
                <th className="py-3 px-4 text-right font-medium">Growth (7d)</th>

                <th className="py-3 px-4 text-left font-medium">Last used</th>
                <th className="py-3 px-4 text-left font-medium">Open</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.orgId} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-4 px-4">
                    <div className="font-medium text-white/95">{r.name || r.slug}</div>
                    <div className="text-xs text-white/45">{r.slug}</div>
                  </td>

                  <td className="py-4 px-4">
                    <StatusPill status={r.status} />
                  </td>

                  <td className="py-4 px-4 text-right font-semibold">{fmtNum(r.submissions)}</td>
                  <td className="py-4 px-4 text-right">{fmtNum(r.uniqueTakers)}</td>
                  <td className="py-4 px-4 text-right">{fmtNum(r.activeLinks)}</td>

                  <td className="py-4 px-4 text-right" title="Submissions per active link (selected range)">
                    {r.activeLinks > 0 ? (r.utilization || 0).toFixed(1) : "—"}
                  </td>

                  <td className="py-4 px-4 text-right" title="1 - (unique takers / submissions)">
                    {r.submissions > 0 ? fmtRate01(r.repeatRate) : "—"}
                  </td>

                  <td className="py-4 px-4 text-right">{fmtPct(r.growth)}</td>

                  <td className="py-4 px-4 text-white/70">{fmtDateTime(r.lastUsedAt)}</td>

                  <td className="py-4 px-4">
                    <Link
                      className="underline text-sky-200 hover:text-sky-100"
                      href={`/portal/${r.slug}/dashboard`}
                      title="Open dashboard for this org"
                    >
                      Open dashboard
                    </Link>
                  </td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan={10} className="py-10 px-4 text-center text-white/60">
                    No organisations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}