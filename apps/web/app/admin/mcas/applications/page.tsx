//apps/web/app/admin/mcas/applications/page.tsx
import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

type SearchParams = {
  status?: string;
  partner_key?: string;
  q?: string;
};

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const status = (sp.status || "").trim();
  const partner_key = (sp.partner_key || "").trim();
  const q = (sp.q || "").trim();

  const sb = mcasSupa();

  let query = sb
    .from("partner_applications")
    .select(
      "id, partner_key, application_id, org_id, framework_slug, framework_version, status, public_token, created_at, started_at, completed_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (partner_key) query = query.eq("partner_key", partner_key);
  if (q) query = query.ilike("application_id", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return (
      <div className="min-h-screen bg-[#060e16] text-white p-8">
        <div className="font-semibold">MCAS Applications</div>
        <pre className="mt-4 text-sm text-red-300">{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  const rows = data || [];

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Admin</div>
            <h1 className="text-2xl font-semibold mt-1">MCAS Applications</h1>
            <div className="text-white/60 mt-1 text-sm">Showing {rows.length} (latest 200)</div>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-white/60">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
              >
                <option value="">All</option>
                <option value="created">created</option>
                <option value="started">started</option>
                <option value="completed">completed</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Partner key</label>
              <input
                name="partner_key"
                defaultValue={partner_key}
                placeholder="e.g. manual"
                className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Search application_id</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="contains…"
                className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
              >
                Apply
              </button>
              <Link
                href="/admin/mcas/applications"
                className="w-full text-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
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
                <th className="text-left px-4 py-3">Application</th>
                <th className="text-left px-4 py-3">Partner</th>
                <th className="text-left px-4 py-3">Framework</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Candidate link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const link = `${baseUrl()}/mcas/t/${r.public_token}`;
                return (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/mcas/applications/${encodeURIComponent(r.id)}`}
                        className="hover:underline"
                      >
                        <div className="font-medium">{r.application_id}</div>
                        <div className="text-white/50 text-xs">{r.id}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white/80">{r.partner_key}</td>
                    <td className="px-4 py-3 text-white/80">
                      <div>{r.framework_slug}</div>
                      <div className="text-white/50 text-xs">{r.framework_version}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
                        >
                          Open
                        </a>
                        <CopyButton text={link} />
                      </div>
                      <div className="mt-1 text-xs text-white/50 break-all">{link}</div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-white/60" colSpan={6}>
                    No applications found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}