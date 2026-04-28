//apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/ProfileExtendedReportClient.tsx
"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DownloadPdfButton from "@/components/reports/DownloadPdfButton";

type VisibilityTier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type BehaviourStyle = "A" | "B" | "C" | "D";

type ProfileExtendedBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  items?: Array<Record<string, unknown>>;
  transition?: string;
  meta?: Record<string, unknown>;
};

type ProfileExtendedPanel = {
  panel_key: string;
  title: string;
  blocks: ProfileExtendedBlock[];
  matched_rows?: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, unknown>;
  }>;
};

type ProfileExtendedSection = {
  section_key: string;
  heading: string;
  panels: ProfileExtendedPanel[];
  matched_rows?: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, unknown>;
  }>;
};

type ReportPayload = {
  audience?: string;
  meta?: {
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string | null;
    generated_at?: string | null;
    mode?: string | null;
    scoring_mode?: string | null;
    report_variant?: string | null;
  } | null;
  input?: {
    tier?: string | null;
    level?: number | null;
    behaviour_style?: string | null;
    readiness?: string | null;
    pillar_scores?: Record<string, number | null> | null;
    tier_counts?: Record<string, number | null> | null;
  } | null;
  signals?: {
    tier?: string | null;
    level?: number | null;
    style?: string | null;
    readiness?: string | null;
    overall_pct?: number | null;
    pillar_scores?: Record<string, number | null> | null;
    weakest_pillar?: string | null;
    strongest_pillar?: string | null;
  } | null;
  graphs?: {
    tier_counts?: Record<string, number | null> | null;
    pillars?: Record<string, number | null> | null;
    pillar_bands?: Record<string, string | null> | null;
  } | null;
  sections?: unknown[];
};

type Props = {
  org: {
    id: string;
    slug: string;
    name: string;
  };
  taker: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    roleTitle: string;
    createdAt: string | null;
  };
  test: {
    id: string;
    name: string;
    slug: string;
  };
  report: ReportPayload;
  backHref: string;
};

const BRAND = {
  pageBg: "#050914",
  heroBg:
    "radial-gradient(ellipse 83.33% 66.67% at 50% -10%, #113149 0%, #08121B 55%, #060E16 100%)",
  border: "#E2E8F0",
  blue: "#4F7DFF",
  purple: "#8B5CF6",
  teal: "#32D7C8",
  green: "#0FCD5E",
  red: "#E24B4A",
  orange: "#EF9F27",
  sky: "#4A9EDD",
  slate: "#A7B3C7",
} as const;

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function titleCase(input: string) {
  return safeString(input)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function readinessLabel(value?: string | null) {
  const v = safeString(value).toLowerCase();
  if (v === "stabilise") return "Stabilise";
  if (v === "ready_to_progress") return "Ready to progress";
  return value ? titleCase(value) : "—";
}

function overallScore(report: ReportPayload) {
  const direct = safeNumber(report?.signals?.overall_pct, -1);
  if (direct >= 0) return direct;

  const source =
    report?.graphs?.pillars ||
    report?.signals?.pillar_scores ||
    report?.input?.pillar_scores ||
    {};

  const values = [
    safeNumber((source as Record<string, unknown>)?.visibility, NaN),
    safeNumber((source as Record<string, unknown>)?.trust, NaN),
    safeNumber((source as Record<string, unknown>)?.authority, NaN),
    safeNumber((source as Record<string, unknown>)?.dominance, NaN),
  ].filter((n) => Number.isFinite(n));

  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function getTier(report: ReportPayload): VisibilityTier {
  const tier = safeString(report?.signals?.tier || report?.input?.tier);
  if (
    tier === "Invisible" ||
    tier === "Emerging" ||
    tier === "Established" ||
    tier === "Magnetic"
  ) {
    return tier;
  }
  return "Invisible";
}

function getLevel(report: ReportPayload) {
  return clamp(safeNumber(report?.signals?.level ?? report?.input?.level, 1), 1, 20);
}

function getStyle(report: ReportPayload): BehaviourStyle {
  const value = safeString(
    report?.signals?.style || report?.input?.behaviour_style
  ).toUpperCase();
  if (value === "A" || value === "B" || value === "C" || value === "D") return value;
  return "A";
}

function getTierRange(tier: VisibilityTier) {
  if (tier === "Invisible") return "1–5";
  if (tier === "Emerging") return "6–10";
  if (tier === "Established") return "11–15";
  return "16–20";
}

function getTierColor(tier: VisibilityTier) {
  if (tier === "Invisible") return BRAND.slate;
  if (tier === "Emerging") return BRAND.blue;
  if (tier === "Established") return BRAND.teal;
  return BRAND.purple;
}

function getTierCounts(report: ReportPayload) {
  const counts = report?.graphs?.tier_counts || {};
  return {
    Invisible: safeNumber((counts as Record<string, unknown>)?.Invisible, 0),
    Emerging: safeNumber((counts as Record<string, unknown>)?.Emerging, 0),
    Established: safeNumber((counts as Record<string, unknown>)?.Established, 0),
    Magnetic: safeNumber((counts as Record<string, unknown>)?.Magnetic, 0),
  };
}

function getPillarItems(report: ReportPayload) {
  const source =
    report?.graphs?.pillars ||
    report?.signals?.pillar_scores ||
    report?.input?.pillar_scores ||
    {};

  return [
    {
      key: "trust",
      label: "Trust",
      value: safeNumber((source as Record<string, unknown>)?.trust, 0),
      color: BRAND.green,
    },
    {
      key: "authority",
      label: "Authority",
      value: safeNumber((source as Record<string, unknown>)?.authority, 0),
      color: BRAND.red,
    },
    {
      key: "dominance",
      label: "Dominance",
      value: safeNumber((source as Record<string, unknown>)?.dominance, 0),
      color: BRAND.sky,
    },
    {
      key: "visibility",
      label: "Visibility",
      value: safeNumber((source as Record<string, unknown>)?.visibility, 0),
      color: BRAND.orange,
    },
  ];
}

function safeSectionId(sectionKey: unknown) {
  const raw = safeString(sectionKey);
  return raw ? raw.replace(/_/g, "-") : "section";
}

function normalizeSections(rawSections: unknown[]): ProfileExtendedSection[] {
  const mapped: Array<ProfileExtendedSection | null> = (rawSections || []).map(
    (section: unknown) => {
      const sec = (section || {}) as Record<string, unknown>;
      const sectionKey = safeString(sec.section_key || sec.key);
      if (!sectionKey) return null;

      let panels: ProfileExtendedPanel[] = [];

      if (Array.isArray(sec.panels)) {
        panels = (sec.panels as unknown[])
          .map((panel: unknown): ProfileExtendedPanel | null => {
            const p = (panel || {}) as Record<string, unknown>;
            const panelKey = safeString(p.panel_key || p.key || "panel");
            const title = safeString(p.title) || titleCase(panelKey);
            const blocks = Array.isArray(p.blocks)
              ? (p.blocks as ProfileExtendedBlock[])
              : [];

            if (!panelKey) return null;
            if (!blocks.length && !title) return null;

            return {
              panel_key: panelKey,
              title,
              blocks,
              matched_rows: Array.isArray(p.matched_rows)
                ? (p.matched_rows as Array<{
                    id: string;
                    priority: number;
                    source_section_key: string;
                    triggers: Record<string, unknown>;
                  }>)
                : [],
            };
          })
          .filter((panel): panel is ProfileExtendedPanel => panel !== null);
      } else if (Array.isArray(sec.blocks)) {
        panels = [
          {
            panel_key: `${sectionKey}_legacy`,
            title: safeString(sec.title) || titleCase(sectionKey),
            blocks: sec.blocks as ProfileExtendedBlock[],
            matched_rows: [],
          },
        ];
      }

      return {
        section_key: sectionKey,
        heading:
          safeString(sec.heading || sec.title) || titleCase(sectionKey),
        panels,
        matched_rows: Array.isArray(sec.matched_rows)
          ? (sec.matched_rows as Array<{
              id: string;
              priority: number;
              source_section_key: string;
              triggers: Record<string, unknown>;
            }>)
          : [],
      };
    }
  );

  return mapped.filter(
    (section): section is ProfileExtendedSection =>
      section !== null &&
      !!section.section_key &&
      Array.isArray(section.panels)
  );
}


function PdfPrintModeStyles({ isPrintMode }: { isPrintMode: boolean }) {
  if (!isPrintMode) return null;

  return (
    <style>{`
      html.mc-pdf-print-mode,
      body.mc-pdf-print-mode {
        background: #ffffff !important;
      }

      body.mc-pdf-print-mode .no-print,
      body.mc-pdf-print-mode .pdf-hide,
      body.mc-pdf-print-mode [data-no-print="true"],
      body.mc-pdf-print-mode [data-pdf-hide="true"],
      body.mc-pdf-print-mode nav,
      body.mc-pdf-print-mode header,
      body.mc-pdf-print-mode [role="navigation"],
      body.mc-pdf-print-mode [aria-label="breadcrumb"],
      body.mc-pdf-print-mode [aria-label="breadcrumbs"] {
        display: none !important;
        visibility: hidden !important;
      }

      body.mc-pdf-print-mode .pdf-report-shell {
        background: #ffffff !important;
      }

      body.mc-pdf-print-mode .pdf-hero {
        min-height: auto !important;
      }

      body.mc-pdf-print-mode .pdf-hero-inner {
        padding-top: 0 !important;
        padding-bottom: 16px !important;
      }

      body.mc-pdf-print-mode .pdf-content-area {
        background: #ffffff !important;
      }

      body.mc-pdf-print-mode .pdf-content-inner {
        padding-top: 12px !important;
        padding-bottom: 0 !important;
      }

      body.mc-pdf-print-mode .pdf-page-break {
        break-before: auto !important;
        page-break-before: auto !important;
      }

      body.mc-pdf-print-mode .report-section {
        break-inside: auto !important;
        page-break-inside: auto !important;
        margin-top: 16px !important;
      }

      body.mc-pdf-print-mode .report-card,
      body.mc-pdf-print-mode .summary-card,
      body.mc-pdf-print-mode .chart-card,
      body.mc-pdf-print-mode .pdf-avoid-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      body.mc-pdf-print-mode .pdf-chart-grid {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }

      body.mc-pdf-print-mode .pdf-sections-grid {
        display: block !important;
      }

      body.mc-pdf-print-mode .pdf-sections-list {
        display: block !important;
      }

      body.mc-pdf-print-mode .pdf-sections-list > section:first-child {
        margin-top: 0 !important;
      }

      body.mc-pdf-print-mode .shadow,
      body.mc-pdf-print-mode .shadow-sm,
      body.mc-pdf-print-mode .shadow-md,
      body.mc-pdf-print-mode .shadow-lg,
      body.mc-pdf-print-mode .shadow-xl,
      body.mc-pdf-print-mode .shadow-2xl {
        box-shadow: none !important;
      }

      body.mc-pdf-print-mode a {
        color: inherit !important;
        text-decoration: none !important;
      }

      @media print {
        @page {
          size: A4;
          margin: 12mm;
        }

        body.mc-pdf-print-mode .pdf-page-break {
          break-before: auto !important;
          page-break-before: auto !important;
        }
      }
    `}</style>
  );
}

function usePdfPrintCleanup(isPrintMode: boolean) {
  useEffect(() => {
    if (!isPrintMode || typeof document === "undefined") return;

    document.documentElement.classList.add("mc-pdf-print-mode");
    document.body.classList.add("mc-pdf-print-mode");

    const hiddenTextFragments = [
      "dashboard",
      "database",
      "tests",
      "profile settings",
      "communications",
      "back to",
      "download pdf",
      "report index",
    ];

    const shouldHideText = (value: string) => {
      const normalised = value.replace(/\s+/g, " ").trim().toLowerCase();
      return hiddenTextFragments.some((fragment) => normalised.includes(fragment));
    };

    const hideElement = (element: Element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.display = "none";
      htmlElement.style.visibility = "hidden";
      htmlElement.setAttribute("data-pdf-hidden-by-client", "true");
    };

    document
      .querySelectorAll("a, button, nav, header, aside, [role='navigation'], [aria-label='breadcrumb'], [aria-label='breadcrumbs']")
      .forEach((element) => {
        const tagName = element.tagName.toLowerCase();
        const text = element.textContent || "";
        const href = element instanceof HTMLAnchorElement ? element.href || "" : "";

        if (
          tagName === "nav" ||
          tagName === "header" ||
          tagName === "aside" ||
          shouldHideText(text) ||
          shouldHideText(href)
        ) {
          hideElement(element);
        }
      });

    return () => {
      document.documentElement.classList.remove("mc-pdf-print-mode");
      document.body.classList.remove("mc-pdf-print-mode");
    };
  }, [isPrintMode]);
}

function PdfSection({
  children,
  pageBreakBefore = false,
}: {
  children: ReactNode;
  pageBreakBefore?: boolean;
}) {
  return (
    <section
      data-pdf-section="true"
      className={`report-section ${pageBreakBefore ? "pdf-page-break" : ""}`}
    >
      {children}
    </section>
  );
}

function WhiteCard({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="rounded-[24px] bg-white shadow-sm"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="px-8 py-6 text-[24px] font-semibold leading-8 text-slate-900">
        {title}
      </div>
      <div className="px-8 pb-8">{children}</div>
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <div
      className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{
        color: BRAND.blue,
        background: "rgba(79,125,255,0.05)",
        outline: "1px solid rgba(79,125,255,0.49)",
      }}
    >
      {text}
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  badge,
  badgeColor,
  dotColor,
}: {
  label: string;
  value: string;
  subValue?: string;
  badge?: string;
  badgeColor?: string;
  dotColor?: string;
}) {
  return (
    <div
      className="summary-card pdf-avoid-break rounded-2xl bg-slate-50 p-4"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12px] uppercase tracking-[0.02em] text-slate-500">
          {label}
        </div>
        {badge ? (
          <div
            className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white"
            style={{ background: badgeColor || BRAND.blue }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {dotColor ? (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: dotColor }}
          />
        ) : null}
        <div className="text-[25px] font-semibold leading-7 text-slate-950">
          {value}
        </div>
      </div>

      {subValue ? <div className="mt-1 text-[11px] text-slate-500">{subValue}</div> : null}
    </div>
  );
}

function SummaryHeader({
  orgName,
  backHref,
  taker,
  test,
  report,
  orgSlug,
  isPrintMode,
}: {
  orgName: string;
  backHref: string;
  taker: Props["taker"];
  test: Props["test"];
  report: ReportPayload;
  orgSlug: string;
  isPrintMode: boolean;
}) {
  const tier = getTier(report);
  const level = getLevel(report);
  const style = getStyle(report);
  const readiness = readinessLabel(
    report?.signals?.readiness ?? report?.input?.readiness
  );
  const score = overallScore(report);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[20px] font-semibold text-white">{orgName}</div>
        {!isPrintMode ? (
          <Link href={backHref} className="no-print text-sm text-white/80 underline">
            Back to test taker profile
          </Link>
        ) : null}
      </div>

      <div>
        <div className="text-[26px] font-semibold leading-8 text-white">
          Internal Sales Report
        </div>
        <div className="mt-1 text-[11px] text-white/85">
          Visibility Ladder — sales-facing internal guidance
        </div>
      </div>

      {!isPrintMode ? (
        <div className="no-print flex flex-wrap gap-3">
          <DownloadPdfButton
            type="profile-extended"
            slug={orgSlug}
            takerId={taker.id}
            filename={`${taker.fullName || "profile"}-${test.name || "internal-sales-report"}-internal-sales-report`}
            className="bg-white text-[#050914] hover:bg-slate-100"
          />
        </div>
      ) : null}

      <div
        className="rounded-[24px] bg-white p-5"
        style={{ outline: `1px solid ${BRAND.border}` }}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_620px]">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Internal report
            </div>

            <div className="mt-4 text-[36px] font-semibold leading-10 text-slate-900">
              {taker.fullName}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill text="WhatsWhat Prime" />
              <Pill text="Visibility Ladder" />
              <Pill text="Sales guidance" />
            </div>

            <div className="mt-6 grid gap-2 text-[14px] text-slate-600">
              {taker.email ? <div>{taker.email}</div> : null}
              {taker.phone ? <div>{taker.phone}</div> : null}
              {test.name ? <div>{test.name}</div> : null}
              {taker.roleTitle ? <div>{taker.roleTitle}</div> : null}
              {taker.company ? <div>{taker.company}</div> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <StatCard
              label="Tier"
              value={tier}
              dotColor={getTierColor(tier)}
              badge={tier === "Magnetic" ? "Top tier" : undefined}
              badgeColor={getTierColor(tier)}
            />
            <StatCard label="Level" value={`${level}`} subValue="of 20" />
            <StatCard label="Style" value={style} />
            <StatCard
              label="Readiness"
              value={readiness}
              badge={`${score}% Score`}
              badgeColor={BRAND.green}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportIndexCard({
  sections,
}: {
  sections: ProfileExtendedSection[];
}) {
  return (
    <div
      className="no-print pdf-hide rounded-2xl bg-white p-5 shadow-sm"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Report Index
      </div>

      <div className="mt-4 space-y-3">
        {sections.map((section, idx) => (
          <a
            key={section.section_key}
            href={`#${safeSectionId(section.section_key)}`}
            className="block rounded-xl bg-slate-50 px-3 py-3 text-[14px] text-slate-950"
            style={{ outline: `1px solid ${BRAND.border}` }}
          >
            <span className="mr-2 text-slate-400">{idx + 1}.</span>
            {section.heading}
          </a>
        ))}
      </div>
    </div>
  );
}

function LadderPositionCard({ report }: { report: ReportPayload }) {
  const tier = getTier(report);
  const level = getLevel(report);
  const ordered: VisibilityTier[] = [
    "Invisible",
    "Emerging",
    "Established",
    "Magnetic",
  ];

  return (
    <div
      className="chart-card pdf-avoid-break rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Ladder position
      </div>

      <div className="mt-4 space-y-3">
        {ordered.map((item) => {
          const passed = ordered.indexOf(item) < ordered.indexOf(tier);
          const current = item === tier;
          const color = getTierColor(item);

          return current ? (
            <div key={item} className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F3FF] text-[13px] font-medium"
                style={{ color: "#7C3AED", outline: "2px solid #8B5CF6" }}
              >
                {level}
              </div>
              <div
                className="flex-1 rounded-xl p-4"
                style={{
                  background: item === "Magnetic" ? "#F5F3FF" : "#EFF6FF",
                  outline: `1px solid ${color}`,
                }}
              >
                <div className="text-[16px] font-medium text-slate-950">{item}</div>
                <div className="mt-1 flex items-center justify-between text-[14px]">
                  <span style={{ color }}>{getTierRange(item).split("–")[0]}</span>
                  <span style={{ color }}>{getTierRange(item).split("–")[1]}</span>
                </div>
                <div className="mt-3 h-1 rounded-full bg-white">
                  <div
                    className="h-1 rounded-full"
                    style={{
                      background: color,
                      width: `${Math.max(
                        8,
                        Math.min(
                          100,
                          ((level - Number(getTierRange(item).split("–")[0])) /
                            (Number(getTierRange(item).split("–")[1]) -
                              Number(getTierRange(item).split("–")[0]) || 1)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div key={item} className="flex items-center gap-3 opacity-70">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  background:
                    item === "Invisible"
                      ? "#F9FAFB"
                      : item === "Emerging"
                      ? "#EFF6FF"
                      : item === "Established"
                      ? "#F0FDF4"
                      : "#F5F3FF",
                  outline: `1px solid ${passed ? color : BRAND.border}`,
                }}
              >
                <span className="text-[12px]" style={{ color }}>
                  ✓
                </span>
              </div>
              <div>
                <div
                  className={`text-[14px] ${passed ? "line-through" : ""}`}
                  style={{ color }}
                >
                  {item}
                </div>
                <div className="text-[14px] text-slate-600">
                  {getTierRange(item)} · {passed ? "Passed" : "Pending"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: getTierColor(tier) }}
          />
          <div className="text-[17px] font-medium">
            <span style={{ color: getTierColor(tier) }}>{tier}</span>
            <span className="text-slate-700"> · Level {level}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillarScoresCard({ report }: { report: ReportPayload }) {
  const pillars = getPillarItems(report);

  return (
    <div
      className="chart-card pdf-avoid-break rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Pillar Scores
      </div>

      <div className="mt-4 space-y-4">
        {pillars.map((pillar) => (
          <div key={pillar.key}>
            <div className="mb-1 flex items-center justify-between text-[14px] text-slate-700">
              <span className="capitalize">{pillar.label.toLowerCase()}</span>
              <span className="font-medium">{pillar.value}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${pillar.value}%`,
                  background: pillar.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierDistributionCard({ report }: { report: ReportPayload }) {
  const counts = getTierCounts(report);
  const max = Math.max(...Object.values(counts), 0);

  return (
    <div
      className="chart-card pdf-avoid-break rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Tier Distribution
      </div>

      <div className="mt-4 space-y-4">
        {(Object.keys(counts) as VisibilityTier[]).map((tier) => {
          const value = counts[tier];
          const width = max > 0 ? (value / max) * 100 : 0;

          return (
            <div key={tier}>
              <div className="mb-1 flex items-center justify-between text-[14px] text-slate-700">
                <span>{tier}</span>
                <span>{value}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${width}%`,
                    background: getTierColor(tier),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemValue({ value }: { value: unknown }) {
  if (value == null) return <span>—</span>;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    return <span>{value.map((v) => String(v)).join(", ")}</span>;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return <span>—</span>;

  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k}>
          <span className="font-medium text-slate-900">{titleCase(k)}:</span>{" "}
          <span>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function BlockCard({ block }: { block: ProfileExtendedBlock }) {
  const hasSummary = !!safeString(block.short_summary);
  const paragraphs = Array.isArray(block.paragraphs) ? block.paragraphs : [];
  const bullets = Array.isArray(block.bullets) ? block.bullets : [];
  const items = Array.isArray(block.items) ? block.items : [];
  const transition = safeString(block.transition);

  return (
    <div
      className="report-card pdf-avoid-break rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      {block.title ? (
        <div className="text-[16px] font-semibold leading-7 text-slate-900">
          {block.title}
        </div>
      ) : null}

      {hasSummary ? (
        <div
          className={`rounded-xl bg-white px-4 py-4 text-slate-950 ${
            block.title ? "mt-4" : ""
          }`}
          style={{ outline: `1px solid ${BRAND.blue}` }}
        >
          {block.short_summary}
        </div>
      ) : null}

      {paragraphs.length > 0 ? (
        <div className="mt-4 space-y-3 text-[15px] leading-7 text-slate-700">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      {bullets.length > 0 ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item, idx) => {
            const entries = Object.entries(item);
            return (
              <div
                key={idx}
                className="rounded-xl bg-white px-4 py-4"
                style={{ outline: `1px solid ${BRAND.border}` }}
              >
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 py-1 text-[14px] leading-6"
                  >
                    <div className="font-medium text-slate-500">{titleCase(key)}</div>
                    <div className="text-slate-800">
                      <ItemValue value={value} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {transition ? (
        <div className="mt-4 text-[12px] italic leading-5 text-slate-500">
          {transition}
        </div>
      ) : null}
    </div>
  );
}

function PanelCard({
  title,
  panel,
  showPanelTitle,
}: {
  title: string;
  panel?: ProfileExtendedPanel | null;
  showPanelTitle: boolean;
}) {
  if (!panel) return null;

  return (
    <div className="space-y-4">
      {showPanelTitle ? (
        <div className="text-[18px] font-semibold leading-7 text-slate-900">
          {title}
        </div>
      ) : null}

      {panel.blocks.map((block, idx) => (
        <BlockCard key={`${panel.panel_key}-${idx}`} block={block} />
      ))}
    </div>
  );
}

function SectionRenderer({ section }: { section: ProfileExtendedSection }) {
  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-6">
        {section.panels.map((panel) => {
          const showPanelTitle =
            section.panels.length > 1 ||
            safeString(panel.title).toLowerCase() !== safeString(section.heading).toLowerCase();

          return (
            <PanelCard
              key={panel.panel_key}
              title={panel.title}
              panel={panel}
              showPanelTitle={showPanelTitle}
            />
          );
        })}
      </div>
    </WhiteCard>
  );
}

export default function ProfileExtendedReportClient({
  org,
  taker,
  test,
  report,
  backHref,
}: Props) {
  const searchParams = useSearchParams();
  const isPrintMode = searchParams.get("print") === "1";

  usePdfPrintCleanup(isPrintMode);

  const sections = useMemo(
    () => normalizeSections((report.sections || []) as unknown[]),
    [report.sections]
  );

  return (
    <>
      <PdfPrintModeStyles isPrintMode={isPrintMode} />
      <div
        className="min-h-screen pdf-report-shell"
        style={{ background: isPrintMode ? "#ffffff" : BRAND.pageBg }}
      >
      <div
        className="min-h-[240px] pdf-hero"
        style={{
          background: BRAND.heroBg,
        }}
      >
        <div className="pdf-hero-inner mx-auto max-w-[1440px] px-5 py-4">
          <SummaryHeader
            orgName={org.name}
            backHref={backHref}
            taker={taker}
            test={test}
            report={report}
            orgSlug={org.slug}
            isPrintMode={isPrintMode}
          />

          {!isPrintMode ? (
            <div className="no-print mt-4 text-[12px] text-white/50">
              Database → {taker.fullName} →{" "}
              <span className="text-white">Internal Sales Report</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pdf-content-area bg-slate-100">
        <div className="pdf-content-inner mx-auto max-w-[1440px] px-5 pb-16 pt-5">
          <PdfSection>
            <div className="pdf-chart-grid grid gap-4 xl:grid-cols-[455px_455px_1fr]">
              <LadderPositionCard report={report} />
              <PillarScoresCard report={report} />
              <TierDistributionCard report={report} />
            </div>
          </PdfSection>

          <div
            className={`pdf-sections-grid mt-4 grid gap-4 items-start ${
              isPrintMode ? "" : "xl:grid-cols-[280px_minmax(0,1fr)]"
            }`}
          >
            {!isPrintMode ? (
              <div className="no-print xl:sticky xl:top-5">
                <ReportIndexCard sections={sections} />
              </div>
            ) : null}

            <div className="pdf-sections-list space-y-4">
              {sections.map((section) => (
                <PdfSection key={section.section_key} pageBreakBefore={false}>
                  <SectionRenderer section={section} />
                </PdfSection>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}