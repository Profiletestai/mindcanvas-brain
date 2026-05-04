export type PlanTier = 1 | 2 | 3 | 4;

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
    priceLabel: "Free",
    tagline: "Try the platform with limited usage.",
    features: ["Up to 25 assessments / month", "1 admin seat", "Email support"],
  },
  {
    tier: 2,
    name: "Growth",
    priceMonthly: 49,
    priceLabel: "$49 / mo",
    tagline: "For small teams running regular reports.",
    features: ["Up to 250 assessments / month", "5 admin seats", "Custom branding"],
    highlight: true,
    disabled: true,
  },
  {
    tier: 3,
    name: "Business",
    priceMonthly: 199,
    priceLabel: "$199 / mo",
    tagline: "Scale across multiple departments.",
    features: ["Up to 2,000 assessments / month", "Unlimited seats", "Priority support"],
    disabled: true,
  },
  {
    tier: 4,
    name: "Enterprise",
    priceMonthly: 0,
    priceLabel: "Custom",
    tagline: "Bespoke usage, SSO and SLAs.",
    features: ["Unlimited assessments", "SSO + audit log", "Dedicated CSM"],
    disabled: true,
  },
];

export function getPlan(tier: PlanTier | number | null | undefined): PlanDef | null {
  if (!tier) return null;
  return PLANS.find((p) => p.tier === tier) ?? null;
}
