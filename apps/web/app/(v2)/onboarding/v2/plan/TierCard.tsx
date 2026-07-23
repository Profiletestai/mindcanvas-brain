"use client";

import type { PlanCardContent } from "@/app/(v2)/choose-plan/planContent";
import { TIER_DISABLED_REASON } from "../_lib/engines";

export type TierCardData = PlanCardContent & { amountCents: number };

// Four states from the Figma variants of screen 3:
//   default      — dark card, no border, "Select <plan>" button
//   recommended  — dark card, blue border, RECOMMENDED pill
//   selected     — white card, blue border, "Selected <plan>" button + tick
//   unavailable  — whole card faded to 40%, no button, red notice (below minimum)
const SURFACE_DEFAULT = "rgb(15,32,53)";
const SURFACE_SELECTED = "rgb(255,255,255)";
const BORDER_ACTIVE = "rgb(68,136,214)";
// Light hairline in both states — Figma uses the same stroke on the dark and
// the selected card.
const DIVIDER = "rgb(232,237,243)";
const TEXT_MUTED = "rgb(138,151,171)";
const TEXT_FEATURE = "rgb(90,107,133)";
const TEXT_EXCLUDED = "rgb(183,191,201)";
const ICON_EXCLUDED = "rgb(199,205,214)";
const TEXT_ON_LIGHT = "rgb(22,35,58)";

function formatUsd(cents: number): string {
  const major = cents / 100;
  return `$${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

export function TierCard({
  card,
  selected,
  recommended,
  disabled,
  onSelect,
}: {
  card: TierCardData;
  selected: boolean;
  recommended: boolean;
  /** Tier below the minimum for the engine count — visible but not selectable. */
  disabled: boolean;
  onSelect: () => void;
}) {
  const showBadge = recommended && !disabled;
  const bordered = (recommended || selected) && !disabled;

  return (
    <div
      className="relative flex flex-col rounded-[10px] border px-[21px] pb-[21px] pt-[21px]"
      style={{
        background: selected ? SURFACE_SELECTED : SURFACE_DEFAULT,
        borderColor: bordered ? BORDER_ACTIVE : "transparent",
        // Figma fades the whole unavailable card rather than restyling it.
        opacity: disabled ? 0.4 : 1,
      }}
      aria-disabled={disabled}
    >
      {selected && (
        <span
          className="absolute right-[18px] top-[19px] flex h-[23px] w-[23px] items-center justify-center rounded-full"
          style={{ background: BORDER_ACTIVE }}
          aria-hidden
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </span>
      )}

      {showBadge && (
        <span
          className="absolute -top-[9px] left-[20px] rounded-full px-[10px] py-[2px] text-[9.35px] font-bold uppercase leading-[14px] tracking-[0.2px] text-white"
          style={{ background: BORDER_ACTIVE }}
        >
          Recommended
        </span>
      )}

      <div
        className="text-[11px] font-bold uppercase leading-[13px] tracking-[0.4px]"
        style={{ color: TEXT_MUTED }}
      >
        {card.name}
      </div>

      <div className="mt-[10px] flex items-baseline gap-[3px]">
        <span
          className="text-[24.2px] font-bold leading-[29px]"
          style={{ color: selected ? TEXT_ON_LIGHT : "#fff" }}
        >
          {formatUsd(card.amountCents)}
        </span>
        <span className="text-[13.2px] leading-[16px]" style={{ color: TEXT_MUTED }}>
          /month
        </span>
      </div>

      <p className="mt-[6px] text-[12.1px] leading-[15px]" style={{ color: TEXT_MUTED }}>
        {card.tagline}
      </p>

      <div className="mt-[14px] mb-[10px] h-px" style={{ background: DIVIDER }} />

      <ul className="flex-1 space-y-[6px]">
        {card.features.map((f) => (
          <li key={f.label} className="flex items-start gap-[7px]">
            <span
              aria-hidden
              className="mt-[1px] text-[12.1px] leading-[19px]"
              style={{ color: f.included ? "rgb(22,163,74)" : ICON_EXCLUDED }}
            >
              {f.included ? "✓" : "✕"}
            </span>
            <span
              className="text-[12.1px] leading-[19px]"
              style={{ color: f.included ? TEXT_FEATURE : TEXT_EXCLUDED }}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {disabled ? (
        <p
          className="mt-[18px] rounded-[6px] px-[11px] py-[9px] text-[11.5px] leading-[17.5px]"
          style={{ background: "rgb(253,236,236)", color: "rgb(220,38,38)" }}
        >
          {TIER_DISABLED_REASON}
        </p>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="mt-[18px] flex h-[37px] w-full cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border text-[12.5px] font-medium leading-[15px] text-white transition hover:brightness-125"
          style={{ background: "rgb(23,46,74)", borderColor: "rgb(19,38,64)" }}
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          )}
          {selected ? `Selected ${card.name}` : `Select ${card.name}`}
        </button>
      )}
    </div>
  );
}
