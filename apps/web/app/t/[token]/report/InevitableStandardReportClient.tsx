"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getBaseUrl } from "@/lib/server-url";
import {
  APPROACH_LENS_COPY,
  APPROACHES,
  ApproachCompass,
  BAND_MEANING,
  INK,
  PILLAR_CONSTRAINT_COPY,
  ReadinessDonut,
  bandLabelFor,
  buildPillarView,
  clampPercentage,
  formatAssessmentDate,
  newsreader,
  numberOr,
  pillarLabel,
  primaryConstraintSentence,
  round1,
  serif,
  type ApproachCode,
  type Gar,
  type PillarKey,
  type PillarView,
  type ResultPayload,
} from "./inevitableStandardShared";

const FIGMA = {
  page: "#041731",
  navy: "#14263d",
  ivory: "#f8f6f1",
  gold: "#b89a5e",
  goldLight: "#c9b98f",
  ink: "#14263d",
  body: "#66727d",
  hairline: "#e9e6df",
  green: "#5d806b",
  amber: "#c69248",
  red: "#a85b55",
};

const PILLAR_ICON: Record<PillarKey, string> = {
  identity: "/inevitable-standard/snapshot/identitiy.png",
  positioning: "/inevitable-standard/snapshot/positioning.png",
  offer: "/inevitable-standard/snapshot/offer.png",
  sales: "/inevitable-standard/snapshot/sales.png",
  revenue_model: "/inevitable-standard/snapshot/revenue-model.png",
  decision: "/inevitable-standard/snapshot/decision.png",
};

const APPROACH_ICON: Record<ApproachCode, string> = {
  A: "/inevitable-standard/full-diagnostic/Rocket.png",
  B: "/inevitable-standard/full-diagnostic/connect.png",
  C: "/inevitable-standard/full-diagnostic/Clock.png",
  D: "/inevitable-standard/full-diagnostic/Evidence.png",
};

const CONSTRAINT_ICON: Partial<Record<PillarKey, string>> = {
  sales: "/inevitable-standard/snapshot/sales2.png",
  decision: "/inevitable-standard/snapshot/decision2.png",
};

const SECTIONS = [
  { id: "readiness", label: "Your Inevitable Standard Readiness" },
  { id: "pillars", label: "Where your business stands today" },
  { id: "diagnosis", label: "What Is Holding You Back?" },
  { id: "approach", label: "Commercial Decision Intelligence" },
  { id: "priorities", label: "Your first three priorities" },
];

const PRIORITY_COPY: Record<PillarKey, { title: string; body: string }> = {
  sales: {
    title: "Define one sales process and run every opportunity through it",
    body: "Same stages, same questions, same decision points — whether the opportunity arrives through a referral or cold.",
  },
  revenue_model: {
    title: "Set a minimum profit position for every offer you sell",
    body: "Know the minimum margin the offer must protect before the sales conversation begins, rather than deciding the number in the moment.",
  },
  decision: {
    title: "Add one checkpoint before any decision that changes revenue",
    body: "A single, deliberate pause is usually enough to stop a fast decision from rebuilding the constraint behind it.",
  },
  identity: {
    title: "Hold your commercial position when value is on the table",
    body: "State the real price and let it stand before explaining, discounting or moving away from it.",
  },
  positioning: {
    title: "Make the market description precise enough to pre-qualify the right buyer",
    body: "Use one clear sentence for who the work is for, why it matters and the outcome the right client should recognise.",
  },
  offer: {
    title: "Give the core offer clear edges before adding more options",
    body: "Name the offer, define its promise and make the outcome clear enough that the buyer can picture what they are choosing.",
  },
};

function garColour(gar: Gar) {
  if (gar === "green") return FIGMA.green;
  if (gar === "amber") return FIGMA.amber;
  return FIGMA.red;
}

function riskLabel(gar: Gar) {
  if (gar === "green") return "LOW RISK";
  if (gar === "amber") return "MEDIUM RISK";
  return "HIGH RISK";
}

function SectionShell({ id, eyebrow, children }: { id: string; eyebrow: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-[20px] p-[22px] sm:p-[27px] print:p-4" style={{ backgroundColor: FIGMA.navy }}>
      <p className="mb-[26px] text-[14px] font-semibold uppercase tracking-[0.18em] sm:text-[16px]" style={{ color: FIGMA.gold }}>{eyebrow}</p>
      {children}
    </section>
  );
}

function IvoryPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-[20px] p-6 sm:p-10 print:p-6" style={{ backgroundColor: FIGMA.ivory }}>{children}</div>;
}

function IconBadge({ src, tone = FIGMA.gold }: { src?: string | null; tone?: string }) {
  return (
    <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border" style={{ borderColor: `${tone}55`, backgroundColor: "#fff" }}>
      {src ? <img src={src} alt="" className="h-[42px] w-[42px] object-contain" /> : null}
    </div>
  );
}

function PillarMiniSummary({ pillars }: { pillars: PillarView[] }) {
  return (
    <div className="rounded-[10px] border border-white/15 bg-white/[0.05] px-7 py-5">
      <p className="mb-4 text-[10px] uppercase tracking-[0.16em] text-[#a9a08a]">The six pillars</p>
      <div className="space-y-[13px]">
        {pillars.map((pillar) => (
          <div key={pillar.key} className="grid grid-cols-[105px_1fr_34px] items-center gap-3">
            <div className="flex items-center gap-2"><img src={PILLAR_ICON[pillar.key]} alt="" className="h-6 w-6 object-contain" /><span className="text-[11px] text-[#cfc9b8]">{pillar.key === "revenue_model" ? "Rev. Model" : pillar.label}</span></div>
            <div className="h-[6px] overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full" style={{ width: `${pillar.percentage}%`, backgroundColor: garColour(pillar.gar) }} /></div>
            <span className="text-right text-[11px] font-bold text-[#f0ece0]">{pillar.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InevitableStandardReportClient({ token, tid }: { token: string; tid: string }) {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = await getBaseUrl();
        const response = await fetch(`${base}/api/public/test/${encodeURIComponent(token)}/result?tid=${encodeURIComponent(tid)}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.ok === false) throw new Error(json?.error || `Unable to load report (${response.status})`);
        const nextPayload = (json?.data || null) as ResultPayload | null;
        if (!nextPayload?.inevitable_standard) throw new Error("The Inevitable Standard result is not available for this test taker.");
        if (!cancelled) setPayload(nextPayload);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (tid) load(); else { setError("This report link is missing the required test-taker id."); setLoading(false); }
    return () => { cancelled = true; };
  }, [tid, token]);

  if (loading) return <main className={`${newsreader.variable} min-h-screen px-6 py-16 text-white`} style={{ backgroundColor: FIGMA.page }}><div className="mx-auto max-w-4xl">Preparing your Diagnostic Snapshot…</div></main>;

  const score = payload?.inevitable_standard;
  if (error || !score) return <main className={`${newsreader.variable} min-h-screen px-6 py-16 text-white`} style={{ backgroundColor: FIGMA.page }}><div className="mx-auto max-w-3xl"><p className="text-xs uppercase tracking-[0.2em]" style={{ color: FIGMA.gold }}>The Inevitable Standard Method™</p><h1 className="mt-4 text-4xl" style={serif}>Report not available</h1><p className="mt-4 text-white/65">{error || "The completed assessment result could not be found."}</p></div></main>;

  const overall = score.overall || {};
  const approaches = score.approaches || {};
  const constraints = score.constraints ?? null;
  const pillarView = buildPillarView(score);
  const overallPercentage = round1(clampPercentage(overall.percentage));
  const bandDescriptor = overall.label || bandLabelFor(overallPercentage);
  const bandMeaning = BAND_MEANING[bandLabelFor(overallPercentage)] || BAND_MEANING[bandDescriptor] || "";
  const clientName = [payload?.taker?.first_name, payload?.taker?.last_name].map((part) => (part || "").trim()).filter(Boolean).join(" ") || "—";
  const businessName = (payload?.taker?.company || payload?.business_name || "").trim() || "—";
  const assessmentDate = formatAssessmentDate(payload?.completed_at);
  const primaryKey = (constraints?.primary_constraint as PillarKey | undefined) || null;
  const secondaryKey = (constraints?.secondary_constraint as PillarKey | undefined) || null;
  const falseConstraint = constraints?.false_constraint ?? null;
  const primaryPillar = primaryKey ? pillarView.find((pillar) => pillar.key === primaryKey) || null : null;
  const secondaryPillar = secondaryKey ? pillarView.find((pillar) => pillar.key === secondaryKey) || null : null;
  const severityOrder = [...pillarView].sort((a, b) => a.percentage - b.percentage);
  const firstThree = [...(primaryPillar ? [primaryPillar] : []), ...severityOrder.filter((pillar) => pillar.key !== primaryKey)].slice(0, 3);
  const dominant = approaches.dominant || null;
  const dominantLabel = dominant ? approaches.labels?.[dominant] || APPROACHES.find((item) => item.code === dominant)?.label || dominant : "Still forming";
  const dominantPct = dominant ? round1(clampPercentage(approaches.percentages?.[dominant])) : 0;
  const approachPercent = (code: ApproachCode) => round1(clampPercentage(approaches.percentages?.[code]));
  const compassX = numberOr(approaches.map?.x_people_trust_minus_evidence_proof, approachPercent("B") - approachPercent("D"));
  const compassY = numberOr(approaches.map?.y_future_possibility_minus_timing_certainty, approachPercent("A") - approachPercent("C"));
  const statedProblem = String(score.context_answers?.[13] || "").trim();
  const nextStepsHref =
    (payload?.link?.next_steps_url || payload?.link?.redirect_url || "").trim() ||
    null;

  return (
    <main className={`${newsreader.variable} min-h-screen`} style={{ backgroundColor: FIGMA.page, color: FIGMA.ink }}>
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { background: #041731 !important; }
        }
      `}</style>
      <header className="border-b border-white/10 px-5 py-4 text-white print:hidden" style={{ backgroundColor: FIGMA.navy }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 lg:flex-nowrap">
          <div className="mr-auto flex min-w-[300px] items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><img src="/images/profile-test-ai-logo.png" alt="profiletest.ai" className="max-h-8 max-w-8 object-contain brightness-0 invert" /></div><div><p className="text-[18px] font-semibold uppercase tracking-[0.14em] sm:text-[24px]">Your Diagnostic Snapshot</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em]" style={{ color: FIGMA.goldLight }}>The Inevitable Standard Method™ · powered by Profiletest.ai</p></div></div>
          <button onClick={() => window.print()} className="rounded-lg px-5 py-2 text-[12px] font-semibold text-white" style={{ backgroundColor: FIGMA.gold }}>Download PDF</button>
          <a href={`/t/${encodeURIComponent(token)}/full-report?tid=${encodeURIComponent(tid)}`} className="rounded-lg bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-5 py-2 text-[12px] font-semibold text-white">Get the Full Report</a>
          <a href={nextStepsHref || "#priorities"} className="rounded-lg bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-5 py-2 text-[12px] font-semibold text-white">Next step</a>
        </div>
        <div className="mx-auto mt-3 grid max-w-[600px] grid-cols-3 gap-2 text-[10px] lg:ml-auto lg:mr-5 lg:mt-2"><div className="rounded-xl border border-white/25 px-3 py-2"><span className="block text-white/40">PREPARED FOR</span><strong className="mt-1 block text-[12px] text-white">{clientName}</strong></div><div className="rounded-xl border border-white/25 px-3 py-2"><span className="block text-white/40">BUSINESS</span><strong className="mt-1 block truncate text-[12px] text-white">{businessName}</strong></div><div className="rounded-xl border border-white/25 px-3 py-2"><span className="block text-white/40">DATE</span><strong className="mt-1 block text-[12px] text-white">{assessmentDate}</strong></div></div>
      </header>

      <section className="bg-gradient-to-b from-[#14263d] to-[#1f2c46] px-6 py-12 text-white sm:px-10 sm:py-[60px]"><div className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_263px_388px] xl:items-start print:grid-cols-[minmax(0,1fr)_190px_280px] print:items-start print:gap-4"><div><p className="text-[12px] uppercase tracking-[0.18em]" style={{ color: FIGMA.gold }}>The Inevitable Standard Method™</p><h1 className="mt-6 text-[48px] leading-[0.96] sm:text-[64px] xl:text-[80px]" style={serif}>{clientName}</h1><p className="mt-5 text-[24px] italic sm:text-[30px]" style={{ ...serif, color: FIGMA.goldLight }}>Map Your Revenue-To-Freedom Pathway</p><div className="mt-8 border-t border-[#b89a5e]/45 pt-3 text-[11px] uppercase tracking-[0.2em]">Your Diagnostic Snapshot</div></div><div className="flex flex-col items-center rounded-[10px] border border-white/15 bg-white/[0.05] px-5 py-4"><p className="text-center text-[10px] uppercase tracking-[0.14em] text-[#a9a08a]">Inevitable Standard Readiness</p><ReadinessDonut percentage={overallPercentage} band={bandDescriptor} /><p className="text-center text-[13px] text-[#e8e2d0]">{bandDescriptor} <span className="text-[#cfc9b8]">· Current standard</span></p></div><PillarMiniSummary pillars={pillarView} /></div></section>

      <div className="mx-auto grid max-w-[1275px] gap-8 px-5 py-[88px] lg:grid-cols-[283px_minmax(0,1fr)] print:block print:py-8">
        <aside className="print:hidden"><div className="sticky top-5 rounded-[20px] border border-white/10 p-[18px]" style={{ backgroundColor: FIGMA.ivory }}><p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-[#33445a]">Report Index</p><nav className="space-y-2">{SECTIONS.map((section, index) => <a key={section.id} href={`#${section.id}`} className="block rounded-[15px] border border-[#33445a] px-4 py-3 text-[12px] leading-5 text-[#33445a] transition hover:bg-[#33445a] hover:text-white">{index + 1}. {section.label}</a>)}</nav><button onClick={() => window.print()} className="mt-3 w-full rounded-[10px] bg-[#33445a] px-4 py-3 text-[12px] font-semibold text-white">Download PDF</button><a href={`/t/${encodeURIComponent(token)}/full-report?tid=${encodeURIComponent(tid)}`} className="mt-2 block w-full rounded-[10px] bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-4 py-3 text-center text-[12px] font-semibold text-white">Get The Full Report</a><a href={nextStepsHref || "#priorities"} className="mt-2 block w-full rounded-[10px] bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-4 py-3 text-center text-[12px] font-semibold text-white">Next step</a></div></aside>
        <div className="space-y-8">
          <SectionShell id="readiness" eyebrow="Your Diagnosis"><IvoryPanel><h2 className="text-[29px] leading-tight" style={serif}>Your Inevitable Standard Readiness</h2><div className="mt-8 flex flex-wrap items-end gap-8"><div className="text-[72px] leading-none sm:text-[84px]" style={serif}>{overallPercentage}<span className="ml-1 text-[44px]" style={{ color: FIGMA.gold }}>%</span></div><div className="pb-2"><p className="text-[10px] uppercase tracking-[0.16em] text-[#66727d]">Current standard</p><p className="mt-1 text-[24px]" style={serif}>{bandDescriptor}</p></div></div><div className="mt-7 grid grid-cols-2 overflow-hidden rounded-md sm:grid-cols-4 print:grid-cols-4">{["Chance-Based", "Inconsistent", "Partly Structured", "Deliberate & Repeatable"].map((label, index) => <div key={label} className="px-2 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-white" style={{ backgroundColor: [FIGMA.red, "#bd7f3d", "#c9a24a", FIGMA.green][index] }}>{label}</div>)}</div><p className="mt-7 text-[15px] leading-7" style={{ color: FIGMA.body }}>Your Inevitable Standard Readiness shows how deliberately your business is currently built to move revenue through to profit, personal wealth and greater freedom. It is calculated across six areas of the business and shows where the foundations are already working and where greater structure could have the biggest impact.</p><div className="mt-7 rounded border border-[#ddd4bd] bg-white px-6 py-7 text-[14px] leading-6" style={{ color: FIGMA.body }}><strong className="block uppercase">What this page tells you</strong><p className="mt-4">{bandMeaning || "This result is a starting point for seeing what currently holds and where deliberate structure would create the greatest leverage."}</p></div></IvoryPanel></SectionShell>
          <SectionShell id="pillars" eyebrow="The Six Areas"><IvoryPanel><h2 className="text-[29px] leading-tight" style={serif}>Where your business stands today</h2><p className="mt-4 text-[14px] leading-6" style={{ color: FIGMA.body }}>Each area is scored independently. Read them together — a strong result in one area often carries the weight of a weaker one, and that is usually where effort is quietly being spent.</p><div className="mt-7 border-t" style={{ borderColor: FIGMA.hairline }}>{pillarView.map((pillar) => <div key={pillar.key} className="grid gap-4 border-b py-5 sm:grid-cols-[190px_1fr_82px] sm:items-center print:grid-cols-[170px_1fr_76px] print:items-center print:py-3" style={{ borderColor: FIGMA.hairline }}><div className="flex items-center gap-3"><img src={PILLAR_ICON[pillar.key]} alt="" className="h-12 w-12 object-contain" /><span className="text-[17px]" style={serif}>{pillar.label}</span></div><div><div className="h-[6px] bg-[#e9e6df]"><div className="h-full" style={{ width: `${pillar.percentage}%`, backgroundColor: garColour(pillar.gar) }} /></div><p className="mt-3 text-[12px] leading-5" style={{ color: FIGMA.body }}>{pillar.descriptor}</p></div><div className="text-right"><p className="text-[22px] font-bold" style={{ ...serif, color: garColour(pillar.gar) }}>{pillar.percentage}%</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: garColour(pillar.gar) }}>{riskLabel(pillar.gar)}</p></div></div>)}</div><div className="mt-7 flex flex-wrap justify-center gap-7 text-[9px] uppercase tracking-[0.1em]" style={{ color: FIGMA.body }}><span><b style={{ color: FIGMA.red }}>●</b> High risk — priority</span><span><b style={{ color: FIGMA.green }}>●</b> Low risk — leverage this</span><span><b style={{ color: FIGMA.amber }}>●</b> Medium risk — strengthen and stabilise</span></div></IvoryPanel></SectionShell>
          <SectionShell id="diagnosis" eyebrow="Your Diagnosis"><IvoryPanel><h2 className="text-[29px] leading-tight" style={serif}>What is most likely holding you back</h2><div className="mt-7 space-y-3">{primaryKey && primaryPillar ? <div className="rounded border border-[#a8503f] border-l-[5px] bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.14em] text-[#736c5c]">Your primary constraint</p><h3 className="mt-2 text-[22px] font-bold" style={{ ...serif, color: FIGMA.red }}>{pillarLabel(primaryKey)}</h3></div><IconBadge src={CONSTRAINT_ICON[primaryKey] || PILLAR_ICON[primaryKey]} tone={FIGMA.red} /></div><p className="mt-2 text-[13px] text-[#736c5c]">The area most likely to be limiting progress right now.</p><p className="mt-4 text-[14px] leading-6" style={{ color: FIGMA.body }}>{primaryConstraintSentence(primaryKey, primaryPillar.gar) || PILLAR_CONSTRAINT_COPY[primaryKey]}</p></div> : null}{secondaryKey && secondaryPillar ? <div className="rounded border border-[#bd8b3d] border-l-[5px] bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.14em] text-[#736c5c]">Your secondary constraint</p><h3 className="mt-2 text-[22px] font-bold" style={{ ...serif, color: FIGMA.amber }}>{pillarLabel(secondaryKey)}</h3></div><IconBadge src={CONSTRAINT_ICON[secondaryKey] || PILLAR_ICON[secondaryKey]} tone={FIGMA.amber} /></div><p className="mt-2 text-[13px] text-[#736c5c]">The area most likely to reinforce or recreate the primary constraint.</p><p className="mt-4 text-[14px] leading-6" style={{ color: FIGMA.body }}>{PILLAR_CONSTRAINT_COPY[secondaryKey]}</p></div> : null}{falseConstraint ? <div className="rounded border border-[#736c5c] border-l-[5px] bg-[#e9e6df] p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.14em] text-[#736c5c]">What may not be the real problem</p><h3 className="mt-2 text-[22px] font-bold capitalize" style={{ ...serif, color: INK }}>{statedProblem && statedProblem.length <= 90 ? statedProblem : pillarLabel(falseConstraint.stated_pillar)}</h3></div><IconBadge src="/inevitable-standard/snapshot/not-enough-leads.png" tone="#736c5c" /></div><p className="mt-4 text-[14px] leading-6" style={{ color: FIGMA.body }}>{falseConstraint.explanation || `The pattern points less to ${pillarLabel(falseConstraint.stated_pillar)} and more to ${pillarLabel(falseConstraint.evidence_pillar)}.`}</p></div> : null}</div></IvoryPanel></SectionShell>
          <SectionShell id="approach" eyebrow="Commercial Decision Intelligence"><IvoryPanel><h2 className="text-[29px] leading-tight" style={serif}>How you naturally make commercial decisions</h2><div className="mt-5 flex items-end justify-between gap-6"><p className="text-[42px] leading-none" style={{ ...serif, color: FIGMA.amber }}>{dominantLabel}</p><p className="text-[45px] leading-none" style={{ ...serif, color: FIGMA.amber }}>{dominantPct}%</p></div><p className="mt-5 text-[14px] leading-6" style={{ color: FIGMA.body }}>{dominant ? APPROACH_LENS_COPY[dominant] : "Your approach is a lens, not a label. It describes the information you tend to weigh first when a commercial decision is in front of you."}</p><div className="mt-7 grid gap-8 lg:grid-cols-[1fr_390px] lg:items-center print:grid-cols-[1fr_300px] print:items-center print:gap-5"><div>{APPROACHES.map((approach) => { const pct = approachPercent(approach.code); const isDominant = approach.code === dominant; return <div key={approach.code} className="grid grid-cols-[32px_125px_1fr_38px] items-center gap-3 border-b py-3" style={{ borderColor: FIGMA.hairline }}><img src={APPROACH_ICON[approach.code]} alt="" className="h-6 w-6 object-contain" /><span className="text-[12px] font-semibold" style={{ color: isDominant ? FIGMA.amber : INK }}>{approach.label}</span><div className="h-[5px] bg-[#e9e6df]"><div className="h-full" style={{ width: `${pct}%`, backgroundColor: isDominant ? FIGMA.gold : FIGMA.body }} /></div><span className="text-right text-[12px]">{pct}%</span></div>; })}</div><ApproachCompass x={compassX} y={compassY} /></div><p className="mt-5 text-[12px] leading-5 text-[#918a7d]">Your approach is a lens, not a label. It may influence how some of the results above show up; the pillar evidence and constraint diagnosis remain the commercial evidence.</p></IvoryPanel></SectionShell>
          <SectionShell id="priorities" eyebrow="Where to Begin"><IvoryPanel><h2 className="text-[29px] leading-tight" style={serif}>Your first three priorities</h2><p className="mt-3 text-[14px]" style={{ color: FIGMA.body }}>In this order. Each one makes the next easier to hold.</p><ol className="mt-6 border-t" style={{ borderColor: FIGMA.hairline }}>{firstThree.map((pillar, index) => { const copy = PRIORITY_COPY[pillar.key]; return <li key={pillar.key} className="grid grid-cols-[54px_1fr] gap-5 border-b py-6" style={{ borderColor: FIGMA.hairline }}><span className="text-[30px]" style={{ ...serif, color: FIGMA.gold }}>{String(index + 1).padStart(2, "0")}</span><div><h3 className="text-[20px] leading-6" style={serif}>{copy.title}</h3><p className="mt-2 max-w-2xl text-[13px] leading-6" style={{ color: FIGMA.body }}>{copy.body}</p></div></li>; })}</ol></IvoryPanel></SectionShell>
          <div className="rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-9 text-center text-white shadow-xl"><p className="text-[28px] leading-8" style={serif}>Explore your full<br />Revenue-To-Freedom Pathway</p><a href={`/t/${encodeURIComponent(token)}/full-report?tid=${encodeURIComponent(tid)}`} className="mt-6 inline-block px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white" style={{ backgroundColor: FIGMA.gold }}>View the Full Diagnostic</a></div>
        </div>
      </div>
    </main>
  );
}
