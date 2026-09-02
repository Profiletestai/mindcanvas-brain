"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getBaseUrl } from "@/lib/server-url";
import {
  getInevitableStandardPillarBandContent,
  type InevitableStandardContentSection,
} from "@/lib/inevitable-standard/content/reportCopy";
import {
  buildDiagnosticAdds,
  buildNinetyDayPlan,
  type NinetyDayPhase,
} from "@/lib/inevitable-standard/fullDiagnosticTemplates";
import {
  APPROACH_LENS_COPY,
  APPROACHES,
  ApproachCompass,
  BandMeter,
  BAND_MEANING,
  Eyebrow,
  FIX_ORDER_LABELS,
  GarLegend,
  GAR,
  GOLD,
  GOLD_TEXT,
  HAIRLINE,
  INK,
  IVORY,
  IVORY_BORDER,
  IVORY_PANEL,
  METHOD_LAYER_LABEL,
  METHOD_LAYERS,
  NAVY,
  NAVY_DEEP,
  NAVY_GRADIENT,
  PILLAR_CONSTRAINT_COPY,
  PillarSummaryList,
  PRIORITY_ORDER_NOTE,
  ReadinessDonut,
  REVENUE_CHAIN,
  RevenueInStructurePanel,
  bandLabelFor,
  buildPillarView,
  clampPercentage,
  formatAssessmentDate,
  newsreader,
  numberOr,
  pillarDescriptor,
  pillarLabel,
  primaryConstraintSentence,
  resolvePriorityOrder,
  round1,
  serif,
  type ApproachCode,
  type Gar,
  type PillarKey,
  type PillarView,
  type ResultPayload,
} from "../report/inevitableStandardShared";

/* -------------------------------------------------------------------------- */
/* Pillar chapter template (spec §5 — Report 2)                                */
/* -------------------------------------------------------------------------- */

const CHAPTER_SECTIONS: Array<{
  key: InevitableStandardContentSection;
  heading: string;
}> = [
  { key: "what_this_means", heading: "What This Result Means" },
  { key: "what_appears_working", heading: "What Appears to Be Working" },
  { key: "where_leaking", heading: "Where Value May Currently Be Leaking" },
  { key: "pathway_impact", heading: "How This Affects Your Revenue-To-Freedom Pathway" },
  { key: "focus_now", heading: "What to Focus On Now" },
  { key: "what_to_watch", heading: "What to Watch" },
  { key: "progress_looks_like", heading: "What Progress Should Look Like" },
];

function chapterFallbackSentence(pillar: PillarView): string {
  if (pillar.gar === "green") {
    return `${pillar.label} is a relative strength in this result. ${pillar.descriptor} The work here is to hold it as a standard rather than to rebuild it.`;
  }
  return (
    primaryConstraintSentence(pillar.key, pillar.gar) ||
    PILLAR_CONSTRAINT_COPY[pillar.key]
  );
}

/* -------------------------------------------------------------------------- */
/* Small presentational pieces                                                 */
/* -------------------------------------------------------------------------- */

function Chapter({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-t py-12 first:border-t-0 first:pt-0 sm:py-16 print:break-before-page"
      style={{ borderColor: HAIRLINE }}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="mt-3 text-[26px] leading-snug sm:text-[32px]"
        style={{ ...serif, color: INK }}
      >
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function GarChip({ gar }: { gar: Gar }) {
  const g = GAR[gar];
  return (
    <span
      className="rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ backgroundColor: g.chipBg, color: g.chipText }}
    >
      {g.name} — {g.tone}
    </span>
  );
}

function ConstraintBlock({
  label,
  pillarName,
  body,
}: {
  label: string;
  pillarName: string;
  body: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: GOLD_TEXT }}
      >
        {label}
      </p>
      <p className="mt-1 text-xl" style={{ ...serif, color: INK }}>
        {pillarName}
      </p>
      <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">{body}</p>
    </div>
  );
}

/** Revenue → Profit → Personal Wealth → Freedom — the primary framework visual. */
function RevenueChainDiagram() {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: IVORY_BORDER, backgroundColor: IVORY_PANEL }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: GOLD }} />
      <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
        {REVENUE_CHAIN.map((node, index) => (
          <div key={node.label} className="contents">
            <div className="rounded-xl border bg-white/70 p-4" style={{ borderColor: IVORY_BORDER }}>
              <p className="text-[15px]" style={{ ...serif, color: INK }}>
                {node.label}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">{node.blurb}</p>
            </div>
            {index < REVENUE_CHAIN.length - 1 ? (
              <div
                className="flex items-center justify-center text-lg"
                style={{ color: GOLD_TEXT }}
                aria-hidden="true"
              >
                <span className="hidden md:inline">→</span>
                <span className="md:hidden">↓</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Identity → Structure → Execution — the second framework visual, live scores. */
function MethodLayersDiagram({ pillarView }: { pillarView: PillarView[] }) {
  const byKey = new Map(pillarView.map((pillar) => [pillar.key, pillar]));
  return (
    <div className="space-y-3">
      {METHOD_LAYERS.map((layer, index) => (
        <div
          key={layer.layer}
          className="rounded-2xl border p-5"
          style={{ borderColor: IVORY_BORDER, backgroundColor: "#ffffff" }}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="text-[12px] tabular-nums"
              style={{ color: GOLD_TEXT }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="text-[17px]" style={{ ...serif, color: INK }}>
              {layer.layer}
            </p>
            <p className="text-[12px] leading-5 text-[#6b7280]">{layer.blurb}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {layer.pillars.map((key) => {
              const pillar = byKey.get(key);
              if (!pillar) return null;
              const g = GAR[pillar.gar];
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]"
                  style={{ borderColor: IVORY_BORDER, color: "#4b5563" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: g.bar }}
                  />
                  {pillar.label}
                  <span className="tabular-nums" style={{ color: INK }}>
                    {pillar.percentage}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[12px] leading-6 text-[#918a7d]">
        These layers explain what helps a change hold; they do not replace the diagnosis.
        The Primary Constraint tells you where to begin, the Secondary Constraint shows
        what may recreate it, and the layers show what needs to support the change around them.
      </p>
    </div>
  );
}

function PhaseBlock({ phase }: { phase: NinetyDayPhase }) {
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 print:break-inside-avoid"
      style={{ borderColor: IVORY_BORDER, backgroundColor: "#ffffff" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          className="text-[13px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: GOLD_TEXT }}
        >
          {phase.window}
        </p>
        <p className="text-[19px]" style={{ ...serif, color: INK }}>
          {pillarLabel(phase.pillar)}
        </p>
        <p className="text-[12px] text-[#6b7280]">
          {phase.layer} layer · {phase.role}
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {phase.actions.map((action, index) => (
          <li key={index} className="flex gap-3 text-[14px] leading-7 text-[#4b5563]">
            <span style={{ color: GOLD }}>—</span>
            <span>{action}</span>
          </li>
        ))}
      </ul>
      <p
        className="mt-4 border-l-2 pl-4 text-[13px] leading-6 text-[#4b5563]"
        style={{ borderColor: GOLD }}
      >
        <span className="font-semibold" style={{ color: INK }}>
          What changes:
        </span>{" "}
        {phase.outcome}
      </p>
    </div>
  );
}

function SidebarIndex({
  sections,
  activeSection,
  readiness,
  band,
}: {
  sections: Array<{ id: string; label: string }>;
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
        <div className="mt-4 border-t pt-4" style={{ borderColor: IVORY_BORDER }}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9a9384]">
            Readiness
          </p>
          <p className="mt-1 text-[28px] leading-none" style={{ ...serif, color: INK }}>
            {round1(readiness)}%
          </p>
          <p className="mt-1 text-[12px] text-[#6b7280]">{band}</p>
        </div>
        <nav className="mt-5 space-y-1">
          {sections.map((section, index) => {
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

export default function InevitableStandardFullDiagnosticClient({
  token,
  tid,
}: {
  token: string;
  tid: string;
}) {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("summary");

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

  const score = payload?.inevitable_standard ?? null;

  const view = useMemo(() => {
    if (!score) return null;

    const overall = score.overall || {};
    const approaches = score.approaches || {};
    const constraints = score.constraints ?? null;
    const revenueInStructure = score.revenue_in_structure ?? null;
    const contextAnswers = score.context_answers ?? null;

    const overallPercentage = round1(clampPercentage(overall.percentage));
    const bandDescriptor = overall.label || bandLabelFor(overallPercentage);
    const bandMeaning =
      BAND_MEANING[bandLabelFor(overallPercentage)] ||
      BAND_MEANING[bandDescriptor] ||
      "";

    const pillarView = buildPillarView(score);
    const pillarByKey = new Map(pillarView.map((pillar) => [pillar.key, pillar]));
    const pillarsByPct = [...pillarView].sort((a, b) => a.percentage - b.percentage);
    const lowestPillar = pillarsByPct[0] || null;

    const primaryKey =
      (constraints?.primary_constraint as PillarKey | undefined) || null;
    const secondaryKey =
      (constraints?.secondary_constraint as PillarKey | undefined) || null;
    const falseConstraint = constraints?.false_constraint ?? null;

    const priorityOrder = resolvePriorityOrder(constraints, pillarView);


    const dominant = approaches.dominant || null;
    const dominantLabel = dominant
      ? approaches.labels?.[dominant] ||
        APPROACHES.find((item) => item.code === dominant)?.label ||
        dominant
      : null;
    const dominantPct = dominant
      ? round1(clampPercentage(approaches.percentages?.[dominant]))
      : 0;
    const secondaryApproach = approaches.secondary ?? null;
    const secondaryApproachLabel =
      secondaryApproach && secondaryApproach !== "BALANCED"
        ? APPROACHES.find((item) => item.code === secondaryApproach)?.label ||
          secondaryApproach
        : secondaryApproach === "BALANCED"
          ? "a balanced mix of the other three"
          : null;

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

    const plan = buildNinetyDayPlan({
      priorityOrder: constraints ? priorityOrder : [],
      primaryConstraint: primaryKey,
      secondaryConstraint: secondaryKey,
      pillarPercentages: Object.fromEntries(
        pillarView.map((pillar) => [pillar.key, pillar.percentage]),
      ) as Partial<Record<PillarKey, number>>,
    });

    const diagnosticAdds = buildDiagnosticAdds({
      q13: contextAnswers?.[13] ?? null,
      q29: contextAnswers?.[29] ?? null,
      primaryLabel: primaryKey ? pillarLabel(primaryKey) : null,
      secondaryLabel: secondaryKey ? pillarLabel(secondaryKey) : null,
      falseConstraint: falseConstraint
        ? {
            stated_label: pillarLabel(falseConstraint.stated_pillar),
            evidence_label: pillarLabel(falseConstraint.evidence_pillar),
            mismatch: falseConstraint.mismatch,
            explanation: falseConstraint.explanation,
          }
        : null,
    });

    const clientName =
      [payload?.taker?.first_name, payload?.taker?.last_name]
        .map((part) => (part || "").trim())
        .filter(Boolean)
        .join(" ") || "—";
    const businessName =
      (payload?.taker?.company || payload?.business_name || "").trim() || null;
    const assessmentDate = formatAssessmentDate(payload?.completed_at);
    const orgName = (payload?.org_name || "").trim();

    return {
      overallPercentage,
      bandDescriptor,
      bandMeaning,
      pillarView,
      pillarByKey,
      lowestPillar,
      primaryKey,
      secondaryKey,
      falseConstraint,
      priorityOrder,
      dominant,
      dominantLabel,
      dominantPct,
      secondaryApproachLabel,
      approachPercent,
      compassX,
      compassY,
      plan,
      diagnosticAdds,
      revenueInStructure,
      clientName,
      businessName,
      assessmentDate,
      orgName,
    };
  }, [score, payload]);

  const sections = useMemo(() => {
    if (!view) return [];
    const list: Array<{ id: string; label: string }> = [
      { id: "summary", label: "Results at a Glance" },
      { id: "model", label: "The Revenue-To-Freedom Model" },
      { id: "pillars", label: "The Six Pillars" },
    ];
    if (view.diagnosticAdds) list.push({ id: "your-words", label: "In Your Words" });
    list.push({ id: "approach", label: "Commercial Decision Intelligence" });
    if (view.revenueInStructure)
      list.push({ id: "revenue", label: "Revenue in Your Structure" });
    list.push({ id: "plan", label: "Your 30/60/90-Day Focus" });
    list.push({ id: "closing", label: "In Closing" });
    return list;
  }, [view]);

  useEffect(() => {
    if (!view || typeof IntersectionObserver === "undefined") return;

    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));
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
  }, [view, sections]);

  if (loading) {
    return (
      <main
        className={`${newsreader.variable} min-h-screen px-6 py-16`}
        style={{ backgroundColor: IVORY, color: INK }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-[#8b8f98]">Preparing your Full Diagnostic Report…</p>
        </div>
      </main>
    );
  }

  if (error || !score || !view) {
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

  const {
    overallPercentage,
    bandDescriptor,
    bandMeaning,
    pillarView,
    lowestPillar,
    primaryKey,
    secondaryKey,
    falseConstraint,
    priorityOrder,
    dominant,
    dominantLabel,
    dominantPct,
    secondaryApproachLabel,
    approachPercent,
    compassX,
    compassY,
    plan,
    diagnosticAdds,
    revenueInStructure,
    clientName,
    businessName,
    assessmentDate,
    orgName,
  } = view;

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

      {/* Cover */}
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
                Your Revenue-To-Freedom Pathway
              </h1>
              <p className="mt-4 text-xl text-white/70 sm:text-2xl" style={serif}>
                The Full Diagnostic Report
              </p>

              <div className="mt-8 h-px w-16" style={{ backgroundColor: GOLD }} />

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

              <p className="mt-8 text-[13px] text-white/55">
                Genene Wilson, The Wealth Architect
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 justify-self-center lg:justify-self-end">
              <ReadinessDonut percentage={overallPercentage} band={bandDescriptor} />
              <p className="max-w-[220px] text-center text-[11px] uppercase tracking-[0.16em] text-white/45">
                Inevitable Standard Readiness
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Print-only index */}
      <div className="mx-auto hidden max-w-6xl px-6 pt-8 sm:px-10 print:block">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: GOLD_TEXT }}
        >
          Report Index
        </p>
        <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[#4b5563]">
          {sections.map((section, index) => (
            <li key={section.id}>
              <span className="tabular-nums" style={{ color: GOLD_TEXT }}>
                {String(index + 1).padStart(2, "0")}
              </span>{" "}
              {section.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="mx-auto max-w-6xl gap-x-12 px-6 py-12 sm:px-10 lg:grid lg:grid-cols-[260px_1fr] lg:py-16 print:block">
        <SidebarIndex
          sections={sections}
          activeSection={activeSection}
          readiness={overallPercentage}
          band={bandDescriptor}
        />

        <div className="min-w-0">
          {/* Results at a glance */}
          <Chapter
            id="summary"
            eyebrow="Results at a Glance"
            title="Where the business stands, before we go deeper"
          >
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <span
                className="text-[56px] leading-none"
                style={{ ...serif, color: INK }}
              >
                {overallPercentage}%
              </span>
              <span className="pb-2 text-xl" style={{ ...serif, color: "#6b7280" }}>
                {bandDescriptor}
              </span>
            </div>
            <BandMeter percentage={overallPercentage} />
            {bandMeaning ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
                {bandMeaning}
              </p>
            ) : null}

            <h3
              className="mt-12 text-[13px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: GOLD_TEXT }}
            >
              The Six Pillars
            </h3>
            <div className="mt-4">
              <PillarSummaryList pillars={pillarView} />
              <GarLegend />
            </div>

            <div className="mt-12 space-y-8">
              {primaryKey ? (
                <ConstraintBlock
                  label="Primary constraint"
                  pillarName={pillarLabel(primaryKey)}
                  body={`The area most likely to be limiting progress right now. ${primaryConstraintSentence(
                    primaryKey,
                    view.pillarByKey.get(primaryKey)?.gar ?? "amber",
                  )}`}
                />
              ) : (
                <p className="text-[15px] leading-7 text-[#4b5563]">
                  Primary area to strengthen:{" "}
                  <strong className="font-semibold" style={{ color: INK }}>
                    {lowestPillar?.label || "not yet available"}
                  </strong>{" "}
                  ({lowestPillar?.percentage ?? 0}%).
                </p>
              )}

              {secondaryKey ? (
                <ConstraintBlock
                  label="Secondary constraint"
                  pillarName={pillarLabel(secondaryKey)}
                  body="The area most likely to reinforce or recreate the primary constraint."
                />
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

              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: GOLD_TEXT }}
                >
                  Commercial decision approach
                </p>
                <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                  Your leading approach is{" "}
                  <strong className="font-semibold" style={{ color: INK }}>
                    {dominantLabel || "still forming"}
                  </strong>
                  {dominant ? ` (${dominantPct}%)` : ""}
                  {secondaryApproachLabel
                    ? `, with a secondary influence of ${secondaryApproachLabel}`
                    : ""}
                  . The full picture is in the Commercial Decision Intelligence chapter.
                </p>
              </div>

              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: GOLD_TEXT }}
                >
                  Priority Fix Order
                </p>
                <ol className="mt-3 border-t" style={{ borderColor: HAIRLINE }}>
                  {priorityOrder.map((key, index) => (
                    <li
                      key={key}
                      className="flex gap-4 border-b py-3"
                      style={{ borderColor: HAIRLINE }}
                    >
                      <span
                        className="w-8 shrink-0 text-[16px] tabular-nums"
                        style={{ ...serif, color: GOLD }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-[14px] font-medium" style={{ color: INK }}>
                          {pillarLabel(key)}
                          <span className="ml-2 text-[12px] font-normal text-[#918a7d]">
                            {METHOD_LAYER_LABEL[key]} layer
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] leading-5 text-[#6b7280]">
                          {pillarDescriptor(key)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-[12px] leading-6 text-[#918a7d]">
                  {PRIORITY_ORDER_NOTE}
                </p>
              </div>
            </div>
          </Chapter>

          {/* Framework model */}
          <Chapter
            id="model"
            eyebrow="The Model"
            title="How revenue is meant to become freedom"
          >
            <p className="max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Every number in this report is in service of one chain. Revenue is only the
              first link; the point of the business is what the chain produces at the end.
            </p>
            <div className="mt-8">
              <RevenueChainDiagram />
            </div>

            <h3
              className="mt-12 text-[13px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: GOLD_TEXT }}
            >
              Identity → Structure → Execution
            </h3>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              The six pillars sit in three layers. Each layer depends on the one before it,
              which is why a problem that appears in execution can have quieter dependencies
              elsewhere. The layers explain what helps the intervention hold; they do not
              override the Primary Constraint as the place to begin.
            </p>
            <div className="mt-6">
              <MethodLayersDiagram pillarView={pillarView} />
            </div>
          </Chapter>

          {/* Pillar chapters */}
          <Chapter
            id="pillars"
            eyebrow="The Six Pillars"
            title="Each area in depth"
          >
            <div className="space-y-14">
              {pillarView.map((pillar) => {
                const content = getInevitableStandardPillarBandContent(
                  pillar.key,
                  pillar.gar,
                );
                const snapshot = content.snapshot_line?.text;
                const rows = CHAPTER_SECTIONS.map((section) => ({
                  heading: section.heading,
                  text: content[section.key]?.text,
                })).filter(
                  (row): row is { heading: string; text: string } => Boolean(row.text),
                );
                if (rows.length === 0) {
                  rows.push({
                    heading: "What This Result Means",
                    text: chapterFallbackSentence(pillar),
                  });
                }

                return (
                  <article
                    key={pillar.key}
                    id={`pillar-${pillar.key}`}
                    className="scroll-mt-8 border-t pt-10 first:border-t-0 first:pt-0 print:break-inside-avoid"
                    style={{ borderColor: HAIRLINE }}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                      <h3 className="text-[24px]" style={{ ...serif, color: INK }}>
                        {pillar.label}
                      </h3>
                      <span
                        className="text-[20px] tabular-nums"
                        style={{ ...serif, color: GOLD_TEXT }}
                      >
                        {pillar.percentage}%
                      </span>
                      <GarChip gar={pillar.gar} />
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-[#918a7d]">
                      {pillar.descriptor}
                    </p>
                    {snapshot ? (
                      <p
                        className="mt-4 text-[16px] italic leading-7 text-[#57606f]"
                        style={serif}
                      >
                        {snapshot}
                      </p>
                    ) : null}

                    <div className="mt-6 space-y-6">
                      {rows.map((row) => (
                        <div key={row.heading}>
                          <p
                            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                            style={{ color: GOLD_TEXT }}
                          >
                            {row.heading}
                          </p>
                          <p className="mt-1.5 text-[15px] leading-7 text-[#4b5563]">
                            {row.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </Chapter>

          {/* In your words */}
          {diagnosticAdds ? (
            <Chapter
              id="your-words"
              eyebrow="In Your Words"
              title="What you told us, and what the diagnostic adds"
            >
              {diagnosticAdds.toldUs.length > 0 ? (
                <div className="space-y-5">
                  {diagnosticAdds.toldUs.map((item) => (
                    <div
                      key={item.prompt}
                      className="border-l-2 pl-5"
                      style={{ borderColor: IVORY_BORDER }}
                    >
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#918a7d]">
                        {item.prompt}
                      </p>
                      <p
                        className="mt-1 text-[17px] leading-7 text-[#3f4652]"
                        style={serif}
                      >
                        &ldquo;{item.quote}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {diagnosticAdds.adds ? (
                <div className="mt-8">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: GOLD_TEXT }}
                  >
                    What your diagnostic adds
                  </p>
                  <p className="mt-1.5 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
                    {diagnosticAdds.adds}
                  </p>
                </div>
              ) : null}

              <p className="mt-6 text-[12px] leading-6 text-[#918a7d]">
                This is an interpretation of your answers read alongside your pillar scores,
                not a fixed conclusion.
              </p>
            </Chapter>
          ) : null}

          {/* Commercial decision intelligence */}
          <Chapter
            id="approach"
            eyebrow="Commercial Decision Intelligence"
            title="How you naturally make commercial decisions"
          >
            <p className="max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Your leading approach is{" "}
              <strong className="font-semibold" style={{ color: INK }}>
                {dominantLabel || "still forming"}
              </strong>
              {dominant ? ` (${dominantPct}%)` : ""}
              {secondaryApproachLabel
                ? `, with a secondary influence of ${secondaryApproachLabel}`
                : ""}
              . {dominant ? APPROACH_LENS_COPY[dominant] : APPROACH_LENS_COPY.A}
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

            {primaryKey ? (
              <p className="mt-8 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
                Where this most often shows up in your result is{" "}
                <strong className="font-semibold" style={{ color: INK }}>
                  {pillarLabel(primaryKey)}
                </strong>
                . Your approach may influence how that constraint appears — it does not
                create it, and working the constraint does not require changing how you
                decide.
              </p>
            ) : null}

            <p className="mt-6 text-[12px] leading-6 text-[#918a7d]">
              This is a lens within the diagnostic, not a personality type. Your approach may
              influence how the result shows up — it does not determine it.
            </p>
          </Chapter>

          {/* Revenue in your structure */}
          {revenueInStructure ? (
            <Chapter
              id="revenue"
              eyebrow="Revenue in Your Structure"
              title="The commercial value sitting inside the current build"
            >
              <p className="max-w-2xl text-[15px] leading-7 text-[#4b5563]">
                This is a modelled estimate of the commercial value most closely associated
                with the primary constraint — value that a more deliberate structure could
                make easier to convert, retain or release. It is a location and a scale, not
                a forecast.
              </p>
              <div className="mt-6">
                <RevenueInStructurePanel rre={revenueInStructure} variant="full" />
              </div>
            </Chapter>
          ) : null}

          {/* 30/60/90 */}
          <Chapter
            id="plan"
            eyebrow="Where to Begin"
            title="Your 30 / 60 / 90-day focus"
          >
            <p className="max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Three windows, one focus each, following the priority order. The actions below
              are a practical starting shape, not a fixed prescription — the intent is
              rhythm, not a checklist completed once.
            </p>
            <div className="mt-8 space-y-4">
              {plan.map((phase) => (
                <PhaseBlock key={phase.window} phase={phase} />
              ))}
            </div>

            <p className="mt-6 text-[12px] leading-6 text-[#918a7d]">
              Focus areas and actions in this section are generated from your constraint
              results, not drawn from the method text.
            </p>
          </Chapter>

          {/* Closing */}
          <Chapter id="closing" eyebrow="In Closing" title="What this is actually for">
            <p className="max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              The purpose of this diagnostic is not to improve six scores. It is to build a
              business that works more deliberately for the person who owns it — one where
              revenue reliably becomes profit, profit becomes personal wealth, and that
              wealth buys back choice and time.
            </p>
            <div className="mt-8">
              <RevenueChainDiagram />
            </div>
            <p className="mt-8 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Everything in this report points at the highest-leverage constraint in the
              current system. Strengthen that first, then the issue most likely to recreate
              it, while using the Method layers to make the change hold.
            </p>
          </Chapter>
        </div>
      </div>

      <footer className="border-t" style={{ borderColor: HAIRLINE }}>
        <div className="mx-auto max-w-6xl px-6 py-8 text-[11px] leading-6 text-[#9a9384] sm:px-10">
          The Inevitable Standard™{orgName ? ` · ${orgName}` : ""} · This report is general
          business information, not financial, tax, legal or accounting advice.
        </div>
      </footer>
    </main>
  );
}
