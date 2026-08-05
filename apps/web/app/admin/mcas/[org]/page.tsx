//apps/web/app/admin/mcas/[org]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatMcasDateTime,
  getMcasOrgDashboardStats,
  getMcasOrganisationBySlug,
} from "@/lib/mcas/mcasAdminData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    org: string;
  };
};

export default async function McasOrgDashboardPage({ params }: PageProps) {
  const org = await getMcasOrganisationBySlug(params.org);

  if (!org) {
    notFound();
  }

  const stats = await getMcasOrgDashboardStats(org.id);

  const cards = [
    {
      label: "Total Candidates",
      value: stats.totalCandidates.toString(),
      note: "Total MCAS applications for this organisation.",
    },
    {
      label: "Completed Assessments",
      value: stats.completedAssessments.toString(),
      note: "Applications with completed status.",
    },
    {
      label: "Open Assessments",
      value: stats.openAssessments.toString(),
      note: "Created or started assessments still not completed.",
    },
    {
      label: "Latest Activity",
      value: formatMcasDateTime(stats.latestActivityAt),
      note: "Most recent MCAS application activity.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Organisation Dashboard
          </p>

          <h2 className="mt-3 text-3xl font-semibold text-white">
            {org.name}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This dashboard is now connected to the MCAS organisation record and
            application counts. Charts and deeper analytics will be added after
            the database page is stable.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium capitalize text-slate-300">
              {org.organisation_type.replaceAll("_", " ")}
            </span>

            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium capitalize text-cyan-200">
              {org.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/mcas/${org.slug}/database`}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Candidate Database
          </Link>

          <Link
            href={`/admin/mcas/${org.slug}/links`}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
          >
            Test Links
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {card.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {card.note}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartPlaceholder
          title="Operating Style Distribution"
          description="Next step: aggregate os_distribution from mcas.results for this organisation."
        />

        <ChartPlaceholder
          title="Career Vertical Distribution"
          description="Next step: aggregate CV output from the scored MCAS result payload."
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>

        <p className="mt-2 text-sm text-slate-400">
          Current latest activity:
          <span className="ml-2 font-medium text-slate-200">
            {formatMcasDateTime(stats.latestActivityAt)}
          </span>
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-sm text-slate-500">
          Activity feed will be added after the candidate database query is
          connected.
        </div>
      </section>
    </div>
  );
}

function ChartPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

      <div className="mt-6 flex h-56 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-900/60 text-sm text-slate-500">
        Chart placeholder
      </div>
    </div>
  );
}