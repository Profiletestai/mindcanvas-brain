"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { resetPasswordSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import { AuthShell } from "../_components/AuthShell";
import {
  AuthField,
  AuthFormCard,
  AuthSubmitButton,
  hintStyle,
  inputClass,
  inputStyle,
} from "../_components/AuthFormCard";

type ResetInput = z.input<typeof resetPasswordSchema>;
type ResetOutput = z.output<typeof resetPasswordSchema>;

const bodyStyle: React.CSSProperties = {
  color: "rgb(24,44,62)",
  fontSize: "14px",
  lineHeight: "22px",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expired, setExpired] = useState(searchParams.get("error") === "invalid");
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput, unknown, ResetOutput>({
    resolver: zodResolver(resetPasswordSchema) as unknown as Resolver<
      ResetInput,
      unknown,
      ResetOutput
    >,
    defaultValues: { password: "", confirm_password: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.replace("/portal/login"), 2000);
    return () => clearTimeout(t);
  }, [done, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await fetch("/api/portal/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (res.status === 401 || json?.error === "expired") {
        setExpired(true);
        return;
      }
      if (!res.ok || !json?.ok) {
        setError("root", {
          message:
            json?.error ||
            `Couldn't update your password (HTTP ${res.status}). Try again.`,
        });
        return;
      }
      setDone(true);
    } catch {
      setError("root", {
        message: "Couldn't reach the server. Check your connection and try again.",
      });
    }
  });

  if (expired) {
    return (
      <AuthShell title="This link has expired">
        <AuthFormCard>
          <p className="text-center" style={bodyStyle}>
            Password reset links can only be used once and expire after 1 hour.
            Request a new one and we&apos;ll email it straight over.
          </p>
          <Link
            href="/portal/forgot-password"
            className="mt-6 flex w-full h-[52px] items-center justify-center rounded-[12px] text-white font-bold tracking-wide"
            style={{
              background:
                "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
              fontSize: "15px",
              letterSpacing: "0.2px",
              boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
            }}
          >
            Request a new link
          </Link>
          <p className="mt-4 text-center" style={hintStyle}>
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

  if (done) {
    return (
      <AuthShell title="Password updated">
        <AuthFormCard>
          <p className="text-center" style={bodyStyle}>
            Your password has been changed. You can now sign in with it.
          </p>
          <Link
            href="/portal/login"
            className="mt-6 flex w-full h-[52px] items-center justify-center rounded-[12px] text-white font-bold tracking-wide"
            style={{
              background:
                "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
              fontSize: "15px",
              letterSpacing: "0.2px",
              boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
            }}
          >
            Go to login
          </Link>
          <p className="mt-4 text-center" style={hintStyle}>
            Taking you there automatically…
          </p>
        </AuthFormCard>
      </AuthShell>
    );
  }

  const errMsg =
    errors.password?.message ??
    errors.confirm_password?.message ??
    errors.root?.message;

  return (
    <AuthShell
      title={
        <>
          Create new{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>password</span>
        </>
      }
      subtitle="Choose a password you haven't used before."
    >
      <AuthFormCard onSubmit={onSubmit}>
        <AuthField label="New password">
          <input
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("password")}
            className={inputClass}
            style={inputStyle}
          />
        </AuthField>

        <p className="mt-1.5" style={hintStyle}>
          At least 8 characters, with an uppercase letter, a lowercase letter and
          a number.
        </p>

        <div className="mt-5">
          <AuthField label="Confirm password">
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("confirm_password")}
              className={inputClass}
              style={inputStyle}
            />
          </AuthField>
        </div>

        {errMsg && <div className="mt-4 text-sm text-rose-500">{errMsg}</div>}

        <AuthSubmitButton disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save password"}
        </AuthSubmitButton>
      </AuthFormCard>
    </AuthShell>
  );
}
