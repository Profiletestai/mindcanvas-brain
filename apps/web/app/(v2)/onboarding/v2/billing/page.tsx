import { Suspense } from "react";
import { listOnboardingPlans } from "@/app/_lib/onboardingPlans";
import { PLAN_CARDS } from "@/app/(v2)/choose-plan/planContent";
import { ONBOARDING_TIERS } from "../_lib/engines";
import { BillingClient, type BillingTier } from "./BillingClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contact details and payment" };

export default async function OnboardingBillingPage() {
  let dbPlans: Awaited<ReturnType<typeof listOnboardingPlans>> = [];
  try {
    dbPlans = await listOnboardingPlans();
  } catch (e) {
    console.error("[onboarding/billing] listOnboardingPlans failed", e);
  }

  const priceByTier = new Map(dbPlans.map((p) => [p.tier, p]));

  // The tier itself was fixed on step 3 — this is only the name/price lookup
  // used to render the order summary.
  const tiers: BillingTier[] = PLAN_CARDS.filter((c) =>
    (ONBOARDING_TIERS as readonly number[]).includes(c.tier)
  ).map((card) => ({
    tier: card.tier,
    name: card.name,
    tagline: card.tagline,
    amountCents:
      priceByTier.get(card.tier)?.amount_cents ?? card.fallbackAmountCents,
  }));

  return (
    // BillingClient reads ?status= from the Stripe return URL.
    <Suspense
      fallback={<div className="py-8 text-center text-white/70">Loading…</div>}
    >
      <BillingClient tiers={tiers} />
    </Suspense>
  );
}
