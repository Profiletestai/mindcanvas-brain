"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getBaseUrl } from "@/lib/server-url";

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
  approaches?: {
    counts?: Partial<Record<ApproachCode, number>>;
    percentages?: Partial<Record<ApproachCode, number>>;
    labels?: Partial<Record<ApproachCode, string>>;
    dominant?: ApproachCode | null;
    secondary?: ApproachCode | "BALANCED" | null;
  };
  context_answers?: Record<string, string | null>;
  commercial_context?: Record<string, string | null>;
  constraints?: ConstraintResult | null;
  revenue_in_structure?: RevenueInStructure | null;
};

type ResultPayload = {
  test_name?: string | null;
  taker?: {
    first_name?: string | null;
    last_name?: string | null;
  };
  inevitable_standard?: InevitableStandardScore | null;
};

const PILLARS: Array<{
  key: PillarKey;
  label: string;
  description: string;
}> = [
  {
    key: "identity",
    label: "Identity",
    description: "Authority, commercial confidence and willingness to lead.",
  },
  {
    key: "positioning",
    label: "Positioning",
    description: "How clearly the market understands and chooses you.",
  },
  {
    key: "offer",
    label: "Offer",
    description: "The clarity, boundaries and repeatability of what you sell.",
  },
  {
    key: "sales",
    label: "Sales",
    description: "Discovery, conversion and the quality of the buying path.",
  },
  {
    key: "revenue_model",
    label: "Revenue Model",
    description: "Margin, retention, owner reward and transferability.",
  },
  {
    key: "decision",
    label: "Decision",
    description: "Commercial focus, follow-through and decision discipline.",
  },
];

const APPROACHES: Array<{ code: ApproachCode; label: string }> = [
  { code: "A", label: "Future-Led" },
  { code: "B", label: "Connection-Led" },
  { code: "C", label: "Timing-Led" },
  { code: "D", label: "Evidence-Led" },
];

const CONTEXT_LABELS: Record<string, string> = {
  predictable_revenue: "More predictable revenue and better-fit demand.",
  greater_profit_owner_reward:
    "More of the revenue becoming profit and meaningful owner reward.",
  reduced_founder_dependency:
    "The business performing and growing without needing me in the middle of it.",
  personal_wealth_choice_freedom:
    "More personal wealth, choice and freedom outside the business.",
  scale_without_weakening:
    "Growing into a bigger opportunity without weakening quality or stability.",
  marketing_visibility_leads: "Marketing, visibility, content or lead generation.",
  positioning_pricing_offer: "Positioning, pricing, the offer or what the business sells.",
  sales_conversion_follow_up: "Sales conversations, conversion, offers or follow-up.",
  team_systems_delivery: "Team, systems, delivery or making the business run better.",
  profitability_recurring_revenue_retention:
    "Profitability, recurring revenue, retention or what the business keeps.",
  strategy_priorities_direction: "Strategy, priorities, direction or focus.",
  demand_not_predictable: "Demand is not yet predictable enough.",
  revenue_not_profit_or_owner_value:
    "Revenue is being created, but not enough becomes profit or owner value.",
  founder_dependency: "Too much of what makes the business work still depends on the founder.",
  too_many_open_priorities: "Too many priorities or important decisions remain open.",
  market_clarity_or_choice: "The market does not understand or choose the business quickly enough.",
};

const COMMERCIAL_CONTEXT_LABELS: Record<string, Record<string, string>> = {
  revenue_band: {
    under_100k: "Under 100k",
    "100k_250k": "100k–250k",
    "250k_500k": "250k–500k",
    "500k_1m": "500k–1m",
    "1m_2m": "1m–2m",
    "2m_5m": "2m–5m",
    "5m_10m": "5m–10m",
    "10m_plus": "10m+",
  },
  monthly_opportunity_band: {
    "0_2": "0–2 opportunities",
    "3_5": "3–5 opportunities",
    "6_10": "6–10 opportunities",
    "11_20": "11–20 opportunities",
    "21_50": "21–50 opportunities",
    "51_plus": "51+ opportunities",
  },
  initial_customer_value_band: {
    under_1k: "Under 1k",
    "1k_5k": "1k–5k",
    "5k_15k": "5k–15k",
    "15k_50k": "15k–50k",
    "50k_100k": "50k–100k",
    "100k_plus": "100k+",
  },
};

const PILLAR_INSIGHTS: Record<PillarKey, string> = {
  identity:
    "This reflects how consistently the business is willing to claim value, hold its position and lead the commercial moment.",
  positioning:
    "This reflects how clearly the right people can recognise the problem, outcome and distinct position of the business.",
  offer:
    "This reflects whether the offer has clear boundaries, repeatable logic and a path for customers to progress.",
  sales:
    "This reflects how reliably conversations move from understanding the need to a clear, appropriate decision.",
  revenue_model:
    "This reflects how deliberately the business protects margin, creates repeat value and rewards ownership.",
  decision:
    "This reflects how consistently the business chooses priorities, protects momentum and follows through when conditions change.",
};

const PILLAR_CONSTRAINT_COPY: Record<PillarKey, string> = {
  identity:
    "When Identity is the constraint, the business is not consistently claiming its value or holding its position, so strong work elsewhere gets discounted before it can compound.",
  positioning:
    "When Positioning is the constraint, the right buyers cannot quickly recognise the problem, outcome and distinct choice on offer, so demand stays harder to create than it should be.",
  offer:
    "When Offer is the constraint, what is being sold lacks clear boundaries or a repeatable path, so each sale is negotiated from scratch and value leaks.",
  sales:
    "When Sales is the constraint, conversations do not reliably move from understanding the need to a clear decision, so good opportunities stall rather than resolve.",
  revenue_model:
    "When Revenue Model is the constraint, the business is not deliberately protecting margin, building repeat value or rewarding ownership, so revenue grows without enough of it being kept.",
  decision:
    "When Decision is the constraint, priorities and follow-through shift too easily, so momentum is lost and important calls stay open longer than they should.",
};

const FIX_ORDER_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercentage(value: unknown): number {
  return Math.max(0, Math.min(100, numberOr(value)));
}

function humanise(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function formatApproxCount(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    parsed,
  );
}

function contextValue(value: string | null | undefined): string {
  if (!value) return "";
  return CONTEXT_LABELS[value] || humanise(value);
}

function commercialContextValue(key: string, value: string | null | undefined): string {
  if (!value) return "";
  return COMMERCIAL_CONTEXT_LABELS[key]?.[value] || humanise(value);
}

function overallCopy(level: string | undefined): string {
  switch (level) {
    case "deliberate_and_repeatable":
      return "The business is operating from a strong base of deliberate, repeatable commercial choices. The next opportunity is to strengthen leverage without losing what already works.";
    case "partly_structured":
      return "There are meaningful structures and strengths in place, but some important commercial outcomes still depend on consistency, capacity or the founder personally.";
    case "inconsistent":
      return "The business has evidence of capability, but commercial outcomes are not yet being produced consistently enough to feel dependable.";
    default:
      return "Commercial progress is currently relying too heavily on individual moments, personal effort or circumstances lining up. The first priority is to create a more deliberate base.";
  }
}

function approachCopy(code: ApproachCode | null): string {
  switch (code) {
    case "A":
      return "You are most naturally Future-Led: you notice possibility, direction and the larger outcome the business could create. That can generate ambition and movement; it is strongest when paired with clear commercial commitments and review points.";
    case "B":
      return "You are most naturally Connection-Led: you pay close attention to people, relevance and the quality of the relationship. That can create trust and strong customer understanding; it is strongest when the business also makes the next decision explicit.";
    case "C":
      return "You are most naturally Timing-Led: you notice sequence, readiness and what needs to happen before the next step. That can protect quality and reduce unnecessary disruption; it is strongest when timing does not become a reason to leave decisions open.";
    case "D":
      return "You are most naturally Evidence-Led: you look for proof, clarity and a sound basis for action. That can protect quality and commercial judgement; it is strongest when the search for certainty still leaves room for timely decisions.";
    default:
      return "Your approach mix is still being established. The most useful question is which pattern appears most often when a commercial decision is uncertain or important.";
  }
}

function riskClasses(risk: string | undefined): { badge: string; bar: string } {
  if (risk === "low_risk") {
    return { badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" };
  }
  if (risk === "medium_risk") {
    return { badge: "bg-amber-50 text-amber-700", bar: "bg-amber-500" };
  }
  return { badge: "bg-rose-50 text-rose-700", bar: "bg-rose-500" };
}

function ScoreBar({ percentage, colour = "bg-[#2c8fbf]" }: { percentage: number; colour?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${colour}`}
        style={{ width: `${clampPercentage(percentage)}%` }}
      />
    </div>
  );
}

function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2c8fbf]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-[#12223a]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

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
          throw new Error("The Inevitable Standard result is not available for this test taker.");
        }

        if (!cancelled) setPayload(nextPayload);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load report.");
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
  const overall = score?.overall;
  const approaches = score?.approaches;
  const dominant = approaches?.dominant || null;

  const lowestPillar = useMemo(() => {
    if (!score?.pillars) return null;
    return PILLARS.map((pillar) => ({
      ...pillar,
      percentage: clampPercentage(score.pillars?.[pillar.key]?.percentage),
    })).sort((a, b) => a.percentage - b.percentage)[0] || null;
  }, [score]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] px-4 py-12 text-[#12223a]">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Preparing your personalised report…</p>
        </div>
      </main>
    );
  }

  if (error || !score) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] px-4 py-12 text-[#12223a]">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2c8fbf]">
            The Inevitable Standard™
          </p>
          <h1 className="text-2xl font-semibold">Report not available</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error || "The completed assessment result could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const firstName = payload?.taker?.first_name?.trim() || "there";
  const overallPercentage = clampPercentage(overall?.percentage);
  const dominantLabel = dominant
    ? approaches?.labels?.[dominant] || APPROACHES.find((item) => item.code === dominant)?.label
    : null;
  const context = score.context_answers || {};
  const commercial = score.commercial_context || {};
  const secondary = approaches?.secondary;

  const constraints = score.constraints ?? null;
  const revenueInStructure = score.revenue_in_structure ?? null;

  const pillarLabelFor = (key?: string | null): string =>
    PILLARS.find((item) => item.key === key)?.label || humanise(key);
  const pillarPctFor = (key?: string | null): number =>
    key ? clampPercentage(score.pillars?.[key as PillarKey]?.percentage) : 0;

  const primaryConstraintKey =
    (constraints?.primary_constraint as PillarKey | undefined) || null;
  const secondaryConstraintKey =
    (constraints?.secondary_constraint as PillarKey | undefined) || null;
  const falseConstraint = constraints?.false_constraint ?? null;
  const priorityFixOrder = Array.isArray(constraints?.priority_fix_order)
    ? constraints.priority_fix_order.filter(Boolean)
    : [];
  const rreTranslation = revenueInStructure?.translation ?? null;
  const headlinePillarLabel = primaryConstraintKey
    ? pillarLabelFor(primaryConstraintKey)
    : lowestPillar?.label || null;

  const contextCards = [
    { label: "The constraint you named", value: context["13"] },
    { label: "What you want next", value: contextValue(context["26"]) },
    { label: "Where your attention has gone", value: contextValue(context["27"]) },
    { label: "How the business feels today", value: contextValue(context["28"]) },
    { label: "The decision still waiting", value: context["29"] },
  ].filter((item) => item.value);

  const commercialCards = [
    { label: "Revenue over the last 12 months", value: commercialContextValue("revenue_band", commercial.revenue_band) },
    { label: "Meaningful monthly opportunities", value: commercialContextValue("monthly_opportunity_band", commercial.monthly_opportunity_band) },
    { label: "Typical first customer value", value: commercialContextValue("initial_customer_value_band", commercial.initial_customer_value_band) },
  ].filter((item) => item.value);

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#12223a] print:bg-white">
      <header className="bg-[#10283f] text-white print:bg-[#10283f]">
        <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8dd5f3]">
                Profiletest.ai
              </p>
              <p className="mt-1 text-sm text-white/70">The Inevitable Standard™</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 print:hidden"
            >
              Print / save PDF
            </button>
          </div>
        </div>
      </header>

      <section className="bg-[#10283f] pb-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-[#8dd5f3]">Your commercial readiness report</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {firstName}, this is how the business is currently making growth possible.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
              This report shows how deliberately the business is currently creating, converting and keeping commercial value—and where the next increase in consistency is most likely to come from.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8dd5f3]">Result at a glance</p>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-6xl font-semibold tracking-tight">{overallPercentage}%</span>
              <span className="pb-2 text-sm text-white/70">commercial readiness</span>
            </div>
            <p className="mt-3 text-xl font-medium">{overall?.label || "Commercial readiness"}</p>
            <p className="mt-3 text-sm leading-6 text-white/70">{overallCopy(overall?.level)}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-3xl border border-[#d7e6ef] bg-white p-7 shadow-sm">
          <SectionHeading
            eyebrow="Headline diagnosis"
            title={`${firstName}, your commercial readiness is ${overallPercentage}%`}
          />
          {primaryConstraintKey ? (
            <p className="text-[15px] leading-7 text-slate-600">
              That places the business in the{" "}
              <strong className="text-[#12223a]">
                &ldquo;{overall?.label || "current"}&rdquo;
              </strong>{" "}
              band. The single biggest thing holding this back is{" "}
              <strong className="text-[#12223a]">{headlinePillarLabel}</strong> at{" "}
              {pillarPctFor(primaryConstraintKey)}%. Strengthening this is where the
              next gain in consistency comes from.
            </p>
          ) : (
            <p className="text-[15px] leading-7 text-slate-600">
              That places the business in the{" "}
              <strong className="text-[#12223a]">
                &ldquo;{overall?.label || "current"}&rdquo;
              </strong>{" "}
              band. Its weakest area is{" "}
              <strong className="text-[#12223a]">
                {lowestPillar?.label || "not yet available"}
              </strong>{" "}
              at {lowestPillar?.percentage ?? 0}% &mdash; the part of the commercial
              system where a more deliberate pattern would most improve repeatability.
            </p>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl bg-white p-7 shadow-sm">
            <SectionHeading eyebrow="Your operating pattern" title={dominantLabel || "Your commercial approach"}>
              {dominant ? (
                <span className="rounded-full bg-[#e6f5fb] px-3 py-1 text-xs font-semibold text-[#167ca9]">{dominant}</span>
              ) : null}
            </SectionHeading>
            <p className="text-[15px] leading-7 text-slate-600">{approachCopy(dominant)}</p>
            {secondary && secondary !== "BALANCED" ? (
              <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Your secondary pattern is <strong className="text-[#12223a]">{approaches?.labels?.[secondary] || secondary}</strong>. This is the pattern most likely to influence how you balance your natural instinct with the demands of the situation.
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl bg-white p-7 shadow-sm">
            <SectionHeading eyebrow="Approach mix" title="How decisions tend to be made" />
            <div className="space-y-5">
              {APPROACHES.map((approach) => {
                const percentage = clampPercentage(approaches?.percentages?.[approach.code]);
                const isDominant = approach.code === dominant;
                return (
                  <div key={approach.code}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className={isDominant ? "font-semibold text-[#12223a]" : "text-slate-600"}>
                        {approach.label}
                      </span>
                      <span className="font-semibold text-[#12223a]">{percentage}%</span>
                    </div>
                    <ScoreBar percentage={percentage} colour={isDominant ? "bg-[#2c8fbf]" : "bg-slate-300"} />
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-xs leading-5 text-slate-500">
              This is an approach pattern, not a ranking of better or worse ways to lead. Its value is in showing which instinct may need balancing in the next commercial decision.
            </p>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Six-pillar readiness" title="Where commercial strength is currently concentrated">
            <span className="text-xs text-slate-500">Each pillar is scored out of 12</span>
          </SectionHeading>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {PILLARS.map((pillar) => {
              const result = score.pillars?.[pillar.key] || {};
              const percentage = clampPercentage(result.percentage);
              const styles = riskClasses(result.risk);
              return (
                <article key={pillar.key} className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#12223a]">{pillar.label}</h3>
                      <p className="mt-2 text-sm leading-5 text-slate-500">{pillar.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}>
                      {result.risk_label || humanise(result.risk) || "Readiness"}
                    </span>
                  </div>
                  <div className="mt-6 flex items-baseline justify-between">
                    <span className="text-3xl font-semibold text-[#12223a]">{percentage}%</span>
                    <span className="text-xs text-slate-400">{numberOr(result.raw)}/12</span>
                  </div>
                  <div className="mt-3">
                    <ScoreBar percentage={percentage} colour={styles.bar} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{PILLAR_INSIGHTS[pillar.key]}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-7 shadow-sm">
            <SectionHeading
              eyebrow={primaryConstraintKey ? "Primary constraint" : "What your result suggests"}
              title={
                primaryConstraintKey
                  ? "The one thing to strengthen first"
                  : "The next increase in consistency"
              }
            />
            {primaryConstraintKey ? (
              <>
                <p className="text-[15px] leading-7 text-slate-600">
                  Your primary constraint is{" "}
                  <strong className="text-[#12223a]">{pillarLabelFor(primaryConstraintKey)}</strong>{" "}
                  at {pillarPctFor(primaryConstraintKey)}%.{" "}
                  {PILLAR_CONSTRAINT_COPY[primaryConstraintKey as PillarKey] ||
                    PILLAR_INSIGHTS[primaryConstraintKey as PillarKey] ||
                    ""}
                </p>
                {secondaryConstraintKey ? (
                  <p className="mt-4 text-[15px] leading-7 text-slate-600">
                    The reinforcing issue holding it in place is{" "}
                    <strong className="text-[#12223a]">{pillarLabelFor(secondaryConstraintKey)}</strong>{" "}
                    at {pillarPctFor(secondaryConstraintKey)}%. The two tend to keep each
                    other in position, so the primary constraint is where the work starts.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[15px] leading-7 text-slate-600">
                The lowest current pillar is <strong className="text-[#12223a]">{lowestPillar?.label || "not yet available"}</strong> at {lowestPillar?.percentage ?? 0}%. That does not mean the business is weak in this area. It identifies the part of the commercial system where strengthening the underlying pattern may create the clearest improvement in repeatability.
              </p>
            )}
            <div className="mt-6 rounded-2xl border-l-4 border-[#2c8fbf] bg-[#f2f9fc] p-5">
              <p className="text-sm font-semibold text-[#12223a]">A useful question to carry forward</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                What would need to become deliberate, visible and repeatable in {(headlinePillarLabel || "this area").toLowerCase()} for the business to rely less on personal effort or favourable circumstances?
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-[#eaf5fa] p-7">
            <SectionHeading eyebrow="A note on the model" title="Read the result as a pattern" />
            <p className="text-[15px] leading-7 text-slate-600">
              The Inevitable Standard looks at six connected parts of commercial readiness. The score is not a prediction and it is not a judgement of the founder. It is a structured snapshot of the decisions and habits most likely to shape how revenue becomes repeatable value.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              The most useful result is the one that gives you a clearer next decision—not the one that simply gives you a higher number.
            </p>
          </div>
        </section>

        {falseConstraint ? (
          <section className="rounded-3xl border-l-4 border-amber-400 bg-amber-50 p-7">
            <SectionHeading
              eyebrow="False constraint"
              title="What feels like the problem vs. what the evidence shows"
            />
            <p className="text-[15px] leading-7 text-slate-700">
              You may see the issue as{" "}
              <strong className="text-[#12223a]">{pillarLabelFor(falseConstraint.stated_pillar)}</strong>, but the
              pattern in your answers points to{" "}
              <strong className="text-[#12223a]">{pillarLabelFor(falseConstraint.evidence_pillar)}</strong>.
            </p>
            {falseConstraint.explanation ? (
              <p className="mt-4 text-[15px] leading-7 text-slate-600">
                {falseConstraint.explanation}
              </p>
            ) : null}
          </section>
        ) : null}

        {priorityFixOrder.length > 0 ? (
          <section className="rounded-3xl bg-white p-7 shadow-sm">
            <SectionHeading
              eyebrow="Priority fix order"
              title="Work these in sequence, not all at once"
            />
            <ol className="space-y-4">
              {priorityFixOrder.map((key, index) => (
                <li key={`${key}-${index}`} className="flex gap-4">
                  <span className="shrink-0 rounded-full bg-[#e6f5fb] px-2.5 py-1 text-xs font-semibold text-[#167ca9]">
                    {FIX_ORDER_LABELS[index] || `${index + 1}`}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#12223a]">{pillarLabelFor(key)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {PILLAR_INSIGHTS[key as PillarKey] ||
                        PILLARS.find((item) => item.key === key)?.description ||
                        ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Each step needs to hold before the next will stick. Working the list in this
              order keeps the change manageable and makes it clear what is actually moving
              the result.
            </p>
          </section>
        ) : null}

        {revenueInStructure ? (
          <section className="rounded-3xl bg-white p-7 shadow-sm">
            <SectionHeading
              eyebrow="Revenue in your structure"
              title="The commercial value sitting in the current setup"
            />
            {revenueInStructure.needs_revenue_confirmation ? (
              <p className="text-[15px] leading-7 text-slate-600">
                Your revenue is in the highest band, so this estimate needs a specific
                annual figure to be meaningful. Share an approximate number with your
                advisor and the range can be modelled properly.
              </p>
            ) : (
              <>
                <p className="text-3xl font-semibold tracking-tight text-[#12223a]">
                  {formatCurrencyAmount(revenueInStructure.currency, revenueInStructure.range_low)}{" "}
                  <span className="text-slate-400">to</span>{" "}
                  {formatCurrencyAmount(revenueInStructure.currency, revenueInStructure.range_high)}
                </p>
                <p className="mt-4 text-[15px] leading-7 text-slate-600">
                  This is commercial value that may be easier to convert, retain or release
                  once{" "}
                  <strong className="text-[#12223a]">
                    {pillarLabelFor(revenueInStructure.primary_constraint_pillar)}
                  </strong>{" "}
                  becomes more deliberate and repeatable. It is a modelled range, not a
                  measured figure.
                </p>
                {rreTranslation &&
                (rreTranslation.customer_values_low != null ||
                  rreTranslation.customer_values_high != null) ? (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    That is roughly {formatApproxCount(rreTranslation.customer_values_low)} to{" "}
                    {formatApproxCount(rreTranslation.customer_values_high)} typical customer
                    values, based on the deal size you gave.
                  </p>
                ) : null}
                {revenueInStructure.disclaimer ? (
                  <p className="mt-5 text-xs leading-5 text-slate-400">
                    {revenueInStructure.disclaimer}
                  </p>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {contextCards.length > 0 ? (
          <section>
            <SectionHeading eyebrow="Your business context" title="The situation behind the score" />
            <div className="grid gap-4 md:grid-cols-2">
              {contextCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#12223a]">{card.value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {commercialCards.length > 0 ? (
          <section>
            <SectionHeading eyebrow="Commercial context" title="The scale surrounding the result">
              {commercial.currency ? <span className="text-xs font-semibold text-slate-500">Currency: {commercial.currency}</span> : null}
            </SectionHeading>
            <div className="grid gap-4 md:grid-cols-3">
              {commercialCards.map((card) => (
                <div key={card.label} className="rounded-3xl bg-white p-6 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                  <p className="mt-3 text-xl font-semibold text-[#12223a]">{card.value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl bg-[#10283f] p-8 text-white sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8dd5f3]">Your next step</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Turn the clearest signal into one deliberate move.</h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/75">
            Start with{" "}
            {primaryConstraintKey
              ? `your primary constraint (${pillarLabelFor(primaryConstraintKey)})`
              : "the lowest-readiness pillar"}{" "}
            and the decision you identified as still waiting. The aim is not to improve everything at once. It is to create one visible change that makes the business more repeatable and gives you better evidence for what to strengthen next.
          </p>
          <p className="mt-6 text-sm font-medium text-[#8dd5f3]">{dominantLabel ? `${dominantLabel} is your natural starting instinct.` : "Your result is your starting point."}</p>
        </section>

        <footer className="border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-400">
          The Inevitable Standard™ · Powered by Profiletest.ai · This report is a structured diagnostic snapshot, not financial advice.
        </footer>
      </div>
    </main>
  );
}