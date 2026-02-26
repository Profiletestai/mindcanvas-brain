// /apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
"use client";

import React, { useMemo, useRef } from "react";
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
    }
  // ✅ Premium blocks
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
  | { type: "scorecard_row"; items?: Array<{ label: string; value: string; hint?: string }> }
  | { type: "chart.frequency_bars" }
  | { type: "chart.profile_bars" }
  | { type: "chart.profile_radar" } // ✅ NEW: profiles-only radar (Team Puzzle vibe)
  | { type: "profiles.triad_cards" } // ✅ NEW: Primary/Secondary/Tertiary cards
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

  if (k.startsWith("profile.")) return k.replace("profile.", "").replaceAll("_", " ");
  if (k.startsWith("global.")) return k.replace("global.", "").replaceAll("_", " ");
  return "Section";
}

// -------------------- Premium UI primitives --------------------

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-6 md:p-7 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/6 p-6 md:p-7 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent" />;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function TinyLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</div>;
}

// Frequency color map (as per your spec)
const FREQ_COLORS: Record<AB, string> = {
  A: "#ef4444", // red
  B: "#f59e0b", // yellow
  C: "#22c55e", // green
  D: "#3b82f6", // blue
};

// -------------------- Charts --------------------

// ✅ Frequency bars: colored A/B/C/D bars (sexy, minimal)
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

        return (
          <div key={it.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: FREQ_COLORS[it.code] }}
                      title={it.code}
                    >
                      {it.code}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 truncate">{it.name}</span>
                  </div>

                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Dominant
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 h-2.5 w-full rounded-full bg-white">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${w}%`,
                      backgroundColor: FREQ_COLORS[it.code],
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 text-sm font-bold text-slate-700">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ✅ Profile bars: ranked (like your screenshot 1 right side)
function ProfileBarsRanked(props: {
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {rank}
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-900">{it.name}</span>
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

              <div className="shrink-0 text-sm font-bold text-slate-700">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ✅ Profiles-only radar (SVG) - clean + printable
function ProfileRadar(props: {
  labels: Array<{ code: string; name: string }>;
  pct: Record<string, number>;
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 120;
  const rings = 5;

  const points = props.labels.map((p, i) => {
    const v = clamp01(props.pct?.[p.code] ?? 0);
    const angle = (Math.PI * 2 * i) / props.labels.length - Math.PI / 2;
    const r = radius * v;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { ...p, v, x, y, angle };
  });

  const polygon = points.map((pt) => `${pt.x},${pt.y}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
        {/* rings */}
        {Array.from({ length: rings }).map((_, ri) => {
          const r = (radius * (ri + 1)) / rings;
          return (
            <circle
              key={ri}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="rgba(15,23,42,0.10)"
              strokeWidth="1"
            />
          );
        })}

        {/* axes */}
        {points.map((pt, i) => {
          const x2 = cx + radius * Math.cos(pt.angle);
          const y2 = cy + radius * Math.sin(pt.angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke="rgba(15,23,42,0.10)"
              strokeWidth="1"
            />
          );
        })}

        {/* data area */}
        <polygon points={polygon} fill="rgba(2,132,199,0.18)" stroke="rgba(2,132,199,0.85)" strokeWidth="2" />

        {/* points */}
        {points.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="rgba(2,132,199,0.95)" />
        ))}

        {/* labels */}
        {points.map((pt, i) => {
          const lx = cx + (radius + 20) * Math.cos(pt.angle);
          const ly = cy + (radius + 20) * Math.sin(pt.angle);
          const anchor = Math.abs(Math.cos(pt.angle)) < 0.2 ? "middle" : Math.cos(pt.angle) > 0 ? "start" : "end";
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="11"
              fill="rgba(15,23,42,0.85)"
              style={{ fontWeight: 600 }}
            >
              {pt.code.replace("PROFILE_", "P")}
            </text>
          );
        })}
      </svg>

      <div className="mt-3 text-xs text-slate-500">
        Profiles-only map (higher = stronger pattern).
      </div>
    </div>
  );
}

// ✅ Triad cards (Primary / Secondary / Tertiary) – “Team Puzzle vibe”
function TriadCards(props: {
  primary?: { code: string; name: string; v: number };
  secondary?: { code: string; name: string; v: number };
  tertiary?: { code: string; name: string; v: number };
}) {
  const items = [
    props.primary ? { ...props.primary, label: "Primary profile", rank: 1 } : null,
    props.secondary ? { ...props.secondary, label: "Secondary", rank: 2 } : null,
    props.tertiary ? { ...props.tertiary, label: "Tertiary", rank: 3 } : null,
  ].filter(Boolean) as Array<{ code: string; name: string; v: number; label: string; rank: number }>;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((it) => (
        <div key={it.code} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <TinyLabel>{it.label}</TinyLabel>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {it.rank}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-xl font-bold text-slate-900">{it.name}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{it.code}</div>
            <div className="mt-3 text-sm font-semibold text-slate-900">{pctLabel(it.v)} match</div>

            <div className="mt-3 h-2.5 w-full rounded-full bg-slate-200">
              <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${Math.round(clamp01(it.v) * 100)}%` }} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Strengths
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Motivators
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Watch-outs
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// -------------------- Block rendering --------------------

function BlockRenderer(props: {
  block: ReportSectionBlock;
  ctx: {
    data: ResultData;
    participant: string;
    orgName: string;
    primaryName: string;
    secondaryName: string;
    tertiaryName: string;
    topFreqName: string;
    sortedProfiles: Array<{ code: string; name: string; v: number }>;
  };
}) {
  const { block, ctx } = props;
  const type = String((block as any)?.type || "").toLowerCase();

  if (type === "divider") return <hr className="my-7 border-slate-200" />;

  if (type === "spacer") {
    const s = String((block as any)?.size || "md");
    const h = s === "sm" ? "h-3" : s === "lg" ? "h-12" : "h-7";
    return <div className={h} />;
  }

  if (type === "image") {
    const src = String((block as any)?.src || "").trim();
    if (!src) return null;

    const align = (String((block as any)?.align || "center") as any).toLowerCase();
    const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 520;

    return (
      <figure className="my-7">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText((block as any)?.alt)}
            crossOrigin="anonymous"
            className="h-auto max-w-full rounded-3xl border border-slate-200 bg-white shadow-sm"
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

  if (type === "h1") return <h1 className="text-3xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4")
    return <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText((block as any).text)}</h4>;

  if (type === "p") {
    const t = safeText((block as any).text);
    return <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{t}</p>;
  }

  if (type === "ul") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1.5">
        {items.map((it: any, i: number) => (
          <li key={i}>{safeText(it)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1.5">
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

  // callout
  if (type === "callout") {
    const tone = String((block as any)?.tone || "neutral").toLowerCase();
    const title = safeText((block as any)?.title).trim();
    const text = safeText((block as any)?.text).trim();
    const bullets = Array.isArray((block as any)?.bullets) ? (block as any).bullets : [];

    const shell =
      tone === "insight"
        ? "border-sky-900/10 bg-sky-50"
        : tone === "success"
          ? "border-emerald-900/10 bg-emerald-50"
          : tone === "warning"
            ? "border-amber-900/10 bg-amber-50"
            : "border-slate-200 bg-slate-50";

    return (
      <div className={`rounded-3xl border p-6 ${shell}`}>
        {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}
        {text ? <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{text}</p> : null}
        {bullets.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1.5">
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
          <span key={i} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
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
          <div key={idx} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{safeText(it?.label)}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{safeText(it?.value)}</div>
            {it?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(it.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  // charts
  if (type === "chart.frequency_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Frequency</div>
            <div className="text-xs text-slate-500">Your energy distribution</div>
          </div>
          <div className="text-xs text-slate-500">A · B · C · D</div>
        </div>
        <div className="mt-5">
          <FrequencyBarsColored labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Profile mix</div>
            <div className="text-xs text-slate-500">Primary + supporting patterns</div>
          </div>
          <div className="text-xs text-slate-500">Ranked</div>
        </div>
        <div className="mt-5">
          <ProfileBarsRanked labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_radar") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Profile matrix</div>
            <div className="text-xs text-slate-500">Profiles only (Team Puzzle style)</div>
          </div>
          <div className="text-xs text-slate-500">Higher = stronger</div>
        </div>
        <div className="mt-4">
          <ProfileRadar labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} />
        </div>
      </div>
    );
  }

  if (type === "profiles.triad_cards") {
    const p = ctx.sortedProfiles[0];
    const s = ctx.sortedProfiles[1];
    const t = ctx.sortedProfiles[2];
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
        <TriadCards primary={p} secondary={s} tertiary={t} />
      </div>
    );
  }

  // CTA
  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text = safeText((block as any)?.text).trim() || "Book a follow-up to walk through your results and turn insight into action.";
    const btn = safeText((block as any)?.button_text).trim() || "Book a discussion";
    const url = (ctx.data?.link?.next_steps_url || "").trim();

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-900 p-7 text-white">
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-white/80 whitespace-pre-line">{text}</p>
        <div className="mt-6">
          {url ? (
            <button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              {btn}
            </button>
          ) : (
            <span className="text-xs text-white/70">No next_steps_url is configured for this link.</span>
          )}
        </div>
      </div>
    );
  }

  // Unknown fallback
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">Unsupported block type: {String((block as any).type || "unknown")}</p>
    </div>
  );
}

// -------------------- Default content injection (only used if a section accidentally has no blocks) --------------------

function defaultBlocksForSection(sectionId: string): ReportSectionBlock[] {
  const id = String(sectionId || "").toLowerCase();
  if (id === "global.summary_dashboard") {
    return [
      { type: "chart.frequency_bars" },
      { type: "spacer", size: "md" },
      { type: "chart.profile_bars" },
      { type: "spacer", size: "md" },
      { type: "chart.profile_radar" },
      { type: "spacer", size: "md" },
      { type: "profiles.triad_cards" },
    ];
  }
  return [{ type: "p", text: "This section is missing content blocks." }];
}

// -------------------- Component --------------------

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

  const sortedProfiles = useMemo(() => {
    return [...data.profile_labels]
      .map((p) => ({ code: p.code, name: p.name, v: clamp01(data.profile_percentages?.[p.code] ?? 0) }))
      .sort((a, b) => (b.v || 0) - (a.v || 0));
  }, [data.profile_labels, data.profile_percentages]);

  const primary = sortedProfiles[0];
  const secondary = sortedProfiles[1];
  const tertiary = sortedProfiles[2];

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
    const url = (data?.link?.next_steps_url || "").trim();
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
      primaryName: primary?.name || data.top_profile_name || "Primary profile",
      secondaryName: secondary?.name || "",
      tertiaryName: tertiary?.name || "",
      topFreqName,
      sortedProfiles,
    };
  }, [data, participant, orgName, primary?.name, secondary?.name, tertiary?.name, topFreqName, sortedProfiles]);

  const freqDesc =
    "Frequencies show how you naturally operate as a leader — where your energy goes under pressure. Higher = more natural, lower = less preferred.";
  const profileDesc =
    "Profiles describe your execution pattern — how your leadership behaviour shows up day to day. Your mix shows primary and supporting styles.";

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO / HEADER */}
        <GlassCard className="shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>OperatingFrame™ Report</Badge>
                <Badge>{orgName}</Badge>
                <Badge>{participant}</Badge>
              </div>

              <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{reportTitle}</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>
                  Dominant Frequency: <span className="ml-1 font-bold text-white">{topFreqName}</span> ({topFreqCode}) ·{" "}
                  <span className="ml-1 font-bold text-white">{pctLabel(topFreqPct)}</span>
                </Pill>
                <Pill>
                  Primary Profile: <span className="ml-1 font-bold text-white">{primary?.name || data.top_profile_name}</span>
                </Pill>
                {secondary?.name ? <Pill>Secondary: <span className="ml-1 font-bold text-white">{secondary.name}</span></Pill> : null}
                {tertiary?.name ? <Pill>Tertiary: <span className="ml-1 font-bold text-white">{tertiary.name}</span></Pill> : null}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadPdfViaPrint}
                className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Download PDF
              </button>

              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-xl border border-white/18 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                Next steps
              </button>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* === The exact “Screenshot 1 header style” === */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <WhiteCard>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <TinyLabel>Frequency + Profile</TinyLabel>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {topFreqName} <span className="text-slate-500">({topFreqCode})</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{freqDesc}</div>
                </div>

                <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dominant</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{pctLabel(topFreqPct)}</div>
                </div>
              </div>

              <div className="mt-5">
                <FrequencyBarsColored labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            <WhiteCard>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <TinyLabel>Profile mix</TinyLabel>
                  <div className="mt-2 text-lg font-bold text-slate-900">Primary + supporting</div>
                  <div className="mt-2 text-sm text-slate-700">{profileDesc}</div>
                </div>
              </div>

              <div className="mt-5">
                <ProfileRadar labels={data.profile_labels} pct={data.profile_percentages} />
              </div>
            </WhiteCard>
          </div>

          {/* Triad cards in header (Team Puzzle style) */}
          <div className="mt-5">
            <TriadCards primary={primary} secondary={secondary} tertiary={tertiary} />
          </div>
        </GlassCard>

        {/* BODY: Index + Sections */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/6 p-4 sticky top-6 self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Index</p>
            <p className="mt-1 text-xs text-slate-300">Jump straight to what you need.</p>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
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
                fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              const rawId = String(section.id || "").trim();
              const blocks = Array.isArray(section.blocks) ? section.blocks : [];
              const finalBlocks = blocks.length ? blocks : defaultBlocksForSection(rawId);

              return (
                <section key={domId} id={domId} className="rounded-3xl border border-white/10 bg-white/6 p-5">
                  <WhiteCard>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {rawId || "section"}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {finalBlocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} />
                      ))}
                    </div>
                  </WhiteCard>
                </section>
              );
            })}

            {/* Bottom CTA */}
            <div className="pt-2">
              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-xl border border-white/18 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                Next steps
              </button>
            </div>

            <footer className="pt-4 text-xs text-slate-400">© {new Date().getFullYear()} Powered by Profiletest.ai</footer>
          </main>
        </div>
      </div>
    </div>
  );
}