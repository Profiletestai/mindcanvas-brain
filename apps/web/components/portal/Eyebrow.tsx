// apps/web/components/portal/Eyebrow.tsx
// Uppercase muted label above a heading or section.
import type { ReactNode } from "react";

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[10px] font-bold uppercase tracking-[0.12em] text-white/35 ${className}`}
    >
      {children}
    </div>
  );
}
