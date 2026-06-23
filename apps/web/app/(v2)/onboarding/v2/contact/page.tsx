"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { PhoneField } from "../_components/PhoneField";
import { StepCard } from "../_components/StepCard";
import { api, isErr } from "../_lib/api";
import { contactSchema } from "../_lib/schema";

type ContactFormInput = z.input<typeof contactSchema>;
type ContactFormOutput = z.output<typeof contactSchema>;

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

const EMPTY: ContactFormInput = {
  contact_first_name: "",
  contact_last_name: "",
  contact_email: "",
  phone_number: "",
  support_email: "",
  notification_email: "",
};

export default function ContactPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput, unknown, ContactFormOutput>({
    resolver: zodResolver(contactSchema) as unknown as Resolver<
      ContactFormInput,
      unknown,
      ContactFormOutput
    >,
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.getOrg();
      if (cancelled) return;
      if (!isErr(res) && res.org) {
        reset({
          contact_first_name: res.org.primary_contact_first_name ?? "",
          contact_last_name: res.org.primary_contact_last_name ?? "",
          contact_email: res.org.primary_contact_email ?? "",
          phone_number: res.org.phone_number ?? "",
          support_email: res.org.support_email ?? "",
          notification_email: res.org.notification_email ?? "",
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    const res = await api.patchContact({
      ...values,
      support_email: values.support_email ?? values.contact_email,
      notification_email: values.notification_email ?? values.contact_email,
    });
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    router.push("/onboarding/v2/branding");
  });

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const errMsg =
    errors.contact_first_name?.message ??
    errors.contact_last_name?.message ??
    errors.contact_email?.message ??
    errors.phone_number?.message ??
    errors.support_email?.message ??
    errors.notification_email?.message ??
    errors.root?.message;

  return (
    <StepCard
      title={
        <>
          Primary{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>contact details</span>
        </>
      }
      subtitle="Add the main contact details for this organisation."
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
              Contact first name{" "}
              <span style={{ color: "rgb(200,60,80)" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="First name"
              {...register("contact_first_name")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Contact last name{" "}
              <span style={{ color: "rgb(200,60,80)" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Last name"
              {...register("contact_last_name")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Contact email <span style={{ color: "rgb(200,60,80)" }}>*</span>
          </label>
          <input
            type="email"
            placeholder="contact@company.com"
            {...register("contact_email")}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Phone number with country selector{" "}
            <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
          </label>
          <Controller
            control={control}
            name="phone_number"
            render={({ field }) => (
              <PhoneField
                value={(field.value as string | undefined) ?? ""}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Support email{" "}
              <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
            </label>
            <input
              type="email"
              placeholder="Defaults to contact email"
              {...register("support_email")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Notification email{" "}
              <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
            </label>
            <input
              type="email"
              placeholder="Defaults to contact email"
              {...register("notification_email")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
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
          {isSubmitting ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </StepCard>
  );
}
