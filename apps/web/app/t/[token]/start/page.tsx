//apps/web/app/t/[token]/start/page.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Meta = {
  org_name?: string | null;
  test_name?: string | null;
  intro_text?: string | null; // optional AI briefing
};

export default function Start({ params }: { params: { token: string } }) {
  const { token } = params;

  // --- optional meta (org/test/intro) ---
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      // Graceful: if this endpoint doesn't exist, we just fall back to defaults.
      try {
        const r = await fetch(`/api/public/test/${token}/meta`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        setMeta({
          org_name: j?.org_name ?? j?.org?.name ?? null,
          test_name: j?.test_name ?? j?.test?.name ?? null,
          intro_text: j?.intro_text ?? j?.test_link?.intro_text ?? j?.test?.intro_text ?? null,
        });
      } catch {
        // ignore
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [token]);

  const orgName = meta?.org_name || "Profiletest.ai";
  const testTitle = meta?.test_name || "Quantum Source Code Entrepreneur";

  // --- form state ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [company, setCompany] = useState("");
  const [roleDept, setRoleDept] = useState("");

  const [dataConsent, setDataConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const requiredOk =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      mobile.trim().length > 0 &&
      dataConsent;

    return requiredOk && !submitting;
  }, [firstName, lastName, email, mobile, dataConsent, submitting]);

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    // Simple front-end validation (backend should validate too)
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !mobile.trim()) {
      setMsg("Please complete all required fields before starting.");
      return;
    }
    if (!dataConsent) {
      setMsg("Please confirm that you agree to the use of your data before starting.");
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      const r = await fetch(`/api/public/test/${token}/start`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataConsent: true,

          // These may be ignored by the backend today,
          // but including them enables the desired intake fields.
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: mobile.trim(),
          company: company.trim() || null,
          role_department: roleDept.trim() || null,
        }),
      });

      const j = await r.json();

      if (!r.ok) {
        setMsg(j?.error || `Failed (${r.status})`);
        setSubmitting(false);
        return;
      }

      // Preserve existing behaviour: use j.next if present, else fallback
      const nextUrl = j?.next || `/t/${token}`;
      window.location.href = nextUrl;
    } catch (e: any) {
      setMsg(e?.message || "Network error");
      setSubmitting(false);
    }
  };

  const isError = !!msg;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* MindCanvas-like background */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-10%,#12344c_0%,#08121b_55%,#060e16_100%)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-48 -left-48 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* Top banner */}
      <div className="w-full bg-sky-500/90">
        <div className="mx-auto max-w-6xl px-6 py-7">
          <div className="text-[11px] tracking-[0.22em] text-white/80 uppercase">
            Signature Profiling System
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
            {orgName} — {testTitle}
          </div>
          <div className="mt-2 text-sm text-white/90 max-w-3xl">
            Answer each question honestly and instinctively. Your responses will be used to generate your
            personalised report and insights for your organisation.
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left content */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="text-white/90 text-sm font-medium">
                {orgName} invites you to complete this assessment
              </div>

              <h2 className="mt-3 text-2xl font-semibold text-white">{testTitle}</h2>

              <div className="mt-6">
                <div className="text-sm font-semibold text-white/90">Introduction To {testTitle}</div>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {meta?.intro_text?.trim()
                    ? meta.intro_text
                    : "This assessment helps you understand your entrepreneurial operating style and how it shows up in decision-making, leadership, risk-taking, and execution. You’ll receive a clear profile summary and practical insights you can apply immediately."}
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white/90">Instructions</div>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Please answer each question honestly and instinctively. There are no right or wrong answers.
                  Your results are based on patterns across your responses.
                </p>
                <p className="mt-3 text-sm text-white/75">Enjoy this experience with {orgName}.</p>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="text-white text-lg font-semibold">Before we start, tell us about you</div>
                <div className="mt-2 text-sm text-white/70">
                  Your details help us personalise your report.
                </div>
                <div className="mt-3 text-xs text-white/60">
                  Token: <span className="font-mono">{token}</span>
                </div>
              </div>

              <form onSubmit={handleStart} className="p-6 space-y-6">
                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      First name <span className="text-red-300">*</span>
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="First name"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      Last name <span className="text-red-300">*</span>
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="Last name"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-white/80">
                    Email <span className="text-red-300">*</span>
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-xs font-medium text-white/80">
                    Mobile <span className="text-red-300">*</span>
                  </label>
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                    placeholder="e.g. +27 82 123 4567"
                    autoComplete="tel"
                  />
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      Organisation <span className="text-white/50">(optional)</span>
                    </label>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="Company"
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      Role / Department <span className="text-white/50">(optional)</span>
                    </label>
                    <input
                      value={roleDept}
                      onChange={(e) => setRoleDept(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="Role / Department"
                      autoComplete="organization-title"
                    />
                  </div>
                </div>

                {/* Consent */}
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                      checked={dataConsent}
                      onChange={(e) => {
                        setDataConsent(e.target.checked);
                        if (e.target.checked && msg) setMsg(null);
                      }}
                    />
                    <span className="text-sm text-white/85">
                      I agree that my responses can be used to build my profile and report.
                    </span>
                  </label>

                  <p className="mt-3 text-xs text-white/60">
                    By submitting this assessment, you have read and agree to our{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 text-white/80 hover:text-white"
                    >
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 text-white/80 hover:text-white"
                    >
                      Terms &amp; Conditions
                    </a>
                    .
                  </p>
                </div>

                {/* Message */}
                {msg && (
                  <p className={`text-sm ${isError ? "text-red-300" : "text-white/70"}`}>
                    {msg}
                  </p>
                )}

                {/* CTA */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold border transition
                    ${
                      !canSubmit
                        ? "bg-white/10 text-white/40 border-white/10 cursor-not-allowed"
                        : "bg-white text-slate-900 border-white hover:bg-white/90"
                    }`}
                >
                  {submitting ? "Starting…" : "Start This Assessment 👉"}
                </button>

                {/* Powered by */}
                <div className="pt-2 text-center text-xs text-white/50">
                  powered by <span className="text-white/65">profiletest.ai</span>
                </div>
              </form>
            </div>

            {/* small note */}
            <div className="mt-4 text-xs text-white/45">
              If you have any issues accessing this assessment, please contact your administrator.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}