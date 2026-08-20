//apps/web/app/(v2)/onboarding/v2/layout.tsx
import { OnboardingAnalytics } from "./_components/OnboardingAnalytics";
import { OnboardingHeader } from "./_components/OnboardingHeader";
import { OnboardingShell } from "./_components/OnboardingShell";

export default function OnboardingV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-white flex flex-col">
      <OnboardingAnalytics />
      <OnboardingHeader />

      <main
        className="flex-1"
        style={{
          backgroundColor: "#021824",
          backgroundImage: [
            "linear-gradient(rgba(34, 75, 94, 0.22) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(34, 75, 94, 0.22) 1px, transparent 1px)",
            "linear-gradient(90deg, #01151f 0%, #0f202c 100%)",
          ].join(", "),
          backgroundPosition: "-1px -1px, -1px -1px, 0 0",
          backgroundSize: "64px 64px, 64px 64px, 100% 100%",
        }}
      >
        <OnboardingShell>{children}</OnboardingShell>
      </main>
    </div>
  );
}
