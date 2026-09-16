// apps/web/components/privacy/ConsentProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearGoogleAnalyticsCookies,
  createConsentPreferences,
  disableGoogleAnalytics,
  readConsentCookie,
  writeConsentCookie,
  type ConsentPreferences,
  type OptionalConsent,
} from "@/lib/privacy/consent";

type ConsentContextValue = {
  ready: boolean;
  consent: ConsentPreferences | null;
  hasChoice: boolean;

  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;

  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (preferences: OptionalConsent) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

type ConsentProviderProps = {
  children: ReactNode;
  googleAnalyticsId?: string | null;
};

export function ConsentProvider({
  children,
  googleAnalyticsId,
}: ConsentProviderProps) {
  const [ready, setReady] = useState(false);

  const [consent, setConsent] =
    useState<ConsentPreferences | null>(null);

  const [preferencesOpen, setPreferencesOpen] =
    useState(false);

  useEffect(() => {
    const stored = readConsentCookie();

    setConsent(stored);
    setReady(true);

    if (!stored?.analytics) {
      disableGoogleAnalytics(googleAnalyticsId);
    }
  }, [googleAnalyticsId]);

  const persist = useCallback(
    (optional: OptionalConsent) => {
      const previous = consent;

      const next = createConsentPreferences(optional);

      writeConsentCookie(next);
      setConsent(next);
      setPreferencesOpen(false);

      const analyticsWasRevoked =
        previous?.analytics === true && next.analytics === false;

      const engagementWasRevoked =
        previous?.engagement === true &&
        next.engagement === false;

      if (analyticsWasRevoked) {
        disableGoogleAnalytics(googleAnalyticsId);
        clearGoogleAnalyticsCookies();
      }

      /**
       * Scripts that were already loaded cannot always be perfectly
       * "unloaded" from a running page.
       *
       * When consent is withdrawn we reload once. On the new page load,
       * ThirdPartyScripts sees the updated preference and does not render
       * the revoked service.
       */
      if (analyticsWasRevoked || engagementWasRevoked) {
        window.location.reload();
      }
    },
    [consent, googleAnalyticsId],
  );

  const acceptAll = useCallback(() => {
    persist({
      analytics: true,
      engagement: true,
    });
  }, [persist]);

  const rejectNonEssential = useCallback(() => {
    persist({
      analytics: false,
      engagement: false,
    });
  }, [persist]);

  const savePreferences = useCallback(
    (preferences: OptionalConsent) => {
      persist(preferences);
    },
    [persist],
  );

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      consent,
      hasChoice: consent !== null,

      preferencesOpen,
      openPreferences,
      closePreferences,

      acceptAll,
      rejectNonEssential,
      savePreferences,
    }),
    [
      ready,
      consent,
      preferencesOpen,
      openPreferences,
      closePreferences,
      acceptAll,
      rejectNonEssential,
      savePreferences,
    ],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const context = useContext(ConsentContext);

  if (!context) {
    throw new Error(
      "useConsent must be used inside ConsentProvider",
    );
  }

  return context;
}