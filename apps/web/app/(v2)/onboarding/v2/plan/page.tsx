import { listOnboardingPlans } from "@/app/_lib/onboardingPlans";
import { getPlan, formatPriceLabel } from "../_lib/plans";
import { PlanFormClient, type PlanRow } from "./PlanFormClient";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  let dbPlans: Awaited<ReturnType<typeof listOnboardingPlans>> = [];
  try {
    dbPlans = await listOnboardingPlans();
  } catch (e) {
    console.error("[onboarding/plan] listOnboardingPlans failed", e);
  }

  const safe = Array.isArray(dbPlans) ? dbPlans : [];
  const rows: PlanRow[] = safe.flatMap((p) => {
    const meta = getPlan(p.tier);
    if (!meta) return [];
    return [
      {
        tier: p.tier,
        name: meta.name,
        tagline: meta.tagline,
        features: meta.features,
        priceLabel: formatPriceLabel({
          amount_cents: p.amount_cents,
          currency: p.currency,
          interval: p.interval,
          included_trials_per_month: p.included_trials_per_month,
        }),
      },
    ];
  });

  return <PlanFormClient plans={rows} />;
}
