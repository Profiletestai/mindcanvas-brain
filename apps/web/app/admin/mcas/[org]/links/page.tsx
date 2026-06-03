//apps/web/app/admin/mcas/[org]/links/page.tsx
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  createMcasCandidateAssessmentLink,
  formatMcasDateTime,
  getMcasOrganisationBySlug,
  getMcasTestLinks,
} from "@/lib/mcas/mcasAdminData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    org: string;
  };
  searchParams?: {
    created?: string;
    error?: string;
  };
};

export default async function McasLinksPage({
  params,
  searchParams,
}: PageProps) {
  const org = await getMcasOrganisationBySlug(params.org);

  if (!org) {
    notFound();
  }

  const links = await getMcasTestLinks({
    orgId: org.id,
    limit: 100,
  });

  async function createCandidateLinkAction(formData: FormData) {
    "use server";

    const freshOrg = await getMcasOrganisationBySlug(params.org);

    if (!freshOrg) {
      throw new Error("MCAS organisation not found.");
    }

    try {
      const result = await createMcasCandidateAssessmentLink({
        orgId: freshOrg.id,
        orgSlug: freshOrg.slug,
        applicationId: readFormString(formData, "applicationId"),
        candidateFirstName: readFormString(formData, "candidateFirstName"),
        candidateLastName: readFormString(formData, "candidateLastName"),
        candidateEmail: readFormString(formData, "candidateEmail"),
        candidatePhone: readFormString(formData, "candidatePhone"),
      });

      redirect(
        `/admin/mcas/${freshOrg.slug}/links?created=${encodeURIComponent(
          result.publicToken,
        )}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create MCAS link.";

      redirect(
        `/admin/mcas/${freshOrg.slug}/links?error=${encodeURIComponent(
          message,
        )}`,
      );
    }
  }

  const createdToken =
    typeof searchParams?.created === "string" ? searchParams.created : null;

  const errorMessage =
    typeof searchParams?.error === "string" ? searchParams.error : null;

  const createdLink = createdToken
    ? links.find((link) => link.publicToken === createdToken) ?? null
    : null;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Test Links
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-white">{org.name}</h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Create and manage MCAS candidate assessment links for this organisation.
          Each link creates a record in <span className="font-mono">mcas.partner_applications</span>.
        </p>
      </section>

      {createdLink ? (
        <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-6">
          <h3 className="text-lg font-semibold text-emerald-100">
            Test link created
          </h3>

          <p className="mt-2 text-sm text-emerald-50/80">
            Copy and send this link to the candidate.
          </p>

          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-slate-950/70 p-4">
            <p className="break-all font-mono text-sm text-emerald-100">
              {createdLink.testUrl}
            </p>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-3xl border border-red-300/20 bg-red-300/10 p-6">
          <h3 className="text-lg font-semibold text-red-100">
            Link creation failed
          </h3>
          <p className="mt-2 text-sm text-red-50/80">{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <h3 className="text-lg font-semibold text-white">
            Create Candidate Assessment Link
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Candidate details are optional. Leave Application ID blank to auto-generate one.
          </p>

          <form action={createCandidateLinkAction} className="mt-6 space-y-5">
            <Field label="Application ID">
              <input
                name="applicationId"
                placeholder="Optional, e.g. role-candidate-001"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Candidate First Name">
                <input
                  name="candidateFirstName"
                  placeholder="Optional"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60"
                />
              </Field>

              <Field label="Candidate Last Name">
                <input
                  name="candidateLastName"
                  placeholder="Optional"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60"
                />
              </Field>
            </div>

            <Field label="Candidate Email">
              <input
                name="candidateEmail"
                type="email"
                placeholder="Optional"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60"
              />
            </Field>

            <Field label="Candidate Phone">
              <input
                name="candidatePhone"
                placeholder="Optional"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60"
              />
            </Field>

            <button
              type="submit"
              className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Create candidate test link
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <h3 className="text-lg font-semibold text-white">
            Link Types
          </h3>

          <div className="mt-5 space-y-4">
            <LinkTypeCard
              title="Candidate Assessment"
              description="Connected now. Creates an MCAS candidate application link."
              status="Active"
            />
            <LinkTypeCard
              title="Reverse Role Assessment"
              description="Coming later. This will create a role profile for ideal candidate matching."
              status="Later"
            />
            <LinkTypeCard
              title="Internal Validation"
              description="Coming later. This should connect to the Validation Centre."
              status="Later"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Existing Links</h3>
          <p className="mt-1 text-sm text-slate-400">
            Latest 100 MCAS application links for this organisation.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Candidate / Link</th>
                <th className="px-6 py-4 font-semibold">Application ID</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold">Test URL</th>
                <th className="px-6 py-4 font-semibold">Review</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {links.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No test links created yet.
                  </td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr
                    key={link.id}
                    className="transition hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">
                        {link.candidateFullName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {link.candidateEmail ?? "No email captured"}
                      </p>
                    </td>

                    <td className="max-w-[240px] truncate px-6 py-4 font-mono text-xs text-slate-400">
                      {link.applicationId}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium capitalize text-cyan-200">
                        {link.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                      {formatMcasDateTime(link.createdAt)}
                    </td>

                    <td className="max-w-[320px] truncate px-6 py-4">
                      <a
                        href={link.testUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        {link.testUrl}
                      </a>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/admin/mcas/${org.slug}/database/${link.id}`}
                        className="font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function readFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function LinkTypeCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: "Active" | "Later";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold text-white">{title}</h4>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
          {status}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}