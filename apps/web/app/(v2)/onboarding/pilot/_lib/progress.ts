// Pilot onboarding step routing — mirrors the v2 progress lib but maps to the
// /onboarding/pilot/* paths.
import type {
  OnboardingStep,
  ProgressResponse,
} from "@/app/api/onboarding/v2/_lib/types";

// The pilot flow keeps the six-step shape the v2 flow had before payment and
// the closing screens were added to it, so it has its own step union: pilot
// orgs are complete at 6 and never reach the v2 steps 7-9.
export type PilotStep = 1 | 2 | 3 | 4 | 5 | 6;

export const STEP_TO_PATH: Record<PilotStep, string> = {
  1: "/onboarding/pilot/account",
  2: "/onboarding/pilot/verify",
  3: "/onboarding/pilot/organisation",
  4: "/onboarding/pilot/contact",
  5: "/onboarding/pilot/branding",
  6: "/onboarding/pilot/branding",
};

export const COMPLETE_PATH = "/onboarding/pilot/welcome";
export const ACCOUNT_PATH = STEP_TO_PATH[1];
export const VERIFY_PATH = STEP_TO_PATH[2];
export const ONB_EMAIL_KEY = "onb_email";

// First step that requires an authenticated session (org membership exists).
// Steps 1-2 are pre-auth (signup + OTP).
export const FIRST_AUTH_STEP = 3;

export function pathForStep(step: OnboardingStep): string {
  if (step === "complete") return COMPLETE_PATH;
  return STEP_TO_PATH[Math.min(step, TOTAL_STEPS) as PilotStep];
}

export const PATH_TO_STEP: Record<string, OnboardingStep> = {
  [STEP_TO_PATH[1]]: 1,
  [STEP_TO_PATH[2]]: 2,
  [STEP_TO_PATH[3]]: 3,
  [STEP_TO_PATH[4]]: 4,
  [STEP_TO_PATH[5]]: 5,
  [COMPLETE_PATH]: "complete",
};

export const TOTAL_STEPS = 6;

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
    return { kind: "redirect", to: pathForStep(args.progress.step) };
  }
  return { kind: "allow" };
}
