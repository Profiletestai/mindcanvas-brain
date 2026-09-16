// One place for every tracked action on the site.
// Fires to GA4 via gtag AND pushes to dataLayer for GTM, so it works
// whichever you end up using. Safe to call server-side or before the
// tag loads: it no-ops instead of throwing.

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Object[];
  }
}

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;

  const payload = { ...params, sent_at: new Date().toISOString() };

  try {
    window.gtag?.("event", event, payload);
  } catch {
    /* no-op */
  }

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...payload });
  } catch {
    /* no-op */
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[track]", event, payload);
  }
}

/* ------------------------------------------------------------------ *
 * Event names. Use these constants, never raw strings, so the set
 * stays closed and GA4 reports do not fill up with typos.
 * ------------------------------------------------------------------ */

export const EV = {
  // Every button and link on the site
  CTA_CLICK: "cta_click",

  // Start Free Trial (direct to onboarding)
  TRIAL_START_CLICK: "trial_start_click",
  TRIAL_SUBMIT: "trial_submit",
  TRIAL_SUBMIT_ERROR: "trial_submit_error",

  // Calculator
  CALC_FIRST_INPUT: "calc_first_input",
  CALC_RESULT_SHOWN: "calc_result_shown",
  CALC_CTA_CLICK: "calc_cta_click",

  // Onboarding, fired from profiletest.app
  ONBOARDING_STEP_VIEW: "onboarding_step_view",
  ONBOARDING_COMPLETE: "onboarding_complete",
  FIRST_TEST_SENT: "first_test_sent",
} as const;

/** CTA placement on the page (utm_content + analytics). */
export type CtaLocation =
  | "nav"
  | "hero"
  | "calculator"
  | "pricing"
  | "footer"
  | "profiling"
  | "how"
  | "offer"
  | "who"
  | "engines"
  | "final"
  | "products"
  | "plan"
  | "demo"
  | "mcas"
  | "bip"
  | "app"
  | "media"
  | "neuro_nav"
  | "neuro_calculator"
  | "neuro_profiling"
  | "neuro_how"
  | "neuro_offer"
  | "neuro_who"
  | "neuro_pricing"
  | "neuro_engines"
  | "neuro_final";

/**
 * Helper for CTA clicks. Call from every button.
 *   trackCta('start_trial', 'Start Free Trial', 'hero', href)
 */
export function trackCta(
  id: string,
  label: string,
  location: string,
  destination?: string,
) {
  track(EV.CTA_CLICK, {
    cta_id: id,
    cta_label: label,
    cta_location: location,
    cta_destination: destination,
  });
}
