"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getBaseUrl } from "@/lib/server-url";
import {
  APPROACH_LENS_COPY,
  APPROACHES,
  ApproachCompass,
  BandMeter,
  BAND_MEANING,
  Eyebrow,
  FIX_ORDER_LABELS,
  GarLegend,
  GOLD,
  GOLD_TEXT,
  HAIRLINE,
  INK,
  IVORY,
  IVORY_BORDER,
  IVORY_PANEL,
  METHOD_LAYER_LABEL,
  NAVY_DEEP,
  NAVY_GRADIENT,
  OPENING_COPY,
  PILLAR_CONSTRAINT_COPY,
  PillarSummaryList,
  PRIORITY_ORDER_NOTE,
  ReadinessDonut,
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
  round1,
  serif,
  type ApproachCode,
  type Gar,
  type PillarKey,
  type ResultPayload,
} from "./inevitableStandardShared";

/* Report Index — drives the persistent sidebar nav and the print-only index. */
const SECTIONS: Array<{ id: string; label: string }> = [
  { id: "readiness", label: "Readiness Overview" },
  { id: "pillars", label: "The Six Pillars" },
  { id: "diagnosis", label: "Key Diagnosis" },
  { id: "approach", label: "Decision Approach" },
  { id: "priorities", label: "Your First Three Priorities" },
];

/* -------------------------------------------------------------------------- */
/* Report-1 presentational pieces                                              */
/* -------------------------------------------------------------------------- */

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

        <div className="mt-4 border-t pt-4" style={{ borderColor: IVORY_BORDER }}>
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
  const assessmentDate = formatAssessmentDate(payload?.completed_at);
  const orgName = (payload?.org_name || "").trim();

  const pillarView = buildPillarView(score);
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
              <p className="mt-4 text-xl text-white/70 sm:text-2xl" style={serif}>
                Your Diagnostic Snapshot
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
            <PillarSummaryList pillars={pillarView} />
            <GarLegend />
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
                  <p className="mt-1 text-xl" style={{ ...serif, color: INK }}>
                    {pillarLabel(primaryKey)}
                  </p>
                  <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                    The area most likely to be limiting progress right now.{" "}
                    {primaryBand
                      ? primaryConstraintSentence(primaryKey as PillarKey, primaryBand)
                      : PILLAR_CONSTRAINT_COPY[primaryKey as PillarKey] || ""}
                  </p>

                  {revenueInStructure ? (
                    <div className="mt-5">
                      <RevenueInStructurePanel
                        rre={revenueInStructure}
                        variant="compact"
                      />
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
                    <p className="mt-1 text-xl" style={{ ...serif, color: INK }}>
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
              className="mt-12 border-t pt-10 print:hidden"
              style={{ borderColor: HAIRLINE }}
            >
              <a
                href={`/t/${encodeURIComponent(token)}/full-report?tid=${encodeURIComponent(tid)}`}
                className="inline-block rounded-sm px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/95 transition hover:brightness-110"
                style={{ backgroundColor: NAVY_DEEP }}
              >
                Explore Your Full Revenue-To-Freedom Pathway
              </a>
              <p className="mt-3 text-[12px] text-[#918a7d]">
                Your Full Diagnostic Report opens the six pillars, the Revenue-To-Freedom
                model and a 30/60/90-day focus in depth.
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
