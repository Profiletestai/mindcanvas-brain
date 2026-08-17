//apps/web/app/(v2)/onboarding/v2/_components/OnboardingAnalytics.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackOnboardingEvent } from "../_lib/analytics";

const ONBOARDING_SESSION_KEY =
  "mindcanvas_onboarding_analytics_started";

let lastTrackedPath: string | null = null;

const STEP_NAMES: Record<string, string> = {
  start: "onboarding_home",
  account: "account",
  verify: "email_verification",
  organisation: "organisation_details",
  diagnostic: "diagnostic",
  plan: "plan_selection",
  billing: "billing",
  created: "organisation_created",
  branding: "branding",
  welcome: "welcome",
  "book-session": "book_session",
  "session-booked": "session_booked",
};

function getOnboardingStepName(pathname: string): string {
  const onboardingPrefix = "/onboarding/v2";

  const remainingPath = pathname
    .replace(onboardingPrefix, "")
    .replace(/^\/+|\/+$/g, "");

  const firstSegment = remainingPath.split("/")[0] || "start";

  return (
    STEP_NAMES[firstSegment] ||
    firstSegment.replace(/-/g, "_")
  );
}

function hasOnboardingSessionStarted(): boolean {
  try {
    return (
      window.sessionStorage.getItem(ONBOARDING_SESSION_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
}

function markOnboardingSessionStarted() {
  try {
    window.sessionStorage.setItem(
      ONBOARDING_SESSION_KEY,
      "true",
    );
  } catch {
    // Analytics must never interrupt onboarding if storage is unavailable.
  }
}

export function OnboardingAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/onboarding/v2")) {
      return;
    }

    const stepName = getOnboardingStepName(pathname);

    if (!hasOnboardingSessionStarted()) {
      trackOnboardingEvent("onboarding_started", {
        entry_step: stepName,
        page_path: pathname,
      });

      markOnboardingSessionStarted();
    }

    if (lastTrackedPath === pathname) {
      return;
    }

    trackOnboardingEvent("onboarding_step_viewed", {
      step_name: stepName,
      page_path: pathname,
    });

    lastTrackedPath = pathname;
  }, [pathname]);

  return null;
}