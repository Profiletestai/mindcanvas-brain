// apps/web/app/portal/dashboard-v2/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import AppBackground from "@/components/ui/AppBackground";
import DashboardV2Client from "./DashboardV2Client";

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <AppBackground />

      {/* MindCanvas overlay tint */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#050914]/70" />

      {/* Subtle grid overlay for continuity (even if AppBackground changes) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 50% 20%, black 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10">
        <DashboardV2Client />
      </div>
    </main>
  );
}
