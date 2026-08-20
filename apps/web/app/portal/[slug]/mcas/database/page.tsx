// apps/web/app/portal/[slug]/mcas/database/page.tsx
// Organisation-scoped MCAS candidate list.

import Link from "next/link";

import { listPortalMcasCandidates } from "@/lib/mcas/mcasPortalData";
import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import McasAccessNotice from "../_components/McasAccessNotice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

const STATUS_FILTERS = ["all", "created", "started", "completed"] as const;

export default async function McasDatabasePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  const guard = await requirePortalOrgAccess({
    slug: params.slug,
    permission: "read",
    testSlug: MCAS_TEST_SLUG,
  });

  if (!guard.ok) return <McasAccessNotice failure={guard} />;

  const { org } = guard.access;

  const q = (searchParams.q ?? "").trim();
  const status = (searchParams.status ?? "all").trim();
  const page = Math.max(Number.parseInt(searchParams.page ?? "1", 10) || 1, 1);

  const result = await listPortalMcasCandidates(org.id, {
    query: q || null,
    status,
    page,
    pageSize: 25,
  });

  const basePath = `/portal/${encodeURIComponent(org.slug)}/mcas/database`;

  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status && status !== "all") search.set("status", status);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">MCAS candidates</h1>
        <p className="mt-1 text-sm text-gray-600">
          {result.total} candidate{result.total === 1 ? "" : "s"} for{" "}
          {org.name ?? org.slug}.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, email or application ID"
            className="w-72 rounded border border-gray-300 p-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="rounded border border-gray-300 p-2 text-sm"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All" : value}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white">
        {result.rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">
            No candidates match.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2">Candidate</th>
                <th className="px-5 py-2">Email</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Primary style</th>
                <th className="px-5 py-2">Readiness</th>
                <th className="px-5 py-2">Date</th>
              </tr>
            </thead>

            <tbody>
              {result.rows.map((row) => (
                <tr
                  key={row.partnerApplicationId}
                  className="border-t border-gray-100"
                >
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`${basePath}/${row.partnerApplicationId}`}
                      className="text-sky-700 underline"
                    >
                      {row.fullName}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{row.email ?? "—"}</td>
                  <td className="px-5 py-3 capitalize">{row.status}</td>
                  <td className="px-5 py-3">{row.primaryOS ?? "—"}</td>
                  <td className="px-5 py-3">{row.verticalReadiness ?? "—"}</td>
                  <td className="px-5 py-3">
                    {formatDate(row.assessmentDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="text-sky-700 underline">
            Previous
          </Link>
        ) : null}

        <span className="text-gray-500">Page {result.page}</span>

        {result.hasMore ? (
          <Link href={pageHref(page + 1)} className="text-sky-700 underline">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
