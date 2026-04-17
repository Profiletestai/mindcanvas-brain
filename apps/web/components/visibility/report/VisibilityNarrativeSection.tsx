// apps/web/components/visibility/report/VisibilityNarrativeSection.tsx
import { InnerPanel, OuterCard } from "./VisibilityReportPrimitives";
import { BRAND, sectionParagraphs, sectionSummary, safeString } from "./VisibilityReportUtils";
import type { Section } from "./VisibilityReportTypes";

export default function VisibilityNarrativeSection({
  id,
  title,
  section,
  footerNote,
}: {
  id?: string;
  title: string;
  section?: Section | null;
  footerNote?: string;
}) {
  const summary = sectionSummary(section);
  const paragraphs = sectionParagraphs(section);
  const transition =
    (Array.isArray(section?.blocks) ? section?.blocks : [])
      .map((b) => safeString(b.transition))
      .find(Boolean) || footerNote || "";

  return (
    <OuterCard id={id} className="p-4 md:p-5">
      <div className="text-[15px] font-semibold">{title}</div>

      <InnerPanel className="mt-3 p-4">
        {summary ? (
          <div
            className="rounded-2xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: BRAND.borderSoft,
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            <span className="font-medium">In short:</span> {summary}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>

        {transition ? (
          <div className="mt-4 text-[11px]" style={{ color: BRAND.textFaint }}>
            {transition}
          </div>
        ) : null}
      </InnerPanel>
    </OuterCard>
  );
}