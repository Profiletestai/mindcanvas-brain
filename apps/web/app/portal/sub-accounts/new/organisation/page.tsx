"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { StepCard } from "@/app/(v2)/onboarding/v2/_components/StepCard";
import { subOrgSchema, type SubOrgInput, type SubOrgOutput } from "../_lib/schema";
import {
  loadDraft,
  saveDraft,
  setParentOrgIdFromQuery,
  getParentOrgId,
} from "../_lib/state";

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

const EMPTY: SubOrgInput = {
  org_name: "",
  country_code: "",
  website: "",
  industry: "",
};

function SubOrganisationForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  const [missingParent, setMissingParent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubOrgInput, unknown, SubOrgOutput>({
    resolver: zodResolver(subOrgSchema) as unknown as Resolver<
      SubOrgInput,
      unknown,
      SubOrgOutput
    >,
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  useEffect(() => {
    setParentOrgIdFromQuery(sp);
    const draft = loadDraft();
    reset({
      org_name: draft.org_name ?? "",
      country_code: draft.country_code ?? "",
      website: draft.website ?? "",
      industry: draft.industry ?? "",
    });
    if (!getParentOrgId()) setMissingParent(true);
    setReady(true);
  }, [reset, sp]);

  const countryOptions = useMemo(() => {
    const all = countries.getNames("en", { select: "official" }) as Record<
      string,
      string
    >;
    return Object.entries(all)
      .map(([code, n]) => ({ code, name: n }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const onSubmit = handleSubmit((values) => {
    if (!getParentOrgId()) {
      setError("root", {
        message: "Missing parent organisation. Open this flow from your dashboard.",
      });
      return;
    }
    saveDraft({
      org_name: values.org_name,
      country_code: values.country_code,
      website: values.website,
      industry: values.industry,
    });
    router.push("/portal/sub-accounts/new/owner");
  });

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const errMsg =
    errors.org_name?.message ??
    errors.country_code?.message ??
    errors.website?.message ??
    errors.industry?.message ??
    errors.root?.message;

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Tell us about the{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>sub-organisation</span>
        </>
      }
      subtitle="Add the core details for the new licensee organisation."
    >
      {missingParent && (
        <div
          className="mt-4 rounded-[10px] px-4 py-3 text-sm"
          style={{
            background: "rgba(220,60,80,0.12)",
            border: "1px solid rgba(220,60,80,0.4)",
            color: "rgb(255, 210, 215)",
          }}
        >
          Missing parent organisation. Return to the{" "}
          <a className="underline" href="/portal/dashboard-v2">
            dashboard
          </a>{" "}
          and click “Create sub-account”.
        </div>
      )}

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
        <div>
          <label className="block mb-1.5" style={eyebrowStyle}>
            Organisation name <span style={{ color: "rgb(200,60,80)" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Sub-organisation name"
            {...register("org_name")}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="mt-5">
          <label className="block mb-1.5" style={eyebrowStyle}>
            Country <span style={{ color: "rgb(200,60,80)" }}>*</span>
          </label>
          <select
            {...register("country_code")}
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

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Website{" "}
              <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://"
              {...register("website")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={eyebrowStyle}>
              Industry{" "}
              <span style={{ color: "rgb(140,160,185)" }}>(optional)</span>
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
          Save and continue
        </button>
      </form>
    </StepCard>
  );
}

export default function SubOrganisationPage() {
  return (
    <Suspense
      fallback={<div className="py-8 text-center text-white/70">Loading…</div>}
    >
      <SubOrganisationForm />
    </Suspense>
  );
}
