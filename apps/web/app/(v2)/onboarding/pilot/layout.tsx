import { MarketingPane } from "@/app/(v2)/onboarding/v2/_components/MarketingPane";
import { OnboardingHeader } from "./_components/OnboardingHeader";
import { StepGuard } from "./_components/StepGuard";

export default function OnboardingPilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-white flex flex-col">
      <OnboardingHeader />
      <main className="flex-1 mc-bg">
        <div className="mx-auto max-w-[1440px] px-6 lg:pl-[145px] lg:pr-[53px] pb-24 flex flex-col gap-8 lg:flex-row lg:gap-[150px] lg:items-start">
          <div className="lg:flex-1 lg:pt-[100px]">
            <MarketingPane />
          </div>
          <div className="flex lg:justify-end lg:pt-[52px]">
            <StepGuard>{children}</StepGuard>
          </div>
        </div>
      </main>
    </div>
  );
}
