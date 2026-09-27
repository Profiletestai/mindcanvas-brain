import "server-only";

import {
  getAdminClient,
  getServerSupabase,
} from "@/app/_lib/portal";

export type AdminApiAuthResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
    };

/**
 * Authorisation guard for privileged /api/admin/* route handlers.
 *
 * Important:
 * - /admin/* pages are protected by middleware + admin/layout.tsx.
 * - /api/admin/* is NOT covered by that middleware.
 * - Any API route using the service role must therefore perform its own
 *   authentication + superadmin authorisation before privileged work.
 *
 * auth.getUser() validates the current Supabase session rather than trusting
 * the cookie contents alone.
 */
export async function requireSuperadminApi(): Promise<AdminApiAuthResult> {
  try {
    const sb = await getServerSupabase();

    const {
      data: auth,
      error: authError,
    } = await sb.auth.getUser();

    const user = auth?.user ?? null;

    if (authError || !user) {
      return {
        ok: false,
        status: 401,
        error: "Unauthorized",
      };
    }

    const admin = await getAdminClient();
    const portal = admin.schema("portal");

    const {
      data: adminRow,
      error: adminError,
    } = await portal
      .from("superadmin")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error(
        "[admin-api-auth] superadmin lookup failed",
        {
          userId: user.id,
          error: adminError,
        }
      );

      return {
        ok: false,
        status: 500,
        error: "Unable to verify administrator access",
      };
    }

    if (!adminRow?.user_id) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden",
      };
    }

    return {
      ok: true,
      userId: user.id,
    };
  } catch (error) {
    console.error(
      "[admin-api-auth] authentication check failed",
      error
    );

    return {
      ok: false,
      status: 500,
      error: "Unable to verify administrator access",
    };
  }
}