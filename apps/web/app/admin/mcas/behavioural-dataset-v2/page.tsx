// apps/web/app/admin/mcas/behavioural-dataset-v2/page.tsx
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
  job_description: string | null;
  expected_primary_os: string | null;
  expected_secondary_os: string | null;
  expected_tertiary_os: string | null;
  expected_primary_cv: string | null;
  expected_secondary_cv: string | null;
  calculated_result: any;
};

function pct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function precisePct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function normaliseCv(value: unknown): string {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return "—";
  if (raw.includes("1") && raw.includes("2")) return "CV1–2";
  if (raw.includes("5") && raw.includes("6")) return "CV5–6";
  const match = raw.match(/(?:CV|V)\s*([1-6])/);
  return match ? `CV${match[1]}` : raw;
}

function getRoleAlignment(row: Row) {
  return row.calculated_result?.role_alignment || null;
}

function getFitBand(row: Row) {
  return getRoleAlignment(row)?.fit_band || "not_scored";
}

function readableBand(band: string) {
  return band
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOverall(row: Row) {
  return Number(getRoleAlignment(row)?.overall_alignment_pct || 0);
}

function getOsPct(row: Row) {
  return Number(getRoleAlignment(row)?.os_alignment?.pct || 0);
}

function getCvPct(row: Row) {
  return Number(getRoleAlignment(row)?.cv_alignment?.pct || 0);
}

function actualOs(row: Row) {
  const os = getRoleAlignment(row)?.actual?.os;
  if (Array.isArray(os) && os.length) return os.join(" / ");

  const ranking = row.calculated_result?.scoring?.operating_style_ranking || [];
  return ranking
    .filter((item: any) => Number(item?.pct || 0) > 0)
    .slice(0, 3)
    .map((item: any) => item.code)
    .join(" / ") || "—";
}

function actualCv(row: Row) {
  const cv = getRoleAlignment(row)?.actual?.cv;
  if (Array.isArray(cv) && cv.length) return cv.join(" / ");

  const ranking = row.calculated_result?.scoring?.career_vertical_ranking || [];
  return ranking
    .filter((item: any) => Number(item?.pct || 0) > 0)
    .slice(0, 2)
    .map((item: any) => normaliseCv(item.code))
    .join(" / ") || "—";
}

function expectedOs(row: Row) {
  return [
    row.expected_primary_os,
    row.expected_secondary_os,
    row.expected_tertiary_os,
  ]
    .filter(Boolean)
    .join(" / ") || "—";
}

function expectedCv(row: Row) {
  return [row.expected_primary_cv, row.expected_secondary_cv]
    .filter(Boolean)
    .map(normaliseCv)
    .join(" / ") || "—";
}

function bandClass(band: string) {
  if (band === "excellent_fit") return "bg-emerald-500/15 text-emerald-200";
  if (band === "strong_fit") return "bg-sky-500/15 text-sky-200";
  if (band === "moderate_fit") return "bg-amber-500/15 text-amber-200";
  if (band === "low_fit") return "bg-orange-500/15 text-orange-200";
  if (band === "poor_fit") return "bg-red-500/15 text-red-200";
  return "bg-white/10 text-slate-300";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
      : "v2";

  const band =
    typeof params.band === "string" && params.band.trim()
      ? params.band.trim()
      : "all";

  const os =
    typeof params.os === "string" && params.os.trim() ? params.os.trim() : "all";

  const cv =
    typeof params.cv === "string" && params.cv.trim() ? params.cv.trim() : "all";

  const q =
    typeof params.q === "string" && params.q.trim() ? params.q.trim() : "";

  const sb = mcasSupa();

  let query = sb
    .from("behavioural_dataset")
    .select(
      "id,row_number,dataset_version,job_title,job_description,expected_primary_os,expected_secondary_os,expected_tertiary_os,expected_primary_cv,expected_secondary_cv,calculated_result"
    )
    .eq("dataset_version", version)
    .order("row_number", { ascending: true })
    .limit(5000);

  if (q) query = query.ilike("job_title", `%${q}%`);

  const { data, error } = await query;
  const allRows = ((data || []) as Row[]).filter((row) => row.calculated_result);

  const filteredRows = allRows.filter((row) => {
    const rowBand = getFitBand(row);
    const rowExpectedOs = expectedOs(row);
    const rowExpectedCv = expectedCv(row);

    if (band !== "all" && rowBand !== band) return false;
    if (os !== "all" && !rowExpectedOs.includes(os)) return false;
    if (cv !== "all" && !rowExpectedCv.includes(normaliseCv(cv))) return false;
    return true;
  });

  const total = allRows.length;
  const excellent = allRows.filter((row) => getFitBand(row) === "excellent_fit").length;
  const strong = allRows.filter((row) => getFitBand(row) === "strong_fit").length;
  const moderate = allRows.filter((row) => getFitBand(row) === "moderate_fit").length;
  const low = allRows.filter((row) => getFitBand(row) === "low_fit").length;
  const poor = allRows.filter((row) => getFitBand(row) === "poor_fit").length;

  const validationSuccess = total ? ((excellent + strong) / total) * 100 : 0;
  const avgOverall = average(allRows.map(getOverall));
  const avgOs = average(allRows.map(getOsPct));
  const avgCv = average(allRows.map(getCvPct));

  const exportHref = `/api/admin/mcas/behavioural-dataset-v2/export?version=${encodeURIComponent(
    version
  )}${band !== "all" ? `&band=${encodeURIComponent(band)}` : ""}${
    q ? `&q=${encodeURIComponent(q)}` : ""
  }`;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm text-slate-400">MCAS v2</p>
            <h1 className="text-3xl font-semibold">Role Alignment Validation</h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              Validation dashboard for MCAS v2 distribution scoring and role alignment.
            </p>
          </div>

          <a
            href={exportHref}
            className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          >
            Export CSV
          </a>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {error.message}
          </div>
        ) : null}

        <form className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Dataset version</label>
            <input
              name="version"
              defaultValue={version}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Fit band</label>
            <select
              name="band"
              defaultValue={band}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="excellent_fit">Excellent</option>
              <option value="strong_fit">Strong</option>
              <option value="moderate_fit">Moderate</option>
              <option value="low_fit">Low</option>
              <option value="poor_fit">Poor</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Expected OS</label>
            <select
              name="os"
              defaultValue={os}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              {Array.from({ length: 8 }, (_, i) => `OS${i + 1}`).map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Expected CV</label>
            <select
              name="cv"
              defaultValue={cv}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="CV1_2">CV1–2</option>
              <option value="CV3">CV3</option>
              <option value="CV4">CV4</option>
              <option value="CV5_6">CV5–6</option>
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

          <div className="md:col-span-5">
            <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">
              Apply filters
            </button>
          </div>
        </form>

        <section className="mb-8 grid gap-4 md:grid-cols-6">
          <MetricCard label="Rows" value={String(total)} sub={`Showing ${filteredRows.length}`} />
          <MetricCard label="Validation success" value={precisePct(validationSuccess)} sub="Excellent + Strong" />
          <MetricCard label="Excellent" value={String(excellent)} sub={precisePct(total ? (excellent / total) * 100 : 0)} />
          <MetricCard label="Strong" value={String(strong)} sub={precisePct(total ? (strong / total) * 100 : 0)} />
          <MetricCard label="Moderate" value={String(moderate)} sub={precisePct(total ? (moderate / total) * 100 : 0)} />
          <MetricCard label="Avg alignment" value={precisePct(avgOverall)} sub={`OS ${precisePct(avgOs)} · CV ${precisePct(avgCv)}`} />
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <FitBandCard label="Excellent" count={excellent} total={total} band="excellent_fit" />
          <FitBandCard label="Strong" count={strong} total={total} band="strong_fit" />
          <FitBandCard label="Moderate" count={moderate} total={total} band="moderate_fit" />
          <FitBandCard label="Low" count={low} total={total} band="low_fit" />
          <FitBandCard label="Poor" count={poor} total={total} band="poor_fit" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold">Validation rows</h2>
            <p className="text-sm text-slate-400">
              Showing {filteredRows.length} roles. Click a row to inspect the scoring audit.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Expected OS</th>
                  <th className="px-4 py-3">Actual OS</th>
                  <th className="px-4 py-3">OS Align</th>
                  <th className="px-4 py-3">Expected CV</th>
                  <th className="px-4 py-3">Actual CV</th>
                  <th className="px-4 py-3">CV Align</th>
                  <th className="px-4 py-3">Overall</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const rowBand = getFitBand(row);

                  return (
                    <tr key={row.id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-400">{row.row_number}</td>
                      <td className="px-4 py-3 font-medium">{row.job_title}</td>
                      <td className="px-4 py-3">{expectedOs(row)}</td>
                      <td className="px-4 py-3">{actualOs(row)}</td>
                      <td className="px-4 py-3">{pct(getOsPct(row))}</td>
                      <td className="px-4 py-3">{expectedCv(row)}</td>
                      <td className="px-4 py-3">{actualCv(row)}</td>
                      <td className="px-4 py-3">{pct(getCvPct(row))}</td>
                      <td className="px-4 py-3 font-semibold">{pct(getOverall(row))}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs ${bandClass(rowBand)}`}>
                          {readableBand(rowBand)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/mcas/behavioural-dataset-v2/${row.id}`}
                          className="text-sky-300 hover:text-sky-200"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
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

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function FitBandCard({ label, count, total, band }: { label: string; count: number; total: number; band: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">{label}</p>
        <span className={`rounded-full px-2 py-1 text-xs ${bandClass(band)}`}>{count}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-white/70"
          style={{ width: precisePct(total ? (count / total) * 100 : 0) }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{precisePct(total ? (count / total) * 100 : 0)}</p>
    </div>
  );
}