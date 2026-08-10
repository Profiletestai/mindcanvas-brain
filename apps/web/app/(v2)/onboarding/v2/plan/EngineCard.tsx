"use client";

import type { Engine, EngineKey } from "../_lib/engines";

// Figma "Draft 3 Revised onboarding" screen 3: the unselected card is dark on
// the page background; selecting inverts it to a light card with a blue border.
const BADGE_ENGINES: Partial<Record<EngineKey, string>> = {
  sales: "MOST POPULAR",
};

export function EngineCard({
  engine,
  selected,
  onToggle,
}: {
  engine: Engine;
  selected: boolean;
  onToggle: () => void;
}) {
  // MPS has no separate long-form name yet, so avoid "MPS — MPS".
  const productLabel =
    engine.productName === engine.productCode
      ? engine.productCode
      : `${engine.productName} — ${engine.productCode}`;

  const badge = BADGE_ENGINES[engine.key];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={`flex w-full cursor-pointer flex-col rounded-[10px] border p-6 text-left transition ${
        selected ? "" : "hover:border-white/25"
      }`}
      style={{
        background: selected ? "rgb(244,247,251)" : "rgb(15,32,53)",
        borderColor: selected ? "rgb(68,136,214)" : "rgba(255,255,255,0.09)",
      }}
    >
      <span className="flex h-[19px] w-full items-center justify-between">
        {/* Radio, not a checkbox: ⌀18.7 ring, 1.1px stroke, ⌀9.28 inner dot. */}
        <span
          className="flex h-[18.7px] w-[18.7px] shrink-0 items-center justify-center rounded-full"
          style={{
            border: `1.1px solid ${selected ? "rgb(68,136,214)" : "rgb(74,91,117)"}`,
          }}
        >
          {selected && (
            <span
              className="block h-[9.28px] w-[9.28px] rounded-full"
              style={{ background: "rgb(68,136,214)" }}
            />
          )}
        </span>

        {badge && (
          <span
            className="rounded-full px-[10px] py-[3px] text-[10px] font-bold uppercase leading-[12px] tracking-[0.2px]"
            style={{ background: "rgb(232,247,238)", color: "rgb(22,101,52)" }}
          >
            {badge}
          </span>
        )}
      </span>

      <span
        className="mt-[11px] block text-[15.4px] font-semibold leading-[19px]"
        style={{ color: selected ? "rgb(22,35,58)" : "rgb(234,242,251)" }}
      >
        {engine.name}
      </span>

      <span
        className="mt-[4px] block text-[12.65px] font-semibold leading-[15px]"
        style={{
          color: selected ? "rgb(90,107,133)" : "rgba(230,240,250,0.62)",
        }}
      >
        Product: {productLabel}
      </span>

      <span
        className="mt-[11px] block text-[12.65px] leading-[20.4px]"
        style={{
          color: selected ? "rgb(90,107,133)" : "rgba(210,225,245,0.38)",
        }}
      >
        {engine.description}
      </span>
    </button>
  );
}
