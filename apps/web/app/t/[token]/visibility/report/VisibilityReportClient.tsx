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
import VisibilityReportHeader from "@/components/visibility/report/VisibilityReportHeader";
import VisibilityHeroSection from "@/components/visibility/report/VisibilityHeroSection";
import VisibilityLadderPanel from "@/components/visibility/report/VisibilityLadderPanel";
import VisibilityReportIndex from "@/components/visibility/report/VisibilityReportIndex";
import VisibilityInsightCards from "@/components/visibility/report/VisibilityInsightCards";
import VisibilityNarrativeSection from "@/components/visibility/report/VisibilityNarrativeSection";
import VisibilitySignalGraph from "@/components/visibility/report/VisibilitySignalGraph";
import VisibilityCoachingInsights from "@/components/visibility/report/VisibilityCoachingInsights";
import VisibilityClosingSection from "@/components/visibility/report/VisibilityClosingSection";
import VisibilityVideoSection from "@/components/visibility/report/VisibilityVideoSection";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

const VIDEO_BUCKET = "report-videos";
const LONG_VIDEO_PATH = "visibility/Visibility Ladder long_01.mp4";
const POSTER_PATH = "visibility/visibility-ladder-long-01-poster.jpg";

function buildSupabasePublicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!base) return "";
  const normalizedBase = base.replace(/\/+$/, "");
  const encodedPath = encodeURI(path);
  return `${normalizedBase}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

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

  const orgLogoUrl = portalMeta?.org_logo_url || kbReport?.meta?.org_logo_url || null;
  const takerName = fullName(portalMeta?.taker);
  const reportDate = formatDate(kbReport?.meta?.generated_at);
  const nextStepsUrl = safeString(portalMeta?.link?.next_steps_url);

  const publicVideoUrl = buildSupabasePublicUrl(VIDEO_BUCKET, LONG_VIDEO_PATH);
  const publicPosterUrl = POSTER_PATH
    ? buildSupabasePublicUrl(VIDEO_BUCKET, POSTER_PATH)
    : "";

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
          <VisibilityReportHeader
            orgLogoUrl={orgLogoUrl}
            takerName={takerName}
            reportDate={reportDate || formatDate(null)}
            frameworkName="WhatsWhat Prime"
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

        <ReportPage>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] items-start">
            <div className="xl:sticky xl:top-4 self-start">
              <VisibilityReportIndex
                reportIndex={reportIndex}
                nextStepsUrl={nextStepsUrl}
                onDownload={downloadPdf}
              />
            </div>

            <div className="space-y-4">
              <VisibilityVideoSection
                title="Video Introduction"
                videoSrc={publicVideoUrl}
                posterSrc={publicPosterUrl || undefined}
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
          <VisibilityCoachingInsights
            ai={kbReport.ai}
            fallbackStrengths={firstItems(sectionBullets(secStrengths), 4)}
            fallbackFriction={firstItems(sectionBullets(secFriction), 4)}
            fallbackOpportunity={sectionSummary(secOpportunity)}
            iconSrc={VISIBILITY_REPORT_ASSETS.sections.coaching}
            strategicOpportunityIconSrc={VISIBILITY_REPORT_ASSETS.insights.opportunity}
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
    </Shell>
  );
}
