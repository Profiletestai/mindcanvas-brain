// apps/web/components/portal/create-test-link/StepChooseModel.tsx

import {
  Controller,
  type Control,
} from "react-hook-form";

import UpgradeEngineButton from "@/components/portal/UpgradeEngineButton";
import OptionRow from "./OptionRow";
import type {
  CreateTestLinkFormValues,
  ModelOption,
} from "./types";

export default function StepChooseModel({
  control,
  models,
  orgId,
}: {
  control: Control<CreateTestLinkFormValues>;
  models: ModelOption[];
  orgId: string;
}) {
  return (
    <div>
      <div className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
        Choose model
      </div>

      <Controller
        name="modelId"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <div className="space-y-2.5">
            {models.length === 0 && (
              <p className="text-[13px] text-white/50">
                No models are available for
                this organisation yet.
              </p>
            )}

            {models.map((model) => {
              if (
                model.locked &&
                model.requiredTier &&
                model.requiredPlan
              ) {
                return (
                  <div
                    key={model.id}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-[12px] text-white/45">
                        🔒
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-white/55">
                          {model.name}
                        </p>

                        <p className="mt-1 text-[11px] leading-4 text-white/35">
                          {model.category ||
                            "Additional profiling engine"}
                        </p>

                        <p className="mt-1 text-[11px] font-medium text-[#54AFE0]/80">
                          Available on{" "}
                          {model.requiredPlan}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <UpgradeEngineButton
                        orgId={orgId}
                        targetTier={
                          model.requiredTier
                        }
                        planName={
                          model.requiredPlan
                        }
                        compact
                      />
                    </div>
                  </div>
                );
              }

              return (
                <OptionRow
                  key={model.id}
                  selected={
                    field.value === model.id
                  }
                  title={model.name}
                  hint={
                    model.category ||
                    "Profiling model"
                  }
                  onClick={() =>
                    field.onChange(model.id)
                  }
                />
              );
            })}
          </div>
        )}
      />
    </div>
  );
}
