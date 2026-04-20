// apps/web/components/visibility/report/VisibilityReportHeader.tsx
import { Chip, InnerPanel, OuterCard, TopButton } from "./VisibilityReportPrimitives";
import { BRAND } from "./VisibilityReportUtils";

export default function VisibilityReportHeader({
  orgLogoUrl,
  takerName,
  reportDate,
  frameworkName,
  nextStepsUrl,
  onDownload,
}: {
  orgLogoUrl?: string | null;
  takerName: string;
  reportDate: string;
  frameworkName: string;
  nextStepsUrl?: string;
  onDownload: () => void;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt="Organisation logo"
                className="h-10 w-10 rounded-2xl object-cover"
                style={{ border: `1px solid ${BRAND.border}` }}
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="h-10 w-10 rounded-2xl"
                style={{
                  border: `1px solid ${BRAND.border}`,
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            )}

            <div>
              <div className="text-[28px] md:text-[32px] font-semibold tracking-[0.14em] uppercase leading-none">
                Visibility Ladder™
              </div>
              <div
                className="mt-1.5 text-[12px] md:text-[13px] uppercase tracking-[0.28em]"
                style={{ color: BRAND.textDim }}
              >
                Strategic Visibility Assessment
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>{frameworkName}</Chip>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5">
          <div className="flex gap-2">
            <TopButton onClick={onDownload}>Download PDF</TopButton>
            {nextStepsUrl ? (
              <TopButton href={nextStepsUrl} variant="gradient">
                Next steps
              </TopButton>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <InnerPanel className="px-3.5 py-3 min-w-[150px]">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Prepared for
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{takerName}</div>
            </InnerPanel>

            <InnerPanel className="px-3.5 py-3 min-w-[130px]">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Date
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{reportDate}</div>
            </InnerPanel>

            <InnerPanel className="px-3.5 py-3 min-w-[150px]">
              <div className="text-[10px]" style={{ color: BRAND.textFaint }}>
                Framework
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">{frameworkName}</div>
            </InnerPanel>
          </div>
        </div>
      </div>
    </OuterCard>
  );
}