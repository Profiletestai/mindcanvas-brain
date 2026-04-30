"use client";

import { usePathname } from "next/navigation";
import { PATH_TO_STEP } from "../_lib/progress";

const STEPS: { num: number; label: string }[] = [
  { num: 1, label: "Account" },
  { num: 2, label: "Verify" },
  { num: 3, label: "Organisation" },
  { num: 4, label: "Contact" },
  { num: 5, label: "Plan" },
  { num: 6, label: "Branding" },
];

export function Stepper() {
  const pathname = usePathname();
  const stepValue = PATH_TO_STEP[pathname];

  if (stepValue === "complete" || stepValue === undefined) return null;

  const current = stepValue;

  return (
    <div className="w-full mb-6 px-6 sm:px-8">
      <ol className="flex items-stretch">
        {STEPS.map((s, i) => {
          const done = s.num < current;
          const active = s.num === current;
          const isFirst = i === 0;
          const isLast = i === STEPS.length - 1;
          const leftFilled = s.num <= current && !isFirst;
          const rightFilled = s.num < current && !isLast;
          return (
            <li key={s.num} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="flex items-center w-full">
                <div
                  className={`h-px flex-1 ${
                    isFirst
                      ? "invisible"
                      : leftFilled
                      ? "bg-emerald-500/70"
                      : "bg-white/15"
                  }`}
                  aria-hidden
                />
                <div
                  className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-sm font-semibold transition ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                      ? "bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.2)]"
                      : "bg-white/10 text-white/60 border border-white/15"
                  }`}
                >
                  {done ? "✓" : s.num}
                </div>
                <div
                  className={`h-px flex-1 ${
                    isLast
                      ? "invisible"
                      : rightFilled
                      ? "bg-emerald-500/70"
                      : "bg-white/15"
                  }`}
                  aria-hidden
                />
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide truncate w-full text-center ${
                  active ? "text-white" : "text-white/50"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
