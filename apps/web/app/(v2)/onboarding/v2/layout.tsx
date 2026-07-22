import { OnboardingHeader } from "./_components/OnboardingHeader";
import { OnboardingShell } from "./_components/OnboardingShell";

export default function OnboardingV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-white flex flex-col">
      <OnboardingHeader />
      <main className="flex-1 mc-bg">
        <OnboardingShell>{children}</OnboardingShell>
      </main>
    </div>
  );
}
