import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG_A = { id: "org-a", slug: "acme", name: "Acme", status: "active" };

const requirePortalOrgAccess = vi.fn();
const listPortalMcasCandidates = vi.fn();
const getPortalMcasCandidate = vi.fn();

vi.mock("@/lib/portal/authz", () => ({
  requirePortalOrgAccess,
  MCAS_TEST_SLUG: "mcas-core-alignment",
}));

vi.mock("@/lib/mcas/mcasPortalData", () => ({
  listPortalMcasCandidates,
  getPortalMcasCandidate,
}));

function allow(org = ORG_A) {
  requirePortalOrgAccess.mockResolvedValue({
    ok: true,
    access: { userId: "user-1", org, role: "org_owner", testId: "test-mcas" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/portal/[slug]/mcas/candidates", () => {
  it("passes the guarded org id, never one from the query string", async () => {
    allow();
    listPortalMcasCandidates.mockResolvedValue({
      rows: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasMore: false,
    });

    const { GET } = await import("./route");

    await GET(
      new Request(
        "https://app.example.com/api/portal/acme/mcas/candidates?orgId=org-b&q=ada&page=2",
      ),
      { params: Promise.resolve({ slug: "acme" }) },
    );

    expect(listPortalMcasCandidates).toHaveBeenCalledWith(
      "org-a",
      expect.objectContaining({ query: "ada", page: 2 }),
    );
  });

  it("falls back to page 1 on unparseable pagination", async () => {
    allow();
    listPortalMcasCandidates.mockResolvedValue({
      rows: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasMore: false,
    });

    const { GET } = await import("./route");

    await GET(
      new Request(
        "https://app.example.com/api/portal/acme/mcas/candidates?page=banana&pageSize=nope",
      ),
      { params: Promise.resolve({ slug: "acme" }) },
    );

    expect(listPortalMcasCandidates).toHaveBeenCalledWith(
      "org-a",
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
  });

  it("returns 403 without querying when MCAS access is revoked", async () => {
    requirePortalOrgAccess.mockResolvedValue({
      ok: false,
      status: 403,
      code: "test_access_revoked",
      error: "This test is not available on your current plan",
    });

    const { GET } = await import("./route");

    const res = await GET(
      new Request("https://app.example.com/api/portal/acme/mcas/candidates"),
      { params: Promise.resolve({ slug: "acme" }) },
    );

    expect(res.status).toBe(403);
    expect(listPortalMcasCandidates).not.toHaveBeenCalled();
  });
});

describe("GET /api/portal/[slug]/mcas/candidates/[candidateId]", () => {
  it("404s on a candidate the org does not own", async () => {
    allow();
    // The adapter scopes on portal_org_id, so another org's candidate comes
    // back as null — the route must not distinguish the two cases.
    getPortalMcasCandidate.mockResolvedValue(null);

    const { GET } = await import("./[candidateId]/route");

    const res = await GET(new Request("https://app.example.com"), {
      params: Promise.resolve({ slug: "acme", candidateId: "app-from-org-b" }),
    });

    expect(res.status).toBe(404);
    expect(getPortalMcasCandidate).toHaveBeenCalledWith("org-a", "app-from-org-b");
  });

  it("returns the candidate for the owning org", async () => {
    allow();
    getPortalMcasCandidate.mockResolvedValue({
      partnerApplicationId: "app-1",
      fullName: "Ada Lovelace",
      verticalReadiness: "V4",
    });

    const { GET } = await import("./[candidateId]/route");

    const res = await GET(new Request("https://app.example.com"), {
      params: Promise.resolve({ slug: "acme", candidateId: "app-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      candidate: { fullName: "Ada Lovelace", verticalReadiness: "V4" },
    });
  });
});
