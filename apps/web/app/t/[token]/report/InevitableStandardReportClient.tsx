"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getBaseUrl } from "@/lib/server-url";

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
  taker?: {
    first_name?: string | null;
    last_name?: string | null;
    // Not currently returned by result/route.ts — the cover renders it only
    // when present, so surfacing `company` there later needs no change here.
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2a6b76]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-3 font-serif text-[26px] leading-snug text-[#1e2a38] sm:text-[30px]">
      {children}
    </h2>
  );
}

function Section({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#e7e3db] print:break-before-page">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-16">
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionTitle>{title}</SectionTitle>
        {intro ? (
          <p className="mt-4 text-[15px] leading-7 text-[#4b5563]">{intro}</p>
        ) : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function BandMeter({ percentage }: { percentage: number }) {
  return (
    <div className="mt-8">
      <div className="relative h-2 w-full rounded-full bg-[#ece7dd]">
        {[40, 60, 80].map((mark) => (
          <span
            key={mark}
            className="absolute top-0 h-2 w-px bg-[#d6cfc0]"
            style={{ left: `${mark}%` }}
          />
        ))}
        <span
          className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#2a6b76] shadow-sm"
          style={{ left: `${clampPercentage(percentage)}%` }}
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ece7dd]">
      <div
        className="h-full rounded-full"
        style={{ width: `${clampPercentage(percentage)}%`, backgroundColor: colour }}
      />
    </div>
  );
}

/**
 * Restrained decision-approach map. One marker on a two-axis plot — no fill,
 * no icons, no colour beyond a single accent dot. Vertical: Future ↔ Timing.
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
      <circle cx={px} cy={py} r="9" fill="none" stroke="#2a6b76" strokeWidth="1" opacity="0.3" />
      <circle cx={px} cy={py} r="4.5" fill="#2a6b76" />
    </svg>
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

  const score = payload?.inevitable_standard;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf8f4] px-6 py-16 text-[#1e2a38]">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-[#8b8f98]">Preparing your Diagnostic Snapshot…</p>
        </div>
      </main>
    );
  }

  if (error || !score) {
    return (
      <main className="min-h-screen bg-[#faf8f4] px-6 py-16 text-[#1e2a38]">
        <div className="mx-auto max-w-2xl">
          <Eyebrow>The Inevitable Standard Diagnostic™</Eyebrow>
          <h1 className="mt-3 font-serif text-3xl">Report not available</h1>
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

  const clientName =
    [payload?.taker?.first_name, payload?.taker?.last_name]
      .map((part) => (part || "").trim())
      .filter(Boolean)
      .join(" ") || "—";
  const businessName =
    (payload?.taker?.company || payload?.business_name || "").trim() || null;
  const assessmentDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
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
    <main className="min-h-screen bg-[#faf8f4] text-[#1e2a38] print:bg-white">
      <button
        type="button"
        onClick={() => window.print()}
        className="fixed right-4 top-4 z-10 rounded-full border border-[#d9d3c6] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b5563] shadow-sm backdrop-blur transition hover:bg-white print:hidden"
      >
        Print / Save PDF
      </button>

      {/* 1 — Cover */}
      <section className="flex min-h-[88vh] flex-col justify-between px-6 py-16 sm:px-12 print:min-h-0 print:break-after-page">
        <Eyebrow>The Inevitable Standard Diagnostic™</Eyebrow>

        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-serif text-[40px] leading-[1.1] text-[#1e2a38] sm:text-[64px]">
            Map Your Revenue-To-Freedom Pathway
          </h1>
          <p className="mt-5 font-serif text-xl text-[#6b7280] sm:text-2xl">
            Your Diagnostic Snapshot
          </p>

          <div className="mt-10 h-px w-16 bg-[#c9c2b4]" />

          <dl className="mt-8 space-y-2 text-[15px]">
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-[#9a9384]">Prepared for</dt>
              <dd className="font-medium text-[#1e2a38]">{clientName}</dd>
            </div>
            {businessName ? (
              <div className="flex gap-3">
                <dt className="w-32 shrink-0 text-[#9a9384]">Business</dt>
                <dd className="text-[#4b5563]">{businessName}</dd>
              </div>
            ) : null}
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-[#9a9384]">Assessment date</dt>
              <dd className="text-[#4b5563]">{assessmentDate}</dd>
            </div>
          </dl>
        </div>

        <p className="mx-auto w-full max-w-3xl text-[12px] leading-5 text-[#9a9384]">
          Created from The Inevitable Standard Method™ by Genene Wilson, The Wealth
          Architect.
        </p>
      </section>

      {/* 2 — Opening result area */}
      <section className="border-t border-[#e7e3db] bg-white print:break-before-page">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-20">
          <Eyebrow>Your Inevitable Standard Readiness</Eyebrow>
          <div className="mt-6 flex items-end gap-4">
            <span className="font-serif text-[72px] leading-none text-[#1e2a38] sm:text-[96px]">
              {overallPercentage}%
            </span>
            <span className="pb-3 font-serif text-2xl text-[#6b7280]">{bandDescriptor}</span>
          </div>
          <BandMeter percentage={overallPercentage} />
          <p className="mt-8 max-w-2xl text-[15px] leading-7 text-[#4b5563]">{OPENING_COPY}</p>
        </div>
      </section>

      {/* 3 — Six-pillar display */}
      <Section
        eyebrow="The Six Pillars"
        title="Where the business is built — and where it is exposed"
      >
        <div className="border-t border-[#e7e3db]">
          {pillarView.map((pillar) => {
            const gar = GAR[pillar.gar];
            return (
              <div
                key={pillar.key}
                className="grid grid-cols-1 gap-3 border-b border-[#e7e3db] py-5 sm:grid-cols-[190px_1fr_auto] sm:items-center sm:gap-6"
              >
                <div>
                  <p className="text-[15px] font-medium text-[#1e2a38]">{pillar.label}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-[#918a7d]">
                    {pillar.descriptor}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PillarBar percentage={pillar.percentage} colour={gar.bar} />
                  <span className="w-11 shrink-0 text-right text-[15px] font-semibold tabular-nums text-[#1e2a38]">
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

      {/* 4 — Key diagnosis */}
      <Section
        eyebrow="Key Diagnosis"
        title="What is most likely shaping the result"
      >
        {primaryKey ? (
          <div className="space-y-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2a6b76]">
                Primary constraint
              </p>
              <p className="mt-1 font-serif text-xl text-[#1e2a38]">
                {pillarLabel(primaryKey)}
              </p>
              <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                The area most likely to be limiting progress right now.{" "}
                {PILLAR_CONSTRAINT_COPY[primaryKey as PillarKey] || ""}
              </p>

              {rreShowRange ? (
                <div className="mt-5 border-l-2 border-[#d8d2c6] pl-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#918a7d]">
                    Revenue in your structure
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-[#1e2a38]">
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
                <div className="mt-5 border-l-2 border-[#d8d2c6] pl-5 text-[13px] leading-6 text-[#4b5563]">
                  A revenue-in-structure range needs a specific annual figure at this scale.
                  Your advisor can add it.
                </div>
              ) : null}
            </div>

            {secondaryKey ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2a6b76]">
                  Secondary constraint
                </p>
                <p className="mt-1 font-serif text-xl text-[#1e2a38]">
                  {pillarLabel(secondaryKey)}
                </p>
                <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                  The area most likely to reinforce or recreate the primary constraint.
                </p>
              </div>
            ) : null}

            {falseConstraint ? (
              <div className="rounded-sm border border-[#e2d9c3] bg-[#faf6ec] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6d33]">
                  What may not be the real problem
                </p>
                <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                  The result points less to{" "}
                  <strong className="font-semibold text-[#1e2a38]">
                    {pillarLabel(falseConstraint.stated_pillar)}
                  </strong>{" "}
                  and more to{" "}
                  <strong className="font-semibold text-[#1e2a38]">
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
            <strong className="font-semibold text-[#1e2a38]">
              {lowestPillar?.label || "not yet available"}
            </strong>{" "}
            ({lowestPillar?.percentage ?? 0}%) — the pillar where a more deliberate pattern
            would most improve repeatability.
          </p>
        )}
      </Section>

      {/* 5 — Commercial decision approach */}
      <Section
        eyebrow="Commercial Decision Approach"
        title="How You Naturally Make Commercial Decisions"
      >
        <p className="text-[15px] leading-7 text-[#4b5563]">
          Your leading approach is{" "}
          <strong className="font-semibold text-[#1e2a38]">
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
                      className={
                        isDominant
                          ? "font-semibold text-[#1e2a38]"
                          : "text-[#4b5563]"
                      }
                    >
                      {approach.label}
                    </span>
                    <span className="font-semibold tabular-nums text-[#1e2a38]">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ece7dd]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isDominant ? "#2a6b76" : "#c4bdae",
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

      {/* 6 — Finish */}
      <Section eyebrow="Where to Begin" title="Your First Three Priorities">
        <ol className="border-t border-[#e7e3db]">
          {firstThree.map((key, index) => (
            <li
              key={`${key}-${index}`}
              className="flex gap-5 border-b border-[#e7e3db] py-5"
            >
              <span className="w-8 shrink-0 font-serif text-[22px] tabular-nums text-[#b8b0a0]">
                {FIX_ORDER_LABELS[index] || `${index + 1}`}
              </span>
              <div>
                <p className="text-[15px] font-medium text-[#1e2a38]">{pillarLabel(key)}</p>
                <p className="mt-0.5 text-[13px] leading-6 text-[#4b5563]">
                  {pillarDescriptor(key)}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {showConstraintSequenceNote ? (
          <p className="mt-5 border-l-2 border-[#d8d2c6] pl-5 text-[13px] leading-6 text-[#4b5563]">
            <strong className="font-semibold text-[#1e2a38]">
              {pillarLabel(primaryKey)}
            </strong>{" "}
            is your Primary Constraint, but per the Method, work in{" "}
            {layersBeforePrimary} comes first — that is why it appears as your{" "}
            {primaryPositionLabel} priority here rather than your first.
          </p>
        ) : null}
        <p className="mt-5 text-[13px] leading-6 text-[#918a7d]">{PRIORITY_ORDER_NOTE}</p>

        <div className="mt-12 border-t border-[#e7e3db] pt-10">
          <button
            type="button"
            aria-disabled="true"
            onClick={(event) => event.preventDefault()}
            className="cursor-default rounded-sm bg-[#1e2a38] px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/95"
          >
            Explore Your Full Revenue-To-Freedom Pathway
          </button>
          <p className="mt-3 text-[12px] text-[#918a7d]">
            Your Full Diagnostic Report is being prepared.
          </p>
        </div>
      </Section>

      <footer className="border-t border-[#e7e3db]">
        <div className="mx-auto max-w-3xl px-6 py-8 text-[11px] leading-6 text-[#9a9384] sm:px-10">
          The Inevitable Standard™{orgName ? ` · ${orgName}` : ""} · This snapshot is
          general business information, not financial, tax, legal or accounting advice.
        </div>
      </footer>
    </main>
  );
}
