import "server-only";
import { getAdminClient } from "@/app/_lib/portal";

export type PostLoginNext = {
  is_superadmin: boolean;
  org_slug: string | null;
  next: string;
};

export async function resolvePostLoginNext(
  userId: string
): Promise<PostLoginNext> {
  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const { data: adminRow } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const is_superadmin = !!adminRow?.user_id;

  if (is_superadmin) {
    return { is_superadmin: true, org_slug: null, next: "/admin" };
  }

  const { data: mem } = await portal
    .from("user_orgs")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!mem?.org_id) {
    return { is_superadmin: false, org_slug: null, next: "/onboarding" };
  }

  const { data: org } = await portal
    .from("orgs")
    .select("slug")
    .eq("id", mem.org_id)
    .maybeSingle();

  return {
    is_superadmin: false,
    org_slug: org?.slug ?? null,
    next: org?.slug ? `/portal/${org.slug}/dashboard` : "/portal",
  };
}
