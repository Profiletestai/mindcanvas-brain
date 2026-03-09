//apps/web/app/mcas/reverse/[runId]/ReverseProfileClient.tsx
"use client";

import { useState } from "react";

type QuestionOption = {
  code: string;
  label: string;
};

type Question = {
  code: string;
  prompt: string;
  options: QuestionOption[];
};

export default function ReverseProfileClient({
  runId,
  questions,
  title,
}: {
  runId: string;
  questions: Question[];
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const q = questions[index];

  function handleBack() {
    if (index > 0 && !submitting) {
      setIndex(index - 1);
    }
  }

  async function answer(code: string) {
    if (!q || submitting) return;

    const next = { ...answers, [q.code]: code };
    setAnswers(next);

    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }

    await submit(next);
  }

  async function submit(payload: Record<string, string>) {
    try {
      setSubmitting(true);

      const res = await fetch("/api/mcas/reverse/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, answers: payload }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        console.error("Reverse profile submit failed:", json);
        alert(json?.error || "Failed to submit reverse profile test.");
        setSubmitting(false);
        return;
      }

      window.location.href = `/mcas/reverse/${runId}/result`;
    } catch (err) {
      console.error(err);
      alert("Something went wrong while submitting the reverse profile test.");
      setSubmitting(false);
    }
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-[#060e16] text-white flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No questions found for this reverse profile run.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-sm text-white/60">MCAS Reverse Profile Sandbox</div>
        <h1 className="mt-1 text-3xl font-semibold">
          {title || "Reverse Profile Test"}
        </h1>
        <p className="mt-3 text-white/70 max-w-2xl">
          Answer the 25 MCAS questions as the ideal candidate for this role.
          This sandbox is used to preview the structured output a partner platform
          will receive.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4 text-sm text-white/60">
            <div>
              Question {index + 1} of {questions.length}
            </div>
            <div className="font-mono">{q.code}</div>
          </div>

          <div className="mt-5 text-xl font-semibold leading-relaxed">
            {q.prompt}
          </div>

          <div className="mt-6 grid gap-3">
            {q.options.map((o) => (
              <button
                key={o.code}
                type="button"
                disabled={submitting}
                onClick={() => answer(o.code)}
                className={[
                  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left transition",
                  "hover:bg-white/10",
                  submitting ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <div className="text-xs text-white/50 font-mono">{o.code}</div>
                <div className="mt-1 text-white">{o.label}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={index === 0 || submitting}
              className={[
                "rounded-xl border px-4 py-2 text-sm transition",
                index === 0 || submitting
                  ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10",
              ].join(" ")}
            >
              Back
            </button>

            <div className="text-sm text-white/60">
              {submitting ? "Submitting..." : "Select an answer to continue"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}