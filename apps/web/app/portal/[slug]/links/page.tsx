// apps/web/app/portal/[slug]/links/page.tsx
import { createClient } from "@/lib/server/supabaseAdmin";
import PortalPageHeader from "@/components/portal/PortalPageHeader";
import CreateTestLinkButton from "@/components/portal/CreateTestLinkButton";
import CreatedTestLinksTable from "./CreatedTestLinksTable";
import { loadModels } from "@/lib/portal/loadModels";

export const dynamic = "force-dynamic";

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

      {/* Links table — create/edit both run through the wizard modal */}
      <CreatedTestLinksTable orgId={org.id} orgSlug={org.slug} models={models} />
    </div>
  );
}
