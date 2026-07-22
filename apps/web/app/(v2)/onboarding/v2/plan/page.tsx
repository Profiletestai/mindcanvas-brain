import { listOnboardingPlans } from "@/app/_lib/onboardingPlans";
import { PLAN_CARDS } from "@/app/(v2)/choose-plan/planContent";
import { ONBOARDING_TIERS } from "../_lib/engines";
import { PlanClient } from "./PlanClient";
import type { TierCardData } from "./TierCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Choose your engines and plan" };

export default async function OnboardingPlanPage() {
  let dbPlans: Awaited<ReturnType<typeof listOnboardingPlans>> = [];
  try {
    dbPlans = await listOnboardingPlans();
  } catch (e) {
    console.error("[onboarding/plan] listOnboardingPlans failed", e);
  }

  const priceByTier = new Map(dbPlans.map((p) => [p.tier, p]));

  // Tier 4 is deliberately absent from onboarding.
  const cards: TierCardData[] = PLAN_CARDS.filter((c) =>
    (ONBOARDING_TIERS as readonly number[]).includes(c.tier)
  ).map((card) => ({
    ...card,
    amountCents: priceByTier.get(card.tier)?.amount_cents ?? card.fallbackAmountCents,
  }));

  return <PlanClient cards={cards} />;
}
