import Image from "next/image";
import type { ReactNode } from "react";
import logo from "@/public/images/profile-test-ai-logo.png";
import { StepCard } from "@/app/(v2)/onboarding/v2/_components/StepCard";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
};

/**
 * Shell for the standalone portal auth screens (forgot / reset password).
 * Same look as onboarding v2 minus the Stepper, which is funnel-specific.
 */
export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-white text-white flex flex-col">
      <header className="w-full bg-white h-[105px] flex items-center justify-center">
        <Image
          src={logo}
          alt="profiletest.ai"
          width={222}
          height={68}
          priority
          className="h-[68px] w-auto select-none"
        />
      </header>
      <main className="flex-1 mc-bg flex justify-center px-6 py-12">
        <StepCard
          title={title}
          subtitle={subtitle}
          width={560}
          minHeight={420}
          titleNoWrap={false}
          className="max-w-full self-start"
        >
          {children}
        </StepCard>
      </main>
    </div>
  );
}
