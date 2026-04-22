//apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/ProfileExtendedReportClient.tsx
"use client";

import { useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type VisibilityTier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type BehaviourStyle = "A" | "B" | "C" | "D";

type ProfileExtendedPanel = {
  panel_key: string;
  title: string;
  blocks: Array<Record<string, any>>;
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
  text: "#334155",
  textSoft: "#64748B",
  title: "#0F172A",
  surface: "#F8FAFC",
  white: "#FFFFFF",
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
  const counts = report?.graphs?.tier_counts || report?.input?.tier_counts || {};
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

function safeSectionId(sectionKey: unknown) {
  const raw = safeString(sectionKey);
  return raw ? raw.replace(/_/g, "-") : "section";
}

function normalizeSections(rawSections: any[]): ProfileExtendedSection[] {
  const mapped: Array<ProfileExtendedSection | null> = (rawSections || []).map((section: any) => {
    const sectionKey = safeString(section?.section_key || section?.key);
    if (!sectionKey) return null;

    let panels: ProfileExtendedPanel[] = [];

    if (Array.isArray(section?.panels)) {
      panels = section.panels
        .map((panel: any): ProfileExtendedPanel | null => {
          const panelKey = safeString(panel?.panel_key || panel?.key || "panel");
          const title = safeString(panel?.title) || titleCase(panelKey);
          const blocks = Array.isArray(panel?.blocks) ? panel.blocks : [];

          if (!panelKey) return null;

          return {
            panel_key: panelKey,
            title,
            blocks,
            matched_rows: Array.isArray(panel?.matched_rows) ? panel.matched_rows : [],
          };
        })
        .filter((panel: ProfileExtendedPanel | null): panel is ProfileExtendedPanel => panel !== null);
    } else if (Array.isArray(section?.blocks)) {
      panels = [
        {
          panel_key: `${sectionKey}_legacy`,
          title: safeString(section?.title) || titleCase(sectionKey),
          blocks: section.blocks,
          matched_rows: [],
        },
      ];
    }

    return {
      section_key: sectionKey,
      heading: safeString(section?.heading || section?.title) || titleCase(sectionKey),
      panels,
      matched_rows: Array.isArray(section?.matched_rows) ? section.matched_rows : [],
    };
  });

  return mapped.filter(
    (section): section is ProfileExtendedSection =>
      section !== null && !!section.section_key && Array.isArray(section.panels)
  );
}

function getSection(
  sections: ProfileExtendedSection[],
  key: string
): ProfileExtendedSection | null {
  return sections.find((section) => section.section_key === key) || null;
}

function getPanel(
  section: ProfileExtendedSection | null | undefined,
  panelKey: string
): ProfileExtendedPanel | null {
  if (!section) return null;
  return section.panels.find((panel) => panel.panel_key === panelKey) || null;
}

function getBlockTitle(block: Record<string, any> | undefined) {
  return (
    safeString(block?.title) ||
    safeString(block?.heading) ||
    safeString(block?.subheading) ||
    ""
  );
}

function getBlockSummary(block: Record<string, any> | undefined) {
  return (
    safeString(block?.short_summary) ||
    safeString(block?.summary) ||
    ""
  );
}

function getBlockParagraphs(block: Record<string, any> | undefined): string[] {
  const paragraphs = Array.isArray(block?.paragraphs) ? block?.paragraphs : [];
  return paragraphs.map((p: unknown) => safeString(p)).filter(Boolean);
}

function getBlockBullets(block: Record<string, any> | undefined): string[] {
  const bullets = Array.isArray(block?.bullets) ? block?.bullets : [];
  return bullets.map((b: unknown) => safeString(b)).filter(Boolean);
}

function getBlockItems(block: Record<string, any> | undefined): Array<Record<string, any>> {
  const items = Array.isArray(block?.items) ? block?.items : [];
  return items.filter((item: unknown) => item && typeof item === "object") as Array<Record<string, any>>;
}

function getPanelSummary(panel?: ProfileExtendedPanel | null): string {
  if (!panel) return "";
  for (const block of panel.blocks) {
    const summary = getBlockSummary(block);
    if (summary) return summary;
  }
  return "";
}

function getPanelParagraphs(panel?: ProfileExtendedPanel | null): string[] {
  if (!panel) return [];
  const out: string[] = [];
  for (const block of panel.blocks) {
    out.push(...getBlockParagraphs(block));
  }
  return out;
}

function getPanelBullets(panel?: ProfileExtendedPanel | null): string[] {
  if (!panel) return [];
  const out: string[] = [];
  for (const block of panel.blocks) {
    out.push(...getBlockBullets(block));
  }
  return out;
}

function getPanelItems(panel?: ProfileExtendedPanel | null): Array<Record<string, any>> {
  if (!panel) return [];
  const out: Array<Record<string, any>> = [];
  for (const block of panel.blocks) {
    out.push(...getBlockItems(block));
  }
  return out;
}

function PdfSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-pdf-section="true" className={className} style={{ pageBreakAfter: "always" }}>
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

function SoftPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl bg-slate-50 p-6"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[18px] font-semibold leading-7 text-slate-900">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SummaryBox({ text }: { text: string }) {
  if (!safeString(text)) return null;

  return (
    <div
      className="rounded-xl bg-white px-4 py-4"
      style={{ outline: `1px solid ${BRAND.blue}` }}
    >
      <span className="font-semibold text-[#4F7DFF]">In short:</span>{" "}
      <span className="text-slate-950">{text}</span>
    </div>
  );
}

function ParagraphStack({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <div className="space-y-3 text-[15px] leading-7 text-slate-700">
      {items.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function BulletStack({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

function DescriptorRows({
  blocks,
}: {
  blocks: Array<Record<string, any>>;
}) {
  const rows = blocks
    .map((block) => ({
      title: getBlockTitle(block),
      summary: getBlockSummary(block),
      paragraphs: getBlockParagraphs(block),
      bullets: getBlockBullets(block),
    }))
    .filter(
      (row) =>
        row.title || row.summary || row.paragraphs.length > 0 || row.bullets.length > 0
    );

  if (!rows.length) return null;

  return (
    <div className="space-y-5">
      {rows.map((row, idx) => (
        <div key={`${row.title}-${idx}`} className="space-y-3">
          {row.title ? (
            <div className="text-[15px] font-semibold leading-7 text-slate-900">
              {row.title}
            </div>
          ) : null}
          {row.summary ? <SummaryBox text={row.summary} /> : null}
          {row.paragraphs.length ? <ParagraphStack items={row.paragraphs} /> : null}
          {row.bullets.length ? <BulletStack items={row.bullets} /> : null}
        </div>
      ))}
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
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: dotColor }} />
        ) : null}
        <div className="text-[25px] font-semibold leading-7 text-slate-950">{value}</div>
      </div>

      {subValue ? <div className="mt-1 text-[10px] text-slate-500">{subValue}</div> : null}
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
  const readiness = readinessLabel(report?.signals?.readiness ?? report?.input?.readiness);
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

function ReportIndexCard({ sections }: { sections: ProfileExtendedSection[] }) {
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
  const ordered: VisibilityTier[] = ["Invisible", "Emerging", "Established", "Magnetic"];

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
                <div className={`text-[14px] ${passed ? "line-through" : ""}`} style={{ color }}>
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

function ResultAtAGlanceSection({
  section,
}: {
  section: ProfileExtendedSection;
}) {
  const panel = getPanel(section, "plain_english_summary") || section.panels[0] || null;
  const summary = getPanelSummary(panel);
  const paragraphs = getPanelParagraphs(panel);

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <SoftPanel title={panel?.title || "Plain-English summary"}>
        <div className="space-y-4">
          {summary ? <SummaryBox text={summary} /> : null}
          {paragraphs.length ? <ParagraphStack items={paragraphs} /> : null}
        </div>
      </SoftPanel>
    </WhiteCard>
  );
}

function WhatThisTierMeansSection({
  section,
}: {
  section: ProfileExtendedSection;
}) {
  const coreDiagnosis = getPanel(section, "core_diagnosis");
  const marketHappening = getPanel(section, "market_happening");
  const coreReading = getPanel(section, "core_reading");

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        <SoftPanel title={coreDiagnosis?.title || "Core diagnosis"}>
          <DescriptorRows blocks={coreDiagnosis?.blocks || []} />
        </SoftPanel>

        <SoftPanel title={marketHappening?.title || "What is likely happening in the market"}>
          <DescriptorRows blocks={marketHappening?.blocks || []} />
        </SoftPanel>

        <SoftPanel title={coreReading?.title || "Core reading"}>
          <DescriptorRows blocks={coreReading?.blocks || []} />
        </SoftPanel>
      </div>
    </WhiteCard>
  );
}

function LevelMeaningCallout({ item }: { item: Record<string, any> }) {
  const level = safeNumber(item?.level, 0);
  const marketPosition = safeString(item?.market_position);
  const immediateFocus = safeString(item?.immediate_focus);

  if (!level && !marketPosition && !immediateFocus) return null;

  return (
    <div
      className="max-w-[420px] rounded-xl bg-white px-5 py-4"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Level {level}
      </div>
      {marketPosition ? (
        <div className="mt-3 text-[15px] leading-7 text-slate-700">
          <span className="font-semibold text-slate-900">Typical market position:</span>{" "}
          {marketPosition}
        </div>
      ) : null}
      {immediateFocus ? (
        <div className="mt-1 text-[15px] leading-7 text-slate-700">
          <span className="font-semibold text-slate-900">Immediate focus:</span>{" "}
          {immediateFocus}
        </div>
      ) : null}
    </div>
  );
}

function LevelNuanceSection({
  section,
}: {
  section: ProfileExtendedSection;
}) {
  const levelMeaning = getPanel(section, "level_meaning");
  const meaningInPractice = getPanel(section, "meaning_in_practice");

  const levelItems = getPanelItems(levelMeaning);

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        <SoftPanel title={levelMeaning?.title || "Level meaning"}>
          <div className="space-y-4">
            <DescriptorRows blocks={levelMeaning?.blocks || []} />
            {levelItems.length ? <LevelMeaningCallout item={levelItems[0]} /> : null}
          </div>
        </SoftPanel>

        <SoftPanel title={meaningInPractice?.title || "Meaning in practice"}>
          <DescriptorRows blocks={meaningInPractice?.blocks || []} />
        </SoftPanel>
      </div>
    </WhiteCard>
  );
}

function SignalCard({
  title,
  value,
  color,
  description,
}: {
  title: string;
  value: number;
  color: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl bg-white p-4"
      style={{ outline: `1px solid ${color}` }}
    >
      <div className="text-[15px] font-bold leading-7" style={{ color }}>
        {title}
      </div>
      <div className="mt-3 text-[32px] font-bold leading-8" style={{ color }}>
        {value}%
      </div>
      <div className="mt-4 text-[15px] leading-7 text-slate-700">{description}</div>
    </div>
  );
}

function FrameworkStageCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      className="rounded-xl bg-white p-4"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[15px] font-semibold leading-7 text-slate-900">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.map((row, idx) => (
          <div key={`${title}-${row.label}-${idx}`}>
            <div className="text-[14px] font-semibold leading-5 text-slate-900">
              {row.label}
            </div>
            <div className="mt-1 text-[14px] leading-6 text-slate-600">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PillarsAndSignalsSection({
  section,
  report,
}: {
  section: ProfileExtendedSection;
  report: ReportPayload;
}) {
  const currentSignal = getPanel(section, "current_signal_pattern");
  const widerSignal = getPanel(section, "wider_signal_pathway");
  const progressionPattern = getPanel(section, "progression_pattern");
  const pillars = getPillarItems(report);

  const descriptions: Record<string, string> = {
    trust: "This reflects whether the business feels credible and proven once found.",
    authority: "This reflects whether the business is seen as a clear expert rather than just capable.",
    dominance: "This suggests how strongly the business is beginning to lead attention and preference in the market.",
    visibility: "This is about how reliably the market can find and recognise the business.",
  };

  const widerBlocks = widerSignal?.blocks || [];
  const introBlock = widerBlocks.find(
    (block) => getBlockTitle(block).toLowerCase().includes("wider signal pathway")
  );
  const stageBlocks = widerBlocks.filter((block) => getBlockItems(block).length > 0);

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        <SoftPanel title={currentSignal?.title || "Current signal pattern"}>
          <div className="space-y-5">
            <DescriptorRows blocks={currentSignal?.blocks || []} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pillars.map((pillar) => (
                <SignalCard
                  key={pillar.key}
                  title={pillar.label}
                  value={pillar.value}
                  color={pillar.color}
                  description={descriptions[pillar.key] || ""}
                />
              ))}
            </div>
          </div>
        </SoftPanel>

        <SoftPanel title={widerSignal?.title || "The wider signal pathway"}>
          <div className="space-y-5">
            {introBlock ? <SummaryBox text={getBlockSummary(introBlock)} /> : null}

            {progressionPattern ? (
              <DescriptorRows blocks={progressionPattern.blocks || []} />
            ) : null}

            {stageBlocks.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {stageBlocks.map((block, idx) => (
                  <FrameworkStageCard
                    key={`${getBlockTitle(block)}-${idx}`}
                    title={getBlockTitle(block)}
                    rows={getBlockItems(block).map((item) => ({
                      label: safeString(item?.label),
                      value: safeString(item?.value),
                    }))}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </SoftPanel>
      </div>
    </WhiteCard>
  );
}

function BehaviourCard({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div
      className="rounded-xl bg-white p-4"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[15px] font-bold leading-7 text-slate-900">{title}</div>
      <div className="mt-3 text-[15px] leading-7 text-slate-700">{summary}</div>
    </div>
  );
}

function BehaviourStyleSection({
  section,
}: {
  section: ProfileExtendedSection;
}) {
  const typeInterpretation = getPanel(section, "type_interpretation");
  const howToUse = getPanel(section, "how_to_use_this_layer");

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        <SoftPanel title={typeInterpretation?.title || "Type interpretation"}>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              {(typeInterpretation?.blocks || []).map((block, idx) => (
                <BehaviourCard
                  key={`${getBlockTitle(block)}-${idx}`}
                  title={getBlockTitle(block)}
                  summary={getBlockSummary(block)}
                />
              ))}
            </div>
          </div>
        </SoftPanel>

        <SoftPanel title={howToUse?.title || "How to use this layer"}>
          <DescriptorRows blocks={howToUse?.blocks || []} />
        </SoftPanel>
      </div>
    </WhiteCard>
  );
}

function StrategicPrioritySection({
  section,
}: {
  section: ProfileExtendedSection;
}) {
  const focusPanel = getPanel(section, "what_to_focus_on_now") || section.panels[0] || null;

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <SoftPanel title={focusPanel?.title || "What to focus on now"}>
        <DescriptorRows blocks={focusPanel?.blocks || []} />
      </SoftPanel>
    </WhiteCard>
  );
}

function ProgressionRoadmapSection({
  section,
}: {
  section: ProfileExtendedSection;
}) {
  const nextPanel = getPanel(section, "what_progression_looks_like_next");
  const readinessPanel = getPanel(section, "how_to_recognise_readiness");

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        <SoftPanel title={nextPanel?.title || "What progression looks like next"}>
          <DescriptorRows blocks={nextPanel?.blocks || []} />
        </SoftPanel>

        <SoftPanel title={readinessPanel?.title || "How to recognise readiness"}>
          <DescriptorRows blocks={readinessPanel?.blocks || []} />
        </SoftPanel>
      </div>
    </WhiteCard>
  );
}

function SectionRenderer({
  section,
  report,
}: {
  section: ProfileExtendedSection;
  report: ReportPayload;
}) {
  if (section.section_key === "result_at_a_glance") {
    return <ResultAtAGlanceSection section={section} />;
  }

  if (section.section_key === "what_this_tier_means") {
    return <WhatThisTierMeansSection section={section} />;
  }

  if (section.section_key === "level_nuance") {
    return <LevelNuanceSection section={section} />;
  }

  if (section.section_key === "pillars_and_signals") {
    return <PillarsAndSignalsSection section={section} report={report} />;
  }

  if (section.section_key === "behaviour_style") {
    return <BehaviourStyleSection section={section} />;
  }

  if (section.section_key === "strategic_priority_now") {
    return <StrategicPrioritySection section={section} />;
  }

  if (section.section_key === "progression_roadmap") {
    return <ProgressionRoadmapSection section={section} />;
  }

  return (
    <WhiteCard id={safeSectionId(section.section_key)} title={section.heading}>
      <div className="space-y-5">
        {section.panels.map((panel) => (
          <SoftPanel key={panel.panel_key} title={panel.title}>
            <DescriptorRows blocks={panel.blocks || []} />
          </SoftPanel>
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

            <div className="mt-4 xl:hidden">
              <ReportIndexCard sections={sections} />
            </div>
          </PdfSection>

          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] items-start">
            <div className="hidden xl:block xl:sticky xl:top-5">
              <ReportIndexCard sections={sections} />
            </div>

            <div className="space-y-4">
              {sections.map((section) => (
                <PdfSection key={section.section_key}>
                  <SectionRenderer section={section} report={report} />
                </PdfSection>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}