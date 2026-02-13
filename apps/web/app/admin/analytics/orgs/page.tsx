// apps/web/app/admin/analytics/orgs/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import AdminOrgRankingsClient from "./AdminOrgRankingsClient";

const PROFILETEST_ORG_SLUG = "profiletest-ai"; // must match portal.orgs.slug exactly

async function supabaseFromCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = await cookies(); // ✅ Next typings: cookies() may be async
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
    },
  });
}

export default async function Page() {
  const supabase = await supabaseFromCookies();
  if (!supabase) notFound();

  // 1) Who is logged in?
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user) notFound();

  // 2) Find Profiletest.ai org id
  const { data: orgRow, error: orgErr } = await supabase
    .schema("portal")
    .from("orgs")
    .select("id,slug")
    .eq("slug", PROFILETEST_ORG_SLUG)
    .maybeSingle();

  if (orgErr || !orgRow?.id) notFound();

  // 3) Is this user a member of Profiletest.ai org?
  const { data: membership, error: memErr } = await supabase
    .schema("portal")
    .from("user_orgs")
    .select("org_id, role")
    .eq("org_id", orgRow.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr || !membership) notFound();

  // Optional hardening: only allow certain roles
  // const allowed = ["owner", "admin", "super_admin"];
  // if (!allowed.includes(String(membership.role || ""))) notFound();

  return <AdminOrgRankingsClient />;
}

