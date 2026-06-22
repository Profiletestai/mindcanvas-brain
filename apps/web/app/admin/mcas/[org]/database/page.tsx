// apps/web/app/admin/mcas/[org]/database/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatMcasDateTime,
  getMcasCandidateDatabaseRows,
  getMcasOrganisationBySlug,
} from "@/lib/mcas/mcasAdminData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    org: string;
  };
  searchParams?: {
    q?: string;
    status?: string;
  };
};

function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

export default async function McasCandidateDatabasePage({
  params,
  searchParams,
}: PageProps) {
  const org = await getMcasOrganisationBySlug(params.org);

  if (!org) {
    notFound();
  }

  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const status =
    typeof searchParams?.status === "string" ? searchParams.status : "all";

  const candidates = await getMcasCandidateDatabaseRows({
    orgId: org.id,
    query: q,
    status,
  });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Candidate Database
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-white">{org.name}</h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This is the organisation-specific MCAS candidate database. It is filtered
          by the selected MCAS organisation and reads from the MCAS schema.
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          Showing <span className="font-semibold text-white">{candidates.length}</span>{" "}
          candidate/application record{candidates.length === 1 ? "" : "s"}.
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" method="get">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Search
            </span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, email, application ID, OS, CV..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Status
            </span>
            <select
              name="status"
              defaultValue={status}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
            >
              <option value="all">All statuses</option>
              <option value="created">Created</option>
              <option value="started">Started</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Filter
            </button>

            <Link
              href={`/admin/mcas/${org.slug}/database`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-300 hover:border-white/30 hover:text-white"
            >
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Candidates</h3>
          <p className="mt-1 text-sm text-slate-400">
            Candidate list pulled from MCAS applications, assessments, and result records.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Application ID</th>
                <th className="px-6 py-4 font-semibold">Assessment Date</th>
                <th className="px-6 py-4 font-semibold">Primary OS</th>
                <th className="px-6 py-4 font-semibold">Secondary OS</th>
                <th className="px-6 py-4 font-semibold">Primary CV</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No MCAS candidate records found for this filter.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate, index) => {
                  const candidateId = isUuid(candidate.partnerApplicationId)
                    ? candidate.partnerApplicationId
                    : null;

                  return (
                    <tr
                      key={
                        candidateId ??
                        `${candidate.applicationId || "candidate"}-${index}`
                      }
                      className="transition hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-white">
                        {candidate.fullName}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                        {candidate.email ?? "—"}
                      </td>

                      <td className="max-w-[240px] truncate px-6 py-4 font-mono text-xs text-slate-400">
                        {candidate.applicationId}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                        {formatMcasDateTime(candidate.assessmentDate)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                        {candidate.primaryOS ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                        {candidate.secondaryOS ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                        {candidate.primaryCV ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium capitalize text-cyan-200">
                          {candidate.status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        {candidateId ? (
                          <Link
                            href={`/admin/mcas/${org.slug}/database/${candidateId}`}
                            prefetch={false}
                            className="font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            Review →
                          </Link>
                        ) : (
                          <span
                            title="This row does not have a linked partner application record yet."
                            className="cursor-not-allowed text-sm font-semibold text-slate-500"
                          >
                            Review unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}