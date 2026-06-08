"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, isErr } from "../_lib/api";
import { planSchema } from "../_lib/schema";
import { StepCard } from "../_components/StepCard";

export type PlanRow = {
  tier: number;
  name: string;
  tagline: string;
  features: string[];
  priceLabel: string;
};

type PlanFormValues = {
  tier: number;
  terms_accepted: boolean;
  privacy_accepted: boolean;
};

function parseTier(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : undefined;
}

export function PlanFormClient({ plans }: { plans?: PlanRow[] }) {
  const router = useRouter();
  const safePlans: PlanRow[] = Array.isArray(plans) ? plans : [];
  const hasPlans = safePlans.length > 0;
  const defaultTier = hasPlans ? safePlans[0].tier : 1;

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema) as unknown as Resolver<PlanFormValues>,
    defaultValues: { tier: defaultTier, terms_accepted: false, privacy_accepted: false },
    mode: "onSubmit",
  });

  const terms = watch("terms_accepted");
  const privacy = watch("privacy_accepted");

  useEffect(() => {
    const storedTier =
      typeof window !== "undefined"
        ? parseTier(sessionStorage.getItem("onb_tier"))
        : undefined;
    if (storedTier !== undefined && safePlans.some((p) => p.tier === storedTier)) {
      setValue("tier", storedTier);
    }

    let cancelled = false;
    (async () => {
      const orgRes = await api.getOrg();
      if (cancelled) return;
      if (!isErr(orgRes) && orgRes.org) {
        if (orgRes.org.terms_accepted_at) setValue("terms_accepted", true);
        if (orgRes.org.privacy_accepted_at) setValue("privacy_accepted", true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setValue, safePlans]);

  const onSubmit = handleSubmit(async (values) => {
    const res = await api.patchPlan({
      tier: values.tier,
      terms_accepted: true,
      privacy_accepted: true,
    });
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    sessionStorage.setItem("onb_tier", String(values.tier));
    router.push("/onboarding/v2/branding");
  });

  const errMsg =
    errors.tier?.message ??
    errors.terms_accepted?.message ??
    errors.privacy_accepted?.message ??
    errors.root?.message;

  const canSubmit = hasPlans && terms && privacy && !isSubmitting;

  return (
    <StepCard
      title={
        <>
          Choose your{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>starting plan</span>
        </>
      }
      subtitle="Select the plan you want this organisation to start with."
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
        {hasPlans ? (
          <Controller
            control={control}
            name="tier"
            render={({ field }) => (
              <div className="space-y-3">
                {safePlans.map((p) => (
                  <PlanRowButton
                    key={p.tier}
                    plan={p}
                    selected={field.value === p.tier}
                    onSelect={() => field.onChange(p.tier)}
                  />
                ))}
              </div>
            )}
          />
        ) : (
          <div
            className="rounded-[12px]"
            style={{
              background: "rgb(255,236,238)",
              color: "rgb(176,40,68)",
              border: "1px solid rgb(214,62,90)",
              padding: "14px 16px",
              fontSize: "13px",
            }}
          >
            No plans available — contact support.
          </div>
        )}

        <div
          className="mt-3 rounded-[12px] flex items-center justify-center gap-2"
          style={{
            background: "rgb(240,246,255)",
            border: "1.5px dashed rgb(180,204,232)",
            padding: "14px 16px",
            color: "rgb(90,122,158)",
            fontSize: "13px",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <rect
              x="4"
              y="11"
              width="16"
              height="10"
              rx="2"
              stroke="rgb(90,122,158)"
              strokeWidth="1.6"
            />
            <path
              d="M8 11V8a4 4 0 1 1 8 0v3"
              stroke="rgb(90,122,158)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          Billing · Payment fields available after activation
        </div>

        <div className="mt-5 space-y-3">
          <Controller
            control={control}
            name="terms_accepted"
            render={({ field }) => (
              <CheckboxRow
                checked={field.value}
                onChange={field.onChange}
                label={
                  <>
                    I agree to the{" "}
                    <a
                      href="https://profiletest.ai/terms--conditions"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                      style={{ color: "rgb(42,137,190)" }}
                    >
                      Terms and Conditions
                    </a>
                  </>
                }
              />
            )}
          />
          <Controller
            control={control}
            name="privacy_accepted"
            render={({ field }) => (
              <CheckboxRow
                checked={field.value}
                onChange={field.onChange}
                label={
                  <>
                    I agree to the{" "}
                    <a
                      href="https://profiletest.ai/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                      style={{ color: "rgb(42,137,190)" }}
                    >
                      Privacy Policy
                    </a>
                  </>
                }
              />
            )}
          />
        </div>

        {errMsg && <div className="mt-4 text-sm text-rose-500">{errMsg}</div>}

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
          {isSubmitting ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </StepCard>
  );
}

function PlanRowButton({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full flex items-center justify-between rounded-[12px] transition cursor-pointer hover:bg-[rgb(232,240,252)]"
      style={{
        background: "rgb(240,246,255)",
        border: selected
          ? "1.5px solid rgb(42,137,190)"
          : "1.5px solid rgb(208,224,240)",
        padding: "16px 20px",
        boxShadow: selected ? "0 0 0 3px rgba(42,137,190,0.12)" : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <RadioDot selected={selected} />
        <span
          style={{
            color: "rgb(24,44,62)",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          {plan.name}
        </span>
      </div>
      <span
        style={{
          color: "rgb(90,122,158)",
          fontSize: "13px",
        }}
      >
        {plan.priceLabel}
      </span>
    </button>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full"
      style={{
        width: 20,
        height: 20,
        border: selected
          ? "2px solid rgb(42,137,190)"
          : "2px solid rgb(180,204,232)",
        background: "#fff",
      }}
    >
      {selected && (
        <span
          className="block rounded-full"
          style={{
            width: 10,
            height: 10,
            background: "rgb(42,137,190)",
          }}
        />
      )}
    </span>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label
      className="flex items-start gap-3 cursor-pointer select-none"
      style={{ color: "rgb(24,44,62)", fontSize: "14px", lineHeight: "20px" }}
    >
      <span
        className="inline-flex items-center justify-center rounded-[6px] mt-[2px] shrink-0"
        style={{
          width: 20,
          height: 20,
          background: checked ? "rgb(42,137,190)" : "#fff",
          border: checked
            ? "1.5px solid rgb(42,137,190)"
            : "1.5px solid rgb(180,204,232)",
          transition: "background 120ms, border-color 120ms",
        }}
      >
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M2.5 6.2 5 8.7l4.5-5"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
