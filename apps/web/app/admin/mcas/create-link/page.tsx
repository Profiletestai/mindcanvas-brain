//apps/web/app/admin/mcas/create-link/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

async function createLinkAction(formData: FormData): Promise<void> {
  "use server";

  const partner_key = String(formData.get("partner_key") || "").trim();
  const application_id = String(formData.get("application_id") || "").trim();
  const org_id = String(formData.get("org_id") || "").trim();

  const candidate_first_name = String(formData.get("candidate_first_name") || "").trim() || null;
  const candidate_last_name = String(formData.get("candidate_last_name") || "").trim() || null;
  const candidate_email = String(formData.get("candidate_email") || "").trim() || null;

  if (!partner_key || !application_id || !org_id) {
    // Keep it simple: redirect back with error
    redirect(
      `/admin/mcas/create-link?error=${encodeURIComponent(
        "partner_key, application_id, and org_id are required."
      )}`
    );
  }

  const sb = mcasSupa();

  const { data, error } = await sb
    .from("partner_applications")
    .insert({
      partner_key,
      application_id,
      org_id,
      framework_slug: "mcas-core-alignment",
      framework_version: "v1",
      status: "created",
      candidate_first_name,
      candidate_last_name,
      candidate_email,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    redirect(
      `/admin/mcas/create-link?error=${encodeURIComponent(
        error?.message || "Failed to create link."
      )}`
    );
  }

  // Redirect straight to the application detail page
  redirect(`/admin/mcas/applications/${encodeURIComponent(data.id)}?created=1`);
}

export default async function Page(props: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const sp = await props.searchParams;
  const errMsg = sp.error ? String(sp.error) : "";

  // Profiletest.ai org id (your earlier insert)
  const defaultOrgId = "b9608ed1-0c7c-46cd-9aec-5a3439d421c1";

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-sm text-white/60">Admin • MCAS</div>
        <h1 className="mt-1 text-2xl font-semibold">Create Partner Test Link</h1>
        <div className="mt-2 text-white/60 text-sm">
          Creates a new MCAS application row + generates a candidate token link.
        </div>

        {errMsg ? (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">
            {errMsg}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <form action={createLinkAction} className="grid gap-4">
            <div>
              <label className="text-xs text-white/60">Org ID</label>
              <input
                name="org_id"
                defaultValue={defaultOrgId}
                className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2 font-mono"
              />
              <div className="mt-1 text-xs text-white/50">
                Default is profiletest.ai org_id.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/60">Partner key</label>
                <input
                  name="partner_key"
                  placeholder="e.g. partner_one"
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Application ID (partner)</label>
                <input
                  name="application_id"
                  placeholder="e.g. ATS-REQ-12345"
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>
            </div>

            <div className="text-sm text-white/60 mt-2">Optional candidate details</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-white/60">First name</label>
                <input
                  name="candidate_first_name"
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Last name</label>
                <input
                  name="candidate_last_name"
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Email</label>
                <input
                  name="candidate_email"
                  type="email"
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>
            </div>

            <button className="mt-2 w-full rounded-xl bg-white text-black px-5 py-3 font-medium hover:bg-white/90">
              Create Link
            </button>
          </form>

          <div className="mt-6 text-xs text-white/50">
            After creation, you’ll be redirected to the application detail page automatically.
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <a
            href="/admin/mcas/applications"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            View Applications
          </a>
        </div>
      </div>
    </div>
  );
}