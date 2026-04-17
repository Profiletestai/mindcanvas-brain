// apps/web/components/visibility/report/VisibilitySignalGraph.tsx
import { InnerPanel, OuterCard } from "./VisibilityReportPrimitives";
import { BRAND } from "./VisibilityReportUtils";
import type { PillarItem, Tier } from "./VisibilityReportTypes";

export default function VisibilitySignalGraph({
  tier,
  level,
  overallPct,
  pillars,
  weakest,
  strongest,
}: {
  tier: Tier;
  level: number;
  overallPct: number;
  pillars: PillarItem[];
  weakest?: string | null;
  strongest?: string | null;
}) {
  return (
    <OuterCard className="p-4 h-full">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.26em]"
        style={{ color: BRAND.purple }}
      >
        Signal Graph
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <InnerPanel className="p-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Tier
          </div>
          <div
            className="mt-1.5 text-[13px] font-semibold"
            style={{ color: BRAND.tier[tier] }}
          >
            {tier}
          </div>
        </InnerPanel>

        <InnerPanel className="p-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Level
          </div>
          <div className="mt-1.5 text-[13px] font-semibold">{level}</div>
        </InnerPanel>

        <InnerPanel className="p-3">
          <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
            Overall
          </div>
          <div className="mt-1.5 text-[13px] font-semibold">{overallPct}%</div>
        </InnerPanel>
      </div>

      <div className="mt-4 space-y-3.5">
        {pillars.map((pillar) => {
          const tag =
            pillar.key === String(weakest || "").toLowerCase()
              ? "weakest"
              : pillar.key === String(strongest || "").toLowerCase()
              ? "strongest"
              : "";

          return (
            <div key={pillar.key}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <div className="font-medium">
                  {pillar.label}{" "}
                  {tag ? (
                    <span className="ml-1 text-[10px]" style={{ color: BRAND.textFaint }}>
                      {tag}
                    </span>
                  ) : null}
                </div>
                <div>{pillar.value}%</div>
              </div>

              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pillar.value}%`,
                    background: `linear-gradient(90deg, ${pillar.color}, rgba(255,255,255,0.45))`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </OuterCard>
  );
}