// apps/web/app/portal/[slug]/dashboard/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import DashboardClient from "./DashboardClient";

export default async function Page({ params }: { params: { slug: string } }) {
  return <DashboardClient orgSlug={params.slug} />;
}



