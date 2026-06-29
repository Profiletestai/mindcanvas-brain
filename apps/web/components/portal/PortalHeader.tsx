// apps/web/components/portal/PortalHeader.tsx
"use client";

import Link from "next/link";

type Props = {
  orgSlug: string;
  firstName?: string | null;
  fullName?: string | null;
};

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BellIcon = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.5 1.875C6.2568 1.875 5.06451 2.36886 4.18544 3.24794C3.30636 4.12701 2.8125 5.3193 2.8125 6.5625V8.90625L1.875 10.7812H13.125L12.1875 8.90625V6.5625C12.1875 5.3193 11.6936 4.12701 10.8146 3.24794C9.93549 2.36886 8.7432 1.875 7.5 1.875Z"
      stroke="white"
      strokeOpacity="0.62"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.09375 12.6562C6.09375 13.0292 6.24191 13.3869 6.50563 13.6506C6.76935 13.9143 7.12704 14.0625 7.5 14.0625C7.87296 14.0625 8.23065 13.9143 8.49437 13.6506C8.75809 13.3869 8.90625 13.0292 8.90625 12.6562"
      stroke="white"
      strokeOpacity="0.62"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HelpIcon = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.5 13.125C10.6066 13.125 13.125 10.6066 13.125 7.5C13.125 4.3934 10.6066 1.875 7.5 1.875C4.3934 1.875 1.875 4.3934 1.875 7.5C1.875 10.6066 4.3934 13.125 7.5 13.125Z"
      stroke="white"
      strokeOpacity="0.62"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.8125 5.625C6.06319 5.34069 6.39417 5.13903 6.76178 5.04663C7.1294 4.95422 7.51639 4.97541 7.87172 5.10739C8.22705 5.23937 8.53404 5.47595 8.7522 5.78592C8.97036 6.0959 9.08944 6.46472 9.09375 6.84375C9.09375 7.78125 8.34375 8.34375 7.5 8.71875V9.375"
      stroke="white"
      strokeOpacity="0.62"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 11.9062C7.86244 11.9062 8.15625 11.6124 8.15625 11.25C8.15625 10.8876 7.86244 10.5938 7.5 10.5938C7.13756 10.5938 6.84375 10.8876 6.84375 11.25C6.84375 11.6124 7.13756 11.9062 7.5 11.9062Z"
      fill="white"
      fillOpacity="0.4"
      stroke="white"
      strokeOpacity="0.62"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function PortalHeader({ orgSlug, firstName, fullName }: Props) {
  const name = (firstName ?? "").trim() || "there";

  return (
    <header className="relative flex h-[87px] items-center border border-[rgba(255,255,255,0.05)] justify-between gap-4 pl-6 pr-[21px] bg-[rgba(14,42,69,1)] backdrop-blur-2xl">
      <div className="min-w-0">
        <h1 className="truncate text-[20px] leading-[32px] font-extrabold tracking-[-0.4px] text-white">
          Welcome, {name}.
        </h1>
        <p className="mt-1 text-[12.5px] font-light leading-[20px] tracking-0 text-[rgba(255,255,255,0.36)]">
          Here&apos;s what&apos;s happening with your MindCanvas account today.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/portal/${orgSlug}/links`}
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          className="mr-2 inline-flex h-[30px] items-center gap-[7px] rounded-md bg-[linear-gradient(101.83deg,#54AFE0_0%,#54AFE0_100%)] px-4 text-[12px] font-bold leading-none tracking-[0.1px] text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition-opacity hover:opacity-90"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create test link
        </Link>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
        >
          {BellIcon}
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border border-[rgba(3,14,42,0.85)] bg-[rgba(239,68,68,1)]" />
        </button>

        <button
          type="button"
          aria-label="Help"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
        >
          {HelpIcon}
        </button>

        <div
          aria-label={fullName ?? undefined}
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[rgba(74,155,255,0.3)] bg-[rgba(74,155,255,0.15)] text-[10.5px] font-bold leading-[16.8px] text-[rgba(84,175,224,1)]"
        >
          {initials(fullName)}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px] border-t border-[rgba(255,255,255,0.06)]" />
    </header>
  );
}
