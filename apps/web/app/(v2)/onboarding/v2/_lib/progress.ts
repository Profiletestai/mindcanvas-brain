import type {
  OnboardingStep,
  ProgressResponse,
} from "@/app/api/onboarding/v2/_lib/types";

export const STEP_TO_PATH: Record<Exclude<OnboardingStep, "complete">, string> = {
  1: "/onboarding/v2/account",
  2: "/onboarding/v2/verify",
  3: "/onboarding/v2/organisation",
  4: "/onboarding/v2/contact",
  5: "/onboarding/v2/plan",
  6: "/onboarding/v2/branding",
};

export const COMPLETE_PATH = "/onboarding/v2/welcome";
export const ACCOUNT_PATH = STEP_TO_PATH[1];
export const VERIFY_PATH = STEP_TO_PATH[2];
export const ONB_EMAIL_KEY = "onb_email";

// First step that requires an authenticated session (org membership exists).
// Steps 1-2 are pre-auth (signup + OTP).
export const FIRST_AUTH_STEP = 3;

export function pathForStep(step: OnboardingStep): string {
  if (step === "complete") return COMPLETE_PATH;
  return STEP_TO_PATH[step];
}

export const PATH_TO_STEP: Record<string, OnboardingStep> = {
  [STEP_TO_PATH[1]]: 1,
  [STEP_TO_PATH[2]]: 2,
  [STEP_TO_PATH[3]]: 3,
  [STEP_TO_PATH[4]]: 4,
  [STEP_TO_PATH[5]]: 5,
  [STEP_TO_PATH[6]]: 6,
  [COMPLETE_PATH]: "complete",
};

export const TOTAL_STEPS = 7;

export function displayStep(step: OnboardingStep | undefined): number {
  if (step === "complete") return TOTAL_STEPS;
  if (typeof step === "number") return step;
  return 1;
}

export function stepIndex(step: OnboardingStep): number {
  return step === "complete" ? TOTAL_STEPS : step;
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
    return { kind: "redirect", to: pathForStep(args.progress.step) };
  }
  return { kind: "allow" };
}
