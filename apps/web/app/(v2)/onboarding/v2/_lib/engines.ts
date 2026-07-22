// Engine catalogue + subscription rules for onboarding step 3.
// Shared by the client screen and the API routes — the backend recomputes the
// recommended/minimum tier and the trial allocation from the engine list and
// never trusts the values the browser submits.

export const ENGINE_KEYS = ["sales", "coaching", "people"] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];

export type EngineProductCode = "GED" | "MPS" | "MCAS";

export type Engine = {
  key: EngineKey;
  name: string;
  productCode: EngineProductCode;
  productName: string;
  description: string;
};

// Display names may change; the keys are the permanent internal identifiers.
export const ENGINES: Record<EngineKey, Engine> = {
  sales: {
    key: "sales",
    name: "Sales Engine",
    productCode: "GED",
    productName: "Growth Engine Diagnostic",
    description:
      "Diagnose the strategic, behavioural and mindset factors affecting business growth. GED helps founders, sales teams and growth-focused businesses identify their strongest growth drivers, key constraints and strategic priorities.",
  },
  coaching: {
    key: "coaching",
    name: "Coaching Engine",
    productCode: "MPS",
    productName: "MPS",
    description:
      "Give coaches a structured way to understand how clients think, communicate, make decisions and take action. MPS supports more personalised coaching conversations, development plans and client insights.",
  },
  people: {
    key: "people",
    name: "People Engine",
    productCode: "MCAS",
    productName: "MindCanvas Alignment System",
    description:
      "Understand how people naturally operate, where they are most likely to thrive and how well they align with a role or organisation. MCAS supports recruitment, team development and people decisions.",
  },
};

export const ENGINE_LIST: Engine[] = ENGINE_KEYS.map((k) => ENGINES[k]);

/** Free trial tests granted per selected engine (not per tier). */
export const TRIAL_TESTS_PER_ENGINE = 3;

/** Tiers offered during onboarding. Tier 4 is intentionally excluded. */
export const ONBOARDING_TIERS = [1, 2, 3] as const;
export type OnboardingTier = (typeof ONBOARDING_TIERS)[number];

export function isEngineKey(v: unknown): v is EngineKey {
  return typeof v === "string" && (ENGINE_KEYS as readonly string[]).includes(v);
}

/** Drop unknown/duplicate keys and return them in catalogue order. */
export function normalizeEngines(input: readonly unknown[]): EngineKey[] {
  const seen = new Set<EngineKey>();
  for (const v of input) if (isEngineKey(v)) seen.add(v);
  return ENGINE_KEYS.filter((k) => seen.has(k));
}

/** 1 engine -> tier 1, 2 -> tier 2, 3 -> tier 3. Also the minimum tier. */
export function recommendedTier(engineCount: number): OnboardingTier {
  if (engineCount >= 3) return 3;
  if (engineCount === 2) return 2;
  return 1;
}

export function minimumTier(engineCount: number): OnboardingTier {
  return recommendedTier(engineCount);
}

/** A tier is selectable when it supports the number of engines chosen. */
export function isTierAllowed(tier: number, engineCount: number): boolean {
  if (!(ONBOARDING_TIERS as readonly number[]).includes(tier)) return false;
  return tier >= minimumTier(engineCount);
}

export const TIER_DISABLED_REASON =
  "This tier does not support the number of engines you selected.";

/** Per-engine trial entitlement — kept separate so trials cannot be pooled. */
export function trialAllocation(
  engines: readonly EngineKey[]
): Array<{ engine: EngineKey; product: EngineProductCode; quantity: number }> {
  return normalizeEngines(engines).map((key) => ({
    engine: key,
    product: ENGINES[key].productCode,
    quantity: TRIAL_TESTS_PER_ENGINE,
  }));
}

export function totalTrialTests(engines: readonly EngineKey[]): number {
  return normalizeEngines(engines).length * TRIAL_TESTS_PER_ENGINE;
}

/** "Sales and Coaching" / "Sales, Coaching and People" */
export function engineListLabel(engines: readonly EngineKey[]): string {
  const names = normalizeEngines(engines).map((k) =>
    ENGINES[k].name.replace(/ Engine$/, "")
  );
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
