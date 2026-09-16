// apps/web/app/_lib/referrals.ts

export const REFERRAL_COOKIE_NAME = "mc_referral_click";

export const REFERRAL_ATTRIBUTION_DAYS = 30;

export const REFERRAL_ATTRIBUTION_SECONDS =
  REFERRAL_ATTRIBUTION_DAYS * 24 * 60 * 60;

export const DEFAULT_REFERRAL_DESTINATION =
  "/onboarding/v2/account";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normaliseReferralCode(
  value: string | null | undefined
) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isUuid(
  value: string | null | undefined
): value is string {
  return UUID_RE.test(String(value ?? "").trim());
}

/**
 * Referral destinations must stay inside MindCanvas.
 *
 * Examples allowed:
 *   /onboarding/v2/account
 *   /onboarding/v2/account?campaign=partner
 *
 * Examples rejected:
 *   https://example.com
 *   //example.com
 *   /\example.com
 */
export function safeReferralDestination(
  value: string | null | undefined
) {
  const path = String(value ?? "").trim();

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return DEFAULT_REFERRAL_DESTINATION;
  }

  return path;
}

export function referralCutoffIso(
  now = new Date()
) {
  return new Date(
    now.getTime() -
      REFERRAL_ATTRIBUTION_SECONDS * 1000
  ).toISOString();
}