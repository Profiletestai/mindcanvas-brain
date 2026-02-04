// apps/web/app/portal/dashboard-v2/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import DashboardV2Client from "./DashboardV2Client";

export default function Page() {
  return <DashboardV2Client />;
}
