"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { emailSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import { AuthShell } from "../_components/AuthShell";
import {
  AuthField,
  AuthFormCard,
  AuthSubmitButton,
  hintStyle,
  inputClass,
  inputStyle,
} from "../_components/AuthFormCard";

const forgotSchema = z.object({ email: emailSchema });
type ForgotInput = z.input<typeof forgotSchema>;
type ForgotOutput = z.output<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput, unknown, ForgotOutput>({
    resolver: zodResolver(forgotSchema) as unknown as Resolver<
      ForgotInput,
      unknown,
      ForgotOutput
    >,
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await fetch("/api/portal/password/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        setError("root", {
          message:
            json?.error || `Something went wrong (HTTP ${res.status}). Try again.`,
        });
        return;
      }
      setSent(true);
    } catch {
      setError("root", {
        message: "Couldn't reach the server. Check your connection and try again.",
      });
    }
  });

  const errMsg = errors.email?.message ?? errors.root?.message;

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <AuthFormCard>
          <p
            className="text-center"
            style={{ color: "rgb(24,44,62)", fontSize: "14px", lineHeight: "22px" }}
          >
            If an account exists for this email address, we&apos;ve sent you a
            password reset link.
          </p>
          <p className="mt-4 text-center" style={hintStyle}>
            The link expires in 1 hour. Check your spam folder if it doesn&apos;t
            arrive.
          </p>
          <div className="mt-6 text-center">
            <Link
              href="/portal/login"
              className="underline"
              style={{ color: "rgb(42,137,190)", fontSize: "14px" }}
            >
              Back to login
            </Link>
          </div>
        </AuthFormCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={
        <>
          Forgot your{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>password</span>?
        </>
      }
      subtitle="Enter your email and we'll send you a reset link."
    >
      <AuthFormCard onSubmit={onSubmit}>
        <AuthField label="Email">
          <input
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
            className={inputClass}
            style={inputStyle}
          />
        </AuthField>

        {errMsg && <div className="mt-4 text-sm text-rose-500">{errMsg}</div>}

        <AuthSubmitButton disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </AuthSubmitButton>

        <p className="mt-4 text-center" style={hintStyle}>
          Remembered it?{" "}
          <Link
            href="/portal/login"
            className="underline"
            style={{ color: "rgb(42,137,190)" }}
          >
            Back to login
          </Link>
        </p>
      </AuthFormCard>
    </AuthShell>
  );
}
