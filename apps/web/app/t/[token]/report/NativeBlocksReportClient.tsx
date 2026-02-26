// /apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
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
  | { type: "chart.frequency_bars" }
  | { type: "chart.profile_bars" }
  | { type: "chart.profile_radar" }
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

// -------------------- Image helpers --------------------

const PUBLIC_IMG_BASE = "/images/operatingframe-full-test";

function slugifyName(name: string) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/™/g, "")
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}

function profileImageFromProfileName(profileName: string) {
  // expects files like: activator.png, vision-engineer.png, messenger.png, etc.
  const slug = slugifyName(profileName);
  return `${PUBLIC_IMG_BASE}/profile-cards/${slug}.png`;
}

function resolveImageSrc(srcRaw: string, ctx: { primaryName: string; secondaryName: string; tertiaryName: string }) {
  const src = String(srcRaw || "").trim();
  if (!src) return "";

  // If they stored these placeholders in DB
  if (src === "{{PROFILE_IMAGE_PRIMARY}}") return profileImageFromProfileName(ctx.primaryName);
  if (src === "{{PROFILE_IMAGE_SECONDARY}}") return profileImageFromProfileName(ctx.secondaryName);
  if (src === "{{PROFILE_IMAGE_TERTIARY}}") return profileImageFromProfileName(ctx.tertiaryName);

  // convenience macros you referenced
  if (src === "{{BIO_IMAGE}}") return `${PUBLIC_IMG_BASE}/bio-image.png`;
  if (src === "{{FREQUENCY_GRID}}") return `${PUBLIC_IMG_BASE}/frequency-grid.png`;
  if (src === "{{PROFILE_GRID}}") return `${PUBLIC_IMG_BASE}/profile-grid.png`;

  // allow absolute public paths
  if (src.startsWith("/")) return src;

  // allow relative
  return `${PUBLIC_IMG_BASE}/${src}`;
}

// -------------------- Premium visual primitives --------------------

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-6 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-6 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

function freqColor(code: AB) {
  // A red, B yellow, C green, D blue (your requirement)
  if (code === "A") return { dot: "bg-red-500", bar: "bg-red-500", soft: "bg-red-50", ring: "border-red-200" };
  if (code === "B") return { dot: "bg-yellow-500", bar: "bg-yellow-500", soft: "bg-yellow-50", ring: "border-yellow-200" };
  if (code === "C") return { dot: "bg-green-500", bar: "bg-green-500", soft: "bg-green-50", ring: "border-green-200" };
  return { dot: "bg-blue-500", bar: "bg-blue-500", soft: "bg-blue-50", ring: "border-blue-200" };
}

function FrequencyBars(props: { labels: Array<{ code: AB; name: string }>; pct: Record<AB, number>; top: AB }) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const max = Math.max(...items.map((i) => i.v), 0.01);

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.top;
        const c = freqColor(it.code);

        return (
          <div key={it.code} className={`rounded-2xl border ${c.ring} ${c.soft} p-4`}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${c.dot}`}>
                    {it.code}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{it.name}</span>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Dominant
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-white/70">
                      <div className={`h-2 rounded-full ${c.bar}`} style={{ width: `${w}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-sm font-bold text-slate-900">{pctLabel(it.v)}</div>
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
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{it.name}</span>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Primary
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 h-2 w-full rounded-full bg-white">
                      <div className="h-2 rounded-full bg-slate-900" style={{ width: `${w}%` }} />
                    </div>

                    <div className="mt-1 text-[11px] font-semibold text-slate-500">{it.code}</div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-sm font-bold text-slate-900">{pctLabel(it.v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------- Profiles radar (profiles-only) --------------------

function ProfileRadar(props: {
  values: Array<{ code: string; name: string; v: number }>; // expects 8
  size?: number;
}) {
  const size = props.size ?? 340;
  const pad = 34;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - pad;

  const pts = props.values.map((p, i) => {
    const angle = (-Math.PI / 2) + (i * (2 * Math.PI / props.values.length));
    const rr = r * clamp01(p.v);
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  });

  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1].map((k) => k);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {/* rings */}
      {rings.map((k, idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={r * k}
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth="1"
        />
      ))}

      {/* spokes + labels */}
      {props.values.map((p, i) => {
        const angle = (-Math.PI / 2) + (i * (2 * Math.PI / props.values.length));
        const x2 = cx + r * Math.cos(angle);
        const y2 = cy + r * Math.sin(angle);

        const lx = cx + (r + 18) * Math.cos(angle);
        const ly = cy + (r + 18) * Math.sin(angle);

        return (
          <g key={p.code}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              fontSize="12"
              fontWeight="700"
              fill="rgba(15,23,42,0.75)"
              textAnchor={Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end"}
              dominantBaseline="middle"
            >
              {p.code.replace("PROFILE_", "P")}
            </text>
          </g>
        );
      })}

      {/* polygon */}
      <polygon points={poly} fill="rgba(37,99,235,0.18)" stroke="rgba(37,99,235,0.75)" strokeWidth="2" />
      {/* nodes */}
      {pts.map((p, idx) => (
        <circle key={idx} cx={p.x} cy={p.y} r="4" fill="rgba(37,99,235,0.95)" />
      ))}
    </svg>
  );
}

// -------------------- Triad cards (Primary / Secondary / Tertiary) --------------------

function TriadCards(props: {
  primary: { code: string; name: string; v: number };
  secondary?: { code: string; name: string; v: number };
  tertiary?: { code: string; name: string; v: number };
}) {
  const items = [
    { kind: "Primary profile", rank: 1, pill: "Primary", tone: "border-slate-200 bg-white", ...props.primary },
    props.secondary ? { kind: "Secondary", rank: 2, pill: "Supporting", tone: "border-blue-100 bg-blue-50/40", ...props.secondary } : null,
    props.tertiary ? { kind: "Tertiary", rank: 3, pill: "Supporting", tone: "border-emerald-100 bg-emerald-50/40", ...props.tertiary } : null,
  ].filter(Boolean) as Array<any>;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it) => {
          const pct = Math.round(clamp01(it.v) * 100);
          const img = profileImageFromProfileName(it.name);

          return (
            <div key={it.code} className={`relative overflow-hidden rounded-3xl border p-5 ${it.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {it.kind}
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-slate-900">
                    {it.name}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{it.code}</div>
                </div>

                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {it.rank}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900">{pct}% match</div>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {it.pill}
                </span>
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-slate-200/60">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  {/* profile image */}
                  <img
                    src={img}
                    alt={it.name}
                    className="h-10 w-10 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
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
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center text-xs font-semibold text-slate-500">
        Primary profile: <span className="font-bold text-slate-700">{props.primary.name}</span>
      </div>
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
    reportTitle: string;
    primary: { code: string; name: string; v: number };
    secondary?: { code: string; name: string; v: number };
    tertiary?: { code: string; name: string; v: number };
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
    const src0 = String((block as any)?.src || "").trim();
    const src = resolveImageSrc(src0, {
      primaryName: ctx.primary.name,
      secondaryName: ctx.secondary?.name || "",
      tertiaryName: ctx.tertiary?.name || "",
    });
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
          <figcaption className="mt-2 text-center text-xs text-slate-500">
            {safeText((block as any)?.caption)}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "h1") return <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4") {
    return (
      <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
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
      <ul className="list-disc pl-5 text-sm text-slate-700 space-y-2">
        {items.map((it: any, i: number) => (
          <li key={i}>{safeText(it)}</li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray((block as any).items) ? (block as any).items : [];
    return (
      <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-2">
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
        {cite ? <p className="mt-2 text-xs font-semibold text-slate-500">— {cite}</p> : null}
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
      <div className={`rounded-3xl border p-6 ${shell}`}>
        {title ? <div className="text-sm font-bold text-slate-900">{title}</div> : null}
        {text ? <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{text}</p> : null}
        {bullets.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
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
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
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
      <div className={`grid gap-4 ${grid}`}>
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
                <div className={`text-sm font-bold ${tone === "light" ? "text-slate-900" : "text-white"}`}>
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
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{safeText(it?.label)}</div>
            <div className="mt-2 text-lg font-extrabold text-slate-900">{safeText(it?.value)}</div>
            {it?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(it.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  if (type === "chart.frequency_bars") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Frequency + profile</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">
              {ctx.data.frequency_labels.find((x) => x.code === ctx.data.top_freq)?.name} ({ctx.data.top_freq})
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Frequencies show how you naturally operate as a leader — where your energy goes under pressure.
              Higher = more natural, lower = less preferred.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Dominant</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900">
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">Primary + supporting</div>
            <p className="mt-2 text-sm text-slate-600">
              Profiles describe your execution pattern — how your leadership behaviour shows up day to day.
              Your mix shows primary and supporting styles.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">Primary + supporting</div>
        </div>

        <div className="mt-5">
          <ProfileBars labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_radar") {
    const values = ctx.data.profile_labels
      .slice()
      .sort((a, b) => {
        // Keep stable order P1..P8 if codes like PROFILE_1 etc.
        const ai = Number(String(a.code).replace(/\D+/g, "")) || 0;
        const bi = Number(String(b.code).replace(/\D+/g, "")) || 0;
        return ai - bi;
      })
      .map((p) => ({ code: p.code, name: p.name, v: clamp01(ctx.data.profile_percentages?.[p.code] ?? 0) }));

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">Primary + supporting</div>
            <p className="mt-2 text-sm text-slate-600">
              Profiles-only map (higher = stronger pattern).
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ProfileRadar values={values} />
        </div>
      </div>
    );
  }

  if (type === "profiles.triad_cards") {
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
    const btn = safeText((block as any)?.button_text).trim() || "Book your next step";
    const url = (ctx.data?.link?.next_steps_url || ctx.data?.link?.redirect_url || "").trim();

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-900 p-7 text-white">
        <div className="text-xl font-extrabold">{title}</div>
        <p className="mt-2 text-sm text-white/80">{text}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {url ? (
            <button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
            >
              {btn}
            </button>
          ) : (
            <span className="text-xs text-white/70">No next_steps_url/redirect_url is configured for this link.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-bold text-amber-900">
        Unsupported block type: {String((block as any).type || "unknown")}
      </p>
    </div>
  );
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
  const orgName = data.org_name || "Organisation";
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

  const primaryCtx = {
    code: primary?.code || data.top_profile_code,
    name: primary?.name || data.top_profile_name,
    v: clamp01(primary?.pct ?? data.profile_percentages?.[data.top_profile_code] ?? 0),
  };

  const secondaryCtx = secondary
    ? { code: secondary.code, name: secondary.name, v: clamp01(secondary.pct ?? 0) }
    : undefined;

  const tertiaryCtx = tertiary
    ? { code: tertiary.code, name: tertiary.name, v: clamp01(tertiary.pct ?? 0) }
    : undefined;

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
    const url = (data?.link?.next_steps_url || data?.link?.redirect_url || "").trim();
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
      reportTitle,
      primary: primaryCtx,
      secondary: secondaryCtx,
      tertiary: tertiaryCtx,
    };
  }, [data, participant, orgName, reportTitle, primaryCtx, secondaryCtx, tertiaryCtx]);

  // Avoid duplicate pills when orgName === reportTitle (OperatingFrame duplicate)
  const showOrgPill = !!orgName;
  const showTestPill = !!reportTitle && reportTitle.trim() !== orgName.trim();

  const orgLogo = `${PUBLIC_IMG_BASE}/org-logo.png`; // if you add one later (optional)
  const topProfileImg = profileImageFromProfileName(primaryCtx.name);

  // Profile radar values P1..P8 order
  const profileRadarValues = useMemo(() => {
    return data.profile_labels
      .slice()
      .sort((a, b) => {
        const ai = Number(String(a.code).replace(/\D+/g, "")) || 0;
        const bi = Number(String(b.code).replace(/\D+/g, "")) || 0;
        return ai - bi;
      })
      .map((p) => ({ code: p.code, name: p.name, v: clamp01(data.profile_percentages?.[p.code] ?? 0) }));
  }, [data.profile_labels, data.profile_percentages]);

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HERO */}
        <GlassCard className="overflow-hidden">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Left: logo + meta */}
            <div className="flex items-start gap-4 min-w-0">
              {/* org logo placeholder (optional) */}
              <div className="h-14 w-14 shrink-0 rounded-2xl border border-white/15 bg-white/5 flex items-center justify-center overflow-hidden">
                <img
                  src={orgLogo}
                  alt={orgName}
                  className="h-12 w-12 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {showOrgPill ? <Badge>{orgName}</Badge> : null}
                  {showTestPill ? <Badge>{reportTitle}</Badge> : null}
                </div>

                <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
                  Personalised report
                </div>

                <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
                  Your Operating Style in Depth: {primaryCtx.code.replace("PROFILE_", "P")}: {primaryCtx.name}
                </h1>

                <p className="mt-2 text-sm text-white/80">
                  For <span className="font-bold text-white">{participant}</span>
                </p>

                <p className="mt-1 text-sm text-white/80">
                  Top profile: <span className="font-bold text-white">{primaryCtx.name}</span>
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">
                    Dominant Frequency: {topFreqName} ({topFreqCode}) · {pctLabel(topFreqPct)}
                  </span>

                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    Primary: {primaryCtx.name}
                  </span>

                  {secondaryCtx ? (
                    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      Secondary: {secondaryCtx.name}
                    </span>
                  ) : null}

                  {tertiaryCtx ? (
                    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      Tertiary: {tertiaryCtx.name}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={downloadPdfViaPrint}
                    className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-100"
                  >
                    Download PDF
                  </button>

                  <button
                    onClick={openNextSteps}
                    className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/15"
                  >
                    Next steps
                  </button>
                </div>
              </div>
            </div>

            {/* Right: top profile image */}
            <div className="shrink-0">
              <div className="h-28 w-28 rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                <img
                  src={topProfileImg}
                  alt={primaryCtx.name}
                  className="h-20 w-20 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* HERO panels: frequency + profile mix radar */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <WhiteCard>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Frequency + profile</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">
                    {topFreqName} ({topFreqCode})
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Frequencies show how you naturally operate as a leader — where your energy goes under pressure.
                    Higher = more natural, lower = less preferred.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Dominant</div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900">{pctLabel(topFreqPct)}</div>
                </div>
              </div>

              <div className="mt-5">
                <FrequencyBars labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
              </div>
            </WhiteCard>

            <WhiteCard>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">Primary + supporting</div>
                  <p className="mt-2 text-sm text-slate-600">
                    Profiles describe your execution pattern — how your leadership behaviour shows up day to day.
                    Your mix shows primary and supporting styles.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-500">Primary + supporting</div>
              </div>

              <div className="mt-4">
                <ProfileRadar values={profileRadarValues} />
              </div>

              <div className="mt-3 text-xs font-semibold text-slate-500">
                Profiles-only map (higher = stronger pattern).
              </div>
            </WhiteCard>
          </div>
        </GlassCard>

        {/* BODY: Index + Sections */}
        <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 sticky top-6 self-start">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Index</p>
            <p className="mt-1 text-xs text-slate-300">Jump straight to what you need.</p>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{s.title}</div>
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
              const rawId = String(section.id || "").trim();
              const title = safeText(section.title).trim() || fallbackTitleFromId(rawId, data.top_profile_name);

              const blocks = Array.isArray(section.blocks) ? section.blocks : [];
              const firstBlockType = String((blocks[0] as any)?.type || "").toLowerCase();
              const firstBlockText = safeText((blocks[0] as any)?.text || "").trim();

              // Remove “double heading” feeling:
              // If first block is an h1/h2 with same text as section title, don't render section header title.
              const hideSectionTitle =
                (firstBlockType === "h1" || firstBlockType === "h2") &&
                firstBlockText &&
                firstBlockText.toLowerCase() === title.toLowerCase();

              return (
                <section key={domId} id={domId} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    {!hideSectionTitle ? (
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
                      </div>
                    ) : null}

                    <div className={`${hideSectionTitle ? "" : "mt-4"} space-y-3`}>
                      {blocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} />
                      ))}
                    </div>
                  </WhiteCard>
                </section>
              );
            })}

            {/* Bottom CTA (always visible) */}
            <div className="pt-2">
              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/15"
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