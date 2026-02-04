// apps/web/app/portal/dashboard-v2/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import AppBackground from "@/components/ui/AppBackground";
import DashboardV2Client from "./DashboardV2Client";

export default function Page() {
  return (
    <main className="relative min-h-screen">
      {/* Background layer */}
      <AppBackground />

      {/* Foreground content */}
      <div className="relative z-10">
        <DashboardV2Client />
      </div>
    </main>
  );
}
