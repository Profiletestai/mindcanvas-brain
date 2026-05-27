//apps/web/app/admin/mcas/behavioural-dataset/page.tsx
import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

type Row = {
  id: string;
  row_number: number | null;
  dataset_version: string;
  job_title: string;
  expected_primary_os: string | null;
  expected_primary_cv: string | null;
  calculated_primary_os: string | null;
  calculated_primary_cv: string | null;
  os_match: boolean | null;
  cv_match: boolean | null;
  status: string;
};

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function clean(value: string | null | undefined) {
  return value || "Unknown";
}

function countBy(rows: Row[], getKey: (row: Row) => string) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    out[key] = (out[key] || 0) + 1;
  }
  return Object.entries(out)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function clusterRows(rows: Row[], type: "os" | "cv") {
  const map: Record<string, { expected: string; calculated: string; count: number }> = {};

  for (const row of rows) {
    const match = type === "os" ? row.os_match : row.cv_match;
    if (match === true) continue;

    const expected =
      type === "os" ? clean(row.expected_primary_os) : clean(row.expected_primary_cv);
    const calculated =
      type === "os" ? clean(row.calculated_primary_os) : clean(row.calculated_primary_cv);

    const key = `${expected} → ${calculated}`;

    map[key] = map[key] || { expected, calculated, count: 0 };
    map[key].count += 1;
  }

  return Object.values(map).sort((a, b) => b.count - a.count);
}

function badge(value: boolean | null) {
  if (value === true) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
        Match
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
        Review
      </span>
    );
  }

  return <span className="text-slate-500">—</span>;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};

  const version =
    typeof params.version === "string" && params.version.trim()
      ? params.version.trim()
      : "v1";

  const status =
    typeof params.status === "string" && params.status.trim()
      ? params.status.trim()
      : "";

  const q =
    typeof params.q === "string" && params.q.trim() ? params.q.trim() : "";

  const sb = mcasSupa();

  let query = sb
    .from("behavioural_dataset")
    .select(
      "id,row_number,dataset_version,job_title,expected_primary_os,expected_primary_cv,calculated_primary_os,calculated_primary_cv,os_match,cv_match,status"
    )
    .eq("dataset_version", version)
    .order("row_number", { ascending: true })
    .limit(1000);

  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("job_title", `%${q}%`);

  const { data, error } = await query;
  const rows = (data || []) as Row[];

  const total = rows.length;
  const osMatches = rows.filter((r) => r.os_match === true).length;
  const cvMatches = rows.filter((r) => r.cv_match === true).length;
  const bothMatch = rows.filter((r) => r.os_match === true && r.cv_match === true).length;
  const needsReview = rows.filter((r) => r.status === "needs_review").length;

  const expectedOs = countBy(rows, (r) => clean(r.expected_primary_os));
  const calculatedOs = countBy(rows, (r) => clean(r.calculated_primary_os));
  const expectedCv = countBy(rows, (r) => clean(r.expected_primary_cv));
  const calculatedCv = countBy(rows, (r) => clean(r.calculated_primary_cv));

  const osClusters = clusterRows(rows, "os").slice(0, 12);
  const cvClusters = clusterRows(rows, "cv").slice(0, 12);

  const reviewRows = rows
    .filter((r) => r.os_match === false || r.cv_match === false)
    .slice(0, 80);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm text-slate-400">MCAS Calibration</p>
          <h1 className="text-3xl font-semibold">Behavioural Dataset</h1>
          <p className="mt-2 max-w-4xl text-slate-300">
            This dashboard compares Daniel’s canonical behavioural dataset against
            the current MCAS scorer. It is used to identify scorer drift, OS/CV
            mismatch patterns, and calibration priorities.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {error.message}
          </div>
        ) : null}

        <form className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Dataset version</label>
            <input
              name="version"
              defaultValue={version}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Status</label>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="imported">Imported</option>
              <option value="scored">Scored</option>
              <option value="needs_review">Needs review</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Search job title</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search..."
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">
              Apply filters
            </button>
          </div>
        </form>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <MetricCard label="Dataset rows" value={String(total)} />
          <MetricCard label="OS match rate" value={percent(osMatches, total)} sub={`${osMatches}/${total}`} />
          <MetricCard label="CV match rate" value={percent(cvMatches, total)} sub={`${cvMatches}/${total}`} />
          <MetricCard label="Both OS + CV match" value={percent(bothMatch, total)} sub={`${bothMatch}/${total}`} />
          <MetricCard label="Needs review" value={String(needsReview)} />
        </section>

        <section className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <h2 className="text-lg font-semibold text-amber-100">What this means</h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/85">
            The dataset is the canonical behavioural benchmark. Low match rates do
            not mean the dataset is wrong. They show where the current scorer is
            drifting from Daniel’s intended psychometric interpretation. Use the
            mismatch clusters below to decide what Daniel should review first.
          </p>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <ClusterCard
            title="Top OS mismatch clusters"
            description="Where the scorer most often disagrees with the expected Operating Style."
            clusters={osClusters}
            type="os"
          />

          <ClusterCard
            title="Top CV mismatch clusters"
            description="Where the scorer most often disagrees with the expected Career Vertical."
            clusters={cvClusters}
            type="cv"
          />
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <DistributionCard title="Expected OS" data={expectedOs} total={total} />
          <DistributionCard title="Calculated OS" data={calculatedOs} total={total} />
          <DistributionCard title="Expected CV" data={expectedCv} total={total} />
          <DistributionCard title="Calculated CV" data={calculatedCv} total={total} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold">Review queue</h2>
            <p className="text-sm text-slate-400">
              These are rows where the scorer disagrees with the benchmark. Start
              with repeated mismatch clusters, not isolated rows.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Expected OS</th>
                  <th className="px-4 py-3">Calculated OS</th>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Expected CV</th>
                  <th className="px-4 py-3">Calculated CV</th>
                  <th className="px-4 py-3">CV</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody>
                {reviewRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-400">{row.row_number}</td>
                    <td className="px-4 py-3 font-medium">{row.job_title}</td>
                    <td className="px-4 py-3">{row.expected_primary_os || "—"}</td>
                    <td className="px-4 py-3">{row.calculated_primary_os || "—"}</td>
                    <td className="px-4 py-3">{badge(row.os_match)}</td>
                    <td className="px-4 py-3">{row.expected_primary_cv || "—"}</td>
                    <td className="px-4 py-3">{row.calculated_primary_cv || "—"}</td>
                    <td className="px-4 py-3">{badge(row.cv_match)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/mcas/behavioural-dataset/${row.id}`}
                        className="text-sky-300 hover:text-sky-200"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}

                {!reviewRows.length ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No review rows found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ClusterCard({
  title,
  description,
  clusters,
  type,
}: {
  title: string;
  description: string;
  clusters: Array<{ expected: string; calculated: string; count: number }>;
  type: "os" | "cv";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="space-y-2">
        {clusters.map((cluster) => {
          const href =
            type === "os"
              ? `/admin/mcas/behavioural-dataset?status=needs_review&q=&version=v1`
              : `/admin/mcas/behavioural-dataset?status=needs_review&q=&version=v1`;

          return (
            <div
              key={`${cluster.expected}-${cluster.calculated}`}
              className="flex items-center justify-between rounded-xl bg-white/5 p-3"
            >
              <div>
                <p className="font-medium">
                  {cluster.expected}{" "}
                  <span className="text-slate-500">→</span>{" "}
                  {cluster.calculated}
                </p>
                <p className="text-xs text-slate-400">
                  Expected vs calculated drift
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{cluster.count}</p>
                <p className="text-xs text-slate-500">rows</p>
              </div>
            </div>
          );
        })}

        {!clusters.length ? (
          <p className="text-sm text-slate-400">No mismatch clusters found.</p>
        ) : null}
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  data,
  total,
}: {
  title: string;
  data: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{item.label}</span>
              <span className="text-slate-400">
                {item.count} · {percent(item.count, total)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-white/60"
                style={{ width: percent(item.count, total) }}
              />
            </div>
          </div>
        ))}

        {!data.length ? <p className="text-sm text-slate-400">No data</p> : null}
      </div>
    </div>
  );
}