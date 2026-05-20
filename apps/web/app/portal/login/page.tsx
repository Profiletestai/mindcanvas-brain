// apps/web/app/portal/login/page.tsx
"use client";

import { useState } from "react";
import { OtpInput } from "./_components/OtpInput";

function safeNextPath(input: unknown, fallback: string) {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s.startsWith("/")) return fallback;
  if (s.startsWith("//")) return fallback;
  return s;
}

type LoginResponse = {
  ok: boolean;
  error?: string;
  next?: string;
  is_superadmin?: boolean;
  org_slug?: string | null;
};

function getNextFromUrl(): string | null {
  try {
    const usp = new URLSearchParams(window.location.search || "");
    const next = usp.get("next");
    return next ? next : null;
  } catch {
    return null;
  }
}

function handleLoginResponse(json: LoginResponse) {
  const isSuper = !!json.is_superadmin;

  const nextFromUrl = getNextFromUrl();
  const nextFromServer = json?.next;

  const computedFallback = isSuper
    ? "/dashboard"
    : json?.org_slug
      ? `/portal/${json.org_slug}/dashboard`
      : "/portal";

  let target = safeNextPath(nextFromUrl || nextFromServer, computedFallback);

  if (!isSuper && (target === "/dashboard" || target.startsWith("/dashboard/"))) {
    target = computedFallback;
  }
  if (!isSuper && (target === "/admin" || target.startsWith("/admin/"))) {
    target = computedFallback;
  }
  if (isSuper && target.startsWith("/portal/") && !nextFromUrl) {
    target = "/dashboard";
  }

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
    setMode(next);
    setStep("email");
    setError(null);
    setInfo(null);
    setPassword("");
    setToken("");
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        redirect: "manual",
      });

      const ct = res.headers.get("content-type") || "";
      const json = ct.includes("application/json")
        ? ((await res.json().catch(() => null)) as LoginResponse | null)
        : null;

      if (!res.ok || !json?.ok) {
        setError(json?.error || `Login failed (HTTP ${res.status})`);
        return;
      }

      handleLoginResponse(json);
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/login/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json().catch(() => null)) as LoginResponse | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error || `Request failed (HTTP ${res.status})`);
        return;
      }
      setStep("code");
      setToken("");
      setInfo(`Code sent to ${email}`);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function onOtpEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendOtp();
  }

  async function onOtpVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/login/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const json = (await res.json().catch(() => null)) as LoginResponse | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error || `Verification failed (HTTP ${res.status})`);
        return;
      }
      handleLoginResponse(json);
    } catch (e: any) {
      setError(e?.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  const tabBtn = (active: boolean) =>
    `flex-1 py-2 text-sm rounded-md transition ${
      active
        ? "bg-white/10 text-white border border-white/25"
        : "text-white/60 hover:text-white border border-transparent"
    }`;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#0b0f16] text-white">
      <div className="w-full max-w-sm space-y-4 border border-white/15 rounded-xl p-6">
        <h1 className="text-xl font-semibold">Client Portal Login</h1>

        <div className="flex gap-2">
          <button
            type="button"
            className={tabBtn(mode === "password")}
            onClick={() => switchMode("password")}
          >
            Password
          </button>
          <button
            type="button"
            className={tabBtn(mode === "otp")}
            onClick={() => switchMode("otp")}
          >
            OTP
          </button>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {info && !error && <div className="text-green-400 text-sm">{info}</div>}

        {mode === "password" && (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                className="w-full rounded-md border border-white/20 bg-transparent p-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                className="w-full rounded-md border border-white/20 bg-transparent p-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              className="w-full rounded-md border border-white/25 py-2 hover:bg-white/5 disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {mode === "otp" && step === "email" && (
          <form onSubmit={onOtpEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                className="w-full rounded-md border border-white/20 bg-transparent p-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <button
              className="w-full rounded-md border border-white/25 py-2 hover:bg-white/5 disabled:opacity-50"
              type="submit"
              disabled={loading || !email}
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {mode === "otp" && step === "code" && (
          <form onSubmit={onOtpVerifySubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-center">
                Enter the 6-digit code
              </label>
              <OtpInput value={token} onChange={setToken} autoFocus />
            </div>

            <button
              className="w-full rounded-md border border-white/25 py-2 hover:bg-white/5 disabled:opacity-50"
              type="submit"
              disabled={loading || token.length !== 6}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>

            <div className="flex justify-between text-xs text-white/60">
              <button
                type="button"
                className="hover:text-white disabled:opacity-50"
                onClick={sendOtp}
                disabled={loading}
              >
                Resend code
              </button>
              <button
                type="button"
                className="hover:text-white"
                onClick={() => {
                  setStep("email");
                  setToken("");
                  setError(null);
                  setInfo(null);
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
