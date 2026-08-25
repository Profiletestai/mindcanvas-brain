// apps/web/components/portal/create-test-link/StepName.tsx
import type { UseFormRegister } from "react-hook-form";
import type { CreateTestLinkFormValues } from "./types";

export default function StepName({
  register,
}: {
  register: UseFormRegister<CreateTestLinkFormValues>;
}) {
  return (
    <div>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
        Name this test link
      </div>
      <input
        autoFocus
        placeholder="e.g. QSC Leaders — Sales team intake"
        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#54AFE0]"
        {...register("name")}
      />
      <p className="mt-2 text-[12.5px] text-white/40">
        This is for your reference only. Test takers won&apos;t see it.
      </p>
    </div>
  );
}
