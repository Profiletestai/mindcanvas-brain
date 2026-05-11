"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { api, isErr } from "../_lib/api";
import { orgSchema } from "../_lib/schema";
import { StepCard } from "../_components/StepCard";

type OrgFormInput = z.input<typeof orgSchema>;
type OrgFormOutput = z.output<typeof orgSchema>;

countries.registerLocale(enLocale);

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

const EMPTY: OrgFormInput = {
  name: "",
  country: "",
  address: "",
  website_url: "",
  industry: "",
  logo_url: "",
};

export default function OrganisationPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrgFormInput, unknown, OrgFormOutput>({
    resolver: zodResolver(orgSchema),
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  const logoUrl = (watch("logo_url") as string | undefined) ?? "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.getOrg();
      if (cancelled) return;
      if (!isErr(res) && res.org) {
        reset({
          name: res.org.name ?? "",
          country: res.org.country ?? "",
          address: res.org.address ?? "",
          website_url: res.org.website_url ?? "",
          industry: res.org.industry ?? "",
          logo_url: res.org.logo_url ?? "",
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const countryOptions = useMemo(() => {
    const all = countries.getNames("en", { select: "official" }) as Record<
      string,
      string
    >;
    return Object.entries(all)
      .map(([code, n]) => ({ code, name: n }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    const res = await api.uploadLogo(file);
    setUploading(false);
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    setValue("logo_url", res.url, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    const res = await api.createOrg(values);
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    router.push("/onboarding/v2/contact");
  });

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const errMsg =
    errors.name?.message ??
    errors.country?.message ??
    errors.address?.message ??
    errors.website_url?.message ??
    errors.industry?.message ??
    errors.logo_url?.message ??
    errors.root?.message;

  return (
    <StepCard
      title={
        <>
          Tell us about your{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>organisation</span>
        </>
      }
      subtitle="Add the core details for your main organisation."
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-[12px] flex flex-col items-center justify-center transition hover:bg-[rgb(232,240,252)]"
          style={{
            background: "rgb(240,246,255)",
            border: "1.5px dashed rgb(180,204,232)",
            padding: "26px 16px",
            minHeight: "132px",
          }}
        >
          {logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="logo"
                className="h-16 w-16 object-cover rounded-md"
              />
              <span
                className="mt-2"
                style={{ fontSize: "12px", color: "rgb(90,122,158)" }}
              >
                Replace logo
              </span>
            </>
          ) : (
            <>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M3 16.5V5.5C3 4.67 3.67 4 4.5 4h15c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-15C3.67 20 3 19.33 3 18.5"
                  stroke="rgb(24,44,62)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m3.5 17 4.5-4.5 4 4 3.5-3.5 5 5"
                  stroke="rgb(24,44,62)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="mt-2 font-bold"
                style={{ fontSize: "14px", color: "rgb(24,44,62)" }}
              >
                {uploading ? "Uploading…" : "Upload logo"}
              </span>
              <span
                className="mt-1"
                style={{ fontSize: "12px", color: "rgb(120,144,176)" }}
              >
                PNG, JPG or SVG · Max 2MB
              </span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {logoUrl && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() =>
                setValue("logo_url", "", { shouldDirty: true })
              }
              className="text-[12px] font-semibold"
              style={{ color: "rgb(200,60,80)" }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Organisation name <span style={{ color: "rgb(200,60,80)" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Your organisation name"
            {...register("name")}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Address <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Street address"
              {...register("address")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Country <span style={{ color: "rgb(200,60,80)" }}>*</span>
            </label>
            <select
              {...register("country")}
              className={inputClass + " appearance-none pr-9"}
              style={{
                ...inputStyle,
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4.5l4 4 4-4' stroke='%235A7A9E' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
              }}
            >
              <option value="">Select country</option>
              {countryOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Website <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://"
              {...register("website_url")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Industry <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Select industry"
              {...register("industry")}
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
