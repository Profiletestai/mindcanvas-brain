//apps/web/app/admin/mcas/test-lab/[runId]/TestLabRunClient.tsx
"use client";

import { useMemo, useState } from "react";

type Option = { code: string; label: string };
type Question = { code: string; section: string; prompt: string; options: Option[] };
type ResultPayload = { ok: boolean; result?: any; error?: string };

function toPct(value: unknown) {
  const n = Number(value || 0);
  return `${Math.round(n * 100)}%`;
}

export default function TestLabRunClient({ runId, questions }: { runId: string; questions: Question[] }) {
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const aNum = Number(String(a.code || "").replace("Q", ""));
      const bNum = Number(String(b.code || "").replace("Q", ""));
      return aNum - bNum;
    });
  }, [questions]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = sortedQuestions[currentIndex];
  const answeredCount = Object.keys(answers).filter(Boolean).length;
  const isLast = currentIndex === sortedQuestions.length - 1;

  function selectAnswer(questionCode: string, optionCode: string) {
    setAnswers((prev) => ({ ...prev, [questionCode]: optionCode }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      for (const question of sortedQuestions) {
        if (!answers[question.code]) throw new Error(`Please answer ${question.code} before submitting.`);
      }

      const res = await fetch(`/api/admin/mcas/test-lab/${runId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Something went wrong while submitting.");

      setResult(json);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    const scoring = result.result?.scoring || {};
    const primary = scoring.primary_operating_style;
    const cv = scoring.career_vertical;

    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <h2 className="text-2xl font-semibold text-emerald-100">Test Lab Result</h2>
          <p className="mt-2 text-emerald-100/80">This result was generated internally and did not touch Atumaphire routes.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Primary Operating Style" value={primary ? `${primary.code} · ${primary.label || ""} · ${toPct(primary.pct)}` : "—"} />
          <SummaryCard label="Career Vertical" value={cv ? `${String(cv.code).replace(/^V/, "CV")} · ${cv.label || ""}` : "—"} />
          <SummaryCard label="Model" value={scoring.model_version || "mcas-test-lab-v1"} />
        </div>

        <ResultBlock title="CORE Distribution" data={scoring.core_distribution} />
        <ResultBlock title="Operating Style Ranking" data={scoring.operating_style_ranking} />
        <ResultBlock title="Career Vertical" data={scoring.career_vertical} />
        <ResultBlock title="Full Result" data={result.result} />

        <button type="button" onClick={() => { setResult(null); setCurrentIndex(0); }} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">
          Back to answers
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Question {currentIndex + 1} of {sortedQuestions.length}</p>
          <h2 className="mt-1 text-xl font-semibold">{current?.prompt}</h2>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">{answeredCount}/{sortedQuestions.length}</div>
      </div>

      <div className="space-y-3">
        {current?.options?.map((option) => {
          const active = answers[current.code] === option.code;
          return (
            <button key={option.code} type="button" onClick={() => selectAnswer(current.code, option.code)} className={`w-full rounded-xl border p-4 text-left transition ${active ? "border-sky-400 bg-sky-400/15" : "border-white/10 bg-slate-900 hover:bg-white/5"}`}>
              <span className="font-semibold">{option.code}.</span> {option.label}
            </button>
          );
        })}
      </div>

      {error ? <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-6 flex justify-between gap-3">
        <button type="button" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
        {isLast ? (
          <button type="button" onClick={submit} disabled={submitting} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{submitting ? "Submitting..." : "Submit Test Lab Result"}</button>
        ) : (
          <button type="button" onClick={() => setCurrentIndex((i) => Math.min(sortedQuestions.length - 1, i + 1))} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">Next</button>
        )}
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function ResultBlock({ title, data }: { title: string; data: any }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-6"><h3 className="mb-4 text-lg font-semibold">{title}</h3><pre className="max-h-[480px] overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">{JSON.stringify(data, null, 2)}</pre></div>;
}