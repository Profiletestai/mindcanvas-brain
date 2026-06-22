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
  showResults: boolean | null;
  nextStepsUrl: string | null;

  snapshotUrl: string | null;
  fullReportUrl: string | null;
  candidateReportUrl: string | null;
  candidateReportLabel: string | null;
};

type McasPartnerApplicationRow = {
  id: string;
  org_id: string;
  test_link_id: string | null;
};

type McasAssessmentRow = {
  id: string;
  report_token: string | null;
  test_link_id: string | null;
  status: string | null;
  completed_at: string | null;
};

type McasResultRow = {
  id: string;
};

type McasTestLinkRow = {
  id: string;
  name: string;
  report_version: "lite" | "full";
  show_results: boolean;
  next_steps_url: string | null;
};

function getMcasAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    db: {
      schema: "mcas",
    },
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

function emptyReportAccess(
  reason: string,
  partial?: Partial<McasCandidateReportAccess>
): McasCandidateReportAccess {
  return {
    isReady: false,
    reason,

    assessmentId: null,
    assessmentStatus: null,
    reportToken: null,

    reportVersion: null,
    testLinkName: null,
    showResults: null,
    nextStepsUrl: null,

    snapshotUrl: null,
    fullReportUrl: null,
    candidateReportUrl: null,
    candidateReportLabel: null,

    ...partial,
  };
}

/**
 * Resolves the completed MCAS assessment and the correct candidate-facing report
 * for one partner application.
 *
 * This intentionally reads the live MCAS tables directly instead of depending
 * on v_admin_candidate_database. The profile button therefore works even before
 * the reporting fields are added to that database view.
 */
export async function getMcasCandidateReportAccess({
  orgId,
  candidateId,
}: {
  orgId: string;
  candidateId: string;
}): Promise<McasCandidateReportAccess> {
  const supabase = getMcasAdminClient();

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

  const application = applicationData as McasPartnerApplicationRow | null;

  if (!application) {
    return emptyReportAccess("Candidate application not found.");
  }

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("assessments")
    .select("id, report_token, test_link_id, status, completed_at")
    .eq("partner_application_id", application.id)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError) {
    throw new Error(
      `Failed to load MCAS assessment: ${assessmentError.message}`
    );
  }

  const assessment = assessmentData as McasAssessmentRow | null;

  if (!assessment) {
    return emptyReportAccess(
      "This candidate has not submitted an assessment yet."
    );
  }

  const reportToken = cleanText(assessment.report_token);

  if (!reportToken) {
    return emptyReportAccess(
      "This assessment does not have a report token yet.",
      {
        assessmentId: assessment.id,
        assessmentStatus: assessment.status,
      }
    );
  }

  const { data: resultData, error: resultError } = await supabase
    .from("results")
    .select("id")
    .eq("assessment_id", assessment.id)
    .maybeSingle();

  if (resultError) {
    throw new Error(`Failed to load MCAS result: ${resultError.message}`);
  }

  const result = resultData as McasResultRow | null;

  if (!result || assessment.status !== "completed") {
    return emptyReportAccess(
      "The assessment is still being completed or scored.",
      {
        assessmentId: assessment.id,
        assessmentStatus: assessment.status,
        reportToken,
      }
    );
  }

  const testLinkId = assessment.test_link_id ?? application.test_link_id;

  let testLink: McasTestLinkRow | null = null;

  if (testLinkId) {
    const { data: testLinkData, error: testLinkError } = await supabase
      .from("test_links")
      .select("id, name, report_version, show_results, next_steps_url")
      .eq("id", testLinkId)
      .maybeSingle();

    if (testLinkError) {
      throw new Error(
        `Failed to load MCAS test link: ${testLinkError.message}`
      );
    }

    testLink = testLinkData as McasTestLinkRow | null;
  }

  /*
   * Legacy/API applications may not have a test link. Their internal review
   * defaults to the Full report because that is the only complete report view.
   */
  const reportVersion = testLink?.report_version ?? "full";
  const encodedToken = encodeURIComponent(reportToken);
  const snapshotUrl = `/mcas/r/${encodedToken}/snapshot`;
  const fullReportUrl = `/mcas/r/${encodedToken}/full`;
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
    showResults: testLink?.show_results ?? null,
    nextStepsUrl: testLink?.next_steps_url ?? null,

    snapshotUrl,
    fullReportUrl,
    candidateReportUrl,
    candidateReportLabel:
      reportVersion === "lite"
        ? "View Lite Candidate Report"
        : "View Full Candidate Report",
  };
}