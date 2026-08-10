import { listOnboardingPlans } from "@/app/_lib/onboardingPlans";
import { PLAN_CARDS } from "@/app/(v2)/choose-plan/planContent";
import { ONBOARDING_TIERS } from "../_lib/engines";
import { PlanClient } from "./PlanClient";
import type { TierCardData } from "./TierCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Choose your engines and plan" };

export default async function OnboardingPlanPage() {
  let monthlyPlans: Awaited<ReturnType<typeof listOnboardingPlans>> = [];
  let annualPlans: Awaited<ReturnType<typeof listOnboardingPlans>> = [];
  try {
    [monthlyPlans, annualPlans] = await Promise.all([
      listOnboardingPlans("month"),
      listOnboardingPlans("year"),
    ]);
  } catch (e) {
    console.error("[onboarding/plan] listOnboardingPlans failed", e);
  }

  const monthlyByTier = new Map(monthlyPlans.map((p) => [p.tier, p]));
  const annualByTier = new Map(annualPlans.map((p) => [p.tier, p]));

  // Tier 4 is deliberately absent from onboarding.
  const cards: TierCardData[] = PLAN_CARDS.filter((c) =>
    (ONBOARDING_TIERS as readonly number[]).includes(c.tier)
  ).map((card) => ({
    ...card,
    monthlyAmountCents:
      monthlyByTier.get(card.tier)?.amount_cents ?? card.fallbackAmountCents,
    annualAmountCents:
      annualByTier.get(card.tier)?.amount_cents ??
      card.fallbackAmountCents * 10,
  }));

  return <PlanClient cards={cards} />;
}
