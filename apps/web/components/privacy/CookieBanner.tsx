// apps/web/components/privacy/CookieBanner.tsx
"use client";

import { useConsent } from "./ConsentProvider";

export function CookieBanner() {
  const {
    ready,
    hasChoice,
    acceptAll,
    rejectNonEssential,
    openPreferences,
  } = useConsent();

  if (!ready || hasChoice) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] p-4 sm:p-6"
      role="region"
      aria-label="Cookie consent"
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold sm:text-lg">
              Your privacy choices
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              MindCanvas uses necessary technologies for security,
              authentication and core platform functionality. With your
              permission, we also use Google Analytics to understand how
              MindCanvas is used and HighLevel/LeadConnector to provide
              website chat and engagement features.
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Non-essential technologies remain off unless you choose to
              enable them. You can change your choice at any time using
              Cookie settings.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              type="button"
              onClick={rejectNonEssential}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Reject non-essential
            </button>

            <button
              type="button"
              onClick={acceptAll}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              Accept all
            </button>

            <button
              type="button"
              onClick={openPreferences}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Manage preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}