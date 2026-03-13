// apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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

type LinkMeta = {
  show_results?: boolean;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  next_steps_url?: string | null;
  email_report?: boolean;
};

type ReportBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  transition?: string;
};

type ReportSection = {
  key: string;
  title?: string;
  blocks?: ReportBlock[];
};

type ApiReport = {
  token: string;
  tid?: string | null;
  sid?: string | null;
  submission_id: string;
  engine_key: string;
  version: number;
  audience: string;
  meta: {
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string | null;
    generated_at?: string;
    link_meta?: LinkMeta;
  };
  signals: {
    tier?: Tier;
    level?: number;
    style?: AB;
    readiness?: Readiness;
    pillar_scores?: Record<string, number>;
    pillar_band?: Record<string, string>;
    weakest_pillar?: string | null;
    strongest_pillar?: string | null;
    pattern_tags?: string[];
  };
  graphs: {
    tier_counts?: Record<string, number>;
    personality_points?: Record<string, number>;
    ladder?: { tier?: Tier; level?: number };
    pillars?: Record<string, number>;
    pillar_band?: Record<string, string>;
  };
  sections: ReportSection[];
};

type ApiResponse = { ok: boolean; data?: ApiReport; error?: string };

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
  const j = (await r.json()) as any;
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j as ApiResponse;
}

/* ---------------- Brand palette ---------------- */

const BRAND = {
  navy0: "#050914",
  textDim: "rgba(255,255,255,0.72)",
  textFaint: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.12)",

  teal: "#38E1C6",
  blue: "#4FB3FF",
  purple: "#7C3AED",

  tier: {
    Invisible: "#64748B",
    Emerging: "#4FB3FF",
    Established: "#38E1C6",
    Magnetic: "#7C3AED",
  } as Record<Tier, string>,

  ab: {
    A: "#38E1C6",
    B: "#4FB3FF",
    C: "#F59E0B",
    D: "#EF4444",
  } as Record<AB, string>,
};

// Add this near the top of VisibilityReportClient.tsx (below BRAND is fine)
function defaultTitles(key: string) {
  const m: Record<string, string> = {
    framework_foundation: "Framework foundation",
    snapshot: "Your visibility snapshot",
    pillars: "Your visibility pillars",
    level_meaning: "What your current level means",
    strengths: "What is already working",
    friction: "Where visibility friction exists",
    market_experience: "How the market is likely experiencing your business",
    opportunity: "Your strategic visibility opportunity",
    next_move: "Your most effective next move",
    possible_next: "What becomes possible next",
    closing: "Turning insight into strategy",
  };
  return m[key] || key;
}
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
          background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
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

/* ---------------- Visuals ---------------- */

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

  return (
    <div className="mt-6">
      <div className="text-xs" style={{ color: BRAND.textFaint }}>
        Pyramid view (tier emphasis)
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="w-full max-w-[520px] space-y-2">
          {tiers.map((t, idx) => {
            const isActive = t === tier;
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

/* ---------------- Narrative renderer ---------------- */

function NarrativeSection({ title, blocks }: { title: string; blocks: ReportBlock[] }) {
  return (
    <GlassCard title={title}>
      <div className="mt-4 space-y-4">
        {blocks.map((b, idx) => (
          <div
            key={idx}
            className="rounded-2xl p-5"
            style={{
              background: "rgba(0,0,0,0.18)",
              border: `1px solid ${BRAND.border}`,
            }}
          >
            {b.title ? <div className="text-base font-semibold">{b.title}</div> : null}

            {b.short_summary ? (
              <div
                className="mt-3 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid rgba(255,255,255,0.10)`,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                <span style={{ color: BRAND.textFaint }}>In short:</span> {b.short_summary}
              </div>
            ) : null}

            {Array.isArray(b.paragraphs) && b.paragraphs.length ? (
              <div className="mt-4 space-y-3 text-sm leading-6" style={{ color: "rgba(255,255,255,0.85)" }}>
                {b.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : null}

            {b.transition ? (
              <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
                {b.transition}
              </div>
            ) : null}
          </div>
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
  tid: string;
  src?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ApiReport | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setReport(null);

        if (!tid) throw new Error("Missing tid");

        const url =
          `/api/public/visibility/${encodeURIComponent(token)}/report?` +
          `tid=${encodeURIComponent(tid)}` +
          (src ? `&src=${encodeURIComponent(src)}` : "");

        const j = await fetchJson(url);
        if (cancelled) return;

        if (!j.data) throw new Error("Missing report data");
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
  }, [token, tid, src]);

  const tierCountsData = useMemo(() => {
    const counts = report?.graphs?.tier_counts || {};
    return (["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]).map((t) => ({
      name: t,
      value: Number((counts as any)[t] ?? 0),
      color: BRAND.tier[t],
    }));
  }, [report]);

  const personalityData = useMemo(() => {
    const pts = report?.graphs?.personality_points || {};
    const order: AB[] = ["A", "B", "C", "D"];
    return order.map((k) => ({ name: k, value: Number((pts as any)[k] ?? 0), color: BRAND.ab[k] }));
  }, [report]);

  const radarData = useMemo(() => {
    const p = report?.graphs?.pillars || report?.signals?.pillar_scores || {};
    const d = (k: string) => Number((p as any)[k] ?? 0);

    const discoverability = d("discoverability");
    const trust = d("trust");
    const conversion = d("conversion");

    const hasAny = [discoverability, trust, conversion].some((n) => Number.isFinite(n) && n > 0);
    if (!hasAny) return null;

    return [
      { pillar: "Discoverability", score: Math.round(discoverability) },
      { pillar: "Trust", score: Math.round(trust) },
      { pillar: "Conversion", score: Math.round(conversion) },
    ];
  }, [report]);

  const tier = (report?.signals?.tier as Tier) || (report?.graphs?.ladder?.tier as Tier) || "Emerging";
  const level = Number(report?.signals?.level ?? report?.graphs?.ladder?.level ?? 0) || 0;
  const readiness = (report?.signals?.readiness as Readiness) || "stabilise";
  const style = (report?.signals?.style as AB) || "A";

  const orgName = report?.meta?.org_name || "MindCanvas";
  const testName = report?.meta?.test_name || "Visibility Ladder";

  const nextStepsUrl = report?.meta?.link_meta?.next_steps_url || null;

  async function downloadPdf() {
    if (!reportRef.current) return;

    // temporarily widen / remove fixed max widths issues while capturing
    const el = reportRef.current;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: BRAND.navy0,
      windowWidth: 1400,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // keep aspect ratio
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      // multi-page
      let remaining = imgHeight;
      while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
        remaining -= pageHeight;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageHeight;
        }
      }
    }

    pdf.save(`visibility-report-${tid}.pdf`);
  }

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
            <div>tid: {tid}</div>
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

  const sections = Array.isArray(report.sections) ? report.sections : [];
  const engineKey = report.engine_key || "visibility_v1";
  const version = report.version || 1;

  return (
    <Shell>
      <div className="mx-auto max-w-6xl p-6 space-y-6" ref={reportRef}>
        <GlassCard
          title="Your Visibility Ladder"
          subtitle={`${orgName} • ${testName}`}
          right={
            <div className="flex flex-col gap-3 items-end">
              <div className="flex gap-2">
                <button
                  onClick={downloadPdf}
                  className="px-4 py-2 rounded-xl font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    color: "#0B1220",
                    border: "1px solid rgba(255,255,255,0.20)",
                  }}
                >
                  Download PDF
                </button>

                {nextStepsUrl ? (
                  <a
                    href={nextStepsUrl}
                    className="px-4 py-2 rounded-xl font-semibold"
                    style={{
                      background: "rgba(255,255,255,0.10)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    Next Step
                  </a>
                ) : null}
              </div>

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
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard title="Your ladder position" subtitle="20 levels across 4 tiers. You’re highlighted at your level.">
            <LadderGrid level={level} />
            <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
              Bands: 1–5 Invisible • 6–10 Emerging • 11–15 Established • 16–20 Magnetic
            </div>
            <TierPyramid tier={tier} level={level} />
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
          <GlassCard title="Pillars overview" subtitle="Discoverability, Trust, and Conversion.">
            <div className="mt-4 h-[320px]">
              {radarData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
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
                  Pillar scores will appear here once computed.
                </div>
              )}
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

        <GlassCard
          title="Your personalised report"
          subtitle="This narrative is selected dynamically from the Visibility Ladder knowledge base."
          right={
            <div className="text-xs" style={{ color: BRAND.textFaint }}>
              engine: {engineKey} • v{version}
            </div>
          }
        >
          <div className="mt-6 space-y-6">
            {sections.map((s) => (
              <NarrativeSection
                key={s.key}
                title={s.title || defaultTitles(s.key)}
                blocks={Array.isArray(s.blocks) ? s.blocks : []}
              />
            ))}
          </div>
        </GlassCard>

        {/* AI placeholder (next phase) */}
        <GlassCard
          title="AI insights (coming next)"
          subtitle="We’ll use the knowledge base + your exact pillar signals to generate: risks, strengths, and a 7-day + 30-day action plan."
        >
          <div className="pt-2 text-xs" style={{ color: BRAND.textFaint }}>
            powered by <span style={{ color: "rgba(255,255,255,0.75)" }}>profiletest.ai</span>
          </div>
        </GlassCard>
      </div>
    </Shell>
  );
}