// apps/web/app/api/public/mcas/[token]/submit/_lib/portalUsage.ts
// Portal ownership and usage recording for the public MCAS submit route.
//
// Extracted from route.ts so the attribution and billing rules can be tested
// without standing up a full 25-answer submission.

export type McasUsageOutcome = {
  recorded: boolean;
  /** Absent when the link has no portal owner. */
  reason?: string;
  source?: string;
  alreadyRecorded?: boolean;
};

/**
 * Which portal organisation owns this submission.
 *
 * The link establishes ownership at creation; the application snapshots it when
 * the candidate starts. The application's value wins, because that snapshot was
 * taken at the moment the org actually acquired this candidate — a link that is
 * later re-pointed or handed to a different org must not re-attribute work that
 * is already done.
 *
 * NULL for every link created in /admin/mcas: those belong to no portal tenant.
 */
export function resolvePortalOwner(
  application: { portal_org_id?: string | null },
  testLink: { portal_org_id?: string | null },
): string | null {
  return application.portal_org_id ?? testLink.portal_org_id ?? null;
}

/** Namespaced against the GED flow, which uses bare taker ids as references. */
export function usageReference(assessmentId: string): string {
  return `mcas:${assessmentId}`;
}

type Deps = {
  reserveSubmission: (
    orgId: string,
    referenceId: string,
    testId?: string | null,
  ) => Promise<{
    ok: boolean;
    reason?: string;
    source?: string;
    already_recorded?: boolean;
  }>;
  getMcasCatalogueTestId: () => Promise<string | null>;
};

/**
 * Records one portal usage event for a completed MCAS assessment.
 *
 * Never throws. The caller has already scored and persisted the candidate's
 * result by this point; losing that to protect a ledger row would be the wrong
 * trade. The gate that can actually turn a candidate away runs earlier, at link
 * start, in createMcasApplicationFromReusableLink.
 */
export async function recordPortalMcasUsage(
  portalOrgId: string | null,
  assessmentId: string,
  deps?: Deps,
): Promise<McasUsageOutcome> {
  if (!portalOrgId) return { recorded: false, reason: "no_portal_org" };

  try {
    // Deferred so a submission with no portal owner never pulls the
    // billing/Stripe module graph in.
    const resolved: Deps =
      deps ??
      (await (async () => {
        const [billing, authz] = await Promise.all([
          import("@/app/_lib/billing"),
          import("@/lib/portal/authz"),
        ]);

        return {
          reserveSubmission: billing.reserveSubmission,
          getMcasCatalogueTestId: authz.getMcasCatalogueTestId,
        };
      })());

    const testId = await resolved.getMcasCatalogueTestId();

    if (!testId) {
      console.error(
        "[MCAS submit] No portal.tests row for mcas-core-alignment — usage not recorded",
        { portalOrgId, assessmentId },
      );
      return { recorded: false, reason: "test_not_configured" };
    }

    const reservation = await resolved.reserveSubmission(
      portalOrgId,
      usageReference(assessmentId),
      testId,
    );

    if (!reservation.ok) {
      // The start gate should have caught this. Reaching here means the org ran
      // out between starting and submitting — record the fact, keep the result.
      console.error("[MCAS submit] usage not recorded", {
        portalOrgId,
        assessmentId,
        reason: reservation.reason,
      });
      return { recorded: false, reason: reservation.reason };
    }

    return {
      recorded: true,
      source: reservation.source,
      alreadyRecorded: Boolean(reservation.already_recorded),
    };
  } catch (caught) {
    console.error("[MCAS submit] usage recording threw", {
      portalOrgId,
      assessmentId,
      error: caught instanceof Error ? caught.message : String(caught),
    });
    return { recorded: false, reason: "error" };
  }
}
