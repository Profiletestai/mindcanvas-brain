"use client";

/* -------------------------------------------------------------------------- */
/* Insider Insights — the private, adviser-facing companion to the Inevitable  */
/* Standard client reports. Reached from the test-taker profile in the portal. */
/* Rendered from a report assembled server-side by buildInsiderInsightsReport. */
/* -------------------------------------------------------------------------- */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  InsiderBlock,
  InsiderInsightsReport,
} from "@/lib/inevitable-standard/buildInsiderInsightsReport";
import {
  BandMeter,
  GAR,
  GOLD,
  GOLD_TEXT,
  HAIRLINE,
  INK,
  IVORY,
  IVORY_BORDER,
  IVORY_PANEL,
  NAVY_DEEP,
  ReadinessDonut,
  newsreader,
  round1,
  serif,
} from "@/app/t/[token]/report/inevitableStandardShared";
import PrintButton from "@/app/t/[token]/report/PrintButton";

const GAR_KEY = { GREEN: "green", AMBER: "amber", RED: "red" } as const;

function Block({ block }: { block: InsiderBlock }) {
  if (block.type === "list") {
    return (
      <div className="mt-4">
        {block.label ? (
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: GOLD_TEXT }}
          >
            {block.label}
          </p>
        ) : null}
        <ul className="mt-2 space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-[#3a4250]">
              <span aria-hidden style={{ color: GOLD }}>
                &bull;
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <div
        className="mt-4 rounded-xl border-l-2 p-4"
        style={{ backgroundColor: IVORY_PANEL, borderColor: GOLD }}
      >
        {block.label ? (
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: GOLD_TEXT }}
          >
            {block.label}
          </p>
        ) : null}
        <p className="mt-1 whitespace-pre-line text-[15px] leading-7" style={{ color: INK }}>
          {block.text}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {block.label ? (
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: GOLD_TEXT }}
        >
          {block.label}
        </p>
      ) : null}
      <p
        className="mt-1 whitespace-pre-line text-[15px] leading-7 text-[#3a4250]"
      >
        {block.text}
      </p>
    </div>
  );
}

export default function InsiderInsightsReportClient({
  report,
  backHref,
}: {
  report: InsiderInsightsReport;
  backHref: string;
}) {
  const { meta, snapshot, sections } = report;

  const indexItems = useMemo(
    () => [
      { id: "snapshot", label: "Diagnostic snapshot" },
      ...sections.map((s) => ({ id: s.id, label: s.title })),
    ],
    [sections],
  );

  const [activeSection, setActiveSection] = useState("snapshot");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = indexItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
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
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [indexItems]);

  const completedLabel = meta.generatedAt
    ? new Date(meta.generatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main
      className={`${newsreader.variable} min-h-screen`}
      style={{ backgroundColor: IVORY, color: INK }}
    >
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={backHref}
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: IVORY_BORDER, color: "#5b6472" }}
          >
            &larr; Back to profile
          </Link>
          <PrintButton className="rounded-md bg-[#14263d] px-3 py-2 text-sm font-medium text-white hover:bg-[#1f2c46]">
            Print / Save PDF
          </PrintButton>
        </div>

        {/* Banner */}
        <div
          className="mt-5 rounded-xl border-l-2 px-4 py-3 text-[13px] leading-6"
          style={{ backgroundColor: "#f2eae8", borderColor: "#a6564e", color: "#7c3f39" }}
        >
          <strong>Adviser-only.</strong> This report is for the coach or consultant
          preparing a commercial conversation. It is never shared with the test
          taker.
        </div>

        {/* Header */}
        <header className="mt-6">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: GOLD_TEXT }}
          >
            {meta.test.name} · Insider Insights
          </p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl" style={{ ...serif, color: INK }}>
            {meta.taker.fullName}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {[meta.taker.company, meta.org.name, completedLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
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
              <nav className="mt-4 space-y-1">
                {indexItems.map((item, index) => {
                  const active = item.id === activeSection;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      aria-current={active ? "true" : undefined}
                      className="flex gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] leading-5 transition"
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
                        {String(index).padStart(2, "0")}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div>
            {/* Snapshot */}
            <section id="snapshot" className="scroll-mt-8">
              <div
                className="rounded-2xl border p-6 sm:p-8"
                style={{ backgroundColor: "#fff", borderColor: IVORY_BORDER }}
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <ReadinessDonut
                    percentage={snapshot.readinessPercentage}
                    band={snapshot.readinessLabel ?? ""}
                    onLight
                  />
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: GOLD_TEXT }}
                    >
                      Inevitable Standard Readiness
                    </p>
                    <p className="mt-1 text-2xl" style={{ ...serif, color: INK }}>
                      {round1(snapshot.readinessPercentage)}%{" "}
                      <span className="text-base text-[#6b7280]">
                        {snapshot.readinessLabel}
                      </span>
                    </p>
                    <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                      <div className="flex justify-between gap-3 sm:block">
                        <dt className="text-[#8a8477]">Dominant approach</dt>
                        <dd style={{ color: INK }}>{meta.approachLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-3 sm:block">
                        <dt className="text-[#8a8477]">Secondary influence</dt>
                        <dd style={{ color: INK }}>
                          {meta.secondaryInfluenceLabel ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 sm:block">
                        <dt className="text-[#8a8477]">Primary constraint</dt>
                        <dd style={{ color: INK }}>
                          {meta.primaryConstraint?.label ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 sm:block">
                        <dt className="text-[#8a8477]">Secondary constraint</dt>
                        <dd style={{ color: INK }}>
                          {meta.secondaryConstraint?.label ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Pillars */}
                <div className="mt-6 border-t pt-5" style={{ borderColor: HAIRLINE }}>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: GOLD_TEXT }}
                  >
                    Six pillars
                  </p>
                  <ul className="mt-3 space-y-3">
                    {snapshot.pillars.map((pillar) => {
                      const gar = GAR[GAR_KEY[pillar.gar]];
                      return (
                        <li key={pillar.key} className="grid grid-cols-[130px_minmax(0,1fr)_84px] items-center gap-3">
                          <span className="text-[13px]" style={{ color: INK }}>
                            {pillar.label}
                          </span>
                          <BandMeter percentage={pillar.percentage} />
                          <span className="flex items-center justify-end gap-2 text-[12px]">
                            <span className="tabular-nums text-[#6b7280]">
                              {round1(pillar.percentage)}%
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{ backgroundColor: gar.chipBg, color: gar.chipText }}
                            >
                              {gar.name}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {snapshot.priorityOrder.length > 0 ? (
                  <p className="mt-5 text-[13px] leading-6 text-[#6b7280]">
                    <span
                      className="font-semibold uppercase tracking-[0.16em]"
                      style={{ color: GOLD_TEXT }}
                    >
                      Priority fix order:{" "}
                    </span>
                    {snapshot.priorityOrder
                      .map(
                        (key) =>
                          snapshot.pillars.find((p) => p.key === key)?.label ?? key,
                      )
                      .join(" → ")}
                  </p>
                ) : null}
              </div>
            </section>

            {/* Sections */}
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="mt-10 scroll-mt-8 break-inside-avoid"
              >
                <h2 className="text-[22px] leading-snug" style={{ ...serif, color: INK }}>
                  {section.title}
                </h2>
                {section.subtitle ? (
                  <p className="mt-1 text-[13px] text-[#8a8477]">{section.subtitle}</p>
                ) : null}
                <div className="mt-2">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}

            <footer
              className="mt-14 border-t pt-6 text-[12px] text-[#9a9384] print:hidden"
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
