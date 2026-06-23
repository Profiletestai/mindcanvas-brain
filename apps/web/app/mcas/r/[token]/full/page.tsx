// apps/web/app/mcas/r/[token]/full/page.tsx

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { buildMcasReportPayloadByToken } from "@/lib/mcas/reportPayload";
import { getOperatingStyleDisplayLabel } from "@/lib/mcas/reportConstants";
import McasFullReportActions from "./McasFullReportActions";
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
  params: Promise<{ token: string }>;
};

const OS_IMAGES: Record<McasOperatingStyleCode, string> = {
  OS1: "/mcas/profile-cards/visionary.png",
  OS2: "/mcas/profile-cards/catalyst.png",
  OS3: "/mcas/profile-cards/motivator.png",
  OS4: "/mcas/profile-cards/connector.png",
  OS5: "/mcas/profile-cards/facilitator.png",
  OS6: "/mcas/profile-cards/coordinator.png",
  OS7: "/mcas/profile-cards/controller.png",
  OS8: "/mcas/profile-cards/optimiser.png",
};

const OS_COLOURS: Record<McasOperatingStyleCode, string> = {
  OS1: "#300993",
  OS2: "#FD2527",
  OS3: "#EF6001",
  OS4: "#0049F9",
  OS5: "#0F7B6C",
  OS6: "#4338CA",
  OS7: "#F7B955",
  OS8: "#DB2777",
};

const CORE_SHORT: Record<McasCoreCode, string> = {
  CREATE: "C",
  ORGANISE: "O",
  RESOLVE: "R",
  EXAMINE: "E",
};

const CORE_IMAGES: Record<McasCoreCode, string> = {
  CREATE: "/mcas/icons/create.png",
  ORGANISE: "/mcas/icons/organise.png",
  RESOLVE: "/mcas/icons/resolve.png",
  EXAMINE: "/mcas/icons/examine.png",
};

const CORE_COLOURS: Record<McasCoreCode, string> = {
  CREATE: "#1725DB",
  ORGANISE: "#0A65EE",
  RESOLVE: "#028F8B",
  EXAMINE: "#2C06C1",
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
  const labels: Record<string, string> = {
    dominant: "Dominant",
    secondary: "Secondary",
    tertiary: "Tertiary",
    minimal: "Minimal",
    low: "Low",
  };
  return band ? labels[band] ?? band : "Result";
}

function periodLabel(period: McasSuccessGuideItem["period"]) {
  const labels: Record<McasSuccessGuideItem["period"], string> = {
    days_1_30: "Days 1–30",
    days_31_60: "Days 31–60",
    days_61_90: "Days 61–90",
  };
  return labels[period];
}

function pct(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function operatingStyleLabel(code: McasOperatingStyleCode): string {
  return getOperatingStyleDisplayLabel(code);
}

type McasReportAccessWithNextSteps = McasReportPayload["access"] & {
  nextStepsUrl?: string | null;
};

function getConfiguredNextStepsUrl(payload: McasReportPayload): string | null {
  const access = payload.access as McasReportAccessWithNextSteps;
  const value = access.nextStepsUrl;

  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function reportPdfFilename(candidateName: string): string {
  const safeName =
    candidateName
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "candidate";

  return `mcas-extensive-career-report-${safeName}`;
}

function corePair(payload: McasReportPayload) {
  return payload.result.core.distribution.slice(0, 2);
}

function coreInitials(payload: McasReportPayload) {
  return corePair(payload).map((item) => CORE_SHORT[item.code]).join(" + ");
}

function coreLabels(payload: McasReportPayload) {
  return corePair(payload).map((item) => item.label).join(" & ");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function strengthIcon(strength: McasStrength) {
  const slug = slugify(strength.title);
  const known: Record<string, string> = {
    "cross-team-alignment": "/mcas/report-icons/cross-team-alignment.png",
    "timing-and-presence": "/mcas/report-icons/timing-presence.png",
    "communication-clarity": "/mcas/report-icons/communication-clarity.png",
    "relational-execution": "/mcas/report-icons/relational-execution.png",
    "calm-under-pressure": "/mcas/report-icons/calm-under-pressure.png",
    "gap-identification": "/mcas/report-icons/gap-identification.png",
  };
  return known[slug] ?? "/mcas/report-icons/natural-strengths.png";
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#16152E]/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#181631]/50">{label}</p>
      <p className="mt-2 text-sm font-bold text-[#17152F] md:text-base">{value}</p>
    </div>
  );
}

function ReportHeader({
  payload,
  nextStepsUrl,
  pdfFilename,
}: {
  payload: McasReportPayload;
  nextStepsUrl: string | null;
  pdfFilename: string;
}) {
  return (
    <header className="rounded-t-[30px] bg-[#EEEAFE] px-6 py-5 shadow-[0_14px_42px_rgba(0,0,0,0.32)] ring-1 ring-white/10 md:px-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-5">
          <div className="mt-2 h-10 w-12 rounded-2xl border border-white/20 bg-[#6F5CFF]/30" />
          <div>
            <p className="max-w-xl text-2xl font-semibold uppercase leading-tight tracking-[0.14em] text-[#6F5CFF] md:text-[32px] md:leading-[35px]">
              Candidate Extensive Career Report
            </p>
            <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.28em] text-[#201E41]">
              MindCanvas CORE Alignment System
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <McasFullReportActions
            variant="header"
            pdfFilename={pdfFilename}
            nextStepsUrl={nextStepsUrl}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <MetaCard label="Prepared for" value={payload.candidate.fullName} />
            <MetaCard label="Date" value={formatDate(payload.assessment.completedAt)} />
            <MetaCard label="Framework" value="Candidate Extensive Career Report" />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroMetric({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-[13px] border border-white/10 bg-white/[0.06] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-white/35">{label}</p>
      <p className="mt-2 text-[22px] font-extrabold leading-tight text-white">{value}</p>
      <p className="mt-2 text-sm font-semibold text-[#8E7BFF]">{caption}</p>
    </div>
  );
}

function OperatingStyleCard({ items, title = "Operating Style" }: { items: McasDistributionItem<McasOperatingStyleCode>[]; title?: string }) {
  return (
    <div className="self-start rounded-xl border border-[#E2E8F0] bg-white p-5 text-[#0D1B2A]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.25em] text-[#4A5568]">{title}</h3>
        <span className="rounded-full bg-[#6F5CFF]/10 px-3 py-1 text-xs font-bold text-[#6F5CFF]">Distribution</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const colour = OS_COLOURS[item.code] ?? "#6F5CFF";
          return (
            <div key={item.code} className="grid grid-cols-[28px_minmax(0,1fr)_36px_70px] items-center gap-3">
              <img src={OS_IMAGES[item.code]} alt="" className="h-7 w-7 rounded-lg object-cover shadow-sm" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold leading-4">{operatingStyleLabel(item.code)}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#EFF1F5]">
                  <div className="h-full rounded-full" style={{ width: `${pct(item.percentage)}%`, backgroundColor: colour }} />
                </div>
              </div>
              <p className="text-right text-[11px] font-semibold text-[#4A5568]">{item.percentage}%</p>
              <span className="rounded px-2 py-1 text-center text-[10px] font-semibold" style={{ backgroundColor: `${colour}14`, color: item.band === "low" ? "#718096" : colour }}>
                {bandLabel(item.band)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkCycleCoverage({
  items,
  title = "Work Cycle Coverage",
}: {
  items: McasDistributionItem<McasCoreCode>[];
  title?: string;
}) {
  const byCode = new Map(items.map((item) => [item.code, item]));

  const create = byCode.get("CREATE")?.percentage ?? 0;
  const organise = byCode.get("ORGANISE")?.percentage ?? 0;
  const resolve = byCode.get("RESOLVE")?.percentage ?? 0;
  const examine = byCode.get("EXAMINE")?.percentage ?? 0;

  const legendItems: Array<{ code: McasCoreCode; percentage: number }> = [
    { code: "ORGANISE", percentage: organise },
    { code: "RESOLVE", percentage: resolve },
    { code: "CREATE", percentage: create },
    { code: "EXAMINE", percentage: examine },
  ];

  return (
    <div className="self-start rounded-xl border border-[#E2E8F0] bg-white px-4 pb-4 pt-4 text-[#0D1B2A]">
      <p className="mb-2 text-[10px] font-bold uppercase leading-4 tracking-[0.18em] text-[#8892A4]">
        {title}
      </p>

      <div className="relative mx-auto h-[200px] w-[200px] overflow-hidden">
        <div className="absolute left-3 top-3 grid h-[176px] w-[176px] grid-cols-2 grid-rows-2 overflow-hidden rounded-full border border-[#E2E8F0]">
          <div className="relative bg-[#2C06C1]/25">
            <div className="absolute left-[34px] top-[38px] text-center">
              <p className="text-[10px] font-black leading-none text-[#2C06C1]">
                E
              </p>
              <p className="mt-1 text-[9px] leading-none text-[#0D1B2A]">
                {examine}%
              </p>
            </div>
          </div>

          <div className="relative bg-[#1725DB]/15">
            <div className="absolute left-[34px] top-[38px] text-center">
              <p className="text-[10px] font-black leading-none text-[#1725DB]">
                C
              </p>
              <p className="mt-1 text-[9px] leading-none text-[#0D1B2A]">
                {create}%
              </p>
            </div>
          </div>

          <div className="relative bg-[#028F8B]/30">
            <div className="absolute left-[34px] top-[38px] text-center">
              <p className="text-[10px] font-black leading-none text-[#028F8B]">
                R
              </p>
              <p className="mt-1 text-[9px] leading-none text-[#0D1B2A]">
                {resolve}%
              </p>
            </div>
          </div>

          <div className="relative bg-[#0A65EE]/30">
            <div className="absolute left-[34px] top-[38px] text-center">
              <p className="text-[10px] font-black leading-none text-[#0A65EE]">
                O
              </p>
              <p className="mt-1 text-[9px] leading-none text-[#0D1B2A]">
                {organise}%
              </p>
            </div>
          </div>
        </div>

        <div className="absolute left-[74px] top-[74px] flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-center">
          <p className="text-[8.5px] font-black leading-none text-[#718096]">
            CORE
          </p>
          <p className="mt-1 text-[8px] leading-none text-[#A0AEC0]">
            Balance
          </p>
        </div>
      </div>

      <div className="-mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] leading-4 text-[#6B7280]">
        {legendItems.map((item) => (
          <div key={item.code} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CORE_COLOURS[item.code] }}
            />
            <span>
              {CORE_SHORT[item.code]} {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ payload }: { payload: McasReportPayload }) {
  const primaryOs = payload.result.operatingStyle.primary;
  const primaryVertical = payload.result.careerVertical.primary;
  const readiness = payload.result.careerVertical.readinessPercentage;

  return (
    <section className="overflow-hidden border-b border-[#E8EBF4] bg-[linear-gradient(168deg,#232046_0%,#1A1836_60%,#0F0E1F_100%)] px-6 py-6 text-white md:px-8">
      <div className="grid items-start gap-6 xl:grid-cols-[500px_minmax(500px,1fr)_254px]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#8E7BFF]">Candidate Extensive Career Report</p>
          <h1 className="mt-3 text-[36px] font-black leading-none tracking-[-0.04em] md:text-[42px]">{payload.candidate.fullName}</h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/55 md:text-[14px]">
            A practical career guide — grounded, honest, and actionable. This report explains how you naturally execute work and where you are most likely to thrive.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <HeroMetric label="Operating Style" value={operatingStyleLabel(primaryOs.code)} caption="Dominant pattern" />
            <HeroMetric label="CORE Balance" value={coreInitials(payload)} caption={coreLabels(payload)} />
            <HeroMetric label="Vertical Fit" value={primaryVertical.code} caption={primaryVertical.label} />
            <HeroMetric label="Next Readiness" value={readiness === undefined ? "In development" : `${readiness}%`} caption={payload.result.careerVertical.readinessLabel ?? "Growth readiness"} />
          </div>
        </div>

        <OperatingStyleCard items={payload.result.operatingStyle.distribution} />

        <div className="space-y-4">
          <WorkCycleCoverage items={payload.result.core.distribution} />
          <HeroSummaryCard label="Core balance" value={coreInitials(payload)} caption="Dominant" />
        </div>
      </div>
    </section>
  );
}

function HeroSummaryCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#6F5CFF] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-white">{caption}</p>
    </div>
  );
}

function TopStyleStrip({ items }: { items: McasDistributionItem<McasOperatingStyleCode>[] }) {
  return (
    <div className="grid gap-4 bg-white px-6 py-5 md:grid-cols-4 md:px-8">
      {items.slice(0, 4).map((item) => (
        <div key={item.code} className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src={OS_IMAGES[item.code]} alt="" className="h-8 w-8 rounded-lg object-cover" />
              <p className="truncate font-extrabold text-[#0D1B2A]">{operatingStyleLabel(item.code)}</p>
            </div>
            <p className="text-sm font-bold text-[#718096]">{item.percentage}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#EFF1F5]">
            <div className="h-full rounded-full" style={{ width: `${pct(item.percentage)}%`, backgroundColor: OS_COLOURS[item.code] }} />
          </div>
          <p className="mt-3 text-xs font-bold text-[#718096]">{bandLabel(item.band)}</p>
        </div>
      ))}
    </div>
  );
}

function AfterHeroSummary({ payload }: { payload: McasReportPayload }) {
  const primaryVertical = payload.result.careerVertical.primary;
  const nextVertical = payload.result.careerVertical.next;
  const developmentFocus =
    payload.candidateFacing.nextStepPathway?.developmentFocus ?? [];

  const developmentCount = developmentFocus.length || 4;
  const developmentSummary =
    developmentFocus.length > 0
      ? developmentFocus
          .slice(0, 4)
          .map((item) => {
            const firstPart = item.split(/[—:.]/)[0]?.trim();
            return firstPart || item;
          })
          .join(" · ")
      : "Authority · Examine · Scope · Narrative";

  const bullets =
    developmentFocus.length > 0
      ? developmentFocus.slice(0, 3)
      : [
          "Authority clarity — own a directional position consistently",
          "Analytical partnership — build examine coverage",
          "Scope boundary management — flag overload early",
        ];

  return (
    <section className="bg-[#07111E] px-6 py-8 md:px-8">
      <div className="grid gap-7 lg:grid-cols-[460px_1fr] lg:items-center">
        <div className="grid gap-5 sm:grid-cols-2">
          <AfterHeroInfoCard
            icon="▥"
            label="Vertical Fit"
            value={`${primaryVertical.code} Now`}
            caption={
              nextVertical
                ? `${nextVertical.code} in development`
                : payload.result.careerVertical.readinessLabel ?? "Current fit"
            }
          />

          <AfterHeroInfoCard
            icon="✓"
            label="Development"
            value={`${developmentCount} areas`}
            caption={developmentSummary}
          />
        </div>

        <div className="lg:pl-8">
          <p className="text-[11px] font-black uppercase leading-4 tracking-[0.22em] text-[#2BF083]">
            Development Areas
          </p>

          <div className="mt-3 h-px w-full max-w-xl bg-[#2BF083]/70" />

          <ul className="mt-4 space-y-3">
            {bullets.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-6 text-white"
              >
                <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-[#2BF083]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AfterHeroInfoCard({
  icon,
  label,
  value,
  caption,
}: {
  icon: string;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-xl border border-[#6F5CFF] bg-[#EEEAFE] px-5 py-5 shadow-sm">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#6F5CFF] text-xl font-black text-white">
        {icon}
      </div>

      <p className="text-[12px] font-black uppercase leading-4 tracking-[0.2em] text-[#718096]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black leading-tight text-[#0D1B2A]">
        {value}
      </p>

      <p className="mt-2 text-sm leading-5 text-[#4A5568]">
        {caption}
      </p>
    </div>
  );
}

function SidebarIndex({
  token,
  pdfFilename,
}: {
  token: string;
  pdfFilename: string;
}) {
  const links = [
    ["orientation", "Welcome and Orientation"],
    ["plain-language", "Your Work Pattern in Plain Language"],
    ["style-deep-dive", "Your Operating Style Deep Dive"],
    ["pressure-strengths", "Your Strength Advantages Under Pressure"],
    ["blind-spots", "Your Blind Spots and How to Manage Them"],
    ["roles", "Your Best Fit Work and Roles"],
    ["vertical", "Your Career Vertical Fit Today"],
    ["success-guide", "Your 30 / 60 / 90 Day Success Guide"],
    ["pathway", "Your Next Step Pathway"],
  ];

  return (
    <aside className="mcas-full-report-no-print rounded-3xl border border-white/10 bg-[#1D1B3B] p-5 text-white lg:sticky lg:top-6">
      <p className="mb-4 text-[10px] uppercase tracking-[0.24em]">Report Index</p>

      <nav className="space-y-2">
        {links.map(([href, label], index) => (
          <a
            key={href}
            href={`#${href}`}
            className="block rounded-xl border border-white/35 px-3 py-2 text-sm leading-5 transition hover:bg-white/10"
          >
            {index + 1}. {label}
          </a>
        ))}
      </nav>

      <McasFullReportActions
        variant="sidebar"
        pdfFilename={pdfFilename}
        snapshotHref={`/mcas/r/${encodeURIComponent(token)}/snapshot`}
      />
    </aside>
  );
}

function SectionShell({ id, title, icon, children }: { id: string; title: string; icon: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
      <div className="rounded-[18px] bg-white p-6 md:p-8">
        <div className="mb-7 flex items-center gap-4">
          <img src={icon} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-[#3B82F6]/20" />
          <h2 className="text-2xl font-black leading-tight tracking-[-0.04em] text-[#0D0F1C]">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#EEEAFE] p-5">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#4A5568]">{title}</p>
      <p className="text-sm leading-7 text-[#4A5568]">{description}</p>
    </div>
  );
}

function OrientationSection() {
  return (
    <SectionShell id="orientation" title="Welcome and Orientation" icon="/mcas/report-icons/welcome-icon.png">
      <div className="space-y-6">
        <p className="text-base leading-8 text-[#4A5568]">
          This report explains how you naturally execute work and where you are most likely to thrive. It is designed to feel encouraging, grounded, honest, and practical.
        </p>
        <p className="text-base leading-8 text-[#4A5568]">
          MCAS does not measure intelligence, mental health, morality, or values. It measures observable work patterns.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard title="What it measures" description="Observable work patterns — execution, organisation, resolve, and examine." />
          <InfoCard title="What it doesn’t measure" description="Intelligence, mental health, morality, values, or personality traits." />
          <InfoCard title="How to use it" description="Return to it. Share sections. Use the 30/60/90 guide. Treat it as a strategic tool." />
        </div>
      </div>
    </SectionShell>
  );
}

function PlainLanguageSection({ payload }: { payload: McasReportPayload }) {
  return (
    <SectionShell id="plain-language" title="Your Work Pattern in Plain Language" icon="/mcas/report-icons/work-style.png">
      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
        <p className="text-lg leading-9 text-[#0D1B2A]">{payload.candidateFacing.workPatternSummary}</p>
      </div>
    </SectionShell>
  );
}

function OperatingStyleDeepDive({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.operatingStyle.primary;

  return (
    <section
      id="style-deep-dive"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/operating-style-identity-system.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your Operating Style Deep Dive
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-6 md:px-7 md:py-7">
        <p className="mb-6 text-[13px] leading-7 text-[#4A5568]">
          The Operating Style reveals the candidate&apos;s natural execution
          pattern. The distribution below reflects scored pattern strength, not
          a ranking against others.
        </p>

        <div className="grid items-center gap-8 lg:grid-cols-[410px_1fr]">
          <div className="flex justify-center">
            <img
              src="/mcas/graphics/operating-style-system.png"
              alt="Operating style identity system"
              className="h-auto max-h-[335px] w-full max-w-[390px] object-contain"
            />
          </div>

          <div className="rounded-[13px] border border-[#E2E8F0] bg-white p-6">
            <div className="grid items-start gap-5 md:grid-cols-[64px_1fr]">
              <img
                src={OS_IMAGES[primary.code]}
                alt=""
                className="h-16 w-16 rounded-[13px] object-cover shadow-sm"
              />

              <div>
                <p className="text-[10px] font-bold uppercase leading-4 tracking-[0.22em] text-[#718096]">
                  Operating Style · Profile{" "}
                  {primary.code.replace("OS", "").padStart(2, "0")}
                </p>

                <h3 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.04em] text-[#0D0F1C]">
                  The {operatingStyleLabel(primary.code)}
                </h3>

                <p className="mt-4 max-w-[470px] text-[13px] leading-7 text-[#5A5F7E]">
                  {payload.candidateFacing.operatingStyleNarrative}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreBalanceSection({ payload }: { payload: McasReportPayload }) {
  const byCode = new Map(
    payload.result.core.distribution.map((item) => [item.code, item])
  );

  const orderedItems = (
    ["CREATE", "ORGANISE", "RESOLVE", "EXAMINE"] as McasCoreCode[]
  )
    .map((code) => byCode.get(code))
    .filter(
      (item): item is McasDistributionItem<McasCoreCode> => item !== undefined
    );

  return (
    <section
      id="core-balance"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/core-behavioural-balance.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your CORE Behavioural Balance
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-6 md:px-7 md:py-7">
        <p className="mb-6 text-[13px] leading-7 text-[#4A5568]">
          The CORE system maps which parts of the work cycle the candidate
          naturally drives, supports, or under-covers.
        </p>

        <div className="grid items-center gap-8 lg:grid-cols-[360px_1fr]">
          <div className="flex justify-center">
            <img
              src="/mcas/graphics/your-core-behaviour.png"
              alt="Your CORE behaviour"
              className="h-auto max-h-[260px] w-full max-w-[330px] object-contain"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {orderedItems.map((item) => (
              <CoreCompactCard key={item.code} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreCompactCard({
  item,
}: {
  item: McasDistributionItem<McasCoreCode>;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-3 flex items-start gap-3">
        <img
          src={CORE_IMAGES[item.code]}
          alt=""
          className="h-8 w-8 rounded-lg object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-black leading-4 text-[#0D0F1C]">
                {item.label}
              </p>
              <p className="mt-1 text-[11px] font-bold leading-4 text-[#6F5CFF]">
                {item.percentage}% · {bandLabel(item.band)}
              </p>
            </div>

            <span className="rounded-md bg-[#6F5CFF]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#6F5CFF]">
              {CORE_SHORT[item.code]}
            </span>
          </div>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#EFF1F5]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct(item.percentage)}%`,
                backgroundColor: CORE_COLOURS[item.code],
              }}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-5 text-[#4A5568]">
        {item.description}
      </p>
    </div>
  );
}

function pressureStrengthCards(strengths: McasStrength[]) {
  const extras: McasStrength[] = [
    {
      title: "Pattern recognition",
      description:
        "You notice where quality, structure, or execution can be improved before it becomes a larger issue.",
    },
    {
      title: "Quality protection",
      description:
        "You naturally protect standards and help prevent rushed or incomplete work from becoming the default.",
    },
    {
      title: "Improvement discipline",
      description:
        "You bring a thoughtful improvement lens that helps work become cleaner, stronger, and more sustainable.",
    },
  ];

  const combined = [...strengths];

  for (const extra of extras) {
    if (combined.length >= 6) break;

    const alreadyExists = combined.some(
      (item) => item.title.toLowerCase() === extra.title.toLowerCase()
    );

    if (!alreadyExists) {
      combined.push(extra);
    }
  }

  return combined.slice(0, 6);
}

function PressureStrengthsSection({ strengths }: { strengths: McasStrength[] }) {
  const cards = pressureStrengthCards(strengths);

  return (
    <section
      id="pressure-strengths"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/natural-strengths.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your Strength Advantages Under Pressure
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-6 md:px-7 md:py-7">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((strength) => (
            <StrengthCompactCard key={strength.title} strength={strength} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StrengthCompactCard({ strength }: { strength: McasStrength }) {
  return (
    <div className="min-h-[108px] rounded-xl border border-[#45E0D1] bg-[#F8FAFC] p-4">
      <img
        src={strengthIcon(strength)}
        alt=""
        className="mb-3 h-8 w-8 rounded-lg object-cover"
      />

      <h3 className="text-[13px] font-black leading-4 text-[#0D0F1C]">
        {strength.title}
      </h3>

      <p className="mt-2 text-[11px] leading-5 text-[#4A5568]">
        {strength.description}
      </p>
    </div>
  );
}

function blindSpotCards(blindSpots: McasBlindSpot[]) {
  const extras: McasBlindSpot[] = [
    {
      title: "Over-refinement loop",
      description:
        "You may keep improving work beyond the point where the next useful step is release, feedback, or decision.",
      managementStrategy:
        "Define the standard needed for this stage before you refine. Ask whether the work needs precision, progress, or feedback.",
    },
    {
      title: "Delayed release",
      description:
        "Your quality instinct can make it harder to move work forward while there are still visible gaps or imperfections.",
      managementStrategy:
        "Separate essential fixes from later improvements. Move forward when the work is safe, clear, and useful enough.",
    },
    {
      title: "Standards friction",
      description:
        "You may experience frustration when others move quickly without checking the quality, logic, or sustainability of the work.",
      managementStrategy:
        "Name the standard clearly and explain why it matters. Turn the concern into a practical checkpoint instead of a blocker.",
    },
    {
      title: "Improvement fatigue",
      description:
        "Constantly seeing what can be improved may become tiring for you and for the people around you.",
      managementStrategy:
        "Choose the few improvements that will create the most value. Let lower-impact refinements wait until the next review cycle.",
    },
  ];

  const combined = [...blindSpots];

  for (const extra of extras) {
    if (combined.length >= 4) break;

    const exists = combined.some(
      (item) => item.title.toLowerCase() === extra.title.toLowerCase()
    );

    if (!exists) {
      combined.push(extra);
    }
  }

  return combined.slice(0, 4);
}

function blindSpotAccent(index: number) {
  const accents = [
    {
      border: "#2563EB",
      text: "#2563EB",
    },
    {
      border: "#028F8B",
      text: "#028F8B",
    },
    {
      border: "#F59E0B",
      text: "#F59E0B",
    },
    {
      border: "#8B5CF6",
      text: "#6F5CFF",
    },
  ];

  return accents[index % accents.length];
}

function BlindSpotsSection({
  blindSpots,
}: {
  blindSpots: McasBlindSpot[];
}) {
  const cards = blindSpotCards(blindSpots);

  return (
    <section
      id="blind-spots"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/blind-spots.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your Blind Spots and How to Manage Them
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-6 md:px-7 md:py-7">
        <p className="mb-5 max-w-5xl text-[13px] leading-7 text-[#4A5568]">
          Blind spots are not weaknesses. They are the natural shadow of your
          strengths — the places where your dominant pattern, applied without
          awareness, can create friction or limit impact.
        </p>

        <div className="space-y-3">
          {cards.map((blindSpot, index) => {
            const accent = blindSpotAccent(index);

            return (
              <div
                key={`${blindSpot.title}-${index}`}
                className="rounded-xl border bg-white px-5 py-4"
                style={{ borderColor: accent.border }}
              >
                <p
                  className="text-[10px] font-black uppercase leading-4 tracking-[0.22em]"
                  style={{ color: accent.text }}
                >
                  Blind Spot {String(index + 1).padStart(2, "0")}
                </p>

                <h3 className="mt-2 text-[14px] font-black leading-5 text-[#0D0F1C]">
                  {blindSpot.title}
                </h3>

                <p className="mt-2 text-[12px] leading-5 text-[#4A5568]">
                  {blindSpot.description}
                </p>

                <p
                  className="mt-3 text-[10px] font-black uppercase leading-4 tracking-[0.18em]"
                  style={{ color: accent.text }}
                >
                  Management strategy
                </p>

                <p className="mt-1 text-[11px] leading-5 text-[#4A5568]">
                  {blindSpot.managementStrategy}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function roleCardsForDisplay(
  roles: McasRoleRecommendation[]
): McasRoleRecommendation[] {
  const fallbacks: McasRoleRecommendation[] = [
    {
      category: "People & Culture",
      title: "People Partner",
      description: "Cross-functional alignment, talent advocacy",
    },
    {
      category: "Programme Management",
      title: "Programme Lead",
      description: "Multi-team delivery, stakeholder management",
    },
    {
      category: "Strategy & Operations",
      title: "Chief of Staff",
      description: "Executive alignment, operational bridging",
    },
    {
      category: "Customer Success",
      title: "CS Director",
      description: "Relationship-led retention and growth",
    },
    {
      category: "Communications",
      title: "Comms Lead",
      description: "Narrative clarity, internal alignment",
    },
    {
      category: "Consulting",
      title: "Senior Consultant",
      description: "Client alignment, delivery ownership",
    },
  ];

  const combined = [...roles];

  for (const fallback of fallbacks) {
    if (combined.length >= 6) break;

    const exists = combined.some(
      (item) =>
        item.title.toLowerCase() === fallback.title.toLowerCase() ||
        item.category.toLowerCase() === fallback.category.toLowerCase()
    );

    if (!exists) {
      combined.push(fallback);
    }
  }

  return combined.slice(0, 6);
}

function RolesSection({ roles }: { roles: McasRoleRecommendation[] }) {
  const cards = roleCardsForDisplay(roles);
  const leftCards = [cards[0], cards[2], cards[4]].filter(
    (item): item is McasRoleRecommendation => Boolean(item)
  );
  const rightCards = [cards[1], cards[3], cards[5]].filter(
    (item): item is McasRoleRecommendation => Boolean(item)
  );

  return (
    <section
      id="roles"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/role-fit.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your Best Fit Work and Roles
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-6 md:px-7 md:py-7">
        <div className="grid gap-4 lg:hidden">
          {cards.map((role) => (
            <RoleDiagramCard
              key={`${role.category}-${role.title}`}
              role={role}
            />
          ))}
        </div>

        <div className="hidden min-h-[420px] grid-cols-[minmax(0,1fr)_390px_minmax(0,1fr)] grid-rows-3 gap-y-5 lg:grid">
          {leftCards.map((role, index) => (
            <div
              key={`${role.category}-${role.title}`}
              className="relative flex items-center pr-12"
              style={{ gridColumn: 1, gridRow: index + 1 }}
            >
              <RoleDiagramCard role={role} />
              <span className="absolute right-0 top-1/2 h-[2px] w-12 -translate-y-1/2 bg-[#6F5CFF]" />
            </div>
          ))}

          <div className="relative col-start-2 row-span-3 flex min-h-[420px] items-center justify-center px-2">
            <img
              src="/mcas/graphics/best-fit-work.png"
              alt="Best fit work"
              className="h-auto w-[380px] max-w-full object-contain"
            />
          </div>

          {rightCards.map((role, index) => (
            <div
              key={`${role.category}-${role.title}`}
              className="relative flex items-center pl-12"
              style={{ gridColumn: 3, gridRow: index + 1 }}
            >
              <span className="absolute left-0 top-1/2 h-[2px] w-12 -translate-y-1/2 bg-[#6F5CFF]" />
              <RoleDiagramCard role={role} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleDiagramCard({
  role,
}: {
  role: McasRoleRecommendation;
}) {
  return (
    <div className="flex min-h-[118px] w-full flex-col justify-center rounded-xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.12)]">
      <p className="text-[10px] font-black uppercase leading-4 tracking-[0.22em] text-[#2F6FB8]">
        {role.category}
      </p>

      <h3 className="mt-2 text-[14px] font-black leading-5 text-[#0D0F1C]">
        {role.title}
      </h3>

      <p className="mt-2 text-[12px] leading-5 text-[#5A5F7E]">
        {role.description}
      </p>
    </div>
  );
}

function verticalLevelNumber(code: string) {
  const value = Number(String(code || "").replace("V", ""));
  return Number.isFinite(value) ? value : 0;
}

function careerVerticalStatusMeta(
  level: number,
  primaryLevel: number,
  readinessPercentage?: number
) {
  if (level < primaryLevel) {
    return {
      label: "Completed",
      barWidth: 100,
      barColor: "#5B5CFF",
      rowTone: "completed" as const,
      pillClass: "bg-[#ECEAFE] text-[#5B5CFF]",
      numberClass: "border-[#A5B4FC] bg-white text-[#5B5CFF]",
    };
  }

  if (level === primaryLevel) {
    return {
      label: "Current Fit",
      barWidth: 100,
      barColor: "#5B5CFF",
      rowTone: "current" as const,
      pillClass: "bg-[#111827] text-white",
      numberClass: "bg-[#0D1B2A] text-white border-[#0D1B2A]",
    };
  }

  if (level === primaryLevel + 1) {
    const width = typeof readinessPercentage === "number" ? Math.max(18, Math.min(100, Math.round(readinessPercentage))) : 38;
    return {
      label: "Stretch with support",
      barWidth: width,
      barColor: "#F59E0B",
      rowTone: "stretch" as const,
      pillClass: "bg-[#FFF3D6] text-[#C56A00]",
      numberClass: "border-[#F8D58A] bg-[#FFF7E5] text-[#C56A00]",
    };
  }

  if (level === primaryLevel + 2) {
    return {
      label: "Overreach risk",
      barWidth: 22,
      barColor: "#CBD5E1",
      rowTone: "future" as const,
      pillClass: "bg-[#F1F5F9] text-[#64748B]",
      numberClass: "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]",
    };
  }

  return {
    label: "Not indicated",
    barWidth: 8,
    barColor: "#E2E8F0",
    rowTone: "future" as const,
    pillClass: "bg-[#F8FAFC] text-[#94A3B8]",
    numberClass: "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]",
  };
}

function VerticalInfoChip({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#D9E2F1] bg-white px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-lg font-bold text-white">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#4338CA]">
          {title}
        </p>
        <p className="mt-1 text-[11px] leading-4 text-[#4A5568]">{description}</p>
      </div>
    </div>
  );
}

function CareerVerticalSection({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.careerVertical.primary;
  const readinessPercentage = payload.result.careerVertical.readinessPercentage;
  const order = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
  const primaryLevel = verticalLevelNumber(primary.code);

  const verticals = order.map((code) => {
    return (
      payload.result.careerVertical.distribution.find((item) => item.code === code) ?? {
        code,
        label: code,
        percentage: 0,
        rank: 99,
        band: "low" as const,
        description: "",
      }
    );
  });

  return (
    <SectionShell
      id="vertical"
      title="Your Career Vertical Fit Today"
      icon="/mcas/report-icons/career-vertical-fit.png"
    >
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FCFCFF] p-4 md:p-5">
          <img
            src="/mcas/graphics/career-vertical-fit.png"
            alt="Career vertical fit"
            className="w-full rounded-xl object-contain"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <VerticalInfoChip
            icon="↗"
            title="Increasing Scope"
            description="Wider impact and responsibility"
          />
          <VerticalInfoChip
            icon="◎"
            title="Increasing Complexity"
            description="More variables and interdependencies."
          />
          <VerticalInfoChip
            icon="★"
            title="Increasing Accountability"
            description="Greater ownership and outcomes."
          />
        </div>

        <p className="text-[14px] leading-7 text-[#4A5568]">
          Progression changes work itself. Higher verticals increase ambiguity,
          scope, and accountability.
        </p>

        <div className="space-y-3">
          {verticals.map((item) => {
            const level = verticalLevelNumber(item.code);
            const meta = careerVerticalStatusMeta(
              level,
              primaryLevel,
              readinessPercentage
            );

            return (
              <div
                key={item.code}
                className={[
                  "grid items-center gap-3 rounded-2xl border px-4 py-3 md:grid-cols-[auto_1.5fr_1fr_auto]",
                  level === primaryLevel
                    ? "border-[#5B5CFF] bg-[#F5F3FF]"
                    : "border-transparent bg-white",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black",
                    meta.numberClass,
                  ].join(" ")}
                >
                  {level < primaryLevel ? "✓" : level}
                </div>

                <div>
                  <p className="text-[14px] font-black text-[#0D0F1C]">
                    {item.code} · {item.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#718096]">
                    {item.description}
                  </p>
                </div>

                <div className="w-full">
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${meta.barWidth}%`,
                        backgroundColor: meta.barColor,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <span
                    className={[
                      "inline-flex rounded-md px-3 py-1 text-[10px] font-bold",
                      meta.pillClass,
                    ].join(" ")}
                  >
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

function successGuideCards(
  successGuide: McasSuccessGuideItem[]
): McasSuccessGuideItem[] {
  const defaults: McasSuccessGuideItem[] = [
    {
      period: "days_1_30",
      title: "Map & listen",
      description:
        "Identify the key relationships and communication gaps in your environment. Build a simple map of who connects to whom and where misalignment exists.",
    },
    {
      period: "days_31_60",
      title: "Create your alignment structure",
      description:
        "Build the relational and process bridges your role requires. Establish your communication rhythms.",
    },
    {
      period: "days_61_90",
      title: "Lead with presence",
      description:
        "Expand your impact by taking clear directional stances and reviewing how your work is landing across the system.",
    },
  ];

  return defaults.map((fallback, index) => successGuide[index] ?? fallback);
}

function successGuideTone(index: number) {
  const tones = [
    {
      bg: "#EAF8F5",
      label: "#028F8B",
    },
    {
      bg: "#F5F8FC",
      label: "#2563EB",
    },
    {
      bg: "#FFF8EA",
      label: "#F59E0B",
    },
  ];

  return tones[index % tones.length];
}

function SuccessGuideSection({
  successGuide,
}: {
  successGuide: McasSuccessGuideItem[];
}) {
  const cards = successGuideCards(successGuide);

  return (
    <section
      id="success-guide"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/success-guide.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your 30 / 60 / 90 Day Success Guide
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-7 md:px-8 md:py-8">
        <div className="mb-8 hidden md:block">
          <div className="relative mx-auto max-w-[920px] px-10">
            <div className="absolute left-[16.6%] right-[16.6%] top-8 h-[3px] rounded-full bg-gradient-to-r from-[#0F9E9A] via-[#6F5CFF] to-[#F59E0B]" />

            <div className="relative grid grid-cols-3">
              {cards.map((item, index) => (
                <SuccessGuideTimelineNode
                  key={`${item.period}-timeline`}
                  index={index}
                  period={item.period}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-[#E2E8F0] md:grid-cols-3">
          {cards.map((item, index) => {
            const tone = successGuideTone(index);

            return (
              <div
                key={item.period}
                className="min-h-[224px] p-6"
                style={{ backgroundColor: tone.bg }}
              >
                <p
                  className="text-[10px] font-black uppercase leading-4 tracking-[0.2em]"
                  style={{ color: tone.label }}
                >
                  {periodLabel(item.period)}
                </p>

                <h3 className="mt-4 text-[17px] font-black leading-6 text-[#0D0F1C]">
                  {item.title}
                </h3>

                <p className="mt-3 text-[13px] leading-6 text-[#4A5568]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SuccessGuideTimelineNode({
  index,
  period,
}: {
  index: number;
  period: McasSuccessGuideItem["period"];
}) {
  const tones = [
    {
      fill: "bg-[#0F9E9A]",
      ring: "ring-[#CBEFEB]",
      text: "text-[#0F9E9A]",
    },
    {
      fill: "bg-[#6F5CFF]",
      ring: "ring-[#DED8FF]",
      text: "text-[#6F5CFF]",
    },
    {
      fill: "bg-[#F59E0B]",
      ring: "ring-[#FFE5AE]",
      text: "text-[#F59E0B]",
    },
  ];

  const tone = tones[index] ?? tones[0];

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={[
          "relative z-10 flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white ring-8",
          tone.fill,
          tone.ring,
        ].join(" ")}
      >
        {index + 1}
      </span>

      <p
        className={[
          "mt-4 text-[10px] font-black uppercase tracking-[0.18em]",
          tone.text,
        ].join(" ")}
      >
        {periodLabel(period)}
      </p>
    </div>
  );
}

function verticalCodeFromLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(6, Math.round(level)));
  return `V${safeLevel}`;
}

function verticalLevelFromCode(code: string) {
  const value = Number(String(code || "").replace("V", ""));
  return Number.isFinite(value) ? value : 1;
}

function verticalSummaryForCode(payload: McasReportPayload, code: string) {
  const item = payload.result.careerVertical.distribution.find(
    (vertical) => vertical.code === code
  );

  if (item) {
    return {
      code: item.code,
      label: item.label,
      description: item.description ?? `${item.code} — ${item.label}`,
    };
  }

  const fallback: Record<string, { label: string; description: string }> = {
    V1: {
      label: "Entry / Foundational",
      description: "Task-level execution with guided delivery.",
    },
    V2: {
      label: "Developing",
      description: "Growing ownership with structured guidance.",
    },
    V3: {
      label: "Established",
      description: "Established execution.",
    },
    V4: {
      label: "Senior Scope",
      description: "Senior cross-functional scope.",
    },
    V5: {
      label: "Strategic Leadership",
      description: "Strategic leadership.",
    },
    V6: {
      label: "Executive / Enterprise",
      description: "Enterprise leadership and long-horizon strategy.",
    },
  };

  return {
    code,
    label: fallback[code]?.label ?? code,
    description: fallback[code]?.description ?? "Future growth pathway.",
  };
}

function NextStepPathwaySection({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.careerVertical.primary;
  const primaryLevel = verticalLevelFromCode(primary.code);
  const nextCode = verticalCodeFromLevel(primaryLevel + 1);
  const futureCode = verticalCodeFromLevel(primaryLevel + 2);

  const currentVertical = verticalSummaryForCode(payload, primary.code);
  const nextVertical = verticalSummaryForCode(payload, nextCode);
  const futureVertical = verticalSummaryForCode(payload, futureCode);

  const developmentFocus =
    payload.candidateFacing.nextStepPathway?.developmentFocus ?? [];

  const developmentOne =
    developmentFocus[0] ?? "Authority clarity, analytical coverage";
  const developmentTwo =
    developmentFocus[1] ?? "Strategic narrative, scope expansion";

  return (
    <section
      id="pathway"
      className="rounded-3xl border border-white/10 bg-[#6F5CFF] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-4 flex items-center gap-3 px-2 pt-1">
        <img
          src="/mcas/report-icons/your-next-steps.png"
          alt=""
          className="h-10 w-10 rounded-xl object-cover"
        />
        <h2 className="text-[15px] font-bold leading-5 text-white">
          Your Next Step Pathway
        </h2>
      </div>

      <div className="rounded-[18px] bg-white px-6 py-7 md:px-8 md:py-8">
        <p className="mb-7 text-[14px] leading-7 text-[#4A5568]">
          Growth is not about becoming a different type of person — it is about
          expanding the range and sustainability of your natural pattern.
        </p>

        <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#2F6FB8] bg-[#F8FAFC]">
          <div className="grid divide-y divide-[#D9E2F1] md:grid-cols-[1fr_0.85fr_1fr_0.85fr_1fr] md:divide-x md:divide-y-0">
            <PathwayStageCell
              code={currentVertical.code}
              label="Now"
              description={currentVertical.description}
              emphasis="current"
            />

            <PathwayBridgeCell
              title="Development"
              description={developmentOne}
            />

            <PathwayStageCell
              code={nextVertical.code}
              label="Next Stage"
              description={nextVertical.description}
              emphasis="next"
            />

            <PathwayBridgeCell
              title="Preparation"
              description={developmentTwo}
            />

            <PathwayStageCell
              code={futureVertical.code}
              label="Future"
              description={futureVertical.description}
              emphasis="future"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PathwayStageCell({
  code,
  label,
  description,
  emphasis,
}: {
  code: string;
  label: string;
  description: string;
  emphasis: "current" | "next" | "future";
}) {
  return (
    <div className="flex min-h-[130px] flex-col items-center justify-center px-5 py-6 text-center">
      <p
        className={[
          "text-[28px] font-black leading-none",
          emphasis === "current"
            ? "text-[#028F8B]"
            : emphasis === "next"
              ? "text-[#028F8B]"
              : "text-[#028F8B]",
        ].join(" ")}
      >
        {code}
      </p>

      <p className="mt-3 text-[13px] font-black leading-5 text-[#0D0F1C]">
        {label}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-[#718096]">
        {description}
      </p>
    </div>
  );
}

function PathwayBridgeCell({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[130px] flex-col items-center justify-center px-4 py-6 text-center">
      <p className="text-[20px] font-black leading-none text-[#028F8B]">→</p>

      <p className="mt-4 text-[12px] font-black leading-5 text-[#0D0F1C]">
        {title}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-[#718096]">
        {description}
      </p>
    </div>
  );
}

function PathwayCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 text-center">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6F5CFF]">{label}</p>
      <p className="mt-3 text-lg font-black leading-6 text-[#0D0F1C]">{value}</p>
    </div>
  );
}

function PathwayArrow() {
  return <div className="hidden text-center text-2xl font-black text-[#6F5CFF] md:block">→</div>;
}

function LockedFullReport({ payload, token }: { payload: McasReportPayload; token: string }) {
  return (
    <main className="min-h-screen bg-[#0D0F1C] px-5 py-6 text-[#0D0F1C]">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[30px] bg-white shadow-2xl">
        <ReportHeader
          payload={payload}
          nextStepsUrl={getConfiguredNextStepsUrl(payload)}
          pdfFilename={reportPdfFilename(payload.candidate.fullName)}
        />
        <section className="bg-[linear-gradient(168deg,#232046_0%,#1A1836_60%,#0F0E1F_100%)] px-6 py-12 text-center text-white md:px-10">
          <div className="mx-auto max-w-3xl">
            <img src="/mcas/report-icons/unlock-full-report.png" alt="" className="mx-auto mb-5 h-16 w-16 rounded-2xl object-cover" />
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#8E7BFF]">Full report locked</p>
            <h1 className="text-3xl font-black tracking-tight md:text-5xl">Unlock Your Full Strategic Career Growth Report</h1>
            <p className="mt-5 text-base leading-7 text-white/60">
              Your MCAS assessment has already been completed. You do not need to take the test again. The full report uses the same result and unlocks deeper guidance.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={`/mcas/r/${token}/snapshot`} className="rounded-lg bg-white px-6 py-3 text-sm font-black text-[#111827]">Return to Snapshot</a>
              <a href="#full-preview" className="rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-6 py-3 text-sm font-black text-white">See What Unlocks</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function McasFullReportPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  if (!token) notFound();

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

  const nextStepsUrl = getConfiguredNextStepsUrl(payload);
  const pdfFilename = reportPdfFilename(payload.candidate.fullName);

  return (
    <main className="min-h-screen bg-[#0D0F1C] py-6 text-[#0D0F1C]">
      <div className="mcas-full-report-print-shell mx-auto max-w-[1440px] overflow-hidden rounded-[30px] bg-[#0D0F1C] shadow-2xl">
        <ReportHeader
          payload={payload}
          nextStepsUrl={nextStepsUrl}
          pdfFilename={pdfFilename}
        />
        <Hero payload={payload} />
        <TopStyleStrip items={payload.result.operatingStyle.distribution} />
        <AfterHeroSummary payload={payload} />

        <div className="mcas-full-report-content-grid grid gap-6 px-6 py-9 md:px-8 lg:grid-cols-[260px_1fr]">
          <SidebarIndex token={token} pdfFilename={pdfFilename} />
          <div className="space-y-8">
            <OrientationSection />
            <PlainLanguageSection payload={payload} />
            <OperatingStyleDeepDive payload={payload} />
            <CoreBalanceSection payload={payload} />
            <PressureStrengthsSection strengths={payload.candidateFacing.strengths} />
            <BlindSpotsSection blindSpots={payload.candidateFacing.blindSpots ?? []} />
            <RolesSection roles={payload.candidateFacing.roleRecommendations} />
            <CareerVerticalSection payload={payload} />
            <SuccessGuideSection successGuide={payload.candidateFacing.successGuide ?? []} />
            <NextStepPathwaySection payload={payload} />
          </div>
        </div>
      </div>
    </main>
  );
}