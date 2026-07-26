"use client";

import { usePathname } from "next/navigation";
import {
  PATH_TO_STEP,
  STEP_TO_PATH,
  TOTAL_STEPS,
  displayStep,
} from "../_lib/progress";

// The closing screen is a celebratory full-bleed page in the design — it
// carries no progress band.
const HIDDEN_ON = new Set([
  STEP_TO_PATH[7],
  STEP_TO_PATH[8],
  STEP_TO_PATH[9],
  STEP_TO_PATH[10],
]);

export function Stepper() {
  const pathname = usePathname();
  const stepValue = PATH_TO_STEP[pathname];
  if (stepValue === undefined || HIDDEN_ON.has(pathname)) return null;

  const current = displayStep(stepValue);
  const progressPct = Math.max(
    0,
    Math.min(100, (current / TOTAL_STEPS) * 100)
  );

  return (
    <div className="w-full h-[62px]" style={{ background: "rgb(239,245,254)" }}>
      <div className="h-full mx-auto flex items-center gap-4 px-7 max-w-[1440px]">
        <span
          className="whitespace-nowrap font-bold"
          style={{
            fontSize: "11px",
            lineHeight: "16px",
            letterSpacing: "1px",
            color: "rgb(90,122,158)",
          }}
        >
          Onboarding Step: {current}/{TOTAL_STEPS}
        </span>
        <div
          className="relative flex-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgb(208,224,240)" }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${progressPct}%`,
              background:
                "linear-gradient(90deg, rgb(37,99,200) 0%, rgb(74,144,217) 100%)",
            }}
          />
        </div>
        <ol className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
            const filled = n <= current;
            return (
              <li
                key={n}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white"
                style={{
                  background: filled ? "rgb(37,99,200)" : "rgb(208,224,240)",
                  color: filled ? "#fff" : "rgb(90,122,158)",
                  boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.08)",
                }}
                aria-current={n === current ? "step" : undefined}
              >
                {n}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
