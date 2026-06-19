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
  params: Promise<{ token: string }>;
};

const OS_IMAGES: Record<McasOperatingStyleCode, string> = {
  OS1: "/mcas/profile-cards/trailblazer.png",
  OS2: "/mcas/profile-cards/spark.png",
  OS3: "/mcas/profile-cards/uplifter.png",
  OS4: "/mcas/profile-cards/bridgebuilder.png",
  OS5: "/mcas/profile-cards/steadyhead.png",
  OS6: "/mcas/profile-cards/organiser.png",
  OS7: "/mcas/profile-cards/analyst.png",
  OS8: "/mcas/profile-cards/refiner.png",
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

function ReportHeader({ payload }: { payload: McasReportPayload }) {
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
          <div className="flex flex-wrap gap-3 xl:justify-end">
            <a href="#download" className="inline-flex h-10 items-center rounded-lg bg-[#191733] px-5 text-sm font-bold text-white">
              Download PDF
            </a>
            <a href="#pathway" className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-5 text-sm font-bold text-white">
              Next steps
            </a>
          </div>
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
                <p className="truncate text-[12px] font-bold leading-4">{item.label}</p>
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

function WorkCycleCoverage({ items, title = "Work Cycle Coverage" }: { items: McasDistributionItem<McasCoreCode>[]; title?: string }) {
  const byCode = new Map(items.map((item) => [item.code, item]));
  const create = byCode.get("CREATE")?.percentage ?? 0;
  const organise = byCode.get("ORGANISE")?.percentage ?? 0;
  const resolve = byCode.get("RESOLVE")?.percentage ?? 0;
  const examine = byCode.get("EXAMINE")?.percentage ?? 0;

  return (
    <div className="self-start rounded-xl border border-[#E2E8F0] bg-white p-4 text-[#0D1B2A]">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8892A4]">{title}</p>
      <div className="mx-auto grid h-[164px] w-[164px] grid-cols-2 grid-rows-2 overflow-hidden rounded-full border-[7px] border-[#EEEAFE] text-center text-[10px] font-bold">
        <div className="flex flex-col items-center justify-center bg-[#2C06C1]/20"><span>Create</span><span className="text-[#1725DB]">{create}%</span></div>
        <div className="flex flex-col items-center justify-center bg-[#1725DB]/10"><span>Organise</span><span className="text-[#0A65EE]">{organise}%</span></div>
        <div className="flex flex-col items-center justify-center bg-[#028F8B]/20"><span>Resolve</span><span className="text-[#028F8B]">{resolve}%</span></div>
        <div className="flex flex-col items-center justify-center bg-[#0A65EE]/20"><span>Examine</span><span className="text-[#2C06C1]">{examine}%</span></div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] text-[#6B7280]">
        {items.map((item) => (
          <div key={item.code} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CORE_COLOURS[item.code] }} />
            <span>{CORE_SHORT[item.code]} {item.percentage}%</span>
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
            <HeroMetric label="Operating Style" value={primaryOs.label} caption="Dominant pattern" />
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
              <p className="truncate font-extrabold text-[#0D1B2A]">{item.label}</p>
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

function SidebarIndex({ token }: { token: string }) {
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
    <aside className="rounded-3xl border border-white/10 bg-[#1D1B3B] p-5 text-white lg:sticky lg:top-6">
      <p className="mb-4 text-[10px] uppercase tracking-[0.24em]">Report Index</p>
      <nav className="space-y-2">
        {links.map(([href, label], index) => (
          <a key={href} href={`#${href}`} className="block rounded-xl border border-white/35 px-3 py-2 text-sm leading-5 transition hover:bg-white/10">
            {index + 1}. {label}
          </a>
        ))}
      </nav>
      <div className="mt-6 space-y-2">
        <a id="download" href="#" className="block rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-[#111827]">Download PDF</a>
        <a href={`/mcas/r/${token}/snapshot`} className="block rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-4 py-3 text-center text-sm font-bold text-white">View Snapshot</a>
      </div>
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
                  The {primary.label}
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

function BlindSpotsSection({ blindSpots }: { blindSpots: McasBlindSpot[] }) {
  return (
    <SectionShell id="blind-spots" title="Your Blind Spots and How to Manage Them" icon="/mcas/report-icons/blind-spots.png">
      <div className="space-y-6">
        <p className="text-base leading-8 text-[#4A5568]">
          Blind spots are not weaknesses. They are the natural shadow of your strengths — the places where your dominant pattern, applied without awareness, can create friction or limit impact.
        </p>
        <div className="space-y-4">
          {blindSpots.map((blindSpot, index) => (
            <div key={blindSpot.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6F5CFF]">Blind Spot {String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-xl font-black text-[#0D0F1C]">{blindSpot.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#4A5568]">{blindSpot.description}</p>
              <div className="mt-5 rounded-2xl bg-[#EEEAFE] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#4A5568]">Management strategy</p>
                <p className="mt-2 text-sm leading-7 text-[#4A5568]">{blindSpot.managementStrategy}</p>
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
    <SectionShell id="roles" title="Your Best Fit Work and Roles" icon="/mcas/report-icons/recommended-roles-pathways.png">
      <div className="grid gap-6 lg:grid-cols-[1fr_220px_1fr]">
        <div className="space-y-4">{roles.slice(0, 3).map((role) => <RoleCard key={`${role.category}-${role.title}`} role={role} />)}</div>
        <div className="hidden items-center justify-center lg:flex">
          <img src="/mcas/report-icons/recommended-roles-pathways.png" alt="" className="max-h-56 w-full object-contain" />
        </div>
        <div className="space-y-4">{roles.slice(3, 6).map((role) => <RoleCard key={`${role.category}-${role.title}`} role={role} />)}</div>
      </div>
    </SectionShell>
  );
}

function RoleCard({ role }: { role: McasRoleRecommendation }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6F5CFF]">{role.category}</p>
      <h3 className="mt-3 text-lg font-black leading-6 text-[#0D0F1C]">{role.title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#4A5568]">{role.description}</p>
    </div>
  );
}

function CareerVerticalSection({ payload }: { payload: McasReportPayload }) {
  const primary = payload.result.careerVertical.primary;
  const order = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
  const primaryLevel = Number(primary.code.replace("V", ""));

  const verticals = order.map((code) => {
    return payload.result.careerVertical.distribution.find((item) => item.code === code) ?? {
      code,
      label: code,
      percentage: 0,
      rank: 99,
      band: "low" as const,
      description: "",
    };
  });

  return (
    <SectionShell id="vertical" title="Your Career Vertical Fit Today" icon="/mcas/report-icons/career-vertical-fit.png">
      <div className="space-y-7">
        <p className="text-base leading-8 text-[#4A5568]">
          Progression changes work itself. Higher verticals increase ambiguity, scope, and accountability. Your current indication is{" "}
          <strong className="text-[#0D0F1C]">{primary.code} — {primary.label}</strong>.
        </p>
        <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
          <div className="absolute inset-x-8 bottom-8 h-24 rounded-full bg-gradient-to-r from-[#45E0D1]/20 via-[#6F5CFF]/25 to-[#8B5CF6]/40 blur-2xl" />
          <div className="relative grid gap-4 md:grid-cols-6">
            {verticals.map((item) => {
              const isPrimary = item.code === primary.code;
              const level = Number(item.code.replace("V", ""));
              const isPast = level < primaryLevel;
              return (
                <div key={item.code} className={["min-h-[150px] rounded-2xl p-4", isPrimary ? "bg-[#6F5CFF] text-white shadow-lg" : "bg-white text-[#0D1B2A]"].join(" ")}>
                  <p className="text-lg font-black">{item.code}</p>
                  <p className="mt-1 text-sm font-bold leading-5">{item.label}</p>
                  <p className={["mt-3 text-xs leading-5", isPrimary ? "text-white/80" : "text-[#718096]"].join(" ")}>{item.description}</p>
                  <p className={["mt-4 text-[11px] font-bold uppercase tracking-[0.16em]", isPrimary ? "text-white" : isPast ? "text-[#028F8B]" : "text-[#718096]"].join(" ")}>
                    {isPrimary ? "Current Fit" : isPast ? "Completed" : "Stretch"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        {payload.result.careerVertical.readinessLabel ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#EEEAFE] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6F5CFF]">Readiness note</p>
            <p className="mt-2 text-sm leading-7 text-[#4A5568]">{payload.result.careerVertical.readinessLabel}</p>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

function SuccessGuideSection({ successGuide }: { successGuide: McasSuccessGuideItem[] }) {
  return (
    <SectionShell id="success-guide" title="Your 30 / 60 / 90 Day Success Guide" icon="/mcas/report-icons/success-guide.png">
      <div className="grid gap-5 lg:grid-cols-3">
        {successGuide.map((item) => (
          <div key={item.period} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6F5CFF]">{periodLabel(item.period)}</p>
            <h3 className="mt-4 text-xl font-black leading-7 text-[#0D0F1C]">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-[#4A5568]">{item.description}</p>
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
  const nextLabel = pathway?.next ?? (next ? `${next.code} — ${next.label}` : "Next stage");
  const futureLabel = pathway?.future ?? "Future growth";
  const developmentFocus = pathway?.developmentFocus ?? [];

  return (
    <SectionShell id="pathway" title="Your Next Step Pathway" icon="/mcas/report-icons/your-next-steps.png">
      <div className="space-y-7">
        <p className="text-base leading-8 text-[#4A5568]">
          Growth is not about becoming a different type of person — it is about expanding the range and sustainability of your natural pattern.
        </p>
        <div className="grid gap-4 md:grid-cols-[1fr_40px_1fr_40px_1fr] md:items-center">
          <PathwayCard label="Now" value={currentLabel} />
          <PathwayArrow />
          <PathwayCard label="Next Stage" value={nextLabel} />
          <PathwayArrow />
          <PathwayCard label="Future" value={futureLabel} />
        </div>
        {developmentFocus.length > 0 ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#EEEAFE] p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6F5CFF]">Development Preparation</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {developmentFocus.map((item) => (
                <span key={item} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0D0F1C]">{item}</span>
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
        <ReportHeader payload={payload} />
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

  return (
    <main className="min-h-screen bg-[#0D0F1C] py-6 text-[#0D0F1C]">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] bg-[#0D0F1C] shadow-2xl">
        <ReportHeader payload={payload} />
        <Hero payload={payload} />
        <TopStyleStrip items={payload.result.operatingStyle.distribution} />

        <div className="grid gap-6 px-6 py-9 md:px-8 lg:grid-cols-[260px_1fr]">
          <SidebarIndex token={token} />
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
