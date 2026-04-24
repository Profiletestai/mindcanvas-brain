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

const PROFILE_SHORT_NAMES: Record<string, string> = {
  P1: "Disruptor",
  P2: "Advocator",
  P3: "Mediator",
  P4: "Connector",
  P5: "Planner",
  P6: "Forecaster",
  P7: "Analyzer",
  P8: "Optimizer",
};

const PROFILE_DIMENSIONS: Record<string, string> = {
  P1: "Catalyst",
  P2: "Catalyst–Comm.",
  P3: "Communicator",
  P4: "Comm.–Strategist",
  P5: "Strategist",
  P6: "Strat.–Stabilizer",
  P7: "Stabilizer",
  P8: "Stab.–Disruptor",
};

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

function stripProfileCode(name: string) {
  return name.replace(/\s*\(P[1-8]\)\s*$/i, "").replace(/^P[1-8]:\s*/i, "").trim();
}

function getProfileShortName(code: string, name?: string) {
  const normalized = normalizeProfileCode(code);
  const cleaned = stripProfileCode(name || "");
  return cleaned || PROFILE_SHORT_NAMES[normalized] || normalized;
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
      <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-slate-700">
        {items.map((item: any, idx: number) => (
          <li key={idx}>{safeText(item)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-700">
        {items.map((item: any, idx: number) => (
          <li key={idx}>{safeText(item)}</li>
        ))}
      </ol>
    );
  }

  if (type === "quote") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[13px] italic leading-relaxed text-slate-700">“{safeText((block as any).text)}”</p>
        {(block as any).cite ? <p className="mt-2 text-[11px] font-semibold text-slate-500">— {safeText((block as any).cite)}</p> : null}
      </div>
    );
  }

  return <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{safeText((block as any).text)}</p>;
}

function MiniProfileGrid({ data }: { data: ResultData }) {
  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {data.profile_labels.slice(0, 8).map((p, i) => {
        const code = normalizeProfileCode(p.code || `P${i + 1}`);
        const active = code === topCode;

        return (
          <div
            key={code}
            className={`rounded-xl border px-3 py-2 ${
              active ? "border-white bg-white text-[#06233f]" : "border-white/10 bg-white/5 text-white"
            }`}
          >
            <div className={`text-[10px] font-black uppercase tracking-wide ${active ? "text-slate-500" : "text-white/45"}`}>
              {code}
            </div>
            <div className="mt-1 truncate text-xs font-black">{getProfileShortName(code, p.name)}</div>
          </div>
        );
      })}
    </div>
  );
}

function DimensionsChart({ data }: { data: ResultData }) {
  const rows = data.frequency_labels.map((f) => ({
    ...f,
    pct: percentWhole(data.frequency_percentages?.[f.code]),
  }));

  return (
    <div className="rounded-[18px] bg-white p-4 text-slate-900">
      <h2 className="text-lg font-black text-[#06233f]">Dimensions</h2>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        The four drivers show the behavioural energy you use most often.
      </p>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.code}>
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="font-black">
                {row.name} <span className="text-slate-400">({row.code})</span>
              </span>
              <span className="font-black text-[#06233f]">{row.pct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-[#06233f]" style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonalityMap({ data }: { data: ResultData }) {
  const rows = [...data.profile_labels]
    .map((p) => ({
      ...p,
      code: normalizeProfileCode(p.code),
      pct: percentWhole(readProfilePercent(data, p.code)),
    }))
    .sort((a, b) => Number(a.code.replace(/\D/g, "")) - Number(b.code.replace(/\D/g, "")));

  const topCode = normalizeProfileCode(data.top_profile_code);

  return (
    <div className="rounded-[18px] bg-white p-4 text-slate-900">
      <h2 className="text-lg font-black text-[#06233f]">Your Personality Map</h2>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        Your overall pattern across profiles.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {rows.map((p) => {
          const active = p.code === topCode;

          return (
            <div
              key={p.code}
              className={`rounded-xl border p-2 ${
                active ? "border-[#06233f] bg-[#06233f] text-white" : "border-slate-200 bg-slate-50 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black ${active ? "text-white/70" : "text-slate-500"}`}>{p.code}</span>
                <span className="text-xs font-black">{p.pct}%</span>
              </div>
              <div className={`mt-1.5 h-1.5 rounded-full ${active ? "bg-white/20" : "bg-slate-200"}`}>
                <div className={`h-1.5 rounded-full ${active ? "bg-white" : "bg-[#06233f]"}`} style={{ width: `${p.pct}%` }} />
              </div>
              <div className="mt-2 truncate text-[10px] font-black">{getProfileShortName(p.code, p.name)}</div>
              <div className={`mt-0.5 truncate text-[9px] font-semibold ${active ? "text-white/65" : "text-slate-500"}`}>
                {PROFILE_DIMENSIONS[p.code]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportIndex({ items }: { items: Array<{ id: string; title: string }> }) {
  return (
    <aside className="rounded-[18px] bg-[#0c2b49] p-4 text-white">
      <h2 className="text-base font-black">Report Index</h2>
      <div className="mt-3 space-y-1.5">
        {items.length ? (
          items.slice(0, 20).map((item, idx) => (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] leading-tight text-white/85 hover:bg-white/10"
            >
              <span className="font-black text-white">{idx + 1}.</span> {item.title}
            </button>
          ))
        ) : (
          <p className="text-[11px] leading-snug text-white/65">Report sections will appear once content is returned.</p>
        )}
      </div>
    </aside>
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

  const topCode = normalizeProfileCode(data.top_profile_code);
  const topProfile = getProfileShortName(topCode, data.top_profile_name);
  const topFreqName = data.frequency_labels.find((f) => f.code === data.top_freq)?.name || data.top_freq;
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

  const indexItems = useMemo(
    () =>
      sections
        .filter((s) => safeText(s.title).trim())
        .map((s, idx) => ({
          id: getSectionDomId(s, idx),
          title: safeText(s.title),
        })),
    [sections]
  );

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
    const url = safeText(data.link?.next_steps_url).trim();
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const el = document.getElementById("next-steps");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={reportRef} className="min-h-screen bg-[#061d34] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-25">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:46px_46px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-4 py-8">
        {/* Designer-style hero */}
        <header className="rounded-[28px] border border-white/10 bg-[#0b2a49] p-6 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-white/70">Personalised Report</p>
              <h1 className="mt-4 text-5xl font-black leading-none tracking-tight md:text-6xl">
                5D Leadership Compass
              </h1>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.28em] text-white/70">
                powered by profiletest.ai
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Prepared for</p>
                  <p className="mt-1 text-xl font-black">{participant}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Date</p>
                  <p className="mt-1 text-xl font-black">{reportDate}</p>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button onClick={handleDownloadPdf} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#061d34]">
                  Download PDF
                </button>
                <button onClick={openNextSteps} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white">
                  Next steps
                </button>
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-5 text-[#061d34]">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Framework</p>
              <h2 className="mt-2 text-2xl font-black leading-tight">The 5D Leadership Compass</h2>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">You</p>
                <p className="mt-2 text-2xl font-black">{topProfile} ({topCode})</p>
                <p className="mt-1 text-sm font-bold text-slate-600">{topFreqName} · {data.top_freq}</p>
              </div>

              <div className="mt-5 rounded-2xl bg-[#061d34] p-4 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">Raison d’être</p>
                <p className="mt-2 text-5xl font-black">{raisonScore}%</p>
              </div>
            </div>
          </div>
        </header>

        {/* Designer-style profile intro composition */}
        <section className="mt-5 rounded-[28px] border border-white/10 bg-[#0b2a49] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className="space-y-4">
              <MiniProfileGrid data={data} />

              <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">
                  You · The 5D Leadership Compass
                </p>
                <h2 className="mt-3 text-3xl font-black">{topProfile}</h2>
                <p className="mt-1 text-sm font-black text-cyan-100">
                  {topCode} · {PROFILE_DIMENSIONS[topCode]}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/75">
                  Your strongest leadership pattern sits in the {topFreqName}. This report explains how your profile shows up in your leadership style, strengths, development areas and practical next steps.
                </p>
              </div>
            </div>

            <div className="rounded-[22px] bg-white p-5 text-[#061d34]">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Raison d’être</p>
              <p className="mt-4 text-6xl font-black">{raisonScore}%</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                The deeper purpose score that sits alongside your leadership profile and frequency pattern.
              </p>
              <div className="mt-5 h-2.5 rounded-full bg-slate-100">
                <div className="h-2.5 rounded-full bg-[#061d34]" style={{ width: `${raisonScore}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* Main report composition */}
        <section className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <ReportIndex items={indexItems} />

          <main className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <DimensionsChart data={data} />
              <PersonalityMap data={data} />
            </div>

            {sections.map((section, idx) => {
              const id = getSectionDomId(section, idx);
              const title = safeText(section.title);

              return (
                <section key={id} id={id} className="rounded-[18px] bg-white p-6 text-slate-900">
                  {title ? <h2 className="mb-4 text-2xl font-black text-[#061d34]">{title}</h2> : null}
                  <div className="space-y-3">
                    {(section.blocks || []).map((block, blockIdx) => (
                      <BlockRenderer key={blockIdx} block={block} />
                    ))}
                  </div>
                </section>
              );
            })}

            <section id="next-steps" className="rounded-[18px] bg-white p-6 text-slate-900">
              <h2 className="text-2xl font-black text-[#061d34]">Your Next Steps</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-black">Download Your Report</h3>
                  <p className="mt-2 text-sm text-slate-600">Save a PDF copy of your 5D Leadership Compass report.</p>
                  <button onClick={handleDownloadPdf} className="mt-4 rounded-xl bg-[#061d34] px-4 py-2 text-sm font-black text-white">
                    Download PDF
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-black">Discuss with Your Advisor</h3>
                  <p className="mt-2 text-sm text-slate-600">Translate your insights into practical next actions.</p>
                  <button onClick={openNextSteps} className="mt-4 rounded-xl bg-[#061d34] px-4 py-2 text-sm font-black text-white">
                    Explore Now
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-black">Visit Businesses Are People Too</h3>
                  <p className="mt-2 text-sm text-slate-600">Continue your leadership development journey.</p>
                  <button onClick={openNextSteps} className="mt-4 rounded-xl bg-[#061d34] px-4 py-2 text-sm font-black text-white">
                    Visit Now
                  </button>
                </div>
              </div>
            </section>

            <footer className="pb-8 pt-2 text-center text-xs text-white/55">
              The 5D Leadership Compass · Businesses Are People Too · Powered by Profiletest.ai
            </footer>
          </main>
        </section>
      </div>
    </div>
  );
}