// apps/web/components/visibility/report/VisibilityLadderPanel.tsx
import type { Tier } from "./VisibilityReportTypes";
import { OuterCard } from "./VisibilityReportPrimitives";
import { BRAND, tierBand } from "./VisibilityReportUtils";

export default function VisibilityLadderPanel({
  tier,
  level,
}: {
  tier: Tier;
  level: number;
}) {
  const levels = Array.from({ length: 20 }, (_, i) => 20 - i);

  const groups: Array<{
    tier: Tier;
    startRow: number;
    span: number;
  }> = [
    { tier: "Magnetic", startRow: 1, span: 5 },
    { tier: "Established", startRow: 6, span: 5 },
    { tier: "Emerging", startRow: 11, span: 5 },
    { tier: "Invisible", startRow: 16, span: 5 },
  ];

  return (
    <OuterCard className="p-3.5">
      <div
        className="text-[10px] uppercase tracking-[0.24em]"
        style={{ color: BRAND.textFaint }}
      >
        Ladder Position
      </div>

      <div className="mt-3 grid grid-cols-[38px_minmax(0,1fr)] gap-2.5">
        <div
          className="grid"
          style={{
            gridTemplateRows: "repeat(20, 28px)",
            rowGap: "6px",
          }}
        >
          {groups.map((g) => (
            <div
              key={g.tier}
              className="relative flex items-center justify-center overflow-hidden rounded-[12px]"
              style={{
                gridRow: `${g.startRow} / span ${g.span}`,
                background: `${BRAND.tier[g.tier]}20`,
                border: `1px solid ${BRAND.border}`,
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[5px] rounded-r-full"
                style={{ background: BRAND.tier[g.tier] }}
              />
              <div
                className="rotate-[-90deg] whitespace-nowrap text-[10px] font-semibold"
                style={{ color: BRAND.tier[g.tier] }}
              >
                {g.tier}
              </div>
            </div>
          ))}
        </div>

        <div
          className="grid"
          style={{
            gridTemplateRows: "repeat(20, 28px)",
            rowGap: "6px",
          }}
        >
          {levels.map((n) => {
            const active = n === level;
            const band = tierBand(n);
            const bandColor = BRAND.tier[band];

            return (
              <div
                key={n}
                className="relative rounded-[10px] border flex items-center justify-center text-[12px]"
                style={{
                  borderColor: active ? bandColor : "rgba(255,255,255,0.10)",
                  background: active
                    ? `linear-gradient(90deg, ${bandColor}cc, rgba(255,255,255,0.14))`
                    : "rgba(7,22,43,0.34)",
                  color: "rgba(255,255,255,0.92)",
                  boxShadow: active ? `0 0 18px ${bandColor}44` : "none",
                }}
              >
                {n}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[4px] rounded-r-[10px]"
                  style={{ background: bandColor }}
                />
                {active ? (
                  <div
                    className="absolute -right-2.5 h-5 w-5 rounded-full"
                    style={{
                      background: bandColor,
                      opacity: 0.86,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-1.5 text-[12px]">
        <div>Magnetic</div>
        <div className="text-right" style={{ color: BRAND.textDim }}>
          16–20
        </div>
        <div>Established</div>
        <div className="text-right" style={{ color: BRAND.textDim }}>
          11–15
        </div>
        <div>Emerging</div>
        <div className="text-right" style={{ color: BRAND.textDim }}>
          6–10
        </div>
        <div>Invisible</div>
        <div className="text-right" style={{ color: BRAND.textDim }}>
          1–5
        </div>
      </div>
    </OuterCard>
  );
}