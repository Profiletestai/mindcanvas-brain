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

/** API (KB-driven) shape */
type ReportBlock = {
  title?: string | null;
  short_summary?: string | null;
  paragraphs?: string[] | null;
  transition?: string | null;
};

type ReportSection = {
  key: string;
  title?: string | null;
  blocks?: ReportBlock[] | null;
};

type ApiKbReportResponse = {
  ok: boolean;
  data?: {
    token?: string;
    tid?: string | null;
    sid?: string | null;
    submission_id?: string | null;
    engine_key?: string | null;
    version?: number | null;
    audience?: string | null;
    meta?: {
      org_name?: string | null;
      org_logo_url?: string | null;
      test_name?: string | null;
      generated_at?: string | null;
    };
    signals?: any;
    graphs?: {
      tier_counts?: Record<string, number>;
      personality_points?: Record<string, number>;
      ladder?: { tier?: Tier; level?: number };
      pillars?: Record<string, number>;
      pillar_band?: Record<string, string>;
    };
    sections?: ReportSection[];
    link?: {
      next_steps_url?: string | null;
      show_results?: boolean | null;
      redirect_url?: string | null;
      hidden_results_message?: string | null;
      email_report?: boolean | null;
      meta?: any;
    };
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

function readinessLabel(r: Readiness | string) {
  return r === "ready_to_progress" ? "Ready to progress" : "Stabilise";
}

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

/* ---------------- WhatsWhats Prime brand palette ---------------- */

const BRAND = {
  // WhatsWhats Prime colours (from you)
  bg: "#061A3A",
  accent: "#0F6DFF",
  light: "#E6EDF5",
  white: "#FFFFFF",

  // supporting tones
  textDim: "rgba(255,255,255,0.74)",
  textFaint: "rgba(255,255,255,0.56)",
  border: "rgba(255,255,255,0.14)",

  // data colors (keep tasteful, but still “wow”)
  teal: "#38E1C6",
  purple: "#7C3AED",
  slate: "#64748B",

  tier: {
    Invisible: "#64748B",
    Emerging: "#0F6DFF",
    Established: "#38E1C6",
    Magnetic: "#7C3AED",
  } as Record<Tier, string>,

  ab: {
    A: "#38E1C6",
    B: "#0F6DFF",
    C: "#F59E0B",
    D: "#EF4444",
  } as Record<AB, string>,
};

/* ---------------- UI atoms ---------------- */

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
    {/* gradient + subtle grid */}
    <div className="pointer-events-none fixed inset-0">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(1100px 520px at 14% 10%, rgba(15,109,255,0.22), transparent 60%)," +
            "radial-gradient(900px 520px at 86% 20%, rgba(56,225,198,0.16), transparent 60%)," +
            "radial-gradient(900px 520px at 50% 92%, rgba(124,58,237,0.12), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-22"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
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
          "linear-gradient(135deg, rgba(15,109,255,0.24), rgba(56,225,198,0.12), rgba(255,255,255,0.06))",
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

function Pill({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border px-3 py-1.5 text-sm"
      style={{
        borderColor: BRAND.border,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition";
  const style: any = {
    background: BRAND.accent,
    color: BRAND.white,
    boxShadow: "0 10px 30px rgba(15,109,255,0.28)",
  };

  if (href) {
    return (
      <a className={cls} style={style} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button className={cls} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition";
  const style: any = {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${BRAND.border}`,
    color: "rgba(255,255,255,0.92)",
  };

  if (href) {
    return (
      <a className={cls} style={style} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button className={cls} style={style} onClick={onClick}>
      {children}
    </button>
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
              borderColor: isActive ? "rgba(255,255,255,0.30)" : BRAND.border,
              background: isActive
                ? `linear-gradient(180deg, ${bandColor}44, rgba(255,255,255,0.10))`
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
            const widthPct = 60 + idx * 12; // 60,72,84,96
            return (
              <div key={t} className="flex items-center justify-center">
                <div
                  className="h-12 rounded-2xl border flex items-center justify-between px-4"
                  style={{
                    width: `${widthPct}%`,
                    borderColor: isActive ? "rgba(255,255,255,0.30)" : BRAND.border,
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

/* ---------------- Narrative renderer (NO double headings) ---------------- */

function NarrativeSection({
  section,
}: {
  section: ReportSection;
}) {
  const title = (section?.title || defaultTitles(section.key)).trim();
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];

  return (
    <GlassCard title={title} subtitle={undefined}>
      <div className="mt-4 space-y-4">
        {blocks.length === 0 ? (
          <div
            className="rounded-2xl border p-4 text-sm"
            style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)", color: BRAND.textDim }}
          >
            No content blocks were selected for this section yet.
          </div>
        ) : (
          blocks.map((b, idx) => {
            const bTitle = (b?.title || "").trim();
            const showBlockTitle =
              blocks.length > 1 && bTitle && bTitle.toLowerCase() !== title.toLowerCase();

            const paragraphs = Array.isArray(b?.paragraphs) ? b.paragraphs.filter(Boolean) : [];
            const short = (b?.short_summary || "").trim();
            const transition = (b?.transition || "").trim();

            return (
              <div
                key={`${section.key}_${idx}`}
                className="rounded-2xl border p-4"
                style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)" }}
              >
                {showBlockTitle ? (
                  <div className="text-sm font-semibold">{bTitle}</div>
                ) : null}

                {short ? (
                  <div
                    className="mt-2 rounded-xl border px-4 py-2 text-sm"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ color: BRAND.textFaint }}>In short:</span>{" "}
                    <span style={{ color: "rgba(255,255,255,0.92)" }}>{short}</span>
                  </div>
                ) : null}

                {paragraphs.length ? (
                  <div className="mt-3 space-y-3 text-sm leading-6" style={{ color: "rgba(255,255,255,0.86)" }}>
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : null}

                {transition ? (
                  <div className="mt-3 text-xs" style={{ color: BRAND.textFaint }}>
                    {transition}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
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
  const [report, setReport] = useState<ApiKbReportResponse["data"] | null>(null);

  // AI state (placeholder wiring)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setReport(null);

        if (!tid) throw new Error("Missing tid");

        // ✅ This endpoint is the KB-driven report endpoint you’re using now
        const url =
          `/api/public/visibility/${encodeURIComponent(token)}/report?` +
          `tid=${encodeURIComponent(tid)}` +
          (src ? `&src=${encodeURIComponent(src)}` : "");

        const j: ApiKbReportResponse = await fetchJson(url);
        if (cancelled) return;

        if (!j?.data) throw new Error("Missing report payload.");
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
    return order.map((k) => ({
      name: k,
      value: Number((pts as any)[k] ?? 0),
      color: BRAND.ab[k],
    }));
  }, [report]);

  // NOTE: Pillars chart currently depends on computed pillar_scores. You said it’s “polish later”.
  const radarData = useMemo(() => {
    const p = report?.graphs?.pillars || {};
    const d = Number((p as any).discoverability ?? 0);
    const t = Number((p as any).trust ?? 0);
    const c = Number((p as any).conversion ?? 0);
    const total = d + t + c;
    if (!total) return null;
    return [
      { pillar: "Discoverability", score: d },
      { pillar: "Trust", score: t },
      { pillar: "Conversion", score: c },
    ];
  }, [report]);

  const orgName = report?.meta?.org_name || "WhatsWhats Global";
  const testName = report?.meta?.test_name || "Visibility Ladder";

  const level = Number(report?.graphs?.ladder?.level ?? 0);
  const tier = (report?.graphs?.ladder?.tier as Tier) || tierBand(level || 1);

  const readiness = (report?.signals?.readiness as Readiness) || "stabilise";
  const style = (report?.signals?.style as AB) || "A";

  const tierColor = BRAND.tier[tier];
  const styleColor = BRAND.ab[style];

  const nextStepsUrl =
    (report as any)?.link?.next_steps_url ||
    (report as any)?.link_meta?.next_steps_url ||
    null;

  // Download PDF: you said it works already — keep it simple and non-breaking.
  // This triggers the browser print dialog (which most users can “Save as PDF”).
  // If you already implemented a proper PDF pipeline, just swap this handler.
  const onDownloadPdf = () => {
    try {
      window.print();
    } catch {}
  };

  // AI layer: visible to client now, real composer endpoint later
  const runAi = async () => {
    try {
      setAiLoading(true);
      setAiError(null);
      setAiText(null);

      // Placeholder endpoint name (we’ll implement next)
      // Uses sid if available; otherwise uses tid.
      const sid = safeText(report?.submission_id || report?.sid || "");
      const url =
        `/api/public/visibility/${encodeURIComponent(token)}/ai-compose?` +
        (sid ? `sid=${encodeURIComponent(sid)}` : `tid=${encodeURIComponent(tid)}`);

      const j: any = await fetchJson(url);
      const text = safeText(j?.data?.text || j?.text || "");
      if (!text) throw new Error("AI returned no text.");
      setAiText(text);
    } catch (e: any) {
      setAiError(String(e?.message || e));
    } finally {
      setAiLoading(false);
    }
  };

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

  const sections = Array.isArray(report?.sections) ? report.sections : [];

  return (
    <Shell>
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <GlassCard
          title="Your Visibility Ladder"
          subtitle={`${orgName} • ${testName}`}
          right={
            <div className="flex flex-col gap-3 items-end">
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
                    <div className="font-semibold">{level || "—"}</div>
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

              <div className="flex gap-2 flex-wrap justify-end">
                <GhostButton onClick={onDownloadPdf}>Download PDF</GhostButton>
                {nextStepsUrl ? (
                  <PrimaryButton href={nextStepsUrl}>Next step</PrimaryButton>
                ) : (
                  <PrimaryButton href="#" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
                    Next step
                  </PrimaryButton>
                )}
              </div>
            </div>
          }
        >
          <div className="mt-2 text-white/85">
            <span className="font-semibold" style={{ color: tierColor }}>
              {tier}
            </span>{" "}
            • Level <span className="font-semibold">{level || "—"}</span> •{" "}
            <span className="font-semibold">{readinessLabel(readiness)}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Pill>
              Engine:{" "}
              <span style={{ color: "rgba(255,255,255,0.9)" }}>
                {safeText(report?.engine_key || "visibility_v1")}
              </span>
            </Pill>
            <Pill>
              Version:{" "}
              <span style={{ color: "rgba(255,255,255,0.9)" }}>
                {safeText(report?.version ?? 1)}
              </span>
            </Pill>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard title="Your ladder position" subtitle="20 levels across 4 tiers. You’re highlighted at your level.">
            <LadderGrid level={level || 1} />
            <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
              Bands: 1–5 Invisible • 6–10 Emerging • 11–15 Established • 16–20 Magnetic
            </div>
            <TierPyramid tier={tier} level={level || 1} />
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
                      background: "rgba(6,26,58,0.94)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14,
                      color: "white",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                  />
                  <Bar dataKey="value" radius={[14, 14, 6, 6]}>
                    {tierCountsData.map((d) => (
                      <Cell key={d.name} fill={d.color} fillOpacity={0.92} />
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
                    <Radar dataKey="score" stroke={BRAND.accent} fill={BRAND.accent} fillOpacity={0.18} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(6,26,58,0.94)",
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
                      background: "rgba(6,26,58,0.94)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14,
                      color: "white",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                  />
                  <Bar dataKey="value" radius={[14, 14, 6, 6]}>
                    {personalityData.map((d) => (
                      <Cell key={d.name} fill={d.color} fillOpacity={0.92} />
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

        {/* KB Narrative (Option C style) */}
        <GlassCard
          title="Your personalised report"
          subtitle="This narrative is selected dynamically from the Visibility Ladder knowledge base."
          right={
            <div className="text-xs" style={{ color: BRAND.textFaint }}>
              engine: {safeText(report?.engine_key || "visibility_v1")} • v{safeText(report?.version ?? 1)}
            </div>
          }
        >
          <div className="mt-5 space-y-5">
            {sections.map((s) => (
              <NarrativeSection key={s.key} section={s} />
            ))}
          </div>
        </GlassCard>

        {/* AI layer placeholder (client-facing) */}
        <GlassCard
          title="AI insights"
          subtitle="Client-facing layer: we’ll generate a tailored interpretation + a simple action plan (7 days + 30 days)."
        >
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <PrimaryButton onClick={runAi}>{aiLoading ? "Generating…" : "Generate AI insights"}</PrimaryButton>
            <div className="text-xs" style={{ color: BRAND.textFaint }}>
              (We’ll wire this to the AI composer endpoint next.)
            </div>
          </div>

          {aiError ? (
            <div className="mt-3 text-sm" style={{ color: "rgba(248,113,113,0.95)" }}>
              {aiError}
            </div>
          ) : null}

          {aiText ? (
            <div
              className="mt-4 rounded-2xl border p-4 text-sm leading-6"
              style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.86)" }}
            >
              {aiText.split("\n").map((line, idx) => (
                <p key={idx} className={idx === 0 ? "" : "mt-3"}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm" style={{ color: BRAND.textDim }}>
              When enabled, this section will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Summarise your tier/level in plain language</li>
                <li>Interpret pillar patterns (strengths + friction)</li>
                <li>Provide one strategic opportunity</li>
                <li>Give a 7-day “quick wins” plan + 30-day stabilise/progress plan</li>
              </ul>
            </div>
          )}

          <div className="pt-4 text-xs" style={{ color: BRAND.textFaint }}>
            powered by <span style={{ color: "rgba(255,255,255,0.78)" }}>profiletest.ai</span>
          </div>
        </GlassCard>
      </div>
    </Shell>
  );
}