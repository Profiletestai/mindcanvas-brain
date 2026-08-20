import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordPortalMcasUsage,
  resolvePortalOwner,
  usageReference,
} from "./portalUsage";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("resolvePortalOwner", () => {
  it("takes ownership from the link when the application has none", () => {
    expect(
      resolvePortalOwner({ portal_org_id: null }, { portal_org_id: "org-a" }),
    ).toBe("org-a");
  });

  it("keeps the application's snapshot when the link was re-pointed", () => {
    // The link now belongs to org-b, but this candidate started under org-a and
    // must stay attributed there.
    expect(
      resolvePortalOwner({ portal_org_id: "org-a" }, { portal_org_id: "org-b" }),
    ).toBe("org-a");
  });

  it("is null for links that belong to no portal organisation", () => {
    expect(
      resolvePortalOwner({ portal_org_id: null }, { portal_org_id: null }),
    ).toBeNull();
  });

  it("tolerates rows read before the ownership columns existed", () => {
    expect(resolvePortalOwner({}, {})).toBeNull();
  });
});

describe("usageReference", () => {
  it("namespaces the reference against the GED flow's bare taker ids", () => {
    expect(usageReference("assessment-1")).toBe("mcas:assessment-1");
  });
});

describe("recordPortalMcasUsage", () => {
  type Deps = NonNullable<Parameters<typeof recordPortalMcasUsage>[2]>;

  // Mock<Deps[k]> so .mock.calls stays visible while the object still satisfies
  // the real dependency signature.
  type MockedDeps = {
    reserveSubmission: ReturnType<typeof vi.fn> & Deps["reserveSubmission"];
    getMcasCatalogueTestId: ReturnType<typeof vi.fn> &
      Deps["getMcasCatalogueTestId"];
  };

  function deps(overrides: Partial<MockedDeps> = {}): MockedDeps {
    return {
      reserveSubmission: vi.fn().mockResolvedValue({
        ok: true,
        source: "engine_trial",
      }),
      getMcasCatalogueTestId: vi.fn().mockResolvedValue("test-mcas"),
      ...overrides,
    } as MockedDeps;
  }

  it("records nothing for a link with no portal owner", async () => {
    const d = deps();

    const result = await recordPortalMcasUsage(null, "assessment-1", d);

    expect(result).toEqual({ recorded: false, reason: "no_portal_org" });
    expect(d.reserveSubmission).not.toHaveBeenCalled();
  });

  it("charges the owning org once, against the MCAS catalogue test", async () => {
    const d = deps();

    const result = await recordPortalMcasUsage("org-a", "assessment-1", d);

    expect(d.reserveSubmission).toHaveBeenCalledTimes(1);
    expect(d.reserveSubmission).toHaveBeenCalledWith(
      "org-a",
      "mcas:assessment-1",
      "test-mcas",
    );
    expect(result).toMatchObject({ recorded: true, source: "engine_trial" });
  });

  it("uses a reference stable across retries", async () => {
    const d = deps();

    await recordPortalMcasUsage("org-a", "assessment-1", d);
    await recordPortalMcasUsage("org-a", "assessment-1", d);

    const [first, second] = d.reserveSubmission.mock.calls;

    // Same reference twice is what lets fn_reserve_submission short-circuit the
    // second call instead of spending a second credit.
    expect(first[1]).toBe(second[1]);
  });

  it("surfaces an already-recorded retry without treating it as a failure", async () => {
    const d = deps({
      reserveSubmission: vi
        .fn()
        .mockResolvedValue({ ok: true, already_recorded: true }),
    });

    const result = await recordPortalMcasUsage("org-a", "assessment-1", d);

    expect(result).toMatchObject({ recorded: true, alreadyRecorded: true });
  });

  it("reports, but does not throw on, an exhausted quota", async () => {
    const d = deps({
      reserveSubmission: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "limit_reached" }),
    });

    // The candidate's result is already saved by the time this runs.
    const result = await recordPortalMcasUsage("org-a", "assessment-1", d);

    expect(result).toEqual({ recorded: false, reason: "limit_reached" });
  });

  it("does not charge when the catalogue test is missing", async () => {
    const d = deps({ getMcasCatalogueTestId: vi.fn().mockResolvedValue(null) });

    const result = await recordPortalMcasUsage("org-a", "assessment-1", d);

    expect(result).toEqual({ recorded: false, reason: "test_not_configured" });
    expect(d.reserveSubmission).not.toHaveBeenCalled();
  });

  it("swallows a thrown reservation so the result is still returned", async () => {
    const d = deps({
      reserveSubmission: vi.fn().mockRejectedValue(new Error("connection reset")),
    });

    const result = await recordPortalMcasUsage("org-a", "assessment-1", d);

    expect(result).toEqual({ recorded: false, reason: "error" });
  });
});
