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

function BlockRenderer({ block }: { block: SectionBlock }) {
  const type = safeText((block as any)?.type).toLowerCase();

  if (type === "divider") return <hr className="my-5 border-slate-200" />;

  if (type === "image") {
    const src = safeText((block as any).src).trim();
    if (!src) return null;
    return (
      <figure className="my-5">
        <img
          src={src}
          alt={safeText((block as any).alt)}
          crossOrigin="anonymous"
          className="mx-auto h-auto max-w-full rounded-xl border border-slate-200 bg-white"
          style={{ maxHeight: Number((block as any).max_h || 360) }}
        />
        {(block as any).caption ? (
          <figcaption className="mt-2 text-center text-xs text-slate-500">
            {safeText((block as any).caption)}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "h1") return <h1 className="text-2xl font-bold text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-bold text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4") {
    return (
      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-[#0B2A4A]">
        {safeText((block as any).text)}
      </h4>
    );
  }

  if (type === "ul") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
        {items.map((item: any, idx: number) => (
          <li key={idx}>{safeText(item)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
        {items.map((item: any, idx: number) => (
          <li key={idx}>{safeText(item)}</li>
        ))}
      </ol>
    );
  }

  if (type === "quote") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm italic text-slate-700">“{safeText((block as any).text)}”</p>
        {(block as any).cite ? <p className="mt-2 text-xs text-slate-500">— {safeText((block as any).cite)}</p> : null}
      </div>
    );
  }

  return <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{safeText((block as any).text)}</p>;
}

function DimensionBars({ data }: { data: ResultData }) {
  const rows = data.frequency_labels.map((f) => ({
    ...f,
    pct: percentWhole(data.frequency_percentages?.[f.code]),
  }));

  return (
    <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-sm">
      <div>
        <h3 className="text-lg font-bold">Dimensions</h3>
        <p className="mt-1 text-xs text-slate-500">
          The four drivers show the behavioural energy you use most often.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.code}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                {row.name} <span className="text-slate-400">({row.code})</span>
              </span>
              <span className="font-bold">{row.pct}%</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-[#0B2A4A]" style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileMap({ data }: { data: ResultData }) {
  const rows = [...data.profile_labels]
    .map((p) => ({
      ...p,
      pct: percentWhole(data.profile_percentages?.[p.code]),
    }))
    .sort((a, b) => {
      const na = Number(String(a.code).replace(/\D/g, "") || 0);
      const nb = Number(String(b.code).replace(/\D/g, "") || 0);
      return na - nb;
    });

  return (
    <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-sm">
      <h3 className="text-lg font-bold">Your Personality Map (Profiles)</h3>
      <p className="mt-1 text-xs text-slate-500">
        This map shows your overall pattern across Profiles. Higher scores show stronger natural patterns.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((p) => (
          <div key={p.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.code}</div>
              <div className="text-sm font-bold text-slate-900">{p.pct}%</div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-[#0B2A4A]" style={{ width: `${p.pct}%` }} />
            </div>
            <div className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700">{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaisonCard({ score }: { score: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Raison d’être Score</h3>
          <p className="mt-1 text-xs text-slate-500">
            The underlying passions, drivers and direction that define how leaders find fulfilment in work and life.
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-[#0B2A4A]">{score}%</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Your score</div>
        </div>
      </div>

      <div className="mt-5 h-4 rounded-full bg-slate-100">
        <div className="h-4 rounded-full bg-[#0B2A4A]" style={{ width: `${score}%` }} />
      </div>
    </div>
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

  const topProfile = data.top_profile_name || "Leadership Profile";
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
        backgroundColor: "#071C34",
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
    <div ref={reportRef} className="min-h-screen bg-[#071C34] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="rounded-[28px] border border-white/10 bg-[#0B2A4A] p-6 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-slate-300">
                Personalised Report
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                5D Leadership Compass
              </h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
                powered by profiletest.ai
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Prepared for</div>
                  <div className="mt-1 text-xl font-bold">{participant}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Date</div>
                  <div className="mt-1 text-xl font-bold">{reportDate}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadPdf}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#071C34] hover:bg-slate-100"
                >
                  Download PDF
                </button>
                <button
                  onClick={openNextSteps}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                >
                  Next steps
                </button>
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-5 text-[#071C34]">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Framework</div>
              <div className="mt-2 text-xl font-black">The 5D Leadership Compass</div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">You</div>
                <div className="mt-1 text-2xl font-black">{topProfile}</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  {topFreqName} · {data.top_freq}
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#071C34] p-4 text-white">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                  Raison d’être
                </div>
                <div className="mt-1 text-4xl font-black">{raisonScore}%</div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-[24px] border border-white/10 bg-[#0B2A4A] p-5">
            <h2 className="text-lg font-black">Report Index</h2>
            <div className="mt-4 space-y-2">
              {indexItems.slice(0, 30).map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })}
                  className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                >
                  <span className="mr-2 font-bold text-slate-300">{idx + 1}.</span>
                  {item.title}
                </button>
              ))}
            </div>
          </aside>

          <main className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-3">
              <DimensionBars data={data} />
              <ProfileMap data={data} />
              <RaisonCard score={raisonScore} />
            </div>

            {sections.map((section, idx) => {
              const id = getSectionDomId(section, idx);
              const title = safeText(section.title);

              return (
                <section key={id} id={id} className="rounded-[24px] border border-white/10 bg-[#0B2A4A] p-4">
                  <div className="rounded-[20px] bg-white p-6 text-slate-900">
                    {title ? (
                      <h2 className="mb-4 text-2xl font-black tracking-tight text-[#071C34]">
                        {title}
                      </h2>
                    ) : null}

                    <div className="space-y-4">
                      {(section.blocks || []).map((block, blockIdx) => (
                        <BlockRenderer key={blockIdx} block={block} />
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}

            <section id="next-steps" className="rounded-[24px] border border-white/10 bg-[#0B2A4A] p-4">
              <div className="rounded-[20px] bg-white p-6 text-slate-900">
                <h2 className="text-2xl font-black text-[#071C34]">Your Next Steps</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-bold">Download Your Report</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Save a PDF copy of your 5D Leadership Compass report.
                    </p>
                    <button onClick={handleDownloadPdf} className="mt-4 rounded-xl bg-[#071C34] px-4 py-2 text-sm font-bold text-white">
                      Download PDF
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-bold">Discuss with Your Advisor</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Translate your insights into practical next actions.
                    </p>
                    <button onClick={openNextSteps} className="mt-4 rounded-xl bg-[#071C34] px-4 py-2 text-sm font-bold text-white">
                      Explore Now
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-bold">Visit Businesses Are People Too</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Continue your leadership development journey.
                    </p>
                    <button onClick={openNextSteps} className="mt-4 rounded-xl bg-[#071C34] px-4 py-2 text-sm font-bold text-white">
                      Visit Now
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <footer className="pb-8 pt-2 text-center text-xs text-slate-300">
              The 5D Leadership Compass · Powered by Profiletest.ai
            </footer>
          </main>
        </section>
      </div>
    </div>
  );
}