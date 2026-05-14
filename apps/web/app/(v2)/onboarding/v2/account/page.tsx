"use client";

import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { api, isErr } from "../_lib/api";
import { signupSchema } from "../_lib/schema";
import { StepCard } from "../_components/StepCard";

type SignupFormInput = z.input<typeof signupSchema>;
type SignupFormOutput = z.output<typeof signupSchema>;

const eyebrowStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "10px",
  lineHeight: "16px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "rgb(90,122,158)",
};

const inputStyle: React.CSSProperties = {
  background: "rgb(240,246,255)",
  border: "1px solid rgb(208,224,240)",
  color: "rgb(24,44,62)",
};

const inputClass =
  "w-full rounded-[10px] h-[46px] px-4 text-[14px] outline-none transition focus:bg-white";

export default function AccountPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormInput, unknown, SignupFormOutput>({
    resolver: zodResolver(signupSchema) as unknown as Resolver<
      SignupFormInput,
      unknown,
      SignupFormOutput
    >,
    defaultValues: { first_name: "", last_name: "", email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    const res = await api.signup(values);
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    sessionStorage.setItem("onb_email", values.email);
    sessionStorage.setItem("onb_first_name", values.first_name);
    sessionStorage.setItem("onb_last_name", values.last_name);
    router.push("/onboarding/v2/verify");
  });

  const firstFieldError =
    errors.first_name?.message ??
    errors.last_name?.message ??
    errors.email?.message;
  const errMsg = firstFieldError ?? errors.root?.message;

  return (
    <StepCard
      title={
        <>
          Create your <span style={{ color: "rgb(84, 175, 224)" }}>account</span>
        </>
      }
      subtitle="Let's get your organisation set up."
    >
      <form
        onSubmit={onSubmit}
        className="mt-6 mx-auto w-full max-w-[480px] rounded-[14px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "42px 24px 24px 24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              First name
            </label>
            <input
              type="text"
              placeholder="e.g. Jane"
              autoComplete="given-name"
              {...register("first_name")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Last name
            </label>
            <input
              type="text"
              placeholder="e.g. Smith"
              autoComplete="family-name"
              {...register("last_name")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Email
          </label>
          <input
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {errMsg && <div className="mt-4 text-sm text-rose-500">{errMsg}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`mt-6 w-full h-[52px] rounded-[12px] text-white font-bold tracking-wide ${
            isSubmitting ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            letterSpacing: "0.2px",
            boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          {isSubmitting ? "Sending…" : "Send verification code"}
        </button>

        <p
          className="mt-4 text-center"
          style={{
            fontSize: "11px",
            lineHeight: "17.6px",
            color: "rgb(90,122,158)",
          }}
        >
          We&apos;ll send a one-time verification code to your email.
        </p>
      </form>
    </StepCard>
  );
}
