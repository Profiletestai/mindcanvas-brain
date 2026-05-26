"use client";

// Presentational graphs for the org-portal taker profile page.
// Mirrors the graphs the respondent's own report renders, fed already-computed
// numbers from the server component. Kept self-contained (no shared chart deps).

import React from "react";
import {
  QscMatrix,
  type PersonalityKey,
  type MindsetKey,
} from "@/app/qsc/QscMatrix";

/* ------------------------------- helpers ------------------------------- */

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

// LegacyOrgReportClient.tsx:2211
function profileCodeToShort(code: string) {
  const m = String(code || "").match(/(\d+)/);
  return m ? `P${m[1]}` : code;
}

// qsc/[token]/leader/page.tsx:109 — ×100 when stored as a 0–1 fraction.
function normalisePercent(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  if (raw > 0 && raw <= 1.5) return Math.min(100, Math.max(0, raw * 100));
  return Math.min(100, Math.max(0, raw));
}

/* =========================== Standard graphs =========================== */

type FreqDatum = { code: "A" | "B" | "C" | "D"; name: string; pct: number };
type ProfileLabel = { code: string; name: string };

const FREQ_COLORS: Record<FreqDatum["code"], string> = {
  A: "bg-red-500",
  B: "bg-amber-500",
  C: "bg-emerald-500",
  D: "bg-blue-500",
};

type FrequenciesCardProps = {
  freq: FreqDatum[];
};

function FrequenciesCard({ freq }: FrequenciesCardProps) {
  const labels = freq.length
    ? freq
    : [
        { code: "A" as const, name: "Innovation", pct: 0 },
        { code: "B" as const, name: "Influence", pct: 0 },
        { code: "C" as const, name: "Implementation", pct: 0 },
        { code: "D" as const, name: "Insight", pct: 0 },
      ];

  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Frequencies</h3>
        <p className="mt-1 text-sm text-slate-600">
          The behavioural energy used most often.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {labels.map((item) => {
          const pct = clamp(item.pct);
          return (
            <div key={item.code} className="flex flex-col items-center gap-2">
              <div className="text-xs font-bold text-slate-600">{pct}%</div>
              <div className="relative h-56 w-full max-w-[78px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div
                  className={`absolute bottom-0 left-0 right-0 ${FREQ_COLORS[item.code]}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="text-sm font-bold text-slate-900">{item.code}</div>
              <div className="text-center text-[11px] leading-tight text-slate-600">
                {item.name} ({item.code})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PersonalityMapCardProps = {
  profileLabels: ProfileLabel[];
  profilePct: Record<string, number>;
};

function PersonalityMapCard({
  profileLabels,
  profilePct,
}: PersonalityMapCardProps) {
  const labels = profileLabels ?? [];
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 230;
  const max = 50;

  function point(i: number, valuePct: number) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = (radius * clamp(valuePct, 0, max)) / max;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  function axisPoint(i: number, multiplier = 1) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = radius * multiplier;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  const points = labels.map((label, i) =>
    point(i, profilePct?.[label.code] || 0),
  );
  const path =
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      )
      .join(" ") + " Z";

  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="text-base font-semibold">Personality Map</h3>
      <p className="mt-1 text-sm text-slate-600">
        Higher values show patterns used more often.
      </p>
      <div className="mt-4 flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {labels.length ? (
          <svg
            viewBox="-120 -80 880 800"
            className="h-auto w-full max-w-[760px] overflow-visible"
          >
            {[10, 20, 30, 40, 50].map((ring) => (
              <polygon
                key={ring}
                points={labels
                  .map((_, i) => point(i, ring))
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="rgba(15,23,42,0.12)"
              />
            ))}
            {labels.map((label, i) => {
              const p = axisPoint(i, 1);
              const t = axisPoint(i, 1.24);
              const anchor =
                t.x > cx + 20 ? "start" : t.x < cx - 20 ? "end" : "middle";
              const labelX =
                anchor === "start" ? t.x + 8 : anchor === "end" ? t.x - 8 : t.x;
              return (
                <g key={label.code}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={p.x}
                    y2={p.y}
                    stroke="rgba(15,23,42,0.12)"
                  />
                  <text
                    x={labelX}
                    y={t.y}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="rgba(15,23,42,0.62)"
                  >
                    {`${profileCodeToShort(label.code)}: ${label.name}`}
                  </text>
                </g>
              );
            })}
            <path
              d={path}
              fill="rgba(64,146,197,0.18)"
              stroke="#4092C5"
              strokeWidth="3"
            />
            {labels.map((label, i) => {
              const pct = profilePct?.[label.code] || 0;
              const p = point(i, pct);
              const t = axisPoint(i, 0.75);
              return (
                <g key={`${label.code}-point`}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#084595" />
                  {pct > 0 ? (
                    <text
                      x={t.x}
                      y={t.y}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#334155"
                    >
                      {pct}%
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : (
          <p className="py-10 text-sm text-slate-500">
            Profile-level scores aren&rsquo;t available for this result (only
            frequencies were stored).
          </p>
        )}
      </div>
    </div>
  );
}

export type StandardResultGraphsProps = {
  freq: FreqDatum[];
  profileLabels: ProfileLabel[];
  profilePct: Record<string, number>;
};

export function StandardResultGraphs({
  freq,
  profileLabels,
  profilePct,
}: StandardResultGraphsProps) {
  return (
    <div className="space-y-4 pt-4">
      <FrequenciesCard freq={freq} />
      <PersonalityMapCard
        profileLabels={profileLabels}
        profilePct={profilePct}
      />
    </div>
  );
}

/* ============================== QSC graphs ============================== */

const FREQUENCY_COLORS: Record<PersonalityKey, string> = {
  FIRE: "#f97316",
  FLOW: "#0ea5e9",
  FORM: "#22c55e",
  FIELD: "#a855f7",
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

const MINDSET_ORDER: MindsetKey[] = [
  "ORIGIN",
  "MOMENTUM",
  "VECTOR",
  "ORBIT",
  "QUANTUM",
];

type QscVariant = "qsc-leader" | "qsc-entrepreneur" | "ged";

const LABELS: Record<
  QscVariant,
  {
    freqHeading: string;
    freqSubtitle: string;
    mindsetHeading: string;
    mindsetSubtitle: string;
    donutCenter: string; // "·"-separated → two lines in the donut hole
    matrixTitle: string;
  }
> = {
  "qsc-leader": {
    freqHeading: "Leadership Frequency Type",
    freqSubtitle:
      "Your energetic style across Fire, Flow, Form and Field in how you lead.",
    mindsetHeading: "Leadership Mindset Levels",
    mindsetSubtitle:
      "Where your focus and energy sit across the 5 growth stages.",
    donutCenter: "LEADERSHIP·FREQUENCY",
    matrixTitle: "Leadership Persona Matrix",
  },
  "qsc-entrepreneur": {
    freqHeading: "Buyer Frequency Type",
    freqSubtitle:
      "Your emotional & energetic style across Fire, Flow, Form and Field in the way you buy and build.",
    mindsetHeading: "Quantum Mindset Levels",
    mindsetSubtitle:
      "Where your focus and energy are distributed across the 5 Quantum growth stages.",
    donutCenter: "BUYER·FREQUENCY",
    matrixTitle: "Buyer Persona Matrix",
  },
  ged: {
    freqHeading: "Personality Layer",
    freqSubtitle:
      "Your emotional and energetic style across Fire, Flow, Form and Field.",
    mindsetHeading: "Mindset Layer",
    mindsetSubtitle:
      "Where your focus and energy are distributed across the 5 growth stages.",
    donutCenter: "PERSONALITY·LAYER",
    matrixTitle: "Growth Engine Matrix",
  },
};

type FrequencyDonutDatum = { key: PersonalityKey; label: string; value: number };

type FrequencyDonutProps = {
  data: FrequencyDonutDatum[];
  center: string;
};

function FrequencyDonut({
  data,
  center,
}: FrequencyDonutProps) {
  const total =
    data.reduce((sum, d) => sum + (isFinite(d.value) ? d.value : 0), 0) || 1;

  const radius = 60;
  const strokeWidth = 20;
  const c = 80;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const [line1, line2] = center.split("·");

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 md:h-48 md:w-48">
      <circle
        cx={c}
        cy={c}
        r={radius}
        stroke="rgba(15,23,42,0.12)"
        strokeWidth={strokeWidth}
        fill="transparent"
      />

      {data.map((d) => {
        const fraction = (isFinite(d.value) ? d.value : 0) / total;
        const dash = circumference * fraction;
        const dashArray = `${dash} ${circumference}`;
        const strokeDashoffset = offset;
        offset -= dash;

        return (
          <circle
            key={d.key}
            cx={c}
            cy={c}
            r={radius}
            stroke={FREQUENCY_COLORS[d.key]}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={dashArray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        );
      })}

      <circle cx={c} cy={c} r={radius - strokeWidth} fill="#ffffff" />

      <text x={c} y={c - 4} textAnchor="middle" fontSize="8" fill="#0f172a">
        {line1}
      </text>
      <text x={c} y={c + 9} textAnchor="middle" fontSize="8" fill="#0f172a">
        {line2}
      </text>
    </svg>
  );
}

export type QscResultGraphsProps = {
  variant: QscVariant;
  personality: Partial<Record<PersonalityKey, number>>;
  mindset: Partial<Record<MindsetKey, number>>;
  primaryPersonality?: PersonalityKey | null;
  secondaryPersonality?: PersonalityKey | null;
  primaryMindset?: MindsetKey | null;
  secondaryMindset?: MindsetKey | null;
};

export function QscResultGraphs({
  variant,
  personality,
  mindset,
  primaryPersonality,
  secondaryPersonality,
  primaryMindset,
  secondaryMindset,
}: QscResultGraphsProps) {
  const L = LABELS[variant];

  const personalityPerc: Record<PersonalityKey, number> = {
    FIRE: normalisePercent(personality.FIRE),
    FLOW: normalisePercent(personality.FLOW),
    FORM: normalisePercent(personality.FORM),
    FIELD: normalisePercent(personality.FIELD),
  };

  const mindsetPerc: Record<MindsetKey, number> = {
    ORIGIN: normalisePercent(mindset.ORIGIN),
    MOMENTUM: normalisePercent(mindset.MOMENTUM),
    VECTOR: normalisePercent(mindset.VECTOR),
    ORBIT: normalisePercent(mindset.ORBIT),
    QUANTUM: normalisePercent(mindset.QUANTUM),
  };

  const donutData: FrequencyDonutDatum[] = (
    ["FIRE", "FLOW", "FORM", "FIELD"] as PersonalityKey[]
  ).map((key) => ({
    key,
    label: PERSONALITY_LABELS[key],
    value: personalityPerc[key],
  }));

  return (
    <div className="space-y-4 pt-4">
      {/* Frequency Type donut */}
      <div className="rounded-xl border p-4 bg-white space-y-4">
        <div>
          <h3 className="text-base font-semibold">{L.freqHeading}</h3>
          <p className="mt-1 text-sm text-slate-600">{L.freqSubtitle}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center">
          <div className="flex justify-center">
            <FrequencyDonut data={donutData} center={L.donutCenter} />
          </div>
          <div className="space-y-3 text-sm">
            {donutData.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="inline-flex items-center gap-2 text-slate-700">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: FREQUENCY_COLORS[d.key] }}
                  />
                  {d.label}
                </span>
                <span className="tabular-nums text-slate-900">
                  {Math.round(d.value)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mindset Levels bars */}
      <div className="rounded-xl border p-4 bg-white space-y-4">
        <div>
          <h3 className="text-base font-semibold">{L.mindsetHeading}</h3>
          <p className="mt-1 text-sm text-slate-600">{L.mindsetSubtitle}</p>
        </div>
        <div className="space-y-2 pt-2 text-xs">
          {MINDSET_ORDER.map((key) => {
            const pct = Math.round(mindsetPerc[key]);
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-700">{MINDSET_LABELS[key]}</span>
                  <span className="tabular-nums text-slate-900">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Persona Matrix (dark card, mirrors the report) */}
      <QscMatrix
        title={L.matrixTitle}
        primaryPersonality={primaryPersonality ?? null}
        secondaryPersonality={secondaryPersonality ?? null}
        primaryMindset={primaryMindset ?? null}
        secondaryMindset={secondaryMindset ?? null}
        personalityPercentages={personalityPerc}
        mindsetPercentages={mindsetPerc}
      />
    </div>
  );
}
