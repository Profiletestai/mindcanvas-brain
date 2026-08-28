import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeClient, type StubClient, type TableResults } from "../../test/helpers/supabaseStub";

let mcasClient: StubClient;

const getSubmissionAvailability = vi.fn();
const getMcasCatalogueTestId = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mcasClient,
}));

vi.mock("@/app/_lib/billing", () => ({ getSubmissionAvailability }));
vi.mock("@/lib/portal/authz", () => ({ getMcasCatalogueTestId }));

const ACTIVE_LINK = {
  id: "link-1",
  org_id: "mcas-1",
  portal_org_id: "org-a",
  public_token: "tok-1",
  link_type: "candidate_assessment",
  framework_slug: "mcas-core-alignment",
  framework_version: "v1",
  name: "Sales rep",
  report_version: "full",
  show_results: false,
  email_report: false,
  send_email: false,
  recipient_email: null,
  next_steps_url: null,
  usage_limit_type: "unlimited",
  usage_limit_count: null,
  status: "active",
  settings: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const MCAS_ORG = { id: "mcas-1", name: "Acme", slug: "acme", status: "active" };

async function loadModule(tables: TableResults) {
  mcasClient = makeClient(tables);

  vi.resetModules();

  return import("./mcasTestLinks");
}

function tablesFor(link: Record<string, unknown>) {
  return {
    test_links: { data: link },
    organisations: { data: MCAS_ORG },
    // Two count queries in getMcasPublicTestLinkStatus, then the insert.
    partner_applications: [
      { count: 0 },
      { count: 0 },
      { data: { public_token: "app-tok" } },
    ],
  } satisfies TableResults;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

  getMcasCatalogueTestId.mockResolvedValue("test-mcas");
  getSubmissionAvailability.mockResolvedValue({ ok: true, available: true });
});

describe("createMcasApplicationFromReusableLink", () => {
  it("snapshots the link's portal owner onto the application", async () => {
    const { createMcasApplicationFromReusableLink } = await loadModule(
      tablesFor(ACTIVE_LINK),
    );

    await createMcasApplicationFromReusableLink("tok-1");

    const insert = mcasClient.queries.partner_applications
      .flatMap((query) => query.__calls)
      .find((call) => call.method === "insert");

    expect(insert?.args[0]).toMatchObject({
      portal_org_id: "org-a",
      test_link_id: "link-1",
    });
  });

  it("checks the org's quota before the candidate answers anything", async () => {
    const { createMcasApplicationFromReusableLink } = await loadModule(
      tablesFor(ACTIVE_LINK),
    );

    await createMcasApplicationFromReusableLink("tok-1");

    expect(getSubmissionAvailability).toHaveBeenCalledWith("org-a", "test-mcas");
  });

  it("refuses to start when the org has no credits left", async () => {
    getSubmissionAvailability.mockResolvedValue({
      ok: false,
      available: false,
      reason: "limit_reached",
    });

    const { createMcasApplicationFromReusableLink } = await loadModule(
      tablesFor(ACTIVE_LINK),
    );

    await expect(
      createMcasApplicationFromReusableLink("tok-1"),
    ).rejects.toThrow(/no assessment credits remaining/i);

    // Nothing was written.
    expect(
      mcasClient.queries.partner_applications
        .flatMap((query) => query.__calls)
        .some((call) => call.method === "insert"),
    ).toBe(false);
  });

  it("distinguishes an absent subscription from an exhausted one", async () => {
    getSubmissionAvailability.mockResolvedValue({
      ok: false,
      available: false,
      reason: "no_subscription",
    });

    const { createMcasApplicationFromReusableLink } = await loadModule(
      tablesFor(ACTIVE_LINK),
    );

    await expect(
      createMcasApplicationFromReusableLink("tok-1"),
    ).rejects.toThrow(/active subscription/i);
  });

  it("leaves admin-created links alone", async () => {
    const { createMcasApplicationFromReusableLink } = await loadModule(
      tablesFor({ ...ACTIVE_LINK, portal_org_id: null }),
    );

    await createMcasApplicationFromReusableLink("tok-1");

    // No portal owner means no org to charge and nothing to gate on.
    expect(getSubmissionAvailability).not.toHaveBeenCalled();

    const insert = mcasClient.queries.partner_applications
      .flatMap((query) => query.__calls)
      .find((call) => call.method === "insert");

    expect(insert?.args[0]).toMatchObject({ portal_org_id: null });
  });

  it("starts the assessment when the catalogue test is not configured", async () => {
    getMcasCatalogueTestId.mockResolvedValue(null);

    const { createMcasApplicationFromReusableLink } = await loadModule(
      tablesFor(ACTIVE_LINK),
    );

    // A missing migration is an operator problem, not the candidate's.
    await expect(
      createMcasApplicationFromReusableLink("tok-1"),
    ).resolves.toMatchObject({ applicationPublicToken: "app-tok" });

    expect(getSubmissionAvailability).not.toHaveBeenCalled();
  });
});

describe("createMcasReusableTestLink", () => {
  it("writes portal_org_id when the portal creates the link", async () => {
    const { createMcasReusableTestLink } = await loadModule({
      test_links: { data: { id: "link-1", public_token: "tok-1" } },
    });

    await createMcasReusableTestLink({
      orgId: "mcas-1",
      portalOrgId: "org-a",
      linkType: "candidate_assessment",
      name: "Sales rep",
      sendEmail: false,
      reportVersion: "full",
      showResults: false,
      emailReport: false,
      usageLimitType: "unlimited",
    });

    const insert = mcasClient.queries.test_links[0].__calls.find(
      (call) => call.method === "insert",
    );

    expect(insert?.args[0]).toMatchObject({ portal_org_id: "org-a" });
  });

  it("leaves portal_org_id null for /admin/mcas", async () => {
    const { createMcasReusableTestLink } = await loadModule({
      test_links: { data: { id: "link-1", public_token: "tok-1" } },
    });

    await createMcasReusableTestLink({
      orgId: "mcas-1",
      linkType: "candidate_assessment",
      name: "Internal",
      sendEmail: false,
      reportVersion: "full",
      showResults: false,
      emailReport: false,
      usageLimitType: "unlimited",
    });

    const insert = mcasClient.queries.test_links[0].__calls.find(
      (call) => call.method === "insert",
    );

    expect(insert?.args[0]).toMatchObject({ portal_org_id: null });
  });
});
