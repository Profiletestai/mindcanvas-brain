// apps/web/app/mcas/r/[token]/snapshot/page.tsx

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { buildMcasReportPayloadByToken } from "@/lib/mcas/reportPayload";
import {
  getCareerVerticalDisplayCode,
  getVerticalLabel,
  MCAS_VERTICAL_LABELS,
  replaceCareerVerticalCodesForDisplay,
} from "@/lib/mcas/reportConstants";
import type {
  McasCareerVerticalCode,
  McasCoreCode,
  McasDistributionItem,
  McasOperatingStyleCode,
  McasReportPayload,
  McasRoleRecommendation,
  McasStrength,
} from "@/lib/mcas/reportTypes";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "Not completed";

  try {
    return new Intl.DateTimeFormat("en-ZA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function bandLabel(band?: string) {
  if (!band) return "Result";

  const labels: Record<string, string> = {
    dominant: "Dominant",
    secondary: "Secondary",
    tertiary: "Tertiary",
    minimal: "Minimal",
    low: "Low",
  };

  return labels[band] ?? band;
}

function safePercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function operatingStyleDisplayLabel(
  item: McasDistributionItem<McasOperatingStyleCode>,
) {
  return `${item.label} (${item.code})`;
}

function careerVerticalDisplayCode(code: McasCareerVerticalCode) {
  return getCareerVerticalDisplayCode(code);
}

function careerVerticalDisplayLabel(code: McasCareerVerticalCode) {
  return getVerticalLabel(code);
}

function careerVerticalDefinition(code: McasCareerVerticalCode) {
  return MCAS_VERTICAL_LABELS[code].shortDescription;
}

function careerVerticalLevel(code: McasCareerVerticalCode) {
  const level = Number(code.replace("V", ""));
  return Number.isFinite(level) ? level : 1;
}

function SectionShell({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-[28px] bg-[#6d4cff] p-3 shadow-xl">
      <div className="rounded-[22px] bg-white p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eee9ff] text-base">
            ✉
          </div>
          <div>
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6d4cff]">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="text-[16px] font-bold leading-5 text-slate-950 md:text-[18px]">
              {title}
            </h2>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}

function TopHeader({ payload }: { payload: McasReportPayload }) {
  return (
    <header className="rounded-t-[28px] bg-[#f1eaff] px-5 py-4 md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-[#d8ccff]" />
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-[#5b45d6]">
                Assessment Summary and Report
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                MindCanvas CORE Alignment System
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-[11px] md:grid-cols-3">
          <div className="rounded-2xl border border-[#d8ccff] bg-white px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Prepared for
            </p>
            <p className="font-semibold text-slate-950">
              {payload.candidate.fullName}
            </p>
          </div>

          <div className="rounded-2xl border border-[#d8ccff] bg-white px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Date
            </p>
            <p className="font-semibold text-slate-950">
              {formatDate(payload.assessment.completedAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#d8ccff] bg-white px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Framework
            </p>
            <p className="font-semibold text-slate-950">Assessment Summary and Report</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
        {label}
      </p>
      <p className="text-[18px] font-bold leading-6 text-white">{value}</p>
      <p className="mt-1 text-[12px] leading-5 text-violet-100">{caption}</p>
    </div>
  );
}

function Hero({ payload }: { payload: McasReportPayload }) {
  const primaryOs = payload.result.operatingStyle.primary;
  const primaryVertical = payload.result.careerVertical.primary;
  const strongestCore = payload.result.core.strongest;

  return (
    <section className="bg-[#100d25] px-5 py-8 text-white md:px-8 md:py-10">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr_260px]">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-200">
            Assessment Summary and Report
          </p>
          <h1 className="text-[28px] font-black leading-tight tracking-tight md:text-[34px]">
            {payload.candidate.fullName}
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-violet-100">
            This is how you naturally work — a snapshot of your execution
            pattern, strengths, and best-fit environments.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Your Profile"
              value={operatingStyleDisplayLabel(primaryOs)}
              caption="Natural execution style"
            />
            <MetricCard
              label="Career Vertical"
              value={careerVerticalDisplayCode(primaryVertical.code)}
              caption={careerVerticalDisplayLabel(primaryVertical.code)}
            />
            <MetricCard
              label="Work Pattern"
              value={primaryOs.shortLabel ?? primaryOs.label}
              caption="How you drive results"
            />
            <MetricCard
              label="CORE Strongest"
              value={strongestCore.label}
              caption={`${strongestCore.percentage}% activation`}
            />
          </div>
        </div>

        <OperatingStylePanel
          items={payload.result.operatingStyle.distribution}
          compact
        />

        <div className="space-y-4">
          <CoreBalanceMini items={payload.result.core.distribution} />

          <div className="rounded-3xl bg-[#6d4cff] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
              Profile
            </p>
            <p className="mt-1.5 text-[18px] font-black leading-6">
              {operatingStyleDisplayLabel(primaryOs)}
            </p>
            <p className="text-[12px] leading-5 text-violet-100">
              {primaryOs.percentage}% · {bandLabel(primaryOs.band)}
            </p>
          </div>

          <div className="rounded-3xl bg-[#6d4cff] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
              Career Vertical
            </p>
            <p className="mt-1.5 text-[18px] font-black leading-6">
              {careerVerticalDisplayCode(primaryVertical.code)}
            </p>
            <p className="text-[12px] leading-5 text-violet-100">
              {careerVerticalDisplayLabel(primaryVertical.code)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OperatingStylePanel({
  items,
  compact = false,
}: {
  items: McasDistributionItem<McasOperatingStyleCode>[];
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-3xl bg-white p-4 text-slate-950"
          : "rounded-3xl border border-slate-200 bg-white p-4"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
          Operating Style
        </h3>
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700">
          Distribution
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.code}>
            <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[9px] font-black text-violet-700">
                  {item.code}
                </span>
                <span className="truncate font-semibold text-slate-900">
                  {operatingStyleDisplayLabel(item)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-bold text-slate-900">
                  {item.percentage}%
                </span>
                <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase text-slate-600 sm:inline-flex">
                  {bandLabel(item.band)}
                </span>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#6d4cff]"
                style={{ width: `${safePercent(item.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoreBalanceMini({
  items,
}: {
  items: McasDistributionItem<McasCoreCode>[];
}) {
  const byCode = new Map(items.map((item) => [item.code, item]));

  const create = byCode.get("CREATE")?.percentage ?? 0;
  const organise = byCode.get("ORGANISE")?.percentage ?? 0;
  const resolve = byCode.get("RESOLVE")?.percentage ?? 0;
  const examine = byCode.get("EXAMINE")?.percentage ?? 0;

  return (
    <div className="rounded-3xl bg-white p-4 text-slate-950">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Work Cycle Coverage
      </p>

      <div className="mx-auto grid h-40 w-40 grid-cols-2 grid-rows-2 overflow-hidden rounded-full border-8 border-violet-100 text-center text-[10px] font-bold">
        <div className="flex flex-col items-center justify-center bg-violet-50">
          <span>Create</span>
          <span className="text-violet-700">{create}%</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-indigo-50">
          <span>Organise</span>
          <span className="text-indigo-700">{organise}%</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-cyan-50">
          <span>Resolve</span>
          <span className="text-cyan-700">{resolve}%</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-slate-50">
          <span>Examine</span>
          <span className="text-slate-700">{examine}%</span>
        </div>
      </div>
    </div>
  );
}

function TopStyleStrip({
  items,
}: {
  items: McasDistributionItem<McasOperatingStyleCode>[];
}) {
  return (
    <div className="grid gap-3 bg-white px-5 py-4 md:grid-cols-4 md:px-8">
      {items.slice(0, 4).map((item) => (
        <div
          key={item.code}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-bold text-slate-950">
              {operatingStyleDisplayLabel(item)}
            </p>
            <p className="text-[11px] font-bold text-slate-500">
              {item.percentage}%
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#6d4cff]"
              style={{ width: `${safePercent(item.percentage)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase text-slate-500">
            {bandLabel(item.band)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SidebarIndex() {
  const links = [
    ["welcome", "Welcome Snapshot"],
    ["style", "Your Operating Style Snapshot"],
    ["career-vertical", "Your Career Vertical Fit Today"],
    ["strengths", "Your Natural Strengths"],
    ["environment", "Your Best Fit Work Environment"],
    ["roles", "Recommended Roles and Pathways"],
    ["upgrade", "Unlock your full report"],
    ["inside-full", "What’s in the full report"],
  ];

  return (
    <aside className="rounded-3xl bg-[#211941] p-5 text-white lg:sticky lg:top-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">
        Report Index
      </p>

      <nav className="space-y-2">
        {links.map(([href, label], index) => (
          <a
            key={href}
            href={`#${href}`}
            className="block rounded-xl border border-white/10 px-3 py-2 text-[12px] leading-5 text-violet-50 hover:bg-white/10"
          >
            {index + 1}. {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-2">
        <button className="w-full rounded-xl bg-white px-4 py-2 text-[12px] font-bold text-slate-950">
          Download PDF
        </button>
        <a
          href="#upgrade"
          className="block w-full rounded-xl bg-[#6d4cff] px-4 py-2 text-center text-[12px] font-bold text-white"
        >
          Next step
        </a>
      </div>
    </aside>
  );
}

function WelcomeSection() {
  return (
    <SectionShell id="welcome" title="Welcome Snapshot">
      <div className="space-y-6">
        <p className="text-[13px] leading-6 text-slate-700">
          MCAS is not a personality test. It is a workforce alignment and career
          execution system designed to explain how you naturally execute work,
          where you are most likely to thrive, and what environments and roles
          are most likely to bring out your best.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="What it measures"
            description="Observable work patterns — execution, organisation, communication, and decisions."
          />
          <InfoCard
            title="What this shows"
            description="Your dominant Operating Style, strengths, and best-fit environment indicators."
          />
          <InfoCard
            title="How to use it"
            description="Read it as a mirror. Use it to understand your natural patterns, not as a fixed label."
          />
        </div>
      </div>
    </SectionShell>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-[#f5f1ff] p-5">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">
        {title}
      </p>
      <p className="text-[12px] leading-5 text-slate-700">{description}</p>
    </div>
  );
}

function OperatingStyleSnapshot({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.operatingStyle.primary;

  return (
    <SectionShell id="style" title="Your Operating Style Snapshot">
      <div className="space-y-6">
        <p className="text-[13px] leading-6 text-slate-700">
          The Operating Style reveals your natural execution pattern. The
          distribution below reflects scored pattern strength, not a ranking
          against other people.
        </p>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="mx-auto grid max-w-sm grid-cols-3 gap-3 text-center text-[10px] font-bold text-slate-700">
              {payload.result.operatingStyle.distribution.map((item) => (
                <div
                  key={item.code}
                  className={
                    item.code === primary.code
                      ? "rounded-2xl bg-[#6d4cff] p-3 text-white shadow-lg"
                      : "rounded-2xl bg-white p-3"
                  }
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                    {item.code}
                  </div>
                  <p>{operatingStyleDisplayLabel(item)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6d4cff]">
              Operating Style · {primary.code}
            </p>
            <h3 className="mt-2 text-[20px] font-black leading-7 text-slate-950">
              The {operatingStyleDisplayLabel(primary)}
            </h3>
            <p className="mt-3 text-[13px] leading-6 text-slate-700">
              {payload.candidateFacing.operatingStyleNarrative}
            </p>
          </div>
        </div>

        <CoreCoverage items={payload.result.core.distribution} />
      </div>
    </SectionShell>
  );
}

function CoreCoverage({
  items,
}: {
  items: McasDistributionItem<McasCoreCode>[];
}) {
  return (
    <div>
      <p className="mb-4 text-[13px] leading-6 text-slate-700">
        The CORE system maps which parts of the work cycle you naturally drive,
        support, or under-cover.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.code}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-black leading-5 text-slate-950">{item.label}</p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {item.percentage}% · {bandLabel(item.band)}
                </p>
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                {item.code}
              </span>
            </div>

            <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#6d4cff]"
                style={{ width: `${safePercent(item.percentage)}%` }}
              />
            </div>

            <p className="text-[12px] leading-5 text-slate-600">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrengthsSection({ strengths }: { strengths: McasStrength[] }) {
  return (
    <SectionShell id="strengths" title="Your Natural Strengths">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {strengths.map((strength) => (
          <div
            key={strength.title}
            className="rounded-2xl border border-teal-200 bg-white p-5"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-base">
              {strength.icon ?? "✦"}
            </div>
            <h3 className="text-[13px] font-black leading-5 text-slate-950">{strength.title}</h3>
            <p className="mt-2 text-[12px] leading-5 text-slate-600">
              {strength.description}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function EnvironmentSection({ payload }: { payload: McasReportPayload }) {
  const environment = payload.candidateFacing.environmentFit;

  const cards = [
    ["Pace", environment.pace],
    ["Autonomy", environment.autonomy],
    ["Structure", environment.structure],
    ["Work Style", environment.workStyle],
  ];

  return (
    <SectionShell id="environment" title="Your Best Fit Work Environment">
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(([title, description]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-[13px] font-black leading-5 text-slate-950">{title}</p>
            <p className="mt-2 text-[12px] leading-5 text-slate-600">
              {description}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function RolesSection({ roles }: { roles: McasRoleRecommendation[] }) {
  return (
    <SectionShell id="roles" title="Recommended Roles and Pathways">
      <div className="grid gap-5 lg:grid-cols-[1fr_180px_1fr]">
        <div className="space-y-4">
          {roles.slice(0, 3).map((role) => (
            <RoleCard key={`${role.category}-${role.title}`} role={role} />
          ))}
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="flex h-40 w-40 items-center justify-center rounded-full border-8 border-violet-100 bg-[#f5f1ff] text-center text-5xl">
            👥
          </div>
        </div>

        <div className="space-y-4">
          {roles.slice(3, 6).map((role) => (
            <RoleCard key={`${role.category}-${role.title}`} role={role} />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function RoleCard({ role }: { role: McasRoleRecommendation }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d4cff]">
        {role.category}
      </p>
      <h3 className="mt-2 text-[13px] font-black leading-5 text-slate-950">{role.title}</h3>
      <p className="mt-1 text-[12px] leading-5 text-slate-600">
        {role.description}
      </p>
    </div>
  );
}

function careerVerticalStatusMeta(
  level: number,
  primaryLevel: number,
  readinessPercentage?: number,
) {
  if (level < primaryLevel) {
    return {
      label: "Completed",
      rowClass: "border-[#DDD8FF] bg-white",
      codeClass: "border-[#DDD8FF] bg-[#F5F3FF] text-[#6D4CFF]",
      pillClass: "border-[#DDD8FF] bg-[#F5F3FF] text-[#6D4CFF]",
      barColor: "#7C5CFF",
      barWidth: 100,
    };
  }

  if (level === primaryLevel) {
    return {
      label: "Current fit",
      rowClass: "border-[#6D4CFF] bg-[#F1EEFF]",
      codeClass: "border-[#211941] bg-[#211941] text-white",
      pillClass: "border-[#211941] bg-[#211941] text-white",
      barColor: "#6D4CFF",
      barWidth: 100,
    };
  }

  if (level === primaryLevel + 1) {
    return {
      label: "Stretch with support",
      rowClass: "border-[#37C8E7] bg-[#ECFBFE]",
      codeClass: "border-[#37C8E7] bg-white text-[#147A93]",
      pillClass: "border-[#37C8E7] bg-white text-[#147A93]",
      barColor: "#37C8E7",
      barWidth:
        typeof readinessPercentage === "number"
          ? Math.max(18, Math.min(100, Math.round(readinessPercentage)))
          : 38,
    };
  }

  return {
    label: level === primaryLevel + 2 ? "Overreach risk" : "Not indicated",
    rowClass:
      level === primaryLevel + 2
        ? "border-[#F4C84A] bg-[#FFF9E8]"
        : "border-slate-200 bg-white",
    codeClass:
      level === primaryLevel + 2
        ? "border-[#F4C84A] bg-white text-[#A85C00]"
        : "border-slate-200 bg-white text-slate-500",
    pillClass:
      level === primaryLevel + 2
        ? "border-[#F4C84A] bg-white text-[#A85C00]"
        : "border-slate-200 bg-slate-50 text-slate-500",
    barColor: level === primaryLevel + 2 ? "#F4C84A" : "#CBD5E1",
    barWidth: level === primaryLevel + 2 ? 12 : 6,
  };
}

function CareerVerticalSection({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.careerVertical.primary;
  const next = payload.result.careerVertical.next;
  const primaryLevel = careerVerticalLevel(primary.code);
  const readinessPercentage =
    payload.result.careerVertical.readinessPercentage;

  const order: McasCareerVerticalCode[] = [
    "V1",
    "V2",
    "V3",
    "V4",
    "V5",
    "V6",
  ];

  const verticals = order.map((code) => {
    const resultItem = payload.result.careerVertical.distribution.find(
      (item) => item.code === code,
    );

    return {
      code,
      label: careerVerticalDisplayLabel(code),
      description: careerVerticalDefinition(code),
      percentage: resultItem?.percentage ?? 0,
    };
  });

  const currentResultLabel = replaceCareerVerticalCodesForDisplay(
    payload.result.careerVertical.readinessLabel ??
      `${careerVerticalDisplayCode(primary.code)} fit indicated`,
  );

  const readinessDescription = next
    ? `Current Career Vertical result indicates ${careerVerticalDisplayCode(
        primary.code,
      )} scope. Stretch indicators toward ${careerVerticalDisplayCode(
        next.code,
      )} with support.`
    : `Current Career Vertical result indicates ${careerVerticalDisplayCode(
        primary.code,
      )} scope. Continue strengthening sustainable performance at this level.`;

  return (
    <SectionShell
      id="career-vertical"
      eyebrow="Career Career Vertical Readiness"
      title="Your Career Vertical Fit Today"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#DDD8FF] bg-[#F7F5FF] px-5 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6D4CFF]">
            Current result
          </p>
          <p className="mt-2 text-[18px] font-black leading-6 text-[#211941]">
            {currentResultLabel}
          </p>
          <p className="mt-2 text-[12px] leading-6 text-slate-600">
            Progression changes work itself. Higher Career Verticals increase
            ambiguity, scope, decision impact, and accountability. The next
            level should be treated as a development horizon, not an automatic
            promotion recommendation.
          </p>
        </div>

        <div className="space-y-3">
          {verticals.map((item) => {
            const level = careerVerticalLevel(item.code);
            const meta = careerVerticalStatusMeta(
              level,
              primaryLevel,
              readinessPercentage,
            );

            return (
              <div
                key={item.code}
                className={`grid gap-4 rounded-2xl border px-4 py-4 md:grid-cols-[52px_minmax(0,1.45fr)_minmax(150px,0.85fr)_160px] md:items-center ${meta.rowClass}`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-[12px] font-black ${meta.codeClass}`}
                >
                  {careerVerticalDisplayCode(item.code)}
                </div>

                <div>
                  <p className="text-[13px] font-black leading-5 text-[#211941]">
                    {careerVerticalDisplayCode(item.code)} · {item.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">
                    {item.description}
                  </p>
                </div>

                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${meta.barWidth}%`,
                        backgroundColor: meta.barColor,
                      }}
                    />
                  </div>
                  {item.percentage > 0 ? (
                    <p className="mt-1 text-[9px] font-semibold text-slate-500">
                      {item.percentage}% scored alignment
                    </p>
                  ) : null}
                </div>

                <div className="md:text-right">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.12em] ${meta.pillClass}`}
                  >
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[#6D4CFF] bg-[#EEEAFE] p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6D4CFF] text-lg text-white">
            ↗
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Career Career Vertical Readiness
          </p>
          <p className="mt-2 text-[18px] font-black leading-6 text-[#211941]">
            {careerVerticalDisplayCode(primary.code)} Ready
          </p>
          <p className="mt-2 text-[12px] leading-5 text-slate-600">
            {readinessDescription}
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

function UpgradePanel({
  payload,
  token,
}: {
  payload: McasReportPayload;
  token: string;
}) {
  return (
    <section
      id="upgrade"
      className="rounded-[28px] bg-gradient-to-br from-[#211941] to-[#100d25] p-7 text-center text-white shadow-xl md:p-9"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
          🔒
        </div>

        <h2 className="text-[16px] font-bold leading-5 md:text-[18px]">
          Unlock Your Full Strategic Career Growth Report
        </h2>

        <p className="mt-3 text-[13px] leading-6 text-violet-100">
          Your snapshot is just the beginning. The full MCAS report covers blind
          spots, pressure patterns, decision style, 30/60/90-day success guide,
          and a complete career pathway roadmap.
        </p>

        {payload.access.fullUnlocked ? (
          <a
            href={`/mcas/r/${token}/full`}
            className="mt-6 inline-flex rounded-2xl bg-white px-6 py-3 text-[12px] font-black text-slate-950"
          >
            Open Full Report →
          </a>
        ) : (
          <a
            href={`/mcas/r/${token}/full`}
            className="mt-6 inline-flex rounded-2xl bg-[#6d4cff] px-6 py-3 text-[12px] font-black text-white shadow-lg"
          >
            Get the Full Report →
          </a>
        )}
      </div>
    </section>
  );
}

function FullReportPreview() {
  const lockedSections = [
    [
      "Your Blind Spots and How to Manage Them",
      "Behavioural tradeoffs, sustainability risks, and support strategies.",
    ],
    [
      "Your Strength Advantages Under Pressure",
      "Default behaviours and instinctive patterns in fast-moving environments.",
    ],
    [
      "Your 30 / 60 / 90 Day Success Guide",
      "First actions, habits, and risk-reduction behaviours.",
    ],
    [
      "Your Next Step Pathway",
      "Growth direction, next Career Vertical preparation, and development areas.",
    ],
  ];

  return (
    <SectionShell id="inside-full" title="What’s in the Full Report">
      <div className="space-y-3">
        {lockedSections.map(([title, description]) => (
          <div
            key={title}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg">
              🔒
            </div>
            <div>
              <h3 className="text-[13px] font-black leading-5 text-slate-950">{title}</h3>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export default async function McasSnapshotReportPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  if (!token) {
    notFound();
  }

  let payload: McasReportPayload;

  try {
    payload = await buildMcasReportPayloadByToken(token, "snapshot");
  } catch (error) {
    console.error("[MCAS Snapshot Report] Failed to build payload:", error);
    notFound();
  }

  if (!payload.access.snapshotUnlocked) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#080e1b] py-6 text-slate-950">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#080e1b] shadow-2xl">
        <TopHeader payload={payload} />
        <Hero payload={payload} />
        <TopStyleStrip items={payload.result.operatingStyle.distribution} />

        <div className="grid gap-6 px-5 py-7 md:px-8 lg:grid-cols-[240px_1fr]">
          <SidebarIndex />

          <div className="space-y-6">
            <WelcomeSection />
            <OperatingStyleSnapshot payload={payload} />
            <CareerVerticalSection payload={payload} />
            <StrengthsSection strengths={payload.candidateFacing.strengths} />
            <EnvironmentSection payload={payload} />
            <RolesSection roles={payload.candidateFacing.roleRecommendations} />
            <UpgradePanel payload={payload} token={token} />
            <FullReportPreview />
          </div>
        </div>
      </div>
    </main>
  );
}