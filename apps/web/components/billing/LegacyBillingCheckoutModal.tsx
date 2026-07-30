// apps/web/components/billing/LegacyBillingCheckoutModal.tsx

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Stripe,
} from "@stripe/stripe-js";

type LegacyBillingCheckoutModalProps = {
  publishableKey: string;
  organisationName?: string;
  onPaymentComplete?: () => void;
};

type CheckoutResponse = {
  ok?: boolean;
  client_secret?: string;
  error?: string;
};

function getCustomAssessmentName(
  organisationName?: string
): string {
  const name = organisationName?.toLowerCase() ?? "";

  if (name.includes("focal")) {
    return "OperatingFrame™";
  }

  if (name.includes("team puzzle")) {
    return "Team Puzzle Assessment — RHYTHM Edition";
  }

  if (name.includes("competency")) {
    return "Competency Coach";
  }

  if (
    name.includes("brett") ||
    name.includes("5d leadership")
  ) {
    return "5D Leadership";
  }

  return "Your organisation’s custom assessment";
}

export default function LegacyBillingCheckoutModal({
  publishableKey,
  organisationName,
  onPaymentComplete,
}: LegacyBillingCheckoutModalProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const assessmentName =
    getCustomAssessmentName(organisationName);

  /*
   * Lock the page behind the compulsory payment screen.
   * There is deliberately no close or skip control.
   */
  useEffect(() => {
    const originalBodyOverflow =
      document.body.style.overflow;

    const originalDocumentOverflow =
      document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        originalBodyOverflow;

      document.documentElement.style.overflow =
        originalDocumentOverflow;
    };
  }, []);

  const stripePromise = useMemo<
    Promise<Stripe | null>
  >(() => {
    if (!publishableKey) {
      return Promise.resolve(null);
    }

    return loadStripe(publishableKey);
  }, [publishableKey]);

  const fetchClientSecret =
    useCallback(async (): Promise<string> => {
      setErrorMessage(null);

      const response = await fetch(
        "/api/billing/legacy-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
        }
      );

      let data: CheckoutResponse;

      try {
        data =
          (await response.json()) as CheckoutResponse;
      } catch {
        throw new Error(
          "The billing service returned an invalid response."
        );
      }

      if (
        !response.ok ||
        !data.ok ||
        !data.client_secret
      ) {
        const message =
          data.error ||
          "Unable to start the secure payment checkout.";

        setErrorMessage(message);
        throw new Error(message);
      }

      return data.client_secret;
    }, []);

  const handleComplete = useCallback(() => {
    setIsComplete(true);
    onPaymentComplete?.();
  }, [onPaymentComplete]);

  const handleContinue = useCallback(() => {
    /*
     * Reloading causes the portal layout to check the
     * Stripe status saved by the webhook. The dashboard
     * will only render once the subscription is active.
     */
    window.location.reload();
  }, []);

  if (!publishableKey) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020b16] px-5 py-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-unavailable-heading"
      >
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#071a2c] p-8 text-white shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64bae2]">
            MindCanvas Billing
          </p>

          <h1
            id="billing-unavailable-heading"
            className="mt-3 text-2xl font-semibold"
          >
            Billing is temporarily unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            The Stripe publishable key has not been
            configured for this environment. Please contact
            MindCanvas support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-[#020914]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legacy-billing-heading"
    >
      <div
        className={
          isComplete
            ? "pointer-events-none min-h-screen opacity-20"
            : "min-h-screen"
        }
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600">
                1
              </span>

              <span>Complete your subscription</span>
            </div>

            <h1
              id="legacy-billing-heading"
              className="mt-7 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              Complete your subscription
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              You’re one step away from activating your
              MindCanvas Pro workspace.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
            <section className="space-y-5">
              <div className="rounded-2xl border border-[#173756] bg-[#06182a] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div>
                    <div className="mb-3 inline-flex rounded-full border border-[#1f537a] bg-[#0b2b45] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64bae2]">
                      MindCanvas Pro
                    </div>

                    <h2 className="text-xl font-semibold text-white">
                      MindCanvas Pro
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      For organisations scaling their profiling
                      capability.
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <div className="text-3xl font-semibold tracking-tight text-white">
                      <span className="mr-1 text-sm font-medium text-slate-400">
                        US$
                      </span>
                      347
                      <span className="ml-1 text-sm font-medium text-slate-400">
                        /mo
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Billed monthly
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm text-slate-300 sm:grid-cols-2">
                  <Feature>
                    50 test usages included every month
                  </Feature>

                  <Feature>
                    Growth Engine Diagnostic access
                  </Feature>

                  <Feature>{assessmentName}</Feature>

                  <Feature>
                    Existing tests, links and reports retained
                  </Feature>

                  <Feature>
                    Existing organisation branding retained
                  </Feature>

                  <Feature>
                    Secure recurring billing through Stripe
                  </Feature>
                </div>
              </div>

              <div className="rounded-2xl border border-[#173756] bg-[#06182a] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Billing breakdown
                </p>

                <div className="mt-5 space-y-4 text-sm">
                  <BillingLine
                    label="MindCanvas Pro — Monthly"
                    value="US$347.00"
                  />

                  <BillingLine
                    label="50 monthly test usages"
                    value="Included"
                    valueClassName="text-emerald-400"
                  />

                  <div className="border-t border-white/10 pt-4">
                    <BillingLine
                      label="Due today"
                      value="US$347.00"
                      emphasised
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12.5 9.25 17 19 7"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Your 50 monthly test usages are included
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Your existing organisation, users, tests,
                    links, reports and branding will remain
                    unchanged.
                  </p>
                </div>
              </div>
            </section>

            <section className="min-w-0">
              <div className="overflow-hidden rounded-2xl border border-[#173756] bg-[#071a2c] shadow-[0_20px_70px_rgba(0,0,0,0.3)]">
                <div className="border-b border-white/10 px-6 py-5">
                  <h2 className="text-base font-semibold text-white">
                    Payment details
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Your payment information is encrypted and
                    securely processed by Stripe.
                  </p>
                </div>

                <div className="bg-white p-2 sm:p-4">
                  {errorMessage && (
                    <div
                      className="m-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      role="alert"
                    >
                      {errorMessage}
                    </div>
                  )}

                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{
                      fetchClientSecret,
                      onComplete: handleComplete,
                    }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>

                <div className="border-t border-white/10 px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                    <LockIcon />
                    <span>
                      Secure payment • Protected by Stripe
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#020914]/80 px-5 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#1c3e5d] bg-[#0a2035] p-7 text-center text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M5 12.5 9.25 17 19 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              Payment successful
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your MindCanvas Pro subscription is being
              activated.
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-[#06182a] p-4 text-left text-sm">
              <BillingLine
                label="Plan"
                value="MindCanvas Pro"
              />

              <div className="mt-3">
                <BillingLine
                  label="Billing"
                  value="Monthly"
                />
              </div>

              <div className="mt-3">
                <BillingLine
                  label="Charged today"
                  value="US$347.00"
                />
              </div>

              <div className="mt-3">
                <BillingLine
                  label="Test usages"
                  value="50 per month"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#247baa] focus:outline-none focus:ring-2 focus:ring-[#64bae2] focus:ring-offset-2 focus:ring-offset-[#0a2035]"
            >
              Continue to{" "}
              {organisationName ?? "organisation"} portal
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </button>

            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              Portal access is released only after Stripe
              confirms the active subscription.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span
        className="mt-0.5 text-emerald-400"
        aria-hidden="true"
      >
        ✓
      </span>

      <span>{children}</span>
    </div>
  );
}

function BillingLine({
  label,
  value,
  emphasised = false,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  emphasised?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        emphasised ? "text-base font-semibold" : ""
      }`}
    >
      <span
        className={
          emphasised
            ? "text-white"
            : "text-slate-400"
        }
      >
        {label}
      </span>

      <span
        className={`shrink-0 font-medium ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}