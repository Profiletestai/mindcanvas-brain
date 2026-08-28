import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasFilter,
  makeClient,
  type StubClient,
  type TableResults,
} from "../../test/helpers/supabaseStub";

const ORG_A = "org-a";
const ORG_B = "org-b";

let mcasClient: StubClient;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mcasClient,
}));

async function loadAdapter(tables: TableResults) {
  mcasClient = makeClient(tables);

  vi.resetModules();

  return import("./mcasPortalData");
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
});

describe("ensureMcasOrganisationForPortalOrg", () => {
  it("reuses the existing mirror row", async () => {
    const { ensureMcasOrganisationForPortalOrg } = await loadAdapter({
      organisations: { data: { id: "mcas-1", slug: "acme" } },
    });

    const result = await ensureMcasOrganisationForPortalOrg({
      id: ORG_A,
      slug: "acme",
      name: "Acme",
    });

    expect(result).toEqual({ id: "mcas-1", slug: "acme" });
    // One lookup, no insert.
    expect(mcasClient.queries.organisations).toHaveLength(1);
  });

  it("creates the mirror row when absent", async () => {
    const { ensureMcasOrganisationForPortalOrg } = await loadAdapter({
      organisations: [
        { data: null },
        { data: { id: "mcas-new", slug: "acme" } },
      ],
    });

    const result = await ensureMcasOrganisationForPortalOrg({
      id: ORG_A,
      slug: "acme",
      name: "Acme",
    });

    expect(result).toEqual({ id: "mcas-new", slug: "acme" });
    expect(mcasClient.queries.organisations[1].__calls[0].method).toBe("insert");
  });

  it("re-reads instead of failing when a concurrent create wins", async () => {
    const { ensureMcasOrganisationForPortalOrg } = await loadAdapter({
      organisations: [
        { data: null },
        { data: null, error: { message: "duplicate key", code: "23505" } },
        { data: { id: "mcas-raced", slug: "acme" } },
      ],
    });

    const result = await ensureMcasOrganisationForPortalOrg({
      id: ORG_A,
      slug: "acme",
      name: "Acme",
    });

    expect(result).toEqual({ id: "mcas-raced", slug: "acme" });
  });
});

describe("listPortalMcasCandidates", () => {
  it("filters on the caller's portal_org_id", async () => {
    const { listPortalMcasCandidates } = await loadAdapter({
      v_portal_candidate_database: { data: [], count: 0 },
    });

    await listPortalMcasCandidates(ORG_A);

    const query = mcasClient.queries.v_portal_candidate_database[0];

    expect(hasFilter(query, "eq", "portal_org_id", ORG_A)).toBe(true);
    expect(hasFilter(query, "eq", "portal_org_id", ORG_B)).toBe(false);
  });

  it("pushes the search into SQL rather than filtering after the fetch", async () => {
    const { listPortalMcasCandidates } = await loadAdapter({
      v_portal_candidate_database: { data: [], count: 0 },
    });

    await listPortalMcasCandidates(ORG_A, { query: "ada" });

    const query = mcasClient.queries.v_portal_candidate_database[0];
    const or = query.__calls.find((call) => call.method === "or");

    // Filtering in JS after a capped fetch cannot paginate correctly.
    expect(or).toBeDefined();
    expect(String(or?.args[0])).toContain("candidate_email.ilike.%ada%");
  });

  it("clamps the page size and translates the page to a range", async () => {
    const { listPortalMcasCandidates } = await loadAdapter({
      v_portal_candidate_database: { data: [], count: 0 },
    });

    const result = await listPortalMcasCandidates(ORG_A, {
      page: 3,
      pageSize: 5000,
    });

    expect(result.pageSize).toBe(100);

    const range = mcasClient.queries.v_portal_candidate_database[0].__calls.find(
      (call) => call.method === "range",
    );

    expect(range?.args).toEqual([200, 299]);
  });

  it("reports hasMore from the total, not the page length", async () => {
    const { listPortalMcasCandidates } = await loadAdapter({
      v_portal_candidate_database: {
        data: [
          {
            partner_application_id: "app-1",
            org_id: "mcas-1",
            partner_key: "acme",
            application_id: "acme-1",
            public_token: "tok",
            application_status: "completed",
            candidate_first_name: "Ada",
            candidate_last_name: "Lovelace",
            application_created_at: "2026-01-01T00:00:00Z",
          },
        ],
        count: 40,
      },
    });

    const result = await listPortalMcasCandidates(ORG_A, { pageSize: 1 });

    expect(result.total).toBe(40);
    expect(result.hasMore).toBe(true);
    expect(result.rows[0].fullName).toBe("Ada Lovelace");
  });
});

describe("getPortalMcasCandidate", () => {
  it("scopes the lookup to the org and the candidate", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: { data: null },
    });

    const result = await getPortalMcasCandidate(ORG_A, "app-1");

    const query = mcasClient.queries.v_portal_candidate_database[0];

    expect(hasFilter(query, "eq", "portal_org_id", ORG_A)).toBe(true);
    expect(hasFilter(query, "eq", "partner_application_id", "app-1")).toBe(true);

    // Another org's candidate is indistinguishable from one that does not exist.
    expect(result).toBeNull();
  });
});

describe("getPortalMcasCandidate report access", () => {
  const baseRow = {
    partner_application_id: "app-1",
    org_id: "mcas-1",
    partner_key: "acme",
    application_id: "acme-1",
    public_token: "tok",
    application_status: "completed",
    candidate_first_name: "Ada",
    candidate_last_name: "Lovelace",
    application_created_at: "2026-01-01T00:00:00Z",
    test_link_id: "link-1",
    test_link_name: "Sales rep",
  };

  it("exposes both report URLs when the link shows results to the candidate", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: {
        data: {
          ...baseRow,
          assessment_report_token: "rep-tok",
          assessment_status: "completed",
          result_id: "result-1",
          test_link_report_version: "full",
          test_link_show_results: true,
        },
      },
    });

    const candidate = await getPortalMcasCandidate(ORG_A, "app-1");

    expect(candidate).toMatchObject({
      reportReady: true,
      reportReason: null,
      snapshotUrl: "/mcas/r/rep-tok/snapshot",
      fullReportUrl: "/mcas/r/rep-tok/full",
      primaryReportUrl: "/mcas/r/rep-tok/full",
    });
  });

  it("withholds the snapshot URL when show_results is off", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: {
        data: {
          ...baseRow,
          assessment_report_token: "rep-tok",
          assessment_status: "completed",
          result_id: "result-1",
          test_link_report_version: "full",
          test_link_show_results: false,
        },
      },
    });

    const candidate = await getPortalMcasCandidate(ORG_A, "app-1");

    // That page 404s on snapshotUnlocked; a button that cannot render is worse
    // than no button.
    expect(candidate?.snapshotUrl).toBeNull();
    expect(candidate?.reportReady).toBe(true);
  });

  it("keeps the full report as the staff default even for a lite link", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: {
        data: {
          ...baseRow,
          assessment_report_token: "rep-tok",
          assessment_status: "completed",
          result_id: "result-1",
          test_link_report_version: "lite",
          test_link_show_results: false,
        },
      },
    });

    const candidate = await getPortalMcasCandidate(ORG_A, "app-1");

    // fullUnlocked only gates the candidate's upsell; the full page renders
    // regardless, and staff are entitled to the whole result.
    expect(candidate?.primaryReportUrl).toBe("/mcas/r/rep-tok/full");
    expect(candidate?.snapshotUrl).toBeNull();
  });

  it("withholds the URLs while the assessment is unscored", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: {
        data: {
          ...baseRow,
          application_status: "started",
          assessment_report_token: "rep-tok",
          assessment_status: "started",
          result_id: null,
          test_link_report_version: "full",
        },
      },
    });

    const candidate = await getPortalMcasCandidate(ORG_A, "app-1");

    expect(candidate).toMatchObject({
      reportReady: false,
      primaryReportUrl: null,
    });
    expect(candidate?.reportReason).toMatch(/being completed or scored/);
  });

  it("reports a candidate who never submitted", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: {
        data: {
          ...baseRow,
          application_status: "created",
          assessment_report_token: null,
          assessment_status: null,
          result_id: null,
          test_link_report_version: "full",
        },
      },
    });

    const candidate = await getPortalMcasCandidate(ORG_A, "app-1");

    expect(candidate?.reportReady).toBe(false);
    expect(candidate?.reportReason).toMatch(/not submitted/);
  });

  it("escapes the report token into the URL", async () => {
    const { getPortalMcasCandidate } = await loadAdapter({
      v_portal_candidate_database: {
        data: {
          ...baseRow,
          assessment_report_token: "a b/c",
          assessment_status: "completed",
          result_id: "result-1",
          test_link_report_version: "full",
          test_link_show_results: true,
        },
      },
    });

    const candidate = await getPortalMcasCandidate(ORG_A, "app-1");

    expect(candidate?.fullReportUrl).toBe("/mcas/r/a%20b%2Fc/full");
  });
});

describe("updatePortalMcasLink", () => {
  it("puts the ownership predicate in the UPDATE itself", async () => {
    const { updatePortalMcasLink } = await loadAdapter({
      test_links: {
        data: {
          id: "link-1",
          name: "Renamed",
          status: "active",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    });

    await updatePortalMcasLink(ORG_A, "link-1", { name: "Renamed" });

    const query = mcasClient.queries.test_links[0];

    expect(hasFilter(query, "eq", "id", "link-1")).toBe(true);
    expect(hasFilter(query, "eq", "portal_org_id", ORG_A)).toBe(true);
  });

  it("returns null when the row belongs to another org", async () => {
    const { updatePortalMcasLink } = await loadAdapter({
      test_links: { data: null },
    });

    const result = await updatePortalMcasLink(ORG_B, "link-1", {
      name: "Renamed",
    });

    expect(result).toBeNull();
  });

  it("returns the archived row instead of reporting it missing", async () => {
    const { updatePortalMcasLink } = await loadAdapter({
      test_links: {
        data: {
          id: "link-1",
          name: "Old role",
          status: "archived",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    });

    // listPortalMcasLinks excludes archived links, so re-reading after the
    // update would report a successful archive as "not found".
    const result = await updatePortalMcasLink(ORG_A, "link-1", {
      status: "archived",
    });

    expect(result).toMatchObject({ id: "link-1", status: "archived" });
  });

  it("refuses an empty patch", async () => {
    const { updatePortalMcasLink } = await loadAdapter({ test_links: {} });

    await expect(updatePortalMcasLink(ORG_A, "link-1", {})).rejects.toThrow(
      /Nothing to update/,
    );
  });
});

describe("listPortalMcasLinks", () => {
  it("scopes on portal_org_id, never on the mcas organisation", async () => {
    const { listPortalMcasLinks } = await loadAdapter({
      test_links: {
        data: [
          {
            id: "link-1",
            org_id: "mcas-1",
            portal_org_id: ORG_A,
            public_token: "tok-1",
            link_type: "candidate_assessment",
            framework_slug: "mcas-core-alignment",
            framework_version: "v1",
            name: "Sales rep",
            report_version: "full",
            show_results: false,
            email_report: false,
            send_email: false,
            usage_limit_type: "unlimited",
            usage_limit_count: null,
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      partner_applications: {
        data: [
          { test_link_id: "link-1", status: "completed" },
          { test_link_id: "link-1", status: "started" },
        ],
      },
    });

    const links = await listPortalMcasLinks(ORG_A);

    const query = mcasClient.queries.test_links[0];

    expect(hasFilter(query, "eq", "portal_org_id", ORG_A)).toBe(true);
    expect(hasFilter(query, "eq", "org_id")).toBe(false);

    expect(links[0]).toMatchObject({
      totalApplications: 2,
      completedApplications: 1,
      openApplications: 1,
      reusableUrl: "https://app.example.com/mcas/link/tok-1",
    });
  });

  it("counts every link in one query rather than two per link", async () => {
    const { listPortalMcasLinks } = await loadAdapter({
      test_links: {
        data: [1, 2, 3].map((n) => ({
          id: `link-${n}`,
          org_id: "mcas-1",
          portal_org_id: ORG_A,
          public_token: `tok-${n}`,
          link_type: "candidate_assessment",
          framework_slug: "mcas-core-alignment",
          framework_version: "v1",
          name: `Link ${n}`,
          report_version: "full",
          show_results: false,
          email_report: false,
          send_email: false,
          usage_limit_type: "unlimited",
          usage_limit_count: null,
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        })),
      },
      partner_applications: { data: [] },
    });

    await listPortalMcasLinks(ORG_A);

    expect(mcasClient.queries.partner_applications).toHaveLength(1);
  });
});
