// apps/web/components/privacy/CookieSettingsButton.tsx
"use client";

import { useConsent } from "./ConsentProvider";

export function CookieSettingsButton() {
  const {
    ready,
    hasChoice,
    preferencesOpen,
    openPreferences,
  } = useConsent();

  if (!ready || !hasChoice || preferencesOpen) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={openPreferences}
      className="fixed bottom-4 left-4 z-[9998] rounded-full border border-slate-300/30 bg-slate-950/90 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
    >
      Cookie settings
    </button>
  );
}