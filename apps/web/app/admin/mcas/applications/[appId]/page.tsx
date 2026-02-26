//apps/web/app/admin/mcas/applications/[appId]/page.tsx
import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

export default async function Page(
  props: { params: Promise<{ appId: string }> }
) {
  const { appId } = await props.params;
  const id = decodeURIComponent(appId).trim();
  if (!id) notFound();

  const sb = mcasSupa();

  const { data: app, error: appErr } = await sb
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (appErr || !app) notFound();

  const { data: assessment } = await sb
    .from("assessments")
    .select("id, status, started_at, completed_at, framework_slug, framework_version, meta")
    .eq("partner_application_id", app.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assessmentId = assessment?.id;

  const { data: answers } = assessmentId
    ? await sb
        .from("assessment_answers")
        .select("question_code, option_code, response_time_ms, created_at")
        .eq("assessment_id", assessmentId)
        .order("question_code", { ascending: true })
    : { data: [] as any[] };

  const { data: result } = assessmentId
    ? await sb
        .from("results")
        .select("*")
        .eq("assessment_id", assessmentId)
        .maybeSingle()
    : { data: null as any };

  const link = `${baseUrl()}/mcas/t/${app.public_token}`;

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Admin • MCAS</div>
            <h1 className="text-2xl font-semibold mt-1">{app.application_id}</h1>
            <div className="text-white/60 mt-1 text-sm">
              {app.partner_key} • {app.framework_slug} • {app.framework_version}
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Open candidate link
            </a>
            <Link
              href="/admin/mcas/applications"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Back
            </Link>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Status</div>
            <div className="mt-2 font-medium">{app.status}</div>
            <div className="mt-2 text-xs text-white/50">
              Created: {app.created_at ? new Date(app.created_at).toLocaleString() : "-"}
              <br />
              Started: {app.started_at ? new Date(app.started_at).toLocaleString() : "-"}
              <br />
              Completed: {app.completed_at ? new Date(app.completed_at).toLocaleString() : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Candidate</div>
            <div className="mt-2 text-sm text-white/80">
              {app.candidate_first_name || ""} {app.candidate_last_name || ""}
            </div>
            <div className="mt-1 text-sm text-white/60">{app.candidate_email || "-"}</div>
            <div className="mt-3 text-xs text-white/50 break-all">
              Org ID: {app.org_id}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">Assessment</div>
            <div className="mt-2 font-medium">{assessment ? assessment.status : "—"}</div>
            <div className="mt-2 text-xs text-white/50">
              Assessment ID: {assessmentId || "—"}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/60">Computed Result</div>
              <div className="mt-1 font-medium">Structured scores (JSON)</div>
            </div>
          </div>

          {result ? (
            <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b1724] p-4 text-xs text-white/80">
{JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <div className="mt-4 text-white/60">No result yet.</div>
          )}
        </div>

        {/* Answers */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Answers</div>
          <div className="mt-1 font-medium">Captured responses</div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="text-left px-4 py-3">Question</th>
                  <th className="text-left px-4 py-3">Option</th>
                  <th className="text-left px-4 py-3">Captured</th>
                </tr>
              </thead>
              <tbody>
                {(answers || []).map((a: any) => (
                  <tr key={`${a.question_code}-${a.option_code}-${a.created_at}`} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono">{a.question_code}</td>
                    <td className="px-4 py-3 font-mono">{a.option_code}</td>
                    <td className="px-4 py-3 text-white/60">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}

                {(!answers || answers.length === 0) ? (
                  <tr>
                    <td className="px-4 py-10 text-white/60" colSpan={3}>
                      No answers captured yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Candidate link */}
        <div className="mt-6 text-xs text-white/50 break-all">
          Candidate link: {link}
        </div>
      </div>
    </div>
  );
}