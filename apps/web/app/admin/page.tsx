// apps/web/app/admin/page.tsx
// (or: apps/web/app/portal/admin/page.tsx — use whichever actually maps to /admin in your repo)

import "server-only";

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROFILETEST_ORG_SLUG = "profiletest-ai";

function supabaseFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

export default async function AdminOrgsPage() {
  // ✅ Auth-gated + membership-gated UI (Profiletest.ai only for org performance page link)
  const cookieStore = await cookies();
  const supabase = supabaseFromCookies(cookieStore);

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) notFound();

  // Check membership in profiletest-ai org (Supabase-auth-level access)
  let canSeeOrgPerformance = false;
  try {
    const { data: orgRow } = await supabase
      .schema("portal")
      .from("orgs")
      .select("id, slug")
      .eq("slug", PROFILETEST_ORG_SLUG)
      .maybeSingle();

    if (orgRow?.id) {
      const { data: membership } = await supabase
        .schema("portal")
        .from("user_orgs")
        .select("org_id")
        .eq("org_id", orgRow.id)
        .eq("user_id", user.id)
        .maybeSingle();

      canSeeOrgPerformance = !!membership;
    }
  } catch {
    canSeeOrgPerformance = false;
  }

  // ✅ Load org list (admin/service role is fine here because this is an admin page anyway)
  const sb = createAdminClient().schema("portal");
  const { data: orgs, error } = await sb
    .from("v_organizations")
    .select("id, slug, name")
    .order("name");

  if (error) {
    return (
      <div className="fixed inset-0 mc-bg text-red-400 flex items-center justify-center px-6">
        <div>Load error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 mc-bg text-white overflow-auto">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Organizations</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* ✅ Profiletest.ai-only: Organisation Performance */}
            {canSeeOrgPerformance ? (
              <Link
                href="/admin/analytics/orgs"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow hover:bg-white/10 transition"
                title="View organisation performance across the platform"
              >
                Organisation Performance
              </Link>
            ) : null}

            <Link
              href="/admin/orgs/new"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110 transition"
            >
              + Add organisation
            </Link>

            <Link
              href="/"
              className="text-sm text-sky-300 hover:text-sky-100 underline-offset-4 hover:underline"
            >
              Back to home
            </Link>
          </div>
        </header>

        <ul className="grid gap-4 md:grid-cols-2">
          {orgs?.map((o: any) => (
            <li
              key={o.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 shadow-lg flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-slate-300">{o.slug}</div>
              </div>

              <Link
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110 transition"
                href={`/portal/${o.slug}/dashboard`}
              >
                Open portal
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}




