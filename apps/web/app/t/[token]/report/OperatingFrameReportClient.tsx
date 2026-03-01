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
  top_profile_code: string; // P1..P8
  top_profile_name: string;
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

function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "-");
}

function resolveImageSrc(
  src: string,
  ctx: { primaryName: string },
) {
  const raw = String(src || "").trim();
  if (!raw) return "";

  if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const map: Record<string, string> = {
    "{{ORG_LOGO}}": "/images/operatingframe-full-test/org-logo.png",
    "{{PROFILE_GRID}}": "/images/operatingframe-full-test/profile-grid.png",
    "{{FREQUENCY_GRID}}": "/images/operatingframe-full-test/frequency-grid.png",
  };

  if (map[raw]) return map[raw];

  if (raw === "{{PROFILE_IMAGE_PRIMARY}}") {
    const nm = slugify(ctx.primaryName);
    return nm ? `/images/operatingframe-full-test/profile-cards/${nm}.png` : "";
  }

  return raw;
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-6 ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function WhiteCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-6 text-slate-900 shadow-sm ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function MiniDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
}

/** ✅ Vertical bar chart (A red / B yellow / C green / D blue) */
function VerticalDriversChart(props: {
  labels: Array<{ code: AB; name: string }>;
  pct: Record<AB, number>;
}) {
  const items = props.labels.map((f) => ({ ...f, v: clamp01(props.pct?.[f.code] ?? 0) }));

  const barColor = (code: AB) =>
    code === "A"
      ? "bg-red-500"
      : code === "B"
        ? "bg-amber-500"
        : code === "C"
          ? "bg-emerald-500"
          : "bg-blue-500";

  const ticks = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-end gap-4">
        <div className="w-10 shrink-0">
          {ticks.map((t) => (
            <div key={t} className="relative h-7">
              <div className="absolute right-0 top-[-2px] text-[10px] font-semibold text-slate-400">{t}</div>
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="relative h-[308px] rounded-xl border border-slate-200 bg-slate-50">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 border-t border-slate-200/60"
                style={{ top: `${(1 - t / 100) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end justify-around px-6 pb-4">
              {items.map((it) => {
                const h = Math.round(it.v * 100);
                return (
                  <div key={it.code} className="flex w-16 flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-slate-600">{Math.round(it.v * 100)}</div>
                    <div className="relative h-[240px] w-10 rounded-lg bg-white border border-slate-200 overflow-hidden">
                      <div className={`absolute bottom-0 left-0 right-0 ${barColor(it.code)}`} style={{ height: `${h}%` }} />
                    </div>
                    <div className="text-xs font-bold text-slate-900">{it.code}</div>
                    <div className="text-[11px] text-slate-600 text-center leading-tight">{it.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ✅ Radar chart: 12 axes
 * A,B,C,D + P1..P8 (matches your screenshot style)
 */
function ProfileMapRadar(props: {
  frequencyPct: Record<AB, number>;
  profilePct: Record<string, number>;
}) {
  const labels = ["A", "P1", "P2", "B", "P3", "P4", "C", "P5", "P6", "D", "P7", "P8"] as const;

  const freqVal = (k: string) => {
    if (k === "A" || k === "B" || k === "C" || k === "D") return clamp01(props.frequencyPct[k as AB] ?? 0);
    return 0;
  };
  const profVal = (k: string) => {
    if (k.startsWith("P")) return clamp01(props.profilePct[k] ?? 0);
    return 0;
  };

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = 140;

  function pt(i: number, v: number) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * v, y: cy + Math.sin(angle) * r * v };
  }

  const rings = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

  const freqPts = labels.map((k, i) => pt(i, freqVal(k)));
  const profPts = labels.map((k, i) => pt(i, profVal(k)));

  const path = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Your Personality Map (Frequencies + Profiles)</div>
        <div className="text-xs text-slate-500">Higher = stronger pattern</div>
      </div>

      <div className="mt-4 flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rings.map((rv) => (
            <polygon
              key={rv}
              points={labels.map((_, i) => pt(i, rv)).map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(15,23,42,0.12)"
            />
          ))}

          {labels.map((k, i) => {
            const p = pt(i, 1);
            return (
              <line
                key={k}
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke="rgba(15,23,42,0.12)"
              />
            );
          })}

          {labels.map((k, i) => {
            const p = pt(i, 1.08);
            const isFreq = k === "A" || k === "B" || k === "C" || k === "D";
            return (
              <text
                key={k}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight={isFreq ? 700 : 500}
                fill={isFreq ? "rgba(15,23,42,0.85)" : "rgba(15,23,42,0.55)"}
              >
                {k}
              </text>
            );
          })}

          <path d={path(freqPts)} fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.9)" strokeWidth="2" />
          <path d={path(profPts)} fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.9)" strokeWidth="2" />

          <circle cx={cx} cy={cy} r="2" fill="rgba(15,23,42,0.5)" />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgba(37,99,235,0.9)" }} />
          Frequencies
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgba(20,184,166,0.9)" }} />
          Profiles
        </div>
      </div>
    </div>
  );
}

function BlockRenderer(props: { block: any }) {
  const b = props.block;
  const type = String(b?.type || "").toLowerCase();

  if (type === "h1") return <h1 className="text-2xl font-bold tracking-tight text-slate-900">{safeText(b.text)}</h1>;
  if (type === "h2") return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{safeText(b.text)}</h2>;
  if (type === "h3") return <h3 className="text-lg font-semibold text-slate-900">{safeText(b.text)}</h3>;
  if (type === "h4") return <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{safeText(b.text)}</h4>;

  if (type === "p") return <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{safeText(b.text)}</p>;

  if (type === "ul") {
    const items = Array.isArray(b.items) ? b.items : [];
    return (
      <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
        {items.map((it: any, i: number) => (
          <li key={i}>{safeText(it)}</li>
        ))}
      </ul>
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
  framework: any; // ✅ loaded from Supabase bucket
}) {
  const { data, framework } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);

  const participant = fullName(data.taker?.first_name, data.taker?.last_name);
  const orgName = data.org_name || "Organisation";
  const testName = data.test_name || "OperatingFrame";

  const profileCode = String(data.top_profile_code || "").toUpperCase(); // P1..P8
  const profile = framework?.profiles?.[profileCode];

  const topProfileName = profile?.name || data.top_profile_name || "Top Profile";
  const topFreqCode = data.top_freq;
  const topFreqName = data.frequency_labels.find((f) => f.code === topFreqCode)?.name || topFreqCode;

  const orgLogoSrc = resolveImageSrc("{{ORG_LOGO}}", { primaryName: topProfileName });
  const profileHeroSrc = resolveImageSrc("{{PROFILE_IMAGE_PRIMARY}}", { primaryName: topProfileName });

  function openNextSteps() {
    const url = (data?.link?.redirect_url || data?.link?.next_steps_url || "").trim();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadPdfViaPrint() {
    window.print();
  }

  const sections = useMemo(() => {
    const common = framework?.common || {};
    const p = profile?.sections || {};
    return [
      { title: common?.welcome?.title || "Welcome", blocks: common?.welcome?.blocks || [] },
      { title: "Section 1 – Executive Summary", blocks: p?.section_1?.blocks || [] },
      { title: "Section 2 – The Four Drivers: Your Operating Pattern", blocks: p?.section_2?.blocks || [] },
      { title: "Section 3 – Your Operating Style", blocks: p?.section_3?.blocks || [] },
      { title: "Section 4 – Micro Pattern Expression", blocks: p?.section_4?.blocks || [] },
      { title: "Section 5 – Your Team Contribution", blocks: p?.section_5?.blocks || [] },
      { title: "Section 6 – Stress Operating Summary", blocks: p?.section_6?.blocks || [] },
      { title: "Section 7 – Decision Pattern", blocks: p?.section_7?.blocks || [] },
      { title: "Section 8 – Development Roadmap", blocks: p?.section_8?.blocks || [] },
    ];
  }, [framework, profile]);

  const driversIntro =
    safeText(framework?.common?.drivers_intro?.blocks?.[0]?.text) ||
    "The four Drivers show the behavioural energy you use most often.";
  const mapIntro =
    safeText(framework?.common?.profile_map_intro?.blocks?.[0]?.text) ||
    "This map shows your overall pattern across Drivers and Profiles.";

  return (
    <div ref={reportRef} className="relative min-h-screen bg-[#050914] text-white overflow-hidden">
      <AppBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
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

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Organisation</div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">{orgName}</div>

                  <div className="mt-3 text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">Test Name</div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">{testName}</div>
                </div>
              </div>

              <h1 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight">
                Personalised Report for <span className="text-white/90">{participant}</span>
              </h1>

              <div className="mt-3 grid gap-2">
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">Top Profile:</span> {topProfileName}
                </div>
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">Driver:</span> {topFreqName}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
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
                  Next Steps
                </button>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="h-[92px] w-[92px] rounded-3xl bg-white/10 border border-white/15 overflow-hidden shadow-sm">
                {profileHeroSrc ? (
                  <img
                    src={profileHeroSrc}
                    alt={topProfileName}
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
              <div className="text-sm font-semibold text-slate-900">Drivers (Frequency)</div>
              <div className="mt-2 text-sm text-slate-700">{driversIntro}</div>
              <div className="mt-4">
                <VerticalDriversChart labels={data.frequency_labels} pct={data.frequency_percentages} />
              </div>
            </WhiteCard>

            <WhiteCard>
              <div className="text-sm font-semibold text-slate-900">Profile Map</div>
              <div className="mt-2 text-sm text-slate-700">{mapIntro}</div>
              <div className="mt-4">
                <ProfileMapRadar frequencyPct={data.frequency_percentages} profilePct={data.profile_percentages} />
              </div>
            </WhiteCard>
          </div>
        </GlassCard>

        <div className="mt-6 space-y-4">
          {sections.map((s, idx) => (
            <section key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <WhiteCard>
                <h2 className="text-xl font-semibold text-slate-900">{s.title}</h2>
                <div className="mt-4 space-y-3">
                  {(s.blocks || []).map((b: any, i: number) => (
                    <BlockRenderer key={i} block={b} />
                  ))}
                </div>
              </WhiteCard>
            </section>
          ))}

          <div className="pt-2">
            <button
              onClick={openNextSteps}
              className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
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