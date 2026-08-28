// apps/web/components/portal/create-test-link/StepAdvanced.tsx
// Wizard step 5 — the link options the old advanced form owned. Wraps the
// shared AdvancedFields with react-hook-form state.
"use client";

import type { UseFormSetValue, UseFormWatch } from "react-hook-form";
import AdvancedFields from "./AdvancedFields";
import {
  showsResults,
  type AdvancedLinkValues,
  type CreateTestLinkFormValues,
} from "./types";

export default function StepAdvanced({
  watch,
  setValue,
  supportsLite,
}: {
  watch: UseFormWatch<CreateTestLinkFormValues>;
  setValue: UseFormSetValue<CreateTestLinkFormValues>;
  supportsLite: boolean;
}) {
  const values: AdvancedLinkValues = {
    nextStepsUrl: watch("nextStepsUrl"),
    redirectUrl: watch("redirectUrl"),
    hiddenResultsMessage: watch("hiddenResultsMessage"),
    contactOwner: watch("contactOwner"),
    emailReport: watch("emailReport"),
    reportVariant: watch("reportVariant"),
  };

  return (
    <div>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
        Report delivery
      </div>
      <AdvancedFields
        values={values}
        // react-hook-form's Path/PathValue pair can't narrow a generic key on
        // its own, so the concrete AdvancedLinkValues typing lives on
        // AdvancedFields' onChange signature instead.
        onChange={(key, value) =>
          setValue(key as any, value as any, { shouldDirty: true })
        }
        showResults={showsResults(watch("experience"))}
        supportsLite={supportsLite}
      />
    </div>
  );
}
