// apps/web/app/admin/page.tsx
import "server-only";

import Link from "next/link";
import { createClient as createAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOrgsPage() {
  // /admin is already protected by apps/web/app/admin/layout.tsx.
  const sb = createAdminClient().schema("portal");

  const { data: orgs, error } = await sb
    .from("v_organizations")
    .select("id, slug, name")
    .order("name");

  if (error) {
    return (
      <div className="fixed inset-0 mc-bg flex items-center justify-center px-6 text-red-400">
        <div>Load error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 mc-bg overflow-auto text-white">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Admin</h1>
            <div className="text-sm text-white/60">Platform console</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/analytics/orgs"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
              title="View organisation performance across the platform"
            >
              Organisation Performance
            </Link>

            <Link
              href="/admin/orgs/new"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:brightness-110"
            >
              + Add organisation
            </Link>

            <Link
              href="/"
              className="text-sm text-sky-300 underline-offset-4 hover:text-sky-100 hover:underline"
            >
              Back to home
            </Link>
          </div>
        </header>

        {/* Engines */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Engines</h2>
              <p className="mt-1 text-sm text-white/60">
                Platform-level engines used across organisations and partners.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* MCAS */}
            <div className="rounded-2xl border border-sky-300/20 bg-[#0b1724]/60 p-5 shadow-lg shadow-sky-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-white/60">Recruitment Engine</div>
                  <div className="mt-1 text-xl font-semibold">MCAS</div>
                  <div className="mt-1 text-sm text-white/60">
                    MindCanvas CORE Alignment System for recruitment, candidate
                    assessments, role alignment, and validation.
                  </div>
                </div>

                <div className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-200">
                  Platform
                </div>
              </div>

              <div className="mt-5">
                <Link
                  href="/admin/mcas"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-3 text-sm font-semibold text-white shadow transition hover:brightness-110"
                >
                  Open MCAS Platform →
                </Link>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                  Legacy / Direct Tools
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/admin/mcas/applications"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  >
                    Candidate Applications
                  </Link>

                  <Link
                    href="/admin/mcas/create-link"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  >
                    Create Candidate Link
                  </Link>

                  <Link
                    href="/admin/mcas/reverse-profiles"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  >
                    Reverse Profile Sandbox
                  </Link>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/40">
                Open the MCAS Platform to manage organisations, candidate databases,
                reusable test links, and the Validation Centre.
              </div>
            </div>

            {/* QSC */}
            <div className="rounded-2xl border border-white/10 bg-[#0b1724]/60 p-5">
              <div className="text-xs text-white/60">Diagnostics Engine</div>
              <div className="mt-1 text-xl font-semibold">QSC</div>
              <div className="mt-1 text-sm text-white/60">
                Quantum Source Code diagnostics across entrepreneurs and leaders.
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/admin/analytics/orgs"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                >
                  Performance View
                </Link>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/10"
                  title="Placeholder - add QSC admin console later"
                >
                  Admin Console (Coming)
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/40">
                A dedicated QSC admin console can be added later.
              </div>
            </div>
          </div>
        </section>

        {/* Organisations */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Organizations</h2>
              <div className="text-sm text-white/60">
                Manage tenants and open their portals.
              </div>
            </div>
          </div>

          <ul className="grid gap-4 md:grid-cols-2">
            {orgs?.map((org: any) => (
              <li
                key={org.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 shadow-lg"
              >
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-slate-300">{org.slug}</div>
                </div>

                <Link
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2 text-sm font-medium text-white shadow transition hover:brightness-110"
                  href={`/portal/${org.slug}/dashboard`}
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