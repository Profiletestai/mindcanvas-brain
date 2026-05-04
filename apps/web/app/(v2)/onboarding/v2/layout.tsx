import { Stepper } from "./_components/Stepper";
import { StepGuard } from "./_components/StepGuard";

export default function OnboardingV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen mc-bg text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-xl shadow-[0_8px_30px_rgba(100,186,226,0.35)]"
            style={{
              background:
                "linear-gradient(135deg, var(--mc-c1), var(--mc-c2) 60%, var(--mc-c3))",
            }}
          />
          <span className="text-base font-semibold tracking-tight">MindCanvas</span>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <Stepper />
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_30px_80px_rgba(0,0,0,0.45)] p-6 sm:p-8">
          <StepGuard>{children}</StepGuard>
        </div>
      </main>
    </div>
  );
}
