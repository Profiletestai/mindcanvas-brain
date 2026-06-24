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
   * Optional percentage inputs for future matrix shading.
   */
  personalityPercentages?: Partial<Record<PersonalityKey, number>>;
  mindsetPercentages?: Partial<Record<MindsetKey, number>>;

  /**
   * Optional GED-specific copy overrides.
   * Existing QSC callers remain unchanged when these are not supplied.
   */
  eyebrow?: string;
  title?: string;
  description?: string;
};

const PERSONALITY_COLUMNS: {
  key: PersonalityKey;
  label: string;
  code: string;
}[] = [
  { key: "FIRE", label: "Fire", code: "A" },
  { key: "FLOW", label: "Flow", code: "B" },
  { key: "FORM", label: "Form", code: "C" },
  { key: "FIELD", label: "Field", code: "D" },
];

/**
 * Keep this order exactly as it currently appears in the existing QSC matrix:
 * Origin at the top, Quantum at the bottom.
 */
const MINDSET_ROWS: {
  key: MindsetKey;
  label: string;
  level: number;
}[] = [
  { key: "ORIGIN", level: 1, label: "Origin" },
  { key: "MOMENTUM", level: 2, label: "Momentum" },
  { key: "VECTOR", level: 3, label: "Vector" },
  { key: "ORBIT", level: 4, label: "Orbit" },
  { key: "QUANTUM", level: 5, label: "Quantum" },
];

const CELL_STYLES: Record<CellState, string> = {
  inactive:
    "bg-slate-900/40 border-slate-700/60 text-slate-400/80 hover:border-slate-500/80",
  support:
    "bg-sky-900/40 border-sky-700 text-sky-100/90 hover:border-sky-400/80",
  secondary:
    "bg-sky-700/90 border-sky-400 text-slate-50 shadow shadow-sky-900/60",
  primary:
    "bg-sky-400 text-slate-950 font-semibold shadow-lg shadow-sky-900/70 border-sky-100/90",
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

export function QscMatrix(props: QscMatrixProps) {
  const matrixEyebrow = props.eyebrow ?? "Quantum Source Code";
  const matrixTitle = props.title ?? "Buyer Persona Matrix";
  const matrixDescription =
    props.description ??
    "This grid maps your Buyer Frequency Type from left to right against your Buyer Mindset Level from top to bottom. Your combined profile sits at the intersection.";

  return (
    <section
      aria-labelledby="qsc-matrix-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-black/50 md:p-7"
    >
      <header className="mb-5 flex flex-col gap-2 md:mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300/80">
          {matrixEyebrow}
        </p>

        <h2
          id="qsc-matrix-heading"
          className="text-xl font-semibold text-slate-50 md:text-2xl"
        >
          {matrixTitle}
        </h2>

        <p className="max-w-2xl text-xs text-slate-300 md:text-sm">
          {matrixDescription}
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
                      const stateClass = CELL_STYLES[state];
                      const personaLabel = `${col.label} ${row.label}`;

                      /**
                       * A = Fire, B = Flow, C = Form, D = Field.
                       * Do not use col.key[0], because Fire, Flow and Form
                       * would all incorrectly resolve to F.
                       */
                      const code = `${col.code}${row.level}`;

                      return (
                        <div
                          key={`${col.key}_${row.key}`}
                          aria-label={personaLabel}
                          className={[
                            "flex min-h-[64px] flex-col items-start justify-between rounded-xl border px-2 py-3 text-xs transition-colors duration-150 ease-out md:min-h-[80px] md:px-3 md:py-4 md:text-sm",
                            stateClass,
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
        </div>
      </div>
    </section>
  );
}
