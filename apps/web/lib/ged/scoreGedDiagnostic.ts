//apps/web/lib/ged/scoreGedDiagnostic.ts
export type GedChoiceAnswer = {
  question_id: string;
  question_text: string | null;
  value: string | null;
  label: string | null;
};

export type GedDiagnostics = {
  business_stage: GedChoiceAnswer | null;
  core_constraint: GedChoiceAnswer | null;
  scale_readiness: GedChoiceAnswer | null;
  self_diagnosis: string | null;
};

export type GedPriorityKey =
  | "GROWTH_ENGINE_PRIORITY"
  | "SALES_ENGINE_PRIORITY"
  | "BALANCED_ENGINE_PRIORITY"
  | "SCALE_READINESS_GAP";

export type GedImpactLevel = "low" | "moderate" | "significant" | "critical";
export type GedUrgencyLevel = "low" | "moderate" | "high";
export type GedReadinessLevel = "low" | "moderate" | "high";

export type GedOperationalImpact = {
  key:
    | "new_business_continuity"
    | "conversion"
    | "founder_dependency"
    | "delivery_capacity"
    | "team_consistency";
  label: string;
  level: GedImpactLevel;
  explanation: string;
};

export type GedActionPlanItem = {
  week: string;
  title: string;
  actions: string[];
};

export type GedEngineDiagnostic = {
  scoring_version: "ged_engine_v1";
  primary_priority: GedPriorityKey;
  priority_label: string;
  priority_summary: string;

  business_stage: {
    code: string;
    label: string;
    summary: string;
  };

  core_constraint: {
    code: string;
    label: string;
    summary: string;
  };

  scale_readiness_signal: {
    code: string;
    label: string;
    summary: string;
  };

  self_diagnosis: string | null;

  scores: {
    growth_engine: number;
    sales_engine: number;
    overall_engine: number;
    scale_readiness: number;
    founder_dependency: number;
  };

  scale_readiness_level: GedReadinessLevel;
  founder_dependency_level: GedReadinessLevel;

  primary_bottleneck: {
    code:
      | "sales_consistency_gap"
      | "delivery_consistency_gap"
      | "founder_dependency_gap"
      | "balanced_execution_gap"
      | "diagnostic_clarity_gap";
    label: string;
    summary: string;
    why_it_matters: string;
    first_fix: string;
  };

  urgency: {
    level: GedUrgencyLevel;
    label: string;
    window: string;
    summary: string;
  };

  operational_impact: GedOperationalImpact[];
  action_plan: GedActionPlanItem[];

  recommended_next_step: {
    title: string;
    summary: string;
  };

  confidence: "high" | "moderate" | "low";
};

type StageCode =
  | "FOUNDER_LED"
  | "SMALL_TEAM_BOTTLENECK"
  | "DELEGATED_PARTIAL"
  | "INCONSISTENT_TEAM"
  | "UNKNOWN";

type ConstraintCode =
  | "SALES_CONSISTENCY"
  | "DELIVERY_CONSISTENCY"
  | "FOUNDER_DEPENDENCY"
  | "UNCLEAR"
  | "UNKNOWN";

type ReadinessSignalCode =
  | "SALES_DEPENDENCY"
  | "DELIVERY_DEPENDENCY"
  | "BALANCED_DEPENDENCY"
  | "RESILIENT"
  | "UNKNOWN";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalise(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function choiceText(choice: GedChoiceAnswer | null): string {
  return normalise(`${choice?.label || ""} ${choice?.value || ""}`);
}

function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(normalise(candidate)));
}

function resolveStage(choice: GedChoiceAnswer | null): {
  code: StageCode;
  label: string;
  summary: string;
  growthBase: number;
  salesBase: number;
  founderBase: number;
} {
  const text = choiceText(choice);

  if (includesAny(text, ["still mostly delivering and selling myself"])) {
    return {
      code: "FOUNDER_LED",
      label: "Founder-led delivery and sales",
      summary:
        "You are still carrying the majority of selling and delivery yourself, which limits how much the business can grow without increasing pressure on you.",
      growthBase: 35,
      salesBase: 35,
      founderBase: 85,
    };
  }

  if (includesAny(text, ["small team but i am still the bottleneck"])) {
    return {
      code: "SMALL_TEAM_BOTTLENECK",
      label: "Small team, founder bottleneck",
      summary:
        "You have started to build support around you, but too many key decisions, sales moments or delivery escalations still return to you.",
      growthBase: 48,
      salesBase: 48,
      founderBase: 72,
    };
  }

  if (
    includesAny(text, [
      "team running parts of sales or delivery without me",
      "running parts of sales or delivery without me",
    ])
  ) {
    return {
      code: "DELEGATED_PARTIAL",
      label: "Delegated early scale",
      summary:
        "Some parts of sales or delivery can operate without you. The opportunity now is to make that independence reliable and repeatable.",
      growthBase: 78,
      salesBase: 76,
      founderBase: 28,
    };
  }

  if (includesAny(text, ["team but performance is inconsistent"])) {
    return {
      code: "INCONSISTENT_TEAM",
      label: "Team performance inconsistency",
      summary:
        "You have team capacity, but the business is not yet producing dependable sales or delivery outcomes without your intervention.",
      growthBase: 55,
      salesBase: 55,
      founderBase: 58,
    };
  }

  return {
    code: "UNKNOWN",
    label: choice?.label || choice?.value || "Business stage not captured",
    summary:
      "Your current operating stage could not be classified from the submitted response.",
    growthBase: 50,
    salesBase: 50,
    founderBase: 55,
  };
}

function resolveConstraint(choice: GedChoiceAnswer | null): {
  code: ConstraintCode;
  label: string;
  summary: string;
} {
  const text = choiceText(choice);

  if (includesAny(text, ["team does not close at my level"])) {
    return {
      code: "SALES_CONSISTENCY",
      label: "Sales consistency",
      summary:
        "Your sales outcome still depends too heavily on founder-level closing skill, judgement or follow-up discipline.",
    };
  }

  if (includesAny(text, ["client delivery is inconsistent across my team"])) {
    return {
      code: "DELIVERY_CONSISTENCY",
      label: "Delivery consistency",
      summary:
        "Your team is not yet delivering a consistently reliable client experience without more founder oversight.",
    };
  }

  if (includesAny(text, ["everything depends on me to move forward"])) {
    return {
      code: "FOUNDER_DEPENDENCY",
      label: "Founder dependency",
      summary:
        "The business still relies on you to create movement, make decisions and protect momentum across critical areas.",
    };
  }

  if (includesAny(text, ["not sure where the real bottleneck is"])) {
    return {
      code: "UNCLEAR",
      label: "Diagnostic clarity gap",
      summary:
        "The bottleneck is not yet visible enough to solve confidently. The first job is to identify where growth is actually leaking.",
    };
  }

  return {
    code: "UNKNOWN",
    label: choice?.label || choice?.value || "Constraint not captured",
    summary:
      "The primary constraint could not be classified from the submitted response.",
  };
}

function resolveReadinessSignal(choice: GedChoiceAnswer | null): {
  code: ReadinessSignalCode;
  label: string;
  summary: string;
} {
  const text = choiceText(choice);

  if (includesAny(text, ["sales would drop significantly"])) {
    return {
      code: "SALES_DEPENDENCY",
      label: "Sales reliance on the founder",
      summary:
        "Revenue continuity is exposed because sales momentum would fall away when you are not directly involved.",
    };
  }

  if (includesAny(text, ["client results would become inconsistent"])) {
    return {
      code: "DELIVERY_DEPENDENCY",
      label: "Delivery reliance on the founder",
      summary:
        "Client experience and results still depend on your direct involvement, standards or problem-solving capacity.",
    };
  }

  if (includesAny(text, ["both sales and delivery would suffer"])) {
    return {
      code: "BALANCED_DEPENDENCY",
      label: "Balanced founder dependency",
      summary:
        "Both revenue generation and delivery quality would weaken without you, signalling a broad operating-system dependency.",
    };
  }

  if (includesAny(text, ["business would run mostly fine"])) {
    return {
      code: "RESILIENT",
      label: "Early operating resilience",
      summary:
        "The business can continue operating for a period without you, which is a strong signal of emerging scale readiness.",
    };
  }

  return {
    code: "UNKNOWN",
    label: choice?.label || choice?.value || "Scale readiness not captured",
    summary:
      "The 30-day founder-dependency scenario could not be classified from the submitted response.",
  };
}

function impactFromScore(score: number): GedImpactLevel {
  if (score <= 30) return "critical";
  if (score <= 48) return "significant";
  if (score <= 67) return "moderate";
  return "low";
}

function impactFromDependency(score: number): GedImpactLevel {
  if (score >= 75) return "critical";
  if (score >= 58) return "significant";
  if (score >= 40) return "moderate";
  return "low";
}

function readinessLevel(score: number): GedReadinessLevel {
  if (score >= 72) return "high";
  if (score >= 48) return "moderate";
  return "low";
}

function makeUrgency(args: {
  scaleReadiness: number;
  founderDependency: number;
  primaryPriority: GedPriorityKey;
}): GedEngineDiagnostic["urgency"] {
  const { scaleReadiness, founderDependency, primaryPriority } = args;

  if (
    scaleReadiness < 45 ||
    founderDependency >= 75 ||
    primaryPriority === "SCALE_READINESS_GAP"
  ) {
    return {
      level: "high",
      label: "High",
      window: "Act in the next 30–60 days",
      summary:
        "The current dependency is likely to keep creating drag, inconsistency or founder overload until the operating model changes.",
    };
  }

  if (scaleReadiness < 70 || founderDependency >= 48) {
    return {
      level: "moderate",
      label: "Moderate",
      window: "Address in the next 60–90 days",
      summary:
        "The business has capacity to move forward, but the current weakness will become more expensive as the business grows.",
    };
  }

  return {
    level: "low",
    label: "Low",
    window: "Optimise over the next 90 days",
    summary:
      "There is no immediate operational failure signal. The focus is to strengthen the weakest part of the engine before the next expansion phase.",
  };
}

function buildPriority(args: {
  constraint: ConstraintCode;
  readinessSignal: ReadinessSignalCode;
  growthScore: number;
  salesScore: number;
  founderDependency: number;
}): {
  key: GedPriorityKey;
  label: string;
  summary: string;
} {
  const { constraint, readinessSignal, growthScore, salesScore, founderDependency } =
    args;

  if (readinessSignal === "BALANCED_DEPENDENCY") {
    return {
      key: "BALANCED_ENGINE_PRIORITY",
      label: "Balanced Engine Priority",
      summary:
        "Both selling and delivery are vulnerable without you. The first priority is to create an operating rhythm that protects revenue and client outcomes at the same time.",
    };
  }

  if (
    constraint === "FOUNDER_DEPENDENCY" ||
    (founderDependency >= 75 && readinessSignal !== "RESILIENT")
  ) {
    return {
      key: "SCALE_READINESS_GAP",
      label: "Scale Readiness Gap",
      summary:
        "The business is still too dependent on your direct involvement. Scaling now would increase load faster than it creates leverage.",
    };
  }

  if (
    constraint === "SALES_CONSISTENCY" ||
    readinessSignal === "SALES_DEPENDENCY" ||
    salesScore + 8 < growthScore
  ) {
    return {
      key: "SALES_ENGINE_PRIORITY",
      label: "Sales Engine Priority",
      summary:
        "The immediate risk sits in conversion, follow-up or sales ownership. Revenue needs a process that performs more consistently than founder instinct alone.",
    };
  }

  if (
    constraint === "DELIVERY_CONSISTENCY" ||
    readinessSignal === "DELIVERY_DEPENDENCY" ||
    growthScore + 8 < salesScore
  ) {
    return {
      key: "GROWTH_ENGINE_PRIORITY",
      label: "Growth Engine Priority",
      summary:
        "The business needs more dependable delivery capacity and execution structure before it can add growth without creating service strain.",
    };
  }

  return {
    key: "BALANCED_ENGINE_PRIORITY",
    label: "Balanced Engine Priority",
    summary:
      "No single engine is clearly weaker than the other. The opportunity is to strengthen the shared operating rhythm that keeps sales and delivery moving together.",
  };
}

function buildBottleneck(args: {
  priority: GedPriorityKey;
  constraint: ConstraintCode;
  readinessSignal: ReadinessSignalCode;
}): GedEngineDiagnostic["primary_bottleneck"] {
  const { priority, constraint, readinessSignal } = args;

  if (priority === "SALES_ENGINE_PRIORITY") {
    return {
      code: "sales_consistency_gap",
      label: "Sales consistency gap",
      summary:
        "Sales performance is not yet reliable without founder-level involvement. The business needs clearer conversion ownership, follow-up discipline and a repeatable close process.",
      why_it_matters:
        "When sales quality depends on one person, revenue becomes fragile and expansion creates more pressure rather than more leverage.",
      first_fix:
        "Document the current sales path, identify where deals stall and assign ownership for follow-up, qualification and close progression.",
    };
  }

  if (priority === "GROWTH_ENGINE_PRIORITY") {
    return {
      code: "delivery_consistency_gap",
      label: "Delivery consistency gap",
      summary:
        "Delivery quality is not yet protected by clear standards, ownership and operating systems across the team.",
      why_it_matters:
        "Adding more clients before delivery becomes repeatable can lower client outcomes, create founder firefighting and weaken referrals.",
      first_fix:
        "Define the three most important delivery standards, assign an owner for each and begin measuring whether clients receive the same experience without founder intervention.",
    };
  }

  if (priority === "SCALE_READINESS_GAP") {
    return {
      code: "founder_dependency_gap",
      label: "Founder dependency gap",
      summary:
        "The business needs you to create movement across too many decisions, sales moments or delivery issues. That creates a ceiling on scale.",
      why_it_matters:
        "Every additional client, initiative or team member adds more demand to the same founder bottleneck unless authority and process move outward.",
      first_fix:
        "Map the work that still routes through you, choose one decision or delivery stream to remove from your plate and give it a clear owner with boundaries.",
    };
  }

  if (constraint === "UNCLEAR" && readinessSignal === "UNKNOWN") {
    return {
      code: "diagnostic_clarity_gap",
      label: "Diagnostic clarity gap",
      summary:
        "The business has a performance issue, but the true source is not yet clear enough to solve with confidence.",
      why_it_matters:
        "Trying to fix the wrong problem creates more activity without removing the real constraint.",
      first_fix:
        "Map the current sales and delivery flow end-to-end, then identify the one hand-off, decision or stage that repeatedly slows progress.",
    };
  }

  return {
    code: "balanced_execution_gap",
    label: "Balanced execution gap",
    summary:
      "Sales and delivery both rely on you more than they should. The business needs a clearer operating rhythm before the next growth push.",
    why_it_matters:
      "When both engines are founder-dependent, growth creates more complexity faster than the team can absorb it.",
    first_fix:
      "Choose one sales responsibility and one delivery responsibility to standardise, delegate and review weekly.",
  };
}

function buildActionPlan(
  priority: GedPriorityKey
): GedActionPlanItem[] {
  switch (priority) {
    case "SALES_ENGINE_PRIORITY":
      return [
        {
          week: "Week 1",
          title: "Map the sales path",
          actions: [
            "List every step from first enquiry to signed client.",
            "Identify where leads slow down, disappear or depend on your personal follow-up.",
          ],
        },
        {
          week: "Week 2",
          title: "Create sales ownership",
          actions: [
            "Define who owns qualification, follow-up and next actions.",
            "Set a single standard for what a qualified opportunity looks like.",
          ],
        },
        {
          week: "Week 3",
          title: "Standardise conversion",
          actions: [
            "Document the core discovery, proposal and follow-up sequence.",
            "Use one shared deal-review rhythm to unblock stuck opportunities.",
          ],
        },
        {
          week: "Week 4",
          title: "Measure the new rhythm",
          actions: [
            "Track opportunities created, follow-ups completed and deals progressed.",
            "Choose one change to strengthen for the next 30 days.",
          ],
        },
      ];

    case "GROWTH_ENGINE_PRIORITY":
      return [
        {
          week: "Week 1",
          title: "Define the delivery standard",
          actions: [
            "Identify the three client outcomes that must be reliable every time.",
            "Map where delivery currently varies across people or projects.",
          ],
        },
        {
          week: "Week 2",
          title: "Build operational ownership",
          actions: [
            "Assign an accountable owner for the most fragile delivery hand-off.",
            "Write the minimum standard, decision rights and escalation path.",
          ],
        },
        {
          week: "Week 3",
          title: "Reduce founder intervention",
          actions: [
            "Remove yourself from one recurring client-delivery decision.",
            "Replace ad-hoc help with a visible checklist or operating rhythm.",
          ],
        },
        {
          week: "Week 4",
          title: "Review consistency",
          actions: [
            "Review client outcomes, delivery issues and team capacity weekly.",
            "Keep one operating change and remove one unnecessary complexity.",
          ],
        },
      ];

    case "SCALE_READINESS_GAP":
      return [
        {
          week: "Week 1",
          title: "Map founder dependency",
          actions: [
            "List the decisions, sales moments and delivery escalations that only you currently handle.",
            "Choose the one dependency creating the most drag each week.",
          ],
        },
        {
          week: "Week 2",
          title: "Clarify authority",
          actions: [
            "Define what can be decided without you and what still needs your input.",
            "Assign one clear owner for the first responsibility you are moving out of your role.",
          ],
        },
        {
          week: "Week 3",
          title: "Create a hand-off system",
          actions: [
            "Document the outcome, constraints and review point for the delegated responsibility.",
            "Let the owner run it without rescuing the process too early.",
          ],
        },
        {
          week: "Week 4",
          title: "Measure independence",
          actions: [
            "Review what still came back to you and why.",
            "Choose the next founder-dependent activity to remove over the following month.",
          ],
        },
      ];

    case "BALANCED_ENGINE_PRIORITY":
    default:
      return [
        {
          week: "Week 1",
          title: "Find the shared constraint",
          actions: [
            "Map the points where sales promises and delivery capacity stop matching.",
            "Identify the one issue creating friction across both engines.",
          ],
        },
        {
          week: "Week 2",
          title: "Create one operating rhythm",
          actions: [
            "Set a weekly sales-and-delivery review with the right owners.",
            "Agree the minimum numbers and client outcomes that must be visible each week.",
          ],
        },
        {
          week: "Week 3",
          title: "Delegate one responsibility in each engine",
          actions: [
            "Move one sales responsibility and one delivery responsibility out of founder hands.",
            "Give each owner a clear success measure and escalation route.",
          ],
        },
        {
          week: "Week 4",
          title: "Protect the new system",
          actions: [
            "Review where founder intervention still appears.",
            "Strengthen the weakest hand-off before adding new complexity or growth targets.",
          ],
        },
      ];
  }
}

function buildOperationalImpact(args: {
  growthScore: number;
  salesScore: number;
  founderDependency: number;
}): GedOperationalImpact[] {
  const { growthScore, salesScore, founderDependency } = args;

  return [
    {
      key: "new_business_continuity",
      label: "New-business continuity",
      level: impactFromScore(salesScore),
      explanation:
        "How consistently new business can keep moving when the founder is not directly creating momentum.",
    },
    {
      key: "conversion",
      label: "Conversion and follow-up",
      level: impactFromScore(salesScore),
      explanation:
        "How reliably opportunities progress from conversation to client without founder-led closing.",
    },
    {
      key: "founder_dependency",
      label: "Founder time dependency",
      level: impactFromDependency(founderDependency),
      explanation:
        "How much the business still relies on founder instinct, decisions, relationships or intervention.",
    },
    {
      key: "delivery_capacity",
      label: "Delivery capacity",
      level: impactFromScore(growthScore),
      explanation:
        "How well the business can maintain client outcomes as delivery volume increases.",
    },
    {
      key: "team_consistency",
      label: "Team consistency",
      level: impactFromScore(growthScore),
      explanation:
        "How consistently the team can execute the agreed standard without founder correction.",
    },
  ];
}

export function scoreGedDiagnostic(
  diagnostics: GedDiagnostics | null | undefined
): GedEngineDiagnostic | null {
  if (!diagnostics) return null;

  const stage = resolveStage(diagnostics.business_stage);
  const constraint = resolveConstraint(diagnostics.core_constraint);
  const readinessSignal = resolveReadinessSignal(diagnostics.scale_readiness);

  let growthScore = stage.growthBase;
  let salesScore = stage.salesBase;
  let founderDependency = stage.founderBase;

  switch (constraint.code) {
    case "SALES_CONSISTENCY":
      salesScore -= 30;
      founderDependency += 12;
      break;
    case "DELIVERY_CONSISTENCY":
      growthScore -= 30;
      founderDependency += 12;
      break;
    case "FOUNDER_DEPENDENCY":
      growthScore -= 20;
      salesScore -= 20;
      founderDependency += 22;
      break;
    case "UNCLEAR":
      growthScore -= 10;
      salesScore -= 10;
      founderDependency += 8;
      break;
    default:
      break;
  }

  switch (readinessSignal.code) {
    case "SALES_DEPENDENCY":
      salesScore -= 28;
      founderDependency += 24;
      break;
    case "DELIVERY_DEPENDENCY":
      growthScore -= 28;
      founderDependency += 22;
      break;
    case "BALANCED_DEPENDENCY":
      growthScore -= 25;
      salesScore -= 25;
      founderDependency += 28;
      break;
    case "RESILIENT":
      growthScore += 6;
      salesScore += 6;
      founderDependency -= 22;
      break;
    default:
      break;
  }

  growthScore = clamp(growthScore);
  salesScore = clamp(salesScore);
  founderDependency = clamp(founderDependency);

  const overallEngine = clamp((growthScore + salesScore) / 2);
  const scaleReadiness = clamp(
    (growthScore + salesScore + (100 - founderDependency)) / 3
  );

  const priority = buildPriority({
    constraint: constraint.code,
    readinessSignal: readinessSignal.code,
    growthScore,
    salesScore,
    founderDependency,
  });

  const bottleneck = buildBottleneck({
    priority: priority.key,
    constraint: constraint.code,
    readinessSignal: readinessSignal.code,
  });

  const urgency = makeUrgency({
    scaleReadiness,
    founderDependency,
    primaryPriority: priority.key,
  });

  const confidence: GedEngineDiagnostic["confidence"] =
    constraint.code === "UNCLEAR" ||
    stage.code === "UNKNOWN" ||
    readinessSignal.code === "UNKNOWN"
      ? "moderate"
      : "high";

  return {
    scoring_version: "ged_engine_v1",
    primary_priority: priority.key,
    priority_label: priority.label,
    priority_summary: priority.summary,

    business_stage: {
      code: stage.code,
      label: stage.label,
      summary: stage.summary,
    },

    core_constraint: {
      code: constraint.code,
      label: constraint.label,
      summary: constraint.summary,
    },

    scale_readiness_signal: {
      code: readinessSignal.code,
      label: readinessSignal.label,
      summary: readinessSignal.summary,
    },

    self_diagnosis: diagnostics.self_diagnosis?.trim() || null,

    scores: {
      growth_engine: growthScore,
      sales_engine: salesScore,
      overall_engine: overallEngine,
      scale_readiness: scaleReadiness,
      founder_dependency: founderDependency,
    },

    scale_readiness_level: readinessLevel(scaleReadiness),
    founder_dependency_level: readinessLevel(100 - founderDependency),

    primary_bottleneck: bottleneck,
    urgency,
    operational_impact: buildOperationalImpact({
      growthScore,
      salesScore,
      founderDependency,
    }),
    action_plan: buildActionPlan(priority.key),

    recommended_next_step: {
      title: "Book your Growth Engine review",
      summary:
        "Use a focused strategy session to turn this diagnostic into clear ownership, a 90-day operating plan and the next practical scale move.",
    },

    confidence,
  };
}