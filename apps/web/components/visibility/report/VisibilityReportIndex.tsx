// apps/web/components/visibility/report/VisibilityReportIndex.tsx
import { OuterCard, TopButton } from "./VisibilityReportPrimitives";
import { BRAND } from "./VisibilityReportUtils";
import type { ReportIndexItem } from "./VisibilityReportTypes";

export default function VisibilityReportIndex({
  reportIndex,
  nextStepsUrl,
  onDownload,
}: {
  reportIndex: ReportIndexItem[];
  nextStepsUrl?: string;
  onDownload: () => void;
}) {
  return (
    <OuterCard className="p-3.5">
      <div
        className="text-[10px] uppercase tracking-[0.24em]"
        style={{ color: BRAND.textFaint }}
      >
        Report Index
      </div>

      <div className="mt-3 space-y-1.5">
        {reportIndex.map((item, idx) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block rounded-xl border px-3 py-2.5 text-[12px] leading-5 hover:bg-white/5"
            style={{
              borderColor: BRAND.borderSoft,
              background: "rgba(8,22,43,0.24)",
            }}
          >
            {idx + 1}. {item.label}
          </a>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <TopButton onClick={onDownload}>Download PDF</TopButton>
        {nextStepsUrl ? (
          <TopButton href={nextStepsUrl} variant="gradient">
            Next steps
          </TopButton>
        ) : null}
      </div>
    </OuterCard>
  );
}