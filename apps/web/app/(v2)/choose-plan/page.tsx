import { listOnboardingPlans } from "@/app/_lib/onboardingPlans";
import { PLAN_CARDS } from "./planContent";
import { ChoosePlanClient, type PlanCardData } from "./ChoosePlanClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Choose Plan" };

export default async function ChoosePlanPage() {
  let dbPlans: Awaited<ReturnType<typeof listOnboardingPlans>> = [];
  try {
    dbPlans = await listOnboardingPlans();
  } catch (e) {
    console.error("[choose-plan] listOnboardingPlans failed", e);
  }

  const priceByTier = new Map(dbPlans.map((p) => [p.tier, p]));

  const cards: PlanCardData[] = PLAN_CARDS.map((card) => {
    const db = priceByTier.get(card.tier);
    return {
      ...card,
      amountCents: db?.amount_cents ?? card.fallbackAmountCents,
      selectable: Boolean(db?.stripe_price_id),
    };
  });

  return <ChoosePlanClient cards={cards} />;
}
