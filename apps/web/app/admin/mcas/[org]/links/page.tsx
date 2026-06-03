//apps/web/app/admin/mcas/[org]/links/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  formatMcasDateTime,
  getMcasOrganisationBySlug,
} from "@/lib/mcas/mcasAdminData";
import {
  createMcasReusableTestLink,
  getMcasAdminTestLinks,
} from "@/lib/mcas/mcasTestLinks";

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

  const links = await getMcasAdminTestLinks({
    orgId: org.id,
    limit: 100,
  });

  async function createTestLinkAction(formData: FormData) {
    "use server";

    const freshOrg = await getMcasOrganisationBySlug(params.org);

    if (!freshOrg) {
      throw new Error("MCAS organisation not found.");
    }

    let createdToken: string | null = null;

    try {
      const usageLimitType = readFormString(formData, "usageLimitType");
      const usageLimitCountRaw = readFormString(formData, "usageLimitCount");

      const result = await createMcasReusableTestLink({
        orgId: freshOrg.id,
        linkType: readLinkType(formData),
        name: readFormString(formData, "name") ?? "",
        contactOwnerName: readFormString(formData, "contactOwnerName"),
        recipientEmail: readFormString(formData, "recipientEmail"),
        sendEmail: readFormBoolean(formData, "sendEmail"),
        reportVersion: readReportVersion(formData),
        showResults: readFormBoolean(formData, "showResults"),
        emailReport: readFormBoolean(formData, "emailReport"),
        nextStepsUrl: readFormString(formData, "nextStepsUrl"),
        usageLimitType: usageLimitType === "limited" ? "limited" : "unlimited",
        usageLimitCount:
          usageLimitType === "limited" && usageLimitCountRaw
            ? Number(usageLimitCountRaw)
            : null,
      });

      createdToken = result.publicToken;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create MCAS test link.";

      redirect(
        `/admin/mcas/${freshOrg.slug}/links?error=${encodeURIComponent(message)}`,
      );
    }

    redirect(
      `/admin/mcas/${freshOrg.slug}/links?created=${encodeURIComponent(
        createdToken,
      )}`,
    );
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
          Create Test Link
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-white">{org.name}</h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Create reusable MCAS assessment links for this organisation. The link
          settings are saved in <span className="font-mono">mcas.test_links</span>.
          Candidate records are created only when someone starts the assessment.
        </p>
      </section>

      {createdLink ? (
        <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-6">
          <h3 className="text-lg font-semibold text-emerald-100">
            Test link created
          </h3>

          <p className="mt-2 text-sm text-emerald-50/80">
            Copy and send this reusable MCAS link.
          </p>

          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-slate-950/70 p-4">
            <p className="break-all font-mono text-sm text-emerald-100">
              {createdLink.reusableUrl}
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

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-white/10 bg-white p-6 text-slate-950">
          <form action={createTestLinkAction} className="space-y-5">
            <Field label="Select test">
              <select
                name="linkType"
                defaultValue="candidate_assessment"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-700"
              >
                <option value="candidate_assessment">Candidate Assessment</option>
                <option value="reverse_role_assessment" disabled>
                  Reverse Role Assessment — coming soon
                </option>
                <option value="internal_validation" disabled>
                  Internal Validation — coming soon
                </option>
              </select>
            </Field>

            <Field label="Test name / Test purpose">
              <input
                name="name"
                required
                placeholder="e.g. Software Engineer Team Lead intake"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-700"
              />
            </Field>

            <Field label="Contact owner's name">
              <input
                name="contactOwnerName"
                placeholder="e.g. Sarah Ndlovu"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-700"
              />
            </Field>

            <Field label="Recipient email (optional)">
              <input
                name="recipientEmail"
                type="email"
                placeholder="e.g. person@example.com"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-700"
              />
            </Field>

            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                name="sendEmail"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Send this link to the recipient via email{" "}
                <span className="text-slate-500">(stored now, email send later)</span>
              </span>
            </label>

            <section className="rounded-lg border border-slate-200 p-3">
              <p className="mb-3 text-sm font-semibold text-slate-950">
                Report version
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 p-4 text-slate-400">
                  <input
                    type="radio"
                    name="reportVersion"
                    value="lite"
                    disabled
                    className="sr-only"
                  />
                  <span className="block font-semibold">Lite report</span>
                  <span className="mt-1 block text-xs">
                    Lite report will be added later for MCAS.
                  </span>
                </label>

                <label className="rounded-lg border border-slate-950 bg-slate-950 p-4 text-white">
                  <input
                    type="radio"
                    name="reportVersion"
                    value="full"
                    defaultChecked
                    className="sr-only"
                  />
                  <span className="block font-semibold">Full report</span>
                  <span className="mt-1 block text-xs text-slate-300">
                    Full MCAS candidate alignment output.
                  </span>
                </label>
              </div>
            </section>

            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                name="showResults"
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>Show results to taker after completion</span>
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                name="emailReport"
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>Email the report</span>
            </label>

            <Field label="Next steps URL *">
              <input
                name="nextStepsUrl"
                required
                placeholder="e.g. https://your-site.com/book-a-call"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-700"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                This will be saved as the next-step destination for this link.
              </p>
            </Field>

            <section className="rounded-lg border border-slate-200 p-3">
              <p className="mb-3 text-sm font-semibold text-slate-950">
                Usage limit
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-lg border border-slate-950 bg-slate-950 p-4 text-white">
                  <input
                    type="radio"
                    name="usageLimitType"
                    value="unlimited"
                    defaultChecked
                    className="sr-only"
                  />
                  <span className="block font-semibold">Unlimited</span>
                  <span className="mt-1 block text-xs text-slate-300">
                    Anyone with the link can complete the test, no cap.
                  </span>
                </label>

                <label className="rounded-lg border border-slate-200 bg-white p-4 text-slate-950">
                  <input
                    type="radio"
                    name="usageLimitType"
                    value="limited"
                    className="sr-only"
                  />
                  <span className="block font-semibold">Limited</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    Cap the number of completed submissions.
                  </span>
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Max completed submissions
                </label>
                <input
                  name="usageLimitCount"
                  type="number"
                  min={1}
                  placeholder="Only required if Limited is selected"
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-700"
                />
              </div>
            </section>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Create MCAS test link
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <h3 className="text-lg font-semibold text-white">How this works</h3>

          <div className="mt-5 space-y-4">
            <InfoCard
              title="Reusable link"
              description="The admin creates one reusable MCAS link. The same link can be sent to one person or many people."
            />
            <InfoCard
              title="Candidate record created on start"
              description="When someone starts, MCAS creates a partner application linked back to this test link."
            />
            <InfoCard
              title="Usage limits"
              description="Unlimited links stay open. Limited links stop once the completed submission count reaches the cap."
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Existing Test Links</h3>
          <p className="mt-1 text-sm text-slate-400">
            Latest 100 reusable MCAS links for this organisation.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Test Purpose</th>
                <th className="px-6 py-4 font-semibold">Report</th>
                <th className="px-6 py-4 font-semibold">Usage</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold">Reusable URL</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {links.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No MCAS test links created yet.
                  </td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr key={link.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{link.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {link.contactOwnerName ?? "No contact owner"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-slate-300 capitalize">
                      {link.reportVersion}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                      {link.completedApplications}
                      {link.usageLimitType === "limited" && link.usageLimitCount
                        ? ` / ${link.usageLimitCount}`
                        : " / unlimited"}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium capitalize text-cyan-200">
                        {link.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                      {formatMcasDateTime(link.createdAt)}
                    </td>

                    <td className="max-w-[420px] truncate px-6 py-4">
                      <a
                        href={link.reusableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        {link.reusableUrl}
                      </a>
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

function readFormBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function readLinkType(formData: FormData): "candidate_assessment" {
  const value = readFormString(formData, "linkType");

  if (value === "candidate_assessment") {
    return value;
  }

  return "candidate_assessment";
}

function readReportVersion(formData: FormData): "full" {
  const value = readFormString(formData, "reportVersion");

  if (value === "full") {
    return "full";
  }

  return "full";
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
      <span className="text-sm font-medium text-slate-950">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <h4 className="font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}