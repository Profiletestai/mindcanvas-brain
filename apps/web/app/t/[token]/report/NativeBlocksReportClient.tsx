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
  | {
      type: "chips";
      items?: string[];
    }
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

  // ✅ NEW (DB-driven) block types
  | {
      type: "images.pair";
      left?: { title?: string; src?: string; alt?: string; caption?: string; max_h?: number };
      right?: { title?: string; src?: string; alt?: string; caption?: string; max_h?: number };
    }
  | {
      type: "profiles.triad_cards";
      // optional override text snippets (otherwise we use defaults)
      primary_summary?: string;
      secondary_summary?: string;
      tertiary_summary?: string;
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
  if (k === "global.framework_explainer") return "How OperatingFrame™ works";
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

/**
 * ✅ Image/macros resolver.
 * This fixes your “images not coming through” problem when content_json uses placeholders.
 *
 * Supported macros:
 *  - {{FREQUENCY_GRID}} -> /images/operatingframe-full-test/frequency-grid.png
 *  - {{PROFILE_GRID}}   -> /images/operatingframe-full-test/profile-grid.png
 *  - {{BIO_IMAGE}}      -> /images/operatingframe-full-test/bio-image.png
 *  - {{PROFILE_IMAGE_PRIMARY}} / SECONDARY / TERTIARY -> profile card images
 */
function resolveImageSrc(rawSrc: string, ctx: {
  primarySlug: string;
  secondarySlug: string;
  tertiarySlug: string;
}) {
  const s = String(rawSrc || "").trim();
  if (!s) return "";

  const map: Record<string, string> = {
    "{{FREQUENCY_GRID}}": "/images/operatingframe-full-test/frequency-grid.png",
    "{{PROFILE_GRID}}": "/images/operatingframe-full-test/profile-grid.png",
    "{{BIO_IMAGE}}": "/images/operatingframe-full-test/bio-image.png",
    "{{PROFILE_IMAGE_PRIMARY}}": `/images/operatingframe-full-test/profile-cards/${ctx.primarySlug}.png`,
    "{{PROFILE_IMAGE_SECONDARY}}": `/images/operatingframe-full-test/profile-cards/${ctx.secondarySlug}.png`,
    "{{PROFILE_IMAGE_TERTIARY}}": `/images/operatingframe-full-test/profile-cards/${ctx.tertiarySlug}.png`,
  };

  if (map[s]) return map[s];

  // Allow either absolute URL, or public/ relative paths
  return s;
}

function profileSlugFromName(name: string) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w]+/g, "-")
    .replace(/\-+/g, "-");
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
  return (
    <div className={`rounded-2xl bg-white p-6 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-6 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

function FrequencyBars(props: {
  labels: Array<{ code: AB; name: string }>;
  pct: Record<AB, number>;
  top: AB;
}) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const max = Math.max(...items.map((i) => i.v), 0.01);

  // Brand-ish per your A/B/C/D color instruction
  const colorByCode: Record<AB, string> = {
    A: "bg-red-500",
    B: "bg-amber-400",
    C: "bg-emerald-500",
    D: "bg-blue-500",
  };

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.top;
        return (
          <div key={it.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {it.name} <span className="text-slate-500">({it.code})</span>
                  </span>
                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Dominant
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-white">
                  <div className={`h-2 rounded-full ${colorByCode[it.code]}`} style={{ width: `${w}%` }} />
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

function ProfileRadarStub(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Profile mix</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">{props.title}</div>
          <p className="mt-2 text-sm text-slate-600">{props.description}</p>
        </div>
        <div className="text-xs text-slate-500">Profiles-only map</div>
      </div>

      <div className="mt-4 flex items-center justify-center">{props.children}</div>
      <div className="mt-3 text-center text-xs text-slate-500">Higher = stronger pattern.</div>
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
    reportTitle: string;

    primary: { code: string; name: string; pct: number };
    secondary?: { code: string; name: string; pct: number };
    tertiary?: { code: string; name: string; pct: number };

    topFreq: { code: AB; name: string; pct: number };

    // for macro image resolving
    img: {
      primarySlug: string;
      secondarySlug: string;
      tertiarySlug: string;
      primaryImg: string;
      secondaryImg: string;
      tertiaryImg: string;
    };
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

    const src = resolveImageSrc(raw, {
      primarySlug: ctx.img.primarySlug,
      secondarySlug: ctx.img.secondarySlug,
      tertiarySlug: ctx.img.tertiarySlug,
    });

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
  if (type === "h4")
    return (
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText((block as any).text)}</h4>
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

  // ✅ Premium: cards
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
            <div key={idx} className={`rounded-2xl border p-5 ${shell}`}>
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

  // ✅ Premium: charts driven by report data
  if (type === "chart.frequency_bars") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Frequency</div>
          <div className="text-xs text-slate-500">Higher = more natural energy</div>
        </div>
        <div className="mt-4">
          <FrequencyBars labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_bars") {
    // Intentionally removed from “What this report includes” per your instruction.
    // Keep supported in case another section uses it later.
    return null;
  }

  // ✅ NEW: images.pair (two clean cards side-by-side)
  if (type === "images.pair") {
    const left = (block as any)?.left || {};
    const right = (block as any)?.right || {};

    const leftSrc = resolveImageSrc(String(left?.src || ""), {
      primarySlug: ctx.img.primarySlug,
      secondarySlug: ctx.img.secondarySlug,
      tertiarySlug: ctx.img.tertiarySlug,
    });
    const rightSrc = resolveImageSrc(String(right?.src || ""), {
      primarySlug: ctx.img.primarySlug,
      secondarySlug: ctx.img.secondarySlug,
      tertiarySlug: ctx.img.tertiarySlug,
    });

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {left?.title ? <div className="text-sm font-semibold text-slate-900">{safeText(left.title)}</div> : null}
          {leftSrc ? (
            <div className="mt-3 flex justify-center">
              <img
                src={leftSrc}
                alt={safeText(left?.alt)}
                className="max-w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                style={{ maxHeight: typeof left?.max_h === "number" ? left.max_h : 360 }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          ) : null}
          {left?.caption ? <div className="mt-2 text-center text-xs text-slate-500">{safeText(left.caption)}</div> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {right?.title ? <div className="text-sm font-semibold text-slate-900">{safeText(right.title)}</div> : null}
          {rightSrc ? (
            <div className="mt-3 flex justify-center">
              <img
                src={rightSrc}
                alt={safeText(right?.alt)}
                className="max-w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                style={{ maxHeight: typeof right?.max_h === "number" ? right.max_h : 360 }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          ) : null}
          {right?.caption ? <div className="mt-2 text-center text-xs text-slate-500">{safeText(right.caption)}</div> : null}
        </div>
      </div>
    );
  }

  // ✅ NEW: profiles.triad_cards (Primary/Secondary/Tertiary) with images + richer summary
  if (type === "profiles.triad_cards") {
    const p = ctx.primary;
    const s = ctx.secondary;
    const t = ctx.tertiary;

    const primarySummary =
      safeText((block as any)?.primary_summary).trim() ||
      "Your default under pressure — how you naturally initiate, decide, and drive outcomes.";
    const secondarySummary =
      safeText((block as any)?.secondary_summary).trim() ||
      "A supporting pattern you lean on day-to-day — it balances and strengthens your primary style.";
    const tertiarySummary =
      safeText((block as any)?.tertiary_summary).trim() ||
      "A backup style you can access when needed — especially when the situation demands a different approach.";

    const cardShell = "rounded-2xl border p-5";
    const pShell = "border-red-200 bg-red-50/40";
    const sShell = "border-blue-200 bg-blue-50/40";
    const tShell = "border-emerald-200 bg-emerald-50/40";

    const Item = (args: {
      label: "Primary profile" | "Secondary" | "Tertiary";
      rank: 1 | 2 | 3;
      name: string;
      code: string;
      pct: number;
      img: string;
      shell: string;
      tag: "Primary" | "Supporting";
      summary: string;
    }) => (
      <div className={`${cardShell} ${args.shell}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">{args.label}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {args.code}: {args.name}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{args.code.replace("P", "PROFILE_")}</div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {args.rank}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <img
            src={args.img}
            alt={args.name}
            className="h-14 w-14 rounded-2xl border border-slate-200 bg-white object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{pctLabel(args.pct)}</div>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                {args.tag}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-white">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.round(clamp01(args.pct) * 100)}%` }} />
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">{args.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Strengths
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Motivators
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Watch-outs
          </span>
        </div>
      </div>
    );

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Item
            label="Primary profile"
            rank={1}
            name={p.name}
            code={p.code}
            pct={p.pct}
            img={ctx.img.primaryImg}
            shell={pShell}
            tag="Primary"
            summary={primarySummary}
          />
          {s ? (
            <Item
              label="Secondary"
              rank={2}
              name={s.name}
              code={s.code}
              pct={s.pct}
              img={ctx.img.secondaryImg}
              shell={sShell}
              tag="Supporting"
              summary={secondarySummary}
            />
          ) : null}
          {t ? (
            <Item
              label="Tertiary"
              rank={3}
              name={t.name}
              code={t.code}
              pct={t.pct}
              img={ctx.img.tertiaryImg}
              shell={tShell}
              tag="Supporting"
              summary={tertiarySummary}
            />
          ) : null}
        </div>

        <div className="mt-3 text-center text-xs text-slate-500">Primary profile: {p.name}</div>
      </div>
    );
  }

  // ✅ Premium: CTA
  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text =
      safeText((block as any)?.text).trim() ||
      "Use this report in a coaching conversation. The real value is applying it to your role and team context.";
    const btn = safeText((block as any)?.button_text).trim() || "Next step";

    // ✅ This fixes your “Next Steps button not working” regression:
    // Use redirect_url first (your generator link), then next_steps_url.
    const url = (ctx.data?.link?.redirect_url || ctx.data?.link?.next_steps_url || "").trim();

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
            <span className="text-xs text-white/70">No redirect/next step URL is configured for this link.</span>
          )}
        </div>
      </div>
    );
  }

  // Unknown fallback
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">
        Unsupported block type: {String((block as any).type || "unknown")}
      </p>
    </div>
  );
}

// ---------- Component ----------

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
      .map((p) => ({ ...p, pct: data.profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [data.profile_labels, data.profile_percentages]);

  const primary = sortedProfiles[0] || { code: data.top_profile_code, name: data.top_profile_name, pct: 0 };
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
    const url = (data?.link?.redirect_url || data?.link?.next_steps_url || "").trim();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadPdfViaPrint() {
    window.print();
  }

  const primarySlug = profileSlugFromName(primary?.name || "");
  const secondarySlug = profileSlugFromName(secondary?.name || primary?.name || "");
  const tertiarySlug = profileSlugFromName(tertiary?.name || primary?.name || "");

  const ctx = useMemo(() => {
    return {
      data,
      participant,
      orgName,
      reportTitle,
      primary: { code: primary?.code || data.top_profile_code, name: primary?.name || data.top_profile_name, pct: primary?.pct ?? 0 },
      secondary: secondary ? { code: secondary.code, name: secondary.name, pct: secondary.pct ?? 0 } : undefined,
      tertiary: tertiary ? { code: tertiary.code, name: tertiary.name, pct: tertiary.pct ?? 0 } : undefined,
      topFreq: { code: topFreqCode, name: topFreqName, pct: topFreqPct },
      img: {
        primarySlug,
        secondarySlug,
        tertiarySlug,
        primaryImg: `/images/operatingframe-full-test/profile-cards/${primarySlug}.png`,
        secondaryImg: `/images/operatingframe-full-test/profile-cards/${secondarySlug}.png`,
        tertiaryImg: `/images/operatingframe-full-test/profile-cards/${tertiarySlug}.png`,
      },
    };
  }, [
    data,
    participant,
    orgName,
    reportTitle,
    primary,
    secondary,
    tertiary,
    topFreqCode,
    topFreqName,
    topFreqPct,
    primarySlug,
    secondarySlug,
    tertiarySlug,
  ]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO */}
        <GlassCard className="p-7">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              {/* ✅ Remove “Organisation” label tag, keep clean pills */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{orgName}</Badge>
                <Badge>{reportTitle}</Badge>
              </div>

              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                Personalised report
              </div>

              <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
                Your Operating Style in Depth: {ctx.primary.code}: {ctx.primary.name}
              </h1>

              <p className="mt-2 text-sm text-white/80">
                For <span className="font-semibold text-white">{participant}</span>
              </p>

              {/* ✅ Move Dominant Frequency under Top Profile (as requested) */}
              <div className="mt-1 text-sm text-white/80">
                Top profile:{" "}
                <span className="font-semibold text-white">
                  {ctx.primary.code}: {ctx.primary.name}
                </span>
                <span className="mx-2 text-white/40">•</span>
                Dominant frequency:{" "}
                <span className="font-semibold text-white">
                  {ctx.topFreq.name} ({ctx.topFreq.code})
                </span>{" "}
                · {pctLabel(ctx.topFreq.pct)}
              </div>

              <div className="mt-5 flex gap-3">
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

            {/* ✅ Bigger profile image */}
            <div className="shrink-0">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <img
                  src={ctx.img.primaryImg}
                  alt={ctx.primary.name}
                  className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-white object-contain"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* ✅ Keep the two top cards clean; profile card title now shows top profile name */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <WhiteCard>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Frequency</div>
                <div className="text-xs text-slate-500">Your energy distribution</div>
              </div>
              <div className="mt-4">
                <FrequencyBars labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            <ProfileRadarStub
              title={`${ctx.primary.name}`}
              description={`This visual map shows how your overall Profile / Operating Style is distributed across the model. Higher values show patterns you naturally use more often.`}
            >
              {/* Your existing radar chart component lives elsewhere in your codebase.
                  This client currently receives the rendered chart from the API payload,
                  so we simply preserve space for it and avoid adding another dependency here. */}
              <div className="h-[260px] w-[260px] rounded-full border border-slate-200 bg-slate-50" />
            </ProfileRadarStub>
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
              const title =
                safeText(section.title).trim() ||
                fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              const blocks = Array.isArray(section.blocks) ? section.blocks : [];

              return (
                <section key={domId} id={domId} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

                      {/* ✅ Remove rawId “bubble tag” like global.welcome_letter */}
                      {/* (deliberately not rendered) */}
                    </div>

                    <div className="mt-4 space-y-3">
                      {blocks.map((b, i) => (
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
                className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Next steps
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