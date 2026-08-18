//apps/web/app/t/[token]/report/LeadSystemReportClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";

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
    [key: string]: any;
  } | null;
  [key: string]: any;
};

type ReportBlock = {
  type?: string;
  text?: string;
  title?: string;
  cite?: string;
  items?: any[];
  bullets?: string[];
  columns?: number;
  tone?: string;
  src?: string;
  alt?: string;
  caption?: string;
  align?: "left" | "center" | "right";
  max_h?: number;
  rounded?: boolean;
  size?: "sm" | "md" | "lg";
  button_text?: string;
  left?: any;
  right?: any;
  [key: string]: any;
};

type ReportSection = {
  id?: string;
  title?: string | null;
  blocks?: ReportBlock[] | null;
};

type SectionsPayload = {
  common?: ReportSection[] | { sections?: ReportSection[] | null } | null;
  profile?: ReportSection[] | { sections?: ReportSection[] | null } | null;
  profiles?: Record<
    string,
    { title?: string; sections?: ReportSection[] | null } | ReportSection[] | null
  > | null;
  framework?: any;
  reportFramework?: any;
  framework_path?: string | null;
  framework_bucket?: string | null;
  [key: string]: any;
};

export type LeadSystemResultData = {
  org_slug: string;
  org_name?: string | null;
  org_logo_url?: string | null;
  test_name: string;
  report_date?: string | null;
  framework_id?: string | null;
  framework_content_blocks?: SectionsPayload | null;

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
  debug?: any;
};

type RankedProfile = {
  code: string;
  name: string;
  pct: number;
  sourceIndex: number;
};

const APPROACH_FALLBACKS: Record<AB, string> = {
  A: "Launch",
  B: "Energise",
  C: "Align",
  D: "Discern",
};

const APPROACH_COPY: Record<AB, string> = {
  A: "Future-focused energy that initiates movement, spots opportunity and opens new possibilities.",
  B: "People-focused energy that builds belief, connection, motivation and shared momentum.",
  C: "Delivery-focused energy that creates clarity, structure, coordination and reliable rhythm.",
  D: "Insight-focused energy that tests assumptions, sees risk and improves the quality of decisions.",
};

const APPROACH_SHORT_COPY: Record<AB, string> = {
  A: "Future, possibility, momentum and activation.",
  B: "People, connection, motivation and activation.",
  C: "Structure, coordination, clarity and delivery.",
  D: "Insight, perspective, quality and risk awareness.",
};

const APPROACH_COLOURS: Record<AB, { solid: string; soft: string; ring: string }> = {
  A: { solid: "#e35d5b", soft: "#fff2f1", ring: "#f3b3b1" },
  B: { solid: "#d9a521", soft: "#fff8e6", ring: "#edd181" },
  C: { solid: "#3b9a7d", soft: "#edf8f4", ring: "#9dd2c0" },
  D: { solid: "#5478bd", soft: "#eff3fb", ring: "#adc0e5" },
};

const PROFILE_FALLBACKS: Record<string, string> = {
  P1: "Trailblazer",
  P2: "Spark",
  P3: "Uplifter",
  P4: "Bridgebuilder",
  P5: "Steadyhand",
  P6: "Organiser",
  P7: "Analyst",
  P8: "Refiner",
};

const PROFILE_COPY: Record<string, string> = {
  P1: "Initiates movement, challenges the status quo and spots the future early.",
  P2: "Activates energy, rallies people and brings enthusiasm to new beginnings.",
  P3: "Builds morale, supports people and strengthens culture and connection.",
  P4: "Connects people and plans, translating strategy into coordinated action.",
  P5: "Holds structure, creates reliability and keeps momentum steady over time.",
  P6: "Designs systems, improves process and makes delivery more efficient.",
  P7: "Clarifies truth, spots risk and increases the quality of decisions.",
  P8: "Improves ideas, sharpens strategy and turns insight into better direction.",
};

const PROFILE_GUIDANCE: Record<string, string> = {
  P1: "Lead with courage, create a pause before action, and build the alignment that lets momentum last.",
  P2: "Lead with energy, add focus and follow-through, and turn enthusiasm into sustained progress.",
  P3: "Lead with connection, protect your boundaries, and build the structure that lets your empathy last.",
  P4: "Lead with connection, make ownership explicit, and protect momentum with clear decisions.",
  P5: "Lead with steadiness, surface concerns earlier, and make space for necessary change.",
  P6: "Lead with structure, keep people visible in the process, and leave room for adaptation.",
  P7: "Lead with insight, share conclusions sooner, and balance rigour with timely action.",
  P8: "Lead with refinement, define what is good enough, and let progress test the idea.",
};

function safeText(value: any): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join(" ");
  if (value == null) return "";
  return String(value);
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pct(value: number | undefined) {
  const normalised = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${Math.round(clamp01(normalised) * 100)}%`;
}

function fullName(first?: string | null, last?: string | null) {
  const name = `${String(first || "").trim()} ${String(last || "").trim()}`.trim();
  return name || "Participant";
}

function cleanProfileName(value: string) {
  return String(value || "")
    .replace(/^PROFILE_\d+\s*:\s*/i, "")
    .replace(/^P\d+\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function approachLabel(name: string, code: AB) {
  const cleanName = String(name || "").trim();
  return new RegExp(`\\(${code}\\)`, "i").test(cleanName) ? cleanName : `${cleanName} (${code})`;
}

function shortProfileCode(value: any) {
  const code = String(value || "").trim().toUpperCase();
  const match = code.match(/^(?:PROFILE[_\s-]?|P)?([1-8])$/i);
  return match ? `P${match[1]}` : code;
}

function longProfileCode(value: any) {
  const short = shortProfileCode(value);
  const match = short.match(/^P([1-8])$/);
  return match ? `PROFILE_${match[1]}` : short;
}

function getProfileValue(values: Record<string, number> | undefined, code: string) {
  if (!values) return 0;
  const short = shortProfileCode(code);
  const long = longProfileCode(code);
  const value = values[short] ?? values[long] ?? values[code] ?? 0;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normaliseId(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sectionDomId(section: ReportSection, index: number) {
  const fromId = normaliseId(safeText(section.id));
  if (fromId) return `lead-${fromId}`;
  const fromTitle = normaliseId(safeText(section.title));
  return fromTitle ? `lead-${fromTitle}` : `lead-section-${index + 1}`;
}

function getSectionsArray(value: any): ReportSection[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (Array.isArray(value?.sections)) return value.sections.filter(Boolean);
  return [];
}

function getProfilePayload(root: any, profileCode: string) {
  const profiles = root?.profiles;
  if (!profiles || typeof profiles !== "object") return null;

  const short = shortProfileCode(profileCode);
  const long = longProfileCode(profileCode);
  return profiles[long] || profiles[short] || profiles[profileCode] || null;
}

function isClosingSection(section: ReportSection) {
  const haystack = `${safeText(section.id)} ${safeText(section.title)}`.toLowerCase();
  return (
    haystack.includes("closing") ||
    haystack.includes("conclusion") ||
    haystack.includes("next step") ||
    haystack.includes("next_step") ||
    haystack.includes("methodology")
  );
}

function resolveSections(data: LeadSystemResultData): ReportSection[] {
  const source = data.sections || data.framework_content_blocks;
  const roots = [source?.framework, source?.reportFramework, source].filter(Boolean);

  for (const root of roots) {
    const common = getSectionsArray(root?.common);
    const directProfile = getSectionsArray(root?.profile);
    const selectedProfile = getSectionsArray(getProfilePayload(root, data.top_profile_code));

    const intro = common.filter((section) => !isClosingSection(section));
    const closing = common.filter(isClosingSection);
    const merged = [...intro, ...directProfile, ...selectedProfile, ...closing].filter(Boolean);
    if (merged.length) return merged;
  }

  return [];
}

function fallbackSectionTitle(section: ReportSection, topProfileName: string) {
  const id = safeText(section.id).toLowerCase();
  if (id.includes("welcome")) return "Welcome from Daniel Acutt";
  if (id.includes("how_to_use")) return "How to Use This Report";
  if (id.includes("lead_introduction") || id.includes("framework")) {
    return "What the MindCanvas LEAD System Measures";
  }
  if (id.includes("identity")) return `The Essence of the ${topProfileName}`;
  if (id.includes("next_step")) return "Your Next Steps";
  if (id.includes("reflection")) return "Your Reflection Questions";

  const stripped = id.replace(/^global\./, "").replace(/^profile\./, "").replaceAll("_", " ");
  if (stripped) return stripped.replace(/\b\w/g, (char) => char.toUpperCase());
  return "Your LEAD Report";
}

function getNextStepsUrl(data: LeadSystemResultData) {
  const candidates = [
    data.link?.redirect_url,
    data.link?.next_steps_url,
    data.link?.meta?.redirect_url,
    data.link?.meta?.next_steps_url,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      // Invalid optional links are intentionally ignored.
    }
  }

  return "";
}

function formatReportDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function profileImage(code: string) {
  const short = shortProfileCode(code);
  const filenames: Record<string, string> = {
    P1: "p1-trailblazer.png",
    P2: "p2-spark.png",
    P3: "p3-uplifter.png",
    P4: "p4-bridgebuilder.png",
    P5: "p5-steadyhand.png",
    P6: "p6-organiser.png",
    P7: "p7-analyst.png",
    P8: "p8-refiner.png",
  };
  return filenames[short] ? `/mps/profile-icons/${filenames[short]}` : "";
}

function approachImage(code: AB) {
  return `/mps/four-lead-approaches/${APPROACH_FALLBACKS[code].toLowerCase()}.png`;
}

function resolveImageSrc(rawValue: any, data: LeadSystemResultData, ranked: RankedProfile[]) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("https://") || raw.startsWith("http://")) return raw;

  const tokenMap: Record<string, string> = {
    "{{FREQUENCY_GRID}}": "/images/mindCanvas-LEAD-system/frequency-grid.png",
    "{{PROFILE_GRID}}": "/images/mindCanvas-LEAD-system/profile-grid.png",
    "{{BIO_IMAGE}}": "/images/mindCanvas-LEAD-system/bio-image.png",
    "{{DANIEL_IMAGE}}": "/images/mindCanvas-LEAD-system/bio-image.png",
    "{{ORG_LOGO}}": String(data.org_logo_url || "").trim() || "/images/mindCanvas-LEAD-system/logo.png",
    "{{PROFILE_IMAGE_PRIMARY}}": profileImage(ranked[0]?.code || data.top_profile_code),
    "{{PROFILE_IMAGE_SECONDARY}}": profileImage(ranked[1]?.code || ""),
    "{{PROFILE_IMAGE_TERTIARY}}": profileImage(ranked[2]?.code || ""),
  };

  if (tokenMap[raw]) return tokenMap[raw];
  if (!raw.includes("/") && raw.toLowerCase().endsWith(".png")) {
    return `/images/mindCanvas-LEAD-system/profile-cards/${raw}`;
  }
  return raw;
}

function extractSectionItems(section: ReportSection | undefined, limit = 3) {
  if (!section) return [];
  const output: string[] = [];

  for (const block of section.blocks || []) {
    if (Array.isArray(block.items)) {
      for (const item of block.items) {
        const value = typeof item === "string" ? item : safeText(item?.text || item?.title);
        if (value.trim()) output.push(value.trim());
      }
    }
    if (Array.isArray(block.bullets)) {
      output.push(...block.bullets.map(safeText).map((item) => item.trim()).filter(Boolean));
    }
    if (block.type === "p" && block.text) output.push(safeText(block.text).trim());
    if (output.length >= limit) break;
  }

  return output.slice(0, limit);
}

function findSection(sections: ReportSection[], terms: string[]) {
  return sections.find((section) => {
    const haystack = `${safeText(section.id)} ${safeText(section.title)}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

function FrequencyChart({
  labels,
  values,
  dominant,
}: {
  labels: Array<{ code: AB; name: string }>;
  values: Record<AB, number>;
  dominant: AB;
}) {
  const ordered = (["A", "B", "C", "D"] as AB[]).map((code) => ({
    code,
    name: labels.find((item) => item.code === code)?.name || APPROACH_FALLBACKS[code],
    value: clamp01(values?.[code] ?? 0),
  }));

  return (
    <div className="chart-card rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
      <div className="grid h-[270px] grid-cols-4 items-end gap-3 border-b border-slate-200 sm:gap-5">
        {ordered.map((item) => {
          const height = Math.max(item.value * 100, item.value > 0 ? 3 : 0);
          const colours = APPROACH_COLOURS[item.code];
          return (
            <div key={item.code} className="flex h-full min-w-0 flex-col items-center justify-end">
              <span className="mb-2 text-sm font-bold text-[#0b2545]">{pct(item.value)}</span>
              <div className="relative flex h-[205px] w-full max-w-[58px] items-end overflow-hidden rounded-t-xl bg-slate-100">
                <div
                  className="w-full rounded-t-xl transition-[height] duration-500"
                  style={{ height: `${height}%`, backgroundColor: colours.solid }}
                />
              </div>
              <span
                className="-mb-3 mt-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-white"
                style={{ backgroundColor: colours.solid }}
              >
                {item.code}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ordered.map((item) => (
          <div key={item.code} className="min-w-0 text-center">
            <div className={`text-xs font-bold ${item.code === dominant ? "text-[#b18414]" : "text-[#0b2545]"}`}>
              {item.name}
            </div>
            {item.code === dominant ? <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b18414]">Dominant</div> : null}
          </div>
        ))}
      </div>

      <div className="sr-only">
        {ordered.map((item) => `${item.name} (${item.code}): ${pct(item.value)}`).join("; ")}
      </div>
    </div>
  );
}

function ProfileRadar({ ranked, values }: { ranked: RankedProfile[]; values: Record<string, number> }) {
  const labels = Array.from({ length: 8 }, (_, index) => `P${index + 1}`);
  const size = 390;
  const centre = size / 2;
  const radius = 142;
  const maxValue = Math.max(0.5, ...labels.map((code) => getProfileValue(values, code)));

  function point(index: number, value: number) {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const scaled = clamp01(value / maxValue);
    return {
      x: centre + Math.cos(angle) * radius * scaled,
      y: centre + Math.sin(angle) * radius * scaled,
    };
  }

  const polygon = labels
    .map((code, index) => point(index, getProfileValue(values, code)))
    .map((item) => `${item.x},${item.y}`)
    .join(" ");

  return (
    <div className="chart-card rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mx-auto max-w-[430px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label="Eight-profile personality map">
          {[0.2, 0.4, 0.6, 0.8, 1].map((ring) => (
            <polygon
              key={ring}
              points={labels
                .map((_, index) => {
                  const p = point(index, maxValue * ring);
                  return `${p.x},${p.y}`;
                })
                .join(" ")}
              fill="none"
              stroke="rgba(11,37,69,0.13)"
            />
          ))}

          {labels.map((code, index) => {
            const outer = point(index, maxValue);
            return <line key={code} x1={centre} y1={centre} x2={outer.x} y2={outer.y} stroke="rgba(11,37,69,0.13)" />;
          })}

          <polygon points={polygon} fill="rgba(215,169,40,0.2)" stroke="#d7a928" strokeWidth="3" />

          {labels.map((code, index) => {
            const value = getProfileValue(values, code);
            const p = point(index, value);
            return <circle key={code} cx={p.x} cy={p.y} r="4.5" fill="#0b2545" stroke="white" strokeWidth="2" />;
          })}

          {labels.map((code, index) => {
            const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
            const labelRadius = radius + 30;
            const x = centre + Math.cos(angle) * labelRadius;
            const y = centre + Math.sin(angle) * labelRadius;
            const profile = ranked.find((item) => shortProfileCode(item.code) === code);
            return (
              <g key={`label-${code}`}>
                <text x={x} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0b2545">
                  {code}
                </text>
                <text x={x} y={y + 10} textAnchor="middle" fontSize="10" fill="#667085">
                  {pct(profile?.pct ?? 0)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="sr-only">
        {ranked.map((profile) => `${profile.name} (${shortProfileCode(profile.code)}): ${pct(profile.pct)}`).join("; ")}
      </div>
    </div>
  );
}

function BlockRenderer({
  block,
  data,
  ranked,
  nextStepsUrl,
}: {
  block: ReportBlock;
  data: LeadSystemResultData;
  ranked: RankedProfile[];
  nextStepsUrl: string;
}) {
  const type = String(block?.type || "").toLowerCase().trim();

  if (type === "divider") return <hr className="my-7 border-slate-200" />;
  if (type === "spacer") return <div className={block.size === "lg" ? "h-10" : block.size === "sm" ? "h-3" : "h-6"} />;

  if (type === "h1") return <h3 className="pt-2 text-2xl font-bold tracking-tight text-[#0b2545]">{safeText(block.text)}</h3>;
  if (type === "h2") return <h3 className="pt-2 text-xl font-bold tracking-tight text-[#0b2545]">{safeText(block.text)}</h3>;
  if (type === "h3") return <h4 className="pt-2 text-base font-bold text-[#0b2545]">{safeText(block.text)}</h4>;
  if (type === "h4") return <h5 className="pt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9a7410]">{safeText(block.text)}</h5>;
  if (type === "p") return <p className="whitespace-pre-line text-[15px] leading-7 text-slate-700">{safeText(block.text)}</p>;

  if (type === "ul" || type === "ol") {
    const Tag = type === "ol" ? "ol" : "ul";
    const items = Array.isArray(block.items) ? block.items : [];
    return (
      <Tag className={`${type === "ol" ? "list-decimal" : "list-disc"} space-y-2 pl-6 text-[15px] leading-7 text-slate-700`}>
        {items.map((item, index) => <li key={index}>{safeText(item)}</li>)}
      </Tag>
    );
  }

  if (type === "quote") {
    return (
      <blockquote className="rounded-r-2xl border-l-4 border-[#d7a928] bg-[#fff9e9] px-5 py-4">
        <p className="text-[15px] italic leading-7 text-[#0b2545]">“{safeText(block.text)}”</p>
        {block.cite ? <footer className="mt-2 text-xs font-semibold text-slate-500">— {safeText(block.cite)}</footer> : null}
      </blockquote>
    );
  }

  if (type === "image") {
    const src = resolveImageSrc(block.src, data, ranked);
    if (!src) return null;
    const justify = block.align === "left" ? "justify-start" : block.align === "right" ? "justify-end" : "justify-center";
    return (
      <figure className="my-6">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText(block.alt)}
            className={`${block.rounded === false ? "rounded-lg" : "rounded-2xl"} h-auto max-w-full border border-slate-200 bg-white object-contain`}
            style={{ maxHeight: typeof block.max_h === "number" ? block.max_h : 420 }}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
        {block.caption ? <figcaption className="mt-2 text-center text-xs text-slate-500">{safeText(block.caption)}</figcaption> : null}
      </figure>
    );
  }

  if (type === "callout") {
    const toneClass =
      block.tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : block.tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-[#d7a928]/30 bg-[#fff9e9]";
    return (
      <div className={`rounded-2xl border p-5 ${toneClass}`}>
        {block.title ? <h4 className="font-bold text-[#0b2545]">{safeText(block.title)}</h4> : null}
        {block.text ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{safeText(block.text)}</p> : null}
        {Array.isArray(block.bullets) && block.bullets.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {block.bullets.map((item, index) => <li key={index}>{safeText(item)}</li>)}
          </ul>
        ) : null}
      </div>
    );
  }

  if (type === "chips") {
    return (
      <div className="flex flex-wrap gap-2">
        {(Array.isArray(block.items) ? block.items : []).map((item, index) => (
          <span key={index} className="rounded-full border border-[#d7a928]/35 bg-[#fff9e9] px-3 py-1.5 text-xs font-bold text-[#76580b]">
            {safeText(item)}
          </span>
        ))}
      </div>
    );
  }

  if (type === "cards" || type === "scorecard_row") {
    const items = Array.isArray(block.items) ? block.items : [];
    const columns = type === "scorecard_row" ? 3 : Number(block.columns || 2);
    const grid = columns === 3 ? "md:grid-cols-3" : columns === 1 ? "md:grid-cols-1" : "md:grid-cols-2";
    return (
      <div className={`grid gap-3 ${grid}`}>
        {items.map((item: any, index) => (
          <div key={index} className="report-card rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a7410]">
              {safeText(item?.title || item?.label)}
            </div>
            <div className={`${item?.value ? "mt-2 text-lg font-bold text-[#0b2545]" : "mt-2 text-sm leading-6 text-slate-700"}`}>
              {safeText(item?.value || item?.text)}
            </div>
            {item?.hint ? <div className="mt-1 text-xs text-slate-500">{safeText(item.hint)}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  if (type === "chart.frequency_bars") {
    return <FrequencyChart labels={data.frequency_labels} values={data.frequency_percentages} dominant={data.top_freq} />;
  }
  if (type === "chart.profile_radar" || type === "chart.profile_bars") {
    return <ProfileRadar ranked={ranked} values={data.profile_percentages} />;
  }

  if (type === "images.pair") {
    const pair = [block.left, block.right].filter(Boolean);
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {pair.map((item, index) => {
          const src = resolveImageSrc(item?.src, data, ranked);
          if (!src) return null;
          return (
            <figure key={index} className="report-card rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img
                src={src}
                alt={safeText(item?.alt)}
                className="mx-auto h-auto max-w-full rounded-xl object-contain"
                style={{ maxHeight: typeof item?.max_h === "number" ? item.max_h : 320 }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              {item?.caption ? <figcaption className="mt-2 text-center text-xs text-slate-500">{safeText(item.caption)}</figcaption> : null}
            </figure>
          );
        })}
      </div>
    );
  }

  if (type === "cta") {
    return (
      <div className="report-card rounded-2xl bg-[#0b2545] p-5 text-white">
        <h4 className="font-bold">{safeText(block.title || "Your Next Steps")}</h4>
        {block.text ? <p className="mt-2 text-sm leading-6 text-white/75">{safeText(block.text)}</p> : null}
        {nextStepsUrl ? (
          <a href={nextStepsUrl} target="_blank" rel="noreferrer" className="no-print mt-4 inline-flex rounded-full bg-[#d7a928] px-5 py-2.5 text-sm font-bold text-[#0b2545] hover:bg-[#e4bd4d] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0b2545]">
            {safeText(block.button_text || "Next Step")}
          </a>
        ) : null}
      </div>
    );
  }

  return null;
}

function SectionCard({
  section,
  index,
  data,
  ranked,
  nextStepsUrl,
}: {
  section: ReportSection;
  index: number;
  data: LeadSystemResultData;
  ranked: RankedProfile[];
  nextStepsUrl: string;
}) {
  const id = sectionDomId(section, index);
  const title = safeText(section.title).trim() || fallbackSectionTitle(section, ranked[0]?.name || data.top_profile_name);
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];

  return (
    <section id={id} className="report-section scroll-mt-6 rounded-[28px] border border-white/10 bg-white/5 p-2 sm:p-3">
      <div className="rounded-[22px] bg-white px-5 py-6 text-slate-900 shadow-[0_18px_60px_rgba(0,0,0,0.12)] sm:px-8 sm:py-8">
        <div className="mb-5 flex items-start gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4cf] text-xs font-bold text-[#8a680c]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="min-w-0 text-xl font-bold tracking-tight text-[#0b2545] sm:text-2xl">{title}</h2>
        </div>

        {blocks.length ? (
          <div className="space-y-4">
            {blocks.map((block, blockIndex) => (
              <BlockRenderer key={blockIndex} block={block} data={data} ranked={ranked} nextStepsUrl={nextStepsUrl} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">This section has not been populated yet.</p>
        )}
      </div>
    </section>
  );
}

export default function LeadSystemReportClient({
  token,
  tid,
  src,
  data,
}: {
  token: string;
  tid: string;
  src: string;
  data: LeadSystemResultData;
}) {
  void token;
  void tid;
  void src;

  const reportRef = useRef<HTMLDivElement | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);
  const reportDate = formatReportDate(data.report_date);

  const ranked = useMemo<RankedProfile[]>(() => {
    const storedTopCode = shortProfileCode(data.top_profile_code);
    const source = data.profile_labels?.length
      ? data.profile_labels
      : Array.from({ length: 8 }, (_, index) => ({ code: `P${index + 1}`, name: PROFILE_FALLBACKS[`P${index + 1}`] }));

    return source
      .map((profile, sourceIndex) => {
        const code = shortProfileCode(profile.code || `P${sourceIndex + 1}`);
        return {
          code,
          name: cleanProfileName(profile.name) || PROFILE_FALLBACKS[code] || code,
          pct: getProfileValue(data.profile_percentages, code),
          sourceIndex,
        };
      })
      .sort((left, right) => {
        const scoreDifference = right.pct - left.pct;
        if (scoreDifference !== 0) return scoreDifference;
        if (left.code === storedTopCode && right.code !== storedTopCode) return -1;
        if (right.code === storedTopCode && left.code !== storedTopCode) return 1;
        return left.sourceIndex - right.sourceIndex;
      });
  }, [data.profile_labels, data.profile_percentages, data.top_profile_code]);

  const primary = ranked[0] || {
    code: shortProfileCode(data.top_profile_code || "P1"),
    name: cleanProfileName(data.top_profile_name) || "Top profile",
    pct: getProfileValue(data.profile_percentages, data.top_profile_code),
    sourceIndex: 0,
  };
  const secondary = ranked[1];
  const tertiary = ranked[2];
  const canonicalProfiles = [...ranked].sort(
    (left, right) => Number(shortProfileCode(left.code).replace("P", "")) - Number(shortProfileCode(right.code).replace("P", ""))
  );

  const dominantCode = data.top_freq || "A";
  const dominantName = data.frequency_labels?.find((item) => item.code === dominantCode)?.name || APPROACH_FALLBACKS[dominantCode];
  const dominantPct = data.frequency_percentages?.[dominantCode] ?? 0;

  const sections = useMemo(() => resolveSections(data), [data]);
  const strengths = extractSectionItems(findSection(sections, ["strength"]), 3);
  const risks = extractSectionItems(findSection(sections, ["overuse", "blindspot", "risk", "development area"]), 3);
  const priorities = extractSectionItems(findSection(sections, ["development priorit", "next step", "action"]), 3);
  const strengthSummary = strengths.length ? strengths.join(" ") : PROFILE_COPY[primary.code];
  const riskSummary = risks.length
    ? risks.join(" ")
    : "Notice when a natural strength is being overused or when another approach needs more room.";
  const developmentPriorities = priorities.length
    ? priorities
    : ["Choose one practical shift that protects your strengths while widening your range."];
  const dominantLabel = approachLabel(dominantName, dominantCode);

  const nextStepsUrl = getNextStepsUrl(data);

  const indexItems = [
    ...sections.map((section, index) => ({
      id: sectionDomId(section, index),
      title: safeText(section.title).trim() || fallbackSectionTitle(section, primary.name),
    })),
    { id: "lead-methodology", title: "Methodology" },
  ];

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setIndexOpen(false);
  }

  return (
    <div ref={reportRef} className="lead-report-shell pdf-report-shell report-shell min-h-screen overflow-x-hidden bg-[#07182f] text-white [background-image:radial-gradient(circle_at_12%_2%,rgba(64,104,154,.32),transparent_30%),radial-gradient(circle_at_92%_18%,rgba(215,169,40,.16),transparent_24%)]">
      <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="lead-cover-block report-section rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(27,60,99,.78),rgba(12,32,58,.84))] px-4 py-3 shadow-[0_14px_42px_rgba(0,0,0,.32)] sm:px-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 shrink-0 rounded-[9px] border border-white/10 bg-white/[0.06]" aria-hidden="true" />
                <span className="text-xs font-semibold text-white">MindCanvas LEAD System</span>
              </div>
              <h1 className="mt-1.5 text-xl font-semibold uppercase leading-none tracking-[0.14em] text-white sm:text-2xl">
                Personalised Report
              </h1>
              <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white/60">
                Powered by Profiletest.ai
              </span>
            </div>

            <div className="min-w-0">
              <div className="no-print flex flex-wrap justify-start gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-white/10 bg-[#08162b]/70 px-3 py-2 text-[11px] font-semibold text-slate-50 transition hover:bg-[#08162b] focus:outline-none focus:ring-2 focus:ring-[#45e0d1]"
                >
                  Download PDF
                </button>
                {nextStepsUrl ? (
                  <a
                    href={nextStepsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-[linear-gradient(90deg,#45e0d1_0%,#4f7dff_50%,#8b5cf6_100%)] px-3 py-2 text-[11px] font-semibold text-[#071c36] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    Next steps
                  </a>
                ) : null}
              </div>

              <dl className="mt-2 grid gap-2 sm:grid-cols-[minmax(96px,1fr)_minmax(96px,1fr)_minmax(180px,1.65fr)]">
                <div className="rounded-[14px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(35,62,97,.72),rgba(18,38,64,.78))] px-3 py-2">
                  <dt className="text-[8px] text-white/55">Prepared for</dt>
                  <dd className="mt-1 truncate text-xs font-semibold text-white">{participant}</dd>
                </div>
                {reportDate ? (
                  <div className="rounded-[14px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(35,62,97,.72),rgba(18,38,64,.78))] px-3 py-2">
                    <dt className="text-[8px] text-white/55">Date</dt>
                    <dd className="mt-1 text-xs font-semibold text-white">{reportDate}</dd>
                  </div>
                ) : null}
                <div className="rounded-[14px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(35,62,97,.72),rgba(18,38,64,.78))] px-3 py-2">
                  <dt className="text-[8px] text-white/55">Framework</dt>
                  <dd className="mt-1 text-xs font-semibold text-white">MindCanvas LEAD System</dd>
                </div>
              </dl>
            </div>
          </div>
        </header>

        <section className="lead-cover-block report-section mt-3 grid gap-2.5 md:grid-cols-[minmax(0,2.65fr)_minmax(190px,.9fr)]">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(165deg,rgba(252,178,118,.16),rgba(22,85,157,.16)),linear-gradient(180deg,rgba(27,60,99,.78),rgba(12,32,58,.84))] p-3 shadow-[0_14px_42px_rgba(0,0,0,.32)]">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(230px,.86fr)]">
              <div className="flex min-w-0 flex-col p-1 sm:p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.26em] text-white/55">Personalised report for</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{participant}</h2>
                <p className="mt-3 max-w-xl text-xs leading-5 text-white/75">
                  How the four behavioural energies show up in you, and your pattern toward a more focused way of leading.
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[linear-gradient(90deg,#7c94d7,#e8b15e)] px-3 py-1.5 text-[10px] font-semibold text-[#192a44]">
                    Top Profile: {primary.name} {primary.code}
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white">
                    {dominantName} ({dominantCode})
                  </span>
                  {secondary ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white">
                      Secondary: {secondary.name}
                    </span>
                  ) : null}
                  {tertiary ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white">
                      Tertiary: {tertiary.name}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#061731]/45 sm:grid-cols-2">
                  <div className="p-4 sm:border-r sm:border-white/[0.07]">
                    <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/35">Driver</div>
                    <div className="mt-2 text-base font-semibold text-[#e8b75f]">{dominantName} ({dominantCode})</div>
                    <p className="mt-2 text-[10px] leading-4 text-white/45">{APPROACH_SHORT_COPY[dominantCode]}</p>
                  </div>
                  <div className="border-t border-white/[0.07] p-4 sm:border-t-0">
                    <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/35">Top profile</div>
                    <div className="mt-2 text-base font-semibold text-[#e8b75f]">{primary.name}</div>
                    <p className="mt-2 text-[10px] leading-4 text-white/45">A distinct operating pattern that describes how you most naturally create value.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(27,60,99,.78),rgba(12,32,58,.84))] p-2.5 shadow-[0_14px_42px_rgba(0,0,0,.24)]">
                <div className="space-y-1.5">
                  {canonicalProfiles.map((profile) => {
                    const selected = shortProfileCode(profile.code) === shortProfileCode(primary.code);
                    const imageSrc = profileImage(profile.code);
                    return (
                      <div
                        key={profile.code}
                        className={`grid min-h-8 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5 ${
                          selected
                            ? "border-[#e8b15e]/45 bg-[linear-gradient(90deg,#7c94d7,#e8b15e)] text-[#051227]"
                            : "border-white/[0.05] bg-white/[0.03] text-[#e4eaf8]"
                        }`}
                      >
                        <img
                          src={imageSrc}
                          alt=""
                          className="h-[18px] w-[18px] object-contain"
                          onError={(event) => { event.currentTarget.style.display = "none"; }}
                        />
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[10px] font-medium">{profile.name} ({profile.code})</span>
                          {selected ? <span className="rounded-full bg-white/85 px-1.5 py-0.5 text-[7px] font-bold text-[#0e1726]">You</span> : null}
                        </div>
                        <div className="flex items-center gap-2 text-[8px]">
                          {selected ? <span className="hidden sm:inline">{dominantName} ({dominantCode})</span> : null}
                          <span className={selected ? "font-bold" : "text-white/35"}>{pct(profile.pct)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(27,60,99,.78),rgba(12,32,58,.84))] p-3 shadow-[0_14px_42px_rgba(0,0,0,.32)]">
            <div className="rounded-[18px] bg-[linear-gradient(135deg,#7c94d7,#e8b75f)] p-[2px] shadow-[0_6px_32px_rgba(58,110,212,.12)]">
              <div className="rounded-[16px] bg-[#0a1e36] px-4 py-4 text-center">
                <div className="text-[8px] text-white/70">Your Dominant Driver:</div>
                <div className="mt-2 text-lg font-semibold text-[#e8b75f]">{dominantName} ({dominantCode})</div>
                <p className="mx-auto mt-2 max-w-[180px] text-[10px] leading-4 text-white/80">{APPROACH_SHORT_COPY[dominantCode]}</p>
              </div>
            </div>

            <div className="mt-3 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/35">Profile mix</div>
            <div className="mt-2 space-y-2">
              {[primary, secondary, tertiary].filter(Boolean).map((profile, index) => {
                if (!profile) return null;
                const role = index === 0 ? "Primary" : index === 1 ? "Secondary" : "Tertiary";
                return (
                  <div key={profile.code} className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-medium text-white">{profile.name}</span>
                      <span className="text-[9px] font-medium text-white/80">{pct(profile.pct)}</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                      <span className="text-[7px] text-white/35">{role} · {profile.code}</span>
                      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#7c94d7,#e8b15e)]"
                          style={{ width: `${Math.max(profile.pct * 100, profile.pct > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <section className="report-section mt-3 rounded-[24px] border border-white/10 bg-[linear-gradient(165deg,rgba(252,178,118,.16),rgba(22,85,157,.16)),linear-gradient(180deg,rgba(27,60,99,.78),rgba(12,32,58,.84))] px-5 py-4 shadow-[0_14px_42px_rgba(0,0,0,.32)] sm:px-6 sm:py-5 lg:px-8">
          <div>
            <p className="text-[9px] font-bold uppercase leading-4 tracking-[0.26em] text-white/55">One-page LEAD profile</p>
            <h2 className="mt-1 text-sm font-semibold leading-7 text-white/95">Your at-a-glance leadership profile</h2>
          </div>

          <div className="mt-4 grid gap-2.5 lg:grid-cols-3">
            <article className="summary-card min-h-[304px] rounded-[17px] border-2 border-[#7c94d7] bg-[#061a3a] px-5 py-6 shadow-[0_6px_32px_rgba(58,110,212,.12)] sm:px-7">
              <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.2em] text-white">Your LEAD profile</p>
              <h3 className="mt-7 text-[33px] font-semibold leading-none text-[#e8b75f]">{primary.name}</h3>

              <dl className="mt-8 space-y-2.5">
                <div className="grid min-h-[39px] grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-white/[0.07] bg-white/[0.05] px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e8b75f]" aria-hidden="true" />
                  <dt className="text-[13px] font-medium text-[#c7ccde]">Top frequency</dt>
                  <dd className="text-right text-[13px] font-bold text-[#e8b75f]">{dominantLabel}</dd>
                </div>
                <div className="grid min-h-[39px] grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-white/[0.07] bg-white/[0.05] px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8195d1]" aria-hidden="true" />
                  <dt className="text-[13px] font-medium text-[#c7ccde]">Profile match</dt>
                  <dd className="text-right text-[13px] font-bold text-[#8195d1]">{pct(primary.pct)}</dd>
                </div>
              </dl>
            </article>

            <article className="summary-card min-h-[304px] rounded-[17px] border-2 border-[#7c94d7] bg-[#061a3a] px-5 py-5 shadow-[0_6px_32px_rgba(58,110,212,.12)] sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#e8b75f] bg-[#e8b75f]/25">
                  <img src="/mps/report-icons/strengths.png" alt="" className="h-4 w-4 object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                </span>
                <h3 className="text-[10px] font-semibold uppercase leading-4 tracking-[0.2em] text-white">Your strengths</h3>
              </div>
              <p className="mt-3 text-[11px] leading-[1.45] text-[#7f8ca6]">{strengthSummary}</p>

              <h3 className="mt-5 text-[10px] font-semibold uppercase leading-4 tracking-[0.2em] text-white">Your risks</h3>
              <p className="mt-3 text-[11px] leading-[1.45] text-[#7f8ca6]">{riskSummary}</p>
              <p className="mt-4 text-[11px] italic leading-[1.45] text-[#7f8ca6]">
                {PROFILE_GUIDANCE[primary.code] || "Lead with your strengths, notice overuse early, and widen your range intentionally."}
              </p>
            </article>

            <article className="summary-card min-h-[304px] rounded-[17px] border-2 border-[#7c94d7] bg-[#061a3a] px-5 py-5 shadow-[0_6px_32px_rgba(58,110,212,.12)] sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#e8b75f] bg-[#e8b75f]/20">
                  <img src="/mps/header/top-strategic-priorities.png" alt="" className="h-4 w-4 object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                </span>
                <h3 className="text-[10px] font-medium uppercase leading-4 tracking-[0.2em] text-white">Top development priorities</h3>
              </div>

              <ul className="mt-5 space-y-4">
                {developmentPriorities.slice(0, 3).map((priority, index) => (
                  <li key={index} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3 text-[11px] leading-[1.45] text-[#7f8ca6]">
                    <span className="mt-px flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#e8b75f]" aria-hidden="true">
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-white" strokeWidth="1.8">
                        <path d="M2.2 6.1 4.7 8.4 9.8 3.4" />
                      </svg>
                    </span>
                    <span>{priority}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="report-section mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[30px] bg-white p-5 text-[#0b2545] sm:p-7"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a77d0f]">Frequency summary</p><h2 className="mt-2 text-2xl font-bold">The four LEAD approaches</h2><p className="mt-2 text-sm leading-6 text-slate-600">All four approaches are available to you. The shape of your scores shows which energies you access most naturally.</p><div className="mt-5"><FrequencyChart labels={data.frequency_labels} values={data.frequency_percentages} dominant={dominantCode} /></div></div>
          <div className="rounded-[30px] bg-white p-5 text-[#0b2545] sm:p-7"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a77d0f]">Personality map</p><h2 className="mt-2 text-2xl font-bold">Your eight-profile pattern</h2><p className="mt-2 text-sm leading-6 text-slate-600">Higher points show patterns you access more naturally. Lower points identify areas that may benefit from support, structure or intentional practice.</p><div className="mt-5"><ProfileRadar ranked={ranked} values={data.profile_percentages} /></div></div>
        </section>

        <section className="report-section mt-6 rounded-[30px] bg-white p-5 text-[#0b2545] sm:p-7 lg:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a77d0f]">Framework overview</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Four approaches. Eight operating styles.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(["A", "B", "C", "D"] as AB[]).map((code) => {
              const label = data.frequency_labels.find((item) => item.code === code)?.name || APPROACH_FALLBACKS[code];
              return <div key={code} className="report-card rounded-[22px] border p-5" style={{ borderColor: APPROACH_COLOURS[code].ring, backgroundColor: APPROACH_COLOURS[code].soft }}><img src={approachImage(code)} alt="" className="h-12 w-12 rounded-xl object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div className="mt-4 flex items-center justify-between gap-3"><h3 className="font-bold">{label}</h3><span className="text-sm font-bold" style={{ color: APPROACH_COLOURS[code].solid }}>{pct(data.frequency_percentages?.[code])}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{APPROACH_COPY[code]}</p></div>;
            })}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => `P${index + 1}`).map((code) => {
              const profile = ranked.find((item) => shortProfileCode(item.code) === code);
              const selected = code === shortProfileCode(primary.code);
              return <div key={code} className={`report-card rounded-2xl border p-4 ${selected ? "border-[#d7a928] bg-[#fff9e9]" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center gap-3"><img src={profileImage(code)} alt="" className="h-11 w-11 rounded-xl object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div className="min-w-0"><div className="text-xs font-bold text-[#a77d0f]">{code} · {pct(profile?.pct ?? 0)}</div><h3 className="truncate font-bold">{profile?.name || PROFILE_FALLBACKS[code]}</h3></div></div><p className="mt-3 text-xs leading-5 text-slate-600">{PROFILE_COPY[code]}</p>{selected ? <span className="mt-3 inline-flex rounded-full bg-[#0b2545] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Your top profile</span> : null}</div>;
            })}
          </div>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="no-print self-start lg:sticky lg:top-5">
            <button type="button" onClick={() => setIndexOpen((open) => !open)} aria-expanded={indexOpen} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-bold lg:hidden"><span>Report index</span><span aria-hidden="true">{indexOpen ? "−" : "+"}</span></button>
            <nav aria-label="Report index" className={`${indexOpen ? "block" : "hidden"} mt-3 rounded-[24px] border border-white/10 bg-white/5 p-4 lg:mt-0 lg:block`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e8c65e]">Report index</p>
              <p className="mt-2 text-xs leading-5 text-white/55">Jump straight to what you need.</p>
              <div className="mt-4 max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                {indexItems.map((item, index) => <button key={item.id} type="button" onClick={() => scrollTo(item.id)} className="group flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left text-xs leading-5 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d7a928]"><span className="mt-0.5 text-[10px] font-bold text-[#e8c65e]">{String(index + 1).padStart(2, "0")}</span><span>{item.title}</span></button>)}
              </div>
            </nav>
          </aside>

          <main className="space-y-5">
            {sections.length ? sections.map((section, index) => <SectionCard key={`${sectionDomId(section, index)}-${index}`} section={section} index={index} data={data} ranked={ranked} nextStepsUrl={nextStepsUrl} />) : <section className="rounded-[28px] bg-white p-7 text-slate-700"><h2 className="text-xl font-bold text-[#0b2545]">Report content is unavailable</h2><p className="mt-3 text-sm leading-6">The result loaded correctly, but the LEAD narrative content could not be loaded. Please refresh the page or contact support.</p></section>}

            <section id="lead-methodology" className="report-section rounded-[28px] border border-white/10 bg-white/5 p-2 sm:p-3">
              <div className="rounded-[22px] bg-[#fff9e9] px-5 py-6 text-[#0b2545] sm:px-8 sm:py-8"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7410]">Methodology</p><h2 className="mt-2 text-xl font-bold sm:text-2xl">Use this report as insight, not a verdict</h2><p className="mt-4 text-sm leading-7 text-slate-700">Your results reflect patterns in how you responded at the time of the assessment. They describe preferences and tendencies, not fixed personality traits. This report should be used as one source of insight and not as a standalone hiring, promotion or development decision.</p></div>
            </section>

            {nextStepsUrl ? <div className="no-print flex justify-end"><a href={nextStepsUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#d7a928] px-6 py-3 text-sm font-bold text-[#0b2545] hover:bg-[#e4bd4d] focus:outline-none focus:ring-2 focus:ring-white">Next Step</a></div> : null}
          </main>
        </div>

        <footer className="mt-8 border-t border-white/10 py-5 text-center text-xs text-white/45">© {new Date().getFullYear()} MindCanvas LEAD System · Powered by Profiletest.ai</footer>
      </div>
    </div>
  );
}