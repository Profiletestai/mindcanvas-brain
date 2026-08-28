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

  if (!guard.ok) {
    return <McasAccessNotice failure={guard} />;
  }

  const { org, role } = guard.access;

  // The API performs the authoritative permission check.
  // This only determines whether write actions are displayed.
  const canWrite = PORTAL_WRITE_ROLES.has(role);

  return (
    <McasLinksClient
      orgSlug={org.slug}
      canWrite={canWrite}
    />
  );
}
