import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import CopyTextButton from "./CopyTextButton";
import CopyJsonButton from "./CopyJsonButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function pct(n: any) {
  const x = typeof n === "number" ? n : 0;
  return `${Math.round(x * 100)}%`;
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
};

export default async function Page(props: { params: Promise<{ appId: string }> }) {
  const { appId } = await props.params;
  const id = decodeURIComponent(appId || "").trim();
  if (!id) notFound();

  const sb = mcasSupa();

  // Application
  const { data: app, error: appErr } = await sb
    .from("partner_applications")
    .select(
      "id, partner_key, application_id, org_id, framework_slug, framework_version, status, public_token, created_at, started_at, completed_at, candidate_first_name, candidate_last_name, candidate_email, candidate_phone, consent"
    )
    .eq("id", id)
    .maybeSingle();

  if (appErr || !app) notFound();

  // Load framework definition for enrichment (prompts + option labels)
  const { data: fw } = await sb
    .from("frameworks")
    .select("definition")
    .eq("slug", app.framework_slug)
    .eq("version", app.framework_version)
    .maybeSingle();

  const def = (fw?.definition || {}) as FrameworkDefinition;

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

  // Latest assessment for this application
  const { data: assessment } = await sb
    .from("assessments")
    .select("id, status, started_at, completed_at, framework_slug, framework_version, meta, individual_id")
    .eq("partner_application_id", app.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assessmentId = assessment?.id ?? null;

  // Answers (Q1..Q25)
  const { data: answers } = assessmentId
    ? await sb
        .from("assessment_answers")
        .select("question_code, option_code, created_at")
        .eq("assessment_id", assessmentId)
        .order("question_code", { ascending: true })
    : { data: [] as any[] };

  // Result row
  const { data: result } = assessmentId
    ? await sb.from("results").select("*").eq("assessment_id", assessmentId).maybeSingle()
    : { data: null as any };

  const candidateLink = `${baseUrl()}/mcas/t/${app.public_token}`;

  const core = (result?.core_distribution || {}) as Record<string, number>;
  const osDist = Array.isArray(result?.os_distribution) ? result.os_distribution : [];
  const flags = Array.isArray(result?.flags) ? result.flags : [];
  const confidence = result?.confidence ?? null;

  // ---------------------------
  // Enriched Answers (for UI + partner export)
  // ---------------------------
  const answersEnriched = (answers || [])
    .slice()
    .sort((a: any, b: any) => qNum(a.question_code) - qNum(b.question_code))
    .map((a: any) => {
      const qc = String(a.question_code || "").trim();
      const oc = String(a.option_code || "").trim();
      const prompt = questionPromptByCode.get(qc) || "";
      const option_label = optionLabelByQAndOpt.get(`${qc}|${oc}`) || "";
      return {
        question_code: qc,
        prompt: prompt || null,
        option_code: oc,
        option_label: option_label || null,
        created_at: a.created_at || null,
      };
    });

  // ---------------------------
  // Partner Export Payload (v1)
  // ---------------------------
  const exportPayload = {
    version: "mcas_partner_payload_v1",
    generated_at: new Date().toISOString(),
    partner: {
      partner_key: app.partner_key,
      application_id: app.application_id,
    },
    mindcanvas: {
      org_id: app.org_id,
      engine: "mcas",
      framework: {
        slug: app.framework_slug,
        version: app.framework_version,
      },
      candidate_link: candidateLink,
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
          operating_style_distribution: result.os_distribution || null,
          vertical_readiness: result.vertical_readiness || null,
          confidence: result.confidence || null,
          flags: result.flags || [],
        }
      : null,

    // ✅ enriched answers for partner readability
    answers: answersEnriched.map((a) => ({
      question_code: a.question_code,
      prompt: a.prompt,
      option_code: a.option_code,
      option_label: a.option_label,
    })),

    debug: {
      application_id_internal: app.id,
      assessment_id: assessmentId,
      individual_id: assessment?.individual_id || null,

      // useful to see if framework enrichment worked
      framework_questions_loaded: rawQs.length,
    },
  };

  const exportJson = JSON.stringify(exportPayload, null, 2);

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Admin • MCAS</div>
            <h1 className="mt-1 text-2xl font-semibold">{app.application_id}</h1>
            <div className="mt-1 text-sm text-white/60">
              Partner: <span className="text-white">{app.partner_key}</span> • Framework:{" "}
              <span className="text-white">
                {app.framework_slug} {app.framework_version}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <a
              href={candidateLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              Open Candidate Link
            </a>

            <CopyTextButton text={candidateLink} label="Copy Candidate Link" />

            <Link
              href="/admin/mcas/applications"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              Back
            </Link>
          </div>
        </div>

        {/* Top summary cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Application Status</div>
            <div className="mt-2 font-medium">{app.status}</div>
            <div className="mt-3 text-xs text-white/50">
              Created: {app.created_at ? new Date(app.created_at).toLocaleString() : "-"}
              <br />
              Started: {app.started_at ? new Date(app.started_at).toLocaleString() : "-"}
              <br />
              Completed: {app.completed_at ? new Date(app.completed_at).toLocaleString() : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Test Taker</div>
            <div className="mt-2 font-medium">
              {(app.candidate_first_name || "-") + " " + (app.candidate_last_name || "")}
            </div>
            <div className="mt-1 text-sm text-white/70">{app.candidate_email || "-"}</div>
            <div className="mt-1 text-sm text-white/70">{app.candidate_phone || "-"}</div>
            <div className="mt-3 text-xs text-white/50">
              Consent: <span className="text-white">{app.consent ? "true" : "false"}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Assessment</div>
            <div className="mt-2 font-medium">{assessment?.status || "—"}</div>
            <div className="mt-3 text-xs text-white/50 break-all">
              Assessment ID: {assessmentId || "—"}
              <br />
              Individual ID: {assessment?.individual_id || "—"}
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">CORE Distribution</div>
            <div className="mt-1 text-lg font-semibold">C • O • R • E</div>

            {result ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["C", "O", "R", "E"] as const).map((k) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/60">{k}</div>
                    <div className="mt-1 text-xl font-semibold">{pct(core[k])}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-white/60">No result yet.</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Operating Style Ranking</div>
            <div className="mt-1 text-lg font-semibold">Most dominant → least</div>

            {result ? (
              <div className="mt-4 grid gap-2">
                {osDist.length ? (
                  osDist.map((x: any) => (
                    <div
                      key={x.code}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="font-medium">{x.code}</div>
                      <div className="text-white/70">{pct(x.pct)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-white/60">No OS distribution returned.</div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-white/60">No result yet.</div>
            )}
          </div>
        </div>

        {/* Vertical + flags */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Career Vertical</div>
            <div className="mt-1 text-lg font-semibold">
              {result?.vertical_readiness ? String(result.vertical_readiness) : "—"}
            </div>

            <div className="mt-4 text-sm text-white/70">
              Scoring model:{" "}
              <span className="font-mono text-white/80">{result?.scoring_model || "—"}</span>
            </div>

            {confidence ? (
              <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b1724] p-4 text-xs text-white/80">
{JSON.stringify(confidence, null, 2)}
              </pre>
            ) : (
              <div className="mt-4 text-white/60">No confidence payload yet.</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Flags</div>
            <div className="mt-1 text-lg font-semibold">Signals to pay attention to</div>

            {flags.length ? (
              <div className="mt-4 grid gap-2">
                {flags.map((f: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-medium">{f.code || "FLAG"}</div>
                    <div className="text-sm text-white/60">Severity: {f.severity || "—"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-white/60">No flags recorded.</div>
            )}
          </div>
        </div>

        {/* Answers (Enriched) */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Answers</div>
          <div className="mt-1 text-lg font-semibold">Q1 → Q25 (with prompts + labels)</div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="text-left px-4 py-3">Q</th>
                  <th className="text-left px-4 py-3">Prompt</th>
                  <th className="text-left px-4 py-3">Option</th>
                  <th className="text-left px-4 py-3">Answer</th>
                </tr>
              </thead>
              <tbody>
                {answersEnriched.map((a) => (
                  <tr
                    key={`${a.question_code}-${a.option_code}-${a.created_at}`}
                    className="border-t border-white/10 align-top"
                  >
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{a.question_code}</td>
                    <td className="px-4 py-3 text-white/80">{a.prompt || <span className="text-white/40">—</span>}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{a.option_code}</td>
                    <td className="px-4 py-3 text-white/80">
                      {a.option_label || <span className="text-white/40">—</span>}
                    </td>
                  </tr>
                ))}

                {answersEnriched.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-white/60" colSpan={4}>
                      No answers captured yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Partner Export */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-white/60">Partner Export</div>
              <div className="mt-1 text-lg font-semibold">Payload (v1)</div>
              <div className="mt-1 text-sm text-white/60">
                Copy this JSON and send to your integration partner. Later, the API will return this exact shape.
              </div>
            </div>

            <CopyJsonButton json={exportJson} />
          </div>

          <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b1724] p-4 text-xs text-white/80">
{exportJson}
          </pre>
        </div>

        {/* Raw result (debug) */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Raw Result JSON (debug)</div>
          {result ? (
            <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b1724] p-4 text-xs text-white/80">
{JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <div className="mt-4 text-white/60">No result yet.</div>
          )}
        </div>

        <div className="mt-6 text-xs text-white/50 break-all">Candidate link: {candidateLink}</div>
      </div>
    </div>
  );
}