// apps/web/app/admin/mcas/[org]/database/[candidateId]/page.tsx

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatMcasDateTime,
  getMcasCandidateDetailById,
  getMcasOrganisationBySlug,
} from "@/lib/mcas/mcasAdminData";
import { getMcasCandidateReportAccess } from "@/lib/mcas/mcasCandidateReports";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    org: string;
    candidateId: string;
  };
};

export default async function McasCandidateDetailPage({ params }: PageProps) {
  const org = await getMcasOrganisationBySlug(params.org);

  if (!org) {
    notFound();
  }

  const candidate = await getMcasCandidateDetailById({
    orgId: org.id,
    candidateId: params.candidateId,
  });

  if (!candidate) {
    notFound();
  }

  const reportAccess = await getMcasCandidateReportAccess({
    orgId: org.id,
    candidateId: params.candidateId,
  });

  const summaryUrl = `/admin/mcas/${org.slug}/database/${candidate.partnerApplicationId}/summary`;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <Link
          href={`/admin/mcas/${org.slug}/database`}
          className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
        >
          ← Back to candidate database
        </Link>

        <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Candidate Review
            </p>

            <h2 className="mt-3 text-3xl font-semibold text-white">
              {candidate.fullName}
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Internal MCAS review page for this candidate application and
              assessment result.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {reportAccess.isReady && reportAccess.candidateReportUrl ? (
              <a
                href={reportAccess.candidateReportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {reportAccess.candidateReportLabel} ↗
              </a>
            ) : (
              <span
                title={reportAccess.reason ?? undefined}
                className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-slate-500"
              >
                Candidate report pending
              </span>
            )}

            {reportAccess.isReady ? (
              <Link
                href={summaryUrl}
                className="inline-flex items-center justify-center rounded-xl border border-violet-300/40 bg-violet-300/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:border-violet-200 hover:bg-violet-300/20"
              >
                Candidate Summary Report →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {!reportAccess.isReady ? (
        <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-100">
          <span className="font-semibold">Reports are not available yet.</span>{" "}
          {reportAccess.reason ?? "Complete and score the assessment first."}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Status" value={candidate.status} />
        <InfoCard label="Primary OS" value={candidate.primaryOS ?? "—"} />
        <InfoCard label="Secondary OS" value={candidate.secondaryOS ?? "—"} />
        <InfoCard label="Primary CV" value={candidate.primaryCV ?? "—"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Candidate Details">
          <DetailRow label="Name" value={candidate.fullName} />
          <DetailRow label="Email" value={candidate.email ?? "—"} />
          <DetailRow label="Phone" value={candidate.phone ?? "—"} />
          <DetailRow
            label="Consent"
            value={
              candidate.consent === true
                ? "Yes"
                : candidate.consent === false
                  ? "No"
                  : "—"
            }
          />
        </Panel>

        <Panel title="Application Details">
          <DetailRow label="Partner Key" value={candidate.partnerKey} />
          <DetailRow label="Application ID" value={candidate.applicationId} />
          <DetailRow label="Public Token" value={candidate.publicToken} />
          <DetailRow
            label="Assessment Date"
            value={formatMcasDateTime(candidate.assessmentDate)}
          />
        </Panel>

        <Panel title="Assessment Record">
          <DetailRow label="Assessment ID" value={candidate.assessmentId ?? "—"} />
          <DetailRow
            label="Assessment Status"
            value={candidate.assessmentStatus ?? "—"}
          />
          <DetailRow label="Framework" value={candidate.frameworkSlug ?? "—"} />
          <DetailRow
            label="Framework Version"
            value={candidate.frameworkVersion ?? "—"}
          />
        </Panel>

        <Panel title="Readiness / Result">
          <DetailRow label="Result ID" value={candidate.resultId ?? "—"} />
          <DetailRow label="Scoring Model" value={candidate.scoringModel ?? "—"} />
          <DetailRow
            label="Vertical Readiness"
            value={candidate.verticalReadiness ?? "—"}
          />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <JsonPanel
          title="Operating Style Distribution"
          value={candidate.rawOsDistribution}
        />
        <JsonPanel
          title="CORE Distribution"
          value={candidate.rawCoreDistribution}
        />
        <JsonPanel title="Confidence Payload" value={candidate.rawConfidence} />
        <JsonPanel title="Flags" value={candidate.rawFlags} />
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold capitalize text-white">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>

      <pre className="mt-5 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-300">
        {value ? JSON.stringify(value, null, 2) : "No data available."}
      </pre>
    </div>
  );
}
