// apps/web/app/t/[token]/PublicTestClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  idx?: number | null;
  order?: number | null;
  type?: string | null;
  text?: string;
  options?: string[] | null;
  category?: "scored" | "qual" | string | null;
};

type AnswersMap = Record<string, number>;
type TextAnswersMap = Record<string, string>;
type Step = "details" | "questions";

type CountryCode = {
  iso: string;
  label: string;
  dial: string;
};

const PRIVACY_POLICY_URL = "https://profiletest.ai/privacy-policy";

const COUNTRY_CODES: CountryCode[] = [
  { iso: "ZA", label: "South Africa", dial: "+27" },
  { iso: "GB", label: "United Kingdom", dial: "+44" },
  { iso: "US", label: "United States", dial: "+1" },
  { iso: "CA", label: "Canada", dial: "+1" },
  { iso: "AU", label: "Australia", dial: "+61" },
  { iso: "NZ", label: "New Zealand", dial: "+64" },
  { iso: "IE", label: "Ireland", dial: "+353" },
  { iso: "AE", label: "United Arab Emirates", dial: "+971" },
  { iso: "FR", label: "France", dial: "+33" },
  { iso: "DE", label: "Germany", dial: "+49" },
  { iso: "NL", label: "Netherlands", dial: "+31" },
  { iso: "ES", label: "Spain", dial: "+34" },
  { iso: "IT", label: "Italy", dial: "+39" },
  { iso: "PT", label: "Portugal", dial: "+351" },
  { iso: "CH", label: "Switzerland", dial: "+41" },
  { iso: "BE", label: "Belgium", dial: "+32" },
  { iso: "SE", label: "Sweden", dial: "+46" },
  { iso: "NO", label: "Norway", dial: "+47" },
  { iso: "DK", label: "Denmark", dial: "+45" },
  { iso: "FI", label: "Finland", dial: "+358" },
  { iso: "IN", label: "India", dial: "+91" },
  { iso: "SG", label: "Singapore", dial: "+65" },
  { iso: "HK", label: "Hong Kong", dial: "+852" },
  { iso: "JP", label: "Japan", dial: "+81" },
  { iso: "CN", label: "China", dial: "+86" },
  { iso: "BR", label: "Brazil", dial: "+55" },
  { iso: "MX", label: "Mexico", dial: "+52" },
  { iso: "KE", label: "Kenya", dial: "+254" },
  { iso: "NG", label: "Nigeria", dial: "+234" },
  { iso: "ZW", label: "Zimbabwe", dial: "+263" },
  { iso: "ZM", label: "Zambia", dial: "+260" },
  { iso: "BW", label: "Botswana", dial: "+267" },
  { iso: "NA", label: "Namibia", dial: "+264" },
  { iso: "MU", label: "Mauritius", dial: "+230" },
];

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const ct = r.headers.get("content-type") || "";

  if (!ct.includes("application/json")) {
    const text = (await r.text()).slice(0, 600);
    throw new Error(`HTTP ${r.status} – non-JSON response:\n${text}`);
  }

  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

type SubmitResponse = {
  ok: boolean;
  redirect?: string | null;
  show_results?: boolean;
  next_steps_url?: string | null;
  hidden_results_message?: string | null;

  // legacy / alternate variants
  redirect_url?: string | null;
  redirectUrl?: string | null;
  showResults?: boolean;
  nextStepsUrl?: string | null;

  // qsc-specific variants
  qsc_public_path?: string | null;
  qsc_public_url?: string | null;

  [k: string]: any;
};

function isTextQuestion(q?: Question | null) {
  const t = String(q?.type || "").toLowerCase().trim();
  return t === "text" || t === "textarea" || t === "longtext";
}

function safeString(x: any): string {
  if (typeof x === "string") return x;
  if (x == null) return "";
  return String(x);
}

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function buildInternationalPhone(countryCode: string, localNumber: string) {
  const cleanedCountryCode = safeString(countryCode).trim() || "+27";
  const cleanedLocal = safeString(localNumber).replace(/[^\d]/g, "").replace(/^0+/, "");

  return cleanedLocal ? `${cleanedCountryCode}${cleanedLocal}` : "";
}

function parseSavedPhone(savedCountryCode: any, savedPhone: any) {
  const existingCountryCode = safeString(savedCountryCode).trim();
  const phone = safeString(savedPhone).trim();

  if (existingCountryCode) {
    const localWithoutCountry = phone.startsWith(existingCountryCode)
      ? phone.slice(existingCountryCode.length)
      : phone;

    return {
      countryCode: existingCountryCode,
      localPhone: localWithoutCountry,
    };
  }

  if (!phone) {
    return {
      countryCode: "+27",
      localPhone: "",
    };
  }

  const compactPhone = phone.replace(/\s+/g, "");

  const matchingCountry = [...COUNTRY_CODES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) => compactPhone.startsWith(country.dial));

  if (matchingCountry) {
    return {
      countryCode: matchingCountry.dial,
      localPhone: compactPhone.slice(matchingCountry.dial.length),
    };
  }

  return {
    countryCode: "+27",
    localPhone: phone,
  };
}

export default function PublicTestClient({
  token,
  embed = false,
}: {
  token: string;
  embed?: boolean;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [testName, setTestName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [introText, setIntroText] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("details");

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [textAnswers, setTextAnswers] = useState<TextAnswersMap>({});

  // visibility engine detection
  const [isVisibilityEngine, setIsVisibilityEngine] = useState(false);

  // details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+27");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [takerId, setTakerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const key = (k: string) => `mc_${k}_${token}`;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const metaRes: any = await fetchJson(`/api/public/test/${token}`);
        if (!alive) return;

        const metaData = metaRes?.data ?? {};
        const nameFromMeta: string | null = metaData?.name ?? null;

        const orgNameFromMeta: string | null =
          metaData?.org_name ??
          metaData?.organisation_name ??
          metaData?.org?.name ??
          null;

        const introFromMeta: string | null =
          metaData?.intro_text ??
          metaData?.briefing ??
          metaData?.assessment_intro ??
          null;

        setTestName(nameFromMeta);
        setOrgName(orgNameFromMeta);
        setIntroText(introFromMeta);

        if (!embed && typeof window !== "undefined") {
          const detail = { orgName: orgNameFromMeta, testName: nameFromMeta };
          window.dispatchEvent(new CustomEvent("mc_test_meta", { detail }));
        }

        const qRes: any = await fetchJson(`/api/public/test/${token}/questions`);
        if (!alive) return;

        const list: Question[] = Array.isArray(qRes?.questions) ? qRes.questions : [];
        setQuestions(list);

        const engine = safeString(qRes?.__debug?.engine).toLowerCase();
        setIsVisibilityEngine(engine.includes("visibility"));

        if (typeof window !== "undefined") {
          const savedAns = window.localStorage.getItem(key("answers"));
          if (savedAns) {
            try {
              setAnswers(JSON.parse(savedAns));
            } catch {}
          }

          const savedText = window.localStorage.getItem(key("text_answers"));
          if (savedText) {
            try {
              setTextAnswers(JSON.parse(savedText));
            } catch {}
          }

          const d = window.localStorage.getItem(key("details"));
          if (d) {
            try {
              const o = JSON.parse(d);
              const parsedPhone = parseSavedPhone(o.phoneCountryCode, o.phone);

              setFirstName(o.firstName || "");
              setLastName(o.lastName || "");
              setEmail(o.email || "");
              setPhoneCountryCode(parsedPhone.countryCode);
              setPhone(parsedPhone.localPhone);
              setCompany(o.company || "");
              setRoleTitle(o.roleTitle || "");
              setDataConsent(Boolean(o.dataConsent));
            } catch {}
          }

          const tid = window.localStorage.getItem(key("taker_id"));
          if (tid) setTakerId(tid);
        }

        setStarted(true);
      } catch (e: any) {
        if (alive) setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, embed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key("answers"), JSON.stringify(answers));
    }
  }, [answers, token]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key("text_answers"), JSON.stringify(textAnswers));
    }
  }, [textAnswers, token]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key("details"),
        JSON.stringify({
          firstName,
          lastName,
          email,
          phoneCountryCode,
          phone,
          company,
          roleTitle,
          dataConsent,
        })
      );
    }
  }, [firstName, lastName, email, phoneCountryCode, phone, company, roleTitle, dataConsent, token]);

  const q = questions[i];

  const isAnswered = (qq: Question) => {
    if (isTextQuestion(qq)) return (textAnswers[qq.id] || "").trim().length > 0;
    return Number(answers[qq.id]) >= 1;
  };

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((qq) => isAnswered(qq)),
    [questions, answers, textAnswers]
  );

  const setChoice = (qid: string, val: number) => setAnswers((a) => ({ ...a, [qid]: val }));
  const setText = (qid: string, val: string) => setTextAnswers((a) => ({ ...a, [qid]: val }));

  const validateDetails = (): string | null => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const ph = buildInternationalPhone(phoneCountryCode, phone);

    if (!fn || !ln || !em || !ph) {
      return "Please complete all required fields before starting.";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(em)) {
      return "Please enter a valid email address.";
    }

    const localDigits = phone.replace(/[^\d]/g, "").replace(/^0+/, "");
    if (localDigits.length < 6) {
      return "Please enter a valid mobile number.";
    }

    if (!dataConsent) {
      return "Please confirm that you agree to the use of your data before starting.";
    }

    return null;
  };

  const proceedToQuestions = async () => {
    const validationError = validateDetails();

    if (validationError) {
      setDetailsError(validationError);
      return;
    }

    try {
      setSavingDetails(true);
      setError("");
      setDetailsError(null);

      const internationalPhone = buildInternationalPhone(phoneCountryCode, phone);

      const res: any = await fetchJson(`/api/public/test/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim().toLowerCase() || null,
          phone: internationalPhone || null,
          company: company.trim() || null,
          role_title: roleTitle.trim() || null,
          data_consent: true,
        }),
      });

      const tid = res?.id;
      if (!tid) throw new Error("Failed to create taker");

      setTakerId(tid);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key("taker_id"), tid);
      }

      setStep("questions");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSavingDetails(false);
    }
  };

  function resolveRedirectAndNextSteps(j: SubmitResponse) {
    const redirect =
      safeString(j.redirect).trim() ||
      safeString((j as any).redirect_url).trim() ||
      safeString((j as any).redirectUrl).trim() ||
      safeString((j as any).qsc_public_path).trim() ||
      safeString((j as any).qsc_public_url).trim() ||
      "";

    const nextSteps =
      safeString(j.next_steps_url).trim() ||
      safeString((j as any).nextStepsUrl).trim() ||
      safeString((j as any).next_steps?.url).trim() ||
      safeString((j as any).link_meta?.next_steps_url).trim() ||
      safeString((j as any).meta?.next_steps_url).trim() ||
      safeString((j as any).link?.next_steps_url).trim() ||
      "";

    const showResults =
      typeof j.show_results === "boolean"
        ? j.show_results
        : typeof (j as any).showResults === "boolean"
        ? (j as any).showResults
        : undefined;

    return { redirect: redirect || null, nextSteps: nextSteps || null, showResults };
  }

  const submit = async () => {
    try {
      setSubmitting(true);
      setError("");
      setCompletedMessage(null);

      if (!takerId) throw new Error("missing taker_id");

      const payloadAnswers = questions.map((qq) => {
        if (isTextQuestion(qq)) {
          return { question_id: qq.id, text: (textAnswers[qq.id] || "").trim() };
        }

        return { question_id: qq.id, selected: Number(answers[qq.id] || 0) - 1 };
      });

      const res = await fetch(`/api/public/test/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taker_id: takerId, answers: payloadAnswers }),
      });

      const j: SubmitResponse = await res.json().catch(() => ({} as any));

      if (!res.ok || (j as any)?.ok === false) {
        throw new Error((j as any)?.error || `HTTP ${res.status}`);
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key("answers"));
        window.localStorage.removeItem(key("text_answers"));
        window.localStorage.removeItem(key("details"));
      }

      // Visibility always goes to bespoke route
      if (isVisibilityEngine) {
        router.replace(`/t/${token}/visibility/report?tid=${encodeURIComponent(takerId)}`);
        return;
      }

      const { redirect, nextSteps, showResults } = resolveRedirectAndNextSteps(j);

      // CRITICAL FIX:
      // Trust explicit backend redirect FIRST (QSC and other bespoke engines)
      if (redirect) {
        if (isAbsoluteUrl(redirect)) {
          window.location.href = redirect;
        } else {
          router.replace(redirect);
        }

        return;
      }

      if (nextSteps) {
        if (isAbsoluteUrl(nextSteps)) {
          window.location.href = nextSteps;
        } else {
          router.replace(nextSteps);
        }

        return;
      }

      // Only fall back to generic /result when no explicit redirect was provided
      if (showResults !== false) {
        router.replace(`/t/${token}/result?tid=${encodeURIComponent(takerId)}`);
        return;
      }

      setCompletedMessage(
        j.hidden_results_message ||
          (j as any).hiddenResultsMessage ||
          "Thanks — your results have been sent to your organisation. You can close this page."
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- UI ---------------- */

  const finalOrg = orgName || "Profiletest.ai";
  const finalTest = testName || "Profile Test";

  if (loading) {
    return (
      <div className={embed ? "p-0" : "p-6"}>
        <div className="text-lg font-semibold text-white">Loading…</div>
        <div className="mt-2 text-sm text-white/70">Preparing your assessment.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={embed ? "p-0" : "p-6"} style={embed ? { minHeight: 420 } : undefined}>
        <h1 className="text-xl font-semibold text-white">Couldn’t load test</h1>
        <pre className="mt-3 p-3 rounded bg-white text-black whitespace-pre-wrap border border-black/10">
          {error}
        </pre>
      </div>
    );
  }

  if (completedMessage) {
    return (
      <div className={embed ? "p-0" : "p-6"}>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 max-w-2xl space-y-3">
          <div className="text-lg font-semibold text-white">All done</div>
          <p className="text-sm text-white/80">{completedMessage}</p>
        </div>
      </div>
    );
  }

  const noQuestions = questions.length === 0 || !q;

  const canProceedDetails =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    buildInternationalPhone(phoneCountryCode, phone).length > 0 &&
    dataConsent &&
    !savingDetails;

  const currentAnswered = q ? isAnswered(q) : false;

  return (
    <div className={embed ? "p-0" : "p-6"}>
      {step === "details" ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
              <div className="text-sm text-white/80 font-medium">
                {finalOrg} invites you to complete this assessment
              </div>

              <div className="text-2xl font-semibold text-white">{finalTest}</div>

              <div>
                <div className="text-sm font-semibold text-white/90">Introduction To {finalTest}</div>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {introText?.trim()
                    ? introText
                    : "This assessment is designed to help you understand your profile and the patterns that influence how you operate. Your results will be used to generate a personalised report and insights for your organisation."}
                </p>
              </div>

              <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                <div className="text-sm font-semibold text-white/90">Instructions</div>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Please answer each question honestly and instinctively. There are no right or wrong answers.
                  Your results are based on patterns across your responses.
                </p>
                <p className="mt-3 text-sm text-white/75">Enjoy this experience with {finalOrg}.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
              <div className="text-lg font-semibold text-white">Before we start, tell us about you</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-white/80">First name *</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Last name *</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-white/80">Email *</span>
                  <input
                    type="email"
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Mobile *</span>

                  <div className="mt-1 flex gap-2">
                    <select
                      className="w-36 rounded-xl bg-white text-black p-3"
                      value={phoneCountryCode}
                      onChange={(e) => {
                        setPhoneCountryCode(e.target.value);
                        setDetailsError(null);
                      }}
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={`${country.iso}-${country.dial}`} value={country.dial}>
                          {country.iso} {country.dial}
                        </option>
                      ))}
                    </select>

                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Mobile number"
                      className="min-w-0 flex-1 rounded-xl bg-white text-black p-3"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setDetailsError(null);
                      }}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Organisation (optional)</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-white/80">Role / Department (optional)</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  />
                </label>
              </div>

              <div className="rounded-xl bg-black/20 border border-white/10 p-4 flex flex-col gap-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                    checked={dataConsent}
                    onChange={(e) => {
                      setDataConsent(e.target.checked);
                      setDetailsError(null);
                    }}
                  />
                  <span className="text-sm text-white/90">
                    I agree that my responses can be used to build my profile and report.
                  </span>
                </label>

                <p className="text-xs text-white/70">
                  By submitting this assessment, you have read and agree to our{" "}
                  <a
                    href={PRIVACY_POLICY_URL}
                    target="_blank"
                    className="underline"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a href="/terms" target="_blank" className="underline" rel="noopener noreferrer">
                    Terms &amp; Conditions
                  </a>
                  .
                </p>
              </div>

              {detailsError && <p className="text-sm text-red-300">{detailsError}</p>}

              <div className="pt-1">
                <button
                  onClick={proceedToQuestions}
                  disabled={!canProceedDetails}
                  className="w-full px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 disabled:opacity-60"
                >
                  {savingDetails ? "Saving…" : "Start This Assessment 👉"}
                </button>

                {!embed && (
                  <div className="pt-3 text-center text-xs text-white/50">
                    powered by <span className="text-white/65">profiletest.ai</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : noQuestions ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 max-w-2xl">
          <div className="text-lg font-semibold mb-2 text-white">
            This test isn&apos;t configured with any questions yet
          </div>
          <p className="text-sm text-white/70">
            The link is valid, but no question set was found for this test. If you believe this is an error,
            please contact the organiser or MindCanvas support so they can add questions to this assessment.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-sm text-white/60 mb-2">
              Question {i + 1} / {questions.length}
              {q.category && (
                <span className="ml-2 uppercase text-[11px] px-2 py-0.5 rounded bg-white/10">
                  {q.category}
                </span>
              )}
            </div>

            <div className="text-lg font-medium mb-4 text-white">{q.text || `Question ${i + 1}`}</div>

            {isTextQuestion(q) ? (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[140px] rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Type your answer here…"
                  value={textAnswers[q.id] || ""}
                  onChange={(e) => setText(q.id, e.target.value)}
                />
              </div>
            ) : Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.options.map((label: string, idx: number) => {
                  const val = idx + 1;
                  const selected = answers[q.id] === val;

                  return (
                    <button
                      key={idx}
                      onClick={() => setChoice(q.id, val)}
                      className={[
                        "text-left px-3 py-3 rounded-xl border transition",
                        selected
                          ? "bg-white text-black border-white"
                          : "bg-white/5 border-white/20 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setChoice(q.id, val)}
                    className={[
                      "px-3 py-3 rounded-xl border transition",
                      answers[q.id] === val
                        ? "bg-white text-black border-white"
                        : "bg-white/5 border-white/20 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setI(Math.max(0, i - 1))}
              disabled={i === 0}
              className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-50 text-white"
            >
              Previous
            </button>

            {i < questions.length - 1 ? (
              <button
                onClick={() => setI(Math.min(questions.length - 1, i + 1))}
                className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white"
                disabled={!currentAnswered}
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!allAnswered || submitting}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}