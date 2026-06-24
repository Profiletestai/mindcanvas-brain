// apps/web/app/ged/[token]/entrepreneur/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
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
  FIRE: "#f97316",
  FLOW: "#0ea5e9",
  FORM: "#22c55e",
  FIELD: "#a855f7",
};

const MINDSET_COLORS: Record<MindsetKey, string> = {
  ORIGIN: "#f59e0b",
  MOMENTUM: "#38bdf8",
  VECTOR: "#45e0d1",
  ORBIT: "#818cf8",
  QUANTUM: "#c084fc",
};

const REPORT_ICON_BASE = "/ged/report-icons";

const SECTION_ICON_PATHS = {
  quantum_profile_matrix: `${REPORT_ICON_BASE}/section-icons/quantum-profile-matrix.png`,
  understand_quantum_profile: `${REPORT_ICON_BASE}/section-icons/understand-quantum-profile.png`,
  personality_layer: `${REPORT_ICON_BASE}/section-icons/personality-layer.png`,
  mindset_layer: `${REPORT_ICON_BASE}/section-icons/mindset-layer.png`,
  combined_pattern: `${REPORT_ICON_BASE}/section-icons/combined-pattern.png`,
  emotional_alignment: `${REPORT_ICON_BASE}/section-icons/emotional-operational-alignment.png`,
  business_context: `${REPORT_ICON_BASE}/section-icons/business-context.png`,
  engine_scorecard: `${REPORT_ICON_BASE}/section-icons/engine-scorecard.png`,
  primary_bottleneck: `${REPORT_ICON_BASE}/section-icons/primary-bottleneck.png`,
  what_this_means: `${REPORT_ICON_BASE}/section-icons/what-this-means.png`,
  revenue_impact: `${REPORT_ICON_BASE}/section-icons/your-revenue-impact.png`,
  focus_plan: `${REPORT_ICON_BASE}/section-icons/30-day-focus-plan.png`,
  executive_summary: `${REPORT_ICON_BASE}/section-icons/one-page-executive-summary.png`,
  recommended_next_steps: `${REPORT_ICON_BASE}/section-icons/recommended-next-steps.png`,
} as const;

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

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTone(score: number): string {
  if (score >= 72) return "text-emerald-600";
  if (score >= 48) return "text-amber-600";
  return "text-rose-600";
}

function impactTone(level: GedImpactLevel): string {
  if (level === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "significant") return "border-orange-200 bg-orange-50 text-orange-700";
  if (level === "moderate") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
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
        accent: "text-orange-600",
        chip: "border-orange-200 bg-orange-50 text-orange-700",
        hero: "from-orange-500/15 via-amber-400/10 to-transparent",
      };
    case "DELIVERY_ENGINE_PRIORITY":
      return {
        accent: "text-emerald-600",
        chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
        hero: "from-emerald-500/15 via-teal-400/10 to-transparent",
      };
    case "SCALE_READINESS_GAP":
      return {
        accent: "text-amber-600",
        chip: "border-amber-200 bg-amber-50 text-amber-700",
        hero: "from-amber-500/15 via-orange-400/10 to-transparent",
      };
    case "BALANCED_ENGINE_PRIORITY":
    default:
      return {
        accent: "text-cyan-700",
        chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
        hero: "from-cyan-500/15 via-sky-400/10 to-transparent",
      };
  }
}

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AssetIcon({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return <img src={src} alt={alt} className={className} />;
}

function SectionMarker({
  icon,
  eyebrow,
  title,
  body,
  dark = false,
  compact = false,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  body?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/30">
        <AssetIcon src={icon} className="h-7 w-7 object-contain" />
      </div>
      <div className="min-w-0">
        <p className={`text-[0.67rem] font-bold uppercase tracking-[0.22em] ${dark ? "text-emerald-300" : "text-cyan-700"}`}>
          {eyebrow}
        </p>
        <h2
          className={[
            "mt-1 font-extrabold tracking-tight",
            compact ? "text-xl leading-7" : "text-2xl md:text-[2rem]",
            dark ? "text-white" : "text-[#111827]",
          ].join(" ")}
        >
          {title}
        </h2>
        {body ? (
          <p
            className={[
              "mt-2 max-w-4xl",
              compact ? "text-sm leading-5" : "text-sm leading-6",
              dark ? "text-slate-300" : "text-slate-600",
            ].join(" ")}
          >
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContentCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </article>
  );
}

function DarkContentCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-xl border border-white/10 bg-white/[0.035] p-5 ${className}`}>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-300">{children}</div>
    </article>
  );
}

function Meter({
  label,
  score,
  accent = "#22c55e",
  caption,
}: {
  label: string;
  score: number;
  accent?: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-sm font-bold tabular-nums" style={{ color: accent }}>
          {clampPercent(score)}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${clampPercent(score)}%`, backgroundColor: accent }} />
      </div>
      {caption ? <p className="mt-2 text-xs leading-5 text-slate-500">{caption}</p> : null}
    </div>
  );
}

function FrequencyDonut({ data }: { data: { key: PersonalityKey; value: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 55;
  const stroke = 17;
  const center = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 144 144" className="h-40 w-40 shrink-0" aria-label="Personality distribution">
      <circle cx={center} cy={center} r={radius} stroke="rgba(148,163,184,0.18)" strokeWidth={stroke} fill="transparent" />
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
      <circle cx={center} cy={center} r={35} fill="#0c1d1a" />
      <text x={center} y={68} textAnchor="middle" fill="#e2e8f0" fontSize="8" letterSpacing="1.4">
        PERSONALITY
      </text>
      <text x={center} y={79} textAnchor="middle" fill="#e2e8f0" fontSize="8" letterSpacing="1.4">
        LAYER
      </text>
    </svg>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  const dash = (clampPercent(score) / 100) * circumference;

  return (
    <svg viewBox="0 0 132 132" className="h-36 w-36" aria-label={`Overall engine score: ${score}%`}>
      <circle cx="66" cy="66" r={radius} stroke="rgba(148,163,184,0.20)" strokeWidth="10" fill="transparent" />
      <circle
        cx="66"
        cy="66"
        r={radius}
        stroke="#2dd4bf"
        strokeWidth="10"
        fill="transparent"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="66" textAnchor="middle" fill="#f8fafc" fontSize="23" fontWeight="800">
        {clampPercent(score)}
      </text>
      <text x="66" y="82" textAnchor="middle" fill="#94a3b8" fontSize="8" letterSpacing="1.2">
        ENGINE SCORE
      </text>
    </svg>
  );
}

function RocketGlyph({ color = "#45e0d1" }: { color?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-7 w-7" fill="none">
      <path d="M29.9 6.2c4.8 1.5 8.4 5.1 9.9 9.9-2.5 7.3-7.2 13.9-13.5 18.8l-6.4-6.4c4.9-6.3 11.5-11 18.8-13.5Z" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m19.9 28.5-5.7 5.7m9.9-1.8-3 7.5m-5.7-11.4-7.5 3" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31.1" cy="14.9" r="2.2" fill={color} />
    </svg>
  );
}

function QuantumProfileVisual({
  personalityLabel,
  mindsetLabel,
  profileLabel,
  personalityColor,
  mindsetColor,
  personalityIcon,
  mindsetIcon,
}: {
  personalityLabel: string;
  mindsetLabel: string;
  profileLabel: string;
  personalityColor: string;
  mindsetColor: string;
  personalityIcon: string;
  mindsetIcon: string;
}) {
  return (
    <section
      aria-label="Quantum Profile"
      className="rounded-2xl border border-amber-400/30 bg-[#0a211c] p-4 shadow-inner shadow-black/20 md:p-5"
    >
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
        Quantum Profile
      </p>

      <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative h-28 w-[196px] shrink-0" aria-label={`${personalityLabel} and ${mindsetLabel}`}>
          <div
            className="absolute left-0 top-0 flex h-28 w-28 flex-col items-center justify-center rounded-full border-[1.5px] bg-[#0c1d1a]"
            style={{ borderColor: personalityColor }}
          >
            <AssetIcon src={personalityIcon} className="h-7 w-7 object-contain" />
            <span className="mt-1 text-lg font-extrabold" style={{ color: personalityColor }}>
              {personalityLabel}
            </span>
          </div>

          <div
            className="absolute left-[76px] top-0 flex h-28 w-28 flex-col items-center justify-center rounded-full border-[1.5px] bg-[#0c1d1a]"
            style={{ borderColor: mindsetColor }}
          >
            <AssetIcon src={mindsetIcon} className="h-7 w-7 object-contain" />
            <span className="mt-1 text-lg font-extrabold" style={{ color: mindsetColor }}>
              {mindsetLabel}
            </span>
          </div>
        </div>

        <div className="hidden h-px flex-1 bg-white/35 xl:block" aria-hidden="true" />
        <span className="hidden text-2xl text-slate-300 xl:block" aria-hidden="true">→</span>

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-300/5">
            <RocketGlyph color="#45e0d1" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-200">Your Result</p>
            <p className="mt-0.5 text-lg font-extrabold leading-tight md:text-xl">
              <span style={{ color: personalityColor }}>{personalityLabel}</span>{" "}
              <span style={{ color: mindsetColor }}>{mindsetLabel}</span>
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">{profileLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type ReportIndexItem = {
  href: string;
  label: string;
};

function ReportIndex({
  items,
  onDownloadPdf,
  downloading,
  nextStepsHref,
}: {
  items: ReportIndexItem[];
  onDownloadPdf: () => void;
  downloading: boolean;
  nextStepsHref: string | null;
}) {
  function handleInReportNavigation(
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string
  ) {
    if (!href.startsWith("#")) return;

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", href);
    }
  }

  const nextStepsIsExternal = Boolean(nextStepsHref);
  const resolvedNextStepsHref = nextStepsHref || "#recommended-next-steps";

  return (
    <aside className="hidden self-start xl:block">
      <div className="sticky top-6 w-[240px] rounded-[24px] border border-white/[0.12] bg-[#0C1D1A] p-[14px] text-white shadow-2xl shadow-black/25">
        <p className="px-1 text-[10px] font-normal uppercase leading-[15px] tracking-[0.24em] text-white">
          Report Index
        </p>

        <nav aria-label="Report Index" className="mt-3 space-y-[6px]">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(event) => handleInReportNavigation(event, item.href)}
              className="flex min-h-[40px] items-center rounded-[12px] border border-white px-[12px] py-2 text-[12px] leading-5 text-white transition hover:border-emerald-300 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mt-5 space-y-[7px]">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={downloading}
            className="flex h-8 w-[122px] items-center justify-center rounded-[6px] border border-white/[0.12] bg-[#34D399] px-3 text-[12px] font-semibold leading-[14.72px] text-slate-50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? "Preparing…" : "Download PDF"}
          </button>

          <a
            href={resolvedNextStepsHref}
            target={nextStepsIsExternal ? "_blank" : undefined}
            rel={nextStepsIsExternal ? "noopener noreferrer" : undefined}
            onClick={(event) => handleInReportNavigation(event, resolvedNextStepsHref)}
            className="flex h-7 w-[95px] items-center justify-center rounded-[5.62px] bg-gradient-to-r from-[#FFB347] via-[#34D399] to-[#34D399] px-3 text-[12px] font-semibold leading-[13.69px] text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          >
            Next steps
          </a>
        </div>
      </div>
    </aside>
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
      const report = reportRef.current;
      const units = Array.from(report.querySelectorAll<HTMLElement>("[data-ged-pdf-page]"));
      const pages = units.length ? units : [report];
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      let isFirstPdfPage = true;

      for (const page of pages) {
        const canvas = await html2canvas(page, {
          backgroundColor: "#09141d",
          scale: 2,
          useCORS: true,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
          logging: false,
        });

        const imageWidth = pdfPageWidth;
        const imageHeight = (canvas.height * imageWidth) / canvas.width;
        const imageData = canvas.toDataURL("image/png");
        let renderedHeight = 0;

        while (renderedHeight < imageHeight) {
          if (!isFirstPdfPage) pdf.addPage();
          pdf.addImage(imageData, "PNG", 0, -renderedHeight, imageWidth, imageHeight);
          renderedHeight += pdfPageHeight;
          isFirstPdfPage = false;
        }
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
      <div className="relative min-h-screen bg-[#09141d] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">Growth Engine Diagnostic</p>
          <h1 className="mt-3 text-3xl font-semibold">Preparing your Strategic Client Report…</h1>
        </main>
      </div>
    );
  }

  if (error || !result || !diagnostic) {
    return (
      <div className="relative min-h-screen bg-[#09141d] text-white">
        <AppBackground />
        <main className="relative mx-auto max-w-4xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">Growth Engine Diagnostic</p>
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

  // Stored QSC result is the source of truth; percentages are only a compatibility fallback.
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
  const nextStepsHref = (payload?.link?.next_steps_url || payload?.link?.redirect_url || "").trim() || null;
  const createdAt = humanDate(result.created_at);
  const theme = priorityTheme(diagnostic.primary_priority);

  const frequencyData = (['FIRE', 'FLOW', 'FORM', 'FIELD'] as PersonalityKey[]).map((key) => ({
    key,
    value: personalityPercentages[key] || 0,
  }));

  const strategicPriorities = [
    persona?.strategic_priority_1,
    persona?.strategic_priority_2,
    persona?.strategic_priority_3,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const indexItems: ReportIndexItem[] = [
    { href: "#quantum-profile-matrix", label: "Buyers Persona Matrix" },
    { href: "#personality-layer", label: "Your Personality layer" },
    { href: "#understand-quantum-profile", label: "Understand the quantum profile" },
    { href: "#mindset-layer", label: "Your mindset layer" },
    { href: "#combined-pattern", label: "Your combined quantum pattern" },
    { href: "#one-page-quantum-profile", label: "Your strategic growth priorities" },
    { href: "#focus-plan", label: "Your 30-day action plan" },
    { href: "#growth-roadmap", label: "Your growth roadmap" },
    { href: "#communication-decision-style", label: "Your communication and decision style" },
    { href: "#reflection-prompts", label: "Your reflection prompts" },
    { href: "#executive-summary", label: "Your one-page quantum summary" },
    { href: "#executive-summary", label: "Executive summary" },
  ];

  const personaIcon = primaryPersonality
    ? `${REPORT_ICON_BASE}/4-profile-icons/${primaryPersonality.toLowerCase()}.png`
    : `${REPORT_ICON_BASE}/4-profile-icons/fire.png`;
  const mindsetIcon = primaryMindset
    ? `${REPORT_ICON_BASE}/quantum-profile-matrix/${primaryMindset.toLowerCase()}.png`
    : `${REPORT_ICON_BASE}/quantum-profile-matrix/vector.png`;
  const primaryPersonalityColor = primaryPersonality
    ? FREQUENCY_COLORS[primaryPersonality]
    : "#f97316";
  const primaryMindsetColor = primaryMindset
    ? MINDSET_COLORS[primaryMindset]
    : "#45e0d1";

  const onePageIconBase = `${REPORT_ICON_BASE}/one-page-quantum-section`;
  const onePageIcons = {
    personality: `${onePageIconBase}/personality.png`,
    mindsetStage: `${onePageIconBase}/mindset-stage.png`,
    strengths: `${onePageIconBase}/your-strengths.png`,
    priorities: `${onePageIconBase}/top-strength-priorities.png`,
  };

  const displayReadinessLevel =
    diagnostic.scale_readiness_level.charAt(0).toUpperCase() +
    diagnostic.scale_readiness_level.slice(1);

  const readinessStyle =
    diagnostic.scale_readiness_level === "high"
      ? {
          border: "border-emerald-400/70",
          text: "text-emerald-300",
          meter: "#34d399",
          card: "from-emerald-500/10 to-transparent",
        }
      : diagnostic.scale_readiness_level === "moderate"
        ? {
            border: "border-orange-400/70",
            text: "text-orange-300",
            meter: "#f97316",
            card: "from-orange-500/10 to-transparent",
          }
        : {
            border: "border-rose-400/70",
            text: "text-rose-300",
            meter: "#fb7185",
            card: "from-rose-500/10 to-transparent",
          };

  const urgencyStyle =
    diagnostic.urgency.level === "high"
      ? {
          border: "border-rose-500/70",
          text: "text-rose-300",
          dot: "bg-rose-400",
        }
      : diagnostic.urgency.level === "moderate"
        ? {
            border: "border-orange-400/70",
            text: "text-orange-300",
            dot: "bg-orange-400",
          }
        : {
            border: "border-emerald-400/70",
            text: "text-emerald-300",
            dot: "bg-emerald-400",
          };

  const priorityText = diagnostic.priority_label.toLowerCase();
  const activeJourneyStep = priorityText.includes("sales")
    ? 3
    : priorityText.includes("delivery") || priorityText.includes("growth")
      ? 5
      : priorityText.includes("scale")
        ? 2
        : 4;

  const engineJourney = [
    { step: 5, title: "Scale & Systemize", detail: "Predictable growth engine" },
    { step: 4, title: "Optimise & Expand", detail: "Increase efficiency & margin" },
    { step: 3, title: "Build & Convert", detail: "Strong pipeline & a sales system" },
    { step: 2, title: "Validate & Offer", detail: "Market fit & offer clarity" },
    { step: 1, title: "Foundation", detail: "Clarity, positioning & early traction" },
  ];

  return (
    <div className="min-h-screen bg-[#09141d] text-slate-900">
      <AppBackground />
      <main ref={reportRef} className="relative mx-auto max-w-[1440px] px-3 py-4 md:px-5 md:py-6">
        <header data-ged-pdf-page className="overflow-hidden rounded-3xl border border-white/10 bg-[#17403a] px-5 py-5 text-white shadow-2xl shadow-black/25 md:px-8 md:py-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,190px))] xl:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xs font-black tracking-[0.12em]">
                PT
              </div>
              <div>
                <h1 className="text-2xl font-extrabold uppercase tracking-[0.12em] md:text-[2rem]">Strategic Growth Report</h1>
                <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-emerald-300">Growth Engine Diagnostic</p>
                <p className="mt-1 text-xs text-white/80">Strategic Client Report · Powered by ProfileTest.ai</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 xl:contents">
              <div className="rounded-2xl border border-white/15 bg-black/5 p-3">
                <p className="text-[0.65rem] text-white/55">Prepared for</p>
                <p className="mt-1 truncate text-sm font-bold">{name || "—"}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/5 p-3">
                <p className="text-[0.65rem] text-white/55">Date</p>
                <p className="mt-1 text-sm font-bold">{createdAt}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/5 p-3">
                <p className="text-[0.65rem] text-white/55">Framework</p>
                <p className="mt-1 text-sm font-bold">{canonicalProfile}</p>
              </div>
            </div>
          </div>
        </header>

        <section data-ged-pdf-page className={`mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${theme.hero} bg-[#0c1d1a] p-6 text-white shadow-2xl shadow-black/25 md:p-9`}>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Quantum profile</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">{name || "Your Growth Engine"}</h2>
              {company || role ? <p className="mt-2 text-base text-slate-300">{[role, company].filter(Boolean).join(" · ")}</p> : null}
              <p className="mt-6 border-l-4 border-emerald-400 pl-4 text-base leading-7 text-slate-200">
                A practical view of where your business is relying too heavily on you, what needs attention first and how to build more dependable growth.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="rounded-xl border border-white/15 bg-[#1a4d41] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#235d4f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
              {nextStepsHref ? (
                <a
                  href={nextStepsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-gradient-to-r from-[#45e0d1] via-[#4f7dff] to-[#3c2ee0] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Next steps
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.22fr_0.78fr]">
            <QuantumProfileVisual
              personalityLabel={primaryPersonalityLabel}
              mindsetLabel={primaryMindsetLabel}
              profileLabel={canonicalProfile}
              personalityColor={primaryPersonalityColor}
              mindsetColor={primaryMindsetColor}
              personalityIcon={personaIcon}
              mindsetIcon={mindsetIcon}
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm leading-6 text-slate-300">
                The Growth Engine Diagnostic combines your behavioural pattern with your current operating signals, helping you see how you naturally create momentum and where the operating system needs to become more dependable.
              </p>
            </div>
          </div>
        </section>

        <section
          data-ged-pdf-page
          id="one-page-quantum-profile"
          className="mt-5 scroll-mt-6 overflow-hidden rounded-3xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(20,107,105,0.28),transparent_42%),linear-gradient(120deg,#14282a_0%,#08201f_52%,#113638_100%)] p-5 shadow-2xl shadow-black/20 md:p-7"
        >
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-emerald-300">
            One-Page Quantum Profile
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">
            Your at-a-glance growth profile
          </h2>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.94fr_1.08fr_1.08fr]">
            <article className="min-h-[206px] rounded-2xl border-2 border-emerald-400 bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <p className="text-sm font-bold text-emerald-300">Your Quantum Profile</p>
              <p className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">{canonicalProfile}</p>

              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/10">
                    <AssetIcon src={onePageIcons.personality} className="h-4 w-4 object-contain" />
                  </span>
                  <span className="flex-1 text-xs font-medium text-slate-300">Personality</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: primaryPersonalityColor }}
                  >
                    {primaryPersonalityLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-400/10">
                    <AssetIcon src={onePageIcons.mindsetStage} className="h-4 w-4 object-contain" />
                  </span>
                  <span className="flex-1 text-xs font-medium text-slate-300">Mindset Stage</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: primaryMindsetColor }}
                  >
                    {primaryMindsetLabel}
                  </span>
                </div>
              </div>
            </article>

            <article className="min-h-[206px] rounded-2xl border border-white/10 bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-300/60 bg-cyan-400/10">
                  <AssetIcon src={onePageIcons.strengths} className="h-4 w-4 object-contain" />
                </span>
                <p className="text-sm font-bold text-cyan-300">Your Strengths</p>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-200">
                {persona?.combined_strengths ||
                  "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}
              </p>

              <p className="mt-5 text-sm font-bold text-rose-300">Your Risks</p>
              <p className="mt-2 text-sm leading-5 text-slate-200">
                {persona?.combined_risks ||
                  "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}
              </p>
            </article>

            <article className="min-h-[206px] rounded-2xl border border-[#168bd2] bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#168bd2]/70 bg-[#168bd2]/10">
                  <AssetIcon src={onePageIcons.priorities} className="h-4 w-4 object-contain" />
                </span>
                <p className="text-sm font-bold text-sky-300">Top strategic priorities</p>
              </div>

              <ol className="mt-4 space-y-3 text-sm leading-5 text-slate-200">
                {(strategicPriorities.length
                  ? strategicPriorities
                  : [
                      "Protect the new operating rhythm.",
                      "Strengthen ownership across the team.",
                      "Remove the next founder dependency once the first change is working.",
                    ]
                ).map((priority, index) => (
                  <li key={priority} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2d91e8] text-[0.56rem] font-black text-white">
                      {index + 1}
                    </span>
                    <span>{priority}</span>
                  </li>
                ))}
              </ol>
            </article>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.78fr_0.9fr_1.42fr_0.92fr]">
            <article
              className={`min-h-[188px] rounded-2xl border bg-gradient-to-br ${readinessStyle.border} ${readinessStyle.card} p-5 text-white shadow-inner shadow-black/20`}
            >
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-300">
                Scale Readiness Gap
              </p>
              <p className={`mt-3 text-2xl font-extrabold ${readinessStyle.text}`}>
                {displayReadinessLevel}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-200">
                {diagnostic.scale_readiness_level} readiness for growth without adding more founder load.
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${clampPercent(diagnostic.scores.scale_readiness)}%`,
                    backgroundColor: readinessStyle.meter,
                  }}
                />
              </div>
              <p className="mt-2 text-[0.68rem] text-slate-300">
                Readiness score: {diagnostic.scores.scale_readiness}%
              </p>
            </article>

            <article
              className={`min-h-[188px] rounded-2xl border bg-[#09211c] p-5 text-white shadow-inner shadow-black/20 ${urgencyStyle.border}`}
            >
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-300">
                Urgency Level
              </p>
              <p className={`mt-3 text-2xl font-extrabold ${urgencyStyle.text}`}>
                {diagnostic.urgency.label}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-100">{diagnostic.urgency.window}</p>
              <div className="mt-3 flex gap-2 text-xs leading-5 text-slate-300">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${urgencyStyle.dot}`} />
                <span>{diagnostic.urgency.summary}</span>
              </div>
            </article>

            <article className="min-h-[188px] rounded-2xl border border-white/10 bg-[#09211c] p-5 text-white shadow-inner shadow-black/20">
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
                {diagnostic.priority_label}
              </p>

              <div className="mt-3 space-y-1.5">
                {engineJourney.map((item) => {
                  const active = item.step === activeJourneyStep;

                  return (
                    <div
                      key={item.step}
                      className={[
                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
                        active
                          ? "border-emerald-300/80 bg-[#3ed9aa] text-[#09211c]"
                          : "border-white/[0.05] bg-[#061713] text-slate-100",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-black",
                          active ? "bg-[#0a7d5f] text-white" : "bg-emerald-400/20 text-emerald-200",
                        ].join(" ")}
                      >
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[0.68rem] font-bold leading-4 ${active ? "text-[#09211c]" : "text-slate-100"}`}>
                          {item.title}
                        </p>
                        <p className={`text-[0.56rem] leading-3 ${active ? "text-[#09211c] opacity-75" : "text-slate-400"}`}>
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-300">{diagnostic.priority_summary}</p>
            </article>

            <article className="flex min-h-[188px] flex-col items-center justify-center rounded-2xl border border-emerald-300/50 bg-[#1b5148] p-4 text-center text-white shadow-inner shadow-black/20">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-emerald-200">
                Progress Circle
              </p>
              <ScoreRing score={diagnostic.scores.overall_engine} />
              <p className="-mt-2 text-sm font-bold text-white">Overall Engine Score</p>
              <p className="mt-2 text-xs leading-5 text-emerald-50/85">
                Overall engine health
              </p>
            </article>
          </div>
        </section>

        <section
          data-ged-pdf-page
          id="profile-distributions"
          className="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <article className="rounded-2xl border border-white/10 bg-[#0c1d1a] p-5 text-white shadow-2xl shadow-black/20 md:p-6">
            <h2 className="text-base font-bold text-white md:text-lg">Your Personality Layer</h2>
            <p className="mt-3 max-w-xl text-xs leading-5 text-slate-300 md:text-sm">
              Your emotional &amp; energetic style across Fire, Flow, Form and Field in the way you buy and build.
            </p>

            <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <FrequencyDonut data={frequencyData} />

              <div className="w-full space-y-3">
                {frequencyData.map((item) => (
                  <div key={item.key} className="flex items-center gap-3 text-xs md:text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: FREQUENCY_COLORS[item.key] }}
                    />
                    <span className="flex-1 text-slate-200">
                      {PERSONALITY_LABELS[item.key]}
                    </span>
                    <span className="w-10 text-right tabular-nums text-slate-200">
                      {Math.round(item.value)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0c1d1a] p-5 text-white shadow-2xl shadow-black/20 md:p-6">
            <h2 className="text-base font-bold text-white md:text-lg">Your Mindset Layer</h2>
            <p className="mt-3 max-w-xl text-xs leading-5 text-slate-300 md:text-sm">
              Where your focus and energy are distributed across the five Quantum growth stages.
            </p>

            <div className="mt-5 space-y-3">
              {(["ORIGIN", "MOMENTUM", "VECTOR", "ORBIT", "QUANTUM"] as MindsetKey[]).map((key) => {
                const value = clampPercent(mindsetPercentages[key] || 0);

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between gap-4 text-xs md:text-sm">
                      <span className="text-slate-200">{MINDSET_LABELS[key]}</span>
                      <span className="tabular-nums text-slate-200">{value}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#45e0d1]"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <ReportIndex
            items={indexItems}
            onDownloadPdf={handleDownloadPdf}
            downloading={downloading}
            nextStepsHref={nextStepsHref}
          />

          <div className="space-y-5">
            <section
              data-ged-pdf-page
              id="quantum-profile-matrix"
              className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7"
            >
              <SectionMarker
                icon={SECTION_ICON_PATHS.quantum_profile_matrix}
                eyebrow="Quantum Profile Matrix"
                title="Where your buyer frequency meets your mindset level"
                body="Each cell represents a different Quantum buyer persona. Your primary pattern is highlighted — this is where your emotional wiring and current growth stage meet."
                dark
                compact
              />

              <div className="mt-6">
                <QscMatrix
                  variant="ged"
                  primaryPersonality={primaryPersonality}
                  secondaryPersonality={result.secondary_personality}
                  primaryMindset={primaryMindset}
                  secondaryMindset={result.secondary_mindset}
                  personalityPercentages={personalityPercentages}
                  mindsetPercentages={mindsetPercentages}
                  eyebrow="Quantum Source Code"
                  title="Quantum Profile Matrix"
                  description="This grid maps your Buyer Frequency Type (left to right) against your Buyer Mindset Level (bottom to top). Your combined profile sits at the intersection."
                />
              </div>
            </section>

            <section data-ged-pdf-page id="understand-quantum-profile" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.understand_quantum_profile}
                eyebrow="Understand the Quantum Profile"
                title="Your Quantum Profile"
                body="Your combined profile is where your personality layer and mindset stage meet. The result explains how you naturally create momentum and where the business needs more structure to keep pace."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DarkContentCard title={`Your Personality Layer — ${primaryPersonalityLabel}`}>
                  <p>{persona?.combined_strengths || "Your personality layer shows how you naturally think, act, make decisions and respond when the business needs more structure."}</p>
                </DarkContentCard>
                <DarkContentCard title={`Your Mindset Layer — ${primaryMindsetLabel}`}>
                  <p>
                    Your current mindset stage is <span className="font-semibold text-white">{primaryMindsetLabel}</span>. It shows where your focus and energy are distributed across the Quantum growth stages.
                  </p>
                </DarkContentCard>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Your result</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{canonicalProfile}</p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                  The Growth Engine Diagnostic uses your QSC result as behavioural intelligence: it shows how you naturally create momentum, make decisions and respond when the business needs more structure.
                </p>
              </div>
            </section>

            <section data-ged-pdf-page id="personality-layer" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.personality_layer}
                eyebrow="Your Personality Layer"
                title="How you show up emotionally & behaviourally"
                body="Your personality layer is your emotional wiring and energetic pattern. It does not change overnight, which is why it is such a powerful anchor for business design."
                dark
              />
              <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:flex-row">
                  <FrequencyDonut data={frequencyData} />
                  <div className="w-full space-y-3">
                    {frequencyData.map((item) => (
                      <div key={item.key} className="flex items-center gap-3 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: FREQUENCY_COLORS[item.key] }} />
                        <span className="min-w-14 text-slate-300">{PERSONALITY_LABELS[item.key]}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: FREQUENCY_COLORS[item.key] }} />
                        </div>
                        <span className="w-10 text-right tabular-nums text-slate-200">{Math.round(item.value)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <DarkContentCard title="Core pattern">
                    <p>{persona?.combined_strengths || "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}</p>
                  </DarkContentCard>
                  <DarkContentCard title="What energises you">
                    <p>{persona?.energisers || "You operate best when your strengths are directed toward the work that creates strategic momentum."}</p>
                  </DarkContentCard>
                  <DarkContentCard title="What drains you">
                    <p>{persona?.drains || "Repeated escalation, unclear ownership and work that should be carried by the operating system can drain your highest-value energy."}</p>
                  </DarkContentCard>
                </div>
              </div>
            </section>

            <section data-ged-pdf-page id="mindset-layer" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.mindset_layer}
                eyebrow="Your Mindset Layer"
                title="Where you are in your growth journey"
                body="Your mindset layer shows where your focus and energy are distributed across the five Quantum growth stages."
                dark
              />
              <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-sm font-bold text-white">{primaryMindsetLabel}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Current stage: <span className="font-semibold text-white">{primaryMindsetLabel}</span>. Primary operating style: <span className="font-semibold text-white">{primaryPersonalityLabel}</span>.
                  </p>
                  <p className="mt-5 text-sm leading-6 text-slate-300">
                    Your Growth Engine Diagnostic uses the behavioural profile to show the conditions that make the current operating correction easier to implement and sustain.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mindset distribution</p>
                  <div className="mt-5 space-y-4">
                    {(["ORIGIN", "MOMENTUM", "VECTOR", "ORBIT", "QUANTUM"] as MindsetKey[]).map((key) => (
                      <div key={key}>
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-slate-200">{MINDSET_LABELS[key]}</span>
                          <span className="tabular-nums text-slate-300">{Math.round(mindsetPercentages[key] || 0)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#45e0d1]" style={{ width: `${mindsetPercentages[key] || 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section data-ged-pdf-page id="combined-pattern" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.combined_pattern}
                eyebrow="Your Combined Quantum Pattern"
                title="How your behaviour and mindset interact"
                body="Your combined profile is more than the sum of its parts. It shows how your emotional wiring and current growth stage create a distinct operating pattern, with specific strengths, risks and levers."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <DarkContentCard title="Strategic strengths">
                  <p>{persona?.combined_strengths || "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}</p>
                </DarkContentCard>
                <DarkContentCard title="Growth risks & loops">
                  <p>{persona?.combined_risks || "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}</p>
                </DarkContentCard>
                <DarkContentCard title="Biggest lever">
                  <p>{persona?.combined_big_lever || "Use your natural strengths to set direction, then protect the routines and ownership that allow the team to execute without you."}</p>
                </DarkContentCard>
              </div>
            </section>

            <section data-ged-pdf-page id="communication-decision-style" className="scroll-mt-6 rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.emotional_alignment}
                eyebrow="Your Emotional & Operational Alignment"
                title="How to support yourself inside this pattern"
                body="Your behavioural result does not replace the operational diagnosis. It explains the conditions that help you implement the right fix and the patterns that may pull you back into the bottleneck."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <DarkContentCard title="What stabilises you">
                  <p>{persona?.emotional_stabilises || "Clear ownership, visible progress and a small number of priorities help you stay out of reactive founder mode."}</p>
                </DarkContentCard>
                <DarkContentCard title="What destabilises you">
                  <p>{persona?.emotional_destabilises || "Unclear ownership, repeated escalation and too many decisions returning to you can increase pressure and reduce follow-through."}</p>
                </DarkContentCard>
                <DarkContentCard title="Support yourself better">
                  <p>{persona?.support_yourself || "Protect time for strategic work, use simple decision rules and review whether the team is truly owning the work you have delegated."}</p>
                </DarkContentCard>
              </div>
            </section>

            <section data-ged-pdf-page id="business-context" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.business_context}
                eyebrow="Your Business Context"
                title="Where you are right now"
                body="Your qualifying responses translated into business intelligence. These four signals shape the diagnostic priorities throughout this report."
                dark
              />
              <div className="mt-6 rounded-2xl bg-[#f9f8f6] p-4 md:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <ContentCard title="Business stage">
                    <p className="text-lg font-extrabold text-slate-950">{diagnostic.business_stage.label}</p>
                    <p className="mt-2">{diagnostic.business_stage.summary}</p>
                  </ContentCard>
                  <ContentCard title="Core constraint">
                    <p className="text-lg font-extrabold text-slate-950">{diagnostic.core_constraint.label}</p>
                    <p className="mt-2">{diagnostic.core_constraint.summary}</p>
                  </ContentCard>
                  <ContentCard title="Scale readiness">
                    <p className={`text-2xl font-extrabold ${scoreTone(diagnostic.scores.scale_readiness)}`}>{diagnostic.scores.scale_readiness}% Ready</p>
                    <p className="mt-2">{diagnostic.scale_readiness_signal.summary}</p>
                  </ContentCard>
                  <ContentCard title="Strategic self-diagnosis">
                    <p className="text-sm leading-6 text-slate-700">
                      {diagnostic.self_diagnosis
                        ? `“${diagnostic.self_diagnosis}”`
                        : "You did not add a written self-diagnosis. The scorecard still identifies the most likely operating pressure point from your answers."}
                    </p>
                  </ContentCard>
                </div>
              </div>
            </section>

            <section data-ged-pdf-page id="engine-scorecard" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.engine_scorecard}
                eyebrow="Your Engine Scorecard"
                title="Growth Engine Health Check"
                body="A diagnostic view across the core dimensions that determine your ability to scale sustainably."
                dark
              />
              <div className="mt-6 rounded-2xl bg-white p-5 md:p-6">
                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <ScoreRing score={diagnostic.scores.overall_engine} />
                    <p className="mt-1 text-sm font-bold text-slate-950">Overall Engine Score</p>
                    <div className="mt-5 w-full space-y-3 text-left text-sm">
                      <div className="flex items-center justify-between"><span className="text-slate-600">Growth Profile</span><strong className="text-slate-950">{diagnostic.scores.growth_engine}%</strong></div>
                      <div className="flex items-center justify-between"><span className="text-slate-600">Scale Readiness</span><strong className="text-slate-950">{diagnostic.scores.scale_readiness}%</strong></div>
                      <div className="flex items-center justify-between"><span className="text-slate-600">Founder Dependency</span><strong className="text-slate-950">{diagnostic.scores.founder_dependency}%</strong></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <p className="text-base font-bold text-slate-950">Diagnostic Score Breakdown</p>
                    <div className="mt-5 space-y-5">
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Operational Layer</p>
                        <div className="mt-4 space-y-4">
                          <Meter label="Growth Engine" score={diagnostic.scores.growth_engine} accent="#16a34a" caption="Delivery capacity, team execution and operating structure." />
                          <Meter label="Sales Engine" score={diagnostic.scores.sales_engine} accent="#d97706" caption="Conversion, follow-up and consistent revenue without founder-led closing." />
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Readiness Layer</p>
                        <div className="mt-4 space-y-4">
                          <Meter label="Scale Readiness" score={diagnostic.scores.scale_readiness} accent="#d97706" />
                          <Meter label="Founder Dependency" score={100 - diagnostic.scores.founder_dependency} accent="#dc2626" caption="Higher dependency reduces the readiness score." />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section data-ged-pdf-page id="primary-bottleneck" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.primary_bottleneck}
                eyebrow="Your Primary Bottleneck"
                title="What is capping your growth"
                body="Your diagnostic identifies one primary constraint preventing sustainable scale right now."
                dark
              />
              <div className="mt-6 rounded-2xl bg-[#f9f8f6] p-4 md:p-6">
                <div className="rounded-2xl border border-emerald-300 bg-emerald-100/60 p-5">
                  <p className="text-sm font-extrabold text-emerald-800">{diagnostic.primary_bottleneck.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{diagnostic.primary_bottleneck.summary}</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <ContentCard title="Why it matters"><p>{diagnostic.primary_bottleneck.why_it_matters}</p></ContentCard>
                  <ContentCard title="The first practical fix"><p>{diagnostic.primary_bottleneck.first_fix}</p></ContentCard>
                  <ContentCard title="Urgency window">
                    <p className="text-lg font-extrabold text-slate-950">{diagnostic.urgency.label}</p>
                    <p className="mt-2 font-semibold text-slate-800">{diagnostic.urgency.window}</p>
                    <p className="mt-3">{diagnostic.urgency.summary}</p>
                  </ContentCard>
                </div>
              </div>
            </section>

            <section data-ged-pdf-page id="reflection-prompts" className="scroll-mt-6 rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.what_this_means}
                eyebrow="What This Means"
                title={`${canonicalProfile} — decoded for operators`}
                body="What your combined profile signals about your strengths, your risks, and where the highest-leverage moves live."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <ContentCard title="Strategic Strength" className="border-emerald-200 bg-emerald-50/60">
                  <p className="font-semibold text-slate-950">{persona?.combined_strengths || "Your profile highlights the strengths you naturally bring to decisions, relationships and momentum in the business."}</p>
                </ContentCard>
                <ContentCard title="Growth Risk" className="border-rose-200 bg-rose-50/60">
                  <p className="font-semibold text-slate-950">{persona?.combined_risks || "Under pressure, your natural style can make it easier to return to old habits instead of letting the new operating system do its work."}</p>
                </ContentCard>
                <ContentCard title="Biggest Lever" className="border-emerald-200 bg-emerald-50/60">
                  <p className="font-semibold text-slate-950">{persona?.combined_big_lever || "Use your natural strengths to set direction, then protect the routines and ownership that allow the team to execute without you."}</p>
                </ContentCard>
              </div>
            </section>

            <section data-ged-pdf-page id="revenue-impact" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.revenue_impact}
                eyebrow="Your Revenue Impact"
                title="What the bottleneck is costing you"
                body="The commercial case for resolving your primary constraint in the next 90 days."
                dark
              />
              <div className="mt-6 rounded-2xl bg-white p-5 md:p-6">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-cyan-700">Operational impact analysis</p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-950">Where the bottleneck is likely to show up</h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                  This is not a revenue forecast. It is a practical view of where the current constraint is most likely to create drag, inconsistency or founder overload.
                </p>
                <div className="mt-5 space-y-3">
                  {diagnostic.operational_impact.map((impact) => {
                    const severity = impact.level === "critical" ? 92 : impact.level === "significant" ? 72 : impact.level === "moderate" ? 52 : 28;
                    return (
                      <article key={impact.key} className={`rounded-xl border p-4 ${impactTone(impact.level)}`}>
                        <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(260px,1.1fr)_auto] md:items-center">
                          <div>
                            <h3 className="text-sm font-bold text-slate-950">{impact.label}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{impact.explanation}</p>
                          </div>
                          <div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/80">
                              <div className="h-full rounded-full" style={{ width: `${severity}%`, backgroundColor: impact.level === "critical" ? "#e11d48" : impact.level === "significant" ? "#f97316" : impact.level === "moderate" ? "#d97706" : "#10b981" }} />
                            </div>
                            <div className="mt-1 flex justify-between text-[0.65rem] text-slate-400"><span>Low impact</span><span>Critical impact</span></div>
                          </div>
                          <span className="rounded-lg bg-white/80 px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em]">{impactLabel(impact.level)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            <section data-ged-pdf-page id="focus-plan" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.focus_plan}
                eyebrow="Your 30-Day Focus Plan"
                title="Your first month, week by week"
                body="Concrete actions mapped across four weeks to start resolving your primary bottleneck immediately."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {diagnostic.action_plan.map((step) => (
                  <article key={step.week} className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-white">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-emerald-300">{step.week}</p>
                    <h3 className="mt-3 text-lg font-extrabold">{step.title}</h3>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                      {step.actions.map((action) => (
                        <li key={action} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section data-ged-pdf-page id="executive-summary" className="rounded-3xl border border-white/10 bg-[#0c1d1a] p-5 shadow-2xl shadow-black/20 md:p-7">
              <SectionMarker
                icon={SECTION_ICON_PATHS.executive_summary}
                eyebrow="Your One-Page Executive Summary"
                title="Your full diagnostic at a glance"
                body="Everything in one view — share with your leadership team or revisit before your strategy session."
                dark
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ContentCard title="Growth Engine Profile">
                  <p className="text-lg font-extrabold text-slate-950">{canonicalProfile}</p>
                  <p className="mt-2">Personality: {primaryPersonalityLabel}. Mindset stage: {primaryMindsetLabel}.</p>
                </ContentCard>
                <ContentCard title="Primary Bottleneck">
                  <p className="text-lg font-extrabold text-slate-950">{diagnostic.primary_bottleneck.label}</p>
                  <p className="mt-2">{diagnostic.urgency.window}</p>
                </ContentCard>
                <ContentCard title="Engine Scorecard">
                  <p>Growth Engine: <span className="font-bold text-slate-950">{diagnostic.scores.growth_engine}%</span></p>
                  <p>Sales Engine: <span className="font-bold text-slate-950">{diagnostic.scores.sales_engine}%</span></p>
                  <p>Scale readiness: <span className="font-bold text-slate-950">{diagnostic.scores.scale_readiness}%</span></p>
                </ContentCard>
                <ContentCard title="Business Context">
                  <p>{diagnostic.business_stage.label}</p>
                  <p className="mt-2">Constraint: {diagnostic.core_constraint.label}</p>
                </ContentCard>
                <div id="growth-roadmap" className="scroll-mt-6">
                  <ContentCard title="Next 90 Days">
                    {strategicPriorities.length ? (
                      <ul className="space-y-2">
                        {strategicPriorities.map((priority) => (
                          <li key={priority} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-700" />{priority}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Protect the new operating rhythm, strengthen ownership and remove the next founder dependency once the first change is working.</p>
                    )}
                  </ContentCard>
                </div>
                <ContentCard title="Recommended Next Step">
                  <p className="font-bold text-slate-950">{diagnostic.recommended_next_step.title}</p>
                  <p className="mt-2">{diagnostic.recommended_next_step.summary}</p>
                </ContentCard>
              </div>
            </section>

            <section data-ged-pdf-page id="recommended-next-steps" className="scroll-mt-6 overflow-hidden rounded-3xl border border-cyan-300/35 bg-gradient-to-br from-[#45e0d1] via-[#b3f5ed] to-[#d9f99d] p-7 shadow-2xl shadow-black/20 md:p-10">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-700">Your Recommended Next Step</p>
              <h2 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-950 md:text-5xl">Turn the diagnostic into a live execution plan.</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
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
            </section>
          </div>
        </div>

        <footer className="py-7 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ProfileTest.ai · Growth Engine Diagnostic · Confidential Strategic Client Report
        </footer>
      </main>
    </div>
  );
}
