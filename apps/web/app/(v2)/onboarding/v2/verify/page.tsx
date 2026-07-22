"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { OtpInput } from "../_components/OtpInput";
import { StepCard } from "../_components/StepCard";
import { api, isErr } from "../_lib/api";
import { PLAN_PATH } from "../_lib/progress";
import { verifyOtpSchema } from "../_lib/schema";

type VerifyFormInput = z.input<typeof verifyOtpSchema>;
type VerifyFormOutput = z.output<typeof verifyOtpSchema>;

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VerifyFormInput, unknown, VerifyFormOutput>({
    resolver: zodResolver(verifyOtpSchema) as unknown as Resolver<
      VerifyFormInput,
      unknown,
      VerifyFormOutput
    >,
    defaultValues: { email: "", token: "" },
    mode: "onSubmit",
  });

  const token = watch("token") ?? "";

  useEffect(() => {
    const e = sessionStorage.getItem("onb_email");
    if (!e) {
      router.replace("/onboarding/v2/account");
      return;
    }
    setEmail(e);
    setValue("email", e);
  }, [router, setValue]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const onSubmit = handleSubmit(async (values) => {
    const res = await api.verifyOtp(values);
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    router.push(PLAN_PATH);
  });

  const onResend = async () => {
    if (!email || resendIn > 0 || resending) return;
    const first = sessionStorage.getItem("onb_first_name") || "";
    const last = sessionStorage.getItem("onb_last_name") || "";
    if (!first || !last) {
      router.replace("/onboarding/v2/account");
      return;
    }
    setResending(true);
    setResendIn(30);
    const res = await api.signup({
      first_name: first,
      last_name: last,
      email,
      terms_accepted: true,
      privacy_accepted: true,
    });
    setResending(false);
    if (isErr(res)) {
      setResendIn(0);
      setError("root", { message: res.error });
    }
  };

  if (!email) return null;

  const errMsg = errors.token?.message ?? errors.root?.message;
  const canSubmit = token.length === 6 && !isSubmitting;

  return (
    <StepCard
      title={
        <>
          Verify your <span style={{ color: "rgb(84, 175, 224)" }}>email</span>
        </>
      }
      subtitle="Enter the 6-digit code we sent to your email address."
    >
      <form
        onSubmit={onSubmit}
        className="mt-6 mx-auto w-full max-w-[480px] rounded-[14px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "32px 24px 24px 24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <Controller
          control={control}
          name="token"
          render={({ field }) => (
            <OtpInput value={field.value} onChange={field.onChange} autoFocus />
          )}
        />

        {errMsg && (
          <div className="mt-4 text-sm text-rose-500 text-center">{errMsg}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`mt-6 w-full h-[52px] rounded-[12px] text-white font-bold tracking-wide ${
            canSubmit ? "cursor-pointer" : "cursor-not-allowed opacity-40"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            letterSpacing: "0.2px",
            boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          {isSubmitting ? "Verifying…" : "Verify and continue"}
        </button>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onResend}
            disabled={resendIn > 0 || resending}
            className="font-semibold disabled:opacity-50"
            style={{
              color: "rgb(90,122,158)",
              fontSize: "13px",
            }}
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </form>
    </StepCard>
  );
}
