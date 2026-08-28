// apps/web/components/portal/Badge.tsx
// Small pill badge for statuses and roles (Active / Draft / Owner / Admin …).
import type { ReactNode } from "react";

export type BadgeTone =
  | "emerald"
  | "amber"
  | "sky"
  | "teal"
  | "violet"
  | "neutral";

const TONES: Record<BadgeTone, string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  teal: "border-teal-500/40 bg-teal-500/10 text-teal-400",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  neutral: "border-white/[0.12] bg-white/[0.04] text-white/45",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
