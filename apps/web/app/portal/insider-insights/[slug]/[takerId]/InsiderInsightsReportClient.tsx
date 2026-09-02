"use client";

/* -------------------------------------------------------------------------- */
/* Insider Insights — the private, adviser-facing companion to the Inevitable  */
/* Standard client reports. Five compact sections, same visual system as       */
/* Reports 1 and 2 (navy hero, ivory two-column body, Report Index sidebar).   */
/* Rendered from a report assembled server-side by buildInsiderInsightsReport. */
/* -------------------------------------------------------------------------- */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  InsiderFounderWord,
  InsiderInsightsReport,
  InsiderSequenceStep,
} from "@/lib/inevitable-standard/buildInsiderInsightsReport";
import {
  Eyebrow,
  GAR,
  GOLD,
  GOLD_TEXT,
  HAIRLINE,
  INK,
  IVORY,
  IVORY_BORDER,
  IVORY_PANEL,
  NAVY_DEEP,
  NAVY_GRADIENT,
  PillarSummaryList,
  ReadinessDonut,
  newsreader,
  round1,
  serif,
  type Gar,
} from "@/app/t/[token]/report/inevitableStandardShared";
import PrintButton from "@/app/t/[token]/report/PrintButton";

const GAR_KEY = { GREEN: "green", AMBER: "amber", RED: "red" } as const;

const INDEX_ITEMS = [
  { id: "snapshot", label: "Insider Snapshot" },
  { id: "predictive-signals", label: "Predictive Signals at a Glance" },
  { id: "founders-words", label: "The Founder's Own Words" },
  { id: "suggested-sequence", label: "Suggested Sequence" },
  { id: "objective", label: "The Objective" },
] as const;

/* -------------------------------------------------------------------------- */

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="text-[12px] font-semibold tabular-nums"
        style={{ color: GOLD_TEXT }}
      >
        {String(index).padStart(2, "0")}
      </span>
      <h2 className="text-[22px] leading-snug" style={{ ...serif, color: INK }}>
        {title}
      </h2>
    </div>
  );
}

function GarChip({ gar, label }: { gar: Gar; label: string }) {
  const tone = GAR[gar];
  return (
    <span
      className="rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ backgroundColor: tone.chipBg, color: tone.chipText }}
    >
      {label}
    </span>
  );
}

function SnapshotFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[#8a8477]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[15px]" style={{ color: INK }}>
        {value}
      </dd>
      {hint ? (
        <dd className="mt-0.5 text-[12px] leading-5 text-[#8a8477]">{hint}</dd>
      ) : null}
    </div>
  );
}

/* --- Section 3 card ------------------------------------------------------- */

const TAG_TONE: Record<InsiderFounderWord["tags"][number]["kind"], { bg: string; text: string }> = {
  "HYPOTHESIS TO VALIDATE": { bg: "#eef1f6", text: "#3c4a63" },
  "LISTEN FOR": { bg: "#f5f0e6", text: "#7a5a28" },
  "DO NOT ASSUME": { bg: "#f2eae8", text: "#7c3f39" },
  "GREEN LEVERAGE": { bg: "#eef2ef", text: "#3f5e50" },
};

function FounderWordCard({ item }: { item: InsiderFounderWord }) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ backgroundColor: "#fff", borderColor: IVORY_BORDER }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#918a7d]">
          {item.prompt}
        </p>
        {item.pillar ? (
          <span className="flex items-center gap-2 text-[12px] text-[#6b7280]">
            {item.pillar.label} · {round1(item.pillar.percentage)}%
            <GarChip gar={GAR_KEY[item.pillar.gar]} label={item.pillar.garLabel} />
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[19px] leading-8" style={{ ...serif, color: "#3f4652" }}>
        &ldquo;{item.quote}&rdquo;
      </p>

      {item.tags.length > 0 ? (
        <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: HAIRLINE }}>
          {item.tags.map((tag) => {
            const tone = TAG_TONE[tag.kind];
            return (
              <div key={tag.kind} className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
                <span
                  className="h-fit shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] sm:w-[168px]"
                  style={{ backgroundColor: tone.bg, color: tone.text }}
                >
                  {tag.kind}
                </span>
                <span className="text-[14px] leading-6 text-[#3a4250]">{tag.text}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {item.riskSignal ? (
        <div
          className="mt-4 rounded-xl border-l-2 p-4"
          style={{ backgroundColor: "#f2eae8", borderColor: "#a6564e" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "#7c3f39" }}
          >
            Risk signal · {item.riskSignal.label}
          </p>
          <p className="mt-1 text-[14px] leading-6" style={{ color: INK }}>
            {item.riskSignal.text}
          </p>
          {item.riskSignal.adviserResponse ? (
            <p className="mt-2 text-[13px] leading-6 text-[#7c3f39]">
              Adviser response: {item.riskSignal.adviserResponse}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --- Section 4 step ----------------------------------------------------- */

function SequenceStep({ step }: { step: InsiderSequenceStep }) {
  return (
    <div className="flex gap-4 break-inside-avoid">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
        style={{ backgroundColor: NAVY_DEEP }}
      >
        {step.step}
      </span>
      <div className="min-w-0 pb-2">
        <p className="text-[15px] font-semibold" style={{ color: INK }}>
          {step.title}
        </p>
        {step.instruction ? (
          <p className="mt-1 text-[14px] leading-6 text-[#3a4250]">{step.instruction}</p>
        ) : null}
        {step.example ? (
          <p
            className="mt-2 border-l-2 pl-3 text-[14px] leading-6 text-[#5b6472]"
            style={{ ...serif, borderColor: GOLD }}
          >
            &ldquo;{step.example}&rdquo;
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function InsiderInsightsReportClient({
  report,
  backHref,
}: {
  report: InsiderInsightsReport;
  backHref: string;
}) {
  const { meta, snapshot } = report;
  const [activeSection, setActiveSection] = useState<string>("snapshot");

  const indexItems = useMemo(
    () =>
      INDEX_ITEMS.filter((item) => {
        if (item.id === "founders-words") return report.foundersWords.length > 0;
        if (item.id === "predictive-signals") return report.predictiveSignals.length > 0;
        if (item.id === "objective") return Boolean(report.objective);
        return true;
      }),
    [report],
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = indexItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0, 0.25, 0.6, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [indexItems]);

  const completedLabel = meta.generatedAt
    ? new Date(meta.generatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const secondaryText = snapshot.secondaryApproach
    ? snapshot.secondaryApproach.percentage != null
      ? `${snapshot.secondaryApproach.label} (${round1(snapshot.secondaryApproach.percentage)}%)`
      : snapshot.secondaryApproach.label
    : "—";

  return (
    <main
      className={`${newsreader.variable} min-h-screen`}
      style={{ backgroundColor: IVORY, color: INK }}
    >
      {/* Hero */}
      <header className="px-5 pt-10 pb-8 text-white sm:px-8" style={{ background: NAVY_GRADIENT }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={backHref}
              className="rounded-md border border-white/25 px-3 py-2 text-sm text-white/80 hover:bg-white/10 print:hidden"
            >
              &larr; Back to profile
            </Link>
            <PrintButton className="rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 print:hidden">
              Print / Save PDF
            </PrintButton>
          </div>

          <div>
            <Eyebrow tone="light">{meta.test.name} · Insider Insights</Eyebrow>
            <h1 className="mt-2 text-3xl leading-tight sm:text-4xl" style={serif}>
              {meta.taker.fullName}
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {[meta.taker.company, meta.org.name, completedLabel].filter(Boolean).join(" · ")}
            </p>
          </div>

          <p
            className="max-w-2xl rounded-lg border-l-2 border-[#b89a5e] bg-white/5 px-4 py-3 text-[13px] leading-6 text-white/80"
          >
            <strong className="text-white">Adviser-only.</strong> Prepared for the coach or
            consultant leading a commercial conversation with this founder. It is never
            shared with the test taker.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* Index */}
          <aside className="hidden lg:block print:hidden">
            <div
              className="sticky top-8 rounded-2xl border p-5"
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
                <p className="mt-1 text-[26px] leading-none" style={{ ...serif, color: INK }}>
                  {round1(snapshot.readinessPercentage)}%
                </p>
                {snapshot.readinessLabel ? (
                  <p className="mt-1 text-[12px] text-[#6b7280]">{snapshot.readinessLabel}</p>
                ) : null}
              </div>
              <nav className="mt-4 space-y-1">
                {indexItems.map((item, i) => {
                  const active = item.id === activeSection;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      aria-current={active ? "true" : undefined}
                      className="flex gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] leading-5 transition"
                      style={active ? { backgroundColor: NAVY_DEEP, color: "#fff" } : { color: "#5b6472" }}
                    >
                      <span className="tabular-nums" style={{ color: active ? GOLD : "#a99a78" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div className="space-y-14">
            {/* 1 — SNAPSHOT */}
            <section id="snapshot" className="scroll-mt-8">
              <SectionHeading index={1} title="Insider Snapshot" />
              <div
                className="mt-4 rounded-2xl border p-6 sm:p-8"
                style={{ backgroundColor: "#fff", borderColor: IVORY_BORDER }}
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <ReadinessDonut
                    percentage={snapshot.readinessPercentage}
                    band={snapshot.readinessLabel ?? ""}
                    onLight
                  />
                  <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <SnapshotFact
                      label="Primary approach"
                      value={`${snapshot.primaryApproach.label} (${round1(snapshot.primaryApproach.percentage)}%)`}
                    />
                    <SnapshotFact label="Secondary influence" value={secondaryText} />
                    <SnapshotFact
                      label="Primary constraint"
                      value={
                        snapshot.primaryConstraint
                          ? `${snapshot.primaryConstraint.label} · ${round1(snapshot.primaryConstraint.percentage)}%`
                          : "—"
                      }
                    />
                    <SnapshotFact
                      label="Secondary constraint"
                      value={
                        snapshot.secondaryConstraint
                          ? `${snapshot.secondaryConstraint.label} · ${round1(snapshot.secondaryConstraint.percentage)}%`
                          : "—"
                      }
                    />
                    <SnapshotFact
                      label="Strongest pillar"
                      value={
                        snapshot.strongestPillar
                          ? `${snapshot.strongestPillar.label} · ${round1(snapshot.strongestPillar.percentage)}%`
                          : "—"
                      }
                    />
                    <SnapshotFact
                      label="Possible false constraint"
                      value={snapshot.falseConstraint?.label ?? "None flagged"}
                      hint={snapshot.falseConstraint?.note ?? null}
                    />
                  </dl>
                </div>

                {snapshot.priorityOrder.length > 0 ? (
                  <p className="mt-6 border-t pt-4 text-[13px] leading-6 text-[#6b7280]" style={{ borderColor: HAIRLINE }}>
                    <span className="font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD_TEXT }}>
                      Priority fix order:{" "}
                    </span>
                    {snapshot.priorityOrder.map((p) => p.label).join(" → ")}
                  </p>
                ) : null}

                <div className="mt-6 border-t pt-5" style={{ borderColor: HAIRLINE }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD_TEXT }}>
                    Six pillars
                  </p>
                  <div className="mt-1">
                    <PillarSummaryList
                      pillars={snapshot.pillars.map((p) => ({
                        key: p.key,
                        label: p.label,
                        descriptor: p.descriptor,
                        percentage: p.percentage,
                        gar: GAR_KEY[p.gar] as Gar,
                      }))}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 2 — PREDICTIVE SIGNALS */}
            {report.predictiveSignals.length > 0 ? (
              <section id="predictive-signals" className="scroll-mt-8">
                <SectionHeading index={2} title="Predictive Signals at a Glance" />
                <p className="mt-2 text-[13px] text-[#8a8477]">
                  For a {meta.approachLabel} founder. Each row is the lead of the fuller
                  guidance in the coaching library.
                </p>
                <dl
                  className="mt-4 divide-y divide-[#e7e3db] rounded-2xl border"
                  style={{ backgroundColor: "#fff", borderColor: IVORY_BORDER }}
                >
                  {report.predictiveSignals.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6"
                    >
                      <dt
                        className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]"
                      >
                        {row.label}
                      </dt>
                      <dd className="text-[14px] leading-6 text-[#3a4250]">{row.text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {/* 3 — FOUNDER'S OWN WORDS */}
            {report.foundersWords.length > 0 ? (
              <section id="founders-words" className="scroll-mt-8">
                <SectionHeading index={3} title="The Founder's Own Words" />
                <p className="mt-2 text-[13px] text-[#8a8477]">
                  What they wrote, read against their actual pillar evidence and primary
                  constraint. Tags are hypotheses to test in the room, not conclusions.
                </p>
                <div className="mt-4 space-y-5">
                  {report.foundersWords.map((item) => (
                    <FounderWordCard key={item.prompt} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 4 — SUGGESTED SEQUENCE */}
            <section id="suggested-sequence" className="scroll-mt-8">
              <SectionHeading index={4} title="Suggested Sequence" />
              <p className="mt-2 text-[13px] text-[#8a8477]">
                A four-step talk-track for a {meta.approachLabel} founder
                {meta.primaryConstraint ? ` with a ${meta.primaryConstraint.label} constraint` : ""}.
              </p>
              <div
                className="mt-4 space-y-5 rounded-2xl border p-6 sm:p-8"
                style={{ backgroundColor: "#fff", borderColor: IVORY_BORDER }}
              >
                {report.suggestedSequence.map((step) => (
                  <SequenceStep key={step.step} step={step} />
                ))}
              </div>
            </section>

            {/* 5 — THE OBJECTIVE */}
            {report.objective ? (
              <section id="objective" className="scroll-mt-8">
                <SectionHeading index={5} title="The Objective" />
                <div
                  className="mt-4 rounded-2xl border-l-4 p-6 sm:p-8"
                  style={{ backgroundColor: IVORY_PANEL, borderColor: GOLD }}
                >
                  <p className="text-[19px] leading-8" style={{ ...serif, color: INK }}>
                    {report.objective}
                  </p>
                </div>
              </section>
            ) : null}

            <footer
              className="border-t pt-6 text-[12px] text-[#9a9384] print:hidden"
              style={{ borderColor: HAIRLINE }}
            >
              <p>Content source: {meta.sourceVersion}.</p>
              {report.qaFlags.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer">
                    Diagnostic notes ({report.qaFlags.length}) — not shown to the founder
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {report.qaFlags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
