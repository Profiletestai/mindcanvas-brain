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
  const counts = report?.graphs?.tier_counts || report?.input?.tier_counts || {};
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
  return (rawSections || [])
    .map((section): ProfileExtendedSection | null => {
      const rawSection = (section || {}) as Record<string, unknown>;
      const sectionKey = safeString(rawSection.section_key || rawSection.key);
      if (!sectionKey) return null;

      let panels: ProfileExtendedPanel[] = [];

      if (Array.isArray(rawSection.panels)) {
        panels = rawSection.panels
          .map((panel): ProfileExtendedPanel | null => {
            const rawPanel = (panel || {}) as Record<string, unknown>;
            const panelKey = safeString(rawPanel.panel_key || rawPanel.key || "panel");
            if (!panelKey) return null;

            return {
              panel_key: panelKey,
              title: safeString(rawPanel.title) || titleCase(panelKey),
              blocks: Array.isArray(rawPanel.blocks)
                ? (rawPanel.blocks as ProfileExtendedBlock[])
                : [],
              matched_rows: Array.isArray(rawPanel.matched_rows)
                ? (rawPanel.matched_rows as ProfileExtendedPanel["matched_rows"])
                : [],
            };
          })
          .filter((panel): panel is ProfileExtendedPanel => panel !== null);
      } else if (Array.isArray(rawSection.blocks)) {
        panels = [
          {
            panel_key: `${sectionKey}_legacy`,
            title: safeString(rawSection.title) || titleCase(sectionKey),
            blocks: rawSection.blocks as ProfileExtendedBlock[],
            matched_rows: [],
          },
        ];
      }

      return {
        section_key: sectionKey,
        heading:
          safeString(rawSection.heading || rawSection.title) || titleCase(sectionKey),
        panels,
        matched_rows: Array.isArray(rawSection.matched_rows)
          ? (rawSection.matched_rows as ProfileExtendedSection["matched_rows"])
          : [],
      };
    })
    .filter((section): section is ProfileExtendedSection => section !== null);
}

function collectSummary(panel?: ProfileExtendedPanel | null) {
  if (!panel) return "";
  for (const block of panel.blocks || []) {
    const value = safeString(block.short_summary);
    if (value) return value;
  }
  return "";
}

function collectParagraphs(panel?: ProfileExtendedPanel | null) {
  if (!panel) return [] as string[];
  const out: string[] = [];
  for (const block of panel.blocks || []) {
    const paragraphs = Array.isArray(block.paragraphs) ? block.paragraphs : [];
    for (const paragraph of paragraphs) {
      const value = safeString(paragraph);
      if (value) out.push(value);
    }
  }
  return out;
}

function collectBullets(panel?: ProfileExtendedPanel | null) {
  if (!panel) return [] as string[];
  const out: string[] = [];
  for (const block of panel.blocks || []) {
    const bullets = Array.isArray(block.bullets) ? block.bullets : [];
    for (const bullet of bullets) {
      const value = safeString(bullet);
      if (value) out.push(value);
    }
  }
  return out;
}

function collectItems(panel?: ProfileExtendedPanel | null) {
  if (!panel) return [] as Array<Record<string, unknown>>;
  const out: Array<Record<string, unknown>> = [];
  for (const block of panel.blocks || []) {
    const items = Array.isArray(block.items) ? block.items : [];
    for (const item of items) {
      if (item && typeof item === "object") out.push(item);
    }
  }
  return out;
}

function collectTransition(panel?: ProfileExtendedPanel | null) {
  if (!panel) return "";
  for (const block of panel.blocks || []) {
    const value = safeString(block.transition);
    if (value) return value;
  }
  return "";
}

function isLanguagePanel(panelKey: string) {
  return panelKey === "words_to_use" || panelKey === "words_not_to_use";
}

function isPersonalityPanel(panelKey: string) {
  return (
    panelKey === "personality_sales_profile" ||
    panelKey === "words_to_use" ||
    panelKey === "words_not_to_use"
  );
}

function isCallPanel(panelKey: string) {
  return (
    panelKey === "what_not_to_do_on_call" ||
    panelKey === "what_to_do_on_call" ||
    panelKey === "objections" ||
    panelKey === "close_line"
  );
}

function formatItemLabel(rawKey: string) {
  return titleCase(rawKey);
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

function PanelShell({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl bg-slate-50 p-6"
      style={{
        outline: `1px solid ${BRAND.border}`,
        borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
      }}
    >
      <div className="text-[18px] font-semibold leading-7 text-slate-900">{title}</div>
      {children}
    </div>
  );
}

function PanelCard({
  panel,
}: {
  panel: ProfileExtendedPanel;
}) {
  const summary = collectSummary(panel);
  const paragraphs = collectParagraphs(panel);
  const bullets = collectBullets(panel);
  const items = collectItems(panel);
  const transition = collectTransition(panel);

  const accentColor = isPersonalityPanel(panel.panel_key)
    ? BRAND.purple
    : isCallPanel(panel.panel_key)
      ? BRAND.blue
      : BRAND.blue;

  return (
    <PanelShell title={panel.title} accentColor={accentColor}>
      {summary ? (
        <div
          className="mt-4 rounded-xl bg-white px-4 py-4"
          style={{ outline: `1px solid ${accentColor}` }}
        >
          <span className="font-semibold" style={{ color: accentColor }}>
            In short:
          </span>{" "}
          <span className="text-slate-950">{summary}</span>
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
        isLanguagePanel(panel.panel_key) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {bullets.map((bullet, i) => (
              <span
                key={i}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{
                  background:
                    panel.panel_key === "words_not_to_use"
                      ? "rgba(226, 75, 74, 0.10)"
                      : "rgba(79, 125, 255, 0.10)",
                  color: panel.panel_key === "words_not_to_use" ? BRAND.red : BRAND.blue,
                  outline: `1px solid ${
                    panel.panel_key === "words_not_to_use"
                      ? "rgba(226, 75, 74, 0.25)"
                      : "rgba(79, 125, 255, 0.25)"
                  }`,
                }}
              >
                {bullet}
              </span>
            ))}
          </div>
        ) : (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700">
            {bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        )
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item, idx) => {
            const entries = Object.entries(item)
              .map(([key, value]) => [formatItemLabel(key), safeString(value)] as const)
              .filter(([, value]) => value);

            if (!entries.length) return null;

            return (
              <div
                key={idx}
                className="rounded-xl bg-white p-4"
                style={{ outline: `1px solid ${BRAND.border}` }}
              >
                <div className="space-y-2">
                  {entries.map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {label}
                      </div>
                      <div className="mt-1 text-[14px] leading-6 text-slate-800">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
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
    </PanelShell>
  );
}

function SummaryHeader({
  orgName,
  backHref,
  onDownload,
  taker,
  report,
}: {
  orgName: string;
  backHref: string;
  onDownload: () => void;
  taker: Props["taker"];
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
              <Pill text={`Style ${style}`} />
            </div>

            <div className="mt-6 grid gap-2 text-[14px] text-slate-600">
              {taker.email ? <div>{taker.email}</div> : null}
              {taker.phone ? <div>{taker.phone}</div> : null}
              {taker.company ? <div>{taker.company}</div> : null}
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
  return (
    <div
      className="rounded-2xl bg-white p-5 shadow-sm"
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
      className="rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Ladder Position
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
          <PanelCard key={panel.panel_key} panel={panel} />
        ))}
      </div>
    </WhiteCard>
  );
}

function buildCardRanges(
  heights: number[],
  startIndex: number,
  maxHeight: number,
  gap: number
) {
  let used = 0;
  let endIndex = startIndex;

  while (endIndex < heights.length) {
    const extra = endIndex > startIndex ? gap : 0;
    const nextHeight = heights[endIndex] + extra;

    if (endIndex > startIndex && used + nextHeight > maxHeight) {
      break;
    }

    if (endIndex === startIndex && nextHeight > maxHeight) {
      endIndex += 1;
      break;
    }

    used += nextHeight;
    endIndex += 1;
  }

  return endIndex;
}

export default function ProfileExtendedReportClient({
  org,
  taker,
  test,
  report,
  backHref,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo(
    () => normalizeSections(Array.isArray(report.sections) ? report.sections : []),
    [report.sections]
  );

  async function downloadPdf() {
    const root = rootRef.current;
    const headerNode = headerRef.current;
    const overviewNode = overviewRef.current;
    const indexNode = indexRef.current;

    if (!root || !headerNode || !overviewNode || !indexNode) return;

    const cardNodes = Array.from(
      root.querySelectorAll("[data-export-card='true']")
    ) as HTMLElement[];

    if (!cardNodes.length) return;

    let stage: HTMLDivElement | null = null;

    try {
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

      const pdf = new JsPDF("p", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const marginPt = 20;
      const printableWidthPt = pdfWidth - marginPt * 2;
      const printableHeightPt = pdfHeight - marginPt * 2;

      const exportWidthPx = Math.max(root.scrollWidth, 1480);
      const pageHeightPx = Math.floor(
        (printableHeightPt / printableWidthPt) * exportWidthPx
      );

      const bodyPaddingPx = 20;
      const pageGapPx = 16;
      const cardGapPx = 16;

      const cardHeights = cardNodes.map((node) => Math.ceil(node.offsetHeight));
      const headerHeight = Math.ceil(headerNode.offsetHeight);
      const overviewHeight = Math.ceil(overviewNode.offsetHeight);
      const indexHeight = Math.ceil(indexNode.offsetHeight);

      const cloneStatic = (node: HTMLElement) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.style.position = "static";
        clone.style.top = "auto";
        clone.style.left = "auto";
        clone.style.right = "auto";
        clone.style.bottom = "auto";
        clone.style.alignSelf = "auto";
        return clone;
      };

      stage = document.createElement("div");
      stage.style.position = "fixed";
      stage.style.left = "-100000px";
      stage.style.top = "0";
      stage.style.width = `${exportWidthPx}px`;
      stage.style.background = "#F1F5F9";
      stage.style.pointerEvents = "none";
      stage.style.zIndex = "-1";
      document.body.appendChild(stage);

      const pageCanvases: HTMLCanvasElement[] = [];

      const firstPageAvailableForContent =
        pageHeightPx -
        headerHeight -
        overviewHeight -
        bodyPaddingPx * 2 -
        pageGapPx * 2;

      const firstPageAvailableForCards = Math.max(
        0,
        firstPageAvailableForContent
      );

      let firstPageEnd = buildCardRanges(
        cardHeights,
        0,
        firstPageAvailableForCards,
        cardGapPx
      );

      if (firstPageEnd < 1) firstPageEnd = 1;

      const firstPage = document.createElement("div");
      firstPage.style.width = `${exportWidthPx}px`;
      firstPage.style.background = BRAND.pageBg;
      firstPage.style.overflow = "hidden";

      firstPage.appendChild(headerNode.cloneNode(true));

      const firstPageBody = document.createElement("div");
      firstPageBody.style.background = "#F1F5F9";

      const firstPageInner = document.createElement("div");
      firstPageInner.style.maxWidth = "1440px";
      firstPageInner.style.margin = "0 auto";
      firstPageInner.style.padding = `${bodyPaddingPx}px`;
      firstPageInner.style.display = "grid";
      firstPageInner.style.rowGap = `${pageGapPx}px`;

      firstPageInner.appendChild(overviewNode.cloneNode(true));

      const firstRow = document.createElement("div");
      firstRow.style.display = "grid";
      firstRow.style.gridTemplateColumns = "280px minmax(0,1fr)";
      firstRow.style.columnGap = `${pageGapPx}px`;
      firstRow.style.alignItems = "start";

      firstRow.appendChild(cloneStatic(indexNode));

      const firstCardsCol = document.createElement("div");
      firstCardsCol.style.display = "grid";
      firstCardsCol.style.rowGap = `${cardGapPx}px`;

      for (let i = 0; i < firstPageEnd; i += 1) {
        firstCardsCol.appendChild(cardNodes[i].cloneNode(true));
      }

      firstRow.appendChild(firstCardsCol);
      firstPageInner.appendChild(firstRow);
      firstPageBody.appendChild(firstPageInner);
      firstPage.appendChild(firstPageBody);
      stage.appendChild(firstPage);

      const firstCanvas = await html2canvas(firstPage, {
        backgroundColor: "#F1F5F9",
        scale: 2,
        useCORS: true,
        windowWidth: exportWidthPx,
        windowHeight: firstPage.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });

      pageCanvases.push(firstCanvas);

      let startIndex = firstPageEnd;

      while (startIndex < cardNodes.length) {
        const page = document.createElement("div");
        page.style.width = `${exportWidthPx}px`;
        page.style.background = "#F1F5F9";

        const pageInner = document.createElement("div");
        pageInner.style.maxWidth = "1440px";
        pageInner.style.margin = "0 auto";
        pageInner.style.padding = `${bodyPaddingPx}px`;

        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "280px minmax(0,1fr)";
        row.style.columnGap = `${pageGapPx}px`;
        row.style.alignItems = "start";

        row.appendChild(cloneStatic(indexNode));

        const cardsCol = document.createElement("div");
        cardsCol.style.display = "grid";
        cardsCol.style.rowGap = `${cardGapPx}px`;

        const availableHeight = Math.max(0, pageHeightPx - bodyPaddingPx * 2);
        const endIndex = buildCardRanges(
          cardHeights,
          startIndex,
          availableHeight,
          cardGapPx
        );

        for (let i = startIndex; i < endIndex; i += 1) {
          cardsCol.appendChild(cardNodes[i].cloneNode(true));
        }

        row.appendChild(cardsCol);
        pageInner.appendChild(row);
        page.appendChild(pageInner);
        stage.appendChild(page);

        const canvas = await html2canvas(page, {
          backgroundColor: "#F1F5F9",
          scale: 2,
          useCORS: true,
          windowWidth: exportWidthPx,
          windowHeight: page.scrollHeight,
          scrollX: 0,
          scrollY: 0,
        });

        pageCanvases.push(canvas);
        startIndex = endIndex;
      }

      pageCanvases.forEach((canvas, idx) => {
        const imgData = canvas.toDataURL("image/png");
        const imgWidthPt = printableWidthPt;
        const imgHeightPt = (canvas.height * imgWidthPt) / canvas.width;

        if (idx > 0) pdf.addPage();

        pdf.addImage(
          imgData,
          "PNG",
          marginPt,
          marginPt,
          imgWidthPt,
          imgHeightPt,
          undefined,
          "FAST"
        );
      });

      const safeName = `${taker.fullName || "profile"}-profile-extended-report.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );

      pdf.save(safeName);
    } catch (e) {
      console.error("[profile-extended] pdf export failed", e);
      alert("PDF export failed.");
    } finally {
      if (stage && stage.parentNode) {
        stage.parentNode.removeChild(stage);
      }
    }
  }

  return (
    <div className="min-h-screen" style={{ background: BRAND.pageBg }}>
      <div ref={rootRef}>
        <div
          ref={headerRef}
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
              report={report}
            />

            <div className="mt-4 text-[12px] text-white/50">
              Database → {taker.fullName} →{" "}
              <span className="text-white">Profile Extended Report</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-100">
          <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-5">
            <div ref={overviewRef}>
              <div className="grid gap-4 xl:grid-cols-[455px_455px_1fr]">
                <LadderPositionCard report={report} />
                <PillarScoresCard report={report} />
                <TierDistributionCard report={report} />
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] items-start">
              <div ref={indexRef} className="xl:sticky xl:top-5">
                <ReportIndexCard sections={sections} />
              </div>

              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.section_key} data-export-card="true">
                    <SectionRenderer section={section} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}