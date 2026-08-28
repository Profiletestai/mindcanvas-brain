import type {
  OnboardingStep,
  ProgressResponse,
} from "@/app/api/onboarding/v2/_lib/types";

/**
 * Internal database steps remain numbered 1–10 for backward compatibility.
 *
 * The old internal step 6 (“Organisation created”) has been removed from the
 * visible flow. Both internal steps 6 and 7 now resolve to the Welcome screen:
 *
 * - A new organisation with last_completed_step = 5 receives internal step 6.
 * - An existing user who already acknowledged the old screen receives step 7.
 *
 * Both users therefore continue safely to Welcome without a data migration.
 */
export const STEP_TO_PATH: Record<
  Exclude<OnboardingStep, "complete">,
  string
> = {
  1: "/onboarding/v2/account",
  2: "/onboarding/v2/verify",
  3: "/onboarding/v2/plan",
  4: "/onboarding/v2/billing",
  5: "/onboarding/v2/organisation",

  // Internal step 6 is intentionally collapsed into Welcome.
  6: "/onboarding/v2/welcome",
  7: "/onboarding/v2/welcome",

  8: "/onboarding/v2/book-session",
  9: "/onboarding/v2/session-booked",
  10: "/onboarding/v2/diagnostic",
};

/** Onboarding ends in the portal, not on another onboarding screen. */
export function dashboardPath(
  orgSlug: string | null | undefined
): string {
  return orgSlug
    ? `/portal/${orgSlug}/dashboard`
    : "/portal/home";
}

export const ACCOUNT_PATH = STEP_TO_PATH[1];
export const VERIFY_PATH = STEP_TO_PATH[2];
export const PLAN_PATH = STEP_TO_PATH[3];
export const BILLING_PATH = STEP_TO_PATH[4];
export const ORGANISATION_PATH = STEP_TO_PATH[5];

/**
 * Retained only for old bookmarks. This route redirects to WELCOME_PATH and
 * is not included in onboarding progress.
 */
export const CREATED_PATH =
  "/onboarding/v2/created";

export const WELCOME_PATH = STEP_TO_PATH[7];
export const BOOK_SESSION_PATH = STEP_TO_PATH[8];
export const SESSION_BOOKED_PATH =
  STEP_TO_PATH[9];
export const DIAGNOSTIC_PATH = STEP_TO_PATH[10];

// Branding is configured later from Portal → Profile Settings → Customise.
// Keep the old route constant so existing bookmarks can be redirected without
// making Branding part of onboarding progress.
export const BRANDING_PATH =
  "/onboarding/v2/branding";

export const ONB_EMAIL_KEY = "onb_email";

// First step requiring an authenticated session.
// Steps 1–2 are pre-auth signup and OTP.
export const FIRST_AUTH_STEP = 3;

/**
 * The database still ends on internal step 10.
 * The interface now displays nine steps.
 */
const FINAL_INTERNAL_STEP = 10;
export const TOTAL_STEPS = 9;

export function pathForStep(
  step: OnboardingStep,
  orgSlug?: string | null
): string {
  if (step === "complete") {
    return dashboardPath(orgSlug);
  }

  return STEP_TO_PATH[step];
}

/**
 * Welcome represents both internal steps 6 and 7.
 *
 * It is mapped to 6 here so a new user whose progress returns internal step 6
 * is allowed onto the page. Users already on internal step 7 are also allowed
 * because the guard permits revisiting an earlier available screen.
 */
export const PATH_TO_STEP: Record<
  string,
  OnboardingStep
> = {
  [ACCOUNT_PATH]: 1,
  [VERIFY_PATH]: 2,
  [PLAN_PATH]: 3,
  [BILLING_PATH]: 4,
  [ORGANISATION_PATH]: 5,
  [WELCOME_PATH]: 6,
  [BOOK_SESSION_PATH]: 8,
  [SESSION_BOOKED_PATH]: 9,
  [DIAGNOSTIC_PATH]: 10,
};

/**
 * Translate internal database progress into the visible nine-step counter.
 *
 * Internal 6 and 7 both display as visible step 6.
 * Internal 8, 9 and 10 display as visible steps 7, 8 and 9.
 */
export function displayStep(
  step: OnboardingStep | undefined
): number {
  if (step === "complete") {
    return TOTAL_STEPS;
  }

  if (typeof step !== "number") {
    return 1;
  }

  if (step <= 5) {
    return Math.max(step, 1);
  }

  if (step === 6 || step === 7) {
    return 6;
  }

  return Math.min(step - 1, TOTAL_STEPS);
}

/**
 * Access checks continue using internal database numbering rather than the
 * visible nine-step numbering.
 */
export function stepIndex(
  step: OnboardingStep
): number {
  return step === "complete"
    ? FINAL_INTERNAL_STEP + 1
    : step;
}

export type GuardDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string };

export function decideAccess(args: {
  pathname: string;
  progress: ProgressResponse | null;
  hasOnbEmail: boolean;
}): GuardDecision {
  const expected = PATH_TO_STEP[args.pathname];

  if (expected === undefined) {
    return { kind: "allow" };
  }

  if (args.progress === null) {
    if (args.pathname === ACCOUNT_PATH) {
      return { kind: "allow" };
    }

    if (
      args.pathname === VERIFY_PATH &&
      args.hasOnbEmail
    ) {
      return { kind: "allow" };
    }

    return {
      kind: "redirect",
      to: ACCOUNT_PATH,
    };
  }

  const current = stepIndex(args.progress.step);

  if (
    typeof expected === "number" &&
    expected >= FIRST_AUTH_STEP &&
    expected <= current
  ) {
    return { kind: "allow" };
  }

  if (args.progress.step !== expected) {
    return {
      kind: "redirect",
      to: pathForStep(
        args.progress.step,
        args.progress.org_slug
      ),
    };
  }

  return { kind: "allow" };
}
