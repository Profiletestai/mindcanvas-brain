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
  // for prev=0 case, API returns 1 when last>0. treat as "New"
  if (g === 1) return "New";
  const v = g * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`;
}

export default function AdminOrgRankingsClient() {
  const now = new Date();
  const defaultTo = isoToDateInput(now.toISOString());
  const defaultFrom = isoToDateInput(new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString());

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Organisation Performance</h1>
          <p className="text-sm opacity-70">Highest performing organisations across the selected date range.</p>
        </div>

        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs opacity-70 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10 rounded-md border px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs opacity-70 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 rounded-md border px-3 text-sm"
            />
          </div>
          <button onClick={load} className="h-10 rounded-md border px-4 text-sm font-medium">
            Apply
          </button>
          <Link href="/admin" className="h-10 inline-flex items-center rounded-md border px-4 text-sm">
            Back
          </Link>
        </div>
      </div>

      {loading && <div className="opacity-70">Loading…</div>}
      {err && <div className="text-red-600">Error: {err}</div>}

      {!loading && !err && data?.ok && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-black/5">
              <tr className="border-b">
                <th className="py-2 px-3 text-left">Org</th>
                <th className="py-2 px-3 text-right">Submissions</th>
                <th className="py-2 px-3 text-right">Unique takers</th>
                <th className="py-2 px-3 text-right">Active links</th>
                <th className="py-2 px-3 text-right">Growth (7d)</th>
                <th className="py-2 px-3 text-left">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.orgId} className="border-b last:border-b-0">
                  <td className="py-3 px-3">
                    <div className="font-medium">{r.name || r.slug}</div>
                    <div className="text-xs opacity-60">{r.slug}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold">{r.submissions}</td>
                  <td className="py-3 px-3 text-right">{r.uniqueTakers}</td>
                  <td className="py-3 px-3 text-right">{r.activeLinks}</td>
                  <td className="py-3 px-3 text-right">{fmtPct(r.growth)}</td>
                  <td className="py-3 px-3">
                    <Link className="underline" href={`/portal/${r.slug}/dashboard`} title="Open dashboard for this org">
                      Open dashboard
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="py-10 px-3 text-center opacity-70">
                    No organisations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

