import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

function baseUrl(req: Request) {
  // Prefer explicit app URL, otherwise derive from request (works on Vercel)
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function qNum(code: string) {
  const n = Number(String(code || "").replace("Q", ""));
  return Number.isFinite(n) ? n : 999;
}

type FrameworkDefinition = {
  questions?: Array<{
    code?: string;
    prompt?: string;
    options?: Array<{ code?: string; label?: string }>;
  }>;
  labels?: {
    operating_styles?: Record<string, string>;
    core?: Record<string, string>;
    career_verticals?: Record<string, string>;
    verticals?: Record<string, string>; // support either key
    flags?: Record<string, string>;
  };
};

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound(message = "Not found") {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

export async function GET(
  req: Request,
  props: { params: Promise<{ partnerKey: string; applicationId: string }> }
) {
  const { partnerKey, applicationId } = await props.params;

  const partner_key = decodeURIComponent(partnerKey || "").trim();
  const application_id = decodeURIComponent(applicationId || "").trim();

  if (!partner_key || !application_id) {
    return badRequest("partner_key and application_id are required in the URL path.");
  }

  // Simple bearer token protection (v1)
  const expected = process.env.MCAS_PARTNER_EXPORT_TOKEN;
  if (expected) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    if (!token || token !== expected) return unauthorized();
  } else {
    // If you forget to set MCAS_PARTNER_EXPORT_TOKEN, we fail closed.
    return unauthorized("Missing server config: MCAS_PARTNER_EXPORT_TOKEN is not set.");
  }

  const sb = mcasSupa();

  // 1) Find the partner application
  const { data: app, error: appErr } = await sb
    .from("partner_applications")
    .select(
      "id, partner_key, application_id, org_id, framework_slug, framework_version, status, public_token, created_at, started_at, completed_at, candidate_first_name, candidate_last_name, candidate_email, candidate_phone, consent"
    )
    .eq("partner_key", partner_key)
    .eq("application_id", application_id)
    .maybeSingle();

  if (appErr) {
    return NextResponse.json({ ok: false, error: appErr.message }, { status: 500 });
  }
  if (!app) return notFound("Application not found for this partner_key + application_id.");

  // 2) Load framework definition (for labels + prompts + option labels)
  const { data: fw, error: fwErr } = await sb
    .from("frameworks")
    .select("definition")
    .eq("slug", app.framework_slug)
    .eq("version", app.framework_version)
    .maybeSingle();

  if (fwErr) {
    return NextResponse.json({ ok: false, error: fwErr.message }, { status: 500 });
  }

  const def = (fw?.definition || {}) as FrameworkDefinition;

  // Lookups for Q prompts + option labels
  const questionPromptByCode = new Map<string, string>();
  const optionLabelByQAndOpt = new Map<string, string>(); // `${Q}|${OPT}` -> label

  const rawQs = Array.isArray(def.questions) ? def.questions : [];
  for (const q of rawQs) {
    const qCode = String(q?.code || "").trim();
    const prompt = String(q?.prompt || "").trim();
    if (qCode) questionPromptByCode.set(qCode, prompt);

    const opts = Array.isArray(q?.options) ? q!.options! : [];
    for (const o of opts) {
      const oCode = String(o?.code || "").trim();
      const label = String(o?.label || "").trim();
      if (qCode && oCode) optionLabelByQAndOpt.set(`${qCode}|${oCode}`, label);
    }
  }

  // Labels (already seeded into definition.labels via your SQL)
  const osLabels = def.labels?.operating_styles || {};
  const coreLabels = def.labels?.core || {};
  const verticalLabels =
    def.labels?.career_verticals || def.labels?.verticals || {};
  const flagLabels = def.labels?.flags || {};

  // 3) Latest assessment
  const { data: assessment, error: aErr } = await sb
    .from("assessments")
    .select("id, status, started_at, completed_at, framework_slug, framework_version, meta, individual_id")
    .eq("partner_application_id", app.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr) {
    return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  }

  const assessmentId = assessment?.id ?? null;

  // 4) Answers
  const { data: answers, error: ansErr } = assessmentId
    ? await sb
        .from("assessment_answers")
        .select("question_code, option_code, created_at")
        .eq("assessment_id", assessmentId)
    : { data: [] as any[], error: null as any };

  if (ansErr) {
    return NextResponse.json({ ok: false, error: ansErr.message }, { status: 500 });
  }

  // 5) Result
  const { data: result, error: rErr } = assessmentId
    ? await sb.from("results").select("*").eq("assessment_id", assessmentId).maybeSingle()
    : { data: null as any, error: null as any };

  if (rErr) {
    return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  }

  const candidate_link = `${baseUrl(req)}/mcas/t/${app.public_token}`;

  // Enrich answers
  const answersEnriched = (answers || [])
    .slice()
    .sort((a: any, b: any) => qNum(a.question_code) - qNum(b.question_code))
    .map((a: any) => {
      const qc = String(a.question_code || "").trim();
      const oc = String(a.option_code || "").trim();
      const prompt = questionPromptByCode.get(qc) || null;
      const option_label = optionLabelByQAndOpt.get(`${qc}|${oc}`) || null;
      return { question_code: qc, prompt, option_code: oc, option_label };
    });

  // Enrich OS distribution + ranking
  const osDist = Array.isArray(result?.os_distribution) ? result.os_distribution : [];
  const osEnriched = osDist
    .slice()
    .map((x: any) => ({
      code: String(x.code || "").trim(),
      label: osLabels[String(x.code || "").trim()] || null,
      pct: typeof x.pct === "number" ? x.pct : null,
    }))
    .sort((a: any, b: any) => (b.pct ?? 0) - (a.pct ?? 0))
    .map((x: any, idx: number) => ({ ...x, rank: idx + 1 }));

  // Vertical label
  const verticalCode = result?.vertical_readiness ? String(result.vertical_readiness).trim() : null;
  const verticalLabel = verticalCode ? (verticalLabels[verticalCode] || null) : null;

  // Flags enrichment
  const flags = Array.isArray(result?.flags) ? result.flags : [];
  const flagsEnriched = flags.map((f: any) => {
    const code = String(f.code || "").trim();
    return { ...f, code, label: flagLabels[code] || null };
  });

  // Build payload (same shape as UI)
  const payload = {
    version: "mcas_partner_payload_v1",
    generated_at: new Date().toISOString(),
    partner: {
      partner_key: app.partner_key,
      application_id: app.application_id,
    },
    mindcanvas: {
      org_id: app.org_id,
      engine: "mcas",
      framework: { slug: app.framework_slug, version: app.framework_version },
      candidate_link,
      status: {
        application_status: app.status,
        assessment_status: assessment?.status || null,
        created_at: app.created_at || null,
        started_at: app.started_at || null,
        completed_at: app.completed_at || null,
      },
    },
    candidate: {
      first_name: app.candidate_first_name || null,
      last_name: app.candidate_last_name || null,
      email: app.candidate_email || null,
      phone: app.candidate_phone || null,
      consent: !!app.consent,
    },
    results: result
      ? {
          scoring_model: result.scoring_model || null,

          core_distribution: result.core_distribution || null,
          core_labels: coreLabels,

          operating_style_distribution: result.os_distribution || null,
          operating_style_enriched: osEnriched,

          vertical_readiness: verticalCode,
          vertical_label: verticalLabel,

          confidence: result.confidence || null,

          flags: result.flags || [],
          flags_enriched: flagsEnriched,
        }
      : null,
    answers: answersEnriched,
    debug: {
      application_id_internal: app.id,
      assessment_id: assessmentId,
      individual_id: assessment?.individual_id || null,
      framework_questions_loaded: rawQs.length,
    },
  };

  return NextResponse.json(payload, { status: 200 });
}