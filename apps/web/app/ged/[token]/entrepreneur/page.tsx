//apps/web/app/ged/[token]/entrepreneur/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QscMatrix } from "@/app/qsc/QscMatrix";
import AppBackground from "@/components/ui/AppBackground";
import type {
  GedDiagnostics,
  GedEngineDiagnostic,
  GedImpactLevel,
} from "@/lib/ged/scoreGedDiagnostic";

type PersonalityKey = "FIRE" | "FLOW" | "FORM" | "FIELD";
type MindsetKey = "ORIGIN" | "MOMENTUM" | "VECTOR" | "ORBIT" | "QUANTUM";

type PersonalityPercMap = Partial<Record<PersonalityKey, number>>;
type MindsetPercMap = Partial<Record<MindsetKey, number>>;

type QscResultsRow = {
  id: string;
  test_id: string;
  token: string;
  audience: "entrepreneur" | "leader" | null;
  personality_totals: Record<string, number> | null;
  personality_percentages: PersonalityPercMap | null;
  mindset_totals: Record<string, number> | null;
  mindset_percentages: MindsetPercMap | null;
  primary_personality: PersonalityKey | null;
  secondary_personality: PersonalityKey | null;
  primary_mindset: MindsetKey | null;
  secondary_mindset: MindsetKey | null;
  combined_profile_code: string | null;
  qsc_profile_id: string | null;
  created_at: string;
};

type QscProfileRow = {
  id: string;
  profile_label: string | null;
  how_to_communicate: string | null;
  decision_style: string | null;
  business_challenges: string | null;
  trust_signals: string | null;
  offer_fit: string | null;
  sale_blockers: string | null;
};

type QscPersonaRow = {
  profile_label: string | null;
  energisers: string | null;
  drains: string | null;
  combined_strengths: string | null;
  combined_risks: string | null;
  combined_big_lever: string | null;
  emotional_stabilises: string | null;
  emotional_destabilises: string | null;
  support_yourself: string | null;
  strategic_priority_1: string | null;
  strategic_priority_2: string | null;
  strategic_priority_3: string | null;
};

type QscTakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  role_title: string | null;
};

type LinkMeta = {
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  next_steps_url?: string | null;
  email_report?: boolean | null;
};

type GedPayload = {
  results: QscResultsRow;
  profile: QscProfileRow | null;
  persona: QscPersonaRow | null;
  taker: QscTakerRow | null;
  link: LinkMeta | null;
  ged: {
    submission_id: string | null;
    submission_created_at: string | null;
    diagnostics: GedDiagnostics;
    engine_diagnostic: GedEngineDiagnostic | null;
  } | null;
};

const PERSONALITY_LABELS: Record<PersonalityKey, string> = {
  FIRE: "Fire",
  FLOW: "Flow",
  FORM: "Form",
  FIELD: "Field",
};

const MINDSET_LABELS: Record<MindsetKey, string> = {
  ORIGIN: "Origin",
  MOMENTUM: "Momentum",
  VECTOR: "Vector",
  ORBIT: "Orbit",
  QUANTUM: "Quantum",
};

const FREQUENCY_COLORS: Record<PersonalityKey, string> = {
  FIRE: "#fb923c",
  FLOW: "#38bdf8",
  FORM: "#34d399",
  FIELD: "#a78bfa",
};

function normalisePercent(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  if (raw > 0 && raw <= 1.5) return Math.min(100, Math.max(0, raw * 100));
  return Math.min(100, Math.max(0, raw));
}

function getFullName(taker: QscTakerRow | null): string | null {
  if (!taker) return null;
  const name = `${taker.first_name || ""} ${taker.last_name || ""}`.trim();
  return name || taker.email?.trim() || null;
}

function derivePrimary<K extends string>(
  values: Partial<Record<K, number>>,
  keys: readonly K[]
): K | null {
  const winner = [...keys]
    .map((key) => ({ key, value: normalisePercent(values[key] ?? 0) }))
    .sort((a, b) => b.value - a.value)[0];

  return winner && winner.value > 0 ? winner.key : null;
}

function scoreTone(score: number): string {
  if (score >= 72) return "text-emerald-300";
  if (score >= 48) return "text-amber-300";
  return "text-rose-300";
}

function impactTone(level: GedImpactLevel): string {
  if (level === "critical") return "border-rose-400/50 bg-rose-500/15 text-rose-100";
  if (level === "significant") return "border-orange-400/50 bg-orange-500/15 text-orange-100";
  if (level === "moderate") return "border-amber-400/50 bg-amber-500/15 text-amber-100";
  return "border-emerald-400/50 bg-emerald-500/15 text-emerald-100";
}

function impactLabel(level: GedImpactLevel): string {
  if (level === "critical") return "Critical";
  if (level === "significant") return "Significant";
  if (level === "moderate") return "Moderate";
  return "Low";
}

function priorityTheme(priority: GedEngineDiagnostic["primary_priority"] | undefined) {
  switch (priority) {
    case "SALES_ENGINE_PRIORITY":
      return {
        eyebrow: "Sales Engine Priority",
        accent: "text-orange-200",
        border: "border-orange-300/25",
        panel: "from-orange-400/20 via-orange-500/10 to-transparent",
      };
    case "GROWTH_ENGINE_PRIORITY":
      return {
        eyebrow: "Growth Engine Priority",
        accent: "text-emerald-200",
        border: "border-emerald-300/25",
        panel: "from-emerald-400/20 via-emerald-500/10 to-transparent",
      };
    case "SCALE_READINESS_GAP":
      return {
        eyebrow: "Scale Readiness Gap",
        accent: "text-amber-200",
        border: "border-amber-300/25",
        panel: "from-amber-400/20 via-amber-500/10 to-transparent",
      };
    case "BALANCED_ENGINE_PRIORITY":
    default:
      return {
        eyebrow: "Balanced Engine Priority",
        accent: "text-sky-200",
        border: "border-sky-300/25",
        panel: "from-sky-400/20 via-sky-500/10 to-transparent",
      };
  }
}

function FrequencyDonut({ data }: { data: { key: PersonalityKey; value: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 55;
  const stroke = 17;
  const center = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 144 144" className="h-40 w-40" aria-label="Personality distribution">
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="rgba(148,163,184,0.18)"
        strokeWidth={stroke}
        fill="transparent"
      />
      {data.map((item) => {
        const dash = (item.value / total) * circumference;
        const node = (
          <circle
            key={item.key}
            cx={center}
            cy={center}
            r={radius}
            stroke={FREQUENCY_COLORS[item.key]}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
        offset -= dash;
        return node;
      })}
      <circle cx={center} cy={center} r={35} fill="#07121d" />
      <text x={center} y={68} textAnchor="middle" fill="#e2e8f0" fontSize="8" letterSpacing="1.4">
        PERSONALITY
      </text>
      <text x={center} y={79} textAnchor="middle" fill="#e2e8f0" fontSize="8" letterSpacing="1.4">
        LAYER
      </text>
    </svg>
  );
}

function ScoreRing({ score, label, sublabel }: { score: number; label: string; sublabel: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 112 112" className="h-28 w-28" aria-label={`${label}: ${score}%`}>
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke="rgba(148,163,184,0.20)"
          strokeWidth="9"
          fill="transparent"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke="#2dd4bf"
          strokeWidth="9"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 56 56)"
        />
        <text x="56" y="58" textAnchor="middle" fill="#f8fafc" fontSize="21" fontWeight="700">
          {Math.round(score)}
        </text>
        <text x="56" y="73" textAnchor="middle" fill="#94a3b8" fontSize="8">
          SCORE
        </text>
      </svg>
      <p className="mt-1 text-sm font-semibold text-slate-100">{label}</p>
      <p className="mt-1 max-w-[12rem] text-xs leading-5 text-slate-400">{sublabel}</p>
    </div>
  );
}

function ScoreBar({ label, score, caption }: { label: string; score: number; caption: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{caption}</p>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${scoreTone(score)}`}>{Math.round(score)}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h2>
      {body ? <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">{body}</p> : null}
    </div>
  );
}

function ReportCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </article>
  );
}

export default function GedEntrepreneurStrategicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const searchParams = useSearchParams();
  const tid = searchParams?.get("tid") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<GedPayload | null>(null);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const query = new URLSearchParams();
        if (tid) query.set("tid", tid);

        const response = await fetch(
          `/api/public/ged/${encodeURIComponent(token)}/result?${query.toString()}`,
          { cache: "no-store" }
        );

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await response.text();
          throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 180)}`);
        }

        const json = (await response.json()) as {
          ok?: boolean;
          error?: string;
          results?: QscResultsRow;
          profile?: QscProfileRow | null;
          persona?: QscPersonaRow | null;
          taker?: QscTakerRow | null;
          link?: LinkMeta | null;
          ged?: GedPayload["ged"];
        };

        if (!response.ok || json.ok === false || !json.results) {
          throw new Error(json.error || `HTTP ${response.status}`);
        }

        if (alive) {
          setPayload({
            results: json.results,
            profile: json.profile ?? null,
            persona: json.persona ?? null,
            taker: json.taker ?? null,
            link: json.link ?? null,
            ged: json.ged ?? null,
          });
        }
      } catch (cause: any) {
        if (alive) setError(String(cause?.message || cause || "Unknown error"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tid, token]);

  async function handleDownloadPdf() {
    if (!reportRef.current || downloading) return;

    try {
      setDownloading(true);
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: "#06111b",
        scale: 2,
        useCORS: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png");

      let position = 0;
      let remainingHeight = imageHeight;
      pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position = remainingHeight - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
        remainingHeight -= pageHeight;
      }

      pdf.save(`growth-engine-diagnostic-${token}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  const result = payload?.results ?? null;
  const persona = payload?.persona ?? null;
  const taker = payload?.taker ?? null;
  const diagnostic = payload?.ged?.engine_diagnostic ?? null;

  const personalityPercentages = useMemo<Partial<Record<PersonalityKey, number>>>(() => {
    const raw = result?.personality_percentages || {};
    return {
      FIRE: normalisePercent(raw.FIRE),
      FLOW: normalisePercent(raw.FLOW),
      FORM: normalisePercent(raw.FORM),
      FIELD: normalisePercent(raw.FIELD),
    };
  }, [result]);

  const mindsetPercentages = useMemo<Partial<Record<MindsetKey, number>>>(() => {
    const raw = result?.mindset_percentages || {};
    return {
      ORIGIN: normalisePercent(raw.ORIGIN),
      MOMENTUM: normalisePercent(raw.MOMENTUM),
      VECTOR: normalisePercent(raw.VECTOR),
      ORBIT: normalisePercent(raw.ORBIT),
      QUANTUM: normalisePercent(raw.QUANTUM),
    };
  }, [result]);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#06111b] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200">Growth Engine Diagnostic</p>
          <h1 className="mt-3 text-3xl font-semibold">Preparing your Strategic Client Report…</h1>
        </main>
      </div>
    );
  }

  if (error || !result || !diagnostic) {
    return (
      <div className="relative min-h-screen bg-[#06111b] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-4xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200">Growth Engine Diagnostic</p>
          <h1 className="mt-3 text-3xl font-semibold">We could not prepare this report</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            The Strategic Client Report needs the GED qualification answers as well as the QSC result. Please complete the diagnostic again or contact the person who sent you this link.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            {error || "GED diagnostic data was not available for this report."}
          </pre>
        </main>
      </div>
    );
  }

  const derivedPersonality = derivePrimary(personalityPercentages, ["FIRE", "FLOW", "FORM", "FIELD"]);
  const derivedMindset = derivePrimary(mindsetPercentages, ["ORIGIN", "MOMENTUM", "VECTOR", "ORBIT", "QUANTUM"]);

  /** Stored QSC result is the source of truth; percentages are only a compatibility fallback. */
  const primaryPersonality = result.primary_personality || derivedPersonality;
  const primaryMindset = result.primary_mindset || derivedMindset;
  const primaryPersonalityLabel = primaryPersonality ? PERSONALITY_LABELS[primaryPersonality] : "—";
  const primaryMindsetLabel = primaryMindset ? MINDSET_LABELS[primaryMindset] : "—";
  const canonicalProfile = `${primaryPersonalityLabel} ${primaryMindsetLabel}`.trim();
  const secondaryProfile =
    result.secondary_personality || result.secondary_mindset
      ? `${result.secondary_personality ? PERSONALITY_LABELS[result.secondary_personality] : ""} ${
          result.secondary_mindset ? MINDSET_LABELS[result.secondary_mindset] : ""
        }`.trim()
      : null;

  const name = getFullName(taker);
  const company = taker?.company?.trim() || null;
  const role = taker?.role_title?.trim() || null;
  const nextStepsHref =
    (payload?.link?.next_steps_url || payload?.link?.redirect_url || "").trim() || null;
  const createdAt = new Date(result.created_at);
  const theme = priorityTheme(diagnostic.primary_priority);

  const frequencyData = (["FIRE", "FLOW", "FORM", "FIELD"] as PersonalityKey[]).map((key) => ({
    key,
    value: personalityPercentages[key] || 0,
  }));

  const strategicPriorities = [
    persona?.strategic_priority_1,
    persona?.strategic_priority_2,
    persona?.strategic_priority_3,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return (
    <div className="min-h-screen bg-[#06111b] text-slate-900">
      <AppBackground />
      <main ref={reportRef} className="relative mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:px-6 md:py-10">
        <section className={`overflow-hidden rounded-[2rem] border bg-gradient-to-br ${theme.panel} ${theme.border} bg-[#06111b] p-6 text-white shadow-2xl shadow-black/30 md:p-9`}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                <span>Growth Engine Diagnostic</span>
                <span className="h-1 w-1 rounded-full bg-cyan-200" />
                <span>Strategic Client Report</span>
              </div>
              <p className="mt-7 text-sm text-slate-300">Prepared for</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-5xl">{name || "Your Growth Engine"}</h1>
              {company || role ? (
                <p className="mt-3 text-sm text-slate-300">
                  {[role, company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
                A practical view of where your business is relying too heavily on you, what needs attention first and how to build more dependable growth.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <p className="text-xs text-slate-400">
                Completed {createdAt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloading ? "Preparing PDF…" : "Download PDF"}
                </button>
                {nextStepsHref ? (
                  <a
                    href={nextStepsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  >
                    Next steps
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Your priority</p>
              <p className={`mt-3 text-lg font-semibold ${theme.accent}`}>{diagnostic.priority_label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{diagnostic.priority_summary}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Primary bottleneck</p>
              <p className="mt-3 text-lg font-semibold text-white">{diagnostic.primary_bottleneck.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{diagnostic.urgency.window}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Scale readiness</p>
              <p className={`mt-3 text-3xl font-semibold tabular-nums ${scoreTone(diagnostic.scores.scale_readiness)}`}>{diagnostic.scores.scale_readiness}%</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{diagnostic.scale_readiness_level} readiness for growth without adding more founder load.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Growth operating style</p>
              <p className="mt-3 text-lg font-semibold text-white">{canonicalProfile}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{secondaryProfile ? `Supporting mode: ${secondaryProfile}.` : "Your behavioural pattern explains how you create momentum and where pressure can build."}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#f7fafc] p-6 shadow-xl shadow-slate-950/15 md:p-9">
          <SectionHeading
            eyebrow="Executive snapshot"
            title="Your business needs a stronger engine, not more founder effort"
            body="Your answers show how reliably sales, delivery and decision-making can operate without direct founder intervention. These scores point to the highest-value area to strengthen first."
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1.1fr_0.8fr]">
            <ScoreBar
              label="Growth Engine"
              score={diagnostic.scores.growth_engine}
              caption="Delivery capacity, team execution and the operating structure that protects client outcomes as the business grows."
            />
            <ScoreBar
              label="Sales Engine"
              score={diagnostic.scores.sales_engine}
              caption="Conversion, follow-up and the ability to create consistent revenue without founder-led closing."
            />
            <div className="rounded-2xl bg-[#07121d] p-5">
              <ScoreRing
                score={diagnostic.scores.overall_engine}
                label="Overall Engine Health"
                sublabel="A combined view of sales reliability and growth capacity."
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ReportCard title="Business stage">
              <p className="font-medium text-slate-900">{diagnostic.business_stage.label}</p>
              <p className="mt-2">{diagnostic.business_stage.summary}</p>
            </ReportCard>
            <ReportCard title="Core constraint">
              <p className="font-medium text-slate-900">{diagnostic.core_constraint.label}</p>
              <p className="mt-2">{diagnostic.core_constraint.summary}</p>
            </ReportCard>
            <ReportCard title="30-day founder-dependency signal">
              <p className="font-medium text-slate-900">{diagnostic.scale_readiness_signal.label}</p>
              <p className="mt-2">{diagnostic.scale_readiness_signal.summary}</p>
            </ReportCard>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-950/15 md:p-9">
          <SectionHeading
            eyebrow="Business context"
            title="What your diagnostic answers tell us"
            body="The diagnostic is designed to separate a surface problem from the operating issue that is actually limiting scale."
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Your own diagnosis</p>
              <p className="mt-4 text-lg leading-8 text-slate-800">
                {diagnostic.self_diagnosis
                  ? `“${diagnostic.self_diagnosis}”`
                  : "You did not add a written self-diagnosis. The scorecard above still identifies the most likely operating pressure point from your answers."}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-800">Diagnostic confidence</p>
              <p className="mt-3 text-xl font-semibold capitalize text-slate-900">{diagnostic.confidence}</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                This report is a focused decision tool. It identifies the next area to examine and strengthen; it does not replace a full operational review.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#07121d] p-6 text-white shadow-xl shadow-slate-950/25 md:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Your growth operating style</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{canonicalProfile}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                The Growth Engine Diagnostic uses your QSC result as behavioural intelligence: it shows how you naturally create momentum, make decisions and respond when the business needs more structure.
              </p>

              <div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center">
                <FrequencyDonut data={frequencyData} />
                <div className="min-w-0 flex-1 space-y-3">
                  {frequencyData.map((item) => (
                    <div key={item.key} className="flex items-center gap-3 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: FREQUENCY_COLORS[item.key] }} />
                      <span className="min-w-14 text-slate-300">{PERSONALITY_LABELS[item.key]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: FREQUENCY_COLORS[item.key] }} />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-200">{Math.round(item.value)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Mindset distribution</p>
              <div className="mt-5 space-y-4">
                {(["ORIGIN", "MOMENTUM", "VECTOR", "ORBIT", "QUANTUM"] as MindsetKey[]).map((key) => {
                  const value = mindsetPercentages[key] || 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-slate-200">{MINDSET_LABELS[key]}</span>
                        <span className="tabular-nums text-slate-300">{Math.round(value)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-50">
                Current stage: <span className="font-semibold">{primaryMindsetLabel}</span>. Primary operating style: <span className="font-semibold">{primaryPersonalityLabel}</span>.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-950/15 md:p-8">
          <QscMatrix
            primaryPersonality={primaryPersonality}
            secondaryPersonality={result.secondary_personality}
            primaryMindset={primaryMindset}
            secondaryMindset={result.secondary_mindset}
            personalityPercentages={personalityPercentages}
            mindsetPercentages={mindsetPercentages}
            eyebrow="Growth operating pattern"
            title="How your operating style meets your current business stage"
            description="Your growth pattern is the intersection of how you naturally move through business and the stage your current operating system can support."
          />
        </section>

        <section className="rounded-[2rem] bg-[#f7fafc] p-6 shadow-xl shadow-slate-950/15 md:p-9">
          <SectionHeading
            eyebrow="Primary bottleneck"
            title={diagnostic.primary_bottleneck.label}
            body={diagnostic.primary_bottleneck.summary}
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <ReportCard title="Why it matters">
              <p>{diagnostic.primary_bottleneck.why_it_matters}</p>
            </ReportCard>
            <ReportCard title="The first practical fix">
              <p>{diagnostic.primary_bottleneck.first_fix}</p>
            </ReportCard>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Urgency</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{diagnostic.urgency.label}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{diagnostic.urgency.window}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{diagnostic.urgency.summary}</p>
            </article>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-950/15 md:p-9">
          <SectionHeading
            eyebrow="Operational impact"
            title="Where the bottleneck is likely to show up"
            body="This is not a revenue forecast. It is a practical view of where the current constraint is most likely to create drag, inconsistency or founder overload."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {diagnostic.operational_impact.map((impact) => (
              <article key={impact.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${impactTone(impact.level)}`}>
                  {impactLabel(impact.level)} impact
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-950">{impact.label}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{impact.explanation}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#07121d] p-6 text-white shadow-xl shadow-slate-950/25 md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">30-day focus plan</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Build the next layer of your engine</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            The goal is not to fix everything at once. It is to remove the highest-cost dependency, create clear ownership and establish a rhythm the team can repeat without you.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {diagnostic.action_plan.map((step) => (
              <article key={step.week} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{step.week}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  {step.actions.map((action) => (
                    <li key={action} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-950/15 md:p-9">
          <SectionHeading
            eyebrow="Behavioural intelligence"
            title="How to work with your operating style"
            body="Your behavioural result does not replace the operational diagnosis. It explains the conditions that help you implement the right fix and the patterns that may pull you back into the bottleneck."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ReportCard title="What you bring">
              <p>{persona?.combined_strengths || "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}</p>
            </ReportCard>
            <ReportCard title="What can create drag">
              <p>{persona?.combined_risks || "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}</p>
            </ReportCard>
            <ReportCard title="Your biggest behavioural lever">
              <p>{persona?.combined_big_lever || "Use your natural strengths to set direction, then protect the routines and ownership that allow the team to execute without you."}</p>
            </ReportCard>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ReportCard title="What stabilises you">
              <p>{persona?.emotional_stabilises || "Clear ownership, visible progress and a small number of priorities help you stay out of reactive founder mode."}</p>
            </ReportCard>
            <ReportCard title="What destabilises you">
              <p>{persona?.emotional_destabilises || "Unclear ownership, repeated escalation and too many decisions returning to you can increase pressure and reduce follow-through."}</p>
            </ReportCard>
            <ReportCard title="Support yourself better">
              <p>{persona?.support_yourself || "Protect time for strategic work, use simple decision rules and review whether the team is truly owning the work you have delegated."}</p>
            </ReportCard>
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#f7fafc] p-6 shadow-xl shadow-slate-950/15 md:p-9">
          <SectionHeading
            eyebrow="Executive summary"
            title="Your Growth Engine at a glance"
            body="Save this page, bring it to your strategy session or use it with your leadership team when deciding what to strengthen next."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ReportCard title="Growth Engine Profile">
              <p className="text-lg font-semibold text-slate-950">{canonicalProfile}</p>
              <p className="mt-2">Personality: {primaryPersonalityLabel}. Mindset stage: {primaryMindsetLabel}.</p>
            </ReportCard>
            <ReportCard title="Primary bottleneck">
              <p className="text-lg font-semibold text-slate-950">{diagnostic.primary_bottleneck.label}</p>
              <p className="mt-2">{diagnostic.urgency.window}</p>
            </ReportCard>
            <ReportCard title="Engine scorecard">
              <p>Growth Engine: <span className="font-semibold text-slate-950">{diagnostic.scores.growth_engine}%</span></p>
              <p>Sales Engine: <span className="font-semibold text-slate-950">{diagnostic.scores.sales_engine}%</span></p>
              <p>Scale readiness: <span className="font-semibold text-slate-950">{diagnostic.scores.scale_readiness}%</span></p>
            </ReportCard>
            <ReportCard title="Business context">
              <p>{diagnostic.business_stage.label}</p>
              <p className="mt-2">Constraint: {diagnostic.core_constraint.label}</p>
            </ReportCard>
            <ReportCard title="Next 90 days">
              {strategicPriorities.length ? (
                <ul className="space-y-2">
                  {strategicPriorities.map((priority) => (
                    <li key={priority} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-700" />{priority}</li>
                  ))}
                </ul>
              ) : (
                <p>Protect the new operating rhythm, strengthen ownership and remove the next founder dependency once the first change is working.</p>
              )}
            </ReportCard>
            <ReportCard title="Recommended next step">
              <p className="font-semibold text-slate-950">{diagnostic.recommended_next_step.title}</p>
              <p className="mt-2">{diagnostic.recommended_next_step.summary}</p>
            </ReportCard>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-gradient-to-br from-cyan-300 via-teal-200 to-emerald-100 p-7 shadow-xl shadow-black/15 md:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">Your recommended next step</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Turn the diagnostic into a live execution plan.</h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              You now have a clear view of the pressure point. The next move is to translate it into ownership, an operating rhythm and a focused 90-day plan.
            </p>
            {nextStepsHref ? (
              <a
                href={nextStepsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Book your strategy session
              </a>
            ) : null}
          </div>
        </section>

        <footer className="pb-5 pt-2 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ProfileTest.ai · Growth Engine Diagnostic · Confidential Strategic Client Report
        </footer>
      </main>
    </div>
  );
}
