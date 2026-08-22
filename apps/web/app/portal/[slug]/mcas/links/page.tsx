// apps/web/app/portal/[slug]/mcas/links/page.tsx
// MCAS assessment links for the organisation.

import {
  MCAS_TEST_SLUG,
  PORTAL_WRITE_ROLES,
  requirePortalOrgAccess,
} from "@/lib/portal/authz";

import McasAccessNotice from "../_components/McasAccessNotice";
import McasLinksClient from "./McasLinksClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function McasLinksPage({
  params,
}: {
  params: { slug: string };
}) {
  const guard = await requirePortalOrgAccess({
    slug: params.slug,
    permission: "read",
    testSlug: MCAS_TEST_SLUG,
  });

  if (!guard.ok) return <McasAccessNotice failure={guard} />;

  const { org, role } = guard.access;

  // The API re-checks this; the flag only decides whether to render the form.
  const canWrite = PORTAL_WRITE_ROLES.has(role);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          MCAS — {org.name ?? org.slug}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Create MCAS assessment links, share them with candidates, and pause
          them when a role is filled.
        </p>
      </div>

      <McasLinksClient orgSlug={org.slug} canWrite={canWrite} />
    </div>
  );
}
