// apps/web/app/api/mcas/reverse/[runId]/export/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.MCAS_API_BEARER_TOKEN || "";
  if (!expected) return false;

  const received = getBearerToken(req);
  return !!received && received === expected;
}

type ReportContentBlock = {
  section_key: "oss" | "rfs" | "cvs";
  content: any;
};

function buildIdealCandidateProfile(payload: any) {
  const scoring = payload?.result?.scoring || {};
  const wording = payload?.result?.wording || {};

  const primaryStyle =
    scoring?.primary_operating_style?.label ||
    wording?.operating_style?.label ||
    "this profile";

  const careerVertical =
    scoring?.career_vertical?.label ||
    wording?.career_vertical?.label ||
    "the required level of responsibility";

  const operatingWords: string[] = Array.isArray(wording?.operating_style?.words)
    ? wording.operating_style.words
    : [];

  const careerWords: string[] = Array.isArray(wording?.career_vertical?.words)
    ? wording.career_vertical.words
    : [];

  return {
    thinking_style: {
      title: "How this ideal candidate thinks",
      summary:
        `This ideal candidate shows the thinking pattern of ${primaryStyle}. ` +
        `They are likely to approach work through ${
          operatingWords.length
            ? operatingWords.join(", ")
            : "clear behavioural strengths"
        } and will naturally focus on what creates movement, clarity, and useful outcomes. ` +
        `At ${careerVertical} level, they need to think beyond isolated tasks and consider the broader impact of decisions, priorities, and trade-offs.`,
    },
    execution_style: {
      title: "How they execute and perform",
      summary:
        `This ideal candidate is expected to execute through ${
          operatingWords.length
            ? operatingWords.join(", ")
            : "their dominant operating style"
        }. ` +
        `They should be able to turn direction into action, maintain momentum, and produce outcomes that match the level of responsibility required. ` +
        `The role is likely to need someone who can ${
          careerWords.length
            ? careerWords.join(", ")
            : "perform consistently at the required career vertical"
        }.`,
    },
    team_style: {
      title: "How they operate in a team",
      summary:
        `In a team context, this ideal candidate should contribute through the behavioural strengths associated with ${primaryStyle}. ` +
        `They are expected to support the system by bringing the right balance of contribution, ownership, and collaboration for the role. ` +
        `At ${careerVertical} level, their team impact should extend beyond personal delivery and support wider alignment, performance, and execution.`,
    },
  };
}

function cleanExistingReport(report: any) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {};
  }

  const cleanReport = { ...report };

  // Prevent duplicated payload output:
  // Keep this only at result.ideal_candidate_profile, not inside result.report.
  delete cleanReport.ideal_candidate_profile;

  return cleanReport;
}

async function fetchReportSections(sb: ReturnType<typeof supa>, payload: any) {
  const frameworkSlug = payload?.framework?.slug || "mcas-core-alignment";
  const frameworkVersion = payload?.framework?.version || "v1";

  const operatingStyleCode =
    payload?.result?.scoring?.primary_operating_style?.code ||
    payload?.result?.wording?.operating_style?.code ||
    null;

  const careerVertical = payload?.result?.scoring?.career_vertical || null;

  const fallback = {
    operating_style_summary: null,
    role_fit_summary: null,
    career_vertical_summary: careerVertical
      ? {
          current_vertical: {
            code: careerVertical.code,
            label: careerVertical.label,
            avg_score: careerVertical.avg_score,
            summary: null,
          },
        }
      : null,
  };

  if (!operatingStyleCode) return fallback;

  const { data, error } = await sb
    .from("report_content_blocks")
    .select("section_key, content")
    .eq("framework_slug", frameworkSlug)
    .eq("framework_version", frameworkVersion)
    .eq("operating_style_code", operatingStyleCode)
    .eq("is_active", true)
    .in("section_key", ["oss", "rfs", "cvs"]);

  if (error) throw new Error(error.message);

  const bySection: Record<"oss" | "rfs" | "cvs", any> = {
    oss: null,
    rfs: null,
    cvs: null,
  };

  for (const block of (data || []) as ReportContentBlock[]) {
    bySection[block.section_key] = block.content;
  }

  const cvsContent = bySection.cvs || {};

  return {
    operating_style_summary: bySection.oss,
    role_fit_summary: bySection.rfs,
    career_vertical_summary: {
      ...cvsContent,
      current_vertical: careerVertical
        ? {
            code: careerVertical.code,
            label: careerVertical.label,
            avg_score: careerVertical.avg_score,
            summary:
              cvsContent?.levels?.[careerVertical.code] ||
              cvsContent?.levels?.[
                `CV${String(careerVertical.code).replace("V", "")}`
              ] ||
              null,
          }
        : null,
    },
  };
}

async function enrichExportPayload(sb: ReturnType<typeof supa>, payload: any) {
  if (!payload || typeof payload !== "object") return payload;

  const idealCandidateProfile =
    payload?.result?.ideal_candidate_profile ||
    payload?.result?.report?.ideal_candidate_profile ||
    buildIdealCandidateProfile(payload);

  const reportSections = await fetchReportSections(sb, payload);
  const cleanReport = cleanExistingReport(payload?.result?.report);

  return {
    ...payload,
    result: {
      ...(payload.result || {}),

      // Canonical location for this content.
      // Do not also include this under result.report.
      ideal_candidate_profile: idealCandidateProfile,

      report: {
        ...cleanReport,
        operating_style_summary: reportSections.operating_style_summary,
        role_fit_summary: reportSections.role_fit_summary,
        career_vertical_summary: reportSections.career_vertical_summary,
      },
    },
  };
}

export async function GET(
  req: Request,
  props: { params: Promise<{ runId: string }> }
) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { runId } = await props.params;
    const sb = supa();

    const { data: run, error } = await sb
      .from("reverse_profile_runs")
      .select("id, run_number, status, export_payload")
      .eq("id", runId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Run not found" },
        { status: 404 }
      );
    }

    if (!run.export_payload) {
      return NextResponse.json(
        {
          ok: false,
          error: "Run has not been scored yet",
          status: run.status,
          run_id: run.id,
          run_number: run.run_number,
        },
        { status: 400 }
      );
    }

    const enrichedPayload = await enrichExportPayload(sb, run.export_payload);

    return NextResponse.json(enrichedPayload);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}