//apps/web/components/visibility/profile-extended/ProfileExtendedReportClient.tsx
"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type ReportBlock = {
  heading?: string;
  title?: string;
  short_summary?: string;
  summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  transition?: string;
  [key: string]: any;
};

type ReportSection = {
  section_key: string;
  heading?: string | null;
  subheading?: string | null;
  blocks?: ReportBlock[];
  matched_rows?: Array<Record<string, any>>;
};

type ReportPayload = {
  audience?: string;
  token?: string;
  tid?: string | null;
  sid?: string | null;
  submission_id?: string | null;
  engine_key?: string;
  version?: number;
  meta?: Record<string, any> | null;
  signals?: {
    tier?: string;
    level?: number;
    style?: string;
    readiness?: string | null;
    overall_pct?: number | null;
    pillar_scores?: Record<string, number> | null;
    weakest_pillar?: string | null;
    strongest_pillar?: string | null;
  } | null;
  graphs?: {
    tier_counts?: Record<string, number> | null;
    pillars?: Record<string, number> | null;
    pillar_bands?: Record<string, string> | null;
  } | null;
  input?: {
    tier?: string;
    level?: number;
    behaviour_style?: string;
    readiness?: string | null;
    pillar_scores?: Record<string, number> | null;
  } | null;
  sections?: ReportSection[];
};

type Props = {
  orgSlug: string;
  orgName: string;
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

type PillarItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  blurb: string;
};

const BRAND = {
  pageBg: "#050914",
  shellBg:
    "radial-gradient(ellipse 83.33% 66.67% at 50% -10%, #113149 0%, #08121B 55%, #060E16 100%)",
  white: "#FFFFFF",
  text: "#0F172A",
  textSoft: "#334155",
  textMuted: "#64748B",
  border: "#E2E8F0",
  panel: "#F8FAFC",
  blue: "#4F7DFF",
  purple: "#8B5CF6",
  teal: "#32D7C8",
  green: "#0FCD5E",
  red: "#E24B4A",
  orange: "#EF9F27",
  sky: "#4A9EDD",
} as const;

const TIER_ORDER = ["Invisible", "Emerging", "Established", "Magnetic"] as const;

const STYLE_META: Record<
  string,
  {
    label: string;
    title: string;
    strengths: string;
    risk: string;
    worksBest: string;
  }
> = {
  A: {
    label: "Type A",
    title: "Vision Driven Initiator",
    strengths: "Momentum, visibility comfort, experimentation.",
    risk: "Scaling exposure before structure.",
    worksBest: "Direct growth goals, fast action, proof-backed authority building.",
  },
  B: {
    label: "Type B",
    title: "Relationship Driven Communicator",
    strengths: "Connection building, trust generation, warm audience growth.",
    risk: "Overextending energy across too many relationship channels.",
    worksBest: "Partnerships, community-led authority, trust-first visibility systems.",
  },
  C: {
    label: "Type C",
    title: "Structure Driven Optimiser",
    strengths: "Consistency, systems thinking, operational credibility.",
    risk: "Over-refining structure before enough market signal is visible.",
    worksBest: "Clear sequencing, process-led growth, disciplined signal strengthening.",
  },
  D: {
    label: "Type D",
    title: "Control Driven Authority Builder",
    strengths: "Standards, decisiveness, authority protection.",
    risk: "Pushing too hard on control before market trust catches up.",
    worksBest: "Authority positioning, sharp offers, disciplined category leadership.",
  },
};

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

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tierRange(tier: string) {
  if (tier === "Invisible") return "1–5";
  if (tier === "Emerging") return "6–10";
  if (tier === "Established") return "11–15";
  return "16–20";
}

function overallScore(report: ReportPayload) {
  const direct =
    safeNumber(report?.signals?.overall_pct, -1) >= 0
      ? safeNumber(report?.signals?.overall_pct, 0)
      : -1;

  if (direct >= 0) return direct;

  const source =
    report?.graphs?.pillars ||
    report?.signals?.pillar_scores ||
    report?.input?.pillar_scores ||
    {};

  const values = Object.values(source || {})
    .map((v) => safeNumber(v, 0))
    .filter((v) => Number.isFinite(v));

  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function getTier(report: ReportPayload) {
  return (
    safeString(report?.signals?.tier) ||
    safeString(report?.input?.tier) ||
    "Invisible"
  );
}

function getLevel(report: ReportPayload) {
  return clamp(
    safeNumber(report?.signals?.level ?? report?.input?.level, 1),
    1,
    20
  );
}

function getStyle(report: ReportPayload) {
  return (
    safeString(report?.signals?.style) ||
    safeString(report?.input?.behaviour_style) ||
    "A"
  ).toUpperCase();
}

function readinessLabel(value?: string | null) {
  const v = safeString(value).toLowerCase();
  if (v === "ready_to_progress") return "Ready to progress";
  if (v === "stabilise") return "Stabilise";
  return value ? titleCase(value) : "—";
}

function flattenBlocks(sections: ReportSection[] = []) {
  return sections.flatMap((section) =>
    (section.blocks || []).map((block) => ({
      ...block,
      __section_key: section.section_key,
      __section_heading: section.heading,
      __section_subheading: section.subheading,
    }))
  );
}

function blockHeading(block?: ReportBlock | null) {
  return safeString(block?.heading || block?.title);
}

function matchesHeading(block: ReportBlock | undefined, terms: string[]) {
  const h = blockHeading(block).toLowerCase();
  return terms.some((term) => h.includes(term.toLowerCase()));
}

function firstBlock(blocks: ReportBlock[], terms: string[]) {
  return blocks.find((b) => matchesHeading(b, terms));
}

function textFromBlock(block?: ReportBlock | null) {
  if (!block) return "";
  const short = safeString(block.short_summary || block.summary);
  if (short) return short;
  const para = (block.paragraphs || []).map(safeString).find(Boolean);
  if (para) return para;
  const bullet = (block.bullets || []).map(safeString).find(Boolean);
  if (bullet) return bullet;
  return "";
}

function paragraphsFromBlock(block?: ReportBlock | null) {
  if (!block) return [];
  return (block.paragraphs || []).map(safeString).filter(Boolean);
}

function bulletsFromBlock(block?: ReportBlock | null) {
  if (!block) return [];
  return (block.bullets || []).map(safeString).filter(Boolean);
}

function tailFromBlock(block?: ReportBlock | null) {
  return safeString(block?.transition);
}

function getPillarItems(report: ReportPayload): PillarItem[] {
  const source =
    report?.graphs?.pillars ||
    report?.signals?.pillar_scores ||
    report?.input?.pillar_scores ||
    {};

  const raw: Record<string, number> = {
    trust: safeNumber((source as any)?.trust, 0),
    authority: safeNumber((source as any)?.authority ?? (source as any)?.conversion, 0),
    dominance: safeNumber((source as any)?.dominance, 0),
    visibility: safeNumber((source as any)?.visibility ?? (source as any)?.discoverability, 0),
  };

  return [
    {
      key: "trust",
      label: "Trust",
      value: raw.trust,
      color: BRAND.green,
      blurb: "This reflects whether the business feels credible and proven once found.",
    },
    {
      key: "authority",
      label: "Authority",
      value: raw.authority,
      color: BRAND.red,
      blurb: "This reflects whether the business is seen as a clear expert rather than just capable.",
    },
    {
      key: "dominance",
      label: "Dominance",
      value: raw.dominance,
      color: BRAND.sky,
      blurb: "This suggests how strongly the business is beginning to lead attention and preference in the market.",
    },
    {
      key: "visibility",
      label: "Visibility",
      value: raw.visibility,
      color: BRAND.orange,
      blurb: "This is about how reliably the market can find and recognise the business.",
    },
  ];
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

function PdfSection({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      data-pdf-section="true"
      className="space-y-6"
      style={{ pageBreakAfter: "always" }}
    >
      {children}
    </section>
  );
}

function WhiteCard({
  title,
  children,
  subtitle,
  id,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="rounded-[24px] bg-white shadow-sm"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="px-8 py-6">
        <div className="text-[24px] font-semibold leading-8 text-slate-900">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-[13px] text-slate-500">{subtitle}</div>
        ) : null}
      </div>
      <div className="px-8 pb-8">{children}</div>
    </div>
  );
}

function SubPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl bg-slate-50 p-6"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[18px] font-semibold leading-7 text-slate-900">{title}</div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function InShort({
  text,
}: {
  text: string;
}) {
  if (!text) return null;
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

function ParagraphList({
  paragraphs,
}: {
  paragraphs: string[];
}) {
  const items = paragraphs.filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="space-y-3 text-[15px] leading-7 text-slate-700">
      {items.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function FooterNote({
  text,
}: {
  text?: string;
}) {
  if (!text) return null;
  return <div className="text-[12px] italic leading-4 text-slate-500">{text}</div>;
}

function InternalHeader({
  orgName,
  backHref,
  onDownload,
}: {
  orgName: string;
  backHref: string;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[20px] font-semibold text-white">{orgName || "whatswhat Prime"}</div>
        <Link href={backHref} className="text-sm text-white/80 underline">
          Back to admin
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {["Dashboard", "Database", "Tests", "Communications", "Profile Settings"].map((item) => {
          const active = item === "Database";
          return (
            <div
              key={item}
              className="rounded-md px-3 py-2 text-sm"
              style={{
                color: BRAND.white,
                background: active ? "#2D8FC4" : "transparent",
                outline: "1px solid rgba(229,231,235,0.55)",
                opacity: item === "Communications" ? 0.55 : 1,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[26px] font-semibold leading-8 text-white">
            Profile Extended Report
          </div>
          <div className="mt-1 text-[10px] text-white/85">
            Internal-only extended interpretation layer for Visibility Ladder
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDownload}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#050914]"
          >
            Download PDF
          </button>
          <Link
            href={backHref}
            className="rounded-md px-4 py-2 text-sm text-white"
            style={{ outline: "1px solid rgba(229,231,235,0.8)" }}
          >
            Back to test taker profile
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryHeaderCard({
  taker,
  testName,
  report,
}: {
  taker: Props["taker"];
  testName: string;
  report: ReportPayload;
}) {
  const tier = getTier(report);
  const level = getLevel(report);
  const style = getStyle(report);
  const readiness = readinessLabel(report?.signals?.readiness ?? report?.input?.readiness);
  const score = overallScore(report);

  return (
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
            {taker.email ? <ContactRow label={taker.email} /> : null}
            {taker.phone ? <ContactRow label={taker.phone} /> : null}
            {testName ? <ContactRow label={testName} /> : null}
            {taker.roleTitle ? <ContactRow label={taker.roleTitle} /> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="Tier"
            value={tier}
            dotColor={BRAND.purple}
            badge={tier === "Magnetic" ? "Top tier" : undefined}
            badgeColor={BRAND.purple}
          />
          <StatCard
            label="Level"
            value={`${level}`}
            subValue="of 20"
          />
          <StatCard
            label="Profile Style"
            value={style}
          />
          <StatCard
            label="Readiness"
            value={readiness}
            badge={`${score}% Score`}
            badgeColor={BRAND.green}
          />
        </div>
      </div>
    </div>
  );
}

function Pill({
  text,
}: {
  text: string;
}) {
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

function ContactRow({
  label,
}: {
  label: string;
}) {
  return <div>{label}</div>;
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
        <div className="text-[12px] uppercase tracking-[0.02em] text-slate-500">{label}</div>
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
        <div className="text-[25px] font-semibold leading-7 text-slate-950">{value}</div>
      </div>

      {subValue ? (
        <div className="mt-1 text-[8px] text-slate-500">{subValue}</div>
      ) : null}
    </div>
  );
}

function LadderPositionCard({
  report,
}: {
  report: ReportPayload;
}) {
  const tier = getTier(report);
  const level = getLevel(report);

  return (
    <div
      className="rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Ladder position
      </div>

      <div className="mt-4 space-y-3">
        {TIER_ORDER.map((item) => {
          const passed = TIER_ORDER.indexOf(item) < TIER_ORDER.indexOf(tier as any);
          const current = item === tier;
          const color =
            item === "Invisible"
              ? "#A7B3C7"
              : item === "Emerging"
              ? BRAND.blue
              : item === "Established"
              ? BRAND.teal
              : BRAND.purple;

          return (
            <div key={item}>
              {!current ? (
                <div className="flex items-center gap-3 opacity-70">
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
                      {tierRange(item)} · {passed ? "Passed" : "Pending"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F3FF] text-[13px] font-medium"
                    style={{ color: "#7C3AED", outline: "2px solid #8B5CF6" }}
                  >
                    {level}
                  </div>
                  <div
                    className="flex-1 rounded-xl bg-[#F5F3FF] p-4"
                    style={{ outline: "1px solid #8B5CF6" }}
                  >
                    <div className="text-[16px] font-medium text-slate-950">{tier}</div>
                    <div className="mt-1 flex items-center justify-between text-[14px] text-[#7C3AED]">
                      <span>{tierRange(tier).split("–")[0]}</span>
                      <span>{tierRange(tier).split("–")[1]}</span>
                    </div>
                    <div className="mt-3 h-1 rounded-full bg-white">
                      <div
                        className="h-1 rounded-full bg-[#7C3AED]"
                        style={{
                          width: `${Math.round(
                            ((level - Number(tierRange(tier).split("–")[0])) /
                              (Number(tierRange(tier).split("–")[1]) -
                                Number(tierRange(tier).split("–")[0]) || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7C3AED]" />
          <div className="text-[17px] font-medium">
            <span className="text-[#7C3AED]">{tier}</span>
            <span className="text-slate-700"> · Level {level}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillarScoresCard({
  report,
}: {
  report: ReportPayload;
}) {
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

function TierDistributionCard({
  report,
}: {
  report: ReportPayload;
}) {
  const counts = getTierCounts(report);
  const max = Math.max(...Object.values(counts), 0);

  const colors: Record<string, string> = {
    Invisible: "#A7B3C7",
    Emerging: BRAND.blue,
    Established: BRAND.teal,
    Magnetic: BRAND.purple,
  };

  return (
    <div
      className="rounded-2xl bg-slate-50 p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Tier Distribution
      </div>

      <div className="mt-4 space-y-4">
        {TIER_ORDER.map((tier) => {
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
                    background: colors[tier],
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

function ReportIndexCard() {
  const items = [
    { id: "result-at-a-glance", label: "Result at a glance" },
    { id: "what-this-tier-means", label: "What this tier means" },
    { id: "level-nuance", label: "Level nuance" },
    { id: "pillars-and-signals", label: "Pillars and signals" },
    { id: "behaviour-style", label: "Behaviour style" },
    { id: "strategic-priority-now", label: "Strategic priority now" },
    { id: "progression-roadmap", label: "Progression roadmap" },
  ];

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
            key={item.id}
            href={`#${item.id}`}
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

function ResultAtAGlanceSection({
  report,
  blocks,
}: {
  report: ReportPayload;
  blocks: ReportBlock[];
}) {
  const tier = getTier(report);
  const level = getLevel(report);
  const style = getStyle(report);
  const readiness = readinessLabel(report?.signals?.readiness ?? report?.input?.readiness);

  const summaryBlock =
    firstBlock(blocks, ["plain-english summary"]) ||
    firstBlock(blocks, ["core diagnosis"]) ||
    firstBlock(blocks, ["core reading"]);

  const summaryText =
    textFromBlock(summaryBlock) ||
    `You are in the ${tier} tier at Level ${level}, with behaviour style ${style} and readiness set to ${readiness}.`;

  const immediateFocus =
    firstBlock(blocks, ["best-fit strategic focus"]) ||
    firstBlock(blocks, ["what to focus on now"]);

  return (
    <WhiteCard id="result-at-a-glance" title="Result at a glance">
      <SubPanel title="Plain-English summary">
        <InShort text={summaryText} />
        <ParagraphList
          paragraphs={[
            `You are in the ${tier} tier at Level ${level}, with behaviour style ${style} and readiness set to ${readiness}.`,
            textFromBlock(firstBlock(blocks, ["core reading"])) ||
              `Authority is strong and the market is already attracted. The challenge is sustaining and extending influence.`,
            `At Level ${level}, this currently looks like preferred provider: customers seek the business directly.`,
            textFromBlock(immediateFocus) ||
              `The immediate focus at this level is to strengthen brand leadership.`,
          ].filter(Boolean)}
        />
        <FooterNote text="This gives the report its structural truth: tier explains the stage, while level explains how stable or advanced that stage currently is." />
      </SubPanel>
    </WhiteCard>
  );
}

function WhatThisTierMeansSection({
  blocks,
}: {
  blocks: ReportBlock[];
}) {
  const coreDiagnosis =
    firstBlock(blocks, ["core diagnosis"]) || firstBlock(blocks, ["core reading"]);
  const marketBlock = firstBlock(blocks, ["what is likely happening in the market", "market"]);
  const coreReading = firstBlock(blocks, ["core reading"]);

  return (
    <WhiteCard id="what-this-tier-means" title="What this tier means">
      <div className="space-y-5">
        <SubPanel title="Core diagnosis">
          <InShort text={textFromBlock(coreDiagnosis)} />
          <ParagraphList paragraphs={paragraphsFromBlock(coreDiagnosis)} />
          <FooterNote text={tailFromBlock(coreDiagnosis) || "The goal here is not to dramatise the result, but to explain the current pattern calmly and clearly."} />
        </SubPanel>

        <SubPanel title="What is likely happening in the market">
          <InShort text={textFromBlock(marketBlock)} />
          <ParagraphList paragraphs={paragraphsFromBlock(marketBlock)} />
          <FooterNote text={tailFromBlock(marketBlock) || "This helps explain why effort alone does not move the business forward if the wrong visibility problem is being solved."} />
        </SubPanel>

        <SubPanel title="Core reading">
          <InShort text={textFromBlock(coreReading) || textFromBlock(coreDiagnosis)} />
        </SubPanel>
      </div>
    </WhiteCard>
  );
}

function LevelNuanceSection({
  report,
  blocks,
}: {
  report: ReportPayload;
  blocks: ReportBlock[];
}) {
  const level = getLevel(report);
  const tier = getTier(report);

  const levelMeaning = firstBlock(blocks, ["level meaning"]);
  const meaningPractice = firstBlock(blocks, ["meaning in practice"]);

  return (
    <WhiteCard id="level-nuance" title="Level nuance">
      <div className="space-y-5">
        <SubPanel title={`Level ${level} meaning`}>
          <InShort text={textFromBlock(levelMeaning) || "Preferred provider"} />
          <ParagraphList
            paragraphs={[
              ...paragraphsFromBlock(levelMeaning),
              `Inside the ${tier} tier, Level ${level} shows how stable and advanced this stage currently is.`,
            ].filter(Boolean)}
          />
          <FooterNote
            text={
              tailFromBlock(levelMeaning) ||
              "The level acts as the precision layer. It shows not just where the business is, but how developed that stage currently is."
            }
          />
        </SubPanel>

        <SubPanel title="Meaning in practice">
          <InShort text={textFromBlock(meaningPractice) || "Influential / market-shaping"} />
        </SubPanel>
      </div>
    </WhiteCard>
  );
}

function PillarsAndSignalsSection({
  report,
  blocks,
}: {
  report: ReportPayload;
  blocks: ReportBlock[];
}) {
  const signalPattern = firstBlock(blocks, ["current signal pattern"]);
  const widerPathway = firstBlock(blocks, ["the wider signal pathway", "wider signal pathway"]);
  const pillars = getPillarItems(report);

  const pathwayItems = [
    "Discoverability → Whether people can reliably find the business at all.",
    "Credibility → Whether the business feels trustworthy and proven once found.",
    "Authority → Whether the business is seen as a clear expert rather than just capable.",
    "Positioning → Whether the market understands exactly why this business is the right choice.",
    "Influence → Whether the business shapes the category beyond client delivery.",
  ];

  return (
    <WhiteCard id="pillars-and-signals" title="Pillars and signals">
      <div className="space-y-5">
        <SubPanel title="Current signal pattern">
          <InShort
            text={
              textFromBlock(signalPattern) ||
              "Trust is currently the strongest visible signal, while Authority looks like the main limiting factor."
            }
          />

          <div className="grid gap-4 xl:grid-cols-4">
            {pillars.map((pillar) => (
              <div
                key={pillar.key}
                className="rounded-xl bg-white p-5"
                style={{ outline: `1px solid ${pillar.color}` }}
              >
                <div className="text-[15px] font-bold" style={{ color: pillar.color }}>
                  {pillar.label}
                </div>
                <div className="mt-5 text-[32px] font-bold leading-7" style={{ color: pillar.color }}>
                  {pillar.value}%
                </div>
                <div className="mt-5 text-[15px] leading-7 text-slate-700">{pillar.blurb}</div>
              </div>
            ))}
          </div>

          <ParagraphList paragraphs={paragraphsFromBlock(signalPattern)} />
          <FooterNote
            text={
              tailFromBlock(signalPattern) ||
              "The same low pillar can mean different things at different levels, so the pillar pattern should always be read together with the tier and level."
            }
          />
        </SubPanel>

        <SubPanel title="The wider signal pathway">
          <InShort
            text={
              textFromBlock(widerPathway) ||
              "Visibility Ladder progression is not driven by effort alone. It is driven by the strength and alignment of the signals the market can see."
            }
          />

          <div className="space-y-3 text-[15px] leading-7 text-slate-700">
            {pathwayItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <FooterNote
            text={
              tailFromBlock(widerPathway) ||
              "Each stage builds on the one before it. Businesses that try to skip a stage usually create unstable growth."
            }
          />
        </SubPanel>

        <SubPanel title="Progression pattern">
          <InShort text="Discoverability → Credibility → Authority → Positioning → Influence" />
        </SubPanel>
      </div>
    </WhiteCard>
  );
}

function BehaviourStyleSection({
  report,
  blocks,
}: {
  report: ReportPayload;
  blocks: ReportBlock[];
}) {
  const style = getStyle(report);
  const meta = STYLE_META[style] || STYLE_META.A;
  const typeBlock =
    firstBlock(blocks, [`type ${style.toLowerCase()} interpretation`]) ||
    firstBlock(blocks, ["type a interpretation", "type b interpretation", "type c interpretation", "type d interpretation"]);
  const useLayer = firstBlock(blocks, ["how to use this layer"]);

  return (
    <WhiteCard id="behaviour-style" title="Behaviour style">
      <div className="space-y-5">
        <SubPanel title={`${meta.label} interpretation`}>
          <InShort
            text={
              textFromBlock(typeBlock) ||
              "Behaviour style explains how the client naturally approaches visibility and growth, which changes what strategies they are most likely to implement consistently."
            }
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <MiniInfoBox
              title="Natural strengths"
              text={meta.strengths}
            />
            <MiniInfoBox
              title="Main risk"
              text={meta.risk}
            />
            <MiniInfoBox
              title="What usually works best"
              text={meta.worksBest}
            />
          </div>

          <ParagraphList
            paragraphs={[
              ...paragraphsFromBlock(typeBlock),
              `At the ${getTier(report)} stage, the most suitable behaviour-led focus is to expand only in ways that reinforce authority.`,
            ].filter(Boolean)}
          />
          <FooterNote
            text={
              tailFromBlock(typeBlock) ||
              "Two businesses can be in the same tier but still need very different implementation paths depending on how the founder naturally operates."
            }
          />
        </SubPanel>

        <SubPanel title="How to use this layer">
          <InShort
            text={
              textFromBlock(useLayer) ||
              "Use the tier to choose the right strategic problem. Use the behaviour style to choose the delivery style and the type of work the client is most likely to sustain."
            }
          />
        </SubPanel>
      </div>
    </WhiteCard>
  );
}

function MiniInfoBox({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      className="rounded-xl bg-white p-5"
      style={{ outline: `1px solid ${BRAND.border}` }}
    >
      <div className="text-[15px] font-bold leading-7 text-slate-700">{title}</div>
      <div className="mt-4 text-[15px] leading-7 text-slate-700">{text}</div>
    </div>
  );
}

function StrategicPrioritySection({
  blocks,
}: {
  blocks: ReportBlock[];
}) {
  const focusBlock = firstBlock(blocks, ["what to focus on now", "best-fit strategic focus"]);

  return (
    <WhiteCard id="strategic-priority-now" title="Strategic priority now">
      <SubPanel title="What to focus on now">
        <InShort
          text={
            textFromBlock(focusBlock) ||
            "Protect authority while scaling category impact."
          }
        />
        <ParagraphList
          paragraphs={[
            ...paragraphsFromBlock(focusBlock),
            "At this stage, what usually helps most is the work that strengthens the signals needed for the next shift.",
            "Typical priorities include thought leadership scaling, strategic partnerships, influence platform development, and category-shaping initiatives.",
            "What does not help yet: price-led growth, diluted positioning.",
          ].filter(Boolean)}
        />
        <FooterNote
          text={
            tailFromBlock(focusBlock) ||
            "The goal is not to do more everywhere. It is to strengthen the part of the system that is currently limiting progress."
          }
        />
      </SubPanel>
    </WhiteCard>
  );
}

function ProgressionRoadmapSection({
  report,
  blocks,
}: {
  report: ReportPayload;
  blocks: ReportBlock[];
}) {
  const progression = firstBlock(blocks, ["what progression looks like next"]);
  const readiness = firstBlock(blocks, ["how to recognise readiness"]);
  const tier = getTier(report);

  return (
    <WhiteCard id="progression-roadmap" title="Progression roadmap">
      <div className="space-y-5">
        <SubPanel title="What progression looks like next">
          <InShort
            text={
              textFromBlock(progression) ||
              "Category-shaping authority"
            }
          />
          <ParagraphList
            paragraphs={[
              ...paragraphsFromBlock(progression),
              `Your next milestone is protecting authority while extending influence in a deliberate way.`,
              `The progression cue for this stage is that reputation creates opportunities naturally and the brand shapes the category.`,
            ].filter(Boolean)}
          />
          <FooterNote
            text={
              tailFromBlock(progression) ||
              "A useful report should explain movement, not just diagnosis."
            }
          />
        </SubPanel>

        <SubPanel title="How to recognise readiness">
          <InShort
            text={
              textFromBlock(readiness) ||
              "The current pattern suggests that the base still needs to stabilise before aggressive next-stage moves will hold."
            }
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <MiniInfoBox title="Readiness signal 1" text="The business is referenced as a leading authority." />
            <MiniInfoBox title="Readiness signal 2" text="Reputation routinely creates introductions and strategic opportunities." />
            <MiniInfoBox title="Readiness signal 3" text="Its ideas influence how the category is discussed." />
          </div>

          <ParagraphList
            paragraphs={[
              "Influence expands without weakening positioning.",
              readinessLabel(report?.signals?.readiness ?? report?.input?.readiness) === "Stabilise"
                ? "Stabilise means strengthen the base first."
                : `At the ${tier} stage, the next-stage signals are beginning to consolidate.`,
            ].filter(Boolean)}
          />
          <FooterNote
            text={
              tailFromBlock(readiness) ||
              "Readiness is there to guide how aggressive the next move should be. Stabilise means strengthen the base first. Ready to progress means the next-stage signals are beginning to consolidate."
            }
          />
        </SubPanel>
      </div>
    </WhiteCard>
  );
}

export default function ProfileExtendedReportClient({
  orgName,
  taker,
  test,
  report,
  backHref,
}: Props) {
  const reportRootRef = useRef<HTMLDivElement | null>(null);

  const allBlocks = useMemo(
    () => flattenBlocks(report.sections || []),
    [report.sections]
  );

  const resultBlocks = useMemo(
    () =>
      allBlocks.filter(
        (b: any) =>
          safeString(b.__section_key) === "result_interpretation_scripts"
      ),
    [allBlocks]
  );

  const roadmapBlocks = useMemo(
    () =>
      allBlocks.filter(
        (b: any) =>
          safeString(b.__section_key) === "level_progression_roadmap"
      ),
    [allBlocks]
  );

  const signalBlocks = useMemo(
    () =>
      allBlocks.filter(
        (b: any) =>
          safeString(b.__section_key) === "visibility_signal_framework"
      ),
    [allBlocks]
  );

  const behaviourBlocks = useMemo(
    () =>
      allBlocks.filter(
        (b: any) =>
          safeString(b.__section_key) === "visibility_audit_layer"
      ),
    [allBlocks]
  );

  async function downloadPdf() {
    try {
      const root = reportRootRef.current;
      if (!root) return;

      const sections = Array.from(
        root.querySelectorAll("[data-pdf-section='true']")
      ) as HTMLDivElement[];

      if (!sections.length) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

      const pdf = new JsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      for (let i = 0; i < sections.length; i += 1) {
        const node = sections[i];
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
    <div
      className="min-h-screen"
      style={{
        background: BRAND.pageBg,
      }}
    >
      <div
        className="min-h-[240px]"
        style={{
          background: BRAND.shellBg,
        }}
      >
        <div className="mx-auto max-w-[1440px] px-5 py-4">
          <InternalHeader orgName={orgName} backHref={backHref} onDownload={downloadPdf} />

          <div className="mt-4 text-[12px] text-white/50">
            Database → {taker.fullName} → <span className="text-white">Profile Extended Report</span>
          </div>
        </div>
      </div>

      <div className="-mt-2 bg-slate-100">
        <div
          ref={reportRootRef}
          className="mx-auto max-w-[1440px] px-5 pb-16 pt-5"
        >
          <PdfSection>
            <SummaryHeaderCard taker={taker} testName={test.name} report={report} />

            <div className="mt-4 grid gap-4 xl:grid-cols-[455px_455px_1fr]">
              <LadderPositionCard report={report} />
              <PillarScoresCard report={report} />
              <TierDistributionCard report={report} />
            </div>
          </PdfSection>

          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] items-start">
            <div className="xl:sticky xl:top-5">
              <ReportIndexCard />
            </div>

            <div className="space-y-4">
              <PdfSection id="result-at-a-glance">
                <ResultAtAGlanceSection report={report} blocks={resultBlocks} />
              </PdfSection>

              <PdfSection id="what-this-tier-means">
                <WhatThisTierMeansSection blocks={resultBlocks} />
              </PdfSection>

              <PdfSection id="level-nuance">
                <LevelNuanceSection report={report} blocks={roadmapBlocks} />
              </PdfSection>

              <PdfSection id="pillars-and-signals">
                <PillarsAndSignalsSection report={report} blocks={signalBlocks} />
              </PdfSection>

              <PdfSection id="behaviour-style">
                <BehaviourStyleSection report={report} blocks={behaviourBlocks} />
              </PdfSection>

              <PdfSection id="strategic-priority-now">
                <StrategicPrioritySection blocks={[...resultBlocks, ...roadmapBlocks]} />
              </PdfSection>

              <PdfSection id="progression-roadmap">
                <ProgressionRoadmapSection report={report} blocks={roadmapBlocks} />
              </PdfSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}