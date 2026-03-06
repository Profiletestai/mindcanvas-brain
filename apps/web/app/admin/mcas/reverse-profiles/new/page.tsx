//apps/web/app/admin/mcas/reverse-profiles/new/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

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

async function createRun(formData: FormData) {
  "use server";

  const partner_key = String(formData.get("partner_key") || "").trim();
  const job_id = String(formData.get("job_id") || "").trim();
  const campaign_id = String(formData.get("campaign_id") || "").trim() || null;
  const title = String(formData.get("title") || "").trim();
  const framework_slug = String(formData.get("framework_slug") || "").trim() || "mcas-core-alignment";
  const framework_version = String(formData.get("framework_version") || "").trim() || "v1";

  if (!partner_key || !job_id || !title) return;

  const sb = mcasSupa();

  const { data, error } = await sb
    .from("reverse_profile_runs")
    .insert({
      partner_key,
      job_id,
      campaign_id,
      title,
      framework_slug,
      framework_version,
      input_mode: "manual",
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data?.id) return;

  redirect(`/mcas/reverse/${data.id}`);
}

export default async function Page() {
  const sb = mcasSupa();

  const { data: partners } = await sb
    .from("partners")
    .select("partner_key, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-sm text-white/60">Admin • MCAS</div>
        <h1 className="mt-1 text-3xl font-semibold">Create Reverse Profile Sandbox</h1>
        <p className="mt-3 text-white/70 max-w-2xl">
          Create a sandbox run for a partner to answer the 25 MCAS questions as the
          ideal candidate for a role. The result page will show the visual output and
          the structured payload their platform will receive.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <form action={createRun} className="space-y-5">
            <div>
              <label className="block text-sm text-white/70 mb-2">Partner</label>
              <select
                name="partner_key"
                defaultValue="atumaphire"
                className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-4 py-3 outline-none"
              >
                {(partners || []).map((p: any) => (
                  <option key={p.partner_key} value={p.partner_key}>
                    {p.name} ({p.partner_key})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Job ID</label>
                <input
                  name="job_id"
                  placeholder="e.g. JOB-001"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">Campaign ID</label>
                <input
                  name="campaign_id"
                  placeholder="Optional"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Title</label>
              <input
                name="title"
                placeholder="e.g. Senior Operations Manager"
                className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-4 py-3 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Framework Slug</label>
                <input
                  name="framework_slug"
                  defaultValue="mcas-core-alignment"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">Framework Version</label>
                <input
                  name="framework_version"
                  defaultValue="v1"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0b1724] p-4 text-sm text-white/60">
              This creates a partner sandbox run. After creation you’ll be redirected to
              the shareable question flow.
            </div>

            <button className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#64bae2] to-[#2d8fc4] px-5 py-3 text-sm font-medium text-white shadow hover:brightness-110 transition">
              Create Sandbox Link
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
