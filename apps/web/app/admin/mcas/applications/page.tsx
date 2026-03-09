//apps/web/app/admin/mcas/applications/page.tsx
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

type SearchParams = {
  status?: string;
  partner_key?: string;
  q?: string;
};

export default async function Page(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const status = String(sp.status || "").trim();
  const partner_key = String(sp.partner_key || "").trim();
  const q = String(sp.q || "").trim();

  const sb = mcasSupa();

  const { data: partners } = await sb
    .from("partners")
    .select("partner_key, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  let query = sb
    .from("partner_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (partner_key) query = query.eq("partner_key", partner_key);
  if (q) {
    query = query.or(
      [
        `application_id.ilike.%${q}%`,
        `candidate_first_name.ilike.%${q}%`,
        `candidate_last_name.ilike.%${q}%`,
        `candidate_email.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data: rows, error } = await query;

  if (error) {
    return (
      <div className="min-h-screen bg-[#060e16] text-white p-8">
        <div className="font-semibold">MCAS Applications</div>
        <pre className="mt-4 text-sm text-red-300">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/60">Admin • MCAS</div>
            <h1 className="mt-1 text-3xl font-semibold">Candidate Applications</h1>
            <p className="mt-2 text-white/70 max-w-3xl">
              View all real candidate submissions, application status, and open the
              scored MCAS result for each person.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/admin/mcas/create-link"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110 transition"
            >
              Create Candidate Link
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
              <label className="block text-xs text-white/60 mb-2">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2 outline-none"
              >
                <option value="">All statuses</option>
                <option value="created">created</option>
                <option value="started">started</option>
                <option value="completed">completed</option>
                <option value="expired">expired</option>
              </select>
            </div>

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
              <label className="block text-xs text-white/60 mb-2">
                Search candidate / application
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
                href="/admin/mcas/applications"
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
                <th className="text-left px-4 py-3">Candidate</th>
                <th className="text-left px-4 py-3">Application</th>
                <th className="text-left px-4 py-3">Partner</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Completed</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((row: any) => {
                const candidateName = [row.candidate_first_name, row.candidate_last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim();

                return (
                  <tr key={row.id} className="border-t border-white/10 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium">{candidateName || "Unnamed candidate"}</div>
                      <div className="mt-1 text-xs text-white/50">
                        {row.candidate_email || "—"}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {row.candidate_phone || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium">{row.application_id || "—"}</div>
                      <div className="mt-1 text-xs text-white/50">
                        {row.framework_slug || "mcas-core-alignment"} {row.framework_version || "v1"}
                      </div>
                      <div className="mt-2 text-[11px] text-white/35 font-mono break-all">
                        {row.id}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-white/80">
                      {row.partner_key || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">
                        {row.status || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-white/60">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </td>

                    <td className="px-4 py-4 text-white/60">
                      {row.completed_at ? new Date(row.completed_at).toLocaleString() : "-"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/mcas/applications/${row.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
                        >
                          Open Result
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-white/60 text-center">
                    No candidate applications found.
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