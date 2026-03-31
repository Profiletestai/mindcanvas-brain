//apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/ProfileExtendedReportClient.tsx
"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type VisibilityInputs = {
  tier: string;
  level: number;
  behaviour_style?: string | null;
  readiness?: string | null;
  pillar_scores?: Record<string, number> | null;
  tier_counts?: Record<string, number> | null;
  personality_points?: Record<string, number> | null;
};

type ReportBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  transition?: string;
};

type ReportSection = {
  key: string;
  title?: string;
  blocks?: ReportBlock[];
};

function safeString(x: any) {
  return typeof x === "string" ? x.trim() : "";
}

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function sectionLabel(key: string, title?: string) {
  if (safeString(title)) return title!;
  const map: Record<string, string> = {
    result_interpretation_scripts: "Result Interpretation",
    level_progression_roadmap: "Level Progression Roadmap",
    visibility_signal_framework: "Visibility Signal Framework",
    visibility_audit_layer: "Visibility Audit Layer",
  };
  return map[key] || key.replace(/_/g, " ");
}

function sectionId(key: string) {
  return `section-${key.replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
}

function colourForTier(tier: string) {
  const t = safeString(tier).toLowerCase();
  if (t === "invisible") return "#64748b";
  if (t === "emerging") return "#3b82f6";
  if (t === "established") return "#14b8a6";
  if (t === "magnetic") return "#8b5cf6";
  return "#64748b";
}

function normalisedPillars(scores?: Record<string, number> | null) {
  const s = scores || {};
  return Object.entries(s).map(([key, value]) => ({
    key,
    label: key.replace(/_/g, " "),
    value: Math.max(0, Math.min(100, safeNumber(value))),
  }));
}

function tierRows(level: number) {
  return Array.from({ length: 20 }, (_, i) => 20 - i).map((n) => ({
    level: n,
    active: n === level,
    tier:
      n <= 5
        ? "Invisible"
        : n <= 10
          ? "Emerging"
          : n <= 15
            ? "Established"
            : "Magnetic",
  }));
}

function TierLadderGraph({ tier, level }: { tier: string; level: number }) {
  const rows = tierRows(level);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Ladder Position
      </div>

      <div className="mt-4 space-y-1">
        {rows.map((row) => {
          const color = colourForTier(row.tier);
          return (
            <div key={row.level} className="flex items-center gap-3">
              <div className="w-8 text-xs text-slate-500">{row.level}</div>
              <div
                className="relative h-6 flex-1 rounded-full border"
                style={{
                  borderColor: row.active ? color : "#e2e8f0",
                  background: row.active ? `${color}22` : "#ffffff",
                }}
              >
                <div
                  className="absolute inset-y-0 right-0 w-1 rounded-r-full"
                  style={{ background: row.active ? color : "#cbd5e1" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-sm text-slate-700">
        <span className="font-semibold" style={{ color: colourForTier(tier) }}>
          {tier}
        </span>{" "}
        • Level {level}
      </div>
    </div>
  );
}

function PillarGraph({ scores }: { scores?: Record<string, number> | null }) {
  const pillars = normalisedPillars(scores);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Pillar Scores
      </div>

      {pillars.length ? (
        <div className="mt-4 space-y-4">
          {pillars.map((pillar) => (
            <div key={pillar.key}>
              <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                <span className="capitalize">{pillar.label}</span>
                <span className="font-medium">{pillar.value}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div
                  className="h-3 rounded-full bg-slate-900"
                  style={{ width: `${pillar.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">
          No pillar scores available.
        </div>
      )}
    </div>
  );
}

function TierCountsGraph({ counts }: { counts?: Record<string, number> | null }) {
  const c = counts || {};
  const items = [
    { key: "Invisible", label: "Invisible", value: safeNumber(c.Invisible) },
    { key: "Emerging", label: "Emerging", value: safeNumber(c.Emerging) },
    { key: "Established", label: "Established", value: safeNumber(c.Established) },
    { key: "Magnetic", label: "Magnetic", value: safeNumber(c.Magnetic) },
  ];
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Tier Distribution
      </div>

      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  background: colourForTier(item.key),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileExtendedReportClient(props: {
  orgSlug: string;
  takerId: string;
  orgName: string;
  testName: string;
  takerName: string;
  takerEmail: string;
  company: string;
  roleTitle: string;
  inputs: VisibilityInputs;
  sections: ReportSection[];
}) {
  const reportRef = useRef<HTMLDivElement | null>(null);

  const pillarEntries = useMemo(() => {
    const scores = props.inputs.pillar_scores || {};
    return Object.entries(scores).map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " "),
      value: safeNumber(value),
    }));
  }, [props.inputs.pillar_scores]);

  async function downloadPdf() {
    try {
      if (!reportRef.current) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f8fafc",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new JsPDF("p", "pt", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = `${props.takerName || "Profile"}-Profile-Extended-Report`.replace(
        /[^\w-]+/g,
        "_"
      );
      pdf.save(`${safeName}.pdf`);
    } catch (err) {
      console.error("[profile-extended-report] pdf export failed", err);
      alert("PDF export failed. Check the console for details.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/portal/${props.orgSlug}/database/${props.takerId}`}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back to test taker profile
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Profile Extended Report
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Internal-only extended interpretation layer for Visibility Ladder
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadPdf}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div ref={reportRef} className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Internal Report
                </div>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                  {props.takerName}
                </h2>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>{props.takerEmail || "—"}</div>
                  <div>{props.company || "—"}</div>
                  <div>{props.roleTitle || "—"}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Organisation
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {props.orgName}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assessment
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {props.testName}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tier
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: colourForTier(props.inputs.tier) }}
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      {props.inputs.tier}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Level
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {props.inputs.level}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Behaviour Style
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {props.inputs.behaviour_style || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Readiness
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {props.inputs.readiness || "—"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Report Index
                </div>

                <div className="mt-4 space-y-2">
                  {props.sections.map((section, index) => (
                    <a
                      key={section.key}
                      href={`#${sectionId(section.key)}`}
                      className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span className="mr-2 text-slate-400">{index + 1}.</span>
                      {sectionLabel(section.key, section.title)}
                    </a>
                  ))}
                </div>

                {pillarEntries.length ? (
                  <div className="mt-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pillar Scores
                    </div>
                    <div className="mt-3 space-y-3">
                      {pillarEntries.map((pillar) => (
                        <div key={pillar.key}>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span className="capitalize">{pillar.label}</span>
                            <span>{pillar.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-slate-900"
                              style={{ width: `${Math.max(0, Math.min(100, pillar.value))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>

            <main className="space-y-6">
              <section className="grid gap-6 xl:grid-cols-3">
                <TierLadderGraph
                  tier={props.inputs.tier}
                  level={props.inputs.level}
                />
                <PillarGraph scores={props.inputs.pillar_scores} />
                <TierCountsGraph counts={props.inputs.tier_counts} />
              </section>

              {props.sections.length ? (
                props.sections.map((section, index) => (
                  <section
                    key={section.key}
                    id={sectionId(section.key)}
                    className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
                  >
                    <div className="mb-6">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Section {index + 1}
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {sectionLabel(section.key, section.title)}
                      </h2>
                    </div>

                    <div className="space-y-5">
                      {(section.blocks || []).map((block, blockIndex) => (
                        <div
                          key={`${section.key}-${blockIndex}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
                        >
                          {safeString(block.title) ? (
                            <h3 className="text-lg font-semibold text-slate-900">
                              {block.title}
                            </h3>
                          ) : null}

                          {safeString(block.short_summary) ? (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">
                                In short:
                              </span>{" "}
                              {block.short_summary}
                            </div>
                          ) : null}

                          {Array.isArray(block.paragraphs) && block.paragraphs.length ? (
                            <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-700">
                              {block.paragraphs.map((paragraph, pIndex) => (
                                <p key={pIndex}>{paragraph}</p>
                              ))}
                            </div>
                          ) : null}

                          {safeString(block.transition) ? (
                            <div className="mt-4 text-xs italic text-slate-500">
                              {block.transition}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8">
                  <h2 className="text-xl font-semibold text-slate-900">
                    No report sections found
                  </h2>
                  <p className="mt-3 text-sm text-slate-700">
                    The helper ran, but no matching Profile Extended Report blocks
                    were returned from the knowledge base.
                  </p>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}