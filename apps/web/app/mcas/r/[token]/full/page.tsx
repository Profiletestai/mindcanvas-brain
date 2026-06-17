// apps/web/app/mcas/r/[token]/full/page.tsx

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { buildMcasReportPayloadByToken } from "@/lib/mcas/reportPayload";
import type {
  McasBlindSpot,
  McasCoreCode,
  McasDistributionItem,
  McasOperatingStyleCode,
  McasReportPayload,
  McasRoleRecommendation,
  McasStrength,
  McasSuccessGuideItem,
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

function periodLabel(period: McasSuccessGuideItem["period"]) {
  const labels: Record<McasSuccessGuideItem["period"], string> = {
    days_1_30: "Days 1–30",
    days_31_60: "Days 31–60",
    days_61_90: "Days 61–90",
  };

  return labels[period];
}

function safePercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function dominantCorePair(payload: McasReportPayload) {
  return payload.result.core.distribution
    .slice(0, 2)
    .map((item) => item.label)
    .join(" + ");
}

function SectionShell({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-[28px] bg-[#6d4cff] p-3 shadow-xl">
      <div className="rounded-[22px] bg-white p-6 md:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eee9ff] text-lg">
            ✉
          </div>
          <div>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6d4cff]">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="text-xl font-black text-slate-950 md:text-2xl">
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
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#d8ccff]" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#5b45d6]">
              Candidate Extensive Career Report
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">
              MindCanvas CORE Alignment System
            </p>
          </div>
        </div>

        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-2xl border border-[#d8ccff] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Prepared for
            </p>
            <p className="font-semibold text-slate-950">
              {payload.candidate.fullName}
            </p>
          </div>

          <div className="rounded-2xl border border-[#d8ccff] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Date
            </p>
            <p className="font-semibold text-slate-950">
              {formatDate(payload.assessment.completedAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#d8ccff] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Framework
            </p>
            <p className="font-semibold text-slate-950">Full Career Report</p>
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
    <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
        {label}
      </p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm leading-5 text-violet-100">{caption}</p>
    </div>
  );
}

function Hero({ payload }: { payload: McasReportPayload }) {
  const primaryOs = payload.result.operatingStyle.primary;
  const primaryVertical = payload.result.careerVertical.primary;
  const readiness = payload.result.careerVertical.readinessPercentage;
  const corePair = dominantCorePair(payload);

  return (
    <section className="bg-[#100d25] px-5 py-8 text-white md:px-8 md:py-10">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr_280px]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
            Candidate Extensive Career Report
          </p>

          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            {payload.candidate.fullName}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-violet-100">
            A practical career guide — grounded, honest, and actionable. This
            report explains how you naturally execute work and where you are
            most likely to thrive.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Operating Style"
              value={primaryOs.label}
              caption="Dominant pattern"
            />
            <MetricCard
              label="Vertical Fit"
              value={primaryVertical.code}
              caption={primaryVertical.label}
            />
            <MetricCard
              label="CORE Balance"
              value={corePair}
              caption="Dominant behavioural coverage"
            />
            <MetricCard
              label="Next Readiness"
              value={readiness === undefined ? "In development" : `${readiness}%`}
              caption={payload.result.careerVertical.readinessLabel ?? "Growth readiness"}
            />
          </div>
        </div>

        <OperatingStylePanel
          items={payload.result.operatingStyle.distribution}
          compact
        />

        <div className="space-y-4">
          <CoreBalanceMini items={payload.result.core.distribution} />

          <SummaryPill
            label="Core Balance"
            value={corePair}
            caption="Dominant"
          />

          <SummaryPill
            label="Vertical Fit"
            value={`${primaryVertical.code} Now`}
            caption={
              payload.result.careerVertical.next
                ? `${payload.result.careerVertical.next.code} in development`
                : payload.result.careerVertical.readinessLabel ?? "Current fit"
            }
          />

          <SummaryPill
            label="Development"
            value={
              payload.candidateFacing.nextStepPathway?.developmentFocus
                ?.slice(0, 4)
                .join(" · ") ?? "Growth areas"
            }
            caption="Focus areas"
          />
        </div>
      </div>
    </section>
  );
}

function SummaryPill({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-3xl bg-[#6d4cff] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-violet-100">{caption}</p>
    </div>
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
          ? "rounded-3xl bg-white p-5 text-slate-950"
          : "rounded-3xl border border-slate-200 bg-white p-5"
      }
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">
          Operating Style
        </h3>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
          Distribution
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.code}>
            <div className="mb-1 flex items-center justify-between gap-4 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-700">
                  {item.code.replace("OS", "")}
                </span>
                <span className="truncate font-semibold text-slate-900">
                  {item.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-bold text-slate-900">
                  {item.percentage}%
                </span>
                <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">
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
    <div className="rounded-3xl bg-white p-5 text-slate-950">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        CORE Balance
      </p>

      <div className="mx-auto grid h-44 w-44 grid-cols-2 grid-rows-2 overflow-hidden rounded-full border-8 border-violet-100 text-center text-xs font-bold">
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
            <p className="font-bold text-slate-950">{item.label}</p>
            <p className="text-sm font-bold text-slate-500">
              {item.percentage}%
            </p>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#6d4cff]"
              style={{ width: `${safePercent(item.percentage)}%` }}
            />
          </div>

          <p className="mt-2 text-xs font-semibold text-slate-500">
            {bandLabel(item.band)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SidebarIndex({ token }: { token: string }) {
  const links = [
    ["orientation", "Welcome and Orientation"],
    ["plain-language", "Your Work Pattern in Plain Language"],
    ["style-deep-dive", "Your Operating Style Deep Dive"],
    ["core-balance", "Your CORE Behavioural Balance"],
    ["pressure-strengths", "Your Strength Advantages Under Pressure"],
    ["blind-spots", "Your Blind Spots and How to Manage Them"],
    ["roles", "Your Best Fit Work and Roles"],
    ["vertical", "Your Career Vertical Fit Today"],
    ["success-guide", "Your 30 / 60 / 90 Day Success Guide"],
    ["pathway", "Your Next Step Pathway"],
  ];

  return (
    <aside className="rounded-3xl bg-[#211941] p-5 text-white lg:sticky lg:top-6">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
        Report Index
      </p>

      <nav className="space-y-2">
        {links.map(([href, label], index) => (
          <a
            key={href}
            href={`#${href}`}
            className="block rounded-xl border border-white/10 px-3 py-2 text-sm text-violet-50 hover:bg-white/10"
          >
            {index + 1}. {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-2">
        <button className="w-full rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950">
          Download PDF
        </button>

        <a
          href={`/mcas/r/${token}/snapshot`}
          className="block w-full rounded-xl bg-[#6d4cff] px-4 py-2 text-center text-sm font-bold text-white"
        >
          View Snapshot
        </a>
      </div>
    </aside>
  );
}

function OrientationSection() {
  return (
    <SectionShell id="orientation" title="Welcome and Orientation">
      <div className="space-y-6">
        <p className="text-base leading-7 text-slate-700">
          This report explains how you naturally execute work and where you are
          most likely to thrive. It is designed to feel encouraging, grounded,
          honest, and practical.
        </p>

        <p className="text-base leading-7 text-slate-700">
          MCAS does not measure intelligence, mental health, morality, or
          values. It measures observable work patterns: how you create movement,
          organise priorities, resolve work, examine quality, and scale
          responsibility over time.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="What it measures"
            description="Observable work patterns — execution, organisation, resolve, and examine."
          />
          <InfoCard
            title="What it does not measure"
            description="Intelligence, mental health, morality, values, or fixed personality traits."
          />
          <InfoCard
            title="How to use it"
            description="Return to it. Share sections. Use the 30/60/90 guide. Treat it as a strategic tool."
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
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-slate-700">
        {title}
      </p>
      <p className="text-sm leading-6 text-slate-700">{description}</p>
    </div>
  );
}

function PlainLanguageSection({ payload }: { payload: McasReportPayload }) {
  return (
    <SectionShell
      id="plain-language"
      title="Your Work Pattern in Plain Language"
    >
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-lg leading-8 text-slate-800">
          {payload.candidateFacing.workPatternSummary}
        </p>
      </div>
    </SectionShell>
  );
}

function OperatingStyleDeepDive({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.operatingStyle.primary;
  const secondary = payload.result.operatingStyle.secondary;

  return (
    <SectionShell id="style-deep-dive" title="Your Operating Style Deep Dive">
      <div className="space-y-8">
        <p className="text-base leading-7 text-slate-700">
          The Operating Style reveals your natural execution pattern. The
          distribution below reflects scored pattern strength, not a ranking
          against other people.
        </p>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="mx-auto grid max-w-sm grid-cols-3 gap-3 text-center text-xs font-bold text-slate-700">
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
                    {item.code.replace("OS", "")}
                  </div>
                  <p>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6d4cff]">
              Operating Style Profile · {primary.code}
            </p>
            <h3 className="mt-3 text-3xl font-black text-slate-950">
              The {primary.label}
            </h3>
            <p className="mt-4 text-base leading-7 text-slate-700">
              {payload.candidateFacing.operatingStyleNarrative}
            </p>

            {secondary ? (
              <div className="mt-5 rounded-2xl border border-violet-100 bg-[#f5f1ff] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d4cff]">
                  Secondary Influence
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Your secondary pattern is{" "}
                  <strong>
                    {secondary.label} at {secondary.percentage}%
                  </strong>
                  . This can shape how your dominant pattern shows up in more
                  complex or pressured environments.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <OperatingStylePanel
          items={payload.result.operatingStyle.distribution}
        />
      </div>
    </SectionShell>
  );
}

function CoreBalanceSection({ payload }: { payload: McasReportPayload }) {
  return (
    <SectionShell id="core-balance" title="Your CORE Behavioural Balance">
      <div className="space-y-6">
        <p className="text-base leading-7 text-slate-700">
          The CORE system maps which parts of the work cycle you naturally
          drive, support, or under-cover.
        </p>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <CoreBalanceMini items={payload.result.core.distribution} />
          <CoreCoverage items={payload.result.core.distribution} />
        </div>
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
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.code}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-black text-slate-950">{item.label}</p>
              <p className="text-xs font-semibold text-slate-500">
                {item.percentage}% · {bandLabel(item.band)}
              </p>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
              {item.code}
            </span>
          </div>

          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#6d4cff]"
              style={{ width: `${safePercent(item.percentage)}%` }}
            />
          </div>

          <p className="text-sm leading-6 text-slate-600">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function PressureStrengthsSection({ strengths }: { strengths: McasStrength[] }) {
  return (
    <SectionShell
      id="pressure-strengths"
      title="Your Strength Advantages Under Pressure"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {strengths.map((strength) => (
          <StrengthCard key={strength.title} strength={strength} />
        ))}
      </div>
    </SectionShell>
  );
}

function StrengthCard({ strength }: { strength: McasStrength }) {
  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-lg">
        {strength.icon ?? "✦"}
      </div>
      <h3 className="font-black text-slate-950">{strength.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {strength.description}
      </p>
    </div>
  );
}

function BlindSpotsSection({
  blindSpots,
}: {
  blindSpots: McasBlindSpot[];
}) {
  return (
    <SectionShell id="blind-spots" title="Your Blind Spots and How to Manage Them">
      <div className="space-y-6">
        <p className="text-base leading-7 text-slate-700">
          Blind spots are not weaknesses. They are the natural shadow of your
          strengths — the places where your dominant pattern, applied without
          awareness, can create friction or limit impact.
        </p>

        <div className="space-y-4">
          {blindSpots.map((blindSpot, index) => (
            <div
              key={blindSpot.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d4cff]">
                Blind Spot {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-lg font-black text-slate-950">
                {blindSpot.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {blindSpot.description}
              </p>

              <div className="mt-4 rounded-2xl bg-[#f5f1ff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">
                  Management strategy
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {blindSpot.managementStrategy}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function RolesSection({ roles }: { roles: McasRoleRecommendation[] }) {
  return (
    <SectionShell id="roles" title="Your Best Fit Work and Roles">
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
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6d4cff]">
        {role.category}
      </p>
      <h3 className="mt-2 font-black text-slate-950">{role.title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {role.description}
      </p>
    </div>
  );
}

function CareerVerticalSection({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.careerVertical.primary;

  return (
    <SectionShell id="vertical" title="Your Career Vertical Fit Today">
      <div className="space-y-6">
        <p className="text-base leading-7 text-slate-700">
          Progression changes work itself. Higher verticals increase ambiguity,
          scope, and accountability. Your current indication is{" "}
          <strong>
            {primary.code} — {primary.label}
          </strong>
          .
        </p>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 md:grid-cols-6">
            {payload.result.careerVertical.distribution.map((item) => {
              const isPrimary = item.code === primary.code;

              return (
                <div
                  key={item.code}
                  className={
                    isPrimary
                      ? "rounded-2xl bg-[#6d4cff] p-4 text-white shadow-lg"
                      : "rounded-2xl bg-white p-4 text-slate-800"
                  }
                >
                  <p className="text-sm font-black">{item.code}</p>
                  <p className="mt-1 text-xs font-semibold">{item.label}</p>
                  <p
                    className={
                      isPrimary
                        ? "mt-3 text-xs text-violet-100"
                        : "mt-3 text-xs text-slate-500"
                    }
                  >
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {payload.result.careerVertical.readinessLabel ? (
          <div className="rounded-2xl border border-violet-100 bg-[#f5f1ff] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d4cff]">
              Readiness note
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {payload.result.careerVertical.readinessLabel}
            </p>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

function SuccessGuideSection({
  successGuide,
}: {
  successGuide: McasSuccessGuideItem[];
}) {
  return (
    <SectionShell id="success-guide" title="Your 30 / 60 / 90 Day Success Guide">
      <div className="grid gap-4 lg:grid-cols-3">
        {successGuide.map((item) => (
          <div
            key={item.period}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d4cff]">
              {periodLabel(item.period)}
            </p>
            <h3 className="mt-3 text-lg font-black text-slate-950">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function NextStepPathwaySection({ payload }: { payload: McasReportPayload }) {
  const pathway = payload.candidateFacing.nextStepPathway;
  const primary = payload.result.careerVertical.primary;
  const next = payload.result.careerVertical.next;

  const currentLabel = pathway?.current ?? `${primary.code} — ${primary.label}`;
  const nextLabel = pathway?.next ?? next
    ? `${next?.code} — ${next?.label}`
    : "Next stage";
  const futureLabel = pathway?.future ?? "Future growth";
  const developmentFocus = pathway?.developmentFocus ?? [];

  return (
    <SectionShell id="pathway" title="Your Next Step Pathway">
      <div className="space-y-6">
        <p className="text-base leading-7 text-slate-700">
          Growth is not about becoming a different type of person. It is about
          expanding the range and sustainability of your natural pattern.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <PathwayCard label="Now" value={currentLabel} />
          <PathwayCard label="Next Stage" value={nextLabel} />
          <PathwayCard label="Future" value={futureLabel} />
        </div>

        {developmentFocus.length > 0 ? (
          <div className="rounded-2xl border border-violet-100 bg-[#f5f1ff] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d4cff]">
              Development preparation
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {developmentFocus.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

function PathwayCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d4cff]">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function LockedFullReport({
  payload,
  token,
}: {
  payload: McasReportPayload;
  token: string;
}) {
  return (
    <main className="min-h-screen bg-[#080e1b] px-5 py-6 text-slate-950">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[30px] bg-white shadow-2xl">
        <TopHeader payload={payload} />

        <section className="bg-[#100d25] px-6 py-12 text-center text-white md:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-3xl">
              🔒
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
              Full report locked
            </p>

            <h1 className="text-3xl font-black tracking-tight md:text-5xl">
              Unlock Your Full Strategic Career Growth Report
            </h1>

            <p className="mt-5 text-base leading-7 text-violet-100">
              Your MCAS assessment has already been completed. You do not need
              to take the test again. The full report uses the same result and
              unlocks deeper guidance, blind spots, pressure patterns, and your
              30/60/90-day success guide.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={`/mcas/r/${token}/snapshot`}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-950"
              >
                Return to Snapshot
              </a>

              <a
                href="#full-preview"
                className="rounded-2xl bg-[#6d4cff] px-6 py-3 text-sm font-black text-white shadow-lg"
              >
                See What Unlocks
              </a>
            </div>
          </div>
        </section>

        <section id="full-preview" className="space-y-4 bg-[#f5f1ff] p-6 md:p-10">
          <h2 className="text-2xl font-black text-slate-950">
            What is included in the full report
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Your Work Pattern in Plain Language",
              "Your Operating Style Deep Dive",
              "Your CORE Behavioural Balance",
              "Your Strength Advantages Under Pressure",
              "Your Blind Spots and How to Manage Them",
              "Your Best Fit Work and Roles",
              "Your Career Vertical Fit Today",
              "Your 30 / 60 / 90 Day Success Guide",
              "Your Next Step Pathway",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl bg-white p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee9ff]">
                  🔒
                </span>
                <p className="font-bold text-slate-900">{item}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-600">
            The checkout/unlock flow will connect here once billing is ready. For
            now, full report access is controlled by{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              mcas.report_access.full_unlocked
            </code>
            .
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function McasFullReportPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  if (!token) {
    notFound();
  }

  let payload: McasReportPayload;

  try {
    payload = await buildMcasReportPayloadByToken(token, "full_career_growth");
  } catch (error) {
    console.error("[MCAS Full Report] Failed to build payload:", error);
    notFound();
  }

  if (!payload.access.fullUnlocked) {
    return <LockedFullReport payload={payload} token={token} />;
  }

  return (
    <main className="min-h-screen bg-[#080e1b] py-6 text-slate-950">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#080e1b] shadow-2xl">
        <TopHeader payload={payload} />
        <Hero payload={payload} />
        <TopStyleStrip items={payload.result.operatingStyle.distribution} />

        <div className="grid gap-6 px-5 py-8 md:px-8 lg:grid-cols-[260px_1fr]">
          <SidebarIndex token={token} />

          <div className="space-y-8">
            <OrientationSection />
            <PlainLanguageSection payload={payload} />
            <OperatingStyleDeepDive payload={payload} />
            <CoreBalanceSection payload={payload} />
            <PressureStrengthsSection
              strengths={payload.candidateFacing.strengths}
            />
            <BlindSpotsSection
              blindSpots={payload.candidateFacing.blindSpots ?? []}
            />
            <RolesSection roles={payload.candidateFacing.roleRecommendations} />
            <CareerVerticalSection payload={payload} />
            <SuccessGuideSection
              successGuide={payload.candidateFacing.successGuide ?? []}
            />
            <NextStepPathwaySection payload={payload} />
          </div>
        </div>
      </div>
    </main>
  );
}