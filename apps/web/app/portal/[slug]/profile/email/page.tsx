// apps/web/app/portal/[slug]/profile/email/page.tsx
// Profile → Email settings. Wired to the existing org-profile report_* fields.
import EmailSettingsClient from "./EmailSettingsClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { slug: string } }) {
  return <EmailSettingsClient slug={params.slug} />;
}
