// apps/web/app/portal/[slug]/links/page.tsx
import { createClient } from "@/lib/server/supabaseAdmin";
import LinksClient from "./LinksClient";

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

  return (
    <div className="p-6 space-y-6">
      {/* ✅ Make this page feel like the "Tests" hub */}
      <div>
        <h1 className="text-2xl font-semibold">
          Tests — {org.name ?? org.slug}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Generate test links, manage redirects, and track usage.
        </p>
      </div>

      <LinksClient
        orgId={org.id}
        orgSlug={org.slug}
        orgName={org.name ?? org.slug}
      />
    </div>
  );
}

