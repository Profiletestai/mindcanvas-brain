// apps/web/app/portal/[slug]/legacy/dashboard/page.tsx
// LEGACY Dashboard experience for /portal/[slug]/legacy/dashboard
// Kept for reference; the active dashboard lives at /portal/[slug]/dashboard.
// This preserves the previous link-analytics console (KPIs, timeline, drill-down).
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import DashboardClient from "../../dashboard/DashboardClient";

export default async function LegacyDashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  return <DashboardClient orgSlug={params.slug} />;
}
