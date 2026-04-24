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
  raw_score: number;
  percentage: number;
  eligible_count?: number;
  answered_count?: number;
};

type SectionBlock =
  | { type: "p"; text?: string }
  | { type: "ul"; items?: string[] }
  | { type: "ol"; items?: string[] }
  | { type: "quote"; text?: string; cite?: string }
  | { type: "divider" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | {
      type: "image";
      src?: string;
      alt?: string;
      caption?: string;
      align?: "left" | "center" | "right";
      max_h?: number;
    }
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

const ASSET_BASE = "/images/5d-leadership-compass";

const ASSETS = {
  logo: `${ASSET_BASE}/5d-logo.png`,
  brett: `${ASSET_BASE}/brett-gordon.png`,
  iconWelcome: `${ASSET_BASE}/icon-welcome.png`,
  iconCompass: `${ASSET_BASE}/icon-compass.png`,
  iconProfiles: `${ASSET_BASE}/icon-profiles.png`,
  iconResults: `${ASSET_BASE}/icon-results.png`,
};

const PROFILE_ICONS: Record<string, string> = {
  P1: `${ASSET_BASE}/profile-icons/p1-disruptor.png`,
  P2: `${ASSET_BASE}/profile-icons/p2-advocator.png`,
  P3: `${ASSET_BASE}/profile-icons/p3-mediator.png`,
  P4: `${ASSET_BASE}/profile-icons/p4-connector.png`,
  P5: `${ASSET_BASE}/profile-icons/p5-planner.png`,
  P6: `${ASSET_BASE}/profile-icons/p6-forecaster.png`,
  P7: `${ASSET_BASE}/profile-icons/p7-analyzer.png`,
  P8: `${ASSET_BASE}/profile-icons/p8-optimizer.png`,
};

const BG = "linear-gradient(180deg, rgba(27, 60, 99, 0.78) 0%, rgba(12, 32, 58, 0.84) 100%)";

const FREQUENCY_META: Record<
  AB,
  { label: string; shortLabel: string; color: string; subtitle: string; description: string }
> = {
  A: {
    label: "Catalyst Dimension",
    shortLabel: "Catalyst",
    color: "#3AAB7A",
    subtitle: "Rapid Response & Innovation",
    description: "Action-oriented leaders who drive change and thrive in fast-moving environments.",
  },
  B: {
    label: "Communicator Dimension",
    shortLabel: "Communicator",
    color: "#B84040",
    subtitle: "Influence & Relationship-Driven Leadership",
    description: "People-focused leaders who build strong teams and partnerships.",
  },
  C: {
    label: "Strategist Dimension",
    shortLabel: "Strategist",
    color: "#C48A20",
    subtitle: "Customer Service & Mission-Driven",
    description: "Structured leaders who ensure operational efficiency and reliability.",
  },
  D: {
    label: "Stabilizer Dimension",
    shortLabel: "Stabilizer",
    color: "#4070B8",
    subtitle: "Target Focused & Systems Thinking",
    description: "Analytical leaders who focus on longer-term analysis, optimization and future-proofing.",
  },
};

const PROFILES = [
  {
    code: "P1",
    name: "The Disruptor",
    short: "Disruptor",
    dimension: "Catalyst Dimension",
    color: "#457E58",
    icon: "⚡",
    description:
      "Visionary innovators who push boundaries and create industry-shifting change. Hard chargers that see the light at the end of the tunnel well before most others.",
  },
  {
    code: "P2",
    name: "The Advocator",
    short: "Advocator",
    dimension: "Catalyst–Communicator Dimension",
    color: "#457E58",
    icon: "📣",
    description: "High-energy leaders who thrive on engagement, motivation, and generating broad interest and buy-in.",
  },
  {
    code: "P3",
    name: "The Mediator",
    short: "Mediator",
    dimension: "Communicator Dimension",
    color: "#954444",
    icon: "🤝",
    description: "Empathetic leaders who excel in team alignment, conflict resolution, and relationship-building.",
  },
  {
    code: "P4",
    name: "The Connector",
    short: "Connector",
    dimension: "Communicator–Strategist Dimension",
    color: "#954444",
    icon: "🔗",
    description: "Strategic networkers who leverage partnerships to drive business success.",
  },
  {
    code: "P5",
    name: "The Planner",
    short: "Planner",
    dimension: "Strategist Dimension",
    color: "#CE8B0A",
    icon: "🗂",
    description: "Customer, market and mission-oriented leaders focused on service-driven planning and reliable logistics performance.",
  },
  {
    code: "P6",
    name: "The Forecaster",
    short: "Forecaster",
    dimension: "Strategist–Stabilizer Dimension",
    color: "#CE8B0A",
    icon: "🔭",
    description: "Risk-averse, detail-oriented leaders with foresight to anticipate upcoming opportunities and challenges.",
  },
  {
    code: "P7",
    name: "The Analyzer",
    short: "Analyzer",
    dimension: "Stabilizer Dimension",
    color: "#B0C3CB",
    icon: "📊",
    description: "Systems-oriented thinkers who leverage data-driven approaches to develop long-term business frameworks.",
  },
  {
    code: "P8",
    name: "The Optimizer",
    short: "Optimizer",
    dimension: "Stabilizer–Disruptor Dimension",
    color: "#B0C3CB",
    icon: "⚙",
    description: "Precision-driven leaders who refine processes, integrate technology, implement automation, and make things better.",
  },
];

const DEFAULT_INDEX = [
  "Welcome to the 5D Leadership Compass",
  "Introduction to the 5D Leadership Compass",
  "The Five Dimensions of Leadership",
  "The Eight Leadership Profiles",
  "Your Leadership Results",
  "How to Use This Framework",
  "Introduction to Your Profile",
  "Core Characteristics",
  "How You Lead",
  "Success Factors",
  "Ideal Roles",
  "Roles That May Be Challenging",
  "Development Pathway",
  "Case Studies & Industry Examples",
  "The Raison d’être Dimension",
  "Final Thoughts",
];

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

function fullName(first?: string | null, last?: string | null) {
  const out = `${first || ""} ${last || ""}`.trim();
  return out || "Full Name";
}

function normalizeProfileCode(input: any): string {
  const s = String(input || "").trim().toUpperCase();
  const m = s.match(/^P(?:ROFILE)?[_\s-]?([1-8])$/i);
  if (m) return `P${m[1]}`;
  return s;
}

function legacyProfileCode(input: any): string {
  const p = normalizeProfileCode(input);
  const m = p.match(/^P([1-8])$/i);
  return m ? `PROFILE_${m[1]}` : p;
}

function readProfilePercent(data: ResultData, code: string) {
  const normalized = normalizeProfileCode(code);
  const legacy = legacyProfileCode(code);

  const direct = data.profile_percentages?.[normalized];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;

  const legacyVal = data.profile_percentages?.[legacy];
  if (typeof legacyVal === "number" && Number.isFinite(legacyVal)) return legacyVal;

  return 0;
}

function percentWhole(decimalValue?: number) {
  const n = Number(decimalValue || 0);
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

function percentFromScore(data: ResultData) {
  const nested = Number(data.raison_detre?.percentage ?? NaN);
  if (Number.isFinite(nested)) return Math.max(0, Math.min(100, Math.round(nested)));

  const flat = Number(data.raison_detre_percentage ?? NaN);
  if (Number.isFinite(flat)) return Math.max(0, Math.min(100, Math.round(flat)));

  return 0;
}

function normaliseId(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\-]+/g, "-")
    .replace(/\-+/g, "-");
}

function getSectionDomId(section: ReportSection, idx: number) {
  const raw = safeText(section.id).trim();
  if (raw) return raw;
  const title = safeText(section.title).trim();
  if (title) return normaliseId(title);
  return `section-${idx + 1}`;
}

function profileMeta(code: string) {
  const c = normalizeProfileCode(code);
  return PROFILES.find((p) => p.code === c) || PROFILES[0];
}

function cleanProfileName(name: string, code: string) {
  const cleaned = safeText(name)
    .replace(/^P[1-8]:\s*/i, "")
    .replace(/\s*\(P[1-8]\)\s*$/i, "")
    .trim();

  return cleaned || profileMeta(code).short;
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

function SectionShell({
  id,
  title,
  iconSrc,
  fallbackIcon,
  children,
}: {
  id?: string;
  title: string;
  iconSrc?: string;
  fallbackIcon: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-[24px] border border-white/10 p-[18px] shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
      style={{ background: BG }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-blue-400/20 bg-blue-400/10 text-lg">
          {iconSrc ? (
            <ImageWithFallback
              src={iconSrc}
              alt=""
              className="flex h-10 w-10 items-center justify-center rounded-[10px] object-cover"
              fallback={<span className="flex h-10 w-10 items-center justify-center">{fallbackIcon}</span>}
            />
          ) : (
            fallbackIcon
          )}
        </div>
        <h2 className="text-[15px] font-semibold leading-[22.5px] text-white">{title}</h2>
      </div>

      {children}
    </section>
  );
}

function WhitePanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[18px] bg-white text-[#313C52] ${className}`}>{children}</div>;
}

function BlockRenderer({ block }: { block: SectionBlock }) {
  const type = safeText((block as any)?.type).toLowerCase();

  if (type === "divider") return <hr className="my-4 border-slate-200" />;

  if (type === "image") {
    const src = safeText((block as any).src).trim();
    if (!src) return null;

    return (
      <figure className="my-4">
        <img
          src={src}
          alt={safeText((block as any).alt)}
          crossOrigin="anonymous"
          className="mx-auto h-auto max-w-full rounded-xl border border-slate-200 bg-white"
          style={{ maxHeight: Number((block as any).max_h || 360) }}
        />
        {(block as any).caption ? (
          <figcaption className="mt-2 text-center text-[10px] text-slate-500">
            {safeText((block as any).caption)}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "h1") return <h1 className="text-2xl font-black text-[#06233f]">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-black text-[#06233f]">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-black text-[#06233f]">{safeText((block as any).text)}</h3>;
  if (type === "h4") return <h4 className="text-xs font-black uppercase tracking-[0.16em] text-[#0b4f6c]">{safeText((block as any).text)}</h4>;

  if (type === "ul") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ul className="list-disc space-y-1 pl-5 text-[13px] leading-7 text-[#313C52]">
        {items.map((item: any, idx: number) => (
          <li key={idx}>{safeText(item)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-7 text-[#313C52]">
        {items.map((item: any, idx: number) => (
          <li key={idx}>{safeText(item)}</li>
        ))}
      </ol>
    );
  }

  if (type === "quote") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[13px] italic leading-7 text-[#313C52]">“{safeText((block as any).text)}”</p>
        {(block as any).cite ? <p className="mt-2 text-[11px] font-semibold text-slate-500">— {safeText((block as any).cite)}</p> : null}
      </div>
    );
  }

  return <p className="whitespace-pre-line text-[13px] leading-7 text-[#313C52]">{safeText((block as any).text)}</p>;
}

function TopHeader({
  data,
  participant,
  reportDate,
  onDownload,
  onNext,
}: {
  data: ResultData;
  participant: string;
  reportDate: string;
  onDownload: () => void;
  onNext: () => void;
}) {
  return (
    <section className="rounded-[18px] border border-white/10 px-5 py-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]" style={{ background: BG }}>
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[9px] border border-white/10 bg-white/10" />
          <div>
            <p className="text-[24px] font-black uppercase tracking-[0.24em] text-white">Personalised Report</p>
            <p className="mt-1 inline-flex rounded-full bg-white/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/70">
              Powered by Profiletest.ai
            </p>
          </div>
        </div>

        <div className="hidden gap-2 md:flex">
          <button onClick={onDownload} className="rounded-lg bg-black/35 px-4 py-2 text-[10px] font-black text-white">
            Download PDF
          </button>
          <button onClick={onNext} className="rounded-lg bg-[#7c5cff] px-4 py-2 text-[10px] font-black text-white">
            Next steps
          </button>
        </div>

        <InfoPill label="Prepared for" value={participant} />
        <InfoPill label="Date" value={reportDate} />
        <InfoPill label="Framework" value="The 5D Leadership Compass" />
      </div>
    </section>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[9px] text-white/55">{label}</p>
      <p className="mt-1 text-[13px] font-black text-white">{value}</p>
    </div>
  );
}

function HeroSummary({
  data,
  participant,
  raisonScore,
}: {
  data: ResultData;
  participant: string;
  raisonScore: number;
}) {
  const topCode = normalizeProfileCode(data.top_profile_code);
  const top = profileMeta(topCode);
  const topName = cleanProfileName(data.top_profile_name, topCode);
  const topFreq = FREQUENCY_META[data.top_freq];

  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_205px]">
      <div className="rounded-[18px] border border-white/10 p-5 shadow-[0_14px_42px_rgba(0,0,0,0.32)]" style={{ background: BG }}>
        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45">The 5D Leadership Compass</p>
            <h1 className="mt-3 text-4xl font-black leading-none text-white">{participant}</h1>
            <p className="mt-5 max-w-[660px] text-[13px] leading-6 text-white">
              “Navigating Leadership Strengths in Logistics, Supply Chain, and Operations” —
              <br />
              Visionary innovators who push boundaries and create industry-shifting change.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-2 text-[11px] font-black text-[#0C203A]">
                {topCode} · {topName}
              </span>
              <span className="rounded-full bg-[#1da86b] px-3 py-2 text-[11px] font-black text-white">
                {data.top_freq} · {topFreq?.shortLabel || data.top_freq}
              </span>
            </div>

            <div className="mt-5 grid max-w-[520px] grid-cols-2 rounded-xl border border-white/10 bg-white/5">
              <div className="border-r border-white/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Dimension</p>
                <p className="mt-1 text-xl font-black text-white">{topFreq?.shortLabel || data.top_freq}</p>
                <p className="text-[11px] text-white/55">{topFreq?.subtitle}</p>
              </div>
              <div className="p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Leadership Style</p>
                <p className="mt-1 text-xl font-black text-white">{top.short}</p>
                <p className="text-[11px] text-white/55">{top.description.slice(0, 36)}...</p>
              </div>
            </div>
          </div>

          <VerticalProfileList data={data} />
        </div>
      </div>

      <div className="rounded-[18px] bg-[#4f3f78] p-6 text-center text-white shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
        <p className="mx-auto inline-flex rounded-full border border-white/50 px-4 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
          The 5th Dimension
        </p>
        <p className="mt-8 text-6xl font-black">{raisonScore}%</p>
        <p className="mt-5 text-xl font-black uppercase tracking-[0.13em]">
          Your Raison
          <br />
          d&apos;être Score
        </p>
        <p className="mx-auto mt-8 max-w-[180px] text-[12px] leading-6 text-white/85">
          The underlying passions, drivers and direction that defines how leaders find fulfillment in their work and life.
        </p>
      </div>
    </section>
  );
}

function VerticalProfileList({ data }: { data: ResultData }) {
  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <div className="rounded-[18px] border border-white/10 bg-black/10 p-3">
      <div className="space-y-2">
        {PROFILES.map((p, idx) => {
          const active = p.code === topCode;
          return (
            <div
              key={p.code}
              className={`grid grid-cols-[26px_1fr_auto] items-center gap-2 rounded-lg border px-3 py-2 text-[10px] ${
                active ? "border-[#20c46b] bg-[#0d7847]/30 text-[#30e57f]" : "border-white/10 bg-white/5 text-white/70"
              }`}
            >
              <span className="text-white/35">{idx + 1}</span>
              <span className="font-black">{p.name}</span>
              <span className="text-[9px] text-white/40">{p.dimension.replace(" Dimension", "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveDimensionChart({ data }: { data: ResultData }) {
  const rows = (["A", "B", "C", "D"] as AB[]).map((code) => ({
    code,
    pct: percentWhole(data.frequency_percentages?.[code]),
    meta: FREQUENCY_META[code],
  }));

  return (
    <div className="rounded-[18px] p-4 text-white" style={{ background: BG }}>
      <h2 className="text-[14px] font-black">Dimensions</h2>
      <p className="mt-2 max-w-sm text-[12px] leading-5 text-white/85">
        The four Drivers show the behavioural energy you use most often. Higher scores are patterns you access more naturally.
      </p>

      <WhitePanel className="mt-4 p-5">
        <svg viewBox="0 0 520 300" className="h-auto w-full">
          {[0, 20, 40, 60, 80, 100].map((v) => {
            const y = 245 - (v / 100) * 210;
            return (
              <g key={v}>
                <line x1="55" x2="500" y1={y} y2={y} stroke="#E5EAF1" strokeWidth="1" />
                <text x="25" y={y + 4} fontSize="10" fill="#8FA0B8">
                  {v}
                </text>
              </g>
            );
          })}

          {rows.map((r, i) => {
            const x = 80 + i * 105;
            const h = (r.pct / 100) * 210;
            const y = 245 - h;
            return (
              <g key={r.code}>
                <rect x={x} y="35" width="72" height="210" rx="8" fill="#F8FAFC" stroke="#D9E1EC" />
                <rect x={x} y={y} width="72" height={h} rx="6" fill={r.meta.color} />
                <text x={x + 36} y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
                  {r.pct}
                </text>
                <text x={x + 36} y="270" textAnchor="middle" fontSize="12" fontWeight="800" fill="#111827">
                  {r.code}
                </text>
                <text x={x + 36} y="288" textAnchor="middle" fontSize="9" fill="#64748B">
                  {r.meta.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </WhitePanel>
    </div>
  );
}

function LiveRadarChart({ data }: { data: ResultData }) {
  const center = { x: 250, y: 155 };
  const maxR = 105;
  const labels = PROFILES.map((p) => p.code);
  const points = labels.map((code, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
    const pct = percentWhole(readProfilePercent(data, code));
    const r = (pct / 60) * maxR;
    return {
      code,
      pct,
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
      lx: center.x + Math.cos(angle) * (maxR + 26),
      ly: center.y + Math.sin(angle) * (maxR + 26),
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-[18px] p-4 text-white" style={{ background: BG }}>
      <h2 className="text-[14px] font-black">Your Personality Map (Profile)</h2>
      <p className="mt-2 max-w-md text-[12px] leading-5 text-white/85">
        This map shows your overall pattern across Profiles. It helps you see what you naturally lean on and what may require support.
      </p>

      <WhitePanel className="mt-4 p-5">
        <svg viewBox="0 0 500 310" className="h-auto w-full">
          {[0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
            const ring = labels
              .map((_, i) => {
                const angle = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
                const x = center.x + Math.cos(angle) * maxR * scale;
                const y = center.y + Math.sin(angle) * maxR * scale;
                return `${x},${y}`;
              })
              .join(" ");
            return <polygon key={scale} points={ring} fill="none" stroke="#E5EAF1" strokeWidth="1" />;
          })}

          {labels.map((_, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
            return (
              <line
                key={i}
                x1={center.x}
                y1={center.y}
                x2={center.x + Math.cos(angle) * maxR}
                y2={center.y + Math.sin(angle) * maxR}
                stroke="#E5EAF1"
              />
            );
          })}

          <polygon points={polygon} fill="rgba(45, 190, 180, 0.22)" stroke="#2DBEB4" strokeWidth="3" />

          {points.map((p) => (
            <g key={p.code}>
              <circle cx={p.x} cy={p.y} r="4" fill="#2DBEB4" />
              <text x={p.lx} y={p.ly} textAnchor="middle" fontSize="12" fontWeight="800" fill="#111827">
                {p.code}
              </text>
              <text x={p.x + 7} y={p.y - 5} fontSize="9" fill="#64748B">
                {p.pct}%
              </text>
            </g>
          ))}
        </svg>
      </WhitePanel>
    </div>
  );
}

function GraphPanelGrid({ data }: { data: ResultData }) {
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <LiveDimensionChart data={data} />
      <LiveRadarChart data={data} />
    </section>
  );
}

function ReportIndex({ items }: { items: string[] }) {
  return (
    <aside className="sticky top-4 self-start rounded-[18px] bg-[#0C203A] p-5 text-white shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35">Report Index</p>
      <div className="mt-4 space-y-2">
        {items.map((item, idx) => (
          <button
            key={`${item}-${idx}`}
            onClick={() => {
              const id = `index-section-${idx}`;
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="block w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-left text-[12px] leading-snug text-white/85 hover:bg-white/10"
          >
            <span className="font-black text-white">{idx + 1}.</span> {item}
          </button>
        ))}
      </div>
    </aside>
  );
}

function WelcomeSection({ participant }: { participant: string }) {
  return (
    <SectionShell id="index-section-0" title="Welcome to the 5D Leadership Compass" iconSrc={ASSETS.iconWelcome} fallbackIcon="✉">
      <WhitePanel className="p-7">
        <div className="text-[13px] leading-7 text-[#313C52]">
          <p>Dear {participant},</p>
          <p className="mt-3">
            Welcome to the 5D Leadership Compass, a framework designed to help you unlock your leadership potential by understanding your natural strengths, decision-making style, and how you best contribute to your team, industry, and life.
          </p>
          <p className="mt-3">
            In today&apos;s complex world of logistics, supply chain, and operations, leadership success goes beyond experience or technical skill. It is about knowing how you lead, collaborate, and make an impact.
          </p>
          <p className="mt-3">
            This guide will introduce the <strong>Five Dimensions of Leadership</strong> and the <strong>Eight Leadership Profiles</strong>, giving you deeper insight into your leadership style and how to thrive in any environment.
          </p>
          <p className="mt-3">
            Explore your profile with an open mind. The more you understand how you lead, the more impactful you will become.
          </p>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex h-[63px] w-[63px] items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl">
              <ImageWithFallback
                src={ASSETS.brett}
                alt="Brett Gordon"
                className="flex h-[63px] w-[63px] items-center justify-center rounded-full object-cover"
                fallback={<span className="flex h-[63px] w-[63px] items-center justify-center">BG</span>}
              />
            </div>
            <div>
              <p>Warm regards</p>
              <p className="font-bold">Brett Gordon</p>
              <p>Founder, Businesses Are People Too</p>
              <p>Creator of The 5D Leadership Compass</p>
            </div>
          </div>
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function IntroSection() {
  return (
    <SectionShell id="index-section-1" title="Introduction to the 5D Leadership Compass" iconSrc={ASSETS.iconCompass} fallbackIcon="🧭">
      <WhitePanel className="p-7">
        <p className="text-[13px] leading-7 text-[#313C52]">
          The 5D Leadership Compass is a dynamic framework that categorizes leadership into five core dimensions, with four core dimensions representing a distinct approach to leadership and problem-solving. There is also the powerful fifth overarching dimension, your internal compass, reflecting your reason for being, your whys and meanings guiding your paths in leadership and life.
        </p>
      </WhitePanel>
    </SectionShell>
  );
}

function DimensionsSection({ data, raisonScore }: { data: ResultData; raisonScore: number }) {
  return (
    <SectionShell id="index-section-2" title="The Five Dimensions of Leadership" iconSrc={ASSETS.iconCompass} fallbackIcon="🧭">
      <WhitePanel className="p-7">
        <div className="mx-auto flex h-[330px] max-w-[640px] items-center justify-center rounded-full bg-slate-50">
          <div className="grid h-[260px] w-[260px] place-items-center rounded-full border-[22px] border-slate-200 bg-white text-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Your Compass</p>
              <p className="mt-3 text-5xl font-black text-[#0C203A]">{data.top_freq}</p>
              <p className="mt-1 text-sm font-black text-[#313C52]">{FREQUENCY_META[data.top_freq]?.label}</p>
              <p className="mt-4 text-2xl font-black text-[#63457E]">{raisonScore}%</p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Raison d’être</p>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {(["A", "B", "C", "D"] as AB[]).map((code) => {
            const m = FREQUENCY_META[code];
            const pct = percentWhole(data.frequency_percentages?.[code]);
            return (
              <div key={code} className="rounded-[14px] border bg-white p-5" style={{ borderColor: m.color, borderTopWidth: 3 }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: m.color }}>
                      {code} · {m.label}
                    </h3>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[1px]" style={{ color: m.color }}>
                      {m.subtitle}
                    </p>
                  </div>
                  <p className="text-xl font-black" style={{ color: m.color }}>
                    {pct}%
                  </p>
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                </div>
                <p className="mt-4 text-[13px] leading-[20.8px] text-[#313C52]">{m.description}</p>
              </div>
            );
          })}

          <div className="rounded-[14px] border bg-white p-6 md:col-span-2" style={{ borderColor: "#5A2A8A", borderTopWidth: 3 }}>
            <p className="text-[10px] font-semibold uppercase leading-4 tracking-[2.5px] text-[#313C52]">
              E. The Fifth Dimension · The Differentiator
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold leading-8 text-[#63457E]">Raison d&apos;être</h3>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#313C52]">
                  The Motivational Foundation
                </p>
              </div>
              <p className="text-5xl font-black text-[#63457E]">{raisonScore}%</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#313C52]">
              The underlying passions, drivers and direction that defines how leaders find fulfillment in their work and life.
            </p>
          </div>
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function ProfilesSection({ data }: { data: ResultData }) {
  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <SectionShell id="index-section-3" title="The Eight Leadership Profiles" iconSrc={ASSETS.iconProfiles} fallbackIcon="👥">
      <WhitePanel className="p-7">
        <div className="mx-auto flex h-[320px] max-w-[640px] items-center justify-center rounded-full bg-slate-50">
          <div className="grid h-[240px] w-[240px] place-items-center rounded-full border-[22px] border-slate-200 bg-white text-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Top Profile</p>
              <p className="mt-3 text-5xl font-black text-[#0C203A]">{topCode}</p>
              <p className="mt-1 text-sm font-black text-[#313C52]">{cleanProfileName(data.top_profile_name, topCode)}</p>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PROFILES.map((profile) => {
            const active = profile.code === topCode;
            return (
              <div key={profile.code} className={`relative rounded-[18px] ${active ? "ring-4 ring-[#63457E]" : ""}`}>
                <div className="h-[105px] rounded-t-[18px]" style={{ backgroundColor: profile.color }} />
                <div className="min-h-[227px] bg-white px-4 pb-5 pt-[70px] text-center shadow-md">
                  <div className="absolute left-1/2 top-[18px] flex h-[91px] w-[89px] -translate-x-1/2 items-center justify-center bg-[#FAF1EA] text-4xl shadow-md">
                    <ImageWithFallback
                      src={PROFILE_ICONS[profile.code]}
                      alt={profile.name}
                      className="flex h-[66px] w-[66px] items-center justify-center object-contain text-3xl"
                      fallback={<span className="flex h-[66px] w-[66px] items-center justify-center">{profile.icon}</span>}
                    />
                  </div>
                  <h3 className="text-xs font-semibold leading-[19.2px] text-[#111828]">{profile.name}</h3>
                  <p className="mt-2 text-[10px] uppercase leading-4 tracking-[1px] text-[#313C52]">{profile.dimension}</p>
                  <p className="mt-4 text-[11px] leading-[16.5px] text-[#313C52]">{profile.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function ResultsSection({ data, raisonScore }: { data: ResultData; raisonScore: number }) {
  const topCode = normalizeProfileCode(data.top_profile_code);
  const topName = cleanProfileName(data.top_profile_name, topCode);
  const top = profileMeta(topCode);

  return (
    <SectionShell id="index-section-4" title="Your Leadership Results" iconSrc={ASSETS.iconResults} fallbackIcon="📌">
      <WhitePanel className="p-7">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="rounded-[18px] bg-[#0C203A] p-6 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Your Profile</p>
            <h3 className="mt-4 text-3xl font-black">{topName}</h3>
            <p className="mt-1 text-sm font-semibold text-white/75">
              {topCode} · {top.dimension}
            </p>

            <div className="mt-7 rounded-[14px] bg-[#63457E] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">Raison d’être</p>
              <p className="mt-3 text-5xl font-black">{raisonScore}%</p>
            </div>
          </div>

          <div className="space-y-4">
            {PROFILES.map((p) => {
              const pct = percentWhole(readProfilePercent(data, p.code));
              const active = p.code === topCode;
              return (
                <div key={p.code}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-bold ${active ? "text-[#63457E]" : "text-[#313C52]"}`}>
                      {p.code} · {p.name}
                    </span>
                    <span className="font-black text-[#313C52]">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: active ? "#63457E" : "#0C203A" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function DynamicContentSection({ section, idx }: { section: ReportSection; idx: number }) {
  const id = `index-section-${idx + 5}`;
  const title = safeText(section.title) || `Report Section ${idx + 1}`;

  return (
    <SectionShell id={id} title={title} fallbackIcon="📖">
      <WhitePanel className="p-7">
        <div className="space-y-4">
          {(section.blocks || []).map((block, blockIdx) => (
            <BlockRenderer key={blockIdx} block={block} />
          ))}
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function NextSteps({
  participant,
  onDownload,
  nextUrl,
}: {
  participant: string;
  onDownload: () => void;
  nextUrl?: string | null;
}) {
  function openNext() {
    if (nextUrl) window.open(nextUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <SectionShell title="Your Next Steps" fallbackIcon="🚀">
      <WhitePanel className="p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black text-[#061d34]">Download Your Report</h3>
            <p className="mt-2 text-sm text-slate-600">Save a PDF copy of your 5D Leadership Compass report.</p>
            <button onClick={onDownload} className="mt-4 rounded-xl bg-[#061d34] px-4 py-2 text-sm font-black text-white">
              Download PDF
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black text-[#061d34]">Discuss with Your Advisor</h3>
            <p className="mt-2 text-sm text-slate-600">Translate your insights into practical next actions.</p>
            <button onClick={openNext} className="mt-4 rounded-xl bg-[#061d34] px-4 py-2 text-sm font-black text-white">
              Explore Now
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black text-[#061d34]">Visit Businesses Are People Too</h3>
            <p className="mt-2 text-sm text-slate-600">For more information and next steps, please visit businessesarepeopletoo.com.</p>
            <button onClick={openNext} className="mt-4 rounded-xl bg-[#061d34] px-4 py-2 text-sm font-black text-white">
              Visit Now
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          The 5D Leadership Compass · Businesses Are People Too © {new Date().getFullYear()} · Personalised report for {participant}
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

  const sections = useMemo(() => {
    const common = (data.sections?.common || []) as ReportSection[];
    const profile = (data.sections?.profile || []) as ReportSection[];
    const combined = [...common, ...profile].filter(Boolean);

    const seen = new Set<string>();
    return combined.filter((section, idx) => {
      const id = getSectionDomId(section, idx);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [data.sections]);

  const indexItems = useMemo(() => {
    const dynamic = sections.map((s) => safeText(s.title)).filter(Boolean);
    return dynamic.length ? DEFAULT_INDEX.slice(0, 5).concat(dynamic) : DEFAULT_INDEX;
  }, [sections]);

  function openNextSteps() {
    if (data.link?.next_steps_url) {
      window.open(data.link.next_steps_url, "_blank", "noopener,noreferrer");
      return;
    }

    document.getElementById("next-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDownloadPdf() {
    if (!reportRef.current) return;

    const element = reportRef.current;
    const prevScroll = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#061d34",
        scrollY: -window.scrollY,
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

  return (
    <div className="min-h-screen bg-[#061d34] py-5 text-white">
      <div ref={reportRef} className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4">
        <TopHeader data={data} participant={participant} reportDate={reportDate} onDownload={handleDownloadPdf} onNext={openNextSteps} />

        <HeroSummary data={data} participant={participant} raisonScore={raisonScore} />

        <GraphPanelGrid data={data} />

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <ReportIndex items={indexItems} />

          <main className="flex flex-col gap-5">
            <WelcomeSection participant={participant} />
            <IntroSection />
            <DimensionsSection data={data} raisonScore={raisonScore} />
            <ProfilesSection data={data} />
            <ResultsSection data={data} raisonScore={raisonScore} />

            {sections.map((section, idx) => (
              <DynamicContentSection key={getSectionDomId(section, idx)} section={section} idx={idx} />
            ))}

            <div id="next-steps">
              <NextSteps participant={participant} onDownload={handleDownloadPdf} nextUrl={data.link?.next_steps_url} />
            </div>

            <footer className="pb-8 text-center text-xs text-white/60">
              The 5D Leadership Compass · Businesses Are People Too · Powered by Profiletest.ai
            </footer>
          </main>
        </section>
      </div>
    </div>
  );
}