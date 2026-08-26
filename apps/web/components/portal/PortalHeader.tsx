// apps/web/components/portal/PortalHeader.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CreateTestLinkButton from "./CreateTestLinkButton";
import PortalSidebar from "./PortalSidebar";
import type { ModelOption } from "./create-test-link/types";

type Props = {
  orgSlug: string;
  orgId: string;
  models: ModelOption[];
  firstName?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  // "Back to admin" is only meaningful for portal.superadmin users.
  isSuperadmin?: boolean;
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

export default function PortalHeader({
  orgSlug,
  orgId,
  models,
  firstName,
  fullName,
  avatarUrl,
  isSuperadmin = false,
}: Props) {
  const name = (firstName ?? "").trim();

  // Mobile nav drawer — the sidebar is hidden below md, so this is the only
  // navigation on small screens.
  const [navOpen, setNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <header className="relative flex h-[87px] items-center border border-[rgba(255,255,255,0.05)] justify-between gap-4 pl-4 pr-[21px] md:pl-6 bg-[rgba(14,42,69,1)] backdrop-blur-2xl">
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={navOpen}
        onClick={() => setNavOpen(true)}
        className="mr-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white/70 transition-colors hover:bg-[rgba(255,255,255,0.08)] md:hidden"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mounted &&
        navOpen &&
        createPortal(
          <div className="fixed inset-0 z-[90] md:hidden">
            <div
              className="absolute inset-0 bg-[#050914]/75 backdrop-blur-md"
              onClick={() => setNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-56 overflow-y-auto shadow-2xl">
              <PortalSidebar
                orgSlug={orgSlug}
                onNavigate={() => setNavOpen(false)}
              />
            </div>
          </div>,
          document.body,
        )}

      <div className="min-w-0">
        <h1 className="truncate text-[20px] leading-[32px] font-extrabold tracking-[-0.4px] text-white">
          {name ? `Welcome, ${name}.` : "Welcome back."}
        </h1>
        <p className="mt-1 text-[12.5px] font-light leading-[20px] tracking-0 text-[rgba(255,255,255,0.36)]">
          Here&apos;s what&apos;s happening with your MindCanvas account today.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isSuperadmin && (
          <Link
            href="/admin"
            className="mr-1 hidden text-[12px] font-medium text-white/40 underline-offset-2 transition-colors hover:text-white hover:underline sm:inline"
          >
            Back to admin
          </Link>
        )}

        <span className="mr-2">
          <CreateTestLinkButton
            orgId={orgId}
            orgSlug={orgSlug}
            models={models}
            variant="header"
          />
        </span>

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

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName ? `${fullName}'s profile` : "Your profile"}
            className="h-[30px] w-[30px] rounded-full border border-[rgba(74,155,255,0.3)] object-cover"
          />
        ) : (
          <div
            aria-label={fullName ?? undefined}
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[rgba(74,155,255,0.3)] bg-[rgba(74,155,255,0.15)] text-[10.5px] font-bold leading-[16.8px] text-[rgba(84,175,224,1)]"
          >
            {initials(fullName)}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px] border-t border-[rgba(255,255,255,0.06)]" />
    </header>
  );
}
