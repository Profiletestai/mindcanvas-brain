// apps/web/components/visibility/report/VisibilityNarrativeSection.tsx
import { InnerPanel, OuterCard } from "./VisibilityReportPrimitives";
import { BRAND, sectionParagraphs, sectionSummary, safeString } from "./VisibilityReportUtils";
import type { Section } from "./VisibilityReportTypes";

export default function VisibilityNarrativeSection({
  id,
  title,
  section,
  footerNote,
  iconSrc,
  footerProfile,
  infographicSrc,
  infographicAlt,
  infographicAfterParagraph,
}: {
  id?: string;
  title: string;
  section?: Section | null;
  footerNote?: string;
  iconSrc?: string;
  footerProfile?: {
    imageSrc?: string;
    name?: string;
    title?: string;
  };
  infographicSrc?: string;
  infographicAlt?: string;
  infographicAfterParagraph?: number;
}) {
  const summary = sectionSummary(section);
  const paragraphs = sectionParagraphs(section);
  const transition =
    (Array.isArray(section?.blocks) ? section?.blocks : [])
      .map((b) => safeString(b.transition))
      .find(Boolean) || footerNote || "";

  const insertAfter = typeof infographicAfterParagraph === "number" ? infographicAfterParagraph : 2;

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
        <div className="text-[15px] font-semibold">{title}</div>
      </div>

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
            <div key={idx}>
              <p>{p}</p>

              {infographicSrc && idx === insertAfter - 1 ? (
                <div className="my-8 flex justify-center">
                  <img
                    src={infographicSrc}
                    alt={infographicAlt || ""}
                    className="max-w-full h-auto object-contain"
                    style={{ maxHeight: 340 }}
                    onError={(e: any) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {footerProfile?.name || footerProfile?.title ? (
          <div className="mt-6 flex items-center gap-3">
            {footerProfile.imageSrc ? (
              <img
                src={footerProfile.imageSrc}
                alt={footerProfile.name || "Profile"}
                className="h-14 w-14 rounded-full object-cover"
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}

            <div>
              {footerProfile.name ? (
                <div className="text-[13px] font-semibold" style={{ color: BRAND.text }}>
                  {footerProfile.name}
                </div>
              ) : null}
              {footerProfile.title ? (
                <div className="text-[12px]" style={{ color: BRAND.textDim }}>
                  {footerProfile.title}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {transition ? (
          <div className="mt-4 text-[11px]" style={{ color: BRAND.textFaint }}>
            {transition}
          </div>
        ) : null}
      </InnerPanel>
    </OuterCard>
  );
}