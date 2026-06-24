// apps/web/app/ged/[token]/entrepreneur/page.tsx
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

type PersonalityPercentages = Partial<Record<PersonalityKey, number>>;
type MindsetPercentages = Partial<Record<MindsetKey, number>>;

type QscResultsRow = {
  id: string;
  test_id: string;
  token: string;
  audience: "entrepreneur" | "leader" | null;
  personality_totals: Record<string, number> | null;
  personality_percentages: PersonalityPercentages | null;
  mindset_totals: Record<string, number> | null;
  mindset_percentages: MindsetPercentages | null;
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
  FIRE: "#F97316",
  FLOW: "#0EA5E9",
  FORM: "#22C55E",
  FIELD: "#A855F7",
};

const REPORT_ICON_ROOT = "/ged/report-icons";

function normalisePercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (value > 0 && value <= 1.5) return Math.max(0, Math.min(100, value * 100));
  return Math.max(0, Math.min(100, value));
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
  const ranked = [...keys]
    .map((key) => ({ key, value: normalisePercent(values[key] ?? 0) }))
    .sort((a, b) => b.value - a.value);

  return ranked[0]?.value ? ranked[0].key : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreColor(score: number): string {
  if (score >= 72) return "#16A34A";
  if (score >= 48) return "#D97706";
  return "#DC2626";
}

function impactLabel(level: GedImpactLevel): string {
  switch (level) {
    case "critical":
      return "Critical";
    case "significant":
      return "Significant";
    case "moderate":
      return "Moderate";
    default:
      return "Low";
  }
}

function impactTheme(level: GedImpactLevel): {
  chip: string;
  bar: string;
  panel: string;
} {
  switch (level) {
    case "critical":
      return {
        chip: "bg-rose-100 text-rose-700",
        bar: "bg-rose-600",
        panel: "border-rose-200 bg-rose-50",
      };
    case "significant":
      return {
        chip: "bg-orange-100 text-orange-700",
        bar: "bg-orange-500",
        panel: "border-orange-200 bg-orange-50",
      };
    case "moderate":
      return {
        chip: "bg-amber-100 text-amber-800",
        bar: "bg-amber-500",
        panel: "border-amber-200 bg-amber-50",
      };
    default:
      return {
        chip: "bg-emerald-100 text-emerald-700",
        bar: "bg-emerald-500",
        panel: "border-emerald-200 bg-emerald-50",
      };
  }
}

function priorityTheme(priority: GedEngineDiagnostic["primary_priority"]) {
  switch (priority) {
    case "SALES_ENGINE_PRIORITY":
      return {
        accent: "#F97316",
        soft: "from-orange-400/20 via-orange-500/8 to-transparent",
        pill: "bg-orange-400/10 text-orange-200 ring-orange-300/25",
      };
    case "DELIVERY_ENGINE_PRIORITY":
      return {
        accent: "#34D399",
        soft: "from-emerald-400/20 via-emerald-500/8 to-transparent",
        pill: "bg-emerald-400/10 text-emerald-200 ring-emerald-300/25",
      };
    case "SCALE_READINESS_GAP":
      return {
        accent: "#FBBF24",
        soft: "from-amber-300/20 via-amber-500/8 to-transparent",
        pill: "bg-amber-400/10 text-amber-100 ring-amber-300/25",
      };
    case "DIAGNOSTIC_CLARITY_GAP":
      return {
        accent: "#38BDF8",
        soft: "from-sky-400/20 via-sky-500/8 to-transparent",
        pill: "bg-sky-400/10 text-sky-100 ring-sky-300/25",
      };
    case "BALANCED_ENGINE_PRIORITY":
    default:
      return {
        accent: "#45E0D1",
        soft: "from-cyan-300/20 via-teal-400/8 to-transparent",
        pill: "bg-cyan-300/10 text-cyan-100 ring-cyan-200/25",
      };
  }
}

function ReportIcon({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span className={`flex shrink-0 items-center justify-center ${className}`}>
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </span>
  );
}

function FrequencyDonut({
  data,
}: {
  data: { key: PersonalityKey; value: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 54;
  const center = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 144 144" className="h-40 w-40 shrink-0" aria-label="Personality layer distribution">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="17"
      />
      {data.map((item) => {
        const dash = (item.value / total) * circumference;
        const node = (
          <circle
            key={item.key}
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={FREQUENCY_COLORS[item.key]}
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="17"
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
        offset -= dash;
        return node;
      })}
      <circle cx={center} cy={center} r="35" fill="#0C1D1A" />
      <text x={center} y="68" fill="#E2E8F0" fontSize="8" letterSpacing="1.4" textAnchor="middle">
        PERSONALITY
      </text>
      <text x={center} y="80" fill="#E2E8F0" fontSize="8" letterSpacing="1.4" textAnchor="middle">
        LAYER
      </text>
    </svg>
  );
}

function ScoreRing({
  score,
  label,
  sublabel,
}: {
  score: number;
  label: string;
  sublabel: string;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamp(score) / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32" aria-label={`${label}: ${score}%`}>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="9"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="transparent"
          stroke="#45E0D1"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="9"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="60" fill="#F8FAFC" fontSize="23" fontWeight="800" textAnchor="middle">
          {clamp(score)}
        </text>
        <text x="60" y="76" fill="#94A3B8" fontSize="8" letterSpacing="1.1" textAnchor="middle">
          INDICATOR
        </text>
      </svg>
      <p className="mt-1 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 max-w-[14rem] text-xs leading-5 text-slate-400">{sublabel}</p>
    </div>
  );
}

function EngineIndicator({
  label,
  score,
  caption,
  icon,
}: {
  label: string;
  score: number;
  caption: string;
  icon?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {icon ? (
          <ReportIcon
            src={icon}
            alt=""
            className="h-10 w-10 rounded-lg bg-[#E8FBF8] p-2"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-semibold text-[#0C1D1A]">{label}</p>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color: scoreColor(score) }}>
              {clamp(score)}%
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{caption}</p>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamp(score)}%`,
            background:
              "linear-gradient(90deg, #DC2626 0%, #F59E0B 52%, #16A34A 100%)",
          }}
        />
      </div>
    </article>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  body,
  inverse = false,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  body?: string;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <ReportIcon
        src={icon}
        alt=""
        className={`h-11 w-11 rounded-xl p-2.5 ${
          inverse ? "bg-cyan-300/15 ring-1 ring-white/10" : "bg-[#06B6CA] shadow-sm"
        }`}
      />
      <div className="max-w-3xl">
        <p
          className={`text-[0.68rem] font-bold uppercase tracking-[0.24em] ${
            inverse ? "text-emerald-300" : "text-cyan-700"
          }`}
        >
          {eyebrow}
        </p>
        <h2
          className={`mt-2 text-2xl font-bold tracking-tight md:text-3xl ${
            inverse ? "text-white" : "text-[#0C1D1A]"
          }`}
        >
          {title}
        </h2>
        {body ? (
          <p className={`mt-3 text-sm leading-6 md:text-base ${inverse ? "text-slate-300" : "text-slate-600"}`}>
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LightCard({
  title,
  children,
  icon,
  className = "",
}: {
  title: string;
  children: ReactNode;
  icon?: string;
  className?: string;
}) {
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {icon ? (
        <ReportIcon src={icon} alt="" className="h-9 w-9 rounded-lg bg-[#FEE8D6] p-2" />
      ) : null}
      <h3 className={`${icon ? "mt-4" : ""} text-xs font-bold uppercase tracking-[0.15em] text-slate-500`}>
        {title}
      </h3>
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
          const responseText = await response.text();
          throw new Error(
            `Non-JSON response (${response.status}): ${responseText.slice(0, 180)}`
          );
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
      } catch (cause: unknown) {
        if (alive) {
          setError(
            cause instanceof Error
              ? cause.message
              : String(cause || "Unknown report error")
          );
        }
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
        backgroundColor: "#09141D",
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png");

      let y = 0;
      let remainingHeight = imageHeight;

      pdf.addImage(imageData, "PNG", 0, y, imageWidth, imageHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        y = remainingHeight - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, y, imageWidth, imageHeight);
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

  const personalityPercentages = useMemo<PersonalityPercentages>(() => {
    const source = result?.personality_percentages || {};
    return {
      FIRE: normalisePercent(source.FIRE),
      FLOW: normalisePercent(source.FLOW),
      FORM: normalisePercent(source.FORM),
      FIELD: normalisePercent(source.FIELD),
    };
  }, [result]);

  const mindsetPercentages = useMemo<MindsetPercentages>(() => {
    const source = result?.mindset_percentages || {};
    return {
      ORIGIN: normalisePercent(source.ORIGIN),
      MOMENTUM: normalisePercent(source.MOMENTUM),
      VECTOR: normalisePercent(source.VECTOR),
      ORBIT: normalisePercent(source.ORBIT),
      QUANTUM: normalisePercent(source.QUANTUM),
    };
  }, [result]);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#09141D] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
            Growth Engine Diagnostic
          </p>
          <h1 className="mt-4 text-3xl font-bold">Preparing your Strategic Client Report…</h1>
        </main>
      </div>
    );
  }

  if (error || !result || !diagnostic) {
    return (
      <div className="relative min-h-screen bg-[#09141D] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-4xl px-5 py-20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
            Growth Engine Diagnostic
          </p>
          <h1 className="mt-4 text-3xl font-bold">We could not prepare this report</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            The Strategic Client Report needs the GED qualification answers as well as the QSC result.
            Please complete the diagnostic again or contact the person who sent you this link.
          </p>
          <pre className="mt-7 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">
            {error || "GED diagnostic data was not available for this report."}
          </pre>
        </main>
      </div>
    );
  }

  const derivedPersonality = derivePrimary(personalityPercentages, [
    "FIRE",
    "FLOW",
    "FORM",
    "FIELD",
  ]);
  const derivedMindset = derivePrimary(mindsetPercentages, [
    "ORIGIN",
    "MOMENTUM",
    "VECTOR",
    "ORBIT",
    "QUANTUM",
  ]);

  /**
   * Stored QSC values remain the single source of truth. The distributions are
   * only a compatibility fallback for legacy results.
   */
  const primaryPersonality = result.primary_personality || derivedPersonality;
  const primaryMindset = result.primary_mindset || derivedMindset;
  const primaryPersonalityLabel = primaryPersonality
    ? PERSONALITY_LABELS[primaryPersonality]
    : "—";
  const primaryMindsetLabel = primaryMindset
    ? MINDSET_LABELS[primaryMindset]
    : "—";
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
  const createdAt = formatDate(result.created_at);
  const nextStepsHref =
    (payload?.link?.next_steps_url || payload?.link?.redirect_url || "").trim() || null;
  const theme = priorityTheme(diagnostic.primary_priority);
  const profileIcon = primaryPersonality
    ? `${REPORT_ICON_ROOT}/4-profile-icons/${primaryPersonality.toLowerCase()}.png`
    : `${REPORT_ICON_ROOT}/4-profile-icons/fire.png`;

  const frequencyData = (["FIRE", "FLOW", "FORM", "FIELD"] as PersonalityKey[]).map(
    (key) => ({
      key,
      value: personalityPercentages[key] || 0,
    })
  );

  const snapshotItems = [
    {
      label: "Your priority",
      value: diagnostic.priority_label,
      detail: diagnostic.priority_summary,
      accent: theme.accent,
    },
    {
      label: "Primary bottleneck",
      value: diagnostic.primary_bottleneck.label,
      detail: diagnostic.urgency.window,
      accent: "#F8FAFC",
    },
    {
      label: "Scale readiness",
      value: `${diagnostic.scores.scale_readiness}%`,
      detail: `${diagnostic.scale_readiness_level} readiness without adding founder load.`,
      accent: scoreColor(diagnostic.scores.scale_readiness),
    },
    {
      label: "Growth operating style",
      value: canonicalProfile,
      detail: secondaryProfile
        ? `Supporting mode: ${secondaryProfile}.`
        : "Your QSC pattern explains how you create momentum under pressure.",
      accent: "#45E0D1",
    },
  ];

  return (
    <div className="min-h-screen bg-[#09141D] text-slate-900">
      <AppBackground />

      <main ref={reportRef} className="relative mx-auto max-w-[1440px] px-3 py-4 md:px-6 md:py-7">
        <header className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#17403A] px-5 py-6 text-white shadow-2xl shadow-black/30 md:px-9 md:py-8">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-black tracking-[0.1em]">
                PT
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-emerald-300">
                  Growth Engine Diagnostic
                </p>
                <h1 className="mt-2 text-2xl font-semibold uppercase tracking-[0.12em] md:text-3xl">
                  Strategic Growth Report
                </h1>
                <p className="mt-2 text-sm text-emerald-100/85">
                  Strategic Client Report · Powered by ProfileTest.ai
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-black/10 px-4 py-3">
                <p className="text-[0.68rem] text-white/55">Prepared for</p>
                <p className="mt-1 text-sm font-semibold">{name || "Participant"}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/10 px-4 py-3">
                <p className="text-[0.68rem] text-white/55">Date</p>
                <p className="mt-1 text-sm font-semibold">{createdAt}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/10 px-4 py-3">
                <p className="text-[0.68rem] text-white/55">Framework</p>
                <p className="mt-1 text-sm font-semibold">{canonicalProfile}</p>
              </div>
            </div>
          </div>
        </header>

        <section className={`mt-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-gradient-to-br ${theme.soft} bg-[#0C1D1A] p-6 text-white shadow-2xl shadow-black/20 md:mt-7 md:p-10`}>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.25em] text-emerald-300">
                Executive snapshot
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">
                Your business needs a stronger engine, not more founder effort.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                A practical view of where the business is relying too heavily on you, what needs attention
                first and how to build more dependable growth.
              </p>
              {company || role ? (
                <p className="mt-5 text-sm text-slate-400">
                  {[role, company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
              {nextStepsHref ? (
                <a
                  href={nextStepsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#3C2EE0] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30"
                >
                  Next steps
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {snapshotItems.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-black/15 p-5">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-3 text-xl font-bold" style={{ color: item.accent }}>
                  {item.value}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-300">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-[#F9F8F6] p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/engine-scorecard.png`}
              eyebrow="Your engine scorecard"
              title="A practical view of the operating system"
              body="These are response indicators, not a financial forecast. They show where sales reliability, delivery reliability and founder dependency need the most attention."
            />

            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr_0.76fr]">
              <EngineIndicator
                label="Delivery & Operating Engine"
                score={diagnostic.scores.delivery_engine}
                caption="Delivery capacity, team execution and operating ownership that protect client outcomes as the business grows."
                icon={`${REPORT_ICON_ROOT}/section-icons/engine-scorecard.png`}
              />
              <EngineIndicator
                label="Sales Engine"
                score={diagnostic.scores.sales_engine}
                caption="Conversion, follow-up and the ability to create consistent revenue without founder-led closing."
                icon={`${REPORT_ICON_ROOT}/section-icons/primary-bottleneck.png`}
              />
              <div className="rounded-2xl bg-[#0C1D1A] p-5">
                <ScoreRing
                  score={diagnostic.scores.overall_engine}
                  label="Overall engine health"
                  sublabel="A combined indicator of sales and delivery reliability."
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <LightCard title="Scale readiness">
                <p className="text-xl font-extrabold text-[#0C1D1A]">
                  {diagnostic.scores.scale_readiness}% indicator
                </p>
                <p className="mt-2">{diagnostic.urgency.window}</p>
              </LightCard>
              <LightCard title="Founder dependency">
                <p className="text-xl font-extrabold text-[#0C1D1A]">
                  {diagnostic.scores.founder_dependency}% dependency
                </p>
                <p className="mt-2">
                  This is the current degree of reliance on founder judgement, intervention or personal follow-through.
                </p>
              </LightCard>
              <LightCard title="Response alignment">
                <p className="text-xl font-extrabold text-[#0C1D1A]">
                  {diagnostic.response_alignment.label}
                </p>
                <p className="mt-2">{diagnostic.response_alignment.summary}</p>
              </LightCard>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-[#F9F8F6] p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/business-context.png`}
              eyebrow="Your business context"
              title="What your diagnostic answers tell us"
              body="Your qualifying responses translated into practical business intelligence. These signals shape the priorities throughout this report."
            />

            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              <LightCard
                title="Business stage"
                icon={`${REPORT_ICON_ROOT}/business-context/business-stage.png`}
              >
                <p className="text-lg font-bold text-[#0C1D1A]">{diagnostic.business_stage.label}</p>
                <p className="mt-2">{diagnostic.business_stage.summary}</p>
              </LightCard>

              <LightCard
                title="Core constraint"
                icon={`${REPORT_ICON_ROOT}/business-context/core-constraint.png`}
              >
                <p className="text-lg font-bold text-[#0C1D1A]">{diagnostic.core_constraint.label}</p>
                <p className="mt-2">{diagnostic.core_constraint.summary}</p>
              </LightCard>

              <LightCard
                title="30-day founder-dependency signal"
                icon={`${REPORT_ICON_ROOT}/business-context/scale-readiness.png`}
              >
                <p className="text-lg font-bold text-[#0C1D1A]">{diagnostic.scale_readiness_signal.label}</p>
                <p className="mt-2">{diagnostic.scale_readiness_signal.summary}</p>
              </LightCard>

              <LightCard
                title="Your own diagnosis"
                icon={`${REPORT_ICON_ROOT}/business-context/strategic-self-diagnosis.png`}
              >
                <p className="text-base font-medium leading-7 text-[#0C1D1A]">
                  {diagnostic.self_diagnosis
                    ? `“${diagnostic.self_diagnosis}”`
                    : "You did not add a written self-diagnosis. The report is using your selected answers to identify the most likely pressure point."}
                </p>
              </LightCard>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-6 text-white shadow-2xl shadow-black/20 md:mt-7 md:p-9">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex items-start gap-4">
                <ReportIcon
                  src={profileIcon}
                  alt=""
                  className="h-12 w-12 rounded-xl bg-white/10 p-2.5"
                />
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-emerald-300">
                    Your growth operating style
                  </p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight">{canonicalProfile}</h2>
                </div>
              </div>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
                The Growth Engine Diagnostic uses your QSC result as behavioural intelligence. It explains how you naturally create momentum, make decisions and respond when the business needs more structure.
              </p>

              <div className="mt-7 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                <FrequencyDonut data={frequencyData} />
                <div className="w-full space-y-3">
                  {frequencyData.map((item) => (
                    <div key={item.key} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: FREQUENCY_COLORS[item.key] }}
                      />
                      <span className="w-12 text-slate-300">{PERSONALITY_LABELS[item.key]}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.value}%`,
                            backgroundColor: FREQUENCY_COLORS[item.key],
                          }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-200">
                        {Math.round(item.value)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
                Mindset distribution
              </p>
              <div className="mt-6 space-y-4">
                {(["ORIGIN", "MOMENTUM", "VECTOR", "ORBIT", "QUANTUM"] as MindsetKey[]).map(
                  (key) => {
                    const value = mindsetPercentages[key] || 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">{MINDSET_LABELS[key]}</span>
                          <span className="tabular-nums text-slate-300">{Math.round(value)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#45E0D1]"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
              <p className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-50">
                Primary mindset: <span className="font-semibold">{primaryMindsetLabel}</span>. Primary operating style:{" "}
                <span className="font-semibold">{primaryPersonalityLabel}</span>.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-white p-3 md:p-5">
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
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-[#F9F8F6] p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/primary-bottleneck.png`}
              eyebrow="Your primary bottleneck"
              title={diagnostic.primary_bottleneck.label}
              body={diagnostic.primary_bottleneck.summary}
            />

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <LightCard title="Why it matters">
                <p>{diagnostic.primary_bottleneck.why_it_matters}</p>
              </LightCard>
              <LightCard title="The first practical fix">
                <p>{diagnostic.primary_bottleneck.first_fix}</p>
              </LightCard>
              <LightCard title="Urgency window">
                <p className="text-2xl font-extrabold text-[#0C1D1A]">{diagnostic.urgency.label}</p>
                <p className="mt-1 font-semibold text-slate-800">{diagnostic.urgency.window}</p>
                <p className="mt-3">{diagnostic.urgency.summary}</p>
              </LightCard>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-white p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/what-this-means.png`}
              eyebrow="Operational impact analysis"
              title="Where the bottleneck is likely to show up"
              body="This is not a revenue forecast. It is a practical view of where the current constraint is most likely to create drag, inconsistency or founder overload."
            />

            <div className="mt-7 space-y-3">
              {diagnostic.operational_impact.map((impact) => {
                const themeForImpact = impactTheme(impact.level);
                const impactScore =
                  impact.level === "critical"
                    ? 92
                    : impact.level === "significant"
                      ? 74
                      : impact.level === "moderate"
                        ? 52
                        : 25;

                return (
                  <article
                    key={impact.key}
                    className={`grid gap-4 rounded-2xl border p-4 md:grid-cols-[minmax(10rem,0.72fr)_1fr_auto] md:items-center ${themeForImpact.panel}`}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-[#0C1D1A]">{impact.label}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{impact.explanation}</p>
                    </div>
                    <div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${themeForImpact.bar}`}
                          style={{ width: `${impactScore}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[0.68rem] text-slate-400">
                        <span>Low impact</span>
                        <span>Critical impact</span>
                      </div>
                    </div>
                    <span className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.12em] ${themeForImpact.chip}`}>
                      {impactLabel(impact.level)}
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-6 text-white shadow-2xl shadow-black/20 md:mt-7 md:p-9">
          <SectionHeading
            icon={`${REPORT_ICON_ROOT}/section-icons/30-day-focus-plan.png`}
            eyebrow="30-day focus plan"
            title="Build the next layer of your engine"
            body="The aim is not to fix everything at once. Remove the highest-cost dependency, create clear ownership and establish a rhythm the team can repeat without you."
            inverse
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {diagnostic.action_plan.map((step) => (
              <article key={step.week} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-emerald-300">
                  {step.week}
                </p>
                <h3 className="mt-3 text-lg font-bold text-white">{step.title}</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  {step.actions.map((action) => (
                    <li key={action} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#45E0D1]" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-[#F9F8F6] p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/recommended-next-steps.png`}
              eyebrow="Your 90-day roadmap"
              title="Turn the first correction into an operating model"
              body="The first 30 days reveal the constraint. The next 60 days turn the correction into stronger ownership, a measurable rhythm and less founder dependency."
            />

            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {diagnostic.ninety_day_roadmap.map((phase) => (
                <LightCard key={phase.phase} title={phase.phase}>
                  <p className="text-lg font-bold text-[#0C1D1A]">{phase.title}</p>
                  <p className="mt-3">{phase.summary}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {phase.actions.map((action) => (
                      <li key={action} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#06B6CA]" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </LightCard>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-white p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/emotional-operational-alignment.png`}
              eyebrow="Behavioural intelligence"
              title="How to work with your operating style"
              body="Your behavioural profile does not replace the operating diagnosis. It explains the conditions that help you implement the right fix and the patterns that may pull you back into the bottleneck."
            />

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <LightCard title="What you bring">
                <p>{persona?.combined_strengths || "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}</p>
              </LightCard>
              <LightCard title="What can create drag">
                <p>{persona?.combined_risks || "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}</p>
              </LightCard>
              <LightCard title="Your biggest behavioural lever">
                <p>{persona?.combined_big_lever || "Use your natural strengths to set direction, then protect the routines and ownership that allow the team to execute without you."}</p>
              </LightCard>
              <LightCard title="What stabilises you">
                <p>{persona?.emotional_stabilises || "Clear ownership, visible progress and a small number of priorities help you stay out of reactive founder mode."}</p>
              </LightCard>
              <LightCard title="What destabilises you">
                <p>{persona?.emotional_destabilises || "Unclear ownership, repeated escalation and too many decisions returning to you can increase pressure and reduce follow-through."}</p>
              </LightCard>
              <LightCard title="Support yourself better">
                <p>{persona?.support_yourself || "Protect time for strategic work, use simple decision rules and review whether the team is truly owning the work you have delegated."}</p>
              </LightCard>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#0C1D1A] p-4 shadow-2xl shadow-black/20 md:mt-7 md:p-7">
          <div className="rounded-[1.25rem] bg-[#F9F8F6] p-5 md:p-8">
            <SectionHeading
              icon={`${REPORT_ICON_ROOT}/section-icons/one-page-executive-summary.png`}
              eyebrow="One-page executive summary"
              title="Your Growth Engine at a glance"
              body="Save this page, bring it to your strategy session or use it with your leadership team when deciding what to strengthen next."
            />

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <LightCard title="Growth operating style">
                <p className="text-lg font-bold text-[#0C1D1A]">{canonicalProfile}</p>
                <p className="mt-2">
                  Personality: {primaryPersonalityLabel}. Primary mindset: {primaryMindsetLabel}.
                </p>
              </LightCard>
              <LightCard title="Primary bottleneck">
                <p className="text-lg font-bold text-[#0C1D1A]">{diagnostic.primary_bottleneck.label}</p>
                <p className="mt-2">{diagnostic.urgency.window}</p>
              </LightCard>
              <LightCard title="Engine indicators">
                <p>Delivery & operating: <span className="font-bold text-[#0C1D1A]">{diagnostic.scores.delivery_engine}%</span></p>
                <p>Sales: <span className="font-bold text-[#0C1D1A]">{diagnostic.scores.sales_engine}%</span></p>
                <p>Scale readiness: <span className="font-bold text-[#0C1D1A]">{diagnostic.scores.scale_readiness}%</span></p>
              </LightCard>
              <LightCard title="Business context">
                <p>{diagnostic.business_stage.label}</p>
                <p className="mt-2">Constraint: {diagnostic.core_constraint.label}</p>
              </LightCard>
              <LightCard title="Next 90 days">
                <p>{diagnostic.ninety_day_roadmap[2]?.summary || "Protect the new operating rhythm and remove the next founder dependency once the first change is working."}</p>
              </LightCard>
              <LightCard title="Recommended next step">
                <p className="font-bold text-[#0C1D1A]">{diagnostic.recommended_next_step.title}</p>
                <p className="mt-2">{diagnostic.recommended_next_step.summary}</p>
              </LightCard>
            </div>

            <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              {diagnostic.scope_note}
            </p>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[1.7rem] border border-cyan-200/40 bg-gradient-to-br from-[#45E0D1] via-[#B4F4EA] to-[#E8FFF7] p-7 shadow-2xl shadow-black/20 md:mt-7 md:p-11">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-700">
              Your recommended next step
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0C1D1A] md:text-5xl">
              Turn the diagnostic into a live execution plan.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">
              You now have a clear view of the pressure point. The next move is to translate it into ownership, an operating rhythm and a focused 90-day plan.
            </p>
            {nextStepsHref ? (
              <a
                href={nextStepsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex rounded-xl bg-[#0C1D1A] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
              >
                Book your strategy session
              </a>
            ) : null}
          </div>
        </section>

        <footer className="px-4 py-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} ProfileTest.ai · Growth Engine Diagnostic · Confidential Strategic Client Report
        </footer>
      </main>
    </div>
  );
}
