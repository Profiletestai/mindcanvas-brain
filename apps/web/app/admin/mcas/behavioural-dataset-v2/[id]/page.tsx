// apps/web/app/admin/mcas/behavioural-dataset-v2/[id]/page.tsx
import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

function pct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function precisePct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function readableBand(band: string) {
  return String(band || "not_scored")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function bandClass(band: string) {
  if (band === "excellent_fit") return "bg-emerald-500/15 text-emerald-200";
  if (band === "strong_fit") return "bg-sky-500/15 text-sky-200";
  if (band === "moderate_fit") return "bg-amber-500/15 text-amber-200";
  if (band === "low_fit") return "bg-orange-500/15 text-orange-200";
  if (band === "poor_fit") return "bg-red-500/15 text-red-200";
  return "bg-white/10 text-slate-300";
}

function normaliseCv(value: unknown): string {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return "—";
  if (raw.includes("1") && raw.includes("2")) return "CV1–2";
  if (raw.includes("5") && raw.includes("6")) return "CV5–6";
  const match = raw.match(/(?:CV|V)\s*([1-6])/);
  return match ? `CV${match[1]}` : raw;
}

function expectedOs(row: any) {
  return [
    row.expected_primary_os,
    row.expected_secondary_os,
    row.expected_tertiary_os,
  ]
    .filter(Boolean)
    .join(" / ") || "—";
}

function expectedCv(row: any) {
  return [row.expected_primary_cv, row.expected_secondary_cv]
    .filter(Boolean)
    .map(normaliseCv)
    .join(" / ") || "—";
}

function getRoleAlignment(row: any) {
  return row.calculated_result?.role_alignment || null;
}

function getScoring(row: any) {
  return row.calculated_result?.scoring || row.calculated_result || null;
}

function getAudit(row: any) {
  return row.calculated_result?.audit?.answers || row.calculated_result?.scoring?.audit?.answers || [];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = mcasSupa();

  const { data: row, error } = await sb
    .from("behavioural_dataset")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) notFound();

  const alignment = getRoleAlignment(row);
  const scoring = getScoring(row);
  const audit = getAudit(row);
  const band = alignment?.fit_band || "not_scored";

  const osRanking = scoring?.operating_style_ranking || [];
  const baRanking = scoring?.behavioural_approach_ranking || [];
  const cvRanking = scoring?.career_vertical_ranking || [];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href={`/admin/mcas/behavioural-dataset-v2?version=${row.dataset_version || "v2"}`}
          className="mb-6 inline-block text-sm text-sky-300 hover:text-sky-200"
        >
          ← Back to Role Alignment Validation
        </Link>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-400">Row {row.row_number} · {row.dataset_version}</p>
          <h1 className="mt-1 text-3xl font-semibold">{row.job_title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-slate-300">
            {row.job_description || "No job description provided."}
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Expected OS" value={expectedOs(row)} />
          <SummaryCard label="Actual OS" value={alignment?.actual?.os?.join(" / ") || "—"} />
          <SummaryCard label="Expected CV" value={expectedCv(row)} />
          <SummaryCard label="Actual CV" value={alignment?.actual?.cv?.join(" / ") || "—"} />
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="OS Alignment" value={pct(Number(alignment?.os_alignment?.pct || 0))} />
          <MetricCard label="CV Alignment" value={pct(Number(alignment?.cv_alignment?.pct || 0))} />
          <MetricCard label="Overall Alignment" value={pct(Number(alignment?.overall_alignment_pct || 0))} />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Fit Band</p>
            <p className="mt-3">
              <span className={`rounded-full px-3 py-2 text-sm ${bandClass(band)}`}>
                {readableBand(band)}
              </span>
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <RankingCard title="Operating Style Ranking" items={osRanking} />
          <RankingCard title="Behavioural Approach Ranking" items={baRanking} />
          <RankingCard title="Career Vertical Ranking" items={cvRanking.map((item: any) => ({ ...item, label: normaliseCv(item.code) }))} />
        </section>

        {alignment ? (
          <section className="mb-8 grid gap-4 md:grid-cols-2">
            <AlignmentDetail title="OS Alignment Detail" detail={alignment.os_alignment?.detail || []} />
            <AlignmentDetail title="CV Alignment Detail" detail={alignment.cv_alignment?.detail || []} />
          </section>
        ) : null}

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-xl font-semibold">Q25 Readiness Signal</h2>
          <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
            {JSON.stringify(scoring?.readiness_signal || null, null, 2)}
          </pre>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-xl font-semibold">Question Audit</h2>
          <div className="space-y-3">
            {audit.map((item: any) => (
              <div key={item.question_code} className="rounded-lg bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.question_code}: {item.option_code}</p>
                  {item.mapped_os ? <Badge>{item.mapped_os}</Badge> : null}
                  {item.mapped_core ? <Badge>{item.mapped_core}</Badge> : null}
                  {item.mapped_cv ? <Badge>{normaliseCv(item.mapped_cv)}</Badge> : null}
                  {item.flag ? <Badge>{item.flag}</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.prompt}</p>
                <p className="mt-1 text-sm text-slate-400">{item.option_label}</p>
              </div>
            ))}

            {!audit.length ? <p className="text-sm text-slate-400">No audit data found.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-200">{children}</span>;
}

function RankingCard({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">
        {(items || []).map((item) => (
          <div key={`${item.code}-${item.rank}`}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{item.rank}. {item.label || item.code}</span>
              <span className="text-slate-400">{precisePct(Number(item.pct || 0) * 100)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-white/70"
                style={{ width: precisePct(Number(item.pct || 0) * 100) }}
              />
            </div>
          </div>
        ))}

        {!items?.length ? <p className="text-sm text-slate-400">No ranking data.</p> : null}
      </div>
    </div>
  );
}

function AlignmentDetail({ title, detail }: { title: string; detail: any[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {detail.map((item, idx) => (
          <div key={idx} className="rounded-xl bg-white/5 p-3 text-sm">
            <div className="flex justify-between">
              <span>{item.expected_code}</span>
              <span className="text-slate-400">Awarded {item.awarded}/{item.expected_weight}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Expected position {item.expected_position}; actual position {item.actual_position || "not found"}
            </p>
          </div>
        ))}
        {!detail.length ? <p className="text-sm text-slate-400">No alignment detail.</p> : null}
      </div>
    </div>
  );
}