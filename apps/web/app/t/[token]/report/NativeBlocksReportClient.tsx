// apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
"use client";

import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
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
  | { type: "spacer"; size?: "sm" | "md" | "lg" }
  | { type: "h1" | "h2" | "h3" | "h4"; text?: string }
  | {
      type: "image";
      src?: string;
      alt?: string;
      caption?: string;
      align?: "left" | "center" | "right";
      max_h?: number;
      // optional extra styling knobs
      rounded?: "none" | "md" | "xl" | "full";
      shadow?: boolean;
    }
  // Premium blocks
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
  // charts (support both old/new names safely)
  | { type: "chart.frequency_bars" | "chart.frequency_bars_v2" | "chart.frequency_bars_old" }
  | { type: "chart.profile_bars" }
  | { type: "chart.profile_radar" }
  // OperatingFrame specific
  | { type: "profiles.triad_cards" }
  | {
      type: "images.pair";
      left_src?: string;
      right_src?: string;
      left_caption?: string;
      right_caption?: string;
    }
  | { type: "cta"; title?: string; text?: string; button_text?: string }
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

// -------------------- helpers --------------------

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

function stripDoublePrefix(name: string) {
  // fixes: "P1: P1: Activator" or "P1: Activator" repeated
  let s = (name || "").trim();
  // collapse "P#: P#: "
  s = s.replace(/^P(\d)\s*:\s*P\1\s*:\s*/i, "P$1: ");
  // collapse "P#: P#: " (alternate punctuation)
  s = s.replace(/^P(\d)\s*-\s*P\1\s*-\s*/i, "P$1: ");
  return s;
}

function fallbackTitleFromId(id: string, topProfileName: string) {
  const k = String(id || "").toLowerCase();

  if (k === "global.cover") return "Your personalised report";
  if (k === "global.welcome_letter") return "Welcome";
  if (k === "global.summary_dashboard") return "What this report includes";
  if (k === "global.how_to_use") return "How to use this report";
  if (k === "global.framework_explainer") return "How OperatingFrame™ works";
  if (k === "global.conclusion") return "Conclusion";
  if (k === "global.cta_next_steps") return "Next steps";

  if (k === "profile.identity") return stripDoublePrefix(topProfileName) || "Your Primary Profile";
  if (k === "profile.strengths") return "Strengths";
  if (k === "profile.development_areas") return "Development Areas";
  if (k === "profile.communication_style") return "Communication Style";
  if (k === "profile.reflection_questions") return "Reflection Questions";
  if (k === "profile.collaboration") return "Collaboration";

  if (k === "segmentation-responses") return "Your responses";

  if (k.startsWith("profile.")) return k.replace("profile.", "").replaceAll("_", " ");
  if (k.startsWith("global.")) return k.replace("global.", "").replaceAll("_", " ");
  return "Section";
}

// -------------------- image resolution --------------------

const OF_BASE = "/images/operatingframe-full-test";
const PROFILE_CARD_BASE = `${OF_BASE}/profile-cards`;

const profileCodeToSlug: Record<string, string> = {
  PROFILE_1: "activator",
  PROFILE_2: "messenger",
  PROFILE_3: "relator",
  PROFILE_4: "integrator",
  PROFILE_5: "operator",
  PROFILE_6: "planner",
  PROFILE_7: "evaluator",
  PROFILE_8: "vision-engineer",
};

function profileImageFromCode(code: string | undefined | null) {
  const key = String(code || "").trim().toUpperCase();
  const slug = profileCodeToSlug[key];
  if (!slug) return "";
  return `${PROFILE_CARD_BASE}/${slug}.png`;
}

function resolveImageSrc(raw: string, ctx: {
  orgSlug: string;
  primaryCode: string;
  secondaryCode?: string;
  tertiaryCode?: string;
}) {
  const src = (raw || "").trim();
  if (!src) return "";

  // already absolute / public path
  if (src.startsWith("/") || src.startsWith("http://") || src.startsWith("https://")) return src;

  // macro replacements
  const map: Record<string, string> = {
    "{{FREQUENCY_GRID}}": `${OF_BASE}/frequency-grid.png`,
    "{{PROFILE_GRID}}": `${OF_BASE}/profile-grid.png`,
    "{{BIO_IMAGE}}": `${OF_BASE}/bio-image.png`,
    "{{ORG_LOGO}}": `${OF_BASE}/logo.png`, // keep this file in public
    "{{PROFILE_IMAGE_PRIMARY}}": profileImageFromCode(ctx.primaryCode),
    "{{PROFILE_IMAGE_SECONDARY}}": profileImageFromCode(ctx.secondaryCode || ""),
    "{{PROFILE_IMAGE_TERTIARY}}": profileImageFromCode(ctx.tertiaryCode || ""),
  };

  if (map[src]) return map[src];

  // allow simple filenames to resolve into OperatingFrame folder
  if (src.endsWith(".png") || src.endsWith(".jpg") || src.endsWith(".jpeg") || src.endsWith(".webp")) {
    return `${OF_BASE}/${src}`;
  }

  return src;
}

// -------------------- premium primitives --------------------

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function GlassCard(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-6 md:p-7 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function WhiteCard(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-6 md:p-7 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
      {children}
    </span>
  );
}

// -------------------- charts & visuals --------------------

const freqColor: Record<AB, string> = {
  A: "#EF4444", // red
  B: "#F59E0B", // yellow/amber
  C: "#22C55E", // green
  D: "#3B82F6", // blue
};

function FrequencyBarsColored(props: {
  labels: Array<{ code: AB; name: string }>;
  pct: Record<AB, number>;
  top: AB;
}) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const max = Math.max(...items.map((i) => i.v), 0.01);

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.top;
        const color = freqColor[it.code];

        return (
          <div key={it.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {it.code}
                  </span>

                  <span className="text-sm font-semibold text-slate-900">
                    {it.name} <span className="text-slate-500">({it.code})</span>
                  </span>

                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Dominant
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 h-2.5 w-full rounded-full bg-white">
                  <div className="h-2.5 rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-700">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProfileBars(props: {
  labels: Array<{ code: string; name: string }>;
  pct: Record<string, number>;
  topCode: string;
}) {
  const items = props.labels
    .map((p) => ({ ...p, v: clamp01(props.pct?.[p.code] ?? 0) }))
    .sort((a, b) => (b.v || 0) - (a.v || 0));

  const max = Math.max(...items.map((i) => i.v), 0.01);

  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.topCode;
        const rank = idx + 1;

        return (
          <div key={it.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {rank}
                  </span>

                  <span className="truncate text-sm font-semibold text-slate-900">{stripDoublePrefix(it.name)}</span>

                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Primary
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 h-2.5 w-full rounded-full bg-white">
                  <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${w}%` }} />
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-700">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProfileRadar(props: {
  values: Array<{ code: string; label: string; value: number }>;
  title?: string;
  subtitle?: string;
}) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const R = 115;

  const pts = props.values.map((v, i) => {
    const a = (Math.PI * 2 * i) / props.values.length - Math.PI / 2;
    const r = R * clamp01(v.value);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), a };
  });

  const polygon = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{props.title || "Profile map"}</div>
          {props.subtitle ? <p className="mt-2 text-sm text-slate-600 max-w-md">{props.subtitle}</p> : null}
        </div>
        <div className="text-xs text-slate-500">Profiles-only map</div>
      </div>

      <div className="mt-6 flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* rings */}
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <circle key={t} cx={cx} cy={cy} r={R * t} fill="none" stroke="#E5E7EB" />
          ))}

          {/* axes + labels */}
          {props.values.map((v, i) => {
            const a = (Math.PI * 2 * i) / props.values.length - Math.PI / 2;
            const x2 = cx + R * Math.cos(a);
            const y2 = cy + R * Math.sin(a);

            const lx = cx + (R + 18) * Math.cos(a);
            const ly = cy + (R + 18) * Math.sin(a);

            return (
              <g key={v.code}>
                <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#E5E7EB" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill="#111827"
                  fontWeight="600"
                >
                  {v.label}
                </text>
              </g>
            );
          })}

          {/* polygon */}
          <polygon points={polygon} fill="rgba(37, 99, 235, 0.18)" stroke="#2563EB" strokeWidth="2" />
          {pts.map((p, idx) => (
            <circle key={idx} cx={p.x} cy={p.y} r={4.5} fill="#2563EB" />
          ))}
        </svg>
      </div>

      <div className="mt-2 text-xs text-slate-500 text-center">Higher = stronger pattern.</div>
    </div>
  );
}

// -------------------- triad cards --------------------

const profileSummary: Record<string, string> = {
  PROFILE_1: "Decisive, action-oriented initiator who drives momentum and breaks inertia.",
  PROFILE_2: "Influential communicator who aligns people through clarity, presence, and energy.",
  PROFILE_3: "Relationship-first stabiliser who builds trust and keeps teams connected under pressure.",
  PROFILE_4: "Connector of people and process who creates cohesion, rhythm, and alignment.",
  PROFILE_5: "Practical executor who builds reliability, delivers outcomes, and improves follow-through.",
  PROFILE_6: "Structured organiser who plans, creates order, and enables predictable execution.",
  PROFILE_7: "Critical thinker who improves decisions through insight, quality control, and precision.",
  PROFILE_8: "Strategic architect who designs systems and long-term direction with clarity and depth.",
};

function RolePill({ children, tone }: { children: ReactNode; tone: "primary" | "support"; }) {
  const cls =
    tone === "primary"
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-900 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function TriadCards(props: {
  ctx: {
    primary: { code: string; name: string; pct: number };
    secondary?: { code: string; name: string; pct: number };
    tertiary?: { code: string; name: string; pct: number };
  };
}) {
  const items = [
    { slot: "Primary profile", rank: 1, tone: "primary" as const, data: props.ctx.primary },
    props.ctx.secondary ? { slot: "Secondary", rank: 2, tone: "support" as const, data: props.ctx.secondary } : null,
    props.ctx.tertiary ? { slot: "Tertiary", rank: 3, tone: "support" as const, data: props.ctx.tertiary } : null,
  ].filter(Boolean) as Array<{ slot: string; rank: number; tone: "primary" | "support"; data: { code: string; name: string; pct: number } }>;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it) => {
          const img = profileImageFromCode(it.data.code);
          const name = stripDoublePrefix(it.data.name);
          const pct = clamp01(it.data.pct);
          const summary = profileSummary[it.data.code] || "A distinct pattern of contribution in the OperatingFrame model.";

          // subtle colour accents
          const accent =
            it.rank === 1 ? "border-slate-900/15 bg-white" : it.rank === 2 ? "border-sky-200 bg-sky-50/40" : "border-emerald-200 bg-emerald-50/40";

          return (
            <div key={it.slot} className={`rounded-3xl border p-4 md:p-5 ${accent}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {it.slot}
                </div>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {it.rank}
                </span>
              </div>

              <div className="mt-3 flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {img ? (
                    <img src={img} alt={name} className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="text-lg font-bold text-slate-900 leading-snug">{name}</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-500">{it.data.code}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">{pctLabel(pct)} match</div>
                <RolePill tone={it.tone}>{it.tone === "primary" ? "Primary" : "Supporting"}</RolePill>
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-white">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.round(pct * 100)}%` }} />
              </div>

              <p className="mt-3 text-sm text-slate-700 leading-relaxed">{summary}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center text-xs text-slate-500">
        Primary profile: <span className="font-semibold text-slate-700">{stripDoublePrefix(props.ctx.primary.name)}</span>
      </div>
    </div>
  );
}

// -------------------- BlockRenderer --------------------

function BlockRenderer(props: {
  block: ReportSectionBlock;
  ctx: {
    data: ResultData;
    participant: string;
    orgName: string;
    testName: string;

    topFreqName: string;
    topFreqCode: AB;
    topFreqPct: number;

    primary: { code: string; name: string; pct: number };
    secondary?: { code: string; name: string; pct: number };
    tertiary?: { code: string; name: string; pct: number };
  };
}) {
  const { block, ctx } = props;
  const type = String((block as any)?.type || "").toLowerCase();

  if (type === "divider") return <hr className="my-6 border-slate-200" />;

  if (type === "spacer") {
    const s = String((block as any)?.size || "md");
    const h = s === "sm" ? "h-3" : s === "lg" ? "h-10" : "h-6";
    return <div className={h} />;
  }

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4") {
    return (
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {safeText((block as any).text)}
      </h4>
    );
  }

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
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-sm italic text-slate-700">“{t}”</p>
        {cite ? <p className="mt-2 text-xs text-slate-500">— {cite}</p> : null}
      </div>
    );
  }

  if (type === "image") {
    const rawSrc = String((block as any)?.src || "").trim();
    if (!rawSrc) return null;

    const align = (String((block as any)?.align || "center") as any).toLowerCase();
    const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 520;
    const rounded = String((block as any)?.rounded || "xl").toLowerCase();
    const shadow = Boolean((block as any)?.shadow ?? true);

    const rcls =
      rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-xl" : rounded === "none" ? "rounded-none" : "rounded-3xl";

    const src = resolveImageSrc(rawSrc, {
      orgSlug: ctx.data.org_slug,
      primaryCode: ctx.primary.code,
      secondaryCode: ctx.secondary?.code,
      tertiaryCode: ctx.tertiary?.code,
    });

    return (
      <figure className="my-6">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText((block as any)?.alt)}
            crossOrigin="anonymous"
            className={`h-auto max-w-full ${rcls} border border-slate-200 bg-white ${shadow ? "shadow-sm" : ""}`}
            style={{ maxHeight: maxH }}
            onError={(e) => {
              // hide broken image
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

  // callout
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
      <div className={`rounded-3xl border p-6 ${shell}`}>
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

  // chips
  if (type === "chips") {
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    if (!items.length) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((it: any, i: number) => (
          <span
            key={i}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
          >
            {safeText(it)}
          </span>
        ))}
      </div>
    );
  }

  // cards
  if (type === "cards") {
    const columnsRaw = Number((block as any)?.columns || 2);
    const columns = columnsRaw === 1 ? 1 : columnsRaw === 3 ? 3 : 2;
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    const grid =
      columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2";

    return (
      <div className={`grid gap-3 ${grid}`}>
        {items.map((it: any, idx: number) => {
          const tone = String(it?.tone || "light").toLowerCase();
          const shell =
            tone === "glass"
              ? "border-white/10 bg-slate-900 text-white"
              : tone === "dark"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900";

          return (
            <div key={idx} className={`rounded-3xl border p-6 ${shell}`}>
              {it?.title ? (
                <div className={`text-sm font-semibold ${tone === "light" ? "text-slate-900" : "text-white"}`}>
                  {safeText(it.title)}
                </div>
              ) : null}
              {it?.text ? (
                <p className={`mt-2 text-sm leading-relaxed ${tone === "light" ? "text-slate-700" : "text-white/80"}`}>
                  {safeText(it.text)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  // scorecard row
  if (type === "scorecard_row") {
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    if (!items.length) return null;
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{safeText(it?.label)}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{safeText(it?.value)}</div>
            {it?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(it.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  // OperatingFrame: triad cards inside profile.identity
  if (type === "profiles.triad_cards") {
    return (
      <TriadCards
        ctx={{
          primary: ctx.primary,
          secondary: ctx.secondary,
          tertiary: ctx.tertiary,
        }}
      />
    );
  }

  // Images side-by-side block
  if (type === "images.pair") {
    const left = resolveImageSrc(String((block as any)?.left_src || ""), {
      orgSlug: ctx.data.org_slug,
      primaryCode: ctx.primary.code,
      secondaryCode: ctx.secondary?.code,
      tertiaryCode: ctx.tertiary?.code,
    });
    const right = resolveImageSrc(String((block as any)?.right_src || ""), {
      orgSlug: ctx.data.org_slug,
      primaryCode: ctx.primary.code,
      secondaryCode: ctx.secondary?.code,
      tertiaryCode: ctx.tertiary?.code,
    });

    if (!left && !right) return null;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          {left ? (
            <img src={left} alt={safeText((block as any)?.left_caption)} className="w-full rounded-2xl border border-slate-200" />
          ) : null}
          {(block as any)?.left_caption ? (
            <div className="mt-2 text-xs text-slate-500 text-center">{safeText((block as any).left_caption)}</div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          {right ? (
            <img
              src={right}
              alt={safeText((block as any)?.right_caption)}
              className="w-full rounded-2xl border border-slate-200"
            />
          ) : null}
          {(block as any)?.right_caption ? (
            <div className="mt-2 text-xs text-slate-500 text-center">{safeText((block as any).right_caption)}</div>
          ) : null}
        </div>
      </div>
    );
  }

  // charts
  if (type === "chart.frequency_bars" || type === "chart.frequency_bars_v2" || type === "chart.frequency_bars_old") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-900">Frequency</div>
          <div className="text-xs text-slate-500">Higher = more natural energy</div>
        </div>
        <div className="mt-4">
          <FrequencyBarsColored labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-900">Profiles</div>
          <div className="text-xs text-slate-500">Primary + supporting</div>
        </div>
        <div className="mt-4">
          <ProfileBars labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_radar") {
    const values = ctx.data.profile_labels
      .map((p) => ({ code: p.code, label: p.code.replace("PROFILE_", "P"), value: clamp01(ctx.data.profile_percentages?.[p.code] ?? 0) }))
      .sort((a, b) => {
        // keep P1..P8 order if possible
        const ai = Number(a.label.replace("P", "")) || 999;
        const bi = Number(b.label.replace("P", "")) || 999;
        return ai - bi;
      });

    return (
      <ProfileRadar
        values={values}
        title={stripDoublePrefix(ctx.primary.name)}
        subtitle="This visual map shows how your overall Operating Style is distributed across the model. Higher values show patterns you naturally use more often."
      />
    );
  }

  // CTA
  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text =
      safeText((block as any)?.text).trim() ||
      "Turn insight into action: use this report in a coaching conversation, a 1:1, or a team workshop.";
    const btn = safeText((block as any)?.button_text).trim() || "Next steps";

    // ✅ Must use redirect_url first (per your requirement)
    const url = (ctx.data?.link?.redirect_url || ctx.data?.link?.next_steps_url || "").trim();

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-900 p-7 text-white">
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-white/80">{text}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {url ? (
            <button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              {btn}
            </button>
          ) : (
            <span className="text-xs text-white/70">No redirect_url is configured for this link.</span>
          )}
        </div>
      </div>
    );
  }

  // Unknown fallback
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold text-amber-900">
        Unsupported block type: {String((block as any).type || "unknown")}
      </p>
    </div>
  );
}

// -------------------- default blocks (only when DB blocks empty) --------------------

function defaultBlocksForSection(sectionId: string): ReportSectionBlock[] {
  const id = String(sectionId || "").toLowerCase();

  if (id === "global.cover") {
    return [
      {
        type: "callout",
        tone: "insight",
        title: "Your report at a glance",
        text: "This report gives you a practical language for how you lead, decide, communicate, and execute. Use it to apply your strengths on purpose and spot the patterns that trip you up under pressure.",
      },
      {
        type: "quote",
        cite: "OperatingFrame™",
        text: "The goal isn’t to put you in a box. It’s to give you leverage: clarity, self-awareness, and a repeatable way to improve how you work with others.",
      },
    ];
  }

  if (id === "global.summary_dashboard") {
    return [
      { type: "p", text: "Your results include two layers:" },
      {
        type: "ul",
        items: [
          "Frequencies (A–D): your broad operating energy—how you tend to think, decide, and move work forward under pressure.",
          "Profiles (1–8): your more specific leadership pattern—how your Frequencies combine into a recognisable style.",
        ],
      },
      {
        type: "p",
        text: "You’ll see a dominant Frequency, a Primary Profile, and supporting Secondary and Tertiary Profiles. Higher percentages indicate patterns you use more often and with less effort.",
      },
      {
        type: "ul",
        items: [
          "Primary profile = your default under pressure.",
          "Secondary profile = the pattern that supports you day-to-day.",
          "Tertiary profile = a backup style you can access when needed.",
        ],
      },
    ];
  }

  if (id === "global.framework_explainer") {
    return [
      {
        type: "p",
        text: "OperatingFrame™ is built on four behavioural Drivers (Frequencies) that show where you naturally place attention and energy.",
      },
      {
        type: "ul",
        items: [
          "A: Direction — Vision, decisiveness, future-focus, creating momentum.",
          "B: Connection — People, influence, communication, motivation and energy.",
          "C: Structure — Process, rhythm, reliability, execution and follow-through.",
          "D: Precision — Insight, analysis, accuracy, depth and quality.",
        ],
      },
      {
        type: "p",
        text: "Those Drivers combine into eight Profiles—distinct patterns of contribution. Your profile mix explains how you typically lead, communicate, and execute.",
      },
      {
        type: "ul",
        items: [
          "Activator (A+B): decisive, energetic initiator who gets things moving quickly.",
          "Messenger (A+B): inspires and aligns people through communication and presence.",
          "Relator (B+C): relationship-first stabiliser who builds trust and keeps teams connected.",
          "Integrator (B+C): connector of people and process; creates alignment and cohesion.",
          "Operator (C+D): practical executor who builds reliability and gets results delivered.",
          "Planner (C+D): structured organiser who brings order, plans, and predictable execution.",
          "Evaluator (D+A): critical thinker who improves decisions through insight and quality control.",
          "Vision Engineer (D+A): strategic architect who designs systems and long-term direction.",
        ],
      },
      {
        type: "p",
        text: "No profile is ‘better’. Each has strengths, blind spots, and conditions where it performs best. The goal is to use your pattern intentionally—and build compensating habits where needed.",
      },
      {
        type: "images.pair",
        left_src: "{{FREQUENCY_GRID}}",
        right_src: "{{PROFILE_GRID}}",
        left_caption: "The 4 Frequencies (A–D) — your operating drivers.",
        right_caption: "The 8 Profiles — distinct patterns of contribution.",
      },
    ];
  }

  if (id === "global.cta_next_steps") {
    return [{ type: "cta", title: "Next steps", text: "Book your follow-up conversation to walk through your results.", button_text: "Next steps" }];
  }

  // default generic
  return [{ type: "p", text: "This section has not been populated yet." }];
}

// -------------------- component --------------------

export default function NativeBlocksReportClient(props: {
  token: string;
  tid: string;
  src: string;
  data: ResultData;
}) {
  const { data } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);

  // ✅ remove default “Organisation” wording — only show org if it exists
  const orgName = (data.org_name || "").trim();
  const testName = (data.test_name || "Personalised report").trim();

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

  const ctx = useMemo(() => {
    const primaryObj = {
      code: primary?.code || data.top_profile_code,
      name: stripDoublePrefix(primary?.name || data.top_profile_name || "Primary profile"),
      pct: clamp01(primary?.pct ?? data.profile_percentages?.[data.top_profile_code] ?? 0),
    };

    const secondaryObj = secondary
      ? { code: secondary.code, name: stripDoublePrefix(secondary.name), pct: clamp01(secondary.pct ?? 0) }
      : undefined;

    const tertiaryObj = tertiary
      ? { code: tertiary.code, name: stripDoublePrefix(tertiary.name), pct: clamp01(tertiary.pct ?? 0) }
      : undefined;

    return {
      data,
      participant,
      orgName,
      testName,
      topFreqName,
      topFreqCode,
      topFreqPct,
      primary: primaryObj,
      secondary: secondaryObj,
      tertiary: tertiaryObj,
    };
  }, [data, participant, orgName, testName, topFreqName, topFreqCode, topFreqPct, primary, secondary, tertiary]);

  const mergedSections = useMemo(() => {
    const common = (data.sections?.common || []) as ReportSection[];
    const profile = (data.sections?.profile || []) as ReportSection[];
    return [...common, ...profile].filter(Boolean);
  }, [data.sections]);

  const indexItems = useMemo(() => {
    return mergedSections.map((s, i) => {
      const id = getDomId(s, i);
      const title = safeText(s.title).trim() || fallbackTitleFromId(String(s.id || ""), ctx.primary.name);
      return { id, title, rawId: String(s.id || "") };
    });
  }, [mergedSections, ctx.primary.name]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openNextSteps() {
    // ✅ Must use redirect link
    const url = (data?.link?.redirect_url || data?.link?.next_steps_url || "").trim();
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

  // Header images
  const orgLogo = resolveImageSrc("{{ORG_LOGO}}", {
    orgSlug: data.org_slug,
    primaryCode: ctx.primary.code,
    secondaryCode: ctx.secondary?.code,
    tertiaryCode: ctx.tertiary?.code,
  });

  const profileImg = profileImageFromCode(ctx.primary.code);

  // Profile radar data
  const radarValues = useMemo(() => {
    return data.profile_labels
      .map((p) => ({
        code: p.code,
        label: p.code.replace("PROFILE_", "P"),
        value: clamp01(data.profile_percentages?.[p.code] ?? 0),
      }))
      .sort((a, b) => {
        const ai = Number(a.label.replace("P", "")) || 999;
        const bi = Number(b.label.replace("P", "")) || 999;
        return ai - bi;
      });
  }, [data.profile_labels, data.profile_percentages]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO */}
        <GlassCard>
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              {/* Left logo */}
              <div className="h-14 w-14 md:h-16 md:w-16 shrink-0 rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                {orgLogo ? <img src={orgLogo} alt={orgName || testName} className="h-full w-full object-cover" /> : null}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {orgName ? <Pill>{orgName}</Pill> : null}
                  <Pill>{testName}</Pill>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                    Personalised report
                  </div>
                  <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                    Your Operating Style in Depth: {ctx.primary.name}
                  </h1>

                  <p className="mt-2 text-sm text-white/80">
                    For <span className="font-semibold text-white">{participant}</span>
                  </p>

                  <p className="mt-1 text-sm text-white/80">
                    Top profile: <span className="font-semibold text-white">{ctx.primary.name}</span>
                  </p>

                  {/* ✅ Dominant frequency under Top Profile */}
                  <p className="mt-1 text-sm text-white/80">
                    Frequency: <span className="font-semibold text-white">{topFreqName}</span> · {pctLabel(topFreqPct)}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={downloadPdfViaPrint}
                      className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Download PDF
                    </button>

                    <button
                      onClick={openNextSteps}
                      className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                    >
                      Next steps
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right profile image (bigger) */}
            <div className="hidden md:flex flex-col items-end gap-3 shrink-0">
              <div className="h-28 w-28 rounded-3xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                {profileImg ? <img src={profileImg} alt={ctx.primary.name} className="h-24 w-24 object-contain" /> : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Frequency card (kept compact + coloured bars) */}
            <WhiteCard>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Frequency</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{topFreqName}</div>
                  <p className="mt-2 text-sm text-slate-600 max-w-md">
                    Frequencies show how you naturally operate as a leader — where your energy goes under pressure.
                    Higher = more natural, lower = less preferred.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dominant</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{pctLabel(topFreqPct)}</div>
                </div>
              </div>

              <div className="mt-5">
                <FrequencyBarsColored labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            {/* Profile radar card (use top profile name; remove "Primary + supporting") */}
            <ProfileRadar
              values={radarValues}
              title={ctx.primary.name}
              subtitle="This visual map shows how your overall Operating Style is distributed across the model. Higher values show patterns you naturally use more often."
            />
          </div>
        </GlassCard>

        {/* BODY: Index + Sections */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 sticky top-6 self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Index</p>
            <p className="mt-1 text-xs text-slate-300">Jump straight to what you need.</p>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
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
              const title =
                safeText(section.title).trim() ||
                fallbackTitleFromId(String(section.id || ""), ctx.primary.name);

              const rawId = String(section.id || "").trim();
              const blocks = Array.isArray(section.blocks) ? section.blocks : [];
              const hasRealBlocks = blocks.length > 0;

              const finalBlocks = hasRealBlocks ? blocks : defaultBlocksForSection(rawId);

              return (
                <section key={domId} id={domId} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    <h2 className="text-2xl font-bold text-slate-900">{title}</h2>

                    <div className="mt-5 space-y-4">
                      {finalBlocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} />
                      ))}
                    </div>
                  </WhiteCard>
                </section>
              );
            })}

            {/* Bottom CTA (always present, uses redirect_url) */}
            <div className="pt-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <button
                  onClick={openNextSteps}
                  className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Next steps
                </button>
              </div>
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