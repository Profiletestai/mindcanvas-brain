// Engine catalogue + subscription rules for onboarding step 3.
//
// Engine access is now assigned automatically from the selected plan:
// Starter -> Sales
// Pro     -> Sales + Coaching
// Niche   -> Sales + Coaching + People
//
// The Free Trial always receives Sales/GED with three submissions.

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

export const ENGINE_LIST: Engine[] = ENGINE_KEYS.map((key) => ENGINES[key]);

/** Tiers offered during onboarding. Tier 4 remains excluded. */
export const ONBOARDING_TIERS = [1, 2, 3] as const;
export type OnboardingTier = (typeof ONBOARDING_TIERS)[number];

/**
 * The authoritative engine access supplied by each paid onboarding tier.
 * Both the frontend and API use this mapping, but the API remains authoritative.
 */
export const PLAN_ENGINE_MAP: Record<
  OnboardingTier,
  readonly EngineKey[]
> = {
  1: ["sales"],
  2: ["sales", "coaching"],
  3: ["sales", "coaching", "people"],
};

/** The Free Trial is always the Sales Engine / GED. */
export const FREE_TRIAL_ENGINE: EngineKey = "sales";
export const FREE_TRIAL_TIER: OnboardingTier = 1;

/** Total completed submissions available to a Free Trial organisation. */
export const FREE_TRIAL_TEST_SUBMISSIONS = 3;

/**
 * Retained for compatibility with the existing trial-allocation helpers and
 * API response types.
 */
export const TRIAL_TESTS_PER_ENGINE = FREE_TRIAL_TEST_SUBMISSIONS;

export function isEngineKey(value: unknown): value is EngineKey {
  return (
    typeof value === "string" &&
    (ENGINE_KEYS as readonly string[]).includes(value)
  );
}

export function isOnboardingTier(
  value: unknown
): value is OnboardingTier {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (ONBOARDING_TIERS as readonly number[]).includes(value)
  );
}

/**
 * Returns a new array so callers cannot mutate the authoritative mapping.
 * Unknown tiers receive no engines.
 */
export function enginesForTier(tier: number): EngineKey[] {
  if (!isOnboardingTier(tier)) return [];
  return [...PLAN_ENGINE_MAP[tier]];
}

export function freeTrialEngines(): EngineKey[] {
  return [FREE_TRIAL_ENGINE];
}

/** Drop unknown/duplicate keys and return them in catalogue order. */
export function normalizeEngines(
  input: readonly unknown[]
): EngineKey[] {
  const seen = new Set<EngineKey>();

  for (const value of input) {
    if (isEngineKey(value)) seen.add(value);
  }

  return ENGINE_KEYS.filter((key) => seen.has(key));
}

/**
 * Same cleanup as normalizeEngines but keeps the caller's order.
 */
export function dedupeEngines(
  input: readonly unknown[]
): EngineKey[] {
  const output: EngineKey[] = [];

  for (const value of input) {
    if (isEngineKey(value) && !output.includes(value)) {
      output.push(value);
    }
  }

  return output;
}

/** Legacy recommendation helper retained for existing callers. */
export function recommendedTier(
  engineCount: number
): OnboardingTier {
  if (engineCount >= 3) return 3;
  if (engineCount === 2) return 2;
  return 1;
}

export function minimumTier(
  engineCount: number
): OnboardingTier {
  return recommendedTier(engineCount);
}

/** A tier supports its fixed engine count or fewer. */
export function isTierAllowed(
  tier: number,
  engineCount: number
): boolean {
  if (!isOnboardingTier(tier)) return false;
  return tier >= minimumTier(engineCount);
}

export const TIER_DISABLED_REASON =
  "This tier does not support the number of engines you selected.";

/**
 * Existing per-engine trial entitlement shape.
 *
 * The Free Trial path will only pass ["sales"], ensuring the total allocation
 * is exactly three GED submissions.
 */
export function trialAllocation(
  engines: readonly EngineKey[]
): Array<{
  engine: EngineKey;
  product: EngineProductCode;
  quantity: number;
}> {
  return dedupeEngines(engines).map((key) => ({
    engine: key,
    product: ENGINES[key].productCode,
    quantity: TRIAL_TESTS_PER_ENGINE,
  }));
}

export function totalTrialTests(
  engines: readonly EngineKey[]
): number {
  return (
    dedupeEngines(engines).length * TRIAL_TESTS_PER_ENGINE
  );
}

/** “Sales and Coaching” / “Sales, Coaching and People” */
export function engineListLabel(
  engines: readonly EngineKey[]
): string {
  const names = dedupeEngines(engines).map((key) =>
    ENGINES[key].name.replace(/ Engine$/, "")
  );

  if (names.length <= 1) return names[0] ?? "";

  return `${names.slice(0, -1).join(", ")} and ${
    names[names.length - 1]
  }`;
}
