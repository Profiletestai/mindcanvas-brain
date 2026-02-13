// apps/web/app/portal/[slug]/dashboard/link/[token]/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import LinkAnalyticsClient from "./LinkAnalyticsClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string; token: string };
  searchParams?: { from?: string; to?: string; testId?: string };
}) {
  return (
    <LinkAnalyticsClient
      orgSlug={params.slug}
      token={params.token}
      from={searchParams?.from}
      to={searchParams?.to}
      testId={searchParams?.testId}
    />
  );
}


