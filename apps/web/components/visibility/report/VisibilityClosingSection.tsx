// apps/web/components/visibility/report/VisibilityClosingSection.tsx
import { InnerPanel, OuterCard, SectionTitle } from "./VisibilityReportPrimitives";
import { BRAND, sectionParagraphs, sectionSummary, safeString } from "./VisibilityReportUtils";
import type { Section } from "./VisibilityReportTypes";

export default function VisibilityClosingSection({
  id,
  title,
  section,
  engineKey,
  version,
  scoringMode,
  iconSrc,
}: {
  id?: string;
  title: string;
  section?: Section | null;
  engineKey?: string;
  version?: number;
  scoringMode?: string;
  iconSrc?: string;
}) {
  return (
    <OuterCard id={id} className="p-4 md:p-5">
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

        <SectionTitle title={title} />
      </div>

      <InnerPanel className="mt-3 p-4">
        {sectionSummary(section) ? (
          <div
            className="rounded-2xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: BRAND.borderSoft,
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            <span className="font-medium">In short:</span> {sectionSummary(section)}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {sectionParagraphs(section).map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </InnerPanel>

      <div className="mt-3 text-[11px]" style={{ color: BRAND.textFaint }}>
        engine: {safeString(engineKey || "visibility_prime_v1")} • v{version ?? 2} • mode:{" "}
        {safeString(scoringMode || "prime")}
      </div>
    </OuterCard>
  );
}