// apps/web/app/mcas/t/[token]/McasWizardClient.tsx

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  code: string;
  prompt: string;
  section?: string;
  options: {
    code: string;
    label: string;
  }[];
};

type Props = {
  token: string;
  application: {
    application_id: string;
    partner_key: string;
    status: string;
    test_link_name: string;
    report_version: "lite" | "full";
    show_results: boolean;
    candidate_first_name?: string | null;
    candidate_last_name?: string | null;
    candidate_email?: string | null;
    candidate_phone?: string | null;
  };
  questions: Question[];
};

function isExternalUrl(urlValue: string) {
  try {
    const url = new URL(urlValue, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export default function McasWizardClient({
  token,
  application,
  questions,
}: Props) {
  const router = useRouter();
  const total = questions.length;

  const [step, setStep] = useState<"intro" | number>("intro");
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(
    application.candidate_first_name ?? ""
  );
  const [lastName, setLastName] = useState(
    application.candidate_last_name ?? ""
  );
  const [email, setEmail] = useState(application.candidate_email ?? "");
  const [phone, setPhone] = useState(application.candidate_phone ?? "");
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isIntro = step === "intro";
  const isQuestionStep = typeof step === "number";
  const currentIndex = isQuestionStep ? step : 0;
  const currentQuestion = isQuestionStep ? questions[currentIndex] : null;

  const progress = useMemo(() => {
    const answeredCount = questions.reduce(
      (count, question) => count + (answers[question.code] ? 1 : 0),
      0
    );

    return {
      answeredCount,
      percentage: total > 0 ? Math.round((answeredCount / total) * 100) : 0,
    };
  }, [answers, questions, total]);

  function canStart() {
    return (
      total === 25 &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      phone.trim().length > 0 &&
      consent
    );
  }

  function goBack() {
    if (!isQuestionStep) return;

    if (currentIndex === 0) {
      setStep("intro");
      return;
    }

    setStep(currentIndex - 1);
  }

  function goNext() {
    if (!isQuestionStep || !currentQuestion) return;

    if (answers[currentQuestion.code] && currentIndex < total - 1) {
      setStep(currentIndex + 1);
    }
  }

  function chooseAnswer(questionCode: string, optionCode: string) {
    setAnswers((current) => ({
      ...current,
      [questionCode]: optionCode,
    }));
  }

  async function submitAssessment() {
    setError(null);
    setSubmitting(true);

    try {
      for (const question of questions) {
        if (!answers[question.code]) {
          throw new Error(
            `Please answer ${question.code} before submitting your assessment.`
          );
        }
      }

      const response = await fetch(
        `/api/public/mcas/${encodeURIComponent(token)}/submit`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            candidate: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              consent,
            },
            answers: questions.map((question) => ({
              question_code: question.code,
              option_code: answers[question.code],
            })),
          }),
        }
      );

      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            resultUrl?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(
          body?.error || "Your assessment could not be submitted."
        );
      }

      const resultUrl = String(body?.resultUrl || "").trim();

      if (!resultUrl) {
        throw new Error(
          "Your assessment was saved, but the result page could not be resolved."
        );
      }

      setRedirecting(true);

      if (isExternalUrl(resultUrl)) {
        window.location.assign(resultUrl);
        return;
      }

      router.replace(resultUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your assessment could not be submitted."
      );
      setSubmitting(false);
      setRedirecting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#060e16] px-5 py-8 text-white md:px-8">
      <section className="mx-auto max-w-3xl">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            MCAS Assessment
          </p>

          <h1 className="mt-3 text-2xl font-semibold md:text-3xl">
            {application.test_link_name}
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            This assessment explores observable work patterns, career readiness,
            and the environments where you are most likely to contribute
            sustainably.
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm sm:grid-cols-3">
            <MetaItem label="Questions" value={`${total}`} />
            <MetaItem
              label="Report"
              value={
                application.report_version === "full"
                  ? "Full Career Report"
                  : "Lite Career Report"
              }
            />
            <MetaItem label="Progress" value={`${progress.percentage}%`} />
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm leading-6 text-red-100">
            {error}
          </div>
        ) : null}

        {isIntro ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <h2 className="text-xl font-semibold">Before you begin</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Please confirm your details and consent before beginning the
              assessment.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                autoComplete="family-name"
              />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
              />
              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                type="tel"
                autoComplete="tel"
              />
            </div>

            <label className="mt-6 flex cursor-pointer gap-3 text-sm leading-6 text-slate-300">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300"
              />
              <span>
                I agree that my responses may be used to create my MCAS profile
                and report.
              </span>
            </label>

            <button
              type="button"
              disabled={!canStart()}
              onClick={() => {
                setError(null);
                setStep(0);
              }}
              className={[
                "mt-7 w-full rounded-xl px-5 py-3 text-sm font-semibold transition",
                canStart()
                  ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                  : "cursor-not-allowed bg-white/10 text-white/40",
              ].join(" ")}
            >
              Start assessment
            </button>
          </section>
        ) : null}

        {isQuestionStep && currentQuestion ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-400">
              <p>
                Question {currentIndex + 1} of {total}
              </p>
              <p>
                {progress.answeredCount} of {total} answered
              </p>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-[width]"
                style={{
                  width: `${Math.max(
                    ((currentIndex + 1) / total) * 100,
                    progress.percentage
                  )}%`,
                }}
              />
            </div>

            <h2 className="mt-8 text-xl font-semibold leading-8 md:text-2xl">
              {currentQuestion.prompt}
            </h2>

            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option) => {
                const selected =
                  answers[currentQuestion.code] === option.code;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() =>
                      chooseAnswer(currentQuestion.code, option.code)
                    }
                    className={[
                      "w-full rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-cyan-300 bg-cyan-300/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                      {option.code}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white">
                      {option.label}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Back
              </button>

              {currentIndex < total - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!answers[currentQuestion.code]}
                  className={[
                    "rounded-xl px-5 py-3 text-sm font-semibold transition",
                    answers[currentQuestion.code]
                      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      : "cursor-not-allowed bg-white/10 text-white/40",
                  ].join(" ")}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitAssessment}
                  disabled={
                    submitting ||
                    redirecting ||
                    !answers[currentQuestion.code]
                  }
                  className={[
                    "rounded-xl px-5 py-3 text-sm font-semibold transition",
                    !submitting &&
                    !redirecting &&
                    answers[currentQuestion.code]
                      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      : "cursor-not-allowed bg-white/10 text-white/40",
                  ].join(" ")}
                >
                  {redirecting
                    ? "Opening your report…"
                    : submitting
                      ? "Submitting…"
                      : "View my report"}
                </button>
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-medium text-slate-100">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
      />
    </label>
  );
}