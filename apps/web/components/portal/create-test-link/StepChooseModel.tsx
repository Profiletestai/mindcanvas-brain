// apps/web/components/portal/create-test-link/StepChooseModel.tsx
import { Controller, type Control } from "react-hook-form";
import OptionRow from "./OptionRow";
import type { CreateTestLinkFormValues, ModelOption } from "./types";

export default function StepChooseModel({
  control,
  models,
}: {
  control: Control<CreateTestLinkFormValues>;
  models: ModelOption[];
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
                No models available for this organisation yet.
              </p>
            )}
            {models.map((m) => (
              <OptionRow
                key={m.id}
                selected={field.value === m.id}
                title={m.name}
                hint={m.category || "Profiling model"}
                onClick={() => field.onChange(m.id)}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
}
