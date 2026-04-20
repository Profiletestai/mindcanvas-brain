//apps/web/components/visibility/report/VisibilityVideoSection.tsx
"use client";

import { InnerPanel, OuterCard } from "./VisibilityReportPrimitives";
import { BRAND } from "./VisibilityReportUtils";

export default function VisibilityVideoSection({
  title = "Video Introduction",
  videoSrc,
  posterSrc,
  helperText = "This video introduces how to read the report and what to focus on first.",
}: {
  title?: string;
  videoSrc: string;
  posterSrc?: string;
  helperText?: string;
}) {
  return (
    <OuterCard className="p-4 md:p-5">
      <div className="text-[15px] font-semibold">{title}</div>

      <InnerPanel className="mt-3 p-4">
        <div className="overflow-hidden rounded-[18px] border border-white/10 bg-slate-900/30">
          <video
            controls
            playsInline
            preload="metadata"
            poster={posterSrc}
            className="w-full h-auto rounded-[14px]"
          >
            <source src={videoSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="mt-3 text-[12px]" style={{ color: BRAND.textDim }}>
          {helperText}
        </div>
      </InnerPanel>
    </OuterCard>
  );
}