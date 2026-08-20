//apps/web/app/mcas/link/[token]/page.tsx
import { redirect } from "next/navigation";
import {
  buildMcasCandidateApplicationUrl,
  createMcasApplicationFromReusableLink,
  getMcasPublicTestLinkStatus,
} from "@/lib/mcas/mcasTestLinks";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    error?: string;
  };
};

export default async function McasReusableLinkPage({
  params,
  searchParams,
}: PageProps) {
  const status = await getMcasPublicTestLinkStatus(params.token);

  const startError = searchParams?.error?.trim() || null;

  async function startAssessmentAction() {
    "use server";

    let applicationPublicToken: string;

    try {
      const result = await createMcasApplicationFromReusableLink(params.token);
      applicationPublicToken = result.applicationPublicToken;
    } catch (caught) {
      // Most likely the owning portal organisation is out of assessment
      // credits. Show the candidate why rather than an error boundary.
      const message =
        caught instanceof Error
          ? caught.message
          : "This assessment could not be started.";

      redirect(
        `/mcas/link/${params.token}?error=${encodeURIComponent(message)}`,
      );
    }

    redirect(buildMcasCandidateApplicationUrl(applicationPublicToken));
  }

  if (!status.ok) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
        <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            MCAS Assessment
          </p>

          <h1 className="mt-4 text-3xl font-semibold">Link unavailable</h1>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            {status.message}
          </p>
        </section>
      </main>
    );
  }

  const { link, organisation, completedApplications } = status;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          MCAS Assessment
        </p>

        <h1 className="mt-4 text-3xl font-semibold">{link.name}</h1>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          You are about to start an MCAS assessment for{" "}
          <span className="font-semibold text-white">{organisation.name}</span>.
        </p>

        <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-sm">
          <InfoRow label="Assessment type" value="Candidate Assessment" />
          <InfoRow label="Report version" value={link.report_version} />
          <InfoRow
            label="Completed submissions"
            value={completedApplications.toString()}
          />
        </div>

        {startError ? (
          <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-100">
            {startError}
          </p>
        ) : null}

        <form action={startAssessmentAction} className="mt-8">
          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Start assessment
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Your assessment record will be created when you click Start assessment.
        </p>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium capitalize text-slate-200">
        {value}
      </span>
    </div>
  );
}