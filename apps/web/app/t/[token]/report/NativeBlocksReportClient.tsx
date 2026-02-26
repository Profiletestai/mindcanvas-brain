// /apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
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
  | { type: "profile.triad_cards" } // ✅ NEW: Primary/Secondary/Tertiary UI block
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

  if (k === "profile.identity") return topProfileName || "Profile Identity";
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

// ---------- Visual primitives ----------

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
      {children}
    </span>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-6 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur p-6 md:p-7 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

function subtleLabel(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
      {text}
    </span>
  );
}

function frequencyColor(code: AB) {
  // A red, B yellow, C green, D blue
  if (code === "A") return { dot: "bg-red-500", bar: "bg-red-500" };
  if (code === "B") return { dot: "bg-amber-400", bar: "bg-amber-400" };
  if (code === "C") return { dot: "bg-emerald-500", bar: "bg-emerald-500" };
  return { dot: "bg-blue-500", bar: "bg-blue-500" };
}

function FrequencyBars(props: { labels: Array<{ code: AB; name: string }>; pct: Record<AB, number>; top: AB }) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const max = Math.max(...items.map((i) => i.v), 0.01);

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.top;
        const c = frequencyColor(it.code);

        return (
          <div key={it.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${c.dot}`}>
                    {it.code}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">{it.name}</div>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Dominant
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-white">
                      <div className={`h-2 rounded-full ${c.bar}`} style={{ width: `${w}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-sm font-bold text-slate-800">{pctLabel(it.v)}</div>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">{it.name}</div>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-white">
                      <div className="h-2 rounded-full bg-slate-900" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-sm font-bold text-slate-800">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TriadCards(props: {
  primary?: { code: string; name: string; pct: number };
  secondary?: { code: string; name: string; pct: number };
  tertiary?: { code: string; name: string; pct: number };
}) {
  const items = [
    { label: "Primary profile", rank: 1, x: props.primary },
    { label: "Secondary", rank: 2, x: props.secondary },
    { label: "Tertiary", rank: 3, x: props.tertiary },
  ].filter((i) => !!i.x);

  if (!items.length) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it) => {
          const pct = Math.round(clamp01(it.x!.pct) * 100);

          return (
            <div key={it.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {it.label}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {it.rank}
                </div>
              </div>

              <div className="mt-3 text-lg font-bold text-slate-900">
                {it.x!.name}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{it.x!.code}</div>

              <div className="mt-3 text-sm font-semibold text-slate-800">{pct}% match</div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["Strengths", "Motivators", "Watch-outs"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center text-xs text-slate-500">
        Primary profile: <span className="font-semibold text-slate-700">{props.primary?.name || "—"}</span>
      </div>
    </div>
  );
}

// ---------- Smart image helpers (logo + profile image) ----------

function useBestImage(candidates: string[]) {
  const [src, setSrc] = useState<string | null>(candidates[0] || null);

  const onError = () => {
    if (!src) return;
    const idx = candidates.indexOf(src);
    const next = idx >= 0 ? candidates[idx + 1] : null;
    setSrc(next || null);
  };

  return { src, onError };
}

function buildOrgLogoCandidates(orgSlug: string) {
  const s = (orgSlug || "").trim().toLowerCase();
  if (!s) return [];

  // You can standardise these later; for now we try a few common conventions.
  return [
    `/org-graphics/${s}-logo.png`,
    `/org-graphics/${s}.png`,
    `/org-graphics/${s}/logo.png`,
    `/org-graphics/${s}/logo@2x.png`,
    `/org-graphics/${s}-logo@2x.png`,
    `/org-graphics/operatingframe-logo.png`, // nice fallback if you want
  ];
}

function buildProfileImageCandidates(orgSlug: string, profileCode: string) {
  const s = (orgSlug || "").trim().toLowerCase();
  const p = (profileCode || "").trim();

  return [
    `/profile-cards/${s}/${p}.png`,
    `/profile-cards/${s}-${p}.png`,
    `/profile-cards/${p}.png`,
    `/profile-cards/${p.toLowerCase()}.png`,
  ];
}

// ---------- Block rendering ----------

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
    primary?: { code: string; name: string; pct: number };
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

  if (type === "image") {
    const raw = String((block as any)?.src || "").trim();
    if (!raw) return null;

    const src = raw
      .replaceAll("{{PROFILE_IMAGE_PRIMARY}}", buildProfileImageCandidates(ctx.data.org_slug, ctx.data.top_profile_code)[0] || "")
      .trim();

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

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4")
    return (
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
        ? "border-slate-900/15 bg-slate-900/5"
        : tone === "success"
          ? "border-emerald-800/15 bg-emerald-50"
          : tone === "warning"
            ? "border-amber-800/15 bg-amber-50"
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
          <span
            key={i}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
          >
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
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">FREQUENCY + PROFILE</div>
          <div className="text-xs text-slate-500">Your energy distribution</div>
        </div>
        <div className="mt-2 text-sm text-slate-700">
          Frequencies show how you naturally operate as a leader — where your energy goes under pressure. Higher = more natural, lower = less preferred.
        </div>
        <div className="mt-4">
          <FrequencyBars labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">PROFILE MIX</div>
          <div className="text-xs text-slate-500">Primary + supporting</div>
        </div>
        <div className="mt-2 text-sm text-slate-700">
          Profiles describe your execution pattern — how your leadership behaviour shows up day to day. Your mix shows primary and supporting styles.
        </div>
        <div className="mt-4">
          <ProfileBars labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  if (type === "profile.triad_cards") {
    return (
      <TriadCards
        primary={ctx.primary}
        secondary={ctx.secondary}
        tertiary={ctx.tertiary}
      />
    );
  }

  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text =
      safeText((block as any)?.text).trim() ||
      "Turn insight into action: use this report in a coaching conversation, a 1:1, or a team workshop.";
    const btn = safeText((block as any)?.button_text).trim() || "Go to next steps";
    const url = (ctx.data?.link?.next_steps_url || "").trim();

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white">
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

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">
        Unsupported block type: {String((block as any).type || "unknown")}
      </p>
    </div>
  );
}

// ---------- Default content injection (keeps sections usable even if empty) ----------

function defaultBlocksForSection(
  sectionId: string,
  ctx: {
    participant: string;
    orgName: string;
    primaryName: string;
    secondaryName: string;
    tertiaryName: string;
    topFreqName: string;
  }
): ReportSectionBlock[] {
  const id = String(sectionId || "").toLowerCase();

  if (id === "global.cover") {
    return [
      {
        type: "callout",
        tone: "insight",
        title: "Your headline insight",
        text: `Your natural energy is led by ${ctx.topFreqName}, and your most natural Profile pattern is ${ctx.primaryName}. Use this report as language for what already works — and as a guide for small shifts that create outsized results.`,
      },
    ];
  }

  if (id === "global.summary_dashboard") {
    return [{ type: "chart.frequency_bars" }, { type: "spacer", size: "md" }, { type: "chart.profile_bars" }];
  }

  if (id === "profile.identity") {
    return [
      { type: "profile.triad_cards" },
      { type: "spacer", size: "md" },
      { type: "callout", tone: "insight", title: `You are a ${ctx.primaryName}`, text: "This section should describe the core identity of the profile in a way that feels specific, human, and usable." },
    ];
  }

  if (id === "global.cta_next_steps") {
    return [{ type: "cta", title: "Next steps", text: "Book your next step conversation below to walk through your results.", button_text: "Book a discussion" }];
  }

  return [{ type: "p", text: "This section has not been populated yet." }];
}

// ---------- Component ----------

export default function NativeBlocksReportClient(props: { token: string; tid: string; src: string; data: ResultData }) {
  const { data } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);
  const orgName = data.org_name || data.test_name || "Organisation";
  const testName = data.test_name || "Assessment";
  const topProfileName = data.top_profile_name || "Top profile";

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

  // ✅ Images for the header
  const logoCandidates = useMemo(() => buildOrgLogoCandidates(data.org_slug), [data.org_slug]);
  const profileCandidates = useMemo(
    () => buildProfileImageCandidates(data.org_slug, data.top_profile_code),
    [data.org_slug, data.top_profile_code]
  );

  const logoImg = useBestImage(logoCandidates);
  const profileImg = useBestImage(profileCandidates);

  const ctx = useMemo(() => {
    return {
      data,
      participant,
      orgName,
      primaryName: primary?.name || data.top_profile_name || "Primary profile",
      secondaryName: secondary?.name || "",
      tertiaryName: tertiary?.name || "",
      topFreqName,
      primary: primary ? { code: primary.code, name: primary.name, pct: primary.pct || 0 } : undefined,
      secondary: secondary ? { code: secondary.code, name: secondary.name, pct: secondary.pct || 0 } : undefined,
      tertiary: tertiary ? { code: tertiary.code, name: tertiary.name, pct: tertiary.pct || 0 } : undefined,
    };
  }, [data, participant, orgName, primary, secondary, tertiary, topFreqName]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO HEADER (new structure) */}
        <GlassCard>
          <div className="flex items-start gap-5">
            {/* Left: Org logo */}
            <div className="shrink-0">
              {logoImg.src ? (
                <img
                  src={logoImg.src}
                  onError={logoImg.onError}
                  alt={orgName}
                  className="h-14 w-14 rounded-2xl bg-white p-2 shadow-sm"
                />
              ) : (
                <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/5" />
              )}
            </div>

            {/* Middle: Titles */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {subtleLabel(orgName)}
                {subtleLabel(testName)}
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  Personalised report
                </div>
                <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
                  Your Operating Style in Depth: {topProfileName}
                </h1>

                <div className="mt-2 text-sm text-white/75">
                  For <span className="font-semibold text-white">{participant}</span>
                </div>

                <div className="mt-1 text-sm text-white/75">
                  Top profile: <span className="font-semibold text-white">{topProfileName}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge>
                  Dominant Frequency: {topFreqName} ({topFreqCode}) · {pctLabel(topFreqPct)}
                </Badge>
                {primary?.name ? <Badge>Primary: {primary.name}</Badge> : null}
                {secondary?.name ? <Badge>Secondary: {secondary.name}</Badge> : null}
                {tertiary?.name ? <Badge>Tertiary: {tertiary.name}</Badge> : null}
              </div>

              <div className="mt-5 flex gap-3">
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

            {/* Right: Profile image */}
            <div className="hidden md:block shrink-0">
              {profileImg.src ? (
                <img
                  src={profileImg.src}
                  onError={profileImg.onError}
                  alt={topProfileName}
                  className="h-24 w-24 rounded-3xl border border-white/10 bg-white p-3 shadow-sm"
                />
              ) : (
                <div className="h-24 w-24 rounded-3xl border border-white/10 bg-white/5" />
              )}
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* QUICK DASHBOARD (tighter, less clunky) */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <WhiteCard className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Quick frequency view</div>
                <div className="text-xs text-slate-500">Your energy distribution</div>
              </div>
              <div className="mt-4">
                <FrequencyBars labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            <WhiteCard className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Quick profile view</div>
                <div className="text-xs text-slate-500">Primary + supporting</div>
              </div>
              <div className="mt-2 text-sm text-slate-700">
                Profiles describe your execution pattern — how your leadership shows up day to day.
              </div>
              <div className="mt-4">
                <ProfileBars labels={data.profile_labels} pct={data.profile_percentages} topCode={data.top_profile_code} />
              </div>
            </WhiteCard>
          </div>
        </GlassCard>

        {/* BODY */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 sticky top-6 self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Index</p>
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
              const title = safeText(section.title).trim() || fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              const rawId = String(section.id || "").trim();
              const blocks = Array.isArray(section.blocks) ? section.blocks : [];
              const hasRealBlocks = blocks.length > 0;

              const finalBlocks = hasRealBlocks
                ? blocks
                : defaultBlocksForSection(rawId, {
                    participant,
                    orgName,
                    primaryName: ctx.primaryName,
                    secondaryName: ctx.secondaryName,
                    tertiaryName: ctx.tertiaryName,
                    topFreqName: ctx.topFreqName,
                  });

              return (
                <section key={domId} id={domId} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard className="p-6 md:p-7">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

                      {/* ✅ Subtle section tag (not clunky) */}
                      {rawId ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                          {rawId}
                        </span>
                      ) : null}
                    </div>

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
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
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