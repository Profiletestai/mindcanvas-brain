// apps/web/app/t/[token]/report/FrameworkSectionsRenderer.tsx
"use client";

export type ReportBlock =
  | { type: "p"; text: string }
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "divider" }
  | {
      type: "image";
      src: string;
      alt?: string;
      caption?: string;
      align?: "left" | "center" | "right";
      max_h?: number; // px
    };

export type ReportSection = {
  id: string;
  title?: string | null;
  blocks: ReportBlock[];
};

export type ReportSections = {
  common?: ReportSection[] | null;
  profile?: ReportSection[] | null;
};

function isArray<T>(x: any): x is T[] {
  return Array.isArray(x);
}

function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

function ImageBlockRenderer({ b }: { b: Extract<ReportBlock, { type: "image" }> }) {
  const src = String(b.src || "").trim();
  if (!src) return null;

  const align = (b.align || "center").toLowerCase();
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const maxH = typeof b.max_h === "number" && b.max_h > 0 ? b.max_h : 360;

  return (
    <figure className="my-5">
      <div className={`flex ${justify}`}>
        <img
          src={src}
          alt={safeText(b.alt)}
          crossOrigin="anonymous"
          className="h-auto max-w-full rounded-xl border border-slate-200 bg-white"
          style={{ maxHeight: maxH }}
          onError={(e) => {
            // fail-soft if an image is missing
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      {b.caption ? (
        <figcaption className="mt-2 text-center text-xs text-slate-500">{safeText(b.caption)}</figcaption>
      ) : null}
    </figure>
  );
}

export default function FrameworkSectionsRenderer({ sections }: { sections?: ReportSections }) {
  const common = isArray<ReportSection>(sections?.common) ? (sections!.common as ReportSection[]) : [];
  const profile = isArray<ReportSection>(sections?.profile) ? (sections!.profile as ReportSection[]) : [];
  const all = [...common, ...profile];

  if (!all.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
        No report content found yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {all.map((sec) => (
        <section
          key={sec.id}
          className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 md:p-7"
        >
          {sec.title ? <h2 className="text-xl font-semibold">{sec.title}</h2> : null}

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            {sec.blocks.map((b, idx) => {
              const type = String((b as any)?.type || "").toLowerCase();

              if (type === "p") return <p key={idx} className="whitespace-pre-line">{safeText((b as any).text)}</p>;

              if (type === "h1")
                return <h3 key={idx} className="pt-2 text-2xl font-bold text-slate-900">{safeText((b as any).text)}</h3>;
              if (type === "h2")
                return <h3 key={idx} className="pt-2 text-lg font-semibold text-slate-900">{safeText((b as any).text)}</h3>;
              if (type === "h3")
                return <h4 key={idx} className="pt-2 text-base font-semibold text-slate-900">{safeText((b as any).text)}</h4>;
              if (type === "h4")
                return <h5 key={idx} className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText((b as any).text)}</h5>;

              if (type === "ul") {
                const items = Array.isArray((b as any).items) ? (b as any).items : [];
                return (
                  <ul key={idx} className="list-disc space-y-1 pl-5">
                    {items.map((it: any, i: number) => <li key={i}>{safeText(it)}</li>)}
                  </ul>
                );
              }

              if (type === "ol") {
                const items = Array.isArray((b as any).items) ? (b as any).items : [];
                return (
                  <ol key={idx} className="list-decimal space-y-1 pl-5">
                    {items.map((it: any, i: number) => <li key={i}>{safeText(it)}</li>)}
                  </ol>
                );
              }

              if (type === "divider") {
                return <hr key={idx} className="my-5 border-slate-200" />;
              }

              if (type === "quote") {
                const qt = safeText((b as any).text);
                const cite = safeText((b as any).cite);
                return (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm italic text-slate-700">“{qt}”</p>
                    {cite ? <p className="mt-2 text-xs text-slate-500">— {cite}</p> : null}
                  </div>
                );
              }

              if (type === "image") {
                return <ImageBlockRenderer key={idx} b={b as any} />;
              }

              // fail-soft
              return (
                <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">
                    Unsupported block type: {String((b as any).type || "unknown")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

