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
    designLabel: "Visionary",
    shortDescription: "Moves first and creates new direction.",
    workCycleStage: "Direction Creation",
  },
  OS2: {
    code: "OS2",
    label: "Catalyst",
    designLabel: "Catalyst",
    shortDescription: "Creates momentum and activates movement.",
    workCycleStage: "Activation",
  },
  OS3: {
    code: "OS3",
    label: "Motivator",
    designLabel: "Motivator",
    shortDescription: "Raises people and sustains engagement.",
    workCycleStage: "Engagement",
  },
  OS4: {
    code: "OS4",
    label: "Connector",
    designLabel: "Connector",
    shortDescription: "Connects people, priorities, and communication.",
    workCycleStage: "Alignment",
  },
  OS5: {
    code: "OS5",
    label: "Facilitator",
    designLabel: "Facilitator",
    shortDescription: "Protects delivery and reliable follow-through.",
    workCycleStage: "Delivery",
  },
  OS6: {
    code: "OS6",
    label: "Coordinator",
    designLabel: "Coordinator",
    shortDescription: "Builds structure, process, and repeatability.",
    workCycleStage: "Structuring",
  },
  OS7: {
    code: "OS7",
    label: "Controller",
    designLabel: "Controller",
    shortDescription: "Protects evidence, quality, and judgement.",
    workCycleStage: "Validation",
  },
  OS8: {
    code: "OS8",
    label: "Optimiser",
    designLabel: "Optimiser",
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
    displayCode: string;
    label: string;
    shortDescription: string;
  }
> = {
  V1: {
    code: "V1",
    displayCode: "CV1",
    label: "Apprentice or Student",
    shortDescription:
      "An entry-level or learning stage where work is guided closely, responsibilities are clearly defined, and progress comes through structured practice, coaching, and dependable habit-building.",
  },
  V2: {
    code: "V2",
    displayCode: "CV2",
    label: "Workforce Contributor",
    shortDescription:
      "A reliable individual-contributor stage where the focus is on consistent output, growing ownership, and delivering work independently within a defined role or function.",
  },
  V3: {
    code: "V3",
    displayCode: "CV3",
    label: "Team Lead or Junior Management",
    shortDescription:
      "A first-line leadership stage where responsibility expands into leading projects, coordinating people or workflows, and balancing personal delivery with supervision of others.",
  },
  V4: {
    code: "V4",
    displayCode: "CV4",
    label: "Middle Management",
    shortDescription:
      "A broader management stage where the role includes leading functions or teams, balancing multiple priorities, managing resources, and making decisions across a wider operational scope.",
  },
  V5: {
    code: "V5",
    displayCode: "CV5",
    label: "Senior Management",
    shortDescription:
      "A senior leadership stage with accountability across larger functions or business units, requiring strategic judgement, cross-functional leadership, and responsibility for broader organisational outcomes.",
  },
  V6: {
    code: "V6",
    displayCode: "CV6",
    label: "Executive Leadership",
    shortDescription:
      "An executive stage focused on enterprise direction, long-range decision-making, organisational stewardship, and leading at scale with the highest level of consequence and accountability.",
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

export function getCareerVerticalDisplayCode(code: McasCareerVerticalCode) {
  return MCAS_VERTICAL_LABELS[code]?.displayCode ?? code.replace(/^V/, "CV");
}

export function replaceCareerVerticalCodesForDisplay(value: string) {
  return value.replace(/\bV([1-6])\b/g, "CV$1");
}