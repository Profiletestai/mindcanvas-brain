// apps/web/app/mcas/reverse/[runId]/result/page.tsx
import "server-only";

import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import CopyJsonButton from "@/app/admin/mcas/applications/[appId]/CopyJsonButton";
import {
  buildAtumaphireExternalPayload,
  buildAtumaphireRoleSections,
  buildAtumaphireScoringPayload,
  formatAtumaphireNarrative,
  normaliseAtumaphireOutputMode,
} from "@/lib/mcas/atumaphireOutput";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } },
  );
}

type JsonRecord = Record<string, any>;

type AuditAnswer = {
  question_code?: string | null;
  prompt?: string | null;
  option_code?: string | null;
  option_label?: string | null;
  mapped_os?: string | null;
  mapped_core?: string | null;
  mapped_cv?: string | null;
  flag?: string | null;
};

function pct(value: unknown, digits = 1): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${(number * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

function dateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function safeJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}


function answerNumber(code: unknown): number {
  const value = Number(String(code || "").replace(/\D/g, ""));
  return Number.isFinite(value) ? value : 999;
}

function arrayOf(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function recordOf(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function textList(value: unknown): string[] {
  return arrayOf(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function getNaturalStrengths(value: unknown) {
  return arrayOf(value).map((item) => ({
    title: String(item?.title || item?.label || "Strength").trim(),
    level: item?.level ? String(item.level) : null,
    description: item?.description ? String(item.description) : null,
  }));
}

function buildCurrentAtumaphirePayload(run: JsonRecord, scorePayload: JsonRecord) {
  const scoring = scorePayload?.scoring || null;
  const report = recordOf(scorePayload?.report);
  const idealCandidateProfile = scorePayload?.ideal_candidate_profile || null;

  if (!scoring) return null;

  const externalScoring = buildAtumaphireScoringPayload({
    scoring,
    modelVersion:
      run?.scoring_model_version ||
      run?.export_payload?.scoring_model_version ||
      scoring?.model_version ||
      null,
    careerVertical:
      scoring?.career_vertical || scoring?.primary_career_vertical || null,
  });

  const threeSectionNarrative = buildAtumaphireRoleSections({
    scoring: externalScoring,
    operatingStyleSummary: report?.operating_style_summary || null,
    roleFitSummary: report?.role_fit_summary || null,
    careerVerticalSummary: report?.career_vertical_summary || null,
    idealCandidateProfile,
  });

  const outputMode = normaliseAtumaphireOutputMode(null);
  const narrative = formatAtumaphireNarrative(
    threeSectionNarrative,
    outputMode,
  );

  const sourcePayload = run?.export_payload || {
    ok: true,
    type: "reverse_profile_export",
    meta: {
      run_id: run?.id || null,
      run_number: run?.run_number || null,
      run_type: run?.run_type || "reverse_profile_ai",
      source: run?.source || null,
      exported_at: run?.scored_at || run?.created_at || null,
    },
    partner: {
      partner_key: run?.partner_key || null,
    },
    job: {
      job_id: run?.job_id || null,
      campaign_id: run?.campaign_id || null,
      title: run?.title || null,
    },
    framework: {
      slug: run?.framework_slug || "mcas-core-alignment",
      version: run?.framework_version || "v1",
    },
    scoring_model_version:
      run?.scoring_model_version || scoring?.model_version || null,
    result: scorePayload,
  };

  return buildAtumaphireExternalPayload({
    sourcePayload,
    scoring: externalScoring,
    narrative,
    outputMode,
  });
}

function SectionHeading(props: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {props.eyebrow}
      </div>
      <h2 className="mt-1 text-xl font-semibold">{props.title}</h2>
      {props.description ? (
        <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
          {props.description}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs text-white/50">{props.label}</div>
      <div className="mt-2 text-xl font-semibold">{props.value}</div>
      {props.detail ? (
        <div className="mt-2 text-xs leading-5 text-white/50">
          {props.detail}
        </div>
      ) : null}
    </div>
  );
}

function RankingTable(props: {
  title: string;
  rows: any[];
  emptyText: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4 font-medium">
        {props.title}
      </div>
      {props.rows.length ? (
        <div className="divide-y divide-white/10">
          {props.rows.map((row, index) => (
            <div
              key={`${row?.code || index}-${index}`}
              className="grid grid-cols-[52px_minmax(0,1fr)_90px] items-center gap-3 px-5 py-3 text-sm"
            >
              <div className="text-white/45">#{row?.rank || index + 1}</div>
              <div>
                <div className="font-medium">
                  {row?.label || row?.code || "Unknown"}
                </div>
                <div className="mt-0.5 font-mono text-xs text-white/40">
                  {row?.code || "—"}
                </div>
              </div>
              <div className="text-right font-medium">{pct(row?.pct)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-sm text-white/50">{props.emptyText}</div>
      )}
    </div>
  );
}

function TextPanel(props: {
  title: string;
  value?: unknown;
  children?: ReactNode;
}) {
  const value = String(props.value || "").trim();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-white/45">
        {props.title}
      </div>
      {props.children ? (
        <div className="mt-3">{props.children}</div>
      ) : value ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/80">
          {value}
        </p>
      ) : (
        <div className="mt-3 text-sm text-white/40">No content recorded.</div>
      )}
    </div>
  );
}

export default async function Page(props: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await props.params;

  const sb = supa();
  const { data: run, error } = await sb
    .from("reverse_profile_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error || !run) notFound();

  const scorePayload = recordOf(run.score_payload);
  const scoring = recordOf(scorePayload.scoring);
  const wording = recordOf(
    scorePayload.wording || run.word_mapping_payload,
  );
  const report = recordOf(scorePayload.report);
  const operatingStyleSummary = recordOf(report.operating_style_summary);
  const roleFitSummary = recordOf(report.role_fit_summary);
  const careerVerticalSummary = recordOf(report.career_vertical_summary);
  const idealCandidateProfile = recordOf(scorePayload.ideal_candidate_profile);

  const operatingRanking = arrayOf(scoring.operating_style_ranking);
  const coreRanking = arrayOf(scoring.behavioural_approach_ranking);
  const verticalRanking = arrayOf(scoring.career_vertical_ranking);
  const coreDistribution = recordOf(
    scoring.core_distribution || scoring.behavioural_approach_distribution,
  );
  const confidence = scoring.confidence || null;
  const flags = arrayOf(scoring.flags);
  const readiness = recordOf(scoring.readiness_signal);

  const auditAnswers = arrayOf(scorePayload?.audit?.answers)
    .slice()
    .sort(
      (a: AuditAnswer, b: AuditAnswer) =>
        answerNumber(a.question_code) - answerNumber(b.question_code),
    ) as AuditAnswer[];

  const submittedAnswers = recordOf(run.submitted_answers);
  const currentAtumaphirePayload = buildCurrentAtumaphirePayload(
    run as JsonRecord,
    scorePayload,
  );
  const externalReport = recordOf(currentAtumaphirePayload?.result?.report);

  const naturalStrengths = getNaturalStrengths(
    operatingStyleSummary.natural_strengths,
  );
  const frictionPoints = textList(operatingStyleSummary.friction_points);
  const roleRisks = textList(roleFitSummary.role_risks);
  const idealRoleTypes = textList(roleFitSummary.ideal_role_types);

  const currentVertical = recordOf(careerVerticalSummary.current_vertical);
  const primaryOs =
    scoring.primary_operating_style || operatingRanking[0] || null;
  const secondaryOs =
    scoring.secondary_operating_style || operatingRanking[1] || null;
  const tertiaryOs =
    scoring.tertiary_operating_style || operatingRanking[2] || null;
  const primaryCv =
    scoring.primary_career_vertical || scoring.career_vertical || null;
  const secondaryCv = scoring.secondary_career_vertical || null;

  const externalJson = safeJson(currentAtumaphirePayload);

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-sm text-white/50">Admin • MCAS • Reverse Profiles</div>
            <h1 className="mt-1 text-3xl font-semibold">
              {run.title || "Reverse Profile Result"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
              <span>
                Run: <strong className="text-white">{run.run_number || "—"}</strong>
              </span>
              <span>
                Partner: <strong className="text-white">{run.partner_key || "—"}</strong>
              </span>
              <span>
                Job ID: <strong className="break-all text-white">{run.job_id || "—"}</strong>
              </span>
              <span>
                Campaign: <strong className="break-all text-white">{run.campaign_id || "—"}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/mcas/reverse-profiles"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Back to Runs
            </Link>
            <Link
              href={`/mcas/reverse/${runId}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Open Test
            </Link>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Status" value={run.status || "—"} />
          <MetricCard label="Source" value={run.source || "—"} />
          <MetricCard label="Input mode" value={run.input_mode || "—"} />
          <MetricCard
            label="Framework"
            value={`${run.framework_slug || "mcas-core-alignment"} ${run.framework_version || "v1"}`}
          />
          <MetricCard label="Created" value={dateTime(run.created_at)} />
          <MetricCard label="Submitted" value={dateTime(run.submitted_at)} />
          <MetricCard label="Scored" value={dateTime(run.scored_at)} />
          <MetricCard
            label="Model"
            value={
              run.scoring_model_version || scoring.model_version || "—"
            }
          />
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 md:p-7">
          <SectionHeading
            eyebrow="1. Information collected"
            title="Responses received by the MCAS engine"
            description="This table shows the full 25-question input, the selected option, and how each answer mapped into Operating Style, CORE, Career Vertical and readiness flags."
          />

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-white/55">
                <tr>
                  <th className="px-4 py-3">Question</th>
                  <th className="px-4 py-3">Prompt</th>
                  <th className="px-4 py-3">Selected answer</th>
                  <th className="px-4 py-3">Operating Style</th>
                  <th className="px-4 py-3">CORE</th>
                  <th className="px-4 py-3">Career Vertical</th>
                  <th className="px-4 py-3">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {auditAnswers.map((answer, index) => (
                  <tr key={answer.question_code || `answer-${index}`} className="align-top">
                    <td className="px-4 py-4 font-mono text-white/60">
                      {answer.question_code || "—"}
                    </td>
                    <td className="max-w-[330px] px-4 py-4 leading-6 text-white/75">
                      {answer.prompt || "—"}
                    </td>
                    <td className="max-w-[330px] px-4 py-4 leading-6">
                      <span className="mr-2 rounded-md bg-white/10 px-2 py-1 font-mono text-xs">
                        {answer.option_code ||
                          submittedAnswers[answer.question_code || ""] ||
                          "—"}
                      </span>
                      <span className="text-white/75">
                        {answer.option_label || "No option wording recorded"}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-white/65">
                      {answer.mapped_os || "—"}
                    </td>
                    <td className="px-4 py-4 font-mono text-white/65">
                      {answer.mapped_core || "—"}
                    </td>
                    <td className="px-4 py-4 font-mono text-white/65">
                      {answer.mapped_cv || "—"}
                    </td>
                    <td className="px-4 py-4 text-white/65">
                      {answer.flag || "—"}
                    </td>
                  </tr>
                ))}

                {!auditAnswers.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-white/45">
                      No enriched audit answers are stored for this run.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 md:p-7">
          <SectionHeading
            eyebrow="2. Scoring interpretation"
            title="How MCAS interpreted the collected responses"
            description="The scoring below is separated into Operating Style, CORE and Career Vertical so that you can identify whether an issue begins in the submitted answers or in the calculated result."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Primary Operating Style"
              value={primaryOs?.label || primaryOs?.code || "—"}
              detail={primaryOs ? `${primaryOs.code} • ${pct(primaryOs.pct)}` : null}
            />
            <MetricCard
              label="Secondary Operating Style"
              value={secondaryOs?.label || secondaryOs?.code || "—"}
              detail={secondaryOs ? `${secondaryOs.code} • ${pct(secondaryOs.pct)}` : null}
            />
            <MetricCard
              label="Tertiary Operating Style"
              value={tertiaryOs?.label || tertiaryOs?.code || "—"}
              detail={tertiaryOs ? `${tertiaryOs.code} • ${pct(tertiaryOs.pct)}` : null}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <RankingTable
              title="Operating Style ranking"
              rows={operatingRanking}
              emptyText="No Operating Style ranking recorded."
            />
            <RankingTable
              title="CORE ranking"
              rows={coreRanking}
              emptyText="No CORE ranking recorded."
            />
            <RankingTable
              title="Career Vertical ranking"
              rows={verticalRanking}
              emptyText="No Career Vertical ranking recorded."
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["C", "Create"],
              ["O", "Organise"],
              ["R", "Resolve"],
              ["E", "Examine"],
            ].map(([code, label]) => (
              <div key={code}>
                <MetricCard
                  label={`${code} • ${label}`}
                  value={pct(coreDistribution[code])}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Primary Career Vertical"
              value={primaryCv?.label || primaryCv?.code || "—"}
              detail={primaryCv?.pct != null ? pct(primaryCv.pct) : null}
            />
            <MetricCard
              label="Secondary Career Vertical"
              value={secondaryCv?.label || secondaryCv?.code || "—"}
              detail={secondaryCv?.pct != null ? pct(secondaryCv.pct) : null}
            />
            <MetricCard
              label="Readiness signal"
              value={readiness.label || readiness.code || "None"}
              detail={readiness.interpretation || null}
            />
            <MetricCard
              label="Confidence"
              value={confidence?.rating || "—"}
              detail={
                confidence?.signals
                  ? `${confidence.signals.answered_count || 0} answers processed`
                  : null
              }
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextPanel title="Confidence details">
              <pre className="overflow-auto whitespace-pre-wrap text-xs leading-6 text-white/75">
                {safeJson(confidence)}
              </pre>
            </TextPanel>
            <TextPanel title="Flags">
              {flags.length ? (
                <div className="space-y-2">
                  {flags.map((flag, index) => (
                    <div
                      key={`${flag?.code || index}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="font-medium">{flag?.code || "FLAG"}</div>
                      <div className="mt-1 text-xs text-white/50">
                        Severity: {flag?.severity || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/45">No flags recorded.</div>
              )}
            </TextPanel>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 md:p-7">
          <SectionHeading
            eyebrow="3. Internal MCAS interpretation"
            title="Content used to construct the role profile"
            description="This section exposes the internal knowledge-base content, role interpretation, word mappings and ideal-candidate narrative used before the external Atumaphire response is formatted."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TextPanel
              title="Operating Style summary"
              value={operatingStyleSummary.summary}
            />
            <TextPanel
              title="Decision-making style"
              value={operatingStyleSummary.decision_making_style}
            />
            <TextPanel
              title="Team contribution style"
              value={operatingStyleSummary.team_contribution_style}
            />
            <TextPanel title="Current Career Vertical">
              <div className="text-lg font-semibold">
                {currentVertical.label || currentVertical.code || "—"}
              </div>
              <div className="mt-1 text-sm text-white/50">
                {currentVertical.code || "—"} • {pct(currentVertical.pct)}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/75">
                {currentVertical.summary || "No Career Vertical summary recorded."}
              </p>
            </TextPanel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextPanel title="Natural strengths">
              {naturalStrengths.length ? (
                <div className="space-y-3">
                  {naturalStrengths.map((strength, index) => (
                    <div
                      key={`${strength.title}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{strength.title}</div>
                        {strength.level ? (
                          <div className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/55">
                            {strength.level}
                          </div>
                        ) : null}
                      </div>
                      {strength.description ? (
                        <p className="mt-2 text-sm leading-6 text-white/65">
                          {strength.description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/45">No strengths recorded.</div>
              )}
            </TextPanel>

            <TextPanel title="Friction points">
              {frictionPoints.length ? (
                <ul className="space-y-3 text-sm leading-6 text-white/75">
                  {frictionPoints.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-white/45">No friction points recorded.</div>
              )}
            </TextPanel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextPanel title="Top role alignment" value={roleFitSummary.top_role_alignment} />
            <TextPanel title="Capacity to perform" value={roleFitSummary.capacity_to_perform} />
            <TextPanel title="Ideal role types">
              {idealRoleTypes.length ? (
                <div className="flex flex-wrap gap-2">
                  {idealRoleTypes.map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/45">No ideal role types recorded.</div>
              )}
            </TextPanel>
            <TextPanel title="Role risks">
              {roleRisks.length ? (
                <ul className="space-y-3 text-sm leading-6 text-white/75">
                  {roleRisks.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-white/45">No role risks recorded.</div>
              )}
            </TextPanel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextPanel title="Operating Style word mappings">
              <div className="text-sm font-medium">
                {wording?.operating_style?.label || wording?.operating_style?.code || "—"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {textList(wording?.operating_style?.words).map((word, index) => (
                  <span
                    key={`${word}-${index}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </TextPanel>
            <TextPanel title="Career Vertical word mappings">
              <div className="text-sm font-medium">
                {wording?.career_vertical?.label || wording?.career_vertical?.code || "—"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {textList(wording?.career_vertical?.words).map((word, index) => (
                  <span
                    key={`${word}-${index}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </TextPanel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <TextPanel
              title={idealCandidateProfile?.thinking_style?.title || "How the ideal candidate thinks"}
              value={idealCandidateProfile?.thinking_style?.summary}
            />
            <TextPanel
              title={idealCandidateProfile?.execution_style?.title || "How the ideal candidate executes"}
              value={idealCandidateProfile?.execution_style?.summary}
            />
            <TextPanel
              title={idealCandidateProfile?.team_style?.title || "How the ideal candidate operates in a team"}
              value={idealCandidateProfile?.team_style?.summary}
            />
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="4. Atumaphire response"
              title="Payload produced for Atumaphire"
              description="This preview uses the stored run data and the same current formatter used by the reverse-profile API. It lets you inspect the external three-section response without reading the internal database payloads."
            />
            <CopyJsonButton json={externalJson} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <TextPanel title="trait_snapshot" value={externalReport.trait_snapshot} />
            <TextPanel title="how_they_work" value={externalReport.how_they_work} />
            <TextPanel title="what_to_verify" value={externalReport.what_to_verify} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[#07131f] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Full external JSON
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Response structure available to the Atumaphire integration.
                </div>
              </div>
              <CopyJsonButton json={externalJson} />
            </div>
            <pre className="mt-4 max-h-[760px] overflow-auto whitespace-pre text-xs leading-6 text-white/75">
              {externalJson}
            </pre>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 md:p-7">
          <SectionHeading
            eyebrow="5. Raw database records"
            title="Technical drill-down"
            description="These sections preserve access to the complete stored JSON for technical investigation, while keeping it out of the main review flow."
          />

          <div className="mt-6 space-y-3">
            {[
              ["Submitted answers", run.submitted_answers],
              ["Score payload", run.score_payload],
              ["Word mapping payload", run.word_mapping_payload],
              ["Stored export payload", run.export_payload],
            ].map(([label, value]) => (
              <details
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/[0.035]"
              >
                <summary className="cursor-pointer select-none px-5 py-4 font-medium">
                  {String(label)}
                </summary>
                <div className="border-t border-white/10 p-5">
                  <CopyJsonButton json={safeJson(value)} />
                  <pre className="mt-4 max-h-[760px] overflow-auto whitespace-pre text-xs leading-6 text-white/70">
                    {safeJson(value)}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-6 text-xs leading-5 text-white/35">
          Run ID: {run.id} • Internal record source: mcas.reverse_profile_runs
          <br />
          The Atumaphire preview is reconstructed from the stored run using the current deployed formatter. Historical runs created before formatter changes may not reproduce an earlier response byte-for-byte.
        </div>
      </div>
    </div>
  );
}