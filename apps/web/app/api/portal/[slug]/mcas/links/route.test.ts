import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = { id: "org-a", slug: "acme", name: "Acme", status: "active" };

const requirePortalOrgAccess = vi.fn();
const createPortalMcasLink = vi.fn();
const listPortalMcasLinks = vi.fn();

vi.mock("@/lib/portal/authz", () => ({
  requirePortalOrgAccess,
  MCAS_TEST_SLUG: "mcas-core-alignment",
}));

vi.mock("@/lib/mcas/mcasPortalData", () => ({
  createPortalMcasLink,
  listPortalMcasLinks,
}));

function allow(role = "org_owner") {
  requirePortalOrgAccess.mockResolvedValue({
    ok: true,
    access: { userId: "user-1", org: ORG, role, testId: "test-mcas" },
  });
}

function ctx(slug = "acme") {
  return { params: Promise.resolve({ slug }) };
}

function post(body: unknown) {
  return new Request("https://app.example.com/api/portal/acme/mcas/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = { name: "Sales rep — Q3" };

beforeEach(() => {
  vi.clearAllMocks();
  // serverError() logs the real cause by design; keep it out of the test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/portal/[slug]/mcas/links", () => {
  it("propagates the guard's status", async () => {
    requirePortalOrgAccess.mockResolvedValue({
      ok: false,
      status: 403,
      code: "test_access_revoked",
      error: "This test is not available on your current plan",
    });

    const { GET } = await import("./route");
    const res = await GET(new Request("https://app.example.com"), ctx());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      code: "test_access_revoked",
    });
    expect(listPortalMcasLinks).not.toHaveBeenCalled();
  });

  it("lists only the guarded org's links", async () => {
    allow();
    listPortalMcasLinks.mockResolvedValue([{ id: "link-1" }]);

    const { GET } = await import("./route");
    const res = await GET(new Request("https://app.example.com"), ctx());

    expect(res.status).toBe(200);
    // The org id comes from the guard, never from the request.
    expect(listPortalMcasLinks).toHaveBeenCalledWith(ORG.id);
  });

  it("requires only read permission", async () => {
    allow("org_member");

    const { GET } = await import("./route");
    await GET(new Request("https://app.example.com"), ctx());

    expect(requirePortalOrgAccess).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "read", testSlug: "mcas-core-alignment" }),
    );
  });
});

describe("POST /api/portal/[slug]/mcas/links", () => {
  it("requires write permission", async () => {
    allow();
    createPortalMcasLink.mockResolvedValue({ id: "link-1" });

    const { POST } = await import("./route");
    await POST(post(validBody), ctx());

    expect(requirePortalOrgAccess).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "write" }),
    );
  });

  it("rejects an empty name before writing anything", async () => {
    allow();

    const { POST } = await import("./route");
    const res = await POST(post({ name: "   " }), ctx());

    expect(res.status).toBe(400);
    expect(createPortalMcasLink).not.toHaveBeenCalled();
  });

  it("requires a recipient email when send email is on", async () => {
    allow();

    const { POST } = await import("./route");
    const res = await POST(post({ ...validBody, sendEmail: true }), ctx());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "validation_failed" });
    expect(createPortalMcasLink).not.toHaveBeenCalled();
  });

  it("requires a next steps URL when results are shown", async () => {
    allow();

    const { POST } = await import("./route");
    const res = await POST(post({ ...validBody, showResults: true }), ctx());

    expect(res.status).toBe(400);
    expect(createPortalMcasLink).not.toHaveBeenCalled();
  });

  it("requires a count when the usage limit is limited", async () => {
    allow();

    const { POST } = await import("./route");
    const res = await POST(
      post({ ...validBody, usageLimitType: "limited" }),
      ctx(),
    );

    expect(res.status).toBe(400);
    expect(createPortalMcasLink).not.toHaveBeenCalled();
  });

  it("creates the link against the guarded org and returns 201", async () => {
    allow();
    createPortalMcasLink.mockResolvedValue({
      id: "link-1",
      publicToken: "tok-1",
      url: "https://app.example.com/mcas/link/tok-1",
    });

    const { POST } = await import("./route");
    const res = await POST(post(validBody), ctx());

    expect(res.status).toBe(201);

    const body = await res.json();

    // The shareable URL is the reusable landing page. /mcas/t/<link token> is
    // NOT valid — that route resolves partner_application tokens.
    expect(body.link.url).toBe("https://app.example.com/mcas/link/tok-1");

    expect(createPortalMcasLink).toHaveBeenCalledWith(
      expect.objectContaining({ portalOrg: ORG }),
    );
  });

  it("does not leak database errors to the caller", async () => {
    allow();
    createPortalMcasLink.mockRejectedValue(
      new Error('relation "mcas.test_links" violates constraint uq_secret'),
    );

    const { POST } = await import("./route");
    const res = await POST(post(validBody), ctx());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: "Something went wrong",
    });
  });
});
