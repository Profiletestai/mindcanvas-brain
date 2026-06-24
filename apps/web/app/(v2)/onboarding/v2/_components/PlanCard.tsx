"use client";

import type { PlanDef } from "../_lib/plans";

interface Props {
  plan: PlanDef;
  selected: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, selected, onSelect }: Props) {
  const disabled = plan.disabled;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-disabled={disabled}
      className={`relative text-left rounded-2xl border p-4 transition w-full ${
        disabled
          ? "border-white/5 bg-white/5 opacity-50 cursor-not-allowed"
          : selected
          ? "border-[var(--brand-blue-light)] bg-[var(--brand-blue)]/10 shadow-[0_0_0_4px_rgba(100,186,226,0.15)]"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      {disabled && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-md bg-white/20 text-white">
          Coming soon
        </span>
      )}
      {plan.highlight && !disabled && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-md bg-emerald-500 text-white">
          Popular
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <div className="text-base font-semibold text-white">{plan.name}</div>
        <div className="text-sm text-white/80">{plan.priceLabel}</div>
      </div>
      <div className="mt-1 text-xs text-white/60">{plan.tagline}</div>
      <ul className="mt-3 space-y-1">
        {plan.features.map((f) => (
          <li key={f} className="text-xs text-white/70 flex items-start gap-1.5">
            <span className="text-emerald-400 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}
