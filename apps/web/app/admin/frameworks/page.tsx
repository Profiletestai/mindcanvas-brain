//apps/web/app/admin/frameworks/page.tsx
import "server-only";
import Link from "next/link";
import { getServiceClient } from "@/app/_lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type FrameworkRow = {
  id: string;
  slug: string;
  name: string | null;
  status: string | null;
  created_at: string;
};

export default async function Page() {
  const sb = getServiceClient();

  const { data, error } = await sb
    .schema("portal")
    .from("frameworks")
    .select("id, slug, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        Failed to load frameworks: {error.message}
      </div>
    );
  }

  const rows = (data || []) as FrameworkRow[];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Frameworks</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage Native report content blocks and layout templates (does not affect QSC / Team Puzzle).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 text-left">Framework</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{r.name || r.slug}</div>
                  <div className="text-xs text-slate-500">{r.id}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.slug}</td>
                <td className="px-4 py-3">{r.status || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
                      href={`/admin/frameworks/${r.id}/blocks`}
                    >
                      Blocks
                    </Link>
                    <Link
                      className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
                      href={`/admin/frameworks/${r.id}/templates`}
                    >
                      Templates
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-600" colSpan={4}>
                  No frameworks found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}