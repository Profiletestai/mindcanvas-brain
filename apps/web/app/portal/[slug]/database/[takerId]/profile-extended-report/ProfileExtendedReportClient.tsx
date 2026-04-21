//apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/ProfileExtendedReportClient.tsx
"use client";

import { useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type VisibilityTier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type BehaviourStyle = "A" | "B" | "C" | "D";

type ProfileExtendedBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  items?: Array<Record<string, any>>;
  transition?: string;
  meta?: Record<string, any>;
};

type ProfileExtendedPanel = {
  panel_key: string;
  title: string;
  blocks: ProfileExtendedBlock[];
  matched_rows?: Array<{
    id: string;
    priority: number;
    source_section_key: string;
    triggers: Record<string, any>;
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
    triggers: Record<string, any>;
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
  sections?: any[];
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

const SECTION_LABELS: Array<{ key: string; label: string }> = [
  { key: "result_at_a_glance", label: "Result at a glance" },
  { key: "what_this_tier_means", label: "What this tier means" },
  { key: "level_nuance", label: "Level nuance" },
  { key: "pillars_and_signals", label: "Pillars and signals" },
  { key: "behaviour_style", label: "Behaviour style" },
  { key: "strategic_priority_now", label: "Strategic priority now" },
  { key: "progression_roadmap", label: "Progression roadmap" },
];

function safeString(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNumber(v: any, fallback = 0): number {
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

function normalizeText(input: string) {
  return safeString(input)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    safeNumber((source as any)?.visibility, NaN),
    safeNumber((source as any)?.trust, NaN),
    safeNumber((source as any)?.authority, NaN),
    safeNumber((source as any)?.dominance, NaN),
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
    Invisible: safeNumber((counts as any)?.Invisible, 0),
    Emerging: safeNumber((counts as any)?.Emerging, 0),
    Established: safeNumber((counts as any)?.Established, 0),
    Magnetic: safeNumber((counts as any)?.Magnetic, 0),
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
      value: safeNumber((source as any)?.trust, 0),
      color: BRAND.green,
    },
    {
      key: "authority",
      label: "Authority",
      value: safeNumber((source as any)?.authority, 0),
      color: BRAND.red,
    },
    {
      key: "dominance",
      label: "Dominance",
      value: safeNumber((source as any)?.dominance, 0),
      color: BRAND.sky,
    },
    {
      key: "visibility",
      label: "Visibility",
      value: safeNumber((source as any)?.visibility, 0),
      color: BRAND.orange,
    },
  ];
}

function safeSectionId(sectionKey: any) {
  const raw = safeString(sectionKey);
  return raw ? raw.replace(/_/g, "-") : "section";
}

function normalizeSections(rawSections: any[]): ProfileExtendedSection[] {
  const out: ProfileExtendedSection[] = [];

  for (const section of rawSections || []) {
    const sectionKey = safeString(section?.section_key || section?.key);
    if (!sectionKey) continue;

    const panels: ProfileExtendedPanel[] = [];

    if (Array.isArray(section?.panels)) {
      for (const panel of section.panels) {
        const panelKey = safeString(panel?.panel_key || panel?.key || "panel");
        const title = safeString(panel?.title) || titleCase(panelKey);
        const blocks = Array.isArray(panel?.blocks) ? panel.blocks : [];

        if (!panelKey) continue;
        if (!blocks.length && !title) continue;

        panels.push({
          panel_key: panelKey,
          title,
          blocks,
          matched_rows: Array.isArray(panel?.matched_rows) ? panel.matched_rows : [],
        });
      }
    } else if (Array.isArray(section?.blocks)) {
      panels.push({
        panel_key: `${sectionKey}_legacy`,
        title: safeString(section?.title) || titleCase(sectionKey),
        blocks: section.blocks,
        matched_rows: [],
      });
    }

    if (!panels.length) continue;

    out.push({
      section_key: sectionKey,
      heading: safeString(section?.heading || section?.title) || titleCase(sectionKey),
      panels,
      matched_rows: Array.isArray(section?.matched_rows) ? section.matched_rows : [],
    });
  }

  return out;
}

function PdfSection({ children }: { children: ReactNode }) {
  return (
    <section data-pdf-section="true" style={{ pageBreakAfter: "always" }}>
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

function SummaryCallout({ summary }: { summary: string }) {
  return (
    <div
      className="rounded-xl bg-white px-4 py-4"
      style={{ outline: `1px solid ${BRAND.blue}` }}
    >
      <span className="font-semibold text-[#4F7DFF]">In short:</span>{" "}
      <span className="text-slate-950">{summary}</span>
    </div>
  );
}

function ItemGrid({ items }: { items: Array<Record<string, any>> }) {
  if (!items.length) return null;

  const looksLikeLevelItems = items.some(
    (item) =>
      item &&
      (item.level != null || item.market_position != null || item.immediate_focus != null)
  );

  if (looksLikeLevelItems) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl bg-white p-4"
            style={{ outline: `1px solid ${BRAND.border}` }}
          >
            {item.level != null ? (
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Level {item.level}
              </div>
            ) : null}

            {safeString(item.meaning) ? (
              <div className="mt-2 text-[16px] font-semibold text-slate-900">
                {safeString(item.meaning)}
              </div>
            ) : null}

            {safeString(item.market_position) ? (
              <div className="mt-3 text-[14px] leading-7 text-slate-700">
                <span className="font-semibold text-slate-900">Typical market position:</span>{" "}
                {safeString(item.market_position)}
              </div>
            ) : null}

            {safeString(item.immediate_focus) ? (
              <div className="mt-2 text-[14px] leading-7 text-slate-700">
                <span className="font-semibold text-slate-900">Immediate focus:</span>{" "}
                {safeString(item.immediate_focus)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, idx) => {
        const label = safeString(item.label || item.title || item.heading);
        const value =
          safeString(item.value) ||
          safeString(item.summary) ||
          safeString(item.text) ||
          safeString(item.description);

        return (
          <div
            key={idx}
            className="rounded-xl bg-white p-4"
            style={{ outline: `1px solid ${BRAND.border}` }}
          >
            {label ? (
              <div className="text-[15px] font-semibold leading-7 text-slate-900">{label}</div>
            ) : null}
            {value ? (
              <div className="mt-2 text-[14px] leading-7 text-slate-700">{value}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BlockRenderer({
  block,
  panelTitle,
}: {
  block: ProfileExtendedBlock;
  panelTitle: string;
}) {
  const title = safeString(block?.title);
  const summary = safeString(block?.short_summary);
  const paragraphs = Array.isArray(block?.paragraphs) ? block.paragraphs.map(safeString).filter(Boolean) : [];
  const bullets = Array.isArray(block?.bullets) ? block.bullets.map(safeString).filter(Boolean) : [];
  const items = Array.isArray(block?.items) ? block.items.filter((item) => item && typeof item === "object") : [];
  const transition = safeString(block?.transition);

  const showTitle =
    !!title && normalizeText(title) !== normalizeText(panelTitle);

  if (!title && !summary && !paragraphs.length && !bullets.length && !items.length && !transition) {
    return null;
  }

  return (
    <div className="space-y-4">
      {showTitle ? (
        <div className="text-[18px] font-semibold leading-7 text-slate-900">{title}</div>
      ) : null}

      {summary ? <SummaryCallout summary={summary} /> : null}

      {paragraphs.length ? (
        <div className="space-y-3 text-[15px] leading-7 text-slate-700">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      {bullets.length ? (
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}

      {items.length ? <ItemGrid items={items} /> : null}

      {transition ? (
        <div className="text-[12px] italic leading-4 text-slate-500">{transition}</div>
      ) : null}
    </div>
  );
}

function PanelCard({
  title,
  panel,
}: {
  title: string;
  panel?: ProfileExtendedPanel | null;
}) {
  const blocks = Array.isArray(panel?.blocks) ? panel!.blocks : [];

  return (
    <div
      className="rounded-2xl bg-slate-50 p-6"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[18px] font-semibold leading-7 text-slate-900">{title}</div>

      <div className="mt-4 space-y-5">
        {blocks.map((block, index) => (
          <BlockRenderer
            key={`${panel?.panel_key || "panel"}-${index}`}
            block={block}
            panelTitle={title}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryHeader({
  orgName,
  backHref,
  onDownload,
  taker,
  test,
  report,
}: {
  orgName: string;
  backHref: string;
  onDownload: () => void;
  taker: Props["taker"];
  test: Props["test"];
  report: ReportPayload;
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
        <Link href={backHref} className="text-sm text-white/80 underline">
          Back to test taker profile
        </Link>
      </div>

      <div>
        <div className="text-[26px] font-semibold leading-8 text-white">
          Profile Extended Report
        </div>
        <div className="mt-1 text-[10px] text-white/85">
          Internal-only extended interpretation layer for Visibility Ladder
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onDownload}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#050914]"
        >
          Download PDF
        </button>
      </div>

      <div
        className="rounded-[24px] bg-white p-5"
        style={{ outline: `1px solid ${BRAND.border}` }}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_620px]">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Internal Report
            </div>

            <div className="mt-4 text-[36px] font-semibold leading-10 text-slate-900">
              {taker.fullName}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill text="WhatsWhat Prime" />
              <Pill text="Visibility Ladder" />
            </div>

            <div className="mt-6 grid gap-2 text-[14px] text-slate-600">
              {taker.email ? <div>{taker.email}</div> : null}
              {taker.phone ? <div>{taker.phone}</div> : null}
              {test.name ? <div>{test.name}</div> : null}
              {taker.roleTitle ? <div>{taker.roleTitle}</div> : null}
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
            <StatCard label="Profile Style" value={style} />
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
      className="rounded-2xl bg-slate-50 p-4"
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

      {subValue ? <div className="mt-1 text-[8px] text-slate-500">{subValue}</div> : null}
    </div>
  );
}

function ReportIndexCard({
  sections,
}: {
  sections: ProfileExtendedSection[];
}) {
  const items = SECTION_LABELS.filter((item) =>
    sections.some((section) => section.section_key === item.key)
  );

  return (
    <div
      className="rounded-2xl bg-white p-5 shadow-sm"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Report Index
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item, idx) => (
          <a
            key={item.key}
            href={`#${safeSectionId(item.key)}`}
            className="block rounded-xl bg-slate-50 px-3 py-3 text-[14px] text-slate-950"
            style={{ outline: `1px solid ${BRAND.border}` }}
          >
            <span className="mr-2 text-slate-400">{idx + 1}.</span>
            {item.label}
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
      className="rounded-2xl bg-slate-50 p-5"
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
      className="rounded-2xl bg-slate-50 p-5"
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
      className="rounded-2xl bg-slate-50 p-5"
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

function SectionRenderer({ section }: { section: ProfileExtendedSection }) {
  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        {section.panels.map((panel) => (
          <PanelCard key={panel.panel_key} title={panel.title} panel={panel} />
        ))}
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo(
    () => normalizeSections(report.sections || []),
    [report.sections]
  );

  async function downloadPdf() {
    try {
      const root = rootRef.current;
      if (!root) return;

      const sectionNodes = Array.from(
        root.querySelectorAll("[data-pdf-section='true']")
      ) as HTMLDivElement[];

      if (!sectionNodes.length) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

      const pdf = new JsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      for (let i = 0; i < sectionNodes.length; i += 1) {
        const node = sectionNodes[i];
        const canvas = await html2canvas(node, {
          backgroundColor: "#F1F5F9",
          scale: 2,
          useCORS: true,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }

      const safeName = `${taker.fullName || "profile"}-profile-extended-report.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );
      pdf.save(safeName);
    } catch (e) {
      console.error("[profile-extended] pdf export failed", e);
      alert("PDF export failed.");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: BRAND.pageBg }}>
      <div
        className="min-h-[240px]"
        style={{
          background: BRAND.heroBg,
        }}
      >
        <div className="mx-auto max-w-[1440px] px-5 py-4">
          <SummaryHeader
            orgName={org.name}
            backHref={backHref}
            onDownload={downloadPdf}
            taker={taker}
            test={test}
            report={report}
          />

          <div className="mt-4 text-[12px] text-white/50">
            Database → {taker.fullName} →{" "}
            <span className="text-white">Profile Extended Report</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-100">
        <div ref={rootRef} className="mx-auto max-w-[1440px] px-5 pb-16 pt-5">
          <PdfSection>
            <div className="grid gap-4 xl:grid-cols-[455px_455px_1fr]">
              <LadderPositionCard report={report} />
              <PillarScoresCard report={report} />
              <TierDistributionCard report={report} />
            </div>
          </PdfSection>

          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] items-start">
            <div className="xl:sticky xl:top-5">
              <ReportIndexCard sections={sections} />
            </div>

            <div className="space-y-4">
              {sections.map((section) => (
                <PdfSection key={section.section_key}>
                  <SectionRenderer section={section} />
                </PdfSection>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}