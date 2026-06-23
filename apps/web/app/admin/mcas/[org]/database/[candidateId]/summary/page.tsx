// apps/web/app/admin/mcas/[org]/database/[candidateId]/summary/page.tsx

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CandidateSummaryDownloadButton from "./CandidateSummaryDownloadButton";
import {
  formatMcasDateTime,
  getMcasCandidateDetailById,
  getMcasOrganisationBySlug,
} from "@/lib/mcas/mcasAdminData";
import { getMcasCandidateReportAccess } from "@/lib/mcas/mcasCandidateReports";
import { buildMcasReportPayloadByApplicationId } from "@/lib/mcas/reportPayload";
import {
  getMcasInternalReportContent,
  type McasInternalReportContent,
} from "@/lib/mcas/mcasInternalReportContent";
import type {
  McasCoreCode,
  McasDistributionItem,
  McasOperatingStyleCode,
  McasReportPayload,
} from "@/lib/mcas/reportTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    org: string;
    candidateId: string;
  };
};

const OS_COLOURS: Record<McasOperatingStyleCode, string> = {
  OS1: "#300993",
  OS2: "#9554F8",
  OS3: "#FD464A",
  OS4: "#F86B04",
  OS5: "#047D7B",
  OS6: "#4F46E5",
  OS7: "#F7B955",
  OS8: "#DB2777",
};

const OS_TAGLINES: Record<McasOperatingStyleCode, string> = {
  OS1: "Moves first",
  OS2: "Creates momentum",
  OS3: "Raises people",
  OS4: "Connects systems",
  OS5: "Stabilises delivery",
  OS6: "Builds structure",
  OS7: "Protects quality",
  OS8: "Improves systems",
};

const OS_NAMES: Record<McasOperatingStyleCode, string> = {
  OS1: "Visionary",
  OS2: "Catalyst",
  OS3: "Motivator",
  OS4: "Connector",
  OS5: "Facilitator",
  OS6: "Coordinator",
  OS7: "Controller",
  OS8: "Optimiser",
};

/*
 * Internal MCAS labels map to the existing visual assets:
 * Visionary → Trailblazer, Catalyst → Spark, Motivator → Uplifter,
 * Connector → Bridgebuilder, Facilitator → Steadyhand,
 * Coordinator → Organiser, Controller → Analyst, Optimiser → Refiner.
 */
const OS_PROFILE_IMAGES: Record<McasOperatingStyleCode, string> = {
  OS1: "/mcas/profile-cards/visionary.png",
  OS2: "/mcas/profile-cards/catalyst.png",
  OS3: "/mcas/profile-cards/motivator.png",
  OS4: "/mcas/profile-cards/connector.png",
  OS5: "/mcas/profile-cards/facilitator.png",
  OS6: "/mcas/profile-cards/coordinator.png",
  OS7: "/mcas/profile-cards/controller.png",
  OS8: "/mcas/profile-cards/optimiser.png",
};

/*
 * The internal Candidate Summary follows the MCAS Knowledge Base naming:
 * Visionary, Catalyst, Motivator, Connector, Facilitator, Coordinator,
 * Controller and Optimiser.
 */
const INTERNAL_OS_LABELS: Record<McasOperatingStyleCode, string> = {
  OS1: "Visionary",
  OS2: "Catalyst",
  OS3: "Motivator",
  OS4: "Connector",
  OS5: "Facilitator",
  OS6: "Coordinator",
  OS7: "Controller",
  OS8: "Optimiser",
};

const SUMMARY_OS_COLOURS: Record<McasOperatingStyleCode, string> = {
  OS1: "#2B019E",
  OS2: "#FD2527",
  OS3: "#EF6001",
  OS4: "#0049F9",
  OS5: "#0F7B6C",
  OS6: "#4338CA",
  OS7: "#B45309",
  OS8: "#DB2777",
};

const CORE_COPY: Record<
  McasCoreCode,
  {
    letter: string;
    copy: string;
  }
> = {
  CREATE: {
    letter: "C",
    copy: "Introduces direction, possibility and forward movement.",
  },
  ORGANISE: {
    letter: "O",
    copy: "Brings people, priorities and structure into alignment.",
  },
  RESOLVE: {
    letter: "R",
    copy: "Closes gaps, delivers outcomes and stabilises execution.",
  },
  EXAMINE: {
    letter: "E",
    copy: "Protects judgement, quality, evidence and improvement.",
  },
};


type CareerVerticalStep = {
  code: "V1" | "V2" | "V3" | "V4" | "V5" | "V6";
  title: string;
  description: string;
};

type CareerVerticalRowState = {
  label: string;
  rowClass: string;
  circleClass: string;
  badgeClass: string;
  barClass: string;
  barWidth: string;
};

const CAREER_VERTICAL_STEPS: CareerVerticalStep[] = [
  {
    code: "V1",
    title: "Entry / Foundational",
    description: "Task-level execution and guided delivery.",
  },
  {
    code: "V2",
    title: "Developing",
    description: "Growing ownership with structured guidance.",
  },
  {
    code: "V3",
    title: "Established",
    description: "Independent delivery and cross-team coordination.",
  },
  {
    code: "V4",
    title: "Senior Scope",
    description: "Strategic influence and broader accountability.",
  },
  {
    code: "V5",
    title: "Strategic Leadership",
    description: "Organisation-wide direction and system leadership.",
  },
  {
    code: "V6",
    title: "Executive / Enterprise",
    description: "Enterprise leadership and long-horizon strategy.",
  },
];

function verticalNumber(code: string | null | undefined): number {
  const match = String(code ?? "").toUpperCase().match(/V([1-6])/);

  return match ? Number(match[1]) : 0;
}

function getCareerVerticalRowState({
  rowCode,
  currentCode,
  nextCode,
}: {
  rowCode: CareerVerticalStep["code"];
  currentCode: string;
  nextCode: string | null;
}): CareerVerticalRowState {
  const rowLevel = verticalNumber(rowCode);
  const currentLevel = verticalNumber(currentCode);
  const nextLevel = verticalNumber(nextCode);

  if (rowLevel < currentLevel) {
    return {
      label: "Completed",
      rowClass: "border-slate-200 bg-white",
      circleClass: "border-violet-200 bg-violet-50 text-violet-700",
      badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
      barClass: "bg-violet-500",
      barWidth: "100%",
    };
  }

  if (rowLevel === currentLevel) {
    return {
      label: "Current Fit",
      rowClass: "border-[#6F5CFF] bg-[#F0EEFF]",
      circleClass: "border-[#201E41] bg-[#201E41] text-white",
      badgeClass: "border-[#201E41] bg-[#201E41] text-white",
      barClass: "bg-[#6F5CFF]",
      barWidth: "100%",
    };
  }

  if (nextLevel && rowLevel === nextLevel) {
    return {
      label: "Stretch with support",
      rowClass: "border-cyan-300 bg-cyan-50",
      circleClass: "border-cyan-300 bg-cyan-50 text-cyan-800",
      badgeClass: "border-cyan-300 bg-cyan-50 text-cyan-800",
      barClass: "bg-cyan-400",
      barWidth: "38%",
    };
  }

  if (nextLevel && rowLevel === nextLevel + 1) {
    return {
      label: "Overreach risk",
      rowClass: "border-amber-300 bg-amber-50",
      circleClass: "border-amber-300 bg-amber-50 text-amber-800",
      badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
      barClass: "bg-amber-300",
      barWidth: "10%",
    };
  }

  return {
    label: "Not indicated",
    rowClass: "border-slate-200 bg-slate-50",
    circleClass: "border-slate-200 bg-slate-100 text-slate-500",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-500",
    barClass: "bg-slate-300",
    barWidth: "0%",
  };
}

export default async function McasCandidateSummaryPage({ params }: PageProps) {
  const org = await getMcasOrganisationBySlug(params.org);

  if (!org) {
    notFound();
  }

  const candidate = await getMcasCandidateDetailById({
    orgId: org.id,
    candidateId: params.candidateId,
  });

  if (!candidate) {
    notFound();
  }

  const reportAccess = await getMcasCandidateReportAccess({
    orgId: org.id,
    candidateId: params.candidateId,
  });

  if (!reportAccess.isReady) {
    return (
      <ReportUnavailable
        orgSlug={org.slug}
        candidateId={candidate.partnerApplicationId}
        candidateName={candidate.fullName}
        reason={reportAccess.reason ?? "The assessment has not been scored yet."}
      />
    );
  }

  let payload: McasReportPayload;

  try {
    payload = await buildMcasReportPayloadByApplicationId(
      candidate.partnerApplicationId,
      "internal_decision"
    );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "The report payload could not be prepared.";

    return (
      <ReportUnavailable
        orgSlug={org.slug}
        candidateId={candidate.partnerApplicationId}
        candidateName={candidate.fullName}
        reason={reason}
      />
    );
  }

  const primaryOs = payload.result.operatingStyle.primary;
  const primaryVertical = payload.result.careerVertical.primary;
  const confidencePercent =
    payload.result.confidence.score ?? primaryOs.percentage;
  const riskLevel =
    payload.internal?.riskLevel ?? inferRiskLevel(payload.result.flags);
  const content = getMcasInternalReportContent(payload);
  const nextVertical = getNextVertical(primaryVertical.code);

  const candidateReportHref = reportAccess.candidateReportUrl;

  return (
    <main className="mcas-summary-page min-h-screen bg-[#090B18] py-6 text-[#171429]">
      <div className="mcas-summary-shell mx-auto max-w-[1440px] overflow-hidden rounded-[30px] bg-[#0D0F1C] shadow-2xl">
        <ReportHeader
          payload={payload}
          candidateReportHref={candidateReportHref}
          candidateReportLabel={reportAccess.candidateReportLabel}
        />

        <Hero
          payload={payload}
          confidencePercent={confidencePercent}
          riskLevel={riskLevel}
          content={content}
        />

        <div className="mcas-summary-layout grid gap-6 px-6 py-8 md:px-8 lg:grid-cols-[265px_minmax(0,1fr)]">
          <Sidebar />

          <div className="space-y-8">
            <WelcomeSection
              candidateName={payload.candidate.fullName}
              content={content}
            />
            <HowToUseSection />
            <McasModelSection />
            <OperatingStyleIdentitySection payload={payload} content={content} />
            <OperatingStyleDistributionSection payload={payload} content={content} />
            <CoreBalanceSection payload={payload} content={content} />
            <CareerVerticalSection
              current={primaryVertical.code}
              next={nextVertical}
              readinessLabel={payload.result.careerVertical.readinessLabel}
            />
            <RiskSection payload={payload} content={content} risks={content.risks} />
            <InterviewSection items={content.interviewFocus} />
          </div>
        </div>
      </div>
    </main>
  );
}

function ReportUnavailable({
  orgSlug,
  candidateId,
  candidateName,
  reason,
}: {
  orgSlug: string;
  candidateId: string;
  candidateName: string;
  reason: string;
}) {
  return (
    <main className="min-h-screen bg-[#090B18] px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <Link
          href={`/admin/mcas/${orgSlug}/database/${candidateId}`}
          className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
        >
          ← Back to candidate profile
        </Link>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Candidate Summary Report
        </p>

        <h1 className="mt-3 text-3xl font-semibold">
          {candidateName}&apos;s report is not ready yet
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          {reason}
        </p>
      </section>
    </main>
  );
}

function ReportHeader({
  payload,
  candidateReportHref,
  candidateReportLabel,
}: {
  payload: McasReportPayload;
  candidateReportHref: string | null;
  candidateReportLabel: string | null;
}) {
  return (
    <header className="border-b border-[#DDD9F5] bg-[#EEEAFE] px-5 py-4 md:px-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded-md bg-[#CFC8FF]" />

          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.16em] text-[#6255E8] md:text-base">
              Candidate Summary &amp; Report
            </h1>
            <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.24em] text-[#2B2858]">
              MindCanvas MCAS
            </p>
          </div>
        </div>

        <div className="mcas-summary-no-print flex flex-wrap items-center gap-2">
          <CandidateSummaryDownloadButton className="rounded-md px-4 py-2 text-[11px]" />

          {candidateReportHref ? (
            <a
              href={candidateReportHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-[#1A1836] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#2B2858]"
            >
              {candidateReportLabel ?? "View Candidate Report"} ↗
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CompactMetaCard label="Prepared for" value={payload.candidate.fullName} />
        <CompactMetaCard
          label="Date"
          value={formatMcasDateTime(payload.assessment.completedAt)}
        />
        <CompactMetaCard label="Framework" value="Candidate Summary & Report" />
      </div>
    </header>
  );
}

function CompactMetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#DFDDF1] bg-white/75 px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-[0.17em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#201E41]">{value}</p>
    </div>
  );
}

function Hero({
  payload,
  confidencePercent,
  riskLevel,
  content,
}: {
  payload: McasReportPayload;
  confidencePercent: number;
  riskLevel: "low" | "moderate" | "high";
  content: McasInternalReportContent;
}) {
  const primary = payload.result.operatingStyle.primary;
  const secondary = payload.result.operatingStyle.secondary;
  const vertical = payload.result.careerVertical.primary;
  const nextVertical = getNextVertical(vertical.code);

  return (
    <>
      <section className="bg-[#171331] px-5 py-4 text-white md:px-7 md:py-5">
        <div className="grid gap-4 xl:grid-cols-[250px_minmax(430px,1fr)_185px] xl:items-stretch">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.24em] text-[#8F88FF]">
              Candidate Summary &amp; Report
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.045em] text-white md:text-[28px]">
              {payload.candidate.fullName}
            </h2>

            <p className="mt-2 text-[10px] leading-4 text-slate-300">
              Structured decision support — operating style, vertical readiness
              and sustainability indicators.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <OverviewMetric
                label="Operating Style"
                value={INTERNAL_OS_LABELS[primary.code]}
                detail="Dominant Profile"
                tone="violet"
              />
              <OverviewMetric
                label="Vertical"
                value={`${vertical.code} Ready`}
                detail="Current Fit Range"
                tone="cyan"
              />
              <div className="col-span-2">
                <OverviewMetric
                  label="Risk Level"
                  value={humaniseRisk(riskLevel)}
                  detail={
                    riskLevel === "low"
                      ? "No critical flags"
                      : "Validate indicators"
                  }
                  tone={
                    riskLevel === "high"
                      ? "rose"
                      : riskLevel === "moderate"
                        ? "amber"
                        : "cyan"
                  }
                />
              </div>
            </div>
          </div>

          <div className="h-full min-h-[236px] rounded-lg bg-white p-3 text-[#0D1B2A] shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
            <div className="flex h-full flex-col justify-between gap-1.5">
              {payload.result.operatingStyle.distribution.map((item) => (
                <OverviewDistributionRow key={item.code} item={item} />
              ))}
            </div>
          </div>

          <div className="flex h-full min-h-[236px] flex-col items-center justify-center rounded-lg bg-white px-3 py-3 text-center shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
            <p className="mb-2 text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
              Dominant Operating Style
            </p>

            <OverviewOperatingStyleRing
              percentage={Math.round(primary.percentage)}
              label={INTERNAL_OS_LABELS[primary.code]}
              colour={SUMMARY_OS_COLOURS[primary.code]}
            />

            <p className="mt-2 text-[9px] font-semibold text-slate-500">
              {Math.round(confidencePercent)}% confidence
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E2E8F0] bg-[#F7F8FA] px-5 py-3 md:px-7">
        <div className="grid gap-y-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-y-0">
          {payload.result.operatingStyle.distribution
            .slice(0, 4)
            .map((item, index) => (
              <TopStyleStripItem
                key={item.code}
                item={item}
                index={index}
              />
            ))}
        </div>
      </section>

      <section className="bg-[#06111D] px-5 py-4 text-white md:px-7 md:py-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <HeroSnapshotCard
            icon="◉"
            label="Operating Style"
            title={INTERNAL_OS_LABELS[primary.code]}
            copy={`Dominant execution pattern.${
              secondary
                ? ` Secondary ${
                    INTERNAL_OS_LABELS[secondary.code]
                  } influence at ${Math.round(secondary.percentage)}% confidence.`
                : ""
            }`}
          />

          <HeroSnapshotCard
            icon="↗"
            label="Vertical Readiness"
            title={`${vertical.code} Ready`}
            copy={`Current vertical result indicates ${vertical.code} scope.${
              nextVertical
                ? ` Stretch indicators toward ${nextVertical} with support.`
                : " Enterprise-scope readiness indicated."
            }`}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <CompactHeroInsightSection
            title="Top strengths"
            items={content.primary.strengths}
          />

          <CompactHeroInsightSection
            title="Key risks"
            items={content.risks.slice(0, 2).map((risk) => {
              const firstSentence = risk.detail.split(".")[0]?.trim();

              return firstSentence
                ? `${risk.title} — ${firstSentence}`
                : risk.title;
            })}
          />
        </div>

        <p className="mt-3 text-[10px] leading-4 text-slate-400">
          Pattern confidence:{" "}
          <span className="font-semibold text-slate-200">
            {Math.round(confidencePercent)}%
          </span>
          {" · "}
          Risk level:{" "}
          <span className="font-semibold text-slate-200">
            {humaniseRisk(riskLevel)}
          </span>
        </p>
      </section>
    </>
  );
}

function ProfileIconBadge({
  code,
  size = "md",
}: {
  code: McasOperatingStyleCode;
  size?: "sm" | "md";
}) {
  const sizeClasses =
    size === "sm"
      ? "h-6 w-6 rounded-[7px]"
      : "h-9 w-9 rounded-[9px]";

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-white shadow-[0_3px_8px_rgba(15,23,42,0.10)]",
        sizeClasses,
      ].join(" ")}
    >
      <img
        src={OS_PROFILE_IMAGES[code]}
        alt={`${INTERNAL_OS_LABELS[code]} operating style`}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "rose" | "slate" | "violet" | "cyan";
}) {
  const palette = {
    emerald: "border-emerald-300/20 bg-[#2A284F] text-emerald-100",
    amber: "border-amber-300/30 bg-[#2D2A2A] text-amber-100",
    rose: "border-rose-300/30 bg-[#34232C] text-rose-100",
    slate: "border-white/15 bg-[#2B284C] text-white",
    violet: "border-violet-300/20 bg-[#2B284C] text-violet-100",
    cyan: "border-cyan-300/25 bg-[#203248] text-cyan-100",
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-2.5 ${palette}`}>
      <p className="text-[8px] font-black uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-black leading-none tracking-[-0.03em]">
        {value}
      </p>
      <p className="mt-1.5 text-[9px] leading-3.5 opacity-80">{detail}</p>
    </div>
  );
}

function OverviewDistributionRow({
  item,
}: {
  item: McasDistributionItem<McasOperatingStyleCode>;
}) {
  const colour = SUMMARY_OS_COLOURS[item.code];

  return (
    <div className="grid min-h-[23px] grid-cols-[30px_minmax(68px,0.75fr)_minmax(85px,1.55fr)_28px_54px] items-center gap-2">
      <ProfileIconBadge code={item.code} size="sm" />

      <span className="truncate text-[10px] font-semibold text-[#0D1B2A]">
        {INTERNAL_OS_LABELS[item.code]}
      </span>

      <span className="h-[4px] overflow-hidden rounded-full bg-[#E2E8F0]">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, item.percentage))}%`,
            background: colour,
          }}
        />
      </span>

      <span className="text-right text-[8px] font-bold text-[#4A5568]">
        {Math.round(item.percentage)}%
      </span>

      <span
        className="justify-self-end rounded px-1 py-0.5 text-[7px] font-black uppercase tracking-[0.05em]"
        style={{
          color: colour,
          background: `${colour}18`,
        }}
      >
        {distributionBandLabel(item.band)}
      </span>
    </div>
  );
}

function OverviewOperatingStyleRing({
  percentage,
  label,
  colour,
}: {
  percentage: number;
  label: string;
  colour: string;
}) {
  const safePercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div
      className="flex h-[86px] w-[86px] items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${colour} 0 ${safePercentage}%, #E8EAF2 ${safePercentage}% 100%)`,
      }}
    >
      <div className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-white">
        <span className="text-lg font-black tracking-[-0.05em] text-[#6F5CFF]">
          {safePercentage}%
        </span>
        <span className="mt-0.5 max-w-[54px] text-center text-[8px] font-semibold leading-3 text-[#4A5568]">
          {label}
        </span>
      </div>
    </div>
  );
}

function TopStyleStripItem({
  item,
  index,
}: {
  item: McasDistributionItem<McasOperatingStyleCode>;
  index: number;
}) {
  const colour = SUMMARY_OS_COLOURS[item.code];

  return (
    <div
      className={[
        "flex min-w-0 items-center gap-3 px-2 py-1.5",
        "xl:border-r xl:border-[#E2E8F0] xl:px-5",
        index === 3 ? "xl:border-r-0" : "",
      ].join(" ")}
    >
      <ProfileIconBadge code={item.code} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[#0D1B2A]">
          {INTERNAL_OS_LABELS[item.code]}
        </p>

        <div className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-[#E2E8F0]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.min(100, item.percentage))}%`,
              background: colour,
            }}
          />
        </div>

        <p
          className="mt-1.5 text-[10px] font-semibold"
          style={{ color: colour }}
        >
          {Math.round(item.percentage)}% · {distributionBandLabel(item.band)}
        </p>
      </div>
    </div>
  );
}

function HeroSnapshotCard({
  icon,
  label,
  title,
  copy,
}: {
  icon: string;
  label: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#6F5CFF] bg-[#EEEAFE] p-4 text-[#0D1B2A] shadow-[0_5px_15px_rgba(0,0,0,0.16)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#6F5CFF]" />

      <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#6F5CFF] text-base font-black text-white">
        {icon}
      </span>

      <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#718096]">
        {label}
      </p>

      <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#0D1B2A]">
        {title}
      </h3>

      <p className="mt-2 max-w-[340px] text-[11px] leading-5 text-[#4A5568]">
        {copy}
      </p>
    </div>
  );
}

function CompactHeroInsightSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section>
      <div className="border-b border-[#0FCD5E] pb-2">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0FCD5E]">
          {title}
        </p>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {items.slice(0, 3).map((item) => (
          <div
            key={item}
            className="flex gap-2 text-[10px] leading-4 text-slate-200"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0FCD5E]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function distributionBandLabel(
  band: McasDistributionItem<McasOperatingStyleCode>["band"]
) {
  switch (band) {
    case "dominant":
      return "Dominant";
    case "secondary":
      return "Secondary";
    case "tertiary":
      return "Tertiary";
    case "low":
      return "Low";
    default:
      return "Minimal";
  }
}

function Sidebar() {
  const links = [
    ["welcome", "Welcome from MindCanvas"],
    ["how-to-use", "How to use this report"],
    ["mcas-model", "Introducing the MCAS Model"],
    ["operating-identity", "Operating Style Identity System"],
    ["operating-distribution", "Operating Style Distribution and Confidence"],
    ["core-balance", "CORE Behavioural Balance and Work Cycle Coverage"],
    ["vertical-readiness", "Career Vertical Fit and Readiness"],
    ["risk-flags", "Risk Flags and Sustainability Notes"],
    ["interview-focus", "Suggested Interview Focus Areas"],
  ];

  return (
    <aside className="mcas-summary-no-print h-fit rounded-3xl border border-white/10 bg-[#1C1A3A] p-5 text-white lg:sticky lg:top-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#73E8D7]">
        Report Index
      </p>

      <nav className="mt-5 space-y-2">
        {links.map(([id, label], index) => (
          <a
            key={id}
            href={`#${id}`}
            className="block rounded-xl border border-white/15 px-4 py-3 text-sm leading-5 text-white transition hover:border-[#73E8D7]/60 hover:bg-white/[0.07]"
          >
            {index + 1}. {label}
          </a>
        ))}
      </nav>

      <div className="mt-5">
        <CandidateSummaryDownloadButton className="w-full" />
      </div>
    </aside>
  );
}

function WelcomeSection({
  candidateName,
  content,
}: {
  candidateName: string;
  content: McasInternalReportContent;
}) {
  return (
    <ReportSection
      id="welcome"
      icon="/mcas/report-icons/welcome-icon.png"
      eyebrow="01 · Welcome"
      title={`Welcome, ${candidateName}`}
    >
      <p className="max-w-5xl text-sm leading-7 text-slate-700">
        This internal MCAS report is designed to support a structured hiring,
        placement or progression conversation. It explains the candidate&apos;s
        natural execution pattern, CORE work-cycle coverage and likely current
        career-vertical fit. It should be read alongside role context,
        work-history evidence and a structured interview — never as a standalone
        judgement.
      </p>

      <div className="mt-6 rounded-2xl border border-[#6255E8]/15 bg-[#F7F6FF] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6255E8]">
          Candidate pattern in context
        </p>
        <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-700">
          {content.executiveSummary}
        </p>
      </div>
    </ReportSection>
  );
}

function HowToUseSection() {
  return (
    <ReportSection
      id="how-to-use"
      icon="/mcas/report-icons/how-to-use-this-report.png"
      eyebrow="02 · How to use this report"
      title="Use pattern data to improve the quality of the decision"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <InfoTile
          number="01"
          title="Read the pattern"
          copy="Start with how the candidate naturally moves work, rather than treating any Operating Style as better or worse."
        />
        <InfoTile
          number="02"
          title="Check the role context"
          copy="Compare the candidate against the role's required work cycle, operating environment and career-vertical scope."
        />
        <InfoTile
          number="03"
          title="Validate evidence"
          copy="Use the interview prompts to test real examples, especially where a role requires behaviour outside the candidate's dominant pattern."
        />
      </div>
    </ReportSection>
  );
}

function McasModelSection() {
  return (
    <ReportSection
      id="mcas-model"
      icon="/mcas/report-icons/learn-about-mcas.png"
      eyebrow="03 · Introducing the MCAS model"
      title="MCAS connects three layers of sustainable performance"
    >
      <div className="space-y-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-[#F7F8FA] p-4 sm:p-6">
          <img
            src="/mcas/graphics/mcas-model.png"
            alt="MCAS model showing Career Vertical, Operating Style and CORE Behaviour"
            className="mx-auto h-auto w-full max-w-[900px] object-contain"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ModelCard
            title="CORE"
            copy="Shows which parts of the work cycle a candidate naturally drives, supports or undercovers."
          />
          <ModelCard
            title="Operating Style"
            copy="Shows the candidate's most natural pattern for creating value and moving work forward."
          />
          <ModelCard
            title="Career Vertical"
            copy="Shows the level of scope, ambiguity and accountability the candidate can currently sustain."
          />
        </div>
      </div>
    </ReportSection>
  );
}

function OperatingStyleIdentitySection({
  payload,
}: {
  payload: McasReportPayload;
  content: McasInternalReportContent;
}) {
  const primaryCode = payload.result.operatingStyle.primary.code;

  return (
    <ReportSection
      id="operating-identity"
      icon="/mcas/report-icons/operating-style-identity-system.png"
      eyebrow="04 · Operating style identity system"
      title="The operating style reveals how the candidate naturally executes work"
    >
      <p className="max-w-5xl text-sm leading-7 text-slate-700">
        The distribution below reflects scored pattern strength, not a ranking
        against other people. Every Operating Style performs a different system
        function; sustainable fit depends on whether that function is needed in
        the role and environment.
      </p>

      <div className="mt-6 flex min-h-[300px] items-center justify-center overflow-hidden rounded-2xl bg-[#F7F8FA] p-4 sm:min-h-[360px] sm:p-6">
        <img
          src="/mcas/graphics/operating-style-system.png"
          alt="Operating Style Identity System showing all eight profiles"
          className="h-auto max-h-[360px] w-auto max-w-full object-contain"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(OS_NAMES) as McasOperatingStyleCode[]).map((code) => {
          const active = code === primaryCode;

          return (
            <div
              key={code}
              className={[
                "rounded-2xl border p-5 transition",
                active
                  ? "border-[#6F5CFF]/55 bg-[#F0EEFF] ring-1 ring-[#6F5CFF]/25"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={[
                    "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl",
                    active
                      ? "bg-white shadow-[0_5px_14px_rgba(79,70,229,0.16)]"
                      : "bg-[#F7F8FA]",
                  ].join(" ")}
                >
                  <img
                    src={OS_PROFILE_IMAGES[code]}
                    alt={`${OS_NAMES[code]} operating style`}
                    className="h-full w-full object-contain"
                  />
                </div>

                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white"
                  style={{ background: OS_COLOURS[code] }}
                >
                  {code.replace("OS", "")}
                </span>
              </div>

              <p className="mt-5 text-base font-bold text-[#201E41]">
                {OS_NAMES[code]}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {OS_TAGLINES[code]}
              </p>

              {active ? (
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6255E8]">
                  Candidate profile
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </ReportSection>
  );
}

function OperatingStyleDistributionSection({
  payload,
  content,
}: {
  payload: McasReportPayload;
  content: McasInternalReportContent;
}) {
  const primary = payload.result.operatingStyle.primary;
  const secondary = payload.result.operatingStyle.secondary;
  const confidence = payload.result.confidence.score ?? primary.percentage;
  const primaryLabel = INTERNAL_OS_LABELS[primary.code];
  const primaryColour = SUMMARY_OS_COLOURS[primary.code];
  const safePercentage = Math.max(0, Math.min(100, Math.round(primary.percentage)));

  return (
    <section
      id="operating-distribution"
      className="mcas-summary-section overflow-hidden rounded-3xl border border-white/10 bg-[#6F5CFF] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.28)]"
    >
      <div className="overflow-hidden rounded-[18px] bg-white">
        <div className="flex items-center gap-3 bg-[#6F5CFF] px-5 py-3 text-white">
          <img
            src="/mcas/report-icons/operating-style-identity-system.png"
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/20"
          />
          <p className="text-xs font-bold tracking-[0.02em]">
            Operating Style Distribution and Confidence
          </p>
        </div>

        <div className="p-5 md:p-7">
          <p className="max-w-5xl text-[11px] leading-5 text-slate-600">
            The Operating Style reveals the candidate&apos;s natural execution pattern.
            The distribution below reflects scored pattern strength, not a ranking
            against others.
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">
                Dominant Operating Style
              </p>

              <div className="mt-5 flex flex-col items-center text-center">
                <div
                  className="flex h-[155px] w-[155px] items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${primaryColour} 0 ${safePercentage}%, #EEF0F5 ${safePercentage}% 100%)`,
                  }}
                >
                  <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full bg-white shadow-[0_5px_13px_rgba(79,70,229,0.08)]">
                    <span className="text-4xl font-black tracking-[-0.05em]" style={{ color: primaryColour }}>
                      {safePercentage}%
                    </span>
                    <span className="mt-1 text-sm font-bold text-[#0D1B2A]">
                      {primaryLabel}
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold text-slate-500">
                  {Math.round(confidence)}% pattern confidence
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {payload.result.operatingStyle.distribution.map((item) => (
                <OperatingDistributionRow key={item.code} item={item} />
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-2 text-[11px] leading-5 text-slate-600">
            <p>
              The dominant <span className="font-semibold text-[#0D1B2A]">{primaryLabel}</span>{" "}
              pattern indicates a candidate who naturally {content.primary.systemFunction.toLowerCase()}
            </p>
            <p>{content.primary.executionSummary}</p>
            {secondary && content.secondarySummary ? (
              <p>
                <span className="font-semibold text-[#0D1B2A]">
                  {INTERNAL_OS_LABELS[secondary.code]}
                </span>{" "}
                is the secondary influence at {Math.round(secondary.percentage)}%. {content.secondarySummary}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function OperatingDistributionRow({
  item,
}: {
  item: McasDistributionItem<McasOperatingStyleCode>;
}) {
  const colour = SUMMARY_OS_COLOURS[item.code];
  const percentage = Math.max(0, Math.min(100, Math.round(item.percentage)));

  return (
    <div className="grid grid-cols-[38px_minmax(86px,0.72fr)_minmax(120px,1fr)_38px_70px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg"
        style={{ background: `${colour}16` }}
      >
        <img
          src={OS_PROFILE_IMAGES[item.code]}
          alt=""
          className="h-full w-full object-contain"
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#201E41]">
          {INTERNAL_OS_LABELS[item.code]}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {distributionBandLabel(item.band).toLowerCase()} pattern
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#EEF0F5]">
        <div
          className="h-full rounded-full"
          style={{
            background: colour,
            width: `${Math.max(2, percentage)}%`,
          }}
        />
      </div>

      <p className="text-right text-lg font-black text-[#201E41]">
        {percentage}%
      </p>

      <span
        className="justify-self-end rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-[0.07em]"
        style={{
          background: `${colour}16`,
          color: colour,
        }}
      >
        {distributionBandLabel(item.band)}
      </span>
    </div>
  );
}

function CoreBalanceSection({
  payload,
  content,
}: {
  payload: McasReportPayload;
  content: McasInternalReportContent;
}) {
  const strongest = payload.result.core.strongest;
  const weakest = payload.result.core.weakest;

  return (
    <section
      id="core-balance"
      className="mcas-summary-section overflow-hidden rounded-3xl border border-white/10 bg-[#6F5CFF] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.28)]"
    >
      <div className="overflow-hidden rounded-[18px] bg-white">
        <div className="flex items-center gap-3 bg-[#6F5CFF] px-5 py-3 text-white">
          <img
            src="/mcas/report-icons/core-behavioural-balance.png"
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/20"
          />
          <p className="text-xs font-bold tracking-[0.02em]">
            CORE Behavioural Balance and Work Cycle Coverage
          </p>
        </div>

        <div className="p-5 md:p-7">
          <p className="max-w-5xl text-[11px] leading-5 text-slate-600">
            The CORE system maps which parts of the work cycle the candidate
            naturally drives, supports or undercovers. A lower score does not
            mean inability; it signals where the role may need conscious
            structure, partnership or validation.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[255px_minmax(0,1fr)] lg:items-center">
            <div className="flex min-h-[230px] items-center justify-center rounded-xl bg-[#F8F9FC] p-4">
              <img
                src="/mcas/graphics/your-core-behaviour.png"
                alt="CORE behavioural balance"
                className="h-auto max-h-[225px] w-auto max-w-full object-contain"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(["CREATE", "ORGANISE", "RESOLVE", "EXAMINE"] as McasCoreCode[]).map(
                (code) => {
                  const item =
                    payload.result.core.distribution.find(
                      (entry) => entry.code === code
                    ) ?? null;

                  return (
                    <CoreCoverageCard
                      key={code}
                      code={code}
                      percentage={item ? Math.round(item.percentage) : 0}
                      isStrongest={strongest.code === code}
                      isWeakest={weakest?.code === code}
                    />
                  );
                }
              )}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-[11px] leading-5 text-[#174B53]">
            {content.coreSummary}
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreCoverageCard({
  code,
  percentage,
  isStrongest,
  isWeakest,
}: {
  code: McasCoreCode;
  percentage: number;
  isStrongest: boolean;
  isWeakest: boolean;
}) {
  const copy = CORE_COPY[code];
  const theme = {
    CREATE: {
      icon: "bg-violet-100 text-violet-700",
      badge: "bg-violet-50 text-violet-700",
      border: "border-violet-100",
    },
    ORGANISE: {
      icon: "bg-indigo-100 text-indigo-700",
      badge: "bg-indigo-50 text-indigo-700",
      border: "border-indigo-100",
    },
    RESOLVE: {
      icon: "bg-teal-100 text-teal-700",
      badge: "bg-teal-50 text-teal-700",
      border: "border-teal-100",
    },
    EXAMINE: {
      icon: "bg-amber-100 text-amber-700",
      badge: "bg-amber-50 text-amber-700",
      border: "border-amber-100",
    },
  }[code];

  const status = isStrongest
    ? "Strongest coverage"
    : isWeakest
      ? "Support recommended"
      : "Supporting coverage";

  return (
    <article
      className={[
        "rounded-xl border bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)]",
        isStrongest
          ? "border-[#6F5CFF] bg-[#F3F1FF]"
          : isWeakest
            ? "border-amber-300 bg-[#FFFBEF]"
            : theme.border,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black",
            theme.icon,
          ].join(" ")}
        >
          {copy.letter}
        </span>

        <div className="text-right">
          <p className="text-xl font-black tracking-[-0.04em] text-[#201E41]">
            {percentage}%
          </p>
          <span
            className={[
              "mt-1 inline-flex rounded-md px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]",
              isStrongest
                ? "bg-[#6F5CFF] text-white"
                : isWeakest
                  ? "bg-amber-100 text-amber-800"
                  : theme.badge,
            ].join(" ")}
          >
            {status}
          </span>
        </div>
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#201E41]">
        {code.charAt(0) + code.slice(1).toLowerCase()}
      </h3>

      <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
        {copy.copy}
      </p>
    </article>
  );
}

function CareerVerticalSection({
  current,
  next,
  readinessLabel,
}: {
  current: string;
  next: string | null;
  readinessLabel?: string;
}) {
  return (
    <ReportSection
      id="vertical-readiness"
      icon="/mcas/report-icons/career-vertical-fit.png"
      eyebrow="07 · Career Vertical Fit and Readiness"
      title="Current scope fit and stretch horizon"
    >
      <div className="space-y-7">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#F7F8FA] p-3 sm:p-5">
          <img
            src="/mcas/graphics/career-vertical-fit.png"
            alt="Career Vertical progression from V1 to V6"
            className="mx-auto h-auto w-full max-w-[1160px] object-contain"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <VerticalExplainer
            icon="↗"
            title="Increasing scope"
            copy="Wider impact and responsibility."
          />
          <VerticalExplainer
            icon="◎"
            title="Increasing complexity"
            copy="More variables and interdependencies."
          />
          <VerticalExplainer
            icon="★"
            title="Increasing accountability"
            copy="Greater ownership and outcomes."
          />
        </div>

        <div className="rounded-2xl border border-[#6255E8]/15 bg-[#F7F6FF] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6255E8]">
            Current result
          </p>
          <p className="mt-2 text-lg font-black text-[#201E41]">
            {readinessLabel ?? `${current} fit indicated`}
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Progression changes work itself. Higher verticals increase ambiguity,
            scope and accountability. The next level should be treated as a
            development horizon, not an automatic promotion recommendation.
          </p>
        </div>

        <div className="space-y-3">
          {CAREER_VERTICAL_STEPS.map((step) => {
            const state = getCareerVerticalRowState({
              rowCode: step.code,
              currentCode: current,
              nextCode: next,
            });

            return (
              <CareerVerticalRow
                key={step.code}
                step={step}
                state={state}
              />
            );
          })}
        </div>
      </div>
    </ReportSection>
  );
}

function VerticalExplainer({
  icon,
  title,
  copy,
}: {
  icon: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D8DAF3] bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0ECFF] text-lg font-black text-[#6255E8]">
          {icon}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F56E8]">
            {title}
          </p>
          <p className="mt-1 text-sm text-slate-600">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function CareerVerticalRow({
  step,
  state,
}: {
  step: CareerVerticalStep;
  state: CareerVerticalRowState;
}) {
  return (
    <div
      className={[
        "grid gap-4 rounded-2xl border px-4 py-4",
        "md:grid-cols-[52px_minmax(0,1fr)_220px_150px] md:items-center",
        state.rowClass,
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black",
          state.circleClass,
        ].join(" ")}
      >
        {step.code}
      </span>

      <div>
        <p className="text-base font-bold text-[#201E41]">
          {step.code} · {step.title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{step.description}</p>
      </div>

      <div className="hidden md:block">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${state.barClass}`}
            style={{ width: state.barWidth }}
          />
        </div>
      </div>

      <div className="md:text-right">
        <span
          className={[
            "inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.11em]",
            state.badgeClass,
          ].join(" ")}
        >
          {state.label}
        </span>
      </div>
    </div>
  );
}

function RiskSection({
  payload,
  content,
  risks,
}: {
  payload: McasReportPayload;
  content: McasInternalReportContent;
  risks: McasInternalReportContent["risks"];
}) {
  const primaryCode = payload.result.operatingStyle.primary.code;
  const primaryLabel = INTERNAL_OS_LABELS[primaryCode];
  const nextVertical = getNextVertical(payload.result.careerVertical.primary.code);

  const strength = splitRiskInsight(
    content.primary.strengths[0] ??
      `${primaryLabel} contribution — Creates practical value through the dominant work pattern.`
  );

  const primaryRisk =
    risks[0] ??
    ({
      title: "Sustainability check",
      detail:
        "Validate the conditions that allow this candidate to sustain their strongest contribution over time.",
      level: "moderate",
    } as McasInternalReportContent["risks"][number]);

  const riskResponse = getRiskResponse(primaryCode, primaryRisk.title);
  const growth = getGrowthGuidance(
    primaryCode,
    nextVertical,
    payload.result.careerVertical.primary.code
  );

  return (
    <section
      id="risk-flags"
      className="mcas-summary-section overflow-hidden rounded-3xl border border-white/10 bg-[#6F5CFF] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.28)]"
    >
      <div className="overflow-hidden rounded-[18px] bg-white">
        <div className="flex items-center gap-3 bg-[#6F5CFF] px-5 py-3 text-white">
          <img
            src="/mcas/report-icons/risk-flags.png"
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/20"
          />
          <p className="text-xs font-bold tracking-[0.02em]">
            08 · Risk Flags and Sustainability Notes
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <RiskSustainabilityCard
            accent="strength"
            icon="↗"
            label="Strength"
            title={strength.title}
            copy={strength.detail}
            footerLabel="Impact"
            footerCopy={firstSentence(content.primary.systemFunction)}
          />

          <RiskSustainabilityCard
            accent="risk"
            icon="△"
            label="Risk"
            title={primaryRisk.title}
            copy={firstSentence(primaryRisk.detail)}
            footerLabel="Mitigation"
            footerCopy={riskResponse.mitigation}
            secondaryFooterLabel="Trigger"
            secondaryFooterCopy={riskResponse.trigger}
          />

          <RiskSustainabilityCard
            accent="growth"
            icon="⌁"
            label="Growth"
            title={growth.title}
            copy={growth.copy}
            footerLabel="Action"
            footerCopy={growth.action}
          />

          <RiskSustainabilityCard
            accent="recommendation"
            icon="◎"
            label="Recommendation"
            title="Best Fit Environment"
            copy={firstSentence(content.primary.environmentSummary)}
            footerLabel="Why"
            footerCopy={`Creates the conditions for ${primaryLabel} to deliver impact while protecting sustainable execution.`}
          />
        </div>
      </div>
    </section>
  );
}

function RiskSustainabilityCard({
  accent,
  icon,
  label,
  title,
  copy,
  footerLabel,
  footerCopy,
  secondaryFooterLabel,
  secondaryFooterCopy,
}: {
  accent: "strength" | "risk" | "growth" | "recommendation";
  icon: string;
  label: string;
  title: string;
  copy: string;
  footerLabel: string;
  footerCopy: string;
  secondaryFooterLabel?: string;
  secondaryFooterCopy?: string;
}) {
  const palette = {
    strength: {
      icon: "bg-[#E9FBF6] text-[#42CDB4]",
      label: "text-[#42CDB4]",
      divider: "border-[#CFF6EC]",
      footer: "text-[#42CDB4]",
    },
    risk: {
      icon: "bg-[#FFF2EA] text-[#FF9A69]",
      label: "text-[#FF9A69]",
      divider: "border-[#FFE4D7]",
      footer: "text-[#FF9A69]",
    },
    growth: {
      icon: "bg-[#F4EEFF] text-[#8F5CFF]",
      label: "text-[#8F5CFF]",
      divider: "border-[#E5D7FF]",
      footer: "text-[#8F5CFF]",
    },
    recommendation: {
      icon: "bg-[#EEF2FF] text-[#3D5CFF]",
      label: "text-[#3D5CFF]",
      divider: "border-[#DCE4FF]",
      footer: "text-[#3D5CFF]",
    },
  }[accent];

  return (
    <article className="flex min-h-[280px] flex-col rounded-xl border border-slate-100 bg-white px-5 py-5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
      <span
        className={[
          "flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black",
          palette.icon,
        ].join(" ")}
      >
        {icon}
      </span>

      <p
        className={[
          "mt-4 text-[10px] font-black uppercase tracking-[0.13em]",
          palette.label,
        ].join(" ")}
      >
        {label}
      </p>

      <h3 className="mt-4 text-[15px] font-bold leading-5 text-[#201E41]">
        {title}
      </h3>

      <p className="mt-2 text-[11px] leading-5 text-slate-600">{copy}</p>

      <div
        className={[
          "relative mt-auto border-t pt-4",
          palette.divider,
        ].join(" ")}
      >
        <span
          className={[
            "absolute -top-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
            accent === "strength"
              ? "bg-[#8CE6D4]"
              : accent === "risk"
                ? "bg-[#FFC6AB]"
                : accent === "growth"
                  ? "bg-[#B997FF]"
                  : "bg-[#9CB2FF]",
          ].join(" ")}
        />

        {secondaryFooterLabel && secondaryFooterCopy ? (
          <div className="mb-3">
            <p className={`text-[10px] font-bold ${palette.footer}`}>
              {secondaryFooterLabel}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-600">
              {secondaryFooterCopy}
            </p>
          </div>
        ) : null}

        <p className={`text-[10px] font-bold ${palette.footer}`}>
          {footerLabel}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-slate-600">
          {footerCopy}
        </p>
      </div>
    </article>
  );
}

function splitRiskInsight(value: string) {
  const divider = value.match(/\s[—–:-]\s/);

  if (!divider || divider.index === undefined) {
    return {
      title: value,
      detail: "This is a practical contribution to validate through concrete work examples.",
    };
  }

  const dividerLength = divider[0].length;
  const title = value.slice(0, divider.index).trim();
  const detail = value.slice(divider.index + dividerLength).trim();

  return {
    title: title || value,
    detail:
      detail ||
      "This is a practical contribution to validate through concrete work examples.",
  };
}

function firstSentence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^.*?[.!?](?:\s|$)/);

  return match ? match[0].trim() : trimmed;
}

function getRiskResponse(
  code: McasOperatingStyleCode,
  riskTitle: string
): {
  trigger: string;
  mitigation: string;
} {
  const responses: Record<
    McasOperatingStyleCode,
    {
      trigger: string;
      mitigation: string;
    }
  > = {
    OS1: {
      trigger: "Too many opportunities, unclear priorities or prolonged operational detail.",
      mitigation:
        "Narrow priorities, assign delivery ownership and close or pause lower-value initiatives.",
    },
    OS2: {
      trigger: "High external demand, rapid activity or momentum that exceeds delivery capacity.",
      mitigation:
        "Align activation with delivery capacity and define what success looks like beyond early response.",
    },
    OS3: {
      trigger: "Sustained team pressure, conflict avoidance or responsibility for others' emotional load.",
      mitigation:
        "Set clear boundaries, name accountability early and share support responsibility across the team.",
    },
    OS4: {
      trigger: "Competing stakeholder expectations, unclear authority or unowned dependencies.",
      mitigation:
        "State the recommendation early, define decision rights and escalate dependency risk with evidence.",
    },
    OS5: {
      trigger: "High workload, operational disruption or changing priorities without clear ownership.",
      mitigation:
        "Protect priority work, delegate practical tasks and escalate capacity risk before delivery slips.",
    },
    OS6: {
      trigger: "Repeated change, incomplete information or pressure to act before a process is clear.",
      mitigation:
        "Create minimum viable structure, review assumptions frequently and avoid over-engineering the response.",
    },
    OS7: {
      trigger: "Time pressure, incomplete evidence or responsibility for quality across too many decisions.",
      mitigation:
        "Set proportionate controls, time-box review and delegate validation work using clear criteria.",
    },
    OS8: {
      trigger: "High standards, unclear release criteria or repeated iteration without agreed priorities.",
      mitigation:
        "Agree the quality threshold, separate release work from refinement work and use feedback to prioritise improvement.",
    },
  };

  const response = responses[code];

  if (riskTitle.toLowerCase().includes("overreach")) {
    return {
      trigger:
        "Scope expands faster than demonstrated readiness, support or decision authority.",
      mitigation:
        "Stage the stretch, clarify decision boundaries and provide support before increasing accountability.",
    };
  }

  return response;
}

function getGrowthGuidance(
  code: McasOperatingStyleCode,
  nextVertical: string | null,
  currentVertical: string
): {
  title: string;
  copy: string;
  action: string;
} {
  const nextLabel = nextVertical ?? "broader scope";
  const actionByStyle: Record<McasOperatingStyleCode, string> = {
    OS1: "Practise prioritising opportunity, sequencing initiatives and handing work into accountable delivery.",
    OS2: "Practise converting attention into sustained adoption, measurable outcomes and delivery partnership.",
    OS3: "Practise combining people-centred leadership with direct accountability and clear performance decisions.",
    OS4: "Practise taking a clear directional position, setting decision rights and leading across competing priorities.",
    OS5: "Practise delegating delivery, managing capacity trade-offs and adapting systems when priorities change.",
    OS6: "Practise influencing through adaptable systems, scenario planning and decisions under ambiguity.",
    OS7: "Practise time-bound judgement, proportionate control and strategic decision-making with incomplete evidence.",
    OS8: "Practise release judgement, prioritised improvement and standards influence without slowing momentum.",
  };

  return {
    title: `Build ${nextLabel} readiness`,
    copy: `The current result indicates ${currentVertical} scope. Growth should focus on demonstrating sustainable contribution as responsibility, ambiguity and cross-system impact increase.`,
    action: actionByStyle[code],
  };
}

function InterviewSection({
  items,
}: {
  items: McasInternalReportContent["interviewFocus"];
}) {
  return (
    <ReportSection
      id="interview-focus"
      icon="/mcas/report-icons/suggested-interview-focus-areas.png"
      eyebrow="09 · Suggested Interview Focus Areas"
      title="Use structured questions to validate evidence"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={item.title}
            className="rounded-2xl border border-[#6255E8]/20 bg-[#F7F6FF] p-5"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6255E8] text-sm font-black text-white">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6255E8]">
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
  );
}

function ReportSection({
  id,
  icon,
  eyebrow,
  title,
  children,
}: {
  id: string;
  icon: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="mcas-summary-section rounded-3xl border border-white/10 bg-[#6F5CFF] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.28)]"
    >
      <div className="rounded-[18px] bg-white p-6 md:p-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center">
          <img
            src={icon}
            alt=""
            className="h-12 w-12 rounded-xl object-cover ring-1 ring-[#6255E8]/15"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.19em] text-[#6255E8]">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#201E41] md:text-3xl">
              {title}
            </h2>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#6255E8]/15 bg-white/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-[#201E41]">{value}</p>
    </div>
  );
}

function InfoTile({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8F8FC] p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6255E8] text-sm font-black text-white">
        {number}
      </span>
      <h3 className="mt-4 text-lg font-bold text-[#201E41]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function ModelCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-[#6255E8]/15 bg-[#F8F7FF] p-5">
      <p className="text-lg font-bold text-[#201E41]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function DistributionRow({
  item,
}: {
  item: McasDistributionItem<McasOperatingStyleCode>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: OS_COLOURS[item.code] }}
          />
          <div>
            <p className="font-semibold text-[#201E41]">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.band ?? "supporting"} pattern
            </p>
          </div>
        </div>
        <p className="text-lg font-black text-[#201E41]">
          {Math.round(item.percentage)}%
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{
            background: OS_COLOURS[item.code],
            width: `${Math.max(3, Math.min(100, item.percentage))}%`,
          }}
        />
      </div>
    </div>
  );
}

function inferRiskLevel(flags: string[]): "low" | "moderate" | "high" {
  if (flags.some((flag) => flag.toLowerCase().includes("overreach"))) {
    return "high";
  }

  if (flags.length > 0) return "moderate";

  return "low";
}

function getNextVertical(current: string): string | null {
  const number = Number(current.replace("V", ""));

  if (!Number.isFinite(number) || number >= 6) return null;

  return `V${number + 1}`;
}


function humaniseRisk(level: "low" | "moderate" | "high") {
  return level === "high" ? "High" : level === "moderate" ? "Moderate" : "Low";
}

function humaniseFlag(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}