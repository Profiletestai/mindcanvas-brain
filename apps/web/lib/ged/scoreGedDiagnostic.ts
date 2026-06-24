// apps/web/lib/ged/scoreGedDiagnostic.ts

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

/**
 * Important scope note:
 * GED v2 currently diagnoses sales reliability, delivery / operating reliability
 * and founder dependency. It does not claim to measure demand generation,
 * positioning, revenue, team size or commercial targets because those inputs
 * are not collected in the present assessment.
 */
export type GedPriorityKey =
  | "SALES_ENGINE_PRIORITY"
  | "DELIVERY_ENGINE_PRIORITY"
  | "BALANCED_ENGINE_PRIORITY"
  | "SCALE_READINESS_GAP"
  | "DIAGNOSTIC_CLARITY_GAP";

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

export type GedRoadmapPhase = {
  phase: string;
  title: string;
  summary: string;
  actions: string[];
};

export type GedEngineDiagnostic = {
  scoring_version: "ged_engine_v2";
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
    /**
     * Delivery and operating reliability. `growth_engine` is retained as an
     * alias so any legacy report code can continue to read the old field.
     */
    delivery_engine: number;
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

  response_alignment: {
    level: "high" | "moderate" | "low";
    label: string;
    summary: string;
  };

  /**
   * Kept for backwards compatibility with the initial Strategic Client Report.
   * New presentation copy should use response_alignment instead.
   */
  confidence: "high" | "moderate" | "low";

  scope_note: string;
  operational_impact: GedOperationalImpact[];
  action_plan: GedActionPlanItem[];
  ninety_day_roadmap: GedRoadmapPhase[];

  recommended_next_step: {
    title: string;
    summary: string;
  };
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

type StageProfile = {
  code: StageCode;
  label: string;
  summary: string;
  deliveryBase: number;
  salesBase: number;
  founderBase: number;
};

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

function resolveStage(choice: GedChoiceAnswer | null): StageProfile {
  const text = choiceText(choice);

  if (includesAny(text, ["still mostly delivering and selling myself"])) {
    return {
      code: "FOUNDER_LED",
      label: "Founder-led delivery and sales",
      summary:
        "You are still carrying most of the selling and delivery yourself. The immediate opportunity is to create dependable hand-offs before adding more load.",
      deliveryBase: 35,
      salesBase: 35,
      founderBase: 85,
    };
  }

  if (includesAny(text, ["small team but i am still the bottleneck"])) {
    return {
      code: "SMALL_TEAM_BOTTLENECK",
      label: "Small team, founder bottleneck",
      summary:
        "You have support around you, but key decisions, sales moments or delivery escalations still return to you too often.",
      deliveryBase: 48,
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
        "Some parts of sales or delivery can operate without you. The next job is to make that independence reliable and repeatable.",
      deliveryBase: 78,
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
      deliveryBase: 55,
      salesBase: 55,
      founderBase: 58,
    };
  }

  return {
    code: "UNKNOWN",
    label: choice?.label || choice?.value || "Business stage not captured",
    summary:
      "Your current operating stage could not be classified from the submitted response.",
    deliveryBase: 50,
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
        "Sales outcomes still depend too heavily on founder-level closing skill, judgement or follow-up discipline.",
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
        "The bottleneck is not visible enough yet to solve confidently. The first job is to identify where progress is actually leaking.",
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
        "Both revenue generation and delivery quality would weaken without you, signalling a broader operating-system dependency.",
    };
  }

  if (includesAny(text, ["business would run mostly fine"])) {
    return {
      code: "RESILIENT",
      label: "Early operating resilience",
      summary:
        "The business can continue operating for a period without you, which is a positive signal of emerging scale readiness.",
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
      "There is no immediate failure signal. Strengthen the weakest part of the operating model before the next expansion phase.",
  };
}

function buildPriority(args: {
  constraint: ConstraintCode;
  readinessSignal: ReadinessSignalCode;
  deliveryScore: number;
  salesScore: number;
  founderDependency: number;
}): {
  key: GedPriorityKey;
  label: string;
  summary: string;
} {
  const {
    constraint,
    readinessSignal,
    deliveryScore,
    salesScore,
    founderDependency,
  } = args;

  if (
    constraint === "UNCLEAR" &&
    readinessSignal === "UNKNOWN"
  ) {
    return {
      key: "DIAGNOSTIC_CLARITY_GAP",
      label: "Diagnostic Clarity Gap",
      summary:
        "The business has a performance issue, but the real constraint is not visible enough yet to solve with confidence.",
    };
  }

  if (readinessSignal === "BALANCED_DEPENDENCY") {
    return {
      key: "BALANCED_ENGINE_PRIORITY",
      label: "Balanced Engine Priority",
      summary:
        "Both sales and delivery are vulnerable without you. Build one operating rhythm that protects revenue and client outcomes together.",
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
    salesScore + 8 < deliveryScore
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
    deliveryScore + 8 < salesScore
  ) {
    return {
      key: "DELIVERY_ENGINE_PRIORITY",
      label: "Delivery Engine Priority",
      summary:
        "The immediate risk sits in delivery reliability, team execution or operating ownership. Client outcomes need a system that holds without founder correction.",
    };
  }

  return {
    key: "BALANCED_ENGINE_PRIORITY",
    label: "Balanced Engine Priority",
    summary:
      "No single engine is clearly weaker than the other. Strengthen the shared operating rhythm that keeps sales and delivery moving together.",
  };
}

function buildBottleneck(args: {
  priority: GedPriorityKey;
}): GedEngineDiagnostic["primary_bottleneck"] {
  const { priority } = args;

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

  if (priority === "DELIVERY_ENGINE_PRIORITY") {
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

  if (priority === "DIAGNOSTIC_CLARITY_GAP") {
    return {
      code: "diagnostic_clarity_gap",
      label: "Diagnostic clarity gap",
      summary:
        "The business has a performance issue, but the true source is not clear enough yet to solve with confidence.",
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

function buildActionPlan(priority: GedPriorityKey): GedActionPlanItem[] {
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

    case "DELIVERY_ENGINE_PRIORITY":
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
          title: "Build operating ownership",
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

    case "DIAGNOSTIC_CLARITY_GAP":
      return [
        {
          week: "Week 1",
          title: "Map the current flow",
          actions: [
            "Write the journey from lead to delivery in the order it actually happens.",
            "Mark every delay, rework point and founder escalation.",
          ],
        },
        {
          week: "Week 2",
          title: "Find the repeated leak",
          actions: [
            "Review the same flow with the people closest to the work.",
            "Choose one recurring issue that is visible across more than one client or opportunity.",
          ],
        },
        {
          week: "Week 3",
          title: "Test one correction",
          actions: [
            "Assign an owner and a simple measure for the selected problem.",
            "Run the change for a week before expanding it.",
          ],
        },
        {
          week: "Week 4",
          title: "Name the true priority",
          actions: [
            "Review what changed and where the founder was still required.",
            "Use the evidence to choose the next 30-day operating priority.",
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

function buildNinetyDayRoadmap(priority: GedPriorityKey): GedRoadmapPhase[] {
  switch (priority) {
    case "SALES_ENGINE_PRIORITY":
      return [
        {
          phase: "Days 1–30",
          title: "Make the sales path visible",
          summary:
            "Create one shared definition of qualification, follow-up and progression so sales movement is no longer held in the founder’s head.",
          actions: ["Map the path", "Assign visible ownership"],
        },
        {
          phase: "Days 31–60",
          title: "Coach the operating rhythm",
          summary:
            "Review live opportunities weekly, support the owners through real decisions and improve the hand-offs that keep deals moving.",
          actions: ["Run a deal-review rhythm", "Track follow-up quality"],
        },
        {
          phase: "Days 61–90",
          title: "Reduce founder-only closing",
          summary:
            "Use evidence from conversion, next actions and stalled deals to remove the next point of founder dependency.",
          actions: ["Improve the close process", "Set the next sales ownership target"],
        },
      ];

    case "DELIVERY_ENGINE_PRIORITY":
      return [
        {
          phase: "Days 1–30",
          title: "Protect the client standard",
          summary:
            "Define what good delivery must look like and make the most fragile hand-off visible to the team.",
          actions: ["Set delivery standards", "Assign the first owner"],
        },
        {
          phase: "Days 31–60",
          title: "Build repeatability",
          summary:
            "Use checklists, escalation routes and simple review points to reduce variation across clients and team members.",
          actions: ["Test the operating playbook", "Review client outcomes"],
        },
        {
          phase: "Days 61–90",
          title: "Create capacity without quality loss",
          summary:
            "Strengthen the roles, measures and decision rights that allow the business to carry more work without founder firefighting.",
          actions: ["Track capacity signals", "Remove the next founder escalation"],
        },
      ];

    case "SCALE_READINESS_GAP":
      return [
        {
          phase: "Days 1–30",
          title: "Make dependency visible",
          summary:
            "Identify the work, decisions and relationships that still depend on you to create movement.",
          actions: ["Choose one dependency", "Define the new authority"],
        },
        {
          phase: "Days 31–60",
          title: "Transfer ownership safely",
          summary:
            "Support the first owner with clear boundaries, a simple success measure and a review rhythm instead of taking the work back.",
          actions: ["Run the hand-off", "Review exceptions only"],
        },
        {
          phase: "Days 61–90",
          title: "Design the next layer",
          summary:
            "Use what you learned from the first hand-off to define the next role, process or decision stream that must move out of founder hands.",
          actions: ["Set the next delegation target", "Protect strategic time"],
        },
      ];

    case "DIAGNOSTIC_CLARITY_GAP":
      return [
        {
          phase: "Days 1–30",
          title: "Get to the source",
          summary:
            "Create visibility across the real sales and delivery flow before investing in a bigger fix.",
          actions: ["Map the flow", "Collect repeated evidence"],
        },
        {
          phase: "Days 31–60",
          title: "Test the first intervention",
          summary:
            "Make one targeted operating change and measure whether it removes friction at the point where work is actually breaking.",
          actions: ["Assign one owner", "Measure the correction"],
        },
        {
          phase: "Days 61–90",
          title: "Commit to the true priority",
          summary:
            "Use evidence rather than instinct to decide whether sales, delivery or founder dependency needs the next investment.",
          actions: ["Choose the engine priority", "Build the next 30-day plan"],
        },
      ];

    case "BALANCED_ENGINE_PRIORITY":
    default:
      return [
        {
          phase: "Days 1–30",
          title: "Create one shared view",
          summary:
            "Bring sales promises, client outcomes and founder escalation points into one weekly operating conversation.",
          actions: ["Set shared measures", "Name the weakest hand-off"],
        },
        {
          phase: "Days 31–60",
          title: "Strengthen the two engines together",
          summary:
            "Standardise one sales responsibility and one delivery responsibility so growth does not create a quality gap.",
          actions: ["Delegate two responsibilities", "Review the shared rhythm"],
        },
        {
          phase: "Days 61–90",
          title: "Protect the new operating model",
          summary:
            "Use the weekly rhythm to improve the system rather than returning to founder-led rescue mode.",
          actions: ["Track ownership", "Choose the next shared constraint"],
        },
      ];
  }
}

function buildOperationalImpact(args: {
  deliveryScore: number;
  salesScore: number;
  founderDependency: number;
}): GedOperationalImpact[] {
  const { deliveryScore, salesScore, founderDependency } = args;

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
      level: impactFromScore(deliveryScore),
      explanation:
        "How well the business can maintain client outcomes as delivery volume increases.",
    },
    {
      key: "team_consistency",
      label: "Team consistency",
      level: impactFromScore(deliveryScore),
      explanation:
        "How consistently the team can execute the agreed standard without founder correction.",
    },
  ];
}

function buildResponseAlignment(args: {
  constraint: ConstraintCode;
  readinessSignal: ReadinessSignalCode;
}): GedEngineDiagnostic["response_alignment"] {
  const { constraint, readinessSignal } = args;

  if (
    (constraint === "SALES_CONSISTENCY" &&
      readinessSignal === "SALES_DEPENDENCY") ||
    (constraint === "DELIVERY_CONSISTENCY" &&
      readinessSignal === "DELIVERY_DEPENDENCY") ||
    (constraint === "FOUNDER_DEPENDENCY" &&
      readinessSignal === "BALANCED_DEPENDENCY")
  ) {
    return {
      level: "high",
      label: "High response alignment",
      summary:
        "Your selected answers point clearly to the same immediate operating priority.",
    };
  }

  if (
    constraint === "UNKNOWN" ||
    readinessSignal === "UNKNOWN" ||
    constraint === "UNCLEAR"
  ) {
    return {
      level: "low",
      label: "Low response alignment",
      summary:
        "Your answers show an operating concern, but more detail is needed before treating one issue as the clear priority.",
    };
  }

  return {
    level: "moderate",
    label: "Moderate response alignment",
    summary:
      "Your answers identify a credible priority, with some overlap across sales, delivery or founder dependency to examine in the next review.",
  };
}

export function scoreGedDiagnostic(
  diagnostics: GedDiagnostics | null | undefined
): GedEngineDiagnostic | null {
  if (!diagnostics) return null;

  const stage = resolveStage(diagnostics.business_stage);
  const constraint = resolveConstraint(diagnostics.core_constraint);
  const readinessSignal = resolveReadinessSignal(diagnostics.scale_readiness);

  let deliveryScore = stage.deliveryBase;
  let salesScore = stage.salesBase;
  let founderDependency = stage.founderBase;

  switch (constraint.code) {
    case "SALES_CONSISTENCY":
      salesScore -= 30;
      founderDependency += 12;
      break;
    case "DELIVERY_CONSISTENCY":
      deliveryScore -= 30;
      founderDependency += 12;
      break;
    case "FOUNDER_DEPENDENCY":
      deliveryScore -= 20;
      salesScore -= 20;
      founderDependency += 22;
      break;
    case "UNCLEAR":
      deliveryScore -= 10;
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
      deliveryScore -= 28;
      founderDependency += 22;
      break;
    case "BALANCED_DEPENDENCY":
      deliveryScore -= 25;
      salesScore -= 25;
      founderDependency += 28;
      break;
    case "RESILIENT":
      deliveryScore += 6;
      salesScore += 6;
      founderDependency -= 22;
      break;
    default:
      break;
  }

  deliveryScore = clamp(deliveryScore);
  salesScore = clamp(salesScore);
  founderDependency = clamp(founderDependency);

  const overallEngine = clamp((deliveryScore + salesScore) / 2);
  const scaleReadiness = clamp(
    (deliveryScore + salesScore + (100 - founderDependency)) / 3
  );

  const priority = buildPriority({
    constraint: constraint.code,
    readinessSignal: readinessSignal.code,
    deliveryScore,
    salesScore,
    founderDependency,
  });

  const bottleneck = buildBottleneck({ priority: priority.key });
  const urgency = makeUrgency({
    scaleReadiness,
    founderDependency,
    primaryPriority: priority.key,
  });
  const responseAlignment = buildResponseAlignment({
    constraint: constraint.code,
    readinessSignal: readinessSignal.code,
  });

  return {
    scoring_version: "ged_engine_v2",
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

    self_diagnosis: diagnostics.self_diagnosis || null,

    scores: {
      delivery_engine: deliveryScore,
      growth_engine: deliveryScore,
      sales_engine: salesScore,
      overall_engine: overallEngine,
      scale_readiness: scaleReadiness,
      founder_dependency: founderDependency,
    },

    scale_readiness_level: readinessLevel(scaleReadiness),
    founder_dependency_level: readinessLevel(100 - founderDependency),

    primary_bottleneck: bottleneck,
    urgency,
    response_alignment: responseAlignment,
    confidence: responseAlignment.level,

    scope_note:
      "This focused diagnostic assesses sales reliability, delivery and operating capacity, and founder dependency. It does not estimate revenue, demand generation, positioning, team size or commercial targets.",

    operational_impact: buildOperationalImpact({
      deliveryScore,
      salesScore,
      founderDependency,
    }),

    action_plan: buildActionPlan(priority.key),
    ninety_day_roadmap: buildNinetyDayRoadmap(priority.key),

    recommended_next_step: {
      title: "Book your Growth Engine review",
      summary:
        "Use a focused strategy session to turn this diagnosis into clear ownership, a 90-day operating plan and the next practical move.",
    },
  };
}