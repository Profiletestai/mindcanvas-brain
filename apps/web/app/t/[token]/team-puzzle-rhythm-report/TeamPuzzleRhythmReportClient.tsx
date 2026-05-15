// apps/web/app/t/[token]/team-puzzle-rhythm-report/TeamPuzzleRhythmReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import AppBackground from "@/components/ui/AppBackground";

type FrequencyCode = "A" | "B" | "C" | "D";
type RhythmDriverKey =
  | "resourceful"
  | "human_centred"
  | "yielding"
  | "tactical"
  | "hopeful"
  | "measured";

type FrequencyLabel = { code: FrequencyCode; name: string };
type ProfileLabel = {
  code: string;
  name: string;
  frequency_code?: FrequencyCode | null;
};

type DriverGroup = "flow" | "stabilising" | "frustration";

type ReportData = {
  hidden?: boolean;
  org: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
    website_url?: string | null;
  };
  test: {
    id: string;
    name: string | null;
    slug: string | null;
    meta: any;
  };
  link?: {
    show_results?: boolean | null;
    redirect_url?: string | null;
    hidden_results_message?: string | null;
    next_steps_url?: string | null;
  };
  taker: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    company?: string | null;
    role_title?: string | null;
  };
  submission?: { id: string; created_at?: string | null } | null;
  result: {
    frequency_labels: FrequencyLabel[];
    frequency_percentages: Record<FrequencyCode, number>;
    profile_labels: ProfileLabel[];
    profile_percentages: Record<string, number>;
    top_freq: FrequencyCode;
    top_freq_name: string;
    top_profile_code: string;
    top_profile_name: string;
    sorted_profiles: Array<ProfileLabel & { pct: number; short_code: string }>;
    secondary_profile?:
      | (ProfileLabel & { pct: number; short_code: string })
      | null;
    tertiary_profile?:
      | (ProfileLabel & { pct: number; short_code: string })
      | null;
  };
  rhythm: {
    driver_raw_scores: Partial<Record<RhythmDriverKey, number>>;
    driver_percentages: Partial<Record<RhythmDriverKey, number>>;
    ranked_drivers: RhythmDriverKey[];
    flow_drivers: RhythmDriverKey[];
    stabilising_drivers: RhythmDriverKey[];
    frustration_drivers: RhythmDriverKey[];
    primary_driver?: RhythmDriverKey | null;
    secondary_driver?: RhythmDriverKey | null;
  } | null;
};

type ReportAPI = { ok: boolean; data?: ReportData; error?: string };

const FREQUENCY_COPY: Record<
  FrequencyCode,
  {
    title: string;
    description: string;
    focus: string;
    strength: string;
    blindSpot: string;
  }
> = {
  A: {
    title: "Innovation Frequency",
    description:
      "The energy of ideas, creation, and momentum. People with this frequency generate possibilities, challenge assumptions, and initiate forward movement.",
    focus: "Ideas, change, and future potential",
    strength: "Vision, creativity, problem solving",
    blindSpot: "Inconsistency, distraction, impatience",
  },
  B: {
    title: "Influence Frequency",
    description:
      "The energy of connection, charisma, and communication. These individuals build relationships, rally teams, and breathe life into ideas.",
    focus: "People, energy, and communication",
    strength: "Engagement, empathy, culture building",
    blindSpot: "Overcommitment, emotional fatigue, lack of boundaries",
  },
  C: {
    title: "Implementation Frequency",
    description:
      "The energy of grounding, timing, and practical progress. These individuals know how to execute, respond to real-world needs, and bring order to complexity.",
    focus: "Timing, delivery, grounded progress",
    strength: "Pacing, responsiveness, practical execution",
    blindSpot: "Avoiding confrontation, indecision under pressure",
  },
  D: {
    title: "Insight Frequency",
    description:
      "The energy of analysis, logic, and systems. These people thrive on precision, predictability, accountability, and quality.",
    focus: "Systems, logic, structure",
    strength: "Precision, accountability, risk awareness",
    blindSpot: "Rigidity, analysis paralysis, perfectionism",
  },
};

const PROFILE_COPY: Record<
  string,
  {
    title: string;
    role: string;
    summary: string;
    coreTraits: string;
    idealEnvironment: string;
    famous?: string;
  }
> = {
  PROFILE_1: {
    title: "The Visionary",
    role: "Strategist",
    summary:
      "Visionaries see possibilities before others do. They bring bold ideas, challenge the status quo, and drive future-focused thinking.",
    coreTraits: "Future-focused, imaginative, strategic, opportunity-driven",
    idealEnvironment:
      "Open, innovative environments with room to explore ideas",
  },
  PROFILE_2: {
    title: "The Catalyst",
    role: "Spark",
    summary:
      "Catalysts build momentum and belief. They energise people and ideas, especially in early-stage projects and change efforts.",
    coreTraits: "Energetic, persuasive, expressive, action-oriented",
    idealEnvironment:
      "Fast-moving, people-centred environments that need momentum",
  },
  PROFILE_3: {
    title: "The Motivator",
    role: "Heart",
    summary:
      "Motivators uplift, engage, and build emotional connection. They keep morale high and help others feel seen and valued.",
    coreTraits: "Empathetic, encouraging, expressive, people-first",
    idealEnvironment:
      "Relational teams where motivation, culture, and care matter",
  },
  PROFILE_4: {
    title: "The Connector",
    role: "Bridge",
    summary:
      "Connectors bring people together through empathy, timing, and intuition. They translate relationships into shared movement and practical alignment.",
    coreTraits:
      "Empathetic, observant, timing-sensitive, trusted, intuitive communicator",
    idealEnvironment:
      "Collaborative, values-driven teams with responsive leadership",
    famous: "Michelle Obama, Satya Nadella, Angela Merkel, Malala Yousafzai",
  },
  PROFILE_5: {
    title: "The Facilitator",
    role: "Grounder",
    summary:
      "Facilitators provide stability, rhythm, and calm presence. They create safety, hold space, and help groups move with steadiness.",
    coreTraits: "Calm, inclusive, steady, intuitive, supportive",
    idealEnvironment:
      "Teams that need presence, trust, inclusion, and grounded pacing",
  },
  PROFILE_6: {
    title: "The Coordinator",
    role: "Planner",
    summary:
      "Coordinators thrive on execution and operational clarity. They track timelines, manage deliverables, and turn plans into outcomes.",
    coreTraits: "Organised, reliable, structured, practical, delivery-focused",
    idealEnvironment:
      "Operational settings where planning, consistency, and delivery matter",
  },
  PROFILE_7: {
    title: "The Controller",
    role: "Analyst",
    summary:
      "Controllers bring accuracy, logic, and accountability. They spot failure points early and protect the integrity of work.",
    coreTraits: "Precise, analytical, rigorous, careful, accountable",
    idealEnvironment:
      "Technical, regulatory, quality-control, or detail-sensitive environments",
  },
  PROFILE_8: {
    title: "The Optimiser",
    role: "Refiner",
    summary:
      "Optimisers improve systems, processes, and outcomes. They quietly enhance what exists so it performs better and lasts longer.",
    coreTraits: "Systems-minded, reflective, improvement-focused, strategic",
    idealEnvironment:
      "Settings where refinement, process improvement, and long-term performance matter",
  },
};

const DRIVER_COPY: Record<
  RhythmDriverKey,
  {
    letter: string;
    label: string;
    short: string;
    definition: string;
    research: string[];
    flow: string[];
    stabilising: string[];
    frustration: string[];
    impact: string[];
    thrives: string;
  }
> = {
  resourceful: {
    letter: "R",
    label: "Resourceful",
    short: "Solves problems quickly with practical solutions.",
    definition:
      "The ability to generate practical, effective solutions quickly, particularly in dynamic or uncertain environments.",
    research: [
      "Linked to adaptive performance theory",
      "Associated with problem-solving agility and fluid intelligence",
    ],
    flow: [
      "Rapidly identifies workable solutions under pressure",
      "Comfortable making decisions with incomplete information",
      "Prioritises progress and momentum over perfection",
    ],
    stabilising: [
      "Can solve problems effectively when required",
      "Prefers some structure or clarity before acting",
      "May take slightly longer to commit to decisions",
    ],
    frustration: [
      "Experiences discomfort in ambiguity",
      "Hesitates without clear information or direction",
      "Avoids rapid decision-making environments",
    ],
    impact: [
      "Drives momentum in teams",
      "Prevents stagnation",
      "Critical in early-stage problem solving",
    ],
    thrives:
      "Fast-moving environments, ambiguous situations, crisis or change scenarios",
  },
  human_centred: {
    letter: "H",
    label: "Human-Centred",
    short: "Builds trust, connection, and team alignment.",
    definition:
      "The ability to understand, connect with, and influence others to build trust, alignment, and collaboration.",
    research: [
      "Rooted in Emotional Intelligence theory",
      "Linked to social awareness and relationship management competencies",
    ],
    flow: [
      "Intuitively reads emotional dynamics within teams",
      "Builds strong interpersonal trust",
      "Aligns individuals toward shared outcomes",
    ],
    stabilising: [
      "Can engage and support others when required",
      "Balances relational and task-based priorities",
    ],
    frustration: [
      "Finds emotional engagement draining",
      "Prioritises outcomes over relationships",
      "May struggle with interpersonal conflict resolution",
    ],
    impact: [
      "Strengthens team cohesion",
      "Reduces conflict",
      "Improves communication effectiveness",
    ],
    thrives: "Leadership roles, team facilitation, stakeholder management",
  },
  yielding: {
    letter: "Y",
    label: "Yielding",
    short: "Adapts, flexes, and supports changing needs.",
    definition:
      "The ability to remain flexible, adaptable, and responsive to changing environments, perspectives, and priorities.",
    research: [
      "Connected to cognitive flexibility",
      "A key component of learning agility",
    ],
    flow: [
      "Adapts quickly to change",
      "Open to alternative viewpoints",
      "Comfortable shifting direction as needed",
    ],
    stabilising: [
      "Can adapt when necessary",
      "Prefers some consistency or predictability",
    ],
    frustration: [
      "Resists change",
      "Prefers control and stability",
      "Struggles in fluid or undefined environments",
    ],
    impact: [
      "Enables agility within teams",
      "Reduces resistance to change",
      "Supports collaboration across styles",
    ],
    thrives:
      "Dynamic environments, cross-functional teams, evolving project scopes",
  },
  tactical: {
    letter: "T",
    label: "Tactical",
    short: "Prioritises, structures, and executes effectively.",
    definition:
      "The ability to structure, prioritise, and execute work in a focused and efficient manner.",
    research: [
      "Linked to executive functioning",
      "Strong correlation with goal-setting theory",
    ],
    flow: [
      "Breaks complex work into actionable steps",
      "Prioritises effectively under pressure",
      "Drives execution and delivery",
    ],
    stabilising: [
      "Can organise and prioritise when needed",
      "Does not naturally default to structure",
    ],
    frustration: [
      "Avoids planning or structure",
      "Becomes overwhelmed by complexity",
      "Struggles with prioritisation",
    ],
    impact: [
      "Ensures work gets completed",
      "Maintains focus on outcomes",
      "Drives accountability",
    ],
    thrives: "Operations, project management, delivery-focused roles",
  },
  hopeful: {
    letter: "H",
    label: "Hopeful",
    short: "Drives belief, energy, and forward momentum.",
    definition:
      "The ability to maintain optimism, belief, and forward momentum, particularly in challenging or uncertain situations.",
    research: [
      "Linked to Psychological Capital",
      "Includes elements of hope, resilience, and optimism",
    ],
    flow: [
      "Maintains positive outlook under pressure",
      "Encourages and motivates others",
      "Sustains momentum during setbacks",
    ],
    stabilising: [
      "Can remain positive when required",
      "Not a natural source of energy for others",
    ],
    frustration: [
      "Focuses on risks and problems",
      "Finds it difficult to maintain optimism",
      "Drained by the need to motivate others",
    ],
    impact: [
      "Sustains morale",
      "Reduces burnout in teams",
      "Drives long-term persistence",
    ],
    thrives:
      "Challenging moments, morale building, change journeys, resilience work",
  },
  measured: {
    letter: "M",
    label: "Measured",
    short: "Applies logic, process, and consistency.",
    definition:
      "The ability to apply logic, structure, and systems to ensure consistency, quality, and informed decision making.",
    research: [
      "Connected to analytical reasoning and decision-making models",
      "Aligns with systematic thinking and risk management frameworks",
    ],
    flow: [
      "Uses data and evidence to guide decisions",
      "Builds systems and processes",
      "Ensures accuracy and quality",
    ],
    stabilising: [
      "Can apply structure when needed",
      "Does not rely on it consistently",
    ],
    frustration: [
      "Avoids structured approaches",
      "Makes reactive or inconsistent decisions",
      "Struggles with detail and accuracy",
    ],
    impact: [
      "Creates stability",
      "Reduces risk",
      "Ensures consistency and quality",
    ],
    thrives:
      "Compliance, finance, strategy, analysis, process and quality work",
  },
};

const GROUP_COPY: Record<
  DriverGroup,
  {
    label: string;
    heading: string;
    color: string;
    bg: string;
    border: string;
    text: string;
  }
> = {
  flow: {
    label: "Flow Driver",
    heading: "Flow Drivers — Your Top 2",
    color: "#16A34A",
    bg: "bg-green-50",
    border: "border-green-500/40",
    text: "text-green-700",
  },
  stabilising: {
    label: "Stabilising Driver",
    heading: "Stabilising Drivers — Your Middle 2",
    color: "#D97706",
    bg: "bg-amber-50",
    border: "border-amber-500/40",
    text: "text-amber-700",
  },
  frustration: {
    label: "Frustration Driver",
    heading: "Frustration Drivers — Your Bottom 2",
    color: "#BC1823",
    bg: "bg-red-50",
    border: "border-red-500/40",
    text: "text-red-700",
  },
};


const GENERIC_CONTENT = {
  welcomeFromChandell: {
    paragraphs: [
      "Welcome to your Team Puzzle Discovery Report. I’m so excited to be part of your journey as you uncover your natural strengths, communication style, and best-fit contribution in the workplace.",
      "This report is designed to give you deeper insight into how you work best, where you thrive in a team, and how to align your role with your natural energy.",
      "At Life Puzzle, I’ve worked with leaders, executives, and business owners for over two decades, helping them break through performance barriers, improve communication, and unlock their true potential. One consistent truth I’ve seen across every organisation is this: when people understand themselves and each other more deeply, the entire culture shifts. Results improve, engagement increases, and people feel more fulfilled in the work they do.",
      "Team Puzzle was created with that in mind. It is not just a tool for insight; it is a system for practical action. It maps the puzzle pieces of your team in a way that helps people fit together more effectively, reducing friction and increasing flow.",
      "Whether you are reading this report as part of a leadership team, a coaching session, or a personal development journey, I invite you to treat this insight not as an ending, but as a starting point — a map for growth, alignment, and leadership that reflects your natural style.",
    ],
    signoff: "Warm regards",
    name: "Chandell Labbozzetta",
    role: "CEO of Life Puzzle and Creator of the Team Puzzle Discovery Assessment",
  },
  howToUseThisReport: {
    intro: [
      "Think of this report as your personal blueprint for working smarter, not harder. It is more than a profile; it is a practical guide for doing your best work, building stronger relationships, and creating long-term impact in your role or business.",
      "Each section has been designed with real-world application in mind. You will not only learn about your strengths, but also how to use them, where to watch for blind spots, and how to build stronger partnerships with people who complement your style.",
    ],
    items: [
      {
        title: "Start with curiosity",
        body: "Read through the full report with an open mind. Notice what feels immediately familiar, what surprises you, and what gives language to things you may already know about yourself.",
      },
      {
        title: "Use it in real time",
        body: "Bring it into meetings, planning sessions, coaching conversations, or moments where you need to understand your working style more clearly.",
      },
      {
        title: "Share it",
        body: "Invite your team, leader, coach, or advisor to explore the report with you. Insights become more powerful when they are shared and discussed.",
      },
      {
        title: "Implement gradually",
        body: "You do not need to act on everything at once. Choose one insight, apply it, observe what changes, and then build from there.",
      },
      {
        title: "Check back often",
        body: "As you grow, your expression of your profile may mature. This is a working document, not a one-off report.",
      },
    ],
    closing: "Let’s explore what makes you — and your team — truly effective.",
  },
  introducingTeamPuzzleFramework: {
    paragraphs: [
      "High-performing teams do not happen by accident. They are built with intention, structure, and insight.",
      "The Team Puzzle Framework was developed to bridge the gap between untapped human potential and practical business results. It is a top-down, ground-up approach to unlocking the genius that already exists within people and teams.",
    ],
    question: "How do we get the best from each individual, and even better results from the team as a whole?",
    afterQuestion: "When people are placed in roles that energise them, when teams communicate using a shared language, and when leaders understand where and how each person adds value, the entire culture transforms. Productivity rises, engagement increases, and trust becomes a business asset.",
    benefits: [
      "A clear, structured way to identify natural strengths and working energy.",
      "A common language that simplifies collaboration and reduces misunderstanding.",
      "A strategic map to help leaders make better decisions about people, partnerships, and priorities.",
      "Ideas for charting a course to results by following a path of least resistance.",
    ],
    closing: [
      "The Team Puzzle approach is not about fixing people. It is about fitting people together.",
      "Just like a real puzzle, each person has a unique shape and contribution. Our role is to help teams see how those pieces connect, so they can operate with more clarity, confidence, and better results.",
      "This is not theory. It is a tool for action. Once you see how the pieces fit together, you will never look at team performance the same way again.",
    ],
  },
  understandingFrequenciesProfiles: {
    paragraphs: [
      "Behind every high-performing team is a diverse mix of energy. In Team Puzzle, we call these core energy types the Frequencies — the foundational patterns that shape how people think, operate, communicate, and contribute.",
      "These frequencies are not about job titles or technical skills. They describe the natural way you show up in the workplace, the kind of energy you bring to a team, and how you most instinctively create value.",
      "Understanding the Four Frequencies is like learning the language of performance. Once a team can identify these dynamics, everything becomes clearer: roles, communication, friction, collaboration, decision-making, and results.",
    ],
    frequencySummaries: {
      A: "The energy of ideas, creation, momentum, and possibility.",
      B: "The energy of people, communication, motivation, and activation.",
      C: "The energy of grounding, timing, delivery, and practical progress.",
      D: "The energy of analysis, logic, structure, and precision.",
    },
    closing: "Each frequency contributes something essential. None is better than another. True team flow happens when all are present, respected, and used well.",
  },
  fourFrequencies: {
    intro: "Each person leads with one or two dominant frequencies. These frequencies influence where they naturally focus, how they contribute, what energises them, and where they may experience blind spots.",
    frequencies: {
      A: {
        focus: "Ideas, change, and future potential.",
        strength: "Vision, creativity, possibility, and problem-solving.",
        blindSpot: "Inconsistency, distraction, impatience, or moving too quickly without enough grounding.",
        leveragePoint: "Use Innovation energy early in projects for vision-setting, idea generation, creative problem-solving, and prototyping.",
      },
      B: {
        focus: "People, energy, communication, and engagement.",
        strength: "Connection, empathy, motivation, culture-building, and stakeholder alignment.",
        blindSpot: "Overcommitment, emotional fatigue, lack of boundaries, or prioritising harmony over clarity.",
        leveragePoint: "Use Influence energy to build trust, create buy-in, energise teams, and strengthen communication.",
      },
      C: {
        focus: "Timing, delivery, grounded progress, and real-world responsiveness.",
        strength: "Practical execution, pacing, presence, and stability.",
        blindSpot: "Avoiding confrontation, delaying decisions, or becoming too cautious under pressure.",
        leveragePoint: "Use Implementation energy in delivery, client service, meetings, operations, and team rhythm.",
      },
      D: {
        focus: "Systems, logic, quality, and structure.",
        strength: "Precision, accountability, analysis, risk awareness, and process improvement.",
        blindSpot: "Rigidity, perfectionism, over-analysis, or difficulty moving before everything is certain.",
        leveragePoint: "Use Insight energy for systems, quality control, evaluation, compliance, scaling, and decision-making.",
      },
    },
    reflectionPrompts: [
      "Which frequency do you recognise most in your own energy and thinking style?",
      "Who in your team operates at a very different frequency? What strength do they bring?",
      "Where do your projects or meetings usually get stuck? Could it be a missing frequency?",
      "How could understanding the balance of frequencies help your team function better?",
    ],
  },
  eightProfiles: {
    intro: "The Team Puzzle Framework maps eight unique Profiles. Each Profile represents a different way of thinking, contributing, communicating, and leading. These Profiles are powered by one or more of the Four Frequencies. Together, they cover the full spectrum of what it takes to build a high-performing team.",
    closing: "Together, these eight Profiles represent the complete team puzzle — offering diversity not just of personality, but of contribution, energy, and value.",
  },
  naturalContributionTypes: {
    intro: "Each Profile is a blend of one or more Frequencies and represents a unique role in the team. The more diversity you have across the eight Profiles, the more complete and capable your team becomes.",
    reflectionPrompts: [
      "Which of these profiles do you recognise in your current or past teammates?",
      "Which profile frustrates or challenges you, and why?",
      "Who have you relied on for support, execution, or clarity? Can you now name their profile?",
      "What gaps do you notice in your current team’s profile mix, and what would complement it?",
    ],
  },
  professionalPerformanceRhythm: {
    intro: [
      "Your Team Puzzle Profile explains your natural energy and contribution style. Alongside this, the Professional Performance Rhythm reveals how you approach work and create results across six key drivers.",
      "Think of it as the tempo behind your profile — the underlying rhythm that influences the way you solve problems, collaborate, adapt, lead, and deliver. Everyone has all six RHYTHM drivers available to them, but we do not express them equally. Some energise us, some feel neutral, and some can drain us if overused.",
      "By understanding your rhythm, you will see not only where you naturally thrive, but also how to better align with others whose rhythms may differ from yours. This awareness reduces friction, increases trust, and helps you and your team find greater flow.",
    ],
    whatThisMeans: [
      "Your Professional Performance RHYTHM shows how you naturally approach work, decisions, and collaboration across six key drivers.",
      "While your Profile explains what you bring, your RHYTHM explains how you operate day to day. It reflects the patterns you default to when working under pressure, leading others, solving problems, or delivering results.",
      "Everyone has access to all six drivers. The difference is in how much energy each driver requires from you. Some drivers feel natural and energising. Others can be used when needed. Some may feel draining if used too often.",
    ],
    helps: [
      "Work in a way that feels more natural and sustainable.",
      "Reduce friction in how you approach tasks and people.",
      "Build stronger, more balanced team dynamics.",
    ],
    sixDriversIntro: "Each driver represents a different way of working within a team or organisation.",
    whyThisMatters: {
      intro: "Your Professional Performance Rhythm offers a practical lens on how you show up day to day — not just what you contribute, but how you do it. By knowing your Flow, Stabilising, and Frustration drivers, you can:",
      bullets: [
        "Align your role with the areas that energise you most.",
        "Spot where you may be overextending into draining drivers.",
        "Build complementary partnerships with colleagues who balance your rhythm.",
        "Lead and collaborate with more awareness, trust, and effectiveness.",
      ],
      closing: "Like a real rhythm, it is about balance. No one driver is better than another — the power comes from recognising your unique combination and how it fits into the wider team puzzle.",
    },
    rhythmMeans: {
      intro: "Your RHYTHM is not about being good or bad at certain behaviours.",
      understanding: [
        "Where you naturally create the most impact",
        "Where you can adapt when needed",
        "Where you may experience friction over time",
      ],
      goal: "The goal is not to change your RHYTHM, but to use it more effectively.",
      alignedWork: [
        "Work more efficiently",
        "Feel more energised",
        "Contribute more consistently",
      ],
      closing: "And most importantly, you will better understand how your way of working fits into the wider team puzzle.",
    },
  },
  threeLevelEnergyModel: {
    flow: [
      "Where energy is highest",
      "Natural, effortless",
      "Creates momentum and impact",
      "Core contribution to team",
    ],
    stabilising: [
      "Can use when needed",
      "Not energising, but not draining",
      "Provides balance and adaptability",
    ],
    frustration: [
      "Requires effort",
      "Draining over time",
      "Often avoided or resisted",
      "Key source of friction in teams",
    ],
  },
  nextSteps: {
    intro: "Your Team Puzzle RHYTHM report is designed to give you insight, language, and practical direction. The next step is to turn that insight into action.",
    cards: [
      {
        title: "Download Your Report",
        body: "Save a copy of your report so you can return to it during planning, reflection, performance reviews, or coaching conversations.",
        button: "Download PDF",
      },
      {
        title: "Discuss with Your Advisor",
        body: "Take your insights further with a debrief session, team workshop, or advisory conversation. The value of this report grows when you explore it with someone who can help you apply it.",
        button: "Explore Now",
      },
      {
        title: "Explore Team Puzzle",
        body: "Use this report as the beginning of a bigger conversation about team fit, communication, contribution, and performance. The more clearly people understand their own puzzle piece, the easier it becomes to build a stronger team.",
        button: "Visit Now",
      },
    ],
  },
} as const;

const GENERIC_PROFILE_CONTENT = {
  PROFILE_1: {
    display: "Visionary",
    role: "Strategist",
    summary: "An innovative strategist who sees what is possible before others do. Visionaries bring bold ideas, challenge the status quo, and drive future-focused thinking.",
    naturalContribution: "The Visionary sees possibilities that others do not. They are future-focused creators who thrive in white space, ideas, and ambiguity. Their strength lies in charting new directions and reimagining what is possible for a business, a team, or an entire industry. They start movements, not just projects, but they need others to help carry ideas into execution. Visionaries add immense value when they are encouraged to focus and when their ideas are caught, shaped, and implemented by more grounded profiles.",
  },
  PROFILE_2: {
    display: "Catalyst",
    role: "Spark",
    summary: "An energetic influencer who builds momentum and belief. Catalysts thrive in early-stage projects and energise others through dynamic communication.",
    naturalContribution: "The Catalyst brings a dynamic blend of innovation and influence. They energise people and ideas, often acting as the momentum-builder in early-stage projects or change efforts. Catalysts inspire belief and action with their contagious passion, helping others move quickly and decisively. They thrive in fast-paced, people-centred environments, but benefit from calmer profiles who help manage delivery and sustainability.",
  },
  PROFILE_3: {
    display: "Motivator",
    role: "Heart",
    summary: "A people-first leader who inspires connection, morale, and trust. Motivators lead with empathy and are often the emotional heart of the team.",
    naturalContribution: "The Motivator uplifts, engages, and builds emotional connection within teams. They are deeply people-oriented and bring energy through empathy, optimism, and emotional presence. Motivators keep morale high and ensure others feel seen and valued. They are vital to team culture, but need to balance care for others with strong personal boundaries and focus.",
  },
  PROFILE_4: {
    display: "Connector",
    role: "Bridge",
    summary: "A bridge-builder who creates alignment between people, timing, and goals. Connectors translate strategy into relationships and communication.",
    naturalContribution: "The Connector brings people together through empathy, timing, and intuition. They instinctively sense how individuals, teams, and needs align, and act as the social and emotional glue of a project or business. Their strength lies in translating strategy into relationships and relationships into movement. They lead best when trusted to guide communication and pacing.",
  },
  PROFILE_5: {
    display: "Facilitator",
    role: "Grounder",
    summary: "A harmoniser and integrator who grounds the team in calm consistency. Facilitators create safety, rhythm, and inclusive space for all voices.",
    naturalContribution: "The Facilitator provides stability, rhythm, and presence. They are intuitive team stabilisers who excel at creating calm in complexity. They listen well, hold space for others, and gently guide group energy and decisions. Their power lies in their ability to lead without dominating. Facilitators thrive when given ownership of the human side of operations and culture.",
  },
  PROFILE_6: {
    display: "Coordinator",
    role: "Planner",
    summary: "An operational planner who brings structure, tracking, and reliability. Coordinators excel in execution and turning plans into outcomes.",
    naturalContribution: "The Coordinator thrives on execution and operational clarity. They know what needs to happen, when, and how. They track timelines, manage deliverables, and support consistency. Coordinators are natural project leads and back-end organisers who bring confidence and predictability to fast-moving environments. Their challenge is learning to lead beyond tasks and step into broader systems and strategy.",
  },
  PROFILE_7: {
    display: "Controller",
    role: "Analyst",
    summary: "A detail-oriented analyst who ensures accuracy, quality, and accountability. Controllers anticipate risks and protect the integrity of work.",
    naturalContribution: "The Controller brings accuracy, logic, and accountability. They see potential failure points before others and build systems to prevent them. They thrive in technical, regulatory, or back-end roles where detail matters most. They challenge assumptions, uphold standards, and protect the integrity of a system. Their leadership comes from consistency and rigour, not charisma.",
  },
  PROFILE_8: {
    display: "Optimiser",
    role: "Refiner",
    summary: "A systems-driven refiner who improves processes, performance, and outcomes. Optimisers combine insight and innovation to make things better over time.",
    naturalContribution: "The Optimiser improves systems, processes, and outcomes. They bridge data and design, identifying small shifts that make a big difference. Their strength lies in quietly enhancing what already exists so it performs better, scales easier, or lasts longer. Optimisers combine structure with creativity and thrive when given time, space, and trust to refine and rebuild.",
  },
} as const;

const REPORT_ASSETS = {
  logo: "/org-graphics/tp-logo.png",
  chandell: "/org-graphics/tp-chandell.png",
  frameworkVisual: "/org-graphics/tp-framework-visual.png",
  frequencyWheel: "/org-graphics/tp-frequency-wheel.png",
  rhythmPuzzle: "/org-graphics/rhythm-puzzle.png",
  icons: {
    welcome: "/icons/tp-welcome-from-chandell.png",
    howToUse: "/icons/tp-how-to-use-report.png",
    introTeamPuzzleFramework: "/icons/tp-intro-team-puzzle-framework.png",
    understandingFrequenciesProfiles:
      "/icons/tp-understanding-frequencies-profiles.png",
    fourFrequencies: "/icons/tp-four-frequencies.png",
    eightProfiles: "/icons/tp-eight-profiles.png",
    naturalContribution: "/icons/tp-natural-contribution.png",
    frequencySummary: "/icons/tp-frequency-summary.png",
    personalityMap: "/icons/tp-personality-map.png",
    profileMix: "/icons/tp-profile-mix.png",
    profileInDepth: "/icons/tp-profile-in-depth.png",
    professionalPerformanceRhythm: "/icons/tp-profile-in-depth.png",
    energyModel: "/icons/tp-profile-in-depth.png",
    energyMix: "/icons/tp-energy-mix.png",
    ideas: "/icons/tp-ideas.png",
    strategicMap: "/icons/tp-strategic-map.png",
    structure: "/icons/tp-structure.png",
    commonLanguage: "/icons/tp-common-language.png",
    teamRoleFit: "/icons/tp-team-role-fit.png",
    valueCreationPathway: "/icons/tp-value-creation-pathway.png",
    collaborationTips: "/icons/tp-collaboration-tips.png",
    developmentRecommendations: "/icons/tp-development-recommendations.png",
    whatsHoldingYouBack: "/icons/tp-whats-holing-you-back.png",
    nextSteps: "/icons/tp-next-steps.png",
  },
} as const;

const PROFILE_ORDER = [
  "PROFILE_1",
  "PROFILE_2",
  "PROFILE_3",
  "PROFILE_4",
  "PROFILE_5",
  "PROFILE_6",
  "PROFILE_7",
  "PROFILE_8",
] as const;

const PROFILE_FREQUENCIES: Record<string, FrequencyCode> = {
  PROFILE_1: "A",
  PROFILE_2: "A",
  PROFILE_3: "B",
  PROFILE_4: "B",
  PROFILE_5: "C",
  PROFILE_6: "C",
  PROFILE_7: "D",
  PROFILE_8: "D",
};

const PROFILE_ACCENT: Record<FrequencyCode, string> = {
  A: "#084595",
  B: "#4092C5",
  C: "#6AADD7",
  D: "#B1D3F6",
};

function orderedProfileItems(labels: ProfileLabel[]) {
  return PROFILE_ORDER.map((code) => {
    const existing = labels.find((item) => item.code === code);
    const copy = PROFILE_COPY[code];
    return {
      code,
      name: existing?.name || copy?.title.replace(/^The\s+/i, "") || code,
      frequency_code: existing?.frequency_code || PROFILE_FREQUENCIES[code],
    } as ProfileLabel;
  });
}

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function fullName(taker: ReportData["taker"]) {
  return (
    [taker.first_name, taker.last_name]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" ") || "Participant"
  );
}

function formatDate(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime()))
    return new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function profileCodeToShort(code: string) {
  const m = String(code || "").match(/(\d+)/);
  return m ? `P${m[1]}` : code;
}

function topProfileImage(profileName?: string | null) {
  const cleaned = String(profileName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes("visionary")) return "/profile-cards/tp-visionary.png";
  if (cleaned.includes("catalyst")) return "/profile-cards/tp-catalyst.png";
  if (cleaned.includes("motivator")) return "/profile-cards/tp-motivator.png";
  if (cleaned.includes("connector")) return "/profile-cards/tp-connector.png";
  if (cleaned.includes("facilitator"))
    return "/profile-cards/tp-facilitator.png";
  if (cleaned.includes("coordinator"))
    return "/profile-cards/tp-coordinator.png";
  if (cleaned.includes("controller")) return "/profile-cards/tp-controller.png";
  if (cleaned.includes("optimiser") || cleaned.includes("optimizer"))
    return "/profile-cards/tp-optimiser.png";
  return null;
}

function ReportAssetImage(props: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={props.src}
      alt={props.alt}
      loading="lazy"
      className={props.className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function RhythmPuzzlePieceImage(props: {
  file: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState(`/icons/${props.file}`);
  const [failedOnce, setFailedOnce] = useState(false);

  return (
    <img
      src={src}
      alt={props.alt}
      loading="lazy"
      className={props.className}
      onError={(e) => {
        if (!failedOnce) {
          setFailedOnce(true);
          setSrc(`/org-graphics/${props.file}`);
          return;
        }
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function Card(props: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cls(
        "rounded-3xl border border-white/10 bg-[#0C203A]/80 p-5 shadow-2xl shadow-black/20",
        props.className,
      )}
    >
      {props.children}
    </section>
  );
}

function WhiteCard(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cls(
        "rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

function SectionHeader(props: {
  eyebrow?: string;
  title: string;
  icon?: string;
}) {
  const iconIsImage =
    typeof props.icon === "string" && props.icon.startsWith("/");

  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-300/20 bg-blue-400/10 text-lg">
        {iconIsImage ? (
          <ReportAssetImage
            src={props.icon || ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          props.icon || "✉"
        )}
      </div>
      <div>
        {props.eyebrow ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
            {props.eyebrow}
          </div>
        ) : null}
        <h2 className="text-lg font-semibold text-white">{props.title}</h2>
      </div>
    </div>
  );
}

function StatPill(props: {
  children: ReactNode;
  tone?: "green" | "blue" | "white";
}) {
  const tone = props.tone || "white";
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "green" &&
          "border-green-400/30 bg-green-400/10 text-green-300",
        tone === "blue" && "border-sky-400/30 bg-sky-400/10 text-sky-200",
        tone === "white" && "border-white/15 bg-white/10 text-white",
      )}
    >
      {props.children}
    </span>
  );
}

function FrequencyChart(props: {
  labels: FrequencyLabel[];
  percentages: Record<FrequencyCode, number>;
}) {
  const colors: Record<FrequencyCode, string> = {
    A: "bg-red-500",
    B: "bg-amber-500",
    C: "bg-emerald-500",
    D: "bg-blue-500",
  };
  const labels = props.labels?.length
    ? props.labels
    : [
        { code: "A" as FrequencyCode, name: "Innovation" },
        { code: "B" as FrequencyCode, name: "Influence" },
        { code: "C" as FrequencyCode, name: "Implementation" },
        { code: "D" as FrequencyCode, name: "Insight" },
      ];

  return (
    <WhiteCard>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Frequencies</h3>
          <p className="mt-1 text-sm text-slate-600">
            The behavioural energy you use most often.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {labels.map((item) => {
          const pct = clamp(props.percentages?.[item.code] || 0);
          return (
            <div key={item.code} className="flex flex-col items-center gap-2">
              <div className="text-xs font-bold text-slate-600">{pct}%</div>
              <div className="relative h-56 w-full max-w-[78px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div
                  className={cls(
                    "absolute bottom-0 left-0 right-0",
                    colors[item.code],
                  )}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="text-sm font-bold text-slate-900">
                {item.code}
              </div>
              <div className="text-center text-[11px] leading-tight text-slate-600">
                {item.name} ({item.code})
              </div>
            </div>
          );
        })}
      </div>
    </WhiteCard>
  );
}

function ProfileRadar(props: {
  labels: ProfileLabel[];
  percentages: Record<string, number>;
}) {
  const labels = props.labels?.length ? props.labels : [];
  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 205;
  const max = 50;

  function point(i: number, valuePct: number) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = (radius * clamp(valuePct, 0, max)) / max;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  function axisPoint(i: number, multiplier = 1) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = radius * multiplier;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  const points = labels.map((label, i) =>
    point(i, props.percentages?.[label.code] || 0),
  );
  const path =
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      )
      .join(" ") + " Z";

  return (
    <WhiteCard>
      <h3 className="text-base font-semibold">
        Your Personality Map (Profile)
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Higher values show patterns you use more often.
      </p>
      <div className="mt-4 flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {labels.length ? (
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="h-auto w-full max-w-[520px]"
          >
            {[10, 20, 30, 40, 50].map((ring) => (
              <polygon
                key={ring}
                points={labels
                  .map((_, i) => point(i, ring))
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="rgba(15,23,42,0.12)"
              />
            ))}
            {labels.map((label, i) => {
              const p = axisPoint(i, 1);
              const t = axisPoint(i, 1.17);
              return (
                <g key={label.code}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={p.x}
                    y2={p.y}
                    stroke="rgba(15,23,42,0.12)"
                  />
                  <text
                    x={t.x}
                    y={t.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="rgba(15,23,42,0.62)"
                  >
                    {`${profileCodeToShort(label.code)}: ${label.name}`}
                  </text>
                </g>
              );
            })}
            <path
              d={path}
              fill="rgba(64,146,197,0.18)"
              stroke="#4092C5"
              strokeWidth="3"
            />
            {labels.map((label, i) => {
              const pct = props.percentages?.[label.code] || 0;
              const p = point(i, pct);
              const t = axisPoint(i, 0.75);
              return (
                <g key={`${label.code}-point`}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#084595" />
                  {pct > 0 ? (
                    <text
                      x={t.x}
                      y={t.y}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#334155"
                    >
                      {pct}%
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="py-10 text-sm text-slate-500">
            No profile labels found.
          </div>
        )}
      </div>
    </WhiteCard>
  );
}

function DriverTile(props: { driver: RhythmDriverKey; group?: DriverGroup }) {
  const d = DRIVER_COPY[props.driver];
  const group = props.group || "stabilising";
  const theme: Record<
    DriverGroup,
    { color: string; bg: string; border: string }
  > = {
    flow: {
      color: "#16A34A",
      bg: "rgba(22, 163, 74, 0.18)",
      border: "#16A34A",
    },
    stabilising: {
      color: "#F59E0B",
      bg: "rgba(245, 158, 11, 0.18)",
      border: "#F59E0B",
    },
    frustration: {
      color: "#BC1823",
      bg: "rgba(188, 24, 35, 0.18)",
      border: "#BC1823",
    },
  };
  const t = theme[group];

  return (
    <div
      className="min-h-[154px] rounded-lg px-[14px] pb-[14px] pt-[7px]"
      style={{
        background: t.bg,
        borderLeft: `1px solid ${t.border}`,
        borderRight: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
        borderTop: `3px solid ${t.border}`,
      }}
    >
      <div
        className="text-[42px] font-bold leading-[1.15]"
        style={{ color: t.color }}
      >
        {d.letter}
      </div>
      <div className="mt-[6px] text-[13px] font-bold leading-[18px] text-white">
        {d.label}
      </div>
      <p className="mt-[8px] text-[13px] leading-[21px] text-white/90">
        {d.short}
      </p>
    </div>
  );
}

function DriverDetailCard(props: {
  driver: RhythmDriverKey;
  group: DriverGroup;
}) {
  const d = DRIVER_COPY[props.driver];
  const g = GROUP_COPY[props.group];
  const expression =
    props.group === "flow"
      ? d.flow
      : props.group === "stabilising"
        ? d.stabilising
        : d.frustration;

  return (
    <div
      className={cls("overflow-hidden rounded-2xl border bg-white", g.border)}
    >
      <div
        className="flex gap-4 p-5 text-white"
        style={{ backgroundColor: g.color }}
      >
        <div className="text-4xl font-bold leading-none">{d.letter}</div>
        <div>
          <h4 className="text-xl font-bold">{d.label}</h4>
          <p className="mt-1 text-sm text-white/90">
            {g.label} · {d.definition}
          </p>
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <InfoList
          title="Research Alignment"
          items={d.research}
          tone={props.group}
        />
        <InfoList
          title={`${g.label} Expression`}
          items={expression}
          tone={props.group}
        />
        <InfoList
          title="Workplace Impact"
          items={d.impact}
          tone={props.group}
        />
        <div className={cls("rounded-xl border p-4", g.bg, g.border)}>
          <div
            className={cls("text-xs font-bold uppercase tracking-wide", g.text)}
          >
            Best used in
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{d.thrives}</p>
        </div>
      </div>
    </div>
  );
}

function InfoList(props: {
  title: string;
  items: string[];
  tone: DriverGroup;
}) {
  const g = GROUP_COPY[props.tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className={cls("text-xs font-bold uppercase tracking-wide", g.text)}>
        {props.title}
      </div>
      <ul className="mt-3 space-y-2">
        {props.items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-sm leading-6 text-slate-700"
          >
            <span
              className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntroTextBlock(props: {
  title: string;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <Card>
      <SectionHeader title={props.title} icon={props.icon} />
      <WhiteCard className="prose prose-slate max-w-none prose-p:leading-7 prose-p:text-slate-700">
        {props.children}
      </WhiteCard>
    </Card>
  );
}

function HowToUseCards() {
  const content = GENERIC_CONTENT.howToUseThisReport;

  return (
    <Card>
      <SectionHeader
        title="How to Use This Report"
        icon={REPORT_ASSETS.icons.howToUse}
      />
      <WhiteCard>
        <div className="space-y-4 text-sm leading-7 text-slate-700">
          {content.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {content.items.map((item, index) => (
            <div
              key={item.title}
              className="rounded-2xl bg-[#084595] p-4 text-white"
            >
              <div className="text-2xl font-bold text-white/60">
                {index + 1}
              </div>
              <div className="mt-3 text-sm font-bold">{item.title}</div>
              <p className="mt-2 text-xs leading-5 text-white/80">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-700">
          {content.closing}
        </p>
      </WhiteCard>
    </Card>
  );
}

function ProfileList(props: {
  profiles: Array<ProfileLabel & { pct?: number; short_code?: string }>;
  activeCode?: string;
}) {
  return (
    <div className="space-y-[8px] rounded-[18px] border border-white/10 bg-white/5 p-[17px]">
      {props.profiles.map((p, index) => {
        const active = p.code === props.activeCode;
        return (
          <div
            key={p.code}
            className={cls(
              "flex min-h-[43px] items-center gap-[10px] rounded-lg border px-[13px] py-[8px]",
              active
                ? "border-green-400/40 bg-green-400/15"
                : "border-white/10 bg-white/[0.03]",
            )}
          >
            <span
              className={cls(
                "w-[12px] text-[10px] font-normal",
                active ? "text-green-400/60" : "text-white/35",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cls(
                "h-[7px] w-[7px] rounded-full",
                active ? "bg-green-400" : "bg-sky-200/70",
              )}
            />
            <div className="min-w-0 flex-1">
              <div
                className={cls(
                  "text-[13px] font-semibold leading-[17px]",
                  active ? "text-green-300" : "text-white",
                )}
              >
                {p.name} {p.short_code ? `(${p.short_code})` : ""}
              </div>
            </div>
            <span
              className={cls(
                "shrink-0 text-right text-[10px]",
                active ? "text-green-300" : "text-white/35",
              )}
            >
              {p.frequency_code
                ? `${FREQUENCY_COPY[p.frequency_code]?.title.replace(" Frequency", "")} (${p.frequency_code})`
                : ""}
            </span>
            {active ? (
              <span className="rounded-full bg-green-500 px-2 py-[2px] text-[8px] font-bold text-white">
                You
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function NextStepCard(props: {
  title: string;
  body: string;
  button: string;
  href?: string | null;
  primary?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
        <ReportAssetImage
          src={REPORT_ASSETS.icons.nextSteps}
          alt="Next steps"
          className="h-full w-full object-cover"
        />
      </div>
      <h4 className="mt-4 font-semibold text-slate-800">{props.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.body}</p>
      {props.href ? (
        <button
          type="button"
          onClick={() =>
            window.open(props.href || "#", "_blank", "noopener,noreferrer")
          }
          className={cls(
            "mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold",
            props.primary
              ? "bg-slate-900 text-white hover:bg-slate-700"
              : "border border-slate-900 text-slate-900 hover:bg-slate-50",
          )}
        >
          {props.button}
        </button>
      ) : (
        <div className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-400">
          {props.button}
        </div>
      )}
    </div>
  );
}

export default function TeamPuzzleRhythmReportClient(props: {
  token: string;
  tid: string;
  src?: string;
}) {
  const { token, tid, src } = props;
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  const isPortalViewer = src === "portal";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!tid) throw new Error("Missing tid");
        const qs = new URLSearchParams({ tid });
        if (src) qs.set("src", src);

        const res = await fetch(
          `/api/public/test/${encodeURIComponent(token)}/team-puzzle-rhythm-report?${qs.toString()}`,
          {
            cache: "no-store",
          },
        );
        const json = (await res.json()) as ReportAPI;
        if (!res.ok || !json.ok || !json.data)
          throw new Error(json.error || `HTTP ${res.status}`);
        if (cancelled) return;

        if (json.data.hidden && !isPortalViewer) {
          const redirect = json.data.link?.redirect_url?.trim();
          if (redirect) {
            window.location.assign(redirect);
            return;
          }
        }

        setData(json.data);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, tid, src, isPortalViewer]);

  async function handleDownloadPdf() {
    if (!reportRef.current) return;
    const element = reportRef.current;
    const prevScroll = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#061A3A",
        scrollY: -window.scrollY,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`team-puzzle-rhythm-report-${token}.pdf`);
    } finally {
      window.scrollTo(0, prevScroll);
    }
  }

  const derived = useMemo(() => {
    if (!data) return null;

    const participantName = fullName(data.taker);
    const orgName = data.org?.name || "Life Puzzle";
    const profileName = data.result.top_profile_name || "Your Profile";
    const profileCode = data.result.top_profile_code || "";
    const profileCopy = PROFILE_COPY[profileCode] || {
      title: profileName,
      role: "Contribution Style",
      summary:
        "Your profile describes how you most naturally create value inside a team.",
      coreTraits: "Natural strengths, working energy, contribution style",
      idealEnvironment:
        "A role and environment that lets you use your strengths consistently",
    };

    const topFreq = data.result.top_freq;
    const topFreqName = data.result.top_freq_name || topFreq;
    const sortedProfiles = data.result.sorted_profiles || [];
    const primary = sortedProfiles[0] || null;
    const secondary =
      sortedProfiles[1] || data.result.secondary_profile || null;
    const tertiary = sortedProfiles[2] || data.result.tertiary_profile || null;

    const rhythm = data.rhythm;
    const flow = rhythm?.flow_drivers?.length
      ? rhythm.flow_drivers
      : (["resourceful", "human_centred"] as RhythmDriverKey[]);
    const stabilising = rhythm?.stabilising_drivers?.length
      ? rhythm.stabilising_drivers
      : (["yielding", "tactical"] as RhythmDriverKey[]);
    const frustration = rhythm?.frustration_drivers?.length
      ? rhythm.frustration_drivers
      : (["hopeful", "measured"] as RhythmDriverKey[]);

    return {
      participantName,
      orgName,
      profileName,
      profileCode,
      profileCopy,
      topFreq,
      topFreqName,
      sortedProfiles,
      primary,
      secondary,
      tertiary,
      flow,
      stabilising,
      frustration,
      heroImage: topProfileImage(profileName),
      nextStepsUrl: data.link?.next_steps_url?.trim() || null,
      date: formatDate(data.submission?.created_at),
    };
  }, [data]);

  if (!tid) {
    return (
      <div className="min-h-screen bg-[#061A3A] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-4xl p-6">
          <h1 className="text-2xl font-semibold">Team Puzzle RHYTHM Report</h1>
          <p className="mt-4 text-sm text-slate-300">
            This report needs a taker ID in the URL. Please open it from the
            completed assessment or portal profile.
          </p>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#061A3A] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-4xl p-6">
          <h1 className="text-2xl font-semibold">Team Puzzle RHYTHM Report</h1>
          <p className="mt-4 text-sm text-slate-300">Loading your report...</p>
        </main>
      </div>
    );
  }

  if (error || !data || !derived) {
    return (
      <div className="min-h-screen bg-[#061A3A] text-white">
        <AppBackground />
        <main className="relative z-10 mx-auto max-w-4xl p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Team Puzzle RHYTHM Report</h1>
          <p className="text-sm text-red-300">
            Could not load the report. Please refresh or contact support.
          </p>
          <details className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/80">
            <summary className="cursor-pointer font-semibold">Debug</summary>
            <div className="mt-3 space-y-1">
              <div>Token: {token}</div>
              <div>Taker ID: {tid}</div>
              <div>Error: {error || "No data returned"}</div>
            </div>
          </details>
        </main>
      </div>
    );
  }

  const {
    participantName,
    orgName,
    profileName,
    profileCode,
    profileCopy,
    topFreq,
    topFreqName,
    sortedProfiles,
    primary,
    secondary,
    tertiary,
    flow,
    stabilising,
    frustration,
    heroImage,
    nextStepsUrl,
    date,
  } = derived;
  const topFreqCopy = FREQUENCY_COPY[topFreq];

  return (
    <div
      ref={reportRef}
      className="relative min-h-screen overflow-hidden bg-[#061A3A] text-white"
    >
      <AppBackground />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 12% 12%, rgba(79,125,255,0.22), transparent 35%), radial-gradient(circle at 86% 18%, rgba(69,224,209,0.12), transparent 32%), radial-gradient(circle at 50% 90%, rgba(139,92,246,0.10), transparent 36%)",
        }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Card className="relative min-h-[170px] overflow-hidden p-[20px] md:p-[20px]">
          <div className="absolute right-[20px] top-[20px] z-10 flex gap-[8px]">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="h-[37px] rounded-lg border border-white/15 bg-[#08162B]/70 px-[15px] text-[13px] font-semibold leading-[20px] text-white hover:bg-[#08162B]/90"
            >
              Download PDF
            </button>
            {nextStepsUrl ? (
              <button
                type="button"
                onClick={() =>
                  window.open(nextStepsUrl, "_blank", "noopener,noreferrer")
                }
                className="h-[37px] rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-[14px] text-[13px] font-semibold leading-[20px] text-[#071C36]"
              >
                Next steps
              </button>
            ) : null}
          </div>

          <div className="flex items-start gap-[13px] pr-[240px]">
            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-white/15 bg-white/10 p-[3px]">
              <ReportAssetImage
                src={REPORT_ASSETS.logo}
                alt="Life Puzzle"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold capitalize leading-[22px] text-white">
                Team Puzzle Discovery Report
              </div>
              <div className="mt-[2px] text-[32px] font-semibold uppercase leading-[35px] tracking-[4.48px] text-white">
                Personalised Profile
              </div>
              <div className="mt-[10px] text-[13px] font-bold uppercase leading-[19.5px] tracking-[3.64px] text-white/75">
                Life Puzzle
              </div>
              <div className="mt-[13px] inline-flex rounded-full border border-white/15 bg-white/5 px-[12px] py-[3px] text-[10px] font-bold uppercase tracking-[0.25em] text-white/75">
                powered by profiletest.ai
              </div>
            </div>
          </div>

          <div className="mt-[14px] grid gap-[10px] md:ml-auto md:mr-0 md:w-[697px] md:grid-cols-[168px_168px_1fr]">
            <div className="h-[70px] rounded-[18px] border border-white/10 bg-gradient-to-b from-[rgba(35,62,97,0.72)] to-[rgba(18,38,64,0.78)] px-[15px] py-[12px]">
              <div className="text-[10px] leading-[15px] text-white/55">
                Prepared for
              </div>
              <div className="mt-[6px] text-[16px] font-semibold leading-[24px] text-white">
                {participantName}
              </div>
            </div>
            <div className="h-[70px] rounded-[18px] border border-white/10 bg-gradient-to-b from-[rgba(35,62,97,0.72)] to-[rgba(18,38,64,0.78)] px-[15px] py-[12px]">
              <div className="text-[10px] leading-[15px] text-white/55">
                Date
              </div>
              <div className="mt-[6px] text-[16px] font-semibold leading-[24px] text-white">
                {date}
              </div>
            </div>
            <div className="h-[70px] rounded-[18px] border border-white/10 bg-gradient-to-b from-[rgba(35,62,97,0.72)] to-[rgba(18,38,64,0.78)] px-[15px] py-[12px]">
              <div className="text-[10px] leading-[15px] text-white/55">
                Framework
              </div>
              <div className="mt-[6px] text-[16px] font-semibold leading-[20px] text-white">
                {data.test.name || "Team Puzzle Discovery Assessment"}
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_353px_353px]">
          <Card className="min-h-[423px] p-[22px]">
            <div className="text-[10px] font-normal uppercase leading-[15px] tracking-[2.6px] text-white/55">
              Team Puzzle Profile
            </div>
            <h1 className="mt-[18px] text-[42px] font-semibold leading-[46px] tracking-[0.5px] text-white md:text-[50px] md:leading-[50px]">
              {participantName}
            </h1>
            <p className="mt-[21px] max-w-[493px] text-[15px] font-normal leading-[28px] text-white/90">
              How the four behavioural energies show up in you, and your pattern
              to a more fearless way of being.
            </p>

            <div className="mt-[18px] flex flex-wrap items-center gap-[11px]">
              <StatPill tone="blue">
                Profile: {profileName} ({profileCodeToShort(profileCode)})
              </StatPill>
              <StatPill tone="green">
                {topFreqName} ({topFreq})
              </StatPill>
              <StatPill>Organisation: {data.taker.company || orgName}</StatPill>
            </div>

            <div className="mt-[28px] grid max-w-[550px] overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04] md:grid-cols-2">
              <div className="min-h-[123px] border-b border-white/10 p-[22px] md:border-b-0 md:border-r">
                <div className="text-[9px] font-semibold uppercase leading-[14px] tracking-[2px] text-[#5A6A88]">
                  Driver
                </div>
                <div className="mt-[8px] text-[20px] font-semibold leading-[20px] text-white">
                  {topFreqName} ({topFreq})
                </div>
                <p className="mt-[14px] max-w-[205px] text-[11px] leading-[17.6px] text-[#8B98B4]">
                  {topFreqCopy?.focus || topFreqCopy?.description}
                </p>
              </div>
              <div className="min-h-[123px] p-[22px]">
                <div className="text-[9px] font-semibold uppercase leading-[14px] tracking-[2px] text-[#5A6A88]">
                  Top Profile
                </div>
                <div className="mt-[8px] text-[20px] font-semibold leading-[20px] text-white">
                  {profileName}
                </div>
                <p className="mt-[14px] max-w-[227px] text-[11px] leading-[17.6px] text-[#8B98B4]">
                  A distinct working pattern that describes how you most
                  naturally create value.
                </p>
              </div>
            </div>
          </Card>

          <Card className="min-h-[423px] p-[17px]">
            <ProfileList profiles={sortedProfiles} activeCode={profileCode} />
          </Card>

          <Card className="min-h-[423px] p-[16px]">
            <div className="rounded-[18px] border border-[#4092C5] bg-[rgba(64,146,197,0.50)] px-[20px] py-[38px] text-center shadow-[0_6px_32px_rgba(58,110,212,0.12)]">
              <div className="text-[28px] font-semibold leading-[38px] text-white">
                {topFreqName} ({topFreq})
              </div>
              <div className="mt-[6px] text-[13px] leading-[19px] text-white/90">
                Your Dominant Frequency:
              </div>
            </div>
            <div className="mt-[17px] text-[9px] font-semibold uppercase leading-[14px] tracking-[2px] text-[#5A6A88]">
              Profile mix
            </div>
            <div className="mt-[8px] space-y-[8px]">
              {[primary, secondary, tertiary]
                .filter(Boolean)
                .map((p: any, index) => (
                  <div
                    key={p.code}
                    className="min-h-[66px] rounded-lg border border-white/10 bg-white/[0.03] px-[17px] py-[13px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-semibold leading-[17px] text-white">
                          {p.name} ({p.short_code || profileCodeToShort(p.code)}
                          )
                        </div>
                        <div className="mt-[3px] text-[10px] text-white/35">
                          {index === 0
                            ? "Primary"
                            : index === 1
                              ? "Secondary"
                              : "Tertiary"}{" "}
                          · {p.short_code || profileCodeToShort(p.code)}
                        </div>
                      </div>
                      <div className="text-[11px] text-white">{p.pct}%</div>
                    </div>
                    <div className="ml-[78px] mt-[-5px] h-[4px] overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#6BAED6]"
                        style={{ width: `${clamp(Number(p.pct || 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        <Card className="mt-6 p-[24px]">
          <h2 className="text-[14px] font-semibold leading-[20px] text-white">
            Professional Performance Rhythm
          </h2>
          <p className="mt-[-2px] text-[14px] font-normal leading-[20px] text-white/85">
            Your RHYTHM Drivers
          </p>
          <div className="mt-[36px] grid gap-[15px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                "resourceful",
                "hopeful",
                "yielding",
                "tactical",
                "human_centred",
                "measured",
              ] as RhythmDriverKey[]
            ).map((driver) => (
              <DriverTile
                key={driver}
                driver={driver}
                group={
                  flow.includes(driver)
                    ? "flow"
                    : stabilising.includes(driver)
                      ? "stabilising"
                      : "frustration"
                }
              />
            ))}
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <FrequencyChart
            labels={data.result.frequency_labels}
            percentages={data.result.frequency_percentages}
          />
          <ProfileRadar
            labels={data.result.profile_labels}
            percentages={data.result.profile_percentages}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-[24px] border border-white/10 bg-gradient-to-b from-[rgba(27,60,99,0.78)] to-[rgba(12,32,58,0.84)] p-[18px] shadow-[0_14px_42px_rgba(0,0,0,0.32)] lg:sticky lg:top-4">
            <div className="text-[10px] font-semibold uppercase leading-[15px] tracking-[2.6px] text-white/45">
              Report Index
            </div>
            <ol className="mt-[14px] space-y-[7px]">
              {[
                "Welcome from Chandell",
                "How to use this report",
                "Introducing the Team Puzzle Framework",
                "Understanding the Four Frequencies & Eight Profiles",
                "The Four Frequencies – Energies That Drive Contribution",
                "The Eight Profiles",
                "The Eight Profiles – Natural Contribution Types",
                "Frequency summary",
                "Personality Map",
                "Profile mix",
                `Your profile in depth: ${profileName}`,
                "Professional Performance Rhythm",
                "The 3-Level Energy Model",
                "Your Professional Performance Rhythm",
                "Energy mix – how your profiles work together",
                "Team Role Fit",
                "Your Value Creation Pathway",
                "Collaboration Tips",
                "Development Recommendations",
                "What Could Be Holding You Back?",
                "Your Next Steps",
              ].map((item, index) => (
                <li
                  key={item}
                  className="rounded-[10px] border border-white/[0.06] bg-white/[0.035] px-[10px] py-[8px] text-[10px] font-medium leading-[15px] text-white/85"
                >
                  <span className="text-white/45">{index + 1}.</span> {item}
                </li>
              ))}
            </ol>
            <div className="mt-[28px] flex flex-col items-start gap-[8px]">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex h-[31px] items-center justify-center rounded-[8px] border border-white/12 bg-[rgba(8,22,43,0.72)] px-[14px] text-[11px] font-semibold leading-[16px] text-[#F8FAFC] shadow-sm"
              >
                Download PDF
              </button>
              {nextStepsUrl ? (
                <a
                  href={nextStepsUrl}
                  className="inline-flex h-[31px] items-center justify-center rounded-[8px] bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-[14px] text-[11px] font-semibold leading-[16px] text-[#071C36] shadow-sm"
                >
                  Next step
                </a>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-[31px] items-center justify-center rounded-[8px] bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-[14px] text-[11px] font-semibold leading-[16px] text-[#071C36] shadow-sm"
                >
                  Next step
                </button>
              )}
            </div>
          </aside>

          <div className="space-y-8">
            <IntroTextBlock
              title="Welcome from Chandell"
              icon={REPORT_ASSETS.icons.welcome}
            >
              {GENERIC_CONTENT.welcomeFromChandell.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <div className="not-prose mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <ReportAssetImage
                  src={REPORT_ASSETS.chandell}
                  alt="Chandell Labbozzetta"
                  className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                />
                <p className="m-0 text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.welcomeFromChandell.signoff}
                  <br />
                  <strong>{GENERIC_CONTENT.welcomeFromChandell.name}</strong>
                  <br />
                  {GENERIC_CONTENT.welcomeFromChandell.role}
                </p>
              </div>
            </IntroTextBlock>

            <HowToUseCards />

            <Card>
              <SectionHeader
                title="Introducing The Team Puzzle Framework"
                icon={REPORT_ASSETS.icons.introTeamPuzzleFramework}
              />
              <WhiteCard className="p-0">
                <div className="space-y-5 p-6 text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.introducingTeamPuzzleFramework.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <p>
                    At its core, Team Puzzle helps organisations answer one fundamental question: {" "}
                    <em>{GENERIC_CONTENT.introducingTeamPuzzleFramework.question}</em>
                  </p>
                  <p>{GENERIC_CONTENT.introducingTeamPuzzleFramework.afterQuestion}</p>
                </div>
                <div className="mx-5 mb-6 overflow-hidden rounded-2xl border border-[#4092C5] bg-white shadow-sm">
                  <div className="grid lg:grid-cols-[210px_1fr]">
                    <div className="flex items-center bg-[#4092C5] p-7 text-3xl font-bold leading-tight text-white">
                      This framework gives you:
                    </div>
                    <div className="grid gap-0 divide-y divide-slate-100 p-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                      {[
                        REPORT_ASSETS.icons.structure,
                        REPORT_ASSETS.icons.commonLanguage,
                        REPORT_ASSETS.icons.strategicMap,
                        REPORT_ASSETS.icons.ideas,
                      ].map((icon, index) => (
                        <div
                          key={GENERIC_CONTENT.introducingTeamPuzzleFramework.benefits[index]}
                          className="flex flex-col items-start gap-4 p-5"
                        >
                          <ReportAssetImage
                            src={icon}
                            alt=""
                            className="h-16 w-16 object-contain"
                          />
                          <p className="text-sm leading-6 text-slate-700">
                            {GENERIC_CONTENT.introducingTeamPuzzleFramework.benefits[index]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 px-6 pb-6 text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.introducingTeamPuzzleFramework.closing.map((paragraph, index) => (
                    <p key={paragraph}>
                      {index === 0 ? (
                        <>
                          The Team Puzzle approach is not about fixing people. It is about {" "}
                          <strong>fitting people together.</strong>
                        </>
                      ) : (
                        paragraph
                      )}
                    </p>
                  ))}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Understanding the Four Frequencies & Eight Profiles"
                icon={REPORT_ASSETS.icons.understandingFrequenciesProfiles}
              />
              <WhiteCard className="p-0">
                <div className="space-y-5 p-6 text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.understandingFrequenciesProfiles.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <div className="flex justify-center px-6 pb-6">
                  <ReportAssetImage
                    src={REPORT_ASSETS.frequencyWheel}
                    alt="Team Puzzle frequencies visual"
                    className="mx-auto h-auto w-full max-w-[470px] object-contain"
                  />
                </div>
                <div className="grid gap-3 px-6 pb-6 md:grid-cols-4">
                  {(["A", "B", "C", "D"] as FrequencyCode[]).map((code) => (
                    <div
                      key={code}
                      className="rounded-2xl border border-[#084595] bg-white p-4"
                    >
                      <h3 className="font-semibold text-[#084595]">
                        {FREQUENCY_COPY[code].title.replace(" Frequency", " Frequency")} ({code})
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {GENERIC_CONTENT.understandingFrequenciesProfiles.frequencySummaries[code]}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="px-6 pb-6 text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.understandingFrequenciesProfiles.closing}
                </p>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="The Four Frequencies – Energies That Drive Contribution"
                icon={REPORT_ASSETS.icons.fourFrequencies}
              />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.fourFrequencies.intro}
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {(["A", "B", "C", "D"] as FrequencyCode[]).map((code) => {
                    const item = FREQUENCY_COPY[code];
                    const content = GENERIC_CONTENT.fourFrequencies.frequencies[code];
                    return (
                      <div
                        key={code}
                        className="rounded-2xl border border-[#084595]/30 bg-white p-5"
                      >
                        <h3 className="text-base font-bold text-[#084595]">
                          {code}. {item.title}
                        </h3>
                        <dl className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                          <div>
                            <dt className="font-bold text-slate-900">Focus:</dt>
                            <dd>{content.focus}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">
                              Strength:
                            </dt>
                            <dd>{content.strength}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">
                              Blind Spot:
                            </dt>
                            <dd>{content.blindSpot}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">
                              Leverage point:
                            </dt>
                            <dd>{content.leveragePoint}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                    Reflection prompts
                  </h3>
                  <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
                    {GENERIC_CONTENT.fourFrequencies.reflectionPrompts.map((prompt, index) => (
                      <li key={prompt}>
                        <strong>{index + 1}.</strong> {prompt}
                      </li>
                    ))}
                  </ol>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="The Eight Profiles"
                icon={REPORT_ASSETS.icons.eightProfiles}
              />
              <WhiteCard className="p-0">
                <div className="px-[35px] pt-[26px] text-[13px] leading-[28px] text-slate-700">
                  <p>{GENERIC_CONTENT.eightProfiles.intro}</p>
                </div>

                <div className="flex justify-center px-6 pt-[48px]">
                  <ReportAssetImage
                    src={REPORT_ASSETS.frameworkVisual}
                    alt="Team Puzzle profile framework"
                    className="h-auto w-full max-w-[387px] object-contain"
                  />
                </div>

                <div className="grid gap-x-[18px] gap-y-[28px] px-[22px] pt-[48px] pb-[38px] md:grid-cols-2 xl:grid-cols-4">
                  {orderedProfileItems(data.result.profile_labels).map((p) => {
                    const copy = GENERIC_PROFILE_CONTENT[p.code as keyof typeof GENERIC_PROFILE_CONTENT];
                    const active = p.code === profileCode;
                    const image = topProfileImage(p.name);
                    const freq =
                      p.frequency_code || PROFILE_FREQUENCIES[p.code] || "A";
                    const accent = PROFILE_ACCENT[freq];
                    return (
                      <div
                        key={p.code}
                        className="relative min-h-[266px] overflow-hidden rounded-[18px] bg-white shadow-[0_4px_8px_rgba(0,0,0,0.22)]"
                      >
                        <div
                          className="h-[84px] rounded-t-[18px]"
                          style={{ backgroundColor: accent }}
                        />
                        <div className="absolute left-1/2 top-[31px] flex h-[91px] w-[89px] -translate-x-1/2 items-center justify-center rounded-b-[12px] bg-white shadow-[0_4px_8px_rgba(0,0,0,0.22)]">
                          {image ? (
                            <ReportAssetImage
                              src={image}
                              alt={p.name}
                              className="h-[59px] w-[59px] object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="px-[15px] pt-[72px] text-center">
                          <div className="relative inline-flex items-center justify-center gap-2">
                            <h3 className="text-[12px] font-semibold leading-[19px] text-[#111828]">
                              {p.name}
                            </h3>
                            {active ? (
                              <span className="absolute left-full ml-2 whitespace-nowrap rounded-full bg-[#0FCD5E] px-[7px] py-[2px] text-[8px] font-bold leading-[10px] text-white">
                                Your Profile
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-[6px] text-[10px] font-normal uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                            {FREQUENCY_COPY[freq]?.title.replace(
                              " Frequency",
                              "",
                            )}{" "}
                            ({freq})
                          </div>
                          <p className="mx-auto mt-[16px] max-w-[226px] text-center text-[11px] font-normal leading-[16.5px] text-[#313C52]">
                            {copy?.summary ||
                              "A distinct contribution pattern within the Team Puzzle framework."}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-[35px] pb-[30px] text-[13px] leading-[28px] text-slate-700">
                  <p>
                    {GENERIC_CONTENT.eightProfiles.closing}
                    <br />
                    In the pages ahead, we’ll explore each profile in depth. For now, remember: every team has a puzzle. The most successful ones know how the pieces fit together.
                  </p>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="The Eight Profiles – Natural Contribution Types"
                icon={REPORT_ASSETS.icons.naturalContribution}
              />

              <div className="rounded-[18px] bg-white px-[17px] py-[23px] text-[13px] leading-[28px] text-[#313C52]">
                <p>{GENERIC_CONTENT.naturalContributionTypes.intro}</p>
              </div>

              <div className="mt-[16px] space-y-[16px]">
                {orderedProfileItems(data.result.profile_labels).map(
                  (p, index) => {
                    const copy = GENERIC_PROFILE_CONTENT[p.code as keyof typeof GENERIC_PROFILE_CONTENT];
                    const image = topProfileImage(p.name);
                    const freq =
                      p.frequency_code || PROFILE_FREQUENCIES[p.code] || "A";
                    return (
                      <div
                        key={p.code}
                        className="grid min-h-[186px] grid-cols-[124px_1fr] items-start gap-[17px] rounded-[18px] border-t-[4px] border-t-[#6BAED6] bg-white px-[9px] py-[20px] shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
                      >
                        <div className="flex h-[124px] w-[124px] items-center justify-center overflow-hidden">
                          {image ? (
                            <ReportAssetImage
                              src={image}
                              alt={p.name}
                              className="h-[124px] w-[124px] object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="pt-[3px]">
                          <div className="text-[10px] font-normal uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                            Profile {index + 1} · Frequency {freq}
                          </div>
                          <h3 className="mt-[7px] text-[15px] font-semibold leading-[19.2px] text-[#111828]">
                            {copy ? `The ${copy.display}` : p.name}{" "}
                            {copy?.role ? (
                              <span className="font-normal italic">
                                – {copy.role}
                              </span>
                            ) : null}
                          </h3>
                          <p className="mt-[18px] max-w-[898px] text-[13px] font-normal leading-[28px] text-[#313C52]">
                            {copy?.naturalContribution ||
                              "A distinct contribution pattern within the Team Puzzle framework."}
                          </p>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="mt-[16px] min-h-[309px] rounded-[18px] bg-white p-[30px]">
                <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                  Reflection Exercise:
                </h3>
                <div className="mt-[20px] grid grid-cols-[56px_1fr] gap-[15px]">
                  <div className="relative flex flex-col items-center gap-[15px] pt-[7px]">
                    <div className="absolute left-1/2 top-[13px] h-[204px] w-px -translate-x-1/2 bg-gradient-to-b from-[#3B82F6] to-blue-500/10" />
                    {[1, 2, 3, 4].map((number) => (
                      <div
                        key={number}
                        className="relative z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#111828] bg-white text-[14px] font-bold leading-[22px] text-[#111828]"
                      >
                        {number}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-[20px] pt-[7px] text-[13px] leading-[27px] text-[#313C52]">
                    {GENERIC_CONTENT.naturalContributionTypes.reflectionPrompts.map((prompt) => (
                      <p key={prompt}>{prompt}</p>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Frequency summary"
                icon={REPORT_ASSETS.icons.frequencySummary}
              />
              <WhiteCard className="p-[16px]">
                <p className="text-[13px] leading-[28px] text-[#313C52]">
                  Your strongest overall frequency is{" "}
                  <strong className="text-[#4092C5]">
                    {topFreqName} ({topFreq})
                  </strong>
                  , which shapes how you approach problems and make decisions.
                  Higher percentages indicate where you naturally spend more
                  energy; lower percentages highlight areas that may feel less
                  comfortable or more draining.
                </p>

                <div className="mt-[28px] grid gap-[30px] lg:grid-cols-[494px_1fr]">
                  <div className="rounded-[18px] border border-white/90 bg-white/85 p-[17px] shadow-[0_6px_32px_rgba(58,110,212,0.12)]">
                    <div className="space-y-[23px]">
                      {(["A", "B", "C", "D"] as FrequencyCode[]).map((code) => {
                        const label =
                          data.result.frequency_labels.find(
                            (item) => item.code === code,
                          )?.name ||
                          FREQUENCY_COPY[code].title.replace(" Frequency", "");
                        const pct = clamp(
                          data.result.frequency_percentages[code] || 0,
                        );
                        const barColour: Record<FrequencyCode, string> = {
                          A: "#084595",
                          B: "#4092C5",
                          C: "linear-gradient(180deg, #F0C97A 0%, #D48C3A 100%)",
                          D: "#B1D3F6",
                        };
                        return (
                          <div
                            key={code}
                            className="grid grid-cols-[150px_1fr_34px] items-center gap-[12px] text-[12px] leading-[19px] text-[#3D4163]"
                          >
                            <div>{label}</div>
                            <div className="h-[5px] overflow-hidden rounded-full bg-[#A0A5C0]/20">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: barColour[code],
                                }}
                              />
                            </div>
                            <div className="text-right text-[11px] font-medium leading-[17px]">
                              {pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-r-[10px] border-l-[3px] border-l-[#1B3C63]/80 bg-[#EFEFEF]/40 px-[20px] py-[9px]">
                    <h3 className="text-[14px] font-semibold leading-[22.4px] text-[#334155]">
                      How to read these scores
                    </h3>
                    <ul className="mt-[16px] list-disc space-y-[3px] pl-[18px] text-[13px] leading-[20.8px] text-[#313C52]">
                      <li>
                        Higher percentages highlight patterns you use frequently
                        and with ease.
                      </li>
                      <li>
                        Lower percentages highlight backup styles you can use
                        when needed, but they may cost more energy.
                      </li>
                      <li>
                        Anything above roughly 30% will usually feel very
                        natural for you.
                      </li>
                      <li>
                        Your primary profile is your strongest pattern. Your
                        secondary and tertiary profiles show helpful support
                        patterns around your core style.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-[28px] grid overflow-hidden rounded-[18px] border border-[#4092C5] shadow-[0_6px_32px_rgba(58,110,212,0.12)] lg:grid-cols-[231px_1fr]">
                  <div className="flex min-h-[198px] flex-col items-center justify-center bg-[#4092C5] px-[24px] text-center text-white">
                    <div className="text-[28px] font-semibold leading-[38px]">
                      {topFreqName} ({topFreq})
                    </div>
                    <div className="mt-[6px] text-[13px] leading-[19px]">
                      Your Dominant Frequency:
                    </div>
                  </div>
                  <div className="grid min-h-[198px] gap-[28px] bg-white px-[46px] py-[21px] md:grid-cols-3">
                    <div>
                      <ReportAssetImage
                        src="/icons/tp-key-trait1.png"
                        alt="Key traits"
                        className="h-[66px] w-[60px] object-contain"
                      />
                      <p className="mt-[12px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Key traits:</strong> The energy you rely on most
                        when you need to move things forward.
                      </p>
                    </div>
                    <div>
                      <ReportAssetImage
                        src="/icons/tp-key-trait2.png"
                        alt="Motivators"
                        className="h-[66px] w-[60px] object-contain"
                      />
                      <p className="mt-[12px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Motivators:</strong> Conditions that help this
                        way of working feel energising and sustainable.
                      </p>
                    </div>
                    <div>
                      <ReportAssetImage
                        src="/icons/tp-key-trait3.png"
                        alt="Watch outs"
                        className="h-[66px] w-[60px] object-contain"
                      />
                      <p className="mt-[12px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Watch outs:</strong> Things to notice when this
                        frequency is over-used, such as ignoring other
                        perspectives or pushing your preferred style too hard.
                      </p>
                    </div>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Personality Map"
                icon={REPORT_ASSETS.icons.personalityMap}
              />
              <ProfileRadar
                labels={data.result.profile_labels}
                percentages={data.result.profile_percentages}
              />
            </Card>

            <Card>
              <SectionHeader
                title="Profile mix"
                icon={REPORT_ASSETS.icons.profileMix}
              />
              <WhiteCard className="p-0">
                <div className="p-[16px]">
                  <p className="text-[13px] leading-[28px] text-[#313C52]">
                    Your profile mix shows how strongly you match each of the
                    eight Profiles. Higher percentages show patterns you use
                    often; lower ones are backup styles you can lean on when
                    needed.
                  </p>

                  <div className="mt-[18px] grid gap-[15px] lg:grid-cols-2">
                    {[
                      orderedProfileItems(data.result.profile_labels).slice(
                        0,
                        4,
                      ),
                      orderedProfileItems(data.result.profile_labels).slice(
                        4,
                        8,
                      ),
                    ].map((group, groupIndex) => (
                      <div
                        key={`profile-mix-bars-${groupIndex}`}
                        className="rounded-[18px] bg-white/90 px-[17px] py-[17px] shadow-[0_6px_32px_rgba(58,110,212,0.12)] ring-1 ring-white"
                      >
                        <div className="space-y-[22px]">
                          {group.map((profile) => {
                            const pct = Math.round(
                              data.result.profile_percentages?.[profile.code] ||
                                0,
                            );
                            const frequency =
                              profile.frequency_code ||
                              PROFILE_FREQUENCIES[profile.code];
                            const barColor =
                              PROFILE_ACCENT[frequency || "B"] || "#4092C5";

                            return (
                              <div
                                key={`profile-mix-row-${profile.code}`}
                                className="grid grid-cols-[150px_1fr_34px] items-center gap-[12px]"
                              >
                                <div className="text-[12px] leading-[19px] text-[#3D4163]">
                                  {profile.name}
                                </div>
                                <div className="h-[5px] overflow-hidden rounded-full bg-[#A0A5C0]/20">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${clamp(pct)}%`,
                                      backgroundColor: barColor,
                                    }}
                                  />
                                </div>
                                <div className="text-right text-[11px] font-medium leading-[17px] text-[#3D4163]">
                                  {pct}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-[17px] text-[13px] leading-[28px] text-[#313C52]">
                    Overall, your strongest profile pattern is{" "}
                    <strong>
                      {primary?.name || profileName} (
                      {primary?.short_code || profileCodeToShort(profileCode)}),
                    </strong>{" "}
                    supported by{" "}
                    <strong>
                      {secondary?.name || "your secondary profile"}
                      {secondary
                        ? ` (${secondary.short_code || profileCodeToShort(secondary.code)})`
                        : ""}
                    </strong>{" "}
                    and{" "}
                    <strong>
                      {tertiary?.name || "your tertiary profile"}
                      {tertiary
                        ? ` (${tertiary.short_code || profileCodeToShort(tertiary.code)})`
                        : ""}
                      .
                    </strong>
                  </p>
                </div>
              </WhiteCard>

              <div className="mt-[18px] grid gap-[15px] lg:grid-cols-3">
                {[primary, secondary, tertiary]
                  .filter(Boolean)
                  .map((p, index) => {
                    const item = p as ProfileLabel & {
                      pct: number;
                      short_code: string;
                    };
                    const labels = [
                      "Primary profile",
                      "Secondary profile",
                      "Tertiary profile",
                    ];
                    const borderColors = ["#6BAED6", "#91C3F5", "#C6E1FC"];
                    const pctColors = ["#6BAED6", "#4092C5", "#022B61"];
                    const image = topProfileImage(item.name);

                    return (
                      <div
                        key={`${item.code}-${index}-profile-card`}
                        className="min-h-[303px] rounded-[18px] border-t-4 bg-white p-[21px] text-[#313C52] shadow-sm"
                        style={{ borderTopColor: borderColors[index] }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[10px] uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                              {labels[index]}
                            </div>
                            {image ? (
                              <ReportAssetImage
                                src={image}
                                alt={item.name}
                                className="mt-[14px] h-[54px] w-[54px] object-contain"
                              />
                            ) : null}
                          </div>
                          <div
                            className="pt-[25px] text-[40px] font-semibold leading-[19px]"
                            style={{ color: pctColors[index] }}
                          >
                            {Math.round(item.pct || 0)}%
                          </div>
                        </div>

                        <h3 className="mt-[12px] text-[15px] font-semibold leading-[19.2px] text-[#111828]">
                          {item.name}{" "}
                          {item.short_code || profileCodeToShort(item.code)}
                        </h3>

                        <div className="mt-[14px] text-[11px] leading-[16.5px] text-[#313C52]">
                          <p>
                            <strong>Key traits:</strong> How this profile most
                            naturally contributes when things are going well.
                          </p>
                          <p className="mt-[14px]">
                            <strong>Motivators:</strong> Conditions that help
                            this style feel energising and sustainable.
                          </p>
                          <p className="mt-[14px]">
                            <strong>Watch outs:</strong> Things to watch out for
                            when this style is over-used or under pressure.
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>

            <Card>
              <SectionHeader
                title={`Your profile in depth: ${profileCopy.title.replace(/^The\s+/i, "The ")}`}
                icon={REPORT_ASSETS.icons.profileInDepth}
              />
              <WhiteCard className="p-0">
                <div className="grid gap-[20px] p-[17px] lg:grid-cols-[527px_1fr]">
                  <div className="space-y-[17px]">
                    <div className="rounded-[18px] bg-[#4092C5] p-[20px] shadow-[0_6px_32px_rgba(58,110,212,0.12)]">
                      <div className="grid min-h-[172px] grid-cols-[166px_1fr] gap-[30px] items-center">
                        {heroImage ? (
                          <ReportAssetImage
                            src={heroImage}
                            alt={profileName}
                            className="h-[158px] w-[166px] object-contain"
                          />
                        ) : null}
                        <div className="text-white">
                          <div className="text-[10px] uppercase leading-[16px] tracking-[1px] text-white/90">
                            Core Details
                          </div>
                          <div className="mt-[8px] text-[13px] leading-[20.8px]">
                            <p>
                              <strong>Frequency:</strong>{" "}
                              {FREQUENCY_COPY[topFreq]?.title.replace(
                                " Frequency",
                                "",
                              ) || topFreqName}{" "}
                              ({topFreq})
                            </p>
                            <p className="mt-[12px]">
                              <strong>Core Traits:</strong>{" "}
                              {profileCopy.coreTraits}
                            </p>
                            <p className="mt-[12px]">
                              <strong>Ideal Environment:</strong>{" "}
                              {profileCopy.idealEnvironment}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[18px] bg-white p-[24px] shadow-[0_6px_32px_rgba(58,110,212,0.12)] ring-1 ring-[#4092C5]">
                      <p className="text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>You may have been called:</strong>
                        <br />
                        the people whisperer, the translator, the empathic
                        leader, the harmoniser.
                      </p>
                      <p className="mt-[18px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Famous {profileName}s include:</strong>
                        <br />
                        {profileCopy.famous ||
                          "Recognised leaders and contributors who create value through this style."}
                      </p>
                    </div>
                  </div>

                  <div className="text-[13px] leading-[28px] text-[#313C52]">
                    <p>
                      {profileCopy.summary} You have a natural gift for using
                      your strongest contribution style in a way that helps
                      people, plans, and priorities move forward with more
                      clarity.
                    </p>
                    <p className="mt-[20px]">
                      You are often the person people turn to when they need
                      your particular blend of energy, timing, and contribution.
                      You may not always notice how much this shapes the room,
                      but others often experience your strengths as a
                      stabilising or activating force.
                    </p>
                    <p className="mt-[20px]">
                      To deepen your self-awareness and leadership impact, use
                      this section as a prompt to notice where your profile
                      gives you energy, where it may be over-used, and where
                      support from complementary profiles can help you create
                      even more value.
                    </p>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Professional Performance Rhythm"
                icon={REPORT_ASSETS.icons.professionalPerformanceRhythm}
              />

              <WhiteCard className="p-[20px]">
                <div className="text-[13px] leading-[28px] text-[#313C52]">
                  {GENERIC_CONTENT.professionalPerformanceRhythm.intro.map((paragraph, index) => (
                    <p key={paragraph} className={index === 0 ? undefined : "mt-[18px]"}>
                      {index === 0 ? (
                        <>
                          Your Team Puzzle Profile explains your natural energy and contribution style. Alongside this, the {" "}
                          <strong>Professional Performance Rhythm</strong> reveals how you approach work and create results across six key drivers.
                        </>
                      ) : (
                        paragraph
                      )}
                    </p>
                  ))}
                </div>

                <div className="mt-[24px] grid max-w-[780px] grid-cols-3 overflow-hidden rounded-[18px] bg-white shadow-[0_6px_32px_rgba(58,110,212,0.12)]">
                  {[
                    { file: "tp-r-puzzle.png", label: "Resourceful" },
                    { file: "tp-h-puzzle.png", label: "Human-Centred" },
                    { file: "tp-y-puzzle.png", label: "Yielding" },
                    { file: "tp-t-puzzle.png", label: "Tactical" },
                    { file: "tp-h-puzzle.png", label: "Hopeful" },
                    { file: "tp-m-puzzle.png", label: "Measured" },
                  ].map((piece) => (
                    <div
                      key={piece.label}
                      className="aspect-[1.48] overflow-hidden"
                    >
                      <RhythmPuzzlePieceImage
                        file={piece.file}
                        alt={piece.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-[28px] grid gap-[16px] lg:grid-cols-2">
                  <div className="rounded-[18px] bg-white p-[24px] shadow-[0_6px_32px_rgba(58,110,212,0.12)] ring-1 ring-[#4092C5]">
                    <h3 className="text-[13px] font-bold leading-[20.8px] text-[#313C52]">
                      What This Means
                    </h3>
                    {GENERIC_CONTENT.professionalPerformanceRhythm.whatThisMeans.map((paragraph, index) => (
                      <p
                        key={paragraph}
                        className={cls(
                          "text-[13px] leading-[28px] text-[#313C52]",
                          index === 0 ? "mt-[16px]" : "mt-[18px]",
                        )}
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  <div className="rounded-[18px] bg-white p-[24px] shadow-[0_6px_32px_rgba(58,110,212,0.12)] ring-1 ring-[#4092C5]">
                    <h3 className="text-[13px] font-bold leading-[20.8px] text-[#313C52]">
                      Understanding this helps you:
                    </h3>
                    <ul className="mt-[16px] space-y-[10px] text-[13px] leading-[28px] text-[#313C52]">
                      {GENERIC_CONTENT.professionalPerformanceRhythm.helps.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </WhiteCard>

              <WhiteCard className="mt-[22px] p-[22px]">
                <div className="text-[10px] font-bold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                  How to Interpret Your Results
                </div>
                <p className="mt-[8px] text-[13px] leading-[28px] text-[#313C52]">
                  Your six drivers are grouped into three categories:
                </p>
                <div className="mt-[20px] grid gap-[18px] lg:grid-cols-3">
                  <div className="overflow-hidden rounded-[12px] border border-[#16A34A] bg-white">
                    <div className="bg-[#16A34A] py-[7px] text-center text-[13px] font-semibold leading-[28px] text-white">
                      (Your Top 2)
                    </div>
                    <div className="p-[20px] text-[13px] leading-[28px] text-[#313C52]">
                      <p>
                        <span className="font-bold text-[#16A34A]">
                          ● Flow Drivers
                        </span>{" "}
                        — These are your strongest and most natural ways of
                        working. You use these instinctively, and they give you
                        energy rather than drain it.
                      </p>
                      <p className="mt-[16px]">
                        When you are working in your Flow Drivers:
                      </p>
                      <ul className="mt-[8px] space-y-[4px]">
                        <li>• You perform at your best</li>
                        <li>• You feel more engaged and confident</li>
                        <li>• You create the most value for your team</li>
                        <li>• It feels fun and fulfilling</li>
                        <li>• It&apos;s where your genius lives</li>
                      </ul>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[12px] border border-[#F59E0B] bg-white">
                    <div className="bg-[#F59E0B] py-[7px] text-center text-[13px] font-semibold leading-[28px] text-white">
                      (Your Middle 2)
                    </div>
                    <div className="p-[20px] text-[13px] leading-[28px] text-[#313C52]">
                      <p>
                        <span className="font-bold text-[#F59E0B]">
                          ● Stabilising Drivers
                        </span>{" "}
                        — These are drivers you can use when needed, but they
                        are not your default.
                      </p>
                      <ul className="mt-[12px] space-y-[4px]">
                        <li>
                          • They help you stay flexible and balanced, but they
                          require more conscious effort.
                        </li>
                        <li>• Can add variety and differences.</li>
                        <li>
                          • You are effective here, but it is not where you gain
                          energy long term.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[12px] border border-[#BC1823] bg-white">
                    <div className="bg-[#BC1823] py-[7px] text-center text-[13px] font-semibold leading-[28px] text-white">
                      (Your Bottom 2)
                    </div>
                    <div className="p-[20px] text-[13px] leading-[28px] text-[#313C52]">
                      <p>
                        <span className="font-bold text-[#BC1823]">
                          ● Frustration Drivers
                        </span>{" "}
                        — These are the drivers that require the most effort
                        from you. You can still operate in them, but doing so
                        consistently may feel draining or frustrating.
                      </p>
                      <p className="mt-[16px]">These areas often highlight:</p>
                      <ul className="mt-[8px] space-y-[4px]">
                        <li>• Where you may avoid certain tasks</li>
                        <li>• Where you feel less confident or slower</li>
                        <li>
                          • Where you benefit most from support or collaboration
                        </li>
                        <li>
                          • Can be the source of emotional trauma/stress
                          elevation
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </WhiteCard>

              <WhiteCard className="mt-[22px] p-[26px]">
                <div className="text-[10px] font-bold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                  The Six RHYTHM Drivers
                </div>
                <p className="mt-[14px] text-[13px] leading-[28px] text-[#313C52]">
                  Each driver represents a different way of working within a
                  team or organisation.
                </p>
                <div className="mt-[24px] space-y-[28px]">
                  {(
                    [
                      "resourceful",
                      "human_centred",
                      "yielding",
                      "tactical",
                      "hopeful",
                      "measured",
                    ] as RhythmDriverKey[]
                  ).map((driver) => {
                    const d = DRIVER_COPY[driver];
                    const puzzleFiles: Record<RhythmDriverKey, string> = {
                      resourceful: "tp-r-puzzle.png",
                      human_centred: "tp-h-puzzle.png",
                      yielding: "tp-y-puzzle.png",
                      tactical: "tp-t-puzzle.png",
                      hopeful: "tp-h-puzzle.png",
                      measured: "tp-m-puzzle.png",
                    };
                    return (
                      <div
                        key={driver}
                        className="grid gap-[22px] lg:grid-cols-[101px_1fr]"
                      >
                        <div className="flex h-[82px] w-[101px] items-center justify-center overflow-visible">
                          <RhythmPuzzlePieceImage
                            file={puzzleFiles[driver]}
                            alt={`${d.label} RHYTHM puzzle piece`}
                            className="h-[82px] w-[101px] object-contain"
                          />
                        </div>
                        <div className="text-[13px] leading-[28px] text-[#313C52]">
                          <h3 className="font-bold">{d.label}</h3>
                          <p>
                            You focus on{" "}
                            {driver === "resourceful"
                              ? "finding practical solutions and moving things forward"
                              : driver === "human_centred"
                                ? "people, relationships, and team connection"
                                : driver === "yielding"
                                  ? "flexibility, adaptability, and openness"
                                  : driver === "tactical"
                                    ? "structure, priorities, and execution"
                                    : driver === "hopeful"
                                      ? "energy, belief, and forward momentum"
                                      : "logic, structure, and consistency"}
                            .
                          </p>
                          <p>
                            At your best,{" "}
                            {driver === "resourceful"
                              ? "you are quick to respond to challenges and comfortable working with incomplete information. You prioritise progress and action, helping teams maintain momentum when things become unclear or complex"
                              : driver === "human_centred"
                                ? "you build trust, create alignment, and bring people together. You are aware of how others feel and naturally work to create a positive and supportive environment"
                                : driver === "yielding"
                                  ? "you adjust easily to change and are willing to shift direction when needed. You support different perspectives and help teams stay agile in changing environments"
                                  : driver === "tactical"
                                    ? "you create clear plans, break work into steps, and ensure things get delivered. You are focused on outcomes and bring direction to complex tasks"
                                    : driver === "hopeful"
                                      ? "you bring optimism and encouragement, especially during challenges. You help others stay motivated and maintain focus on what is possible"
                                      : "you rely on data, systems, and careful thinking to guide decisions. You bring stability and ensure work is done accurately and effectively"}
                            .
                          </p>
                          <p>
                            This driver is{" "}
                            {driver === "resourceful"
                              ? "often seen in environments that require speed, adaptability, and problem-solving under pressure"
                              : driver === "human_centred"
                                ? "essential for collaboration, leadership, and maintaining strong team culture"
                                : driver === "yielding"
                                  ? "valuable in fast-moving teams where priorities and situations evolve quickly"
                                  : driver === "tactical"
                                    ? "critical for turning ideas into results and maintaining progress toward goals"
                                    : driver === "hopeful"
                                      ? "important in resilience, leadership, and sustaining team morale over time"
                                      : "key for maintaining quality, reducing risk, and creating dependable processes"}
                            .
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </WhiteCard>

              <WhiteCard className="mt-[22px] p-[26px]">
                <div className="text-[10px] font-bold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                  Why This Matters
                </div>
                <div className="mt-[18px] text-[13px] leading-[28px] text-[#313C52]">
                  <p>{GENERIC_CONTENT.professionalPerformanceRhythm.whyThisMatters.intro}</p>
                  <ul className="mt-[10px] space-y-[4px]">
                    {GENERIC_CONTENT.professionalPerformanceRhythm.whyThisMatters.bullets.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <p className="mt-[18px]">
                    {GENERIC_CONTENT.professionalPerformanceRhythm.whyThisMatters.closing}
                  </p>
                </div>
              </WhiteCard>

              <WhiteCard className="mt-[22px] p-[26px]">
                <div className="text-[10px] font-bold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                  What Your RHYTHM Means for You
                </div>
                <div className="mt-[18px] text-[13px] leading-[28px] text-[#313C52]">
                  <p>{GENERIC_CONTENT.professionalPerformanceRhythm.rhythmMeans.intro}</p>
                  <p className="mt-[18px]">It is about understanding:</p>
                  <ul className="mt-[8px] space-y-[4px]">
                    {GENERIC_CONTENT.professionalPerformanceRhythm.rhythmMeans.understanding.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <p className="mt-[18px]">
                    {GENERIC_CONTENT.professionalPerformanceRhythm.rhythmMeans.goal}
                  </p>
                  <p className="mt-[18px]">
                    When you align your work, your role, and your team interactions with your natural drivers, you will:
                  </p>
                  <ul className="mt-[8px] space-y-[4px]">
                    {GENERIC_CONTENT.professionalPerformanceRhythm.rhythmMeans.alignedWork.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <p className="mt-[18px]">
                    {GENERIC_CONTENT.professionalPerformanceRhythm.rhythmMeans.closing}
                  </p>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="The 3-Level Energy Model"
                icon={REPORT_ASSETS.icons.energyModel}
              />
              <WhiteCard>
                <div className="grid gap-4 md:grid-cols-3">
                  {(
                    ["flow", "stabilising", "frustration"] as DriverGroup[]
                  ).map((group, index) => {
                    const g = GROUP_COPY[group];
                    const text = GENERIC_CONTENT.threeLevelEnergyModel[group];
                    return (
                      <div
                        key={group}
                        className={cls(
                          "rounded-2xl border p-5",
                          g.bg,
                          g.border,
                        )}
                      >
                        <div className={cls("text-5xl font-bold", g.text)}>
                          {index + 1}
                        </div>
                        <h3 className={cls("mt-4 font-bold", g.text)}>
                          {g.heading
                            .replace(" — Your Top 2", "")
                            .replace(" — Your Middle 2", "")
                            .replace(" — Your Bottom 2", "")}
                        </h3>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">
                          {text.map((x) => (
                            <li key={x}>• {x}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Your Professional Performance Rhythm"
                icon={REPORT_ASSETS.icons.professionalPerformanceRhythm}
              />
              <div className="space-y-6">
                <WhiteCard>
                  <h3 className="text-lg font-bold text-slate-900">
                    {GROUP_COPY.flow.heading}
                  </h3>
                  <div className="mt-5 space-y-5">
                    {flow.map((driver) => (
                      <DriverDetailCard
                        key={driver}
                        driver={driver}
                        group="flow"
                      />
                    ))}
                  </div>
                </WhiteCard>
                <WhiteCard>
                  <h3 className="text-lg font-bold text-slate-900">
                    {GROUP_COPY.stabilising.heading}
                  </h3>
                  <div className="mt-5 space-y-5">
                    {stabilising.map((driver) => (
                      <DriverDetailCard
                        key={driver}
                        driver={driver}
                        group="stabilising"
                      />
                    ))}
                  </div>
                </WhiteCard>
                <WhiteCard>
                  <h3 className="text-lg font-bold text-slate-900">
                    {GROUP_COPY.frustration.heading}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    These are not weaknesses. They are energy-draining zones
                    that may require support, structure, or collaboration.
                  </p>
                  <div className="mt-5 space-y-5">
                    {frustration.map((driver) => (
                      <DriverDetailCard
                        key={driver}
                        driver={driver}
                        group="frustration"
                      />
                    ))}
                  </div>
                </WhiteCard>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Energy mix – how your profiles work together"
                icon={REPORT_ASSETS.icons.energyMix}
              />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">
                  As a <strong>{profileName}</strong>, your core contribution is
                  shaped by {topFreqName} energy. Your RHYTHM adds another
                  layer: it shows the conditions and behaviours that help you
                  create results sustainably.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-green-500 bg-green-50 p-4">
                    <div className="font-bold text-green-700">Lean into</div>
                    <p className="mt-2 text-sm text-slate-700">
                      {flow.map((d) => DRIVER_COPY[d].label).join(" and ")} when
                      you need momentum, confidence, and stronger contribution.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500 bg-amber-50 p-4">
                    <div className="font-bold text-amber-700">
                      Use consciously
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {stabilising
                        .map((d) => DRIVER_COPY[d].label)
                        .join(" and ")}{" "}
                      can support balance, but may require more intention.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-red-500 bg-red-50 p-4">
                    <div className="font-bold text-red-700">
                      Get support around
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {frustration
                        .map((d) => DRIVER_COPY[d].label)
                        .join(" and ")}{" "}
                      may drain energy if overused for too long.
                    </p>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Team Role Fit"
                icon={REPORT_ASSETS.icons.teamRoleFit}
              />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
                  <p className="text-sm leading-7 text-slate-700">
                    Your profile gives language to your natural team role. Use
                    this section as a Johari-style reflection: what others see
                    clearly, what you may underplay, what you hold back, and
                    what potential is still emerging.
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage
                      src={REPORT_ASSETS.icons.teamRoleFit}
                      alt="Team role fit"
                      className="mx-auto max-h-[160px] w-full object-contain"
                    />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    "Open Area — visible strengths",
                    "Blind Spot — what others may notice",
                    "Hidden Area — what you may hold back",
                    "Unknown Area — potential still emerging",
                  ].map((title) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <h4 className="font-semibold text-slate-900">{title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Reflect on how your {profileName} style shows up here
                        and what support helps you contribute with more
                        confidence.
                      </p>
                    </div>
                  ))}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Your Value Creation Pathway"
                icon={REPORT_ASSETS.icons.valueCreationPathway}
              />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
                  <p className="text-sm leading-7 text-slate-700">
                    You create value when your profile contribution and your
                    RHYTHM drivers work together. Your strongest pathway is to
                    use your natural contribution style while designing your
                    work around the drivers that create energy rather than drain
                    it.
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage
                      src={REPORT_ASSETS.icons.valueCreationPathway}
                      alt="Value creation pathway"
                      className="mx-auto max-h-[160px] w-full object-contain"
                    />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">
                      You deliver your best value when
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      You work in roles and projects that let you express{" "}
                      {profileName} strengths and your Flow Drivers.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">You build trust when</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      You communicate your needs clearly and help others
                      understand your natural working rhythm.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">You leverage value when</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      You partner with people whose strengths complement your
                      Frustration Drivers.
                    </p>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Collaboration Tips"
                icon={REPORT_ASSETS.icons.collaborationTips}
              />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">
                  You thrive in teams that respect both contribution and rhythm.
                  Use these tips to collaborate with more awareness.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">Best collaborators</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      People who bring structure, clarity, emotional
                      intelligence, or complementary execution energy.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">When working with fast movers</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      Translate vision into people-aligned messages and
                      practical next steps.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">
                      When working with detail thinkers
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      Give structure, evidence, and enough clarity for them to
                      trust the process.
                    </p>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Development Recommendations"
                icon={REPORT_ASSETS.icons.developmentRecommendations}
              />
              <WhiteCard>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      To elevate performance
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <li>• Protect time for your Flow Drivers.</li>
                      <li>
                        • Build simple support around your Frustration Drivers.
                      </li>
                      <li>
                        • Use Stabilising Drivers without over-relying on them.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Daily anchors</h4>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <li>• What gives me energy today?</li>
                      <li>• What task needs support or structure?</li>
                      <li>• Where am I pushing against my rhythm?</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Reflection prompts
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <li>• When do I feel most effective?</li>
                      <li>• Who complements my working rhythm?</li>
                      <li>• What should I stop carrying alone?</li>
                    </ul>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="What Could Be Holding You Back?"
                icon={REPORT_ASSETS.icons.whatsHoldingYouBack}
              />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
                  <p className="text-sm leading-7 text-slate-700">
                    Sometimes the behaviours that make you valuable can also
                    become limiting when overused. Use this section to
                    self-audit and rebalance.
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage
                      src={REPORT_ASSETS.icons.whatsHoldingYouBack}
                      alt="What could be holding you back"
                      className="mx-auto max-h-[160px] w-full object-contain"
                    />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">Weekly check-in prompts</h4>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <li>
                        • What emotional or practical weight am I carrying?
                      </li>
                      <li>• Where am I compromising too often?</li>
                      <li>• What did I notice but not say?</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="font-bold">Monthly calibration metrics</h4>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <li>• Times I redirected confusion constructively.</li>
                      <li>
                        • Discussions where I contributed a bridge or solution.
                      </li>
                      <li>
                        • One opportunity where I influenced direction without
                        needing credit.
                      </li>
                    </ul>
                  </div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader
                title="Your Next Steps"
                icon={REPORT_ASSETS.icons.nextSteps}
              />
              <WhiteCard>
                <p className="mb-5 text-sm leading-7 text-slate-700">
                  {GENERIC_CONTENT.nextSteps.intro}
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <NextStepCard
                    title={GENERIC_CONTENT.nextSteps.cards[0].title}
                    body={GENERIC_CONTENT.nextSteps.cards[0].body}
                    button={GENERIC_CONTENT.nextSteps.cards[0].button}
                    href={null}
                  />
                  <NextStepCard
                    title={GENERIC_CONTENT.nextSteps.cards[1].title}
                    body={GENERIC_CONTENT.nextSteps.cards[1].body}
                    button={GENERIC_CONTENT.nextSteps.cards[1].button}
                    href={nextStepsUrl}
                    primary
                  />
                  <NextStepCard
                    title={GENERIC_CONTENT.nextSteps.cards[2].title}
                    body={GENERIC_CONTENT.nextSteps.cards[2].body}
                    button={GENERIC_CONTENT.nextSteps.cards[2].button}
                    href={data.org?.website_url || nextStepsUrl}
                  />
                </div>
                <div className="mt-6 text-sm text-slate-500">
                  Team Puzzle Assessment — RHYTHM Edition
                </div>
              </WhiteCard>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}