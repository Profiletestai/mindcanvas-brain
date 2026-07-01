// apps/web/components/portal/create-test-link/StepLimits.tsx
import {
  Controller,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import OptionRow from "./OptionRow";
import { LIMIT_OPTIONS, type CreateTestLinkFormValues } from "./types";

export default function StepLimits({
  control,
  register,
}: {
  control: Control<CreateTestLinkFormValues>;
  register: UseFormRegister<CreateTestLinkFormValues>;
}) {
  return (
    <div>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
        Link limits
      </div>
      <Controller
        name="limitMode"
        control={control}
        render={({ field }) => (
          <>
            <div className="space-y-2.5">
              {LIMIT_OPTIONS.map((o) => (
                <OptionRow
                  key={o.value}
                  selected={field.value === o.value}
                  title={o.title}
                  hint={o.hint}
                  onClick={() => field.onChange(o.value)}
                />
              ))}
            </div>

            {field.value === "count" && (
              <input
                type="number"
                min={1}
                step={1}
                placeholder="Max submissions, e.g. 50"
                className="mt-3 w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#54AFE0]"
                {...register("maxUses")}
              />
            )}

            {field.value === "date" && (
              <input
                type="date"
                className="mt-3 w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none focus:border-[#54AFE0] [color-scheme:dark]"
                {...register("expiresDate")}
              />
            )}
          </>
        )}
      />
    </div>
  );
}
