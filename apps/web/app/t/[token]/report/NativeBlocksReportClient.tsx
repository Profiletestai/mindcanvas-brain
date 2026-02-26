//apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
"use client";

import { useMemo, useRef } from "react";
import AppBackground from "@/components/ui/AppBackground";

type AB = "A" | "B" | "C" | "D";

type LinkMeta = {
  next_steps_url?: string | null;
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  email_report?: boolean | null;
};

type ReportSectionBlock =
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
  blocks?: ReportSectionBlock[];
};

type SectionsPayload = {
  common?: ReportSection[] | null;
  profile?: ReportSection[] | null;
};

type ResultData = {
  org_slug: string;
  org_name?: string | null;
  test_name: string;

  taker: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  };

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

  sections?: SectionsPayload | null;
};

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

function normaliseId(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\-\.]+/g, "-")
    .replace(/\-+/g, "-");
}

function getDomId(section: ReportSection, idx: number) {
  const raw = safeText(section.id).trim();
  if (raw) return normaliseId(raw);
  const title = safeText(section.title).trim();
  if (title) return normaliseId(title);
  return `section-${idx}`;
}

function pctLabel(v: number | undefined) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return `${Math.round(n * 100)}%`;
}

function fullName(first?: string | null, last?: string | null) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  const out = `${f} ${l}`.trim();
  return out || "Participant";
}

function fallbackTitleFromId(id: string, topProfileName: string) {
  const k = String(id || "").toLowerCase();

  if (k === "global.cover") return "Your personalised report";
  if (k === "global.welcome_letter") return "Welcome";
  if (k === "global.summary_dashboard") return "High Level Summary";
  if (k === "global.how_to_use") return "How to Use This Report";
  if (k === "global.framework_explainer") return "The Framework";
  if (k === "global.conclusion") return "Conclusion";
  if (k === "global.cta_next_steps") return "Next Steps";

  if (k === "profile.identity") return topProfileName || "Your Primary Profile";
  if (k === "profile.strengths") return "Strengths";
  if (k === "profile.development_areas") return "Development Areas";
  if (k === "profile.communication_style") return "Communication Style";
  if (k === "profile.reflection_questions") return "Reflection Questions";
  if (k === "profile.collaboration") return "Collaboration";

  if (k === "segmentation-responses") return "Your responses";

  // fallback: make it readable
  if (k.startsWith("profile.")) return k.replace("profile.", "").replaceAll("_", " ");
  if (k.startsWith("global.")) return k.replace("global.", "").replaceAll("_", " ");
  return "Section";
}

function BlockRenderer({ block }: { block: ReportSectionBlock }) {
  const type = String((block as any)?.type || "").toLowerCase();

  if (type === "divider") return <hr className="my-5 border-slate-200" />;

  if (type === "image") {
    const src = String((block as any)?.src || "").trim();
    if (!src) return null;

    const align = (String((block as any)?.align || "center") as any).toLowerCase();
    const justify =
      align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 420;

    return (
      <figure className="my-5">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText((block as any)?.alt)}
            crossOrigin="anonymous"
            className="h-auto max-w-full rounded-xl border border-slate-200 bg-white"
            style={{ maxHeight: maxH }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        {(block as any)?.caption ? (
          <figcaption className="mt-2 text-center text-xs text-slate-500">
            {safeText((block as any)?.caption)}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4")
    return (
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {safeText((block as any).text)}
      </h4>
    );

  if (type === "p") {
    const t = safeText((block as any).text);
    return <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{t}</p>;
  }

  if (type === "ul") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
        {items.map((it: any, i: number) => (
          <li key={i}>{safeText(it)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1">
        {items.map((it: any, i: number) => (
          <li key={i}>{safeText(it)}</li>
        ))}
      </ol>
    );
  }

  if (type === "quote") {
    const t = safeText((block as any).text);
    const cite = safeText((block as any).cite);
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm italic text-slate-700">“{t}”</p>
        {cite ? <p className="mt-2 text-xs text-slate-500">— {cite}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">
        Unsupported block type: {String((block as any).type || "unknown")}
      </p>
    </div>
  );
}

export default function NativeBlocksReportClient(props: {
  token: string;
  tid: string;
  src: string;
  data: ResultData;
}) {
  const { data } = props;

  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);
  const orgName = data.org_name || data.test_name || "Organisation";
  const reportTitle = data.test_name || "Personalised report";

  const topFreqCode = data.top_freq;
  const topFreqPct = data.frequency_percentages?.[topFreqCode] ?? 0;
  const topFreqName = data.frequency_labels.find((f) => f.code === topFreqCode)?.name || topFreqCode;

  const mergedSections = useMemo(() => {
    const common = (data.sections?.common || []) as ReportSection[];
    const profile = (data.sections?.profile || []) as ReportSection[];
    return [...common, ...profile].filter(Boolean);
  }, [data.sections]);

  const indexItems = useMemo(() => {
    return mergedSections.map((s, i) => {
      const id = getDomId(s, i);
      const title = safeText(s.title).trim() || fallbackTitleFromId(String(s.id || ""), data.top_profile_name);
      return { id, title };
    });
  }, [mergedSections, data.top_profile_name]);

  const sortedProfiles = useMemo(() => {
    return [...data.profile_labels]
      .map((p) => ({ ...p, pct: data.profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [data.profile_labels, data.profile_percentages]);

  const primary = sortedProfiles[0];
  const secondary = sortedProfiles[1];
  const tertiary = sortedProfiles[2];

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openNextSteps() {
    const url = (data?.link?.next_steps_url || "").trim();
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    // fallback: scroll to Next Steps section if present
    const hit = indexItems.find((x) => x.id.includes("cta") || x.title.toLowerCase().includes("next steps"));
    if (hit) scrollToSection(hit.id);
  }

  function downloadPdfViaPrint() {
    // ✅ no html2canvas/jspdf deps; user saves as PDF from print dialog
    window.print();
  }

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Personalised report
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{reportTitle}</h1>
              <p className="mt-2 text-sm text-slate-200">
                For {participant} · Organisation: {orgName}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Dominant frequency: <span className="font-semibold">{topFreqName}</span> · Top profile:{" "}
                <span className="font-semibold">{data.top_profile_name}</span>
              </p>
            </div>

            {/* Buttons at the top */}
            <div className="flex gap-3">
              <button
                onClick={downloadPdfViaPrint}
                className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Download PDF
              </button>

              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Next Step
              </button>
            </div>
          </div>
        </div>

        {/* High level summary (always visible) */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Frequency</h2>
            <div className="mt-4 rounded-xl bg-white p-4 text-slate-900">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{topFreqName} ({topFreqCode})</span>
                <span className="text-slate-700">{pctLabel(topFreqPct)}</span>
              </div>

              <div className="mt-4 space-y-2">
                {data.frequency_labels.map((f) => (
                  <div key={f.code} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{f.name} ({f.code})</span>
                    <span className="text-slate-700">{pctLabel(data.frequency_percentages?.[f.code])}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Profile mix</h2>
            <p className="mt-2 text-sm text-slate-200">
              Primary: <span className="font-semibold">{primary?.name || "—"}</span> · Secondary:{" "}
              <span className="font-semibold">{secondary?.name || "—"}</span> · Tertiary:{" "}
              <span className="font-semibold">{tertiary?.name || "—"}</span>
            </p>

            <div className="mt-4 rounded-xl bg-white p-4 text-slate-900">
              <div className="space-y-3">
                {sortedProfiles.map((p) => {
                  const pct = Math.max(0, Math.min(1, p.pct || 0));
                  return (
                    <div key={p.code}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-slate-700">{pctLabel(p.pct)}</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.round(pct * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Body layout: Index + Sections */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Index</p>
            <p className="mt-1 text-xs text-slate-300">Jump straight to the section you need.</p>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{s.title}</div>
                    </div>
                    <div className="text-xs text-slate-300">View</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="space-y-4">
            {mergedSections.map((section, idx) => {
              const id = getDomId(section, idx);
              const title =
                safeText(section.title).trim() ||
                fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              return (
                <section key={id} id={id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="rounded-2xl bg-white p-6 text-slate-900">
                    <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

                    <div className="mt-4 space-y-3">
                      {(section.blocks || []).map((b, i) => (
                        <BlockRenderer key={i} block={b} />
                      ))}

                      {(section.blocks || []).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Content coming soon.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Bottom CTA */}
            <div className="pt-2">
              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Next Step
              </button>
            </div>

            <footer className="pt-4 text-xs text-slate-400">
              © {new Date().getFullYear()} Powered by Profiletest.ai
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}