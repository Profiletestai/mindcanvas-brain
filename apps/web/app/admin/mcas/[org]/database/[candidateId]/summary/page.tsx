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
  McasAlignmentStatus,
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
  const secondaryOs = payload.result.operatingStyle.secondary;
  const primaryVertical = payload.result.careerVertical.primary;
  const primaryCore = payload.result.core.strongest;
  const weakestCore = payload.result.core.weakest;
  const confidencePercent =
    payload.result.confidence.score ?? primaryOs.percentage;
  const alignment = payload.internal?.roleFit?.alignmentStatus;
  const alignmentMeta = getAlignmentMeta(alignment);
  const riskLevel =
    payload.internal?.riskLevel ?? inferRiskLevel(payload.result.flags);
  const roleRows = getRoleFitRows(payload);
  const content = getMcasInternalReportContent(payload);
  const nextVertical = getNextVertical(primaryVertical.code);

  const backHref = `/admin/mcas/${org.slug}/database/${candidate.partnerApplicationId}`;
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
          alignmentMeta={alignmentMeta}
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
            <RoleFitSection
              rows={roleRows}
              alignmentMeta={alignmentMeta}
              roleTitle={payload.internal?.roleBlueprint?.title ?? null}
            />
            <CareerVerticalSection
              current={primaryVertical.code}
              next={nextVertical}
              readinessLabel={payload.result.careerVertical.readinessLabel}
            />
            <RiskSection risks={content.risks} />
            <InterviewSection items={content.interviewFocus} />
            <NextStepsSection backHref={backHref} />
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
              MindCanvas CORE Alignment System
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
  alignmentMeta,
  riskLevel,
  content,
}: {
  payload: McasReportPayload;
  confidencePercent: number;
  alignmentMeta: AlignmentMeta;
  riskLevel: "low" | "moderate" | "high";
  content: McasInternalReportContent;
}) {
  const primary = payload.result.operatingStyle.primary;
  const secondary = payload.result.operatingStyle.secondary;
  const vertical = payload.result.careerVertical.primary;
  const nextVertical = getNextVertical(vertical.code);

  return (
    <>
      <section className="border-b border-[#E2E8F0] bg-[#F7F8FA] px-5 py-3 md:px-7">
        <div className="grid gap-y-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-y-0">
          {payload.result.operatingStyle.distribution.slice(0, 4).map((item, index) => (
            <TopStyleStripItem
              key={item.code}
              item={item}
              index={index}
            />
          ))}
        </div>
      </section>

      <section className="bg-[#06111D] px-5 py-4 text-white md:px-7 md:py-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <HeroSnapshotCard
            icon="✓"
            label="Alignment Status"
            title={alignmentMeta.label}
            copy={alignmentMeta.description}
          />

          <HeroSnapshotCard
            icon="◉"
            label="Operating Style"
            title={INTERNAL_OS_LABELS[primary.code]}
            copy={`Dominant execution pattern.${
              secondary
                ? ` Secondary ${INTERNAL_OS_LABELS[secondary.code]} influence at ${Math.round(
                    secondary.percentage
                  )}% confidence.`
                : ""
            }`}
          />

          <HeroSnapshotCard
            icon="↗"
            label="Vertical Readiness"
            title={`${vertical.code} Ready`}
            copy={`Current pattern aligns to ${vertical.code} scope.${
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

        <p className="mt-4 text-[10px] leading-4 text-slate-400">
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
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-black text-white shadow-[0_2px_5px_rgba(0,0,0,0.14)]"
        style={{ background: colour }}
      >
        {item.code.replace("OS", "")}
      </span>

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
    <div className="relative overflow-hidden rounded-xl border border-[#6F5CFF] bg-[#EEEAFE] p-5 text-[#0D1B2A] shadow-[0_5px_15px_rgba(0,0,0,0.16)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#6F5CFF]" />

      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#6F5CFF] text-lg font-black text-white">
        {icon}
      </span>

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#718096]">
        {label}
      </p>

      <h3 className="mt-1.5 text-2xl font-black tracking-[-0.04em] text-[#0D1B2A]">
        {title}
      </h3>

      <p className="mt-3 max-w-[340px] text-sm leading-6 text-[#4A5568]">
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0FCD5E]">
          {title}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {items.slice(0, 3).map((item) => (
          <div
            key={item}
            className="flex gap-2 text-[11px] leading-5 text-slate-200"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0FCD5E]" />
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
    ["role-fit", "Role Fit Assessment"],
    ["vertical-readiness", "Career Vertical Fit and Readiness"],
    ["risk-flags", "Risk Flags and Sustainability Notes"],
    ["interview-focus", "Suggested Interview Focus Areas"],
    ["next-steps", "Your next steps"],
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

      <div className="mt-5 space-y-3">
        <CandidateSummaryDownloadButton className="w-full" />
        <a
          href="#next-steps"
          className="block rounded-xl bg-gradient-to-r from-[#46DCD4] via-[#4B8CFF] to-[#8A5CF6] px-4 py-3 text-center text-sm font-bold text-white"
        >
          Next steps
        </a>
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
      <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-center">
        <img
          src="/mcas/graphics/operating-style-system.png"
          alt="MCAS operating style system"
          className="mx-auto h-auto w-full max-w-[350px] object-contain"
        />

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
  content,
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

      <div className="mt-6 rounded-2xl border border-[#6255E8]/15 bg-[#F7F6FF] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6255E8]">
          Candidate system function
        </p>
        <p className="mt-2 text-lg font-bold text-[#201E41]">
          {content.primary.systemFunction}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {content.primary.executionSummary}
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(OS_NAMES) as McasOperatingStyleCode[]).map((code) => {
          const active = code === primaryCode;

          return (
            <div
              key={code}
              className={[
                "rounded-2xl border p-4",
                active
                  ? "border-[#6F5CFF]/50 bg-[#F0EEFF] ring-1 ring-[#6F5CFF]/20"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                style={{ background: OS_COLOURS[code] }}
              >
                {code.replace("OS", "")}
              </span>
              <p className="mt-4 font-bold text-[#201E41]">{OS_NAMES[code]}</p>
              <p className="mt-1 text-sm text-slate-500">{OS_TAGLINES[code]}</p>
              {active ? (
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-[#6255E8]">
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

  return (
    <ReportSection
      id="operating-distribution"
      icon="/mcas/report-icons/operating-style-identity-system.png"
      eyebrow="05 · Operating Style Distribution and Confidence"
      title="Pattern strength and confidence"
    >
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-3xl bg-[#F0EEFF] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6255E8]">
            Dominant operating style
          </p>

          <div
            className="mt-5 flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-white shadow-lg"
            style={{ background: OS_COLOURS[primary.code] }}
          >
            {Math.round(primary.percentage)}%
          </div>

          <h3 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#201E41]">
            {primary.label}
          </h3>

          <p className="mt-4 text-sm leading-6 text-slate-700">
            {content.primary.executionSummary}
          </p>

          <div className="mt-6 rounded-2xl border border-[#6255E8]/15 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Pattern confidence
            </p>
            <p className="mt-2 text-2xl font-black text-[#201E41]">
              {Math.round(confidence)}%
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {payload.result.confidence.level} confidence
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {payload.result.operatingStyle.distribution.map((item) => (
            <DistributionRow key={item.code} item={item} />
          ))}

          {secondary && content.secondarySummary ? (
            <p className="rounded-2xl border border-cyan-300/30 bg-cyan-50 p-4 text-sm leading-6 text-[#174B53]">
              {content.secondarySummary}
            </p>
          ) : null}
        </div>
      </div>
    </ReportSection>
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
    <ReportSection
      id="core-balance"
      icon="/mcas/report-icons/core-behavioural-balance.png"
      eyebrow="06 · CORE Behavioural Balance and Work Cycle Coverage"
      title="How the candidate moves work from idea to outcome"
    >
      <p className="max-w-5xl text-sm leading-7 text-slate-700">
        The CORE system maps which parts of the work cycle the candidate
        naturally drives, supports or undercovers. A lower score does not mean
        inability; it signals where the role may need conscious structure,
        partnership or validation.
      </p>

      <div className="mt-5 rounded-2xl border border-cyan-300/30 bg-cyan-50 p-4 text-sm leading-6 text-[#174B53]">
        {content.coreSummary}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[330px_1fr] lg:items-center">
        <img
          src="/mcas/graphics/your-core-behaviour.png"
          alt="CORE behavioural balance"
          className="mx-auto h-auto w-full max-w-[320px] object-contain"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(["CREATE", "ORGANISE", "RESOLVE", "EXAMINE"] as McasCoreCode[]).map(
            (code) => {
              const item =
                payload.result.core.distribution.find(
                  (entry) => entry.code === code
                ) ?? null;
              const isStrongest = strongest.code === code;
              const isWeakest = weakest?.code === code;
              const copy = CORE_COPY[code];

              return (
                <div
                  key={code}
                  className={[
                    "rounded-2xl border p-5",
                    isStrongest
                      ? "border-[#6255E8]/35 bg-[#F0EEFF]"
                      : isWeakest
                        ? "border-amber-300/45 bg-amber-50"
                        : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#201E41] text-sm font-black text-white">
                      {copy.letter}
                    </span>
                    <span className="text-2xl font-black text-[#201E41]">
                      {item ? Math.round(item.percentage) : 0}%
                    </span>
                  </div>

                  <p className="mt-5 text-lg font-bold text-[#201E41]">
                    {item?.label ?? code}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {copy.copy}
                  </p>

                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#6255E8]">
                    {isStrongest
                      ? "Strongest coverage"
                      : isWeakest
                        ? "Support recommended"
                        : "Supporting coverage"}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>
    </ReportSection>
  );
}

function RoleFitSection({
  rows,
  alignmentMeta,
  roleTitle,
}: {
  rows: RoleFitRow[];
  alignmentMeta: AlignmentMeta;
  roleTitle: string | null;
}) {
  return (
    <ReportSection
      id="role-fit"
      icon="/mcas/report-icons/role-fit.png"
      eyebrow="07 · Role Fit Assessment"
      title="Candidate pattern against the target role blueprint"
    >
      <div
        className={[
          "rounded-2xl border p-5",
          alignmentMeta.accent === "emerald"
            ? "border-emerald-300/35 bg-emerald-50"
            : alignmentMeta.accent === "amber"
              ? "border-amber-300/45 bg-amber-50"
              : alignmentMeta.accent === "rose"
                ? "border-rose-300/45 bg-rose-50"
                : "border-slate-200 bg-slate-50",
        ].join(" ")}
      >
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-slate-500">
          Alignment status
        </p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-2xl font-black text-[#201E41]">
              {alignmentMeta.label}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              {alignmentMeta.description}
            </p>
          </div>
          {roleTitle ? (
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#201E41] shadow-sm">
              {roleTitle}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[760px] w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-[#201E41] text-xs uppercase tracking-[0.14em] text-white">
            <tr>
              <th className="px-5 py-4 font-semibold">Dimension</th>
              <th className="px-5 py-4 font-semibold">Candidate Pattern</th>
              <th className="px-5 py-4 font-semibold">Role Requirement</th>
              <th className="px-5 py-4 font-semibold">Fit Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row) => (
              <tr key={row.dimension}>
                <td className="px-5 py-4 font-semibold text-[#201E41]">
                  {row.dimension}
                </td>
                <td className="px-5 py-4 text-slate-700">{row.candidate}</td>
                <td className="px-5 py-4 text-slate-600">{row.requirement}</td>
                <td className="px-5 py-4">
                  <span className={fitStatusClasses(row.status)}>
                    {row.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!roleTitle ? (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          A target role blueprint has not yet been attached to this assessment.
          Candidate results are complete; the role-comparison columns will become
          fully dynamic once the reverse-role assessment or role blueprint record
          is connected.
        </p>
      ) : null}
    </ReportSection>
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
  const currentLevel = Number(current.replace("V", "")) || 1;

  return (
    <ReportSection
      id="vertical-readiness"
      icon="/mcas/report-icons/career-vertical-fit.png"
      eyebrow="08 · Career Vertical Fit and Readiness"
      title="Current scope fit and stretch horizon"
    >
      <div className="grid gap-6 lg:grid-cols-[350px_1fr] lg:items-center">
        <div className="rounded-3xl bg-[#0C1B2A] p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#73E8D7]">
            Current fit
          </p>
          <p className="mt-3 text-5xl font-black">{current}</p>
          <p className="mt-3 text-lg font-semibold">
            {readinessLabel ?? `${current} fit indicated`}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Higher verticals increase ambiguity, scope and accountability. The
            next level should be treated as a development horizon, not an
            automatic promotion recommendation.
          </p>
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <VerticalRow
              key={level}
              level={level}
              currentLevel={currentLevel}
              nextLevel={next ? Number(next.replace("V", "")) : null}
            />
          ))}
        </div>
      </div>
    </ReportSection>
  );
}

function RiskSection({
  risks,
}: {
  risks: McasInternalReportContent["risks"];
}) {
  return (
    <ReportSection
      id="risk-flags"
      icon="/mcas/report-icons/risk-flags.png"
      eyebrow="09 · Risk Flags and Sustainability Notes"
      title="Predictable risks to validate before placement"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {risks.map((risk) => (
          <div
            key={risk.title}
            className={[
              "rounded-2xl border p-5",
              risk.level === "high"
                ? "border-rose-300/50 bg-rose-50"
                : risk.level === "moderate"
                  ? "border-amber-300/50 bg-amber-50"
                  : "border-cyan-300/35 bg-cyan-50",
            ].join(" ")}
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {humaniseRisk(risk.level)} priority
            </p>
            <h3 className="mt-3 text-lg font-bold text-[#201E41]">
              {risk.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {risk.detail}
            </p>
          </div>
        ))}
      </div>
    </ReportSection>
  );
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
      eyebrow="10 · Suggested Interview Focus Areas"
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

function NextStepsSection({ backHref }: { backHref: string }) {
  return (
    <ReportSection
      id="next-steps"
      icon="/mcas/report-icons/your-next-steps.png"
      eyebrow="11 · Your next steps"
      title="Move from insight to a structured decision"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <NextStepCard
          icon="/mcas/report-icons/download-your-report.png"
          title="Download Your Report"
          copy="Save a PDF copy of this internal summary for the hiring or talent-review process."
          action={<CandidateSummaryDownloadButton className="mt-5 bg-[#201E41] text-white hover:bg-[#322D63]" />}
        />
        <NextStepCard
          icon="/mcas/report-icons/discuss-with-advisor.png"
          title="Discuss with Your Advisor"
          copy="Use a debrief or calibration session to connect this candidate result to the role and wider team system."
          action={
            <Link
              href={backHref}
              className="mcas-summary-no-print mt-5 inline-flex rounded-xl border border-[#6255E8]/30 px-4 py-3 text-sm font-semibold text-[#6255E8] transition hover:bg-[#F0EEFF]"
            >
              Back to candidate profile
            </Link>
          }
        />
        <NextStepCard
          icon="/mcas/report-icons/learn-about-mcas.png"
          title="Complete Role Matching"
          copy="Attach a role blueprint or reverse-role assessment to calculate the detailed alignment result."
          action={
            <Link
              href={backHref}
              className="mcas-summary-no-print mt-5 inline-flex rounded-xl border border-[#6255E8]/30 px-4 py-3 text-sm font-semibold text-[#6255E8] transition hover:bg-[#F0EEFF]"
            >
              Review candidate
            </Link>
          }
        />
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

function VerticalRow({
  level,
  currentLevel,
  nextLevel,
}: {
  level: number;
  currentLevel: number;
  nextLevel: number | null;
}) {
  const status =
    level < currentLevel
      ? "Completed"
      : level === currentLevel
        ? "Current Fit"
        : level === nextLevel
          ? "Stretch with support"
          : level === currentLevel + 2
            ? "Overreach risk"
            : "Not indicated";

  const classes =
    status === "Current Fit"
      ? "border-[#6255E8]/35 bg-[#F0EEFF]"
      : status === "Stretch with support"
        ? "border-cyan-300/45 bg-cyan-50"
        : status === "Overreach risk"
          ? "border-amber-300/45 bg-amber-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${classes}`}>
      <div className="flex items-center gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#201E41] text-sm font-black text-white">
          V{level}
        </span>
        <div>
          <p className="font-semibold text-[#201E41]">
            {verticalLabel(level)}
          </p>
          <p className="mt-1 text-xs text-slate-600">{verticalCopy(level)}</p>
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#201E41]">
        {status}
      </span>
    </div>
  );
}

function NextStepCard({
  icon,
  title,
  copy,
  action,
}: {
  icon: string;
  title: string;
  copy: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8F8FC] p-5">
      <img src={icon} alt="" className="h-11 w-11 rounded-xl object-cover" />
      <h3 className="mt-5 text-lg font-bold text-[#201E41]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
      {action}
    </div>
  );
}

type AlignmentMeta = {
  label: string;
  shortDetail: string;
  description: string;
  accent: "emerald" | "amber" | "rose" | "slate";
};

type RoleFitRow = {
  dimension: string;
  candidate: string;
  requirement: string;
  status: "aligned" | "monitor" | "stretched" | "misaligned" | "pending";
  statusLabel: string;
};

function getAlignmentMeta(
  status: McasAlignmentStatus | undefined
): AlignmentMeta {
  switch (status) {
    case "aligned":
      return {
        label: "Aligned",
        shortDetail: "Role Fit Confirmed",
        description:
          "The candidate pattern and available role requirements are broadly consistent. Validate the decision with evidence-based interview examples.",
        accent: "emerald",
      };
    case "stretched":
      return {
        label: "Stretched",
        shortDetail: "Support Required",
        description:
          "The candidate can contribute, but the role requires a meaningful stretch in one or more dimensions. Confirm support and development conditions.",
        accent: "amber",
      };
    case "misaligned":
      return {
        label: "Misaligned",
        shortDetail: "Role Fit Concern",
        description:
          "The available role requirements place sustained demand on patterns or scope outside the candidate's strongest fit.",
        accent: "rose",
      };
    default:
      return {
        label: "Role Match Needed",
        shortDetail: "Blueprint Not Attached",
        description:
          "The candidate assessment is complete. Attach the target role blueprint or reverse-role assessment to calculate the final alignment result.",
        accent: "slate",
      };
  }
}

function getRoleFitRows(payload: McasReportPayload): RoleFitRow[] {
  const primary = payload.result.operatingStyle.primary;
  const strongestCore = payload.result.core.strongest;
  const weakestCore = payload.result.core.weakest;
  const vertical = payload.result.careerVertical.primary;
  const roleFit = payload.internal?.roleFit;
  const blueprint = payload.internal?.roleBlueprint;

  if (roleFit && blueprint) {
    const alignmentRows = roleFit.alignmentPoints.slice(0, 3).map((point, index) => ({
      dimension: ["Primary OS", "CORE Strength", "Environment Fit"][index] ?? "Alignment Point",
      candidate: point,
      requirement: blueprint.title,
      status: "aligned" as const,
      statusLabel: "Aligned",
    }));

    const mismatchRows = roleFit.mismatchPoints.slice(0, 3).map((point, index) => ({
      dimension: ["CORE / Risk", "Vertical Range", "Sustainability"][index] ?? "Validation Point",
      candidate: point,
      requirement: blueprint.title,
      status: "monitor" as const,
      statusLabel: "Monitor",
    }));

    return [...alignmentRows, ...mismatchRows];
  }

  return [
    {
      dimension: "Primary OS",
      candidate: `${primary.label} · ${Math.round(primary.percentage)}%`,
      requirement: "Target operating-style requirement not attached",
      status: "pending",
      statusLabel: "Needs Blueprint",
    },
    {
      dimension: "CORE Strength",
      candidate: strongestCore.label,
      requirement: "Target CORE requirement not attached",
      status: "pending",
      statusLabel: "Needs Blueprint",
    },
    {
      dimension: "CORE Gap",
      candidate: weakestCore
        ? `${weakestCore.label} · ${Math.round(weakestCore.percentage)}%`
        : "No gap indicated",
      requirement: "Role support requirement not attached",
      status: "monitor",
      statusLabel: "Monitor",
    },
    {
      dimension: "Vertical Range",
      candidate: `${vertical.code} primary`,
      requirement: "Target vertical range not attached",
      status: "pending",
      statusLabel: "Needs Blueprint",
    },
    {
      dimension: "Environment Fit",
      candidate: payload.candidateFacing.environmentFit.workStyle,
      requirement: "Target environment not attached",
      status: "pending",
      statusLabel: "Needs Blueprint",
    },
    {
      dimension: "Sustainability",
      candidate: `${vertical.code} current scope`,
      requirement: "Target accountability range not attached",
      status: "pending",
      statusLabel: "Needs Blueprint",
    },
  ];
}

function inferRiskLevel(flags: string[]): "low" | "moderate" | "high" {
  if (flags.some((flag) => flag.toLowerCase().includes("overreach"))) {
    return "high";
  }

  if (flags.length > 0) return "moderate";

  return "low";
}

function fitStatusClasses(status: RoleFitRow["status"]) {
  const base =
    "inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.1em]";

  switch (status) {
    case "aligned":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "monitor":
      return `${base} bg-amber-100 text-amber-800`;
    case "stretched":
      return `${base} bg-amber-100 text-amber-800`;
    case "misaligned":
      return `${base} bg-rose-100 text-rose-800`;
    default:
      return `${base} bg-slate-100 text-slate-600`;
  }
}

function getNextVertical(current: string): string | null {
  const number = Number(current.replace("V", ""));

  if (!Number.isFinite(number) || number >= 6) return null;

  return `V${number + 1}`;
}

function verticalLabel(level: number) {
  const labels: Record<number, string> = {
    1: "V1 · Entry / Foundational",
    2: "V2 · Developing",
    3: "V3 · Established",
    4: "V4 · Senior Scope",
    5: "V5 · Strategic Leadership",
    6: "V6 · Executive / Enterprise",
  };

  return labels[level] ?? `V${level}`;
}

function verticalCopy(level: number) {
  const labels: Record<number, string> = {
    1: "Task-level execution and guided delivery.",
    2: "Growing ownership with structured guidance.",
    3: "Independent delivery and cross-team coordination.",
    4: "Strategic influence and broader accountability.",
    5: "Organisation-wide direction and system leadership.",
    6: "Enterprise leadership and long-horizon strategy.",
  };

  return labels[level] ?? "Career vertical progression.";
}

function humaniseRisk(level: "low" | "moderate" | "high") {
  return level === "high" ? "High" : level === "moderate" ? "Moderate" : "Low";
}

function humaniseFlag(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}