import type { PlanCardData } from "./ChoosePlanClient";
import { CheckIcon, CrossIcon } from "./icons";

export type Interval = "month" | "year";

const ANNUAL_DISCOUNT = 0.85;

function formatUsd(cents: number): string {
  const major = cents / 100;
  return `$${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

export function PlanCard({
  card,
  interval,
  busy,
  disabled,
  onSelect,
  animationDelay,
}: {
  card: PlanCardData;
  interval: Interval;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
  animationDelay: number;
}) {
  const monthlyCents =
    interval === "year"
      ? Math.round(card.amountCents * ANNUAL_DISCOUNT)
      : card.amountCents;

  return (
    <div
      className={`relative flex flex-col rounded-[16px] bg-white pt-[22px] px-4 pb-[18px] [animation:cp-rise_480ms_ease_both] ${
        card.highlight
          ? "border-2 border-[rgba(45,157,224,1)]"
          : "border border-white/[0.08]"
      }`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {card.badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-[10px] py-[5px] text-[9px] leading-[14.4px] font-bold uppercase tracking-[1px] text-[rgba(19,38,64,1)]] ${
            card.badge.color === "blue"
              ? "bg-[rgba(45,157,224,1)]"
              : "bg-[rgba(26,181,160,1)]"
          }`}
        >
          {card.badge.label}
        </span>
      )}

      <div className="text-[11px] leading-[17.6px] font-bold uppercase tracking-[1px] text-[rgba(19,38,64,1)]">
        {card.name}
      </div>

      <div className="mt-2 flex items-baseline">
        <span className="text-[28px] font-bold leading-[28px] text-[rgba(19,38,64,1)]">
          {formatUsd(monthlyCents)}
        </span>
        <span className="-ml-[2px] text-[13px] leading-[13px] text-[rgba(19,38,64,1)]">/month</span>
      </div>
      <p className="mt-1 text-[12px] text-[rgb(71,99,128)]">{card.tagline}</p>

      <div className="mt-3 mb-4 h-px bg-[rgb(24,44,62)]" />

      <ul className="flex-1 space-y-1.5">
        {card.features.map((f) => (
          <li key={f.label} className="flex items-start gap-[6px]">
            {f.included ? (
              <CheckIcon color="rgb(38,180,120)" size={11} className="mt-[3px] shrink-0" />
            ) : (
              <CrossIcon color="rgb(148,163,184)" size={9} className="mt-[4px] shrink-0" />
            )}
            <span
              className={`text-[11px] leading-[17px] tracking-[-0.1px] ${
                f.included ? "text-[rgb(40,62,84)]" : "text-[rgb(148,163,184)]"
              }`}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={`mt-6 h-[38px] w-full rounded-[8px] bg-[rgba(23,46,74,1)] text-[12px] leading-[100%] font-medium text-white transition ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:brightness-125"
        }`}
      >
        {busy ? "Starting checkout…" : card.cta}
      </button>
    </div>
  );
}
