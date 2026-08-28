"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicPageShell } from "@/components/public/ProfiletestChrome";
import { OtpInput } from "./_components/OtpInput";

function safeNextPath(input: unknown, fallback: string) {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

type LoginResponse = { ok: boolean; error?: string; next?: string; is_superadmin?: boolean; org_slug?: string | null };

function getNextFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search || "").get("next");
  } catch {
    return null;
  }
}

function handleLoginResponse(json: LoginResponse) {
  const isSuper = Boolean(json.is_superadmin);
  const nextFromUrl = getNextFromUrl();
  const fallback = isSuper ? "/dashboard" : json.org_slug ? `/portal/${json.org_slug}/dashboard` : "/portal";

  try { sessionStorage.setItem("mc_just_logged_in", "1"); } catch {}

  let target = safeNextPath(nextFromUrl || json.next, fallback);
  if (!isSuper && (target === "/dashboard" || target.startsWith("/dashboard/"))) target = fallback;
  if (!isSuper && (target === "/admin" || target.startsWith("/admin/"))) target = fallback;
  if (isSuper && target.startsWith("/portal/") && !nextFromUrl) target = "/dashboard";
  window.location.href = target;
}

type Mode = "password" | "otp";
type Step = "email" | "code";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next); setStep("email"); setError(null); setInfo(null); setPassword(""); setToken("");
  }

  async function onPasswordSubmit(event: React.FormEvent) {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      const response = await fetch("/api/portal/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }), redirect: "manual" });
      const contentType = response.headers.get("content-type") || "";
      const json = contentType.includes("application/json") ? ((await response.json().catch(() => null)) as LoginResponse | null) : null;
      if (!response.ok || !json?.ok) { setError(json?.error || `Login failed (HTTP ${response.status})`); return; }
      handleLoginResponse(json);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally { setLoading(false); }
  }

  async function sendOtp() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const response = await fetch("/api/portal/login/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const json = (await response.json().catch(() => null)) as LoginResponse | null;
      if (!response.ok || !json?.ok) { setError(json?.error || `Request failed (HTTP ${response.status})`); return; }
      setStep("code"); setToken(""); setInfo(`Code sent to ${email}`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally { setLoading(false); }
  }

  async function onOtpVerifySubmit(event: React.FormEvent) {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      const response = await fetch("/api/portal/login/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, token }) });
      const json = (await response.json().catch(() => null)) as LoginResponse | null;
      if (!response.ok || !json?.ok) { setError(json?.error || `Verification failed (HTTP ${response.status})`); return; }
      handleLoginResponse(json);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Verification failed");
    } finally { setLoading(false); }
  }

  const inputClass = "mt-2 h-[46px] w-full rounded-[8px] border border-[#2a3544] bg-[#101925] px-4 text-[14.5px] text-[#F2F5F8] outline-none transition placeholder:text-[#6B7686] focus:border-[#4FA8D8] focus:ring-2 focus:ring-[#4FA8D8]/15";
  const buttonClass = "h-[50px] w-full rounded-[8px] bg-gradient-to-r from-[#2877ad] to-[#3a9bd0] text-[15px] font-bold text-white shadow-[0_8px_22px_rgba(42,139,193,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55 [font-family:var(--font-dm-sans)]";

  return (
    <PublicPageShell compactHeader>
      <section className="relative flex flex-1 items-center bg-[radial-gradient(circle_at_50%_20%,rgba(20,58,83,0.2),transparent_44%),linear-gradient(135deg,#040b13,#06101b_55%,#030810)] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/" className="inline-flex items-center gap-2 text-[13.5px] text-[#6B7686] transition hover:text-[#9AA7BA]"><span aria-hidden>←</span> Back to Profiletest.ai</Link>
          <h1 className="mt-8 text-[30px] font-extrabold text-[#F2F5F8]">Welcome back</h1>
          <p className="mt-2 text-[14.5px] leading-[22.5px] text-[#9AA7BA]">Log in to access your dashboard, test links, reports<br className="hidden sm:block" /> and Insider Insights.</p>

          <div className="mt-7 grid grid-cols-2 rounded-[9px] border border-[#263242] bg-[#101824] p-1">
            <button type="button" onClick={() => switchMode("password")} className={`h-10 rounded-[7px] text-[13.5px] font-semibold transition ${mode === "password" ? "border border-[#326d91] bg-[#19344a] text-[#F2F5F8]" : "text-[#9AA7BA] hover:text-white"}`}>Password</button>
            <button type="button" onClick={() => switchMode("otp")} className={`h-10 rounded-[7px] text-[13.5px] font-semibold transition ${mode === "otp" ? "border border-[#326d91] bg-[#19344a] text-[#F2F5F8]" : "text-[#9AA7BA] hover:text-white"}`}>Email code</button>
          </div>

          {error ? <div role="alert" className="mt-4 rounded-[8px] border border-red-400/35 bg-red-400/10 px-3 py-2.5 text-[13px] text-red-300">{error}</div> : null}
          {info && !error ? <div className="mt-4 rounded-[8px] border border-[#5FE3B3]/30 bg-[#5FE3B3]/10 px-3 py-2.5 text-[13px] text-[#5FE3B3]">✓&nbsp; {info}</div> : null}

          {mode === "password" ? (
            <form onSubmit={onPasswordSubmit} className="mt-7 space-y-5">
              <label className="block text-[12.5px] font-semibold tracking-[0.01em] text-[#9AA7BA]">Email address<input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} placeholder="you@company.com" autoComplete="email" required /></label>
              <label className="block text-[12.5px] font-semibold tracking-[0.01em] text-[#9AA7BA]"><span className="flex items-center justify-between"><span>Password</span><Link href="/portal/forgot-password" className="text-[#4FA8D8] transition hover:text-[#73bce3]">Forgot password?</Link></span><input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} placeholder="••••••••" autoComplete="current-password" required /></label>
              <button className={buttonClass} type="submit" disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
            </form>
          ) : null}

          {mode === "otp" && step === "email" ? (
            <form onSubmit={(event) => { event.preventDefault(); void sendOtp(); }} className="mt-7 space-y-5">
              <label className="block text-[12.5px] font-semibold tracking-[0.01em] text-[#9AA7BA]">Email address<input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} placeholder="you@company.com" autoComplete="email" required /></label>
              <button className={buttonClass} type="submit" disabled={loading || !email}>{loading ? "Sending…" : "Send email code"}</button>
            </form>
          ) : null}

          {mode === "otp" && step === "code" ? (
            <form onSubmit={onOtpVerifySubmit} className="mt-5 space-y-5">
              <div><p className="mb-3 text-[12.5px] font-semibold text-[#9AA7BA]">Enter the code we sent to your email.</p><OtpInput value={token} onChange={setToken} autoFocus /></div>
              <div className="text-right"><button type="button" onClick={() => void sendOtp()} disabled={loading} className="text-[12.5px] font-semibold text-[#4FA8D8] transition hover:text-[#73bce3] disabled:opacity-50">Resend code</button></div>
              <button className={buttonClass} type="submit" disabled={loading || token.length !== 6}>{loading ? "Verifying…" : "Continue"}</button>
              <button type="button" onClick={() => { setStep("email"); setToken(""); setError(null); setInfo(null); }} className="w-full text-center text-[12.5px] text-[#6B7686] transition hover:text-white">Use a different email</button>
            </form>
          ) : null}

          <p className="mt-6 text-center text-[13.5px] text-[#6B7686]">New to Profiletest.ai? <Link href="/onboarding/v2" className="font-semibold text-[#4FA8D8] underline underline-offset-2">Start with 3 free tests.</Link></p>
        </div>
      </section>
    </PublicPageShell>
  );
}
