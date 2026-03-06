//apps/web/app/api/mcas/partner/reverse-profile/[partnerKey]/[jobId]/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

export async function GET(
  req: Request,
  props: { params: Promise<{ partnerKey: string; jobId: string }> }
) {
  try {
    const { partnerKey, jobId } = await props.params;

    const partner_key = decodeURIComponent(partnerKey || "").trim();
    const job_id = decodeURIComponent(jobId || "").trim();

    if (!partner_key || !job_id) {
      return badRequest("partner_key and job_id are required.");
    }

    // v1 simple bearer token protection
    const expected = process.env.MCAS_PARTNER_EXPORT_TOKEN;
    if (!expected) {
      return unauthorized("Missing server config: MCAS_PARTNER_EXPORT_TOKEN is not set.");
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";

    if (!token || token !== expected) {
      return unauthorized();
    }

    const sb = mcasSupa();

    const { data: run, error } = await sb
      .from("reverse_profile_runs")
      .select("*")
      .eq("partner_key", partner_key)
      .eq("job_id", job_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!run) {
      return notFound("Reverse profile run not found.");
    }

    if (run.status !== "scored" || !run.score_payload) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reverse profile exists but has not been scored yet.",
          status: run.status,
        },
        { status: 409 }
      );
    }

    const payload = {
      ok: true,
      type: "reverse_profile_export",
      partner: {
        partner_key: run.partner_key,
      },
      job: {
        job_id: run.job_id,
        campaign_id: run.campaign_id || null,
        title: run.title || null,
      },
      framework: run.score_payload?.framework || {
        slug: run.framework_slug,
        version: run.framework_version,
      },
      scoring_model_version:
        run.score_payload?.scoring?.model_version ||
        run.scoring_model_version ||
        null,
      result: run.score_payload,
      exported_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}