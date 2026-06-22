// apps/web/lib/mcas/mcasCandidateReports.ts

import "server-only";

import { createClient } from "@supabase/supabase-js";

export type McasCandidateReportAccess = {
  isReady: boolean;
  reason: string | null;

  assessmentId: string | null;
  assessmentStatus: string | null;
  reportToken: string | null;

  reportVersion: "lite" | "full" | null;
  testLinkName: string | null;

  snapshotUrl: string | null;
  fullReportUrl: string | null;
  candidateReportUrl: string | null;
  candidateReportLabel: string | null;
};

type PartnerApplicationRow = {
  id: string;
  org_id: string;
  test_link_id: string | null;
};

type AssessmentRow = {
  id: string;
  report_token: string | null;
  test_link_id: string | null;
  status: string | null;
};

type ResultRow = {
  id: string;
};

type TestLinkRow = {
  id: string;
  name: string;
  report_version: "lite" | "full";
};

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    db: { schema: "mcas" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function pending(
  reason: string,
  partial: Partial<McasCandidateReportAccess> = {}
): McasCandidateReportAccess {
  return {
    isReady: false,
    reason,
    assessmentId: null,
    assessmentStatus: null,
    reportToken: null,
    reportVersion: null,
    testLinkName: null,
    snapshotUrl: null,
    fullReportUrl: null,
    candidateReportUrl: null,
    candidateReportLabel: null,
    ...partial,
  };
}

/**
 * Resolves the public candidate report from an internal partner-application ID.
 * It intentionally reads the MCAS tables directly, rather than relying on the
 * admin database view, so the button works while that view evolves.
 */
export async function getMcasCandidateReportAccess({
  orgId,
  candidateId,
}: {
  orgId: string;
  candidateId: string;
}): Promise<McasCandidateReportAccess> {
  const supabase = mcasSupa();

  const { data: applicationData, error: applicationError } = await supabase
    .from("partner_applications")
    .select("id, org_id, test_link_id")
    .eq("id", candidateId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (applicationError) {
    throw new Error(
      `Failed to load MCAS candidate application: ${applicationError.message}`
    );
  }

  const application = applicationData as PartnerApplicationRow | null;

  if (!application) {
    return pending("Candidate application not found.");
  }

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("assessments")
    .select("id, report_token, test_link_id, status")
    .eq("partner_application_id", application.id)
    .order("completed_at", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError) {
    throw new Error(`Failed to load MCAS assessment: ${assessmentError.message}`);
  }

  const assessment = assessmentData as AssessmentRow | null;

  if (!assessment) {
    return pending("This candidate has not submitted an assessment yet.");
  }

  const reportToken = cleanText(assessment.report_token);

  if (!reportToken) {
    return pending("This assessment does not have a report token yet.", {
      assessmentId: assessment.id,
      assessmentStatus: assessment.status,
    });
  }

  const { data: resultData, error: resultError } = await supabase
    .from("results")
    .select("id")
    .eq("assessment_id", assessment.id)
    .maybeSingle();

  if (resultError) {
    throw new Error(`Failed to load MCAS result: ${resultError.message}`);
  }

  const result = resultData as ResultRow | null;

  if (!result || assessment.status !== "completed") {
    return pending("This assessment is still being completed or scored.", {
      assessmentId: assessment.id,
      assessmentStatus: assessment.status,
      reportToken,
    });
  }

  const testLinkId = assessment.test_link_id ?? application.test_link_id;

  let testLink: TestLinkRow | null = null;

  if (testLinkId) {
    const { data: testLinkData, error: testLinkError } = await supabase
      .from("test_links")
      .select("id, name, report_version")
      .eq("id", testLinkId)
      .maybeSingle();

    if (testLinkError) {
      throw new Error(`Failed to load MCAS test link: ${testLinkError.message}`);
    }

    testLink = testLinkData as TestLinkRow | null;
  }

  const reportVersion = testLink?.report_version ?? "full";
  const token = encodeURIComponent(reportToken);
  const snapshotUrl = `/mcas/r/${token}/snapshot`;
  const fullReportUrl = `/mcas/r/${token}/full`;
  const candidateReportUrl =
    reportVersion === "lite" ? snapshotUrl : fullReportUrl;

  return {
    isReady: true,
    reason: null,
    assessmentId: assessment.id,
    assessmentStatus: assessment.status,
    reportToken,
    reportVersion,
    testLinkName: testLink?.name ?? null,
    snapshotUrl,
    fullReportUrl,
    candidateReportUrl,
    candidateReportLabel:
      reportVersion === "lite"
        ? "View Lite Candidate Report"
        : "View Full Candidate Report",
  };
}