//apps/web/app/t/[token]/visibility/report/VisibilityReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  PortalReportResponse,
  ReportIndexItem,
  Section,
  Tier,
  VisibilityKbApiResponse,
  VisibilityKbReport,
} from "@/components/visibility/report/VisibilityReportTypes";
import {
  BRAND,
  buildPillars,
  clamp,
  firstItems,
  formatDate,
  fullName,
  safeNumber,
  safeString,
  safeText,
  sectionBullets,
  sectionParagraphs,
  sectionSummary,
} from "@/components/visibility/report/VisibilityReportUtils";
import { ReportPage, Shell } from "@/components/visibility/report/VisibilityReportPrimitives";
import { VISIBILITY_REPORT_ASSETS } from "@/components/visibility/report/VisibilityReportAssets";
import VisibilityHeroSection from "@/components/visibility/report/VisibilityHeroSection";
import VisibilityLadderPanel from "@/components/visibility/report/VisibilityLadderPanel";
import VisibilityReportIndex from "@/components/visibility/report/VisibilityReportIndex";
import VisibilityInsightCards from "@/components/visibility/report/VisibilityInsightCards";
import VisibilityNarrativeSection from "@/components/visibility/report/VisibilityNarrativeSection";
import VisibilitySignalGraph from "@/components/visibility/report/VisibilitySignalGraph";
import VisibilityClosingSection from "@/components/visibility/report/VisibilityClosingSection";
import VisibilityVideoSection from "@/components/visibility/report/VisibilityVideoSection";
import type { ReactNode } from "react";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

const PUBLIC_VIDEO_URL =
  "https://xciojwhnamsspmxpipzn.supabase.co/storage/v1/object/public/report-videos/Visibility%20Ladder%20long_01.mp4";

const PUBLIC_VIDEO_POSTER_URL = "";

const REPORT_LOGO_SRC = "/images/visibility-report/logo/Whatswhat-logo.png";
const COACHING_ICON_SRC = "/images/visibility-report/icons/coaching.png";
const STRENGTHS_INFOGRAPHIC_SRC =
  "/images/visibility-report/infographics/Strengths 3 pointers.png";
const FRICTION_INFOGRAPHIC_SRC =
  "/images/visibility-report/infographics/Friction 3 pointers.png";

async function fetchJson<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = (await r.text()).slice(0, 600);
    throw new Error(`HTTP ${r.status} – non-JSON response:\n${text}`);
  }
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j as T;
}

function LocalOuterCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border ${className}`}
      style={{
        borderColor: BRAND.border,
        background: "linear-gradient(180deg, rgba(27,60,99,0.78), rgba(12,32,58,0.84))",
        boxShadow: "0 14px 42px rgba(0,0,0,0.32)",
      }}
    >
      {children}
    </div>
  );
}

function LocalInnerPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border ${className}`}
      style={{
        borderColor: BRAND.borderSoft,
        background: "linear-gradient(180deg, rgba(35,62,97,0.72), rgba(18,38,64,0.78))",
      }}
    >
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  href,
  variant = "dark",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "dark" | "gradient";
}) {
  const className =
    "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-[13px] font-semibold";
  const style =
    variant === "gradient"
      ? ({
          background: "linear-gradient(90deg, #45E0D1 0%, #4F7DFF 50%, #8B5CF6 100%)",
          color: "#071C36",
        } as const)
      : ({
          background: "rgba(8,22,43,0.72)",
          color: BRAND.white,
          border: `1px solid ${BRAND.border}`,
        } as const);

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

function HeaderChip({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase"
      style={{
        border: `1px solid ${BRAND.border}`,
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.86)",
      }}
    >
      {children}
    </div>
  );
}

function FullReportHeader({
  takerName,
  reportDate,
  nextStepsUrl,
  onDownload,
}: {
  takerName: string;
  reportDate: string;
  nextStepsUrl?: string;
  onDownload: () => void;
}) {
  return (
    <LocalOuterCard className="p-4 md:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-2xl overflow-hidden shrink-0"
              style={{
                border: `1px solid ${BRAND.border}`,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <img
                src={REPORT_LOGO_SRC}
                alt="WhatsWhat Prime logo"
                className="h-full w-full object-contain"
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>

            <div>
              <div className="text-[28px] md:text-[32px] font-semibold tracking-[0.14em] uppercase leading-none">
                Visibility Ladder™
              </div>
              <div
                className="mt-1.5 text-[12px] md:text-[13px] uppercase tracking-[0.28em]"
                style={{ color: BRAND.textDim }}
              >
                Strategic Visibility Assessment
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <HeaderChip>WhatsWhat Prime</HeaderChip>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5">
          <div className="flex gap-2">
            <ActionButton onClick={onDownload}>Download PDF</ActionButton>
            {nextStepsUrl ? (
              <ActionButton href={nextStepsUrl} variant="gradient">
                Next steps
              </ActionButton>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <LocalInnerPanel className="px-3.5 py-3 min-w-[150px]">
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.56)" }}>
                Prepared for
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{takerName}</div>
            </LocalInnerPanel>

            <LocalInnerPanel className="px-3.5 py-3 min-w-[130px]">
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.56)" }}>
                Date
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{reportDate}</div>
            </LocalInnerPanel>

            <LocalInnerPanel className="px-3.5 py-3 min-w-[150px]">
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.56)" }}>
                Framework
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">WhatsWhat Prime</div>
            </LocalInnerPanel>
          </div>
        </div>
      </div>
    </LocalOuterCard>
  );
}

function CoachingColumn({
  title,
  imageSrc,
  items,
}: {
  title: string;
  imageSrc: string;
  items: string[];
}) {
  return (
    <LocalInnerPanel className="p-4">
      <div className="text-[14px] font-semibold">{title}</div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: BRAND.borderSoft }}>
          <img
            src={imageSrc}
            alt={title}
            className="block w-full h-auto object-contain"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        <div className="space-y-4 text-[13px] leading-6" style={{ color: BRAND.text }}>
          {items.map((item, idx) => (
            <div key={idx}>{item}</div>
          ))}
        </div>
      </div>
    </LocalInnerPanel>
  );
}

function InlineCoachingInsights({
  executiveSummary,
  strengths,
  friction,
  opportunity,
}: {
  executiveSummary: string;
  strengths: string[];
  friction: string[];
  opportunity: string;
}) {
  return (
    <LocalOuterCard className="p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-2xl overflow-hidden shrink-0"
          style={{
            border: `1px solid ${BRAND.border}`,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <img
            src={COACHING_ICON_SRC}
            alt="Coaching insight icon"
            className="h-full w-full object-cover"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        <div>
          <div className="text-[15px] font-semibold">Coaching insight</div>
          <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
            An additional interpretation layer built from your scored signals and narrative blocks
          </div>
        </div>
      </div>

      <LocalInnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">Executive summary</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {executiveSummary}
        </div>
      </LocalInnerPanel>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CoachingColumn
          title="Strengths"
          imageSrc={STRENGTHS_INFOGRAPHIC_SRC}
          items={strengths}
        />

        <CoachingColumn
          title="Friction"
          imageSrc={FRICTION_INFOGRAPHIC_SRC}
          items={friction}
        />
      </div>

      <LocalInnerPanel className="mt-4 p-4">
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-2xl overflow-hidden shrink-0"
            style={{
              border: `1px solid ${BRAND.border}`,
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <img
              src={VISIBILITY_REPORT_ASSETS.insights.opportunity}
              alt="Strategic opportunity icon"
              className="h-full w-full object-cover"
              onError={(e: any) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="min-w-0">
            <div className="text-[14px] font-semibold">Strategic opportunity</div>
            <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
              {opportunity}
            </div>
          </div>
        </div>
      </LocalInnerPanel>
    </LocalOuterCard>
  );
}

export default function VisibilityReportClient({
  token,
  tid,
  src,
}: {
  token: string;
  tid: string;
  src?: string;
}) {
  const reportRootRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [portalMeta, setPortalMeta] = useState<PortalReportResponse["data"] | null>(null);
  const [kbReport, setKbReport] = useState<VisibilityKbReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!token || !tid) throw new Error("Missing token or tid.");

        const portalUrl = `/api/public/test/${encodeURIComponent(token)}/report?tid=${encodeURIComponent(
          tid
        )}${src ? `&src=${encodeURIComponent(src)}` : ""}`;
        const portalRes = await fetchJson<PortalReportResponse>(portalUrl);
        if (cancelled) return;
        setPortalMeta(portalRes?.data ?? null);

        const kbUrl = `/api/public/visibility/${encodeURIComponent(
          token
        )}/report?tid=${encodeURIComponent(tid)}&audience=taker_report`;
        const kbRes = await fetchJson<VisibilityKbApiResponse>(kbUrl);
        if (cancelled) return;
        setKbReport(kbRes?.data ?? null);

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(String(e?.message || e));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tid, src]);

  const takerName = fullName(portalMeta?.taker);
  const reportDate = formatDate(kbReport?.meta?.generated_at);
  const nextStepsUrl = safeString(portalMeta?.link?.next_steps_url);

  const tier = ((kbReport?.signals?.tier as Tier) || "Invisible") as Tier;
  const level = clamp(safeNumber(kbReport?.signals?.level, 1), 1, 20);
  const readiness = kbReport?.signals?.readiness;

  const overallPct = (() => {
    const direct = safeNumber(kbReport?.signals?.overall_pct, -1);
    if (direct >= 0) return direct;
    const pillars = buildPillars(kbReport?.graphs?.pillars || kbReport?.signals?.pillar_scores);
    if (!pillars.length) return 0;
    return Math.round(pillars.reduce((sum, pillar) => sum + pillar.value, 0) / pillars.length);
  })();

  const sectionMap = useMemo(() => {
    const map = new Map<string, Section>();
    const sections = Array.isArray(kbReport?.sections) ? kbReport?.sections : [];
    for (const section of sections) map.set(section.key, section);
    return map;
  }, [kbReport?.sections]);

  const secWelcome = sectionMap.get("welcome") || null;
  const secHowToUse = sectionMap.get("how_to_use") || null;
  const secUnderstanding = sectionMap.get("understanding") || null;
  const secStrengths = sectionMap.get("strengths") || null;
  const secFriction = sectionMap.get("friction") || null;
  const secMarketExperience = sectionMap.get("market_experience") || null;
  const secOpportunity = sectionMap.get("opportunity") || null;
  const secNextMove = sectionMap.get("next_move") || null;
  const secLevelMeaning = sectionMap.get("level_meaning") || null;
  const secSnapshot = sectionMap.get("snapshot") || null;
  const secClosing = sectionMap.get("closing") || null;

  const pillars = buildPillars(kbReport?.graphs?.pillars || kbReport?.signals?.pillar_scores);
  const weakest = safeString(kbReport?.signals?.weakest_pillar).toLowerCase() || null;
  const strongest = safeString(kbReport?.signals?.strongest_pillar).toLowerCase() || null;

  const heroCopy =
    sectionSummary(secLevelMeaning) ||
    sectionSummary(secSnapshot) ||
    (tier === "Invisible"
      ? "You are in the Invisible tier — your market signals are still too weak or inconsistent to create reliable response."
      : tier === "Emerging"
      ? "You are in the Emerging tier — people can see you, but you are not yet the default choice."
      : tier === "Established"
      ? "You are in the Established tier — your market can recognise your value, but stronger authority is still needed."
      : "You are in the Magnetic tier — your market sees you as a recognised authority with strong pull and influence.");

  const currentPositionCopy =
    tier === "Invisible"
      ? "You are visible in some places, but not yet enough to create reliable market confidence."
      : tier === "Emerging"
      ? "You are visible in market terms, but this level is about strengthening structural consistency."
      : tier === "Established"
      ? "You are recognised and trusted, but this level is about consolidating leadership signals."
      : "You are in a leadership position — the focus here is sustaining authority and protecting consistency.";

  const tierRangeCopy =
    tier === "Invisible"
      ? "Levels 1–5. Early market signals are present, but they are not yet stable enough to drive predictable response."
      : tier === "Emerging"
      ? "Levels 6–10. Movement inside the tier reflects how stable your market position is."
      : tier === "Established"
      ? "Levels 11–15. The market recognises your value, but stronger consistency still separates expert from authority."
      : "Levels 16–20. This range reflects strong authority, stronger pull, and greater market recognition.";

  const marketRealityBullets = (() => {
    const bullets = firstItems(sectionBullets(secMarketExperience), 3);
    if (bullets.length) return bullets;
    return firstItems(sectionParagraphs(secMarketExperience), 2);
  })();

  const opportunityBullets = (() => {
    const bullets = firstItems(sectionBullets(secOpportunity), 3);
    if (bullets.length) return bullets;
    return firstItems(sectionParagraphs(secOpportunity), 2);
  })();

  const nextMoveBullets = (() => {
    const bullets = firstItems(sectionBullets(secNextMove), 4);
    if (bullets.length) return bullets;
    return firstItems(sectionParagraphs(secNextMove), 4);
  })();

  const coachingStrengths = firstItems(
    (kbReport?.ai?.strengths?.length ? kbReport.ai.strengths : []).concat(
      firstItems(sectionBullets(secStrengths), 3),
      firstItems(sectionParagraphs(secStrengths), 3)
    ),
    3
  );

  const coachingFriction = firstItems(
    (kbReport?.ai?.friction?.length ? kbReport.ai.friction : []).concat(
      firstItems(sectionBullets(secFriction), 3),
      firstItems(sectionParagraphs(secFriction), 3)
    ),
    3
  );

  const coachingOpportunity =
    kbReport?.ai?.strategic_opportunity ||
    sectionSummary(secOpportunity) ||
    "Clarify the highest-impact next move and focus effort where it will create the greatest lift.";

  const coachingExecutiveSummary =
    kbReport?.ai?.executive_summary ||
    "This section provides a guided interpretation of the report so the reader can turn signals into practical direction.";

  const reportIndex: ReportIndexItem[] = [
    { id: "welcome", label: "A Personal Welcome From Bogdan Stan" },
    { id: "how-to-use", label: "How To Use This Report" },
    { id: "understanding", label: "Understanding the Visibility Ladder" },
    { id: "working", label: "What is already working" },
    { id: "friction", label: "Where visibility friction exists" },
    { id: "closing", label: "Turning insight into strategy" },
  ];

  async function downloadPdf() {
    try {
      const root = reportRootRef.current;
      if (!root) return;

      const pageNodes = Array.from(
        root.querySelectorAll("[data-pdf-page='true']")
      ) as HTMLDivElement[];

      if (!pageNodes.length) return;

      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        html2canvasPromise(),
        jsPdfPromise(),
      ]);

      const pdf = new JsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      for (let i = 0; i < pageNodes.length; i += 1) {
        const pageNode = pageNodes[i];
        const canvas = await html2canvas(pageNode, {
          backgroundColor: BRAND.bg,
          scale: 2,
          useCORS: true,
          windowWidth: pageNode.scrollWidth,
          windowHeight: pageNode.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }

      const safeName = `${safeString(takerName) || "Visibility"}-Visibility-Ladder.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );
      pdf.save(safeName);
    } catch (e) {
      console.error("[visibility] pdf export failed", e);
      alert("PDF export failed.");
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1560px] px-4 py-5">
          <div className="text-2xl font-semibold">Loading your report…</div>
          <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
            Preparing your Visibility Ladder report.
          </div>
        </div>
      </Shell>
    );
  }

  if (err || !kbReport) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1560px] px-4 py-5 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility report</div>
          <p className="text-sm" style={{ color: "rgba(248,113,113,0.95)" }}>
            {safeText(err || "Unknown error")}
          </p>
          <div
            className="rounded-2xl p-4 text-xs"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${BRAND.border}`,
            }}
          >
            <div>token: {token}</div>
            <div>tid: {tid}</div>
          </div>
          <Link href={`/t/${token}`} className="underline text-sm">
            Go back
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div
        ref={reportRootRef}
        className="mx-auto max-w-[1560px] px-4 py-3 md:px-5 md:py-4 space-y-6"
      >
        <ReportPage>
          <FullReportHeader
            takerName={takerName}
            reportDate={reportDate || formatDate(null)}
            nextStepsUrl={nextStepsUrl}
            onDownload={downloadPdf}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_270px] items-start">
            <div className="space-y-4">
              <VisibilityHeroSection
                takerName={takerName}
                tier={tier}
                level={level}
                overallPct={overallPct}
                readiness={readiness}
                heroCopy={heroCopy}
                currentPositionCopy={currentPositionCopy}
                tierRangeCopy={tierRangeCopy}
                pillars={pillars}
                weakest={weakest}
                strongest={strongest}
              />
            </div>

            <div className="self-start">
              <VisibilityLadderPanel tier={tier} level={level} />
            </div>
          </div>

          <VisibilityInsightCards
            marketReality={{
              title: "Market reality",
              content:
                !marketRealityBullets.length ? sectionSummary(secMarketExperience) : undefined,
              bullets: marketRealityBullets,
              iconSrc: VISIBILITY_REPORT_ASSETS.insights.marketReality,
            }}
            opportunity={{
              title: "Your strategic visibility opportunity",
              content:
                !opportunityBullets.length ? sectionSummary(secOpportunity) : undefined,
              bullets: opportunityBullets,
              iconSrc: VISIBILITY_REPORT_ASSETS.insights.opportunity,
            }}
            nextMove={{
              title: "Your most effective next move",
              content:
                !nextMoveBullets.length ? sectionSummary(secNextMove) : undefined,
              bullets: nextMoveBullets,
              iconSrc: VISIBILITY_REPORT_ASSETS.insights.nextMove,
            }}
          />
        </ReportPage>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[240px_minmax(0,1fr)] items-start">
          <div className="hidden xl:block xl:sticky xl:top-4 self-start">
            <VisibilityReportIndex
              reportIndex={reportIndex}
              nextStepsUrl={nextStepsUrl}
              onDownload={downloadPdf}
            />
          </div>

          <div className="space-y-6">
            <ReportPage>
              <div className="xl:hidden">
                <VisibilityReportIndex
                  reportIndex={reportIndex}
                  nextStepsUrl={nextStepsUrl}
                  onDownload={downloadPdf}
                />
              </div>

              <div className="space-y-4">
                <VisibilityVideoSection
                  title="Video Introduction"
                  videoSrc={PUBLIC_VIDEO_URL}
                  posterSrc={PUBLIC_VIDEO_POSTER_URL || undefined}
                  helperText="This video introduces how to use the report and what to focus on first."
                />

                <VisibilityNarrativeSection
                  id="welcome"
                  title="A Personal Welcome From Bogdan Stan"
                  section={secWelcome}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.welcome}
                  footerProfile={{
                    imageSrc: VISIBILITY_REPORT_ASSETS.people.bogdan,
                    name: "Bogdan Stan",
                    title:
                      "Creator of The Visibility Ladder • Managing Director, WhatsWhat and UTender",
                  }}
                />

                <VisibilityNarrativeSection
                  id="how-to-use"
                  title="How To Use This Report"
                  section={secHowToUse}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.howToUse}
                  infographicSrc={VISIBILITY_REPORT_ASSETS.infographics.howToUse}
                  infographicAlt="Inside this report you will discover"
                  infographicAfterParagraph={3}
                />

                <VisibilityNarrativeSection
                  id="understanding"
                  title="Understanding the Visibility Ladder"
                  section={secUnderstanding}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.understanding}
                />
              </div>
            </ReportPage>

            <ReportPage>
              <div className="space-y-4">
                <VisibilityNarrativeSection
                  id="working"
                  title="What is already working"
                  section={secStrengths}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.strengths}
                />

                <VisibilityNarrativeSection
                  title="How the market is likely experiencing your business"
                  section={secMarketExperience}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.marketExperience}
                />

                <VisibilityNarrativeSection
                  id="friction"
                  title="Where visibility friction exists"
                  section={secFriction}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.friction}
                />

                <VisibilitySignalGraph
                  tier={tier}
                  level={level}
                  overallPct={overallPct}
                  pillars={pillars}
                  weakest={weakest}
                  strongest={strongest}
                  iconSrc={VISIBILITY_REPORT_ASSETS.sections.signalGraph}
                />
              </div>
            </ReportPage>

            <ReportPage>
              <InlineCoachingInsights
                executiveSummary={coachingExecutiveSummary}
                strengths={coachingStrengths}
                friction={coachingFriction}
                opportunity={coachingOpportunity}
              />
            </ReportPage>

            <ReportPage>
              <VisibilityClosingSection
                id="closing"
                title={secClosing?.title || "Turning insight into strategy"}
                section={secClosing}
                engineKey={kbReport.engine_key || "visibility_prime_v1"}
                version={kbReport.version ?? 2}
                scoringMode={kbReport?.meta?.scoring_mode || "prime"}
                iconSrc={VISIBILITY_REPORT_ASSETS.sections.strategy}
              />
            </ReportPage>
          </div>
        </div>
      </div>
    </Shell>
  );
}
