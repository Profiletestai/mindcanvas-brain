//apps/web/components/billing/LegacyBillingCheckoutModal.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

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

export default function LegacyBillingCheckoutModal({
  publishableKey,
  organisationName,
  onPaymentComplete,
}: LegacyBillingCheckoutModalProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stripePromise = useMemo<Promise<Stripe | null>>(() => {
    if (!publishableKey) {
      return Promise.resolve(null);
    }

    return loadStripe(publishableKey);
  }, [publishableKey]);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    setErrorMessage(null);

    const response = await fetch("/api/billing/legacy-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
    });

    let data: CheckoutResponse;

    try {
      data = (await response.json()) as CheckoutResponse;
    } catch {
      throw new Error("The billing service returned an invalid response.");
    }

    if (!response.ok || !data.ok || !data.client_secret) {
      const message =
        data.error || "Unable to start the secure payment checkout.";

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
    window.location.reload();
  }, []);

  if (!publishableKey) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold text-slate-950">
            Billing is temporarily unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            The Stripe publishable key has not been configured for this
            environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legacy-billing-heading"
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              MindCanvas Pro
            </p>

            <h1
              id="legacy-billing-heading"
              className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl"
            >
              {isComplete
                ? "Thank you for your payment"
                : "Activate your MindCanvas subscription"}
            </h1>

            {!isComplete && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {organisationName
                  ? `${organisationName} will receive MindCanvas Pro access with 50 test usages per month.`
                  : "Your organisation will receive MindCanvas Pro access with 50 test usages per month."}
              </p>
            )}
          </div>

          {isComplete ? (
            <div className="px-6 py-12 text-center sm:px-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-7 w-7"
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

              <h2 className="mt-5 text-xl font-semibold text-slate-950">
                Your subscription has been submitted successfully
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                We are confirming your subscription with Stripe. Continue to
                refresh your organisation access.
              </p>

              <button
                type="button"
                onClick={handleContinue}
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
              >
                Continue to Portal
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r lg:p-8">
                <h2 className="text-lg font-semibold text-slate-950">
                  Pro Monthly
                </h2>

                <div className="mt-4">
                  <span className="text-4xl font-semibold tracking-tight text-slate-950">
                    US$347
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    per month
                  </span>
                </div>

                <div className="mt-7 border-t border-slate-200 pt-6">
                  <p className="text-sm font-semibold text-slate-900">
                    Included access
                  </p>

                  <ul className="mt-4 space-y-3 text-sm leading-5 text-slate-600">
                    <li className="flex gap-3">
                      <span aria-hidden="true">✓</span>
                      <span>50 test usages each month</span>
                    </li>

                    <li className="flex gap-3">
                      <span aria-hidden="true">✓</span>
                      <span>Growth Engine Diagnostic access</span>
                    </li>

                    <li className="flex gap-3">
                      <span aria-hidden="true">✓</span>
                      <span>Your organisation’s custom assessment</span>
                    </li>

                    <li className="flex gap-3">
                      <span aria-hidden="true">✓</span>
                      <span>Secure monthly subscription through Stripe</span>
                    </li>
                  </ul>
                </div>
              </aside>

              <main className="min-w-0 p-4 sm:p-6 lg:p-8">
                {errorMessage && (
                  <div
                    className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}