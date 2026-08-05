//apps/web/app/admin/mcas/page.tsx
import Link from "next/link";
import {
  formatMcasDate,
  getMcasOrganisationSummaries,
} from "@/lib/mcas/mcasAdminData";

export const dynamic = "force-dynamic";

export default async function McasHomePage() {
  const organisations = await getMcasOrganisationSummaries();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            MCAS
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            MindCanvas Alignment System
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-300">
            MCAS is now structured as its own recruitment and alignment platform.
            Organisations are loaded from the MCAS schema, not hard-coded in the app.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h3 className="text-xl font-semibold text-white">
              MCAS Organisations
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Select an organisation to access its dashboard, candidate database,
              links, and future role-alignment tools.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
            {organisations.length} organisation
            {organisations.length === 1 ? "" : "s"}
          </div>
        </div>

        {organisations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <h4 className="text-lg font-semibold text-white">
              No MCAS organisations found
            </h4>
            <p className="mt-2 text-sm text-slate-400">
              Add records to mcas.organisations to show organisations here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {organisations.map((org) => (
              <Link
                key={org.id}
                href={`/admin/mcas/${org.slug}`}
                className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-cyan-300/60 hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {org.organisation_type.replaceAll("_", " ")}
                    </p>

                    <h4 className="mt-2 text-2xl font-semibold text-white">
                      {org.name}
                    </h4>
                  </div>

                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium capitalize text-cyan-200">
                    {org.status}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <MiniStat
                    label="Total"
                    value={org.total_applications.toString()}
                  />
                  <MiniStat
                    label="Completed"
                    value={org.completed_applications.toString()}
                  />
                  <MiniStat
                    label="Open"
                    value={org.open_applications.toString()}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <p className="text-xs text-slate-500">
                    Created {formatMcasDate(org.created_at)}
                  </p>
                  <span className="text-sm font-semibold text-cyan-300 group-hover:text-cyan-200">
                    Open organisation →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6">
        <h3 className="text-lg font-semibold text-amber-100">
          Scoring Guardrail
        </h3>

        <p className="mt-2 text-sm leading-6 text-amber-50/80">
          This platform shell does not change MCAS scoring. The scoring source of
          truth remains{" "}
          <span className="font-mono">
            apps/web/lib/mcas/scoreMcasV2.ts
          </span>
          .
        </p>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}