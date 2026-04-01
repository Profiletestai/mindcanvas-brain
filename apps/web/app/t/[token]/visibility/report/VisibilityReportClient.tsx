// apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
// apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Cell,
} from "recharts";

// lazy-load heavy libs for PDF export
const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

type Signals = {
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

type Graphs = {
  tier_counts?: Record<string, number>;
  personality_points?: Record<string, number>;
  ladder?: { tier?: Tier; level?: number };
  pillars?: Record<string, number>;
  pillar_band?: Record<string, string>;
};

type ContentBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  transition?: string;
};

type Section = {
  key: string;
  title?: string;
  blocks?: ContentBlock[];
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

type VisibilityKbReport = {
  token: string;
  tid: string | null;
  sid?: string | null;
  submission_id?: string | null;
  engine_key?: string;
  version?: number;
  audience?: string;

  meta?: {
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string | null;
    generated_at?: string | null;
    mode?: "deterministic" | "ai" | string;
    ai_error?: string;
  };

  signals?: Signals;
  graphs?: Graphs;
  sections?: Section[];

  ai?: AiInsights | null;
  ai_meta?: any;
};

type VisibilityKbApiResponse = {
  ok: boolean;
  data?: VisibilityKbReport;
  error?: string;
  __meta?: any;
};

type PortalReportResponse = {
  ok: boolean;
  data?: {
    org_slug?: string;
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string;
    taker?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    };
    link?: {
      next_steps_url?: string | null;
      show_results?: boolean | null;
      redirect_url?: string | null;
      hidden_results_message?: string | null;
      email_report?: boolean | null;
      meta?: any;
    };
    totals?: any;
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

function safeString(x: any): string {
  return typeof x === "string" ? x.trim() : "";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function readinessLabel(r?: Readiness) {
  if (r === "ready_to_progress") return "Ready to progress";
  if (r === "stabilise") return "Stabilise";
  return "—";
}

function fullName(taker?: any) {
  const n = [taker?.first_name, taker?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return n || "Your";
}

function tierBand(level: number): Tier {
  if (level <= 5) return "Invisible";
  if (level <= 10) return "Emerging";
  if (level <= 15) return "Established";
  return "Magnetic";
}

function formatDate(d?: string | null) {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function fetchJson<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = (await r.text()).slice(0, 600);
    throw new Error(`HTTP ${r.status} – non-JSON response:\n${text}`);
  }
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j as T;
}

/* ---------------- Brand palette (WhatsWhats Prime) ---------------- */
const BRAND = {
  bg: "#061A3A",
  accent: "#0F6DFF",
  textDim: "rgba(255,255,255,0.75)",
  textFaint: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.14)",

  tier: {
    Invisible: "#94A3B8",
    Emerging: "#0F6DFF",
    Established: "#38E1C6",
    Magnetic: "#7C3AED",
  } as Record<Tier, string>,

  ab: {
    A: "#38E1C6",
    B: "#4FB3FF",
    C: "#F59E0B",
    D: "#EF4444",
  } as Record<AB, string>,

  pillars: {
    discoverability: "#0F6DFF",
    trust: "#38E1C6",
    conversion: "#F59E0B",
  } as Record<string, string>,
};

/* ---------------- UI atoms ---------------- */

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
    <div className="pointer-events-none fixed inset-0">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(1100px 520px at 12% 10%, rgba(15,109,255,0.22), transparent 60%)," +
            "radial-gradient(900px 480px at 86% 20%, rgba(56,225,198,0.14), transparent 55%)," +
            "radial-gradient(700px 520px at 50% 88%, rgba(124,58,237,0.12), transparent 60%)",
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
          "linear-gradient(135deg, rgba(15,109,255,0.26), rgba(56,225,198,0.12), rgba(255,255,255,0.06))",
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
              {subtitle ? (
                <div className="mt-1 text-sm" style={{ color: BRAND.textDim }}>
                  {subtitle}
                </div>
              ) : null}
            </div>
            {right}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition " +
    (disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-95");
  const style = {
    background: BRAND.accent,
    color: "white",
    boxShadow: "0 10px 30px rgba(15,109,255,0.30)",
  } as any;

  if (href) {
    return (
      <a
        className={cls}
        style={style}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <button className={cls} style={style} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition border " +
    (disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-white/5");
  const style = {
    borderColor: "rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
  } as any;

  if (href) {
    return (
      <a
        className={cls}
        style={style}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <button className={cls} style={style} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/* ---------------- Visuals ---------------- */

function LadderGrid({ level }: { level: number }) {
  const active = clamp(level, 1, 20);
  const steps = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div className="mt-4 grid grid-cols-10 gap-2">
      {steps.map((s) => {
        const isActive = s === active;
        const band = tierBand(s);
        const bandColor = BRAND.tier[band];
        return (
          <div
            key={s}
            className="h-9 rounded-xl border text-[11px] flex items-center justify-center select-none"
            style={{
              borderColor: isActive
                ? "rgba(255,255,255,0.30)"
                : "rgba(255,255,255,0.12)",
              background: isActive
                ? `linear-gradient(180deg, ${bandColor}33, rgba(255,255,255,0.10))`
                : "rgba(255,255,255,0.04)",
              boxShadow: isActive ? `0 0 22px ${bandColor}66` : "none",
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

// ✅ Magnetic at TOP -> Established -> Emerging -> Invisible at bottom
function TierPyramid({ tier, level }: { tier: Tier; level: number }) {
  const tiersTopDown: Tier[] = [
    "Magnetic",
    "Established",
    "Emerging",
    "Invisible",
  ];

  return (
    <div className="mt-5">
      <div className="text-xs" style={{ color: BRAND.textFaint }}>
        Pyramid view shows tier ordering at a glance (Magnetic at top →
        Invisible at bottom).
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="w-full max-w-[560px] space-y-2">
          {tiersTopDown.map((t, idx) => {
            const isActive = t === tier;
            const c = BRAND.tier[t];

            const widthPct = 60 + idx * 12;

            return (
              <div key={t} className="flex items-center justify-center">
                <div
                  className="h-12 rounded-2xl border flex items-center justify-between px-4"
                  style={{
                    width: `${widthPct}%`,
                    borderColor: isActive
                      ? "rgba(255,255,255,0.28)"
                      : "rgba(255,255,255,0.12)",
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
                    {isActive ? `Level ${level}` : ""}
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

function derivePillarsFromTierCounts(tierCounts: Record<string, number>) {
  const inv = Number(tierCounts?.Invisible ?? 0);
  const em = Number(tierCounts?.Emerging ?? 0);
  const est = Number(tierCounts?.Established ?? 0);
  const mag = Number(tierCounts?.Magnetic ?? 0);
  const total = inv + em + est + mag;
  if (!total) return null;

  const discoverability = ((total - inv) / total) * 100;
  const trust = ((est + mag) / total) * 100;
  const conversion = (mag / total) * 100;

  return {
    discoverability: Math.round(discoverability),
    trust: Math.round(trust),
    conversion: Math.round(conversion),
  };
}

function PillarsBars({
  pillars,
  weakest,
  strongest,
}: {
  pillars: Record<string, number>;
  weakest?: string | null;
  strongest?: string | null;
}) {
  const items = [
    { key: "discoverability", label: "Discoverability" },
    { key: "trust", label: "Trust" },
    { key: "conversion", label: "Conversion" },
  ].map((p) => ({
    ...p,
    value: Number((pillars as any)?.[p.key] ?? 0),
    color: BRAND.pillars[p.key] || BRAND.accent,
    tag: p.key === strongest ? "Strongest" : p.key === weakest ? "Weakest" : "",
  }));

  const hasAny = items.some((x) => Number.isFinite(x.value) && x.value > 0);

  if (!hasAny) {
    return (
      <div
        className="h-[240px] rounded-2xl flex items-center justify-center text-sm"
        style={{
          background: "rgba(0,0,0,0.18)",
          border: `1px solid ${BRAND.border}`,
        }}
      >
        Pillar scores will appear here once enabled.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="text-sm" style={{ color: BRAND.textDim }}>
        The pillar percentages are a{" "}
        <span className="font-semibold">signal reading</span> of your answers.
        Higher % = stronger and more consistent signals. Lower % = where
        friction is most likely limiting momentum.
      </div>

      {items.map((it) => {
        const pct = clamp(Math.round(it.value), 0, 100);
        return (
          <div key={it.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {it.label}
                {it.tag ? (
                  <span
                    className="ml-2 text-[11px] px-2 py-0.5 rounded-full border"
                    style={{
                      borderColor: "rgba(255,255,255,0.18)",
                      color: "rgba(255,255,255,0.80)",
                      background: "rgba(0,0,0,0.18)",
                    }}
                  >
                    {it.tag}
                  </span>
                ) : null}
              </div>
              <div className="text-sm" style={{ color: BRAND.textDim }}>
                {pct}%
              </div>
            </div>

            <div
              className="h-3 rounded-full overflow-hidden border"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${it.color}, rgba(255,255,255,0.18))`,
                  boxShadow: `0 0 18px ${it.color}55`,
                }}
              />
            </div>

            <div className="text-xs" style={{ color: BRAND.textFaint }}>
              {it.key === "discoverability"
                ? "Can the market reliably find you?"
                : it.key === "trust"
                  ? "Does it feel safe and credible to choose you?"
                  : "Is it easy to take action right now?"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Narrative rendering ---------------- */

function SectionBlocks({ section }: { section: Section }) {
  const title = safeString(section?.title) || safeString(section?.key);
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];

  return (
    <div className="mt-4 space-y-5">
      {blocks.map((b, idx) => {
        const bt = safeString(b?.title);
        const showBlockTitle = bt && bt.toLowerCase() !== title.toLowerCase();
        const short = safeString(b?.short_summary);
        const ps = Array.isArray(b?.paragraphs) ? b.paragraphs : [];
        const transition = safeString(b?.transition);

        return (
          <div
            key={idx}
            className="rounded-2xl p-5 border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.14)",
            }}
          >
            {showBlockTitle ? (
              <div className="text-base font-semibold">{bt}</div>
            ) : null}

            {short ? (
              <div
                className="mt-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <span style={{ color: BRAND.textFaint }}>In short:</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.88)" }}>{short}</span>
              </div>
            ) : null}

            <div
              className="mt-4 space-y-3 text-sm leading-6"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {ps.map((p, i) => (
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
  );
}

function InsightsCard({
  ai,
  error,
}: {
  ai: AiInsights | null | undefined;
  error?: string | null;
}) {
  return (
    <GlassCard title="Insights" subtitle="">
      {error ? (
        <div
          className="mt-2 text-sm"
          style={{ color: "rgba(248,113,113,0.95)" }}
        >
          Insights generation failed: {error}
        </div>
      ) : ai ? (
        <div className="mt-4 space-y-4">
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.14)",
            }}
          >
            <div className="text-sm font-semibold">Executive summary</div>
            <div
              className="mt-2 text-sm leading-6"
              style={{ color: "rgba(255,255,255,0.86)" }}
            >
              {ai.executive_summary}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.14)",
            }}
          >
            <div className="text-sm font-semibold">What this means</div>
            <div
              className="mt-2 text-sm leading-6"
              style={{ color: "rgba(255,255,255,0.86)" }}
            >
              {ai.what_this_means}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.14)",
              }}
            >
              <div className="text-sm font-semibold">Strengths</div>
              <ul
                className="mt-2 list-disc pl-5 text-sm space-y-1"
                style={{ color: "rgba(255,255,255,0.86)" }}
              >
                {ai.strengths?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.14)",
              }}
            >
              <div className="text-sm font-semibold">Friction</div>
              <ul
                className="mt-2 list-disc pl-5 text-sm space-y-1"
                style={{ color: "rgba(255,255,255,0.86)" }}
              >
                {ai.friction?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.14)",
            }}
          >
            <div className="text-sm font-semibold">Strategic opportunity</div>
            <div
              className="mt-2 text-sm leading-6"
              style={{ color: "rgba(255,255,255,0.86)" }}
            >
              {ai.strategic_opportunity}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.14)",
              }}
            >
              <div className="text-sm font-semibold">7-day plan</div>
              <ol
                className="mt-2 list-decimal pl-5 text-sm space-y-1"
                style={{ color: "rgba(255,255,255,0.86)" }}
              >
                {ai.plan_7_days?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.14)",
              }}
            >
              <div className="text-sm font-semibold">30-day plan</div>
              <ol
                className="mt-2 list-decimal pl-5 text-sm space-y-1"
                style={{ color: "rgba(255,255,255,0.86)" }}
              >
                {ai.plan_30_days?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
          Insights are not available yet.
        </div>
      )}
    </GlassCard>
  );
}

/* ---------------- Charts used inside sections ---------------- */

function TierCountsChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <div className="mt-4 h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={22}>
          <CartesianGrid
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="4 6"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.78)" }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.70)" }}
            allowDecimals={false}
          />
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
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PersonalityChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <div className="mt-4 h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={24}>
          <CartesianGrid
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="4 6"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.78)" }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.70)" }}
            allowDecimals={false}
          />
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
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
  const reportRootRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [portalMeta, setPortalMeta] =
    useState<PortalReportResponse["data"] | null>(null);
  const [kbReport, setKbReport] = useState<VisibilityKbReport | null>(null);

  const orgName =
    portalMeta?.org_name || kbReport?.meta?.org_name || "Organisation";
  const orgLogoUrl =
    portalMeta?.org_logo_url || kbReport?.meta?.org_logo_url || null;
  const testName =
    portalMeta?.test_name || kbReport?.meta?.test_name || "Visibility Ladder";
  const takerName = fullName(portalMeta?.taker);

  const nextStepsUrl = safeString(portalMeta?.link?.next_steps_url);

  const tier: Tier | null = (kbReport?.signals?.tier as Tier) || null;
  const level: number = Number(kbReport?.signals?.level ?? 0);
  const style: AB | null = (kbReport?.signals?.style as AB) || null;
  const readiness = kbReport?.signals?.readiness as Readiness | undefined;

  const tierColor = tier ? BRAND.tier[tier] : "rgba(255,255,255,0.85)";
  const styleColor = style ? BRAND.ab[style] : "rgba(255,255,255,0.85)";

  const reportDate = formatDate(kbReport?.meta?.generated_at);

  const tierCountsData = useMemo(() => {
    const counts = kbReport?.graphs?.tier_counts || {};
    return (
      ["Invisible", "Emerging", "Established", "Magnetic"] as Tier[]
    ).map((t) => ({
      name: t,
      value: Number((counts as any)[t] ?? 0),
      color: BRAND.tier[t],
    }));
  }, [kbReport?.graphs]);

  const personalityData = useMemo(() => {
    const pts = kbReport?.graphs?.personality_points || {};
    const order: AB[] = ["A", "B", "C", "D"];
    return order.map((k) => ({
      name: k,
      value: Number((pts as any)[k] ?? 0),
      color: BRAND.ab[k],
    }));
  }, [kbReport?.graphs]);

  const pillars = useMemo(() => {
    const apiPillars = (kbReport?.graphs?.pillars || {}) as Record<
      string,
      number
    >;
    const hasApi =
      apiPillars &&
      typeof apiPillars === "object" &&
      Object.keys(apiPillars).length > 0;
    if (hasApi) return apiPillars;

    const tc = (kbReport?.graphs?.tier_counts || {}) as Record<string, number>;
    return derivePillarsFromTierCounts(tc) || {};
  }, [kbReport?.graphs]);

  const weakest = kbReport?.signals?.weakest_pillar ?? null;
  const strongest = kbReport?.signals?.strongest_pillar ?? null;

  const sections = Array.isArray(kbReport?.sections) ? kbReport.sections : [];
  const sectionByKey = useMemo(() => {
    const m = new Map<string, Section>();
    sections.forEach((s) => m.set(s.key, s));
    return m;
  }, [sections]);

  const introKeys = [
    "welcome",
    "how_to_use",
    "understanding",
    "tiers_levels",
    "behaviour_profiles",
  ];
  const introSections = introKeys
    .map((k) => sectionByKey.get(k))
    .filter(Boolean) as Section[];
  const missingIntroKeys = introKeys.filter((k) => !sectionByKey.get(k));

  const secSnapshot = sectionByKey.get("snapshot") || null;
  const secPillars = sectionByKey.get("pillars") || null;
  const secLevelMeaning = sectionByKey.get("level_meaning") || null;

  const ai = kbReport?.ai ?? null;
  const aiError = safeString(kbReport?.meta?.ai_error);

  async function downloadPdf() {
    try {
      const node = reportRootRef.current;
      if (!node) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all(
        [html2canvasPromise(), jsPdfPromise()]
      );

      const canvas = await html2canvas(node, {
        backgroundColor: BRAND.bg,
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new JsPDF("p", "pt", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let y = 0;
      let remaining = imgHeight;

      while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
        remaining -= pageHeight;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageHeight;
        }
      }

      const safeName = `${safeString(takerName) || "Visibility"}-Visibility-Ladder.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );
      pdf.save(safeName);
    } catch (e: any) {
      console.error("[visibility] pdf export failed", e);
      alert("Sorry — PDF export failed. Check console for details.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!token || !tid) {
          throw new Error("Missing token or tid (required for report load).");
        }

        const portalUrl = `/api/public/test/${encodeURIComponent(
          token
        )}/report?tid=${encodeURIComponent(tid)}${
          src ? `&src=${encodeURIComponent(src)}` : ""
        }`;

        const portalRes = await fetchJson<PortalReportResponse>(portalUrl);
        if (cancelled) return;
        setPortalMeta(portalRes?.data ?? null);

        const kbUrl = `/api/public/visibility/${encodeURIComponent(
          token
        )}/report?tid=${encodeURIComponent(tid)}&audience=taker_report`;
        const kbRes = await fetchJson<VisibilityKbApiResponse>(kbUrl);
        if (cancelled) return;
        setKbReport(kbRes?.data ?? null);

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

  if (err || !kbReport) {
    return (
      <Shell>
        <div className="mx-auto max-w-6xl p-6 space-y-4">
          <div className="text-2xl font-semibold">
            Couldn’t load Visibility report
          </div>
          <p
            className="text-sm"
            style={{ color: "rgba(248,113,113,0.95)" }}
          >
            {safeText(err || "Unknown error")}
          </p>
          <div
            className="rounded-2xl p-4 text-xs"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${BRAND.border}`,
            }}
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

  const renderedKeys = new Set<string>();
  introKeys.forEach((k) => renderedKeys.add(k));
  renderedKeys.add("snapshot");
  renderedKeys.add("pillars");
  renderedKeys.add("level_meaning");

  const remainingSections = sections.filter((s) => !renderedKeys.has(s.key));

  return (
    <Shell>
      <div ref={reportRootRef} className="mx-auto max-w-6xl p-6 space-y-6">
        {/* ✅ HEADER (DO NOT CHANGE) */}
        <GlassCard
          title=""
          subtitle=""
          right={
            <div className="flex flex-col gap-3 items-end">
              <div className="flex flex-wrap gap-2 justify-end">
                <SecondaryButton onClick={downloadPdf}>
                  Download PDF
                </SecondaryButton>
                {nextStepsUrl ? (
                  <PrimaryButton href={nextStepsUrl}>Next steps</PrimaryButton>
                ) : null}
              </div>

              <div
                className="rounded-2xl border p-4 min-w-[260px]"
                style={{
                  borderColor: BRAND.border,
                  background: "rgba(0,0,0,0.18)",
                }}
              >
                <div className="text-xs" style={{ color: BRAND.textFaint }}>
                  Scores
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: BRAND.textFaint }}>Tier</div>
                    <div className="font-semibold" style={{ color: tierColor }}>
                      {tier || "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: BRAND.textFaint }}>Level</div>
                    <div className="font-semibold">
                      {Number.isFinite(level) && level > 0 ? level : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: BRAND.textFaint }}>Readiness</div>
                    <div className="font-semibold">
                      {readinessLabel(readiness)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: BRAND.textFaint }}>Style</div>
                    <div className="font-semibold" style={{ color: styleColor }}>
                      {style || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <div className="flex items-start gap-4">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt={orgName}
                className="h-12 w-12 rounded-2xl object-cover"
                style={{ border: `1px solid ${BRAND.border}` }}
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="h-12 w-12 rounded-2xl"
                style={{
                  border: `1px solid ${BRAND.border}`,
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            )}

            <div className="flex-1">
              <div className="text-xl font-semibold">{orgName}</div>
              <div className="text-sm mt-0.5" style={{ color: BRAND.textDim }}>
                {testName}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div style={{ color: BRAND.textDim }}>
                  Prepared for:{" "}
                  <span className="font-semibold text-white">{takerName}</span>
                </div>
                <div style={{ color: BRAND.textDim }}>
                  Date:{" "}
                  <span className="font-semibold text-white">
                    {reportDate || formatDate(null)}
                  </span>
                </div>
                <div style={{ color: BRAND.textDim }}>
                  Framework created by:{" "}
                  <span className="font-semibold text-white">Bogdan Stan</span>
                </div>
              </div>

              <div className="mt-4 text-white/85">
                <span className="font-semibold" style={{ color: tierColor }}>
                  {tier || "—"}
                </span>{" "}
                {level ? (
                  <>
                    • Level <span className="font-semibold">{level}</span>
                  </>
                ) : null}{" "}
                {readiness ? (
                  <>
                    •{" "}
                    <span className="font-semibold">
                      {readinessLabel(readiness)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Intro sections (KB-driven) */}
        <GlassCard title="Intro sections">
          {introSections.length ? (
            <div className="mt-2 space-y-6">
              {introSections.map((s) => (
                <div key={s.key}>
                  <div className="text-base font-semibold">
                    {s.title || s.key}
                  </div>
                  <SectionBlocks section={s} />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="mt-3 rounded-2xl border p-4 text-sm"
              style={{
                borderColor: BRAND.border,
                background: "rgba(0,0,0,0.18)",
                color: BRAND.textDim,
              }}
            >
              Intro sections (pending). Once inserted into{" "}
              <code>visibility.kb_blocks</code>, they will render here
              automatically.
              <div className="mt-2 text-xs" style={{ color: BRAND.textFaint }}>
                Missing KB section keys (expected):{" "}
                <span className="font-semibold">
                  {missingIntroKeys.join(", ") || "none"}
                </span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Insights (AI) */}
        <InsightsCard ai={ai} error={aiError || null} />

        {/* ✅ Your visibility snapshot: add BOTH charts here */}
        {secSnapshot ? (
          <GlassCard
            title={secSnapshot.title || "Your visibility snapshot"}
            subtitle="These graphs show how your answers mapped across tiers and behaviour style."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: BRAND.border,
                  background: "rgba(0,0,0,0.14)",
                }}
              >
                <div className="text-sm font-semibold">Signal distribution</div>
                <div className="text-xs mt-1" style={{ color: BRAND.textFaint }}>
                  How your answers mapped across tiers — influences your dominant
                  tier and stability level.
                </div>
                <TierCountsChart data={tierCountsData} />
              </div>

              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: BRAND.border,
                  background: "rgba(0,0,0,0.14)",
                }}
              >
                <div className="text-sm font-semibold">
                  Your behaviour style (from Q1–Q8)
                </div>
                <div className="text-xs mt-1" style={{ color: BRAND.textFaint }}>
                  How you naturally approach visibility and growth — helps you
                  pick strategies you can sustain.
                </div>
                <PersonalityChart data={personalityData} />
                <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
                  Primary style:{" "}
                  <span
                    className="font-semibold"
                    style={{ color: styleColor }}
                  >
                    {style || "—"}
                  </span>
                </div>
              </div>
            </div>

            <SectionBlocks section={secSnapshot} />
          </GlassCard>
        ) : null}

        {/* ✅ Your visibility pillars: put the pillars bars ABOVE the written content */}
        {secPillars ? (
          <GlassCard
            title={secPillars.title || "Your visibility pillars"}
            subtitle="Discoverability, Trust, and Conversion shape how the market responds to you."
          >
            <PillarsBars
              pillars={pillars}
              weakest={weakest}
              strongest={strongest}
            />
            <SectionBlocks section={secPillars} />
          </GlassCard>
        ) : null}

        {/* ✅ What your current level means: include Ladder Position graph ABOVE the content */}
        {secLevelMeaning ? (
          <GlassCard
            title={secLevelMeaning.title || "What your current level means"}
            subtitle="Your ladder position shows your current level and tier band."
          >
            <div
              className="rounded-2xl border p-5 mt-3"
              style={{
                borderColor: BRAND.border,
                background: "rgba(0,0,0,0.14)",
              }}
            >
              <div className="text-sm font-semibold">Your ladder position</div>
              <div className="text-xs mt-1" style={{ color: BRAND.textFaint }}>
                The highlighted number is your current level. Levels 1–5
                Invisible, 6–10 Emerging, 11–15 Established, 16–20 Magnetic.
              </div>

              <LadderGrid level={level || 1} />
              <TierPyramid
                tier={tier || tierBand(level || 1)}
                level={level || 1}
              />
            </div>

            <SectionBlocks section={secLevelMeaning} />
          </GlassCard>
        ) : null}

        {/* Remaining dynamic content */}
        <GlassCard title="Your personalised report">
          {remainingSections.length ? (
            <div className="mt-4 space-y-6">
              {remainingSections.map((s) => (
                <GlassCard key={s.key} title={s.title || s.key} subtitle="">
                  <SectionBlocks section={s} />
                </GlassCard>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm" style={{ color: BRAND.textDim }}>
              No additional narrative sections were returned yet.
            </div>
          )}
          <div className="mt-4 text-xs" style={{ color: BRAND.textFaint }}>
            engine: {safeString(kbReport.engine_key || "visibility_v1")} • v
            {kbReport.version ?? 1}
          </div>
        </GlassCard>
      </div>
    </Shell>
  );
}