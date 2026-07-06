// apps/web/app/portal/[slug]/profile/organisation/page.tsx
// Profile → Organisation. Name / website / industry are wired to the existing
// org-profile API; country & organisation type are mockup fields (no column yet).
import OrganisationClient from "./OrganisationClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { slug: string } }) {
  return <OrganisationClient slug={params.slug} />;
}
