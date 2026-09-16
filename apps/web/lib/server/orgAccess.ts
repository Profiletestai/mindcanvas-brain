// apps/web/lib/server/orgAccess.ts
//
// Legacy org-id authorization helper used by older service-role routes.
//
// This deliberately uses the same session-validation approach as the newer
// portal authorization guard. Service-role clients bypass RLS, so an org id
// supplied by a request is only an argument — never proof of authorization.

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getAdminClient } from "@/app/_lib/supabaseAdmin";

export type OrgAccess =
  | {
      ok: true;
      userId: string;
      isSuperadmin: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

// Legacy membership tables retained for accounts that may not yet have been
// migrated to portal.user_orgs.
const LEGACY_MEMBERSHIP_TABLES = [
  "portal_members",
  "org_members",
] as const;

/**
 * Read and validate the current Supabase session.
 *
 * auth.getUser() validates the JWT with Supabase Auth. We intentionally do not
 * use getSession() as an authorization decision.
 *
 * This helper only reads cookies. Session refresh/mutation belongs to the normal
 * auth flow rather than these privileged API authorization checks.
 */
async function getSessionUserId(): Promise<string | null> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return null;
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      url,
      anon,
      {
        cookies: {
          getAll: () =>
            cookieStore.getAll(),

          // Authorization checks are read-only.
          setAll: () => {},
        },
      }
    );

    const { data, error } =
      await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function requireOrgAccess(
  orgId: string
): Promise<OrgAccess> {
  const targetOrgId =
    (orgId ?? "").trim();

  if (!targetOrgId) {
    return {
      ok: false,
      status: 400,
      error: "Missing orgId",
    };
  }

  const userId =
    await getSessionUserId();

  if (!userId) {
    return {
      ok: false,
      status: 401,
      error: "Not signed in",
    };
  }

  // Fresh service-role client using the same canonical admin helper as the
  // newer portal authorization guard.
  const admin = getAdminClient();

  const portal =
    admin.schema("portal");

  // Platform superadmins are permitted to support/view any organisation.
  const {
    data: superRow,
    error: superError,
  } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (superError) {
    console.error(
      "[org-access] superadmin lookup failed",
      {
        userId,
        error: superError,
      }
    );
  }

  if (superRow?.user_id) {
    return {
      ok: true,
      userId,
      isSuperadmin: true,
    };
  }

  // Current membership model.
  const {
    data: memberRow,
    error: memberError,
  } = await portal
    .from("user_orgs")
    .select("org_id")
    .eq("user_id", userId)
    .eq("org_id", targetOrgId)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error(
      "[org-access] membership lookup failed",
      {
        userId,
        orgId: targetOrgId,
        error: memberError,
      }
    );
  }

  if (memberRow?.org_id) {
    return {
      ok: true,
      userId,
      isSuperadmin: false,
    };
  }

  // Legacy membership fallbacks.
  for (
    const table of LEGACY_MEMBERSHIP_TABLES
  ) {
    try {
      const { data, error } =
        await admin
          .from(table)
          .select("org_id")
          .eq("user_id", userId)
          .eq(
            "org_id",
            targetOrgId
          )
          .limit(1)
          .maybeSingle();

      if (error) {
        continue;
      }

      if (data?.org_id) {
        return {
          ok: true,
          userId,
          isSuperadmin: false,
        };
      }
    } catch {
      // A legacy table may no longer exist in an environment.
      // Missing legacy state is treated as no membership.
    }
  }

  return {
    ok: false,
    status: 403,
    error:
      "You do not have access to this organisation",
  };
}
