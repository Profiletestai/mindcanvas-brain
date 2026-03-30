// apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";
type ScoringMode = "legacy" | "prime";

type Signals = {
  mode?: ScoringMode;
  pillar_model?: "legacy" | "prime";
  public_profile_model?: "hidden" | "visible";

  tier?: Tier;
  level?: number;
  style?: AB;
  readiness?: Readiness;

  pillar_scores?: Record<string, number>;
  pillar_bands?: Record<string, string>;
  pillar_band?: Record<string, string>;

  weakest_pillar?: string | null;
  strongest_pillar?: string | null;
  balance_pattern?: string | null;
  pattern_tags?: string[];

  overall_pct?: number | null;
  validation_required?: boolean;
  validation_status?: string | null;
  ladder_question_count?: number | null;
};

type Graphs = {
  pillar_model?: "legacy" | "prime";
  tier_counts?: Record<string, number>;
  personality_points?: Record<string, number> | null;
  ladder?: { tier?: Tier; level?: number };
  pillars?: Record<string, number>;
  pillar_bands?: Record<string, string>;
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
    scoring_mode?: ScoringMode;
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

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
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
  const n = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim();
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

function inferMode(report: VisibilityKbReport | null): ScoringMode {
  if (!report) return "legacy";
  if (report?.meta?.scoring_mode === "prime") return "prime";
  if (report?.signals?.mode === "prime") return "prime";
  if (report?.signals?.pillar_model === "prime") return "prime";
  if (safeString(report?.engine_key).toLowerCase() === "visibility_prime_v1") return "prime";
  if (Number(report?.version ?? 1) >= 2) return "prime";
  return "legacy";
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

function flattenSectionParagraphs(section?: Section | null): string[] {
  const blocks = Array.isArray(section?.blocks) ? section!.blocks! : [];
  return blocks
    .flatMap((b) => (Array.isArray(b?.paragraphs) ? b.paragraphs : []))
    .filter(Boolean);
}

function firstSummary(section?: Section | null): string {
  const blocks = Array.isArray(section?.blocks) ? section!.blocks! : [];
  for (const b of blocks) {
    const s = safeString(b?.short_summary);
    if (s) return s;
  }
  const paras = flattenSectionParagraphs(section);
  return paras[0] || "";
}

function firstParagraph(section?: Section | null): string {
  const paras = flattenSectionParagraphs(section);
  return paras[0] || "";
}

function paragraphSlice(section?: Section | null, count = 3): string[] {
  return flattenSectionParagraphs(section).slice(0, count);
}

function bulletify(section?: Section | null, count = 3): string[] {
  const paras = flattenSectionParagraphs(section)
    .map((p) => safeString(p))
    .filter(Boolean);
  return paras.slice(0, count);
}

function nicePillarLabel(key: string, mode: ScoringMode) {
  const k = safeString(key).toLowerCase();
  if (mode === "prime") {
    if (k === "visibility") return "Visibility";
    if (k === "trust") return "Trust";
    if (k === "authority") return "Authority";
    if (k === "dominance") return "Dominance";
  } else {
    if (k === "discoverability") return "Discoverability";
    if (k === "trust") return "Trust";
    if (k === "conversion") return "Conversion";
  }
  return key;
}

function normalisePillars(mode: ScoringMode, raw: Record<string, number> | undefined) {
  const src = raw || {};
  if (mode === "prime") {
    return [
      { key: "visibility", label: "Visibility", value: clamp(safeNumber(src.visibility), 0, 100) },
      { key: "trust", label: "Trust", value: clamp(safeNumber(src.trust), 0, 100) },
      { key: "authority", label: "Authority", value: clamp(safeNumber(src.authority), 0, 100) },
      { key: "dominance", label: "Dominance", value: clamp(safeNumber(src.dominance), 0, 100) },
    ];
  }
  return [
    { key: "discoverability", label: "Discoverability", value: clamp(safeNumber(src.discoverability), 0, 100) },
    { key: "trust", label: "Trust", value: clamp(safeNumber(src.trust), 0, 100) },
    { key: "conversion", label: "Conversion", value: clamp(safeNumber(src.conversion), 0, 100) },
  ];
}

function pillarBandLabel(raw?: string | null) {
  const x = safeString(raw).toLowerCase();
  if (!x) return "—";
  if (x === "weak") return "Weak";
  if (x === "developing") return "Developing";
  if (x === "strong") return "Strong";
  if (x === "dominant") return "Dominant";
  return raw || "—";
}

function tierRangeLabel(tier: Tier) {
  if (tier === "Invisible") return "Levels 1–5";
  if (tier === "Emerging") return "Levels 6–10";
  if (tier === "Established") return "Levels 11–15";
  return "Levels 16–20";
}

const BRAND = {
  bg: "#07152F",
  bgSoft: "#0B1E43",
  accent: "#E9B95B",
  textDim: "rgba(255,255,255,0.75)",
  textFaint: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.10)",

  tier: {
    Invisible: "#94A3B8",
    Emerging: "#E9B95B",
    Established: "#38E1C6",
    Magnetic: "#8B5CF6",
  } as Record<Tier, string>,

  ab: {
    A: "#38E1C6",
    B: "#4FB3FF",
    C: "#F59E0B",
    D: "#EF4444",
  } as Record<AB, string>,

  legacyPillars: {
    discoverability: "#4FB3FF",
    trust: "#38E1C6",
    conversion: "#E9B95B",
  } as Record<string, string>,

  primePillars: {
    visibility: "#4FB3FF",
    trust: "#38E1C6",
    authority: "#E9B95B",
    dominance: "#8B5CF6",
  } as Record<string, string>,
};

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
    <div className="pointer-events-none fixed inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 600px at 18% 8%, rgba(79,179,255,0.10), transparent 58%)," +
            "radial-gradient(760px 460px at 82% 18%, rgba(233,185,91,0.08), transparent 52%)," +
            "radial-gradient(760px 460px at 50% 92%, rgba(139,92,246,0.06), transparent 58%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
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
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] p-[1px] ${className}`}
      style={{
        background:
          "linear-gradient(135deg, rgba(233,185,91,0.12), rgba(79,179,255,0.10), rgba(255,255,255,0.04))",
        boxShadow: "0 14px 38px rgba(0,0,0,0.30)",
      }}
    >
      <div
        className="rounded-[23px] p-5 md:p-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          border: `1px solid ${BRAND.border}`,
          backdropFilter: "blur(8px)",
        }}
      >
        {(title || subtitle || right) && (
          <div className="flex items-start justify-between gap-4">
            <div>
              {title ? <div className="text-lg font-semibold tracking-wide">{title}</div> : null}
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
    color: "#081529",
    boxShadow: "0 10px 24px rgba(233,185,91,0.26)",
  } as any;

  if (href) {
    return (
      <a className={cls} style={style} href={href} target="_blank" rel="noopener noreferrer">
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
      <a className={cls} style={style} href={href} target="_blank" rel="noopener noreferrer">
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

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.20em]"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${BRAND.border}`,
        color: "rgba(255,255,255,0.76)",
      }}
    >
      {children}
    </div>
  );
}

function TinyInfoCard({
  title,
  lines,
  accent,
}: {
  title: string;
  lines: string[];
  accent?: string;
}) {
  return (
    <div
      className="rounded-[20px] p-5 h-full"
      style={{
        background: "rgba(0,0,0,0.14)",
        border: `1px solid ${BRAND.border}`,
      }}
    >
      <div
        className="text-[12px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: accent || "rgba(255,255,255,0.90)" }}
      >
        {title}
      </div>

      <div className="mt-4 space-y-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
        {lines.length ? (
          lines.map((line, idx) => (
            <div key={idx} className="flex gap-3">
              <div style={{ color: accent || BRAND.accent }}>+</div>
              <div>{line}</div>
            </div>
          ))
        ) : (
          <div style={{ color: BRAND.textDim }}>No summary available yet.</div>
        )}
      </div>
    </div>
  );
}

function PillarTile({
  label,
  value,
  band,
  color,
  isWeakest,
  isStrongest,
}: {
  label: string;
  value: number;
  band?: string;
  color: string;
  isWeakest?: boolean;
  isStrongest?: boolean;
}) {
  return (
    <div
      className="rounded-[18px] p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isWeakest || isStrongest ? "rgba(255,255,255,0.18)" : BRAND.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold uppercase tracking-[0.08em]">{label}</div>
        {isStrongest ? (
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em]"
            style={{ background: `${color}20`, color }}
          >
            Strongest
          </div>
        ) : isWeakest ? (
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em]"
            style={{ background: `${color}20`, color }}
          >
            Weakest
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold" style={{ color }}>
          {value}%
        </div>
        <div className="text-sm" style={{ color: BRAND.textDim }}>
          {pillarBandLabel(band)}
        </div>
      </div>

      <div
        className="mt-3 h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamp(value, 0, 100)}%`,
            background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.18))`,
          }}
        />
      </div>
    </div>
  );
}

function VerticalLadderRail({
  level,
  tier,
}: {
  level: number;
  tier: Tier;
}) {
  const rows = Array.from({ length: 20 }, (_, i) => 20 - i);
  const active = clamp(level || 1, 1, 20);
  const tierColor = BRAND.tier[tier];

  return (
    <div
      className="rounded-[24px] p-4 h-full"
      style={{
        background: "rgba(0,0,0,0.16)",
        border: `1px solid ${BRAND.border}`,
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: BRAND.textFaint }}>
        Ladder
      </div>

      <div className="mt-4 space-y-1.5">
        {rows.map((n) => {
          const isActive = n === active;
          const rowTier = tierBand(n);

          return (
            <div key={n} className="flex items-center gap-3">
              <div className="w-9 text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>
                {n}
              </div>
              <div
                className="flex-1 h-5 rounded-full border"
                style={{
                  borderColor: isActive ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
                  background: isActive
                    ? `linear-gradient(90deg, ${tierColor}bb, rgba(255,255,255,0.10))`
                    : rowTier === tier
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.025)",
                }}
              />
              <div
                className="w-9 text-center text-[11px] font-semibold"
                style={{ color: isActive ? tierColor : "rgba(255,255,255,0.40)" }}
              >
                {isActive ? n : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 space-y-2 text-xs" style={{ color: BRAND.textDim }}>
        <div className="flex items-center justify-between">
          <span>Invisible</span>
          <span>1–5</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Emerging</span>
          <span>6–10</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Established</span>
          <span>11–15</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Magnetic</span>
          <span>16–20</span>
        </div>
      </div>
    </div>
  );
}

function SectionBlocks({ section }: { section: Section }) {
  const title = safeString(section?.title) || safeString(section?.key);
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];

  return (
    <div className="mt-4 space-y-4">
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
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.12)",
            }}
          >
            {showBlockTitle ? <div className="text-base font-semibold">{bt}</div> : null}

            {short ? (
              <div
                className="mt-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.035)",
                }}
              >
                <span style={{ color: BRAND.textFaint }}>In short:</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.88)" }}>{short}</span>
              </div>
            ) : null}

            <div className="mt-4 space-y-3 text-[15px] leading-8" style={{ color: "rgba(255,255,255,0.86)" }}>
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
    <GlassCard
      title="AI coaching insights"
      subtitle="An additional interpretation layer built from your scored signals and narrative blocks."
    >
      {error ? (
        <div className="mt-2 text-sm" style={{ color: "rgba(248,113,113,0.95)" }}>
          Insights generation failed: {error}
        </div>
      ) : ai ? (
        <div className="mt-4 space-y-4">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.12)" }}
          >
            <div className="text-sm font-semibold">Executive summary</div>
            <div className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
              {ai.executive_summary}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.12)" }}
            >
              <div className="text-sm font-semibold">Strengths</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-2" style={{ color: "rgba(255,255,255,0.86)" }}>
                {ai.strengths?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.12)" }}
            >
              <div className="text-sm font-semibold">Friction</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-2" style={{ color: "rgba(255,255,255,0.86)" }}>
                {ai.friction?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: BRAND.border, background: "rgba(0,0,0,0.12)" }}
          >
            <div className="text-sm font-semibold">Strategic opportunity</div>
            <div className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
              {ai.strategic_opportunity}
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

export default function VisibilityReportClient({
  token,
  tid,
  sid,
  src,
}: {
  token: string;
  tid?: string;
  sid?: string;
  src?: string;
}) {
  const reportRootRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [portalMeta, setPortalMeta] = useState<PortalReportResponse["data"] | null>(null);
  const [kbReport, setKbReport] = useState<VisibilityKbReport | null>(null);

  const mode = inferMode(kbReport);

  const orgName = portalMeta?.org_name || kbReport?.meta?.org_name || "Organisation";
  const orgLogoUrl = portalMeta?.org_logo_url || kbReport?.meta?.org_logo_url || null;
  const testName =
    portalMeta?.test_name ||
    kbReport?.meta?.test_name ||
    (mode === "prime" ? "WhatsWhat Prime Visibility Ladder" : "Visibility Ladder");

  const portalFullName = fullName(portalMeta?.taker);
  const takerName = portalFullName !== "Your" ? portalFullName : "Your Report";

  const nextStepsUrl = safeString(portalMeta?.link?.next_steps_url);

  const tier: Tier =
    (kbReport?.signals?.tier as Tier) || tierBand(Number(kbReport?.signals?.level ?? 1));
  const level: number = Number(kbReport?.signals?.level ?? 1);
  const style: AB | null = (kbReport?.signals?.style as AB) || null;
  const readiness = kbReport?.signals?.readiness as Readiness | undefined;
  const reportDate = formatDate(kbReport?.meta?.generated_at);

  const sections = Array.isArray(kbReport?.sections) ? kbReport.sections : [];
  const sectionByKey = useMemo(() => {
    const m = new Map<string, Section>();
    sections.forEach((s) => m.set(s.key, s));
    return m;
  }, [sections]);

  const introKeys =
    mode === "prime"
      ? ["welcome", "how_to_use", "understanding", "tiers_levels"]
      : ["welcome", "how_to_use", "understanding", "tiers_levels", "behaviour_profiles"];

  const introSections = introKeys
    .map((k) => sectionByKey.get(k))
    .filter(Boolean) as Section[];

  const secWelcome = sectionByKey.get("welcome") || null;
  const secHowToUse = sectionByKey.get("how_to_use") || null;
  const secUnderstanding = sectionByKey.get("understanding") || null;
  const secTiers = sectionByKey.get("tiers_levels") || null;
  const secBehaviourProfiles = sectionByKey.get("behaviour_profiles") || null;

  const secFramework = sectionByKey.get("framework_foundation") || null;
  const secSnapshot = sectionByKey.get("snapshot") || null;
  const secPillars = sectionByKey.get("pillars") || null;
  const secLevelMeaning = sectionByKey.get("level_meaning") || null;
  const secStrengths = sectionByKey.get("strengths") || null;
  const secFriction = sectionByKey.get("friction") || null;
  const secMarket = sectionByKey.get("market_experience") || null;
  const secOpportunity = sectionByKey.get("opportunity") || null;
  const secNextMove = sectionByKey.get("next_move") || null;
  const secPossibleNext = sectionByKey.get("possible_next") || null;
  const secClosing = sectionByKey.get("closing") || null;

  const pillarSource =
    (kbReport?.graphs?.pillars as Record<string, number>) ||
    (kbReport?.signals?.pillar_scores as Record<string, number>) ||
    {};

  const bandSource =
    (kbReport?.signals?.pillar_bands as Record<string, string>) ||
    (kbReport?.signals?.pillar_band as Record<string, string>) ||
    (kbReport?.graphs?.pillar_bands as Record<string, string>) ||
    (kbReport?.graphs?.pillar_band as Record<string, string>) ||
    {};

  const pillars = useMemo(() => normalisePillars(mode, pillarSource), [mode, pillarSource]);

  const weakest = safeString(kbReport?.signals?.weakest_pillar || "");
  const strongest = safeString(kbReport?.signals?.strongest_pillar || "");

  const validationRequired = Boolean(kbReport?.signals?.validation_required);
  const validationStatus = safeString(kbReport?.signals?.validation_status);
  const overallPct = kbReport?.signals?.overall_pct ?? null;

  const marketRealityLines = bulletify(secMarket, 3);
  const frictionLines = bulletify(secFriction, 3);
  const directionLines = bulletify(secOpportunity || secNextMove, 3);

  const ai = kbReport?.ai ?? null;
  const aiError = safeString(kbReport?.meta?.ai_error);

  async function downloadPdf() {
    try {
      const node = reportRootRef.current;
      if (!node) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

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

        if (!token || (!tid && !sid)) {
          throw new Error("Missing token and report locator (tid or sid required).");
        }

        const kbUrl = sid
          ? `/api/public/visibility/${encodeURIComponent(token)}/report?sid=${encodeURIComponent(
              sid
            )}&audience=taker_report`
          : `/api/public/visibility/${encodeURIComponent(
              token
            )}/report?tid=${encodeURIComponent(tid!)}&audience=taker_report`;

        const kbRes = await fetchJson<VisibilityKbApiResponse>(kbUrl);
        if (cancelled) return;
        setKbReport(kbRes?.data ?? null);

        if (tid) {
          try {
            const portalUrl = `/api/public/test/${encodeURIComponent(
              token
            )}/report?tid=${encodeURIComponent(tid)}${
              src ? `&src=${encodeURIComponent(src)}` : ""
            }`;

            const portalRes = await fetchJson<PortalReportResponse>(portalUrl);
            if (cancelled) return;
            setPortalMeta(portalRes?.data ?? null);
          } catch (portalErr) {
            console.warn("[visibility] portal meta fetch failed", portalErr);
            if (!cancelled) setPortalMeta(null);
          }
        } else {
          setPortalMeta(null);
        }

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[visibility] report load failed", e);
        setErr(
          e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e)
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tid, sid, src]);

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1380px] p-6">
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
        <div className="mx-auto max-w-[1380px] p-6 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility report</div>
          <p className="text-sm" style={{ color: "rgba(248,113,113,0.95)" }}>
            {safeText(err || "Unknown error")}
          </p>
          <div
            className="rounded-2xl p-4 text-xs"
            style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BRAND.border}` }}
          >
            <div>token: {token}</div>
            <div>tid: {tid || "—"}</div>
            <div>sid: {sid || "—"}</div>
          </div>
          <Link href={`/t/${token}`} className="underline text-sm">
            Go back
          </Link>
        </div>
      </Shell>
    );
  }

  const usedKeys = new Set<string>([
    ...introKeys,
    "framework_foundation",
    "snapshot",
    "pillars",
    "level_meaning",
    "strengths",
    "friction",
    "market_experience",
    "opportunity",
    "next_move",
    "possible_next",
    "closing",
  ]);

  const remainingSections = sections.filter((s) => !usedKeys.has(s.key));

  return (
    <Shell>
      <div ref={reportRootRef} className="mx-auto max-w-[1380px] p-5 md:p-6 space-y-6">
        <GlassCard
          right={
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={downloadPdf}>Download PDF</SecondaryButton>
              {nextStepsUrl ? <PrimaryButton href={nextStepsUrl}>Next steps</PrimaryButton> : null}
            </div>
          }
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4 items-start">
              {orgLogoUrl ? (
                <img
                  src={orgLogoUrl}
                  alt={orgName}
                  className="h-14 w-14 rounded-2xl object-cover"
                  style={{ border: `1px solid ${BRAND.border}` }}
                  onError={(e: any) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div
                  className="h-14 w-14 rounded-2xl"
                  style={{
                    border: `1px solid ${BRAND.border}`,
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
              )}

              <div>
                <div className="text-[28px] md:text-[34px] font-semibold tracking-[0.12em] uppercase leading-none">
                  Visibility Ladder™
                </div>
                <div
                  className="mt-2 text-[13px] md:text-[14px] uppercase tracking-[0.22em]"
                  style={{ color: BRAND.textDim }}
                >
                  Strategic Visibility Assessment
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Kicker>{mode === "prime" ? "WhatsWhat Prime" : "Visibility Ladder"}</Kicker>
                  <Kicker>{orgName}</Kicker>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 lg:min-w-[520px]">
              <div
                className="rounded-2xl p-4"
                style={{ border: `1px solid ${BRAND.border}`, background: "rgba(0,0,0,0.14)" }}
              >
                <div className="text-xs" style={{ color: BRAND.textFaint }}>
                  Prepared for
                </div>
                <div className="mt-2 text-sm font-semibold">{takerName}</div>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{ border: `1px solid ${BRAND.border}`, background: "rgba(0,0,0,0.14)" }}
              >
                <div className="text-xs" style={{ color: BRAND.textFaint }}>
                  Date
                </div>
                <div className="mt-2 text-sm font-semibold">{reportDate || formatDate(null)}</div>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{ border: `1px solid ${BRAND.border}`, background: "rgba(0,0,0,0.14)" }}
              >
                <div className="text-xs" style={{ color: BRAND.textFaint }}>
                  Framework
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {mode === "prime" ? "WhatsWhat Prime" : "Bogdan Stan"}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-2">
            <VerticalLadderRail level={level} tier={tier} />
          </div>

          <div className="xl:col-span-6 space-y-6">
            <GlassCard>
              <div className="flex flex-col gap-5">
                <div>
                  <div
                    className="text-[14px] uppercase tracking-[0.18em]"
                    style={{ color: BRAND.textFaint }}
                  >
                    {mode === "prime" ? "WhatsWhat Prime Visibility Ladder" : testName}
                  </div>
                  <div className="mt-3 text-[30px] md:text-[40px] font-semibold tracking-[0.04em] uppercase leading-none">
                    {safeString(takerName)}
                  </div>
                </div>

                <div
                  className="rounded-[22px] overflow-hidden"
                  style={{
                    border: `1px solid ${BRAND.border}`,
                    background:
                      "linear-gradient(90deg, rgba(233,185,91,0.14), rgba(255,255,255,0.04))",
                  }}
                >
                  <div className="p-5 md:p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-[620px]">
                        <div
                          className="text-[30px] md:text-[40px] font-semibold leading-none"
                          style={{ color: BRAND.tier[tier] }}
                        >
                          Level {level} — {tier}
                        </div>

                        <div
                          className="mt-3 text-[16px] md:text-[18px] leading-8"
                          style={{ color: "rgba(255,255,255,0.92)" }}
                        >
                          {firstSummary(secSnapshot) ||
                            (mode === "prime"
                              ? `You are currently in the ${tier} tier.`
                              : `You are currently in the ${tier} tier.`)}
                        </div>
                      </div>

                      <div
                        className="rounded-2xl px-4 py-3 self-start min-w-[130px]"
                        style={{
                          background: "rgba(0,0,0,0.16)",
                          border: `1px solid rgba(255,255,255,0.10)`,
                        }}
                      >
                        <div
                          className="text-[11px] uppercase tracking-[0.16em]"
                          style={{ color: BRAND.textFaint }}
                        >
                          Status
                        </div>
                        <div className="mt-1 text-base font-semibold">{readinessLabel(readiness)}</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <div
                          className="text-[11px] uppercase tracking-[0.16em]"
                          style={{ color: BRAND.textFaint }}
                        >
                          Current position
                        </div>
                        <div
                          className="mt-2 text-sm leading-7"
                          style={{ color: "rgba(255,255,255,0.86)" }}
                        >
                          {firstParagraph(secLevelMeaning) ||
                            (mode === "prime"
                              ? "You are visible in market terms, but this level is about strengthening structural consistency."
                              : "You have reached a visible level, but consistency is still what determines growth.")}
                        </div>
                      </div>

                      <div>
                        <div
                          className="text-[11px] uppercase tracking-[0.16em]"
                          style={{ color: BRAND.textFaint }}
                        >
                          Tier range
                        </div>
                        <div
                          className="mt-2 text-sm leading-7"
                          style={{ color: "rgba(255,255,255,0.86)" }}
                        >
                          {tierRangeLabel(tier)}.{" "}
                          {mode === "prime"
                            ? "Movement inside the tier reflects how stable your market position is."
                            : "Movement inside the tier reflects how stable your visibility signals are."}
                        </div>
                      </div>
                    </div>

                    {mode === "prime" && validationRequired ? (
                      <div
                        className="mt-4 rounded-2xl px-4 py-3 text-sm"
                        style={{
                          background: "rgba(233,185,91,0.08)",
                          border: "1px solid rgba(233,185,91,0.22)",
                          color: "rgba(255,255,255,0.92)",
                        }}
                      >
                        Strong authority or dominance signals are present. Final leadership claims should still be interpreted carefully until external validation is confirmed.
                        {validationStatus ? (
                          <span style={{ color: BRAND.textDim }}>
                            {" "}({validationStatus.replaceAll("_", " ")})
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div
                    className="text-[12px] uppercase tracking-[0.18em]"
                    style={{ color: BRAND.textFaint }}
                  >
                    {mode === "prime" ? "Prime structural breakdown" : "Visibility pillars"}
                  </div>

                  <div
                    className={`mt-4 grid gap-4 ${
                      mode === "prime" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"
                    }`}
                  >
                    {pillars.map((p) => {
                      const band = (bandSource as any)?.[p.key];
                      const color =
                        mode === "prime"
                          ? BRAND.primePillars[p.key] || BRAND.accent
                          : BRAND.legacyPillars[p.key] || BRAND.accent;

                      return (
                        <PillarTile
                          key={p.key}
                          label={p.label}
                          value={p.value}
                          band={band}
                          color={color}
                          isWeakest={safeString(p.key).toLowerCase() === weakest.toLowerCase()}
                          isStrongest={safeString(p.key).toLowerCase() === strongest.toLowerCase()}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div
                      className="rounded-2xl p-4"
                      style={{ background: "rgba(0,0,0,0.14)", border: `1px solid ${BRAND.border}` }}
                    >
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: BRAND.textFaint }}>
                        Weakest signal
                      </div>
                      <div className="mt-2 text-base font-semibold">
                        {weakest ? nicePillarLabel(weakest, mode) : "—"}
                      </div>
                    </div>

                    <div
                      className="rounded-2xl p-4"
                      style={{ background: "rgba(0,0,0,0.14)", border: `1px solid ${BRAND.border}` }}
                    >
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: BRAND.textFaint }}>
                        Strongest signal
                      </div>
                      <div className="mt-2 text-base font-semibold">
                        {strongest ? nicePillarLabel(strongest, mode) : "—"}
                      </div>
                    </div>

                    <div
                      className="rounded-2xl p-4"
                      style={{ background: "rgba(0,0,0,0.14)", border: `1px solid ${BRAND.border}` }}
                    >
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: BRAND.textFaint }}>
                        Overall score
                      </div>
                      <div className="mt-2 text-base font-semibold">
                        {overallPct != null ? `${overallPct}%` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard title={secOpportunity?.title || "Your strategic opportunity"}>
                <div className="text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
                  {firstSummary(secOpportunity) ||
                    "Your next growth comes from strengthening the right structural signal — not just doing more."}
                </div>

                {paragraphSlice(secOpportunity, 4).length ? (
                  <div className="mt-4 space-y-3">
                    {paragraphSlice(secOpportunity, 4).map((line, idx) => (
                      <div key={idx} className="flex gap-3 text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                        <div style={{ color: BRAND.accent }}>↗</div>
                        <div>{line}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </GlassCard>

              <GlassCard title={secNextMove?.title || "Your most effective next move"}>
                <div className="text-sm leading-7" style={{ color: "rgba(255,255,255,0.86)" }}>
                  {firstSummary(secNextMove) ||
                    "Do not increase random activity. Strengthen the structural signal that is most limiting momentum."}
                </div>

                {paragraphSlice(secNextMove, 4).length ? (
                  <div className="mt-4 space-y-3">
                    {paragraphSlice(secNextMove, 4).map((line, idx) => (
                      <div key={idx} className="flex gap-3 text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                        <div style={{ color: BRAND.accent }}>✓</div>
                        <div>{line}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </GlassCard>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <TinyInfoCard
              title="Market reality"
              lines={
                marketRealityLines.length
                  ? marketRealityLines
                  : [
                      "Your business is visible in the market.",
                      "But the position is not yet strong enough to make you the default choice.",
                    ]
              }
              accent={BRAND.tier[tier]}
            />

            <TinyInfoCard
              title="Structural gap"
              lines={
                frictionLines.length
                  ? frictionLines
                  : [
                      `Your weakest signal is ${weakest ? nicePillarLabel(weakest, mode) : "still developing"}.`,
                      "That is where market confidence is most likely slowing down.",
                      "Strengthening that signal should become the near-term priority.",
                    ]
              }
              accent={BRAND.accent}
            />

            <TinyInfoCard
              title="Strategic direction"
              lines={
                directionLines.length
                  ? directionLines
                  : [
                      "Do not chase more activity for its own sake.",
                      "Use your next move to strengthen structural confidence.",
                      "That is how you progress tiers more cleanly.",
                    ]
              }
              accent={BRAND.accent}
            />

            {mode === "legacy" && style ? (
              <div
                className="rounded-[20px] p-5"
                style={{
                  background: "rgba(0,0,0,0.14)",
                  border: `1px solid ${BRAND.border}`,
                }}
              >
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: BRAND.textFaint }}>
                  Behaviour style
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-base font-semibold">Style {style}</div>
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-semibold"
                    style={{
                      background: `${BRAND.ab[style]}22`,
                      color: BRAND.ab[style],
                      border: `1px solid ${BRAND.ab[style]}55`,
                    }}
                  >
                    {style}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {secWelcome ? (
              <GlassCard title={secWelcome.title || "Welcome"}>
                <SectionBlocks section={secWelcome} />
              </GlassCard>
            ) : null}

            {secFramework ? (
              <GlassCard title={secFramework.title || "Framework foundation"}>
                <SectionBlocks section={secFramework} />
              </GlassCard>
            ) : null}

            {secHowToUse ? (
              <GlassCard title={secHowToUse.title || "How to use this report"}>
                <SectionBlocks section={secHowToUse} />
              </GlassCard>
            ) : null}
          </div>

          <div className="space-y-6">
            {secUnderstanding ? (
              <GlassCard title={secUnderstanding.title || "Understanding the framework"}>
                <SectionBlocks section={secUnderstanding} />
              </GlassCard>
            ) : null}

            {secTiers ? (
              <GlassCard title={secTiers.title || "How tiers and levels work"}>
                <SectionBlocks section={secTiers} />
              </GlassCard>
            ) : null}

            {mode === "legacy" && secBehaviourProfiles ? (
              <GlassCard title={secBehaviourProfiles.title || "Behaviour profiles"}>
                <SectionBlocks section={secBehaviourProfiles} />
              </GlassCard>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {secStrengths ? (
            <GlassCard title={secStrengths.title || "What is already working"}>
              <SectionBlocks section={secStrengths} />
            </GlassCard>
          ) : null}

          {secFriction ? (
            <GlassCard title={secFriction.title || "Where friction exists"}>
              <SectionBlocks section={secFriction} />
            </GlassCard>
          ) : null}

          {secMarket ? (
            <GlassCard title={secMarket.title || "How the market is experiencing you"}>
              <SectionBlocks section={secMarket} />
            </GlassCard>
          ) : null}

          {secLevelMeaning ? (
            <GlassCard title={secLevelMeaning.title || "What your current level means"}>
              <SectionBlocks section={secLevelMeaning} />
            </GlassCard>
          ) : null}

          {secPillars ? (
            <GlassCard
              title={
                secPillars.title ||
                (mode === "prime" ? "Your Prime pillars" : "Your visibility pillars")
              }
              subtitle={
                mode === "prime"
                  ? "Visibility, Trust, Authority, and Dominance show how strong your market structure is."
                  : "Discoverability, Trust, and Conversion show where visibility is working and where it breaks down."
              }
            >
              <div className={`mt-4 grid gap-4 ${mode === "prime" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                {pillars.map((p) => {
                  const band = (bandSource as any)?.[p.key];
                  const color =
                    mode === "prime"
                      ? BRAND.primePillars[p.key] || BRAND.accent
                      : BRAND.legacyPillars[p.key] || BRAND.accent;

                  return (
                    <PillarTile
                      key={p.key}
                      label={p.label}
                      value={p.value}
                      band={band}
                      color={color}
                      isWeakest={safeString(p.key).toLowerCase() === weakest.toLowerCase()}
                      isStrongest={safeString(p.key).toLowerCase() === strongest.toLowerCase()}
                    />
                  );
                })}
              </div>

              <SectionBlocks section={secPillars} />
            </GlassCard>
          ) : null}

          {secPossibleNext ? (
            <GlassCard title={secPossibleNext.title || "What becomes possible next"}>
              <SectionBlocks section={secPossibleNext} />
            </GlassCard>
          ) : null}
        </div>

        <InsightsCard ai={ai} error={aiError || null} />

        {remainingSections.length ? (
          <GlassCard title="Additional report sections">
            <div className="mt-4 space-y-6">
              {remainingSections.map((s) => (
                <GlassCard key={s.key} title={s.title || s.key}>
                  <SectionBlocks section={s} />
                </GlassCard>
              ))}
            </div>
          </GlassCard>
        ) : null}

        {secClosing ? (
          <GlassCard title={secClosing.title || "Closing"}>
            <SectionBlocks section={secClosing} />
          </GlassCard>
        ) : null}

        <div className="text-xs px-1" style={{ color: BRAND.textFaint }}>
          engine: {safeString(kbReport.engine_key || "visibility_v1")} • v{kbReport.version ?? 1} • mode: {mode}
        </div>
      </div>
    </Shell>
  );
}