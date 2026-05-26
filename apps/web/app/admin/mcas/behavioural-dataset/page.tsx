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

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function badge(value: boolean | null) {
  if (value === true) return "✅ Match";
  if (value === false) return "⚠️ Review";
  return "—";
}

function countBy(rows: Row[], key: keyof Row) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key] || "Unknown");
    out[value] = (out[value] || 0) + 1;
  }
  return out;
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
    typeof params.q === "string" && params.q.trim()
      ? params.q.trim()
      : "";

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
  const needsReview = rows.filter((r) => r.status === "needs_review").length;
  const scored = rows.filter((r) => r.status === "scored").length;

  const expectedOs = countBy(rows, "expected_primary_os");
  const calculatedOs = countBy(rows, "calculated_primary_os");
  const expectedCv = countBy(rows, "expected_primary_cv");
  const calculatedCv = countBy(rows, "calculated_primary_cv");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm text-slate-400">MCAS</p>
          <h1 className="text-3xl font-semibold">Behavioural Dataset</h1>
          <p className="mt-2 max-w-3xl text-slate-300">
            Validation centre for MCAS behavioural dataset rows, expected profiles,
            calculated results, and scoring calibration.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
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
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Rows</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Scored</p>
            <p className="mt-1 text-2xl font-semibold">{scored}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Needs review</p>
            <p className="mt-1 text-2xl font-semibold">{needsReview}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">OS match rate</p>
            <p className="mt-1 text-2xl font-semibold">{pct(osMatches, total)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">CV match rate</p>
            <p className="mt-1 text-2xl font-semibold">{pct(cvMatches, total)}</p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <DistributionCard title="Expected OS" data={expectedOs} />
          <DistributionCard title="Calculated OS" data={calculatedOs} />
          <DistributionCard title="Expected CV" data={expectedCv} />
          <DistributionCard title="Calculated CV" data={calculatedCv} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold">Dataset rows</h2>
            <p className="text-sm text-slate-400">
              Click a row to inspect expected vs calculated results.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
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
                {rows.map((row) => (
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

                {!rows.length ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No rows found.
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

function DistributionCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">
        {entries.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{label}</span>
              <span className="text-slate-400">
                {value} · {pct(value, total)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-white/60"
                style={{ width: pct(value, total) }}
              />
            </div>
          </div>
        ))}

        {!entries.length ? (
          <p className="text-sm text-slate-400">No data</p>
        ) : null}
      </div>
    </div>
  );
}