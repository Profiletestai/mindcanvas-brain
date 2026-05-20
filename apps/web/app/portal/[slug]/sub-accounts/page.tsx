import "server-only";
import { notFound } from "next/navigation";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import SubAccountsClient from "./SubAccountsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const { data, error } = await portalAdmin()
    .from("orgs")
    .select("id")
    .eq("slug", params.slug)
    .maybeSingle<{ id: string }>();
  if (error || !data) notFound();
  return <SubAccountsClient orgSlug={params.slug} parentOrgId={data.id} />;
}
