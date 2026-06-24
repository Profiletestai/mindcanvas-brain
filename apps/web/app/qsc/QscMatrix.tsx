//apps/web/app/qsc/QscMatrix.tsx
"use client";

import React from "react";

/**
 * Horizontal axis – Buyer Frequency Types
 */
export type PersonalityKey = "FIRE" | "FLOW" | "FORM" | "FIELD";

/**
 * Vertical axis – Buyer Mindset Levels
 */
export type MindsetKey =
  | "ORIGIN"
  | "MOMENTUM"
  | "VECTOR"
  | "ORBIT"
  | "QUANTUM";

type CellState = "inactive" | "primary" | "secondary" | "support";

export type QscMatrixProps = {
  primaryPersonality?: PersonalityKey | null;
  secondaryPersonality?: PersonalityKey | null;
  primaryMindset?: MindsetKey | null;
  secondaryMindset?: MindsetKey | null;

  /**
   * Reserved for future percentage-based matrix shading.
   */
  personalityPercentages?: Partial<Record<PersonalityKey, number>>;
  mindsetPercentages?: Partial<Record<MindsetKey, number>>;

  /**
   * Optional copy overrides for GED and other report families.
   * Existing QSC report callers can omit these safely.
   */
  eyebrow?: string;
  title?: string;
  description?: string;
  showLegend?: boolean;

  /**
   * Keep the existing QSC rendering as the default. GED uses a white,
   * designer-aligned matrix canvas without changing the scoring model.
   */
  variant?: "default" | "ged";
};

type PersonalityColumn = {
  key: PersonalityKey;
  label: string;
  code: "A" | "B" | "C" | "D";
};

const PERSONALITY_COLUMNS: PersonalityColumn[] = [
  { key: "FIRE", label: "Fire", code: "A" },
  { key: "FLOW", label: "Flow", code: "B" },
  { key: "FORM", label: "Form", code: "C" },
  { key: "FIELD", label: "Field", code: "D" },
];

type MindsetRow = {
  key: MindsetKey;
  label: string;
  level: number;
};

/**
 * Keep the existing MindCanvas orientation unchanged:
 * Origin first, then Momentum, Vector, Orbit and Quantum.
 */
const MINDSET_ROWS: MindsetRow[] = [
  { key: "ORIGIN", level: 1, label: "Origin" },
  { key: "MOMENTUM", level: 2, label: "Momentum" },
  { key: "VECTOR", level: 3, label: "Vector" },
  { key: "ORBIT", level: 4, label: "Orbit" },
  { key: "QUANTUM", level: 5, label: "Quantum" },
];

const DEFAULT_CELL_STYLES: Record<CellState, string> = {
  inactive:
    "bg-slate-900/40 border-slate-700/60 text-slate-400/80 hover:border-slate-500/80",
  support:
    "bg-sky-900/40 border-sky-700 text-sky-100/90 hover:border-sky-400/80",
  secondary:
    "bg-sky-700/90 border-sky-400 text-slate-50 shadow shadow-sky-900/60",
  primary:
    "bg-sky-400 text-slate-950 font-semibold shadow-lg shadow-sky-900/70 border-sky-100/90",
};

const GED_CELL_STYLES: Record<CellState, string> = {
  inactive:
    "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300",
  support:
    "border-emerald-200 bg-emerald-50 text-slate-800 hover:border-emerald-300",
  secondary:
    "border-emerald-300 bg-emerald-100 text-slate-900 shadow-sm",
  primary:
    "border-emerald-400 bg-[#2FE6AC] text-[#0C1D1A] shadow-sm",
};

function getCellState(
  row: MindsetKey,
  col: PersonalityKey,
  props: QscMatrixProps
): CellState {
  const {
    primaryPersonality,
    secondaryPersonality,
    primaryMindset,
    secondaryMindset,
  } = props;

  const isPrimary =
    primaryPersonality === col && primaryMindset === row;

  if (isPrimary) return "primary";

  const isSecondary =
    (secondaryPersonality === col && primaryMindset === row) ||
    (primaryPersonality === col && secondaryMindset === row) ||
    (secondaryPersonality === col && secondaryMindset === row);

  if (isSecondary) return "secondary";

  const isSupport =
    primaryPersonality === col ||
    primaryMindset === row ||
    secondaryPersonality === col ||
    secondaryMindset === row;

  if (isSupport) return "support";

  return "inactive";
}

function MatrixAsset({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return <img src={src} alt={alt} className={className || ""} />;
}

function DefaultMatrix(props: QscMatrixProps) {
  const {
    eyebrow = "Quantum Source Code",
    title = "Buyer Persona Matrix",
    description = "This grid maps your Buyer Frequency Type from left to right against your Buyer Mindset Level. Your combined profile sits at the intersection.",
    showLegend = true,
  } = props;

  return (
    <section
      aria-labelledby="qsc-matrix-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-black/50 md:p-7"
    >
      <header className="mb-5 flex flex-col gap-2 md:mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300/80">
          {eyebrow}
        </p>

        <h2
          id="qsc-matrix-heading"
          className="text-xl font-semibold text-slate-50 md:text-2xl"
        >
          {title}
        </h2>

        <p className="max-w-2xl text-xs text-slate-300 md:text-sm">
          {description}
        </p>
      </header>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-top">
          <div className="pl-24 pr-4 md:pl-28 md:pr-6">
            <div className="grid grid-cols-4 gap-3 md:gap-4">
              {PERSONALITY_COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className="text-center text-xs text-slate-200 md:text-sm"
                >
                  <div className="font-medium tracking-wide">
                    {col.label.toUpperCase()}
                  </div>

                  <div className="mt-0.5 text-[0.7rem] text-slate-400 md:text-xs">
                    Frequency {col.code}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3 md:space-y-4">
            {MINDSET_ROWS.map((row) => (
              <div
                key={row.key}
                className="flex items-stretch gap-3 md:gap-4"
              >
                <div className="w-24 shrink-0 pr-2 text-right md:w-28 md:pr-3">
                  <div className="text-xs font-medium text-slate-100 md:text-sm">
                    {row.label.toUpperCase()}
                  </div>

                  <div className="text-[0.7rem] text-slate-400 md:text-xs">
                    Mindset {row.level}
                  </div>
                </div>

                <div className="flex-1 pr-4 md:pr-6">
                  <div className="grid grid-cols-4 gap-3 md:gap-4">
                    {PERSONALITY_COLUMNS.map((col) => {
                      const state = getCellState(row.key, col.key, props);
                      const personaLabel = `${col.label} ${row.label}`;
                      const code = `${col.code}${row.level}`;

                      return (
                        <div
                          key={`${col.key}_${row.key}`}
                          aria-label={personaLabel}
                          className={[
                            "flex min-h-[64px] flex-col items-start justify-between rounded-xl border px-2 py-3 text-xs transition-colors duration-150 ease-out md:min-h-[80px] md:px-3 md:py-4 md:text-sm",
                            DEFAULT_CELL_STYLES[state],
                          ].join(" ")}
                        >
                          <div className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-200/80">
                            {personaLabel}
                          </div>

                          <div className="mt-1 text-[0.7rem] text-slate-950/70 dark:text-slate-100/90 md:text-xs">
                            Code:{" "}
                            <span className="font-mono tracking-wide">
                              {code}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showLegend ? (
            <div className="mt-6 flex flex-wrap gap-3 text-[0.7rem] text-slate-400 md:text-xs">
              <div className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-5 rounded bg-sky-400" />
                <span>Primary combined profile</span>
              </div>

              <div className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-5 rounded bg-sky-700" />
                <span>Secondary profile / supporting mode</span>
              </div>

              <div className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-5 rounded bg-sky-900/60" />
                <span>Related frequencies or mindsets</span>
              </div>

              <div className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-5 rounded border border-slate-700/70 bg-slate-900/70" />
                <span>Other personas</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function GedMatrix(props: QscMatrixProps) {
  const {
    eyebrow = "Quantum Source Code",
    title = "Quantum Profile Matrix",
    description = "This grid maps your Buyer Frequency Type (left to right) against your Buyer Mindset Level (bottom to top). Your combined profile sits at the intersection.",
    showLegend = true,
  } = props;

  const assetBase = "/ged/report-icons/quantum-profile-matrix";

  return (
    <section
      aria-labelledby="qsc-matrix-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-[#0C1D1A] shadow-[0_10px_24px_rgba(0,0,0,0.14)] md:p-7"
    >
      <header className="max-w-2xl">
        <p className="text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.22em] text-[#0C1D1A]">
          {eyebrow}
        </p>
        <h2
          id="qsc-matrix-heading"
          className="mt-2 text-2xl font-semibold leading-8 text-[#34D399]"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-5 text-[#0C1D1A]">
          {description}
        </p>
      </header>

      <div className="mt-7 overflow-x-auto pb-1">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[118px_repeat(4,minmax(0,1fr))] gap-2.5">
            <div />
            {PERSONALITY_COLUMNS.map((col) => (
              <div key={col.key} className="flex flex-col items-center text-center">
                <MatrixAsset
                  src={`${assetBase}/${col.key.toLowerCase()}.png`}
                  alt=""
                  className="h-5 w-5 object-contain"
                />
                <span className="mt-1 text-sm font-semibold uppercase tracking-wide text-[#0C1D1A]">
                  {col.label}
                </span>
                <span className="text-[0.68rem] text-slate-500">
                  Frequency {col.code}
                </span>
              </div>
            ))}

            {MINDSET_ROWS.map((row) => (
              <React.Fragment key={row.key}>
                <div className="flex items-center gap-2 pr-1">
                  <MatrixAsset
                    src={`${assetBase}/${row.key.toLowerCase()}.png`}
                    alt=""
                    className="h-5 w-5 shrink-0 object-contain"
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#0C1D1A]">
                      {row.label}
                    </p>
                    <p className="text-[0.68rem] text-slate-500">Mindset {row.level}</p>
                  </div>
                </div>

                {PERSONALITY_COLUMNS.map((col) => {
                  const state = getCellState(row.key, col.key, props);
                  const personaLabel = `${col.label} ${row.label}`;
                  const code = `${col.code}${row.level}`;

                  return (
                    <div
                      key={`${col.key}_${row.key}`}
                      aria-label={personaLabel}
                      className={[
                        "flex min-h-[75px] flex-col justify-center rounded-lg border px-3 py-2.5 transition-colors duration-150 ease-out",
                        GED_CELL_STYLES[state],
                      ].join(" ")}
                    >
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.15em]">
                        {personaLabel}
                      </p>
                      <p className="mt-1 text-xs opacity-75">Code: {code}</p>
                      {state === "primary" ? (
                        <p className="mt-1 text-[0.6rem] font-semibold opacity-85">
                          Primary combined profile
                        </p>
                      ) : state === "secondary" ? (
                        <p className="mt-1 text-[0.6rem] font-semibold opacity-85">
                          Secondary / supporting profile
                        </p>
                      ) : state === "support" ? (
                        <p className="mt-1 text-[0.6rem] opacity-80">
                          Related frequency or mindset
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-3 text-xs text-[#0C1D1A]">
          <div className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded bg-[#2FE6AC]" />
            <span>Primary combined profile</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded bg-emerald-100" />
            <span>Secondary profile / supporting mode</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded bg-emerald-50 ring-1 ring-emerald-200" />
            <span>Related frequencies or mindsets</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded border border-slate-300 bg-slate-50" />
            <span>Other personas</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function QscMatrix(props: QscMatrixProps) {
  if (props.variant === "ged") {
    return <GedMatrix {...props} />;
  }

  return <DefaultMatrix {...props} />;
}
