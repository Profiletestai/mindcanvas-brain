// apps/web/lib/portal/authz.ts
// Authorisation guard for /api/portal/[slug]/* route handlers.
//
// middleware.ts only matches ["/portal/:path*", "/admin/:path*"] — API routes
// under /api/portal are NOT covered by it, so a handler that resolves the org
// from the URL slug and queries with the service role has no authorisation at
// all. Every route added by the MCAS portal integration goes through
// requirePortalOrgAccess() before touching data.
//
// Returns a discriminated union rather than throwing, matching the style of
// app/_lib/billing.ts.

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export type PortalOrg = {
  id: string;
  slug: string;
  name: string;
  status: string | null;
};

export type PortalAccess = {
  userId: string;
  org: PortalOrg;
  role: string;
  /** Catalogue test id resolved when `testSlug` was requested. */
  testId: string | null;
};

export type PortalAccessFailure = {
  ok: false;
  status: number;
  code:
    | "not_authenticated"
    | "org_not_found"
    | "org_inactive"
    | "forbidden"
    | "test_access_revoked"
    | "test_not_configured";
  error: string;
};

export type PortalAccessResult =
  | { ok: true; access: PortalAccess }
  | PortalAccessFailure;

/**
 * Synthetic role given to platform admins, who have no portal.user_orgs row.
 * Never stored — only ever returned by requirePortalOrgAccess().
 */
export const SUPERADMIN_ROLE = "superadmin";

/**
 * Roles allowed to create or modify org-owned records.
 *
 * 'org_owner' is the only value portal.user_orgs.role currently holds (verified
 * against production: 32 rows, all org_owner) and the only one any code writes,
 * in portal.fn_create_onboarding_org. The set is deliberately exact rather than
 * a superset of plausible names: an unrecognised role fails closed, which is the
 * right direction to be wrong in. Adding a role to the schema means adding it
 * here too.
 */
export const PORTAL_WRITE_ROLES = new Set(["org_owner", SUPERADMIN_ROLE]);

/** Slug of the portal.tests catalogue row seeded by 20260813120000. */
export const MCAS_TEST_SLUG = "mcas-core-alignment";

/** Reads the caller's session from cookies. Anon key + RLS, never the service role. */
async function getSessionUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Route handlers must not mutate cookies here; the session is only read.
      setAll: () => {},
    },
  });

  // getUser() revalidates the JWT against the auth server. getSession() only
  // decodes the cookie, which is forgeable — do not swap these.
  const { data, error } = await supabase.auth.getUser();

  if (error) return null;

  return data.user?.id ?? null;
}

let cachedMcasTestId: string | null = null;

/**
 * Resolves a portal.tests catalogue row id from its slug, cached per process.
 * Ids differ per environment, so nothing may hardcode them.
 */
export async function getCatalogueTestId(
  slug: string,
): Promise<string | null> {
  if (slug === MCAS_TEST_SLUG && cachedMcasTestId) return cachedMcasTestId;

  const { data, error } = await portalAdmin()
    .from("tests")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const id = (data?.id as string | undefined) ?? null;

  if (slug === MCAS_TEST_SLUG && id) cachedMcasTestId = id;

  return id;
}

export async function getMcasCatalogueTestId(): Promise<string | null> {
  return getCatalogueTestId(MCAS_TEST_SLUG);
}

/**
 * Whether an org currently holds a catalogue test, ignoring who is asking.
 *
 * For chrome that has already been through the middleware auth gate and only
 * needs to decide what to render — the pages and APIs behind those links still
 * run the full requirePortalOrgAccess() membership check.
 */
export async function orgHasTestAccess(
  orgId: string,
  testSlug: string,
): Promise<boolean> {
  try {
    const testId = await getCatalogueTestId(testSlug);

    if (!testId) return false;

    const { data, error } = await portalAdmin()
      .from("org_test_access")
      .select("status")
      .eq("org_id", orgId)
      .eq("test_id", testId)
      .maybeSingle();

    if (error) throw error;

    return data?.status === "active";
  } catch (caught) {
    // Chrome must render even if this lookup fails; hiding the tab is the safe
    // outcome.
    console.error("[portal-authz] test access lookup failed", {
      orgId,
      testSlug,
      error: caught,
    });
    return false;
  }
}

/**
 * Platform admins, per portal.superadmin — the same table app/admin/layout.tsx
 * gates on. They are not members of any org, but browsing an org portal is a
 * normal support workflow (PortalChrome links back to /admin), so the
 * membership requirement would lock them out of MCAS alone.
 *
 * Only consulted after the membership lookup misses, so ordinary members never
 * pay for this query.
 */
async function isSuperadmin(userId: string): Promise<boolean> {
  const { data, error } = await portalAdmin()
    .from("superadmin")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data?.user_id);
}

export type RequirePortalOrgAccessOptions = {
  slug: string;
  /** "write" additionally requires a role in PORTAL_WRITE_ROLES. */
  permission: "read" | "write";
  /** When set, the org must hold active portal.org_test_access for that test. */
  testSlug?: string;
};

/**
 * Session -> org -> membership -> role -> entitlement.
 *
 * A non-member gets org_not_found rather than forbidden: confirming that an org
 * exists to someone outside it leaks the customer list.
 */
export async function requirePortalOrgAccess(
  opts: RequirePortalOrgAccessOptions,
): Promise<PortalAccessResult> {
  const { slug, permission, testSlug } = opts;

  const userId = await getSessionUserId();

  if (!userId) {
    return {
      ok: false,
      status: 401,
      code: "not_authenticated",
      error: "Sign in to continue",
    };
  }

  const admin = portalAdmin();

  const { data: orgRow, error: orgError } = await admin
    .from("orgs")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .maybeSingle();

  if (orgError) throw orgError;

  if (!orgRow) {
    return {
      ok: false,
      status: 404,
      code: "org_not_found",
      error: "Organisation not found",
    };
  }

  const org = orgRow as PortalOrg;

  const { data: membership, error: membershipError } = await admin
    .from("user_orgs")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw membershipError;

  // A platform admin has no membership row but is allowed through. Everyone
  // else gets org_not_found rather than forbidden: confirming an org exists to
  // someone outside it leaks the customer list.
  if (!membership && !(await isSuperadmin(userId))) {
    return {
      ok: false,
      status: 404,
      code: "org_not_found",
      error: "Organisation not found",
    };
  }

  if (org.status === "archived") {
    return {
      ok: false,
      status: 403,
      code: "org_inactive",
      error: "This organisation is archived",
    };
  }

  const role = membership
    ? String((membership as { role: string }).role ?? "")
    : SUPERADMIN_ROLE;

  if (permission === "write" && !PORTAL_WRITE_ROLES.has(role)) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
      error: "You do not have permission to change this organisation's tests",
    };
  }

  let testId: string | null = null;

  if (testSlug) {
    testId = await getCatalogueTestId(testSlug);

    if (!testId) {
      // The catalogue row is missing entirely — migration 20260813120000 has
      // not run in this environment. Distinct from an org that lost access.
      return {
        ok: false,
        status: 503,
        code: "test_not_configured",
        error: "This assessment is not configured on this environment",
      };
    }

    const { data: access, error: accessError } = await admin
      .from("org_test_access")
      .select("status")
      .eq("org_id", org.id)
      .eq("test_id", testId)
      .maybeSingle();

    if (accessError) throw accessError;

    if (access?.status !== "active") {
      return {
        ok: false,
        status: 403,
        code: "test_access_revoked",
        error: "This test is not available on your current plan",
      };
    }
  }

  return { ok: true, access: { userId, org, role, testId } };
}
