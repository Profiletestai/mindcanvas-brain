//apps/web/app/mcas/reverse/[runId]/result/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

function pct(n: any) {
  const x = typeof n === "number" ? n : 0;
  return `${Math.round(x * 100)}%`;
}

export default async function Page(
  props: { params: Promise<{ runId: string }> }
) {
  const { runId } = await props.params;

  const sb = supa();

  const { data: run } = await sb
    .from("reverse_profile_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  const payload = run?.score_payload || null;
  const scoring = payload?.scoring || null;
  const wording = payload?.wording || null;

  const core = scoring?.core_distribution || {};
  const osRanking = Array.isArray(scoring?.operating_style_ranking)
    ? scoring.operating_style_ranking
    : [];
  const topOs =
    scoring?.primary_operating_style ||
    (osRanking.length > 0 ? osRanking[0] : null);

  const careerVertical = scoring?.career_vertical || null;
  const flags = Array.isArray(scoring?.flags) ? scoring.flags : [];
  const confidence = scoring?.confidence || null;

  const jsonPreview = run?.export_payload || payload || null;

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/60">MCAS Reverse Profile Sandbox</div>
            <h1 className="mt-1 text-3xl font-semibold">
              {run?.title || "Reverse Profile Result"}
            </h1>
            <div className="mt-2 text-sm text-white/60">
              Run Number: <span className="text-white">{run?.run_number || "—"}</span>
              {" • "}
              Partner: <span className="text-white">{run?.partner_key || "—"}</span>
              {" • "}
              Job ID: <span className="text-white">{run?.job_id || "—"}</span>
            </div>
            <div className="mt-1 text-sm text-white/60">
              Framework:{" "}
              <span className="text-white">
                {payload?.framework?.slug || run?.framework_slug || "mcas-core-alignment"}{" "}
                {payload?.framework?.version || run?.framework_version || "v1"}
              </span>
              {" • "}
              Source: <span className="text-white">{run?.source || "manual"}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/mcas/reverse/${runId}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              Retake Test
            </Link>
            <Link
              href="/admin/mcas/reverse-profiles"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              Back to Runs
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Status</div>
            <div className="mt-2 font-medium">{run?.status || "—"}</div>
            <div className="mt-3 text-xs text-white/50">
              Created: {run?.created_at ? new Date(run.created_at).toLocaleString() : "-"}
              <br />
              Submitted: {run?.submitted_at ? new Date(run.submitted_at).toLocaleString() : "-"}
              <br />
              Scored: {run?.scored_at ? new Date(run.scored_at).toLocaleString() : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Scoring Model</div>
            <div className="mt-2 font-medium">{scoring?.model_version || run?.scoring_model_version || "—"}</div>
            <div className="mt-3 text-xs text-white/50">
              Input mode: {run?.input_mode || "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Purpose</div>
            <div className="mt-2 text-sm text-white/80">
              This page shows the visual result and the exact structured data that partner platforms will receive.
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">CORE Distribution</div>
          <div className="mt-1 text-lg font-semibold">Primary behavioural mix</div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { code: "C", label: "Create" },
              { code: "O", label: "Organise" },
              { code: "R", label: "Resolve" },
              { code: "E", label: "Examine" },
            ].map((x) => (
              <div key={x.code} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">{x.code}</div>
                <div className="mt-1 font-medium">{x.label}</div>
                <div className="mt-3 text-2xl font-semibold">{pct(core[x.code])}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Top Operating Style</div>
            {topOs ? (
              <>
                <div className="mt-1 text-lg font-semibold">{topOs.label || topOs.code}</div>
                <div className="mt-1 text-xs text-white/40 font-mono">{topOs.code}</div>
                <div className="mt-3 text-xl font-semibold">{pct(topOs.pct)}</div>
              </>
            ) : (
              <div className="mt-3 text-white/60">No operating style result yet.</div>
            )}

            {osRanking.length > 0 ? (
              <div className="mt-5">
                <div className="text-xs text-white/60 mb-2">Ranking</div>
                <div className="space-y-2">
                  {osRanking.map((x: any) => (
                    <div
                      key={x.code}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">
                          #{x.rank} {x.label || x.code}
                        </div>
                        <div className="text-xs text-white/40 font-mono">{x.code}</div>
                      </div>
                      <div className="text-white/70">{pct(x.pct)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Career Vertical</div>
            {careerVertical ? (
              <>
                <div className="mt-1 text-lg font-semibold">
                  {careerVertical.label || careerVertical.code}
                </div>
                <div className="mt-1 text-xs text-white/40 font-mono">
                  {careerVertical.code}
                </div>
                <div className="mt-3 text-sm text-white/70">
                  Average score:{" "}
                  <span className="text-white">
                    {careerVertical.avg_score != null ? careerVertical.avg_score : "—"}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-3 text-white/60">No career vertical result yet.</div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Word Mapping Output</div>
          <div className="mt-1 text-lg font-semibold">
            Recruitment wording signals for job-description generation
          </div>

          {wording ? (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Primary CORE</div>
                <div className="mt-1 font-medium">
                  {wording.primary_core?.label || wording.primary_core?.code || "—"}
                </div>
                <div className="mt-1 text-xs text-white/40 font-mono">
                  {wording.primary_core?.code || ""}
                </div>
                <div className="mt-3 text-sm text-white/70">
                  {wording.primary_core?.pct != null
                    ? `Weight: ${pct(wording.primary_core.pct)}`
                    : "—"}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Secondary CORE</div>
                <div className="mt-1 font-medium">
                  {wording.secondary_core?.label || wording.secondary_core?.code || "—"}
                </div>
                <div className="mt-1 text-xs text-white/40 font-mono">
                  {wording.secondary_core?.code || ""}
                </div>
                <div className="mt-3 text-sm text-white/70">
                  {wording.secondary_core?.pct != null
                    ? `Weight: ${pct(wording.secondary_core.pct)}`
                    : "—"}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Operating Style Language</div>
                <div className="mt-1 font-medium">
                  {wording.operating_style?.label || wording.operating_style?.code || "—"}
                </div>
                <div className="mt-1 text-xs text-white/40 font-mono">
                  {wording.operating_style?.code || ""}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-white/75">
                  {(wording.operating_style?.words || []).map((w: string, idx: number) => (
                    <li key={idx}>• {w}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Career Vertical Language</div>
                <div className="mt-1 font-medium">
                  {wording.career_vertical?.label || wording.career_vertical?.code || "—"}
                </div>
                <div className="mt-1 text-xs text-white/40 font-mono">
                  {wording.career_vertical?.code || ""}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-white/75">
                  {(wording.career_vertical?.words || []).map((w: string, idx: number) => (
                    <li key={idx}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-white/60">No wording output yet.</div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Confidence</div>
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
            {flags.length > 0 ? (
              <div className="mt-4 space-y-2">
                {flags.map((f: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="font-medium">{f.code || "FLAG"}</div>
                    <div className="text-sm text-white/60">
                      Severity: {f.severity || "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-white/60">No flags returned.</div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">API Payload Preview</div>
          <div className="mt-1 text-lg font-semibold">
            This is the structured result a partner platform would receive
          </div>

          <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b1724] p-4 text-xs text-white/80">
{JSON.stringify(jsonPreview, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}