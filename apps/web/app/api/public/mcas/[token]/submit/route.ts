//apps/web/app/api/public/mcas/[token]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

/**
 * Framework definition format (MVP):
 * mcas.frameworks.definition = {
 *   questions: [{code,prompt,options:[{code,label}]}...],
 *   scoring: {
 *     // Optional mapping: question_code -> option_code -> { core: "C|O|R|E", os: "OS1", weight: number }
 *     map: { "Q1": { "A": { core:"C", os:"OS1", weight: 1 }, "B": {...} }, ... }
 *   }
 * }
 *
 * If scoring.map is missing, we use a safe fallback:
 * - CORE: distribute evenly (0.25 each)
 * - OS: top option frequency across options (not meaningful, but allows testing)
 */

type IncomingAnswer = { question_code: string; option_code: string };

function nowIso() {
  return new Date().toISOString();
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const sb = mcasSupa();

  try {
    const { token } = await ctx.params;
    const public_token = (token || "").trim();
    if (!public_token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const answers: IncomingAnswer[] = Array.isArray(body?.answers) ? body.answers : [];

    if (!answers.length) {
      return NextResponse.json({ error: "answers[] required" }, { status: 400 });
    }

    // 1) Resolve partner application
    const { data: app, error: appErr } = await sb
      .from("partner_applications")
      .select(
        "id, org_id, partner_key, application_id, status, framework_slug, framework_version, started_at, completed_at, candidate_email, candidate_first_name, candidate_last_name"
      )
      .eq("public_token", public_token)
      .maybeSingle();

    if (appErr) return NextResponse.json({ error: "db error" }, { status: 500 });
    if (!app) return NextResponse.json({ error: "invalid token" }, { status: 404 });

    // 2) Load framework
    const { data: fw, error: fwErr } = await sb
      .from("frameworks")
      .select("slug, version, definition")
      .eq("slug", app.framework_slug)
      .eq("version", app.framework_version)
      .maybeSingle();

    if (fwErr) return NextResponse.json({ error: "db error" }, { status: 500 });
    if (!fw) return NextResponse.json({ error: "framework not found" }, { status: 404 });

    const def = (fw.definition || {}) as any;
    const scoringMap = def?.scoring?.map || null;

    // 3) Upsert individual (minimal; future-proof identity)
    // For MVP we create an individual record per application if one doesn't exist for same email.
    let individualId: string | null = null;

    if (app.candidate_email) {
      const { data: existingInd } = await sb
        .from("individuals")
        .select("id")
        .eq("org_id", app.org_id)
        .eq("email", app.candidate_email)
        .maybeSingle();

      if (existingInd?.id) {
        individualId = existingInd.id;
      } else {
        const { data: createdInd, error: indErr } = await sb
          .from("individuals")
          .insert({
            org_id: app.org_id,
            email: app.candidate_email,
            first_name: app.candidate_first_name,
            last_name: app.candidate_last_name,
            external_ref: `${app.partner_key}:${app.application_id}`,
          })
          .select("id")
          .single();

        if (indErr) return NextResponse.json({ error: "failed to create individual" }, { status: 500 });
        individualId = createdInd.id;
      }
    } else {
      // If no email, still create a placeholder individual (optional)
      const { data: createdInd, error: indErr } = await sb
        .from("individuals")
        .insert({
          org_id: app.org_id,
          external_ref: `${app.partner_key}:${app.application_id}`,
        })
        .select("id")
        .single();

      if (indErr) return NextResponse.json({ error: "failed to create individual" }, { status: 500 });
      individualId = createdInd.id;
    }

    // 4) Create or reuse assessment (1 assessment per application for MVP)
    const { data: existingAssessment, error: asFindErr } = await sb
      .from("assessments")
      .select("id, status")
      .eq("partner_application_id", app.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (asFindErr) return NextResponse.json({ error: "db error" }, { status: 500 });

    let assessmentId = existingAssessment?.id as string | undefined;

    if (!assessmentId) {
      const { data: createdAssessment, error: asCreateErr } = await sb
        .from("assessments")
        .insert({
          partner_application_id: app.id,
          individual_id: individualId,
          framework_slug: app.framework_slug,
          framework_version: app.framework_version,
          status: "started",
        })
        .select("id")
        .single();

      if (asCreateErr) return NextResponse.json({ error: "failed to create assessment" }, { status: 500 });
      assessmentId = createdAssessment.id;

      // mark application started
      if (!app.started_at) {
        await sb
          .from("partner_applications")
          .update({ status: "started", started_at: nowIso() })
          .eq("id", app.id);
      }
    }

    // 5) Write answers (replace any existing answers for those question codes)
    // Simple strategy: delete existing answers for this assessment, then insert fresh.
    // (Keeps MVP clean; later we can do incremental updates.)
    await sb.from("assessment_answers").delete().eq("assessment_id", assessmentId);

    const insertRows = answers.map((a) => ({
      assessment_id: assessmentId!,
      question_code: String(a.question_code || "").trim(),
      option_code: String(a.option_code || "").trim(),
      response_time_ms: null,
    })).filter(r => r.question_code && r.option_code);

    if (!insertRows.length) {
      return NextResponse.json({ error: "no valid answers" }, { status: 400 });
    }

    const { error: ansErr } = await sb.from("assessment_answers").insert(insertRows);
    if (ansErr) return NextResponse.json({ error: "failed to save answers" }, { status: 500 });

    // 6) Compute scores
    const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
    const osTotals: Record<string, number> = {};

    let usedMappedScoring = false;

    if (scoringMap && typeof scoringMap === "object") {
      for (const a of insertRows) {
        const qMap = scoringMap[a.question_code];
        const m = qMap ? qMap[a.option_code] : null;

        if (m && m.core && m.os) {
          const w = typeof m.weight === "number" ? m.weight : 1;
          if (coreTotals[m.core] != null) coreTotals[m.core] += w;
          osTotals[m.os] = (osTotals[m.os] || 0) + w;
          usedMappedScoring = true;
        }
      }
    }

    // Fallback scoring (for testing flow if map not yet loaded)
    if (!usedMappedScoring) {
      // Even CORE distribution
      coreTotals.C = 1; coreTotals.O = 1; coreTotals.R = 1; coreTotals.E = 1;

      // OS distribution based on option_code frequency (not meaningful, but deterministic)
      for (const a of insertRows) {
        const key = `OS_${a.option_code}`;
        osTotals[key] = (osTotals[key] || 0) + 1;
      }
    }

    function normalize(obj: Record<string, number>) {
      const sum = Object.values(obj).reduce((acc, v) => acc + v, 0) || 1;
      const out: Record<string, number> = {};
      for (const k of Object.keys(obj)) out[k] = Number((obj[k] / sum).toFixed(4));
      return out;
    }

    const coreDist = normalize(coreTotals);

    const osDistArr = Object.entries(osTotals)
      .map(([code, v]) => ({ code, pct: v }))
      .sort((a, b) => b.pct - a.pct);

    const osSum = osDistArr.reduce((acc, x) => acc + x.pct, 0) || 1;
    const osDist = osDistArr.map((x) => ({ code: x.code, pct: Number((x.pct / osSum).toFixed(4)) }));

    // Confidence (MVP signals)
    const confidence = {
      rating: usedMappedScoring ? "moderate" : "low",
      signals: {
        mapped_scoring_used: usedMappedScoring,
        answered_count: insertRows.length,
      },
    };

    const flags = usedMappedScoring
      ? []
      : [{ code: "SCORING_MAP_MISSING", severity: "high", message: "Framework scoring map not loaded; using fallback." }];

    const scoring_model = usedMappedScoring
      ? `mcas_${app.framework_version}_mapped`
      : `mcas_${app.framework_version}_fallback`;

    // 7) Upsert result (assessment_id is unique)
    // Delete any old result then insert fresh (simple MVP)
    await sb.from("results").delete().eq("assessment_id", assessmentId);

    const { error: resErr } = await sb.from("results").insert({
      assessment_id: assessmentId,
      scoring_model,
      core_distribution: coreDist,
      os_distribution: osDist,
      vertical_readiness: null,
      confidence,
      flags,
    });

    if (resErr) return NextResponse.json({ error: "failed to save result" }, { status: 500 });

    // 8) Mark assessment + application completed
    const completedAt = nowIso();

    await sb
      .from("assessments")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", assessmentId);

    await sb
      .from("partner_applications")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", app.id);

    return NextResponse.json({
      ok: true,
      status: "completed",
      partner_key: app.partner_key,
      application_id: app.application_id,
      framework: { slug: app.framework_slug, version: app.framework_version },
      scoring_model,
      scores: { core: coreDist, operating_styles: osDist },
      confidence,
      flags,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}