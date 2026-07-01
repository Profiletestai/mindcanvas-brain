// apps/web/components/portal/create-test-link/StepExperience.tsx
import { Controller, type Control } from "react-hook-form";
import OptionRow from "./OptionRow";
import { EXPERIENCE_OPTIONS, type CreateTestLinkFormValues } from "./types";

export default function StepExperience({
  control,
}: {
  control: Control<CreateTestLinkFormValues>;
}) {
  return (
    <div>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
        Test taker experience
      </div>
      <Controller
        name="experience"
        control={control}
        render={({ field }) => (
          <div className="space-y-2.5">
            {EXPERIENCE_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                selected={field.value === o.value}
                title={o.title}
                hint={o.hint}
                onClick={() => field.onChange(o.value)}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
}
