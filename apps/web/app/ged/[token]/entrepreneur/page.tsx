// apps/web/app/ged/[token]/entrepreneur/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QscMatrix } from "@/app/qsc/QscMatrix";
import AppBackground from "@/components/ui/AppBackground";
import type {
  GedDiagnostics,
  GedEngineDiagnostic,
  GedImpactLevel,
} from "@/lib/ged/scoreGedDiagnostic";

type PersonalityKey = "FIRE" | "FLOW" | "FORM" | "FIELD";
type MindsetKey = "ORIGIN" | "MOMENTUM" | "VECTOR" | "ORBIT" | "QUANTUM";

type PersonalityPercMap = Partial<Record<PersonalityKey, number>>;
type MindsetPercMap = Partial<Record<MindsetKey, number>>;

type QscResultsRow = {
  id: string;
  test_id: string;
  token: string;
  audience: "entrepreneur" | "leader" | null;
  personality_totals: Record<string, number> | null;
  personality_percentages: PersonalityPercMap | null;
  mindset_totals: Record<string, number> | null;
  mindset_percentages: MindsetPercMap | null;
  primary_personality: PersonalityKey | null;
  secondary_personality: PersonalityKey | null;
  primary_mindset: MindsetKey | null;
  secondary_mindset: MindsetKey | null;
  combined_profile_code: string | null;
  qsc_profile_id: string | null;
  created_at: string;
};

type QscProfileRow = {
  id: string;
  profile_label: string | null;
  how_to_communicate: string | null;
  decision_style: string | null;
  business_challenges: string | null;
  trust_signals: string | null;
  offer_fit: string | null;
  sale_blockers: string | null;
};

type QscPersonaRow = {
  profile_label: string | null;
  energisers: string | null;
  drains: string | null;
  combined_strengths: string | null;
  combined_risks: string | null;
  combined_big_lever: string | null;
  emotional_stabilises: string | null;
  emotional_destabilises: string | null;
  support_yourself: string | null;
  strategic_priority_1: string | null;
  strategic_priority_2: string | null;
  strategic_priority_3: string | null;
};

type QscTakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  role_title: string | null;
};

type LinkMeta = {
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  next_steps_url?: string | null;
  email_report?: boolean | null;
};

type GedPayload = {
  results: QscResultsRow;
  profile: QscProfileRow | null;
  persona: QscPersonaRow | null;
  taker: QscTakerRow | null;
  link: LinkMeta | null;
  ged: {
    submission_id: string | null;
    submission_created_at: string | null;
    diagnostics: GedDiagnostics;
    engine_diagnostic: GedEngineDiagnostic | null;
  } | null;
};

const PERSONALITY_LABELS: Record<PersonalityKey, string> = {
  FIRE: "Fire",
  FLOW: "Flow",
  FORM: "Form",
  FIELD: "Field",
};

const MINDSET_LABELS: Record<MindsetKey, string> = {
  ORIGIN: "Origin",
  MOMENTUM: "Momentum",
  VECTOR: "Vector",
  ORBIT: "Orbit",
  QUANTUM: "Quantum",
};

const FREQUENCY_COLORS: Record<PersonalityKey, string> = {
  FIRE: "#f97316",
  FLOW: "#0ea5e9",
  FORM: "#22c55e",
  FIELD: "#a855f7",
};

const MINDSET_COLORS: Record<MindsetKey, string> = {
  ORIGIN: "#f59e0b",
  MOMENTUM: "#38bdf8",
  VECTOR: "#45e0d1",
  ORBIT: "#818cf8",
  QUANTUM: "#c084fc",
};

const REPORT_ICON_BASE = "/ged/report-icons";

const SECTION_ICON_PATHS = {
  quantum_profile_matrix: `${REPORT_ICON_BASE}/section-icons/quantum-profile-matrix.png`,
  understand_quantum_profile: `${REPORT_ICON_BASE}/section-icons/understand-quantum-profile-graphic.png`,
  personality_layer: `${REPORT_ICON_BASE}/section-icons/personality-layer.png`,
  mindset_layer: `${REPORT_ICON_BASE}/section-icons/mindset-layer.png`,
  combined_pattern: `${REPORT_ICON_BASE}/section-icons/combined-pattern.png`,
  emotional_alignment: `${REPORT_ICON_BASE}/section-icons/emotional-operational-alignment.png`,
  business_context: `${REPORT_ICON_BASE}/section-icons/business-context.png`,
  engine_scorecard: `${REPORT_ICON_BASE}/section-icons/engine-scorecard.png`,
  primary_bottleneck: `${REPORT_ICON_BASE}/section-icons/primary-bottleneck.png`,
  what_this_means: `${REPORT_ICON_BASE}/section-icons/what-this-means.png`,
  revenue_impact: `${REPORT_ICON_BASE}/section-icons/your-revenue-impact.png`,
  focus_plan: `${REPORT_ICON_BASE}/section-icons/30-day-focus-plan.png`,
  executive_summary: `${REPORT_ICON_BASE}/section-icons/one-page-executive-summary.png`,
  recommended_next_steps: `${REPORT_ICON_BASE}/section-icons/recommended-next-steps.png`,
} as const;

const UNDERSTAND_QUANTUM_PROFILE_GRAPH = `${REPORT_ICON_BASE}/graphics/understand-quantum-profile-graph.png`;
const MINDSET_LAYER_INFOGRAPHIC = `${REPORT_ICON_BASE}/graphics/mindset-layer-infographic.png`;
const QUANTUM_PROFILE_MIX_ICON_BASE = `${REPORT_ICON_BASE}/quantum-profile-matrix`;

const BUSINESS_CONTEXT_ICON_PATHS = {
  businessStage: `${REPORT_ICON_BASE}/business-context/business-stage.png`,
  coreConstraint: `${REPORT_ICON_BASE}/business-context/core-constraint.png`,
  scaleReadiness: `${REPORT_ICON_BASE}/business-context/scale-readiness.png`,
  strategicSelfDiagnosis: `${REPORT_ICON_BASE}/business-context/strategic-self-diagnosis.png`,
} as const;

const PRIMARY_BOTTLENECK_ICON_PATHS = {
  bottleneck: `${REPORT_ICON_BASE}/primary-bottle-neck-section/executive-layer-gap.png`,
  revenueImpact: `${REPORT_ICON_BASE}/primary-bottle-neck-section/revenue-impact.png`,
  urgencyWindow: `${REPORT_ICON_BASE}/primary-bottle-neck-section/urgency-window.png`,
  solvability: `${REPORT_ICON_BASE}/primary-bottle-neck-section/solvability.png`,
} as const;

const BUSINESS_STAGE_LADDER = [
  { code: "FOUNDER_LED", label: "Founder-led", height: 30 },
  { code: "SMALL_TEAM_BOTTLENECK", label: "Small team", height: 48 },
  { code: "DELEGATED_PARTIAL", label: "Delegated", height: 70 },
  { code: "INCONSISTENT_TEAM", label: "Inconsistent", height: 88 },
] as const;

const CONSTRAINT_SIGNAL_CHIPS = [
  { code: "SALES_CONSISTENCY", label: "Sales consistency" },
  { code: "DELIVERY_CONSISTENCY", label: "Delivery consistency" },
  { code: "FOUNDER_DEPENDENCY", label: "Founder dependency" },
  { code: "UNCLEAR", label: "Clarity gap" },
] as const;

type MindsetStageCopy = {
  intro: string;
  description: string;
  accent: string;
};

const MINDSET_STAGE_COPY: Record<MindsetKey, MindsetStageCopy> = {
  QUANTUM: {
    intro:
      "You are operating from a place of long-term influence, innovation and compounding impact. The next focus is protecting the architecture that lets your ambition scale beyond your direct involvement.",
    description: "Peak performance. Legacy, innovation and exponential impact.",
    accent: "#a77af8",
  },
  ORBIT: {
    intro:
      "You have established direction and are expanding your influence. The next focus is optimising operations, deepening leadership capacity and growing impact without creating unnecessary complexity.",
    description:
      "Expanding influence. Optimizing operations and growing impact.",
    accent: "#77c3fc",
  },
  VECTOR: {
    intro:
      "You've built momentum and proven your offer. Now the focus is on scaling systems, building team and creating lasting impact.",
    description:
      "Clear direction established. Scaling systems and strengthening positioning.",
    accent: "#00cac3",
  },
  MOMENTUM: {
    intro:
      "You are moving beyond the starting point and beginning to create repeatable traction. The next focus is building consistency, proving direction and protecting the habits that sustain momentum.",
    description:
      "Early traction phase. Building consistency and proving direction.",
    accent: "#56a8e2",
  },
  ORIGIN: {
    intro:
      "You are laying the first foundations for sustainable growth. The next focus is clarifying direction, validating the path forward and creating enough structure for momentum to build.",
    description:
      "The starting point. Laying the foundation for what's possible.",
    accent: "#899dc0",
  },
};

const MINDSET_STAGE_ORDER: MindsetKey[] = [
  "QUANTUM",
  "ORBIT",
  "VECTOR",
  "MOMENTUM",
  "ORIGIN",
];

type QuantumProfileMix = {
  personality: PersonalityKey;
  mindset: MindsetKey;
  label: string;
  title: string;
  description: string;
  color: string;
};

const QUANTUM_PROFILE_MIXES: QuantumProfileMix[] = [
  {
    personality: "FIRE",
    mindset: "ORIGIN",
    label: "Fire Origin",
    title: "Activation Entrepreneur",
    description:
      "Drives through energy, urgency, and visible action. Creates momentum where none exists.",
    color: "#f97316",
  },
  {
    personality: "FLOW",
    mindset: "MOMENTUM",
    label: "Flow Momentum",
    title: "Adaptive Entrepreneur",
    description:
      "Moves with market signals, pivots intelligently, and builds through relationships and trust.",
    color: "#0ea5e9",
  },
  {
    personality: "FORM",
    mindset: "VECTOR",
    label: "Form Vector",
    title: "Structural Entrepreneur",
    description:
      "Builds with precision and systems. Creates the operational foundations that scale requires.",
    color: "#22c55e",
  },
  {
    personality: "FIELD",
    mindset: "ORBIT",
    label: "Field Orbit",
    title: "Ecosystem Entrepreneur",
    description:
      "Creates through networks, positioning, and strategic ecosystem building at scale.",
    color: "#a855f7",
  },
];

function normalisePercent(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  if (raw > 0 && raw <= 1.5) return Math.min(100, Math.max(0, raw * 100));
  return Math.min(100, Math.max(0, raw));
}

function getFullName(taker: QscTakerRow | null): string | null {
  if (!taker) return null;
  const name = `${taker.first_name || ""} ${taker.last_name || ""}`.trim();
  return name || taker.email?.trim() || null;
}

function derivePrimary<K extends string>(
  values: Partial<Record<K, number>>,
  keys: readonly K[],
): K | null {
  const winner = [...keys]
    .map((key) => ({ key, value: normalisePercent(values[key] ?? 0) }))
    .sort((a, b) => b.value - a.value)[0];

  return winner && winner.value > 0 ? winner.key : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTone(score: number): string {
  if (score >= 72) return "text-emerald-600";
  if (score >= 48) return "text-amber-600";
  return "text-rose-600";
}

function scoreAccent(score: number): string {
  if (score >= 72) return "#16a34a";
  if (score >= 48) return "#d97706";
  return "#dc2626";
}

function scoreFunnelState(score: number): { status: string; color: string } {
  const safeScore = clampPercent(score);
  if (safeScore >= 72) return { status: "Strong ✓", color: "#16a34a" };
  if (safeScore >= 48) return { status: "Moderate", color: "#d97706" };
  if (safeScore >= 32) return { status: "Weak", color: "#ea580c" };
  return { status: "⚠ Critical gap", color: "#dc2626" };
}

function dependencyFunnelState(dependency: number): {
  status: string;
  color: string;
} {
  const safeDependency = clampPercent(dependency);
  if (safeDependency >= 75)
    return { status: "⚠ Critical gap", color: "#dc2626" };
  if (safeDependency >= 58)
    return { status: "High dependency", color: "#dc2626" };
  if (safeDependency >= 40)
    return { status: "Moderate dependency", color: "#d97706" };
  return { status: "Low dependency", color: "#16a34a" };
}

function impactAccent(level: GedImpactLevel): string {
  if (level === "critical") return "#dc2626";
  if (level === "significant") return "#ea580c";
  if (level === "moderate") return "#d97706";
  return "#16a34a";
}

function urgencyAccent(level: GedEngineDiagnostic["urgency"]["level"]): string {
  if (level === "high") return "#d97706";
  if (level === "moderate") return "#ea580c";
  return "#16a34a";
}

function impactLabel(level: GedImpactLevel): string {
  if (level === "critical") return "Critical";
  if (level === "significant") return "Significant";
  if (level === "moderate") return "Moderate";
  return "Low";
}

function priorityTheme(
  priority: GedEngineDiagnostic["primary_priority"] | undefined,
) {
  switch (priority) {
    case "SALES_ENGINE_PRIORITY":
      return {
        accent: "text-orange-600",
        chip: "border-orange-200 bg-orange-50 text-orange-700",
        hero: "from-orange-500/15 via-amber-400/10 to-transparent",
      };
    case "DELIVERY_ENGINE_PRIORITY":
      return {
        accent: "text-emerald-600",
        chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
        hero: "from-emerald-500/15 via-teal-400/10 to-transparent",
      };
    case "SCALE_READINESS_GAP":
      return {
        accent: "text-amber-600",
        chip: "border-amber-200 bg-amber-50 text-amber-700",
        hero: "from-amber-500/15 via-orange-400/10 to-transparent",
      };
    case "BALANCED_ENGINE_PRIORITY":
    default:
      return {
        accent: "text-cyan-700",
        chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
        hero: "from-cyan-500/15 via-sky-400/10 to-transparent",
      };
  }
}

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AssetIcon({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return <img src={src} alt={alt} className={className} />;
}

function SectionMarker({
  icon,
  eyebrow,
  title,
  body,
  dark = false,
  compact = false,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  body?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/30">
        <AssetIcon src={icon} className="h-7 w-7 object-contain" />
      </div>
      <div className="min-w-0">
        <p
          className={`text-[0.67rem] font-bold uppercase tracking-[0.22em] ${dark ? "text-emerald-300" : "text-cyan-700"}`}
        >
          {eyebrow}
        </p>
        <h2
          className={[
            "mt-1 font-extrabold tracking-tight",
            compact ? "text-xl leading-7" : "text-2xl md:text-[2rem]",
            dark ? "text-white" : "text-[#111827]",
          ].join(" ")}
        >
          {title}
        </h2>
        {body ? (
          <p
            className={[
              "mt-2 max-w-4xl",
              compact ? "text-sm leading-5" : "text-sm leading-6",
              dark ? "text-slate-300" : "text-slate-600",
            ].join(" ")}
          >
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContentCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </article>
  );
}

function DarkContentCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-xl border border-white/10 bg-white/[0.035] p-5 ${className}`}
    >
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-300">{children}</div>
    </article>
  );
}

function Meter({
  label,
  score,
  accent = "#22c55e",
  caption,
}: {
  label: string;
  score: number;
  accent?: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-sm font-bold tabular-nums" style={{ color: accent }}>
          {clampPercent(score)}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${clampPercent(score)}%`, backgroundColor: accent }}
        />
      </div>
      {caption ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{caption}</p>
      ) : null}
    </div>
  );
}

function FrequencyDonut({
  data,
}: {
  data: { key: PersonalityKey; value: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 55;
  const stroke = 17;
  const center = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg
      viewBox="0 0 144 144"
      className="h-40 w-40 shrink-0"
      aria-label="Personality distribution"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="rgba(148,163,184,0.18)"
        strokeWidth={stroke}
        fill="transparent"
      />
      {data.map((item) => {
        const dash = (item.value / total) * circumference;
        const node = (
          <circle
            key={item.key}
            cx={center}
            cy={center}
            r={radius}
            stroke={FREQUENCY_COLORS[item.key]}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
        offset -= dash;
        return node;
      })}
      <circle cx={center} cy={center} r={35} fill="#0c1d1a" />
      <text
        x={center}
        y={68}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="8"
        letterSpacing="1.4"
      >
        PERSONALITY
      </text>
      <text
        x={center}
        y={79}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="8"
        letterSpacing="1.4"
      >
        LAYER
      </text>
    </svg>
  );
}

function LightFrequencyDonut({
  data,
  primaryKey,
}: {
  data: { key: PersonalityKey; value: number }[];
  primaryKey: PersonalityKey | null;
}) {
  const displayColors: Record<PersonalityKey, string> = {
    FIRE: "#d6580b",
    FLOW: "#34d399",
    FORM: "#ffb347",
    FIELD: "#e5e7eb",
  };
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 52;
  const stroke = 13;
  const center = 68;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const primaryValue = primaryKey
    ? Math.round(data.find((item) => item.key === primaryKey)?.value || 0)
    : 0;
  const primaryLabel = primaryKey ? PERSONALITY_LABELS[primaryKey] : "—";

  return (
    <svg
      viewBox="0 0 136 136"
      className="h-40 w-40 shrink-0 sm:h-44 sm:w-44"
      aria-label="Frequency distribution"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="#e5e7eb"
        strokeWidth={stroke}
        fill="transparent"
      />
      {data.map((item) => {
        const dash = (item.value / total) * circumference;
        const node =
          dash > 0 ? (
            <circle
              key={item.key}
              cx={center}
              cy={center}
              r={radius}
              stroke={displayColors[item.key]}
              strokeWidth={stroke}
              fill="transparent"
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${center} ${center})`}
            />
          ) : null;
        offset -= dash;
        return node;
      })}
      <circle cx={center} cy={center} r={34} fill="#ffffff" />
      <text
        x={center}
        y="64"
        textAnchor="middle"
        fill="#1a1a1a"
        fontSize="16"
        fontWeight="800"
      >
        {primaryLabel}
      </text>
      <text
        x={center}
        y="83"
        textAnchor="middle"
        fill="#4b5563"
        fontSize="14"
        fontWeight="500"
      >
        {primaryValue}%
      </text>
    </svg>
  );
}

function PersonalityFrequencyPanel({
  data,
  primaryKey,
}: {
  data: { key: PersonalityKey; value: number }[];
  primaryKey: PersonalityKey | null;
}) {
  const displayColors: Record<PersonalityKey, string> = {
    FIRE: "#d6580b",
    FLOW: "#34d399",
    FORM: "#ffb347",
    FIELD: "#e5e7eb",
  };

  return (
    <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#4b5563]">
        Frequency distribution
      </p>

      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
        <LightFrequencyDonut data={data} primaryKey={primaryKey} />

        <div className="w-full max-w-[10rem] space-y-2.5">
          {data.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: displayColors[item.key] }}
              />
              <span className="flex-1 font-semibold text-[#1a1a1a]">
                {PERSONALITY_LABELS[item.key]}
              </span>
              <span className="tabular-nums font-bold text-[#4b5563]">
                {Math.round(item.value)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3.5">
        {data.map((item) => (
          <div
            key={item.key}
            className="grid grid-cols-[42px_minmax(0,1fr)_30px] items-center gap-3 text-xs"
          >
            <span className="font-semibold text-[#1a1a1a]">
              {PERSONALITY_LABELS[item.key]}
            </span>
            <div className="h-2.5 overflow-hidden rounded bg-[#e5e7eb]">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max(0, Math.min(100, item.value))}%`,
                  backgroundColor: displayColors[item.key],
                }}
              />
            </div>
            <span className="text-right font-bold tabular-nums text-[#1a1a1a]">
              {Math.round(item.value)}%
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ScoreRing({
  score,
  light = false,
}: {
  score: number;
  light?: boolean;
}) {
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  const dash = (clampPercent(score) / 100) * circumference;
  const scoreColor = light ? "#1a1a1a" : "#f8fafc";
  const labelColor = light ? "#4b5563" : "#94a3b8";

  return (
    <svg
      viewBox="0 0 132 132"
      className="h-36 w-36"
      aria-label={`Overall engine score: ${score}%`}
    >
      <circle
        cx="66"
        cy="66"
        r={radius}
        stroke={light ? "#e5e7eb" : "rgba(148,163,184,0.20)"}
        strokeWidth="10"
        fill="transparent"
      />
      <circle
        cx="66"
        cy="66"
        r={radius}
        stroke="#34d399"
        strokeWidth="10"
        fill="transparent"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 66 66)"
      />
      <text
        x="66"
        y="66"
        textAnchor="middle"
        fill={scoreColor}
        fontSize="23"
        fontWeight="800"
      >
        {clampPercent(score)}%
      </text>
      <text
        x="66"
        y="82"
        textAnchor="middle"
        fill={labelColor}
        fontSize="8"
        letterSpacing="1.2"
      >
        ENGINE HEALTH
      </text>
    </svg>
  );
}

function RocketGlyph({ color = "#45e0d1" }: { color?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-7 w-7" fill="none">
      <path
        d="M29.9 6.2c4.8 1.5 8.4 5.1 9.9 9.9-2.5 7.3-7.2 13.9-13.5 18.8l-6.4-6.4c4.9-6.3 11.5-11 18.8-13.5Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m19.9 28.5-5.7 5.7m9.9-1.8-3 7.5m-5.7-11.4-7.5 3"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31.1" cy="14.9" r="2.2" fill={color} />
    </svg>
  );
}

function QuantumProfileVisual({
  personalityLabel,
  mindsetLabel,
  profileLabel,
  personalityColor,
  mindsetColor,
  personalityIcon,
  mindsetIcon,
}: {
  personalityLabel: string;
  mindsetLabel: string;
  profileLabel: string;
  personalityColor: string;
  mindsetColor: string;
  personalityIcon: string;
  mindsetIcon: string;
}) {
  return (
    <section
      aria-label="Quantum Profile"
      className="rounded-2xl border border-amber-400/30 bg-[#0a211c] p-4 shadow-inner shadow-black/20 md:p-5"
    >
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
        Quantum Profile
      </p>

      <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div
          className="relative h-28 w-[196px] shrink-0"
          aria-label={`${personalityLabel} and ${mindsetLabel}`}
        >
          <div
            className="absolute left-0 top-0 flex h-28 w-28 flex-col items-center justify-center rounded-full border-[1.5px] bg-[#0c1d1a]"
            style={{ borderColor: personalityColor }}
          >
            <AssetIcon
              src={personalityIcon}
              className="h-7 w-7 object-contain"
            />
            <span
              className="mt-1 text-lg font-extrabold"
              style={{ color: personalityColor }}
            >
              {personalityLabel}
            </span>
          </div>

          <div
            className="absolute left-[76px] top-0 flex h-28 w-28 flex-col items-center justify-center rounded-full border-[1.5px] bg-[#0c1d1a]"
            style={{ borderColor: mindsetColor }}
          >
            <AssetIcon src={mindsetIcon} className="h-7 w-7 object-contain" />
            <span
              className="mt-1 text-lg font-extrabold"
              style={{ color: mindsetColor }}
            >
              {mindsetLabel}
            </span>
          </div>
        </div>

        <div
          className="hidden h-px flex-1 bg-white/35 xl:block"
          aria-hidden="true"
        />
        <span
          className="hidden text-2xl text-slate-300 xl:block"
          aria-hidden="true"
        >
          →
        </span>

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-300/5">
            <RocketGlyph color="#45e0d1" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-200">Your Result</p>
            <p className="mt-0.5 text-lg font-extrabold leading-tight md:text-xl">
              <span style={{ color: personalityColor }}>
                {personalityLabel}
              </span>{" "}
              <span style={{ color: mindsetColor }}>{mindsetLabel}</span>
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">
              {profileLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuantumProfileDiagram() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5 md:p-7">
      <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl bg-white sm:min-h-[360px] md:min-h-[460px]">
        <AssetIcon
          src={UNDERSTAND_QUANTUM_PROFILE_GRAPH}
          alt="Quantum Profile diagram"
          className="h-auto w-full max-w-[980px] object-contain"
        />
      </div>
    </div>
  );
}

function QuantumProfileMixCard({
  mix,
  isPrimary,
}: {
  mix: QuantumProfileMix;
  isPrimary: boolean;
}) {
  return (
    <article
      className="relative min-h-[236px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      style={{ borderTopWidth: "6px", borderTopColor: mix.color }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: mix.color }}
      >
        <AssetIcon
          src={`${QUANTUM_PROFILE_MIX_ICON_BASE}/${mix.personality.toLowerCase()}.png`}
          alt=""
          className="h-7 w-7 object-contain"
        />
      </div>

      <p className="mt-4 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-slate-500">
        {mix.label}
      </p>
      <h3 className="mt-2 max-w-[12rem] text-lg font-extrabold leading-6 text-[#0c1d1a]">
        {mix.title}
      </h3>
      <p className="mt-3 text-xs leading-5 text-slate-500">{mix.description}</p>

      {isPrimary ? (
        <span className="absolute bottom-5 left-5 rounded-full bg-[#2fe6ac] px-3 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-white">
          Your Primary
        </span>
      ) : null}
    </article>
  );
}

type ReportIndexItem = {
  href: string;
  label: string;
};

function ReportIndex({
  items,
  onDownloadPdf,
  downloading,
  nextStepsHref,
}: {
  items: ReportIndexItem[];
  onDownloadPdf: () => void;
  downloading: boolean;
  nextStepsHref: string | null;
}) {
  function handleInReportNavigation(
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (!href.startsWith("#")) return;

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", href);
    }
  }

  const nextStepsIsExternal = Boolean(nextStepsHref);
  const resolvedNextStepsHref = nextStepsHref || "#recommended-next-steps";

  return (
    <aside className="hidden self-start xl:block">
      <div className="sticky top-6 w-[240px] rounded-[24px] border border-white/[0.12] bg-[#0C1D1A] p-[14px] text-white shadow-2xl shadow-black/25">
        <p className="px-1 text-[10px] font-normal uppercase leading-[15px] tracking-[0.24em] text-white">
          Report Index
        </p>

        <nav aria-label="Report Index" className="mt-3 space-y-[6px]">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(event) => handleInReportNavigation(event, item.href)}
              className="flex min-h-[40px] items-center rounded-[12px] border border-white px-[12px] py-2 text-[12px] leading-5 text-white transition hover:border-emerald-300 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mt-5 space-y-[7px]">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={downloading}
            className="flex h-8 w-[122px] items-center justify-center rounded-[6px] border border-white/[0.12] bg-[#34D399] px-3 text-[12px] font-semibold leading-[14.72px] text-slate-50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? "Preparing…" : "Download PDF"}
          </button>

          <a
            href={resolvedNextStepsHref}
            target={nextStepsIsExternal ? "_blank" : undefined}
            rel={nextStepsIsExternal ? "noopener noreferrer" : undefined}
            onClick={(event) =>
              handleInReportNavigation(event, resolvedNextStepsHref)
            }
            className="flex h-7 w-[95px] items-center justify-center rounded-[5.62px] bg-gradient-to-r from-[#FFB347] via-[#34D399] to-[#34D399] px-3 text-[12px] font-semibold leading-[13.69px] text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          >
            Next steps
          </a>
        </div>
      </div>
    </aside>
  );
}

export default function GedEntrepreneurStrategicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const searchParams = useSearchParams();
  const tid = searchParams?.get("tid") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<GedPayload | null>(null);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const query = new URLSearchParams();
        if (tid) query.set("tid", tid);

        const response = await fetch(
          `/api/public/ged/${encodeURIComponent(token)}/result?${query.toString()}`,
          { cache: "no-store" },
        );

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await response.text();
          throw new Error(
            `Non-JSON response (${response.status}): ${text.slice(0, 180)}`,
          );
        }

        const json = (await response.json()) as {
          ok?: boolean;
          error?: string;
          results?: QscResultsRow;
          profile?: QscProfileRow | null;
          persona?: QscPersonaRow | null;
          taker?: QscTakerRow | null;
          link?: LinkMeta | null;
          ged?: GedPayload["ged"];
        };

        if (!response.ok || json.ok === false || !json.results) {
          throw new Error(json.error || `HTTP ${response.status}`);
        }

        if (alive) {
          setPayload({
            results: json.results,
            profile: json.profile ?? null,
            persona: json.persona ?? null,
            taker: json.taker ?? null,
            link: json.link ?? null,
            ged: json.ged ?? null,
          });
        }
      } catch (cause: any) {
        if (alive) setError(String(cause?.message || cause || "Unknown error"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tid, token]);

  async function handleDownloadPdf() {
    if (!reportRef.current || downloading) return;

    try {
      setDownloading(true);
      const report = reportRef.current;
      const units = Array.from(
        report.querySelectorAll<HTMLElement>("[data-ged-pdf-page]"),
      );
      const pages = units.length ? units : [report];
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      let isFirstPdfPage = true;

      for (const page of pages) {
        const canvas = await html2canvas(page, {
          backgroundColor: "#09141d",
          scale: 2,
          useCORS: true,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
          logging: false,
        });

        const imageWidth = pdfPageWidth;
        const imageHeight = (canvas.height * imageWidth) / canvas.width;
        const imageData = canvas.toDataURL("image/png");
        let renderedHeight = 0;

        while (renderedHeight < imageHeight) {
          if (!isFirstPdfPage) pdf.addPage();
          pdf.addImage(
            imageData,
            "PNG",
            0,
            -renderedHeight,
            imageWidth,
            imageHeight,
          );
          renderedHeight += pdfPageHeight;
          isFirstPdfPage = false;
        }
      }

      pdf.save(`growth-engine-diagnostic-${token}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  const result = payload?.results ?? null;
  const persona = payload?.persona ?? null;
  const taker = payload?.taker ?? null;
  const diagnostic = payload?.ged?.engine_diagnostic ?? null;

  const personalityPercentages = useMemo<
    Partial<Record<PersonalityKey, number>>
  >(() => {
    const raw = result?.personality_percentages || {};
    return {
      FIRE: normalisePercent(raw.FIRE),
      FLOW: normalisePercent(raw.FLOW),
      FORM: normalisePercent(raw.FORM),
      FIELD: normalisePercent(raw.FIELD),
    };
  }, [result]);

  const mindsetPercentages = useMemo<
    Partial<Record<MindsetKey, number>>
  >(() => {
    const raw = result?.mindset_percentages || {};
    return {
      ORIGIN: normalisePercent(raw.ORIGIN),
      MOMENTUM: normalisePercent(raw.MOMENTUM),
      VECTOR: normalisePercent(raw.VECTOR),
      ORBIT: normalisePercent(raw.ORBIT),
      QUANTUM: normalisePercent(raw.QUANTUM),
    };
  }, [result]);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#09141d] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">
            Growth Engine Diagnostic
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Preparing your Strategic Client Report…
          </h1>
        </main>
      </div>
    );
  }

  if (error || !result || !diagnostic) {
    return (
      <div className="relative min-h-screen bg-[#09141d] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-4xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">
            Growth Engine Diagnostic
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            We could not prepare this report
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            The Strategic Client Report needs the GED qualification answers as
            well as the QSC result. Please complete the diagnostic again or
            contact the person who sent you this link.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            {error || "GED diagnostic data was not available for this report."}
          </pre>
        </main>
      </div>
    );
  }

  const derivedPersonality = derivePrimary(personalityPercentages, [
    "FIRE",
    "FLOW",
    "FORM",
    "FIELD",
  ]);
  const derivedMindset = derivePrimary(mindsetPercentages, [
    "ORIGIN",
    "MOMENTUM",
    "VECTOR",
    "ORBIT",
    "QUANTUM",
  ]);

  // Stored QSC result is the source of truth; percentages are only a compatibility fallback.
  const primaryPersonality = result.primary_personality || derivedPersonality;
  const primaryMindset = result.primary_mindset || derivedMindset;
  const primaryPersonalityLabel = primaryPersonality
    ? PERSONALITY_LABELS[primaryPersonality]
    : "—";
  const primaryMindsetLabel = primaryMindset
    ? MINDSET_LABELS[primaryMindset]
    : "—";
  const canonicalProfile =
    `${primaryPersonalityLabel} ${primaryMindsetLabel}`.trim();
  const secondaryProfile =
    result.secondary_personality || result.secondary_mindset
      ? `${result.secondary_personality ? PERSONALITY_LABELS[result.secondary_personality] : ""} ${
          result.secondary_mindset
            ? MINDSET_LABELS[result.secondary_mindset]
            : ""
        }`.trim()
      : null;

  const name = getFullName(taker);
  const company = taker?.company?.trim() || null;
  const role = taker?.role_title?.trim() || null;
  const nextStepsHref =
    (
      payload?.link?.next_steps_url ||
      payload?.link?.redirect_url ||
      ""
    ).trim() || null;
  const createdAt = humanDate(result.created_at);
  const theme = priorityTheme(diagnostic.primary_priority);

  const frequencyData = (
    ["FIRE", "FLOW", "FORM", "FIELD"] as PersonalityKey[]
  ).map((key) => ({
    key,
    value: personalityPercentages[key] || 0,
  }));

  const strategicPriorities = [
    persona?.strategic_priority_1,
    persona?.strategic_priority_2,
    persona?.strategic_priority_3,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const indexItems: ReportIndexItem[] = [
    { href: "#quantum-profile-matrix", label: "Buyers Persona Matrix" },
    { href: "#personality-layer", label: "Your Personality layer" },
    {
      href: "#understand-quantum-profile",
      label: "Understand the quantum profile",
    },
    { href: "#mindset-layer", label: "Your mindset layer" },
    { href: "#combined-pattern", label: "Your combined quantum pattern" },
    {
      href: "#one-page-quantum-profile",
      label: "Your strategic growth priorities",
    },
    { href: "#focus-plan", label: "Your 30-day action plan" },
    { href: "#growth-roadmap", label: "Your growth roadmap" },
    {
      href: "#communication-decision-style",
      label: "Your communication and decision style",
    },
    { href: "#reflection-prompts", label: "Your reflection prompts" },
    { href: "#executive-summary", label: "Your one-page quantum summary" },
    { href: "#executive-summary", label: "Executive summary" },
  ];

  const personaIcon = primaryPersonality
    ? `${REPORT_ICON_BASE}/4-profile-icons/${primaryPersonality.toLowerCase()}.png`
    : `${REPORT_ICON_BASE}/4-profile-icons/fire.png`;
  const mindsetIcon = primaryMindset
    ? `${REPORT_ICON_BASE}/quantum-profile-matrix/${primaryMindset.toLowerCase()}.png`
    : `${REPORT_ICON_BASE}/quantum-profile-matrix/vector.png`;
  const primaryPersonalityColor = primaryPersonality
    ? FREQUENCY_COLORS[primaryPersonality]
    : "#f97316";
  const primaryMindsetColor = primaryMindset
    ? MINDSET_COLORS[primaryMindset]
    : "#45e0d1";
  const mindsetStageCopy = primaryMindset
    ? MINDSET_STAGE_COPY[primaryMindset]
    : MINDSET_STAGE_COPY.VECTOR;

  const onePageIconBase = `${REPORT_ICON_BASE}/one-page-quantum-section`;
  const onePageIcons = {
    personality: `${onePageIconBase}/personality.png`,
    mindsetStage: `${onePageIconBase}/mindset-stage.png`,
    strengths: `${onePageIconBase}/your-strengths.png`,
    priorities: `${onePageIconBase}/top-strength-priorities.png`,
  };

  const displayReadinessLevel =
    diagnostic.scale_readiness_level.charAt(0).toUpperCase() +
    diagnostic.scale_readiness_level.slice(1);

  const readinessStyle =
    diagnostic.scale_readiness_level === "high"
      ? {
          border: "border-emerald-400/70",
          text: "text-emerald-300",
          meter: "#34d399",
          card: "from-emerald-500/10 to-transparent",
        }
      : diagnostic.scale_readiness_level === "moderate"
        ? {
            border: "border-orange-400/70",
            text: "text-orange-300",
            meter: "#f97316",
            card: "from-orange-500/10 to-transparent",
          }
        : {
            border: "border-rose-400/70",
            text: "text-rose-300",
            meter: "#fb7185",
            card: "from-rose-500/10 to-transparent",
          };

  const urgencyStyle =
    diagnostic.urgency.level === "high"
      ? {
          border: "border-rose-500/70",
          text: "text-rose-300",
          dot: "bg-rose-400",
        }
      : diagnostic.urgency.level === "moderate"
        ? {
            border: "border-orange-400/70",
            text: "text-orange-300",
            dot: "bg-orange-400",
          }
        : {
            border: "border-emerald-400/70",
            text: "text-emerald-300",
            dot: "bg-emerald-400",
          };

  const priorityText = diagnostic.priority_label.toLowerCase();
  const activeJourneyStep = priorityText.includes("sales")
    ? 3
    : priorityText.includes("delivery") || priorityText.includes("growth")
      ? 5
      : priorityText.includes("scale")
        ? 2
        : 4;

  const engineJourney = [
    {
      step: 5,
      title: "Scale & Systemize",
      detail: "Predictable growth engine",
    },
    {
      step: 4,
      title: "Optimise & Expand",
      detail: "Increase efficiency & margin",
    },
    {
      step: 3,
      title: "Build & Convert",
      detail: "Strong pipeline & a sales system",
    },
    {
      step: 2,
      title: "Validate & Offer",
      detail: "Market fit & offer clarity",
    },
    {
      step: 1,
      title: "Foundation",
      detail: "Clarity, positioning & early traction",
    },
  ];

  const currentBusinessStageIndex = BUSINESS_STAGE_LADDER.findIndex(
    (stage) => stage.code === diagnostic.business_stage.code,
  );

  const readinessBreakdown = [
    {
      label: "Sales engine",
      value: diagnostic.scores.sales_engine,
    },
    {
      label: "Delivery & operations",
      value: diagnostic.scores.delivery_engine,
    },
    {
      label: "Founder independence",
      value: 100 - diagnostic.scores.founder_dependency,
    },
  ];

  const selfDiagnosisCopy = diagnostic.self_diagnosis
    ? `“${diagnostic.self_diagnosis}”`
    : "You did not add a written self-diagnosis. The scorecard still identifies the most likely operating pressure point from your answers.";

  const primaryImpactKey =
    diagnostic.primary_bottleneck.code === "sales_consistency_gap"
      ? "conversion"
      : diagnostic.primary_bottleneck.code === "delivery_consistency_gap"
        ? "delivery_capacity"
        : diagnostic.primary_bottleneck.code === "founder_dependency_gap"
          ? "founder_dependency"
          : diagnostic.primary_bottleneck.code === "balanced_execution_gap"
            ? "team_consistency"
            : "new_business_continuity";

  const primaryOperationalImpact =
    diagnostic.operational_impact.find(
      (impact) => impact.key === primaryImpactKey,
    ) ??
    diagnostic.operational_impact[0] ??
    null;

  const primaryImpactAccent = primaryOperationalImpact
    ? impactAccent(primaryOperationalImpact.level)
    : "#d97706";

  const bottleneckFunnel = [
    {
      label: "Growth Engine",
      value: diagnostic.scores.growth_engine,
      ...scoreFunnelState(diagnostic.scores.growth_engine),
    },
    {
      label: "Sales Engine",
      value: diagnostic.scores.sales_engine,
      ...scoreFunnelState(diagnostic.scores.sales_engine),
    },
    {
      label: "Scale Readiness",
      value: diagnostic.scores.scale_readiness,
      ...scoreFunnelState(diagnostic.scores.scale_readiness),
    },
    {
      label: "Founder Dependency",
      value: diagnostic.scores.founder_dependency,
      ...dependencyFunnelState(diagnostic.scores.founder_dependency),
    },
  ];

  return (
    <div className="min-h-screen bg-[#09141d] text-slate-900">
      <AppBackground />
      <main
        ref={reportRef}
        className="relative mx-auto max-w-[1440px] px-3 py-4 md:px-5 md:py-6"
      >
        <header
          data-ged-pdf-page
          className="overflow-hidden rounded-3xl border border-white/10 bg-[#17403a] px-5 py-5 text-white shadow-2xl shadow-black/25 md:px-8 md:py-7"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,190px))] xl:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xs font-black tracking-[0.12em]">
                PT
              </div>
              <div>
                <h1 className="text-2xl font-extrabold uppercase tracking-[0.12em] md:text-[2rem]">
                  Strategic Growth Report
                </h1>
                <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-emerald-300">
                  Growth Engine Diagnostic
                </p>
                <p className="mt-1 text-xs text-white/80">
                  Strategic Client Report · Powered by ProfileTest.ai
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 xl:contents">
              <div className="rounded-2xl border border-white/15 bg-black/5 p-3">
                <p className="text-[0.65rem] text-white/55">Prepared for</p>
                <p className="mt-1 truncate text-sm font-bold">{name || "—"}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/5 p-3">
                <p className="text-[0.65rem] text-white/55">Date</p>
                <p className="mt-1 text-sm font-bold">{createdAt}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/5 p-3">
                <p className="text-[0.65rem] text-white/55">Framework</p>
                <p className="mt-1 text-sm font-bold">{canonicalProfile}</p>
              </div>
            </div>
          </div>
        </header>

        <section
          data-ged-pdf-page
          className={`mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${theme.hero} bg-[#0c1d1a] p-6 text-white shadow-2xl shadow-black/25 md:p-9`}
        >
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Quantum profile
              </p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
                {name || "Your Growth Engine"}
              </h2>
              {company || role ? (
                <p className="mt-2 text-base text-slate-300">
                  {[role, company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <p className="mt-6 border-l-4 border-emerald-400 pl-4 text-base leading-7 text-slate-200">
                A practical view of where your business is relying too heavily
                on you, what needs attention first and how to build more
                dependable growth.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="rounded-xl border border-white/15 bg-[#1a4d41] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#235d4f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
              {nextStepsHref ? (
                <a
                  href={nextStepsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-gradient-to-r from-[#45e0d1] via-[#4f7dff] to-[#3c2ee0] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Next steps
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.22fr_0.78fr]">
            <QuantumProfileVisual
              personalityLabel={primaryPersonalityLabel}
              mindsetLabel={primaryMindsetLabel}
              profileLabel={canonicalProfile}
              personalityColor={primaryPersonalityColor}
              mindsetColor={primaryMindsetColor}
              personalityIcon={personaIcon}
              mindsetIcon={mindsetIcon}
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm leading-6 text-slate-300">
                The Growth Engine Diagnostic combines your behavioural pattern
                with your current operating signals, helping you see how you
                naturally create momentum and where the operating system needs
                to become more dependable.
              </p>
            </div>
          </div>
        </section>

        <section
          data-ged-pdf-page
          id="one-page-quantum-profile"
          className="mt-5 scroll-mt-6 overflow-hidden rounded-3xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(20,107,105,0.28),transparent_42%),linear-gradient(120deg,#14282a_0%,#08201f_52%,#113638_100%)] p-5 shadow-2xl shadow-black/20 md:p-7"
        >
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-emerald-300">
            One-Page Quantum Profile
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">
            Your at-a-glance growth profile
          </h2>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.94fr_1.08fr_1.08fr]">
            <article className="min-h-[206px] rounded-2xl border-2 border-emerald-400 bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <p className="text-sm font-bold text-emerald-300">
                Your Quantum Profile
              </p>
              <p className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">
                {canonicalProfile}
              </p>

              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/10">
                    <AssetIcon
                      src={onePageIcons.personality}
                      className="h-4 w-4 object-contain"
                    />
                  </span>
                  <span className="flex-1 text-xs font-medium text-slate-300">
                    Personality
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: primaryPersonalityColor }}
                  >
                    {primaryPersonalityLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-400/10">
                    <AssetIcon
                      src={onePageIcons.mindsetStage}
                      className="h-4 w-4 object-contain"
                    />
                  </span>
                  <span className="flex-1 text-xs font-medium text-slate-300">
                    Mindset Stage
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: primaryMindsetColor }}
                  >
                    {primaryMindsetLabel}
                  </span>
                </div>
              </div>
            </article>

            <article className="min-h-[206px] rounded-2xl border border-white/10 bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-300/60 bg-cyan-400/10">
                  <AssetIcon
                    src={onePageIcons.strengths}
                    className="h-4 w-4 object-contain"
                  />
                </span>
                <p className="text-sm font-bold text-cyan-300">
                  Your Strengths
                </p>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-200">
                {persona?.combined_strengths ||
                  "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}
              </p>

              <p className="mt-5 text-sm font-bold text-rose-300">Your Risks</p>
              <p className="mt-2 text-sm leading-5 text-slate-200">
                {persona?.combined_risks ||
                  "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}
              </p>
            </article>

            <article className="min-h-[206px] rounded-2xl border border-[#168bd2] bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#168bd2]/70 bg-[#168bd2]/10">
                  <AssetIcon
                    src={onePageIcons.priorities}
                    className="h-4 w-4 object-contain"
                  />
                </span>
                <p className="text-sm font-bold text-sky-300">
                  Top strategic priorities
                </p>
              </div>

              <ol className="mt-4 space-y-3 text-sm leading-5 text-slate-200">
                {(strategicPriorities.length
                  ? strategicPriorities
                  : [
                      "Protect the new operating rhythm.",
                      "Strengthen ownership across the team.",
                      "Remove the next founder dependency once the first change is working.",
                    ]
                ).map((priority, index) => (
                  <li key={priority} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2d91e8] text-[0.56rem] font-black text-white">
                      {index + 1}
                    </span>
                    <span>{priority}</span>
                  </li>
                ))}
              </ol>
            </article>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.78fr_0.9fr_1.42fr_0.92fr]">
            <article
              className={`min-h-[188px] rounded-2xl border bg-gradient-to-br ${readinessStyle.border} ${readinessStyle.card} p-5 text-white shadow-inner shadow-black/20`}
            >
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-300">
                Scale Readiness Gap
              </p>
              <p
                className={`mt-3 text-2xl font-extrabold ${readinessStyle.text}`}
              >
                {displayReadinessLevel}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-200">
                {diagnostic.scale_readiness_level} readiness for growth without
                adding more founder load.
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${clampPercent(diagnostic.scores.scale_readiness)}%`,
                    backgroundColor: readinessStyle.meter,
                  }}
                />
              </div>
              <p className="mt-2 text-[0.68rem] text-slate-300">
                Readiness score: {diagnostic.scores.scale_readiness}%
              </p>
            </article>

            <article
              className={`min-h-[188px] rounded-2xl border bg-[#09211c] p-5 text-white shadow-inner shadow-black/20 ${urgencyStyle.border}`}
            >
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-300">
                Urgency Level
              </p>
              <p
                className={`mt-3 text-2xl font-extrabold ${urgencyStyle.text}`}
              >
                {diagnostic.urgency.label}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-100">
                {diagnostic.urgency.window}
              </p>
              <div className="mt-3 flex gap-2 text-xs leading-5 text-slate-300">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${urgencyStyle.dot}`}
                />
                <span>{diagnostic.urgency.summary}</span>
              </div>
            </article>

            <article className="min-h-[188px] rounded-2xl border border-white/10 bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
                {diagnostic.priority_label}
              </p>

              <div className="mt-3 space-y-1.5">
                {engineJourney.map((item) => {
                  const active = item.step === activeJourneyStep;

                  return (
                    <div
                      key={item.step}
                      className={[
                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
                        active
                          ? "border-emerald-300/80 bg-[#3ed9aa] text-[#09211c]"
                          : "border-white/[0.05] bg-[#061713] text-slate-100",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-black",
                          active
                            ? "bg-[#0a7d5f] text-white"
                            : "bg-emerald-400/20 text-emerald-200",
                        ].join(" ")}
                      >
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-[0.68rem] font-bold leading-4 ${active ? "text-[#09211c]" : "text-slate-100"}`}
                        >
                          {item.title}
                        </p>
                        <p
                          className={`text-[0.56rem] leading-3 ${active ? "text-[#09211c] opacity-75" : "text-slate-400"}`}
                        >
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-300">
                {diagnostic.priority_summary}
              </p>
            </article>

            <article className="flex min-h-[188px] flex-col items-center justify-center rounded-2xl border border-emerald-300/50 bg-[#1b5148] p-4 text-center text-white shadow-inner shadow-black/20">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-emerald-200">
                Progress Circle
              </p>
              <ScoreRing score={diagnostic.scores.overall_engine} />
              <p className="-mt-2 text-sm font-bold text-white">
                Overall Engine Score
              </p>
              <p className="mt-2 text-xs leading-5 text-emerald-50/85">
                Overall engine health
              </p>
            </article>
          </div>
        </section>

        <section
          data-ged-pdf-page
          id="profile-distributions"
          className="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <article className="rounded-2xl border border-white/10 bg-[#0c1d1a] p-5 text-white shadow-2xl shadow-black/20 md:p-6">
            <h2 className="text-base font-bold text-white md:text-lg">
              Your Personality Layer
            </h2>
            <p className="mt-3 max-w-xl text-xs leading-5 text-slate-300 md:text-sm">
              Your emotional &amp; energetic style across Fire, Flow, Form and
              Field in the way you buy and build.
            </p>

            <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <FrequencyDonut data={frequencyData} />

              <div className="w-full space-y-3">
                {frequencyData.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 text-xs md:text-sm"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: FREQUENCY_COLORS[item.key] }}
                    />
                    <span className="flex-1 text-slate-200">
                      {PERSONALITY_LABELS[item.key]}
                    </span>
                    <span className="w-10 text-right tabular-nums text-slate-200">
                      {Math.round(item.value)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0c1d1a] p-5 text-white shadow-2xl shadow-black/20 md:p-6">
            <h2 className="text-base font-bold text-white md:text-lg">
              Your Mindset Layer
            </h2>
            <p className="mt-3 max-w-xl text-xs leading-5 text-slate-300 md:text-sm">
              Where your focus and energy are distributed across the five
              Quantum growth stages.
            </p>

            <div className="mt-5 space-y-3">
              {(
                [
                  "ORIGIN",
                  "MOMENTUM",
                  "VECTOR",
                  "ORBIT",
                  "QUANTUM",
                ] as MindsetKey[]
              ).map((key) => {
                const value = clampPercent(mindsetPercentages[key] || 0);

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between gap-4 text-xs md:text-sm">
                      <span className="text-slate-200">
                        {MINDSET_LABELS[key]}
                      </span>
                      <span className="tabular-nums text-slate-200">
                        {value}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#45e0d1]"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <ReportIndex
            items={indexItems}
            onDownloadPdf={handleDownloadPdf}
            downloading={downloading}
            nextStepsHref={nextStepsHref}
          />

          <div className="space-y-5">
            <section
              data-ged-pdf-page
              id="quantum-profile-matrix"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.quantum_profile_matrix}
                eyebrow="Quantum Profile Matrix"
                title="Where your buyer frequency meets your mindset level"
                body="Each cell represents a different Quantum buyer persona. Your primary pattern is highlighted — this is where your emotional wiring and current growth stage meet."
                dark
                compact
              />

              <div className="mt-6">
                <QscMatrix
                  variant="ged"
                  primaryPersonality={primaryPersonality}
                  secondaryPersonality={result.secondary_personality}
                  primaryMindset={primaryMindset}
                  secondaryMindset={result.secondary_mindset}
                  personalityPercentages={personalityPercentages}
                  mindsetPercentages={mindsetPercentages}
                  eyebrow="Quantum Source Code"
                  title="Quantum Profile Matrix"
                  description="This grid maps your Buyer Frequency Type (left to right) against your Buyer Mindset Level (bottom to top). Your combined profile sits at the intersection."
                />
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="understand-quantum-profile"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.understand_quantum_profile}
                eyebrow="Understand the Quantum Profile"
                title="Your Quantum Profile"
                dark
                compact
              />

              <div className="mt-6">
                <QuantumProfileDiagram />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {QUANTUM_PROFILE_MIXES.map((mix) => (
                  <QuantumProfileMixCard
                    key={mix.label}
                    mix={mix}
                    isPrimary={
                      primaryPersonality === mix.personality &&
                      primaryMindset === mix.mindset
                    }
                  />
                ))}
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="personality-layer"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.personality_layer}
                eyebrow="Your Personality Layer"
                title="How you show up emotionally & behaviourally"
                body="Your personality layer is your emotional wiring and energetic pattern. It does not change overnight, which is why it is such a powerful anchor for business design."
                dark
                compact
              />

              <div className="mt-6 rounded-2xl bg-[#f9f8f6] p-4 sm:p-5 md:p-6">
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1fr] lg:items-stretch">
                  <PersonalityFrequencyPanel
                    data={frequencyData}
                    primaryKey={primaryPersonality}
                  />

                  <div className="grid gap-3">
                    <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#34d399]">
                        Core pattern — {primaryPersonalityLabel}
                      </p>
                      <h3 className="mt-2 text-base font-extrabold leading-6 text-[#1a1a1a]">
                        {primaryPersonalityLabel} operating pattern
                      </h3>
                      <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                        {persona?.combined_strengths ||
                          "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}
                      </p>
                    </article>

                    <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#34d399]">
                        What energises you
                      </p>
                      <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                        {persona?.energisers ||
                          "You operate best when your strengths are directed toward work that creates strategic momentum."}
                      </p>
                    </article>

                    <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#34d399]">
                        What drains you
                      </p>
                      <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                        {persona?.drains ||
                          "Repeated escalation, unclear ownership and work that should be carried by the operating system can drain your highest-value energy."}
                      </p>
                    </article>
                  </div>
                </div>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="mindset-layer"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.mindset_layer}
                eyebrow="Your Mindset Layer"
                title="Where you are in your growth journey"
                dark
                compact
              />

              <div className="mt-6 rounded-2xl border border-white/10 bg-white p-4 shadow-sm sm:p-6 md:p-7">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.08fr)] xl:items-center">
                  <div>
                    <p className="text-base font-extrabold text-[#0c1d1a]">
                      You are in the {primaryMindsetLabel} stage.
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563]">
                      {mindsetStageCopy.intro}
                    </p>

                    <div className="mt-7 space-y-3.5">
                      {MINDSET_STAGE_ORDER.map((key) => {
                        const value = clampPercent(
                          mindsetPercentages[key] || 0,
                        );
                        const isPrimary = key === primaryMindset;

                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between gap-4 text-xs text-[#0c1d1a]">
                              <span
                                className={
                                  isPrimary ? "font-bold" : "font-medium"
                                }
                              >
                                {MINDSET_LABELS[key]}
                              </span>
                              <span className="tabular-nums font-medium">
                                {value}%
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e3e3e3]">
                              <div
                                className="h-full rounded-full bg-[#34d399]"
                                style={{ width: `${value}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="relative min-h-[240px] overflow-hidden rounded-xl bg-[#f9f8f6] sm:min-h-[300px] xl:min-h-[330px]">
                    <AssetIcon
                      src={MINDSET_LAYER_INFOGRAPHIC}
                      alt="Quantum mindset growth-stage infographic"
                      className="absolute inset-0 h-full w-full object-contain p-2 sm:p-3"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {MINDSET_STAGE_ORDER.map((key) => {
                  const stage = MINDSET_STAGE_COPY[key];
                  const value = clampPercent(mindsetPercentages[key] || 0);
                  const isPrimary = key === primaryMindset;

                  return (
                    <article
                      key={key}
                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white p-5 shadow-sm"
                    >
                      <span
                        className="absolute inset-x-0 top-0 h-1.5"
                        style={{ backgroundColor: stage.accent }}
                      />
                      <p className="mt-1 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
                        {MINDSET_LABELS[key]}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <p
                          className="text-3xl font-extrabold leading-none"
                          style={{ color: isPrimary ? "#00cac3" : "#0c1d1a" }}
                        >
                          {value}%
                        </p>
                        {isPrimary ? (
                          <span className="rounded-full bg-[#e6fffa] px-2 py-1 text-[0.56rem] font-bold uppercase tracking-[0.11em] text-[#008f8a]">
                            Current stage
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 text-xs leading-5 text-[#6b7280]">
                        {stage.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="combined-pattern"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.combined_pattern}
                eyebrow="Your Combined Pattern"
                title={`${canonicalProfile} — What Happens When Your Style Meets Your Stage`}
                body="Your combined profile is more than the sum of its parts. This is where your emotional wiring and current growth stage create a distinct operating pattern — with specific strengths, risks and levers."
                dark
              />

              <div className="mt-6 rounded-2xl bg-white p-4 md:p-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  <article className="relative min-h-[218px] overflow-hidden rounded-[13px] border border-[#fddcbf] bg-[#fff8f4] p-6">
                    <span className="absolute inset-x-4 top-0 h-1 bg-[#34d399]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#34a77c]">
                      Strategic strengths
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      Your natural advantage
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                      {persona?.combined_strengths ||
                        "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}
                    </p>
                  </article>

                  <article className="relative min-h-[218px] overflow-hidden rounded-[13px] border border-[#fecaca] bg-[#fef2f2] p-6">
                    <span className="absolute inset-x-4 top-0 h-1 bg-[#dc2626]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#dc2626]">
                      Growth risks & loops
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      What can hold you back
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                      {persona?.combined_risks ||
                        "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}
                    </p>
                  </article>

                  <article className="relative min-h-[218px] overflow-hidden rounded-[13px] border border-[#bbf7d0] bg-[#f0fdf4] p-6">
                    <span className="absolute inset-x-4 top-0 h-1 bg-[#22c55e]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#16a34a]">
                      Biggest lever
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      The move that changes the system
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                      {persona?.combined_big_lever ||
                        "Use your natural strengths to set direction, then protect the routines and ownership that allow the team to execute without you."}
                    </p>
                  </article>
                </div>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="communication-decision-style"
              className="scroll-mt-6 rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.emotional_alignment}
                eyebrow="Your Emotional & Operational Alignment"
                title="How to support yourself inside this pattern"
                body="Your behavioural result does not replace the operational diagnosis. It explains the conditions that help you implement the right fix and the patterns that may pull you back into the bottleneck."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <DarkContentCard title="What stabilises you">
                  <p>
                    {persona?.emotional_stabilises ||
                      "Clear ownership, visible progress and a small number of priorities help you stay out of reactive founder mode."}
                  </p>
                </DarkContentCard>
                <DarkContentCard title="What destabilises you">
                  <p>
                    {persona?.emotional_destabilises ||
                      "Unclear ownership, repeated escalation and too many decisions returning to you can increase pressure and reduce follow-through."}
                  </p>
                </DarkContentCard>
                <DarkContentCard title="Support yourself better">
                  <p>
                    {persona?.support_yourself ||
                      "Protect time for strategic work, use simple decision rules and review whether the team is truly owning the work you have delegated."}
                  </p>
                </DarkContentCard>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="business-context"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.business_context}
                eyebrow="Your Business Context"
                title="Where you are right now"
                body="Your qualifying responses translated into business intelligence. These four signals shape the diagnostic priorities throughout this report."
                dark
              />

              <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f9f8f6] p-4 shadow-sm md:p-7">
                <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                  <article className="flex min-h-[300px] flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fee8d6]">
                      <AssetIcon
                        src={BUSINESS_CONTEXT_ICON_PATHS.businessStage}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                    </div>
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#4b5563]">
                      Business stage
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold leading-6 text-[#1a1a1a]">
                      {diagnostic.business_stage.label}
                    </h3>
                    <p className="mt-2 text-xs leading-[1.45] text-[#4b5563] sm:text-sm sm:leading-5">
                      {diagnostic.business_stage.summary}
                    </p>

                    <div className="mt-auto grid grid-cols-4 items-end gap-2 pt-5 sm:gap-3">
                      {BUSINESS_STAGE_LADDER.map((stage, index) => {
                        const active = index === currentBusinessStageIndex;
                        const passed =
                          currentBusinessStageIndex >= 0 &&
                          index < currentBusinessStageIndex;
                        const barColor = active
                          ? "#34d399"
                          : passed
                            ? "#ffb347"
                            : "#e5e7eb";

                        return (
                          <div
                            key={stage.code}
                            className="flex min-w-0 flex-col items-center gap-1.5"
                          >
                            <div className="flex h-[90px] items-end">
                              <div
                                className="w-full min-w-[38px] rounded-t-md transition-colors"
                                style={{
                                  height: `${stage.height}%`,
                                  backgroundColor: barColor,
                                }}
                              />
                            </div>
                            <p
                              className={`w-full text-center text-[0.58rem] font-semibold leading-3 sm:text-[0.64rem] ${
                                active ? "text-emerald-700" : "text-[#4b5563]"
                              }`}
                            >
                              {stage.label}
                              {active ? " ★" : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="flex min-h-[300px] flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fee8d6]">
                      <AssetIcon
                        src={BUSINESS_CONTEXT_ICON_PATHS.coreConstraint}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                    </div>
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#4b5563]">
                      Core constraint
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold leading-6 text-[#1a1a1a]">
                      {diagnostic.core_constraint.label}
                    </h3>
                    <p className="mt-2 text-xs leading-[1.45] text-[#4b5563] sm:text-sm sm:leading-5">
                      {diagnostic.core_constraint.summary}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      {CONSTRAINT_SIGNAL_CHIPS.map((signal) => {
                        const selected =
                          signal.code === diagnostic.core_constraint.code;
                        return (
                          <span
                            key={signal.code}
                            className={[
                              "rounded-full px-3 py-1.5 text-xs font-bold",
                              selected
                                ? "bg-rose-100 text-rose-700"
                                : signal.code === "UNCLEAR"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-amber-100 text-amber-800",
                            ].join(" ")}
                          >
                            {signal.label}
                          </span>
                        );
                      })}
                    </div>
                  </article>

                  <article className="flex min-h-[300px] flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fee8d6]">
                      <AssetIcon
                        src={BUSINESS_CONTEXT_ICON_PATHS.scaleReadiness}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                    </div>
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#4b5563]">
                      Scale readiness
                    </p>
                    <h3
                      className={`mt-1 text-lg font-extrabold leading-6 ${scoreTone(diagnostic.scores.scale_readiness)}`}
                    >
                      {diagnostic.scores.scale_readiness}% Ready
                    </h3>
                    <p className="mt-2 text-xs leading-[1.45] text-[#4b5563] sm:text-sm sm:leading-5">
                      {diagnostic.scale_readiness_signal.summary}
                    </p>

                    <div className="mt-auto space-y-3.5 pt-5">
                      {readinessBreakdown.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between gap-3 text-[0.68rem]">
                            <span className="font-medium text-[#1a1a1a]">
                              {item.label}
                            </span>
                            <span
                              className="font-bold tabular-nums"
                              style={{ color: scoreAccent(item.value) }}
                            >
                              {clampPercent(item.value)}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded bg-[#e5e7eb]">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${clampPercent(item.value)}%`,
                                backgroundColor: scoreAccent(item.value),
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="flex min-h-[300px] flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fee8d6]">
                      <AssetIcon
                        src={BUSINESS_CONTEXT_ICON_PATHS.strategicSelfDiagnosis}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                    </div>
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#4b5563]">
                      Strategic self-diagnosis
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold leading-6 text-[#1a1a1a]">
                      {diagnostic.scale_readiness_signal.label}
                    </h3>
                    <p className="mt-2 text-xs leading-[1.45] text-[#4b5563] sm:text-sm sm:leading-5">
                      {selfDiagnosisCopy}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">
                        Founder dependency{" "}
                        {clampPercent(diagnostic.scores.founder_dependency)}%
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                        {diagnostic.response_alignment.label}
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="engine-scorecard"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.engine_scorecard}
                eyebrow="Your Engine Scorecard"
                title="Growth Engine Health Check"
                body="A diagnostic view across the core dimensions that determine your ability to scale sustainably."
                dark
                compact
              />

              <div className="mt-6 rounded-2xl bg-white p-5 md:p-7">
                <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
                  <article className="rounded-2xl border border-[#e5e7eb] bg-white px-6 py-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.13em] text-[#4b5563]">
                      Overall Engine
                      <br />
                      Score
                    </p>

                    <div className="mt-4 flex justify-center">
                      <ScoreRing
                        score={diagnostic.scores.overall_engine}
                        light
                      />
                    </div>

                    <p className="-mt-1 text-sm text-[#4b5563]">
                      Engine Health
                    </p>

                    <div className="mt-7 space-y-3 text-left">
                      {[
                        {
                          label: "Growth Profile",
                          value: diagnostic.scores.growth_engine,
                          dot: "#34d399",
                        },
                        {
                          label: "Scale Readiness",
                          value: diagnostic.scores.scale_readiness,
                          dot: "#d97706",
                        },
                        {
                          label: "Founder Dependency",
                          value: diagnostic.scores.founder_dependency,
                          dot: "#dc2626",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 text-sm"
                        >
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.dot }}
                          />
                          <span className="text-[#4b5563]">{item.label}</span>
                          <strong className="tabular-nums text-[#1a1a1a]">
                            {clampPercent(item.value)}%
                          </strong>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <p className="text-base font-bold text-[#1a1a1a]">
                      Diagnostic Score Breakdown
                    </p>

                    <div className="mt-6 space-y-5">
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[#9ca3af]">
                          Operational Layer
                        </p>
                        <div className="mt-4 space-y-4">
                          <Meter
                            label="Growth Engine"
                            score={diagnostic.scores.growth_engine}
                            accent={scoreAccent(
                              diagnostic.scores.growth_engine,
                            )}
                            caption="Delivery capacity, team execution and operating structure."
                          />
                          <Meter
                            label="Sales Engine"
                            score={diagnostic.scores.sales_engine}
                            accent={scoreAccent(diagnostic.scores.sales_engine)}
                            caption="Conversion, follow-up and consistent revenue without founder-led closing."
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[#9ca3af]">
                          Readiness Layer
                        </p>
                        <div className="mt-4 space-y-4">
                          <Meter
                            label="Scale Readiness"
                            score={diagnostic.scores.scale_readiness}
                            accent={scoreAccent(
                              diagnostic.scores.scale_readiness,
                            )}
                          />
                          <Meter
                            label="Founder Dependency"
                            score={100 - diagnostic.scores.founder_dependency}
                            accent="#dc2626"
                            caption="Higher dependency reduces the readiness score."
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="primary-bottleneck"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.primary_bottleneck}
                eyebrow="Your Primary Bottleneck"
                title="What's Capping Your Growth"
                body="Your diagnostic identifies one primary constraint preventing sustainable scale right now."
                dark
                compact
              />

              <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f9f8f6] p-4 md:p-7">
                <div className="rounded-xl border border-[#34d399] bg-[#d1fae5]/80 p-5 md:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-[#34d399] bg-white/35">
                      <AssetIcon
                        src={PRIMARY_BOTTLENECK_ICON_PATHS.bottleneck}
                        alt=""
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-[#16a34a] md:text-xl">
                        {diagnostic.primary_bottleneck.label}
                      </h3>
                      <p className="mt-2 max-w-5xl text-sm font-medium leading-6 text-[#1a1a1a]">
                        {diagnostic.primary_bottleneck.summary}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <article className="min-h-[132px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <AssetIcon
                      src={PRIMARY_BOTTLENECK_ICON_PATHS.revenueImpact}
                      alt=""
                      className="h-6 w-6 object-contain"
                    />
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.13em] text-[#4b5563]">
                      Revenue impact
                    </p>
                    <p
                      className="mt-1 text-sm font-extrabold"
                      style={{ color: primaryImpactAccent }}
                    >
                      {primaryOperationalImpact
                        ? impactLabel(primaryOperationalImpact.level)
                        : "Not scored"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#4b5563]">
                      {primaryOperationalImpact?.explanation ??
                        diagnostic.primary_bottleneck.why_it_matters}
                    </p>
                  </article>

                  <article className="min-h-[132px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <AssetIcon
                      src={PRIMARY_BOTTLENECK_ICON_PATHS.urgencyWindow}
                      alt=""
                      className="h-6 w-6 object-contain"
                    />
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.13em] text-[#4b5563]">
                      Urgency window
                    </p>
                    <p
                      className="mt-1 text-sm font-extrabold"
                      style={{ color: urgencyAccent(diagnostic.urgency.level) }}
                    >
                      {diagnostic.urgency.window}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#4b5563]">
                      {diagnostic.urgency.summary}
                    </p>
                  </article>

                  <article className="min-h-[132px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <AssetIcon
                      src={PRIMARY_BOTTLENECK_ICON_PATHS.solvability}
                      alt=""
                      className="h-6 w-6 object-contain"
                    />
                    <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.13em] text-[#4b5563]">
                      Solvability
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-[#16a34a]">
                      First practical fix
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#4b5563]">
                      {diagnostic.primary_bottleneck.first_fix}
                    </p>
                  </article>
                </div>

                <article className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <h3 className="text-sm font-bold text-[#1a1a1a]">
                    Growth Constraint Funnel — Where the Bottleneck Lives
                  </h3>
                  <div className="mt-5 space-y-3">
                    {bottleneckFunnel.map((metric) => (
                      <div
                        key={metric.label}
                        className="grid grid-cols-[minmax(104px,1fr)_minmax(0,4fr)_42px] items-center gap-3"
                      >
                        <p className="text-[0.67rem] font-semibold leading-4 text-[#1a1a1a] md:text-xs">
                          {metric.label}
                        </p>
                        <div className="h-7 overflow-hidden rounded bg-[#e5e7eb]">
                          <div
                            className="flex h-full min-w-[66px] items-center rounded px-2 text-[0.62rem] font-bold text-white"
                            style={{
                              width: `${Math.max(8, clampPercent(metric.value))}%`,
                              backgroundColor: metric.color,
                            }}
                          >
                            <span className="truncate">{metric.status}</span>
                          </div>
                        </div>
                        <p className="text-right text-xs font-bold tabular-nums text-[#4b5563]">
                          {clampPercent(metric.value)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="reflection-prompts"
              className="scroll-mt-6 rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.what_this_means}
                eyebrow="What This Means"
                title={`${canonicalProfile} — Decoded for Operators`}
                body="What your combined profile signals about your strengths, your risks, and where the highest-leverage moves live."
                dark
                compact
              />

              <div className="mt-6 rounded-2xl bg-[#f9f8f6] p-4 md:p-8">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <article className="relative min-h-[198px] overflow-hidden rounded-[14px] border border-[#fddcbf] bg-[#fff8f4] p-5 pt-6">
                    <span className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#34d399]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#34a77c]">
                      Strategic Strength
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      Your natural advantage
                    </h3>
                    <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                      {persona?.combined_strengths ||
                        "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}
                    </p>
                  </article>

                  <article className="relative min-h-[198px] overflow-hidden rounded-[14px] border border-[#fecaca] bg-[#fef2f2] p-5 pt-6">
                    <span className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#dc2626]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#dc2626]">
                      Growth Risk
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      The pattern to manage
                    </h3>
                    <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                      {persona?.combined_risks ||
                        "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}
                    </p>
                  </article>

                  <article className="relative min-h-[198px] overflow-hidden rounded-[14px] border border-[#bbf7d0] bg-[#f0fdf4] p-5 pt-6">
                    <span className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#16a34a]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#16a34a]">
                      Biggest Lever
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      The highest-leverage move
                    </h3>
                    <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                      {persona?.combined_big_lever ||
                        "Use your natural strengths to set direction, then protect the routines and ownership that allow the team to execute without you."}
                    </p>
                  </article>

                  <article className="relative min-h-[198px] overflow-hidden rounded-[14px] border border-[#fddcbf] bg-[#fff8f4] p-5 pt-6">
                    <span className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#34d399]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#34a77c]">
                      What Stabilises You
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      Conditions that support you
                    </h3>
                    <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                      {persona?.emotional_stabilises ||
                        "Clear ownership, visible progress and a small number of priorities help you stay out of reactive founder mode."}
                    </p>
                  </article>

                  <article className="relative min-h-[198px] overflow-hidden rounded-[14px] border border-[#fecaca] bg-[#fef2f2] p-5 pt-6">
                    <span className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#dc2626]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#dc2626]">
                      What Destabilises You
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      The conditions to watch
                    </h3>
                    <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                      {persona?.emotional_destabilises ||
                        "Unclear ownership, repeated escalation and too many decisions returning to you can increase pressure and reduce follow-through."}
                    </p>
                  </article>

                  <article className="relative min-h-[198px] overflow-hidden rounded-[14px] border border-[#fde68a] bg-[#fffbeb] p-5 pt-6">
                    <span className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#34d399]" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#34a77c]">
                      Energised By
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-6 text-[#1a1a1a]">
                      Where you do your best work
                    </h3>
                    <p className="mt-3 text-sm leading-5 text-[#4b5563]">
                      {persona?.energisers ||
                        "Protected strategic time, meaningful progress and work that makes full use of your natural strengths will give you the greatest energy."}
                    </p>
                  </article>
                </div>
              </div>
            </section>
            <section
              data-ged-pdf-page
              id="revenue-impact"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.revenue_impact}
                eyebrow="Your Revenue Impact"
                title="What the bottleneck is costing you"
                body="The commercial case for resolving your primary constraint in the next 90 days."
                dark
              />

              <div className="mt-6 rounded-2xl bg-[#f9f8f6] p-5 md:p-6">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-emerald-500">
                  How this bottleneck shows up in the business
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {diagnostic.operational_impact.map((impact, index) => (
                    <article
                      key={impact.key}
                      className={`rounded-lg bg-[#0c1d1a] p-4 text-white shadow-sm ${
                        index === diagnostic.operational_impact.length - 1
                          ? "md:col-span-2"
                          : ""
                      }`}
                    >
                      <h3 className="text-sm font-bold leading-5 text-white">
                        {impact.label}
                      </h3>
                      <p className="mt-1.5 max-w-4xl text-xs leading-5 text-slate-300">
                        {impact.explanation}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="focus-plan"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.focus_plan}
                eyebrow="Your 30-Day Focus Plan"
                title="Your first month, week by week"
                body="Concrete actions mapped across four weeks to start resolving your primary bottleneck immediately."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {diagnostic.action_plan.map((step) => (
                  <article
                    key={step.week}
                    className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-white"
                  >
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
                      {step.week}
                    </p>
                    <h3 className="mt-3 text-lg font-extrabold">
                      {step.title}
                    </h3>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                      {step.actions.map((action) => (
                        <li key={action} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="executive-summary"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.executive_summary}
                eyebrow="Your One-Page Executive Summary"
                title="Your full diagnostic at a glance"
                body="Everything in one view — share with your leadership team or revisit before your strategy session."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ContentCard title="Growth Engine Profile">
                  <p className="text-lg font-extrabold text-slate-950">
                    {canonicalProfile}
                  </p>
                  <p className="mt-2">
                    Personality: {primaryPersonalityLabel}. Mindset stage:{" "}
                    {primaryMindsetLabel}.
                  </p>
                </ContentCard>
                <ContentCard title="Primary Bottleneck">
                  <p className="text-lg font-extrabold text-slate-950">
                    {diagnostic.primary_bottleneck.label}
                  </p>
                  <p className="mt-2">{diagnostic.urgency.window}</p>
                </ContentCard>
                <ContentCard title="Engine Scorecard">
                  <p>
                    Growth Engine:{" "}
                    <span className="font-bold text-slate-950">
                      {diagnostic.scores.growth_engine}%
                    </span>
                  </p>
                  <p>
                    Sales Engine:{" "}
                    <span className="font-bold text-slate-950">
                      {diagnostic.scores.sales_engine}%
                    </span>
                  </p>
                  <p>
                    Scale readiness:{" "}
                    <span className="font-bold text-slate-950">
                      {diagnostic.scores.scale_readiness}%
                    </span>
                  </p>
                </ContentCard>
                <ContentCard title="Business Context">
                  <p>{diagnostic.business_stage.label}</p>
                  <p className="mt-2">
                    Constraint: {diagnostic.core_constraint.label}
                  </p>
                </ContentCard>
                <div id="growth-roadmap" className="scroll-mt-6">
                  <ContentCard title="Next 90 Days">
                    {strategicPriorities.length ? (
                      <ul className="space-y-2">
                        {strategicPriorities.map((priority) => (
                          <li key={priority} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-700" />
                            {priority}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        Protect the new operating rhythm, strengthen ownership
                        and remove the next founder dependency once the first
                        change is working.
                      </p>
                    )}
                  </ContentCard>
                </div>
                <ContentCard title="Recommended Next Step">
                  <p className="font-bold text-slate-950">
                    {diagnostic.recommended_next_step.title}
                  </p>
                  <p className="mt-2">
                    {diagnostic.recommended_next_step.summary}
                  </p>
                </ContentCard>
              </div>
            </section>

            <section
              data-ged-pdf-page
              id="recommended-next-steps"
              className="scroll-mt-6 overflow-hidden rounded-3xl border border-cyan-300/35 bg-gradient-to-br from-[#45e0d1] via-[#b3f5ed] to-[#d9f99d] p-7 shadow-2xl shadow-black/20 md:p-10"
            >
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-700">
                Your Recommended Next Step
              </p>
              <h2 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-950 md:text-5xl">
                Turn the diagnostic into a live execution plan.
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
                You now have a clear view of the pressure point. The next move
                is to translate it into ownership, an operating rhythm and a
                focused 90-day plan.
              </p>
              {nextStepsHref ? (
                <a
                  href={nextStepsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Book your strategy session
                </a>
              ) : null}
            </section>
          </div>
        </div>

        <footer className="py-7 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ProfileTest.ai · Growth Engine
          Diagnostic · Confidential Strategic Client Report
        </footer>
      </main>
    </div>
  );
}

