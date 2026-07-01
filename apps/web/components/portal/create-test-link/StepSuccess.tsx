// apps/web/components/portal/create-test-link/StepSuccess.tsx
import { getBaseUrl } from "@/lib/baseUrl";

export default function StepSuccess({
  createdToken,
  copied,
  onCopy,
}: {
  createdToken: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  const url = createdToken ? `${getBaseUrl()}/t/${createdToken}` : null;

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#22C55E]/[0.22] bg-[#22C55E]/10 text-[#22C55E]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h3 className="mt-4 text-[16px] font-extrabold text-white">
        Test link created
      </h3>
      <p className="mt-1 text-[12.5px] font-light text-white/[0.62]">
        You can now activate, copy, and share your test links.
      </p>

      {url && (
        <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-3.5 pr-2.5">
          <span className="truncate font-mono text-[11.5px] text-white/[0.62]">
            {url}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-md border border-[#54AFE0]/[0.22] bg-[#54AFE0]/10 px-2.5 py-1 text-[10.5px] font-bold text-[#54AFE0] transition hover:bg-[#54AFE0]/20"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
