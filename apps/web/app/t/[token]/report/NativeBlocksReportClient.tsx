// apps/web/app/t/[token]/report/NativeBlocksReportClient.tsx
"use client";

import { useMemo, useRef } from "react";
import AppBackground from "@/components/ui/AppBackground";

type AB = "A" | "B" | "C" | "D";

type LinkMeta = {
  next_steps_url?: string | null;
  show_results?: boolean | null;
  redirect_url?: string | null; // ✅ must drive "Next steps"
  hidden_results_message?: string | null;
  email_report?: boolean | null;

  // sometimes legacy links store redirect in meta
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
  | { type: "chart.profile_radar" } // alias
  | { type: "cta"; title?: string; text?: string; button_text?: string }
  | {
      type: "images.pair";
      left?: { src?: string; alt?: string; caption?: string; max_h?: number };
      right?: { src?: string; alt?: string; caption?: string; max_h?: number };
    }
  | {
      type: "profiles.triad_cards";
      show_pills?: boolean;
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
  org_logo_url?: string | null; // ✅ allow using DB logo if present
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

function cleanProfileName(raw: string) {
  const s = String(raw || "").trim();

  // Remove things like "PROFILE_1:" prefix and duplicated "P1:"
  let out = s.replace(/^PROFILE_\d+\s*:\s*/i, "");
  out = out.replace(/^\s*(P\d+)\s*:\s*(P\d+)\s*:/i, "$1:");
  out = out.replace(/^\s*(P\d+)\s*:\s*(P\d+)\s*/i, "$1 $2"); // just in case
  out = out.replace(/\s+/g, " ").trim();

  return out || s || "Top profile";
}

function fallbackTitleFromId(id: string, topProfileName: string) {
  const k = String(id || "").toLowerCase();

  if (k === "global.cover") return "Your personalised report";
  if (k === "global.welcome_letter") return "Welcome";
  if (k === "global.welcome") return "Welcome";
  if (k === "global.summary_dashboard") return "High Level Summary";
  if (k === "global.summary_explainer") return "High Level Summary";
  if (k === "global.what_this_report_includes") return "What this report includes";
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

// ---------- Test detection ----------

function isLead(data: ResultData) {
  const t = String(data?.test_name || "").toLowerCase();
  const o = String(data?.org_slug || "").toLowerCase();
  return t.includes("lead") || o.includes("lead");
}

// ---------- Image resolution (paths/macros) ----------

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

  // If already a normal path/http
  if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const lead = isLead(ctx.data);

  // Macros
  const map: Record<string, string> = lead
    ? {
        "{{FREQUENCY_GRID}}": "/images/mindCanvas-LEAD-system/frequency-grid.png",
        "{{PROFILE_GRID}}": "/images/mindCanvas-LEAD-system/profile-grid.png",
        "{{BIO_IMAGE}}": "/images/mindCanvas-LEAD-system/profile-cards/bio-image.png",
        "{{ORG_LOGO}}": "/images/mindCanvas-LEAD-system/org-logo.png",
      }
    : {
        "{{FREQUENCY_GRID}}": "/images/operatingframe-full-test/frequency-grid.png",
        "{{PROFILE_GRID}}": "/images/operatingframe-full-test/profile-grid.png",
        "{{BIO_IMAGE}}": "/images/operatingframe-full-test/profile-cards/bio-image.png",
        "{{ORG_LOGO}}": "/images/operatingframe-full-test/org-logo.png",
      };

  if (map[raw]) return map[raw];

  // Profile macros
  if (raw === "{{PROFILE_IMAGE_PRIMARY}}") {
    if (lead) {
      const f = leadProfileFileFromCode(ctx.primaryCode || ctx.data.top_profile_code) || leadProfileFileFromName(ctx.primaryName);
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

  // If someone stored "activator.png" etc:
  if (!raw.includes("/") && raw.toLowerCase().endsWith(".png")) {
    return lead
      ? `/images/mindCanvas-LEAD-system/profile-cards/${raw}`
      : `/images/operatingframe-full-test/profile-cards/${raw}`;
  }

  return raw;
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

function FrequencyBars(props: { labels: Array<{ code: AB; name: string }>; pct: Record<AB, number>; top: AB }) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const max = Math.max(...items.map((i) => i.v), 0.01);

  const color = (code: AB) =>
    code === "A" ? "bg-red-500" : code === "B" ? "bg-amber-500" : code === "C" ? "bg-emerald-500" : "bg-blue-500";

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.v / max) * 100);
        const isTop = it.code === props.top;
        return (
          <div key={it.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {it.name} <span className="text-slate-500">({it.code})</span>
                  </span>
                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">Dominant</span>
                  ) : null}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white">
                  <div className={`h-2 rounded-full ${color(it.code)}`} style={{ width: `${w}%` }} />
                </div>
              </div>
              <div className="ml-3 shrink-0 text-sm font-semibold text-slate-700">{pctLabel(it.v)}</div>
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
          <div key={it.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {rank}
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-900">{it.name}</span>
                  {isTop ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">Primary</span>
                  ) : null}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white">
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

// ---------- Profile triad cards (Primary/Secondary/Tertiary) ----------

function TriadCards(props: {
  ctx: {
    data: ResultData;
    primaryName: string;
    secondaryName: string;
    tertiaryName: string;
    primaryCode?: string;
  };
  primary: { code: string; name: string; pct: number } | undefined;
  secondary: { code: string; name: string; pct: number } | undefined;
  tertiary: { code: string; name: string; pct: number } | undefined;
}) {
  const { ctx, primary, secondary, tertiary } = props;

  const cardShell = (tone: "primary" | "support1" | "support2") =>
    tone === "primary" ? "border-red-200 bg-red-50" : tone === "support1" ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50";

  const pill = (tone: "Primary" | "Supporting") =>
    tone === "Primary" ? "bg-slate-900 text-white" : "bg-white/70 text-slate-900 border border-slate-200";

  const Card = (args: {
    tone: "primary" | "support1" | "support2";
    label: "PRIMARY PROFILE" | "SECONDARY" | "TERTIARY";
    rank: "1" | "2" | "3";
    item?: { code: string; name: string; pct: number };
    badge: "Primary" | "Supporting";
    imgSrc: string;
    snapshot: string;
  }) => {
    const it = args.item;
    return (
      <div className={`rounded-2xl border p-4 ${cardShell(args.tone)}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.22em] text-slate-500">{args.label}</div>
            <div className="mt-2 text-lg font-bold text-slate-900 leading-tight">{it ? cleanProfileName(it.name) : "—"}</div>
            <div className="mt-0.5 text-xs text-slate-600">{it?.code || "—"}</div>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{args.rank}</div>
        </div>

        <div className="mt-3 grid grid-cols-[72px_1fr] gap-3 items-center">
          <div className="h-[72px] w-[72px] rounded-2xl bg-white/70 border border-white/60 flex items-center justify-center overflow-hidden">
            {args.imgSrc ? (
              <img
                src={args.imgSrc}
                alt={it?.name || ""}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{pctLabel(it?.pct || 0)} match</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill(args.badge)}`}>{args.badge}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-white border border-white/60 overflow-hidden">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.round(clamp01(it?.pct || 0) * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-700 line-clamp-2">{args.snapshot}</p>
          </div>
        </div>
      </div>
    );
  };

  const snapshotFor = (name: string) => {
    const n = String(name || "").toLowerCase();
    if (n.includes("trailblazer")) return "Bold initiator who drives momentum and direction.";
    if (n.includes("spark")) return "Energises people and unlocks creativity fast.";
    if (n.includes("uplifter")) return "Builds optimism and momentum through people.";
    if (n.includes("bridge")) return "Connects perspectives and aligns teams.";
    if (n.includes("steady")) return "Stabilises execution through consistency.";
    if (n.includes("organis") || n.includes("organizer") || n.includes("organiser")) return "Creates structure and dependable delivery.";
    if (n.includes("analyst")) return "Improves decisions through depth and logic.";
    if (n.includes("refiner")) return "Raises quality through precision and clarity.";
    if (n.includes("activator")) return "Decisive initiator who creates momentum quickly.";
    if (n.includes("vision")) return "Strategic architect who designs direction with depth.";
    if (n.includes("messenger")) return "Aligns and mobilises people through clear communication.";
    if (n.includes("integrator")) return "Connects people and process to build cohesion.";
    if (n.includes("relator")) return "Builds trust and stability through relationships.";
    if (n.includes("operator")) return "Reliable executor who delivers outcomes consistently.";
    if (n.includes("planner")) return "Creates structure, order, and predictable execution.";
    if (n.includes("evaluator")) return "Improves decisions through insight, accuracy, and quality.";
    return "A key supporting pattern in how you lead and execute.";
  };

  const imgPrimary = resolveImageSrc("{{PROFILE_IMAGE_PRIMARY}}", {
    data: ctx.data,
    primaryName: ctx.primaryName,
    secondaryName: ctx.secondaryName,
    tertiaryName: ctx.tertiaryName,
    primaryCode: ctx.primaryCode,
  });

  const imgSecondary = resolveImageSrc("{{PROFILE_IMAGE_SECONDARY}}", {
    data: ctx.data,
    primaryName: ctx.primaryName,
    secondaryName: ctx.secondaryName,
    tertiaryName: ctx.tertiaryName,
    primaryCode: ctx.primaryCode,
  });

  const imgTertiary = resolveImageSrc("{{PROFILE_IMAGE_TERTIARY}}", {
    data: ctx.data,
    primaryName: ctx.primaryName,
    secondaryName: ctx.secondaryName,
    tertiaryName: ctx.tertiaryName,
    primaryCode: ctx.primaryCode,
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card tone="primary" label="PRIMARY PROFILE" rank="1" item={primary} badge="Primary" imgSrc={imgPrimary} snapshot={snapshotFor(primary?.name || ctx.primaryName)} />
        <Card tone="support1" label="SECONDARY" rank="2" item={secondary} badge="Supporting" imgSrc={imgSecondary} snapshot={snapshotFor(secondary?.name || ctx.secondaryName)} />
        <Card tone="support2" label="TERTIARY" rank="3" item={tertiary} badge="Supporting" imgSrc={imgTertiary} snapshot={snapshotFor(tertiary?.name || ctx.tertiaryName)} />
      </div>

      <div className="mt-3 text-center text-xs text-slate-500">
        Primary profile: <span className="font-semibold text-slate-700">{cleanProfileName(ctx.primaryName)}</span>
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
    primaryName: string;
    primaryCode: string;
    secondaryName: string;
    tertiaryName: string;
    topFreqName: string;
    topFreqCode: AB;
    topFreqPct: number;
  };
  sortedProfiles: Array<{ code: string; name: string; pct: number }>;
}) {
  const { block, ctx, sortedProfiles } = props;
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
        {(block as any)?.caption ? <figcaption className="mt-2 text-center text-xs text-slate-500">{safeText((block as any)?.caption)}</figcaption> : null}
      </figure>
    );
  }

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText((block as any).text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText((block as any).text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText((block as any).text)}</h3>;
  if (type === "h4")
    return <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText((block as any).text)}</h4>;

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
              {it?.title ? <div className={`text-sm font-semibold ${tone === "light" ? "text-slate-900" : "text-white"}`}>{safeText(it.title)}</div> : null}
              {it?.text ? <p className={`mt-2 text-sm leading-relaxed ${tone === "light" ? "text-slate-700" : "text-white/80"}`}>{safeText(it.text)}</p> : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "scorecard_row") {
    const items = Array.isArray((block as any)?.items) ? (block as any)?.items : [];
    if (!items.length) return null;
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{safeText(it?.label)}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{safeText(it?.value)}</div>
            {it?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(it?.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  if (type === "images.pair") {
    const left = (block as any)?.left || {};
    const right = (block as any)?.right || {};

    const leftSrc = resolveImageSrc(String(left?.src || ""), {
      data: ctx.data,
      primaryName: ctx.primaryName,
      secondaryName: ctx.secondaryName,
      tertiaryName: ctx.tertiaryName,
      primaryCode: ctx.primaryCode,
    });

    const rightSrc = resolveImageSrc(String(right?.src || ""), {
      data: ctx.data,
      primaryName: ctx.primaryName,
      secondaryName: ctx.secondaryName,
      tertiaryName: ctx.tertiaryName,
      primaryCode: ctx.primaryCode,
    });

    const leftMax = typeof left?.max_h === "number" ? left.max_h : 340;
    const rightMax = typeof right?.max_h === "number" ? right.max_h : 340;

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {leftSrc ? (
            <img
              src={leftSrc}
              alt={safeText(left?.alt)}
              className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
              style={{ maxHeight: leftMax, objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          {left?.caption ? <div className="mt-2 text-xs text-slate-500">{safeText(left.caption)}</div> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {rightSrc ? (
            <img
              src={rightSrc}
              alt={safeText(right?.alt)}
              className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
              style={{ maxHeight: rightMax, objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          {right?.caption ? <div className="mt-2 text-xs text-slate-500">{safeText(right.caption)}</div> : null}
        </div>
      </div>
    );
  }

  if (type === "profiles.triad_cards") {
    const primary = sortedProfiles[0];
    const secondary = sortedProfiles[1];
    const tertiary = sortedProfiles[2];

    return (
      <TriadCards
        ctx={{
          data: ctx.data,
          primaryName: ctx.primaryName,
          secondaryName: ctx.secondaryName,
          tertiaryName: ctx.tertiaryName,
          primaryCode: ctx.primaryCode,
        }}
        primary={primary}
        secondary={secondary}
        tertiary={tertiary}
      />
    );
  }

  if (type === "chart.frequency_bars") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Frequency</div>
          <div className="text-xs text-slate-500">Your energy distribution</div>
        </div>
        <div className="mt-4">
          <FrequencyBars labels={ctx.data.frequency_labels} pct={ctx.data.frequency_percentages} top={ctx.data.top_freq} />
        </div>
      </div>
    );
  }

  if (type === "chart.profile_radar" || type === "chart.profile_bars") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Profile mix</div>
          <div className="text-xs text-slate-500">Primary + supporting</div>
        </div>
        <div className="mt-4">
          <ProfileBars labels={ctx.data.profile_labels} pct={ctx.data.profile_percentages} topCode={ctx.data.top_profile_code} />
        </div>
      </div>
    );
  }

  if (type === "cta") {
    const title = safeText((block as any)?.title).trim() || "Next steps";
    const text =
      safeText((block as any)?.text).trim() ||
      "Turn insight into action: use this report in a coaching conversation, a 1:1, or a team workshop.";
    const btn = safeText((block as any)?.button_text).trim() || "Go to next steps";

    // ✅ Use redirect_url first, then meta fallbacks
    const url =
      String(
        ctx.data?.link?.redirect_url ||
          ctx.data?.link?.next_steps_url ||
          ctx.data?.link?.meta?.redirect_url ||
          ctx.data?.link?.meta?.next_steps_url ||
          "",
      ).trim();

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
            <span className="text-xs text-white/70">No redirect_url is configured for this link.</span>
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

// ---------- Default content injection (only used when a section has ZERO blocks) ----------

function defaultBlocksForSection(sectionId: string): ReportSectionBlock[] {
  const id = String(sectionId || "").toLowerCase();
  if (id === "global.cta_next_steps") {
    return [{ type: "cta", title: "Next steps", text: "Book your follow-up conversation.", button_text: "Next steps" }];
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

  const primaryName = cleanProfileName(primary?.name || data.top_profile_name || "Top profile");
  const secondaryName = cleanProfileName(secondary?.name || "");
  const tertiaryName = cleanProfileName(tertiary?.name || "");

  // ✅ Hero images (prefer DB org logo if available)
  const orgLogoSrc =
    String(data.org_logo_url || "").trim() ||
    resolveImageSrc("{{ORG_LOGO}}", { data, primaryName, secondaryName, tertiaryName, primaryCode: primary?.code || data.top_profile_code });

  const profileHeroSrc = resolveImageSrc("{{PROFILE_IMAGE_PRIMARY}}", {
    data,
    primaryName,
    secondaryName,
    tertiaryName,
    primaryCode: primary?.code || data.top_profile_code,
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
    // ✅ redirect_url first, then meta fallbacks (important for portal viewer)
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
      primaryCode: (primary?.code || data.top_profile_code || "").toUpperCase(),
      secondaryName,
      tertiaryName,
      topFreqName,
      topFreqCode,
      topFreqPct,
    };
  }, [data, participant, orgName, primaryName, primary?.code, secondaryName, tertiaryName, topFreqName, topFreqCode, topFreqPct]);

  const gridImg = resolveImageSrc("{{PROFILE_GRID}}", {
    data,
    primaryName,
    secondaryName,
    tertiaryName,
    primaryCode: primary?.code || data.top_profile_code,
  });

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between gap-6">
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

                <div>
                  <div className="text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Personalised report</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge>{orgName}</Badge>
                    <Badge>{reportTitle}</Badge>
                  </div>
                </div>
              </div>

              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                Your Operating Style in Depth: <span className="text-white/90">{primaryName}</span>
              </h1>

              <div className="mt-2 text-sm text-white/80">
                For <span className="font-semibold text-white">{participant}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                  Top profile: {primaryName}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                  Top frequency: {topFreqName} ({topFreqCode}) · {pctLabel(topFreqPct)}
                </span>
                {secondaryName ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    Secondary: {secondaryName}
                  </span>
                ) : null}
                {tertiaryName ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    Tertiary: {tertiaryName}
                  </span>
                ) : null}
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

            <div className="hidden md:block shrink-0">
              <div className="h-[96px] w-[96px] rounded-3xl bg-white/10 border border-white/15 overflow-hidden shadow-sm">
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

            <WhiteCard>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Profile map</div>
                <div className="text-xs text-slate-500">At a glance</div>
              </div>

              <div className="mt-2 text-sm text-slate-700">
                This view shows your profile distribution across the model (higher = stronger pattern).
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                {gridImg ? (
                  <img
                    src={gridImg}
                    alt="Profile grid"
                    className="w-full rounded-2xl"
                    style={{ objectFit: "contain", maxHeight: 240 }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}

                <div className="mt-4">
                  <ProfileBars labels={data.profile_labels} pct={data.profile_percentages} topCode={data.top_profile_code} />
                </div>
              </div>
            </WhiteCard>
          </div>
        </GlassCard>

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

              const finalBlocks = hasRealBlocks ? blocks : defaultBlocksForSection(rawId);

              return (
                <section key={domId} id={domId} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <WhiteCard>
                    <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                    <div className="mt-4 space-y-3">
                      {finalBlocks.map((b, i) => (
                        <BlockRenderer key={i} block={b} ctx={ctx} sortedProfiles={sortedProfiles} />
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