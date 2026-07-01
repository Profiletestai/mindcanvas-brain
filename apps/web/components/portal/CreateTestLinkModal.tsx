// apps/web/components/portal/CreateTestLinkModal.tsx
// Multi-step "Create a test link" modal (per Figma).
// Steps: choose model → name → test taker experience → link limits → success.
// Form state is handled by react-hook-form; each step lives in its own
// component under ./create-test-link. Submits to /api/admin/create-link and
// broadcasts "links:changed" so the Created test links table refreshes.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { getBaseUrl } from "@/lib/baseUrl";
import StepChooseModel from "./create-test-link/StepChooseModel";
import StepName from "./create-test-link/StepName";
import StepExperience from "./create-test-link/StepExperience";
import StepLimits from "./create-test-link/StepLimits";
import StepSuccess from "./create-test-link/StepSuccess";
import {
  EXPERIENCE_OPTIONS,
  TOTAL_STEPS,
  type CreateTestLinkFormValues,
  type ModelOption,
} from "./create-test-link/types";

export type { ModelOption } from "./create-test-link/types";

type Props = {
  orgId: string;
  orgSlug: string;
  models: ModelOption[];
  initialModelId?: string;
  onClose: () => void;
};

export default function CreateTestLinkModal({
  orgId,
  models,
  initialModelId,
  onClose,
}: Props) {
  const router = useRouter();

  const { control, register, handleSubmit, watch } =
    useForm<CreateTestLinkFormValues>({
      defaultValues: {
        modelId: initialModelId || "",
        name: "",
        experience: "show",
        limitMode: "none",
        maxUses: "",
        expiresDate: "",
      },
    });

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const modelId = watch("modelId");
  const limitMode = watch("limitMode");
  const maxUses = watch("maxUses");
  const expiresDate = watch("expiresDate");

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === modelId) || null,
    [models, modelId]
  );

  const canContinue = useMemo(() => {
    if (step === 0) return !!modelId;
    if (step === 3) {
      if (limitMode === "count") {
        const n = parseInt(maxUses, 10);
        return Number.isInteger(n) && n >= 1;
      }
      if (limitMode === "date") return !!expiresDate;
      return true;
    }
    return true;
  }, [step, modelId, limitMode, maxUses, expiresDate]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      const showResults =
        EXPERIENCE_OPTIONS.find((o) => o.value === values.experience)
          ?.showResults ?? true;

      const payload: Record<string, any> = {
        orgId,
        testId: values.modelId,
        testDisplayName: values.name.trim() || selectedModel?.name || null,
        showResults,
        emailReport: true,
        max_uses:
          values.limitMode === "count" ? parseInt(values.maxUses, 10) : null,
        expiresAt:
          values.limitMode === "date" && values.expiresDate
            ? new Date(values.expiresDate).toISOString()
            : null,
      };

      const res = await fetch("/api/admin/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setCreatedToken(data.token || null);
      setStep(4);
      try {
        window.dispatchEvent(new CustomEvent("links:changed"));
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message || "Failed to create link");
    } finally {
      setSubmitting(false);
    }
  });

  const done = () => {
    router.refresh();
    onClose();
  };

  const copyLink = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(`${getBaseUrl()}/t/${createdToken}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const downloadEmbed = () => {
    if (!createdToken) return;
    const link = `${getBaseUrl()}/t/${createdToken}`;
    const snippet = `<iframe src="${link}" width="100%" height="800" frameborder="0" style="border:0;" allow="clipboard-write"></iframe>\n`;
    const blob = new Blob([snippet], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mindcanvas-embed.html";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isSuccess = step === 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#050914]/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0a1e30] p-7 shadow-[0_40px_80px_0_rgba(0,0,0,0.5)]"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        {/* Top gradient divider */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(to_right,#54AFE0_0%,#54AFE0_55%,transparent_100%)]" />

        {/* Header */}
        <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#54AFE0]">
          New test link
        </div>
        <h2 className="mt-2 text-[21px] font-extrabold leading-[28px] tracking-[-0.3px] text-white">
          Create a test link
        </h2>

        {/* Progress segments */}
        <div className="mt-4 flex gap-[5px]">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const state = isSuccess
              ? "done"
              : i < step
              ? "done"
              : i === step
              ? "current"
              : "todo";
            return (
              <span
                key={i}
                className={`h-[3px] w-5 rounded-full ${
                  state === "done"
                    ? "bg-[#22C55E]"
                    : state === "current"
                    ? "bg-[#54AFE0]"
                    : "bg-white/10"
                }`}
              />
            );
          })}
        </div>

        {/* Body — scrolls when content exceeds the viewport-bounded card */}
        <div className="mt-6 min-h-[200px] flex-1 overflow-y-auto pr-1">
          {step === 0 && <StepChooseModel control={control} models={models} />}
          {step === 1 && <StepName register={register} />}
          {step === 2 && <StepExperience control={control} />}
          {step === 3 && (
            <StepLimits control={control} register={register} />
          )}
          {isSuccess && (
            <StepSuccess
              createdToken={createdToken}
              copied={copied}
              onCopy={copyLink}
            />
          )}
        </div>

        {error && <p className="mb-3 text-[13px] text-rose-400">{error}</p>}

        {/* Footer */}
        {!isSuccess ? (
          <div className="mt-[45px] space-y-2.5">
            <div className="flex gap-2.5">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex h-[38px] shrink-0 basis-[140px] items-center justify-center rounded-xl border border-white/[0.11] bg-white/[0.06] text-[13px] font-bold text-white/[0.75] transition hover:bg-white/[0.09]"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                disabled={!canContinue || submitting}
                onClick={() => {
                  if (step < 3) setStep((s) => s + 1);
                  else submit();
                }}
                className="inline-flex h-[38px] flex-1 items-center justify-center rounded-xl bg-[linear-gradient(101.83deg,#54AFE0_0%,#54AFE0_100%)] text-[13px] font-bold text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step < 3
                  ? "Continue →"
                  : submitting
                  ? "Creating…"
                  : "Create the link →"}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[38px] w-full items-center justify-center rounded-xl border border-white/[0.11] bg-white/[0.06] text-[13px] font-bold text-white/[0.62] transition hover:bg-white/[0.09]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-[45px] space-y-2.5">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-[38px] w-full items-center justify-center rounded-xl bg-[linear-gradient(101.83deg,#54AFE0_0%,#54AFE0_100%)] text-[13px] font-bold text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy test link"}
            </button>
            <button
              type="button"
              onClick={downloadEmbed}
              className="inline-flex h-[38px] w-full items-center justify-center rounded-xl border border-white/[0.11] bg-white/[0.06] text-[13px] font-bold text-white/[0.62] transition hover:bg-white/[0.09]"
            >
              Download embed code
            </button>
            <button
              type="button"
              onClick={done}
              className="inline-flex h-[38px] w-full items-center justify-center rounded-xl border border-white/[0.11] bg-white/[0.06] text-[13px] font-bold text-white/[0.62] transition hover:bg-white/[0.09]"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
