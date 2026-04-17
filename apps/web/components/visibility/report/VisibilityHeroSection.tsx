// apps/web/components/visibility/report/VisibilityHeroSection.tsx
import type { PillarItem, Readiness, Tier } from "./VisibilityReportTypes";
import { InnerPanel, OuterCard } from "./VisibilityReportPrimitives";
import { BRAND, getPillarLabel, readinessLabel } from "./VisibilityReportUtils";

export default function VisibilityHeroSection({
  takerName,
  tier,
  level,
  overallPct,
  readiness,
  heroCopy,
  currentPositionCopy,
  tierRangeCopy,
  pillars,
  weakest,
  strongest,
}: {
  takerName: string;
  tier: Tier;
  level: number;
  overallPct: number;
  readiness?: Readiness;
  heroCopy: string;
  currentPositionCopy: string;
  tierRangeCopy: string;
  pillars: PillarItem[];
  weakest?: string | null;
  strongest?: string | null;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div
        className="text-[10px] uppercase tracking-[0.26em]"
        style={{ color: BRAND.textFaint }}
      >
        Your Result
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_272px]">
        <div>
          <div className="text-[34px] md:text-[50px] font-semibold leading-none tracking-[0.01em]">
            {takerName.toUpperCase()}
          </div>

          <div
            className="mt-4 max-w-4xl text-[15px] leading-7"
            style={{ color: BRAND.text }}
          >
            {heroCopy}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.24em]"
                style={{ color: BRAND.textFaint }}
              >
                Current Position
              </div>
              <div
                className="mt-2 text-[14px] leading-7"
                style={{ color: BRAND.text }}
              >
                {currentPositionCopy}
              </div>
            </div>

            <div>
              <div
                className="text-[10px] uppercase tracking-[0.24em]"
                style={{ color: BRAND.textFaint }}
              >
                Tier Range
              </div>
              <div
                className="mt-2 text-[14px] leading-7"
                style={{ color: BRAND.text }}
              >
                {tierRangeCopy}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <InnerPanel
            className="p-4"
            style={{
              borderTop: `6px solid ${BRAND.tier[tier]}`,
            } as any}
          >
            <div className="text-center">
              <div
                className="text-[54px] md:text-[64px] font-semibold leading-none"
                style={{ color: BRAND.white }}
              >
                {overallPct}%
              </div>
              <div
                className="mt-3 text-[10px] uppercase tracking-[0.24em]"
                style={{ color: BRAND.textFaint }}
              >
                Overall score
              </div>
              <div
                className="mt-4 text-[22px] font-bold leading-7"
                style={{ color: BRAND.tier[tier] }}
              >
                Level {level} — {tier}
              </div>
            </div>
          </InnerPanel>

          <InnerPanel className="px-4 py-3">
            <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
              Status
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[16px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>{readinessLabel(readiness)}</span>
            </div>
          </InnerPanel>
        </div>
      </div>

      <div
        className="mt-6 text-[10px] uppercase tracking-[0.30em]"
        style={{ color: BRAND.textFaint }}
      >
        Prime Structural Breakdown
      </div>

      <div
        className={`mt-3 grid gap-3 ${
          pillars.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
        }`}
      >
        {pillars.map((pillar) => {
          const isWeakest = pillar.key === String(weakest || "").toLowerCase();
          const isStrongest = pillar.key === String(strongest || "").toLowerCase();

          return (
            <InnerPanel key={pillar.key} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em]">
                  {pillar.label}
                </div>

                {isStrongest ? (
                  <div
                    className="rounded-full px-2 py-0.5 text-[8px] uppercase tracking-[0.12em]"
                    style={{ background: BRAND.green, color: BRAND.white }}
                  >
                    Strongest Signal
                  </div>
                ) : null}

                {isWeakest ? (
                  <div
                    className="rounded-full px-2 py-0.5 text-[8px] uppercase tracking-[0.12em]"
                    style={{ background: BRAND.red, color: BRAND.white }}
                  >
                    Weakest Signal
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-end justify-between gap-2">
                <div
                  className="text-[16px] font-semibold"
                  style={{ color: pillar.color }}
                >
                  {pillar.value}%
                </div>
                <div className="text-[12px]" style={{ color: BRAND.textDim }}>
                  {pillar.band}
                </div>
              </div>

              <div
                className="mt-2.5 h-2.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pillar.value}%`,
                    background: `linear-gradient(90deg, ${pillar.color}, rgba(255,255,255,0.25))`,
                  }}
                />
              </div>
            </InnerPanel>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <InnerPanel className="p-3.5">
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: BRAND.textFaint }}
          >
            Weakest Signal
          </div>
          <div className="mt-2 text-[16px] font-semibold">
            {getPillarLabel(weakest || pillars[0]?.key || "visibility")}
          </div>
        </InnerPanel>

        <InnerPanel className="p-3.5">
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: BRAND.textFaint }}
          >
            Strongest Signal
          </div>
          <div className="mt-2 text-[16px] font-semibold">
            {getPillarLabel(strongest || pillars[pillars.length - 1]?.key || "trust")}
          </div>
        </InnerPanel>

        <InnerPanel className="p-3.5">
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: BRAND.textFaint }}
          >
            Overall Score
          </div>
          <div className="mt-2 text-[16px] font-semibold">{overallPct}%</div>
        </InnerPanel>
      </div>
    </OuterCard>
  );
}