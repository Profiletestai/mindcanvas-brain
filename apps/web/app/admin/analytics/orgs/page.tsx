// apps/web/app/admin/analytics/orgs/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import AdminOrgRankingsClient from "./AdminOrgRankingsClient";

export default function Page() {
  return <AdminOrgRankingsClient />;
}
