export type PlanTier = 1 | 2 | 3;

export interface PlanDef {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
  disabled?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    tier: 1,
    name: "Starter",
    priceMonthly: 0,
    priceLabel: "Free · Up to 5 users",
    tagline: "Try the platform with limited usage.",
    features: ["Up to 5 users", "Core assessments", "Email support"],
  },
  {
    tier: 2,
    name: "Growth",
    priceMonthly: 49,
    priceLabel: "$49/mo · Up to 25 users",
    tagline: "For small teams running regular reports.",
    features: ["Up to 25 users", "Custom branding", "Priority support"],
    disabled: true,
  },
  {
    tier: 3,
    name: "Enterprise",
    priceMonthly: 0,
    priceLabel: "Custom pricing",
    tagline: "Bespoke usage, SSO and SLAs.",
    features: ["Unlimited users", "SSO + audit log", "Dedicated CSM"],
    disabled: true,
  },
];

export function getPlan(tier: PlanTier | number | null | undefined): PlanDef | null {
  if (!tier) return null;
  return PLANS.find((p) => p.tier === tier) ?? null;
}
