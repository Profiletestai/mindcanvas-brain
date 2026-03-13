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

type ReportMeta = {
  org_name?: string | null;
  org_logo_url?: string | null;
  test_name?: string | null;
  generated_at?: string | null;
};

type Signals = {
  tier?: Tier | null;
  level?: number | null;
  style?: AB | null;
  readiness?: Readiness | null;
  pillar_scores?: Record<string, number> | null; // discoverability/trust/conversion => %
  pillar_band?: Record<string, string> | null;
  weakest_pillar?: string | null;
  strongest_pillar?: string | null;
  pattern_tags?: string[] | null;
};

type Graphs = {
  tier_counts?: Record<string, number> | null;
  personality_points?: Record<string, number> | null;
  ladder?: { tier?: Tier | null; level?: number | null } | null;
  pillars?: Record<string, number> | null; // discoverability/trust/conversion => %
  pillar_band?: Record<string, string> | null;
};

type KBBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  callouts?: Array<{ title?: string; body?: string }>;
};

type KBSection = {
  key: string;
  title: string;
  blocks: KBBlock[];
};

type ApiVisibilityReportResponse = {
  ok: boolean;
  data?: {
    token?: string;
    tid?: string | null;
    sid?: string | null;
    submission_id?: string;
    engine_key?: string;
    version?: number;
    audience?: string;

    meta?: ReportMeta;
    signals?: Signals;
    graphs?: Graphs;
    sections?: KBSection[];
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

function readinessLabel(r?: Readiness | null) {
  return r === "ready_to_progress" ? "Ready to progress" : "Stabilise";
}

function tierBand(level: number): Tier {
  if (level <= 5) return "Invisible";
  if (level <= 10) return "Emerging";
  if (level <= 15) return "Established";
  return "Magnetic";
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
  amber: "#F59E0B",
  red: "#EF4444",

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

  pillar: {
    discoverability: "#4FB3FF",
    trust: "#38E1C6",
    conversion: "#7C3AED",
  } as Record<string, string>,
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
        {children}
      </div>
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        borderColor: "rgba(255,255,255,0.18)",
        background: "rgba(0,0,0,0.18)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 12px ${color}66` }}
      />
      {text}
    </span>
  );
}

/* ---------------- Visuals: Ladder + Pyramid ---------------- */

function LadderGrid({ level }: { level: number }) {
  const active = clamp(level, 1, 20);
  const steps = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div className="mt-5 grid grid-cols-10 gap-2">
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
              boxShadow: isActive ? `0 0 0 1px rgba(255,255,255,0.12), 0 0 18px ${bandColor}55` : "none",
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
                    <div className="h-3 w-3 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}66` }} />
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

/* ---------------- KB content rendering ---------------- */

function BlockRenderer({ b }: { b: KBBlock }) {
  return (
    <div className="space-y-3">
      {b.title ? <div className="text-base font-semibold">{b.title}</div> : null}

      {b.short_summary ? (
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
          {b.short_summary}
        </div>
      ) : null}

      {Array.isArray(b.paragraphs) && b.paragraphs.length > 0 ? (
        <div className="space-y-2">
          {b.paragraphs.filter(Boolean).map((p, idx) => (
            <p key={idx} className="text-sm leading-6" style={{ color: "rgba(255,255,255,0.80)" }}>
              {p}
            </p>
          ))}
        </div>
      ) : null}

      {Array.isArray(b.bullets) && b.bullets.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1">
          {b.bullets.filter(Boolean).map((x, idx) => (
            <li key={idx} className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>
              {x}
            </li>
          ))}
        </ul>
      ) : null}

      {Array.isArray(b.callouts) && b.callouts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {b.callouts.map((c, idx) => (
            <div
              key={idx}
              className="rounded-2xl border p-4"
              style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)" }}
            >
              {c?.title ? <div className="text-sm font-semibold">{c.title}</div> : null}
              {c?.body ? (
                <div className="mt-1 text-sm" style={{ color: BRAND.textDim }}>
                  {c.body}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionRenderer({ s }: { s: KBSection }) {
  return (
    <GlassCard title={s.title}>
      <div className="mt-4 space-y-6">
        {(s.blocks || []).map((b, idx) => (
          <BlockRenderer key={idx} b={b} />
        ))}
      </div>
    </GlassCard>
  );
}

/* ---------------- Main ---------------- */

export default function VisibilityReportClient({
  token,
  tid,
  src,
}: {
  token: string;
  tid?: string;
  src?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [report, setReport] = useState<ApiVisibilityReportResponse["data"] | null>(null);

  // ✅ Prefer sid if present
  const sid = useMemo(() => {
    if (typeof window === "undefined") return "";
    const p = new URLSearchParams(window.location.search);
    return (p.get("sid") || p.get("submission_id") || "").trim();
  }, []);

  const effectiveTid = (tid || "").trim();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setReport(null);

        if (!sid && !effectiveTid) {
          throw new Error("Missing sid or tid");
        }

        const qs = new URLSearchParams();
        if (sid) qs.set("sid", sid);
        else qs.set("tid", effectiveTid);

        if (src) qs.set("src", src);

        const url = `/api/public/visibility/${encodeURIComponent(token)}/report?${qs.toString()}`;

        const j: ApiVisibilityReportResponse = await fetchJson(url);
        if (cancelled) return;

        if (!j?.data) throw new Error("Missing report data");
        setReport(j.data);

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
  }, [token, effectiveTid, sid, src]);

  const meta = report?.meta || {};
  const signals = report?.signals || {};
  const graphs = report?.graphs || {};
  const sections = Array.isArray(report?.sections) ? report!.sections! : [];

  const orgName = meta?.org_name || "MindCanvas";
  const testName = meta?.test_name || "Visibility Ladder";

  const tier = (signals.tier || graphs.ladder?.tier || "Invisible") as Tier;
  const level = Number(signals.level ?? graphs.ladder?.level ?? 1);
  const readiness = (signals.readiness || "stabilise") as Readiness;
  const style = (signals.style || "A") as AB;

  const tierCountsData = useMemo(() => {
    const counts = graphs.tier_counts || {};
    return (["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]).map((t) => ({
      name: t,
      value: Number((counts as any)[t] ?? 0),
      color: BRAND.tier[t],
    }));
  }, [graphs.tier_counts]);

  const personalityData = useMemo(() => {
    const pts = graphs.personality_points || {};
    const order: AB[] = ["A", "B", "C", "D"];
    return order.map((k) => ({
      name: k,
      value: Number((pts as any)[k] ?? 0),
      color: BRAND.ab[k],
    }));
  }, [graphs.personality_points]);

  const pillarBarData = useMemo(() => {
    const p = graphs.pillars || signals.pillar_scores || {};
    const band = graphs.pillar_band || signals.pillar_band || {};
    const items = ["discoverability", "trust", "conversion"].map((k) => ({
      key: k,
      name: k === "discoverability" ? "Discoverability" : k === "trust" ? "Trust" : "Conversion",
      value: Number((p as any)[k] ?? 0),
      band: String((band as any)[k] ?? ""),
      color: BRAND.pillar[k],
    }));
    return items;
  }, [graphs.pillars, graphs.pillar_band, signals.pillar_scores, signals.pillar_band]);

  const radarData = useMemo(() => {
    // nice “shape” chart for pillars too
    if (!pillarBarData?.length) return null;
    return pillarBarData.map((x) => ({ pillar: x.name, score: Number(x.value ?? 0) }));
  }, [pillarBarData]);

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
            <div>tid: {effectiveTid || "—"}</div>
            <div>sid: {sid || "—"}</div>
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

  const strongest = safeText(signals.strongest_pillar);
  const weakest = safeText(signals.weakest_pillar);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <GlassCard
          title={`Visibility Ladder Report`}
          subtitle={`${orgName} • ${testName}`}
          right={
            <div
              className="rounded-2xl border p-4 min-w-[260px]"
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

              <div className="mt-3 flex flex-wrap gap-2">
                {strongest ? (
                  <Pill text={`Strongest: ${strongest}`} color={BRAND.pillar[strongest] || BRAND.teal} />
                ) : null}
                {weakest ? (
                  <Pill text={`Weakest: ${weakest}`} color={BRAND.pillar[weakest] || BRAND.blue} />
                ) : null}
              </div>
            </div>
          }
        >
          <div className="mt-2 text-white/85">
            <span className="font-semibold" style={{ color: tierColor }}>
              {tier}
            </span>{" "}
            • Level <span className="font-semibold">{level}</span> •{" "}
            <span className="font-semibold">{readinessLabel(readiness)}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: BRAND.textDim }}>
            {Array.isArray(signals.pattern_tags) && signals.pattern_tags.length ? (
              <>
                <span style={{ color: BRAND.textFaint }}>Patterns:</span>
                {signals.pattern_tags.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border px-3 py-1"
                    style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)" }}
                  >
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </>
            ) : (
              <span style={{ color: BRAND.textFaint }}>Patterns: none detected</span>
            )}
          </div>
        </GlassCard>

        {/* --- Visual dashboard area --- */}
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

          <GlassCard title="Signal distribution" subtitle="How your answers mapped into each tier (Q9–Q25).">
            <div className="mt-4 h-[320px]">
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
            title="Your visibility pillars"
            subtitle="These scores are computed from Q9–Q25 using your Supabase scoring rules."
          >
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pillarBarData} barCategoryGap={28} layout="vertical">
                  <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.70)" }}
                    stroke="rgba(255,255,255,0.12)"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "rgba(255,255,255,0.78)" }}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      background: "rgba(7,18,38,0.92)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14,
                      color: "white",
                    }}
                    formatter={(v: any, _name: any, props: any) => {
                      const band = props?.payload?.band ? ` • ${props.payload.band}` : "";
                      return [`${v}%${band}`, "Score"];
                    }}
                    labelFormatter={(l) => String(l)}
                  />
                  <Bar dataKey="value" radius={[14, 14, 14, 14]}>
                    {pillarBarData.map((d) => (
                      <Cell key={d.key} fill={d.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {pillarBarData.map((p) => (
                <Pill
                  key={p.key}
                  text={`${p.name}: ${p.value}%${p.band ? ` • ${p.band}` : ""}`}
                  color={p.color}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard title="Your execution style" subtitle="Based on Q1–Q8 weighting (personality points).">
            <div className="mt-4 h-[320px]">
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

        {/* --- KB-driven narrative report --- */}
        <div className="space-y-6">
          {sections.length ? (
            sections.map((s) => <SectionRenderer key={s.key} s={s} />)
          ) : (
            <GlassCard
              title="Your personalised report"
              subtitle="No knowledge-base sections were returned. This usually means there are no generic fallback blocks in the KB."
            >
              <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
                Ask an admin to add generic blocks with empty triggers for each section key.
              </div>
            </GlassCard>
          )}
        </div>

        <div className="pt-2 text-xs text-center" style={{ color: BRAND.textFaint }}>
          powered by <span style={{ color: "rgba(255,255,255,0.75)" }}>profiletest.ai</span>
        </div>
      </div>
    </Shell>
  );
}