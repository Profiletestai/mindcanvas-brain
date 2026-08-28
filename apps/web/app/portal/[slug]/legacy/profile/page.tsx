// apps/web/app/portal/[slug]/legacy/profile/page.tsx
// LEGACY Profile settings for /portal/[slug]/legacy/profile
// Kept for reference; the active profile lives at /portal/[slug]/profile.
// This preserves the previous single-page org-settings form.
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { slug: string } }) {
  return <ProfileClient slug={params.slug} />;
}
