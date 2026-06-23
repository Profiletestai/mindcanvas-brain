import "server-only";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export type OnboardingPlan = {
  tier: number;
  tier_definition_id: string;
  amount_cents: number;
  currency: string;
  interval: "month" | "year";
  included_trials_per_month: number;
  extra_trials_cap: number | null;
  stripe_price_id: string | null;
};

export async function listOnboardingPlans(): Promise<OnboardingPlan[]> {
  const admin = portalAdmin();

  const { data: priceRows, error: priceErr } = await admin
    .from("tier_prices")
    .select("tier_definition_id, amount_cents, currency, interval, stripe_price_id")
    .eq("billing_type", "owner")
    .eq("active", true)
    .eq("interval", "month")
    .gt("amount_cents", 0)
    .not("tier_definition_id", "is", null);
  if (priceErr) {
    console.error("[onboardingPlans] tier_prices query failed", priceErr);
    throw priceErr;
  }

  const prices = (priceRows ?? []) as Array<{
    tier_definition_id: string;
    amount_cents: number;
    currency: string;
    interval: "month" | "year";
    stripe_price_id: string | null;
  }>;
  if (prices.length === 0) return [];

  const defIds = Array.from(new Set(prices.map((p) => p.tier_definition_id)));

  const { data: defRows, error: defErr } = await admin
    .from("tier_definitions")
    .select("id, tier, included_trials_per_month, extra_trials_cap")
    .in("id", defIds)
    .is("valid_until", null);
  if (defErr) {
    console.error("[onboardingPlans] tier_definitions query failed", defErr);
    throw defErr;
  }

  const defs = (defRows ?? []) as Array<{
    id: string;
    tier: number;
    included_trials_per_month: number;
    extra_trials_cap: number | null;
  }>;
  const defById = new Map(defs.map((d) => [d.id, d]));

  const merged: OnboardingPlan[] = [];
  for (const price of prices) {
    const def = defById.get(price.tier_definition_id);
    if (!def) continue;
    merged.push({
      tier: def.tier,
      tier_definition_id: def.id,
      amount_cents: price.amount_cents,
      currency: price.currency,
      interval: price.interval,
      included_trials_per_month: def.included_trials_per_month,
      extra_trials_cap: def.extra_trials_cap,
      stripe_price_id: price.stripe_price_id,
    });
  }

  merged.sort((a, b) => a.tier - b.tier);
  return merged;
}
