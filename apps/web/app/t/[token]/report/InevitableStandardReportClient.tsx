"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Newsreader } from "next/font/google";
import { getBaseUrl } from "@/lib/server-url";
import { getInevitableStandardPillarBandContent } from "@/lib/inevitable-standard/content/reportCopy";

/* -------------------------------------------------------------------------- */
/* Display type — Newsreader for headings, the readiness figure and pillar     */
/* names. Body copy stays on the platform sans (Inter). Self-hosted by         */
/* next/font, so no external request and no change to any other surface.       */
/* -------------------------------------------------------------------------- */

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

const serif: CSSProperties = {
  fontFamily:
    "var(--font-newsreader), ui-serif, Georgia, 'Times New Roman', serif",
};

/* -------------------------------------------------------------------------- */
/* Design tokens (spec §5 — Reporting Suite design brief)                      */
/* -------------------------------------------------------------------------- */

const NAVY_DEEP = "#14263d";
const NAVY = "#1f2c46";
const NAVY_GRADIENT = `linear-gradient(158deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`;
const GOLD = "#b89a5e"; // arcs, rules, dots, borders
const GOLD_TEXT = "#8a6a3c"; // small-caps labels on the ivory ground
const IVORY = "#faf8f4"; // page ground
const IVORY_PANEL = "#f5efe3"; // sidebar / inset panels
const IVORY_BORDER = "#e7ddc8";
const INK = "#1e2a38";
const HAIRLINE = "#e7e3db";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type PillarKey =
  | "identity"
  | "positioning"
  | "offer"
  | "sales"
  | "revenue_model"
  | "decision";

type ApproachCode = "A" | "B" | "C" | "D";

type PillarResult = {
  raw?: number;
  max?: number;
  percentage?: number;
  risk?: "high_risk" | "medium_risk" | "low_risk";
  risk_label?: string;
};

type ConstraintConfidence = "High" | "Medium" | "Directional";

type FalseConstraint = {
  stated_pillar?: string | null;
  evidence_pillar?: string | null;
  mismatch?: boolean | null;
  explanation?: string | null;
};

type ConstraintResult = {
  primary_constraint?: PillarKey | string | null;
  secondary_constraint?: PillarKey | string | null;
  false_constraint?: FalseConstraint | null;
  priority_fix_order?: Array<PillarKey | string> | null;
  confidence?: ConstraintConfidence | null;
  identity_decision_override?: boolean | null;
};

type RevenueInStructure = {
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

type ApproachData = {
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

type InevitableStandardScore = {
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
};

type ResultPayload = {
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

const PILLARS: Array<{ key: PillarKey; label: string; descriptor: string }> = [
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

const PILLAR_BY_KEY: Record<string, { label: string; descriptor: string }> =
  Object.fromEntries(
    PILLARS.map((pillar) => [
      pillar.key,
      { label: pillar.label, descriptor: pillar.descriptor },
    ]),
  );

const APPROACHES: Array<{ code: ApproachCode; label: string }> = [
  { code: "A", label: "Future-Led" },
  { code: "B", label: "Connection-Led" },
  { code: "C", label: "Timing-Led" },
  { code: "D", label: "Evidence-Led" },
];

/**
 * Fallback constraint sentences. Used when the content layer has no entry for the
 * primary-constraint pillar at its band — see primaryConstraintSentence().
 */
const PILLAR_CONSTRAINT_COPY: Record<PillarKey, string> = {
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

const APPROACH_LENS_COPY: Record<ApproachCode, string> = {
  A: "A Future-Led approach leans toward possibility, direction and the larger outcome. This may shape how the result above shows up — momentum can run ahead of the structure that would make it repeatable.",
  B: "A Connection-Led approach leans toward people, relevance and the quality of the relationship. This may shape how the result shows up — trust builds well, while the point where a clear decision is asked for can be left softer than it needs to be.",
  C: "A Timing-Led approach leans toward sequence, readiness and what needs to happen first. This may shape how the result shows up — quality is protected, while decisions can stay open longer than the commercial situation needs.",
  D: "An Evidence-Led approach leans toward proof, clarity and a sound basis for action. This may shape how the result shows up — judgement is sound, while the search for certainty can slow a decision that is already clear enough.",
};

const OPENING_COPY =
  "Your Inevitable Standard Readiness shows how deliberately your business is currently built to move revenue through to profit, personal wealth and greater freedom. It is calculated across six areas of the business and is designed to show where the foundations are already working and where greater structure could have the biggest impact.";

const PRIORITY_ORDER_NOTE =
  "The order is not a ranking of importance. It is the sequence in which work compounds fastest for this result.";

const FIX_ORDER_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

const METHOD_LAYER_LABEL: Record<PillarKey, "Identity" | "Structure" | "Execution"> = {
  identity: "Identity",
  positioning: "Structure",
  offer: "Structure",
  revenue_model: "Structure",
  sales: "Execution",
  decision: "Execution",
};

const BANDS: Array<{ min: number; label: string }> = [
  { min: 0, label: "Chance-Based" },
  { min: 40, label: "Inconsistent" },
  { min: 60, label: "Partly Structured" },
  { min: 80, label: "Deliberate & Repeatable" },
];

/** Short band language, reused from spec §2. */
const BAND_MEANING: Record<string, string> = {
  "Chance-Based":
    "Right now the result is carried mostly by effort, instinct and hope rather than by structure.",
  Inconsistent:
    "Some parts of the business are working, but value, time and money are still leaking in places.",
  "Partly Structured":
    "There is a working base to build on. It needs tightening before it is ready to scale.",
  "Deliberate & Repeatable":
    "The business is built clearly enough to support predictable results.",
};

/* Green / Amber / Red — muted and editorial, never traffic-light. Green means
 * "leverage this strength", not "ignore this". */
type Gar = "green" | "amber" | "red";

const GAR: Record<
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

function garForRisk(risk: string | undefined): Gar {
  if (risk === "low_risk") return "green";
  if (risk === "medium_risk") return "amber";
  return "red";
}

/**
 * The primary-constraint sentence shown in Key Diagnosis. Prefers sourced copy
 * from the content layer, matched to the pillar's band; falls back to the in-file
 * PILLAR_CONSTRAINT_COPY string when the content layer has no entry for that
 * pillar/band (Red for any pillar, Green for most).
 */
function primaryConstraintSentence(pillar: PillarKey, band: Gar): string {
  const bandContent = getInevitableStandardPillarBandContent(pillar, band);
  return (
    bandContent.what_this_means?.text ||
    bandContent.where_leaking?.text ||
    PILLAR_CONSTRAINT_COPY[pillar] ||
    ""
  );
}

/* Report Index — drives the persistent sidebar nav and the print-only index. */
const SECTIONS: Array<{ id: string; label: string }> = [
  { id: "readiness", label: "Readiness Overview" },
  { id: "pillars", label: "The Six Pillars" },
  { id: "diagnosis", label: "Key Diagnosis" },
  { id: "approach", label: "Decision Approach" },
  { id: "priorities", label: "Your First Three Priorities" },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercentage(value: unknown): number {
  return Math.max(0, Math.min(100, numberOr(value)));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function humanise(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function pillarLabel(key?: string | null): string {
  return PILLAR_BY_KEY[String(key ?? "")]?.label || humanise(key);
}

function pillarDescriptor(key?: string | null): string {
  return PILLAR_BY_KEY[String(key ?? "")]?.descriptor || "";
}

function formatWhole(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(parsed),
  );
}

function formatCurrencyAmount(
  currency: string | null | undefined,
  value: unknown,
): string {
  const amount = formatWhole(value);
  if (!amount) return "";
  const code = (currency || "").trim();
  return code ? `${code} ${amount}` : amount;
}

function bandLabelFor(percentage: number): string {
  let label = BANDS[0].label;
  for (const band of BANDS) if (percentage >= band.min) label = band.label;
  return label;
}

/* -------------------------------------------------------------------------- */
/* Small presentational pieces                                                 */
/* -------------------------------------------------------------------------- */

function Eyebrow({
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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mt-3 text-[26px] leading-snug sm:text-[30px]"
      style={{ ...serif, color: INK }}
    >
      {children}
    </h2>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-t py-12 first:border-t-0 first:pt-0 sm:py-14 print:break-inside-avoid"
      style={{ borderColor: HAIRLINE }}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>
      {intro ? (
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
          {intro}
        </p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

/**
 * Circular readiness gauge. A single value (overall readiness %), shown as a
 * gold arc on a faint track, with the figure and band word in the centre.
 */
function ReadinessDonut({
  percentage,
  band,
}: {
  percentage: number;
  band: string;
}) {
  const size = 232;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = clampPercentage(percentage);
  const filled = (pct / 100) * circumference;
  const center = size / 2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-[200px] w-[200px] sm:h-[232px] sm:w-[232px]"
      role="img"
      aria-label={`Inevitable Standard Readiness ${round1(pct)} percent, ${band}`}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
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
        fill="#ffffff"
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
        fill="rgba(255,255,255,0.65)"
      >
        {band.toUpperCase()}
      </text>
    </svg>
  );
}

function BandMeter({ percentage }: { percentage: number }) {
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

function PillarBar({ percentage, colour }: { percentage: number; colour: string }) {
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
 * Restrained decision-approach map. One marker on a two-axis plot — no fill,
 * no icons, one gold accent dot. Vertical: Future ↔ Timing.
 * Horizontal: Evidence ↔ Connection.
 */
function ApproachCompass({ x, y }: { x: number; y: number }) {
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

function SidebarIndex({
  activeSection,
  readiness,
  band,
}: {
  activeSection: string;
  readiness: number;
  band: string;
}) {
  return (
    <aside className="hidden lg:block print:hidden">
      <div
        className="sticky top-8 rounded-2xl border p-6"
        style={{ backgroundColor: IVORY_PANEL, borderColor: IVORY_BORDER }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: GOLD_TEXT }}
        >
          Report Index
        </p>

        <div
          className="mt-4 border-t pt-4"
          style={{ borderColor: IVORY_BORDER }}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9a9384]">
            Readiness
          </p>
          <p
            className="mt-1 text-[28px] leading-none"
            style={{ ...serif, color: INK }}
          >
            {round1(readiness)}%
          </p>
          <p className="mt-1 text-[12px] text-[#6b7280]">{band}</p>
        </div>

        <nav className="mt-5 space-y-1">
          {SECTIONS.map((section, index) => {
            const active = section.id === activeSection;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                className="flex gap-3 rounded-lg px-3 py-2 text-[13px] leading-5 transition"
                style={
                  active
                    ? { backgroundColor: NAVY_DEEP, color: "#ffffff" }
                    : { color: "#5b6472" }
                }
              >
                <span
                  className="tabular-nums"
                  style={{ color: active ? GOLD : "#a99a78" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{section.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function InevitableStandardReportClient({
  token,
  tid,
}: {
  token: string;
  tid: string;
}) {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const base = await getBaseUrl();
        const response = await fetch(
          `${base}/api/public/test/${encodeURIComponent(token)}/result?tid=${encodeURIComponent(tid)}`,
          { cache: "no-store" },
        );
        const json = await response.json().catch(() => null);

        if (!response.ok || json?.ok === false) {
          throw new Error(json?.error || `Unable to load report (${response.status})`);
        }

        const nextPayload = (json?.data || null) as ResultPayload | null;
        if (!nextPayload?.inevitable_standard) {
          throw new Error(
            "The Inevitable Standard result is not available for this test taker.",
          );
        }

        if (!cancelled) setPayload(nextPayload);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load report.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (tid) load();
    else {
      setError("This report link is missing the required test-taker id.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [tid, token]);

  // Scroll-spy for the persistent Report Index. Runs once the sections exist.
  useEffect(() => {
    if (!payload) return;
    if (typeof IntersectionObserver === "undefined") return;

    const elements = SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0, 0.2, 0.5, 1] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [payload]);

  const score = payload?.inevitable_standard;

  if (loading) {
    return (
      <main
        className={`${newsreader.variable} min-h-screen px-6 py-16`}
        style={{ backgroundColor: IVORY, color: INK }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-[#8b8f98]">Preparing your Diagnostic Snapshot…</p>
        </div>
      </main>
    );
  }

  if (error || !score) {
    return (
      <main
        className={`${newsreader.variable} min-h-screen px-6 py-16`}
        style={{ backgroundColor: IVORY, color: INK }}
      >
        <div className="mx-auto max-w-2xl">
          <Eyebrow>The Inevitable Standard Diagnostic™</Eyebrow>
          <h1 className="mt-3 text-3xl" style={serif}>
            Report not available
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5563]">
            {error || "The completed assessment result could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const overall = score.overall || {};
  const approaches = score.approaches || {};
  const constraints = score.constraints ?? null;
  const revenueInStructure = score.revenue_in_structure ?? null;

  const overallPercentage = round1(clampPercentage(overall.percentage));
  const bandDescriptor = overall.label || bandLabelFor(overallPercentage);
  const bandMeaning =
    BAND_MEANING[bandLabelFor(overallPercentage)] || BAND_MEANING[bandDescriptor] || "";

  const clientName =
    [payload?.taker?.first_name, payload?.taker?.last_name]
      .map((part) => (part || "").trim())
      .filter(Boolean)
      .join(" ") || "—";
  const businessName =
    (payload?.taker?.company || payload?.business_name || "").trim() || null;
  const completedAt = payload?.completed_at ? new Date(payload.completed_at) : null;
  const assessmentDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(
    completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : new Date(),
  );
  const orgName = (payload?.org_name || "").trim();

  const pillarView = PILLARS.map((pillar) => {
    const result = score.pillars?.[pillar.key] || {};
    return {
      ...pillar,
      percentage: round1(clampPercentage(result.percentage)),
      gar: garForRisk(result.risk),
    };
  });

  const pillarsByPct = [...pillarView].sort((a, b) => a.percentage - b.percentage);
  const lowestPillar = pillarsByPct[0] || null;

  const primaryKey = (constraints?.primary_constraint as PillarKey | undefined) || null;
  const primaryBand: Gar | null = primaryKey
    ? pillarView.find((pillar) => pillar.key === primaryKey)?.gar ?? null
    : null;
  const secondaryKey =
    (constraints?.secondary_constraint as PillarKey | undefined) || null;
  const falseConstraint = constraints?.false_constraint ?? null;

  const rankedFixOrder = Array.isArray(constraints?.priority_fix_order)
    ? (constraints!.priority_fix_order!.filter(Boolean) as string[])
    : [];
  const firstThree = (
    rankedFixOrder.length > 0
      ? rankedFixOrder
      : pillarsByPct.map((pillar) => pillar.key)
  ).slice(0, 3);

  // When the primary constraint sits outside the top 3 priorities (it is in a
  // later Method layer), explain the gap. Position is derived from the array.
  const primaryFixPosition =
    primaryKey && rankedFixOrder.length > 0
      ? rankedFixOrder.indexOf(primaryKey)
      : -1;
  const layersBeforePrimary =
    primaryKey && METHOD_LAYER_LABEL[primaryKey] === "Execution"
      ? "Identity and Structure"
      : primaryKey && METHOD_LAYER_LABEL[primaryKey] === "Structure"
        ? "Identity"
        : "";
  const showConstraintSequenceNote =
    primaryFixPosition >= 3 && !!layersBeforePrimary;
  const primaryPositionLabel =
    primaryFixPosition >= 0
      ? FIX_ORDER_LABELS[primaryFixPosition] || `${primaryFixPosition + 1}`
      : "";

  const dominant = approaches.dominant || null;
  const dominantLabel = dominant
    ? approaches.labels?.[dominant] ||
      APPROACHES.find((item) => item.code === dominant)?.label ||
      dominant
    : null;
  const dominantPct = dominant
    ? round1(clampPercentage(approaches.percentages?.[dominant]))
    : 0;

  const approachPercent = (code: ApproachCode) =>
    round1(clampPercentage(approaches.percentages?.[code]));
  const compassX =
    numberOr(
      approaches.map?.x_people_trust_minus_evidence_proof,
      approachPercent("B") - approachPercent("D"),
    ) || 0;
  const compassY =
    numberOr(
      approaches.map?.y_future_possibility_minus_timing_certainty,
      approachPercent("A") - approachPercent("C"),
    ) || 0;

  const rreShowRange =
    !!revenueInStructure && !revenueInStructure.needs_revenue_confirmation;
  const rreShowConfirm =
    !!revenueInStructure && !!revenueInStructure.needs_revenue_confirmation;

  return (
    <main
      className={`${newsreader.variable} min-h-screen`}
      style={{ backgroundColor: IVORY, color: INK }}
    >
      <button
        type="button"
        onClick={() => window.print()}
        className="fixed right-4 top-4 z-20 rounded-full border bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b5563] shadow-sm backdrop-blur transition hover:bg-white print:hidden"
        style={{ borderColor: IVORY_BORDER }}
      >
        Print / Save PDF
      </button>

      {/* Navy gradient hero — cover + readiness gauge */}
      <header
        className="text-white print:break-after-page"
        style={{
          background: NAVY_GRADIENT,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
            <div>
              <Eyebrow tone="light">The Inevitable Standard Diagnostic™</Eyebrow>
              <h1
                className="mt-4 text-[40px] leading-[1.08] sm:text-[58px]"
                style={serif}
              >
                Map Your Revenue-To-Freedom Pathway
              </h1>
              <p
                className="mt-4 text-xl text-white/70 sm:text-2xl"
                style={serif}
              >
                Your Diagnostic Snapshot
              </p>

              <div
                className="mt-8 h-px w-16"
                style={{ backgroundColor: GOLD }}
              />

              <dl className="mt-8 space-y-2 text-[14px]">
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-white/45">Prepared for</dt>
                  <dd className="font-medium text-white">{clientName}</dd>
                </div>
                {businessName ? (
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-white/45">Business</dt>
                    <dd className="text-white/80">{businessName}</dd>
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-white/45">Assessment date</dt>
                  <dd className="text-white/80">{assessmentDate}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col items-center gap-3 justify-self-center lg:justify-self-end">
              <ReadinessDonut
                percentage={overallPercentage}
                band={bandDescriptor}
              />
              <p className="max-w-[220px] text-center text-[11px] uppercase tracking-[0.16em] text-white/45">
                Inevitable Standard Readiness
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Print-only Report Index (the sidebar is screen-only) */}
      <div className="mx-auto hidden max-w-6xl px-6 pt-8 sm:px-10 print:block">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: GOLD_TEXT }}
        >
          Report Index
        </p>
        <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[#4b5563]">
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <span className="tabular-nums" style={{ color: GOLD_TEXT }}>
                {String(index + 1).padStart(2, "0")}
              </span>{" "}
              {section.label}
            </li>
          ))}
        </ol>
      </div>

      {/* Two-column body: persistent ivory sidebar + report */}
      <div className="mx-auto max-w-6xl gap-x-12 px-6 py-12 sm:px-10 lg:grid lg:grid-cols-[240px_1fr] lg:py-16 print:block">
        <SidebarIndex
          activeSection={activeSection}
          readiness={overallPercentage}
          band={bandDescriptor}
        />

        <div className="min-w-0">
          {/* 1 — Readiness overview */}
          <Section
            id="readiness"
            eyebrow="Your Inevitable Standard Readiness"
            title="Where the business stands today"
            intro={OPENING_COPY}
          >
            <BandMeter percentage={overallPercentage} />
            {bandMeaning ? (
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
                Your result sits in the{" "}
                <strong className="font-semibold" style={{ color: INK }}>
                  {bandDescriptor}
                </strong>{" "}
                band. {bandMeaning}
              </p>
            ) : null}
          </Section>

          {/* 2 — Six-pillar display */}
          <Section
            id="pillars"
            eyebrow="The Six Pillars"
            title="Where the business is built — and where it is exposed"
          >
            <div className="border-t" style={{ borderColor: HAIRLINE }}>
              {pillarView.map((pillar) => {
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
            <p className="mt-6 text-[12px] leading-6 text-[#918a7d]">
              <strong className="font-semibold text-[#4b5563]">Green</strong> — a strength to
              leverage.&nbsp;&nbsp;
              <strong className="font-semibold text-[#4b5563]">Amber</strong> — working, needs
              strengthening and stabilising.&nbsp;&nbsp;
              <strong className="font-semibold text-[#4b5563]">Red</strong> — a priority for
              investigation and rebuild.
            </p>
          </Section>

          {/* 3 — Key diagnosis */}
          <Section
            id="diagnosis"
            eyebrow="Key Diagnosis"
            title="What is most likely shaping the result"
          >
            {primaryKey ? (
              <div className="space-y-10">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: GOLD_TEXT }}
                  >
                    Primary constraint
                  </p>
                  <p
                    className="mt-1 text-xl"
                    style={{ ...serif, color: INK }}
                  >
                    {pillarLabel(primaryKey)}
                  </p>
                  <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                    The area most likely to be limiting progress right now.{" "}
                    {primaryBand
                      ? primaryConstraintSentence(primaryKey as PillarKey, primaryBand)
                      : PILLAR_CONSTRAINT_COPY[primaryKey as PillarKey] || ""}
                  </p>

                  {rreShowRange ? (
                    <div
                      className="mt-5 border-l-2 pl-5"
                      style={{ borderColor: GOLD }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#918a7d]">
                        Revenue in your structure
                      </p>
                      <p
                        className="mt-1 text-lg font-semibold tabular-nums"
                        style={{ color: INK }}
                      >
                        {formatCurrencyAmount(
                          revenueInStructure?.currency,
                          revenueInStructure?.range_low,
                        )}{" "}
                        <span className="font-normal text-[#9a9384]">–</span>{" "}
                        {formatCurrencyAmount(
                          revenueInStructure?.currency,
                          revenueInStructure?.range_high,
                        )}
                      </p>
                      <p className="mt-1 text-[13px] leading-6 text-[#4b5563]">
                        Commercial value that may be easier to convert, retain or release as{" "}
                        {pillarLabel(revenueInStructure?.primary_constraint_pillar)} becomes more
                        deliberate.
                      </p>
                      {revenueInStructure?.disclaimer ? (
                        <p className="mt-2 text-[11px] leading-5 text-[#9a9384]">
                          {revenueInStructure.disclaimer}
                        </p>
                      ) : null}
                    </div>
                  ) : rreShowConfirm ? (
                    <div
                      className="mt-5 border-l-2 pl-5 text-[13px] leading-6 text-[#4b5563]"
                      style={{ borderColor: GOLD }}
                    >
                      A revenue-in-structure range needs a specific annual figure at this scale.
                      Your advisor can add it.
                    </div>
                  ) : null}
                </div>

                {secondaryKey ? (
                  <div>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: GOLD_TEXT }}
                    >
                      Secondary constraint
                    </p>
                    <p
                      className="mt-1 text-xl"
                      style={{ ...serif, color: INK }}
                    >
                      {pillarLabel(secondaryKey)}
                    </p>
                    <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                      The area most likely to reinforce or recreate the primary constraint.
                    </p>
                  </div>
                ) : null}

                {falseConstraint ? (
                  <div
                    className="rounded-sm border p-6"
                    style={{ borderColor: IVORY_BORDER, backgroundColor: "#faf6ec" }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: GOLD_TEXT }}
                    >
                      What may not be the real problem
                    </p>
                    <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                      The result points less to{" "}
                      <strong className="font-semibold" style={{ color: INK }}>
                        {pillarLabel(falseConstraint.stated_pillar)}
                      </strong>{" "}
                      and more to{" "}
                      <strong className="font-semibold" style={{ color: INK }}>
                        {pillarLabel(falseConstraint.evidence_pillar)}
                      </strong>
                      .
                    </p>
                    {falseConstraint.explanation ? (
                      <p className="mt-3 text-[14px] leading-7 text-[#4b5563]">
                        {falseConstraint.explanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[15px] leading-7 text-[#4b5563]">
                Primary area to strengthen:{" "}
                <strong className="font-semibold" style={{ color: INK }}>
                  {lowestPillar?.label || "not yet available"}
                </strong>{" "}
                ({lowestPillar?.percentage ?? 0}%) — the pillar where a more deliberate pattern
                would most improve repeatability.
              </p>
            )}
          </Section>

          {/* 4 — Commercial decision approach */}
          <Section
            id="approach"
            eyebrow="Commercial Decision Approach"
            title="How You Naturally Make Commercial Decisions"
          >
            <p className="text-[15px] leading-7 text-[#4b5563]">
              Your leading approach is{" "}
              <strong className="font-semibold" style={{ color: INK }}>
                {dominantLabel || "still forming"}
              </strong>
              {dominant ? ` (${dominantPct}%)` : ""}.{" "}
              {dominant ? APPROACH_LENS_COPY[dominant] : APPROACH_LENS_COPY.A}
            </p>

            <div className="mt-8 grid gap-10 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-4">
                {APPROACHES.map((approach) => {
                  const pct = approachPercent(approach.code);
                  const isDominant = approach.code === dominant;
                  return (
                    <div key={approach.code}>
                      <div className="mb-1.5 flex items-center justify-between text-[13px]">
                        <span
                          className={isDominant ? "font-semibold" : "text-[#4b5563]"}
                          style={isDominant ? { color: INK } : undefined}
                        >
                          {approach.label}
                        </span>
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: INK }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: "#ece7dd" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isDominant ? GOLD : "#c4bdae",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sm:w-[280px]">
                <ApproachCompass x={compassX} y={compassY} />
                <p className="mt-2 text-center text-[11px] leading-5 text-[#918a7d]">
                  Vertical: Future ↔ Timing. Horizontal: Evidence ↔ Connection.
                </p>
              </div>
            </div>

            <p className="mt-8 text-[12px] leading-6 text-[#918a7d]">
              This is a lens within the diagnostic, not a personality type. Your approach may
              influence how the result shows up — it does not determine it.
            </p>
          </Section>

          {/* 5 — Finish */}
          <Section
            id="priorities"
            eyebrow="Where to Begin"
            title="Your First Three Priorities"
          >
            <ol className="border-t" style={{ borderColor: HAIRLINE }}>
              {firstThree.map((key, index) => (
                <li
                  key={`${key}-${index}`}
                  className="flex gap-5 border-b py-5"
                  style={{ borderColor: HAIRLINE }}
                >
                  <span
                    className="w-8 shrink-0 text-[22px] tabular-nums"
                    style={{ ...serif, color: GOLD }}
                  >
                    {FIX_ORDER_LABELS[index] || `${index + 1}`}
                  </span>
                  <div>
                    <p
                      className="text-[15px] font-medium"
                      style={{ ...serif, color: INK }}
                    >
                      {pillarLabel(key)}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-6 text-[#4b5563]">
                      {pillarDescriptor(key)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {showConstraintSequenceNote ? (
              <p
                className="mt-5 border-l-2 pl-5 text-[13px] leading-6 text-[#4b5563]"
                style={{ borderColor: GOLD }}
              >
                <strong className="font-semibold" style={{ color: INK }}>
                  {pillarLabel(primaryKey)}
                </strong>{" "}
                is your Primary Constraint, but per the Method, work in{" "}
                {layersBeforePrimary} comes first — that is why it appears as your{" "}
                {primaryPositionLabel} priority here rather than your first.
              </p>
            ) : null}
            <p className="mt-5 text-[13px] leading-6 text-[#918a7d]">{PRIORITY_ORDER_NOTE}</p>

            <div
              className="mt-12 border-t pt-10"
              style={{ borderColor: HAIRLINE }}
            >
              <button
                type="button"
                aria-disabled="true"
                onClick={(event) => event.preventDefault()}
                className="cursor-default rounded-sm px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/95"
                style={{ backgroundColor: NAVY_DEEP }}
              >
                Explore Your Full Revenue-To-Freedom Pathway
              </button>
              <p className="mt-3 text-[12px] text-[#918a7d]">
                Your Full Diagnostic Report is being prepared.
              </p>
            </div>
          </Section>
        </div>
      </div>

      <footer className="border-t" style={{ borderColor: HAIRLINE }}>
        <div className="mx-auto max-w-6xl px-6 py-8 text-[11px] leading-6 text-[#9a9384] sm:px-10">
          The Inevitable Standard™{orgName ? ` · ${orgName}` : ""} · This snapshot is
          general business information, not financial, tax, legal or accounting advice.
        </div>
      </footer>
    </main>
  );
}
