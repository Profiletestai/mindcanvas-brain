"use client";

import type {
  Engine,
  EngineKey,
} from "../_lib/engines";

const ENGINE_BADGES: Partial<
  Record<EngineKey, string>
> = {
  sales: "Free trial engine",
};

export function EngineCard({
  engine,
}: {
  engine: Engine;
}) {
  const productLabel =
    engine.productName === engine.productCode
      ? engine.productCode
      : `${engine.productName} — ${engine.productCode}`;

  const badge = ENGINE_BADGES[engine.key];

  return (
    <article
      aria-label={`${engine.name}: ${productLabel}`}
      className="flex w-full flex-col rounded-[10px] border p-6 text-left"
      style={{
        background: "rgb(15,32,53)",
        borderColor: "rgba(255,255,255,0.09)",
      }}
    >
      <div className="flex min-h-[24px] items-center justify-between gap-3">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold"
          style={{
            borderColor: "rgba(84,175,224,0.55)",
            background: "rgba(84,175,224,0.10)",
            color: "rgb(84,175,224)",
          }}
        >
          i
        </span>

        {badge && (
          <span
            className="rounded-full px-[10px] py-[3px] text-[10px] font-bold uppercase leading-[12px] tracking-[0.2px]"
            style={{
              background: "rgb(232,247,238)",
              color: "rgb(22,101,52)",
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <h3
        className="mt-[11px] text-[15.4px] font-semibold leading-[19px]"
        style={{ color: "rgb(234,242,251)" }}
      >
        {engine.name}
      </h3>

      <p
        className="mt-[4px] text-[12.65px] font-semibold leading-[15px]"
        style={{
          color: "rgba(230,240,250,0.62)",
        }}
      >
        Product: {productLabel}
      </p>

      <p
        className="mt-[11px] text-[12.65px] leading-[20.4px]"
        style={{
          color: "rgba(210,225,245,0.58)",
        }}
      >
        {engine.description}
      </p>

      <p
        className="mt-auto pt-4 text-[11.5px] leading-[17px]"
        style={{
          color: "rgba(84,175,224,0.85)",
        }}
      >
        Engine access is assigned automatically from your
        chosen plan.
      </p>
    </article>
  );
}
