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

type IncomingAnswer = { question_code: string; option_code: string };

type CandidatePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

type FrameworkOption = {
  code: string;
  label: string;
  points?: number;
  os?: string;
  core?: "C" | "O" | "R" | "E";
  vertical_band?: "1-2" | "3" | "4" | "5-6";
  flag?: string;
};

type FrameworkQuestion = {
  code: string;
  section: "operating_style" | "career_vertical";
  prompt: string;
  options: FrameworkOption[];
};

function verticalBandMidpoint(band: string): number | null {
  switch (band) {
    case "1-2":
      return 1.5;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5-6":
      return 5.5;
    default:
      return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(obj: Record<string, number>) {
  const sum = Object.values(obj).reduce((acc, v) => acc + v, 0) || 1;
  const out: Record<string, number> = {};
  for (const k of Object.keys(obj)) out[k] = Number((obj[k] / sum).toFixed(4));
  return out;
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const sb = mcasSupa();

  try {
    const { token } = await ctx.params;
    const public_token = (token || "").trim();
    if (!public_token) return NextResponse.json({ error: "token required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const answers: IncomingAnswer[] = Array.isArray(body?.answers) ? body.answers : [];
    const candidate: CandidatePayload = (body?.candidate && typeof body.candidate === "object")
      ? body.candidate
      : {};

    if (!answers.length) return NextResponse.json({ error: "answers[] required" }, { status: 400 });

    // Validate intro payload (required)
    const first_name = String(candidate.first_name || "").trim();
    const last_name = String(candidate.last_name || "").trim();
    const email = String(candidate.email || "").trim();
    const phone = String(candidate.phone || "").trim();
    const consent = Boolean(candidate.consent);

    if (!first_name || !last_name || !email || !phone || !consent) {
      return NextResponse.json(
        { error: "candidate fields required: first_name, last_name, email, phone, consent=true" },
        { status: 400 }
      );
    }

    // 1) Resolve application
    const { data: app, error: appErr } = await sb
      .from("partner_applications")
      .select(
        "id, org_id, partner_key, application_id, status, framework_slug, framework_version, started_at"
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
    const questions: FrameworkQuestion[] = Array.isArray(def.questions) ? def.questions : [];

    if (questions.length !== 25) {
      return NextResponse.json(
        { error: `framework must have 25 questions; found ${questions.length}` },
        { status: 500 }
      );
    }

    const qLookup = new Map<string, FrameworkQuestion>();
    for (const q of questions) qLookup.set(q.code, q);

    const aMap = new Map<string, string>();
    for (const a of answers) {
      const qc = String(a.question_code || "").trim();
      const oc = String(a.option_code || "").trim();
      if (qc && oc) aMap.set(qc, oc);
    }

    for (let i = 1; i <= 25; i++) {
      const qc = `Q${i}`;
      if (!aMap.has(qc)) return NextResponse.json({ error: `missing answer for ${qc}` }, { status: 400 });
    }

    // 3) Update application with candidate details
    const { error: upErr } = await sb
      .from("partner_applications")
      .update({
        candidate_first_name: first_name,
        candidate_last_name: last_name,
        candidate_email: email,
        candidate_phone: phone,
        consent: true,
      })
      .eq("id", app.id);

    if (upErr) return NextResponse.json({ error: "failed to save candidate info" }, { status: 500 });

    // 4) Upsert individual (longitudinal identity per org)
    let individualId: string | null = null;

    const { data: existingInd } = await sb
      .from("individuals")
      .select("id")
      .eq("org_id", app.org_id)
      .eq("email", email)
      .maybeSingle();

    if (existingInd?.id) {
      individualId = existingInd.id;
      // keep details current
      await sb
        .from("individuals")
        .update({ first_name, last_name })
        .eq("id", individualId);
    } else {
      const { data: createdInd, error: indErr } = await sb
        .from("individuals")
        .insert({
          org_id: app.org_id,
          email,
          first_name,
          last_name,
          external_ref: `${app.partner_key}:${app.application_id}`,
        })
        .select("id")
        .single();

      if (indErr) return NextResponse.json({ error: "failed to create individual" }, { status: 500 });
      individualId = createdInd.id;
    }

    // 5) Create or reuse assessment
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

      if (!app.started_at) {
        await sb
          .from("partner_applications")
          .update({ status: "started", started_at: nowIso() })
          .eq("id", app.id);
      }
    }

    // 6) Store answers
    await sb.from("assessment_answers").delete().eq("assessment_id", assessmentId);

    const answerRows = Array.from(aMap.entries()).map(([question_code, option_code]) => ({
      assessment_id: assessmentId!,
      question_code,
      option_code,
      response_time_ms: null,
    }));

    const { error: ansErr } = await sb.from("assessment_answers").insert(answerRows);
    if (ansErr) return NextResponse.json({ error: "failed to save answers" }, { status: 500 });

    // 7) Scoring
    const coreTotals: Record<string, number> = { C: 0, O: 0, R: 0, E: 0 };
    const osTotals: Record<string, number> = {};
    const verticalValues: number[] = [];
    const flags: any[] = [];

    let verticalConfidence: "low" | "matched" | null = null;
    let verticalReadiness = false;
    let overreachRisk = false;

    for (let i = 1; i <= 25; i++) {
      const qc = `Q${i}`;
      const oc = aMap.get(qc)!;
      const q = qLookup.get(qc);
      if (!q) return NextResponse.json({ error: `framework missing ${qc}` }, { status: 500 });

      const opt = q.options?.find((x) => x.code === oc);
      if (!opt) return NextResponse.json({ error: `invalid option ${qc}:${oc}` }, { status: 400 });

      if (q.section === "operating_style") {
        const pts = typeof opt.points === "number" ? opt.points : null;
        if (!pts || !opt.os || !opt.core) {
          return NextResponse.json({ error: `missing scoring meta on ${qc}:${oc}` }, { status: 500 });
        }
        coreTotals[opt.core] += pts;
        osTotals[opt.os] = (osTotals[opt.os] || 0) + pts;
      }

      if (q.section === "career_vertical") {
        if (qc === "Q25") {
          if (opt.flag === "overreach_risk") overreachRisk = true;
          if (opt.flag === "vertical_confidence_low") verticalConfidence = "low";
          if (opt.flag === "vertical_confidence_matched") verticalConfidence = "matched";
          if (opt.flag === "vertical_readiness_signal") verticalReadiness = true;
        } else {
          const mid = opt.vertical_band ? verticalBandMidpoint(opt.vertical_band) : null;
          if (mid == null) {
            return NextResponse.json({ error: `missing vertical_band on ${qc}:${oc}` }, { status: 500 });
          }
          verticalValues.push(mid);
        }
      }
    }

    if (overreachRisk) flags.push({ code: "OVERREACH_RISK", severity: "high" });
    if (verticalConfidence === "low") flags.push({ code: "VERTICAL_CONFIDENCE_LOW", severity: "medium" });
    if (verticalConfidence === "matched") flags.push({ code: "VERTICAL_CONFIDENCE_MATCHED", severity: "low" });
    if (verticalReadiness) flags.push({ code: "VERTICAL_READINESS_SIGNAL", severity: "low" });

    const coreDist = normalize(coreTotals);

    const osDistArr = Object.entries(osTotals)
      .map(([code, v]) => ({ code, pct: v }))
      .sort((a, b) => b.pct - a.pct);

    const osSum = osDistArr.reduce((acc, x) => acc + x.pct, 0) || 1;
    const osDist = osDistArr.map((x) => ({ code: x.code, pct: Number((x.pct / osSum).toFixed(4)) }));

    const vAvg = verticalValues.reduce((acc, v) => acc + v, 0) / (verticalValues.length || 1);
    const verticalLevel = clamp(Math.round(vAvg), 1, 6);

    const scoring_model = `mcas_${app.framework_version}_real_v1`;
    const confidence = {
      rating: "moderate",
      signals: {
        answered_count: 25,
        vertical_avg: Number(vAvg.toFixed(2)),
        vertical_level: verticalLevel,
        vertical_confidence: verticalConfidence,
        vertical_readiness: verticalReadiness,
        overreach_risk: overreachRisk,
      },
    };

    // 8) Persist result
    await sb.from("results").delete().eq("assessment_id", assessmentId);

    const { error: resErr } = await sb.from("results").insert({
      assessment_id: assessmentId,
      scoring_model,
      core_distribution: coreDist,
      os_distribution: osDist,
      vertical_readiness: `V${verticalLevel}`,
      confidence,
      flags,
    });

    if (resErr) return NextResponse.json({ error: "failed to save result" }, { status: 500 });

    // 9) Mark completed
    const completedAt = nowIso();

    await sb.from("assessments").update({ status: "completed", completed_at: completedAt }).eq("id", assessmentId);
    await sb.from("partner_applications").update({ status: "completed", completed_at: completedAt }).eq("id", app.id);

    return NextResponse.json({
      ok: true,
      status: "completed",
      application_id: app.application_id,
      scoring_model,
      scores: { core: coreDist, operating_styles: osDist, vertical_level: verticalLevel },
      confidence,
      flags,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}