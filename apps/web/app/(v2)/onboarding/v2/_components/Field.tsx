import * as React from "react";

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, required, hint, error, children, className = "" }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm text-white/80">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
        {!required && <span className="text-white/40 text-xs ml-1">(optional)</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-white/50">{hint}</span>}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/40 px-3 py-2.5 outline-none focus:border-[var(--brand-blue-light)] focus:ring-2 focus:ring-[var(--brand-blue-light)]/30 transition";

export const selectClass = inputClass + " appearance-none";
