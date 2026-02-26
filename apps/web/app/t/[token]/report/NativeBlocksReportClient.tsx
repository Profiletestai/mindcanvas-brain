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
  | {
      type: "scorecard_row";
      items?: Array<{ label: string; value: string; hint?: string }>;
    }
  | { type: "chart.frequency_bars" }
  | { type: "chart.profile_bars" }
  // ✅ NEW: sexy charts (your screenshots)
  | { type: "chart.frequency_color_bars" } // A red, B yellow, C green, D blue
  | { type: "chart.profile_radar" } // profiles-only radar
  // ✅ NEW: Team Puzzle style triad cards (Primary/Secondary/Tertiary) – place under profile.identity
  | { type: "profiles.triad_cards" }
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
  return s.toLowerCase().trim().replace(/[^\w\-\.]+/g, "-").replace(/\-+/g, "-");
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

  if (k === "global.cover") return "Your OperatingFrame™ report";
  if (k === "global.welcome_letter") return "Welcome";
  if (k === "global.summary_dashboard") return "What this report includes";
  if (k === "global.how_to_use") return "How to use this report";
  if (k === "global.framework_explainer") return "How OperatingFrame™ works";
  if (k === "global.conclusion") return "Conclusion";
  if (k === "global.cta_next_steps") return "Next steps";

  if (k === "profile.identity") return topProfileName || "Primary profile";
  if (k === "profile.strengths") return "Strengths";
  if (k === "profile.development_areas") return "Development areas";
  if (k === "profile.communication_style") return "Communication style";
  if (k === "profile.reflection_questions") return "Reflection questions";
  if (k === "profile.collaboration") return "Collaboration";

  if (k === "segmentation-responses") return "Your responses";

  if (k.startsWith("profile.")) return k.replace("profile.", "").replaceAll("_", " ");
  if (k.startsWith("global.")) return k.replace("global.", "").replaceAll("_", " ");
  return "Section";
}

// ---------- Premium visual primitives ----------

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 text-slate-900 shadow-sm ${props.className || ""}`}>{props.children}</div>;
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/5 p-6 ${props.className || ""}`}>{props.children}</div>;
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

// ---------- Charts / visuals ----------

const FREQ_COLOR: Record<AB, { dot: string; bar: string }> = {
  A: { dot: "bg-red-500", bar: "bg-red-500" },
  B: { dot: "bg-amber-400", bar: "bg-amber-400" },
  C: { dot: "bg-emerald-500", bar: "bg-emerald-500" },
  D: { dot: "bg-blue-500", bar: "bg-blue-500" },
};

function FrequencyColorBars(props: { labels: Array<{ code: AB; name: string }>; pct: Record<AB, number>; top: AB }) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const max = Math.max(...items.map((i) => i.v), 0.01);

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.top;
        const col = FREQ_COLOR[it.code];

        return (
          <div key={it.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${col.dot}`}>
                    {it.code}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{it.name} <span className="text-slate-500">({it.code})</span></span>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">Dominant</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full rounded-full bg-white">
                  <div className={`h-2 rounded-full ${col.bar}`} style={{ width: `${w}%` }} />
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

function ProfileBars(props: { labels: Array<{ code: string; name: string }>; pct: Record<string, number>; topCode: string }) {
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
                  <span className="truncate text-sm font-semibold text-slate-900">{it.name}</span>
                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">Primary</span>
                  ) : null}
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white">
                  <div className="h-2 rounded-full bg-slate-900" style={{ width: `${w}%` }} />
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

function ProfilesRadar(props: { labels: Array<{ code: string; name: string }>; pct: Record<string, number> }) {
  // profiles-only radar (8 axes)
  const N = Math.max(3, props.labels.length);
  const size = 360;
  const pad = 22;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - pad;

  const pts = props.labels.map((p, i) => {
    const v = clamp01(props.pct?.[p.code] ?? 0);
    const ang = (-Math.PI / 2) + (2 * Math.PI * (i / N));
    const rr = r * v;
    const x = cx + rr * Math.cos(ang);
    const y = cy + rr * Math.sin(ang);
    return { x, y, v, code: p.code };
  });

  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const rings = [0.2, 0.4, 0.6, 0.8, 1].map((k) => {
    const rr = r * k;
    return { rr, k };
  });

  const axes = props.labels.map((p, i) => {
    const ang = (-Math.PI / 2) + (2 * Math.PI * (i / N));
    const x2 = cx + r * Math.cos(ang);
    const y2 = cy + r * Math.sin(ang);
    const lx = cx + (r + 16) * Math.cos(ang);
    const ly = cy + (r + 16) * Math.sin(ang);
    return { i, x2, y2, lx, ly, label: `P${i + 1}` };
  });

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Profiles radar">
        {/* rings */}
        {rings.map((ring) => (
          <circle
            key={ring.k}
            cx={cx}
            cy={cy}
            r={ring.rr}
            fill="none"
            stroke="rgb(203 213 225)" // slate-300
            strokeOpacity={0.6}
          />
        ))}

        {/* axes */}
        {axes.map((a) => (
          <line
            key={a.i}
            x1={cx}
            y1={cy}
            x2={a.x2}
            y2={a.y2}
            stroke="rgb(203 213 225)"
            strokeOpacity={0.6}
          />
        ))}

        {/* polygon */}
        <polygon points={poly} fill="rgb(37 99 235)" fillOpacity={0.18} stroke="rgb(37 99 235)" strokeWidth={2} />

        {/* points */}
        {pts.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r={5} fill="rgb(37 99 235)" />
        ))}

        {/* labels */}
        {axes.map((a) => (
          <text
            key={`t-${a.i}`}
            x={a.lx}
            y={a.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fill="rgb(51 65 85)" // slate-700
            fontWeight={600}
          >
            {a.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function TriadProfileCards(props: {
  sorted: Array<{ code: string; name: string; pct: number }>;
}) {
  const primary = props.sorted[0];
  const secondary = props.sorted[1];
  const tertiary = props.sorted[2];

  const cards = [
    { label: "Primary profile", num: 1, p: primary },
    { label: "Secondary", num: 2, p: secondary },
    { label: "Tertiary", num: 3, p: tertiary },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => {
        const p = c.p;
        if (!p) return null;
        const pct = Math.round(clamp01(p.pct) * 100);

        return (
          <div key={c.num} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{c.label}</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {c.num}
              </span>
            </div>

            <div className="mt-3 text-lg font-semibold text-slate-900">{p.name}</div>
            <div className="text-xs text-slate-500">{p.code}</div>

            <div className="mt-3 text-sm font-semibold text-slate-800">{pct}% match</div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Strengths", "Motivators", "Watch-outs"].map((t) => (
                <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Block rendering ----------

function BlockRenderer(props: {
  block: ReportSectionBlock;
  ctx: {
    data: ResultData;
    participant: string;
    orgName: string;
    topFreqName: string;
    sortedProfiles: Array<{ code: string; name: string; pct: number }>;
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

  if (type === "image") {
    const src = String((block as any)?.src || "").trim();
    if (!src) return null;

    const align = (String((block as any)?.align || "center") as any).toLowerCase();
    const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 420;

    return (
      <figure className="my-6">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText((block as any)?.alt)}
            crossOrigin="anonymous"
            className="h-auto max-w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm italic text-slate-700">“{t}”</p>
        {cite ? <p className="mt-2 text-xs text-slate-500">— {cite}</p> : null}
      </div>
    );
  }

  // ✅ Premium: callout
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

  // ✅ Premium: chips
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

  // ✅ Premium: cards
  if (type === "cards") {
    const columnsRaw = Number((block as any)?.columns || 2);
    const columns = columnsRaw === 1 ? 1 : columnsRaw === 3 ? 3 : 2;
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];

    const grid = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2";

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
            <div key={idx} className={`rounded-2xl border p-5 ${shell}`}>
              {it?.title ? (
                <div className={`text-sm font-semibold ${tone === "light" ? "text-slate-900" : "text-white"}`}>{safeText(it.title)}</div>
              ) : null}
              {it?.text ? (
                <p className={`mt-2 text-sm leading-relaxed ${tone === "light" ? "text-slate-700" : "text-white/80"}`}>{safeText(it.text)}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  // ✅ Premium: scorecard row
  if (type === "scorecard_row") {
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    if (!items.length) return null;
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{safeText(it?.label)}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{safeText(it?.value)}</div>
            {it?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(it.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  // ✅ Charts
  if (type === "chart.frequency_bars") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Your Frequency distribution</div>
          <div className="text-xs text-slate-500">Higher = more natural energy</div>
        </div>
        <div className="mt-4">
          {/* legacy monotone */}
          <FrequencyColorBars labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.frequency_color_bars") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Frequency + Profile</div>
          <div className="text-xs text-slate-500">Your energy distribution</div>
        </div>
        <div className="mt-4">
          <FrequencyColorBars labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_bars") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Your Profile mix</div>
          <div className="text-xs text-slate-500">Primary + supporting patterns</div>
        </div>
        <div className="mt-4">
          <ProfileBars labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_radar") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Profile mix</div>
          <div className="text-xs text-slate-500">Primary + supporting</div>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          Profiles describe your execution pattern — how your leadership behaviour shows up day to day. Your mix shows primary and supporting styles.
        </p>

        <div className="mt-4">
          <ProfilesRadar labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} />
        </div>

        <div className="mt-2 text-xs text-slate-500 text-center">Profiles-only map (higher = stronger pattern).</div>
      </div>
    );
  }

  if (type === "profiles.triad_cards") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <TriadProfileCards sorted={ctx.sortedProfiles} />
      </div>
    );
  }

  // ✅ Premium: CTA
  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text = safeText((block as any)?.text).trim() || "Turn insight into action: use this report in a coaching conversation, a 1:1, or a team workshop.";
    const btn = safeText((block as any)?.button_text).trim() || "Go to next steps";
    const url = (ctx.data?.link?.next_steps_url || "").trim();

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-white/80">{text}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {url ? (
            <button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
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
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">Unsupported block type: {String((block as any).type || "unknown")}</p>
    </div>
  );
}

// ---------- Default content injection (only used when section.blocks is empty) ----------

function defaultBlocksForSection(
  sectionId: string,
  ctx: {
    primaryName: string;
    secondaryName: string;
    tertiaryName: string;
    topFreqName: string;
  }
): ReportSectionBlock[] {
  const id = String(sectionId || "").toLowerCase();

  // Your PDF is already coming through from report_blocks now; this is just safety.
  // We *do* force the triad cards into profile.identity if it would otherwise be empty.

  if (id === "global.summary_dashboard") {
    return [{ type: "chart.frequency_color_bars" }, { type: "spacer", size: "md" }, { type: "chart.profile_radar" }];
  }

  if (id === "profile.identity") {
    return [
      { type: "profiles.triad_cards" }, // ✅ THIS is the key change you asked for
      { type: "spacer", size: "md" },
      {
        type: "callout",
        tone: "insight",
        title: `Primary profile: ${ctx.primaryName}`,
        text: "This section should describe the core identity of the profile in a way that feels specific, human, and usable.",
      },
      { type: "chips", items: ["At your best", "Under pressure", "Best environment", "Reset actions"] },
    ];
  }

  return [{ type: "p", text: "This section has not been populated yet." }];
}

// ---------- Component ----------

export default function NativeBlocksReportClient(props: { token: string; tid: string; src: string; data: ResultData }) {
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
      .map((p) => ({ ...p, pct: data.profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
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

  const renderCtx = useMemo(() => {
    return {
      data,
      participant,
      orgName,
      topFreqName,
      sortedProfiles,
    };
  }, [data, participant, orgName, topFreqName, sortedProfiles]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO */}
        <GlassCard>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{reportTitle}</Badge>
                <Badge>{orgName}</Badge>
                <Badge>{participant}</Badge>
              </div>

              <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{reportTitle}</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                  Dominant Frequency: {topFreqName} ({topFreqCode}) · {pctLabel(topFreqPct)}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                  Primary Profile: {primary?.code?.replace("PROFILE_", "P")}: {primary?.name || data.top_profile_name}
                </span>
                {secondary ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    Secondary: {secondary?.code?.replace("PROFILE_", "P")}: {secondary?.name}
                  </span>
                ) : null}
                {tertiary ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    Tertiary: {tertiary?.code?.replace("PROFILE_", "P")}: {tertiary?.name}
                  </span>
                ) : null}
              </div>
            </div>

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
                Next steps
              </button>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* TOP WOW BLOCKS (match your screenshots) */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <WhiteCard>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Frequency + Profile</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dominant</div>
                  <div className="text-xl font-bold text-slate-900">{pctLabel(topFreqPct)}</div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xl font-semibold text-slate-900">{topFreqName} ({topFreqCode})</div>
                <p className="mt-2 text-sm text-slate-600">
                  Frequencies show how you naturally operate as a leader — where your energy goes under pressure. Higher = more natural, lower = less preferred.
                </p>
              </div>

              <div className="mt-4">
                <FrequencyColorBars labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            <WhiteCard>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
                <div className="text-xs text-slate-500">Primary + supporting</div>
              </div>

              <div className="mt-3">
                <div className="text-xl font-semibold text-slate-900">Primary + supporting</div>
                <p className="mt-2 text-sm text-slate-600">
                  Profiles describe your execution pattern — how your leadership behaviour shows up day to day. Your mix shows primary and supporting styles.
                </p>
              </div>

              <div className="mt-4">
                <ProfilesRadar labels={data.profile_labels} pct={data.profile_percentages} />
              </div>

              <div className="mt-2 text-xs text-slate-500 text-center">Profiles-only map (higher = stronger pattern).</div>
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
              const domId = getDomId(section, idx);
              const title = safeText(section.title).trim() || fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              const rawId = String(section.id || "").trim();
              const blocks = Array.isArray(section.blocks) ? section.blocks : [];
              const hasRealBlocks = blocks.length > 0;

              const finalBlocks = hasRealBlocks
                ? blocks
                : defaultBlocksForSection(rawId, {
                    primaryName: primary?.name || data.top_profile_name || "Primary profile",
                    secondaryName: secondary?.name || "",
                    tertiaryName: tertiary?.name || "",
                    topFreqName,
                  });

              return (
                <section key={domId} id={domId} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {rawId || "section"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {finalBlocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={renderCtx} />
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
                className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
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