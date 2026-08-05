//apps/web/app/mcas/t/[token]/McasTakerClient.tsx
"use client";

import { useMemo, useState } from "react";

type Question = {
  code: string;
  prompt: string;
  options: { code: string; label: string }[];
};

type Props = {
  token: string;
  application: {
    partner_key: string;
    application_id: string;
    status: string;
    candidate_email?: string | null;
    candidate_first_name?: string | null;
    candidate_last_name?: string | null;
    framework_slug: string;
    framework_version: string;
  };
  framework: { slug: string; version: string; status: string };
  questions: Question[];
};

// Small deterministic PRNG (string seed)
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const seed = xmur3(seedStr)();
  const rand = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function McasTakerClient(props: Props) {
  const { token, application, framework } = props;

  // Randomise question order per user (deterministic)
  const questions = useMemo(() => {
    const shuffledQs = seededShuffle(props.questions, `mcas:${token}:questions`);
    // Also shuffle option order per question
    return shuffledQs.map((q) => ({
      ...q,
      options: seededShuffle(q.options, `mcas:${token}:${q.code}:options`),
    }));
  }, [props.questions, token]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | any>(null);
  const [error, setError] = useState<string | null>(null);

  const total = questions.length;
  const answered = useMemo(
    () => questions.reduce((acc, q) => acc + (answers[q.code] ? 1 : 0), 0),
    [answers, questions]
  );

  const canSubmit = total > 0 && answered === total && !submitting;

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        answers: questions.map((q) => ({
          question_code: q.code,
          option_code: answers[q.code],
        })),
      };

      const res = await fetch(`/api/public/mcas/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Submit failed");

      setDone(json);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060e16] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/70">
            MCAS • {framework.slug} • {framework.version}
          </div>

          <h1 className="mt-2 text-2xl font-semibold">MindCanvas CORE Alignment System</h1>

          <div className="mt-2 text-white/70">
            Application: <span className="text-white">{application.application_id}</span>
          </div>

          {done ? (
            <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <div className="font-semibold">Submitted successfully</div>
              <div className="mt-2 text-white/80 text-sm">
                Your results have been recorded. You may close this window.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        {total > 0 && !done ? (
          <div className="mt-6 space-y-4">
            {questions.map((q) => (
              <div key={q.code} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm text-white/60">{q.code}</div>
                <div className="mt-2 text-lg font-medium">{q.prompt}</div>

                <div className="mt-4 grid gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.code] === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        className={[
                          "text-left rounded-xl border px-4 py-3 transition",
                          selected
                            ? "border-white/40 bg-white/15"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                        ].join(" ")}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.code]: opt.code }))}
                      >
                        <div className="text-sm text-white/60">{opt.code}</div>
                        <div className="mt-1">{opt.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-white/70">
                Progress: <span className="text-white">{answered}</span> / {total}
              </div>

              <button
                disabled={!canSubmit}
                onClick={onSubmit}
                className={[
                  "rounded-xl px-5 py-3 font-medium transition",
                  canSubmit ? "bg-white text-black hover:bg-white/90" : "bg-white/20 text-white/50 cursor-not-allowed",
                ].join(" ")}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}