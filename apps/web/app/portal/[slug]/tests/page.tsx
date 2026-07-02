// apps/web/app/portal/[slug]/tests/page.tsx
// Server component — Tests hub for /portal/[slug]/tests
// Redesigned "Available models" grid (per Figma). Cards are driven by the
// tests this org actually has access to (same source as the "Select test"
// dropdown on the create-link form). Each card links to the create-link flow.

import { createClient } from "@/lib/server/supabaseAdmin";
import PortalPageHeader from "@/components/portal/PortalPageHeader";
import CreateTestLinkButton from "@/components/portal/CreateTestLinkButton";
import { metaFor } from "@/lib/testModels";

export const dynamic = "force-dynamic";

type Test = {
  id: string;
  name: string;
};

// Resolve the tests this org can create links for — mirrors
// /api/admin/tests: access via portal.org_test_access, with a legacy
// fallback to org-owned test rows.
async function loadTests(orgId: string): Promise<Test[]> {
  const sb = createClient().schema("portal");

  let rows: any[] = [];

  const { data: accessRows } = await sb
    .from("org_test_access")
    .select("test_id")
    .eq("org_id", orgId)
    .eq("status", "active");

  const ids = (accessRows ?? []).map((r: any) => r.test_id).filter(Boolean);

  if (ids.length) {
    const { data: testRows } = await sb
      .from("tests")
      .select("id, name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    rows = testRows ?? [];
  }

  if (!rows.length) {
    const { data } = await sb
      .from("tests")
      .select("id, name, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    rows = data ?? [];
  }

  return (rows || [])
    .map((r: any) => {
      const id = r?.id ?? r?.test_id ?? null;
      if (!id) return null;
      return { id, name: r?.name ?? "Untitled test" } as Test;
    })
    .filter(Boolean) as Test[];
}

export default async function TestsPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  try {
    const sb = createClient().schema("portal");

    const { data: org, error: orgErr } = await sb
      .from("orgs")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();

    if (orgErr || !org) {
      throw new Error(orgErr?.message || "Organisation not found");
    }

    const tests = await loadTests(org.id);

    // Serializable model list for the create-link modal (client component).
    const models = tests.map((t) => ({
      id: t.id,
      name: t.name,
      category: metaFor(t.name).category,
    }));

    return (
      <div className="space-y-6 text-slate-100">
        <PortalPageHeader
          title="Tests"
          subtitle="Create test links, manage models, and control how profiles are distributed."
          actions={
            <CreateTestLinkButton
              orgId={org.id}
              orgSlug={slug}
              models={models}
              variant="header"
            />
          }
        />

        <div>
          <div className="mb-4 text-[12px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
            Available models
          </div>

          <div className="grid gap-x-2 gap-y-3.5 lg:grid-cols-2">
            {tests.map((t) => {
              const meta = metaFor(t.name);
              return (
                <div
                  key={t.id}
                  className="flex min-h-[254px] flex-col rounded-[20px] border border-white/[0.08] bg-[#0e2a45] p-5 backdrop-blur-[24px]"
                >
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#54AFE0]">
                    {meta.category}
                  </div>
                  <h2 className="mt-2 text-[15px] font-extrabold leading-[20px] tracking-[-0.2px] text-white">
                    {t.name}
                  </h2>
                  <p className="mt-2.5 text-[12px] font-light leading-[18px] text-white/[0.62]">
                    {meta.description}
                  </p>

                  <div className="mt-3 space-y-2 border-t border-white/[0.05] pt-3.5">
                    <div className="flex text-[11px]">
                      <span className="w-[73px] shrink-0 font-semibold text-white/[0.36]">
                        Best for
                      </span>
                      <span className="font-light text-white/[0.62]">
                        {meta.bestFor}
                      </span>
                    </div>
                    <div className="flex text-[11px]">
                      <span className="w-[73px] shrink-0 font-semibold text-white/[0.36]">
                        Output
                      </span>
                      <span className="font-light text-white/[0.62]">
                        {meta.output}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex justify-end pt-6">
                    <CreateTestLinkButton
                      orgId={org.id}
                      orgSlug={slug}
                      models={models}
                      initialModelId={t.id}
                      variant="card"
                    />
                  </div>
                </div>
              );
            })}

            {/* "More models coming soon" placeholder — mirrors the empty cell
                in the design: same solid card treatment, muted centered copy.
                Also covers the no-tests case gracefully. */}
            <div className="flex min-h-[254px] flex-col items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#0e2a45] p-5 text-center backdrop-blur-[24px]">
              <p className="text-[11px] font-light leading-[16px] text-white/[0.36]">
                More models coming soon.
              </p>
              <p className="text-[11px] font-light leading-[16px] text-white/[0.36]">
                Speak to us about custom systems.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="space-y-3 p-6 text-red-200">
        <h1 className="text-xl font-semibold">Tests page error</h1>
        <pre className="whitespace-pre-wrap rounded border border-red-700/40 bg-red-950/40 p-3 text-xs">
          {String(err?.message || err)}
        </pre>
      </div>
    );
  }
}
