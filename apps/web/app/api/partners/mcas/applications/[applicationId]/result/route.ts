//apps/web/app/api/partners/mcas/applications/[applicationId]/result/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePartnerAuth } from "../../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requirePartnerAuth(req);
    const { applicationId } = await ctx.params;

    const application_id = decodeURIComponent(applicationId).trim();
    if (!application_id) {
      return NextResponse.json({ error: "application_id required" }, { status: 400 });
    }

    const sb = supa();

    // Load application
    const { data: app, error: appErr } = await sb
      .from("partner_applications")
      .select("id, status, partner_key, application_id, framework_slug, framework_version, created_at, started_at, completed_at")
      .eq("partner_key", auth.partner_key)
      .eq("application_id", application_id)
      .maybeSingle();

    if (appErr) return NextResponse.json({ error: "db error" }, { status: 500 });
    if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

    // If not completed, return status only
    if (app.status !== "completed") {
      return NextResponse.json({
        partner_key: app.partner_key,
        application_id: app.application_id,
        status: app.status,
        created_at: app.created_at,
        started_at: app.started_at,
        completed_at: app.completed_at,
        framework: { slug: app.framework_slug, version: app.framework_version },
      });
    }

    // Find the assessment + result
    const { data: assessment, error: asErr } = await sb
      .from("assessments")
      .select("id, completed_at, framework_slug, framework_version")
      .eq("partner_application_id", app.id)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (asErr || !assessment) {
      return NextResponse.json({ error: "completed but assessment missing" }, { status: 500 });
    }

    const { data: result, error: rErr } = await sb
      .from("results")
      .select("scoring_model, core_distribution, os_distribution, vertical_readiness, confidence, flags, computed_at")
      .eq("assessment_id", assessment.id)
      .maybeSingle();

    if (rErr || !result) {
      return NextResponse.json({ error: "completed but result missing" }, { status: 500 });
    }

    return NextResponse.json({
      partner_key: app.partner_key,
      application_id: app.application_id,
      status: app.status,
      test: {
        slug: assessment.framework_slug,
        version: assessment.framework_version,
        completed_at: assessment.completed_at,
        computed_at: result.computed_at,
        scoring_model: result.scoring_model,
      },
      scores: {
        core: result.core_distribution,
        operating_styles: result.os_distribution,
        vertical_readiness: result.vertical_readiness,
      },
      confidence: result.confidence,
      flags: result.flags || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    const status = msg.startsWith("AUTH_") ? 401 : 500;
    return NextResponse.json({ error: msg || "unknown error" }, { status });
  }
}