//apps/web/app/t/[token]/visibility/report/VisibilityLiteReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import VisibilityReportHeader from "@/components/visibility/report/VisibilityReportHeader";
import VisibilityVideoSection from "@/components/visibility/report/VisibilityVideoSection";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

type Signals = {
  tier?: Tier;
  level?: number;
  style?: string;
  readiness?: Readiness;
  pillar_scores?: Record<string, number>;
  pillar_band?: Record<string, string>;
  pillar_bands?: Record<string, string>;
  weakest_pillar?: string | null;
  strongest_pillar?: string | null;
  pattern_tags?: string[];
  overall_pct?: number | null;
};

type Graphs = {
  tier_counts?: Record<string, number>;
  personality_points?: Record<string, number> | null;
  ladder?: { tier?: Tier; level?: number };
  pillars?: Record<string, number>;
  pillar_band?: Record<string, string>;
  pillar_bands?: Record<string, string>;
  pillar_model?: string;
};

type ContentBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
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
    scoring_mode?: string;
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
  };
  error?: string;
};

type PillarItem = {
  key: string;
  label: string;
  value: number;
  band: string;
  color: string;
};

const BRAND = {
  bg: "#061A3A",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.08)",
  text: "rgba(255,255,255,0.94)",
  textDim: "rgba(255,255,255,0.76)",
  textFaint: "rgba(255,255,255,0.56)",
  white: "#F8FAFC",
  blue: "#4F7DFF",
  teal: "#45E0D1",
  purple: "#8B5CF6",
  amber: "#F3B95C",
  tier: {
    Invisible: "#A7B3C7",
    Emerging: "#4F7DFF",
    Established: "#32D7C8",
    Magnetic: "#8B5CF6",
  } as Record<Tier, string>,
};

const SHORT_VIDEO_URL =
  "https://xciojwhnamsspmxpipzn.supabase.co/storage/v1/object/public/report-videos/Visibility%20Ladder%20Short.mp4";

const SHORT_VIDEO_POSTER_URL = "";

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

function safeString(x: any): string {
  return typeof x === "string" ? x.trim() : "";
}

function safeNumber(x: any, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fullName(taker?: any): string {
  const n = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim();
  return n || "Your";
}

function readinessLabel(r?: Readiness): string {
  if (r === "ready_to_progress") return "Ready to progress";
  if (r === "stabilise") return "Stabilise";
  return "—";
}

function formatDate(d?: string | null): string {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tierBand(level: number): Tier {
  if (level <= 5) return "Invisible";
  if (level <= 10) return "Emerging";
  if (level <= 15) return "Established";
  return "Magnetic";
}

function getPillarColor(key: string): string {
  const k = key.toLowerCase();
  if (k === "visibility" || k === "discoverability") return BRAND.blue;
  if (k === "trust" || k === "credibility") return BRAND.teal;
  if (k === "authority" || k === "conversion") return BRAND.amber;
  if (k === "dominance" || k === "influence") return BRAND.purple;
  return BRAND.blue;
}

function getPillarLabel(key: string): string {
  const k = key.toLowerCase();
  if (k === "visibility") return "Visibility";
  if (k === "discoverability") return "Discoverability";
  if (k === "trust") return "Trust";
  if (k === "credibility") return "Credibility";
  if (k === "authority") return "Authority";
  if (k === "conversion") return "Conversion";
  if (k === "dominance") return "Dominance";
  if (k === "influence") return "Influence";
  return key;
}

function bandFromValue(value: number): string {
  if (value >= 75) return "Strong";
  if (value >= 50) return "Developing";
  return "Weak";
}

function buildPillars(raw: Record<string, number> | undefined | null): PillarItem[] {
  const source = raw || {};
  const keys = Object.keys(source).map((k) => k.toLowerCase());
  const isPrime =
    keys.includes("visibility") || keys.includes("authority") || keys.includes("dominance");

  const order = isPrime
    ? ["visibility", "trust", "authority", "dominance"]
    : ["discoverability", "trust", "conversion"];

  return order.map((key) => {
    const value = clamp(safeNumber((source as any)?.[key]), 0, 100);
    return {
      key,
      label: getPillarLabel(key),
      value,
      band: bandFromValue(value),
      color: getPillarColor(key),
    };
  });
}

function sectionSummary(section?: Section | null): string {
  if (!section) return "";
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) {
    const short = safeString(block.short_summary);
    if (short) return short;
    const para = (Array.isArray(block.paragraphs) ? block.paragraphs : [])
      .map((p) => safeString(p))
      .find(Boolean);
    if (para) return para;
  }
  return "";
}

function sectionBullets(section?: Section | null): string[] {
  if (!section) return [];
  const out: string[] = [];
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) {
    const bullets = Array.isArray(block.bullets) ? block.bullets : [];
    for (const b of bullets) {
      const s = safeString(b);
      if (s) out.push(s);
    }
  }
  return out;
}

function firstItems(arr: string[], count: number): string[] {
  return arr.filter(Boolean).slice(0, count);
}

function buildTierCounts(raw: Record<string, number> | undefined | null, dominantTier: Tier) {
  const source = raw || {};
  const out: Record<Tier, number> = {
    Invisible: safeNumber((source as any)?.Invisible, 0),
    Emerging: safeNumber((source as any)?.Emerging, 0),
    Established: safeNumber((source as any)?.Established, 0),
    Magnetic: safeNumber((source as any)?.Magnetic, 0),
  };

  const total = out.Invisible + out.Emerging + out.Established + out.Magnetic;
  if (total > 0) return out;

  return {
    Invisible: dominantTier === "Invisible" ? 5 : 1,
    Emerging: dominantTier === "Emerging" ? 5 : 1,
    Established: dominantTier === "Established" ? 5 : 1,
    Magnetic: dominantTier === "Magnetic" ? 5 : 1,
  };
}

function realityForTier(tier: Tier) {
  switch (tier) {
    case "Invisible":
      return {
        intro:
          "Your business is beginning to appear, but the market still experiences inconsistency and uncertainty.",
        marketCan: [
          "Occasionally notice your presence",
          "See early signs of value",
          "Begin recognising your offer",
        ],
        caution: [
          "You are not yet easy to find",
          "Trust is not yet automatic",
          "Interest can stall before action",
        ],
      };
    case "Emerging":
      return {
        intro:
          "Your business is visible and gaining notice, but it is not yet the obvious choice in the market.",
        marketCan: [
          "Find you more consistently",
          "Understand your offer more clearly",
          "See growing signs of credibility",
        ],
        caution: [
          "You may still be compared against alternatives",
          "Trust is not yet fully settled",
          "Momentum can slow before conversion",
        ],
      };
    case "Established":
      return {
        intro:
          "Your business is recognised and trusted enough to create stronger confidence, but there is still room to deepen authority.",
        marketCan: ["Find you", "Understand what you do", "Recognise your value"],
        caution: [
          "You are not always the obvious choice",
          "Trust may still require reassurance",
          "Growth can flatten without stronger authority cues",
        ],
      };
    case "Magnetic":
    default:
      return {
        intro:
          "Your business carries strong market pull. Visibility, trust, and authority are working together at a high level.",
        marketCan: [
          "Recognise you quickly",
          "Trust your position with confidence",
          "Move toward action with less persuasion",
        ],
        caution: [
          "Consistency still needs protecting",
          "Strong reputation must be sustained",
          "Leadership signals need to remain visible",
        ],
      };
  }
}

function pillarInterpretation(pillar: PillarItem): string {
  if (pillar.band === "Strong") {
    return `${pillar.label} is strong — this signal is helping the market respond to you with greater confidence and consistency.`;
  }
  if (pillar.band === "Developing") {
    return `${pillar.label} is developing — this signal is present, but it still needs strengthening to become more reliable.`;
  }
  return `${pillar.label} is weak — this is currently one of the areas most likely to create hesitation or friction in the market response.`;
}

function OuterCard({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-[24px] border ${className}`}
      style={{
        borderColor: BRAND.border,
        background: "linear-gradient(180deg, rgba(27,60,99,0.78), rgba(12,32,58,0.84))",
        boxShadow: "0 14px 42px rgba(0,0,0,0.32)",
      }}
    >
      {children}
    </div>
  );
}

function InnerPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border ${className}`}
      style={{
        borderColor: BRAND.borderSoft,
        background: "linear-gradient(180deg, rgba(35,62,97,0.72), rgba(18,38,64,0.78))",
      }}
    >
      {children}
    </div>
  );
}

function ReportPage({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      data-pdf-page="true"
      className="block w-full"
      style={{ pageBreakAfter: "always" }}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function TopButton({
  children,
  onClick,
  href,
  variant = "dark",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "dark" | "gradient";
}) {
  const className =
    "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-[13px] font-semibold";
  const style =
    variant === "gradient"
      ? ({
          background: "linear-gradient(90deg, #45E0D1 0%, #4F7DFF 50%, #8B5CF6 100%)",
          color: "#071C36",
        } as const)
      : ({
          background: "rgba(8,22,43,0.72)",
          color: BRAND.white,
          border: `1px solid ${BRAND.border}`,
        } as const);

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={className} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 520px at 12% 12%, rgba(79,125,255,0.22), transparent 58%)," +
              "radial-gradient(860px 460px at 86% 18%, rgba(69,224,209,0.12), transparent 56%)," +
              "radial-gradient(720px 520px at 50% 92%, rgba(139,92,246,0.10), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function LadderSidebar({
  tier,
  level,
  nextStepsUrl,
  onDownload,
}: {
  tier: Tier;
  level: number;
  nextStepsUrl?: string;
  onDownload: () => void;
}) {
  const levels = Array.from({ length: 20 }, (_, i) => 20 - i);
  const groups: Array<{
    tier: Tier;
    startRow: number;
    span: number;
  }> = [
    { tier: "Magnetic", startRow: 1, span: 5 },
    { tier: "Established", startRow: 6, span: 5 },
    { tier: "Emerging", startRow: 11, span: 5 },
    { tier: "Invisible", startRow: 16, span: 5 },
  ];

  return (
    <div className="space-y-3">
      <OuterCard className="p-3.5">
        <div
          className="text-[10px] uppercase tracking-[0.24em]"
          style={{ color: BRAND.textFaint }}
        >
          Ladder Position
        </div>

        <div className="mt-3 grid grid-cols-[38px_minmax(0,1fr)] gap-2.5">
          <div
            className="grid"
            style={{
              gridTemplateRows: "repeat(20, 28px)",
              rowGap: "6px",
            }}
          >
            {groups.map((g) => (
              <div
                key={g.tier}
                className="relative flex items-center justify-center overflow-hidden rounded-[12px]"
                style={{
                  gridRow: `${g.startRow} / span ${g.span}`,
                  background: `${BRAND.tier[g.tier]}20`,
                  border: `1px solid ${BRAND.border}`,
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[5px] rounded-r-full"
                  style={{ background: BRAND.tier[g.tier] }}
                />
                <div
                  className="rotate-[-90deg] whitespace-nowrap text-[10px] font-semibold"
                  style={{ color: BRAND.tier[g.tier] }}
                >
                  {g.tier}
                </div>
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateRows: "repeat(20, 28px)",
              rowGap: "6px",
            }}
          >
            {levels.map((n) => {
              const active = n === level;
              const band = tierBand(n);
              const bandColor = BRAND.tier[band];

              return (
                <div
                  key={n}
                  className="relative rounded-[10px] border flex items-center justify-center text-[12px]"
                  style={{
                    borderColor: active ? bandColor : "rgba(255,255,255,0.10)",
                    background: active
                      ? `linear-gradient(90deg, ${bandColor}cc, rgba(255,255,255,0.14))`
                      : "rgba(7,22,43,0.34)",
                    color: "rgba(255,255,255,0.92)",
                    boxShadow: active ? `0 0 18px ${bandColor}44` : "none",
                  }}
                >
                  {n}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-[4px] rounded-r-[10px]"
                    style={{ background: bandColor }}
                  />
                  {active ? (
                    <div
                      className="absolute -right-2.5 h-5 w-5 rounded-full"
                      style={{
                        background: bandColor,
                        opacity: 0.86,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-y-1.5 text-[12px]">
          <div>Magnetic</div>
          <div className="text-right" style={{ color: BRAND.textDim }}>
            16–20
          </div>
          <div>Established</div>
          <div className="text-right" style={{ color: BRAND.textDim }}>
            11–15
          </div>
          <div>Emerging</div>
          <div className="text-right" style={{ color: BRAND.textDim }}>
            6–10
          </div>
          <div>Invisible</div>
          <div className="text-right" style={{ color: BRAND.textDim }}>
            1–5
          </div>
        </div>
      </OuterCard>

      <OuterCard className="p-3.5">
        <div className="space-y-2">
          <TopButton onClick={onDownload}>Download PDF</TopButton>
          {nextStepsUrl ? (
            <TopButton href={nextStepsUrl} variant="gradient">
              Next steps
            </TopButton>
          ) : null}
        </div>
      </OuterCard>
    </div>
  );
}

function LitePositionCard({
  tier,
  level,
  readiness,
  intro,
  marketCan,
  caution,
}: {
  tier: Tier;
  level: number;
  readiness?: Readiness;
  intro: string;
  marketCan: string[];
  caution: string[];
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="text-[16px] md:text-[18px] font-semibold">
        You are currently positioned at:{" "}
        <span style={{ color: BRAND.tier[tier] }}>Level {level}</span>{" "}
        <span style={{ color: BRAND.textDim }}>{tier} Tier</span>
      </div>

      <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
        {intro}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <InnerPanel className="px-4 py-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Status
          </div>
          <div className="mt-1.5 text-[14px] font-semibold">
            {readinessLabel(readiness)}
          </div>
        </InnerPanel>

        <InnerPanel className="px-4 py-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Tier range
          </div>
          <div className="mt-1.5 text-[14px] font-semibold">
            {tier === "Invisible"
              ? "1–5"
              : tier === "Emerging"
              ? "6–10"
              : tier === "Established"
              ? "11–15"
              : "16–20"}
          </div>
        </InnerPanel>
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">What this means in reality</div>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <div className="text-[12px] font-semibold" style={{ color: BRAND.textDim }}>
              The market can:
            </div>
            <ul className="mt-2 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
              {marketCan.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span style={{ color: BRAND.teal }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[12px] font-semibold" style={{ color: BRAND.textDim }}>
              But when it matters:
            </div>
            <ul className="mt-2 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
              {caution.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span style={{ color: "#FF7A7A" }}>×</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

function DistributionChart({
  tierCounts,
}: {
  tierCounts: Record<Tier, number>;
}) {
  const items: Array<{ key: Tier; value: number; color: string }> = [
    { key: "Invisible", value: tierCounts.Invisible, color: BRAND.tier.Invisible },
    { key: "Emerging", value: tierCounts.Emerging, color: BRAND.tier.Emerging },
    { key: "Established", value: tierCounts.Established, color: BRAND.tier.Established },
    { key: "Magnetic", value: tierCounts.Magnetic, color: BRAND.tier.Magnetic },
  ];

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <OuterCard className="p-4">
      <div className="text-[15px] font-semibold">Signal distribution</div>
      <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
        These graphs show how your answers map across ladder tiers.
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="flex h-[220px] items-end justify-between gap-4">
          {items.map((item) => {
            const h = Math.max(12, Math.round((item.value / max) * 150));
            return (
              <div key={item.key} className="flex flex-1 flex-col items-center gap-3">
                <div className="text-[12px] font-medium">{item.value}</div>
                <div
                  className="w-full max-w-[74px] rounded-[12px]"
                  style={{
                    height: `${h}px`,
                    background: `linear-gradient(180deg, ${item.color}, ${item.color}cc)`,
                    boxShadow: `0 0 20px ${item.color}33`,
                  }}
                />
                <div className="text-center text-[11px]" style={{ color: BRAND.textDim }}>
                  {item.key}
                </div>
              </div>
            );
          })}
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

function SnapshotSummaryCard({
  tier,
  level,
  summary,
}: {
  tier: Tier;
  level: number;
  summary: string;
}) {
  return (
    <OuterCard className="p-4 h-full">
      <div className="text-[15px] font-semibold">Your visibility snapshot</div>
      <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
        A concise summary of where you currently stand.
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[13px] leading-7" style={{ color: BRAND.text }}>
          <span className="font-semibold" style={{ color: BRAND.tier[tier] }}>
            Level {level} — {tier}
          </span>
          {" · "}
          {summary}
        </div>
      </InnerPanel>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[13px] font-semibold">What this tells you</div>
        <div className="mt-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          This snapshot highlights your current market position and the major signal pattern shaping how prospects interpret your business.
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

function PillarSnapshot({
  pillars,
}: {
  pillars: PillarItem[];
}) {
  return (
    <OuterCard className="p-4">
      <div className="text-[15px] font-semibold">Your visibility pillars</div>
      <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
        A quick reading of the key signals shaping market response.
      </div>

      <div className="mt-4 space-y-4">
        {pillars.map((pillar) => (
          <InnerPanel key={pillar.key} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[13px] font-semibold">{pillar.label}</div>
              <div className="text-[12px]" style={{ color: BRAND.textDim }}>
                {pillar.value}%
              </div>
            </div>

            <div
              className="mt-2 h-2.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pillar.value}%`,
                  background: `linear-gradient(90deg, ${pillar.color}, rgba(255,255,255,0.28))`,
                }}
              />
            </div>

            <div className="mt-3 text-[12px] leading-6" style={{ color: BRAND.text }}>
              {pillarInterpretation(pillar)}
            </div>
          </InnerPanel>
        ))}
      </div>
    </OuterCard>
  );
}

function InsightsSnapshot({
  ai,
  strengths,
  friction,
  opportunity,
  nextStepsUrl,
}: {
  ai?: AiInsights | null;
  strengths: string[];
  friction: string[];
  opportunity: string;
  nextStepsUrl?: string;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="text-[15px] font-semibold">Insights</div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">Executive summary</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.executive_summary ||
            "This results snapshot gives a concise view of your current position and the signals shaping market response."}
        </div>
      </InnerPanel>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">What this means</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.what_this_means || opportunity}
        </div>
      </InnerPanel>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Strengths</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {strengths.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </InnerPanel>

        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Friction</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {friction.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </InnerPanel>
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">Strategic opportunity</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.strategic_opportunity || opportunity}
        </div>
      </InnerPanel>

      <OuterCard className="mt-4 p-4">
        <div className="text-[16px] font-semibold">Want the full Visibility Ladder report?</div>
        <div className="mt-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          The full report includes deeper strategic interpretation, broader coaching insights, and a more complete diagnostic view of your market position.
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {nextStepsUrl ? (
            <TopButton href={nextStepsUrl} variant="gradient">
              Unlock next step
            </TopButton>
          ) : null}
        </div>
      </OuterCard>
    </OuterCard>
  );
}

export default function VisibilityLiteReportClient({
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
  const [portalMeta, setPortalMeta] = useState<PortalReportResponse["data"] | null>(null);
  const [kbReport, setKbReport] = useState<VisibilityKbReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!token || !tid) throw new Error("Missing token or tid.");

        const portalUrl = `/api/public/test/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
          tid
        )}${src ? `&src=${encodeURIComponent(src)}` : ""}`;
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

  const orgLogoUrl = portalMeta?.org_logo_url || kbReport?.meta?.org_logo_url || null;
  const takerName = fullName(portalMeta?.taker);
  const reportDate = formatDate(kbReport?.meta?.generated_at);
  const nextStepsUrl = safeString(portalMeta?.link?.next_steps_url);

  const tier = ((kbReport?.signals?.tier as Tier) || "Invisible") as Tier;
  const level = clamp(safeNumber(kbReport?.signals?.level, 1), 1, 20);
  const readiness = kbReport?.signals?.readiness;

  const pillars = buildPillars(kbReport?.graphs?.pillars || kbReport?.signals?.pillar_scores);
  const tierCounts = buildTierCounts(kbReport?.graphs?.tier_counts, tier);

  const sectionMap = useMemo(() => {
    const map = new Map<string, Section>();
    const sections = Array.isArray(kbReport?.sections) ? kbReport?.sections : [];
    for (const section of sections) map.set(section.key, section);
    return map;
  }, [kbReport?.sections]);

  const secMarketExperience = sectionMap.get("market_experience") || null;
  const secOpportunity = sectionMap.get("opportunity") || null;
  const secStrengths = sectionMap.get("strengths") || null;
  const secFriction = sectionMap.get("friction") || null;
  const secSnapshot = sectionMap.get("snapshot") || null;

  const reality = realityForTier(tier);
  const snapshotSummary =
    sectionSummary(secSnapshot) ||
    sectionSummary(secMarketExperience) ||
    reality.intro;

  const strengths = firstItems(
    (kbReport?.ai?.strengths?.length ? kbReport.ai.strengths : []).concat(
      firstItems(sectionBullets(secStrengths), 3)
    ),
    3
  );

  const friction = firstItems(
    (kbReport?.ai?.friction?.length ? kbReport.ai.friction : []).concat(
      firstItems(sectionBullets(secFriction), 3)
    ),
    3
  );

  const opportunity =
    kbReport?.ai?.strategic_opportunity ||
    sectionSummary(secOpportunity) ||
    "Strengthen the most important weak signal so your market response becomes more consistent and predictable.";

  async function downloadPdf() {
    try {
      const root = reportRootRef.current;
      if (!root) return;

      const pageNodes = Array.from(
        root.querySelectorAll("[data-pdf-page='true']")
      ) as HTMLDivElement[];

      if (!pageNodes.length) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

      const pdf = new JsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      for (let i = 0; i < pageNodes.length; i += 1) {
        const pageNode = pageNodes[i];
        const canvas = await html2canvas(pageNode, {
          backgroundColor: BRAND.bg,
          scale: 2,
          useCORS: true,
          windowWidth: pageNode.scrollWidth,
          windowHeight: pageNode.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }

      const safeName = `${safeString(takerName) || "Visibility"}-Results-Snapshot.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );
      pdf.save(safeName);
    } catch (e) {
      console.error("[visibility-lite] pdf export failed", e);
      alert("PDF export failed.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
        <div className="mx-auto max-w-[1560px] px-4 py-5">
          <div className="text-2xl font-semibold">Loading your snapshot…</div>
          <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
            Preparing your Results Snapshot.
          </div>
        </div>
      </div>
    );
  }

  if (err || !kbReport) {
    return (
      <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
        <div className="mx-auto max-w-[1560px] px-4 py-5 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility snapshot</div>
          <p className="text-sm" style={{ color: "rgba(248,113,113,0.95)" }}>
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
      </div>
    );
  }

  return (
    <Shell>
      <div
        ref={reportRootRef}
        className="mx-auto max-w-[1560px] px-4 py-3 md:px-5 md:py-4 space-y-6"
      >
        <ReportPage id="ladder-position">
          <VisibilityReportHeader
            orgLogoUrl={orgLogoUrl}
            takerName={takerName}
            reportDate={reportDate || formatDate(null)}
            frameworkName="WhatsWhat Prime"
            nextStepsUrl={nextStepsUrl}
            onDownload={downloadPdf}
          />

          <VisibilityVideoSection
            title="Welcome Video"
            videoSrc={SHORT_VIDEO_URL}
            posterSrc={SHORT_VIDEO_POSTER_URL || undefined}
            helperText="Watch this short introduction before reviewing your snapshot."
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] items-start">
            <div className="self-start">
              <LadderSidebar
                tier={tier}
                level={level}
                nextStepsUrl={nextStepsUrl}
                onDownload={downloadPdf}
              />
            </div>

            <div className="space-y-4">
              <LitePositionCard
                tier={tier}
                level={level}
                readiness={readiness}
                intro={reality.intro}
                marketCan={reality.marketCan}
                caution={reality.caution}
              />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-stretch">
                <DistributionChart tierCounts={tierCounts} />
                <SnapshotSummaryCard
                  tier={tier}
                  level={level}
                  summary={snapshotSummary}
                />
              </div>
            </div>
          </div>
        </ReportPage>

        <ReportPage id="visibility-snapshot">
          <PillarSnapshot pillars={pillars} />
        </ReportPage>

        <ReportPage id="results-snapshot">
          <InsightsSnapshot
            ai={kbReport.ai}
            strengths={strengths}
            friction={friction}
            opportunity={opportunity}
            nextStepsUrl={nextStepsUrl}
          />
        </ReportPage>
      </div>
    </Shell>
  );
}