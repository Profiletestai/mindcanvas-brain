// apps/web/components/billing/LegacyBillingCheckoutModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type BillingSummaryResponse = {
  ok?: boolean;
  error?: string;
  usage?: {
    allowance?: number | null;
  };
  billing?: {
    tier?: number | null;
    billing_source?: string | null;
    billing_interval?: string | null;
    included_trials_per_month?: number | null;
    plan?: {
      name?: string | null;
      interval?: string | null;
      amount_cents?: number | null;
      currency?: string | null;
    } | null;
  } | null;
};

type PlanDetails = {
  tier: number | null;
  name: string;
  interval: string | null;
  amountCents: number | null;
  currency: string | null;
  allowance: number | null;
};

function getCustomAssessmentName(organisationName?: string): string {
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

  if (name.includes("brett") || name.includes("5d leadership")) {
    return "5D Leadership";
  }

  return "Your organisation’s existing assessments";
}

function getPlanDescription(tier: number | null): string {
  if (tier === 1) {
    return "For organisations getting started with consistent profiling.";
  }

  if (tier === 2) {
    return "For organisations scaling their profiling capability.";
  }

  if (tier === 3) {
    return "For established organisations using profiling across specialist programmes.";
  }

  if (tier === 4) {
    return "For enterprise organisations with high-volume profiling requirements.";
  }

  return "Your MindCanvas subscription, configured for your organisation.";
}

function formatMoney(
  amountCents: number | null,
  currency: string | null,
  includeDecimals = false,
): string {
  if (amountCents === null || !currency) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: includeDecimals ? 2 : 0,
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(
      includeDecimals ? 2 : 0,
    )}`;
  }
}

function getIntervalSuffix(interval: string | null): string {
  if (interval === "month" || interval === "monthly") {
    return "/mo";
  }

  if (interval === "year" || interval === "annual") {
    return "/yr";
  }

  return "";
}

function getBillingCycle(interval: string | null): string {
  if (interval === "month" || interval === "monthly") {
    return "Monthly";
  }

  if (interval === "year" || interval === "annual") {
    return "Annual";
  }

  return interval
    ? interval.charAt(0).toUpperCase() + interval.slice(1)
    : "Subscription";
}

function getAllowanceLabel(allowance: number | null): string {
  return allowance === null
    ? "Unlimited test usages"
    : `${allowance} test usages per month`;
}

export default function LegacyBillingCheckoutModal({
  publishableKey,
  organisationName,
  onPaymentComplete,
}: LegacyBillingCheckoutModalProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const assessmentName = getCustomAssessmentName(organisationName);

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocumentOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/billing/summary", {
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response
          .json()
          .catch(() => null)) as BillingSummaryResponse | null;

        if (!response.ok || !data?.ok || !data.billing) {
          throw new Error(
            data?.error || "Unable to load the subscription details.",
          );
        }

        if (data.billing.billing_source !== "legacy") {
          throw new Error(
            "This organisation does not have a legacy subscription ready for activation.",
          );
        }

        if (cancelled) {
          return;
        }

        setPlan({
          tier: data.billing.tier ?? null,
          name: data.billing.plan?.name || "MindCanvas subscription",
          interval:
            data.billing.plan?.interval ??
            data.billing.billing_interval ??
            null,
          amountCents: data.billing.plan?.amount_cents ?? null,
          currency: data.billing.plan?.currency ?? null,
          allowance:
            data.billing.included_trials_per_month ??
            data.usage?.allowance ??
            null,
        });
        setPlanError(null);
      } catch (error) {
        if (!cancelled) {
          setPlanError(
            error instanceof Error
              ? error.message
              : "Unable to load the subscription details.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      body: JSON.stringify({
        presentation: "embedded",
      }),
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
            The Stripe publishable key has not been configured for this
            environment. Please contact MindCanvas support.
          </p>
        </div>
      </div>
    );
  }

  const planName = plan?.name ?? "Loading subscription details…";
  const planPrice = formatMoney(
    plan?.amountCents ?? null,
    plan?.currency ?? null,
  );
  const dueToday = formatMoney(
    plan?.amountCents ?? null,
    plan?.currency ?? null,
    true,
  );
  const intervalSuffix = getIntervalSuffix(plan?.interval ?? null);
  const billingCycle = getBillingCycle(plan?.interval ?? null);
  const allowanceLabel = getAllowanceLabel(plan?.allowance ?? null);

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
              You’re one step away from activating your {planName} workspace.
            </p>
          </div>

          {planError && (
            <div
              className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
              role="alert"
            >
              {planError} The secure Stripe checkout below remains the
              authoritative subscription amount.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
            <section className="space-y-5">
              <div className="rounded-2xl border border-[#173756] bg-[#06182a] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div>
                    <div className="mb-3 inline-flex rounded-full border border-[#1f537a] bg-[#0b2b45] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64bae2]">
                      {planName}
                    </div>

                    <h2 className="text-xl font-semibold text-white">
                      {planName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      {getPlanDescription(plan?.tier ?? null)}
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <div className="text-3xl font-semibold tracking-tight text-white">
                      {planPrice}
                      {intervalSuffix && (
                        <span className="ml-1 text-sm font-medium text-slate-400">
                          {intervalSuffix}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Billed {billingCycle.toLowerCase()}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm text-slate-300 sm:grid-cols-2">
                  <Feature>{allowanceLabel} included</Feature>

                  <Feature>{assessmentName}</Feature>

                  <Feature>Existing tests, links and reports retained</Feature>

                  <Feature>
                    Existing users and organisation access retained
                  </Feature>

                  <Feature>Existing organisation branding retained</Feature>

                  <Feature>Secure recurring billing through Stripe</Feature>
                </div>
              </div>

              <div className="rounded-2xl border border-[#173756] bg-[#06182a] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Billing breakdown
                </p>

                <div className="mt-5 space-y-4 text-sm">
                  <BillingLine
                    label={`${planName} — ${billingCycle}`}
                    value={dueToday}
                  />

                  <BillingLine
                    label={allowanceLabel}
                    value="Included"
                    valueClassName="text-emerald-400"
                  />

                  <div className="border-t border-white/10 pt-4">
                    <BillingLine
                      label="Due today"
                      value={dueToday}
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
                    Your {allowanceLabel.toLowerCase()} are included
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Your existing organisation, users, tests, links, reports and
                    branding will remain unchanged.
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
                    Your payment information is encrypted and securely processed
                    by Stripe.
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
                    <span>Secure payment • Protected by Stripe</span>
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

            <h2 className="mt-5 text-lg font-semibold">Payment successful</h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your {planName} subscription is being activated.
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-[#06182a] p-4 text-left text-sm">
              <BillingLine label="Plan" value={planName} />

              <div className="mt-3">
                <BillingLine label="Billing" value={billingCycle} />
              </div>

              <div className="mt-3">
                <BillingLine label="Charged today" value={dueToday} />
              </div>

              <div className="mt-3">
                <BillingLine label="Test usages" value={allowanceLabel} />
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#247baa] focus:outline-none focus:ring-2 focus:ring-[#64bae2] focus:ring-offset-2 focus:ring-offset-[#0a2035]"
            >
              Continue to {organisationName ?? "organisation"} portal
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </button>

            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              Portal access is released only after Stripe confirms the active
              subscription.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 text-emerald-400" aria-hidden="true">
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
      <span className={emphasised ? "text-white" : "text-slate-400"}>
        {label}
      </span>

      <span className={`shrink-0 font-medium ${valueClassName}`}>{value}</span>
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