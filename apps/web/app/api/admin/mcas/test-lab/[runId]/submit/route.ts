// apps/web/app/api/admin/mcas/test-lab/[runId]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scoreMcasV2,
  type McasAnswers,
  type McasQuestion,
} from "@/lib/mcas/scoreMcasV2";

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

export async function POST(
  req: Request,
  props: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await props.params;

    const body = await req.json().catch(() => ({}));
    const answers = (body?.answers || {}) as McasAnswers;

    const sb = supa();

    const { data: framework, error: frameworkError } = await sb
      .from("frameworks")
      .select("definition")
      .eq("slug", "mcas-core-alignment")
      .eq("version", "v1")
      .maybeSingle();

    if (frameworkError) {
      return NextResponse.json(
        { ok: false, error: frameworkError.message },
        { status: 500 }
      );
    }

    if (!framework) {
      return NextResponse.json(
        { ok: false, error: "Framework not found" },
        { status: 404 }
      );
    }

    const definition = (framework.definition || {}) as any;

    const questions: McasQuestion[] = Array.isArray(definition.questions)
      ? definition.questions
      : [];

    if (questions.length !== 25) {
      return NextResponse.json(
        {
          ok: false,
          error: `Framework must contain 25 questions. Found ${questions.length}.`,
        },
        { status: 500 }
      );
    }

    const labels = definition.labels || {};

    const osLabels: Record<string, string> = labels.operating_styles || {};
    const coreLabels: Record<string, string> = labels.core || {
      C: "Create",
      O: "Organise",
      R: "Resolve",
      E: "Examine",
    };
    const cvLabels: Record<string, string> = labels.career_verticals || {};

    const scoring = scoreMcasV2({
      answers,
      questions,
      osLabels,
      coreLabels,
      cvLabels,
    });

    const result = {
      scoring,
      audit: scoring.audit,
    };

    return NextResponse.json({
      ok: true,
      type: "mcas_test_lab_result",
      meta: {
        run_id: runId,
        scoring_model_version: scoring.model_version,
        completed_at: new Date().toISOString(),
      },
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
