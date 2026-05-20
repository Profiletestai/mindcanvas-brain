"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StepCard } from "@/app/(v2)/onboarding/v2/_components/StepCard";
import {
  subPayerSchema,
  type SubPayerInput,
  type SubPayerOutput,
} from "../_lib/schema";
import {
  loadDraft,
  clearDraft,
  getParentOrgId,
  getParentOrgSlug,
} from "../_lib/state";
import { subAccountsApi, isErr, humanError } from "../_lib/api";

const EMPTY: SubPayerInput = {
  payer_mode: undefined as unknown as "parent_paid",
  tier: 1,
};

type Option = {
  value: "parent_paid" | "self_paid";
  title: string;
  desc: string;
};

const OPTIONS: Option[] = [
  {
    value: "parent_paid",
    title: "Parent pays",
    desc: "Your organisation pays for this sub-account. Sub-account is activated immediately.",
  },
  {
    value: "self_paid",
    title: "Self-pays",
    desc: "Owner of the sub-account will connect their own billing. Sub-account starts in pending activation.",
  },
];

export default function SubPayerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubPayerInput, unknown, SubPayerOutput>({
    resolver: zodResolver(subPayerSchema) as unknown as Resolver<
      SubPayerInput,
      unknown,
      SubPayerOutput
    >,
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  const payerMode = watch("payer_mode");

  useEffect(() => {
    const draft = loadDraft();
    if (
      !draft.org_name ||
      !draft.country_code ||
      !draft.owner_first_name ||
      !draft.owner_last_name ||
      !draft.owner_email
    ) {
      router.replace("/portal/sub-accounts/new/organisation");
      return;
    }
    if (draft.payer_mode) setValue("payer_mode", draft.payer_mode);
    setReady(true);
  }, [router, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const draft = loadDraft();
    const parent_org_id = getParentOrgId();
    if (!parent_org_id) {
      setError("root", {
        message:
          "Missing parent organisation. Return to the dashboard and try again.",
      });
      return;
    }
    if (
      !draft.org_name ||
      !draft.country_code ||
      !draft.owner_first_name ||
      !draft.owner_last_name ||
      !draft.owner_email
    ) {
      setError("root", { message: "Draft is incomplete. Restart from step 1." });
      return;
    }

    const res = await subAccountsApi.create({
      parent_org_id,
      tier: 1,
      org_name: draft.org_name,
      country_code: draft.country_code,
      website: draft.website || null,
      industry: draft.industry || null,
      owner_first_name: draft.owner_first_name,
      owner_last_name: draft.owner_last_name,
      owner_email: draft.owner_email,
      owner_phone: draft.owner_phone || null,
      payer_mode: values.payer_mode,
    });

    if (isErr(res)) {
      setError("root", { message: humanError(res.error, res.field) });
      return;
    }

    const parentSlug = getParentOrgSlug();
    clearDraft();
    const dest = parentSlug
      ? `/portal/${encodeURIComponent(parentSlug)}/dashboard?created=${encodeURIComponent(res.org_slug)}`
      : `/portal/dashboard-v2?created=${encodeURIComponent(res.org_slug)}`;
    router.push(dest);
  });

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const errMsg = errors.payer_mode?.message ?? errors.root?.message;

  return (
    <StepCard
      title={
        <>
          Choose a <span style={{ color: "rgb(84, 175, 224)" }}>billing</span>{" "}
          mode
        </>
      }
      subtitle="Decide who pays for this sub-account. You can change billing later."
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
        <div className="flex flex-col gap-3">
          {OPTIONS.map((o) => {
            const selected = payerMode === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  setValue("payer_mode", o.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className="text-left rounded-[12px] px-5 py-4 transition"
                style={{
                  background: selected
                    ? "rgb(232,242,253)"
                    : "rgb(240,246,255)",
                  border: selected
                    ? "2px solid rgb(42,137,190)"
                    : "1.5px solid rgb(208,224,240)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      border: selected
                        ? "5px solid rgb(42,137,190)"
                        : "2px solid rgb(180,200,224)",
                      background: "#fff",
                    }}
                  />
                  <span
                    className="font-bold"
                    style={{ color: "rgb(24,44,62)", fontSize: "15px" }}
                  >
                    {o.title}
                  </span>
                </div>
                <p
                  className="mt-2"
                  style={{
                    color: "rgb(90,122,158)",
                    fontSize: "13px",
                    lineHeight: "20px",
                  }}
                >
                  {o.desc}
                </p>
              </button>
            );
          })}
        </div>

        {errMsg && <div className="mt-4 text-sm text-rose-500">{errMsg}</div>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/portal/sub-accounts/new/owner")}
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
            {isSubmitting ? "Creating…" : "Create sub-account"}
          </button>
        </div>
      </form>
    </StepCard>
  );
}
