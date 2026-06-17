// apps/web/lib/mcas/reportConstants.ts

import type {
  McasCareerVerticalCode,
  McasCoreCode,
  McasOperatingStyleCode,
} from "./reportTypes";

export const MCAS_OPERATING_STYLE_LABELS: Record<
  McasOperatingStyleCode,
  {
    code: McasOperatingStyleCode;
    label: string;
    designLabel: string;
    shortDescription: string;
    workCycleStage: string;
  }
> = {
  OS1: {
    code: "OS1",
    label: "Visionary",
    designLabel: "Trailblazer",
    shortDescription: "Moves first and creates new direction.",
    workCycleStage: "Direction Creation",
  },
  OS2: {
    code: "OS2",
    label: "Catalyst",
    designLabel: "Spark",
    shortDescription: "Creates momentum and activates movement.",
    workCycleStage: "Activation",
  },
  OS3: {
    code: "OS3",
    label: "Motivator",
    designLabel: "Uplifter",
    shortDescription: "Raises people and sustains engagement.",
    workCycleStage: "Engagement",
  },
  OS4: {
    code: "OS4",
    label: "Connector",
    designLabel: "Bridgebuilder",
    shortDescription: "Connects people, priorities, and communication.",
    workCycleStage: "Alignment",
  },
  OS5: {
    code: "OS5",
    label: "Facilitator",
    designLabel: "Steadyhand",
    shortDescription: "Protects delivery and reliable follow-through.",
    workCycleStage: "Delivery",
  },
  OS6: {
    code: "OS6",
    label: "Coordinator",
    designLabel: "Organiser",
    shortDescription: "Builds structure, process, and repeatability.",
    workCycleStage: "Structuring",
  },
  OS7: {
    code: "OS7",
    label: "Controller",
    designLabel: "Analyst",
    shortDescription: "Protects evidence, quality, and judgement.",
    workCycleStage: "Validation",
  },
  OS8: {
    code: "OS8",
    label: "Optimiser",
    designLabel: "Refiner",
    shortDescription: "Improves, sharpens, and raises standards.",
    workCycleStage: "Improvement",
  },
};

export const MCAS_CORE_LABELS: Record<
  McasCoreCode,
  {
    code: McasCoreCode;
    label: string;
    shortDescription: string;
  }
> = {
  CREATE: {
    code: "CREATE",
    label: "Create",
    shortDescription: "Initiates new direction and forward movement.",
  },
  ORGANISE: {
    code: "ORGANISE",
    label: "Organise",
    shortDescription: "Aligns people, expectations, and dependencies.",
  },
  RESOLVE: {
    code: "RESOLVE",
    label: "Resolve",
    shortDescription: "Protects delivery, consistency, and follow-through.",
  },
  EXAMINE: {
    code: "EXAMINE",
    label: "Examine",
    shortDescription: "Validates, reviews, improves, and protects quality.",
  },
};

export const MCAS_VERTICAL_LABELS: Record<
  McasCareerVerticalCode,
  {
    code: McasCareerVerticalCode;
    label: string;
    shortDescription: string;
  }
> = {
  V1: {
    code: "V1",
    label: "Entry / Foundational",
    shortDescription: "Task-level execution with guided delivery.",
  },
  V2: {
    code: "V2",
    label: "Developing",
    shortDescription: "Growing ownership with structured guidance.",
  },
  V3: {
    code: "V3",
    label: "Established",
    shortDescription: "Independent delivery and cross-team coordination.",
  },
  V4: {
    code: "V4",
    label: "Senior Scope",
    shortDescription: "Strategic influence and broader accountability.",
  },
  V5: {
    code: "V5",
    label: "Strategic Leadership",
    shortDescription: "Organisation-wide direction and accountability.",
  },
  V6: {
    code: "V6",
    label: "Executive / Enterprise",
    shortDescription: "Enterprise leadership and long-horizon strategy.",
  },
};

export function getOperatingStyleDisplayLabel(code: McasOperatingStyleCode) {
  return MCAS_OPERATING_STYLE_LABELS[code]?.designLabel ?? code;
}

export function getOperatingStyleKnowledgeLabel(code: McasOperatingStyleCode) {
  return MCAS_OPERATING_STYLE_LABELS[code]?.label ?? code;
}

export function getCoreLabel(code: McasCoreCode) {
  return MCAS_CORE_LABELS[code]?.label ?? code;
}

export function getVerticalLabel(code: McasCareerVerticalCode) {
  return MCAS_VERTICAL_LABELS[code]?.label ?? code;
}