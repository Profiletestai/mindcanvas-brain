// apps/web/app/t/[token]/report/FrameworkSectionsRenderer.tsx
"use client";

export type ImageBlock = {
  type: "image";
  src: string;
  alt?: string;
  caption?: string;
  align?: "left" | "center" | "right";
  max_h?: number; // px
};

export type ReportBlock =
  | { type: "p"; text: string }
  | { type: "h2" | "h3" | "h4"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | ImageBlock;

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

function ImageRenderer({ b }: { b: ImageBlock }) {
  const src = String(b?.src || "").trim();
  if (!src) return null;

  const align = (b.align || "center").toLowerCase();
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  const maxH = typeof b.max_h === "number" && b.max_h > 0 ? b.max_h : 360;

  return (
    <figure className="my-5">
      <div className={`flex ${justify}`}>
        <img
          src={src}
          alt={String(b.alt || "")}
          crossOrigin="anonymous"
          className="h-auto max-w-full rounded-xl border border-slate-200 bg-white"
          style={{ maxHeight: maxH }}
          onError={(e) => {
            // Fail-soft: if an image is missing, hide it without breaking layout/PDF export.
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      {b.caption ? (
        <figcaption className="mt-2 text-center text-xs text-slate-500">
          {String(b.caption)}
        </figcaption>
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
          className="rounded-2xl border border-slate-200 bg-white p-6 md:p-7 text-slate-900"
        >
          {sec.title ? <h2 className="text-xl font-semibold">{sec.title}</h2> : null}

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            {sec.blocks.map((b, idx) => {
              if (b.type === "p") return <p key={idx}>{b.text}</p>;

              if (b.type === "h2")
                return (
                  <h3 key={idx} className="pt-2 text-lg font-semibold text-slate-900">
                    {b.text}
                  </h3>
                );

              if (b.type === "h3")
                return (
                  <h4 key={idx} className="pt-2 text-base font-semibold text-slate-900">
                    {b.text}
                  </h4>
                );

              if (b.type === "h4")
                return (
                  <h5 key={idx} className="pt-2 text-sm font-semibold text-slate-900">
                    {b.text}
                  </h5>
                );

              if (b.type === "image") return <ImageRenderer key={idx} b={b} />;

              if (b.type === "ul") {
                return (
                  <ul key={idx} className="list-disc pl-5 space-y-1">
                    {b.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                );
              }

              if (b.type === "ol") {
                return (
                  <ol key={idx} className="list-decimal pl-5 space-y-1">
                    {b.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ol>
                );
              }

              // Fail-soft: ignore unknown blocks
              return null;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
