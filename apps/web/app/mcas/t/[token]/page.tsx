// apps/web/app/mcas/t/[token]/page.tsx

import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import McasWizardClient from "./McasWizardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

type McasPartnerApplicationRow = {
  id: string;
  org_id: string;
  partner_key: string;
  application_id: string;
  public_token: string;
  test_link_id: string | null;
  framework_slug: string;
  framework_version: string;
  status: string;
  candidate_first_name: string | null;
  candidate_last_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
};

type McasTestLinkRow = {
  id: string;
  name: string;
  link_type:
    | "candidate_assessment"
    | "reverse_role_assessment"
    | "internal_validation";
  report_version: "lite" | "full";
  show_results: boolean;
  next_steps_url: string | null;
  status: "active" | "paused" | "expired" | "archived";
};

type McasFrameworkRow = {
  slug: string;
  version: string;
  definition: unknown;
};

type FrameworkQuestion = {
  code: string;
  prompt: string;
  section?: string;
  options: {
    code: string;
    label: string;
  }[];
};

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    db: { schema: "mcas" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseQuestion(value: unknown): FrameworkQuestion | null {
  if (!isRecord(value)) return null;

  const code = String(value.code || "").trim();
  const prompt = String(value.prompt || "").trim();

  const options = Array.isArray(value.options)
    ? value.options
        .map((option) => {
          if (!isRecord(option)) return null;

          const optionCode = String(option.code || "").trim();
          const label = String(option.label || "").trim();

          if (!optionCode || !label) return null;

          return { code: optionCode, label };
        })
        .filter(
          (option): option is { code: string; label: string } =>
            option !== null
        )
    : [];

  if (!code || !prompt || options.length === 0) return null;

  return {
    code,
    prompt,
    section: value.section ? String(value.section) : undefined,
    options,
  };
}

function questionIndex(code: string) {
  return Number(code.replace("Q", "")) || 0;
}

function reportUrlForLink(reportToken: string, testLink: McasTestLinkRow) {
  const encodedReportToken = encodeURIComponent(reportToken);

  if (!testLink.show_results) {
    return testLink.next_steps_url || `/mcas/r/${encodedReportToken}/snapshot`;
  }

  return testLink.report_version === "full"
    ? `/mcas/r/${encodedReportToken}/full`
    : `/mcas/r/${encodedReportToken}/snapshot`;
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;
  const applicationPublicToken = String(token || "").trim();

  if (!applicationPublicToken) notFound();

  const sb = mcasSupa();

  /*
   * /mcas/link/[test-link-token] creates a partner_applications row and
   * redirects here with that new application's public_token.
   *
   * This token is NOT mcas.test_links.public_token.
   */
  const { data: applicationData, error: applicationError } = await sb
    .from("partner_applications")
    .select(
      [
        "id",
        "org_id",
        "partner_key",
        "application_id",
        "public_token",
        "test_link_id",
        "framework_slug",
        "framework_version",
        "status",
        "candidate_first_name",
        "candidate_last_name",
        "candidate_email",
        "candidate_phone",
      ].join(", ")
    )
    .eq("public_token", applicationPublicToken)
    .maybeSingle();

  const application = applicationData as McasPartnerApplicationRow | null;

  if (applicationError || !application) notFound();
  if (!application.test_link_id) notFound();

  const { data: testLinkData, error: testLinkError } = await sb
    .from("test_links")
    .select(
      [
        "id",
        "name",
        "link_type",
        "report_version",
        "show_results",
        "next_steps_url",
        "status",
      ].join(", ")
    )
    .eq("id", application.test_link_id)
    .maybeSingle();

  const testLink = testLinkData as McasTestLinkRow | null;

  if (testLinkError || !testLink) notFound();

  if (
    testLink.status !== "active" ||
    testLink.link_type !== "candidate_assessment"
  ) {
    notFound();
  }

  /*
   * Reopening a completed application token should return the candidate to
   * the report, rather than allow a duplicate assessment.
   */
  if (application.status === "completed") {
    const { data: completedAssessment } = await sb
      .from("assessments")
      .select("report_token")
      .eq("partner_application_id", application.id)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const reportToken = String(completedAssessment?.report_token || "").trim();

    if (reportToken) {
      redirect(reportUrlForLink(reportToken, testLink));
    }
  }

  const { data: frameworkData, error: frameworkError } = await sb
    .from("frameworks")
    .select("slug, version, definition")
    .eq("slug", application.framework_slug)
    .eq("version", application.framework_version)
    .maybeSingle();

  const framework = frameworkData as McasFrameworkRow | null;

  if (frameworkError || !framework || !isRecord(framework.definition)) {
    notFound();
  }

  const rawQuestions = Array.isArray(framework.definition.questions)
    ? framework.definition.questions
    : [];

  const questions = rawQuestions
    .map(normaliseQuestion)
    .filter((question): question is FrameworkQuestion => question !== null)
    .sort((left, right) => questionIndex(left.code) - questionIndex(right.code));

  if (questions.length !== 25) notFound();

  return (
    <McasWizardClient
      token={applicationPublicToken}
      application={{
        application_id: application.application_id,
        partner_key: application.partner_key,
        status: application.status,
        test_link_name: testLink.name,
        report_version: testLink.report_version,
        show_results: testLink.show_results,
        candidate_first_name: application.candidate_first_name,
        candidate_last_name: application.candidate_last_name,
        candidate_email: application.candidate_email,
        candidate_phone: application.candidate_phone,
      }}
      questions={questions}
    />
  );
}