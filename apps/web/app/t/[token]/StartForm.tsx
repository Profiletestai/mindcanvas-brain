// apps/web/app/t/[token]/StartForm.tsx
"use client";

import * as React from "react";

type Meta = {
  org_name?: string | null;
  test_name?: string | null;
  intro_text?: string | null;
};

export default function StartForm({ token }: { token: string }) {
  // Optional meta (won't break if endpoint doesn't exist)
  const [meta, setMeta] = React.useState<Meta | null>(null);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const r = await fetch(`/api/public/test/${token}/meta`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        setMeta({
          org_name: j?.org_name ?? j?.org?.name ?? null,
          test_name: j?.test_name ?? j?.test?.name ?? null,
          intro_text:
            j?.intro_text ??
            j?.test_link?.intro_text ??
            j?.test?.intro_text ??
            null,
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

  // Form state
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [roleDept, setRoleDept] = React.useState("");

  const [dataConsent, setDataConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  function validate(): string | null {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const mb = mobile.trim();

    if (!fn || !ln || !em || !mb) {
      return "Please complete all required fields before starting.";
    }

    // simple email check – enough to catch obvious mistakes
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(em)) {
      return "Please enter a valid email address.";
    }

    if (!dataConsent) {
      return "Please confirm that you agree to the use of your data before starting.";
    }

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    setBusy(true);
    setErr(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim().toLowerCase();
    const mb = mobile.trim();
    const co = company.trim();
    const rd = roleDept.trim();

    try {
      const res = await fetch(`/api/public/test/${token}/start`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataConsent: true,
          firstName: fn,
          lastName: ln,
          email: em,
          phone: mb,
          company: co || null,
          role_department: rd || null,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const nextUrl = data?.next || `/t/${token}`;
      window.location.href = nextUrl;
    } catch (e: any) {
      setErr(e?.message || "Failed to start");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    mobile.trim().length > 0 &&
    dataConsent;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* MindCanvas-style background */}
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
            Signature Profiling System-Start Form
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
          {/* Left: intro */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="text-white/90 text-sm font-medium">
                {orgName} invites you to complete this assessment
              </div>

              <h2 className="mt-3 text-2xl font-semibold text-white">{testTitle}</h2>

              <div className="mt-6">
                <div className="text-sm font-semibold text-white/90">
                  Introduction To {testTitle}
                </div>
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
                <div className="mt-2 text-sm text-white/70">Your details help us personalise your report.</div>
                <div className="mt-3 text-xs text-white/60">
                  Token: <span className="font-mono">{token}</span>
                </div>
              </div>

              <form onSubmit={onSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      First name <span className="text-red-300">*</span>
                    </label>
                    <input
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      Last name <span className="text-red-300">*</span>
                    </label>
                    <input
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80">
                    Email <span className="text-red-300">*</span>
                  </label>
                  <input
                    type="email"
                    className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80">
                    Mobile <span className="text-red-300">*</span>
                  </label>
                  <input
                    className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                    placeholder="e.g. +27 82 123 4567"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    autoComplete="tel"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      Organisation <span className="text-white/50">(optional)</span>
                    </label>
                    <input
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="Company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80">
                      Role / Department <span className="text-white/50">(optional)</span>
                    </label>
                    <input
                      className="mt-2 w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-sky-300"
                      placeholder="Role / Department"
                      value={roleDept}
                      onChange={(e) => setRoleDept(e.target.value)}
                      autoComplete="organization-title"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                      checked={dataConsent}
                      onChange={(e) => {
                        setDataConsent(e.target.checked);
                        if (e.target.checked && err) setErr(null);
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
                      href="https://profiletest.ai/terms-and-conditions"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 text-white/80 hover:text-white"
                    >
                      Terms &amp; Conditions
                    </a>
                    .
                  </p>
                </div>

                {err && <div className="text-red-300 text-sm">{err}</div>}

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
                  {busy ? "Starting…" : "Start This Assessment 👉"}
                </button>

                <div className="pt-2 text-center text-xs text-white/50">
                  powered by <span className="text-white/65">profiletest.ai</span>
                </div>
              </form>
            </div>

            <div className="mt-4 text-xs text-white/45">
              If you have any issues accessing this assessment, please contact your administrator.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}