//apps/web/app/t/[token]/visibility/report/VisibilityLiteReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type {
  PortalReportResponse,
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
  sectionSummary,
} from "@/components/visibility/report/VisibilityReportUtils";
import { ReportPage, Shell } from "@/components/visibility/report/VisibilityReportPrimitives";
import { VISIBILITY_REPORT_ASSETS } from "@/components/visibility/report/VisibilityReportAssets";
import VisibilityReportHeader from "@/components/visibility/report/VisibilityReportHeader";
import VisibilityLadderPanel from "@/components/visibility/report/VisibilityLadderPanel";
import VisibilityVideoSection from "@/components/visibility/report/VisibilityVideoSection";

const html2canvasPromise = () => import("html2canvas");
const jsPdfPromise = () => import("jspdf");

type Readiness = "stabilise" | "ready_to_progress";

type AiInsights = {
  executive_summary: string;
  what_this_means: string;
  strengths: string[];
  friction: string[];
  strategic_opportunity: string;
  plan_7_days: string[];
  plan_30_days: string[];
  closing_note: string;
};

type PillarItem = {
  key: string;
  label: string;
  value: number;
  band: string;
  color: string;
};

const SHORT_VIDEO_URL =
  "https://xciojwhnamsspmxpipzn.supabase.co/storage/v1/object/public/report-videos/Visibility%20Ladder%20Short.mp4";

const SHORT_VIDEO_POSTER_URL = "";
const WHATSWHAT_LOGO = "/images/visibility-report/logo/Whatswhat-logo.png";

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

function readinessLabel(r?: Readiness): string {
  if (r === "ready_to_progress") return "Ready to progress";
  if (r === "stabilise") return "Stabilise";
  return "—";
}

function OuterCard({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
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

function InnerPanel({
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

function IconBadge({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div
      className="h-12 w-12 shrink-0 rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${BRAND.border}`,
        background: "linear-gradient(180deg, rgba(87,146,255,0.95), rgba(69,118,225,0.92))",
        boxShadow: "0 10px 24px rgba(47,106,214,0.28)",
      }}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={(e: any) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}

function LiteHeroCard({
  tier,
  level,
  readiness,
  intro,
  marketCan,
  caution,
}: {
  tier: Tier;
  level: number;
  readiness?: Readiness;
  intro: string;
  marketCan: string[];
  caution: string[];
}) {
  return (
    <OuterCard className="p-5">
      <div className="flex items-start gap-4">
        <IconBadge
          src={VISIBILITY_REPORT_ASSETS.sections.marketExperience}
          alt="Result icon"
        />

        <div className="min-w-0 flex-1">
          <div className="text-[18px] md:text-[20px] font-semibold leading-tight">
            You are currently positioned at:{" "}
            <span style={{ color: BRAND.tier[tier] }}>
              Level {level} {tier} Tier
            </span>
          </div>

          <div className="mt-2 text-[14px] leading-7" style={{ color: BRAND.text }}>
            {intro}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <InnerPanel className="px-4 py-3">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Status
              </div>
              <div className="mt-1.5 text-[14px] font-semibold">
                {readinessLabel(readiness)}
              </div>
            </InnerPanel>

            <InnerPanel className="px-4 py-3">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Tier range
              </div>
              <div className="mt-1.5 text-[14px] font-semibold">
                {tier === "Invisible"
                  ? "1–5"
                  : tier === "Emerging"
                  ? "6–10"
                  : tier === "Established"
                  ? "11–15"
                  : "16–20"}
              </div>
            </InnerPanel>
          </div>
        </div>
      </div>

      <InnerPanel className="mt-5 p-4">
        <div className="text-[15px] font-semibold">What this means in reality</div>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <div className="text-[12px] font-semibold" style={{ color: BRAND.textDim }}>
              The market can:
            </div>
            <ul className="mt-2 space-y-2 text-[14px] leading-7" style={{ color: BRAND.text }}>
              {marketCan.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span style={{ color: BRAND.teal }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[12px] font-semibold" style={{ color: BRAND.textDim }}>
              But when it matters:
            </div>
            <ul className="mt-2 space-y-2 text-[14px] leading-7" style={{ color: BRAND.text }}>
              {caution.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span style={{ color: "#FF7A7A" }}>×</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

function buildTierCounts(raw: Record<string, number> | undefined | null, dominantTier: Tier) {
  const source = raw || {};
  const out: Record<Tier, number> = {
    Invisible: safeNumber((source as any)?.Invisible, 0),
    Emerging: safeNumber((source as any)?.Emerging, 0),
    Established: safeNumber((source as any)?.Established, 0),
    Magnetic: safeNumber((source as any)?.Magnetic, 0),
  };

  const total = out.Invisible + out.Emerging + out.Established + out.Magnetic;
  if (total > 0) return out;

  return {
    Invisible: dominantTier === "Invisible" ? 5 : 1,
    Emerging: dominantTier === "Emerging" ? 5 : 1,
    Established: dominantTier === "Established" ? 5 : 1,
    Magnetic: dominantTier === "Magnetic" ? 5 : 1,
  };
}

function DistributionChart({
  tierCounts,
}: {
  tierCounts: Record<Tier, number>;
}) {
  const items: Array<{ key: Tier; value: number; color: string }> = [
    { key: "Invisible", value: tierCounts.Invisible, color: BRAND.tier.Invisible },
    { key: "Emerging", value: tierCounts.Emerging, color: BRAND.tier.Emerging },
    { key: "Established", value: tierCounts.Established, color: BRAND.tier.Established },
    { key: "Magnetic", value: tierCounts.Magnetic, color: BRAND.tier.Magnetic },
  ];

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <OuterCard className="p-4 h-full">
      <div className="flex items-start gap-4">
        <IconBadge
          src={VISIBILITY_REPORT_ASSETS.sections.signalGraph}
          alt="Signal distribution"
        />
        <div>
          <div className="text-[15px] font-semibold">Signal distribution</div>
          <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
            These graphs show how your answers map across ladder tiers.
          </div>
        </div>
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="flex h-[220px] items-end justify-between gap-4">
          {items.map((item) => {
            const h = Math.max(12, Math.round((item.value / max) * 150));
            return (
              <div key={item.key} className="flex flex-1 flex-col items-center gap-3">
                <div className="text-[12px] font-medium">{item.value}</div>
                <div
                  className="w-full max-w-[74px] rounded-[12px]"
                  style={{
                    height: `${h}px`,
                    background: `linear-gradient(180deg, ${item.color}, ${item.color}cc)`,
                    boxShadow: `0 0 20px ${item.color}33`,
                  }}
                />
                <div className="text-center text-[11px]" style={{ color: BRAND.textDim }}>
                  {item.key}
                </div>
              </div>
            );
          })}
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

function SnapshotSummaryCard({
  tier,
  level,
  summary,
}: {
  tier: Tier;
  level: number;
  summary: string;
}) {
  return (
    <OuterCard className="p-4 h-full">
      <div className="flex items-start gap-4">
        <IconBadge
          src={VISIBILITY_REPORT_ASSETS.insights.opportunity}
          alt="Visibility snapshot"
        />
        <div>
          <div className="text-[15px] font-semibold">Your visibility snapshot</div>
          <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
            A concise summary of where you currently stand.
          </div>
        </div>
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] leading-7" style={{ color: BRAND.text }}>
          <span className="font-semibold" style={{ color: BRAND.tier[tier] }}>
            Level {level} — {tier}
          </span>
          {" · "}
          {summary}
        </div>
      </InnerPanel>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[13px] font-semibold">What this tells you</div>
        <div className="mt-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          This snapshot highlights your current market position and the major signal pattern shaping how prospects interpret your business.
        </div>
      </InnerPanel>
    </OuterCard>
  );
}

function pillarInterpretation(pillar: PillarItem): string {
  if (pillar.band === "Strong") {
    return `${pillar.label} is strong — this signal is helping the market respond to you with greater confidence and consistency.`;
  }
  if (pillar.band === "Developing") {
    return `${pillar.label} is developing — this signal is present, but it still needs strengthening to become more reliable.`;
  }
  return `${pillar.label} is weak — this is currently one of the areas most likely to create hesitation or friction in the market response.`;
}

function PillarSnapshot({
  pillars,
}: {
  pillars: PillarItem[];
}) {
  return (
    <OuterCard className="p-4">
      <div className="flex items-start gap-4">
        <IconBadge
          src={VISIBILITY_REPORT_ASSETS.sections.signalGraph}
          alt="Pillar snapshot"
        />
        <div>
          <div className="text-[15px] font-semibold">Your visibility pillars</div>
          <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
            A quick reading of the key signals shaping market response.
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {pillars.map((pillar) => (
          <InnerPanel key={pillar.key} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[13px] font-semibold">{pillar.label}</div>
              <div className="text-[12px]" style={{ color: BRAND.textDim }}>
                {pillar.value}%
              </div>
            </div>

            <div
              className="mt-2 h-2.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pillar.value}%`,
                  background: `linear-gradient(90deg, ${pillar.color}, rgba(255,255,255,0.28))`,
                }}
              />
            </div>

            <div className="mt-3 text-[12px] leading-6" style={{ color: BRAND.text }}>
              {pillarInterpretation(pillar)}
            </div>
          </InnerPanel>
        ))}
      </div>
    </OuterCard>
  );
}

function InsightsSnapshot({
  ai,
  strengths,
  friction,
  opportunity,
  nextStepsUrl,
}: {
  ai?: AiInsights | null;
  strengths: string[];
  friction: string[];
  opportunity: string;
  nextStepsUrl?: string;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="flex items-start gap-4">
        <IconBadge
          src={VISIBILITY_REPORT_ASSETS.sections.coaching}
          alt="Coaching insight"
        />
        <div>
          <div className="text-[15px] font-semibold">Coaching insight</div>
          <div className="mt-1 text-[12px]" style={{ color: BRAND.textDim }}>
            An additional interpretation layer built from your scored signals and narrative blocks.
          </div>
        </div>
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">Executive summary</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.executive_summary ||
            "This results snapshot gives a concise view of your current position and the signals shaping market response."}
        </div>
      </InnerPanel>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">What this means</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.what_this_means || opportunity}
        </div>
      </InnerPanel>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Strengths</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {strengths.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </InnerPanel>

        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Friction</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {friction.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </InnerPanel>
      </div>

      <InnerPanel className="mt-4 p-4">
        <div className="text-[14px] font-semibold">Strategic opportunity</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.strategic_opportunity || opportunity}
        </div>
      </InnerPanel>

      <OuterCard className="mt-4 p-4">
        <div className="text-[16px] font-semibold">Want the full Visibility Ladder report?</div>
        <div className="mt-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          The full report includes deeper strategic interpretation, broader coaching insights, and a more complete diagnostic view of your market position.
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {nextStepsUrl ? (
            <TopButton href={nextStepsUrl} variant="gradient">
              Unlock next step
            </TopButton>
          ) : null}
        </div>
      </OuterCard>
    </OuterCard>
  );
}

function TopButton({
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
    <button className={className} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

function realityForTier(tier: Tier) {
  switch (tier) {
    case "Invisible":
      return {
        intro:
          "Your business is beginning to appear, but the market still experiences inconsistency and uncertainty.",
        marketCan: [
          "Occasionally notice your presence",
          "See early signs of value",
          "Begin recognising your offer",
        ],
        caution: [
          "You are not yet easy to find",
          "Trust is not yet automatic",
          "Interest can stall before action",
        ],
      };
    case "Emerging":
      return {
        intro:
          "Your business is visible and gaining notice, but it is not yet the obvious choice in the market.",
        marketCan: [
          "Find you more consistently",
          "Understand your offer more clearly",
          "See growing signs of credibility",
        ],
        caution: [
          "You may still be compared against alternatives",
          "Trust is not yet fully settled",
          "Momentum can slow before conversion",
        ],
      };
    case "Established":
      return {
        intro:
          "Your business is recognised and trusted enough to create stronger confidence, but there is still room to deepen authority.",
        marketCan: ["Find you", "Understand what you do", "Recognise your value"],
        caution: [
          "You are not always the obvious choice",
          "Trust may still require reassurance",
          "Growth can flatten without stronger authority cues",
        ],
      };
    case "Magnetic":
    default:
      return {
        intro:
          "Your business carries strong market pull. Visibility, trust, and authority are working together at a high level.",
        marketCan: [
          "Recognise you quickly",
          "Trust your position with confidence",
          "Move toward action with less persuasion",
        ],
        caution: [
          "Consistency still needs protecting",
          "Strong reputation must be sustained",
          "Leadership signals need to remain visible",
        ],
      };
  }
}

export default function VisibilityLiteReportClient({
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
  const readiness = kbReport?.signals?.readiness as Readiness | undefined;

  const pillars = buildPillars(
    (kbReport?.graphs?.pillars || kbReport?.signals?.pillar_scores) as Record<string, number>
  );
  const tierCounts = buildTierCounts(kbReport?.graphs?.tier_counts, tier);

  const sectionMap = useMemo(() => {
    const map = new Map<string, Section>();
    const sections = Array.isArray(kbReport?.sections) ? kbReport?.sections : [];
    for (const section of sections) map.set(section.key, section);
    return map;
  }, [kbReport?.sections]);

  const secMarketExperience = sectionMap.get("market_experience") || null;
  const secOpportunity = sectionMap.get("opportunity") || null;
  const secStrengths = sectionMap.get("strengths") || null;
  const secFriction = sectionMap.get("friction") || null;
  const secSnapshot = sectionMap.get("snapshot") || null;

  const reality = realityForTier(tier);
  const snapshotSummary =
    sectionSummary(secSnapshot) ||
    sectionSummary(secMarketExperience) ||
    reality.intro;

  const strengths = firstItems(
    (kbReport?.ai?.strengths?.length ? kbReport.ai.strengths : []).concat(
      firstItems(sectionBullets(secStrengths), 3)
    ),
    3
  );

  const friction = firstItems(
    (kbReport?.ai?.friction?.length ? kbReport.ai.friction : []).concat(
      firstItems(sectionBullets(secFriction), 3)
    ),
    3
  );

  const opportunity =
    kbReport?.ai?.strategic_opportunity ||
    sectionSummary(secOpportunity) ||
    "Strengthen the most important weak signal so your market response becomes more consistent and predictable.";

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

      const safeName = `${safeString(takerName) || "Visibility"}-Results-Snapshot.pdf`.replace(
        /[^\w\-]+/g,
        "_"
      );
      pdf.save(safeName);
    } catch (e) {
      console.error("[visibility-lite] pdf export failed", e);
      alert("PDF export failed.");
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1560px] px-4 py-5">
          <div className="text-2xl font-semibold">Loading your snapshot…</div>
          <div className="mt-2 text-sm" style={{ color: BRAND.textDim }}>
            Preparing your Results Snapshot.
          </div>
        </div>
      </Shell>
    );
  }

  if (err || !kbReport) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1560px] px-4 py-5 space-y-4">
          <div className="text-2xl font-semibold">Couldn’t load Visibility snapshot</div>
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
        <ReportPage id="ladder-position">
          <VisibilityReportHeader
            orgLogoUrl={WHATSWHAT_LOGO}
            takerName={takerName}
            reportDate={reportDate || formatDate(null)}
            frameworkName="WhatsWhat Prime"
            nextStepsUrl={nextStepsUrl}
            onDownload={downloadPdf}
          />

          <VisibilityVideoSection
            title="Welcome Video"
            videoSrc={SHORT_VIDEO_URL}
            posterSrc={SHORT_VIDEO_POSTER_URL || undefined}
            helperText="Watch this short introduction before reviewing your snapshot."
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] items-start">
            <div className="self-start">
              <VisibilityLadderPanel tier={tier} level={level} />
            </div>

            <div className="space-y-4">
              <LiteHeroCard
                tier={tier}
                level={level}
                readiness={readiness}
                intro={reality.intro}
                marketCan={reality.marketCan}
                caution={reality.caution}
              />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-stretch">
                <DistributionChart tierCounts={tierCounts} />
                <SnapshotSummaryCard
                  tier={tier}
                  level={level}
                  summary={snapshotSummary}
                />
              </div>
            </div>
          </div>
        </ReportPage>

        <ReportPage id="visibility-snapshot">
          <PillarSnapshot pillars={pillars} />
        </ReportPage>

        <ReportPage id="results-snapshot">
          <InsightsSnapshot
            ai={kbReport.ai as AiInsights | null | undefined}
            strengths={strengths}
            friction={friction}
            opportunity={opportunity}
            nextStepsUrl={nextStepsUrl}
          />
        </ReportPage>
      </div>
    </Shell>
  );
}