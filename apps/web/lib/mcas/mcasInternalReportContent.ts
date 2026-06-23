// apps/web/lib/mcas/mcasInternalReportContent.ts

import type {
  McasCoreCode,
  McasOperatingStyleCode,
  McasReportPayload,
} from "./reportTypes";

export type McasInternalRiskLevel = "low" | "moderate" | "high";

export type McasInternalRisk = {
  title: string;
  detail: string;
  level: McasInternalRiskLevel;
};

export type McasInternalInterviewFocus = {
  title: string;
  question: string;
};

type OperatingStyleContent = {
  systemFunction: string;
  executionSummary: string;
  environmentSummary: string;
  strengths: [string, string, string];
  risks: [
    Omit<McasInternalRisk, "level">,
    Omit<McasInternalRisk, "level">
  ];
  executionInterview: McasInternalInterviewFocus;
  pressureInterview: McasInternalInterviewFocus;
};

export type McasInternalReportContent = {
  primary: {
    code: McasOperatingStyleCode;
    label: string;
    systemFunction: string;
    executionSummary: string;
    environmentSummary: string;
    strengths: string[];
  };
  secondarySummary: string | null;
  executiveSummary: string;
  coreSummary: string;
  risks: McasInternalRisk[];
  interviewFocus: McasInternalInterviewFocus[];
};

const STYLE_CONTENT: Record<McasOperatingStyleCode, OperatingStyleContent> = {
  OS1: {
    systemFunction: "Initiates first direction before full certainty exists.",
    executionSummary:
      "This candidate is most likely to create value by sensing opportunity early, forming an initial direction and creating movement before inertia becomes embedded. Their contribution is strongest when work needs a start, a test or a new path forward.",
    environmentSummary:
      "Most sustainable in growth, innovation, change or ambiguous environments where an early directional force is needed and delivery capacity can support the pace of movement.",
    strengths: [
      "Opportunity sensing — notices gaps, possibilities and emerging openings early.",
      "Direction creation — forms an initial path when the current route is unclear or insufficient.",
      "Momentum initiation — starts useful movement before delay becomes embedded.",
    ],
    risks: [
      {
        title: "Direction overload",
        detail:
          "May open more routes, ideas or initiatives than the surrounding system can absorb. Validate prioritisation and the ability to close or pause lower-value work.",
      },
      {
        title: "Completion hand-off",
        detail:
          "May lose energy when work becomes repetitive, operational or maintenance-led. Validate clean ownership transfer, follow-through and accountability after the initial launch.",
      },
    ],
    executionInterview: {
      title: "Prioritisation discipline",
      question:
        "Describe a time you identified several possible opportunities at once. How did you decide which direction deserved commitment, and what did you deliberately stop or defer?",
    },
    pressureInterview: {
      title: "Operational hand-off",
      question:
        "Tell us about an initiative you started that required other people to deliver the next phase. How did you create clarity, ownership and follow-through after the initial momentum?",
    },
  },
  OS2: {
    systemFunction: "Activates attention, energy and buy-in around a direction.",
    executionSummary:
      "This candidate is most likely to create value through activation: making an opportunity visible, building belief and helping people move from awareness into action. Their pattern is strongest where adoption, communication, launch or commercial momentum matter.",
    environmentSummary:
      "Most sustainable in visible, responsive environments where communication, persuasion, adoption and momentum are required alongside clear delivery ownership.",
    strengths: [
      "Activation — creates attention and interest around a useful direction.",
      "Amplification — expands the reach and visibility of an idea, message or offer.",
      "Mobilisation — helps people convert awareness into practical action.",
    ],
    risks: [
      {
        title: "Energy without delivery",
        detail:
          "May create movement faster than the operational system can support. Validate the ability to coordinate with delivery owners and maintain focus after the launch phase.",
      },
      {
        title: "Response dependency",
        detail:
          "May over-prioritise visibility, immediate feedback or external response. Validate judgement and persistence when progress is quieter or less immediately rewarding.",
      },
    ],
    executionInterview: {
      title: "Sustained activation",
      question:
        "Describe a campaign, launch or change effort where you had to move people from interest into sustained action. What evidence showed that attention became real adoption?",
    },
    pressureInterview: {
      title: "Delivery partnership",
      question:
        "Tell us about a time momentum was high but delivery capacity was constrained. How did you adjust the message, priorities or pace without losing trust?",
    },
  },
  OS3: {
    systemFunction: "Sustains morale, trust and human commitment through the work.",
    executionSummary:
      "This candidate is most likely to create value by strengthening engagement, trust and team commitment. Their contribution is strongest when progress depends on people staying connected, supported and willing to carry the work through pressure.",
    environmentSummary:
      "Most sustainable in people-centred environments that value trust, team health and sustained engagement while maintaining clear accountability and performance expectations.",
    strengths: [
      "Human commitment — builds the trust that keeps people engaged in demanding work.",
      "Morale resilience — helps teams sustain energy through uncertainty or pressure.",
      "Relational support — notices when connection, confidence or belonging is affecting execution.",
    ],
    risks: [
      {
        title: "Harmony over accountability",
        detail:
          "May protect relationships at the expense of naming a difficult performance, ownership or behavioural issue. Validate directness when standards must be upheld.",
      },
      {
        title: "Emotional load absorption",
        detail:
          "May carry more team emotion or support responsibility than is sustainable. Validate boundary-setting and escalation when support needs exceed role capacity.",
      },
    ],
    executionInterview: {
      title: "Accountability under tension",
      question:
        "Describe a time you had to address a difficult performance or behaviour issue with someone you cared about. How did you protect both clarity and the relationship?",
    },
    pressureInterview: {
      title: "Boundary management",
      question:
        "Tell us about a period when a team was under emotional pressure. What did you take responsibility for, and what did you escalate or share rather than carrying alone?",
    },
  },
  OS4: {
    systemFunction: "Aligns people, expectations and dependencies across work.",
    executionSummary:
      "This candidate is most likely to create value by connecting people, priorities and information across boundaries. Their execution tends to move through relationships, trust, timing and clear stakeholder alignment rather than through force or structural enforcement alone.",
    environmentSummary:
      "Most sustainable in collaborative, cross-functional and multi-stakeholder environments with clear goals, trusted ownership and flexibility in how alignment is created.",
    strengths: [
      "Cross-functional alignment — naturally bridges teams, priorities and communication.",
      "Relational execution — uses trust as a practical mechanism for moving work forward.",
      "Communication clarity — translates complexity into workable direction for different stakeholders.",
    ],
    risks: [
      {
        title: "Authority understatement",
        detail:
          "May avoid taking a clear directional position when one is needed. In high-stakes moments, the desire to preserve harmony can be interpreted as indecision.",
      },
      {
        title: "Silent overload absorption",
        detail:
          "May absorb relational and organisational complexity without flagging it early. Validate scope boundaries, escalation habits and the ability to name dependency risk.",
      },
    ],
    executionInterview: {
      title: "Authority pattern",
      question:
        "Describe a situation where you had to make a high-stakes decision with limited consensus. How did you communicate your position and move the work forward?",
    },
    pressureInterview: {
      title: "Cross-functional execution",
      question:
        "Describe a complex project with competing priorities across multiple teams. How did you establish alignment, manage dependencies and drive it to completion?",
    },
  },
  OS5: {
    systemFunction: "Protects reliable delivery and consistency.",
    executionSummary:
      "This candidate is most likely to create value through dependable execution, steady follow-through and practical delivery discipline. Their contribution is strongest when a system needs consistency, calm prioritisation and work that can be trusted to get finished.",
    environmentSummary:
      "Most sustainable in roles with clear outputs, stable operating rhythms and practical accountability, while still giving enough room to adapt when delivery conditions change.",
    strengths: [
      "Reliable delivery — creates confidence through consistent follow-through.",
      "Operational steadiness — maintains practical momentum when conditions become noisy or pressured.",
      "Priority discipline — keeps attention on the work that must be completed.",
    ],
    risks: [
      {
        title: "Change resistance through reliability",
        detail:
          "May protect established delivery rhythms so strongly that necessary change is delayed. Validate adaptability when the current system is no longer fit for purpose.",
      },
      {
        title: "Capacity overextension",
        detail:
          "May keep taking on practical work to protect the team from disruption. Validate workload boundaries, delegation and early signalling when delivery risk is rising.",
      },
    ],
    executionInterview: {
      title: "Adaptation under change",
      question:
        "Describe a time an established process stopped working. How did you adapt the delivery approach while protecting reliability for customers, colleagues or stakeholders?",
    },
    pressureInterview: {
      title: "Capacity and escalation",
      question:
        "Tell us about a period of sustained workload pressure. How did you decide what to protect, what to delegate and when to escalate a delivery risk?",
    },
  },
  OS6: {
    systemFunction: "Builds structure, process and repeatability.",
    executionSummary:
      "This candidate is most likely to create value by turning recurring work into clear systems, operating rhythms and dependable coordination. Their contribution is strongest when a team needs structure that makes delivery more repeatable and scalable.",
    environmentSummary:
      "Most sustainable in environments where process ownership, sequencing and coordination matter, provided the organisation allows structure to evolve as conditions change.",
    strengths: [
      "System building — turns ambiguity into practical processes and rhythms.",
      "Coordination — aligns tasks, ownership, timing and dependencies across work.",
      "Repeatability — creates frameworks that make delivery less dependent on individual memory.",
    ],
    risks: [
      {
        title: "Structure before judgement",
        detail:
          "May reach for process before the real problem, context or people needs are fully understood. Validate the ability to adapt structure to the work rather than imposing it.",
      },
      {
        title: "Rigidity under change",
        detail:
          "May experience friction when priorities shift quickly or the process is repeatedly interrupted. Validate flexibility and decision-making in ambiguous conditions.",
      },
    ],
    executionInterview: {
      title: "Adaptive systems thinking",
      question:
        "Describe a process you built that later had to change because the context shifted. How did you decide what to keep, what to remove and how to bring others with you?",
    },
    pressureInterview: {
      title: "Ambiguity and prioritisation",
      question:
        "Tell us about a situation where there was no clear process to follow. How did you create enough structure to move forward without over-engineering the work?",
    },
  },
  OS7: {
    systemFunction: "Protects evidence, quality, risk and judgement.",
    executionSummary:
      "This candidate is most likely to create value by testing assumptions, protecting standards and improving decision quality. Their contribution is strongest where evidence, responsible judgement, risk control and clear criteria matter.",
    environmentSummary:
      "Most sustainable in roles that value rigour, independent judgement and quality control, while providing clear decision rights so analysis can lead to action.",
    strengths: [
      "Evidence protection — brings facts, criteria and validation into important decisions.",
      "Risk visibility — notices exposure, inconsistency or weak assumptions before they become costly.",
      "Quality judgement — protects standards when speed or pressure could otherwise reduce care.",
    ],
    risks: [
      {
        title: "Analysis drag",
        detail:
          "May continue reviewing when the decision requires a time-bound commitment. Validate the ability to distinguish essential evidence from further reassurance-seeking.",
      },
      {
        title: "Control bottleneck",
        detail:
          "May become the quality gate for too much work. Validate delegation of review responsibility and the ability to set proportionate controls.",
      },
    ],
    executionInterview: {
      title: "Decision under uncertainty",
      question:
        "Describe a decision where the evidence was incomplete but action was still required. How did you decide what was sufficient to proceed, and how did you manage the remaining risk?",
    },
    pressureInterview: {
      title: "Proportionate control",
      question:
        "Tell us about a time quality or risk standards were important but time was limited. How did you decide which checks were essential and which could wait?",
    },
  },
  OS8: {
    systemFunction: "Improves quality, efficiency and effectiveness over time.",
    executionSummary:
      "This candidate is most likely to create value by seeing how existing work can be sharpened, simplified or improved without destabilising the system. Their contribution is strongest where quality, efficiency and continuous improvement are strategic priorities.",
    environmentSummary:
      "Most sustainable in improvement-led environments with clear standards, room for iteration and shared agreement on when work is ready to release.",
    strengths: [
      "Continuous improvement — sees practical ways to refine outcomes and reduce friction.",
      "Standards elevation — raises quality without accepting avoidable mediocrity.",
      "Optimisation thinking — identifies cleaner, stronger or more efficient ways to achieve the outcome.",
    ],
    risks: [
      {
        title: "Perfection drag",
        detail:
          "May continue refining when a useful release would create more value. Validate judgement around release criteria, iteration and what must be excellent now.",
      },
      {
        title: "Standards frustration",
        detail:
          "May experience friction when others move ahead at a lower quality threshold. Validate communication of standards and the ability to influence improvement without blocking momentum.",
      },
    ],
    executionInterview: {
      title: "Release judgement",
      question:
        "Describe a time you had to decide between further refinement and releasing work. What criteria did you use, and how did you manage the remaining improvement work?",
    },
    pressureInterview: {
      title: "Improvement adoption",
      question:
        "Tell us about an improvement you introduced that others initially resisted. How did you demonstrate value, adapt the approach and ensure the new standard held?",
    },
  },
};

const CORE_SUPPORT: Record<
  McasCoreCode,
  {
    summary: string;
    riskTitle: string;
    riskDetail: string;
    interviewTitle: string;
    interviewQuestion: string;
  }
> = {
  CREATE: {
    summary:
      "Lower Create coverage means the candidate may benefit from a clearer source of direction, experimentation or opportunity generation when work begins in ambiguity.",
    riskTitle: "Lower Create coverage",
    riskDetail:
      "Validate how the candidate responds when no one has yet named the direction, opportunity or first move.",
    interviewTitle: "Direction creation",
    interviewQuestion:
      "Walk us through a time you had to create the first direction in an unclear situation. What did you notice, how did you choose a starting point and what happened next?",
  },
  ORGANISE: {
    summary:
      "Lower Organise coverage means cross-team alignment, dependency management and practical structure may need clearer support in a demanding role environment.",
    riskTitle: "Lower Organise coverage",
    riskDetail:
      "Validate how the candidate coordinates priorities, stakeholders, hand-offs and shared operating rhythms when work becomes more complex.",
    interviewTitle: "Alignment and structure",
    interviewQuestion:
      "Describe a piece of work that required several people or teams to coordinate. How did you make ownership, timing and dependencies visible?",
  },
  RESOLVE: {
    summary:
      "Lower Resolve coverage means sustained follow-through, closure and delivery rhythm may need stronger accountability structures or complementary support.",
    riskTitle: "Lower Resolve coverage",
    riskDetail:
      "Validate how the candidate turns an agreed plan into completed outcomes when energy drops or competing work appears.",
    interviewTitle: "Follow-through and closure",
    interviewQuestion:
      "Tell us about a project that became difficult in the final stages. How did you maintain ownership, resolve obstacles and ensure the outcome was fully delivered?",
  },
  EXAMINE: {
    summary:
      "Lower Examine coverage means analytical depth, quality review and evidence-based validation may need clearer structure, specialist support or deliberate checkpoints.",
    riskTitle: "Lower Examine coverage",
    riskDetail:
      "Validate the candidate's approach to data, quality assurance, risk review and decision checking in a demanding role environment.",
    interviewTitle: "Analytical coverage",
    interviewQuestion:
      "Walk us through a situation requiring strong analytical or quality-review work. What was your method, where did you seek support and how did you confirm the outcome was sound?",
  },
};

function humaniseFlag(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resultFlagToRisk(
  flag: string
): McasInternalRisk | null {
  const key = flag.toUpperCase().replace(/[\s-]+/g, "_");

  if (key.includes("OVERREACH")) {
    return {
      title: "Overreach risk",
      detail:
        "Current evidence suggests that the next level of scope may create strain without added support, clearer boundaries or demonstrated progression evidence.",
      level: "high",
    };
  }

  if (key.includes("VERTICAL_CONFIDENCE_LOW")) {
    return {
      title: "Vertical confidence low",
      detail:
        "Validate the underlying scope evidence through work examples, references and structured interview questions before using the vertical result for a placement decision.",
      level: "moderate",
    };
  }

  if (key.includes("VERTICAL_CONFIDENCE_MATCHED")) {
    return null;
  }

  if (key.includes("VERTICAL_READINESS_SIGNAL")) {
    return null;
  }

  return {
    title: humaniseFlag(flag),
    detail:
      "Validate this scored indicator with concrete work examples, reference evidence and the structured interview prompts in this report.",
    level: "moderate",
  };
}

function verticalInterview(
  verticalCode: string
): McasInternalInterviewFocus {
  return {
    title: "Scope and accountability",
    question: `Tell us about a time the scope of your role expanded significantly. What did you decide to own, what did you delegate and where did you ask for support? This should validate readiness around ${verticalCode}.`,
  };
}

function environmentInterview(): McasInternalInterviewFocus {
  return {
    title: "Role-environment fit",
    question:
      "What work environment brings out your strongest contribution, and what conditions make it harder to sustain performance? Ask for evidence from recent roles, not preferences alone.",
  };
}

export function getMcasInternalReportContent(
  payload: McasReportPayload
): McasInternalReportContent {
  const primary = payload.result.operatingStyle.primary;
  const secondary = payload.result.operatingStyle.secondary;
  const strongestCore = payload.result.core.strongest;
  const weakestCore = payload.result.core.weakest;
  const vertical = payload.result.careerVertical.primary;

  const style = STYLE_CONTENT[primary.code];

  const secondarySummary = secondary
    ? `${secondary.label} is the secondary influence. It is likely to support the dominant ${primary.label} pattern in day-to-day execution, especially where the role needs more than one part of the work cycle.`
    : null;

  const coreSummary = weakestCore
    ? `${CORE_SUPPORT[weakestCore.code].summary} The strongest ${strongestCore.label} coverage remains a key source of contribution.`
    : `The candidate's strongest ${strongestCore.label} coverage is a key source of contribution.`;

  const risks: McasInternalRisk[] = [
    ...style.risks.map((risk) => ({
      ...risk,
      level: "moderate" as const,
    })),
  ];

  for (const flag of payload.result.flags) {
    const risk = resultFlagToRisk(flag);

    if (risk) {
      risks.unshift(risk);
    }
  }

  if (weakestCore) {
    risks.push({
      title: CORE_SUPPORT[weakestCore.code].riskTitle,
      detail: CORE_SUPPORT[weakestCore.code].riskDetail,
      level: "moderate",
    });
  }

  const uniqueRisks = risks.filter(
    (risk, index, values) =>
      values.findIndex((candidate) => candidate.title === risk.title) === index
  );

  const interviewFocus: McasInternalInterviewFocus[] = [
    style.executionInterview,
    verticalInterview(vertical.code),
    weakestCore
      ? {
          title: CORE_SUPPORT[weakestCore.code].interviewTitle,
          question: CORE_SUPPORT[weakestCore.code].interviewQuestion,
        }
      : style.pressureInterview,
    environmentInterview(),
  ];

  return {
    primary: {
      code: primary.code,
      label: primary.label,
      systemFunction: style.systemFunction,
      executionSummary: style.executionSummary,
      environmentSummary: style.environmentSummary,
      strengths: style.strengths,
    },
    secondarySummary,
    executiveSummary: `${primary.label} performs a specific system function: ${style.systemFunction.toLowerCase()} ${style.executionSummary}`,
    coreSummary,
    risks: uniqueRisks.slice(0, 4),
    interviewFocus,
  };
}