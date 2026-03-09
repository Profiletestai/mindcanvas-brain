//apps/web/app/api/public/visibility/[token]/submit/route.ts
// apps/web/app/api/public/visibility/[token]/submit/route.ts
import { NextResponse } from "next/server";
import { getVisibilityServiceClient } from "@/lib/visibility/supabase";
import { calculateVisibilityResults, type VisibilityEngineConfig } from "@/lib/visibility/scoring";

// NOTE:
// You’ll need to adapt these two parts to your platform:
// 1) How you resolve token -> (org_id, test_id, test_link_id, config_path)
// 2) How you fetch config JSON (Supabase storage bucket vs local file)

async function loadEngineConfigFromSomewhere(_orgId: string | null): Promise<VisibilityEngineConfig> {
  // TODO: Replace with your real config loading logic (Supabase storage is ideal)
  // For now, you can hardcode a path, or store in DB (visibility.report_templates or a portal table).
  throw new Error("Not implemented: load engine config JSON");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sb = getVisibilityServiceClient();

  try {
    const body = await req.json();
    const answers = body?.answers || {};
    const taker_name = body?.taker_name ?? null;
    const taker_email = body?.taker_email ?? null;

    // 1) Resolve token -> org/test/link identifiers (replace this block with your real logic)
    // Example placeholder (you likely have portal.test_links or similar)
    const org_id = body?.org_id ?? null;
    const test_id = body?.test_id ?? null;
    const test_link_id = body?.test_link_id ?? null;

    // 2) Load config
    const config = await loadEngineConfigFromSomewhere(org_id);

    // 3) Score
    const result = calculateVisibilityResults(answers, config);

    // 4) Insert submission
    const { data: sub, error: subErr } = await sb
      .from("submissions")
      .insert({
        org_id,
        test_id,
        test_link_id,
        token,
        taker_name,
        taker_email,
        answers,
        metadata: { user_agent: req.headers.get("user-agent") },
      })
      .select("*")
      .single();

    if (subErr) throw subErr;

    // 5) Insert result
    const { data: resRow, error: resErr } = await sb
      .from("results")
      .insert({
        submission_id: sub.id,
        engine_key: result.engine_key,
        version: result.version,
        personality_type: result.personality_type,
        personality_points: result.personality_points,
        personality_percent: result.personality_percent,
        tier: result.tier,
        level: result.level,
        tier_counts: result.tier_counts,
        readiness: result.readiness,
        pillar_scores: result.pillar_scores,
        computed: result.computed,
        debug: result.debug,
      })
      .select("*")
      .single();

    if (resErr) throw resErr;

    // 6) Return result IDs (and later: report URL)
    return NextResponse.json({
      ok: true,
      submission_id: sub.id,
      result_id: resRow.id,
      engine_key: result.engine_key,
      tier: result.tier,
      level: result.level,
      readiness: result.readiness,
      personality_type: result.personality_type,
    });
  } catch (e: any) {
    console.error("Visibility submit error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}