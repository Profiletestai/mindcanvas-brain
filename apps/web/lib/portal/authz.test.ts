import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeClient, type StubClient, type TableResults } from "../../test/helpers/supabaseStub";

const ORG = {
  id: "org-1",
  slug: "acme",
  name: "Acme",
  status: "active",
};

let sessionUserId: string | null = "user-1";
let portalClient: StubClient;

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () =>
        sessionUserId
          ? { data: { user: { id: sessionUserId } }, error: null }
          : { data: { user: null }, error: { message: "no session" } },
    },
  }),
}));

vi.mock("@/app/_lib/supabaseAdmin", () => ({
  portalAdmin: () => portalClient,
  supabaseAdmin: () => portalClient,
}));

/**
 * getCatalogueTestId caches the MCAS test id in module scope, so every test
 * loads a fresh copy of the module.
 */
async function loadAuthz(tables: TableResults, userId: string | null = "user-1") {
  sessionUserId = userId;
  portalClient = makeClient(tables);

  vi.resetModules();

  return import("./authz");
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
});

describe("requirePortalOrgAccess", () => {
  it("rejects an unauthenticated caller", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({}, null);

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
    });

    expect(result).toMatchObject({ ok: false, status: 401, code: "not_authenticated" });
  });

  it("rejects an unknown organisation", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: null },
    });

    const result = await requirePortalOrgAccess({
      slug: "nope",
      permission: "read",
    });

    expect(result).toMatchObject({ ok: false, status: 404, code: "org_not_found" });
  });

  it("hides the organisation from a non-member rather than returning 403", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: null },
      superadmin: { data: null },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
    });

    // A 403 would confirm the org exists to someone outside it.
    expect(result).toMatchObject({ ok: false, status: 404, code: "org_not_found" });
  });

  it("lets a platform admin through without a membership row", async () => {
    const { requirePortalOrgAccess, SUPERADMIN_ROLE } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: null },
      superadmin: { data: { user_id: "user-1" } },
    });

    // Browsing an org portal is a normal support workflow — PortalChrome links
    // back to /admin — so the membership requirement must not lock them out.
    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
    });

    expect(result).toMatchObject({
      ok: true,
      access: { role: SUPERADMIN_ROLE },
    });
  });

  it("lets a platform admin write", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: null },
      superadmin: { data: { user_id: "user-1" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "write",
    });

    expect(result.ok).toBe(true);
  });

  it("does not consult the superadmin table for an ordinary member", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
    });

    await requirePortalOrgAccess({ slug: "acme", permission: "write" });

    // Members must not pay for an extra round trip on every request.
    expect(portalClient.queries.superadmin).toBeUndefined();
  });

  it("still refuses a platform admin when MCAS is not on the org plan", async () => {
    const { requirePortalOrgAccess, MCAS_TEST_SLUG } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: null },
      superadmin: { data: { user_id: "user-1" } },
      tests: { data: { id: "test-mcas" } },
      org_test_access: { data: null },
    });

    // The bypass covers membership, not entitlement.
    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    expect(result).toMatchObject({ ok: false, code: "test_access_revoked" });
  });

  it("scopes the membership lookup to both the org and the user", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
    });

    await requirePortalOrgAccess({ slug: "acme", permission: "read" });

    const membershipQuery = portalClient.queries.user_orgs[0];

    expect(membershipQuery.__calls).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["org_id", ORG.id] },
        { method: "eq", args: ["user_id", "user-1"] },
      ]),
    );
  });

  it("allows a member to read", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_member" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
    });

    expect(result.ok).toBe(true);
  });

  it("refuses a write from a role outside PORTAL_WRITE_ROLES", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_member" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "write",
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: "forbidden" });
  });

  it("allows a write from an owner", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "write",
    });

    expect(result.ok).toBe(true);
  });

  it("refuses an archived organisation", async () => {
    const { requirePortalOrgAccess } = await loadAuthz({
      orgs: { data: { ...ORG, status: "archived" } },
      user_orgs: { data: { role: "org_owner" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: "org_inactive" });
  });

  it("reports a missing catalogue row separately from a revoked entitlement", async () => {
    const { requirePortalOrgAccess, MCAS_TEST_SLUG } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
      tests: { data: null },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    // The migration has not run here — not the org's fault, and not a 403.
    expect(result).toMatchObject({ ok: false, status: 503, code: "test_not_configured" });
  });

  it("refuses an org whose MCAS access is not active", async () => {
    const { requirePortalOrgAccess, MCAS_TEST_SLUG } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
      tests: { data: { id: "test-mcas" } },
      org_test_access: { data: { status: "revoked" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: "test_access_revoked" });
  });

  it("refuses an org with no access row at all", async () => {
    const { requirePortalOrgAccess, MCAS_TEST_SLUG } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
      tests: { data: { id: "test-mcas" } },
      org_test_access: { data: null },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    expect(result).toMatchObject({ ok: false, code: "test_access_revoked" });
  });

  it("returns the resolved test id on the happy path", async () => {
    const { requirePortalOrgAccess, MCAS_TEST_SLUG } = await loadAuthz({
      orgs: { data: ORG },
      user_orgs: { data: { role: "org_owner" } },
      tests: { data: { id: "test-mcas" } },
      org_test_access: { data: { status: "active" } },
    });

    const result = await requirePortalOrgAccess({
      slug: "acme",
      permission: "write",
      testSlug: MCAS_TEST_SLUG,
    });

    expect(result).toMatchObject({
      ok: true,
      access: { userId: "user-1", role: "org_owner", testId: "test-mcas" },
    });

    // Entitlement is checked against this org's row, not any org's.
    expect(portalClient.queries.org_test_access[0].__calls).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["org_id", ORG.id] },
        { method: "eq", args: ["test_id", "test-mcas"] },
      ]),
    );
  });
});
