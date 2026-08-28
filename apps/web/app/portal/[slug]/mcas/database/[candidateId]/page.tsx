// apps/web/app/portal/[slug]/mcas/database/[candidateId]/page.tsx
// One candidate's MCAS result: distributions, readiness, confidence, flags.

import Link from "next/link";

import { readDistribution } from "@/lib/mcas/mcasAdminData";
import { getPortalMcasCandidate } from "@/lib/mcas/mcasPortalData";
import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import McasAccessNotice from "../../_components/McasAccessNotice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function McasCandidatePage({
  params,
}: {
  params: { slug: string; candidateId: string };
}) {
  const guard = await requirePortalOrgAccess({
    slug: params.slug,
    permission: "read",
    testSlug: MCAS_TEST_SLUG,
  });

  if (!guard.ok) return <McasAccessNotice failure={guard} />;

  const { org } = guard.access;

  const candidate = await getPortalMcasCandidate(org.id, params.candidateId);

  const listHref = `/portal/${encodeURIComponent(org.slug)}/mcas/database`;

  // Ownership is part of the query, so "belongs to another org" and "does not
  // exist" are the same answer here.
  if (!candidate) {
    return (
      <div className="p-6">
        <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold">Candidate not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            This candidate does not belong to {org.name ?? org.slug}.
          </p>
          <Link href={listHref} className="mt-4 inline-block text-sm text-sky-700 underline">
            Back to candidates
          </Link>
        </div>
      </div>
    );
  }

  const core = readDistribution(candidate.rawCoreDistribution);
  const operatingStyles = readDistribution(candidate.rawOsDistribution);
  const confidence = asRecord(candidate.rawConfidence);
  const flags = Array.isArray(candidate.rawFlags) ? candidate.rawFlags : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href={listHref} className="text-sm text-sky-700 underline">
          ← Candidates
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{candidate.fullName}</h1>

        <p className="mt-1 text-sm text-gray-600">
          {candidate.email ?? "No email"} · {candidate.status}
          {candidate.testLinkName ? ` · ${candidate.testLinkName}` : ""}
        </p>
      </div>

      {candidate.reportReady ? (
        <section className="flex flex-wrap gap-3">
          <a
            href={candidate.primaryReportUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Open full report
          </a>

          {/* Only rendered when the link lets the candidate see their result —
              the snapshot page 404s otherwise. */}
          {candidate.snapshotUrl ? (
            <a
              href={candidate.snapshotUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Snapshot
            </a>
          ) : null}
        </section>
      ) : (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {candidate.reportReason}
        </p>
      )}

      {candidate.resultId ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Readiness" value={candidate.verticalReadiness ?? "—"} />
            <Stat label="Primary style" value={candidate.primaryOS ?? "—"} />
            <Stat
              label="Secondary style"
              value={candidate.secondaryOS ?? "—"}
            />
          </section>

          <Distribution title="Core alignment" rows={core} />
          <Distribution title="Operating styles" rows={operatingStyles} />

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold">Confidence</h2>

            {confidence ? (
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {Object.entries(flattenConfidence(confidence)).map(
                  ([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <dt className="text-gray-500">{humanise(key)}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ),
                )}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Not recorded.</p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold">Flags</h2>

            {flags.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No flags raised.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {flags.map((flag, index) => {
                  const record = asRecord(flag);

                  return (
                    <li
                      key={index}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"
                    >
                      {record
                        ? String(record.label ?? record.code ?? "Flag")
                        : String(flag)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          This candidate has not completed the assessment yet.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Distribution({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ code: string; value: number }>;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold">{title}</h2>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Not recorded.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.code} className="text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-medium">{row.code}</span>
                <span className="text-gray-600">{formatShare(row.value)}</span>
              </div>

              <div className="mt-1 h-2 rounded bg-gray-100">
                <div
                  className="h-2 rounded bg-gray-900"
                  style={{ width: `${clampPercent(row.value)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Stored shares are fractions (0.42) in some rows and percentages elsewhere. */
function clampPercent(value: number): number {
  const percent = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, percent));
}

function formatShare(value: number): string {
  return `${clampPercent(value).toFixed(1)}%`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** confidence is { rating, signals: { … } }; render it as one flat list. */
function flattenConfidence(
  confidence: Record<string, unknown>,
): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(confidence)) {
    const nested = asRecord(value);

    if (nested) {
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        flat[nestedKey] = String(nestedValue);
      }
      continue;
    }

    flat[key] = String(value);
  }

  return flat;
}

function humanise(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
