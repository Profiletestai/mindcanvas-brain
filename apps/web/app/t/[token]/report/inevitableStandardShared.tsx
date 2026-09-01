"use client";

/* -------------------------------------------------------------------------- */
/* Shared design system for the Inevitable Standard reporting suite.           */
/*                                                                            */
/* Report 1 (Diagnostic Snapshot) and Report 2 (Full Diagnostic Report) both  */
/* render from this module so they read as one product. Tokens, types, pure   */
/* helpers and the small presentational pieces (readiness gauge, band meter,   */
/* pillar bar, decision compass, revenue-in-structure panel) live here.       */
/* -------------------------------------------------------------------------- */

import { type CSSProperties, type ReactNode } from "react";
import { Newsreader } from "next/font/google";
import { getInevitableStandardPillarBandContent } from "@/lib/inevitable-standard/content/reportCopy";

/* Display type — Newsreader for headings / figures, Inter (platform default)
 * for body. Self-hosted by next/font; the font CSS is scoped to the routes
 * that import this module, so no other surface is affected. */
export const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

export const serif: CSSProperties = {
  fontFamily:
    "var(--font-newsreader), ui-serif, Georgia, 'Times New Roman', serif",
};

/* -------------------------------------------------------------------------- */
/* Design tokens (spec §5 — Reporting Suite design brief)                      */
/* -------------------------------------------------------------------------- */

export const NAVY_DEEP = "#14263d";
export const NAVY = "#1f2c46";
export const NAVY_GRADIENT = `linear-gradient(158deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`;
export const GOLD = "#b89a5e";
export const GOLD_TEXT = "#8a6a3c";
export const IVORY = "#faf8f4";
export const IVORY_PANEL = "#f5efe3";
export const IVORY_BORDER = "#e7ddc8";
export const INK = "#1e2a38";
export const HAIRLINE = "#e7e3db";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type PillarKey =
  | "identity"
  | "positioning"
  | "offer"
  | "sales"
  | "revenue_model"
  | "decision";

export type ApproachCode = "A" | "B" | "C" | "D";

export type PillarResult = {
  raw?: number;
  max?: number;
  percentage?: number;
  risk?: "high_risk" | "medium_risk" | "low_risk";
  risk_label?: string;
};

export type ConstraintConfidence = "High" | "Medium" | "Directional";

export type FalseConstraint = {
  stated_pillar?: string | null;
  evidence_pillar?: string | null;
  mismatch?: boolean | null;
  explanation?: string | null;
};

export type ConstraintResult = {
  primary_constraint?: PillarKey | string | null;
  secondary_constraint?: PillarKey | string | null;
  false_constraint?: FalseConstraint | null;
  priority_fix_order?: Array<PillarKey | string> | null;
  confidence?: ConstraintConfidence | null;
  identity_decision_override?: boolean | null;
};

export type RevenueInStructure = {
  primary_constraint_pillar?: PillarKey | string | null;
  point_estimate?: number | null;
  range_low?: number | null;
  range_high?: number | null;
  currency?: string | null;
  needs_revenue_confirmation?: boolean | null;
  translation?: {
    customer_values_low?: number | null;
    customer_values_high?: number | null;
  } | null;
  confidence_label?: ConstraintConfidence | null;
  disclaimer?: string | null;
};

export type ApproachData = {
  counts?: Partial<Record<ApproachCode, number>>;
  percentages?: Partial<Record<ApproachCode, number>>;
  labels?: Partial<Record<ApproachCode, string>>;
  dominant?: ApproachCode | null;
  secondary?: ApproachCode | "BALANCED" | null;
  map?: {
    x_people_trust_minus_evidence_proof?: number | null;
    y_future_possibility_minus_timing_certainty?: number | null;
  } | null;
};

export type CommercialContext = {
  currency?: string | null;
  revenue_band?: string | null;
  monthly_opportunity_band?: string | null;
  initial_customer_value_band?: string | null;
};

export type InevitableStandardScore = {
  scoring_complete?: boolean;
  overall?: {
    raw?: number;
    max?: number;
    percentage?: number;
    level?: string;
    label?: string;
  };
  pillars?: Partial<Record<PillarKey, PillarResult>>;
  approaches?: ApproachData;
  constraints?: ConstraintResult | null;
  revenue_in_structure?: RevenueInStructure | null;
  context_answers?: Partial<Record<13 | 26 | 27 | 28 | 29, string | null>> | null;
  commercial_context?: CommercialContext | null;
};

export type ResultPayload = {
  test_name?: string | null;
  org_name?: string | null;
  completed_at?: string | null;
  taker?: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
  };
  business_name?: string | null;
  inevitable_standard?: InevitableStandardScore | null;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const PILLARS: Array<{ key: PillarKey; label: string; descriptor: string }> = [
  {
    key: "identity",
    label: "Identity",
    descriptor: "Authority, commercial confidence and willingness to lead.",
  },
  {
    key: "positioning",
    label: "Positioning",
    descriptor: "How clearly the market understands and chooses you.",
  },
  {
    key: "offer",
    label: "Offer",
    descriptor: "The clarity, boundaries and repeatability of what you sell.",
  },
  {
    key: "sales",
    label: "Sales",
    descriptor: "Discovery, conversion and the quality of the buying path.",
  },
  {
    key: "revenue_model",
    label: "Revenue Model",
    descriptor: "Margin, retention, owner reward and transferability.",
  },
  {
    key: "decision",
    label: "Decision",
    descriptor: "Commercial focus, follow-through and decision discipline.",
  },
];

export const PILLAR_BY_KEY: Record<string, { label: string; descriptor: string }> =
  Object.fromEntries(
    PILLARS.map((pillar) => [
      pillar.key,
      { label: pillar.label, descriptor: pillar.descriptor },
    ]),
  );

export const APPROACHES: Array<{ code: ApproachCode; label: string }> = [
  { code: "A", label: "Future-Led" },
  { code: "B", label: "Connection-Led" },
  { code: "C", label: "Timing-Led" },
  { code: "D", label: "Evidence-Led" },
];

/** Fallback constraint sentences — used when the content layer has no entry. */
export const PILLAR_CONSTRAINT_COPY: Record<PillarKey, string> = {
  identity:
    "The business is not consistently claiming its value or holding its position, so strong work elsewhere gets discounted before it can compound.",
  positioning:
    "The right buyers cannot quickly recognise the problem, outcome and distinct choice on offer, so demand stays harder to create than it should be.",
  offer:
    "What is being sold lacks clear boundaries or a repeatable path, so each sale is negotiated from scratch and value leaks.",
  sales:
    "Conversations do not reliably move from understanding the need to a clear decision, so good opportunities stall rather than resolve.",
  revenue_model:
    "The business is not deliberately protecting margin, building repeat value or rewarding ownership, so revenue grows without enough of it being kept.",
  decision:
    "Priorities and follow-through shift too easily, so momentum is lost and important calls stay open longer than they should.",
};

export const APPROACH_LENS_COPY: Record<ApproachCode, string> = {
  A: "A Future-Led approach leans toward possibility, direction and the larger outcome. This may shape how the result above shows up — momentum can run ahead of the structure that would make it repeatable.",
  B: "A Connection-Led approach leans toward people, relevance and the quality of the relationship. This may shape how the result shows up — trust builds well, while the point where a clear decision is asked for can be left softer than it needs to be.",
  C: "A Timing-Led approach leans toward sequence, readiness and what needs to happen first. This may shape how the result shows up — quality is protected, while decisions can stay open longer than the commercial situation needs.",
  D: "An Evidence-Led approach leans toward proof, clarity and a sound basis for action. This may shape how the result shows up — judgement is sound, while the search for certainty can slow a decision that is already clear enough.",
};

export const OPENING_COPY =
  "Your Inevitable Standard Readiness shows how deliberately your business is currently built to move revenue through to profit, personal wealth and greater freedom. It is calculated across six areas of the business and is designed to show where the foundations are already working and where greater structure could have the biggest impact.";

export const PRIORITY_ORDER_NOTE =
  "The order is not a ranking of importance. It is the sequence in which work compounds fastest for this result.";

/** Method-layer grouping (spec §3), used by the framework-model visual. */
export const METHOD_LAYERS: Array<{
  layer: "Identity" | "Structure" | "Execution";
  blurb: string;
  pillars: PillarKey[];
}> = [
  {
    layer: "Identity",
    blurb: "What the business believes it is allowed to charge and lead on.",
    pillars: ["identity"],
  },
  {
    layer: "Structure",
    blurb: "How the offer, position and revenue model are built to hold.",
    pillars: ["positioning", "offer", "revenue_model"],
  },
  {
    layer: "Execution",
    blurb: "Whether the selling and the daily decisions actually happen.",
    pillars: ["sales", "decision"],
  },
];

/** Revenue → Profit → Personal Wealth → Freedom chain (spec §5). */
export const REVENUE_CHAIN: Array<{ label: string; blurb: string }> = [
  { label: "Revenue", blurb: "What the business brings in." },
  { label: "Profit", blurb: "What it keeps after it has been fed." },
  { label: "Personal Wealth", blurb: "What that profit builds for the owner." },
  { label: "Freedom", blurb: "The choice and time that wealth is meant to buy." },
];

export const FIX_ORDER_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

export const METHOD_LAYER_LABEL: Record<
  PillarKey,
  "Identity" | "Structure" | "Execution"
> = {
  identity: "Identity",
  positioning: "Structure",
  offer: "Structure",
  revenue_model: "Structure",
  sales: "Execution",
  decision: "Execution",
};

export const BANDS: Array<{ min: number; label: string }> = [
  { min: 0, label: "Chance-Based" },
  { min: 40, label: "Inconsistent" },
  { min: 60, label: "Partly Structured" },
  { min: 80, label: "Deliberate & Repeatable" },
];

/** Short band language, reused from spec §2. */
export const BAND_MEANING: Record<string, string> = {
  "Chance-Based":
    "Right now the result is carried mostly by effort, instinct and hope rather than by structure.",
  Inconsistent:
    "Some parts of the business are working, but value, time and money are still leaking in places.",
  "Partly Structured":
    "There is a working base to build on. It needs tightening before it is ready to scale.",
  "Deliberate & Repeatable":
    "The business is built clearly enough to support predictable results.",
};

export type Gar = "green" | "amber" | "red";

export const GAR: Record<
  Gar,
  { letter: string; name: string; tone: string; bar: string; chipBg: string; chipText: string }
> = {
  green: {
    letter: "G",
    name: "Green",
    tone: "Leverage this strength",
    bar: "#5b8a72",
    chipBg: "#eef2ef",
    chipText: "#3f5e50",
  },
  amber: {
    letter: "A",
    name: "Amber",
    tone: "Strengthen and stabilise",
    bar: "#b58a45",
    chipBg: "#f5f0e6",
    chipText: "#7a5a28",
  },
  red: {
    letter: "R",
    name: "Red",
    tone: "Priority — investigate and rebuild",
    bar: "#a6564e",
    chipBg: "#f2eae8",
    chipText: "#7c3f39",
  },
};

export function garForRisk(risk: string | undefined): Gar {
  if (risk === "low_risk") return "green";
  if (risk === "medium_risk") return "amber";
  return "red";
}

/**
 * Primary-constraint sentence. Prefers sourced copy from the content layer,
 * matched to the pillar's band; falls back to PILLAR_CONSTRAINT_COPY when the
 * content layer has no entry for that pillar/band.
 */
export function primaryConstraintSentence(pillar: PillarKey, band: Gar): string {
  const bandContent = getInevitableStandardPillarBandContent(pillar, band);
  return (
    bandContent.what_this_means?.text ||
    bandContent.where_leaking?.text ||
    PILLAR_CONSTRAINT_COPY[pillar] ||
    ""
  );
}

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                                */
/* -------------------------------------------------------------------------- */

export function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampPercentage(value: unknown): number {
  return Math.max(0, Math.min(100, numberOr(value)));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function humanise(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function pillarLabel(key?: string | null): string {
  return PILLAR_BY_KEY[String(key ?? "")]?.label || humanise(key);
}

export function pillarDescriptor(key?: string | null): string {
  return PILLAR_BY_KEY[String(key ?? "")]?.descriptor || "";
}

export function formatWhole(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(parsed),
  );
}

export function formatCurrencyAmount(
  currency: string | null | undefined,
  value: unknown,
): string {
  const amount = formatWhole(value);
  if (!amount) return "";
  const code = (currency || "").trim();
  return code ? `${code} ${amount}` : amount;
}

export function bandLabelFor(percentage: number): string {
  let label = BANDS[0].label;
  for (const band of BANDS) if (percentage >= band.min) label = band.label;
  return label;
}

export function formatAssessmentDate(completedAt: string | null | undefined): string {
  const date = completedAt ? new Date(completedAt) : null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date && !Number.isNaN(date.getTime()) ? date : new Date());
}

/* -------------------------------------------------------------------------- */
/* Presentational pieces                                                       */
/* -------------------------------------------------------------------------- */

export function Eyebrow({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "light";
}) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.24em]"
      style={{ color: tone === "light" ? "rgba(255,255,255,0.62)" : GOLD_TEXT }}
    >
      {children}
    </p>
  );
}

/** Circular readiness gauge — a single value shown as a gold arc on a faint track. */
export function ReadinessDonut({
  percentage,
  band,
  onLight = false,
}: {
  percentage: number;
  band: string;
  onLight?: boolean;
}) {
  const size = 232;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = clampPercentage(percentage);
  const filled = (pct / 100) * circumference;
  const center = size / 2;
  const track = onLight ? "rgba(20,38,61,0.10)" : "rgba(255,255,255,0.14)";
  const figure = onLight ? INK : "#ffffff";
  const caption = onLight ? "#6b7280" : "rgba(255,255,255,0.65)";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-[176px] w-[176px] sm:h-[212px] sm:w-[212px]"
      role="img"
      aria-label={`Inevitable Standard Readiness ${round1(pct)} percent, ${band}`}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={track}
        strokeWidth={stroke}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={GOLD}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        style={serif}
        fontSize="46"
        fill={figure}
      >
        {round1(pct)}%
      </text>
      <text
        x={center}
        y={center + 28}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        letterSpacing="2"
        fill={caption}
      >
        {band.toUpperCase()}
      </text>
    </svg>
  );
}

export function BandMeter({ percentage }: { percentage: number }) {
  return (
    <div className="mt-2">
      <div
        className="relative h-2 w-full rounded-full"
        style={{ backgroundColor: "#ece7dd" }}
      >
        {[40, 60, 80].map((mark) => (
          <span
            key={mark}
            className="absolute top-0 h-2 w-px"
            style={{ left: `${mark}%`, backgroundColor: "#d6cfc0" }}
          />
        ))}
        <span
          className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow-sm"
          style={{
            left: `${clampPercentage(percentage)}%`,
            backgroundColor: NAVY,
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-[#9a9384]">
        {BANDS.map((band) => (
          <span key={band.label}>{band.label}</span>
        ))}
      </div>
    </div>
  );
}

export function PillarBar({
  percentage,
  colour,
}: {
  percentage: number;
  colour: string;
}) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "#ece7dd" }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${clampPercentage(percentage)}%`, backgroundColor: colour }}
      />
    </div>
  );
}

/**
 * Six-pillar row list — label + descriptor, severity bar + %, G/A/R chip.
 * Shared by both reports (the snapshot and the full report's opening summary).
 */
export function PillarSummaryList({
  pillars,
}: {
  pillars: Array<{
    key: PillarKey;
    label: string;
    descriptor: string;
    percentage: number;
    gar: Gar;
  }>;
}) {
  return (
    <div className="border-t" style={{ borderColor: HAIRLINE }}>
      {pillars.map((pillar) => {
        const gar = GAR[pillar.gar];
        return (
          <div
            key={pillar.key}
            className="grid grid-cols-1 gap-3 border-b py-5 sm:grid-cols-[190px_1fr_auto] sm:items-center sm:gap-6"
            style={{ borderColor: HAIRLINE }}
          >
            <div>
              <p
                className="text-[15px] font-medium"
                style={{ ...serif, color: INK }}
              >
                {pillar.label}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-[#918a7d]">
                {pillar.descriptor}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PillarBar percentage={pillar.percentage} colour={gar.bar} />
              <span
                className="w-11 shrink-0 text-right text-[15px] font-semibold tabular-nums"
                style={{ color: INK }}
              >
                {pillar.percentage}%
              </span>
            </div>
            <span
              className="justify-self-start rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:justify-self-end"
              style={{ backgroundColor: gar.chipBg, color: gar.chipText }}
            >
              {gar.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function GarLegend() {
  return (
    <p className="mt-6 text-[12px] leading-6 text-[#918a7d]">
      <strong className="font-semibold text-[#4b5563]">Green</strong> — a strength to
      leverage.&nbsp;&nbsp;
      <strong className="font-semibold text-[#4b5563]">Amber</strong> — working, needs
      strengthening and stabilising.&nbsp;&nbsp;
      <strong className="font-semibold text-[#4b5563]">Red</strong> — a priority for
      investigation and rebuild.
    </p>
  );
}

/**
 * Restrained decision-approach map. One gold marker on a two-axis plot.
 * Vertical: Future ↔ Timing. Horizontal: Evidence ↔ Connection.
 */
export function ApproachCompass({ x, y }: { x: number; y: number }) {
  const size = 260;
  const height = 230;
  const cx = size / 2;
  const cy = height / 2;
  const reach = 54;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value / 50));
  const px = cx + clamp(x) * reach;
  const py = cy - clamp(y) * reach;
  const line = "#cfc9bd";
  const label = "#6b7280";

  return (
    <svg
      viewBox={`0 0 ${size} ${height}`}
      className="mx-auto h-[230px] w-full max-w-[280px]"
      role="img"
      aria-label="Commercial decision approach map"
    >
      <rect x={cx - 70} y={cy - 70} width={140} height={140} fill="none" stroke={line} />
      <line x1={cx} y1={cy - 70} x2={cx} y2={cy + 70} stroke={line} />
      <line x1={cx - 70} y1={cy} x2={cx + 70} y2={cy} stroke={line} />
      <text x={cx} y={cy - 84} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill={label}>
        FUTURE
      </text>
      <text x={cx} y={cy + 96} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill={label}>
        TIMING
      </text>
      <text x={cx - 78} y={cy + 3} textAnchor="end" fontSize="10" letterSpacing="1" fill={label}>
        EVIDENCE
      </text>
      <text x={cx + 78} y={cy + 3} textAnchor="start" fontSize="10" letterSpacing="1" fill={label}>
        CONNECTION
      </text>
      <circle cx={px} cy={py} r="9" fill="none" stroke={GOLD} strokeWidth="1" opacity="0.4" />
      <circle cx={px} cy={py} r="4.5" fill={GOLD} />
    </svg>
  );
}

/**
 * Revenue-in-Structure panel. Shared by both reports.
 * - variant="compact" (Report 1): range + framing line + disclaimer.
 * - variant="full" (Report 2): also the customer-value translation line, when
 *   the estimate carries one.
 */
export function RevenueInStructurePanel({
  rre,
  variant = "compact",
}: {
  rre: RevenueInStructure | null;
  variant?: "compact" | "full";
}) {
  if (!rre) return null;

  const showConfirm = !!rre.needs_revenue_confirmation;
  const low = formatCurrencyAmount(rre.currency, rre.range_low);
  const high = formatCurrencyAmount(rre.currency, rre.range_high);

  const translation = rre.translation;
  const translationLow = Number(translation?.customer_values_low);
  const translationHigh = Number(translation?.customer_values_high);
  const showTranslation =
    variant === "full" &&
    !showConfirm &&
    Number.isFinite(translationLow) &&
    Number.isFinite(translationHigh) &&
    translationHigh >= 1;

  const formatCount = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <div className="border-l-2 pl-5" style={{ borderColor: GOLD }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#918a7d]">
        Revenue in your structure
      </p>

      {showConfirm ? (
        <p className="mt-1 text-[13px] leading-6 text-[#4b5563]">
          A revenue-in-structure range needs a specific annual figure at this scale. Your
          advisor can add it.
        </p>
      ) : (
        <>
          <p
            className="mt-1 text-lg font-semibold tabular-nums"
            style={{ color: INK }}
          >
            {low} <span className="font-normal text-[#9a9384]">–</span> {high}
          </p>
          <p className="mt-1 text-[13px] leading-6 text-[#4b5563]">
            Commercial value that may be easier to convert, retain or release as{" "}
            {pillarLabel(rre.primary_constraint_pillar)} becomes more deliberate.
          </p>
          {showTranslation ? (
            <p className="mt-1 text-[13px] leading-6 text-[#4b5563]">
              At your typical first-purchase value, that is roughly{" "}
              {formatCount(translationLow)}–{formatCount(translationHigh)} new customers&rsquo;
              worth of value sitting inside the current structure.
            </p>
          ) : null}
          {rre.disclaimer ? (
            <p className="mt-2 text-[11px] leading-5 text-[#9a9384]">{rre.disclaimer}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Derived view helpers                                                        */
/* -------------------------------------------------------------------------- */

export type PillarView = {
  key: PillarKey;
  label: string;
  descriptor: string;
  percentage: number;
  gar: Gar;
};

export function buildPillarView(score: InevitableStandardScore): PillarView[] {
  return PILLARS.map((pillar) => {
    const result = score.pillars?.[pillar.key] || {};
    return {
      ...pillar,
      percentage: round1(clampPercentage(result.percentage)),
      gar: garForRisk(result.risk),
    };
  });
}

/**
 * Full 6-pillar priority order. Uses the stored constraint engine order when
 * present; otherwise falls back to ascending pillar percentage (lowest first),
 * matching how Report 1 degrades.
 */
export function resolvePriorityOrder(
  constraints: ConstraintResult | null,
  pillarView: PillarView[],
): PillarKey[] {
  const stored = Array.isArray(constraints?.priority_fix_order)
    ? (constraints!.priority_fix_order!.filter(Boolean) as string[])
    : [];

  const ordered = stored.filter((key): key is PillarKey =>
    PILLARS.some((pillar) => pillar.key === key),
  );

  // Ensure all six appear even if stored data is a short pre-change list.
  for (const pillar of [...pillarView].sort((a, b) => a.percentage - b.percentage)) {
    if (!ordered.includes(pillar.key)) ordered.push(pillar.key);
  }

  return ordered;
}
