"use client";

import { usePathname } from "next/navigation";
import { MarketingPane } from "./MarketingPane";
import { StepGuard } from "./StepGuard";
import { PLAN_PATH } from "../_lib/progress";

// Most onboarding steps are a narrow card beside the marketing pane. Step 3
// (engines + subscription) needs the full width, so it drops the pane.
const WIDE_PATHS = new Set([PLAN_PATH]);

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (WIDE_PATHS.has(pathname)) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-[120px] pb-24 pt-8 lg:pt-[52px]">
        <StepGuard>{children}</StepGuard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 lg:pl-[145px] lg:pr-[53px] pb-24 flex flex-col gap-8 lg:flex-row lg:gap-[150px] lg:items-start">
      <div className="lg:flex-1 lg:pt-[100px]">
        <MarketingPane />
      </div>
      <div className="flex lg:justify-end lg:pt-[52px]">
        <StepGuard>{children}</StepGuard>
      </div>
    </div>
  );
}
