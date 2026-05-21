import { SubHeader } from "./_components/SubHeader";

export default function SubAccountOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-white flex flex-col">
      <SubHeader />
      <main className="flex-1 mc-bg">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-12 py-12 flex justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
