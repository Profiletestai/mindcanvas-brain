// apps/web/app/api/debug/mcas-token/[token]/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type McasApplicationRow = {
  id: string;
  public_token: string | null;
  partner_key: string | null;
  application_id: string | null;
  org_id: string | null;
  status: string | null;
  framework_slug: string | null;
  framework_version: string | null;
  candidate_first_name: string | null;
  candidate_last_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type McasAssessmentRow = {
  id: string;
  partner_application_id: string | null;
  individual_id: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type McasResultRow = {
  id: string;
  assessment_id: string | null;
  core_distribution: unknown;
  os_distribution: unknown;
  vertical_readiness: unknown;
  flags: unknown;
  confidence: unknown;
  scoring_model: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    db: { schema: "mcas" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export async function GET(_req: Request, context: RouteContext) {
  const { token } = await context.params;
  const publicToken = (token || "").trim();

  if (!publicToken) {
    return NextResponse.json(
      {
        ok: false,
        step: "token",
        error: "Missing token.",
      },
      { status: 400 }
    );
  }

  const sb = mcasSupa();

  const {
    data: applicationData,
    error: applicationError,
  } = await sb
    .from("partner_applications")
    .select(
      [
        "id",
        "public_token",
        "partner_key",
        "application_id",
        "org_id",
        "status",
        "framework_slug",
        "framework_version",
        "candidate_first_name",
        "candidate_last_name",
        "candidate_email",
        "candidate_phone",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("public_token", publicToken)
    .maybeSingle();

  const application = applicationData as McasApplicationRow | null;

  if (applicationError) {
    return NextResponse.json(
      {
        ok: false,
        step: "partner_applications",
        token: publicToken,
        error: applicationError.message,
      },
      { status: 500 }
    );
  }

  if (!application) {
    return NextResponse.json(
      {
        ok: false,
        step: "partner_applications",
        token: publicToken,
        error:
          "No row found in mcas.partner_applications for this public_token.",
      },
      { status: 404 }
    );
  }

  const {
    data: assessmentData,
    error: assessmentError,
  } = await sb
    .from("assessments")
    .select(
      [
        "id",
        "partner_application_id",
        "individual_id",
        "status",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("partner_application_id", application.id)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assessment = assessmentData as McasAssessmentRow | null;

  if (assessmentError) {
    return NextResponse.json(
      {
        ok: false,
        step: "assessments",
        token: publicToken,
        application,
        error: assessmentError.message,
      },
      { status: 500 }
    );
  }

  if (!assessment) {
    return NextResponse.json(
      {
        ok: false,
        step: "assessments",
        token: publicToken,
        application,
        error:
          "Application was found, but no assessment row exists for this application id.",
      },
      { status: 404 }
    );
  }

  const { data: resultData, error: resultError } = await sb
    .from("results")
    .select(
      [
        "id",
        "assessment_id",
        "core_distribution",
        "os_distribution",
        "vertical_readiness",
        "flags",
        "confidence",
        "scoring_model",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("assessment_id", assessment.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = resultData as McasResultRow | null;

  if (resultError) {
    return NextResponse.json(
      {
        ok: false,
        step: "results",
        token: publicToken,
        application,
        assessment,
        error: resultError.message,
      },
      { status: 500 }
    );
  }

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        step: "results",
        token: publicToken,
        application,
        assessment,
        error:
          "Application and assessment were found, but no result row exists for this assessment id.",
      },
      { status: 404 }
    );
  }

  let reportAccessPayload: unknown = null;

  try {
    const { data: reportAccess, error: reportAccessError } = await sb
      .from("report_access")
      .select(
        "snapshot_unlocked, full_unlocked, internal_unlocked, full_purchase_enabled"
      )
      .eq("application_id", application.id)
      .maybeSingle();

    reportAccessPayload = {
      data: reportAccess,
      error: reportAccessError?.message ?? null,
      note:
        reportAccessError?.message ??
        "If data is null, snapshot should still default to unlocked and full should default to locked.",
    };
  } catch (error: unknown) {
    reportAccessPayload = {
      data: null,
      error: getErrorMessage(error),
      note:
        "report_access lookup failed. This should not block snapshot access if reportPayload.ts is defensive.",
    };
  }

  return NextResponse.json({
    ok: true,
    token: publicToken,
    expectedUrls: {
      test: `/mcas/t/${publicToken}`,
      snapshot: `/mcas/r/${publicToken}/snapshot`,
      full: `/mcas/r/${publicToken}/full`,
    },
    application,
    assessment,
    result,
    reportAccess: reportAccessPayload,
  });
}