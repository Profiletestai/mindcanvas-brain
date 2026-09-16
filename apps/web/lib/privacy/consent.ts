// apps/web/lib/privacy/consent.ts

export const CONSENT_COOKIE_NAME = "mindcanvas_consent";
export const CONSENT_VERSION = 1;

// Six months.
// We can review this period later as part of the formal Cookie Register.
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type ConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  engagement: boolean;
  updatedAt: string;
};

export type OptionalConsent = {
  analytics: boolean;
  engagement: boolean;
};

export function createConsentPreferences(
  optional: OptionalConsent,
): ConsentPreferences {
  return {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: optional.analytics,
    engagement: optional.engagement,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultOptionalConsent(): OptionalConsent {
  return {
    analytics: false,
    engagement: false,
  };
}

export function parseConsentCookie(
  raw: string | null | undefined,
): ConsentPreferences | null {
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Partial<ConsentPreferences>;

    if (parsed.version !== CONSENT_VERSION) {
      return null;
    }

    if (
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.engagement !== "boolean"
    ) {
      return null;
    }

    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: parsed.analytics,
      engagement: parsed.engagement,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function readConsentCookie(): ConsentPreferences | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${CONSENT_COOKIE_NAME}=`;

  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!value) {
    return null;
  }

  return parseConsentCookie(value.slice(prefix.length));
}

export function writeConsentCookie(
  preferences: ConsentPreferences,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const encoded = encodeURIComponent(JSON.stringify(preferences));

  const secure =
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
      ? "; Secure"
      : "";

  document.cookie = [
    `${CONSENT_COOKIE_NAME}=${encoded}`,
    "Path=/",
    `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ") + secure;
}

/**
 * Prevent further GA collection in the current browser session.
 *
 * The normal consent flow also reloads the page when analytics consent is
 * withdrawn, which ensures the GA component is no longer rendered.
 */
export function disableGoogleAnalytics(gaId?: string | null): void {
  if (typeof window === "undefined" || !gaId) {
    return;
  }

  (
    window as typeof window & Record<string, unknown>
  )[`ga-disable-${gaId}`] = true;
}

/**
 * Best-effort removal of first-party GA cookies.
 *
 * This is not relied upon as the primary consent control. The primary control
 * is that GA is not rendered at all when analytics consent is false.
 */
export function clearGoogleAnalyticsCookies(): void {
  if (typeof document === "undefined") {
    return;
  }

  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter(
      (name) =>
        name === "_ga" ||
        name.startsWith("_ga_") ||
        name === "_gid" ||
        name === "_gat",
    );

  for (const name of cookieNames) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;

    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const parts = hostname.split(".");

      // Also try the parent domain where appropriate.
      if (parts.length >= 2) {
        const parentDomain = `.${parts.slice(-2).join(".")}`;

        document.cookie =
          `${name}=; Path=/; Domain=${parentDomain}; ` +
          "Max-Age=0; SameSite=Lax";
      }
    }
  }
}