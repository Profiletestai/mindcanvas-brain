// apps/web/app/admin/analytics/orgs/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { notFound } from "next/navigation";
import AdminOrgRankingsClient from "./AdminOrgRankingsClient";
import { getServerSupabase, getAdminClient } from "@/app/_lib/portal";

const PROFILETEST_ORG_SLUG = "profiletest-ai"; // must match portal.orgs.slug exactly

export default async function Page() {
  // ✅ This matches /admin/layout.tsx behaviour
  const sb = await getServerSupabase();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user) notFound();

  // ✅ Use admin client for portal tables (consistent + avoids cookie typing issues)
  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  // 1) Find Profiletest.ai org id
  const { data: orgRow, error: orgErr } = await portal
    .from("orgs")
    .select("id, slug")
    .eq("slug", PROFILETEST_ORG_SLUG)
    .maybeSingle();

  if (orgErr || !orgRow?.id) notFound();

  // 2) Check membership in that org (Profiletest.ai only)
  const { data: membership, error: memErr } = await portal
    .from("user_orgs")
    .select("org_id, role")
    .eq("org_id", orgRow.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr || !membership) notFound();

  return <AdminOrgRankingsClient />;
}