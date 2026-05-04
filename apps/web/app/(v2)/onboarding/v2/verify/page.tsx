"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "../_components/OtpInput";
import { api, isErr } from "../_lib/api";

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    const e = sessionStorage.getItem("onb_email");
    if (!e) {
      router.replace("/onboarding/v2/account");
      return;
    }
    setEmail(e);
  }, [router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email || token.length !== 6) {
      setErr("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    const res = await api.verifyOtp({ email, token });
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    router.push("/onboarding/v2/organisation");
  };

  const onResend = async () => {
    if (!email || resendIn > 0) return;
    setErr(null);
    const first = sessionStorage.getItem("onb_first_name") || "";
    const last = sessionStorage.getItem("onb_last_name") || "";
    if (!first || !last) {
      router.replace("/onboarding/v2/account");
      return;
    }
    setResendIn(30);
    const res = await api.signup({ first_name: first, last_name: last, email });
    if (isErr(res)) {
      setErr(res.error);
      setResendIn(0);
    }
  };

  if (!email) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-center">Verify your email</h1>
      <p className="mt-2 text-center text-sm text-white/70">
        Enter the 6-digit code we sent to <span className="text-white">{email}</span>.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <OtpInput value={token} onChange={setToken} autoFocus />

        {err && <div className="text-sm text-rose-400 text-center">{err}</div>}

        <Button type="submit" disabled={busy || token.length !== 6} className="w-full">
          {busy ? "Verifying…" : "Verify and continue"}
        </Button>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={onResend}
            disabled={resendIn > 0}
            className="text-white/70 hover:text-white disabled:opacity-50"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </form>
    </div>
  );
}
