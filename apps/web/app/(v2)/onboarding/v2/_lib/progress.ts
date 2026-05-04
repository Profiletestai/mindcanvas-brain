import type { OnboardingStep } from "@/app/api/onboarding/v2/_lib/types";

export const STEP_TO_PATH: Record<Exclude<OnboardingStep, "complete">, string> = {
  1: "/onboarding/v2/account",
  2: "/onboarding/v2/verify",
  3: "/onboarding/v2/organisation",
  4: "/onboarding/v2/contact",
  5: "/onboarding/v2/plan",
  6: "/onboarding/v2/branding",
};

export const COMPLETE_PATH = "/onboarding/v2/welcome";

export function pathForStep(step: OnboardingStep): string {
  if (step === "complete") return COMPLETE_PATH;
  return STEP_TO_PATH[step];
}

export const PATH_TO_STEP: Record<string, OnboardingStep> = {
  "/onboarding/v2/account": 1,
  "/onboarding/v2/verify": 2,
  "/onboarding/v2/organisation": 3,
  "/onboarding/v2/contact": 4,
  "/onboarding/v2/plan": 5,
  "/onboarding/v2/branding": 6,
  "/onboarding/v2/welcome": "complete",
};
