//apps/web/app/mcas/t/[token]/McasWizardClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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
    candidate_first_name?: string | null;
    candidate_last_name?: string | null;
    candidate_email?: string | null;
  };
  questions: Question[];
};

export default function McasWizardClient({ token, application, questions }: Props) {
  const total = questions.length;

  const [step, setStep] = useState<"intro" | number>("intro");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Intro fields
  const [firstName, setFirstName] = useState(application.candidate_first_name ?? "");
  const [lastName, setLastName] = useState(application.candidate_last_name ?? "");
  const [email, setEmail] = useState(application.candidate_email ?? "");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  // Answers keyed by question code
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isIntro = step === "intro";
  const isQuestionStep = typeof step === "number";
  const index = isQuestionStep ? step : 0;
  const currentQuestion = isQuestionStep ? questions[index] : null;

  const progress = useMemo(() => {
    const answeredCount = questions.reduce((acc, q) => acc + (answers[q.code] ? 1 : 0), 0);
    return { answeredCount };
  }, [answers, questions]);

  function canStart() {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      phone.trim().length > 0 &&
      consent
    );
  }

  function goNext() {
    if (!isQuestionStep) return;
    if (index < total - 1) setStep(index + 1);
  }

  function goBack() {
    if (!isQuestionStep) return;
    if (index > 0) setStep(index - 1);
  }

  async function submitAll() {
    setError(null);
    setSubmitting(true);

    try {
      for (const q of questions) {
        if (!answers[q.code]) throw new Error(`Please answer ${q.code} before submitting.`);
      }

      const payload = {
        candidate: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          consent: consent,
        },
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
          <div className="text-sm text-white/70">MCAS • {application.application_id}</div>
          <h1 className="mt-2 text-2xl font-semibold">MindCanvas CORE Alignment System</h1>

          <div className="mt-2 text-white/60 text-sm">
            {total ? `25 questions • One question per page` : `No questions loaded`}
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}

          {done ? (
            <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <div className="font-semibold">Submitted successfully</div>
              <div className="mt-2 text-white/80 text-sm">
                Thank you. Your responses have been recorded.
              </div>
            </div>
          ) : null}
        </div>

        {!done && isIntro ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Before you begin</h2>
            <p className="mt-2 text-white/70 text-sm">
              Please complete your details below and confirm consent to proceed.
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/60">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-[#0b1724] border border-white/10 px-3 py-2"
                />
              </div>
            </div>

            <label className="mt-5 flex gap-3 items-start text-sm text-white/75">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I agree that my responses can be used to build my profile and report.
                <br />
                <span className="text-white/50 text-xs">
                  You can read our Privacy Policy and Terms &amp; Conditions for more details on how we handle your data.
                </span>
              </span>
            </label>

            <button
              disabled={!canStart()}
              onClick={() => setStep(0)}
              className={[
                "mt-6 w-full rounded-xl px-5 py-3 font-medium transition",
                canStart()
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/20 text-white/50 cursor-not-allowed",
              ].join(" ")}
            >
              Start Test
            </button>
          </div>
        ) : null}

        {!done && isQuestionStep && currentQuestion ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between text-sm text-white/60">
              <div>
                Question {index + 1} of {total} • {currentQuestion.code}
              </div>
              <div>
                Answered: <span className="text-white">{progress.answeredCount}</span> / {total}
              </div>
            </div>

            <div className="mt-4 text-xl font-semibold">{currentQuestion.prompt}</div>

            <div className="mt-5 grid gap-2">
              {currentQuestion.options.map((opt) => {
                const selected = answers[currentQuestion.code] === opt.code;
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
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [currentQuestion.code]: opt.code }))
                    }
                  >
                    <div className="text-sm text-white/60">{opt.code}</div>
                    <div className="mt-1">{opt.label}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={index === 0}
                className={[
                  "rounded-xl px-4 py-2 border transition",
                  index === 0
                    ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                ].join(" ")}
              >
                Back
              </button>

              {index < total - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!answers[currentQuestion.code]}
                  className={[
                    "rounded-xl px-5 py-2 font-medium transition",
                    answers[currentQuestion.code]
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-white/20 text-white/50 cursor-not-allowed",
                  ].join(" ")}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitAll}
                  disabled={submitting || !answers[currentQuestion.code]}
                  className={[
                    "rounded-xl px-5 py-2 font-medium transition",
                    !submitting && answers[currentQuestion.code]
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-white/20 text-white/50 cursor-not-allowed",
                  ].join(" ")}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}