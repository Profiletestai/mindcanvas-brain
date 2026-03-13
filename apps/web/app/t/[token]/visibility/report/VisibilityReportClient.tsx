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
  Cell,
} from "recharts";

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

type VisibilitySignals = {
  tier: Tier;
  level: number;
  style: AB;
  readiness: Readiness;
  pillar_scores?: Record<string, number>;
  pillar_band?: Record<string, string>;
  weakest_pillar?: string | null;
  strongest_pillar?: string | null;
  pattern_tags?: string[];
};

type VisibilityGraphs = {
  tier_counts?: Record<string, number>;
  personality_points?: Record<string, number>;
  ladder?: { tier: Tier; level: number };
  pillars?: Record<string, number>;
  pillar_band?: Record<string, string>;
};

type KBBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  transition?: string;
};

type KBSection = {
  key: string;
  title?: string;
  blocks?: KBBlock[];
};

type ApiKBReport = {
  token: string;
  tid?: string | null;
  sid?: string | null;
  submission_id: string;
  engine_key: string;
  version: number;
  audience: string;
  meta?: {
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string | null;
    generated_at?: string | null;
  };
  signals?: VisibilitySignals;
  graphs?: VisibilityGraphs;
  sections?: KBSection[];
};

type ApiResponse = {
  ok: boolean;
  data?: ApiKBReport;
  error?: string;
  __meta?: any;
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

function fullNameFallback(first?: any, last?: any) {
  const n = [first, last].filter(Boolean).join(" ").trim();
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

/* ---------------- Brand-ish palette (no Tailwind tokens needed) ---------------- */

const BRAND = {
  navy0: "#050914",
  textDim: "rgba(255,255,255,0.72)",
  textFaint: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.12)",

  teal: "#38E1C6",
  blue: "#4FB3FF",
  purple: "#7C3AED",

  tier: {
    Invisible: "#64748B", // slate
    Emerging: "#4FB3FF", // blue
    Established: "#38E1C6", // teal
    Magnetic: "#7C3AED", // purple
  } as Record<Tier, string>,

  ab: {
    A: "#38E1C6",
    B: "#4FB3FF",
    C: "#F59E0B",
    D: "#EF4444",
  } as Record<AB, string>,
};

/* ---------------- UI atoms ---------------- */

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen text-white" style={{ background: BRAND.navy0 }}>
    <div className="pointer-events-none fixed inset-0">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1100px 520px at 16% 8%, rgba(56,225,198,0.18), transparent 60%)," +
            "radial-gradient(900px 480px at 86% 20%, rgba(79,179,255,0.16), transparent 55%)," +
            "radial-gradient(700px 520px at 50% 88%, rgba(124,58,237,0.14), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
    </div>
    <div className="relative">{children}</div>
  </div>
);

function GlassCard({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-[28px] p-[1px]"
      style={{
        background:
          "linear-gradient(135deg, rgba(56,225,198,0.22), rgba(79,179,255,0.12), rgba(255,255,255,0.06))",
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="rounded-[27px] p-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
          border: `1px solid ${BRAND.border}`,
          backdropFilter: "blur(10px)",
        }}
      >
        {(title || subtitle || right) && (
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && <div className="text-lg font-semibold">{title}</div>}
              {subtitle && (
                <div className="mt-1 text-sm" style={{ color: BRAND.textDim }}>
                  {subtitle}
                </div>
              )}
            </div>
            {right}
          </div>
        )}
        <div className={title || subtitle || right ? "mt-4" : ""}>{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Visuals: Ladder + Pyramid ---------------- */

function LadderGrid({ level }: { level: number }) {
  const active = clamp(level, 1, 20);
  const steps = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div className="mt-2 grid grid-cols-10 gap-2">
      {steps.map((s) => {
        const isActive = s === active;
        const band = tierBand(s);
        const bandColor = BRAND.tier[band];
        return (
          <div
            key={s}
            className="h-9 rounded-xl border text-[11px] flex items-center justify-center select-none"
            style={{
              borderColor: isActive ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.12)",
              background: isActive
                ? `linear-gradient(180deg, ${bandColor}33, rgba(255,255,255,0.10))`
                : "rgba(255,255,255,0.04)",
              boxShadow: isActive
                ? `0 0 0 1px rgba(255,255,255,0.12), 0 0 18px ${bandColor}55`
                : "none",
              color: isActive ? "white" : "rgba(255,255,255,0.75)",
            }}
            title={`${band} • Level ${s}`}
          >
            {s}
          </div>
        );
      })}
    </div>
  );
}

function TierPyramid({ tier, level }: { tier: Tier; level: number }) {
  const tiers: Tier[] = ["Invisible", "Emerging", "Established", "Magnetic"];
  const activeTier = tier;

  return (
    <div className="mt-6">
      <div className="text-xs" style={{ color: BRAND.textFaint }}>
        Pyramid view (tier emphasis)
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="w-full max-w-[520px] space-y-2">
          {tiers.map((t, idx) => {
            const isActive = t === activeTier;
            const c = BRAND.tier[t];
            const widthPct = 60 + idx * 12; // 60,72,84,96
            return (
              <div key={t} className="flex items-center justify-center">
                <div
                  className="h-12 rounded-2xl border flex items-center justify-between px-4"
                  style={{
                    width: `${widthPct}%`,
                    borderColor: isActive ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)",
                    background: isActive
                      ? `linear-gradient(90deg, ${c}66, rgba(255,255,255,0.06))`
                      : "rgba(255,255,255,0.04)",
                    boxShadow: isActive ? `0 0 22px ${c}55` : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ background: c, boxShadow: `0 0 12px ${c}66` }}
                    />
                    <div className="text-sm font-semibold">{t}</div>
                  </div>
                  <div className="text-xs" style={{ color: BRAND.textDim }}>
                    {t === tier ? `Level ${level}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- KB renderer ---------------- */

function SectionBlock({ b }: { b: KBBlock }) {
  return (
    <div className="space-y-3">
      {b.short_summary ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.82)" }}
        >
          <span className="font-semibold">In short:</span> {b.short_summary}
        </div>
      ) : null}

      {Array.isArray(b.paragraphs) && b.paragraphs.length ? (
        <div className="space-y-3">
          {b.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-6" style={{ color: "rgba(255,255,255,0.80)" }}>
              {p}
            </p>
          ))}
        </div>
      ) : null}

      {Array.isArray(b.bullets) && b.bullets.length ? (
        <ul className="list-disc pl-6 space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>
          {b.bullets.map((x, i) => (
            <li key={i} className="leading-6">
              {x}
            </li>
          ))}
        </ul>
      ) : null}

      {b.transition ? (
        <div className="pt-1 text-xs" style={{ color: BRAND.textFaint }}>
          {b.transition}
        </div>
      ) : null}
    </div>
  );
}

function KBSections({ sections }: { sections: KBSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <GlassCard key={s.key} title={s.title || s.key}>
          <div className="space-y-6">
            {(s.blocks || []).map((b, idx) => (
              <div key={idx}>
                {b.title && (
                  <div className="text-base font-semibold mb-2">{b.title}</div>
                )}
                <SectionBlock b={b} />
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

/* ---------------- Main ---------------- */

export default function VisibilityReportClient({
  token,
  tid,
  src,
}: {
  token: string;
  tid?: string; // allow empty, because we may use sid
  src?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [report, setReport] = useState<ApiKBReport | null>(null);

  // ✅ If you later decide to navigate by sid, we support it.
  const sidFromUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("sid") || ""
      : "";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setReport(null);

        const cleanTid = (tid || "").trim();
        const cleanSid = (sidFromUrl || "").trim();

        if (!cleanTid && !cleanSid) throw new Error("Missing tid or sid");

        // ✅ IMPORTANT: call the KB-driven endpoint
        const url =
          `/api/public/visibility/${encodeURIComponent(token)}/report?` +
          (cleanSid
            ? `sid=${encodeURIComponent(cleanSid)}`
            : `tid=${encodeURIComponent(cleanTid)}`) +
          `&audience=taker_report&nocache=1` +
          (src ? `&src=${encodeURIComponent(src)}` : "");

        const j: ApiResponse = await fetchJson(url);
        if (cancelled) return;

        const data = j.data;
        if (!data) throw new Error("Missing report data");
        setReport(data);
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
  }, [token, tid, src, sidFromUrl]);

  const signals = report?.signals;
  const graphs = report?.graphs;
  const sections = Array.isArray(report?.sections) ? report!.sections! : [];

  const tierCountsData = useMemo(() => {
    const counts = graphs?.tier_counts || {};
    return (["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]).map((t) => ({
      name: t,
      value: Number((counts as any)[t] ?? 0),
      color: BRAND.tier[t],
    }));
  }, [graphs]);

  const personalityData = useMemo(() => {
    const pts = graphs?.personality_points || {};
    const order: AB[] = ["A", "B", "C", "D"];
    return order.map((k) => ({
      name: k,
      value: Number((pts as any)[k] ?? 0),
      color: BRAND.ab[k],
    }));
  }, [graphs]);

  const pillarRadarData = useMemo(() => {
    const p = graphs?.pillars || signals?.pillar_scores || {};
    const d = Number((p as any).discoverability ?? 0);
    const t = Number((p as any).trust ?? 0);
    const c = Number((p as any).conversion ?? 0);
    const hasAny = [d, t, c].some((n) => Number.isFinite(n) && n > 0);
    if (!hasAny) return null;

    return [
      { pillar: "Discoverability", score: clamp(Math.round(d), 0, 100) },
      { pillar: "Trust", score: clamp(Math.round(t), 0, 100) },
      { pillar: "Conversion", score: clamp(Math.round(c), 0, 100) },
    ];
  }, [graphs, signals]);

  const orgName = report?.meta?.org_name || "MindCanvas";
  const testName = report?.meta?.test_name || "Visibility Ladder";
  const takerName = fullNameFallback(
    (report as any)?.taker?.first_name,
    (report as any)?.taker?.last_name
  );

  const tier = (signals?.tier || graphs?.ladder?.tier || "Emerging") as Tier;
  const level = Number(signals?.level ?? graphs?.ladder?.level ?? 0);
  const readiness = (signals?.readiness || "stabilise") as Readiness;
  const style = (signals?.style || "A") as AB;

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-6xl p-6">
          <div className="text-2xl font-semibold">Loading your report…</div>
          <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
            Preparing your Visibility Ladder report.
          </div>
        </div>
      </Shell>
    );
  }

  if (err || !report) {
    return (
      <Shell>
        <div className="mx-auto max-w-6xl p-6 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility report</div>
          <p className="text-sm" style={{ color: "rgba(248,113,113,0.95)" }}>
            {safeText(err || "Unknown error")}
          </p>
          <div
            className="rounded-2xl p-4 text-xs"
            style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BRAND.border}` }}
          >
            <div>token: {token}</div>
            <div>tid: {safeText(tid || "")}</div>
            <div>sid: {safeText(sidFromUrl || "")}</div>
          </div>
          <Link href={`/t/${token}`} className="underline text-sm">
            Go back
          </Link>
        </div>
      </Shell>
    );
  }

  const tierColor = BRAND.tier[tier];
  const styleColor = BRAND.ab[style];

  return (
    <Shell>
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <GlassCard
          title={`${takerName} Visibility Ladder`}
          subtitle={`${orgName} • ${testName}`}
          right={
            <div
              className="rounded-2xl border p-4 min-w-[240px]"
              style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)" }}
            >
              <div className="text-xs" style={{ color: BRAND.textFaint }}>
                At a glance
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div style={{ color: BRAND.textFaint }}>Tier</div>
                  <div className="font-semibold" style={{ color: tierColor }}>
                    {tier}
                  </div>
                </div>
                <div>
                  <div style={{ color: BRAND.textFaint }}>Level</div>
                  <div className="font-semibold">{level}</div>
                </div>
                <div>
                  <div style={{ color: BRAND.textFaint }}>Readiness</div>
                  <div className="font-semibold">{readinessLabel(readiness)}</div>
                </div>
                <div>
                  <div style={{ color: BRAND.textFaint }}>Style</div>
                  <div className="font-semibold" style={{ color: styleColor }}>
                    {style}
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <div className="text-white/85">
            <span className="font-semibold" style={{ color: tierColor }}>
              {tier}
            </span>{" "}
            • Level <span className="font-semibold">{level}</span> •{" "}
            <span className="font-semibold">{readinessLabel(readiness)}</span>
          </div>
        </GlassCard>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard
            title="Your ladder position"
            subtitle="20 levels across 4 tiers. You’re highlighted at your level."
          >
            <LadderGrid level={level} />
            <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
              Bands: 1–5 Invisible • 6–10 Emerging • 11–15 Established • 16–20 Magnetic
            </div>
            <TierPyramid tier={tier} level={level} />
          </GlassCard>

          <GlassCard
            title="Signal distribution"
            subtitle="How your answers across Q9–Q25 mapped into each tier."
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierCountsData} barCategoryGap={22}>
                  <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.78)" }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.70)" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      background: "rgba(7,18,38,0.92)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14,
                      color: "white",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                  />
                  <Bar dataKey="value" radius={[14, 14, 6, 6]}>
                    {tierCountsData.map((d) => (
                      <Cell key={d.name} fill={d.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard
            title="Pillars overview"
            subtitle="Discoverability, Trust, and Conversion."
          >
            <div className="h-[320px]">
              {pillarRadarData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={pillarRadarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.14)" />
                    <PolarAngleAxis dataKey="pillar" tick={{ fill: "rgba(255,255,255,0.78)" }} />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: "rgba(255,255,255,0.55)" }}
                      stroke="rgba(255,255,255,0.12)"
                    />
                    <Radar dataKey="score" stroke={BRAND.teal} fill={BRAND.teal} fillOpacity={0.25} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(7,18,38,0.92)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 14,
                        color: "white",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="h-full rounded-2xl flex items-center justify-center text-sm"
                  style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}
                >
                  Pillar scores will appear here once enabled.
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard
            title="Your execution style"
            subtitle="Based on Q1–Q8 weighting."
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={personalityData} barCategoryGap={24}>
                  <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.78)" }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.70)" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      background: "rgba(7,18,38,0.92)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14,
                      color: "white",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                  />
                  <Bar dataKey="value" radius={[14, 14, 6, 6]}>
                    {personalityData.map((d) => (
                      <Cell key={d.name} fill={d.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-sm" style={{ color: BRAND.textDim }}>
              Primary style:{" "}
              <span className="font-semibold" style={{ color: styleColor }}>
                {style}
              </span>
            </div>
          </GlassCard>
        </div>

        {/* ✅ KB-driven narrative report */}
        <GlassCard
          title="Your personalised report"
          subtitle="This narrative is selected dynamically from the Visibility Ladder knowledge base."
          right={
            <div className="text-xs" style={{ color: BRAND.textFaint }}>
              engine: <span style={{ color: "rgba(255,255,255,0.75)" }}>{report.engine_key}</span>{" "}
              • v{report.version}
            </div>
          }
        >
          {sections.length ? (
            <KBSections sections={sections} />
          ) : (
            <div
              className="rounded-2xl p-4 text-sm"
              style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}`, color: BRAND.textDim }}
            >
              No KB sections were returned. This usually means the KB doesn’t contain fallback blocks for one or more
              section keys.
            </div>
          )}
          <div className="pt-4 text-xs" style={{ color: BRAND.textFaint }}>
            powered by <span style={{ color: "rgba(255,255,255,0.75)" }}>profiletest.ai</span>
          </div>
        </GlassCard>
      </div>
    </Shell>
  );
}