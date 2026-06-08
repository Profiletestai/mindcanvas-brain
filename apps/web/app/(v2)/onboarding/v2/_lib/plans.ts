export type PlanTier = 1 | 2 | 3 | 4;

export interface PlanMeta {
  tier: PlanTier;
  name: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_META: Record<PlanTier, PlanMeta> = {
  1: {
    tier: 1,
    name: "Starter",
    tagline: "Best for independent consultants and coaches",
    features: ["Up to 5 users", "Core assessments", "Email support"],
  },
  2: {
    tier: 2,
    name: "Pro",
    tagline: "Best for growing service businesses",
    features: [],
  },
  3: {
    tier: 3,
    name: "Niche",
    tagline: "Best for experts building a niche authority",
    features: [],
  },
  4: {
    tier: 4,
    name: "Enterprise",
    tagline: "Best for organisations and large-scale operators",
    features: [],
  },
};

export function getPlan(tier: number | null | undefined): PlanMeta | null {
  if (tier == null) return null;
  return (PLAN_META as Record<number, PlanMeta>)[tier] ?? null;
}

export function formatPriceLabel(args: {
  amount_cents: number;
  currency: string;
  interval: "month" | "year";
  included_trials_per_month: number;
}): string {
  const { amount_cents, currency, interval, included_trials_per_month } = args;
  const major = amount_cents / 100;
  const isUsd = currency.toLowerCase() === "usd";
  const priceStr = isUsd
    ? `$${Number.isInteger(major) ? major : major.toFixed(2)}`
    : `${currency.toUpperCase()} ${Number.isInteger(major) ? major : major.toFixed(2)}`;
  const intervalShort = interval === "month" ? "mo" : "yr";
  const trialsText = `${included_trials_per_month} trials/mo`;
  return `${priceStr}/${intervalShort} · ${trialsText}`;
}
