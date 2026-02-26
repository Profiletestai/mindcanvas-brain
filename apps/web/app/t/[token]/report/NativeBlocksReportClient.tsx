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
      rounded?: "none" | "lg" | "xl" | "2xl" | "full";
      shadow?: boolean;
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
  | { type: "grid_pair"; left_src: string; left_caption?: string; right_src: string; right_caption?: string }
  | { type: "chart.frequency_card" }
  | { type: "chart.profile_mix_card" }
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

function fallbackTitleFromId(id: string, topProfileName: string) {
  const k = String(id || "").toLowerCase();
  if (k === "global.cover") return "Your OperatingFrame™ report";
  if (k === "global.welcome_letter") return "Welcome";
  if (k === "global.summary_dashboard") return "What this report includes";
  if (k === "global.how_to_use") return "How to use this report";
  if (k === "global.framework_explainer") return "How OperatingFrame™ works";
  if (k === "global.conclusion") return "Conclusion";
  if (k === "global.cta_next_steps") return "Next steps";

  if (k === "profile.identity") return topProfileName || "Your profile";
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

// --- display cleanup helpers (fix duplication like “P1: P1: Activator”) ---

function stripDoublePrefix(name: string) {
  const s = (name || "").trim();
  // If string starts with "P#: P#:"
  const m = s.match(/^(P\d+:\s*)(P\d+:\s*)(.+)$/i);
  if (m) return `${m[1]}${m[3]}`.trim();
  return s;
}

// ---------- Image resolution (your #1 problem) ----------

function resolveImageSrc(srcRaw: string, ctx: { orgSlug: string; primaryProfileName: string }) {
  const src = (srcRaw || "").trim();
  if (!src) return "";

  // already absolute
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
  // already public path
  if (src.startsWith("/")) return src;

  // macros you referenced in messages
  const base = "/images/operatingframe-full-test";
  const cards = `${base}/profile-cards`;

  // org logo (you can adjust this later if you store per-org logos elsewhere)
  if (src === "{{ORG_LOGO}}") return `${base}/org-logo.png`;

  // welcome image
  if (src === "bio-image.png" || src === "{{BIO_IMAGE}}") return `${base}/bio-image.png`;

  // grids
  if (src === "{{FREQUENCY_GRID}}" || src === "frequency-grid.png") return `${base}/frequency-grid.png`;
  if (src === "{{PROFILE_GRID}}" || src === "profile-grid.png") return `${base}/profile-grid.png`;

  // profile images
  if (src === "{{PROFILE_IMAGE_PRIMARY}}") {
    const file = slugifyProfileToCard(ctx.primaryProfileName);
    return `${cards}/${file}`;
  }

  // if user stores a card file name directly
  if (src.endsWith(".png") || src.endsWith(".jpg") || src.endsWith(".jpeg") || src.endsWith(".webp")) {
    // allow "activator.png" etc
    if (src.includes("profile-cards/")) return `${base}/${src}`;
    // if someone passed "activator.png"
    if (!src.includes("/")) return `${cards}/${src}`;
  }

  return src; // fallback
}

function slugifyProfileToCard(profileName: string) {
  // expected names: "Activator", "Vision Engineer", etc
  const raw = (profileName || "").trim().toLowerCase();
  const slug = raw
    .replace(/^p\d+:\s*/i, "") // remove "P1:" prefix
    .replace(/™/g, "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
  return `${slug}.png`;
}

// profile summaries (so the cards aren’t just headings)
const PROFILE_SUMMARY: Record<string, string> = {
  "P1": "Decisive, energetic initiator who gets things moving quickly.",
  "P2": "Communicates direction clearly; aligns and mobilises people through presence and message.",
  "P3": "Relationship-first stabiliser who builds trust and keeps teams connected.",
  "P4": "Connector of people and process; creates alignment and cohesion across functions.",
  "P5": "Practical executor who builds reliability and gets outcomes delivered.",
  "P6": "Structured organiser who brings order, plans, and predictable follow-through.",
  "P7": "Critical thinker who strengthens decisions through insight, accuracy, and quality control.",
  "P8": "Strategic architect who designs systems and long-term direction with depth.",
};

function profileCodeToP(code: string) {
  // your DB uses PROFILE_1..8 (seen in screenshots)
  const m = String(code || "").match(/(\d+)/);
  if (!m) return "";
  return `P${m[1]}`;
}

function profilePairForP(p: string) {
  // mapping you described (and matches your screenshot codes)
  if (p === "P1" || p === "P2") return "AB";
  if (p === "P3" || p === "P4") return "BC";
  if (p === "P5" || p === "P6") return "CD";
  if (p === "P7" || p === "P8") return "DA";
  return "";
}

function pairAccentClass(pair: string) {
  // subtle tint + border accents, not childish
  switch (pair) {
    case "AB":
      return "border-red-200 bg-red-50/40";
    case "BC":
      return "border-amber-200 bg-amber-50/40";
    case "CD":
      return "border-emerald-200 bg-emerald-50/40";
    case "DA":
      return "border-blue-200 bg-blue-50/40";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function freqColor(code: AB) {
  // your requested A red, B yellow, C green, D blue
  switch (code) {
    case "A":
      return { dot: "bg-red-500", bar: "bg-red-500", text: "text-red-600" };
    case "B":
      return { dot: "bg-amber-400", bar: "bg-amber-400", text: "text-amber-600" };
    case "C":
      return { dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600" };
    case "D":
      return { dot: "bg-blue-500", bar: "bg-blue-500", text: "text-blue-600" };
  }
}

// ---------- Premium visual primitives ----------

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-7 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-7 text-slate-900 shadow-sm ${props.className || ""}`}>{props.children}</div>;
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

// ---------- Charts: Frequency (styled) ----------

function FrequencyCard(props: {
  labels: Array<{ code: AB; name: string }>;
  pct: Record<AB, number>;
  top: AB;
}) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  return (
    <WhiteCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Frequency + profile</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {props.labels.find((x) => x.code === props.top)?.name || props.top}{" "}
            <span className="text-slate-500">({props.top})</span>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            Frequencies show how you naturally operate as a leader — where your energy goes under pressure. Higher = more
            natural, lower = less preferred.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Dominant</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{pctLabel(props.pct?.[props.top])}</div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((it) => {
          const c = freqColor(it.code);
          const isTop = it.code === props.top;
          const pct = Math.round(it.v * 100);
          return (
            <div key={it.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-full ${c.dot} text-white flex items-center justify-center text-sm font-bold`}>
                    {it.code}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {it.name} <span className="text-slate-500">({it.code})</span>
                      </div>
                      {isTop ? (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">Dominant</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-700">{pct}%</div>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-white">
                <div className={`h-2 rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </WhiteCard>
  );
}

// ---------- Charts: Profile radar (profiles-only) ----------

function ProfileRadar(props: { labels: Array<{ code: string; name: string }>; pct: Record<string, number> }) {
  // fixed order P1..P8
  const order = ["PROFILE_1", "PROFILE_2", "PROFILE_3", "PROFILE_4", "PROFILE_5", "PROFILE_6", "PROFILE_7", "PROFILE_8"];
  const values = order.map((k) => clamp01(props.pct?.[k] ?? 0));

  // SVG radar
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 110;

  function pt(i: number, val: number) {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const rr = r * val;
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  }

  const points = values.map((v, i) => pt(i, v));
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  const rings = [0.25, 0.5, 0.75, 1].map((k) => {
    const rr = r * k;
    return <circle key={k} cx={cx} cy={cy} r={rr} fill="none" stroke="#e5e7eb" />;
  });

  const axes = new Array(8).fill(0).map((_, i) => {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" />;
  });

  const labelPos = new Array(8).fill(0).map((_, i) => {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const x = cx + (r + 22) * Math.cos(a);
    const y = cy + (r + 22) * Math.sin(a);
    return { x, y };
  });

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Profile mix radar">
        {rings}
        {axes}

        {/* area */}
        <path d={d} fill="rgba(37, 99, 235, 0.18)" stroke="rgba(37, 99, 235, 0.85)" strokeWidth="2" />

        {/* points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="rgba(37, 99, 235, 0.95)" />
        ))}

        {/* labels P1..P8 */}
        {labelPos.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fill="#111827"
            style={{ fontWeight: 700 }}
          >
            {`P${i + 1}`}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ProfileMixCard(props: {
  labels: Array<{ code: string; name: string }>;
  pct: Record<string, number>;
  topCode: string;
  topName: string;
}) {
  return (
    <WhiteCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile mix</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">Primary + supporting</div>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            Profiles describe your execution pattern — how your leadership behaviour shows up day to day. Your mix shows
            primary and supporting styles.
          </p>
        </div>
        <div className="text-xs text-slate-500 pt-1">Profiles-only map</div>
      </div>

      <div className="mt-5">
        <ProfileRadar labels={props.labels} pct={props.pct} />
        <div className="mt-2 text-center text-xs text-slate-500">Higher = stronger pattern.</div>
      </div>
    </WhiteCard>
  );
}

// ---------- Triad cards (Primary/Secondary/Tertiary) ----------

function TriadCards(props: {
  ctx: {
    orgSlug: string;
    primary: { code: string; name: string; pct: number };
    secondary?: { code: string; name: string; pct: number };
    tertiary?: { code: string; name: string; pct: number };
  };
}) {
  const cards = [
    { role: "Primary profile", rank: 1, item: props.ctx.primary, tag: "Primary" },
    props.ctx.secondary ? { role: "Secondary", rank: 2, item: props.ctx.secondary, tag: "Supporting" } : null,
    props.ctx.tertiary ? { role: "Tertiary", rank: 3, item: props.ctx.tertiary, tag: "Supporting" } : null,
  ].filter(Boolean) as Array<{ role: string; rank: number; item: { code: string; name: string; pct: number }; tag: string }>;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => {
          const p = profileCodeToP(c.item.code);
          const pair = profilePairForP(p);
          const accent = pairAccentClass(pair);
          const summary = PROFILE_SUMMARY[p] || "A distinct pattern of contribution in how you execute and lead.";
          const img = resolveImageSrc("{{PROFILE_IMAGE_PRIMARY}}", {
            orgSlug: props.ctx.orgSlug,
            primaryProfileName: c.item.name,
          });

          return (
            <div key={c.rank} className={`rounded-3xl border p-5 ${accent}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">{c.role}</div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {p ? `${p}: ` : ""}{stripDoublePrefix(c.item.name)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{c.item.code}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {c.rank}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                  <img src={img} alt={stripDoublePrefix(c.item.name)} className="h-14 w-14 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold text-slate-900">{pctLabel(c.item.pct)} match</div>
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">{c.tag}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white">
                    <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.round(clamp01(c.item.pct) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-700 leading-relaxed">{summary}</p>
            </div>
          );
        })}
      </div>
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
    testName: string;
    primary: { code: string; name: string; pct: number };
    secondary?: { code: string; name: string; pct: number };
    tertiary?: { code: string; name: string; pct: number };
    topFreqName: string;
  };
}) {
  const { block, ctx } = props;
  const type = String((block as any)?.type || "").toLowerCase();

  if (type === "divider") return <hr className="my-7 border-slate-200" />;

  if (type === "spacer") {
    const s = String((block as any)?.size || "md");
    const h = s === "sm" ? "h-3" : s === "lg" ? "h-10" : "h-6";
    return <div className={h} />;
  }

  if (type === "image") {
    const raw = String((block as any)?.src || "").trim();
    const src = resolveImageSrc(raw, { orgSlug: ctx.data.org_slug, primaryProfileName: ctx.primary.name });
    if (!src) return null;

    const align = (String((block as any)?.align || "center") as any).toLowerCase();
    const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof (block as any)?.max_h === "number" ? (block as any).max_h : 420;
    const rounded = String((block as any)?.rounded || "2xl");
    const shadow = (block as any)?.shadow !== false;

    const rClass =
      rounded === "full"
        ? "rounded-full"
        : rounded === "xl"
          ? "rounded-xl"
          : rounded === "lg"
            ? "rounded-lg"
            : "rounded-2xl";

    return (
      <figure className="my-6">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText((block as any)?.alt)}
            crossOrigin="anonymous"
            className={`h-auto max-w-full ${rClass} border border-slate-200 bg-white ${shadow ? "shadow-sm" : ""}`}
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
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
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

  if (type === "scorecard_row") {
    const items = Array.isArray((block as any)?.items) ? (block as any).items : [];
    if (!items.length) return null;
    return (
      <div className="grid gap-4 md:grid-cols-3">
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

  if (type === "grid_pair") {
    const left = resolveImageSrc(String((block as any).left_src || ""), { orgSlug: ctx.data.org_slug, primaryProfileName: ctx.primary.name });
    const right = resolveImageSrc(String((block as any).right_src || ""), { orgSlug: ctx.data.org_slug, primaryProfileName: ctx.primary.name });
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <img src={left} alt="Frequency grid" className="w-full h-auto rounded-2xl border border-slate-200" />
          {(block as any).left_caption ? <div className="mt-2 text-xs text-slate-500 text-center">{safeText((block as any).left_caption)}</div> : null}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <img src={right} alt="Profile grid" className="w-full h-auto rounded-2xl border border-slate-200" />
          {(block as any).right_caption ? <div className="mt-2 text-xs text-slate-500 text-center">{safeText((block as any).right_caption)}</div> : null}
        </div>
      </div>
    );
  }

  if (type === "chart.frequency_card") {
    return <FrequencyCard labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />;
  }

  if (type === "chart.profile_mix_card") {
    return (
      <ProfileMixCard
        labels={ctx.data.profile_labels}
        pct={ctx.data.profile_percentages}
        topCode={ctx.data.top_profile_code}
        topName={ctx.data.top_profile_name}
      />
    );
  }

  if (type === "profiles.triad_cards") {
    return (
      <TriadCards
        ctx={{
          orgSlug: ctx.data.org_slug,
          primary: ctx.primary,
          secondary: ctx.secondary,
          tertiary: ctx.tertiary,
        }}
      />
    );
  }

  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text =
      safeText((block as any)?.text).trim() ||
      "Turn insight into action: use this report in a coaching conversation, a 1:1, or a team workshop.";
    const btn = safeText((block as any)?.button_text).trim() || "Book a discussion";

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
            <span className="text-xs text-white/70">No redirect_url (or next_steps_url) is configured for this link.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">Unsupported block type: {String((block as any).type || "unknown")}</p>
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
  const orgName = (data.org_name || "").trim() || "Organisation";
  const testName = (data.test_name || "").trim() || "Test";

  const topFreqCode = data.top_freq;
  const topFreqPct = data.frequency_percentages?.[topFreqCode] ?? 0;
  const topFreqName = data.frequency_labels.find((f) => f.code === topFreqCode)?.name || topFreqCode;

  const sortedProfiles = useMemo(() => {
    return [...data.profile_labels]
      .map((p) => ({ ...p, pct: data.profile_percentages?.[p.code] ?? 0 }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [data.profile_labels, data.profile_percentages]);

  const primary = sortedProfiles[0] || { code: data.top_profile_code, name: data.top_profile_name, pct: data.profile_percentages?.[data.top_profile_code] ?? 0 };
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
    // ✅ per your instruction: use redirect link first
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

  const ctx = useMemo(() => {
    return {
      data,
      participant,
      orgName,
      testName,
      primary: { code: primary?.code || data.top_profile_code, name: primary?.name || data.top_profile_name, pct: primary?.pct || 0 },
      secondary: secondary ? { code: secondary.code, name: secondary.name, pct: secondary.pct || 0 } : undefined,
      tertiary: tertiary ? { code: tertiary.code, name: tertiary.name, pct: tertiary.pct || 0 } : undefined,
      topFreqName,
    };
  }, [data, participant, orgName, testName, primary, secondary, tertiary, topFreqName]);

  // Header images
  const orgLogo = resolveImageSrc("{{ORG_LOGO}}", { orgSlug: data.org_slug, primaryProfileName: ctx.primary.name });
  const primaryProfileImg = resolveImageSrc("{{PROFILE_IMAGE_PRIMARY}}", { orgSlug: data.org_slug, primaryProfileName: ctx.primary.name });

  // Clean title (avoid duplication)
  const heroTitle = `Your Operating Style in Depth: ${stripDoublePrefix(ctx.primary.name)}`;

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* HEADER / HERO (clean + image-based as requested) */}
        <GlassCard className="overflow-hidden">
          <div className="flex items-start justify-between gap-6">
            {/* left */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                  {/* org logo */}
                  <img
                    src={orgLogo}
                    alt={orgName}
                    className="h-10 w-10 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* remove “Organisation” word; just show the values */}
                  <Pill>{orgName}</Pill>
                  <Pill>{testName}</Pill>
                </div>
              </div>

              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Personalised report</div>

              <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{heroTitle}</h1>

              <p className="mt-2 text-sm text-white/80">
                For <span className="font-semibold text-white">{participant}</span>
              </p>
              <p className="mt-1 text-sm text-white/80">
                Top profile: <span className="font-semibold text-white">{stripDoublePrefix(ctx.primary.name)}</span>
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

            {/* right */}
            <div className="hidden md:flex flex-col items-end gap-3">
              <div className="h-20 w-20 rounded-3xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                <img
                  src={primaryProfileImg}
                  alt={stripDoublePrefix(ctx.primary.name)}
                  className="h-16 w-16 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              {/* (no extra chips here — you asked to remove them) */}
              <div className="text-xs text-white/60 text-right max-w-[220px]">
                Dominant frequency: <span className="text-white/90 font-semibold">{topFreqName}</span> · {pctLabel(topFreqPct)}
              </div>
            </div>
          </div>

          <div className="mt-7">
            <MiniDivider />
          </div>

          {/* SUMMARY TWO-CARD ROW (slick + not clunky) */}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <FrequencyCard labels={data.frequency_labels} pct={data.frequency_percentages} top={data.top_freq} />
            <ProfileMixCard labels={data.profile_labels} pct={data.profile_percentages} topCode={data.top_profile_code} topName={data.top_profile_name} />
          </div>
        </GlassCard>

        {/* BODY: Index + Sections */}
        <div className="mt-7 grid gap-5 md:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-5 sticky top-6 self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Index</p>
            <p className="mt-1 text-xs text-slate-300">Jump straight to what you need.</p>

            <div className="mt-4 space-y-2">
              {indexItems.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
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

          <main className="space-y-5">
            {mergedSections.map((section, idx) => {
              const domId = getDomId(section, idx);
              const title =
                safeText(section.title).trim() ||
                fallbackTitleFromId(String(section.id || ""), data.top_profile_name);

              const blocks = Array.isArray(section.blocks) ? section.blocks : [];

              return (
                <section key={domId} id={domId} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    <h2 className="text-2xl font-bold text-slate-900">{title}</h2>

                    <div className="mt-5 space-y-4">
                      {blocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} />
                      ))}
                    </div>
                  </WhiteCard>
                </section>
              );
            })}

            {/* Bottom CTA (must exist) */}
            <div className="pt-2">
              <button
                onClick={openNextSteps}
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
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