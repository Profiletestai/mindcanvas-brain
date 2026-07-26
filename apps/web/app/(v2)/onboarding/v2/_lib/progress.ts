//apps/web/app/(v2)/onboarding/v2/_lib/progress.ts
import type {
  OnboardingStep,
  ProgressResponse,
} from "@/app/api/onboarding/v2/_lib/types";

export const STEP_TO_PATH: Record<Exclude<OnboardingStep, "complete">, string> = {
  1: "/onboarding/v2/account",
  2: "/onboarding/v2/verify",
  3: "/onboarding/v2/plan",
  4: "/onboarding/v2/billing",
  5: "/onboarding/v2/organisation",
  6: "/onboarding/v2/branding",
  7: "/onboarding/v2/created",
  8: "/onboarding/v2/welcome",
};

/** Onboarding ends in the portal, not on another onboarding screen. */
export function dashboardPath(orgSlug: string | null | undefined): string {
  return orgSlug ? `/portal/${orgSlug}/dashboard` : "/portal/home";
}

export const ACCOUNT_PATH = STEP_TO_PATH[1];
export const VERIFY_PATH = STEP_TO_PATH[2];
export const PLAN_PATH = STEP_TO_PATH[3];
export const BILLING_PATH = STEP_TO_PATH[4];
export const ORGANISATION_PATH = STEP_TO_PATH[5];
export const BRANDING_PATH = STEP_TO_PATH[6];
export const CREATED_PATH = STEP_TO_PATH[7];
export const WELCOME_PATH = STEP_TO_PATH[8];
export const ONB_EMAIL_KEY = "onb_email";

// First step that requires an authenticated session (org membership exists).
// Steps 1-2 are pre-auth (signup + OTP).
export const FIRST_AUTH_STEP = 3;

export function pathForStep(
  step: OnboardingStep,
  orgSlug?: string | null
): string {
  if (step === "complete") return dashboardPath(orgSlug);
  return STEP_TO_PATH[step];
}

export const PATH_TO_STEP: Record<string, OnboardingStep> = {
  [STEP_TO_PATH[1]]: 1,
  [STEP_TO_PATH[2]]: 2,
  [STEP_TO_PATH[3]]: 3,
  [STEP_TO_PATH[4]]: 4,
  [STEP_TO_PATH[5]]: 5,
  [STEP_TO_PATH[6]]: 6,
  [STEP_TO_PATH[7]]: 7,
  [STEP_TO_PATH[8]]: 8,
};

export const TOTAL_STEPS = 8;

export function displayStep(step: OnboardingStep | undefined): number {
  if (step === "complete") return TOTAL_STEPS;
  if (typeof step === "number") return Math.min(step, TOTAL_STEPS);
  return 1;
}

export function stepIndex(step: OnboardingStep): number {
  return step === "complete" ? TOTAL_STEPS + 1 : step;
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
  if (expected === undefined) return { kind: "allow" };

  if (args.progress === null) {
    if (args.pathname === ACCOUNT_PATH) return { kind: "allow" };
    if (args.pathname === VERIFY_PATH && args.hasOnbEmail) {
      return { kind: "allow" };
    }
    return { kind: "redirect", to: ACCOUNT_PATH };
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
      to: pathForStep(args.progress.step, args.progress.org_slug),
    };
  }
  return { kind: "allow" };
}
