// apps/web/app/t/[token]/report/OperatingFrameReportClient.tsx
"use client";

import AppBackground from "@/components/ui/AppBackground";
import { useMemo, useRef } from "react";

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
    [k: string]: any;
  } | null;

  [k: string]: any;
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

  profile_labels: Array<{ code: string; name: string }>;
  profile_percentages: Record<string, number>;

  top_freq: AB;
  top_profile_code: string; // PROFILE_1..PROFILE_8
  top_profile_name: string;
};

type ReportBlock =
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
      border?: boolean;
      no_border?: boolean;
    }
  | { type: string; [k: string]: any };

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

function fullName(first?: string | null, last?: string | null) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  const out = `${f} ${l}`.trim();
  return out || "Participant";
}

function profileKeyVariants(code: string) {
  const c = String(code || "").toUpperCase().trim(); // PROFILE_1
  const asP = c.startsWith("PROFILE_") ? c.replace("PROFILE_", "P") : c; // P1
  const asPROFILE = c.startsWith("P") ? c.replace(/^P/, "PROFILE_") : c; // PROFILE_1
  return Array.from(new Set([c, asP, asPROFILE]));
}

function profileNameToImageFile(profileName: string) {
  const n = String(profileName || "").toLowerCase();
  if (n.includes("activator")) return "activator.png";
  if (n.includes("messenger")) return "messenger.png";
  if (n.includes("integrator")) return "integrator.png";
  if (n.includes("relator")) return "relator.png";
  if (n.includes("operator")) return "operator.png";
  if (n.includes("planner")) return "planner.png";
  if (n.includes("evaluator")) return "evaluator.png";
  if (n.includes("vision")) return "vision-engineer.png";
  return "";
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-4 md:p-6 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

/** ✅ Vertical bar chart */
function VerticalDriversChart(props: { labels: Array<{ code: AB; name: string }>; pct: Record<AB, number> }) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));
  const barColor = (code: AB) =>
    code === "A" ? "bg-red-500" : code === "B" ? "bg-amber-500" : code === "C" ? "bg-emerald-500" : "bg-blue-500";
  const ticks = [100, 80, 60, 40, 20, 0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-end gap-3 md:gap-4">
        {/* ticks: hidden on very small screens */}
        <div className="hidden sm:block w-8 md:w-10 shrink-0">
          {ticks.map((t) => (
            <div key={t} className="relative h-7">
              <div className="absolute right-0 top-[-2px] text-[10px] font-semibold text-slate-400">{t}</div>
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="relative h-[260px] sm:h-[300px] md:h-[308px] rounded-xl border border-slate-200 bg-slate-50">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 border-t border-slate-200/60"
                style={{ top: `${(1 - t / 100) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end justify-around px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
              {items.map((it) => {
                const h = Math.round(it.v * 100);
                return (
                  <div key={it.code} className="flex w-14 sm:w-16 flex-col items-center gap-2">
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-600">
                      {Math.round(it.v * 100)}%
                    </div>
                    <div className="relative h-[200px] sm:h-[230px] md:h-[240px] w-9 sm:w-10 rounded-lg bg-white border border-slate-200 overflow-hidden">
                      <div className={`absolute bottom-0 left-0 right-0 ${barColor(it.code)}`} style={{ height: `${h}%` }} />
                    </div>
                    <div className="text-xs font-bold text-slate-900">{it.code}</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-600 text-center leading-tight">{it.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* mobile helper: ticks summary */}
          <div className="mt-2 sm:hidden text-[11px] text-slate-500">
            Scale: 0–100 (top labels show %)
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ✅ Profiles-only radar: zoom to 50% + mobile-optimized sizing
 * - Smaller canvas on mobile (so it doesn’t overflow)
 * - Still large on desktop
 */
function ProfileOnlyRadar(props: { profilePct: Record<string, number> }) {
  const labels = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"] as const;

  const rawVal = (p: string) => {
    const asPROFILE = p.replace(/^P/, "PROFILE_");
    return clamp01(props.profilePct[p] ?? props.profilePct[asPROFILE] ?? 0);
  };

  const MAX = 0.5;
  const val = (p: string) => clamp01(rawVal(p) / MAX);

  // ViewBox stays constant; actual render size is responsive via CSS.
  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const r = 205;

  function pt(i: number, v: number) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * v, y: cy + Math.sin(angle) * r * v };
  }

  const rings = [0.1, 0.2, 0.3, 0.4, 0.5];
  const pts = labels.map((k, i) => pt(i, val(k)));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
  const ringLabelY = (rv: number) => cy - r * (rv / MAX);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">Your Personality Map (Profiles)</div>
        <div className="hidden sm:block text-xs text-slate-500">Higher = stronger pattern</div>
      </div>

      <div className="mt-3 flex justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-auto max-w-[420px] sm:max-w-[520px]"
          aria-label="Profile radar chart"
        >
          {rings.map((rv) => (
            <polygon
              key={rv}
              points={labels.map((_, i) => pt(i, clamp01(rv / MAX))).map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(15,23,42,0.12)"
            />
          ))}

          {rings.map((rv) => (
            <text
              key={`lbl-${rv}`}
              x={cx}
              y={ringLabelY(rv)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="rgba(15,23,42,0.42)"
            >
              {Math.round(rv * 100)}%
            </text>
          ))}

          {labels.map((k, i) => {
            const p = pt(i, 1);
            return <line key={k} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(15,23,42,0.12)" />;
          })}

          {labels.map((k, i) => {
            const p = pt(i, 1.12);
            return (
              <text
                key={k}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="13"
                fontWeight={600}
                fill="rgba(15,23,42,0.65)"
              >
                {k}
              </text>
            );
          })}

          <path d={path} fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.92)" strokeWidth="2.75" />
          <circle cx={cx} cy={cy} r="2.75" fill="rgba(15,23,42,0.5)" />

          {labels.map((k, i) => {
            const vScaled = val(k);
            const vRaw = rawVal(k);
            const p = pt(i, vScaled);

            const show = vRaw > 0.001;
            const labelPt = pt(i, Math.min(1, vScaled + 0.16));

            return (
              <g key={`pt-${k}`}>
                <circle cx={p.x} cy={p.y} r="4" fill="rgba(20,184,166,0.95)" />
                {show ? (
                  <text
                    x={labelPt.x}
                    y={labelPt.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fill="rgba(15,23,42,0.55)"
                  >
                    {Math.round(vRaw * 100)}%
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 sm:hidden text-xs text-slate-500 text-center">Higher = stronger pattern</div>
    </div>
  );
}

/**
 * Normalize blocks so doc-style "item lines" don't render as bold headings.
 */
function normaliseDocBlocks(blocks: ReportBlock[]): ReportBlock[] {
  const inBlocks = Array.isArray(blocks) ? blocks : [];
  const out: ReportBlock[] = [];

  const isH = (b: any, lvl: "h3" | "h4") => String(b?.type || "").toLowerCase() === lvl;
  const getText = (b: any) => safeText(b?.text).trim();

  let i = 0;
  while (i < inBlocks.length) {
    const b = inBlocks[i];
    const t = String((b as any)?.type || "").toLowerCase();

    if (t === "h4") {
      const items: string[] = [];
      while (i < inBlocks.length && isH(inBlocks[i], "h4")) {
        const txt = getText(inBlocks[i]);
        if (txt) items.push(txt);
        i++;
      }
      if (items.length) out.push({ type: "ul", items });
      continue;
    }

    if (t === "h3" && i + 1 < inBlocks.length && (isH(inBlocks[i + 1], "h3") || isH(inBlocks[i + 1], "h4"))) {
      out.push(b);
      const items: string[] = [];
      i++;

      while (i < inBlocks.length) {
        const tt = String((inBlocks[i] as any)?.type || "").toLowerCase();
        if (tt !== "h3" && tt !== "h4") break;

        const txt = getText(inBlocks[i]);
        if (txt) items.push(txt);
        i++;
      }

      if (items.length) out.push({ type: "ul", items });
      continue;
    }

    out.push(b);
    i++;
  }

  return out;
}

function resolveBlockImageSrc(rawSrc: string, topProfileName: string) {
  const raw = String(rawSrc || "").trim();
  if (!raw) return "";

  if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  if (raw === "{{TOP_PROFILE_IMAGE}}") {
    const file = profileNameToImageFile(topProfileName);
    return file ? `/images/operatingframe-full-test/profile-cards/${file}` : "/images/operatingframe-full-test/profile-cards/bio-image.png";
  }

  return raw;
}

function BlockRenderer(props: { block: any; topProfileName: string }) {
  const b = props.block;
  const type = String(b?.type || "").toLowerCase();

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText(b.text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText(b.text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText(b.text)}</h3>;
  if (type === "h4") return <div className="text-sm font-normal text-slate-700">{safeText(b.text)}</div>;

  if (type === "p") return <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{safeText(b.text)}</p>;

  if (type === "ul") {
    const items = Array.isArray(b.items) ? b.items : [];
    return (
      <ul className="list-disc pl-5 text-sm font-normal text-slate-700 space-y-1">
        {items.map((it: any, i: number) => (
          <li key={i} className="font-normal text-slate-700">
            {safeText(it)}
          </li>
        ))}
      </ul>
    );
  }

  if (type === "ol") {
    const items = Array.isArray(b.items) ? b.items : [];
    return (
      <ol className="list-decimal pl-5 text-sm font-normal text-slate-700 space-y-1">
        {items.map((it: any, i: number) => (
          <li key={i} className="font-normal text-slate-700">
            {safeText(it)}
          </li>
        ))}
      </ol>
    );
  }

  if (type === "quote") {
    const t = safeText(b.text).trim();
    const cite = safeText(b.cite).trim();
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm italic text-slate-700">“{t}”</p>
        {cite ? <p className="mt-2 text-xs text-slate-500">— {cite}</p> : null}
      </div>
    );
  }

  if (type === "image") {
    const src = resolveBlockImageSrc(String(b?.src || ""), props.topProfileName);
    if (!src) return null;

    const align = String(b?.align || "center").toLowerCase();
    const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
    const maxH = typeof b?.max_h === "number" ? b.max_h : 360;

    const wantsBorder =
      b?.border === false || b?.no_border === true || String(src).toLowerCase().includes("nick-pye") ? false : true;

    const rounded = b?.rounded === false ? "rounded-none" : "rounded-2xl";
    const chrome = wantsBorder ? "border border-slate-200 bg-white shadow-sm" : "border-0 bg-transparent shadow-none";

    return (
      <figure className="my-4">
        <div className={`flex ${justify}`}>
          <img
            src={src}
            alt={safeText(b?.alt)}
            className={`max-w-full ${rounded} ${chrome}`}
            style={{ maxHeight: maxH }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {b?.caption ? <figcaption className="mt-2 text-xs text-slate-500">{safeText(b.caption)}</figcaption> : null}
      </figure>
    );
  }

  if (type === "divider") return <hr className="my-6 border-slate-200" />;
  if (type === "spacer") return <div className={b.size === "lg" ? "h-10" : b.size === "sm" ? "h-3" : "h-6"} />;

  return null;
}

export default function OperatingFrameReportClient(props: {
  token: string;
  tid: string;
  src: string;
  data: ResultData;
  framework: any;
}) {
  const { data, framework } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);
  const orgName = data.org_name || "Organisation";
  const testName = data.test_name || "OperatingFrame™";

  const keys = profileKeyVariants(data.top_profile_code);
  const profile = keys.map((k) => framework?.profiles?.[k]).find(Boolean) || null;

  const topProfileName = profile?.name || data.top_profile_name || "Top Profile";
  const topFreqCode = data.top_freq;
  const topFreqName = data.frequency_labels.find((f) => f.code === topFreqCode)?.name || topFreqCode;

  const orgLogoSrc = "/images/operatingframe-full-test/org-logo.png";

  const profileFile = profileNameToImageFile(topProfileName);
  const profileHeroSrc = profileFile
    ? `/images/operatingframe-full-test/profile-cards/${profileFile}`
    : "/images/operatingframe-full-test/profile-cards/bio-image.png";

  function openNextSteps() {
    const direct =
      (data?.link as any)?.redirect_url ||
      (data?.link as any)?.next_steps_url ||
      (data?.link as any)?.meta?.redirect_url ||
      (data?.link as any)?.meta?.next_steps_url ||
      "";

    const url = String(direct || "").trim();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadPdfViaPrint() {
    window.print();
  }

  const sections = useMemo(() => {
    const common = framework?.common || {};
    const p = profile?.sections || {};
    return [
      { title: common?.welcome?.title || "Welcome", blocks: normaliseDocBlocks(common?.welcome?.blocks || []) },
      { title: "Section 1 – Executive Summary", blocks: normaliseDocBlocks(p?.section_1?.blocks || []) },
      { title: "Section 2 – The Four Drivers: Your Operating Pattern", blocks: normaliseDocBlocks(p?.section_2?.blocks || []) },
      { title: "Section 3 – Your Operating Style", blocks: normaliseDocBlocks(p?.section_3?.blocks || []) },
      { title: "Section 4 – Micro Pattern Expression", blocks: normaliseDocBlocks(p?.section_4?.blocks || []) },
      { title: "Section 5 – Your Team Contribution", blocks: normaliseDocBlocks(p?.section_5?.blocks || []) },
      { title: "Section 6 – Stress Operating Summary", blocks: normaliseDocBlocks(p?.section_6?.blocks || []) },
      { title: "Section 7 – Decision Pattern", blocks: normaliseDocBlocks(p?.section_7?.blocks || []) },
      { title: "Section 8 – Development Roadmap", blocks: normaliseDocBlocks(p?.section_8?.blocks || []) },
    ];
  }, [framework, profile]);

  const driversIntro =
    safeText(framework?.common?.drivers_intro?.blocks?.[0]?.text) ||
    "OperatingFrame helps you understand four core drivers behind your leadership: Direction, Connection, Structure, and Precision.";

  const mapIntro =
    safeText(framework?.common?.profile_map_intro?.blocks?.[0]?.text) ||
    "This map shows your overall pattern across Profiles. It helps you see what you naturally lean on (strength), and what may require support or structure (risk).";

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      {/* ✅ tighter padding on mobile */}
      <div className="relative z-10 mx-auto max-w-6xl px-3 sm:px-4 py-6 md:px-6 md:py-8">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          </div>

          {/* ✅ mobile-first header layout */}
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 md:h-12 md:w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={orgLogoSrc}
                    alt={orgName}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Organisation</div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">{orgName}</div>

                  <div className="mt-3 text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Test Name</div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">{testName}</div>
                </div>
              </div>

              <h1 className="mt-4 text-[22px] sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                Personalised Report for <span className="text-white/90">{participant}</span>
              </h1>

              <div className="mt-3 grid gap-2">
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">Top Profile:</span> {topProfileName}
                </div>
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">Driver:</span> {topFreqName} ({topFreqCode})
                </div>
              </div>

              {/* ✅ buttons stack on mobile */}
              <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
                <button
                  onClick={downloadPdfViaPrint}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Download PDF
                </button>

                <button
                  onClick={openNextSteps}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Next Steps
                </button>
              </div>
            </div>

            {/* ✅ hero image smaller on mobile, stays big on desktop */}
            <div className="shrink-0 flex items-center justify-start md:justify-end gap-3">
              <div className="h-[110px] w-[110px] sm:h-[130px] sm:w-[130px] md:h-[160px] md:w-[160px] rounded-[26px] bg-white/10 border border-white/15 overflow-hidden shadow-sm">
                <img
                  src={profileHeroSrc}
                  alt={topProfileName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <MiniDivider />
          </div>

          {/* ✅ stack cards on mobile, 2-col on md+ */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <WhiteCard>
              <div className="text-sm font-semibold text-slate-900">Drivers</div>
              <div className="mt-2 text-sm text-slate-700">{driversIntro}</div>
              <div className="mt-4">
                <VerticalDriversChart labels={data.frequency_labels} pct={data.frequency_percentages} />
              </div>
            </WhiteCard>

            <WhiteCard>
              <div className="text-sm font-semibold text-slate-900">Profile Map</div>
              <div className="mt-2 text-sm text-slate-700">{mapIntro}</div>
              <div className="mt-4">
                <ProfileOnlyRadar profilePct={data.profile_percentages} />
              </div>
            </WhiteCard>
          </div>
        </GlassCard>

        <div className="mt-6 space-y-4">
          {sections.map((s, idx) => (
            <section key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <WhiteCard>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{s.title}</h2>
                <div className="mt-4 space-y-3">
                  {(s.blocks || []).map((b: any, i: number) => (
                    <BlockRenderer key={i} block={b} topProfileName={topProfileName} />
                  ))}
                </div>
              </WhiteCard>
            </section>
          ))}

          {/* ✅ bottom CTA button full width on mobile */}
          <div className="pt-2">
            <button
              onClick={openNextSteps}
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Next Steps
            </button>
          </div>

          <footer className="pt-4 text-xs text-slate-400">© {new Date().getFullYear()} Powered by Profiletest.ai</footer>
        </div>
      </div>
    </div>
  );
}