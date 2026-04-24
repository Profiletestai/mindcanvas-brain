//apps/web/app/t/[token]/report/FiveDLeadershipReportClient.tsx
"use client";

import { useMemo, useRef } from "react";
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

const BG = "linear-gradient(180deg, rgba(27, 60, 99, 0.78) 0%, rgba(12, 32, 58, 0.84) 100%)";

const DIMENSIONS: Record<
  AB | "E",
  {
    title: string;
    subtitle: string;
    description: string;
    color: string;
    border: string;
  }
> = {
  A: {
    title: "A · Catalyst Dimension",
    subtitle: "Rapid Response & Innovation",
    description: "Action-oriented leaders who drive change and thrive in fast-moving environments.",
    color: "#3AAB7A",
    border: "#2E7D5E",
  },
  B: {
    title: "B · Communicator Dimension",
    subtitle: "Influence & Relationship-Driven Leadership",
    description: "People-focused leaders who build strong teams and partnerships.",
    color: "#B84040",
    border: "#8B2A2A",
  },
  C: {
    title: "C · Strategist Dimension",
    subtitle: "Customer Service & Mission-Driven",
    description:
      "Structured leaders who ensure operational efficiency and reliability, balancing customer delight with operational effectiveness.",
    color: "#C48A20",
    border: "#8A6010",
  },
  D: {
    title: "D · Stabilizer Dimension",
    subtitle: "Target Focused & Systems Thinking",
    description:
      "Analytical leaders who focus on longer-term, detailed analysis, optimization and future-proofing businesses.",
    color: "#4070B8",
    border: "#2A4A7A",
  },
  E: {
    title: "Raison d'être",
    subtitle: "The Motivational Foundation",
    description:
      "The underlying passions, drivers and direction that defines how leaders find fulfillment in their work and life.",
    color: "#63457E",
    border: "#5A2A8A",
  },
};

const PROFILES: Array<{
  code: string;
  name: string;
  dimension: string;
  description: string;
  color: string;
  icon: string;
}> = [
  {
    code: "P1",
    name: "The Disruptor",
    dimension: "Catalyst Dimension",
    description:
      "Visionary innovators who push boundaries and create industry-shifting change. Hard chargers that see the light at the end of the tunnel well before most others.",
    color: "#457E58",
    icon: "⚡",
  },
  {
    code: "P2",
    name: "The Advocator",
    dimension: "Catalyst–Communicator Dimension",
    description: "High-energy leaders who thrive on engagement, motivation, and generating broad interest and buy-in.",
    color: "#457E58",
    icon: "📣",
  },
  {
    code: "P3",
    name: "The Mediator",
    dimension: "Communicator Dimension",
    description: "Empathetic leaders who excel in team alignment, conflict resolution, and relationship-building.",
    color: "#954444",
    icon: "🤝",
  },
  {
    code: "P4",
    name: "The Connector",
    dimension: "Communicator–Strategist Dimension",
    description: "Strategic networkers who leverage partnerships to drive business success.",
    color: "#954444",
    icon: "🔗",
  },
  {
    code: "P5",
    name: "The Planner",
    dimension: "Strategist Dimension",
    description:
      "Customer, market and mission-oriented leaders focused on service-driven planning and reliable logistics performance.",
    color: "#CE8B0A",
    icon: "🗂",
  },
  {
    code: "P6",
    name: "The Forecaster",
    dimension: "Strategist–Stabilizer Dimension",
    description: "Risk-averse, detail-oriented leaders with foresight to anticipate upcoming opportunities and challenges.",
    color: "#CE8B0A",
    icon: "🔭",
  },
  {
    code: "P7",
    name: "The Analyzer",
    dimension: "Stabilizer Dimension",
    description:
      "Systems-oriented thinkers who leverage data-driven, systematic approaches to develop long-term business frameworks.",
    color: "#B0C3CB",
    icon: "📊",
  },
  {
    code: "P8",
    name: "The Optimizer",
    dimension: "Stabilizer–Disruptor Dimension",
    description:
      "Precision-driven leaders who refine processes, integrate technology, implement automation, and find ways to make things better.",
    color: "#B0C3CB",
    icon: "⚙",
  },
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

function getProfileNameFromLive(data: ResultData, code: string) {
  const normalized = normalizeProfileCode(code);
  const live = data.profile_labels.find((p) => normalizeProfileCode(p.code) === normalized)?.name;
  const fallback = PROFILES.find((p) => p.code === normalized)?.name;
  return (live || fallback || normalized).replace(/^P[1-8]:\s*/i, "").trim();
}

function getTopProfile(data: ResultData) {
  const code = normalizeProfileCode(data.top_profile_code);
  const profile = PROFILES.find((p) => p.code === code);
  return {
    code,
    name: getProfileNameFromLive(data, code),
    dimension: profile?.dimension || "",
    description: profile?.description || "",
    color: profile?.color || "#0C203A",
    icon: profile?.icon || "●",
  };
}

function SectionShell({
  id,
  title,
  icon,
  children,
}: {
  id?: string;
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative rounded-[24px] border border-white/10 p-[21px] shadow-[0_14px_42px_rgba(0,0,0,0.32)]"
      style={{ background: BG }}
    >
      <div className="mb-7 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-blue-400/20 bg-blue-400/10 text-lg">
          {icon}
        </div>
        <h2 className="text-[15px] font-semibold leading-[22.5px] text-white">{title}</h2>
      </div>

      {children}
    </section>
  );
}

function WhitePanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[18px] border border-white/10 bg-white text-[#313C52] ${className}`}>
      {children}
    </div>
  );
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

function WelcomeSection({ participant }: { participant: string }) {
  return (
    <SectionShell title="Welcome to the 5D Leadership Compass" icon="✉">
      <WhitePanel className="p-5">
        <div className="text-[13px] leading-7 text-[#313C52]">
          <p>Dear {participant},</p>
          <p className="mt-3">
            Welcome to the 5D Leadership Compass, a framework designed to help you unlock your leadership potential by
            understanding your natural strengths, decision-making style, and how you best contribute to your team,
            industry, and life.
          </p>
          <p className="mt-3">
            In today&apos;s complex world of logistics, supply chain, and operations, leadership success goes beyond
            experience or technical skill. It is about knowing how you lead, collaborate, and make an impact.
          </p>
          <p className="mt-3">
            This guide will introduce the <strong>Five Dimensions of Leadership</strong> and the{" "}
            <strong>Eight Leadership Profiles</strong>, giving you deeper insight into your leadership style and how to
            thrive in any environment.
          </p>
          <p className="mt-3">
            Explore your profile with an open mind. The more you understand how you lead, the more impactful you will
            become.
          </p>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex h-[63px] w-[63px] items-center justify-center rounded-full bg-slate-100 text-2xl">
              BG
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
    <SectionShell title="Introduction to the 5D Leadership Compass" icon="🧭">
      <WhitePanel className="p-5">
        <p className="text-[13px] leading-7 text-[#313C52]">
          The 5D Leadership Compass is a dynamic framework that categorizes leadership into five core dimensions, with
          four core dimensions representing a distinct approach to leadership and problem-solving. There is also the
          powerful fifth overarching dimension, your internal compass, reflecting your reason for being, your whys and
          meanings guiding your paths in leadership and life.
        </p>
      </WhitePanel>
    </SectionShell>
  );
}

function DimensionsSection({ data, raisonScore }: { data: ResultData; raisonScore: number }) {
  const rows = (["A", "B", "C", "D"] as AB[]).map((code) => {
    const label = data.frequency_labels.find((f) => f.code === code)?.name || DIMENSIONS[code].title;
    const pct = percentWhole(data.frequency_percentages?.[code]);
    return { code, label, pct, ...DIMENSIONS[code] };
  });

  return (
    <SectionShell title="The Five Dimensions of Leadership" icon="🧭">
      <WhitePanel className="p-6">
        <div className="mx-auto flex h-[420px] max-w-[640px] items-center justify-center rounded-full bg-slate-50">
          <div className="grid h-[360px] w-[360px] place-items-center rounded-full border-[28px] border-[#E7ECF3] bg-white text-center shadow-inner">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Your Compass</div>
              <div className="mt-2 text-5xl font-black text-[#0C203A]">{data.top_freq}</div>
              <div className="mt-2 text-sm font-bold text-[#313C52]">
                {data.frequency_labels.find((f) => f.code === data.top_freq)?.name || data.top_freq}
              </div>
              <div className="mt-3 text-2xl font-black text-[#63457E]">{raisonScore}%</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Raison d’être</div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((d) => (
            <div
              key={d.code}
              className="rounded-[14px] border bg-white p-5"
              style={{
                borderColor: d.border,
                borderTopWidth: 3,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold leading-6" style={{ color: d.color }}>
                    {d.title}
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: d.border }}>
                    {d.subtitle}
                  </p>
                </div>
                <div className="text-xl font-black" style={{ color: d.color }}>
                  {d.pct}%
                </div>
              </div>

              <div className="mt-4 h-2.5 rounded-full bg-slate-100">
                <div className="h-2.5 rounded-full" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
              </div>

              <p className="mt-4 text-[13px] leading-[20.8px] text-[#313C52]">{d.description}</p>
            </div>
          ))}

          <div
            className="rounded-[14px] border bg-white p-6 md:col-span-2"
            style={{ borderColor: DIMENSIONS.E.border, borderTopWidth: 3 }}
          >
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
              <div className="text-5xl font-black text-[#63457E]">{raisonScore}%</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#313C52]">{DIMENSIONS.E.description}</p>
          </div>
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function ProfileCard({ profile, active }: { profile: (typeof PROFILES)[number]; active: boolean }) {
  return (
    <div className={`relative rounded-[18px] ${active ? "ring-4 ring-[#63457E]" : ""}`}>
      <div className="h-[105px] rounded-t-[18px]" style={{ backgroundColor: profile.color }} />
      <div className="min-h-[227px] bg-white px-4 pb-5 pt-[70px] text-center shadow-md">
        <div className="absolute left-1/2 top-[18px] flex h-[91px] w-[89px] -translate-x-1/2 items-center justify-center bg-[#FAF1EA] text-4xl shadow-md">
          {profile.icon}
        </div>
        <h3 className="text-xs font-semibold leading-[19.2px] text-[#111828]">{profile.name}</h3>
        <p className="mt-2 text-[10px] font-normal uppercase leading-4 tracking-[1px] text-[#313C52]">
          {profile.dimension}
        </p>
        <p className="mt-4 text-[11px] leading-[16.5px] text-[#313C52]">{profile.description}</p>
      </div>
    </div>
  );
}

function ProfilesSection({ data }: { data: ResultData }) {
  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <SectionShell title="The Eight Leadership Profiles" icon="👥">
      <WhitePanel className="p-6">
        <div className="mx-auto flex h-[360px] max-w-[720px] items-center justify-center rounded-full bg-slate-50">
          <div className="grid h-[300px] w-[300px] place-items-center rounded-full border-[24px] border-slate-200 bg-white text-center shadow-inner">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Top Profile</div>
              <div className="mt-2 text-5xl font-black text-[#0C203A]">{topCode}</div>
              <div className="mt-2 text-sm font-bold text-[#313C52]">{getProfileNameFromLive(data, topCode)}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PROFILES.map((profile) => (
            <ProfileCard key={profile.code} profile={profile} active={profile.code === topCode} />
          ))}
        </div>
      </WhitePanel>
    </SectionShell>
  );
}

function ResultsSection({ data, raisonScore }: { data: ResultData; raisonScore: number }) {
  const top = getTopProfile(data);

  const profileRows = PROFILES.map((p) => ({
    ...p,
    pct: percentWhole(readProfilePercent(data, p.code)),
  }));

  return (
    <SectionShell title="Your Leadership Results" icon="📌">
      <WhitePanel className="p-6">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-[18px] bg-[#0C203A] p-6 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Your Profile</p>
            <h3 className="mt-3 text-3xl font-black">{top.name}</h3>
            <p className="mt-1 text-sm font-semibold text-white/75">
              {top.code} · {top.dimension}
            </p>

            <div className="mt-6 rounded-[14px] bg-[#63457E] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">Raison d’être</p>
              <p className="mt-2 text-5xl font-black">{raisonScore}%</p>
            </div>
          </div>

          <div className="space-y-4">
            {profileRows.map((p) => {
              const active = p.code === top.code;
              return (
                <div key={p.code}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-bold ${active ? "text-[#63457E]" : "text-[#313C52]"}`}>
                      {p.code} · {p.name}
                    </span>
                    <span className="font-black text-[#313C52]">{p.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${p.pct}%`,
                        backgroundColor: active ? "#63457E" : "#0C203A",
                      }}
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
  const id = getSectionDomId(section, idx);
  const title = safeText(section.title);

  return (
    <SectionShell id={id} title={title || `Report Section ${idx + 1}`} icon="📄">
      <WhitePanel className="p-6">
        <div className="space-y-4">
          {(section.blocks || []).map((block, blockIdx) => (
            <BlockRenderer key={blockIdx} block={block} />
          ))}
        </div>
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
    <div className="min-h-screen bg-[#061d34] py-8 text-white">
      <div ref={reportRef} className="mx-auto flex max-w-[1139px] flex-col gap-6 px-4">
        <div className="rounded-[24px] border border-white/10 p-8 shadow-[0_14px_42px_rgba(0,0,0,0.32)]" style={{ background: BG }}>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">Personalised Report</p>
          <h1 className="mt-4 text-5xl font-black leading-none tracking-tight">5D Leadership Compass</h1>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.25em] text-white/70">Powered by Profiletest.ai</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={handleDownloadPdf} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#061d34]">
              Download PDF
            </button>
          </div>
        </div>

        <WelcomeSection participant={participant} />
        <IntroSection />
        <DimensionsSection data={data} raisonScore={raisonScore} />
        <ProfilesSection data={data} />
        <ResultsSection data={data} raisonScore={raisonScore} />

        {sections.map((section, idx) => (
          <DynamicContentSection key={getSectionDomId(section, idx)} section={section} idx={idx} />
        ))}

        <footer className="pb-8 text-center text-xs text-white/60">
          The 5D Leadership Compass · Businesses Are People Too · Powered by Profiletest.ai
        </footer>
      </div>
    </div>
  );
}