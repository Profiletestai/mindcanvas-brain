// apps/web/app/portal/[slug]/profile/_components/PreviewBanner.tsx
// Marks a profile page whose contents are still a mockup, so example data is
// never mistaken for the organisation's real settings.

export default function PreviewBanner({ note }: { note?: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-amber-400/[0.28] bg-amber-400/[0.08] px-5 py-4"
    >
      <span className="mt-[1px] shrink-0 text-amber-300" aria-hidden>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      </span>
      <div>
        <p className="text-[13px] font-bold text-amber-300">
          Preview — this page shows example data. Nothing here is saved yet.
        </p>
        {note && (
          <p className="mt-0.5 text-[12.5px] font-light text-amber-200/70">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
