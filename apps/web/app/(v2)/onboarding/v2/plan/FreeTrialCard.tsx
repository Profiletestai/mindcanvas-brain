"use client";

const SURFACE_DEFAULT = "rgb(15,32,53)";
const SURFACE_SELECTED = "rgb(255,255,255)";
const BORDER_ACTIVE = "rgb(68,136,214)";
const DIVIDER = "rgb(232,237,243)";
const TEXT_MUTED = "rgb(138,151,171)";
const TEXT_FEATURE = "rgb(90,107,133)";
const TEXT_ON_LIGHT = "rgb(22,35,58)";

const FEATURES = [
  "Sales Engine — Growth Engine Diagnostic",
  "3 completed test submissions",
  "No expiry date",
  "Upgrade required after 3 submissions",
];

export function FreeTrialCard({
  selected,
  onSelect,
}: {
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="relative flex flex-col rounded-[10px] border px-[21px] pb-[21px] pt-[21px]"
      style={{
        background: selected
          ? SURFACE_SELECTED
          : SURFACE_DEFAULT,
        borderColor: BORDER_ACTIVE,
      }}
    >
      <span
        className="absolute -top-[9px] left-[20px] rounded-full px-[10px] py-[2px] text-[9.35px] font-bold uppercase leading-[14px] tracking-[0.2px] text-white"
        style={{ background: BORDER_ACTIVE }}
      >
        Try MindCanvas
      </span>

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

      <div
        className="text-[11px] font-bold uppercase leading-[13px] tracking-[0.4px]"
        style={{ color: TEXT_MUTED }}
      >
        Free Trial
      </div>

      <div className="mt-[10px] flex items-baseline gap-[3px]">
        <span
          className="text-[24.2px] font-bold leading-[29px]"
          style={{
            color: selected
              ? TEXT_ON_LIGHT
              : "#fff",
          }}
        >
          $0
        </span>

        <span
          className="text-[13.2px] leading-[16px]"
          style={{ color: TEXT_MUTED }}
        >
          to get started
        </span>
      </div>

      <p
        className="mt-[6px] text-[12.1px] leading-[15px]"
        style={{ color: TEXT_MUTED }}
      >
        Explore GED before choosing a paid plan.
      </p>

      <div
        className="mb-[10px] mt-[14px] h-px"
        style={{ background: DIVIDER }}
      />

      <ul className="flex-1 space-y-[6px]">
        {FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-[7px]"
          >
            <span
              aria-hidden
              className="mt-[1px] text-[12.1px] leading-[19px]"
              style={{ color: "rgb(22,163,74)" }}
            >
              ✓
            </span>

            <span
              className="text-[12.1px] leading-[19px]"
              style={{ color: TEXT_FEATURE }}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="mt-[18px] flex h-[37px] w-full cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border text-[12.5px] font-medium leading-[15px] text-white transition hover:brightness-125"
        style={{
          background: "rgb(23,46,74)",
          borderColor: "rgb(19,38,64)",
        }}
      >
        {selected && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}

        {selected
          ? "Selected Free Trial"
          : "Select Free Trial"}
      </button>
    </div>
  );
}