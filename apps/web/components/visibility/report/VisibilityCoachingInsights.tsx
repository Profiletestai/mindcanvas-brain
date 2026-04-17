// apps/web/components/visibility/report/VisibilityCoachingInsights.tsx
import { InnerPanel, OuterCard, SectionTitle } from "./VisibilityReportPrimitives";
import { BRAND } from "./VisibilityReportUtils";
import type { AiInsights } from "./VisibilityReportTypes";

export default function VisibilityCoachingInsights({
  ai,
  fallbackStrengths,
  fallbackFriction,
  fallbackOpportunity,
  iconSrc,
}: {
  ai?: AiInsights | null;
  fallbackStrengths?: string[];
  fallbackFriction?: string[];
  fallbackOpportunity?: string;
  iconSrc?: string;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="flex items-center gap-3">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className="h-12 w-12 object-contain shrink-0"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}

        <SectionTitle
          title="Coaching insight"
          subtitle="An additional interpretation layer built from your scored signals and narrative blocks"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Strengths</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {(ai?.strengths?.length ? ai.strengths : fallbackStrengths || []).map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </InnerPanel>

        <InnerPanel className="p-4">
          <div className="text-[14px] font-semibold">Friction</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
            {(ai?.friction?.length ? ai.friction : fallbackFriction || []).map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </InnerPanel>
      </div>

      <InnerPanel className="mt-3 p-4">
        <div className="text-[14px] font-semibold">Strategic opportunity</div>
        <div className="mt-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {ai?.strategic_opportunity ||
            fallbackOpportunity ||
            "Clarify the highest-impact next move and focus effort where it will create the greatest lift."}
        </div>
      </InnerPanel>
    </OuterCard>
  );
}