// apps/web/app/t/[token]/embed/page.tsx
import PublicTestClient from "../PublicTestClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* MindCanvas background (same vibe as TestShell, no banner) */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#020617,rgba(2,6,23,0.92)),url('/images/mc-grid.svg')]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <PublicTestClient token={params.token} embed />
      </div>
    </div>
  );
}