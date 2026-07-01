// apps/web/lib/testModels.ts
// Display metadata for known profiling models. Matched against a test's name
// so the Tests grid and the create-link modal can show the design copy while
// staying driven by the org's real tests.

export type ModelMeta = {
  category: string;
  description: string;
  bestFor: string;
  output: string;
};

const MODEL_CATALOG: { match: RegExp; meta: ModelMeta }[] = [
  {
    match: /entrepreneur/i,
    meta: {
      category: "Predictive Sales Intelligence",
      description:
        "A sales and growth model for entrepreneurs and business owners.",
      bestFor: "Understanding how someone thinks, decides, buys, and grows.",
      output: "Strategic Growth Report",
    },
  },
  {
    match: /leader/i,
    meta: {
      category: "Predictive Leadership Intelligence",
      description:
        "A leadership-focused model for managers, executives, and decision makers.",
      bestFor:
        "Understanding leadership flow, pressure, decision-making, and career growth.",
      output: "Strategic Career Growth Report",
    },
  },
  {
    match: /growth\s*engine|growth\s*diagnostic/i,
    meta: {
      category: "Predictive Growth Intelligence",
      description:
        "A business growth diagnostic that looks at the gap between sales, delivery, and growth capacity.",
      bestFor:
        "Business owners who want to understand what is helping or blocking growth.",
      output: "Growth Diagnostic Report",
    },
  },
  {
    match: /lead\s*\/?\s*mps|\bmps\b|coaching/i,
    meta: {
      category: "Predictive Coaching Intelligence",
      description:
        "A coaching and development model for understanding how people contribute, communicate, decide, and perform.",
      bestFor:
        "Leadership development, coaching, team conversations, and performance support.",
      output: "Coaching & Development Profile",
    },
  },
  {
    match: /\bmcas\b|team\s*design/i,
    meta: {
      category: "Predictive Team Design Intelligence",
      description:
        "A model for recruitment, training, team design, and team operations.",
      bestFor:
        "Understanding role fit, team fit, operating style, and career verticals.",
      output: "Candidate, team, or role-fit insight",
    },
  },
];

const FALLBACK_META: ModelMeta = {
  category: "Predictive Intelligence",
  description: "A profiling model available to your organisation.",
  bestFor: "Understanding how people think, decide, and perform.",
  output: "Profile Report",
};

export function metaFor(name: string): ModelMeta {
  const hit = MODEL_CATALOG.find((m) => m.match.test(name || ""));
  return hit ? hit.meta : FALLBACK_META;
}
