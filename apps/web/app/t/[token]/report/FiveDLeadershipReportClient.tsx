//apps/web/app/t/[token]/report/FiveDLeadershipReportClient.tsx
"use client";

import { useMemo, useRef, type ReactNode } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type AB = "A" | "B" | "C" | "D";

type LinkMeta = {
  next_steps_url?: string | null;
};

type RaisonDetreData = {
  raw_score?: number;
  percentage?: number;
  eligible_count?: number;
  answered_count?: number;
};

type SectionBlock =
  | { type: "p"; text?: string }
  | { type: "paragraph"; text?: string; content?: string }
  | { type: "ul"; items?: unknown[] }
  | { type: "ol"; items?: unknown[] }
  | { type: "quote"; text?: string; cite?: string }
  | { type: "divider" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | { type: "heading"; text?: string; level?: number }
  | {
      type: "image";
      src?: string;
      alt?: string;
      caption?: string;
      align?: "left" | "center" | "right";
      max_h?: number;
    }
  | { type: "html"; html?: string }
  | { type: "callout"; title?: string; text?: string; content?: string }
  | { type: string; [k: string]: any };

type ReportSection = {
  id?: string;
  title?: string;
  blocks?: SectionBlock[];
};

type ResultData = {
  org_slug: string;
  org_name?: string | null;
  org_logo_url?: string | null;
  test_name: string;

  taker: { id: string; first_name?: string | null; last_name?: string | null };

  link?: LinkMeta;

  frequency_labels: Array<{ code: AB; name: string }>;
  frequency_percentages: Record<AB, number>;
  frequency_totals?: Record<AB, number>;

  profile_labels: Array<{ code: string; name: string }>;
  profile_percentages: Record<string, number>;
  profile_totals?: Record<string, number>;

  top_freq: AB;
  top_profile_code: string;
  top_profile_name: string;

  raison_detre?: RaisonDetreData;
  raison_detre_raw_score?: number;
  raison_detre_percentage?: number;

  sections?: {
    common?: ReportSection[] | null;
    profile?: ReportSection[] | null;
    report_title?: string | null;
    framework_path?: string | null;
  } | null;

  debug?: any;
  version?: string;
};

type RenderableSection = {
  id: string;
  title: string;
  blocks: SectionBlock[];
};

type RenderContext = {
  data: ResultData;
  participant: string;
  topFreq: AB;
  topCode: string;
  topName: string;
  raisonScore: number;
};

const ASSET_BASE = "/images/5d-leadership-compass";

const ASSETS = {
  logo: `${ASSET_BASE}/5d-logo.png`,
  brett: `${ASSET_BASE}/brett-gordon.png`,
  fiveDimensionsCompass: `${ASSET_BASE}/five-dimensions-compass.png`,
  iconWelcome: `${ASSET_BASE}/icon-welcome.png`,
  iconCompass: `${ASSET_BASE}/icon-compass.png`,
  iconProfiles: `${ASSET_BASE}/icon-profiles.png`,
  iconResults: `${ASSET_BASE}/icon-results.png`,
};

const DESIGN_FONT =
  "'Inter', 'Montserrat', 'Avenir Next', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const DARK_PANEL =
  "linear-gradient(180deg, rgba(18,54,91,0.97) 0%, rgba(5,29,56,0.98) 100%)";

const PAGE_BG =
  "radial-gradient(ellipse 69% 58% at 12% 12%, rgba(79,125,255,0.22) 0%, rgba(79,125,255,0) 58%), radial-gradient(ellipse 60% 51% at 86% 18%, rgba(69,224,209,0.12) 0%, rgba(69,224,209,0) 56%), radial-gradient(ellipse 50% 58% at 50% 92%, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 60%), #061A3A";

const PROFILE_ORDER = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const FREQUENCY_ORDER: AB[] = ["A", "B", "C", "D"];

const PROFILE_META: Record<
  string,
  {
    name: string;
    shortName: string;
    dimension: string;
    shortDimension: string;
    description: string;
    color: string;
  }
> = {
  P1: {
    name: "The Disruptor",
    shortName: "Disruptor",
    dimension: "Catalyst Dimension",
    shortDimension: "Catalyst",
    description: "Visionary innovators who push boundaries and create industry-shifting change.",
    color: "#15C96F",
  },
  P2: {
    name: "The Advocator",
    shortName: "Advocator",
    dimension: "Catalyst–Communicator Dimension",
    shortDimension: "Catalyst–Comm.",
    description:
      "High-energy leaders who thrive on engagement, motivation, and generating broad interest and buy-in.",
    color: "#7FA04A",
  },
  P3: {
    name: "The Mediator",
    shortName: "Mediator",
    dimension: "Communicator Dimension",
    shortDimension: "Communicator",
    description: "Empathetic leaders who excel in team alignment, conflict resolution, and relationship-building.",
    color: "#D34B41",
  },
  P4: {
    name: "The Connector",
    shortName: "Connector",
    dimension: "Communicator–Strategist Dimension",
    shortDimension: "Comm.–Strategist",
    description: "Strategic networkers who leverage partnerships to drive business success.",
    color: "#C76932",
  },
  P5: {
    name: "The Planner",
    shortName: "Planner",
    dimension: "Strategist Dimension",
    shortDimension: "Strategist",
    description:
      "Customer, market and mission-oriented leaders focused on service-driven planning and reliable logistics performance.",
    color: "#D68A1D",
  },
  P6: {
    name: "The Forecaster",
    shortName: "Forecaster",
    dimension: "Strategist–Stabilizer Dimension",
    shortDimension: "Strat.–Stabilizer",
    description:
      "Risk-aware, detail-oriented leaders with foresight to anticipate upcoming opportunities and challenges.",
    color: "#5B80B4",
  },
  P7: {
    name: "The Analyzer",
    shortName: "Analyzer",
    dimension: "Stabilizer Dimension",
    shortDimension: "Stabilizer",
    description:
      "Systems-oriented thinkers who use data-driven, systematic approaches to develop long-term business frameworks.",
    color: "#356AB9",
  },
  P8: {
    name: "The Optimizer",
    shortName: "Optimizer",
    dimension: "Stabilizer–Disruptor Dimension",
    shortDimension: "Stab.–Disruptor",
    description:
      "Precision-driven leaders who refine processes, integrate technology, implement automation, and make things better.",
    color: "#4A8F6C",
  },
};

const FREQUENCY_META: Record<
  AB,
  {
    label: string;
    dimension: string;
    subtitle: string;
    description: string;
    cardColor: string;
    chartColor: string;
  }
> = {
  A: {
    label: "Innovation",
    dimension: "Catalyst",
    subtitle: "Rapid Response & Innovation",
    description: "Action-oriented leaders who drive change and thrive in fast-moving environments.",
    cardColor: "#2F9F67",
    chartColor: "#FF3742",
  },
  B: {
    label: "Influence",
    dimension: "Communicator",
    subtitle: "Influence & Relationship-Driven Leadership",
    description: "People-focused leaders who build strong teams and partnerships.",
    cardColor: "#C94440",
    chartColor: "#F59B2F",
  },
  C: {
    label: "Implementation",
    dimension: "Strategist",
    subtitle: "Customer Service & Mission Driven",
    description:
      "Structured leaders who ensure operational efficiency and reliability focused on balancing customer delight with operational effectiveness and reliability.",
    cardColor: "#D7851F",
    chartColor: "#11B57B",
  },
  D: {
    label: "Insight",
    dimension: "Stabilizer",
    subtitle: "Target Focused & Systems Thinking",
    description:
      "Analytical leaders who focus on longer-term, detailed analysis, optimization and future-proofing businesses.",
    cardColor: "#336FBD",
    chartColor: "#1D7FE8",
  },
};

function safeText(x: unknown): string {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (Array.isArray(x)) return x.map(safeText).join(" ");
  if (x == null) return "";
  return String(x);
}

function fullName(first?: string | null, last?: string | null) {
  const out = `${first || ""} ${last || ""}`.trim();
  return out || "Participant";
}

function normalizeFrequency(input: unknown): AB {
  const s = String(input || "").trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D") return s;
  return "A";
}

function normalizeProfileCode(input: unknown): string {
  const s = String(input || "").trim().toUpperCase();
  const m = s.match(/^P(?:ROFILE)?[_\s-]?([1-8])$/i);
  if (m) return `P${m[1]}`;

  const legacy = s.match(/^PROFILE[_\s-]?([1-8])$/i);
  if (legacy) return `P${legacy[1]}`;

  return s;
}

function legacyProfileCode(input: unknown): string {
  const p = normalizeProfileCode(input);
  const m = p.match(/^P([1-8])$/i);
  return m ? `PROFILE_${m[1]}` : p;
}

function profileNumber(code: string) {
  const m = normalizeProfileCode(code).match(/^P([1-8])$/);
  return m ? m[1] : "";
}

function asRatio(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return Math.min(n / 100, 1);
  return Math.min(n, 1);
}

function pctLabelFromRatio(ratio = 0) {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

function percentWidth(ratio = 0) {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

function readProfileTotal(data: ResultData, code: string) {
  const normalized = normalizeProfileCode(code);
  const legacy = legacyProfileCode(code);

  const direct = data.profile_totals?.[normalized];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;

  const legacyVal = data.profile_totals?.[legacy];
  if (typeof legacyVal === "number" && Number.isFinite(legacyVal)) return legacyVal;

  return 0;
}

function readProfileRatio(data: ResultData, code: string) {
  const normalized = normalizeProfileCode(code);
  const legacy = legacyProfileCode(code);

  const direct = data.profile_percentages?.[normalized];
  if (typeof direct === "number" && Number.isFinite(direct)) return asRatio(direct);

  const legacyVal = data.profile_percentages?.[legacy];
  if (typeof legacyVal === "number" && Number.isFinite(legacyVal)) return asRatio(legacyVal);

  const total = readProfileTotal(data, code);
  const sum = PROFILE_ORDER.reduce((acc, c) => acc + readProfileTotal(data, c), 0);
  if (sum > 0) return Math.max(0, Math.min(1, total / sum));

  return 0;
}

function readFrequencyTotal(data: ResultData, code: AB) {
  const val = data.frequency_totals?.[code];
  if (typeof val === "number" && Number.isFinite(val)) return val;
  return 0;
}

function readFrequencyRatio(data: ResultData, code: AB) {
  const val = data.frequency_percentages?.[code];
  if (typeof val === "number" && Number.isFinite(val)) return asRatio(val);

  const total = readFrequencyTotal(data, code);
  const sum = FREQUENCY_ORDER.reduce((acc, c) => acc + readFrequencyTotal(data, c), 0);
  if (sum > 0) return Math.max(0, Math.min(1, total / sum));

  return 0;
}

function percentFromScore(data: ResultData) {
  const nested = Number(data.raison_detre?.percentage ?? NaN);
  if (Number.isFinite(nested)) return nested > 1 ? Math.round(nested) : Math.round(nested * 100);

  const flat = Number(data.raison_detre_percentage ?? NaN);
  if (Number.isFinite(flat)) return flat > 1 ? Math.round(flat) : Math.round(flat * 100);

  return 0;
}

function cleanProfileName(name: string, code: string) {
  const normalized = normalizeProfileCode(code);
  const meta = PROFILE_META[normalized];

  const cleaned = safeText(name)
    .replace(/^P[1-8]:\s*/i, "")
    .replace(/^Profile\s*[1-8]:\s*/i, "")
    .replace(/\s*\(P[1-8]\)\s*$/i, "")
    .trim();

  if (!cleaned) return meta?.shortName || normalized;

  return cleaned.replace(/^The\s+/i, "");
}

function replaceMacros(input: unknown, ctx: RenderContext) {
  const text = safeText(input);
  const topMeta = PROFILE_META[ctx.topCode];

  return text
    .replace(/\{\{\s*FULL_NAME\s*\}\}/gi, ctx.participant)
    .replace(/\{\{\s*FIRST_NAME\s*\}\}/gi, ctx.participant.split(" ")[0] || ctx.participant)
    .replace(/\{\{\s*PROFILE_NAME\s*\}\}/gi, ctx.topName)
    .replace(/\{\{\s*PROFILE_CODE\s*\}\}/gi, ctx.topCode)
    .replace(/\{\{\s*PROFILE_NUMBER\s*\}\}/gi, profileNumber(ctx.topCode))
    .replace(/\{\{\s*PROFILE_DIMENSION\s*\}\}/gi, topMeta?.dimension || "")
    .replace(/\{\{\s*TOP_FREQUENCY\s*\}\}/gi, ctx.topFreq)
    .replace(/\{\{\s*RAISON_SCORE\s*\}\}/gi, `${ctx.raisonScore}%`);
}

function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  return (
    <span className="inline-flex">
      <img
        src={src}
        alt={alt}
        className={className}
        crossOrigin="anonymous"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (next) next.style.display = "flex";
        }}
      />
      <span style={{ display: "none" }} className={className}>
        {fallback || null}
      </span>
    </span>
  );
}

function sectionIconFor(title: string) {
  const t = title.toLowerCase();

  if (t.includes("welcome")) return { src: ASSETS.iconWelcome, fallback: "✉" };
  if (t.includes("dimension")) return { src: ASSETS.iconCompass, fallback: "🧭" };
  if (t.includes("profile")) return { src: ASSETS.iconProfiles, fallback: "👥" };
  if (t.includes("result") || t.includes("score")) return { src: ASSETS.iconResults, fallback: "📌" };
  if (t.includes("use")) return { src: undefined, fallback: "📖" };
  if (t.includes("role")) return { src: undefined, fallback: "🎯" };
  if (t.includes("development") || t.includes("growth")) return { src: undefined, fallback: "🚀" };
  if (t.includes("case")) return { src: undefined, fallback: "📚" };
  if (t.includes("final")) return { src: undefined, fallback: "✨" };

  return { src: undefined, fallback: "✦" };
}

function SectionShell({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const icon = sectionIconFor(title);

  return (
    <section
      id={id}
      className="rounded-[28px] border border-white/10 p-[18px] shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
      style={{ background: DARK_PANEL }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5EFEA] text-lg text-[#0C203A] shadow-sm">
          {icon.src ? (
            <ImageWithFallback
              src={icon.src}
              alt=""
              className="flex h-11 w-11 items-center justify-center rounded-[14px] object-contain p-1.5"
              fallback={<span className="flex h-11 w-11 items-center justify-center">{icon.fallback}</span>}
            />
          ) : (
            icon.fallback
          )}
        </div>
        <h2 className="text-[15px] font-bold leading-[22px] text-white">{title}</h2>
      </div>

      {children}
    </section>
  );
}

function WhitePanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] border border-white/10 bg-[#F6F7FA] text-[#313C52] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function DashboardOuterCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[20px] border border-white/10 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.25)]"
      style={{ background: DARK_PANEL }}
    >
      <h3 className="text-[16px] font-bold text-white">{title}</h3>
      <p className="mt-2 max-w-[540px] text-[12px] leading-6 text-white/85">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[168px] rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-medium leading-none text-white/55">{label}</p>
      <p className="mt-2 text-[15px] font-bold leading-tight text-white">{value}</p>
    </div>
  );
}

function TopHeader({
  participant,
  reportDate,
  onDownload,
  onNext,
}: {
  participant: string;
  reportDate: string;
  onDownload: () => void;
  onNext: () => void;
}) {
  return (
    <section
      className="rounded-[24px] border border-white/10 px-5 py-5 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
      style={{ background: DARK_PANEL }}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/15 bg-white/10">
            <ImageWithFallback
              src={ASSETS.logo}
              alt="5D Leadership"
              className="flex h-10 w-10 items-center justify-center rounded-[14px] object-contain p-1"
              fallback={<span className="flex h-10 w-10 items-center justify-center text-[10px] font-black">5D</span>}
            />
          </div>

          <div>
            <p className="text-[28px] font-black uppercase leading-none tracking-[0.14em] text-white md:text-[32px]">
              Personalised Report
            </p>
            <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.28em] text-white/75">
              5D Leadership Compass
            </p>
            <p className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
              Powered by Profiletest.ai
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
          <button
            onClick={onDownload}
            className="rounded-lg border border-white/10 bg-[#08162B]/80 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#08162B]"
          >
            Download PDF
          </button>
          <button
            onClick={onNext}
            className="rounded-lg bg-gradient-to-r from-[#24D6DC] via-[#2D8CFF] to-[#7857F6] px-4 py-2.5 text-[12px] font-black text-[#071C36] shadow-sm"
          >
            Next steps
          </button>

          <div className="mt-2 flex w-full flex-wrap gap-2 xl:mt-0 xl:w-auto">
            <InfoPill label="Prepared for" value={participant} />
            <InfoPill label="Date" value={reportDate} />
            <InfoPill label="Framework" value="The 5D Leadership Compass" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroHeader({
  data,
  participant,
  raisonScore,
}: {
  data: ResultData;
  participant: string;
  raisonScore: number;
}) {
  const topFreq = normalizeFrequency(data.top_freq);
  const topFreqMeta = FREQUENCY_META[topFreq];

  const topCode = normalizeProfileCode(data.top_profile_code);
  const topName = cleanProfileName(data.top_profile_name, topCode);
  const topMeta = PROFILE_META[topCode] || PROFILE_META.P1;

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_327px]">
      <div
        className="rounded-[24px] border border-white/10 p-5 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
        style={{ background: DARK_PANEL }}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_353px]">
          <div className="py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/55">
              The 5D Leadership Compass
            </p>

            <h1 className="mt-4 text-[44px] font-black leading-[0.95] tracking-[-0.04em] text-white md:text-[54px]">
              {participant}
            </h1>

            <p className="mt-6 max-w-[800px] text-[15px] leading-7 text-white/90">
              “Navigating Leadership Strengths in Logistics, Supply Chain, and Operations” — {topMeta.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span
                className="inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-black"
                style={{
                  borderColor: `${topMeta.color}55`,
                  background: `${topMeta.color}1F`,
                  color: topMeta.color,
                }}
              >
                ⚡ Profile {profileNumber(topCode)} · {topName}
              </span>

              <span className="inline-flex items-center rounded-full border border-[#0FCD5E]/25 bg-[#0FCD5E]/10 px-4 py-2 text-[13px] font-black text-[#0FCD5E]">
                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#0FCD5E]" />
                {topFreq} · {topFreqMeta.dimension} Dimension
              </span>
            </div>

            <div className="mt-7 grid max-w-[640px] overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04] md:grid-cols-2">
              <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#5A6A88]">Dimension</p>
                <p className="mt-2 text-[22px] font-black text-white">{topFreqMeta.dimension}</p>
                <p className="mt-1 text-[12px] text-[#8FA0BC]">{topFreqMeta.subtitle}</p>
              </div>
              <div className="p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#5A6A88]">
                  Leadership Style
                </p>
                <p className="mt-2 text-[22px] font-black text-white">{topName}</p>
                <p className="mt-1 text-[12px] text-[#8FA0BC]">{topMeta.shortDimension}</p>
              </div>
            </div>
          </div>

          <HeroProfileList data={data} />
        </div>
      </div>

      <RaisonScoreCard score={raisonScore} />
    </section>
  );
}

function HeroProfileList({ data }: { data: ResultData }) {
  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <div
      className="rounded-[24px] border border-white/10 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.22)]"
      style={{ background: DARK_PANEL }}
    >
      <div className="space-y-2">
        {PROFILE_ORDER.map((code, idx) => {
          const meta = PROFILE_META[code];
          const active = code === topCode;

          return (
            <div
              key={code}
              className="grid grid-cols-[22px_10px_1fr_auto_auto] items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px]"
              style={{
                borderColor: active ? `${meta.color}66` : "rgba(255,255,255,0.06)",
                background: active ? `${meta.color}24` : "rgba(255,255,255,0.035)",
              }}
            >
              <span className="text-[11px] text-white/35">{idx + 1}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              <span className={active ? "font-bold text-[#0FCD5E]" : "font-semibold text-[#E4EAF8]"}>
                {meta.name}
              </span>
              <span className={active ? "text-[10px] text-[#0FCD5E]" : "text-[10px] text-white/35"}>
                {meta.shortDimension}
              </span>
              {active ? (
                <span className="rounded-full bg-[#0FCD5E] px-2 py-0.5 text-[9px] font-black text-white">You</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RaisonScoreCard({ score }: { score: number }) {
  return (
    <div className="rounded-[24px] bg-[#624585] p-7 text-center text-white shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
      <p className="mx-auto inline-flex rounded-full border border-white/55 px-8 py-2 text-[11px] font-black uppercase leading-tight tracking-[0.18em] text-white">
        The 5th
        <br />
        Dimension
      </p>

      <p className="mt-12 text-[70px] font-black leading-none tracking-[-0.06em]">{score}%</p>

      <p className="mt-5 text-[22px] font-black uppercase leading-tight tracking-[0.16em]">
        Your Raison
        <br />
        d&apos;être Score
      </p>

      <p className="mx-auto mt-10 max-w-[220px] text-[13px] leading-6 text-white/86">
        The underlying passions, drivers and direction that defines how leaders find fulfillment.
      </p>
    </div>
  );
}

function OverviewDashboard({ data }: { data: ResultData }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <DimensionScorePanel data={data} />
      <ProfileMapPanel data={data} />
    </section>
  );
}

function DimensionScorePanel({ data }: { data: ResultData }) {
  const ticks = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

  return (
    <DashboardOuterCard
      title="Dimensions"
      description="The four Drivers show the behavioural energy you use most often. Higher scores are patterns you access more naturally; lower scores are patterns you may need to be more intentional about."
    >
      <div className="rounded-[14px] border border-[#D6DDE7] bg-[#F5F7FA] p-4">
        <div className="rounded-[12px] border border-[#D6DDE7] bg-[#EEF2F6] p-4">
          <div className="grid grid-cols-[34px_1fr] gap-4">
            <div className="relative h-[250px]">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute left-0 right-0 text-[10px] text-[#8A96A9]"
                  style={{ bottom: `${tick}%`, transform: tick === 0 ? "translateY(0)" : "translateY(50%)" }}
                >
                  {tick}
                </div>
              ))}
            </div>

            <div className="relative h-[250px]">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute left-0 right-0 border-t border-[#DDE4EC]"
                  style={{ bottom: `${tick}%` }}
                />
              ))}

              <div className="grid h-full grid-cols-4 gap-2 px-2 pt-2">
                {FREQUENCY_ORDER.map((code) => {
                  const ratio = readFrequencyRatio(data, code);
                  const percent = Math.round(ratio * 100);
                  const meta = FREQUENCY_META[code];

                  return (
                    <div key={code} className="flex h-full flex-col items-center justify-end">
                      <div className="mb-2 text-[12px] font-bold text-[#5E6675]">{percent}</div>

                      <div className="relative flex h-[206px] w-full max-w-[82px] items-end overflow-hidden rounded-[6px] border border-[#D2D9E2] bg-[#F3F3F3]">
                        <div
                          className="w-full rounded-b-[6px]"
                          style={{
                            height: `${percent}%`,
                            minHeight: percent > 0 ? 8 : 0,
                            background: meta.chartColor,
                          }}
                        />
                      </div>

                      <div className="mt-3 text-[14px] font-black text-[#13233C]">{code}</div>
                      <div className="mt-1 text-center text-[10px] font-medium tracking-[0.04em] text-[#5E6E86]">
                        {meta.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardOuterCard>
  );
}

function ProfileMapPanel({ data }: { data: ResultData }) {
  return (
    <DashboardOuterCard
      title="Your Personality Map (Profile)"
      description="This map shows your overall pattern across Profiles. It helps you see what you naturally lean on (strength), and what may require support or structure (risk)."
    >
      <div className="rounded-[14px] border border-[#D6DDE7] bg-[#F5F7FA] p-4">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="text-[14px] font-bold text-[#18253D]">Your Personality Map (Profiles)</p>
          <p className="text-[11px] text-[#7B879B]">Higher = stronger pattern</p>
        </div>
        <ProfileRadar data={data} />
      </div>
    </DashboardOuterCard>
  );
}

function polygonPoints(cx: number, cy: number, radius: number, count: number) {
  return Array.from({ length: count }, (_, idx) => {
    const angle = -Math.PI / 2 + (idx * Math.PI * 2) / count;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return `${x},${y}`;
  }).join(" ");
}

function ProfileRadar({ data }: { data: ResultData }) {
  const size = 380;
  const cx = size / 2;
  const cy = 190;
  const maxRadius = 110;
  const rings = [0.17, 0.34, 0.51, 0.68, 0.85, 1];

  const points = PROFILE_ORDER.map((code, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / PROFILE_ORDER.length;
    const ratio = readProfileRatio(data, code);
    const radius = ratio * maxRadius;

    return {
      code,
      ratio,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      ax: cx + Math.cos(angle) * maxRadius,
      ay: cy + Math.sin(angle) * maxRadius,
      lx: cx + Math.cos(angle) * (maxRadius + 22),
      ly: cy + Math.sin(angle) * (maxRadius + 22),
      tx: cx + Math.cos(angle) * (maxRadius + 6),
      ty: cy + Math.sin(angle) * (maxRadius + 6),
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <svg viewBox={`0 0 ${size} 360`} className="h-auto w-full">
        {rings.map((ring, idx) => (
          <polygon
            key={idx}
            points={polygonPoints(cx, cy, maxRadius * ring, PROFILE_ORDER.length)}
            fill="none"
            stroke="#D7DCE5"
            strokeWidth="1"
          />
        ))}

        {points.map((p) => (
          <line key={p.code} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="#D7DCE5" strokeWidth="1" />
        ))}

        <polygon points={polygon} fill="rgba(36,214,220,0.16)" stroke="#16C7C6" strokeWidth="2.5" />

        {points.map((p) => (
          <g key={p.code}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#16C7C6" />
            <text
              x={p.lx}
              y={p.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="700"
              fill="#4B5565"
            >
              {p.code}
            </text>
            <text
              x={p.tx}
              y={p.ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#8A96A9"
            >
              {Math.round(p.ratio * 100)}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function sectionTitleToId(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ReportIndex({
  sections,
  onDownload,
  onNext,
}: {
  sections: RenderableSection[];
  onDownload: () => void;
  onNext: () => void;
}) {
  return (
    <aside
      className="sticky top-4 self-start rounded-[20px] border border-white/10 p-4 text-white shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
      style={{ background: DARK_PANEL }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-white/35">Report Index</p>

      <div className="mt-4 max-h-[72vh] space-y-2 overflow-auto pr-1">
        {sections.map((section, idx) => (
          <button
            key={`${section.id}-${idx}`}
            onClick={() =>
              document.getElementById(section.id)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            className="block w-full rounded-[10px] border border-white/8 bg-white/[0.03] px-3 py-2.5 text-left text-[11px] leading-5 text-white/92 hover:bg-white/[0.06]"
          >
            <span className="font-bold text-white">{idx + 1}.</span> {section.title}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <button
          onClick={onDownload}
          className="w-full rounded-[10px] border border-white/15 bg-[#071629] px-3 py-2.5 text-left text-[11px] font-bold text-white"
        >
          Download PDF
        </button>
        <button
          onClick={onNext}
          className="w-full rounded-[10px] bg-gradient-to-r from-[#24D6DC] via-[#2D8CFF] to-[#7857F6] px-3 py-2.5 text-left text-[11px] font-bold text-[#071C36]"
        >
          Next step
        </button>
      </div>
    </aside>
  );
}

function buildFallbackSections(ctx: RenderContext): RenderableSection[] {
  const topMeta = PROFILE_META[ctx.topCode] || PROFILE_META.P1;
  const topLabel = topMeta.name;

  const titles = [
    "Welcome to the 5D Leadership Compass",
    "Introduction to the 5D Leadership Compass",
    "The Five Dimensions of Leadership",
    "The Eight Leadership Profiles",
    "How to Use This Framework",
    `Introduction to The ${topLabel} Profile`,
    `Core Characteristics Of The ${topLabel}`,
    `How The ${topLabel} Leads in Logistics`,
    `Success Factors for The ${topLabel} in Logistics`,
    "Ideal Roles in Logistics & Supply Chain",
    "Roles That Will Be Challenging",
    `Enhancing The ${topLabel}'s Development`,
    `Case Studies & Industry Examples Of The ${topLabel}`,
    `Final Thoughts on The ${topLabel} Profile`,
    "The Raison d'être Dimension",
    "Final Thoughts: The 5D Leader — Leading in Your Core, Living With Purpose",
  ];

  const blocksByTitle: Record<string, SectionBlock[]> = {
    "Welcome to the 5D Leadership Compass": [
      { type: "p", text: `Dear ${ctx.participant},` },
      {
        type: "p",
        text:
          "Welcome to the 5D Leadership Compass, a framework designed to help you unlock your leadership potential by understanding your natural strengths, decision-making style, and how you best contribute to your team, industry, and life.",
      },
      {
        type: "p",
        text:
          "This report gives you a practical way to understand your leadership pattern and apply it in logistics, supply chain, and operations environments.",
      },
    ],
    "Introduction to the 5D Leadership Compass": [
      {
        type: "p",
        text:
          "The 5D Leadership Compass is a dynamic framework that categorises leadership into five core dimensions. Four dimensions represent distinct behavioural leadership patterns, while the fifth dimension — Raison d’être — reflects the deeper purpose and motivation behind leadership.",
      },
    ],
    "How to Use This Framework": [
      {
        type: "ul",
        items: [
          "Use your top profile as a guide to your most natural leadership pattern.",
          "Review the dimensions and note which behavioural energies are strongest.",
          "Use the profile insights to understand strengths, risks, and growth opportunities.",
          "Return to this report regularly to reflect on what is becoming more intentional.",
        ],
      },
    ],
    [`Introduction to The ${topLabel} Profile`]: [
      {
        type: "p",
        text: `${topLabel} reflects a strong tendency toward ${topMeta.description.toLowerCase()}`,
      },
      {
        type: "p",
        text:
          "Your profile is not a box — it is a guide. It shows where you naturally lead from and where greater awareness can improve consistency and influence.",
      },
    ],
    [`Core Characteristics Of The ${topLabel}`]: [
      {
        type: "ul",
        items: [
          "Natural strengths and behavioural preferences",
          "The leadership environments where this pattern performs best",
          "Potential blind spots that can emerge under pressure",
        ],
      },
    ],
    [`How The ${topLabel} Leads in Logistics`]: [
      {
        type: "p",
        text:
          "In logistics, supply chain, and operational leadership, this profile often shows up through the way decisions are made, people are engaged, and systems are improved or protected.",
      },
    ],
    [`Success Factors for The ${topLabel} in Logistics`]: [
      {
        type: "ul",
        items: [
          "Strong self-awareness",
          "A clear understanding of role fit",
          "The ability to complement your strengths with other leadership styles",
        ],
      },
    ],
    "Ideal Roles in Logistics & Supply Chain": [
      {
        type: "p",
        text:
          "The best-fit roles for any leadership profile are those that allow strengths to be expressed consistently while still offering the right amount of challenge and growth.",
      },
    ],
    "Roles That Will Be Challenging": [
      {
        type: "p",
        text:
          "Every leadership profile has environments that may create strain. Knowing these in advance helps you build better support systems, team balance, and role alignment.",
      },
    ],
    [`Enhancing The ${topLabel}'s Development`]: [
      {
        type: "p",
        text:
          "Development comes from leaning into your strengths while intentionally building awareness around your less natural patterns.",
      },
    ],
    [`Case Studies & Industry Examples Of The ${topLabel}`]: [
      {
        type: "p",
        text:
          "Real-world examples help bring this profile to life and show how these leadership tendencies may appear across different operational and business environments.",
      },
    ],
    [`Final Thoughts on The ${topLabel} Profile`]: [
      {
        type: "p",
        text:
          "The goal is not to become someone else — it is to become more effective, more self-aware, and more intentional in how you lead from your natural core.",
      },
    ],
    "The Raison d'être Dimension": [
      {
        type: "p",
        text:
          "Raison d’être is the motivational foundation of the framework. It reflects the deeper passions, drivers, and direction that shape how you find fulfillment in leadership.",
      },
    ],
    "Final Thoughts: The 5D Leader — Leading in Your Core, Living With Purpose": [
      {
        type: "p",
        text:
          "Sustainable leadership grows when behavioural strengths, profile awareness, and purpose all align. This is what makes leadership practical, powerful, and authentic.",
      },
    ],
  };

  return titles.map((title, index) => ({
    id: `index-section-${index}-${sectionTitleToId(title)}`,
    title,
    blocks: blocksByTitle[title] || [],
  }));
}

function buildSections(data: ResultData, ctx: RenderContext): RenderableSection[] {
  const common = Array.isArray(data.sections?.common) ? data.sections?.common || [] : [];
  const profile = Array.isArray(data.sections?.profile) ? data.sections?.profile || [] : [];
  const source = [...common, ...profile].filter((section) => {
    const title = safeText(section?.title).trim();
    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    return title || blocks.length > 0;
  });

  if (!source.length) return buildFallbackSections(ctx);

  return source.map((section, index) => ({
    id: `index-section-${index}-${sectionTitleToId(safeText(section.title) || `section-${index + 1}`)}`,
    title: safeText(section.title).trim() || `Section ${index + 1}`,
    blocks: Array.isArray(section.blocks) ? section.blocks : [],
  }));
}

function alignClass(align?: "left" | "center" | "right") {
  if (align === "left") return "mr-auto";
  if (align === "right") return "ml-auto";
  return "mx-auto";
}

function renderListItem(item: unknown, ctx: RenderContext) {
  if (typeof item === "string" || typeof item === "number") return replaceMacros(item, ctx);
  if (typeof item === "object" && item !== null) {
    const candidate = item as Record<string, unknown>;
    if (candidate.text) return replaceMacros(candidate.text, ctx);
    if (candidate.title && candidate.description) {
      return `${replaceMacros(candidate.title, ctx)} — ${replaceMacros(candidate.description, ctx)}`;
    }
    if (candidate.title) return replaceMacros(candidate.title, ctx);
    if (candidate.content) return replaceMacros(candidate.content, ctx);
  }
  return safeText(item);
}

function BlockRenderer({ block, ctx }: { block: SectionBlock; ctx: RenderContext }) {
  const type = safeText(block.type).toLowerCase();

  if (type === "p" || type === "paragraph") {
    const text = replaceMacros((block as any).text ?? (block as any).content, ctx);
    if (!text) return null;
    return <p className="mb-4 text-[13px] leading-7 text-[#313C52] last:mb-0">{text}</p>;
  }

  if (type === "h1" || type === "h2" || type === "heading") {
    const text = replaceMacros((block as any).text ?? (block as any).content, ctx);
    if (!text) return null;
    return <h3 className="mb-4 mt-6 text-[24px] font-black leading-tight text-[#0C203A] first:mt-0">{text}</h3>;
  }

  if (type === "h3") {
    const text = replaceMacros((block as any).text ?? (block as any).content, ctx);
    if (!text) return null;
    return <h4 className="mb-3 mt-5 text-[18px] font-black leading-tight text-[#0C203A] first:mt-0">{text}</h4>;
  }

  if (type === "h4") {
    const text = replaceMacros((block as any).text ?? (block as any).content, ctx);
    if (!text) return null;
    return (
      <h5 className="mb-2 mt-4 text-[14px] font-black uppercase tracking-[0.08em] text-[#5B4380] first:mt-0">
        {text}
      </h5>
    );
  }

  if (type === "ul" || type === "list" || type === "bullet_list") {
    const items: unknown[] = Array.isArray((block as any).items) ? ((block as any).items as unknown[]) : [];
    if (!items.length) return null;

    return (
      <ul className="mb-5 ml-5 list-disc space-y-2 text-[13px] leading-6 text-[#313C52]">
        {items.map((item: unknown, idx: number) => (
          <li key={idx}>{renderListItem(item, ctx)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol" || type === "numbered_list") {
    const items: unknown[] = Array.isArray((block as any).items) ? ((block as any).items as unknown[]) : [];
    if (!items.length) return null;

    return (
      <ol className="mb-5 ml-5 list-decimal space-y-2 text-[13px] leading-6 text-[#313C52]">
        {items.map((item: unknown, idx: number) => (
          <li key={idx}>{renderListItem(item, ctx)}</li>
        ))}
      </ol>
    );
  }

  if (type === "quote") {
    const text = replaceMacros((block as any).text, ctx);
    const cite = replaceMacros((block as any).cite, ctx);

    if (!text) return null;

    return (
      <blockquote className="my-6 rounded-2xl border-l-4 border-[#5B4380] bg-[#F5F0FA] p-5 text-[14px] italic leading-7 text-[#313C52]">
        “{text}”
        {cite ? <footer className="mt-3 text-[12px] font-bold not-italic text-[#5B4380]">— {cite}</footer> : null}
      </blockquote>
    );
  }

  if (type === "divider") {
    return <hr className="my-7 border-slate-200" />;
  }

  if (type === "image") {
    const src = safeText((block as any).src);
    if (!src) return null;

    return (
      <figure className={`my-6 max-w-full ${alignClass((block as any).align)}`}>
        <img
          src={src}
          alt={safeText((block as any).alt) || ""}
          crossOrigin="anonymous"
          className={`h-auto max-w-full rounded-2xl object-contain ${alignClass((block as any).align)}`}
          style={{ maxHeight: (block as any).max_h ? `${(block as any).max_h}px` : undefined }}
        />
        {(block as any).caption ? (
          <figcaption className="mt-2 text-center text-[11px] text-slate-500">
            {replaceMacros((block as any).caption, ctx)}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "html") {
    const html = replaceMacros((block as any).html, ctx);
    if (!html) return null;

    return (
      <div
        className="report-html mb-5 text-[13px] leading-7 text-[#313C52]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (type === "callout") {
    const title = replaceMacros((block as any).title, ctx);
    const text = replaceMacros((block as any).text ?? (block as any).content, ctx);

    if (!title && !text) return null;

    return (
      <div className="my-5 rounded-2xl border border-[#D8DDEC] bg-[#F7F9FC] p-5">
        {title ? <p className="text-[14px] font-black text-[#0C203A]">{title}</p> : null}
        {text ? <p className="mt-2 text-[13px] leading-6 text-[#313C52]">{text}</p> : null}
      </div>
    );
  }

  const fallbackTitle = replaceMacros((block as any).title, ctx);
  const fallbackText = replaceMacros((block as any).text ?? (block as any).content ?? (block as any).description, ctx);
  const fallbackItems: unknown[] = Array.isArray((block as any).items)
    ? ((block as any).items as unknown[])
    : [];

  if (fallbackTitle || fallbackText || fallbackItems.length) {
    return (
      <div className="my-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        {fallbackTitle ? <p className="text-[14px] font-black text-[#0C203A]">{fallbackTitle}</p> : null}
        {fallbackText ? <p className="mt-2 text-[13px] leading-6 text-[#313C52]">{fallbackText}</p> : null}
        {fallbackItems.length ? (
          <ul className="mt-3 ml-5 list-disc space-y-2 text-[13px] leading-6 text-[#313C52]">
            {fallbackItems.map((item: unknown, idx: number) => (
              <li key={idx}>{renderListItem(item, ctx)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return null;
}

function FiveDimensionsVisual() {
  return (
    <div className="mt-2">
      <div className="mb-8 flex justify-center">
        <img
          src={ASSETS.fiveDimensionsCompass}
          alt="The Five Dimensions of Leadership"
          className="h-auto max-h-[360px] w-auto max-w-full object-contain"
          crossOrigin="anonymous"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {FREQUENCY_ORDER.map((code) => {
          const meta = FREQUENCY_META[code];
          return (
            <div
              key={code}
              className="rounded-[16px] border bg-[#F8F8F8] p-5"
              style={{ borderColor: `${meta.cardColor}AA` }}
            >
              <p className="text-[14px] font-black text-[#18304D]">
                {code} · {meta.dimension} Dimension
              </p>
              <p
                className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: meta.cardColor }}
              >
                {meta.subtitle}
              </p>
              <p className="mt-4 text-[13px] leading-7 text-[#313C52]">{meta.description}</p>
            </div>
          );
        })}

        <div className="rounded-[16px] border border-[#8F61D1] bg-[#F4EFFB] p-5 md:col-span-2">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#54457F]">
            E. The Fifth Dimension · The Differentiator
          </p>
          <p className="mt-3 text-[20px] font-black text-[#102640]">Raison d&apos;être</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#54457F]">
            The Motivational Foundation
          </p>
          <p className="mt-4 text-[13px] leading-7 text-[#313C52]">
            The underlying passions, drivers and direction that defines how leaders find fulfillment in their work and
            life.
          </p>
        </div>
      </div>
    </div>
  );
}

function EightProfilesVisual({ data }: { data: ResultData }) {
  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {PROFILE_ORDER.map((code) => {
        const meta = PROFILE_META[code];
        const active = code === topCode;

        return (
          <div
            key={code}
            className={`rounded-2xl border p-5 ${
              active ? "border-[#5B4380] bg-[#F5F0FA]" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: meta.color }} />
              <div>
                <p className="text-[15px] font-black text-[#0C203A]">{meta.name}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {meta.dimension}
                </p>
                <p className="mt-3 text-[13px] leading-6 text-[#313C52]">{meta.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultsVisual({ data, raisonScore }: { data: ResultData; raisonScore: number }) {
  const topCode = normalizeProfileCode(data.top_profile_code);
  const topName = cleanProfileName(data.top_profile_name, topCode);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="rounded-[18px] bg-[#0C203A] p-6 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">Your Profile</p>
        <h3 className="mt-4 text-[30px] font-black leading-tight">{topName}</h3>
        <p className="mt-1 text-sm font-semibold text-white/70">{topCode}</p>

        <div className="mt-6 rounded-[14px] bg-[#624585] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Raison d’être</p>
          <p className="mt-3 text-[48px] font-black">{raisonScore}%</p>
        </div>
      </div>

      <WhitePanel className="p-6">
        {PROFILE_ORDER.map((code) => {
          const meta = PROFILE_META[code];
          const value = readProfileRatio(data, code);

          return (
            <div key={code} className="mb-4 last:mb-0">
              <div className="flex justify-between text-[13px]">
                <span className="font-black text-[#313C52]">
                  {code} · {meta.shortName}
                </span>
                <span className="font-black text-[#313C52]">{pctLabelFromRatio(value)}</span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    width: percentWidth(value),
                    background: meta.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </WhitePanel>
    </div>
  );
}

function SignatureBlock() {
  return (
    <div className="mt-8 flex items-center gap-4">
      <div className="flex h-[63px] w-[63px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl">
        <ImageWithFallback
          src={ASSETS.brett}
          alt="Brett Gordon"
          className="flex h-[63px] w-[63px] items-center justify-center rounded-full object-cover"
          fallback={<span className="flex h-[63px] w-[63px] items-center justify-center">BG</span>}
        />
      </div>
      <div className="text-[13px] leading-6 text-[#313C52]">
        <p>Warm regards</p>
        <p className="font-bold">Brett Gordon</p>
        <p>Founder, Businesses Are People Too</p>
        <p>Creator of The 5D Leadership Compass</p>
      </div>
    </div>
  );
}

function ContentSection({
  section,
  ctx,
}: {
  section: RenderableSection;
  ctx: RenderContext;
}) {
  const title = section.title.toLowerCase();
  const showFiveDimensions = title.includes("five dimensions");
  const showProfiles = title.includes("eight leadership profiles");
  const showResults = title.includes("leadership results") || title.includes("your results");
  const showSignature = title.includes("welcome");

  return (
    <SectionShell id={section.id} title={section.title}>
      <WhitePanel className="p-7">
        {section.blocks.length ? (
          <div>
            {section.blocks.map((block, idx) => (
              <BlockRenderer key={idx} block={block} ctx={ctx} />
            ))}
          </div>
        ) : null}

        {showFiveDimensions ? <FiveDimensionsVisual /> : null}
        {showProfiles ? <EightProfilesVisual data={ctx.data} /> : null}
        {showResults ? <ResultsVisual data={ctx.data} raisonScore={ctx.raisonScore} /> : null}
        {showSignature ? <SignatureBlock /> : null}
      </WhitePanel>
    </SectionShell>
  );
}

function NextStepsPanel({
  participant,
  onDownload,
  onNext,
}: {
  participant: string;
  onDownload: () => void;
  onNext: () => void;
}) {
  return (
    <SectionShell id="next-steps-section" title="Your Next Steps">
      <WhitePanel className="p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={onDownload}
            className="rounded-xl bg-[#0C203A] px-4 py-4 text-sm font-black text-white shadow-sm"
          >
            Download PDF
          </button>
          <button
            onClick={onNext}
            className="rounded-xl bg-gradient-to-r from-[#24D6DC] via-[#2D8CFF] to-[#7857F6] px-4 py-4 text-sm font-black text-[#071C36] shadow-sm"
          >
            Next step
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          The 5D Leadership Compass · Personalised report for {participant}
        </p>
      </WhitePanel>
    </SectionShell>
  );
}

export default function FiveDLeadershipReportClient(props: {
  token: string;
  tid: string;
  src?: string;
  data: ResultData;
}) {
  const { data } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);

  const reportDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const raisonScore = percentFromScore(data);
  const topFreq = normalizeFrequency(data.top_freq);
  const topCode = normalizeProfileCode(data.top_profile_code);
  const topName = cleanProfileName(data.top_profile_name, topCode);

  const ctx: RenderContext = {
    data,
    participant,
    topFreq,
    topCode,
    topName,
    raisonScore,
  };

  const sections = useMemo(() => buildSections(data, ctx), [data, participant, topFreq, topCode, topName, raisonScore]);

  async function handleDownloadPdf() {
    if (!reportRef.current) return;

    const element = reportRef.current;
    const prevScroll = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#061A3A",
        scrollY: -window.scrollY,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`5d-leadership-compass-${participant.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } finally {
      window.scrollTo(0, prevScroll);
    }
  }

  function openNextSteps() {
    if (data.link?.next_steps_url) {
      window.open(data.link.next_steps_url, "_blank", "noopener,noreferrer");
      return;
    }

    document.getElementById("next-steps-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="min-h-screen py-5 text-white" style={{ fontFamily: DESIGN_FONT, background: PAGE_BG }}>
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <div ref={reportRef} className="relative mx-auto flex max-w-[1440px] flex-col gap-5 px-4">
        <TopHeader
          participant={participant}
          reportDate={reportDate}
          onDownload={handleDownloadPdf}
          onNext={openNextSteps}
        />

        <HeroHeader data={data} participant={participant} raisonScore={raisonScore} />

        <OverviewDashboard data={data} />

        <section className="grid gap-5 lg:grid-cols-[190px_1fr]">
          <ReportIndex sections={sections} onDownload={handleDownloadPdf} onNext={openNextSteps} />

          <main className="flex flex-col gap-5">
            {sections.map((section) => (
              <ContentSection key={section.id} section={section} ctx={ctx} />
            ))}

            <NextStepsPanel participant={participant} onDownload={handleDownloadPdf} onNext={openNextSteps} />
          </main>
        </section>

        <footer className="pb-8 text-center text-xs text-white/60">
          The 5D Leadership Compass · Businesses Are People Too · Powered by Profiletest.ai
        </footer>
      </div>
    </div>
  );
}