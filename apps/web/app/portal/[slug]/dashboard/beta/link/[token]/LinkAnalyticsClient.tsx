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
    redirectUrl?: string | null;
    nextStepsUrl?: string | null;
    showResults?: boolean | null;
    meta?: any;
  };
  kpis: { testsTaken: number; uniqueTakers: number | null; lastUsedAt: string | null };
  timeline: TimelinePoint[];
  distributions: {
    profiles: DistItem[];
    frequencies: DistItem[];
  };
  segments: {
    companies: { company: string; testsTaken: number; pct: number }[];
  };
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

export default function LinkAnalyticsClient({
  orgSlug,
  token,
  from,
  to,
}: {
  orgSlug: string;
  token: string;
  from?: string;
  to?: string;
  testId?: string; // kept for backwards compatibility, but not required
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<LinkApiPayload | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        setData(null);

        const q = new URLSearchParams();
        q.set("token", token);
        if (from) q.set("from", from);
        if (to) q.set("to", to);

        const res = await fetch(`/api/portal-dashboard-v2/link?${q.toString()}`, {
          cache: "no-store",
        });

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
    if (!data?.link) return "Link analytics";
    return data.link.name || data.link.label || "Link analytics";
  }, [data]);

  function downloadSegmentationCsv() {
    if (!data?.ok) return;

    const header = ["section", "name", "code", "count", "pct", "avg_points"];

    const rows: any[][] = [];

    const companies = (data.segments?.companies || []).map((c) => [
      "company",
      c.company,
      "",
      Math.round(c.testsTaken || 0),
      Math.round(clampPct(c.pct || 0) * 100),
      "",
    ]);

    const profiles = (data.distributions?.profiles || []).map((p) => [
      "profile",
      p.name,
      p.code,
      Math.round(p.count || 0),
      Math.round(clampPct(p.pct || 0) * 100),
      Math.round(p.avgPoints || 0),
    ]);

    const freqs = (data.distributions?.frequencies || []).map((f) => [
      "frequency",
      f.name,
      f.code,
      Math.round(f.count || 0),
      Math.round(clampPct(f.pct || 0) * 100),
      Math.round(f.avgPoints || 0),
    ]);

    rows.push(...companies, ...profiles, ...freqs);

    const safeName = String(title).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
    downloadCsv(`link_analytics_${orgSlug}_${safeName}.csv`, header, rows);
  }

  const topCompanies = data?.segments?.companies || [];
  const topProfiles = (data?.distributions?.profiles || []).slice(0, 12);
  const topFreqs = (data?.distributions?.frequencies || []).slice(0, 8);

  return (
    <div className="min-h-screen p-6 space-y-6 text-white">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-white/60">Full analytics</div>
            <h1 className="text-2xl font-semibold truncate">{title}</h1>

            {data?.kpis ? (
              <div className="text-sm text-white/60 mt-1">
                Tests taken: <span className="text-white/85 font-medium">{fmtNum(data.kpis.testsTaken)}</span> · Unique
                takers: <span className="text-white/85 font-medium">{fmtNum(data.kpis.uniqueTakers)}</span> · Last used:{" "}
                <span className="text-white/85 font-medium">{fmtDateTime(data.kpis.lastUsedAt)}</span>
              </div>
            ) : (
              <div className="text-sm text-white/60 mt-1">Loading summary…</div>
            )}

            {/* Client-safe range display */}
            {from || to ? (
              <div className="text-xs text-white/50 mt-1">
                Range: {from || "—"} → {to || "—"}
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={downloadSegmentationCsv}
              disabled={!data?.ok}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              title="Download segmentation + distributions as CSV"
            >
              Download CSV
            </button>

            <Link
              href={`/portal/${orgSlug}/dashboard-v2`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
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
          {/* Clean 3-column scannable layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold">Top companies</h2>
              <div className="mt-3 space-y-2">
                {topCompanies.length ? (
                  topCompanies.slice(0, 15).map((c) => (
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold">Top profiles</h2>
              <div className="mt-3 space-y-2">
                {topProfiles.length ? (
                  topProfiles.map((p) => (
                    <div key={p.code} className="flex items-center justify-between gap-3">
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
                  <div className="text-sm text-white/60">No profile distribution available.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold">Top frequencies</h2>
              <div className="mt-3 space-y-2">
                {topFreqs.length ? (
                  topFreqs.map((f) => (
                    <div key={f.code} className="flex items-center justify-between gap-3">
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
                  <div className="text-sm text-white/60">No frequency distribution available.</div>
                )}
              </div>
            </div>
          </div>

          {/* Client-safe link details (no tokens) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="font-semibold">Link details</h2>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="text-white/70">
                Status:{" "}
                <span className="text-white/90 font-medium">
                  {data.link.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>
              <div className="text-white/70">
                Created: <span className="text-white/90 font-medium">{fmtDateTime(data.link.createdAt)}</span>
              </div>
              <div className="text-white/70">
                Expires: <span className="text-white/90 font-medium">{fmtDateTime(data.link.expiresAt)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

