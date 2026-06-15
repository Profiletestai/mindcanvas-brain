import type { PlanCardData } from "./ChoosePlanClient";
import { CheckSvgIcon, CrossSvgIcon } from "./icons";

export type Interval = "month" | "year";

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
  const monthlyCents = card.amountCents;

  return (
    <div
      className={`relative flex flex-col rounded-[16px] bg-white px-5 pb-4 pt-5 [animation:cp-rise_480ms_ease_both] ${
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
        <span className="-ml-[2px] text-[13px] leading-[13px] text-[rgba(19,38,64,1)]">
          /month
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-[16.5px] text-[rgba(19,38,64,1)]">
        {card.tagline}
      </p>

      <div className="mt-3 mb-4 h-px bg-[rgba(28,48,80,1)]" />

      <ul className="flex-1 space-y-1.5">
        {card.features.map((f) => (
          <li key={f.label} className="flex items-start gap-[18px]">
            {f.included ? (
              <CheckSvgIcon
                color="rgba(45,212,191,1)"
                size={12}
                className="mt-[3px] shrink-0"
              />
            ) : (
              <CrossSvgIcon
                color="#132640"
                size={12}
                className="mt-[3px] shrink-0 opacity-50"
              />
            )}
            <span
              className={`text-[11px] leading-[15.4px] font-light tracking-[0px] ${
                f.included
                  ? "text-[rgba(19,38,64,1)]"
                  : "text-[rgba(19,38,64,0.5)]"
              }`}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {card.externalUrl ? (
        <a
          href={card.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex h-[38px] w-full items-center justify-center rounded-[8px] bg-[rgba(23,46,74,1)] text-[12px] leading-[100%] font-medium text-white transition cursor-pointer hover:brightness-125"
        >
          {card.cta}
        </a>
      ) : (
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
      )}
    </div>
  );
}
