// apps/web/components/portal/create-test-link/OptionRow.tsx
// Selectable radio row used by the choose-model, experience, and limit steps.

export default function OptionRow({
  selected,
  title,
  hint,
  onClick,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-4 py-3.5 text-left transition ${
        selected
          ? "border-[#54AFE0] bg-[#54AFE0]/10"
          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <span
        className={`h-[13px] w-[13px] shrink-0 rounded-full border ${
          selected ? "border-[#54AFE0] bg-[#54AFE0]" : "border-white/20"
        }`}
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-white/[0.94]">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] font-light text-white/[0.36]">
          {hint}
        </span>
      </span>
    </button>
  );
}
