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

type VisibilityTotals = {
  tier: Tier;
  level: number;
  readiness: Readiness;
  personality_type: AB;
  personality_points: Record<AB, number>;
  tier_counts: Record<Tier, number>;
};

type AiInsights = {
  executive_summary: string;
  what_this_means: string;
  strengths: string[];
  friction: string[];
  strategic_opportunity: string;
  plan_7_days: string[];
  plan_30_days: string[];
  closing_note: string;
};

type ReportSectionBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  transition?: string;
};

type ReportSection = {
  key: string;
  title?: string;
  blocks?: ReportSectionBlock[];
};

type ApiReport = {
  ok: boolean;
  data?: {
    token: string;
    tid: string | null;
    sid?: string | null;

    // ✅ add these (your API returns them)
    submission_id?: string | null;
    engine_key?: string | null;
    version?: number | null;
    audience?: string | null;

    meta?: {
      org_name?: string | null;
      org_logo_url?: string | null;
      test_name?: string | null;
      generated_at?: string | null;
      mode?: string;
    };
    graphs?: any;
    sections?: ReportSection[];

    ai?: AiInsights | null;
    ai_meta?: any;
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

/* ---------------- WhatsWhat Prime brand palette ---------------- */

const BRAND = {
  // WhatsWhat Prime
  navy0: "#061A3A",
  accent: "#0F6DFF",
  neutral: "#E6EDF5",
  white: "#FFFFFF",

  textDim: "rgba(255,255,255,0.74)",
  textFaint: "rgba(255,255,255,0.56)",
  border: "rgba(255,255,255,0.14)",

  tier: {
    Invisible: "rgba(230,237,245,0.55)",
    Emerging: "#0F6DFF",
    Established: "rgba(56,225,198,0.95)",
    Magnetic: "rgba(124,58,237,0.95)",
  } as Record<Tier, string>,

  ab: {
    A: "rgba(56,225,198,0.95)",
    B: "#4FB3FF",
    C: "#F59E0B",
    D: "#EF4444",
  } as Record<AB, string>,
};

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen text-white" style={{ background: BRAND.navy0 }}>
    <div className="pointer-events-none fixed inset-0">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1100px 520px at 16% 8%, rgba(15,109,255,0.20), transparent 60%)," +
            "radial-gradient(900px 480px at 86% 20%, rgba(230,237,245,0.10), transparent 55%)," +
            "radial-gradient(700px 520px at 50% 88%, rgba(15,109,255,0.12), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-22"
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
          "linear-gradient(135deg, rgba(15,109,255,0.28), rgba(255,255,255,0.08), rgba(255,255,255,0.05))",
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="rounded-[27px] p-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
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
              borderColor: isActive ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.12)",
              background: isActive
                ? `linear-gradient(180deg, ${bandColor}33, rgba(255,255,255,0.10))`
                : "rgba(255,255,255,0.04)",
              boxShadow: isActive ? `0 0 18px ${bandColor}55` : "none",
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
            const widthPct = 60 + idx * 12;
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

function SectionCard({ section }: { section: ReportSection }) {
  const title = safeText(section?.title || section?.key);

  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  if (!blocks.length) return null;

  return (
    <div className="rounded-[28px] p-[1px]" style={{ background: "linear-gradient(135deg, rgba(15,109,255,0.22), rgba(255,255,255,0.06))" }}>
      <div
        className="rounded-[27px] p-6"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
          border: `1px solid ${BRAND.border}`,
          backdropFilter: "blur(10px)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="text-xl font-semibold">{title}</div>

        <div className="mt-4 space-y-4">
          {blocks.map((b, idx) => {
            const bTitle = safeText(b?.title || "");
            const showBlockTitle = bTitle && bTitle.toLowerCase() !== title.toLowerCase(); // ✅ avoid double heading
            const short = safeText(b?.short_summary || "");
            const paras = Array.isArray(b?.paragraphs) ? b.paragraphs : [];
            const transition = safeText(b?.transition || "");

            return (
              <div key={idx} className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
                {showBlockTitle ? <div className="text-base font-semibold">{bTitle}</div> : null}

                {short ? (
                  <div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BRAND.border}` }}>
                    <span style={{ color: BRAND.textFaint }}>In short:</span>{" "}
                    <span style={{ color: "rgba(255,255,255,0.92)" }}>{short}</span>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.84)" }}>
                  {paras.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>

                {transition ? (
                  <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
                    {transition}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AiCard({ ai, aiMeta }: { ai: AiInsights; aiMeta?: any }) {
  return (
    <div className="rounded-[28px] p-[1px]" style={{ background: "linear-gradient(135deg, rgba(15,109,255,0.30), rgba(255,255,255,0.08))" }}>
      <div
        className="rounded-[27px] p-6"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          border: `1px solid ${BRAND.border}`,
          backdropFilter: "blur(10px)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">AI insights</div>
            <div className="mt-1 text-sm" style={{ color: BRAND.textDim }}>
              Tailored interpretation + a simple action plan (7 days + 30 days).
            </div>
          </div>
          <div className="text-xs" style={{ color: BRAND.textFaint }}>
            {aiMeta?.model ? `model: ${aiMeta.model}` : ""}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
            <div className="text-sm font-semibold">Executive summary</div>
            <div className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
              {ai.executive_summary}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
            <div className="text-sm font-semibold">What this means</div>
            <div className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
              {ai.what_this_means}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
              <div className="text-sm font-semibold">What’s working</div>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                {ai.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
              <div className="text-sm font-semibold">Where friction exists</div>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                {ai.friction.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
            <div className="text-sm font-semibold">Your strategic opportunity</div>
            <div className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
              {ai.strategic_opportunity}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
              <div className="text-sm font-semibold">7-day quick wins</div>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                {ai.plan_7_days.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
              <div className="text-sm font-semibold">30-day plan</div>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                {ai.plan_30_days.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}>
            <div className="text-sm font-semibold">Closing</div>
            <div className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
              {ai.closing_note}
            </div>
          </div>
        </div>

        <div className="pt-4 text-xs" style={{ color: BRAND.textFaint }}>
          powered by <span style={{ color: "rgba(255,255,255,0.78)" }}>profiletest.ai</span>
        </div>
      </div>
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
  tid: string;
  src?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [report, setReport] = useState<ApiReport["data"] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setReport(null);

        if (!tid) throw new Error("Missing tid");

        const url = `/api/public/visibility/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(tid)}${
          src ? `&src=${encodeURIComponent(src)}` : ""
        }`;

        const j: ApiReport = await fetchJson(url);
        if (cancelled) return;

        setReport(j.data || null);
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

  const graphs = report?.graphs || {};
  const meta = report?.meta || {};
  const sections = Array.isArray(report?.sections) ? report!.sections! : [];

  // The first cards come from graphs (existing v1 visuals)
  const tierCountsData = useMemo(() => {
    const counts = graphs?.tier_counts || {};
    return (["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]).map((t) => ({
      name: t,
      value: Number(counts[t] ?? 0),
      color: BRAND.tier[t],
    }));
  }, [graphs]);

  const personalityData = useMemo(() => {
    const pts = graphs?.personality_points || {};
    const order: AB[] = ["A", "B", "C", "D"];
    return order.map((k) => ({ name: k, value: Number(pts[k] ?? 0), color: BRAND.ab[k] }));
  }, [graphs]);

  const ladderTier = safeText(graphs?.ladder?.tier) as Tier;
  const ladderLevel = Number(graphs?.ladder?.level ?? 0);

  // we may not have readiness/style in graphs; derive from sections/signals later if you want.
  const stylePrimary = (() => {
    const pts = graphs?.personality_points || {};
    const order: AB[] = ["A", "B", "C", "D"];
    let best: AB = "A";
    let v = -1;
    for (const k of order) {
      const n = Number(pts[k] ?? 0);
      if (n > v) {
        v = n;
        best = k;
      }
    }
    return best;
  })();

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
          <div className="rounded-2xl p-4 text-xs" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BRAND.border}` }}>
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

  const orgName = meta?.org_name || "MindCanvas";
  const testName = meta?.test_name || "Visibility Ladder";

  const tierColor = BRAND.tier[ladderTier] || BRAND.accent;
  const styleColor = BRAND.ab[stylePrimary];

  return (
    <Shell>
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <GlassCard
          title="Your Visibility Ladder"
          subtitle={`${orgName} • ${testName}`}
          right={
            <div className="rounded-2xl border p-4 min-w-[240px]" style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)" }}>
              <div className="text-xs" style={{ color: BRAND.textFaint }}>
                At a glance
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div style={{ color: BRAND.textFaint }}>Tier</div>
                  <div className="font-semibold" style={{ color: tierColor }}>
                    {ladderTier || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ color: BRAND.textFaint }}>Level</div>
                  <div className="font-semibold">{ladderLevel || "—"}</div>
                </div>
                <div>
                  <div style={{ color: BRAND.textFaint }}>Readiness</div>
                  <div className="font-semibold">{/* you can wire readiness from API later */}—</div>
                </div>
                <div>
                  <div style={{ color: BRAND.textFaint }}>Style</div>
                  <div className="font-semibold" style={{ color: styleColor }}>
                    {stylePrimary}
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <div className="mt-2 text-white/85">
            <span className="font-semibold" style={{ color: tierColor }}>
              {ladderTier}
            </span>{" "}
            • Level <span className="font-semibold">{ladderLevel}</span>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard title="Your ladder position" subtitle="20 levels across 4 tiers. You’re highlighted at your level.">
            <LadderGrid level={ladderLevel} />
            <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
              Bands: 1–5 Invisible • 6–10 Emerging • 11–15 Established • 16–20 Magnetic
            </div>
            <TierPyramid tier={ladderTier} level={ladderLevel} />
          </GlassCard>

          <GlassCard title="Signal distribution" subtitle="How your answers across Q9–Q25 mapped into each tier.">
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierCountsData} barCategoryGap={22}>
                  <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.78)" }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.70)" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      background: "rgba(6,26,58,0.92)",
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
          <GlassCard title="Pillars overview" subtitle="Discoverability, Trust, and Conversion. (Polish later)">
            <div className="mt-4 h-[320px]">
              <div
                className="h-full rounded-2xl flex items-center justify-center text-sm"
                style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${BRAND.border}` }}
              >
                Pillar scores will appear here once enabled.
              </div>
            </div>
          </GlassCard>

          <GlassCard title="Your execution style" subtitle="Based on Q1–Q8 weighting.">
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={personalityData} barCategoryGap={24}>
                  <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.78)" }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.70)" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      background: "rgba(6,26,58,0.92)",
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
                {stylePrimary}
              </span>
            </div>
          </GlassCard>
        </div>

        {/* Narrative from KB */}
        <GlassCard
          title="Your personalised report"
          subtitle="This narrative is selected dynamically from the Visibility Ladder knowledge base."
          right={
            <div className="text-xs" style={{ color: BRAND.textFaint }}>
              engine: {report?.engine_key || "visibility_v1"} • v{report?.version || 1}
            </div>
          }
        >
          <div className="mt-5 space-y-6">
            {sections.map((s) => (
              <SectionCard key={s.key} section={s} />
            ))}
          </div>
        </GlassCard>

        {/* ✅ Seamless AI (no button) */}
        {report.ai ? (
          <AiCard ai={report.ai} aiMeta={report.ai_meta} />
        ) : (
          <GlassCard
            title="AI insights"
            subtitle={
              report.ai_meta?.enabled === false
                ? "AI is disabled for this environment."
                : report.ai_meta?.error
                ? `AI could not be generated yet: ${safeText(report.ai_meta.error)}`
                : "AI insights are generating/caching. Refresh this page in a moment."
            }
          >
            <div className="pt-2 text-xs" style={{ color: BRAND.textFaint }}>
              powered by <span style={{ color: "rgba(255,255,255,0.78)" }}>profiletest.ai</span>
            </div>
          </GlassCard>
        )}
      </div>
    </Shell>
  );
}