"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PhoneField } from "@/app/(v2)/onboarding/v2/_components/PhoneField";
import { StepCard } from "@/app/(v2)/onboarding/v2/_components/StepCard";
import {
  subOwnerSchema,
  type SubOwnerInput,
  type SubOwnerOutput,
} from "../_lib/schema";
import { loadDraft, saveDraft } from "../_lib/state";

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
  "w-full rounded-[10px] h-[46px] px-4 text-[14px] outline-none transition focus:bg-white placeholder:text-[rgb(140,160,185)]";

const EMPTY: SubOwnerInput = {
  owner_first_name: "",
  owner_last_name: "",
  owner_email: "",
  owner_phone: "",
};

export default function SubOwnerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubOwnerInput, unknown, SubOwnerOutput>({
    resolver: zodResolver(subOwnerSchema) as unknown as Resolver<
      SubOwnerInput,
      unknown,
      SubOwnerOutput
    >,
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  useEffect(() => {
    const draft = loadDraft();
    if (!draft.org_name || !draft.country_code) {
      router.replace("/portal/sub-accounts/new/organisation");
      return;
    }
    reset({
      owner_first_name: draft.owner_first_name ?? "",
      owner_last_name: draft.owner_last_name ?? "",
      owner_email: draft.owner_email ?? "",
      owner_phone: draft.owner_phone ?? "",
    });
    setReady(true);
  }, [reset, router]);

  const onSubmit = handleSubmit((values) => {
    saveDraft({
      owner_first_name: values.owner_first_name,
      owner_last_name: values.owner_last_name,
      owner_email: values.owner_email,
      owner_phone: values.owner_phone,
    });
    router.push("/portal/sub-accounts/new/payer");
  });

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const fieldError = (msg?: string) =>
    msg ? <p className="mt-1 text-xs text-rose-500">{msg}</p> : null;

  return (
    <StepCard
      title={
        <>
          Who will <span style={{ color: "rgb(84, 175, 224)" }}>own</span> this
          sub-account?
        </>
      }
      subtitle="Stored on the relationship. The owner receives future onboarding emails."
    >
      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-[14px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "32px 24px 24px 24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              First name <span style={{ color: "rgb(200,60,80)" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Jane"
              {...register("owner_first_name")}
              className={inputClass}
              style={inputStyle}
            />
            {fieldError(errors.owner_first_name?.message)}
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Last name <span style={{ color: "rgb(200,60,80)" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Doe"
              {...register("owner_last_name")}
              className={inputClass}
              style={inputStyle}
            />
            {fieldError(errors.owner_last_name?.message)}
          </div>
        </div>

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Email <span style={{ color: "rgb(200,60,80)" }}>*</span>
          </label>
          <input
            type="email"
            placeholder="owner@example.com"
            {...register("owner_email")}
            className={inputClass}
            style={inputStyle}
          />
          {fieldError(errors.owner_email?.message)}
        </div>

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Phone <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
          </label>
          <Controller
            control={control}
            name="owner_phone"
            render={({ field }) => (
              <PhoneField
                value={(field.value as string | undefined) ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          {fieldError(errors.owner_phone?.message)}
        </div>

        {errors.root?.message && (
          <div className="mt-4 text-sm text-rose-500">
            {errors.root.message}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/portal/sub-accounts/new/organisation")}
            className="h-[52px] px-6 rounded-[12px] font-bold tracking-wide"
            style={{
              background: "rgb(240,246,255)",
              color: "rgb(24,44,62)",
              border: "1px solid rgb(208,224,240)",
              fontSize: "15px",
              letterSpacing: "0.2px",
            }}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex-1 h-[52px] rounded-[12px] text-white font-bold tracking-wide ${
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
            Continue
          </button>
        </div>
      </form>
    </StepCard>
  );
}
