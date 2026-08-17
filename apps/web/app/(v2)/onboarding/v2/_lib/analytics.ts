//apps/web/app/(v2)/onboarding/v2/_lib/analytics.ts
"use client";

import { sendGAEvent } from "@next/third-parties/google";

type AnalyticsValue = string | number | boolean;

export type OnboardingAnalyticsParameters = Record<
  string,
  AnalyticsValue
>;

export function trackOnboardingEvent(
  eventName: string,
  parameters: OnboardingAnalyticsParameters = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    return;
  }

  sendGAEvent("event", eventName, parameters);
}