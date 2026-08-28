// apps/web/lib/server/orgAccess.ts
// Authorisation for the service-role link routes. Those clients bypass RLS, so
// the org id in a request body/query is an argument, not a credential: it has
// to be checked against the signed-in user's memberships before any read or
// write is scoped by it.
import "server-only";
import { getAdminClient, getServerSupabase } from "@/app/_lib/portal";

export type OrgAccess =
  | { ok: true; userId: string; isSuperadmin: boolean }
  | { ok: false; status: number; error: string };

// Legacy membership tables, still consulted by getActiveOrgId(). Kept here for
// the same reason: not every account has been migrated to portal.user_orgs.
const LEGACY_MEMBERSHIP_TABLES = ["portal_members", "org_members"] as const;

export async function requireOrgAccess(orgId: string): Promise<OrgAccess> {
  const targetOrgId = (orgId ?? "").trim();

  if (!targetOrgId) {
    return { ok: false, status: 400, error: "Missing orgId" };
  }

  let userId: string | null = null;
  try {
    const sb = await getServerSupabase();
    const { data } = await sb.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return { ok: false, status: 401, error: "Not signed in" };
  }

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  // Platform admins reach every org — same lookup the portal layout uses to
  // gate "Back to admin".
  const { data: superRow } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (superRow?.user_id) {
    return { ok: true, userId, isSuperadmin: true };
  }

  const { data: memberRow } = await portal
    .from("user_orgs")
    .select("org_id")
    .eq("user_id", userId)
    .eq("org_id", targetOrgId)
    .limit(1)
    .maybeSingle();

  if (memberRow?.org_id) {
    return { ok: true, userId, isSuperadmin: false };
  }

  for (const table of LEGACY_MEMBERSHIP_TABLES) {
    try {
      const { data } = await admin
        .from(table)
        .select("org_id")
        .eq("user_id", userId)
        .eq("org_id", targetOrgId)
        .limit(1)
        .maybeSingle();

      if (data?.org_id) {
        return { ok: true, userId, isSuperadmin: false };
      }
    } catch {
      // Table may not exist in this environment — treat as "no membership".
    }
  }

  return {
    ok: false,
    status: 403,
    error: "You do not have access to this organisation",
  };
}
