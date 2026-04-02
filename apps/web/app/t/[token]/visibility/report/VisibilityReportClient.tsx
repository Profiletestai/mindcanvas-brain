// apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

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
  const n = [taker?.first_name, taker?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
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
    keys.includes("visibility") ||
    keys.includes("authority") ||
    keys.includes("dominance");

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

function sectionParagraphs(section?: Section | null): string[] {
  if (!section) return [];
  const out: string[] = [];
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) {
    const paras = Array.isArray(block.paragraphs) ? block.paragraphs : [];
    for (const p of paras) {
      const s = safeString(p);
      if (s) out.push(s);
    }
  }
  return out;
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
        background:
          "linear-gradient(180deg, rgba(27,60,99,0.78), rgba(12,32,58,0.84))",
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
        background:
          "linear-gradient(180deg, rgba(35,62,97,0.72), rgba(18,38,64,0.78))",
      }}
    >
      {children}
    </div>
  );
}

function PageFrame({
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
      data-pdf-page="true"
      className={`rounded-[26px] ${className}`}
      style={{
        pageBreakAfter: "always",
      }}
    >
      {children}
    </div>
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
          background:
            "linear-gradient(90deg, #45E0D1 0%, #4F7DFF 50%, #8B5CF6 100%)",
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

function Chip({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase"
      style={{
        border: `1px solid ${BRAND.border}`,
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.86)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className="text-[15px] font-semibold">{title}</div>
      {subtitle ? (
        <div className="mt-1 text-[13px]" style={{ color: BRAND.textDim }}>
          {subtitle}
        </div>
      ) : null}
    </>
  );
}

function SummaryCard({
  title,
  content,
  bullets,
}: {
  title: string;
  content?: string;
  bullets?: string[];
}) {
  return (
    <OuterCard className="p-4 h-full">
      <div className="text-[15px] font-semibold">{title}</div>
      {content ? (
        <div className="mt-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {content}
        </div>
      ) : null}
      {bullets && bullets.length ? (
        <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {bullets.map((item, idx) => (
            <li key={idx} className="flex gap-2">
              <span style={{ color: BRAND.teal }}>+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </OuterCard>
  );
}

function TextSection({
  id,
  title,
  section,
}: {
  id?: string;
  title: string;
  section?: Section | null;
}) {
  const summary = sectionSummary(section);
  const paragraphs = sectionParagraphs(section);
  const transition =
    (Array.isArray(section?.blocks) ? section?.blocks : [])
      .map((b) => safeString(b.transition))
      .find(Boolean) || "";

  return (
    <OuterCard id={id} className="p-4 md:p-5">
      <div className="text-[15px] font-semibold">{title}</div>

      <InnerPanel className="mt-3 p-4">
        {summary ? (
          <div
            className="rounded-2xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: BRAND.borderSoft,
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            <span className="font-medium">In short:</span> {summary}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>

        {transition ? (
          <div className="mt-4 text-[11px]" style={{ color: BRAND.textFaint }}>
            {transition}
          </div>
        ) : null}
      </InnerPanel>
    </OuterCard>
  );
}

function HeaderCard({
  orgLogoUrl,
  takerName,
  reportDate,
  nextStepsUrl,
  onDownload,
}: {
  orgLogoUrl?: string | null;
  takerName: string;
  reportDate: string;
  nextStepsUrl?: string;
  onDownload: () => void;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt="Organisation logo"
                className="h-10 w-10 rounded-2xl object-cover"
                style={{ border: `1px solid ${BRAND.border}` }}
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="h-10 w-10 rounded-2xl"
                style={{
                  border: `1px solid ${BRAND.border}`,
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            )}

            <div>
              <div className="text-[28px] md:text-[32px] font-semibold tracking-[0.14em] uppercase leading-none">
                Visibility Ladder™
              </div>
              <div
                className="mt-1.5 text-[12px] md:text-[13px] uppercase tracking-[0.28em]"
                style={{ color: BRAND.textDim }}
              >
                Strategic Visibility Assessment
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>WhatsWhat Prime</Chip>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5">
          <div className="flex gap-2">
            <TopButton onClick={onDownload}>Download PDF</TopButton>
            {nextStepsUrl ? (
              <TopButton href={nextStepsUrl} variant="gradient">
                Next steps
              </TopButton>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <InnerPanel className="px-3.5 py-3 min-w-[150px]">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Prepared for
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{takerName}</div>
            </InnerPanel>

            <InnerPanel className="px-3.5 py-3 min-w-[130px]">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Date
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{reportDate}</div>
            </InnerPanel>

            <InnerPanel className="px-3.5 py-3 min-w-[150px]">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Framework
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">WhatsWhat Prime</div>
            </InnerPanel>
          </div>
        </div>
      </div>
    </OuterCard>
  );
}

function LadderSidebar({
  tier,
  level,
  nextStepsUrl,
  onDownload,
  reportIndex,
}: {
  tier: Tier;
  level: number;
  nextStepsUrl?: string;
  onDownload: () => void;
  reportIndex: Array<{ id: string; label: string }>;
}) {
  const levels = Array.from({ length: 20 }, (_, i) => 20 - i);
  const groups: Array<{ tier: Tier; from: number; to: number }> = [
    { tier: "Magnetic", from: 16, to: 20 },
    { tier: "Established", from: 11, to: 15 },
    { tier: "Emerging", from: 6, to: 10 },
    { tier: "Invisible", from: 1, to: 5 },
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

        <div className="mt-3 flex gap-2.5">
          <div className="w-[24px] shrink-0 space-y-2.5 pl-0.5">
            {groups.map((g) => (
              <div
                key={g.tier}
                className="relative flex items-center justify-center rounded-[12px]"
                style={{
                  height: `${g.to - g.from + 1 > 4 ? 86 : 68}px`,
                  background: `${BRAND.tier[g.tier]}20`,
                  border: `1px solid ${BRAND.border}`,
                }}
              >
                <div
                  className="absolute left-0 top-2.5 bottom-2.5 w-[5px] rounded-r-full"
                  style={{ background: BRAND.tier[g.tier] }}
                />
                <div
                  className="rotate-[-90deg] whitespace-nowrap text-[9px] font-semibold"
                  style={{ color: BRAND.tier[g.tier] }}
                >
                  {g.tier}
                </div>
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {levels.map((n) => {
              const active = n === level;
              const band = tierBand(n);
              const bandColor = BRAND.tier[band];

              return (
                <div
                  key={n}
                  className="relative h-7 rounded-[10px] border flex items-center justify-center text-[12px]"
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
        <div
          className="text-[10px] uppercase tracking-[0.24em]"
          style={{ color: BRAND.textFaint }}
        >
          Report Index
        </div>

        <div className="mt-3 space-y-1.5">
          {reportIndex.map((item, idx) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block rounded-xl border px-3 py-2.5 text-[12px] leading-5 hover:bg-white/5"
              style={{
                borderColor: BRAND.borderSoft,
                background: "rgba(8,22,43,0.24)",
              }}
            >
              {idx + 1}. {item.label}
            </a>
          ))}
        </div>

        <div className="mt-3 space-y-2">
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

function HeroAndBreakdown({
  takerName,
  tier,
  level,
  heroCopy,
  currentPositionCopy,
  tierRangeCopy,
  readiness,
  pillars,
  weakest,
  strongest,
  overallPct,
}: {
  takerName: string;
  tier: Tier;
  level: number;
  heroCopy: string;
  currentPositionCopy: string;
  tierRangeCopy: string;
  readiness?: Readiness;
  pillars: PillarItem[];
  weakest?: string | null;
  strongest?: string | null;
  overallPct: number;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div
        className="text-[10px] uppercase tracking-[0.26em]"
        style={{ color: BRAND.textFaint }}
      >
        WhatsWhat Prime Visibility Ladder
      </div>

      <div className="mt-2 text-[34px] md:text-[50px] font-semibold leading-none tracking-[0.01em]">
        {takerName.toUpperCase()}
      </div>

      <InnerPanel className="mt-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div
              className="text-[28px] md:text-[44px] font-semibold leading-none"
              style={{ color: BRAND.tier[tier] }}
            >
              Level {level} — {tier}
            </div>
            <div
              className="mt-3 max-w-4xl text-[15px] leading-7"
              style={{ color: BRAND.text }}
            >
              {heroCopy}
            </div>
          </div>

          <InnerPanel className="px-4 py-3 shrink-0">
            <div
              className="text-[10px] uppercase tracking-[0.24em]"
              style={{ color: BRAND.textFaint }}
            >
              Status
            </div>
            <div className="mt-1.5 text-[16px] font-semibold">
              {readinessLabel(readiness)}
            </div>
          </InnerPanel>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.24em]"
              style={{ color: BRAND.textFaint }}
            >
              Current Position
            </div>
            <div
              className="mt-2 text-[14px] leading-7"
              style={{ color: BRAND.text }}
            >
              {currentPositionCopy}
            </div>
          </div>

          <div>
            <div
              className="text-[10px] uppercase tracking-[0.24em]"
              style={{ color: BRAND.textFaint }}
            >
              Tier Range
            </div>
            <div
              className="mt-2 text-[14px] leading-7"
              style={{ color: BRAND.text }}
            >
              {tierRangeCopy}
            </div>
          </div>
        </div>
      </InnerPanel>

      <div
        className="mt-5 text-[10px] uppercase tracking-[0.30em]"
        style={{ color: BRAND.textFaint }}
      >
        Prime Structural Breakdown
      </div>

      <div
        className={`mt-3 grid gap-3 ${
          pillars.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
        }`}
      >
        {pillars.map((pillar) => (
          <InnerPanel key={pillar.key} className="p-3.5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em]">
              {pillar.label}
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div
                className="text-[16px] font-semibold"
                style={{ color: pillar.color }}
              >
                {pillar.value}%
              </div>
              <div className="text-[12px]" style={{ color: BRAND.textDim }}>
                {pillar.band}
              </div>
            </div>

            <div
              className="mt-2.5 h-2.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pillar.value}%`,
                  background: `linear-gradient(90deg, ${pillar.color}, rgba(255,255,255,0.25))`,
                }}
              />
            </div>
          </InnerPanel>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <InnerPanel className="p-3.5">
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: BRAND.textFaint }}
          >
            Weakest Signal
          </div>
          <div className="mt-2 text-[16px] font-semibold">
            {getPillarLabel(weakest || pillars[0]?.key || "visibility")}
          </div>
        </InnerPanel>

        <InnerPanel className="p-3.5">
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: BRAND.textFaint }}
          >
            Strongest Signal
          </div>
          <div className="mt-2 text-[16px] font-semibold">
            {getPillarLabel(
              strongest || pillars[pillars.length - 1]?.key || "trust"
            )}
          </div>
        </InnerPanel>

        <InnerPanel className="p-3.5">
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: BRAND.textFaint }}
          >
            Overall Score
          </div>
          <div className="mt-2 text-[16px] font-semibold">{overallPct}%</div>
        </InnerPanel>
      </div>
    </OuterCard>
  );
}

function SignalGraph({
  tier,
  level,
  overallPct,
  pillars,
  weakest,
  strongest,
}: {
  tier: Tier;
  level: number;
  overallPct: number;
  pillars: PillarItem[];
  weakest?: string | null;
  strongest?: string | null;
}) {
  return (
    <OuterCard className="p-4 h-full">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.26em]"
        style={{ color: BRAND.purple }}
      >
        Signal Graph
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <InnerPanel className="p-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Tier
          </div>
          <div className="mt-1.5 text-[13px] font-semibold" style={{ color: BRAND.tier[tier] }}>
            {tier}
          </div>
        </InnerPanel>

        <InnerPanel className="p-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Level
          </div>
          <div className="mt-1.5 text-[13px] font-semibold">{level}</div>
        </InnerPanel>

        <InnerPanel className="p-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Overall
          </div>
          <div className="mt-1.5 text-[13px] font-semibold">{overallPct}%</div>
        </InnerPanel>
      </div>

      <div className="mt-4 space-y-3.5">
        {pillars.map((pillar) => {
          const tag =
            pillar.key === safeString(weakest).toLowerCase()
              ? "weakest"
              : pillar.key === safeString(strongest).toLowerCase()
              ? "strongest"
              : "";

          return (
            <div key={pillar.key}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <div className="font-medium">
                  {pillar.label}{" "}
                  {tag ? (
                    <span
                      className="ml-1 text-[10px]"
                      style={{ color: BRAND.textFaint }}
                    >
                      {tag}
                    </span>
                  ) : null}
                </div>
                <div>{pillar.value}%</div>
              </div>

              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pillar.value}%`,
                    background: `linear-gradient(90deg, ${pillar.color}, rgba(255,255,255,0.45))`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </OuterCard>
  );
}

function CoachingInsights({
  ai,
  fallbackStrengths,
  fallbackFriction,
  fallbackOpportunity,
}: {
  ai?: AiInsights | null;
  fallbackStrengths?: string[];
  fallbackFriction?: string[];
  fallbackOpportunity?: string;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <SectionTitle
        title="Coaching insights"
        subtitle="An additional interpretation layer built from your scored signals and narrative blocks."
      />

      <InnerPanel className="mt-3 p-4">
        <div className="text-[14px] font-semibold">Executive summary</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.executive_summary ||
            "This section provides a guided interpretation of the report so the reader can turn signals into practical direction."}
        </div>
      </InnerPanel>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Strengths</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {(ai?.strengths?.length ? ai.strengths : fallbackStrengths || []).map(
              (item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span>•</span>
                  <span>{item}</span>
                </li>
              )
            )}
          </ul>
        </InnerPanel>

        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Friction</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {(ai?.friction?.length ? ai.friction : fallbackFriction || []).map(
              (item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span>•</span>
                  <span>{item}</span>
                </li>
              )
            )}
          </ul>
        </InnerPanel>
      </div>

      <InnerPanel className="mt-3 p-4">
        <div className="text-[14px] font-semibold">Strategic opportunity</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.strategic_opportunity || fallbackOpportunity || "Clarify the highest-impact next move and focus effort where it will create the greatest lift."}
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!token || !tid) throw new Error("Missing token or tid.");

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
        )}/report?tid=${encodeURIComponent(
          tid
        )}&audience=taker_report`;
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

  const orgLogoUrl =
    portalMeta?.org_logo_url || kbReport?.meta?.org_logo_url || null;
  const takerName = fullName(portalMeta?.taker);
  const reportDate = formatDate(kbReport?.meta?.generated_at);
  const nextStepsUrl = safeString(portalMeta?.link?.next_steps_url);

  const tier = ((kbReport?.signals?.tier as Tier) || "Invisible") as Tier;
  const level = clamp(safeNumber(kbReport?.signals?.level, 1), 1, 20);
  const readiness = kbReport?.signals?.readiness;
  const overallPct = (() => {
    const direct = safeNumber(kbReport?.signals?.overall_pct, -1);
    if (direct >= 0) return direct;
    const pillars = buildPillars(
      kbReport?.graphs?.pillars || kbReport?.signals?.pillar_scores
    );
    if (!pillars.length) return 0;
    return Math.round(
      pillars.reduce((sum, pillar) => sum + pillar.value, 0) / pillars.length
    );
  })();

  const sectionMap = useMemo(() => {
    const map = new Map<string, Section>();
    const sections = Array.isArray(kbReport?.sections) ? kbReport?.sections : [];
    for (const section of sections) {
      map.set(section.key, section);
    }
    return map;
  }, [kbReport?.sections]);

  const secWelcome = sectionMap.get("welcome") || null;
  const secHowToUse = sectionMap.get("how_to_use") || null;
  const secUnderstanding = sectionMap.get("understanding") || null;
  const secStrengths = sectionMap.get("strengths") || null;
  const secFriction = sectionMap.get("friction") || null;
  const secMarketExperience = sectionMap.get("market_experience") || null;
  const secOpportunity = sectionMap.get("opportunity") || null;
  const secNextMove = sectionMap.get("next_move") || null;
  const secLevelMeaning = sectionMap.get("level_meaning") || null;
  const secSnapshot = sectionMap.get("snapshot") || null;
  const secClosing = sectionMap.get("closing") || null;

  const pillars = buildPillars(
    kbReport?.graphs?.pillars || kbReport?.signals?.pillar_scores
  );
  const weakest = safeString(kbReport?.signals?.weakest_pillar).toLowerCase() || null;
  const strongest =
    safeString(kbReport?.signals?.strongest_pillar).toLowerCase() || null;

  const heroCopy =
    sectionSummary(secLevelMeaning) ||
    sectionSummary(secSnapshot) ||
    (tier === "Invisible"
      ? "You are in the Invisible tier — your market signals are still too weak or inconsistent to create reliable response."
      : tier === "Emerging"
      ? "You are in the Emerging tier — people can see you, but you are not yet the default choice."
      : tier === "Established"
      ? "You are in the Established tier — your market can recognise your value, but stronger authority is still needed."
      : "You are in the Magnetic tier — your market sees you as a recognised authority with strong pull and influence.");

  const currentPositionCopy =
    tier === "Invisible"
      ? "You are visible in some places, but not yet enough to create reliable market confidence."
      : tier === "Emerging"
      ? "You are visible in market terms, but this level is about strengthening structural consistency."
      : tier === "Established"
      ? "You are recognised and trusted, but this level is about consolidating leadership signals."
      : "You are in a leadership position — the focus here is sustaining authority and protecting consistency.";

  const tierRangeCopy =
    tier === "Invisible"
      ? "Levels 1–5. Early market signals are present, but they are not yet stable enough to drive predictable response."
      : tier === "Emerging"
      ? "Levels 6–10. Movement inside the tier reflects how stable your market position is."
      : tier === "Established"
      ? "Levels 11–15. The market recognises your value, but stronger consistency still separates expert from authority."
      : "Levels 16–20. This range reflects strong authority, stronger pull, and greater market recognition.";

  const marketRealityBullets = (() => {
    const bullets = firstItems(sectionBullets(secMarketExperience), 3);
    if (bullets.length) return bullets;
    return firstItems(sectionParagraphs(secMarketExperience), 2);
  })();

  const opportunityBullets = (() => {
    const bullets = firstItems(sectionBullets(secOpportunity), 3);
    if (bullets.length) return bullets;
    return firstItems(sectionParagraphs(secOpportunity), 2);
  })();

  const nextMoveBullets = (() => {
    const bullets = firstItems(sectionBullets(secNextMove), 4);
    if (bullets.length) return bullets;
    return firstItems(sectionParagraphs(secNextMove), 4);
  })();

  const reportIndex = [
    { id: "welcome", label: "A Personal Welcome From Bogdan Stan" },
    { id: "how-to-use", label: "How To Use This Report" },
    { id: "understanding", label: "Understanding the Visibility Ladder" },
    { id: "working", label: "What is already working" },
    { id: "friction", label: "Where visibility friction exists" },
    { id: "closing", label: "Turning insight into strategy" },
  ];

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
      const pageHeight = pdf.internal.pageSize.getHeight();

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

        if (imgHeight <= pageHeight) {
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        } else {
          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
        }
      }

      const safeName = `${safeString(takerName) || "Visibility"}-Visibility-Ladder.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );
      pdf.save(safeName);
    } catch (e) {
      console.error("[visibility] pdf export failed", e);
      alert("PDF export failed.");
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1560px] px-4 py-5">
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
        <div className="mx-auto max-w-[1560px] px-4 py-5 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility report</div>
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
      </Shell>
    );
  }

  return (
    <Shell>
      <div
        ref={reportRootRef}
        className="mx-auto max-w-[1560px] px-4 py-3 md:px-5 md:py-4 space-y-6"
      >
        {/* PAGE 1 */}
        <PageFrame>
          <div className="space-y-4">
            <HeaderCard
              orgLogoUrl={orgLogoUrl}
              takerName={takerName}
              reportDate={reportDate || formatDate(null)}
              nextStepsUrl={nextStepsUrl}
              onDownload={downloadPdf}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
              <div className="self-start">
                <LadderSidebar
                  tier={tier}
                  level={level}
                  nextStepsUrl={nextStepsUrl}
                  onDownload={downloadPdf}
                  reportIndex={reportIndex}
                />
              </div>

              <div className="space-y-4">
                <HeroAndBreakdown
                  takerName={takerName}
                  tier={tier}
                  level={level}
                  heroCopy={heroCopy}
                  currentPositionCopy={currentPositionCopy}
                  tierRangeCopy={tierRangeCopy}
                  readiness={readiness}
                  pillars={pillars}
                  weakest={weakest}
                  strongest={strongest}
                  overallPct={overallPct}
                />

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <SummaryCard
                    title="Market reality"
                    content={
                      !marketRealityBullets.length
                        ? sectionSummary(secMarketExperience)
                        : undefined
                    }
                    bullets={marketRealityBullets}
                  />

                  <SummaryCard
                    title="Your strategic visibility opportunity"
                    content={
                      !opportunityBullets.length
                        ? sectionSummary(secOpportunity)
                        : undefined
                    }
                    bullets={opportunityBullets}
                  />

                  <SummaryCard
                    title="Your most effective next move"
                    content={
                      !nextMoveBullets.length
                        ? sectionSummary(secNextMove)
                        : undefined
                    }
                    bullets={nextMoveBullets}
                  />
                </div>
              </div>
            </div>
          </div>
        </PageFrame>

        {/* PAGE 2 */}
        <PageFrame>
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)]">
            <div className="space-y-4">
              <TextSection
                id="welcome"
                title="A Personal Welcome From Bogdan Stan"
                section={secWelcome}
              />
              <TextSection
                id="how-to-use"
                title="How To Use This Report"
                section={secHowToUse}
              />
            </div>

            <div className="space-y-4">
              <TextSection
                id="understanding"
                title="Understanding the Visibility Ladder"
                section={secUnderstanding}
              />
            </div>
          </div>
        </PageFrame>

        {/* PAGE 3 */}
        <PageFrame>
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
            <div className="space-y-4">
              <TextSection
                id="working"
                title="What is already working"
                section={secStrengths}
              />
              <TextSection
                title="How the market is likely experiencing your business"
                section={secMarketExperience}
              />
            </div>

            <div className="space-y-4">
              <TextSection
                id="friction"
                title="Where visibility friction exists"
                section={secFriction}
              />
              <SignalGraph
                tier={tier}
                level={level}
                overallPct={overallPct}
                pillars={pillars}
                weakest={weakest}
                strongest={strongest}
              />
            </div>
          </div>
        </PageFrame>

        {/* PAGE 4 */}
        <PageFrame>
          <CoachingInsights
            ai={kbReport.ai}
            fallbackStrengths={firstItems(sectionBullets(secStrengths), 4)}
            fallbackFriction={firstItems(sectionBullets(secFriction), 4)}
            fallbackOpportunity={sectionSummary(secOpportunity)}
          />
        </PageFrame>

        {/* PAGE 5 */}
        <PageFrame>
          <OuterCard id="closing" className="p-4 md:p-5">
            <SectionTitle
              title={secClosing?.title || "Turning insight into strategy"}
            />

            <InnerPanel className="mt-3 p-4">
              {sectionSummary(secClosing) ? (
                <div
                  className="rounded-2xl border px-4 py-3 text-[13px]"
                  style={{
                    borderColor: BRAND.borderSoft,
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  <span className="font-medium">In short:</span>{" "}
                  {sectionSummary(secClosing)}
                </div>
              ) : null}

              <div className="mt-4 space-y-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
                {sectionParagraphs(secClosing).map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </InnerPanel>

            <div className="mt-3 text-[11px]" style={{ color: BRAND.textFaint }}>
              engine: {safeString(kbReport.engine_key || "visibility_prime_v1")} • v
              {kbReport.version ?? 2} • mode:{" "}
              {safeString(kbReport?.meta?.scoring_mode || "prime")}
            </div>
          </OuterCard>
        </PageFrame>
      </div>
    </Shell>
  );
}