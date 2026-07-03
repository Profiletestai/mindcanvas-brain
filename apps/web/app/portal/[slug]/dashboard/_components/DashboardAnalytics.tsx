// apps/web/app/portal/[slug]/dashboard/_components/DashboardAnalytics.tsx
// Pro-tier analytics mockups for the portal Dashboard.
// Static figures mirror the Figma "Pro/niche/enterprise subscription dashboard"
// design — real analytics wiring is out of scope. When `locked` is true the same
// charts render blurred behind an "Unlock with Pro" overlay (Starter design).
import Link from "next/link";
import { cardClass as CARD } from "@/components/portal/ui";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { Avatar } from "@/components/portal/Avatar";
import { ProgressBar } from "@/components/portal/ProgressBar";
import {
  ActivityBarChart,
  LevelDonutChart,
  FrequencyBarChart,
} from "./charts";

// --- shared bits ----------------------------------------------------------

// Decorative "Model ▾" pill shown on chart cards (non-functional in mockup).
function ModelPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white/60">
      Model
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Overlay shown on locked chart cards (Starter tier).
function UnlockOverlay({ slug }: { slug: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="text-white/70">
        <LockIcon size={20} />
      </span>
      <div className="text-[15px] font-bold text-white">Unlock with Pro</div>
      <p className="max-w-[280px] text-[12px] text-white/55">
        Upgrade to see analytics and insights across all your submissions.
      </p>
      <Link
        href={`/portal/${slug}/profile/billing`}
        className="mt-1 inline-flex h-[30px] items-center rounded-md bg-[#54AFE0] px-4 text-[12px] font-bold text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition-opacity hover:opacity-90"
      >
        Upgrade to Pro →
      </Link>
    </div>
  );
}

// Wraps chart content: blurs + dims it and floats the unlock overlay when locked.
function ChartFrame({
  locked,
  slug,
  children,
}: {
  locked: boolean;
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full">
      <div
        className={
          locked ? "pointer-events-none select-none blur-[3px] opacity-40" : ""
        }
        aria-hidden={locked}
      >
        {children}
      </div>
      {locked && <UnlockOverlay slug={slug} />}
    </div>
  );
}

// --- Submission activity (30-day bar chart) -------------------------------

// Mock daily submission counts (30 days); index 25 is the highlighted peak.
const ACTIVITY_BARS = [
  4, 7, 3, 9, 6, 5, 8, 12, 7, 4, 6, 9, 5, 8, 14, 10, 6, 9, 7, 11, 8, 13, 9, 12,
  10, 22, 15, 11, 14, 9,
];

function SubmissionActivityChart() {
  return (
    <div className={`${CARD} flex h-full flex-col p-5`}>
      <div className="flex items-start justify-between">
        <Eyebrow>Analytics</Eyebrow>
        <ModelPill />
      </div>
      <h3 className="mt-2 text-[15px] font-bold text-white">
        Submission activity — last 30 days
      </h3>
      <div className="mt-5 flex flex-1 flex-col">
        <ActivityBarChart values={ACTIVITY_BARS} />
      </div>
    </div>
  );
}

// --- Level distribution (donut) -------------------------------------------

const LEVELS = [
  { label: "Level 18–20 — Strategic", pct: 15, color: "#4a9edd" },
  { label: "Level 15–17 — Magnetic", pct: 28, color: "#a78bfa" },
  { label: "Level 9–12 — Developing", pct: 35, color: "#2dd4bf" },
  { label: "Level 7–8 — Emerging", pct: 22, color: "#f59e0b" },
];

function LevelDistributionDonut() {
  return (
    <div className={`${CARD} flex h-full flex-col p-5`}>
      <div className="flex items-start justify-between">
        <Eyebrow>Insights</Eyebrow>
        <ModelPill />
      </div>
      <h3 className="mt-2 text-[15px] font-bold text-white">Level distribution</h3>
      <div className="mt-4 flex flex-1 items-center gap-6">
        {/* Donut */}
        <LevelDonutChart segments={LEVELS} />
        {/* Legend */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {LEVELS.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-[12px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="truncate text-white/60">{s.label}</span>
              <span className="ml-auto font-semibold text-white/85">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Top frequencies (horizontal bars) ------------------------------------

const FREQUENCIES = [
  { label: "Strategic", pct: 78, color: "#4a9edd" },
  { label: "Magnetic", pct: 64, color: "#2dd4bf" },
  { label: "Analytical", pct: 51, color: "#a78bfa" },
  { label: "Relational", pct: 43, color: "#22c55e" },
  { label: "Systemic", pct: 26, color: "#f59e0b" },
  { label: "Adaptive", pct: 18, color: "#ef4444" },
];

function TopFrequencies() {
  return (
    <div className={`${CARD} flex h-full flex-col p-5`}>
      <Eyebrow>Insights</Eyebrow>
      <h3 className="mt-2 text-[15px] font-bold text-white">Top frequencies</h3>
      <div className="mt-5 flex flex-1 flex-col justify-center">
        <FrequencyBarChart items={FREQUENCIES} />
      </div>
    </div>
  );
}

// --- Top profiles (list) --------------------------------------------------

const PROFILES = [
  { rank: 1, name: "Sarah Mitchell", test: "Growth Engine", level: 19, initials: "SR", color: "bg-sky-500/20 text-sky-300", flag: false },
  { rank: 2, name: "James Okafor", test: "QSC for Entrepreneurs", level: 17, initials: "JO", color: "bg-emerald-500/20 text-emerald-300", flag: false },
  { rank: 3, name: "Tom Barker", test: "QSC for Leaders", level: 16, initials: "TB", color: "bg-violet-500/20 text-violet-300", flag: false },
  { rank: 4, name: "Priya Sharma", test: "MindCanvas LEAD", level: 14, initials: "PS", color: "bg-rose-500/20 text-rose-300", flag: true },
];

function TopProfiles() {
  return (
    <div className={`${CARD} flex h-full flex-col p-5`}>
      <Eyebrow>Insights</Eyebrow>
      <h3 className="mt-2 text-[15px] font-bold text-white">Top profiles</h3>
      <div className="mt-4 flex-1">
        {PROFILES.map((p) => (
          <div
            key={p.rank}
            className="flex items-center gap-3 border-t border-white/[0.05] py-3 first:border-t-0"
          >
            <span className="w-3 shrink-0 text-[12px] font-semibold text-white/35">
              {p.rank}
            </span>
            <Avatar initials={p.initials} color={p.color} size={8} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">
                {p.name}
              </div>
              <div className="truncate text-[11px] text-white/45">{p.test}</div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-white/75">
              Lvl {p.level}
              {p.flag && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Small metric cards (completion / visibility / time) ------------------

function MetricCard({
  eyebrow,
  value,
  unit,
  children,
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="text-[26px] font-bold leading-none text-white">{value}</span>
        {unit && <span className="text-[13px] font-medium text-white/50">{unit}</span>}
      </div>
      <div className="mt-2 text-[11px]">{children}</div>
    </div>
  );
}

function TrendUp({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 15l6-6 6 6" />
      </svg>
      {children}
    </span>
  );
}

function MetricCards() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <MetricCard eyebrow="Completion rate" value="84" unit="%">
        <TrendUp>7.6% vs last month</TrendUp>
        <ProgressBar value={84} className="mt-2" />
      </MetricCard>
      <MetricCard eyebrow="Avg. visibility score" value="14.2">
        <span className="text-white/45">Across all submissions</span>
      </MetricCard>
      <MetricCard eyebrow="Avg. time to complete" value="11" unit="min">
        <TrendUp>2 min faster</TrendUp>
      </MetricCard>
    </div>
  );
}

// Locked metric card (Starter): lock badge + "Pro only" + upgrade.
function LockedMetricCard({
  eyebrow,
  value,
  unit,
  slug,
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  slug: string;
}) {
  return (
    <div className={`${CARD} relative overflow-hidden p-4`}>
      <div className="pointer-events-none select-none blur-[3px] opacity-40" aria-hidden>
        <Eyebrow>{eyebrow}</Eyebrow>
        <div className="mt-2 flex items-baseline gap-0.5">
          <span className="text-[26px] font-bold leading-none text-white">{value}</span>
          {unit && <span className="text-[13px] font-medium text-white/50">{unit}</span>}
        </div>
        <span className="mt-3 block h-1.5 rounded-full bg-white/[0.08]" />
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 text-center">
        <span className="text-white/70">
          <LockIcon size={16} />
        </span>
        <span className="text-[12px] font-semibold text-white/80">Pro only</span>
        <Link
          href={`/portal/${slug}/profile/billing`}
          className="inline-flex h-[24px] items-center rounded-md bg-[#54AFE0] px-3 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}

// --- Composed analytics section -------------------------------------------

export function DashboardAnalytics({
  slug,
  locked,
}: {
  slug: string;
  locked: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Row 1: activity + level distribution */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartFrame locked={locked} slug={slug}>
          <SubmissionActivityChart />
        </ChartFrame>
        <ChartFrame locked={locked} slug={slug}>
          <LevelDistributionDonut />
        </ChartFrame>
      </div>

      {/* Row 2: frequencies + profiles + metric stack */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartFrame locked={locked} slug={slug}>
          <TopFrequencies />
        </ChartFrame>
        <ChartFrame locked={locked} slug={slug}>
          <TopProfiles />
        </ChartFrame>
        {locked ? (
          <div className="grid grid-cols-1 gap-4">
            <LockedMetricCard eyebrow="Completion rate" value="84" unit="%" slug={slug} />
            <LockedMetricCard eyebrow="Avg. visibility score" value="14.2" slug={slug} />
            <LockedMetricCard eyebrow="Avg. time to complete" value="11" unit="min" slug={slug} />
          </div>
        ) : (
          <MetricCards />
        )}
      </div>
    </div>
  );
}

// Bottom upsell banner shown on the Starter dashboard.
export function ProUpsellBanner({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 overflow-hidden rounded-[20px] border border-[#54AFE0]/25 bg-[linear-gradient(101deg,rgba(26,106,232,0.14)_0%,rgba(74,155,255,0.06)_100%)] p-6">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#54AFE0]">
          Unlock more with Pro
        </div>
        <div className="mt-1 text-[18px] font-bold text-white">
          Analytics, insights, and team features — all locked on Starter
        </div>
        <p className="mt-1 max-w-[560px] text-[13px] text-white/55">
          Upgrade to Pro to unlock submission charts, level distribution, top
          frequencies, completion rate trends, and avg. time tracking. All the data
          you need to grow.
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-[28px] font-bold leading-none text-[#54AFE0]">
          $347<span className="text-[15px] font-medium text-white/50">/mo</span>
        </div>
        <div className="text-[12px] text-white/45">Up to 35 submissions/mo</div>
        <Link
          href={`/portal/${slug}/profile/billing`}
          className="mt-2 inline-flex h-[34px] items-center rounded-md bg-[#54AFE0] px-4 text-[13px] font-bold text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition-opacity hover:opacity-90"
        >
          Upgrade to Pro →
        </Link>
      </div>
    </div>
  );
}

// "You're on Pro" status banner (replaces billing alert for active Pro+ orgs).
export function ProStatusBanner({
  slug,
  planLabel = "Pro",
  submissions = 35,
  nextTier = "Niche",
}: {
  slug: string;
  planLabel?: string;
  submissions?: number;
  nextTier?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-amber-400/[0.18] bg-amber-400/[0.06] px-4 py-2.5">
      <span className="text-amber-300">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-amber-100">
          You’re on {planLabel}
        </div>
        <div className="text-[12px] text-amber-100/70">
          Full analytics, insights, and up to {submissions} submissions per month.
        </div>
      </div>
      {nextTier && (
        <Link
          href={`/portal/${slug}/profile/billing`}
          className="ml-auto inline-flex h-[28px] items-center rounded-md border border-white/[0.14] bg-white/[0.04] px-3 text-[12px] font-semibold text-white/75 transition-colors hover:bg-white/[0.08]"
        >
          Upgrade to {nextTier} →
        </Link>
      )}
    </div>
  );
}
