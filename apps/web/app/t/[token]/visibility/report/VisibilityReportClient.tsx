// apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

type VisibilityTotals = {
  tier: Tier;
  level: number;
  readiness: Readiness;
  personality_type: AB;
  personality_points: Record<AB, number>;
  tier_counts: Record<Tier, number>;
};

type ApiVisibilityReportResponse = {
  ok: boolean;
  data?: {
    org_slug?: string | null;
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string | null;
    taker?: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null };
    totals?: VisibilityTotals;
    debug?: any;
  };
  error?: string;
};

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function tierBand(level: number): Tier {
  if (level <= 5) return "Invisible";
  if (level <= 10) return "Emerging";
  if (level <= 15) return "Established";
  return "Magnetic";
}

function readinessLabel(r: Readiness) {
  return r === "ready_to_progress" ? "Ready to progress" : "Stabilise";
}

function fullName(taker?: any) {
  const n = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim();
  return n || "Your";
}

async function fetchJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = (await r.text()).slice(0, 400);
    throw new Error(`HTTP ${r.status} – non-JSON response:\n${text}`);
  }
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-[#050914] text-white">
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 opacity-60 [background:radial-gradient(1200px_600px_at_20%_10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(900px_500px_at_85%_20%,rgba(99,102,241,0.18),transparent_55%),radial-gradient(800px_500px_at_50%_90%,rgba(20,184,166,0.14),transparent_55%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
    </div>
    <div className="relative">{children}</div>
  </div>
);

export default function VisibilityReportClient({
  token,
  tid,
  src,
}: {
  token: string;
  tid: string;
  src?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<ApiVisibilityReportResponse["data"] | null>(null);
  const [vis, setVis] = useState<VisibilityTotals | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setMeta(null);
        setVis(null);

        if (!tid) throw new Error("Missing tid");

        const url = `/api/public/visibility/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
          tid
        )}${src ? `&src=${encodeURIComponent(src)}` : ""}`;

        const j: ApiVisibilityReportResponse = await fetchJson(url);
        if (cancelled) return;

        setMeta(j.data || null);

        const totals = j.data?.totals;
        if (!totals) throw new Error("Visibility totals not found from visibility report endpoint.");
        setVis(totals);

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(String(e?.message || e));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tid, src]);

  const tierCountsData = useMemo(() => {
    if (!vis) return [];
    const counts = vis.tier_counts || ({} as any);
    return (["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]).map((t) => ({
      name: t,
      value: Number(counts[t] ?? 0),
    }));
  }, [vis]);

  const personalityData = useMemo(() => {
    if (!vis) return [];
    const pts = vis.personality_points || ({} as any);
    const order: AB[] = ["A", "B", "C", "D"];
    return order.map((k) => ({ name: k, value: Number(pts[k] ?? 0) }));
  }, [vis]);

  const ladderData = useMemo(() => {
    const level = vis?.level ?? 0;
    const active = clamp(level, 1, 20);
    const steps = [];
    for (let i = 1; i <= 20; i++) {
      steps.push({
        step: i,
        active: i === active ? 1 : 0,
        band: tierBand(i),
      });
    }
    return steps;
  }, [vis?.level]);

  const radarData = useMemo(() => {
    // Proxy pillar view until pillar scoring is explicitly stored.
    if (!vis) return null;

    const tc = vis.tier_counts || ({} as any);
    const total = (["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]).reduce(
      (s, t) => s + Number(tc[t] ?? 0),
      0
    );
    if (!total) return null;

    const inv = Number(tc.Invisible ?? 0);
    const est = Number(tc.Established ?? 0);
    const mag = Number(tc.Magnetic ?? 0);

    const discoverability = ((total - inv) / total) * 100;
    const trust = ((est + mag) / total) * 100;
    const conversion = (mag / total) * 100;

    return [
      { pillar: "Discoverability", score: Math.round(discoverability) },
      { pillar: "Trust", score: Math.round(trust) },
      { pillar: "Conversion", score: Math.round(conversion) },
    ];
  }, [vis]);

  const orgName = meta?.org_name || "MindCanvas";
  const testName = meta?.test_name || "Visibility Ladder";
  const takerName = fullName(meta?.taker);

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-5xl p-6">
          <div className="text-2xl font-semibold">Loading your report…</div>
          <div className="mt-2 text-sm text-white/70">Preparing your Visibility Ladder report.</div>
        </div>
      </Shell>
    );
  }

  if (err || !vis) {
    return (
      <Shell>
        <div className="mx-auto max-w-5xl p-6 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility report</div>
          <p className="text-sm text-red-300">{safeText(err || "Unknown error")}</p>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-xs text-white/70">
            <div>token: {token}</div>
            <div>tid: {tid}</div>
          </div>
          <Link href={`/t/${token}`} className="underline text-sm">
            Go back
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-white/70">
                {orgName} • {testName}
              </div>
              <div className="mt-2 text-3xl font-semibold">{takerName} Visibility Ladder</div>
              <div className="mt-2 text-white/80">
                <span className="font-semibold">{vis.tier}</span> • Level{" "}
                <span className="font-semibold">{vis.level}</span> •{" "}
                <span className="font-semibold">{readinessLabel(vis.readiness)}</span>
              </div>
              <div className="mt-3 text-sm text-white/70">
                Style: <span className="font-semibold">{vis.personality_type}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 border border-white/10 p-4 min-w-[240px]">
              <div className="text-xs text-white/60">At a glance</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-white/60">Tier</div>
                  <div className="font-semibold">{vis.tier}</div>
                </div>
                <div>
                  <div className="text-white/60">Level</div>
                  <div className="font-semibold">{vis.level}</div>
                </div>
                <div>
                  <div className="text-white/60">Readiness</div>
                  <div className="font-semibold">{readinessLabel(vis.readiness)}</div>
                </div>
                <div>
                  <div className="text-white/60">Style</div>
                  <div className="font-semibold">{vis.personality_type}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ladder + Tier distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
            <div className="text-lg font-semibold">Your ladder position</div>
            <div className="mt-1 text-sm text-white/70">20 levels across 4 tiers. You’re highlighted at your level.</div>

            <div className="mt-5 grid grid-cols-10 gap-2">
              {ladderData.map((s) => (
                <div
                  key={s.step}
                  className={[
                    "h-8 rounded-lg border text-[11px] flex items-center justify-center",
                    s.active ? "bg-white text-black border-white" : "bg-white/5 border-white/15 text-white/70",
                  ].join(" ")}
                  title={`${s.band} • Level ${s.step}`}
                >
                  {s.step}
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-white/60">
              Bands: 1–5 Invisible • 6–10 Emerging • 11–15 Established • 16–20 Magnetic
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
            <div className="text-lg font-semibold">Signal distribution</div>
            <div className="mt-1 text-sm text-white/70">How your answers across Q9–Q25 mapped into each tier.</div>

            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierCountsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.75)" }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.75)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pillars + Personality */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
            <div className="text-lg font-semibold">Pillars overview</div>
            <div className="mt-1 text-sm text-white/70">A high-level picture of Discoverability, Trust, and Conversion.</div>

            <div className="mt-4 h-[280px]">
              {radarData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="pillar" tick={{ fill: "rgba(255,255,255,0.75)" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.6)" }} />
                    <Radar dataKey="score" />
                    <Tooltip
                      contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}
                      labelStyle={{ color: "white" }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl bg-black/20 border border-white/10 flex items-center justify-center text-sm text-white/70">
                  Pillar data will appear here once enabled.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
            <div className="text-lg font-semibold">Your execution style</div>
            <div className="mt-1 text-sm text-white/70">Based on Q1–Q8 weighting.</div>

            <div className="mt-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={personalityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.75)" }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.75)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 text-xs text-white/60">
              Primary style: <span className="text-white/80 font-semibold">{vis.personality_type}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 space-y-4">
          <div className="text-lg font-semibold">Your personalised guidance</div>
          <p className="text-sm text-white/70">
            Next, we’ll add AI-generated insights based on your tier, level, distribution, and style.
          </p>
        </div>
      </div>
    </Shell>
  );
}