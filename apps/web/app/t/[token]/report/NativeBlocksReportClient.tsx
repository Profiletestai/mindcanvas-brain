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
  | { type: "scorecard_row"; items?: Array<{ label: string; value: string; hint?: string }> }
  | { type: "chart.frequency_bars" }
  | { type: "chart.profile_bars" }
  | { type: "profiles.triad_cards" } // ✅ NEW: requested block type
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

// ---------------- utils ----------------

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

  if (k === "global.cover") return "Your OperatingFrame™ report";
  if (k === "global.welcome_letter") return "Welcome";
  if (k === "global.summary_dashboard") return "What this report includes";
  if (k === "global.how_to_use") return "How to use this report";
  if (k === "global.framework_explainer") return "How OperatingFrame works";
  if (k === "global.conclusion") return "Conclusion";
  if (k === "global.cta_next_steps") return "Next steps";

  if (k === "profile.identity") return topProfileName || "Profile identity";
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

// ---------------- image helpers ----------------

// You said you're using this path:
const OF_ASSET_ROOT = "/images/operatingframe-full-test";

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Profile images live here:
// /public/images/operatingframe-full-test/profile-cards/*.png
function profileImageSrc(profileName?: string) {
  const n = (profileName || "").trim();
  if (!n) return "";
  const file = `${slugifyName(n)}.png`;
  return `${OF_ASSET_ROOT}/profile-cards/${file}`;
}

// Optional: if you have a single logo, put it here.
// If you want org-specific, we can map by org_slug later.
function orgLogoSrc(orgSlug?: string) {
  const s = (orgSlug || "").toLowerCase();
  // If you have a logo file, drop it into:
  // /public/images/operatingframe-full-test/logo.png
  if (s.includes("operatingframe")) return `${OF_ASSET_ROOT}/logo.png`;
  // fallback: blank
  return "";
}

// ---------------- premium primitives ----------------

function GlassShell(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-white/5",
        "backdrop-blur-sm shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
        props.className || "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={["rounded-3xl bg-white text-slate-900 shadow-sm", props.className || ""].join(" ")}>
      {props.children}
    </div>
  );
}

function Pill(props: { children: React.ReactNode; tone?: "dark" | "light" }) {
  const tone = props.tone || "dark";
  const cls =
    tone === "light"
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : "border-white/15 bg-white/10 text-white/90";
  return (
    <span className={["inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", cls].join(" ")}>
      {props.children}
    </span>
  );
}

function MiniRule() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />;
}

function SoftRule() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />;
}

// ---------------- charts (frequency bars + profile bars) ----------------

function freqColor(code: AB) {
  // per your instruction: A red, B yellow, C green, D blue
  if (code === "A") return "bg-red-500";
  if (code === "B") return "bg-amber-400";
  if (code === "C") return "bg-emerald-500";
  return "bg-blue-600";
}

function freqDot(code: AB) {
  if (code === "A") return "bg-red-500";
  if (code === "B") return "bg-amber-400";
  if (code === "C") return "bg-emerald-500";
  return "bg-blue-600";
}

function FrequencyBars(props: {
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
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={["inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white", freqDot(it.code)].join(" ")}>
                    {it.code}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {it.name} <span className="text-slate-500">({it.code})</span>
                      </div>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Dominant
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-2.5 w-full rounded-full bg-white">
                  <div className={["h-2.5 rounded-full", freqColor(it.code)].join(" ")} style={{ width: `${w}%` }} />
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-800">{pctLabel(it.v)}</div>
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
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">{it.name}</div>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">{it.code}</div>
                  </div>
                </div>

                <div className="mt-3 h-2.5 w-full rounded-full bg-white">
                  <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${w}%` }} />
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-800">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- triad cards (Primary / Secondary / Tertiary) ----------------

function TriadCards(props: {
  primary?: { code: string; name: string; pct: number };
  secondary?: { code: string; name: string; pct: number };
  tertiary?: { code: string; name: string; pct: number };
}) {
  const rows = [
    { label: "Primary profile", badge: "1", tone: "ring-slate-900/10", item: props.primary },
    { label: "Secondary", badge: "2", tone: "ring-slate-900/10", item: props.secondary },
    { label: "Tertiary", badge: "3", tone: "ring-slate-900/10", item: props.tertiary },
  ].filter((x) => !!x.item);

  // compact + stylish
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((r) => {
          const item = r.item!;
          const img = profileImageSrc(item.name);
          const pct = Math.round(clamp01(item.pct) * 100);

          return (
            <div
              key={r.badge}
              className={[
                "rounded-3xl bg-white p-5 shadow-sm",
                "ring-1",
                r.tone,
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {r.label}
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {item.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.code}</div>
                </div>

                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {r.badge}
                </div>
              </div>

              {img ? (
                <div className="mt-4 flex justify-center">
                  <img
                    src={img}
                    alt={item.name}
                    className="h-20 w-20 rounded-2xl object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{pct}% match</span>
                <span className="text-xs text-slate-500">Fit</span>
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
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
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Block renderer ----------------

function BlockRenderer(props: {
  block: ReportSectionBlock;
  ctx: {
    data: ResultData;
    participant: string;
    orgName: string;
    primary: { code: string; name: string; pct: number } | null;
    secondary: { code: string; name: string; pct: number } | null;
    tertiary: { code: string; name: string; pct: number } | null;
    topFreqName: string;
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
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 360;

    return (
      <figure className="my-6">
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

  if (type === "h1")
    return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2")
    return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3")
    return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4")
    return <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText((block as any).text)}</h4>;

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
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
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
        ? "border-slate-900/10 bg-slate-900/5"
        : tone === "success"
        ? "border-emerald-800/12 bg-emerald-50"
        : tone === "warning"
        ? "border-amber-800/12 bg-amber-50"
        : "border-slate-200 bg-slate-50";

    return (
      <div className={`rounded-3xl border p-5 ${shell}`}>
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

  if (type === "chips") {
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    if (!items.length) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((it: any, i: number) => (
          <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {safeText(it)}
          </span>
        ))}
      </div>
    );
  }

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
            <div key={idx} className={`rounded-3xl border p-5 ${shell}`}>
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

  if (type === "scorecard_row") {
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    if (!items.length) return null;
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{safeText(it?.label)}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{safeText(it?.value)}</div>
            {it?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(it.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  if (type === "chart.frequency_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Frequency + profile</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{ctx.topFreqName}</div>
            <p className="mt-2 text-sm text-slate-700">
              Frequencies show how you naturally operate as a leader — where your energy goes under pressure.
              Higher = more natural, lower = less preferred.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dominant</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {pctLabel(ctx.data.frequency_percentages?.[ctx.data.top_freq])}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <FrequencyBars labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
            <div className="mt-2 text-lg font-bold text-slate-900">Primary + supporting</div>
            <p className="mt-2 text-sm text-slate-700">
              Profiles describe your execution pattern — how your leadership behaviour shows up day to day.
              Your mix shows primary and supporting styles.
            </p>
          </div>
          <div className="text-xs text-slate-500">Higher = stronger pattern</div>
        </div>

        <div className="mt-5">
          <ProfileBars labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  // ✅ NEW: triad cards block (Primary/Secondary/Tertiary) for profile.identity
  if (type === "profiles.triad_cards") {
    return (
      <TriadCards primary={ctx.primary || undefined} secondary={ctx.secondary || undefined} tertiary={ctx.tertiary || undefined} />
    );
  }

  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text =
      safeText((block as any)?.text).trim() ||
      "Turn insight into action: use this report in a coaching conversation, a 1:1, or a team workshop.";
    const btn = safeText((block as any)?.button_text).trim() || "Book a discussion";
    const url = (ctx.data?.link?.next_steps_url || "").trim();

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white">
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-white/80">{text}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {url ? (
            <button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
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
      <p className="text-xs font-semibold text-amber-900">
        Unsupported block type: {String((block as any).type || "unknown")}
      </p>
    </div>
  );
}

// ---------------- component ----------------

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
  const testName = data.test_name || "Assessment";
  const topProfileName = data.top_profile_name || "Top profile";

  const topFreqCode = data.top_freq;
  const topFreqName =
    data.frequency_labels.find((f) => f.code === topFreqCode)?.name || topFreqCode;

  const sortedProfiles = useMemo(() => {
    return [...data.profile_labels]
      .map((p) => ({ ...p, pct: data.profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [data.profile_labels, data.profile_percentages]);

  const primary = sortedProfiles[0]
    ? { code: sortedProfiles[0].code, name: sortedProfiles[0].name, pct: sortedProfiles[0].pct || 0 }
    : null;
  const secondary = sortedProfiles[1]
    ? { code: sortedProfiles[1].code, name: sortedProfiles[1].name, pct: sortedProfiles[1].pct || 0 }
    : null;
  const tertiary = sortedProfiles[2]
    ? { code: sortedProfiles[2].code, name: sortedProfiles[2].name, pct: sortedProfiles[2].pct || 0 }
    : null;

  const mergedSections = useMemo(() => {
    const common = (data.sections?.common || []) as ReportSection[];
    const profile = (data.sections?.profile || []) as ReportSection[];
    return [...common, ...profile].filter(Boolean);
  }, [data.sections]);

  const indexItems = useMemo(() => {
    return mergedSections.map((s, i) => {
      const id = getDomId(s, i);
      const title = safeText(s.title).trim() || fallbackTitleFromId(String(s.id || ""), topProfileName);
      return { id, title, rawId: String(s.id || "") };
    });
  }, [mergedSections, topProfileName]);

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

  const logo = orgLogoSrc(data.org_slug);
  const topProfileImg = profileImageSrc(topProfileName);

  const ctx = useMemo(() => {
    return {
      data,
      participant,
      orgName,
      primary,
      secondary,
      tertiary,
      topFreqName,
    };
  }, [data, participant, orgName, primary, secondary, tertiary, topFreqName]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO / HEADER (clean, not duplicated) */}
        <GlassShell className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              {/* Org logo */}
              <div className="shrink-0">
                <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                  {logo ? (
                    <img
                      src={logo}
                      alt={orgName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                {/* Labels row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="dark">{orgName}</Pill>
                  <Pill tone="dark">{testName}</Pill>
                </div>

                <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  Personalised report
                </div>

                <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
                  Your Operating Style in Depth:{" "}
                  <span className="text-white">{primary?.name || topProfileName}</span>
                </h1>

                <div className="mt-3 space-y-1 text-sm text-white/80">
                  <div>
                    For <span className="font-semibold text-white">{participant}</span>
                  </div>
                  <div>
                    Top profile:{" "}
                    <span className="font-semibold text-white">{primary?.name || topProfileName}</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={downloadPdfViaPrint}
                    className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={openNextSteps}
                    className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Next steps
                  </button>
                </div>
              </div>
            </div>

            {/* Profile image on the right */}
            <div className="hidden md:block shrink-0">
              <div className="h-20 w-20 rounded-3xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                {topProfileImg ? (
                  <img
                    src={topProfileImg}
                    alt={topProfileName}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <MiniRule />
          </div>

          {/* Clean “WOW” hero panels (not huge, not duplicated) */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <WhiteCard className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Quick frequency view</div>
                  <div className="text-xs text-slate-500">Your energy distribution</div>
                </div>
              </div>
              <div className="mt-4">
                <FrequencyBars labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            <WhiteCard className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Quick profile view</div>
                  <div className="text-xs text-slate-500">Primary + supporting</div>
                </div>
              </div>
              <div className="mt-4">
                <ProfileBars labels={data.profile_labels} pct={data.profile_percentages} topCode={data.top_profile_code} />
              </div>
            </WhiteCard>
          </div>
        </GlassShell>

        {/* BODY: Index + Sections */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 sticky top-6 self-start">
            <div className="px-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Index</div>
              <div className="mt-1 text-xs text-white/60">Jump straight to what you need.</div>
            </div>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{s.title}</div>
                    </div>
                    <div className="text-xs text-white/60">View</div>
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
                fallbackTitleFromId(String(section.id || ""), topProfileName);

              const rawId = String(section.id || "").trim();
              const blocks = Array.isArray(section.blocks) ? section.blocks : [];

              return (
                <section key={domId} id={domId} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {rawId || "section"}
                      </span>
                    </div>

                    <div className="mt-5">
                      <SoftRule />
                    </div>

                    <div className="mt-5 space-y-4">
                      {blocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} />
                      ))}
                    </div>
                  </WhiteCard>
                </section>
              );
            })}

            <footer className="pt-4 text-xs text-slate-400">
              © {new Date().getFullYear()} Powered by Profiletest.ai
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}