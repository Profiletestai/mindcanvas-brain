//apps/web/app/admin/mcas/reverse-profiles/page.tsx
import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import CopyTextButton from "./CopyTextButton";

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

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

type SearchParams = {
  partner_key?: string;
  status?: string;
  q?: string;
};

export default async function Page(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const partner_key = String(sp.partner_key || "").trim();
  const status = String(sp.status || "").trim();
  const q = String(sp.q || "").trim();

  const sb = mcasSupa();

  const { data: partners } = await sb
    .from("partners")
    .select("partner_key, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  let query = sb
    .from("reverse_profile_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (partner_key) query = query.eq("partner_key", partner_key);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`job_id.ilike.%${q}%,title.ilike.%${q}%,run_number.ilike.%${q}%`);

  const { data: runs, error } = await query;

  if (error) {
    return (
      <div className="min-h-screen bg-[#060e16] text-white p-8">
        <div className="font-semibold">Reverse Profiles</div>
        <pre className="mt-4 text-sm text-red-300">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }

  const origin = baseUrl();

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/60">Admin • MCAS</div>
            <h1 className="mt-1 text-3xl font-semibold">
              Reverse Profile Sandbox Runs
            </h1>
            <p className="mt-2 text-white/70 max-w-3xl">
              Create, manage, and share reverse-profile sandbox tests for partner
              validation. Each run is tracked as an AI flow record inside MCAS.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/admin/mcas/reverse-profiles/new"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110 transition"
            >
              Create Sandbox Link
            </Link>

            <Link
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-2">Partner</label>
              <select
                name="partner_key"
                defaultValue={partner_key}
                className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2 outline-none"
              >
                <option value="">All partners</option>
                {(partners || []).map((p: any) => (
                  <option key={p.partner_key} value={p.partner_key}>
                    {p.name} ({p.partner_key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2 outline-none"
              >
                <option value="">All statuses</option>
                <option value="draft">draft</option>
                <option value="submitted">submitted</option>
                <option value="scored">scored</option>
                <option value="failed">failed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">
                Search title / job ID / run number
              </label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search..."
                className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2 outline-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <button className="w-full rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition">
                Apply
              </button>
              <Link
                href="/admin/mcas/reverse-profiles"
                className="w-full text-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="text-left px-4 py-3">Run</th>
                <th className="text-left px-4 py-3">Partner</th>
                <th className="text-left px-4 py-3">Framework</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Links</th>
              </tr>
            </thead>
            <tbody>
              {(runs || []).map((run: any) => {
                const testPath = `/mcas/reverse/${run.id}`;
                const resultPath = `/mcas/reverse/${run.id}/result`;
                const testLink = `${origin}${testPath}`;
                const resultLink = `${origin}${resultPath}`;

                return (
                  <tr key={run.id} className="border-t border-white/10 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {run.run_number || "—"} • {run.title || "Untitled run"}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Job ID: {run.job_id || "—"}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Campaign: {run.campaign_id || "—"}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Source: {run.source || "manual"}
                      </div>
                      <div className="mt-2 text-[11px] text-white/35 font-mono break-all">
                        {run.id}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-white/80">
                      {run.partner_key || "—"}
                    </td>

                    <td className="px-4 py-4 text-white/80">
                      <div>{run.framework_slug || "mcas-core-alignment"}</div>
                      <div className="text-xs text-white/50">
                        {run.framework_version || "v1"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">
                        {run.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-white/60">
                      {run.created_at
                        ? new Date(run.created_at).toLocaleString()
                        : "-"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={testPath}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          Open Test
                        </a>

                        <CopyTextButton text={testLink} label="Copy Test Link" />

                        <a
                          href={resultPath}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          Open Result
                        </a>

                        <CopyTextButton text={resultLink} label="Copy Result Link" />
                      </div>

                      <div className="mt-2 text-[11px] text-white/35 break-all">
                        {testLink}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-white/60 text-center">
                    No reverse profile runs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}