// apps/web/app/admin/analytics/orgs/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import AdminOrgRankingsClient from "./AdminOrgRankingsClient";

export default async function Page() {
  // ✅ /admin is already protected by apps/web/app/admin/layout.tsx (superadmin-only)
  // So do not add extra membership checks here (they cause 404 via notFound()).
  return <AdminOrgRankingsClient />;
}