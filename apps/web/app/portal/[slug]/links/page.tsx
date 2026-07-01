// apps/web/app/portal/[slug]/links/page.tsx
import { createClient } from "@/lib/server/supabaseAdmin";
import PortalPageHeader from "@/components/portal/PortalPageHeader";
import CreateTestLinkButton from "@/components/portal/CreateTestLinkButton";
import LinksClient from "./LinksClient";
import CreatedTestLinksTable from "./CreatedTestLinksTable";
import { metaFor } from "@/lib/testModels";

export const dynamic = "force-dynamic";

// Resolve the tests this org can create links for — mirrors /api/admin/tests.
async function loadModels(orgId: string) {
  const sb = createClient().schema("portal");
  let rows: any[] = [];

  const { data: accessRows } = await sb
    .from("org_test_access")
    .select("test_id")
    .eq("org_id", orgId)
    .eq("status", "active");

  const ids = (accessRows ?? []).map((r: any) => r.test_id).filter(Boolean);

  if (ids.length) {
    const { data } = await sb
      .from("tests")
      .select("id, name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    rows = data ?? [];
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
      const name = r?.name ?? "Untitled test";
      return { id, name, category: metaFor(name).category };
    })
    .filter(Boolean) as { id: string; name: string; category: string }[];
}

export default async function OrgLinksPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient().schema("portal");

  const { data: org, error } = await sb
    .from("orgs")
    .select("id, name, slug")
    .eq("slug", params.slug)
    .maybeSingle();

  if (error) return <div className="p-6 text-red-600">{error.message}</div>;
  if (!org) return <div className="p-6 text-red-600">Org not found</div>;

  const models = await loadModels(org.id);

  return (
    <div className="space-y-6 text-slate-100">
      <PortalPageHeader
        title="Created test links"
        // subtitle="Generate test links, manage redirects, and track usage."
        actions={
          <CreateTestLinkButton
            orgId={org.id}
            orgSlug={org.slug}
            models={models}
            variant="header"
          />
        }
      />

      {/* Redesigned links table */}
      <CreatedTestLinksTable orgId={org.id} orgSlug={org.slug} models={models} />

      {/* Advanced create form — offers options the quick modal doesn't
          (recipient email, report variant, redirect URLs, contact owner). */}
      <details className="group overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0e2a45]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-[13px] font-semibold text-white/70 transition hover:text-white">
          <span>Advanced: create with more options</span>
          <span className="text-white/40 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-white/[0.07] bg-white p-6 text-slate-900">
          <LinksClient
            orgId={org.id}
            orgSlug={org.slug}
            orgName={org.name ?? org.slug}
            hideRecentLinks
          />
        </div>
      </details>
    </div>
  );
}
