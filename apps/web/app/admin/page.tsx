// apps/web/app/admin/page.tsx
import "server-only";

import Link from "next/link";
import { createClient as createAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOrgsPage() {
  // ✅ /admin is already protected by apps/web/app/admin/layout.tsx (superadmin table)
  // So we don't need additional gating here.

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
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Admin</h1>
            <div className="text-sm text-white/60">Platform console</div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* ✅ Superadmin-only page already, so show this button */}
            <Link
              href="/admin/analytics/orgs"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow hover:bg-white/10 transition"
              title="View organisation performance across the platform"
            >
              Organisation Performance
            </Link>

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

        {/* ✅ Engines section (global) */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Engines</h2>
              <p className="mt-1 text-sm text-white/60">
                Platform-level engines used across organisations and partners.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* MCAS */}
            <div className="rounded-2xl border border-white/10 bg-[#0b1724]/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-white/60">Recruitment Engine</div>
                  <div className="mt-1 text-xl font-semibold">MCAS</div>
                  <div className="mt-1 text-sm text-white/60">
                    MindCanvas CORE Alignment System (applications, scoring, partner links).
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/admin/mcas/applications"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110 transition"
                >
                  View Applications (Results)
                </Link>

                <Link
                  href="/admin/mcas/create-link"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow hover:bg-white/10 transition"
                >
                  Create Partner Link
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/40">
                Results live under <span className="font-mono">Applications</span>.
              </div>
            </div>

            {/* QSC placeholder link area (optional) */}
            <div className="rounded-2xl border border-white/10 bg-[#0b1724]/60 p-5">
              <div className="text-xs text-white/60">Diagnostics Engine</div>
              <div className="mt-1 text-xl font-semibold">QSC</div>
              <div className="mt-1 text-sm text-white/60">
                Quantum Source Code diagnostics across entrepreneurs & leaders.
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/admin/analytics/orgs"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow hover:bg-white/10 transition"
                >
                  Performance View
                </Link>
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow hover:bg-white/10 transition"
                  title="Placeholder - add QSC admin console later"
                >
                  Admin Console (Coming)
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/40">
                We can add a dedicated QSC admin console when you’re ready.
              </div>
            </div>
          </div>
        </section>

        {/* Organisations */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Organizations</h2>
              <div className="text-sm text-white/60">
                Manage tenants and open their portals.
              </div>
            </div>
          </div>

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
        </section>
      </div>
    </div>
  );
}