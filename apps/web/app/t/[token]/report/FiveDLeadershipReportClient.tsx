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
  | { type: "ul"; items?: string[] }
  | { type: "ol"; items?: string[] }
  | { type: "quote"; text?: string; cite?: string }
  | { type: "divider" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | { type: "image"; src?: string; alt?: string; caption?: string; align?: "left" | "center" | "right"; max_h?: number }
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
  fiveDimensionsCompass: `${ASSET_BASE}/five-dimensions-compass.png`,
  iconWelcome: `${ASSET_BASE}/icon-welcome.png`,
  iconCompass: `${ASSET_BASE}/icon-compass.png`,
  iconProfiles: `${ASSET_BASE}/icon-profiles.png`,
  iconResults: `${ASSET_BASE}/icon-results.png`,
};

const DESIGN_FONT =
  "'Inter', 'Montserrat', 'Avenir Next', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const BG =
  "linear-gradient(180deg, rgba(27,60,99,0.82) 0%, rgba(12,32,58,0.94) 100%)";

const PROFILE_ORDER = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

const PROFILE_NAMES: Record<string, string> = {
  P1: "The Disruptor",
  P2: "The Advocator",
  P3: "The Mediator",
  P4: "The Connector",
  P5: "The Planner",
  P6: "The Forecaster",
  P7: "The Analyzer",
  P8: "The Optimizer",
};

const PROFILE_DIMENSION: Record<string, string> = {
  P1: "Catalyst Dimension",
  P2: "Catalyst–Communicator Dimension",
  P3: "Communicator Dimension",
  P4: "Communicator–Strategist Dimension",
  P5: "Strategist Dimension",
  P6: "Strategist–Stabilizer Dimension",
  P7: "Stabilizer Dimension",
  P8: "Stabilizer–Disruptor Dimension",
};

const INDEX_ITEMS = [
  "Welcome to the 5D Leadership Compass",
  "Introduction to the 5D Leadership Compass",
  "The Five Dimensions of Leadership",
  "The Eight Leadership Profiles",
  "Your Leadership Results",
  "Your Next Steps",
];

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

function fullName(first?: string | null, last?: string | null) {
  const out = `${first || ""} ${last || ""}`.trim();
  return out || "Participant";
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

function pctLabel(v = 0) {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

function percentFromScore(data: ResultData) {
  const nested = Number(data.raison_detre?.percentage ?? NaN);
  if (Number.isFinite(nested)) return nested > 1 ? Math.round(nested) : Math.round(nested * 100);

  const flat = Number(data.raison_detre_percentage ?? NaN);
  if (Number.isFinite(flat)) return flat > 1 ? Math.round(flat) : Math.round(flat * 100);

  return 0;
}

function cleanProfileName(name: string, code: string) {
  const cleaned = safeText(name)
    .replace(/^P[1-8]:\s*/i, "")
    .replace(/\s*\(P[1-8]\)\s*$/i, "")
    .trim();

  return cleaned || PROFILE_NAMES[normalizeProfileCode(code)] || normalizeProfileCode(code);
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
  id: string;
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
              className="flex h-10 w-10 items-center justify-center rounded-[10px] object-contain"
              fallback={<span className="flex h-10 w-10 items-center justify-center">{fallbackIcon}</span>}
            />
          ) : (
            fallbackIcon
          )}
        </div>
        <h2 className="text-[15px] font-semibold leading-[22px] text-white">{title}</h2>
      </div>

      {children}
    </section>
  );
}

function WhitePanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[18px] bg-white text-[#313C52] ${className}`}>{children}</div>;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[9px] font-semibold text-white/45">{label}</p>
      <p className="mt-1 text-[13px] font-black leading-tight text-white">{value}</p>
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
      className="rounded-[18px] border border-white/10 px-5 py-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
      style={{ background: BG }}
    >
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/10 bg-white/10">
            <ImageWithFallback
              src={ASSETS.logo}
              alt="5D Leadership"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] object-contain"
              fallback={<span className="flex h-9 w-9 items-center justify-center text-[10px] font-black">5D</span>}
            />
          </div>

          <div>
            <p className="text-[24px] font-black uppercase leading-none tracking-[0.22em] text-white">
              Personalised Report
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/70">
              5D Leadership Compass
            </p>
            <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/70">
              Powered by Profiletest.ai
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={onDownload} className="rounded-lg bg-black/35 px-4 py-2 text-[10px] font-black text-white">
            Download PDF
          </button>
          <button onClick={onNext} className="rounded-lg bg-[#7D5BD6] px-4 py-2 text-[10px] font-black text-white">
            Next steps
          </button>
          <InfoPill label="Prepared for" value={participant} />
          <InfoPill label="Date" value={reportDate} />
          <InfoPill label="Framework" value="The 5D Leadership Compass" />
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
  const topCode = normalizeProfileCode(data.top_profile_code);
  const topName = cleanProfileName(data.top_profile_name, topCode);

  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_205px]">
      <div
        className="rounded-[18px] border border-white/10 p-5 shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
        style={{ background: BG }}
      >
        <div className="grid gap-5 md:grid-cols-[1fr_270px]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45">
              The 5D Leadership Compass
            </p>

            <h1 className="mt-3 text-[42px] font-black leading-[0.95] tracking-[-0.04em] text-white">
              {participant}
            </h1>

            <p className="mt-5 max-w-[660px] text-[13px] leading-6 text-white/85">
              “Navigating Leadership Strengths in Logistics, Supply Chain, and Operations”
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-2 text-[11px] font-black text-[#0C203A]">
                {topCode} · {topName}
              </span>
              <span className="rounded-full bg-[#1DA86B] px-3 py-2 text-[11px] font-black text-white">
                {data.top_freq} · Top Frequency
              </span>
            </div>

            <div className="mt-5 grid max-w-[520px] grid-cols-2 rounded-xl border border-white/10 bg-white/5">
              <div className="border-r border-white/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Dimension</p>
                <p className="mt-1 text-xl font-black text-white">{data.top_freq}</p>
                <p className="text-[11px] text-white/55">Dominant frequency</p>
              </div>
              <div className="p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Leadership Style</p>
                <p className="mt-1 text-xl font-black text-white">{topName}</p>
                <p className="text-[11px] text-white/55">{topCode}</p>
              </div>
            </div>
          </div>

          <VerticalProfileList data={data} />
        </div>
      </div>

      <div className="rounded-[18px] bg-[#5B4380] p-6 text-center text-white shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
        <p className="mx-auto inline-flex rounded-full border border-white/50 px-4 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
          The 5th Dimension
        </p>
        <p className="mt-8 text-6xl font-black leading-none">{raisonScore}%</p>
        <p className="mt-5 text-xl font-black uppercase tracking-[0.13em]">
          Your Raison
          <br />
          d&apos;être Score
        </p>
        <p className="mx-auto mt-8 max-w-[180px] text-[12px] leading-6 text-white/85">
          The underlying passions, drivers and direction that define how leaders find fulfilment.
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
        {PROFILE_ORDER.map((code, idx) => {
          const label =
            cleanProfileName(
              data.profile_labels.find((p) => normalizeProfileCode(p.code) === code)?.name || PROFILE_NAMES[code],
              code
            );

          const active = code === topCode;

          return (
            <div
              key={code}
              className={`grid grid-cols-[26px_1fr_auto] items-center gap-2 rounded-lg border px-3 py-2 text-[10px] ${
                active
                  ? "border-[#20C46B] bg-[#0D7847]/30 text-[#30E57F]"
                  : "border-white/10 bg-white/5 text-white/70"
              }`}
            >
              <span className="text-white/35">{idx + 1}</span>
              <span className="font-black">{label}</span>
              <span className="text-[9px] text-white/40">{code}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportIndex({
  onDownload,
  onNext,
}: {
  onDownload: () => void;
  onNext: () => void;
}) {
  return (
    <aside className="sticky top-4 self-start rounded-[18px] bg-[#0C203A] p-5 text-white shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35">Report Index</p>

      <div className="mt-4 space-y-2">
        {INDEX_ITEMS.map((item, idx) => (
          <button
            key={item}
            onClick={() =>
              document.getElementById(`index-section-${idx}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            className="block w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-left text-[12px] leading-snug text-white/85 hover:bg-white/10"
          >
            <span className="font-black text-white">{idx + 1}.</span> {item}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button onClick={onDownload} className="rounded-lg bg-black/35 px-4 py-2 text-[10px] font-black text-white">
          Download PDF
        </button>
        <button onClick={onNext} className="rounded-lg bg-[#7D5BD6] px-4 py-2 text-[10px] font-black text-white">
          Next step
        </button>
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
            Welcome to the 5D Leadership Compass, a framework designed to help you unlock your leadership potential by
            understanding your natural strengths, decision-making style, and how you best contribute to your team,
            industry, and life.
          </p>
          <p className="mt-3">
            This guide introduces the Five Dimensions of Leadership and the Eight Leadership Profiles, giving you deeper
            insight into your leadership style and how to thrive in any environment.
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
          The 5D Leadership Compass is a dynamic framework that categorises leadership into five core dimensions. Four
          dimensions represent distinct leadership behaviour patterns, while the fifth dimension — Raison d’être —
          reflects the deeper purpose and motivation behind leadership.
        </p>
      </WhitePanel>
    </SectionShell>
  );
}

function FiveDimensionsSection() {
  return (
    <SectionShell id="index-section-2" title="The Five Dimensions of Leadership" iconSrc={ASSETS.iconCompass} fallbackIcon="🧭">
      <WhitePanel className="p-7">
        <div className="mx-auto flex justify-center">
          <img
            src={ASSETS.fiveDimensionsCompass}
            alt="The Five Dimensions of Leadership"
            className="h-auto max-h-[430px] w-auto max-w-full object-contain"
            crossOrigin="anonymous"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
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
        <div className="grid gap-3">
          {PROFILE_ORDER.map((code, idx) => {
            const name = cleanProfileName(
              data.profile_labels.find((p) => normalizeProfileCode(p.code) === code)?.name || PROFILE_NAMES[code],
              code
            );

            const active = code === topCode;

            return (
              <div
                key={code}
                className={`grid grid-cols-[36px_1fr_90px] items-center gap-3 rounded-xl border px-4 py-3 ${
                  active ? "border-[#5B4380] bg-[#F5F0FA]" : "border-slate-200 bg-slate-50"
                }`}
              >
                <span className="text-[12px] font-black text-slate-400">{idx + 1}</span>
                <div>
                  <p className="text-[13px] font-black text-[#0C203A]">
                    {code} · {name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {PROFILE_DIMENSION[code]}
                  </p>
                </div>
                <span className="text-right text-[13px] font-black text-[#5B4380]">
                  {pctLabel(readProfilePercent(data, code))}
                </span>
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

  return (
    <SectionShell id="index-section-4" title="Your Leadership Results" iconSrc={ASSETS.iconResults} fallbackIcon="📌">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded-[18px] bg-[#0C203A] p-6 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">Your Profile</p>
          <h3 className="mt-4 text-[26px] font-black leading-tight">{topName}</h3>
          <p className="mt-1 text-sm font-semibold text-white/70">{topCode}</p>

          <div className="mt-6 rounded-[14px] bg-[#5B4380] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Raison d’être</p>
            <p className="mt-3 text-[44px] font-black">{raisonScore}%</p>
          </div>
        </div>

        <WhitePanel className="p-6">
          {PROFILE_ORDER.map((code) => {
            const name = cleanProfileName(
              data.profile_labels.find((p) => normalizeProfileCode(p.code) === code)?.name || PROFILE_NAMES[code],
              code
            );

            const value = readProfilePercent(data, code);

            return (
              <div key={code} className="mb-4 last:mb-0">
                <div className="flex justify-between text-[13px]">
                  <span className="font-black text-[#313C52]">{code} · {name}</span>
                  <span className="font-black text-[#313C52]">{pctLabel(value)}</span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-[#0C203A]" style={{ width: pctLabel(value) }} />
                </div>
              </div>
            );
          })}
        </WhitePanel>
      </div>
    </SectionShell>
  );
}

function NextSteps({
  participant,
  onDownload,
  onNext,
}: {
  participant: string;
  onDownload: () => void;
  onNext: () => void;
}) {
  return (
    <SectionShell id="index-section-5" title="Your Next Steps" fallbackIcon="🚀">
      <WhitePanel className="p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={onDownload} className="rounded-xl bg-[#0C203A] px-4 py-3 text-sm font-black text-white">
            Download PDF
          </button>
          <button onClick={onNext} className="rounded-xl bg-[#7D5BD6] px-4 py-3 text-sm font-black text-white">
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

  function openNextSteps() {
    if (data.link?.next_steps_url) {
      window.open(data.link.next_steps_url, "_blank", "noopener,noreferrer");
      return;
    }

    document.getElementById("index-section-5")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="min-h-screen bg-[#061d34] py-5 text-white" style={{ fontFamily: DESIGN_FONT }}>
      <div ref={reportRef} className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4">
        <TopHeader participant={participant} reportDate={reportDate} onDownload={handleDownloadPdf} onNext={openNextSteps} />

        <HeroHeader data={data} participant={participant} raisonScore={raisonScore} />

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <ReportIndex onDownload={handleDownloadPdf} onNext={openNextSteps} />

          <main className="flex flex-col gap-5">
            <WelcomeSection participant={participant} />
            <IntroSection />
            <FiveDimensionsSection />
            <ProfilesSection data={data} />
            <ResultsSection data={data} raisonScore={raisonScore} />
            <NextSteps participant={participant} onDownload={handleDownloadPdf} onNext={openNextSteps} />
          </main>
        </section>

        <footer className="pb-8 text-center text-xs text-white/60">
          The 5D Leadership Compass · Businesses Are People Too · Powered by Profiletest.ai
        </footer>
      </div>
    </div>
  );
}