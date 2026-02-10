// apps/web/app/portal/[slug]/dashboard/beta/link/[token]/LinkAnalyticsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TopByCount = { code: string; name: string; count: number; pct: number };
type TopByAvg = { code: string; name: string; avgPoints: number; n: number };
type TopFreqByCount = { code: string; name: string; count: number; pct: number } | null;
type TopFreqByAvg = { code: string; name: string; avgPoints: number; n: number } | null;

type LinkPayload = {
  ok: true;
  link: {
    linkId: string;
    token: string;
    name: string | null;
    label: string | null;
    isActive: boolean;
    createdAt: string;
    expiresAt: string | null;
    useCount: number;
    maxUses: number | null;
  };
  stats: {
    testsTaken: number;
    topProfilesByCount: TopByCount[];
    topProfilesByAvg: TopByAvg[];
    topFrequencyByCount: TopFreqByCount;
    topFrequencyByAvg: TopFreqByAvg;
  };
  // if your API returns more (company breakdown etc), we’ll render it later
};

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
  const [data, setData] = useState<LinkPayload | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const q = new URLSearchParams();
        q.set("org", orgSlug);
        q.set("token", token);
        if (from) q.set("from", from);
        if (to) q.set("to", to);
        if (testId) q.set("testId", testId);

        const res = await fetch(`/api/portal-dashboard-v2/link?${q.toString()}`, {
          cache: "no-store",
        });

        const j = await res.json();
        if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);

        if (alive) setData(j as LinkPayload);
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgSlug, token, from, to, testId]);

  const title = useMemo(() => {
    if (!data?.link) return "Link analytics";
    return data.link.name || data.link.label || "Link analytics";
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs opacity-60">Full analytics</div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-sm opacity-70 break-all">
            token: <code>{token}</code>
          </div>
          {from || to ? (
            <div className="text-xs opacity-60 mt-1">
              Range: {from || "—"} → {to || "—"}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Link
            href={`/portal/${orgSlug}/dashboard/beta${testId ? `?testId=${encodeURIComponent(testId)}` : ""}`}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {loading && <div className="opacity-70">Loading…</div>}
      {err && <div className="text-red-600">Error: {err}</div>}

      {!loading && !err && data?.ok && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4">
              <div className="text-xs opacity-60">Tests taken</div>
              <div className="text-2xl font-semibold">{data.stats.testsTaken}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs opacity-60">Top frequency (most common)</div>
              <div className="text-lg font-semibold">
                {data.stats.topFrequencyByCount?.name ?? "—"}
              </div>
              <div className="text-xs opacity-60">
                {data.stats.topFrequencyByCount
                  ? `${data.stats.topFrequencyByCount.count} (${Math.round(
                      data.stats.topFrequencyByCount.pct * 100
                    )}%)`
                  : "—"}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs opacity-60">Link status</div>
              <div className="text-lg font-semibold">{data.link.isActive ? "Active" : "Inactive"}</div>
              <div className="text-xs opacity-60">
                Expires: {data.link.expiresAt ? new Date(data.link.expiresAt).toLocaleString() : "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border p-4">
              <h2 className="font-semibold mb-3">Top profiles (most common)</h2>
              <div className="space-y-2">
                {data.stats.topProfilesByCount?.length ? (
                  data.stats.topProfilesByCount.map((p) => (
                    <div key={p.code} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs opacity-60">{p.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{p.count}</div>
                        <div className="text-xs opacity-60">{Math.round(p.pct * 100)}%</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="opacity-70">No profile data.</div>
                )}
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <h2 className="font-semibold mb-3">Top profiles (highest average)</h2>
              <div className="space-y-2">
                {data.stats.topProfilesByAvg?.length ? (
                  data.stats.topProfilesByAvg.map((p) => (
                    <div key={p.code} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs opacity-60">{p.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{Math.round(p.avgPoints)}</div>
                        <div className="text-xs opacity-60">n={p.n}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="opacity-70">No profile average data.</div>
                )}
              </div>
            </section>
          </div>

          {/* Export hooks go here next (CSV/JSON/PDF later) */}
        </div>
      )}
    </div>
  );
}
