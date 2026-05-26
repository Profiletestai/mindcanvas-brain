//apps/web/app/admin/mcas/behavioural-dataset/[id]/page.tsx
import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = mcasSupa();

  const { data: row, error } = await sb
    .from("behavioural_dataset")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) notFound();

  const scoring = row.calculated_result?.scoring || null;
  const audit = row.calculated_result?.audit?.answers || [];
  const answers = row.answers || {};

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/admin/mcas/behavioural-dataset"
          className="mb-6 inline-block text-sm text-sky-300 hover:text-sky-200"
        >
          ← Back to Behavioural Dataset
        </Link>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-400">Row {row.row_number}</p>
          <h1 className="mt-1 text-3xl font-semibold">{row.job_title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-slate-300">
            {row.job_description || "No job description provided."}
          </p>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Expected OS" value={row.expected_primary_os} />
          <SummaryCard label="Calculated OS" value={row.calculated_primary_os} />
          <SummaryCard label="Expected CV" value={row.expected_primary_cv} />
          <SummaryCard label="Calculated CV" value={row.calculated_primary_cv} />
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <MatchCard title="Operating Style Match" value={row.os_match} />
          <MatchCard title="Career Vertical Match" value={row.cv_match} />
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-3 text-xl font-semibold">Validation / Justification</h2>
          <p className="whitespace-pre-wrap text-slate-300">
            {row.validation_justification || "No validation text provided."}
          </p>
        </section>

        {scoring ? (
          <section className="mb-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">CORE Distribution</h2>
              <JsonPretty data={scoring.core_distribution} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Operating Style Ranking</h2>
              <JsonPretty data={scoring.operating_style_ranking} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Primary Operating Style</h2>
              <JsonPretty data={scoring.primary_operating_style} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Career Vertical</h2>
              <JsonPretty data={scoring.career_vertical} />
            </div>
          </section>
        ) : (
          <section className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-yellow-100">
            This row has not been scored yet.
          </section>
        )}

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-xl font-semibold">Answers Q1–Q25</h2>
          <div className="grid gap-2 md:grid-cols-5">
            {Array.from({ length: 25 }, (_, i) => {
              const q = `Q${i + 1}`;
              return (
                <div key={q} className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-slate-400">{q}</p>
                  <p className="mt-1 text-sm">{answers[q] || "—"}</p>
                </div>
              );
            })}
          </div>
        </section>

        {audit?.length ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-xl font-semibold">Scoring Audit</h2>
            <div className="space-y-3">
              {audit.map((item: any) => (
                <div key={item.question_code} className="rounded-lg bg-white/5 p-4">
                  <p className="text-sm font-semibold">
                    {item.question_code}: {item.option_code}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">{item.prompt}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.option_label}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value || "—"}</p>
    </div>
  );
}

function MatchCard({
  title,
  value,
}: {
  title: string;
  value: boolean | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">
        {value === true ? "✅ Match" : value === false ? "⚠️ Needs Review" : "—"}
      </p>
    </div>
  );
}

function JsonPretty({ data }: { data: any }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}