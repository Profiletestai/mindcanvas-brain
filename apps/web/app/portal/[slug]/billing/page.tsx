// apps/web/app/portal/[slug]/billing/page.tsx

import "server-only";

import { notFound } from "next/navigation";

import { getAdminClient } from "@/app/_lib/portal";
import BillingClient from "@/app/portal/billing/BillingClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = {
  slug: string;
};

export default async function BillingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const admin = await getAdminClient();

  const { data: org, error } = await admin
    .schema("portal")
    .from("orgs")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !org) {
    notFound();
  }

  return <BillingClient orgId={org.id} />;
}
