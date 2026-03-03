// apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
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

  meta?: {
    redirect_url?: string | null;
    next_steps_url?: string | null;
    [k: string]: any;
  } | null;

  [k: string]: any;
};

type ReportSectionBlock =
  | { type: "p"; text?: string }
  | { type: "ul"; items?: string[] }
  | { type: "ol"; items?: string[] }
  | { type: "quote"; text?: string; cite?: string }
  | { type: "divider" }
  | { type: "spacer"; size?: "sm" | "md" | "lg" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | {
      type: "image";
      src?: string;
      alt?: string;
      caption?: string;
      align?: "left" | "center" | "right";
      max_h?: number;
      rounded?: boolean;
    }
  | {
      type: "callout";
      tone?: "insight" | "warning" | "success" | "neutral";
      title?: string;
      text?: string;
      bullets?: string[];
    }
  | { type: "chips"; items?: string[] }
  | {
      type: "cards";
      columns?: 1 | 2 | 3;
      items?: Array<{ title?: string; text?: string; tone?: "light" | "dark" | "glass" }>;
    }
  | {
      type: "scorecard_row";
      items?: Array<{ label: string; value: string; hint?: string }>;
    }
  | { type: "chart.frequency_bars" }
  | { type: "chart.profile_bars" }
  | { type: "chart.profile_radar" }
  | { type: "cta"; title?: string; text?: string; button_text?: string }
  | {
      type: "images.pair";
      left?: { src?: string; alt?: string; caption?: string; max_h?: number };
      right?: { src?: string; alt?: string; caption?: string; max_h?: number };
    }
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
  org_logo_url?: string | null;
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

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
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

function cleanProfileName(raw: string) {
  const s = String(raw || "").trim();
  let out = s.replace(/^PROFILE_\d+\s*:\s*/i, "");
  out = out.replace(/^\s*(P\d+)\s*:\s*(P\d+)\s*:/i, "$1:");
  out = out.replace(/^\s*(P\d+)\s*:\s*(P\d+)\s*/i, "$1 $2");
  out = out.replace(/\s+/g, " ").trim();
  return out || s || "Top profile";
}

function fallbackTitleFromId(id: string, topProfileName: string) {
  const k = String(id || "").toLowerCase();

  if (k === "global.cover") return "Your personalised report";
  if (k === "global.welcome_letter" || k === "global.welcome") return "Welcome";
  if (k === "global.how_to_use") return "How to Use This Report";
  if (k === "global.lead_introduction") return "Introducing the MindCanvas LEAD System";
  if (k === "global.framework_explainer") return "How this system works";
  if (k === "global.conclusion") return "Conclusion";
  if (k === "global.cta_next_steps") return "Next Steps";

  if (k === "profile.identity") return topProfileName || "Your Primary Profile";

  if (k.startsWith("profile.")) return k.replace("profile.", "").replaceAll("_", " ");
  if (k.startsWith("global.")) return k.replace("global.", "").replaceAll("_", " ");
  return "Section";
}

function isLead(data: ResultData) {
  const t = String(data?.test_name || "").toLowerCase();
  const o = String(data?.org_slug || "").toLowerCase();
  return t.includes("lead") || o.includes("lead");
}

function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "-");
}

function leadProfileFileFromCode(code: string) {
  const c = String(code || "").toUpperCase().trim();
  const n = c.replace("PROFILE_", "");
  switch (n) {
    case "1":
      return "trailblazer.png";
    case "2":
      return "spark.png";
    case "3":
      return "uplifter.png";
    case "4":
      return "bridgebuilder.png";
    case "5":
      return "steadyhand.png";
    case "6":
      return "organiser.png";
    case "7":
      return "analyst.png";
    case "8":
      return "refiner.png";
    default:
      return "";
  }
}

function leadProfileFileFromName(name: string) {
  const n = String(name || "").toLowerCase();
  if (n.includes("trailblazer")) return "trailblazer.png";
  if (n.includes("spark")) return "spark.png";
  if (n.includes("uplifter")) return "uplifter.png";
  if (n.includes("bridge")) return "bridgebuilder.png";
  if (n.includes("steady")) return "steadyhand.png";
  if (n.includes("organis") || n.includes("organizer") || n.includes("organiser")) return "organiser.png";
  if (n.includes("analyst")) return "analyst.png";
  if (n.includes("refiner")) return "refiner.png";
  return "";
}

function resolveImageSrc(
  src: string,
  ctx: { data: ResultData; primaryName: string; secondaryName: string; tertiaryName: string; primaryCode?: string },
) {
  const raw = String(src || "").trim();
  if (!raw) return "";

  if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const lead = isLead(ctx.data);

  const map: Record<string, string> = lead
    ? {
        "{{FREQUENCY_GRID}}": "/images/mindCanvas-LEAD-system/frequency-grid.png",
        "{{PROFILE_GRID}}": "/images/mindCanvas-LEAD-system/profile-grid.png",
        "{{BIO_IMAGE}}": "/images/mindCanvas-LEAD-system/profile-cards/bio-image.png",
        "{{ORG_LOGO}}": "/images/mindCanvas-LEAD-system/org-logo.png",
        "{{DANIEL_IMAGE}}": "/images/mindCanvas-LEAD-system/daniel-acutt.png",
      }
    : {
        "{{FREQUENCY_GRID}}": "/images/operatingframe-full-test/frequency-grid.png",
        "{{PROFILE_GRID}}": "/images/operatingframe-full-test/profile-grid.png",
        "{{BIO_IMAGE}}": "/images/operatingframe-full-test/profile-cards/bio-image.png",
        "{{ORG_LOGO}}": "/images/operatingframe-full-test/org-logo.png",
      };

  if (map[raw]) return map[raw];

  if (raw === "{{PROFILE_IMAGE_PRIMARY}}") {
    if (lead) {
      const f =
        leadProfileFileFromCode(ctx.primaryCode || ctx.data.top_profile_code) || leadProfileFileFromName(ctx.primaryName);
      return f ? `/images/mindCanvas-LEAD-system/profile-cards/${f}` : map["{{BIO_IMAGE}}"];
    }
    const nm = slugify(ctx.primaryName || ctx.data.top_profile_name);
    return `/images/operatingframe-full-test/profile-cards/${nm}.png`;
  }

  if (raw === "{{PROFILE_IMAGE_SECONDARY}}") {
    if (lead) {
      const f = leadProfileFileFromName(ctx.secondaryName);
      return f ? `/images/mindCanvas-LEAD-system/profile-cards/${f}` : "";
    }
    const nm = slugify(ctx.secondaryName);
    return nm ? `/images/operatingframe-full-test/profile-cards/${nm}.png` : "";
  }

  if (raw === "{{PROFILE_IMAGE_TERTIARY}}") {
    if (lead) {
      const f = leadProfileFileFromName(ctx.tertiaryName);
      return f ? `/images/mindCanvas-LEAD-system/profile-cards/${f}` : "";
    }
    const nm = slugify(ctx.tertiaryName);
    return nm ? `/images/operatingframe-full-test/profile-cards/${nm}.png` : "";
  }

  if (!raw.includes("/") && raw.toLowerCase().endsWith(".png")) {
    return lead ? `/images/mindCanvas-LEAD-system/profile-cards/${raw}` : `/images/operatingframe-full-test/profile-cards/${raw}`;
  }

  return raw;
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/5 p-6 ${props.className || ""}`}>{props.children}</div>;
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 text-slate-900 shadow-sm ${props.className || ""}`}>{props.children}</div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

/** ✅ Vertical bar chart (OperatingFrame style) */
function VerticalDriversChart(props: { labels: Array<{ code: AB; name: string }>; pct: Record<AB, number> }) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));

  const barColor = (code: AB) =>
    code === "A" ? "bg-red-500" : code === "B" ? "bg-amber-500" : code === "C" ? "bg-emerald-500" : "bg-blue-500";

  const ticks = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-end gap-4">
        <div className="w-10 shrink-0">
          {ticks.map((t) => (
            <div key={t} className="relative h-7">
              <div className="absolute right-0 top-[-2px] text-[10px] font-semibold text-slate-400">{t}</div>
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="relative h-[308px] rounded-xl border border-slate-200 bg-slate-50">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 border-t border-slate-200/60"
                style={{ top: `${(1 - t / 100) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end justify-around px-6 pb-4">
              {items.map((it) => {
                const h = Math.round(it.v * 100);
                return (
                  <div key={it.code} className="flex w-16 flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-slate-600">{Math.round(it.v * 100)}</div>
                    <div className="relative h-[240px] w-10 rounded-lg bg-white border border-slate-200 overflow-hidden">
                      <div className={`absolute bottom-0 left-0 right-0 ${barColor(it.code)}`} style={{ height: `${h}%` }} />
                    </div>
                    <div className="text-xs font-bold text-slate-900">{it.code}</div>
                    <div className="text-[11px] text-slate-600 text-center leading-tight">{it.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ✅ Profiles-only radar: P1..P8
 * Uses 60% zoom so values don’t bunch near the center.
 */
function ProfileOnlyRadar(props: { profilePct: Record<string, number> }) {
  const labels = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"] as const;

  const rawVal = (p: string) => {
    const asPROFILE = p.replace(/^P/, "PROFILE_");
    return clamp01(props.profilePct[p] ?? props.profilePct[asPROFILE] ?? 0);
  };

  const MAX = 0.6;
  const val = (p: string) => clamp01(rawVal(p) / MAX);

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = 140;

  function pt(i: number, v: number) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * v, y: cy + Math.sin(angle) * r * v };
  }

  const rings = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const pts = labels.map((k, i) => pt(i, val(k)));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";

  const ringLabelY = (rv: number) => cy - r * (rv / MAX);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Your Personality Map (Profiles)</div>
        <div className="text-xs text-slate-500">Higher = stronger pattern</div>
      </div>

      <div className="mt-4 flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rings.map((rv) => (
            <polygon
              key={rv}
              points={labels.map((_, i) => pt(i, clamp01(rv / MAX))).map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(15,23,42,0.12)"
            />
          ))}

          {rings.map((rv) => (
            <text
              key={`lbl-${rv}`}
              x={cx}
              y={ringLabelY(rv)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="rgba(15,23,42,0.45)"
            >
              {Math.round(rv * 100)}%
            </text>
          ))}

          {labels.map((k, i) => {
            const p = pt(i, 1);
            return <line key={k} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(15,23,42,0.12)" />;
          })}

          {labels.map((k, i) => {
            const p = pt(i, 1.12);
            return (
              <text
                key={k}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight={600}
                fill="rgba(15,23,42,0.65)"
              >
                {k}
              </text>
            );
          })}

          <path d={path} fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.9)" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="2" fill="rgba(15,23,42,0.5)" />

          {labels.map((k, i) => {
            const vScaled = val(k);
            const vRaw = rawVal(k);
            const p = pt(i, vScaled);
            const show = vRaw > 0.001;
            const labelPt = pt(i, Math.min(1, vScaled + 0.16));

            return (
              <g key={`pt-${k}`}>
                <circle cx={p.x} cy={p.y} r="3" fill="rgba(20,184,166,0.95)" />
                {show ? (
                  <text
                    x={labelPt.x}
                    y={labelPt.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fill="rgba(15,23,42,0.55)"
                  >
                    {Math.round(vRaw * 100)}%
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function BlockRenderer(props: {
  block: ReportSectionBlock;
  ctx: {
    data: ResultData;
    participant: string;
    orgName: string;
    primaryName: string;
    primaryCode: string;
    secondaryName: string;
    tertiaryName: string;
    topFreqName: string;
    topFreqCode: AB;
    topFreqPct: number;
  };
}) {
  const { block, ctx } = props;
  const type = String((block as any)?.type || "").toLowerCase().trim();

  if (type === "divider") return <hr className="my-6 border-slate-200" />;

  if (type === "spacer") {
    const s = String((block as any)?.size || "md");
    const h = s === "sm" ? "h-3" : s === "lg" ? "h-10" : "h-6";
    return <div className={h} />;
  }

  if (type === "image") {
    const rawSrc = String((block as any)?.src || "").trim();
    if (!rawSrc) return null;

    const src = resolveImageSrc(rawSrc, {
      data: ctx.data,
      primaryName: ctx.primaryName,
      secondaryName: ctx.secondaryName,
      tertiaryName: ctx.tertiaryName,
      primaryCode: ctx.primaryCode,
    });

    const align = (String((block as any)?.align || "center") as any).toLowerCase();
    const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 420;
    const rounded = (block as any)?.rounded === false ? "rounded-lg" : "rounded-2xl";

    return (
      <figure className="my-6">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText((block as any)?.alt)}
            className={`h-auto max-w-full ${rounded} border border-slate-200 bg-white shadow-sm`}
            style={{ maxHeight: maxH }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {(block as any)?.caption ? (
          <figcaption className="mt-2 text-center text-xs text-slate-500">{safeText((block as any)?.caption)}</figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4") return <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText((block as any).text)}</h4>;

  if (type === "p") return <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{safeText((block as any).text)}</p>;

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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm italic text-slate-700">“{t}”</p>
        {cite ? <p className="mt-2 text-xs text-slate-500">— {cite}</p> : null}
      </div>
    );
  }

  if (type === "callout") {
    const tone = String((block as any)?.tone || "neutral").toLowerCase();
    const title = safeText((block as any)?.title).trim();
    const text = safeText((block as any)?.text).trim();
    const bullets = Array.isArray((block as any)?.bullets) ? (block as any).bullets : [];

    const shell =
      tone === "insight"
        ? "border-slate-900/15 bg-slate-900/5"
        : tone === "success"
          ? "border-emerald-800/15 bg-emerald-50"
          : tone === "warning"
            ? "border-amber-800/15 bg-amber-50"
            : "border-slate-200 bg-slate-50";

    return (
      <div className={`rounded-2xl border p-5 ${shell}`}>
        {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}
        {text ? <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{text}</p> : null}
        {bullets.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1">
            {bullets.map((b: any, i: number) => (
              <li key={i}>{safeText(b)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return null;
}

function defaultBlocksForSection(sectionId: string): ReportSectionBlock[] {
  const id = String(sectionId || "").toLowerCase();
  if (id === "global.cta_next_steps") {
    return [{ type: "cta", title: "Next steps", text: "Book your follow-up conversation.", button_text: "Next steps" }];
  }
  return [{ type: "p", text: "This section has not been populated yet." }];
}

export default function NativeBlocksReportClient(props: { token: string; tid: string; src: string; data: ResultData }) {
  const { data } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);
  const orgName = data.org_name || "Organisation";
  const testName = data.test_name || "Test";

  const topFreqCode = data.top_freq;
  const topFreqPct = data.frequency_percentages?.[topFreqCode] ?? 0;
  const topFreqName = data.frequency_labels.find((f) => f.code === topFreqCode)?.name || topFreqCode;

  const sortedProfiles = useMemo(() => {
    return [...data.profile_labels]
      .map((p) => ({ ...p, pct: data.profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [data.profile_labels, data.profile_percentages]);

  const primary = sortedProfiles[0];
  const secondary = sortedProfiles[1];
  const tertiary = sortedProfiles[2];

  const primaryName = cleanProfileName(primary?.name || data.top_profile_name || "Top profile");
  const secondaryName = cleanProfileName(secondary?.name || "");
  const tertiaryName = cleanProfileName(tertiary?.name || "");
  const primaryCode = (primary?.code || data.top_profile_code || "").toUpperCase();

  const orgLogoSrc =
    String(data.org_logo_url || "").trim() ||
    resolveImageSrc("{{ORG_LOGO}}", { data, primaryName, secondaryName, tertiaryName, primaryCode });

  const profileHeroSrc = resolveImageSrc("{{PROFILE_IMAGE_PRIMARY}}", {
    data,
    primaryName,
    secondaryName,
    tertiaryName,
    primaryCode,
  });

  const mergedSections = useMemo(() => {
    const common = (data.sections?.common || []) as ReportSection[];
    const profile = (data.sections?.profile || []) as ReportSection[];
    return [...common, ...profile].filter(Boolean);
  }, [data.sections]);

  const indexItems = useMemo(() => {
    return mergedSections.map((s, i) => {
      const id = getDomId(s, i);
      const title = safeText(s.title).trim() || fallbackTitleFromId(String(s.id || ""), data.top_profile_name);
      return { id, title, rawId: String(s.id || "") };
    });
  }, [mergedSections, data.top_profile_name]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openNextSteps() {
    const direct =
      (data?.link as any)?.redirect_url ||
      (data?.link as any)?.next_steps_url ||
      (data?.link as any)?.meta?.redirect_url ||
      (data?.link as any)?.meta?.next_steps_url ||
      "";

    const url = String(direct || "").trim();
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const hit = indexItems.find((x) => x.rawId === "global.cta_next_steps" || x.title.toLowerCase().includes("next steps"));
    if (hit) scrollToSection(hit.id);
  }

  function downloadPdfViaPrint() {
    window.print();
  }

  const ctx = useMemo(() => {
    return {
      data,
      participant,
      orgName,
      primaryName,
      primaryCode,
      secondaryName,
      tertiaryName,
      topFreqName,
      topFreqCode,
      topFreqPct,
    };
  }, [data, participant, orgName, primaryName, primaryCode, secondaryName, tertiaryName, topFreqName, topFreqCode, topFreqPct]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  {orgLogoSrc ? (
                    <img
                      src={orgLogoSrc}
                      alt={orgName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Organisation</div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">{orgName}</div>

                  <div className="mt-3 text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Test Name</div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">{testName}</div>
                </div>
              </div>

              <h1 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight">
                Personalised Report for <span className="text-white/90">{participant}</span>
              </h1>

              <div className="mt-3 grid gap-2">
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">Top Profile:</span> {primaryName}
                </div>
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">Top Frequency:</span> {topFreqName} ({topFreqCode}) · {pctLabel(topFreqPct)}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
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
                  Next Steps
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{primaryCode}</Badge>
                {secondaryName ? <Badge>Secondary: {secondaryName}</Badge> : null}
                {tertiaryName ? <Badge>Tertiary: {tertiaryName}</Badge> : null}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="h-[140px] w-[140px] md:h-[160px] md:w-[160px] rounded-[28px] bg-white/10 border border-white/15 overflow-hidden shadow-sm">
                {profileHeroSrc ? (
                  <img
                    src={profileHeroSrc}
                    alt={primaryName}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* ✅ OperatingFrame-style snapshot cards */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <WhiteCard>
              <div className="text-sm font-semibold text-slate-900">Drivers</div>
              <div className="mt-2 text-sm text-slate-700">
                The four Drivers show the behavioural energy you use most often. Higher scores are patterns you access more naturally;
                lower scores are patterns you may need to be more intentional about.
              </div>
              <div className="mt-4">
                <VerticalDriversChart labels={data.frequency_labels} pct={data.frequency_percentages} />
              </div>
            </WhiteCard>

            <WhiteCard>
              <div className="text-sm font-semibold text-slate-900">Profile Map</div>
              <div className="mt-2 text-sm text-slate-700">
                This map shows your overall pattern across Profiles. It helps you see what you naturally lean on (strength), and what may
                require support or structure (risk).
              </div>
              <div className="mt-4">
                <ProfileOnlyRadar profilePct={data.profile_percentages} />
              </div>
            </WhiteCard>
          </div>
        </GlassCard>

        {/* BODY: Index + Sections */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4 sticky top-6 self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Index</p>
            <p className="mt-1 text-xs text-slate-300">Jump straight to what you need.</p>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    const el = document.getElementById(s.id);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
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
              const domId = getDomId(section, idx);
              const title = safeText(section.title).trim() || fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              const rawId = String(section.id || "").trim();
              const blocks = Array.isArray(section.blocks) ? section.blocks : [];
              const finalBlocks = blocks.length ? blocks : defaultBlocksForSection(rawId);

              return (
                <section key={domId} id={domId} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                    <div className="mt-4 space-y-3">
                      {finalBlocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} />
                      ))}
                    </div>
                  </WhiteCard>
                </section>
              );
            })}

            <div className="pt-2">
              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Next Steps
              </button>
            </div>

            <footer className="pt-4 text-xs text-slate-400">© {new Date().getFullYear()} Powered by Profiletest.ai</footer>
          </main>
        </div>
      </div>
    </div>
  );
}