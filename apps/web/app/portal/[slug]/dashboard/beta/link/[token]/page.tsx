// apps/web/app/portal/[slug]/dashboard/beta/link/[token]/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import PortalChrome from "@/components/portal/PortalChrome";
import LinkAnalyticsClient from "./LinkAnalyticsClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string; token: string };
  searchParams?: { from?: string; to?: string; testId?: string };
}) {
  const orgSlug = params.slug;
  const token = params.token;

  let orgName: string | null = null;

  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        db: { schema: "portal" },
      });

      const { data } = await sb
        .from("orgs")
        .select("name")
        .eq("slug", orgSlug)
        .maybeSingle();

      orgName = data?.name ?? null;
    }
  } catch {
    orgName = null;
  }

  return (
    <PortalChrome orgSlug={orgSlug} orgName={orgName}>
      <LinkAnalyticsClient
        orgSlug={orgSlug}
        token={token}
        from={searchParams?.from}
        to={searchParams?.to}
        testId={searchParams?.testId}
      />
    </PortalChrome>
  );
}
