// apps/web/components/privacy/CookiePreferences.tsx
"use client";

import { useEffect, useState } from "react";

import { useConsent } from "./ConsentProvider";

type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
};

function Toggle({
  checked,
  disabled = false,
  label,
  onChange,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange?.(!checked);
        }
      }}
      className={[
        "relative inline-flex h-7 w-12 shrink-0 rounded-full transition",
        "focus:outline-none focus:ring-2 focus:ring-cyan-400",
        checked ? "bg-cyan-500" : "bg-slate-600",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export function CookiePreferences() {
  const {
    preferencesOpen,
    closePreferences,
    consent,
    acceptAll,
    rejectNonEssential,
    savePreferences,
  } = useConsent();

  const [analytics, setAnalytics] = useState(false);
  const [engagement, setEngagement] = useState(false);

  useEffect(() => {
    if (!preferencesOpen) {
      return;
    }

    setAnalytics(consent?.analytics ?? false);
    setEngagement(consent?.engagement ?? false);
  }, [preferencesOpen, consent]);

  useEffect(() => {
    if (!preferencesOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreferences();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [preferencesOpen, closePreferences]);

  if (!preferencesOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close cookie preferences"
        className="absolute inset-0 bg-black/70"
        onClick={closePreferences}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="cookie-preferences-title"
              className="text-xl font-semibold"
            >
              Cookie preferences
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Choose which optional technologies MindCanvas may use.
              Necessary functionality cannot be switched off because it is
              required to provide and protect the platform.
            </p>
          </div>

          <button
            type="button"
            onClick={closePreferences}
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close cookie preferences"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h3 className="font-semibold">
                  Necessary
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Required for essential platform functions such as
                  authentication, security and remembering your privacy
                  preferences.
                </p>

                <p className="mt-2 text-xs font-medium text-emerald-400">
                  Always active
                </p>
              </div>

              <Toggle
                checked
                disabled
                label="Necessary technologies always active"
              />
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h3 className="font-semibold">
                  Analytics
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Allows Google Analytics to help us understand how people
                  use MindCanvas, such as which pages are visited and how
                  the platform is used. We use this information to improve
                  the service.
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Provider: Google Analytics
                </p>
              </div>

              <Toggle
                checked={analytics}
                onChange={setAnalytics}
                label="Allow analytics technologies"
              />
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h3 className="font-semibold">
                  Chat & engagement
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Allows the HighLevel/LeadConnector website widget to load
                  so that chat and related engagement features can be
                  provided.
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Provider: HighLevel / LeadConnector
                </p>
              </div>

              <Toggle
                checked={engagement}
                onChange={setEngagement}
                label="Allow chat and engagement technologies"
              />
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() =>
              savePreferences({
                analytics,
                engagement,
              })
            }
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Save preferences
          </button>

          <button
            type="button"
            onClick={rejectNonEssential}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600"
          >
            Reject non-essential
          </button>

          <button
            type="button"
            onClick={acceptAll}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Accept all
          </button>
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          You can return to these settings at any time using the Cookie
          settings button.
        </p>
      </div>
    </div>
  );
}