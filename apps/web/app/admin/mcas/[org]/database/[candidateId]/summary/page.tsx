// apps/web/app/admin/mcas/[org]/database/[candidateId]/summary/page.tsx

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CandidateSummaryDownloadButton from "./CandidateSummaryDownloadButton";
import {
  formatMcasDateTime,
  getMcasCandidateDetailById,
  getMcasOrganisationBySlug,
  type McasCandidateDatabaseRow,
} from "@/lib/mcas/mcasAdminData";
import { getMcasCandidateReportAccess } from "@/lib/mcas/mcasCandidateReports";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    org: string;
    candidateId: string;
  };
};

type DistributionItem = {
  code: string;
  value: number;
};

type FlagItem = {
  label: string;
  severity: "low" | "medium" | "high";
};

const OS_META: Record<
  string,
  {
    name: string;
    systemFunction: string;
    interviewPrompt: string;
  }
> = {
  OS1: {
    name: "Trailblazer",
    systemFunction: "Creates direction, momentum and first movement.",
    interviewPrompt:
      "Describe a time you had to create direction with limited information. What happened after you set the course?",
  },
  OS2: {
    name: "Spark",
    systemFunction: "Activates attention, buy-in and energy around action.",
    interviewPrompt:
      "Tell us about a time you had to build momentum behind an idea that initially had limited support.",
  },
  OS3: {
    name: "Uplifter",
    systemFunction: "Builds trust, engagement and sustained human commitment.",
    interviewPrompt:
      "Describe a time you had to hold performance expectations while supporting a team under pressure.",
  },
  OS4: {
    name: "Bridgebuilder",
    systemFunction: "Aligns people, priorities and dependencies across work.",
    interviewPrompt:
      "Describe a cross-functional project with competing priorities. How did you move it to completion?",
  },
  OS5: {
    name: "Steadyhand",
    systemFunction: "Protects reliable delivery, consistency and operational stability.",
    interviewPrompt:
      "Tell us about a time you maintained delivery when circumstances changed around you.",
  },
  OS6: {
    name: "Organiser",
    systemFunction: "Builds structure, cadence and repeatable execution.",
    interviewPrompt:
      "Show us how you created a process or operating rhythm that improved reliability across a team.",
  },
  OS7: {
    name: "Analyst",
    systemFunction: "Protects evidence, quality, risk awareness and judgement.",
    interviewPrompt:
      "Walk us through a decision where your analysis materially changed the direction or reduced risk.",
  },
  OS8: {
    name: "Refiner",
    systemFunction: "Improves quality, raises standards and guides controlled change.",
    interviewPrompt:
      "Describe an improvement you led. How did you avoid over-refining and ensure the work still shipped?",
  },
};

const CORE_META: Record<
  string,
  {
    name: string;
    short: string;
    description: string;
  }
> = {
  C: {
    name: "Create",
    short: "C",
    description: "Initiates direction, ideas and forward movement.",
  },
  O: {
    name: "Organise",
    short: "O",
    description: "Aligns people, priorities and structure so work can move coherently.",
  },
  R: {
    name: "Resolve",
    short: "R",
    description: "Executes, delivers and stabilises outcomes.",
  },
  E: {
    name: "Examine",
    short: "E",
    description: "Evaluates, tests and improves quality and accuracy.",
  },
};

export default async function McasCandidateSummaryPage({ params }: PageProps) {
  const org = await getMcasOrganisationBySlug(params.org);

  if (!org) notFound();

  const candidate = await getMcasCandidateDetailById({
    orgId: org.id,
    candidateId: params.candidateId,
  });

  if (!candidate) notFound();

  const reportAccess = await getMcasCandidateReportAccess({
    orgId: org.id,
    candidateId: params.candidateId,
  });

  if (!reportAccess.isReady || !reportAccess.reportToken) {
    return (
      <main className="mcas-summary-page min-h-screen bg-[#07111E] px-6 py-10 text-white">
        <section className="mcas-summary-shell mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <Link
            href={`/admin/mcas/${org.slug}/database/${candidate.partnerApplicationId}`}
            className="mcas-summary-no-print text-sm font-semibold text-cyan-300 hover:text-cyan-200"
          >
            ← Back to candidate profile
          </Link>

          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Candidate Summary Report
          </p>

          <h1 className="mt-3 text-3xl font-semibold">
            Report not available yet
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            {reportAccess.reason ??
              "The candidate must complete the MCAS assessment before the internal summary report can be prepared."}
          </p>
        </section>
      </main>
    );
  }

  const osItems = readDistribution(candidate.rawOsDistribution);
  const coreItems = readDistribution(candidate.rawCoreDistribution);
  const primaryOs = osItems[0] ?? null;
  const secondaryOs = osItems[1] ?? null;
  const dominantOs = primaryOs
    ? getOperatingStyle(primaryOs.code)
    : {
        name: candidate.primaryOS ?? "Operating style pending",
        systemFunction: "No operating style distribution is available yet.",
        interviewPrompt:
          "Use a structured work-example interview to validate the candidate's natural execution pattern.",
      };

  const primaryCore = coreItems[0] ?? null;
  const weakestCore = coreItems[coreItems.length - 1] ?? null;
  const flags = readFlags(candidate.rawFlags);
  const risk = getRiskSummary(flags, weakestCore);
  const currentVertical = candidate.verticalReadiness ?? "Not indicated";
  const nextVertical = nextVerticalLabel(currentVertical);
  const interviewAreas = buildInterviewAreas(
    candidate,
    dominantOs,
    weakestCore,
    currentVertical
  );

  const candidateReportHref = reportAccess.candidateReportUrl ?? null;
  const backHref = `/admin/mcas/${org.slug}/database/${candidate.partnerApplicationId}`;

  return (
    <main className="mcas-summary-page min-h-screen bg-[#07111E] px-5 py-6 text-[#0D0F1C] md:px-8">
      <div className="mcas-summary-shell mx-auto max-w-[1440px] overflow-hidden rounded-[30px] bg-[#F7F8FC] shadow-2xl">
        <header className="bg-[#EDEAFF] px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link
                href={backHref}
                className="mcas-summary-no-print text-sm font-semibold text-[#6255E8] hover:text-[#4C3ED2]"
              >
                ← Back to candidate profile
              </Link>

              <p className="mt-7 text-sm font-semibold uppercase tracking-[0.24em] text-[#6255E8]">
                MindCanvas CORE Alignment System
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#191733] md:text-4xl">
                Candidate Summary Report
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Internal decision support - alignment status, operating pattern,
                readiness, risk indicators and interview validation priorities.
              </p>
            </div>

            <div className="mcas-summary-no-print flex flex-wrap gap-3 xl:justify-end">
              <CandidateSummaryDownloadButton />

              {candidateReportHref ? (
                <a
                  href={candidateReportHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-[#191733] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2B2858]"
                >
                  View Candidate Report ↗
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <MetaCard label="Prepared for" value={candidate.fullName} />
            <MetaCard
              label="Assessment date"
              value={formatMcasDateTime(candidate.assessmentDate)}
            />
            <MetaCard
              label="Framework"
              value={reportAccess.reportVersion === "full" ? "Full MCAS Report" : "Lite MCAS Report"}
            />
          </div>
        </header>

        <section className="bg-[#0B1727] px-6 py-8 text-white md:px-8">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#72E4D5]">
                Executive summary
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                Candidate pattern complete.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                MCAS has assessed this candidate&apos;s observable execution
                pattern, work-cycle coverage and current career-vertical
                readiness. Role-specific alignment remains pending until a target
                role blueprint is attached to this assessment.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Recommendation status
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                Further validation required
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Use the structured interview focus areas below before making a
                role-fit decision.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              label="Operating Style"
              value={dominantOs.name}
              detail={primaryOs ? `${formatPct(primaryOs.value)} dominant` : "Pending"}
            />
            <SummaryMetric
              label="Career Vertical"
              value={currentVertical}
              detail={nextVertical ? `${nextVertical} is the next scope step` : "Readiness signal"}
            />
            <SummaryMetric
              label="Risk Level"
              value={risk.level}
              detail={risk.detail}
            />
            <SummaryMetric
              label="Role Fit"
              value="Pending"
              detail="No role blueprint attached"
            />
          </div>
        </section>

        <div className="mcas-summary-grid grid gap-7 bg-[#F7F8FC] px-6 py-8 md:px-8">
          <ReportSection
            number="01"
            title="Operating Style Distribution and Confidence"
            subtitle="How the candidate naturally executes work."
          >
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl bg-[#F0EEFF] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6255E8]">
                  Dominant operating style
                </p>
                <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#201E41]">
                  {dominantOs.name}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {dominantOs.systemFunction}
                </p>

                {secondaryOs ? (
                  <div className="mt-6 border-t border-[#6255E8]/15 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Secondary influence
                    </p>
                    <p className="mt-2 font-semibold text-[#201E41]">
                      {getOperatingStyle(secondaryOs.code).name} - {formatPct(secondaryOs.value)}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {osItems.length > 0 ? (
                  osItems.map((item, index) => (
                    <DistributionRow
                      key={item.code}
                      label={getOperatingStyle(item.code).name}
                      value={item.value}
                      descriptor={index === 0 ? "Dominant" : index === 1 ? "Secondary" : "Supporting"}
                      accent={index === 0}
                    />
                  ))
                ) : (
                  <EmptyState text="No operating style distribution is available for this assessment." />
                )}
              </div>
            </div>
          </ReportSection>

          <ReportSection
            number="02"
            title="CORE Behavioural Balance and Work Cycle Coverage"
            subtitle="Which parts of the work cycle the candidate naturally drives, supports or undercovers."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {["C", "O", "R", "E"].map((code) => {
                const item = coreItems.find((core) => core.code.toUpperCase() === code);
                const meta = CORE_META[code];
                const isHighest = primaryCore?.code.toUpperCase() === code;
                const isLowest = weakestCore?.code.toUpperCase() === code;

                return (
                  <div
                    key={code}
                    className={[
                      "rounded-2xl border p-5",
                      isHighest
                        ? "border-[#6359F1]/30 bg-[#F0EEFF]"
                        : isLowest
                          ? "border-amber-300/40 bg-amber-50"
                          : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#201E41] text-sm font-black text-white">
                        {meta.short}
                      </span>
                      <span className="text-2xl font-black text-[#201E41]">
                        {item ? formatPct(item.value) : "—"}
                      </span>
                    </div>

                    <p className="mt-5 text-lg font-bold text-[#201E41]">{meta.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{meta.description}</p>

                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#6255E8]">
                      {isHighest ? "Strongest coverage" : isLowest ? "Support recommended" : "Supporting coverage"}
                    </p>
                  </div>
                );
              })}
            </div>
          </ReportSection>

          <ReportSection
            number="03"
            title="Role Fit Assessment"
            subtitle="Candidate pattern can only be assessed against a defined target role."
          >
            <div className="rounded-3xl border border-amber-300/40 bg-amber-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                Role blueprint required
              </p>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#3A2C10]">
                No role-specific alignment decision has been calculated.
              </h3>
              <p className="mt-4 max-w-4xl text-sm leading-6 text-[#624D20]">
                This candidate has a valid MCAS assessment, but the current test
                link does not store a target role blueprint, target vertical or
                required work-environment conditions. The system can therefore
                show candidate pattern and readiness, but it should not label the
                person aligned or misaligned to a role yet.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <RoleFitNeed label="Target role" value="Not attached" />
                <RoleFitNeed label="Target vertical" value="Not attached" />
                <RoleFitNeed label="Role environment" value="Not attached" />
              </div>
            </div>
          </ReportSection>

          <ReportSection
            number="04"
            title="Career Vertical Fit and Readiness"
            subtitle="Progression changes scope, complexity and accountability."
          >
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-3xl bg-[#0D1B2A] p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#72E4D5]">
                  Current fit
                </p>
                <p className="mt-3 text-4xl font-black">
                  {currentVertical}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  Current scoring indicates the candidate&apos;s most sustainable
                  present scope of responsibility.
                </p>

                {nextVertical ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Development horizon
                    </p>
                    <p className="mt-2 font-semibold text-white">
                      {nextVertical} - stretch with evidence and support
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((level) => (
                  <VerticalRow
                    key={level}
                    level={level}
                    currentVertical={currentVertical}
                  />
                ))}
              </div>
            </div>
          </ReportSection>

          <ReportSection
            number="05"
            title="Risk Flags and Sustainability Notes"
            subtitle="Predictable conditions that should be validated before placement."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {risk.items.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.17em] text-rose-700">
                    {item.category}
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-[#3E1521]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#6A3340]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </ReportSection>

          <ReportSection
            number="06"
            title="Suggested Interview Focus Areas"
            subtitle="Use these structured prompts to validate evidence, not to confirm a label."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {interviewAreas.map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#6255E8]/20 bg-[#F7F6FF] p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6255E8] text-sm font-black text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#6255E8]">
                        Validation area
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-[#201E41]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {item.question}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>

        <footer className="mcas-summary-no-print bg-[#0D1B2A] px-6 py-8 text-white md:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-bold">Use this as decision support, not a verdict.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                MCAS explains observable work patterns, readiness and likely
                sustainability conditions. It does not measure intelligence,
                mental health, morality or personal worth.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <CandidateSummaryDownloadButton />
              <Link
                href={backHref}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Back to Profile
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#6255E8]/12 bg-white/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-[#201E41]">{value}</p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
    </div>
  );
}

function ReportSection({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.06)] md:p-8">
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6255E8]">
            Section {number}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#201E41]">
            {title}
          </h2>
        </div>

        <p className="max-w-xl text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>

      {children}
    </section>
  );
}

function DistributionRow({
  label,
  value,
  descriptor,
  accent,
}: {
  label: string;
  value: number;
  descriptor: string;
  accent: boolean;
}) {
  const percentage = percentageValue(value);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-[#201E41]">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{descriptor}</p>
        </div>
        <p className="text-lg font-black text-[#201E41]">{formatPct(value)}</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={accent ? "h-full rounded-full bg-[#6255E8]" : "h-full rounded-full bg-[#86D7CD]"}
          style={{ width: `${Math.max(3, Math.min(100, percentage))}%` }}
        />
      </div>
    </div>
  );
}

function VerticalRow({
  level,
  currentVertical,
}: {
  level: number;
  currentVertical: string;
}) {
  const currentLevel = readVerticalNumber(currentVertical);
  const status =
    currentLevel === level
      ? "Current fit"
      : currentLevel !== null && level === currentLevel + 1
        ? "Stretch with support"
        : currentLevel !== null && level < currentLevel
          ? "Completed foundation"
          : "Not indicated";

  const style =
    status === "Current fit"
      ? "border-[#6255E8]/30 bg-[#F0EEFF] text-[#201E41]"
      : status === "Stretch with support"
        ? "border-cyan-300/40 bg-cyan-50 text-[#184B59]"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${style}`}>
      <div className="flex items-center gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#201E41] text-sm font-black text-white">
          V{level}
        </span>
        <div>
          <p className="font-semibold">Vertical {level}</p>
          <p className="mt-1 text-xs opacity-75">{verticalDescription(level)}</p>
        </div>
      </div>

      <span className="text-xs font-semibold uppercase tracking-[0.12em]">
        {status}
      </span>
    </div>
  );
}

function RoleFitNeed({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/40 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
        {label}
      </p>
      <p className="mt-2 font-semibold text-[#3A2C10]">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}

function readDistribution(value: unknown): DistributionItem[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!isRecord(item)) return null;

        const code =
          asString(item.code) ??
          asString(item.key) ??
          asString(item.label) ??
          asString(item.name);

        const rawValue =
          asNumber(item.pct) ??
          asNumber(item.percentage) ??
          asNumber(item.percent) ??
          asNumber(item.score) ??
          asNumber(item.value) ??
          asNumber(item.count);

        if (!code || rawValue === null) return null;

        return { code, value: rawValue };
      })
      .filter((item): item is DistributionItem => item !== null)
      .sort((a, b) => b.value - a.value);
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([code, rawValue]) => {
        if (typeof rawValue === "number") {
          return { code, value: rawValue };
        }

        if (typeof rawValue === "string") {
          const parsed = Number(rawValue);

          return Number.isFinite(parsed) ? { code, value: parsed } : null;
        }

        if (isRecord(rawValue)) {
          const nestedCode =
            asString(rawValue.code) ??
            asString(rawValue.key) ??
            asString(rawValue.label) ??
            code;

          const nestedValue =
            asNumber(rawValue.pct) ??
            asNumber(rawValue.percentage) ??
            asNumber(rawValue.percent) ??
            asNumber(rawValue.score) ??
            asNumber(rawValue.value) ??
            asNumber(rawValue.count);

          return nestedValue === null
            ? null
            : { code: nestedCode, value: nestedValue };
        }

        return null;
      })
      .filter((item): item is DistributionItem => item !== null)
      .sort((a, b) => b.value - a.value);
  }

  return [];
}

function readFlags(value: unknown): FlagItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          label: humanise(item),
          severity: "low" as const,
        };
      }

      if (!isRecord(item)) return null;

      const label =
        asString(item.label) ??
        asString(item.code) ??
        asString(item.name);

      if (!label) return null;

      const rawSeverity = asString(item.severity)?.toLowerCase();

      const severity: FlagItem["severity"] =
        rawSeverity === "high" || rawSeverity === "medium" || rawSeverity === "low"
          ? rawSeverity
          : "low";

      return {
        label: humanise(label),
        severity,
      };
    })
    .filter((item): item is FlagItem => item !== null);
}

function getOperatingStyle(code: string) {
  return (
    OS_META[code.toUpperCase()] ?? {
      name: humanise(code),
      systemFunction: "Execution pattern recorded by the MCAS assessment.",
      interviewPrompt:
        "Describe a complex work situation where your usual way of working was tested. What did you do and what evidence shows the outcome?",
    }
  );
}

function getRiskSummary(
  flags: FlagItem[],
  weakestCore: DistributionItem | null
) {
  const high = flags.some((flag) => flag.severity === "high");
  const medium = flags.some((flag) => flag.severity === "medium");

  const level = high ? "Elevated" : medium ? "Moderate" : "Low";
  const detail =
    high || medium
      ? `${flags.length} scored flag${flags.length === 1 ? "" : "s"} to validate`
      : "No critical scored flags";

  const items: Array<{
    category: string;
    title: string;
    detail: string;
  }> = flags.map((flag) => ({
    category: `${flag.severity} priority`,
    title: flag.label,
    detail:
      "Validate the underlying evidence through work examples, references and role-specific interview questions.",
  }));

  if (weakestCore) {
    const core = CORE_META[weakestCore.code.toUpperCase()];

    if (core) {
      items.push({
        category: "Work-cycle coverage",
        title: `Lower ${core.name} coverage`,
        detail: `The current score suggests ${core.name.toLowerCase()} work may need clearer support, structure or validation in a demanding role environment.`,
      });
    }
  }

  if (items.length === 0) {
    items.push({
      category: "Validation note",
      title: "No scored risk flags returned",
      detail:
        "Use the interview to validate the fit between the candidate's natural execution pattern and the actual role context.",
    });
  }

  return {
    level,
    detail,
    items: items.slice(0, 4),
  };
}

function buildInterviewAreas(
  candidate: McasCandidateDatabaseRow,
  primaryOs: {
    name: string;
    systemFunction: string;
    interviewPrompt: string;
  },
  weakestCore: DistributionItem | null,
  currentVertical: string
) {
  const weakestMeta =
    weakestCore ? CORE_META[weakestCore.code.toUpperCase()] : null;

  return [
    {
      title: `${primaryOs.name} execution pattern`,
      question: primaryOs.interviewPrompt,
    },
    {
      title: "Scope and accountability",
      question: `Tell us about a time the scope of your role expanded. How did you decide what to own, what to delegate and where to ask for support? This should validate readiness around ${currentVertical}.`,
    },
    {
      title: weakestMeta
        ? `${weakestMeta.name} coverage`
        : "Work-cycle coverage",
      question: weakestMeta
        ? `Walk us through a situation requiring strong ${weakestMeta.name.toLowerCase()} work. What was your method, where did you seek support and how did you confirm quality?`
        : "Describe a complex project that required you to work outside your natural strengths. How did you protect quality and delivery?",
    },
    {
      title: "Role-environment fit",
      question: `What work environment brings out your best contribution, and what conditions make it harder to sustain performance? Ask for evidence from recent roles, not preferences alone.`,
    },
  ];
}

function nextVerticalLabel(value: string): string | null {
  const current = readVerticalNumber(value);

  if (!current || current >= 6) return null;

  return `V${current + 1}`;
}

function readVerticalNumber(value: string): number | null {
  const match = value.match(/V\s?([1-6])/i);

  return match ? Number(match[1]) : null;
}

function verticalDescription(level: number) {
  const labels: Record<number, string> = {
    1: "Guided delivery and foundational work.",
    2: "Growing ownership within structured scope.",
    3: "Independent delivery and cross-team coordination.",
    4: "Broader scope, strategic influence and accountability.",
    5: "Organisation-level direction and system leadership.",
    6: "Enterprise scope and long-horizon accountability.",
  };

  return labels[level] ?? "Career vertical progression.";
}

function formatPct(value: number): string {
  return `${Math.round(percentageValue(value))}%`;
}

function percentageValue(value: number): number {
  return value <= 1 ? value * 100 : value;
}

function humanise(value: string): string {
  return value
    .replace(/^OS(\d)$/i, "Operating Style $1")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}