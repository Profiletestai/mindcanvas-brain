import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, getAdminClient } from "@/app/_lib/portal";

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

async function requireSuperadmin() {
  const sb = await getServerSupabase();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user) notFound();

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const { data: row } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row?.user_id) notFound();
  return { user };
}

export default async function Page() {
  await requireSuperadmin();

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const { data, error } = await portal
    .from("frameworks")
    .select("id, slug, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6 text-sm text-red-400">
        Failed to load frameworks: {error.message}
      </div>
    );
  }

  const rows = (data || []) as FrameworkRow[];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Frameworks</h1>
        <p className="mt-1 text-sm text-slate-300">
          Manage Native report content blocks and layout templates (does not affect QSC / Team Puzzle).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-200">
            <tr>
              <th className="px-4 py-3 text-left">Framework</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{r.name || r.slug}</div>
                  <div className="text-xs text-slate-300">{r.id}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-200">{r.slug}</td>
                <td className="px-4 py-3 text-slate-200">{r.status || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                      href={`/admin/frameworks/${r.id}/blocks`}
                    >
                      Blocks
                    </Link>
                    <Link
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10"
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
                <td className="px-4 py-6 text-slate-200" colSpan={4}>
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