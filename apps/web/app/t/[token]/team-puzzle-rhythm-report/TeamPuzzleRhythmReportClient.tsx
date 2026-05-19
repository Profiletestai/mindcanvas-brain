// apps/web/app/t/[token]/team-puzzle-rhythm-report/TeamPuzzleRhythmReportClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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


type FrequencyAlignedProfile = {
  profile: string;
  bullets: string[];
};

type FrequencyContent = {
  code: FrequencyCode;
  name: string;
  label: string;
  definition: string;
  coreAttributes: string[];
  potentialBlindSpots: string[];
  alignedProfiles: FrequencyAlignedProfile[];
  howItShowsUp: {
    trait: string;
    expression: string;
  }[];
  idealRoles: string[];
  avoidEnvironments: string[];
  coachingTips: string[];
  reflectionPrompts: string[];
  finalThoughts: string;
  nextStep?: string;
};

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


const FREQUENCY_CONTENT: Record<FrequencyCode, FrequencyContent> = {
  A: {
    code: "A",
    name: "Innovation",
    label: "Innovation Frequency",
    definition:
      "The Innovation Frequency is the energy of ideas, momentum, and possibility. People with this frequency are naturally future-oriented. They thrive on change, pursue progress, and often see possibilities long before others do.",
    coreAttributes: [
      "Big-picture thinking",
      "Strategic vision",
      "Pattern recognition",
      "Restlessness with ‘the way things have always been’",
      "Comfortable with risk and uncertainty",
    ],
    potentialBlindSpots: [
      "May skip over details or structure",
      "Impatience with slower-moving personalities",
      "Can abandon ideas before they’re fully formed",
    ],
    alignedProfiles: [
      {
        profile: "Profile 1: The Visionary",
        bullets: [
          "Brings bold ideas and future-focused strategy",
          "Often sparks the direction for teams or organisations",
          "Needs space and trust to explore and innovate",
        ],
      },
      {
        profile: "Profile 2: The Catalyst",
        bullets: [
          "Brings activation energy to ideas",
          "Motivates and excites people to take action",
          "Communicates vision with passion",
        ],
      },
      {
        profile: "Profile 8: The Optimiser",
        bullets: [
          "Uses systems-thinking to improve and evolve",
          "Brings innovation to process and structure",
          "Often blends creativity with precision",
        ],
      },
    ],
    howItShowsUp: [
      {
        trait: "Idea generation",
        expression: "Comes up with multiple strategic options or future states",
      },
      {
        trait: "Fast momentum",
        expression: "Thrives in sprints, launches, or disruption projects",
      },
      {
        trait: "Strategic alignment",
        expression: "Helps refocus the team on long-term goals",
      },
      {
        trait: "Disengagement warning",
        expression: "Gets bored or disconnected in repetitive roles",
      },
    ],
    idealRoles: [
      "Early-stage ideation and strategy",
      "Business development or product creation",
      "Campaign innovation or market repositioning",
    ],
    avoidEnvironments: [
      "Stifle creativity",
      "Prioritise slow consensus",
      "Punish mistakes over experimentation",
    ],
    coachingTips: [
      "Provide Visionaries/Catalysts space to think and autonomy to act",
      "Don’t rush them into structure, bring in support to implement",
      "Pair them with Coordinators or Controllers for grounded execution",
      "Create short cycles: Plan–Test–Reflect–Refine",
    ],
    reflectionPrompts: [
      "Where have I been most energised lately?",
      "Which ideas am I sitting on that I haven’t acted on?",
      "How could I communicate my vision more clearly to my team?",
      "Who could help bring my ideas to life?",
    ],
    finalThoughts:
      "Innovation energy is a precious asset, and like all energy, it needs to be directed. When you learn how to honour your natural strengths while building the right partnerships around you, you unlock exponential results.",
    nextStep:
      "Want help mapping the rest of your team? Visit lifepuzzle.com.au to explore how Team Puzzle can support your organisation in building a team aligned for flow, performance, and fulfilment.",
  },

  B: {
    code: "B",
    name: "Influence",
    label: "Influence Frequency",
    definition:
      "The Influence Frequency is the energy of connection, charisma, and communication. People with this frequency are energised by interaction, thrive on meaningful conversations, and naturally rally people around a cause.",
    coreAttributes: [
      "Strong interpersonal awareness",
      "Communication-driven problem solving",
      "Intuitive understanding of motivation",
      "High energy and emotional expressiveness",
      "Naturally builds rapport and trust",
    ],
    potentialBlindSpots: [
      "May overcommit to please others",
      "Can avoid difficult conversations",
      "Easily distracted without relational anchors",
    ],
    alignedProfiles: [
      {
        profile: "Profile 2: The Catalyst",
        bullets: [
          "Brings social energy and momentum to new ideas",
          "Communicates vision with contagious enthusiasm",
          "Initiates movement and early-stage engagement",
        ],
      },
      {
        profile: "Profile 3: The Motivator",
        bullets: [
          "Empowers others through encouragement and team spirit",
          "Creates psychological safety and morale",
          "Often the cultural heart of the team",
        ],
      },
      {
        profile: "Profile 4: The Connector",
        bullets: [
          "Links people, ideas, and timing into a collaborative path",
          "Ensures others feel seen, heard, and aligned",
          "Drives harmony in relationships and communication",
        ],
      },
    ],
    howItShowsUp: [
      {
        trait: "Relational leadership",
        expression: "Leads by earning trust, showing empathy",
      },
      {
        trait: "Team cohesion",
        expression: "Bridges gaps between personalities and priorities",
      },
      {
        trait: "Energy transfer",
        expression: "Lifts energy during low-motivation periods",
      },
      {
        trait: "Disengagement warning",
        expression: "Overwhelmed when relationships break down or if isolated",
      },
    ],
    idealRoles: [
      "Relationship management",
      "Customer or team experience",
      "Engagement, culture, or internal communications",
    ],
    avoidEnvironments: [
      "Deprioritise human interaction",
      "Are siloed or excessively technical",
      "Expect motivation without relationship",
    ],
    coachingTips: [
      "Empower them to influence, don’t contain them with overstructure",
      "Allow space for collaborative problem solving",
      "Use them to build bridges across teams or departments",
      "Celebrate small wins to keep energy high",
    ],
    reflectionPrompts: [
      "Who have I positively impacted this week?",
      "Where can I better use my influence to align the team?",
      "What boundaries do I need to set to stay energised?",
      "How can I inspire others around the mission?",
    ],
    finalThoughts:
      "Influence is not about volume, it’s about impact. When influence energy is channelled with clarity and care, it drives cultural transformation.",
    nextStep:
      "Want to understand how this energy impacts your team dynamics? Visit lifepuzzle.com.au to explore coaching and alignment tools tailored to Frequency B profiles.",
  },

  C: {
    code: "C",
    name: "Implementation",
    label: "Implementation Frequency",
    definition:
      "The Implementation Frequency is the energy of grounding, timing, and dependable action. These individuals bring structure to chaos, carry plans through to execution, and stabilise emotions under pressure.",
    coreAttributes: [
      "Grounded presence and calm under stress",
      "Attentive to timing and sequence",
      "Reliable with follow-through",
      "Practical, consistent, and service-driven",
    ],
    potentialBlindSpots: [
      "May resist change or ambiguity",
      "Can prioritise process over innovation",
      "May underplay their own leadership or creativity",
    ],
    alignedProfiles: [
      {
        profile: "Profile 4: The Connector",
        bullets: ["Balances relational intelligence with grounded timing"],
      },
      {
        profile: "Profile 5: The Facilitator",
        bullets: [
          "Brings calm, inclusive rhythm to group dynamics",
          "Stabilises projects and people with equanimity",
        ],
      },
      {
        profile: "Profile 6: The Coordinator",
        bullets: [
          "Converts strategies into tracked, completed actions",
          "Excels in operations, checklists, and follow-through",
        ],
      },
    ],
    howItShowsUp: [
      {
        trait: "Process discipline",
        expression: "Keeps projects structured and grounded",
      },
      {
        trait: "Stability",
        expression: "Maintains consistent emotional tone",
      },
      {
        trait: "Reliability",
        expression: "Follows through when others drop the ball",
      },
      {
        trait: "Disengagement warning",
        expression: "Gets overwhelmed if scope is unclear or constantly shifting",
      },
    ],
    idealRoles: [
      "Project and operations management",
      "Delivery coordination and logistics",
      "Ground-level support and maintenance",
    ],
    avoidEnvironments: [
      "Lack structure or shifting deadlines",
      "Expect rapid ideation or high ambiguity",
      "Don’t appreciate process-driven work",
    ],
    coachingTips: [
      "Involve early in project planning, not just the rollout",
      "Give them ownership of execution timelines",
      "Pair them with visionaries to balance pace and precision",
      "Acknowledge progress, not just results",
    ],
    reflectionPrompts: [
      "Where have I brought calm or clarity to a situation this week?",
      "What process needs refinement?",
      "How can I better communicate my capacity and timing?",
      "What energises me most about completion?",
    ],
    finalThoughts:
      "Implementation energy is the muscle of a high-performing team. Without it, ideas stay stuck and momentum stalls. Honour this frequency as the glue that holds execution together.",
    nextStep:
      "Curious how to optimise your systems for flow? Explore our resources at lifepuzzle.com.au.",
  },

  D: {
    code: "D",
    name: "Insight",
    label: "Insight Frequency",
    definition:
      "Insight Frequency is the energy of analysis, structure, and systems. These individuals go deep, seek precision, and often spot patterns, risks, or optimisations long before anyone else.",
    coreAttributes: [
      "Highly analytical and detail-focused",
      "Values accuracy, logic, and reliability",
      "Builds frameworks and systems to scale quality",
      "Operates with intellectual depth and independence",
    ],
    potentialBlindSpots: [
      "Can be rigid, perfectionistic, or resistant to ambiguity",
      "May lack emotional fluency or overlook people dynamics",
      "Sometimes delays action in search of more data",
    ],
    alignedProfiles: [
      {
        profile: "Profile 6: The Coordinator",
        bullets: ["Brings logic and timing to team execution"],
      },
      {
        profile: "Profile 7: The Controller",
        bullets: ["Sees the gaps, builds systems, checks compliance"],
      },
      {
        profile: "Profile 8: The Optimiser",
        bullets: ["Fuses logic and innovation to improve systems"],
      },
    ],
    howItShowsUp: [
      {
        trait: "Detail orientation",
        expression: "Spots risks, inconsistencies, and inefficiencies",
      },
      {
        trait: "Structured thinking",
        expression: "Breaks complex issues into clear systems",
      },
      {
        trait: "Predictive analysis",
        expression: "Forecasts future outcomes through patterns",
      },
      {
        trait: "Disengagement warning",
        expression: "Overwhelmed if logic is ignored or dismissed",
      },
    ],
    idealRoles: [
      "Data, systems, risk, finance, operations",
      "Quality control and policy design",
      "Strategic scaling and diagnostics",
    ],
    avoidEnvironments: [
      "Value intuition over logic without balance",
      "Disregard structure or long-term implications",
      "Prioritise social consensus over truth",
    ],
    coachingTips: [
      "Give time to reflect before major decisions",
      "Provide data or structure for confidence",
      "Use them to test, audit, or optimise systems",
      "Pair them with Catalysts or Facilitators for communication balance",
    ],
    reflectionPrompts: [
      "What risk did I help the team avoid this week?",
      "Where am I overanalysing instead of acting?",
      "What system or process could I improve today?",
      "How can I share my insights in a more actionable way?",
    ],
    finalThoughts:
      "Insight frequency is the backbone of scalable, sustainable success. When this energy is empowered, not dismissed, it protects the future.",
    nextStep:
      "Need help integrating this into your team structure? Book a team strategy session via lifepuzzle.com.au.",
  },
};

function getFrequencyContent(code?: string | null): FrequencyContent {
  const normalized = String(code || "").toUpperCase() as FrequencyCode;
  return FREQUENCY_CONTENT[normalized] || FREQUENCY_CONTENT.A;
}


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


type ProfileBasedContent = {
  display: string;
  title: string;
  role: string;
  frequency: string;
  coreTraits: string;
  idealEnvironment: string;
  youMayHaveBeenCalled: string;
  famousExamples: string;
  profileInDepth: string[];
  energyMatrix: string[];
  teamRoleFit: string[];
  valueCreationPathway: string[];
  collaborationTips: string[];
  developmentRecommendations: string[];
  holdingBack: string[];
  closingThoughts?: string[];
};

const PROFILE_BASED_CONTENT: Record<string, ProfileBasedContent> = {
  "PROFILE_1": {
    "display": "Visionary",
    "title": "The Visionary",
    "role": "Strategist",
    "frequency": "Innovation (A)",
    "coreTraits": "Creative, big-picture, driven by possibility, risk-tolerant, original thinker",
    "idealEnvironment": "Autonomy, flexibility, freedom to innovate",
    "youMayHaveBeenCalled": "ahead of your time, always thinking, or too many ideas, not enough hours",
    "famousExamples": "Recognised founders, strategists, and change-makers who turn bold ideas into movements.",
    "profileInDepth": [
      "The Visionary is the initiator. They often see things before others do, solutions, strategies, innovations, and are most energised when creating what’s new, what’s next, and what’s bold. Visionaries are strategic thinkers with a powerful internal drive and often make ideal founders, strategists, or change-makers.",
      "As a Visionary, you are not content with maintaining the status quo. You are wired to pursue progress, challenge outdated thinking, and reshape the future before others can even see the cracks in the present. Your ability to see patterns where others see problems makes you a rare and valuable force in any environment.",
      "This profile thrives on ideas, big, brave, world-shifting ideas. But beyond just imagining the future, you’re compelled to begin building it. At your best, you're not simply a dreamer, you're a doer, when paired with the right collaborators who can help anchor your vision.",
      "You may have been described as “ahead of your time,” “always thinking,” or “too many ideas, not enough hours.” While some may struggle to keep up with your pace, your gift is helping people see what’s possible, and daring them to go with you.",
      "The key to unlocking your potential lies not in slowing down your thinking, but in learning how to focus your energy, articulate your ideas clearly, and structure your world to support follow-through.",
      "Let this section of the report help you validate what you’ve always sensed, and give you a language, a strategy, and a rhythm to express it more fully in your work and leadership.",
      "Workshop Reflection Questions:",
      "• What was the last idea you felt genuinely excited about?",
      "• When do you feel most energised, starting something new, or completing something old?",
      "• How do you typically share your vision with others? Do they easily understand it?",
      "• What role do you play in meetings, are you leading from the front or pitching from the edge?",
      "• Who helps you transform your ideas into action?",
      "Take 10 minutes to reflect on these prompts. Use a journal, a whiteboard, or even a voice note, whatever helps you make your ideas more tangible. These questions aren’t just for clarity, they're for activation."
    ],
    "energyMatrix": [
      "Understanding your Energy Matrix means identifying the conditions under which your strengths can truly shine. It's not just about how you work, it’s about how you thrive.",
      "As a Visionary, your energy is fast-paced, idea-driven, and fuelled by the future. But working at your best doesn’t just happen. It requires strategy, knowing when to focus, when to hand off, and how to operate in your unique zone of contribution.",
      "The best way to master your energy is to recognise how your energy interacts with others. While your core profile is Visionary, you also share qualities with two other profiles:",
      "• The Catalyst (Profile 2) on your right: energised, expressive, people-facing",
      "• The Optimiser (Profile 8) on your left: reflective, systems-driven, outcome-focused",
      "These adjacent profiles act as your ‘wing collaborators.’ Learning from their strengths, and being aware of where you differ, helps you become more adaptable and strategic in how you show up.",
      "VISIONARY ENERGY MATRIX",
      "Catalyst (Next Optimiser Zone Visionary (You) Profile) (Opposite Profile)",
      "Refinement, Influence, Innovation, systems, Drive momentum, strategic thinking long-term visibility optimisation",
      "Generating bold Inspiring action Improving Strength ideas and and building existing ideas with direction energy precision",
      "Depth and Follow-through Starting from Challenge sustainable and detail scratch delivery",
      "Needs stage and Needs process Needs structure Support Style attention to and space to and clarity to scale activate refine",
      "Team Role Vision setter Energy driver Solution enhancer",
      "Tip: A high-functioning team often includes all three. If you find yourself struggling to bring an idea to life, check who you're collaborating with, and if one of these energy zones is missing."
    ],
    "teamRoleFit": [
      "As a Visionary, your role in the team is often instinctive, people come to you for direction, for ideas, and for energy. But the value you bring goes beyond your visible creativity. It includes the things you do without thinking, the things you keep to yourself, and the potential you haven’t even tapped into yet.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "By mapping your contribution through the Johari Window, you not only deepen your self-awareness, you expand your impact. For Visionaries, this model highlights the creative influence you bring, the unspoken expectations you carry, and the potential legacy you may be shaping without realising it.",
      "Use this model as a mirror and a map. Reflect on each quadrant regularly, ask for feedback to grow your Open Area, and don’t be afraid to share more of the thinking behind your ideas. When your role is understood, and your rhythm",
      "supported, you’ll find the space to lead boldly without carrying the full weight alone."
    ],
    "valueCreationPathway": [
      "Creating value isn’t just about output, it’s about transforming potential into momentum and results. For the Visionary, value begins at the moment of insight, when a pattern is recognised, a need is anticipated, or a new direction becomes clear. Your ability to reimagine what’s possible is what sets you apart. But true leadership lies in turning that vision into something others can see, support, and sustain.",
      "Visionaries bring value through:",
      "• Disruptive thinking that challenges stagnant models",
      "• Uncovering opportunity in uncertainty",
      "• Reframing problems to find unexpected solutions",
      "• Painting a future people want to be part of",
      "Real-World Examples of Visionary Contribution:",
      "• Sara Blakely, founder of Spanx, created value by identifying a gap no one else saw, then followed through with tenacity and bold storytelling to disrupt an entire industry.",
      "• Reed Hastings, co-founder of Netflix, anticipated the decline of physical media and envisioned a streaming model years before it was mainstream, leading a transformation that redefined how the world consumes entertainment.",
      "What these leaders had in common with you: they started with an idea, but knew that ideas alone don’t create results. They structured their vision, invited executional support, and pivoted strategically to stay relevant.",
      "As a Visionary, your value is maximised when your ideas gain traction, when you connect them to action. This is where building with others becomes your leverage point.",
      "Your Strength: Lateral thinking, problem reframing, originality Your Growth Lever: Structured support and delegation Your Output Multiplier: Collaborating early with strong implementers"
    ],
    "collaborationTips": [
      "No matter how visionary your ideas may be, you can't bring them to life alone. Great execution comes from great collaboration, and the best collaborators aren’t always the most similar to you. In fact, they’re often the opposite.",
      "As a Visionary, your success is amplified when you're surrounded by profiles who can catch your ideas, translate them, and carry them through to completion. That’s why understanding how you interact with all 8 Team Puzzle profiles is so valuable, it gives you the ability to lead with intention, partner strategically, and build high-functioning teams.",
      "Why collaboration matters:",
      "• It anchors your strengths in reality",
      "• It provides feedback loops that sharpen your ideas",
      "• It prevents burnout by distributing energy across the team",
      "• It creates buy-in by involving diverse styles from the start",
      "What role you play: You bring the “what if.” You are the source of new direction, big-picture thinking, and conceptual framing. In the team ecosystem, you're the one who helps people think bigger, move faster, and align with purpose.",
      "How to collaborate well with other profiles:",
      "• Catalyst (2): They can amplify your ideas and inspire quick action, but together, you’ll need grounding. Bring in a Coordinator or Facilitator early.",
      "• Motivator (3): They’re brilliant at rallying people around your vision. Be clear about timelines and give them space to connect.",
      "• Connector (4): Excellent at translating your vision into partnerships or stakeholder alignment. Use their relationship sense to guide communication.",
      "• Facilitator (5): They’ll ensure your idea is realistic and people-focused. Respect their timing instincts, they often sense what the team needs before you do.",
      "• Coordinator (6): Your best stabilising force. Trust them with your implementation roadmap and review checkpoints.",
      "• Controller (7): They’ll test your assumptions and safeguard the details. Let them help refine your plan, but avoid micromanaging them.",
      "• Optimiser (8): Can perfect what you initiate. Involve them early in the structure phase to minimise rework later on.",
      "Recommended Collaborators:",
      "• Facilitator (5) – Empathy and reality-checking",
      "• Coordinator (6) – Process and implementation",
      "• Optimiser (8) – Refinement and systemisation",
      "Working Well With All 8 Profiles:",
      "• Use a shared language (e.g. this framework!) so people feel seen and understood",
      "• Frame your vision clearly, but allow others to influence the path",
      "• Recognise that different profiles move at different speeds, create check-in points, not pressure"
    ],
    "developmentRecommendations": [
      "Growth isn’t just something to pursue when problems arise, it’s what enables a Visionary to consistently lead from a place of clarity, focus, and effectiveness. While your strengths come naturally, their impact is amplified when you refine them, test them, and align them with purpose.",
      "Your development pathway is not about changing who you are, it’s about evolving how you work. Small shifts in habits, mindsets, and systems can dramatically increase the real-world outcomes of your ideas.",
      "This section is designed to help you turn insight into traction. Use it to reflect, reset, and recommit to your next level of impact.",
      "To Elevate Performance:",
      "• Limit the number of open “big ideas” to 1–2 per quarter",
      "• Set clear metrics for success before starting new initiatives",
      "• Document ideas visually or through rapid prototyping",
      "Daily Habits to Anchor Your Strengths:",
      "• Visualise end results before communicating plans",
      "• Start each day with 15 mins of strategic reflection",
      "• Use digital tools (e.g., whiteboards, mind maps) to organise ideas",
      "Workshop Reflection Prompts:",
      "• What’s one idea you could complete this quarter?",
      "• What support systems are missing from your process?",
      "• How can your next big idea serve both vision and execution?"
    ],
    "holdingBack": [
      "Even the most visionary thinkers face moments of inertia, times when momentum stalls or motivation wanes. Sometimes it’s because we’ve outgrown a system or routine. Sometimes it’s because our ideas outpace the support structures around us. This section is designed to help you spot the friction early, before it becomes a blocker.",
      "Use these short prompts and practical indicators to reflect honestly on what might be preventing you from delivering your full value. Think of it as a regular reset, a performance pit stop that keeps your engine running in sync with your ambition.",
      "Weekly Reflection Prompts:",
      "• What project energised me most this week?",
      "• Am I delegating or holding back others with rapid shifts?",
      "• Where could I simplify before expanding?",
      "Monthly Action Metrics:",
      "• % of time in ideation vs. execution",
      "• Top 3 innovations or concepts seeded this month",
      "• One person I supported with my strategic thinking"
    ],
    "closingThoughts": [
      "Your strengths are not accidental, they’re your contribution blueprint. As a Visionary, you are here to see what others don’t, and spark change before it’s needed. When paired with the right team, your ideas become movements.",
      "Use this report as your reference, your challenge, and your encouragement. You already have the blueprint. Now build with it."
    ]
  },
  "PROFILE_2": {
    "display": "Catalyst",
    "title": "The Catalyst",
    "role": "Spark",
    "frequency": "Innovation + Influence (A-B)",
    "coreTraits": "Energetic, expressive, persuasive, proactive, inspirational",
    "idealEnvironment": "Dynamic teams, creative autonomy, early-stage projects",
    "youMayHaveBeenCalled": "the cheerleader, the energiser, the persuader, the influencer, the face of the brand",
    "famousExamples": "Oprah Winfrey, Tony Robbins, Richard Branson (Virgin), Brené Brown",
    "profileInDepth": [
      "Catalysts are idea accelerators. You’re the person who sees a spark and turns it into a flame, fast. Whether pitching a new initiative, rallying a team, or bringing energy to a stagnant project, you help people believe in possibility and move toward it with urgency.",
      "Your power lies in your ability to inspire action. You are often the first to speak up, the one others look to for energy, and the motivator who gets people excited about what’s next. You naturally combine creative thinking with high-energy communication, making you a force in team dynamics.",
      "Workshop Reflection Questions",
      "• What environments bring out my energy naturally?",
      "• When was the last time I inspired action in others? What made it work?",
      "• What happens when I’m in a room with low energy, do I compensate, or disengage?",
      "• What structures help me stay focused once the excitement fades?"
    ],
    "energyMatrix": [
      "Your natural energy is high-energy and fast-moving. As a Catalyst, your strength lies in activating ideas, people, and momentum. You’re wired for initiation and inspiration, not necessarily for long-term follow-through or solitary detail work. This means mastering your energy is about knowing when to jump in, when to hand off, and how to balance drive with direction.",
      "You sit between the Visionary and Motivator profiles, drawing energy from both forward-thinking strategy and people-focused influence. Your performance energy is strongest when you start things, ignite engagement, and trust others to help carry the execution.",
      "CATALYST ENERGY MATRIX",
      "Zone Visionary (1) Catalyst (2 - You) Motivator (3)",
      "Momentum, Innovation, Connection, Drive activation, big-picture strategy empathy, uplift persuasion",
      "Vision, strategic Energy, motivation, Morale building, Strength direction buy-in team support",
      "Follow-through, Overcommitment, Over-personalising Challenge focus staying power challenges",
      "Needs a team to Needs structure to Needs clarity in Support Style carry execution pace output priorities",
      "Architect of Emotional and Team Role Igniter of action direction relational glue",
      "Tip: Surround yourself with profiles who stabilise and ground your pace. Facilitators (5), Coordinators (6), and Optimisers (8) all bring implementation, rhythm, and refinement to your ideas."
    ],
    "teamRoleFit": [
      "For a Catalyst, team success starts with energy, creating it, shifting it, and amplifying it. You are often the person who gets things started when others hesitate. But real performance isn’t just about launching something new; it’s also about knowing when to hold back, when to lead, and when to pass the baton.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "As a Catalyst, your team role is to spark action, shape belief, and cut through inertia. You are invaluable in the early stages of a project or during times of change, transition, or challenge. But your success depends on knowing when to lead, and when to partner.",
      "To stay in your lane of highest value:",
      "• Surround yourself with Anchors, profiles who manage detail, timing, and delivery",
      "• Clarify your vision early, and communicate it beyond emotion, add structure",
      "• Step back to invite contribution before charging forward again",
      "Your energy is contagious. When channeled intentionally, it doesn’t just start change, it sustains it."
    ],
    "valueCreationPathway": [
      "Catalysts create value through energy, urgency, and belief. You see opportunity in motion. Where others hesitate, you initiate. Whether influencing decision-makers, rallying a hesitant team, or bringing visibility to a bold idea, your strength is in making things happen.",
      "Your influence isn’t limited to communication, it’s in how you bring momentum. Your ability to generate buy-in early is your strategic advantage. But value doesn’t end with enthusiasm. Learning to sustain influence without needing constant adrenaline is where your next level lies.",
      "Real-World Examples of Catalyst Energy in Action:",
      "• Oprah Winfrey launched a global media brand not just through vision, but through personal influence and emotional connection.",
      "• Tony Robbins energises millions through activation, creating instant commitment from audiences and clients.",
      "You deliver your best value when:",
      "• Leading early-stage ideas or transformation projects",
      "• Working cross-functionally to align diverse personalities",
      "• Acting as an ambassador or internal advocate for change",
      "You build trust when:",
      "• Your energy matches substance with delivery",
      "• You follow through on the momentum you create",
      "• You energise without overpowering others",
      "You leverage value when:",
      "• You pair with process-led partners who can ground and execute",
      "• You align energy with strategy, not just speed"
    ],
    "collaborationTips": [
      "Catalysts thrive in relationships, but not all relationships fuel them equally. For you to perform at your best, you need to be surrounded by people who can harness your pace, support your vision, and build rhythm around your energy.",
      "Your Role in the Team: You are the spark, the voice, the momentum. You help others believe in a bold direction and act with confidence. But without the right ecosystem, you may exhaust yourself, or others, before results appear.",
      "Best Collaborators for You:",
      "• Facilitators (5): They ground your energy and help translate urgency into steady action.",
      "• Coordinators (6): They help build process and prioritisation around your activity.",
      "• Optimisers (8): They help you evolve ideas into sustainable frameworks.",
      "Tips for Working with All 8 Profiles:",
      "• Be mindful of quieter profiles (7 & 6) who may process at a different speed.",
      "• Use your influence to amplify other voices, not just your own.",
      "• Invite feedback early, especially from those with grounding or refining energy."
    ],
    "developmentRecommendations": [
      "The most effective Catalysts aren’t just energetic, they’re strategic. It’s not enough to lead with inspiration. Your development lies in learning when to hold space, when to push forward, and how to make energy scalable.",
      "To Elevate Performance:",
      "• Channel your passion into structured influence, don’t rely on charisma alone",
      "• Define the “why now” behind your ideas and communicate it clearly",
      "• Choose a system to track priorities and reduce mental clutter",
      "Daily Anchors:",
      "• Begin the day with one core outcome, not ten ideas",
      "• Journal moments when your energy made a measurable difference",
      "• Schedule pause moments to assess impact vs. pace",
      "Workshop Reflection Prompts:",
      "1. What happens when I lose momentum, do I disengage or react?",
      "2. Am I creating clarity, or just movement?",
      "3. Who helps me convert my energy into lasting change?",
      "4. What’s the legacy of my leadership in this season?"
    ],
    "holdingBack": [
      "Even high-energy profiles like the Catalyst can face plateaus. Sometimes you overcommit, other times you speed past signs that a team or project isn’t ready. This section helps you spot what’s slowing you down or spreading you too thin.",
      "Weekly Check-In Prompts:",
      "• Where did I create traction this week?",
      "• What message or movement did I push too fast?",
      "• What feedback did I ignore, or delay responding to?",
      "Monthly Calibration Metrics:",
      "• % of meetings where I created buy-in or alignment",
      "• Top 3 moments I led energy or belief in others",
      "• Number of unfinished initiatives still demanding energy"
    ],
    "closingThoughts": []
  },
  "PROFILE_3": {
    "display": "Motivator",
    "title": "The Motivator",
    "role": "Heart",
    "frequency": "Influence (B)",
    "coreTraits": "Empathetic, expressive, relationship-focused, supportive, inspiring",
    "idealEnvironment": "Collaborative, communicative, emotionally attuned teams",
    "youMayHaveBeenCalled": "the heart of the team, the culture carrier, the listener, the encourager",
    "famousExamples": "Brené Brown, Howard Schultz (Starbucks), Sheryl Sandberg (Meta), Jacinda Ardern",
    "profileInDepth": [
      "Motivators are the relational engine of any group. You create connection, build trust, and often act as the glue that holds people together during both calm and chaos. You may not always be the loudest voice, but your presence is felt because you genuinely care about how others feel, engage, and succeed.",
      "Your superpower is empathy in action. People open up to you. You’re a natural listener, coach, and encourager. You’re often the first to welcome someone in, check in on someone quietly struggling, or speak up for the needs others didn’t express.",
      "Workshop Reflection Questions",
      "• When do I feel most valued in a team setting?",
      "• How do I handle emotional tension, do I absorb, deflect, or resolve?",
      "• What spaces give me the freedom to connect and express openly?",
      "• Do I sometimes say yes to avoid conflict or keep harmony?"
    ],
    "energyMatrix": [
      "As a Motivator, your performance energy is shaped by people. You thrive in environments where emotional connection, clear communication, and collaboration are valued. You’re the voice that calms, lifts, and brings cohesion to groups. But you can also become emotionally over-invested or pulled in too many directions if boundaries aren’t in place.",
      "You sit between the Catalyst (A-B) and Connector (B-C) profiles. From the Catalyst, you draw contagious energy and inspiration. From the Connector, you absorb empathy and intuition. Your sweet spot is morale, motivation, and emotional leadership.",
      "MOTIVATOR ENERGY MATRIX",
      "Zone Catalyst (2) Motivator (3 - You) Connector (4)",
      "Momentum, Connection, Drive Harmony, timing influence belonging",
      "Boosting Inspiring others to Sensing needs and Strength confidence and act building bridges unity",
      "Over-committing Avoiding conflict or Challenge Staying consistent emotionally stagnation",
      "Responds Support Style Energises outwardly Supports internally empathetically",
      "Interpersonal Team Role Igniter Morale leader integrator",
      "Tip: You’re most effective when paired with structured profiles (6: Coordinator or 8: Optimiser) to help you channel your relational energy toward outcomes."
    ],
    "teamRoleFit": [
      "Motivators are the emotional glue in teams. They build confidence, foster connection, and help others feel seen. But motivation alone isn’t enough, it needs to be paired with awareness, boundaries, and consistency.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "Motivators hold the emotional rhythm of a team. You bring consistency, heart, and cohesion. But to thrive in this role, you must balance people-care with personal clarity. Set boundaries. Say no when needed.",
      "Your best partnerships come from working with vision-driven or detail-focused profiles. You bring the soul, they bring the structure. Together, you build teams that don’t just perform, but care."
    ],
    "valueCreationPathway": [
      "You create value by making people feel seen, heard, and capable. While others may focus on output or process, your greatest contributions come from engagement, building the emotional momentum that allows teams to perform at their best.",
      "Whether mediating team tensions, offering encouragement, or bringing calm in chaos, you foster an environment where people believe in themselves and each other. Your presence enables others to thrive.",
      "Real-World Examples of Motivator Contribution:",
      "• Brené Brown shares vulnerability as a leadership strength, encouraging leaders to lead with heart, not just strategy.",
      "• Sheryl Sandberg, through initiatives like Lean In, has empowered countless professionals to feel heard, valued, and supported.",
      "You deliver your best value when:",
      "• Helping team members unlock their potential",
      "• Creating clarity and confidence in difficult conversations",
      "• Rebuilding morale in challenging situations",
      "You build trust when:",
      "• You speak truth with kindness",
      "• You honour emotions without letting them take over",
      "• You back encouragement with accountability",
      "You leverage value when:",
      "• You partner with strategic thinkers and operational leads",
      "• You connect morale building with team objectives",
      "• You embed psychological safety into outcomes, not just culture"
    ],
    "collaborationTips": [
      "Motivators thrive when surrounded by a variety of energy types. You don’t need to lead the room, you lead through connection. Your collaboration sweet spot is partnering with people who balance structure, action, and strategy while respecting your relational lens.",
      "Your Role in the Team: You’re the one who asks, \"How is everyone really doing?\" You help resolve invisible tension, lift team energy, and spot what’s unsaid but deeply felt. You're also a vital link between the voices in the room and the heart of the mission.",
      "Best Collaborators for You:",
      "• Visionary (1): For direction and inspiration",
      "• Facilitator (5): For emotional pacing and steadiness",
      "• Coordinator (6): For structure and reliability",
      "Tips for Working with All Profiles:",
      "• With high-speed profiles (1, 2): Ask for clarity and pacing without feeling ‘slow’",
      "• With detailed profiles (6, 7): Align emotionally before focusing on precision",
      "• With quiet profiles (4, 7): Give space and check in gently, don’t fill every silence"
    ],
    "developmentRecommendations": [
      "Your strength in connection is powerful, but unrefined empathy can lead to emotional fatigue or blurred boundaries. This section helps you shift from automatic support to intentional, strategic influence.",
      "To Elevate Performance:",
      "• Establish clear agreements with yourself and your team: what’s yours to carry, and what’s not",
      "• Create feedback loops with other profiles so you don’t carry emotional data alone",
      "• Know when to speak up and when to step back",
      "Daily Anchors:",
      "• Begin with a check-in: how are you, not just how are they?",
      "• Debrief emotionally intense days with a trusted peer or mentor",
      "• Practice saying “no” with compassion, not guilt",
      "Workshop Reflection Prompts:",
      "• When did I last support someone well, and what made it sustainable?",
      "• How do I protect my own wellbeing while being available to others?",
      "• Am I trusted for my consistency, not just my kindness?",
      "• What personal boundaries strengthen my leadership?"
    ],
    "holdingBack": [
      "You may be holding emotional weight you don’t need to carry. Sometimes, your empathy becomes over-functioning. You prioritise relationships so strongly that tasks, performance, or self-care get deprioritised.",
      "This section is a quick weekly and monthly pulse-check to keep your rhythm aligned.",
      "Weekly Check-In Prompts:",
      "• Where did I say yes when I meant no?",
      "• Whose emotions am I carrying that I need to release?",
      "• Did I model boundaries, or only encouragement?",
      "Monthly Calibration Metrics:",
      "• % of time spent in 1:1s, team dialogue, or emotional labour",
      "• Number of situations where I mediated or supported morale",
      "• One boundary I upheld this month that protected my energy"
    ],
    "closingThoughts": []
  },
  "PROFILE_4": {
    "display": "Connector",
    "title": "The Connector",
    "role": "Bridge",
    "frequency": "Influence + Implementation (B-C)",
    "coreTraits": "Empathetic, observant, timing-sensitive, trusted, intuitive communicator",
    "idealEnvironment": "Collaborative, values-driven teams with responsive leadership",
    "youMayHaveBeenCalled": "the people whisperer, the translator, the empathic leader, the harmoniser",
    "famousExamples": "Michelle Obama, Satya Nadella (Microsoft), Angela Merkel, Malala Yousafzai",
    "profileInDepth": [
      "Connectors are the human bridge between intention and action. You have a natural gift for sensing not only what people need, but when they need it. You don’t force connection, you create space for it. Your relational energy is warm and steady, making others feel safe and seen, while your practical instincts mean you know how to move things forward with care and accuracy.",
      "You’re often the person people turn to when there’s tension in the room, or confusion in the workflow. You speak up not for visibility, but for clarity and cohesion. You translate vision into connection, and connection into momentum.",
      "Merkel, Malala Yousafzai.",
      "Connectors often hold relationships, timing, and delivery in harmony. But because you work subtly, your strengths can go unnoticed, even by yourself. To deepen",
      "your self-awareness and leadership impact, use the prompts below to reflect on how you show up and where you can refine your influence."
    ],
    "energyMatrix": [
      "As a Connector, your energy is relational and responsive. You sense when to step in and when to hold space. You don’t impose structure, you observe the emotional and social flow, then act with precision. Your work is rarely loud, but it’s deeply impactful.",
      "You sit between the Motivator and Facilitator profiles. From the Motivator, you draw emotional insight and expressive energy. From the Facilitator, you share an instinct for timing, grounded presence, and calm leadership.",
      "CONNECTOR ENERGY MATRIX",
      "Zone Motivator (3) Connector (4 - You) Facilitator (5)",
      "Connection through Stability and team Drive Emotional uplift clarity rhythm",
      "Building morale and Creating alignment Sensing timing and Strength openness across needs environment",
      "Overcommitment to Underestimating Avoiding direct Challenge others influence confrontation",
      "Energises with Aligns with empathy Grounds with calm Support Style emotion and timing structure",
      "Relationship Team Role Morale builder Harmonic stabiliser integrator",
      "Tip: You work best with direct yet sensitive collaborators, those who value connection and bring structure, such as Coordinators (6), Facilitators (5), and Optimisers (8)."
    ],
    "teamRoleFit": [
      "Connectors are the relational glue in teams. You create trust between people and help projects succeed by aligning communication, timing, and needs. This section uses a quadrant-based view to explore how your natural strengths and relational instincts show up, and where you can grow your influence even further.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "As a Connector, your power lies in alignment. You see what others need, often before they realise it. But lasting alignment requires clarity, not just compassion.",
      "You thrive when paired with Catalysts or Coordinators, balancing movement and structure. Protect your own energy as much as you protect others’."
    ],
    "valueCreationPathway": [
      "Connectors create value by turning understanding into alignment. You take insight about people, their needs, frustrations, timing, and bring them together in a way that creates shared progress. You make people feel part of something. That feeling alone can increase trust, motivation, and retention.",
      "Real-World Examples of Connector Energy in Action:",
      "• Michelle Obama, a powerful example of grace, timing, advocacy, and inclusion. She builds consensus through empathy and message clarity.",
      "• Satya Nadella, CEO of Microsoft, is known for turning one of the world’s most technical companies into one of the most emotionally intelligent cultures.",
      "You deliver your best value when:",
      "• Guiding conversations across emotional, cultural, or strategic gaps",
      "• Acting as the conscience or compass in a growing organisation",
      "• Supporting transitions where sensitivity and people-knowledge matter",
      "You build trust when:",
      "• You name the quiet truths with calm clarity",
      "• You support without absorbing",
      "• You remain consistent in timing and tone",
      "You leverage value when:",
      "• You link people who need each other but can’t find the words",
      "• You embed emotional intelligence into structure, not just culture",
      "• You act before things break, because you saw it coming"
    ],
    "collaborationTips": [
      "You thrive in teams where emotional awareness and mutual respect are alive. You do not seek the spotlight, but you are often the bridge that allows others to share it. Effective collaboration for you isn’t about structure, it’s about presence, alignment, and subtle momentum.",
      "Your Role in the Team: You create glue. You intuitively sense where there are gaps, in process, communication, or trust, and you gently build the bridges to close them. You influence through timing, empathy, and clarity, not volume.",
      "Best Collaborators for You:",
      "• Facilitator (5): For calm and pacing",
      "• Coordinator (6): For clarity and follow-through",
      "• Motivator (3): For emotional backup and morale",
      "Tips for Working with All Profiles:",
      "• With Visionaries or Catalysts (1, 2): Let them lead but gently translate their fast vision into people-aligned messages",
      "• With Controllers or Optimisers (7, 8): Offer insight when needed, but know they value precision over pace, give them structure",
      "• With other Connectors, Motivators, or Facilitators (3–5): Balance empathy with action, don’t drown in compassion without movement"
    ],
    "developmentRecommendations": [
      "You bring harmony, but harmony isn’t always the goal. Sometimes growth needs disruption, and clarity needs challenge. Your development lies in honouring your gift for connection while building the courage to step into discomfort when it matters.",
      "To Elevate Performance:",
      "• Practise naming tension early before it turns into disconnection",
      "• Trust that your voice adds value, even when you’re not 100% ready",
      "• Let others carry emotional weight too, it’s not all yours",
      "Daily Anchors:",
      "• Ask yourself: “What needs to be said today that hasn’t been?”",
      "• Build one habit that structures your follow-through",
      "• Identify one area where you’re holding back for fear of conflict",
      "Workshop Reflection Prompts:",
      "• What is my impact when I speak up early versus when I delay?",
      "• Where am I creating harmony at the cost of clarity?",
      "• When do I listen too long instead of responding?",
      "• How can I develop more influence without losing empathy?"
    ],
    "holdingBack": [
      "Sometimes your desire to support and protect others leads to avoidance. You may prioritise stability over progress, or peace over possibility. Without reflection, this can quietly limit your influence and create internal burnout.",
      "Use this section to self-audit and rebalance.",
      "Weekly Check-In Prompts:",
      "• What emotional weight am I carrying for the team?",
      "• Where am I compromising too often?",
      "• What’s one thing I noticed but didn’t say?",
      "Monthly Calibration Metrics:",
      "• Number of times I redirected confusion or conflict constructively",
      "• % of team discussions where I contributed a bridge or resolution",
      "• One opportunity this month where I influenced direction without needing credit"
    ],
    "closingThoughts": []
  },
  "PROFILE_5": {
    "display": "Facilitator",
    "title": "The Facilitator",
    "role": "Grounder",
    "frequency": "Implementation (C)",
    "coreTraits": "Grounded, responsive, empathetic, calm under pressure, steady presence",
    "idealEnvironment": "Consistent, values-driven teams with space to support others.",
    "youMayHaveBeenCalled": "the calm one, the team rock, the trusted listener, the reliable one",
    "famousExamples": "Mary Barra (GM), Fred Rogers (Mr. Rogers), Susan Cain, Ruth Bader Ginsburg",
    "profileInDepth": [
      "Facilitators are the emotional and operational stabilisers in high-functioning teams. You work behind the scenes to keep momentum steady, manage interpersonal balance, and ensure the right things happen at the right time. You’re not reactive, you’re responsive. You don’t dominate the room, you steady it.",
      "While others may charge forward or step into the spotlight, you’re observing, guiding, and creating the environment where others can thrive. That quiet leadership is your power.",
      "Cain, and Ruth Bader Ginsburg.",
      "Facilitators often find themselves carrying more emotional labour than they realise. To truly step into your leadership potential, you need to honour your",
      "instincts and boundaries equally. Trust that your presence is powerful, especially when paired with a clear voice and strong alignment."
    ],
    "energyMatrix": [
      "As a Facilitator, your energy is deeply attuned to others. You read the emotional undercurrents of a group. You feel when to pause, when to move, and how to maintain a sustainable team tempo. Your energy isn’t fast or forceful, it’s responsive, reliable, and relational.",
      "You sit between the Connector and Coordinator profiles. From the Connector, you inherit people-awareness and sensitivity. From the Coordinator, you share a grounding in process, detail, and delivery. Your strength is bridging what people need and what systems require, quietly, calmly, and with conviction.",
      "FACILITATOR ENERGY MATRIX",
      "Zone Connector (4) Facilitator (5 - You) Coordinator (6)",
      "Connection and Team stability and Drive Structure and clarity timing care",
      "Translating human Creating safe and Implementing Strength needs steady space repeatable systems",
      "Absorbing too much Rigidity or resistance Challenge Avoiding discomfort responsibility to change",
      "Empathetic and Grounded and Logical and Support Style present calming systematic",
      "Emotional and Planning and delivery Team Role Relationship guide operational anchor lead",
      "Tip: You’re most energised in teams that value steady progress over flashy wins. You don’t chase status, you protect the people and the process."
    ],
    "teamRoleFit": [
      "Facilitators keep teams grounded and centred. You help others move forward by creating a sense of rhythm, fairness, and consistency. This section explores your stabilising role in a team using a quadrant-based view, so you can sharpen your presence and influence with clarity.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "Facilitators make workplaces humane. You hold the middle. But don’t let the middle hold you back.",
      "To grow, pair with Visionaries or Controllers who bring ideas and structure. Your magic is turning chaos into care, but you must care for yourself too."
    ],
    "valueCreationPathway": [
      "Facilitators create value by holding the space that allows others to rise. You build a culture where clarity, trust, and safety grow. That is not passive, it’s leadership in its most grounded form.",
      "Real-World Examples of Facilitator Energy in Action:",
      "• Susan Cain, championing the power of quiet in work and leadership",
      "• Mary Barra, CEO of GM, known for calm resolve and clear team communication",
      "You deliver your best value when:",
      "• Teams are misaligned and need steady recalibration",
      "• People need emotional safety and thoughtful guidance",
      "• Change or crisis requires level-headed continuity",
      "You build trust when:",
      "• You speak simply and consistently",
      "• You make space for others while knowing your own limits",
      "• You bring emotional depth to logical execution",
      "You leverage value when:",
      "• You insert rhythm into workflow and pace",
      "• You lead transitions, coaching moments, and debriefs",
      "• You offer feedback without overpowering"
    ],
    "collaborationTips": [
      "You collaborate best in calm, relational teams where trust is built over time. You don't need speed, you need space. Your role is not to lead every discussion, but to shape its tone and rhythm. When paired with stronger directional energy, you help balance out urgency with presence.",
      "Your Role in the Team: You create emotional and operational stability. You hold space, ensure needs are heard, and help teams land on solid ground before they take off again.",
      "Best Collaborators for You:",
      "• Connector (4): Matches your relational pace and supports your intuition",
      "• Coordinator (6): Brings structure that complements your steadiness",
      "• Motivator (3): Adds morale and energy to your stability",
      "Tips for Working with All Profiles:",
      "• With fast-paced profiles (1, 2): Ask for clarity and planning to avoid burnout",
      "• With high-detail profiles (6, 7): Provide human context and rhythm so systems serve people",
      "• With other calm profiles (4, 8): Make sure there's direction as well as depth"
    ],
    "developmentRecommendations": [
      "Your development edge is learning to lead not just through presence, but through voice. You don’t need to change your rhythm, you just need to know how powerful it already is. Speaking from that place is where your influence expands.",
      "To Elevate Performance:",
      "• Practise using your voice to reset tension, not just absorb it",
      "• Lead meetings or touchpoints where your energy sets the tone",
      "• Know when to anchor and when to challenge, even gently",
      "Daily Anchors:",
      "• Set boundaries and reflect on what’s yours to carry",
      "• Protect quiet thinking time so your wisdom doesn’t get lost",
      "• Start each day by checking in on who needs your steadiness most",
      "Workshop Reflection Prompts:",
      "• Where am I providing support when I could be guiding?",
      "• What does assertiveness look like for me?",
      "• What message do I need to share, even if it feels uncomfortable?",
      "• How does my presence influence energy in the room?"
    ],
    "holdingBack": [
      "Your greatest strength, being the grounded one, can sometimes become your trap. You may put others first too often, avoid discomfort, or silence your intuition to maintain peace. These reflection prompts are designed to help you find your true centre.",
      "Weekly Check-In Prompts:",
      "• What emotional energy am I carrying that’s not mine?",
      "• Where am I waiting instead of acting?",
      "• What conversation am I delaying?",
      "Monthly Calibration Metrics:",
      "• Number of times I offered steadiness or resolution in tension",
      "• One moment I chose voice over comfort this month",
      "• Percentage of meetings or interactions where I stayed centred"
    ],
    "closingThoughts": []
  },
  "PROFILE_6": {
    "display": "Coordinator",
    "title": "The Coordinator",
    "role": "Planner",
    "frequency": "Implementation + Insight (C-D)",
    "coreTraits": "Structured, practical, detail-oriented, dependable, plan-driven",
    "idealEnvironment": "Stable, organised teams that value planning and consistency",
    "youMayHaveBeenCalled": "the planner, the organiser, the safe pair of hands, the follow-through expert",
    "famousExamples": "Indra Nooyi (PepsiCo), Tim Cook (Apple), Angela Ahrendts (Burberry/Apple), and Ngozi Okonjo-Iweala (WTO)",
    "profileInDepth": [
      "Coordinators are the taskmasters and operational planners of successful teams. You know how to turn vision into action. You thrive when there are processes to improve, timelines to manage, and people to keep on track. While some profiles chase energy or ideas, you bring calm through clarity.",
      "You’re often the person others rely on when things are vague or messy. You provide not just structure, but reassurance that structure will be followed. You aren’t seeking control, you’re providing certainty. Your work clears the fog so others can move.",
      "Ahrendts (Burberry/Apple), and Ngozi Okonjo-Iweala (WTO).",
      "Coordinators often lead without needing the limelight. But that doesn’t mean you should fade into the background. Your challenge is to own your influence and step forward when leadership needs a grounded, consistent presence."
    ],
    "energyMatrix": [
      "As a Coordinator, your energy is structured and intentional. You operate best when there is a clear plan, predictable outcomes, and a logical sequence of steps to follow. Your ability to track moving parts and organise complex efforts makes you the backbone of team delivery.",
      "You sit between the Facilitator and Controller profiles. From the Facilitator, you share a sense of timing and team awareness. From the Controller, you gain focus, precision, and a need for order. Your rhythm shines in environments where predictability and pace must align.",
      "COORDINATOR ENERGY MATRIX",
      "Zone Facilitator (5) Coordinator (6 - You) Controller (7)",
      "Team harmony and Execution and Drive Accuracy and control pacing consistency",
      "Risk mitigation and data Strength Stabilising team flow Planning and delivery clarity",
      "Avoiding Over-reliance on Challenge Over-analysis or rigidity confrontation systems",
      "Support Calm and Organised and Directive and structured Style collaborative dependable",
      "Supportive rhythm Team Role Operational organiser Systems enforcer setter",
      "Tip: Your greatest impact is felt when others understand how to collaborate with your process, not just your results."
    ],
    "teamRoleFit": [
      "Coordinators bring structure, tracking, and order to teams. You’re the steady hands that help vision become reality. The quadrant-based view will help you reflect on how your planning and process skills are seen, and how you can own them more confidently.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "You help teams breathe. Your gift is repeatability, accountability, and structure. You thrive when paired with vision-led or people-led profiles.",
      "Own your voice, systems leadership isn’t second-tier. It’s foundational."
    ],
    "valueCreationPathway": [
      "Coordinators create value through execution excellence. You’re the one who makes sure the vision happens, the client is informed, the spreadsheet is updated, and nothing slips through the cracks.",
      "Real-World Examples of Coordinator Energy in Action:",
      "• Tim Cook, CEO of Apple, transformed logistics and delivery to scale one of the most valuable companies in history",
      "• Indra Nooyi led PepsiCo through complex global growth with strategic clarity and steady leadership",
      "You deliver your best value when:",
      "• Systems are needed to scale people, teams, or processes",
      "• Consistency is more important than charisma",
      "• Visibility is less valuable than reliability",
      "You build trust when:",
      "• You create visible clarity others can depend on",
      "• You take responsibility without being controlling",
      "• You follow through on even the smallest commitments",
      "You leverage value when:",
      "• You partner with fast-moving visionaries who need delivery partners",
      "• You optimise systems for efficiency, not just maintenance",
      "• You help people understand their part in the bigger picture"
    ],
    "collaborationTips": [
      "You collaborate best when others respect the process and follow through. You don’t need micromanagement or chaos, you need aligned expectations, a plan to follow, and partners who don’t overpromise and underdeliver.",
      "Your Role in the Team: You’re the anchor that allows others to take risks. Your structure is what lets creative, relational, and visionary profiles operate with more freedom.",
      "Best Collaborators for You:",
      "• Visionary (1): For ideas that need grounding",
      "• Facilitator (5): For rhythm and presence",
      "• Optimiser (8): For refining systems with precision",
      "Tips for Working with All Profiles:",
      "• With visionary types (1, 2): Set timelines early and agree on boundaries for flexibility",
      "• With people-focused types (3, 4): Clarify expectations, don’t assume they know the plan",
      "• With detail-driven types (7, 8): Align early so you aren’t duplicating systems"
    ],
    "developmentRecommendations": [
      "Your challenge isn’t doing more, it’s letting go. Great Coordinators build systems that empower others, not systems that make others depend on them. Growth comes when you shift from being the manager of everything to the enabler of high-functioning flow.",
      "To Elevate Performance:",
      "• Build systems that others can maintain",
      "• Focus on clarity more than control",
      "• Trust that others may do things differently, and still succeed",
      "Daily Anchors:",
      "• Prioritise communication just as much as tracking",
      "• Ask once per day: “Who needs visibility into this?”",
      "• Share the ‘why’ behind your process, not just the what",
      "Workshop Reflection Prompts:",
      "• What am I holding onto that someone else could own?",
      "• Where is structure serving people, and where is it limiting them?",
      "• What would it look like to trust my influence, not just my spreadsheets?",
      "• Where can I simplify or automate without losing control?"
    ],
    "holdingBack": [
      "Your value lies in consistency, but your growth lies in flexibility. You may over-engineer solutions, take on too much silently, or let frustration build when others move too fast or loose.",
      "Use these prompts to stay clear, centred, and sustainable.",
      "Weekly Check-In Prompts:",
      "• What system or process needs updating this week?",
      "• Where am I holding on too tightly?",
      "• Who have I supported silently but not communicated with?",
      "Monthly Calibration Metrics:",
      "• Number of check-ins that created clarity this month",
      "• % of tasks owned vs. shared",
      "• One process I simplified or delegated this month"
    ],
    "closingThoughts": []
  },
  "PROFILE_7": {
    "display": "Controller",
    "title": "The Controller",
    "role": "Analyst",
    "frequency": "Insight (D)",
    "coreTraits": "Analytical, consistent, systems-focused, detail-driven, independent",
    "idealEnvironment": "Structured, logic-based teams that value clarity and precision",
    "youMayHaveBeenCalled": "the quality control, the systems thinker, the risk spotter, the spreadsheet genius",
    "famousExamples": "Angela Merkel, Warren Buffett, Katherine Johnson (NASA), and Jeff Bezos",
    "profileInDepth": [
      "Controllers are the gatekeepers of quality. You see risks before they become problems and find inconsistencies that could lead to breakdowns. You bring a level of rigour that ensures teams stay accountable, focused, and aligned with what matters most.",
      "Where others may rely on gut instinct or rapid energy, you trust in patterns, logic, and careful analysis. You don’t just solve problems, you prevent them. And you don’t just correct errors, you design systems that stop them happening again.",
      "Controllers often hold a high bar, and sometimes don’t realise just how high. You are most effective when your voice is heard early in the process, not just when something goes wrong. Learning to communicate your insights without overwhelming others is one of your most powerful growth edges."
    ],
    "energyMatrix": [
      "As a Controller, your energy is measured, deliberate, and structured. You don’t move for the sake of movement, you act when the data makes sense, the risk is managed, and the outcome is defensible. Your consistency, logic, and depth of analysis provide a solid foundation that teams rely on to make quality decisions.",
      "You sit between the Coordinator and Optimiser profiles. From the Coordinator, you share an affinity for process and delivery. From the Optimiser, you borrow systems thinking and a desire to improve through data and insight. Your rhythm shines in environments that demand both rigour and responsibility.",
      "CONTROLLER ENERGY MATRIX",
      "Zone Coordinator (6) Controller (7 - You) Optimiser (8)",
      "Accuracy and System Drive Reliable execution control improvement",
      "Planning and Analytical depth Designing scalable Strength tracking and foresight solutions",
      "Inflexibility or Over-analysis and Perfectionism or Challenge over-planning rigidity isolation",
      "Dependable and Precise and Logical and Support Style clear thorough structured",
      "Quality control and Team Role Delivery coordinator System enhancer risk assessor",
      "Tip: You’re most energised when working independently within a trusted structure, especially if your expertise is respected and your standards are matched."
    ],
    "teamRoleFit": [
      "Controllers are the protectors of detail, data, and integrity. You focus on what’s true, measurable, and accountable. This quadrant-based view helps you see where your analytical gifts shine, and where to soften to increase impact.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "Controllers see what others miss. Your value is depth and discernment, but don’t isolate behind analysis. Build with, not just against. Collaborate with Visionaries and Connectors to translate rigour into relevance."
    ],
    "valueCreationPathway": [
      "Controllers create value by identifying what could go wrong, and building systems so it doesn’t. You offer assurance, clarity, and accountability. You stop problems before they happen and help teams scale by refining the way they work.",
      "Real-World Examples of Controller Energy in Action:",
      "• Warren Buffett’s long-game investment strategy, based on precision, discipline, and pattern recognition",
      "• Katherine Johnson (NASA), whose maths and checks underpinned the success of the US space program",
      "You deliver your best value when:",
      "• Others are unsure what’s real, reliable, or safe",
      "• The organisation is growing fast and needs more structure",
      "• A critical system or product is being built",
      "You build trust when:",
      "• You speak with logic and care, not just correctness",
      "• You give others confidence in the data, decision, or plan",
      "• You manage your perfectionism with prioritisation",
      "You leverage value when:",
      "• You share your observations early enough to shape direction",
      "• You partner with visionary, relational, or implementation profiles to balance speed with rigour",
      "• You develop systems that others can understand and maintain"
    ],
    "collaborationTips": [
      "You collaborate best when there are clear expectations, respect for process, and space for independent work. You bring substance to the conversation, not surface talk. You value outcomes that are repeatable, trackable, and grounded in reality.",
      "Your Role in the Team: You are the team’s quality compass. You assess, advise, and improve. You may not always be loud, but when you speak, your input helps ensure work is thorough and resilient.",
      "Best Collaborators for You:",
      "• Visionary (1): To provide big ideas you can ground",
      "• Coordinator (6): To align with your structure and rhythm",
      "• Optimiser (8): To sharpen and refine systems alongside you",
      "Tips for Working with All Profiles:",
      "• With fast-paced types (1, 2): Offer process, not pushback",
      "• With people-led profiles (3, 4): Acknowledge emotion while keeping logic clear",
      "• With flexible or vague leaders: Ask clear questions to get the clarity you need"
    ],
    "developmentRecommendations": [
      "Growth for Controllers comes not from doing more, but from showing up earlier. Your logic and structure are powerful, but they must be shared proactively, not reactively. Speak when your instincts notice the gap, not just when it’s too late to fix it.",
      "To Elevate Performance:",
      "• Contribute to planning, not just editing or reviewing",
      "• Let go of being right in favour of creating clarity",
      "• Share context for your high standards, help others understand your why",
      "Daily Anchors:",
      "• Share one insight each day with a teammate, even if it feels obvious",
      "• Choose clarity over perfection, what’s 80% good enough?",
      "• Invite others to stress-test your ideas so they grow too",
      "Workshop Reflection Prompts:",
      "• What’s one insight I’m sitting on that could help someone now?",
      "• What would more visibility look like for my strengths?",
      "• When does my need for correctness limit innovation?",
      "• Where am I assuming others understand my logic, but they don’t?"
    ],
    "holdingBack": [
      "Your strengths can become limits when you stop trusting others, overcompensate with systems, or let your need for proof delay your participation. These reflection questions will help you balance high standards with timely action.",
      "Weekly Check-In Prompts:",
      "• Where am I holding back feedback until it’s “perfect”?",
      "• Where could I add value now, even with a partial answer?",
      "• Who could benefit from a question I’m asking myself?",
      "Monthly Calibration Metrics:",
      "• Number of times I spoke up early in the process this month",
      "• % of decisions where my insights shaped clarity or safety",
      "• One process I improved with foresight and collaboration"
    ],
    "closingThoughts": []
  },
  "PROFILE_8": {
    "display": "Optimiser",
    "title": "The Optimiser",
    "role": "Refiner",
    "frequency": "Insight + Innovation (D-A)",
    "coreTraits": "Analytical, creative, strategic, systems-oriented, precise",
    "idealEnvironment": "Teams that value continuous improvement, thoughtful execution, and results that scale",
    "youMayHaveBeenCalled": "the fixer, the behind-the-scenes strategist, the system builder, the efficiency expert",
    "famousExamples": "Bill Gates, Ruth Bader Ginsburg, Marie Kondo, and Reed Hastings (Netflix)",
    "profileInDepth": [
      "Optimisers are problem-solvers at their core. You thrive on asking: How can this be better? You bring together logic and creativity to fix what’s broken, or to enhance what already works. You’re often the one refining, iterating, and improving silently while others move loudly.",
      "You may work quietly, but your work speaks volumes. Others may not always see how much better something could be, but you do. And your ability to fine-tune at scale makes you one of the most valuable profiles in growing or complex organisations.",
      "You don’t need attention, you need space. The more you’re trusted to work independently and improve what matters most, the more successful your team becomes."
    ],
    "energyMatrix": [
      "As an Optimiser, your energy is thoughtful, deliberate, and future-oriented. You don’t chase movement, you engineer improvement. While others rush into action, you pause to evaluate, refine, and ensure the long-term solution is better than the quick fix.",
      "You sit between the Controller and Visionary profiles. From the Controller, you gain structure, logic, and depth. From the Visionary, you borrow strategic insight and long-range thinking. You marry improvement with innovation.",
      "OPTIMISER ENERGY MATRIX",
      "Zone Controller (7) Optimiser (8 - You) Visionary (1)",
      "Accuracy and Improvement and Possibility and Drive prevention innovation disruption",
      "Strength Systems that protect Systems that scale Ideas that inspire",
      "Perfectionism and Inconsistency or Challenge Over-analysis isolation impatience",
      "Strategic Support Style Rigor and checks Vision and direction improvement",
      "Ideator and change Team Role Quality enforcer Refiner and optimiser initiator",
      "Tip: You’re most effective when given time and trust to improve things properly, without being forced to cut corners or rush excellence."
    ],
    "teamRoleFit": [
      "Optimisers make good things better. You refine, systemise, and improve everything you touch. Using the quadrant-based model, this section helps you reflect on how your strength as a ‘completer-finisher’ shows up, and where it can grow.",
      "In this section, we use the Johari Window, a powerful model for self-awareness and interpersonal understanding, to frame your team role through four critical dimensions:",
      "• Open Area – What’s visible to both you and others",
      "• Blind Spot – What others notice but you may not",
      "• Hidden Area – What you know but tend to hold back",
      "• Unknown Area – The unseen potential still to emerge",
      "By viewing your natural contribution through these lenses, you can sharpen your strengths, anticipate friction, and build trust across any team or project.",
      "THE FOUR QUADRANTS OF TEAM ROLE FIT",
      "TEAM ROLE FIT INSIGHTS",
      "You are the quiet force behind sustainable excellence. Partner with Catalysts for momentum and Coordinators for execution.",
      "Don’t just fix, frame. Your value grows when others see your why, not just your what."
    ],
    "valueCreationPathway": [
      "Optimisers create value by turning effort into excellence. You don’t just finish the job, you perfect it. While others chase novelty or speed, you ensure systems, processes, and strategies are continually refined to deliver better outcomes over time.",
      "Real-World Examples of Optimiser Energy in Action:",
      "• Bill Gates, whose post-launch work on Microsoft infrastructure made it one of the world’s most resilient tech ecosystems",
      "• Marie Kondo, who built a global brand by refining how people organise, think, and live",
      "You deliver your best value when:",
      "• Something needs to evolve, not just work once, but work better",
      "• A system is starting to break under growth or pressure",
      "• A product, project, or team is ready for refinement and scale",
      "You build trust when:",
      "• You communicate not just what to improve, but why",
      "• You balance your depth with empathy and timing",
      "• You help others understand the implications of staying the same",
      "You leverage value when:",
      "• You work alongside bold visionaries, organised coordinators, and relational communicators",
      "• You insert improvement loops into team habits",
      "• You teach others to spot and solve issues, not just fix them"
    ],
    "collaborationTips": [
      "You collaborate best when given space to think, respect for your depth, and a clear understanding of the problem to solve. You’re not interested in being the loudest voice, you want to bring the most useful solution.",
      "Your Role in the Team: You are the system upgrader. You help others see what’s not working and offer a practical path to make it better. Your input raises the quality of everyone’s output.",
      "Best Collaborators for You:",
      "• Visionary (1): Brings big ideas you can refine into workable systems",
      "• Controller (7): Matches your love for rigour, while checking your perfectionism",
      "• Coordinator (6): Keeps momentum going while you make the system stronger",
      "Tips for Working with All Profiles:",
      "• With fast-paced types (1, 2): Agree on version one vs. version forever",
      "• With emotional profiles (3, 4): Let them feel heard before refining the plan",
      "• With structure-led types (6, 7): Balance responsibility without overloading each other"
    ],
    "developmentRecommendations": [
      "Your development lies in knowing when “better” is actually good enough. You will always see ways to improve something, but growth comes from acting before things are perfect, and sharing your insights even when they’re still forming.",
      "To Elevate Performance:",
      "• Speak up sooner, improvement matters more than timing it perfectly",
      "• Collaborate early rather than correcting later",
      "• Trust that influence grows through contribution, not just results",
      "Daily Anchors:",
      "• Ask: What’s the most useful thing I can fix or improve today?",
      "• Share an idea before it’s complete, get input, not just approval",
      "• Close at least one loop daily, ship, finish, or deliver",
      "Workshop Reflection Prompts:",
      "• What is “good enough” for this project or moment?",
      "• Where am I waiting when I could be acting?",
      "• Who can support my strengths by helping move things forward?",
      "• What’s the opportunity if I trust progress more than perfection?"
    ],
    "holdingBack": [
      "Your strengths, depth, refinement, and systems thinking, can trap you when you go too far. Perfectionism, over-isolation, or reluctance to share early ideas may limit your influence.",
      "Weekly Check-In Prompts:",
      "• What am I refining that doesn’t need more work?",
      "• What feedback loop am I avoiding?",
      "• Where can I share something at 80% and let others build with me?",
      "Monthly Calibration Metrics:",
      "• Number of finished improvements vs. started ideas",
      "• Times I asked for input before finalising a solution",
      "• One system or process I delivered that simplified something complex"
    ],
    "closingThoughts": []
  }
};

function getProfileContent(code?: string | null): ProfileBasedContent {
  const normalized = String(code || "").toUpperCase();
  return PROFILE_BASED_CONTENT[normalized] || PROFILE_BASED_CONTENT.PROFILE_1;
}


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
  teamRoleFitVisual: "/org-graphics/tp-team-role-fit.png",
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
            className="h-full w-full object-contain"
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
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 230;
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
            viewBox="-120 -80 880 800"
            className="h-auto w-full max-w-[760px] overflow-visible"
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
              const t = axisPoint(i, 1.24);
              const anchor = t.x > cx + 20 ? "start" : t.x < cx - 20 ? "end" : "middle";
              const labelX = anchor === "start" ? t.x + 8 : anchor === "end" ? t.x - 8 : t.x;
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
                    x={labelX}
                    y={t.y}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize="11"
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


function ProfileTextBlocks(props: { blocks: string[]; className?: string }) {
  return (
    <div
      className={cls(
        "space-y-3 text-[13px] leading-[28px] text-[#313C52]",
        props.className,
      )}
    >
      {props.blocks.map((block, index) => {
        const trimmed = String(block || "").trim();
        if (!trimmed) return null;
        const isBullet = trimmed.startsWith("•");
        const isHeading =
          !isBullet &&
          trimmed.length < 90 &&
          (trimmed.endsWith(":") || /^[A-Z0-9 &–—-]+$/.test(trimmed));

        if (isHeading) {
          return (
            <h4
              key={`${trimmed}-${index}`}
              className="pt-2 text-[11px] font-extrabold uppercase leading-[18px] tracking-[1px] text-[#313C52]"
            >
              {trimmed}
            </h4>
          );
        }

        return (
          <p
            key={`${trimmed}-${index}`}
            className={cls(isBullet && "pl-4")}
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

type EnergyMatrixTable = {
  title: string;
  headers: string[];
  rows: Array<{ label: string; cells: string[] }>;
  tip?: string;
  reflectionPrompts?: string[];
};

const ENERGY_MATRIX_TABLES: Record<string, EnergyMatrixTable> = {
  PROFILE_1: {
    title: "Visionary Energy Matrix",
    headers: ["Optimiser (8)", "Visionary (1 – You)", "Catalyst (2)"],
    rows: [
      { label: "Drive", cells: ["Refinement, systems and optimisation", "Innovation, strategic thinking and visibility", "Influence, momentum and activation"] },
      { label: "Strength", cells: ["Improving existing ideas with precision", "Generating bold ideas and direction", "Inspiring action and building energy"] },
      { label: "Challenge", cells: ["Depth and sustainable delivery", "Starting from scratch without structure", "Follow-through and detail"] },
      { label: "Support Style", cells: ["Brings process and space to refine", "Needs structure and clarity to scale", "Needs stage and attention to activate"] },
      { label: "Team Role", cells: ["Solution enhancer", "Vision setter", "Energy driver"] },
    ],
    tip: "A high-functioning team often includes all three energy zones. If an idea is struggling to come to life, check whether one of these zones is missing.",
  },
  PROFILE_2: {
    title: "Catalyst Energy Matrix",
    headers: ["Visionary (1)", "Catalyst (2 – You)", "Motivator (3)"],
    rows: [
      { label: "Drive", cells: ["Momentum, innovation and big-picture strategy", "Drive activation, connection and persuasion", "Empathy, uplift and people energy"] },
      { label: "Strength", cells: ["Vision and strategic direction", "Energy, motivation and buy-in", "Morale building and team support"] },
      { label: "Challenge", cells: ["Follow-through and focus", "Overcommitment and staying power", "Over-personalising challenges"] },
      { label: "Support Style", cells: ["Needs a team to carry execution", "Needs structure to pace output", "Needs clarity in priorities"] },
      { label: "Team Role", cells: ["Architect of direction", "Igniter of action", "Emotional and relational glue"] },
    ],
    tip: "Surround yourself with profiles who stabilise and ground your pace. Facilitators, Coordinators, and Optimisers bring implementation, rhythm, and refinement to your ideas.",
  },
  PROFILE_3: {
    title: "Motivator Energy Matrix",
    headers: ["Catalyst (2)", "Motivator (3 – You)", "Connector (4)"],
    rows: [
      { label: "Drive", cells: ["Activation and momentum", "Morale, belief and emotional energy", "Connection, timing and alignment"] },
      { label: "Strength", cells: ["Gets people moving", "Keeps people encouraged and engaged", "Builds trust across needs"] },
      { label: "Challenge", cells: ["Moving too fast", "Over-carrying other people’s emotions", "Avoiding direct tension"] },
      { label: "Support Style", cells: ["Brings urgency", "Creates warmth and belief", "Adds clarity and relational structure"] },
      { label: "Team Role", cells: ["Spark", "Morale builder", "Relationship bridge"] },
    ],
    tip: "Your best energy is protected when you encourage people without becoming responsible for everyone’s emotional state.",
  },
  PROFILE_4: {
    title: "Connector Energy Matrix",
    headers: ["Motivator (3)", "Connector (4 – You)", "Facilitator (5)"],
    rows: [
      { label: "Drive", cells: ["Emotional uplift", "Connection through clarity", "Stability and team rhythm"] },
      { label: "Strength", cells: ["Building morale and openness", "Creating alignment across needs", "Sensing timing and environment"] },
      { label: "Challenge", cells: ["Overcommitment to others", "Underestimating influence", "Avoiding direct confrontation"] },
      { label: "Support Style", cells: ["Energises with emotion", "Aligns with empathy and timing", "Grounds with calm structure"] },
      { label: "Team Role", cells: ["Morale builder", "Relationship integrator", "Harmonic stabiliser"] },
    ],
    tip: "You work best with direct yet sensitive collaborators, those who value connection and bring structure, such as Coordinators, Facilitators, and Optimisers.",
  },
  PROFILE_5: {
    title: "Facilitator Energy Matrix",
    headers: ["Connector (4)", "Facilitator (5 – You)", "Coordinator (6)"],
    rows: [
      { label: "Drive", cells: ["Relationship alignment", "Calm, safety and rhythm", "Planning, delivery and order"] },
      { label: "Strength", cells: ["Translates needs", "Creates inclusive stability", "Tracks action and responsibilities"] },
      { label: "Challenge", cells: ["Over-attuning to people", "Avoiding direct decisions", "Becoming too task-led"] },
      { label: "Support Style", cells: ["Aligns with empathy", "Grounds with presence", "Supports through structure"] },
      { label: "Team Role", cells: ["Bridge", "Grounder", "Planner"] },
    ],
    tip: "Your calm has the greatest impact when it is paired with clear decisions and visible follow-through.",
  },
  PROFILE_6: {
    title: "Coordinator Energy Matrix",
    headers: ["Facilitator (5)", "Coordinator (6 – You)", "Controller (7)"],
    rows: [
      { label: "Drive", cells: ["Stability and presence", "Operational clarity and delivery", "Accuracy and risk awareness"] },
      { label: "Strength", cells: ["Keeps people steady", "Turns plans into outcomes", "Protects standards and quality"] },
      { label: "Challenge", cells: ["Avoiding hard calls", "Over-owning execution", "Becoming too critical"] },
      { label: "Support Style", cells: ["Creates calm", "Builds reliable process", "Tests logic and detail"] },
      { label: "Team Role", cells: ["Grounder", "Planner", "Analyst"] },
    ],
    tip: "Your reliability is powerful, but it becomes leadership when you use it to create clarity, not just carry tasks.",
  },
  PROFILE_7: {
    title: "Controller Energy Matrix",
    headers: ["Coordinator (6)", "Controller (7 – You)", "Optimiser (8)"],
    rows: [
      { label: "Drive", cells: ["Delivery and coordination", "Precision, logic and accountability", "Systems improvement and refinement"] },
      { label: "Strength", cells: ["Keeps work moving", "Spots risks and protects quality", "Improves what already exists"] },
      { label: "Challenge", cells: ["Over-managing detail", "Perfectionism or rigidity", "Staying too long in refinement"] },
      { label: "Support Style", cells: ["Creates practical order", "Applies standards", "Optimises systems"] },
      { label: "Team Role", cells: ["Planner", "Analyst", "Refiner"] },
    ],
    tip: "Your strongest contribution is not just finding what is wrong; it is helping the team build safer, smarter, more reliable ways forward.",
  },
  PROFILE_8: {
    title: "Optimiser Energy Matrix",
    headers: ["Controller (7)", "Optimiser (8 – You)", "Visionary (1)"],
    rows: [
      { label: "Drive", cells: ["Accuracy and quality", "Improvement, systems and refinement", "Innovation and future possibility"] },
      { label: "Strength", cells: ["Protects integrity", "Makes things work better", "Sees what could be created next"] },
      { label: "Challenge", cells: ["Over-analysis", "Quietly refining for too long", "Starting without enough grounding"] },
      { label: "Support Style", cells: ["Provides standards", "Improves structure", "Adds creative direction"] },
      { label: "Team Role", cells: ["Analyst", "Refiner", "Strategist"] },
    ],
    tip: "You create the most value when you are trusted to refine, improve, and rebuild without being rushed out of your thinking process too early.",
  },
};

function bulletText(text: string) {
  return String(text || "").replace(/^•\s*/, "").trim();
}

function splitValueCreation(blocks: string[]) {
  const examplesIndex = blocks.findIndex((x) => /real-world examples/i.test(x));
  const deliverIndex = blocks.findIndex((x) => /you deliver your best value when/i.test(x));
  const trustIndex = blocks.findIndex((x) => /you build trust when/i.test(x));
  const leverageIndex = blocks.findIndex((x) => /you leverage value when/i.test(x));

  const introEnd = examplesIndex >= 0 ? examplesIndex : blocks.length;
  const intro = blocks.slice(0, introEnd).filter((x) => x && !x.startsWith("•"));

  const examples = examplesIndex >= 0
    ? blocks.slice(examplesIndex + 1, deliverIndex > examplesIndex ? deliverIndex : blocks.length).filter((x) => x.trim().startsWith("•")).map(bulletText)
    : [];

  const deliver = deliverIndex >= 0
    ? blocks.slice(deliverIndex + 1, trustIndex > deliverIndex ? trustIndex : blocks.length).filter((x) => x.trim().startsWith("•")).map(bulletText)
    : [];
  const trust = trustIndex >= 0
    ? blocks.slice(trustIndex + 1, leverageIndex > trustIndex ? leverageIndex : blocks.length).filter((x) => x.trim().startsWith("•")).map(bulletText)
    : [];
  const leverage = leverageIndex >= 0
    ? blocks.slice(leverageIndex + 1).filter((x) => x.trim().startsWith("•")).map(bulletText)
    : [];

  return { intro, examples, deliver, trust, leverage };
}

function EnergyMatrixSection(props: {
  profileCode: string;
  profileName: string;
  blocks: string[];
}) {
  const table = ENERGY_MATRIX_TABLES[props.profileCode] || ENERGY_MATRIX_TABLES.PROFILE_4;
  const intro = props.blocks
    .filter((block) => block && !block.startsWith("•"))
    .slice(0, 2);
  const prompts = table.reflectionPrompts || [
    "How do I respond when team dynamics feel tense or unclear?",
    "When do I feel most effective when aligning people, ideas, or plans?",
    "Do I wait for permission to share what I see?",
    "What systems help me protect my energy while supporting others?",
    "Who brings structure that complements my natural style?",
  ];

  return (
    <WhiteCard className="p-[20px]">
      <div className="space-y-[18px] text-[13px] leading-[28px] text-[#313C52]">
        {intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <h3 className="mt-[22px] text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
        {table.title}
      </h3>

      <div className="mt-[16px] overflow-x-auto rounded-[14px] border border-white/30 shadow-[0_6px_32px_rgba(58,110,212,0.12)]">
        <table className="w-full min-w-[760px] border-collapse text-center text-[12px] leading-[20px] text-[#084595]">
          <thead>
            <tr>
              <th className="w-[160px] border-r-4 border-white bg-[#16356D] px-4 py-6 text-left text-[10px] font-extrabold uppercase tracking-[1px] text-white">
                Zone
              </th>
              {table.headers.map((header) => (
                <th
                  key={header}
                  className="border-r-4 border-white bg-[#4092C5] px-4 py-6 text-[11px] font-extrabold uppercase tracking-[1px] text-white last:border-r-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={row.label}>
                <td className="border-r-4 border-t-4 border-white bg-[#B9C6D6] px-4 py-4 text-left text-[10px] font-extrabold uppercase tracking-[1px] text-[#16356D]">
                  {row.label}
                </td>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${row.label}-${cellIndex}`}
                    className={cls(
                      "border-r-4 border-t-4 border-white px-4 py-4 last:border-r-0",
                      rowIndex % 2 === 0 ? "bg-[#CFE4F3]" : "bg-[#BFD3E6]",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.tip ? (
        <div className="mt-[22px] rounded-[10px] border border-[#084595] bg-white px-[20px] py-[16px] text-[12px] leading-[24px] text-[#313C52]">
          <strong>Tip:</strong> {table.tip}
        </div>
      ) : null}

      <div className="mt-[24px]">
        <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
          Reflection Questions: Your Energy in Action
        </h3>
        <div className="mt-[14px] grid gap-[8px] md:grid-cols-2">
          {prompts.map((prompt) => (
            <div
              key={prompt}
              className="rounded-[8px] bg-[#E7F0FA] px-[16px] py-[11px] text-[12px] italic leading-[20px] text-[#313C52]"
            >
              • {prompt}
            </div>
          ))}
        </div>
      </div>
    </WhiteCard>
  );
}

function TeamRoleFitSection(props: {
  profileContent: ProfileBasedContent;
}) {
  const blocks = props.profileContent.teamRoleFit;
  const insightsIndex = blocks.findIndex((x) => /TEAM ROLE FIT INSIGHTS/i.test(x));
  const introBlocks = blocks
    .slice(0, insightsIndex >= 0 ? insightsIndex : blocks.length)
    .filter((x) => !/THE FOUR QUADRANTS/i.test(x));
  const insightBlocks = insightsIndex >= 0 ? blocks.slice(insightsIndex + 1) : [];

  return (
    <WhiteCard className="p-[20px]">
      <div className="text-[13px] leading-[28px] text-[#313C52]">
        {introBlocks.map((block) => {
          const isBullet = block.trim().startsWith("•");
          return isBullet ? (
            <p key={block} className="ml-6 mt-[8px]">
              {block}
            </p>
          ) : (
            <p key={block} className="mt-[16px] first:mt-0">
              {block}
            </p>
          );
        })}
      </div>

      <h3 className="mt-[20px] text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
        The Four Quadrants of Team Role Fit
      </h3>
      <div className="mt-[14px] flex justify-start">
        <ReportAssetImage
          src={REPORT_ASSETS.teamRoleFitVisual}
          alt="Team role fit Johari Window"
          className="h-auto w-full max-w-[470px] rounded-[8px] object-contain"
        />
      </div>

      {insightBlocks.length ? (
        <div className="mt-[24px]">
          <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
            Team Role Fit Insights
          </h3>
          <ProfileTextBlocks blocks={insightBlocks} className="mt-[14px]" />
        </div>
      ) : null}
    </WhiteCard>
  );
}

function ValueCreationPathwaySection(props: {
  profileContent: ProfileBasedContent;
}) {
  const parsed = splitValueCreation(props.profileContent.valueCreationPathway);
  const exampleNames = ["Example 1", "Example 2"];

  return (
    <WhiteCard className="p-[20px]">
      <div className="space-y-[16px] text-[13px] leading-[28px] text-[#313C52]">
        {parsed.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {parsed.examples.length ? (
        <div className="mt-[22px]">
          <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
            Real-world examples of {props.profileContent.display} energy in action:
          </h3>
          <div className="mt-[14px] grid gap-[14px] md:grid-cols-2">
            {parsed.examples.slice(0, 2).map((example, index) => {
              const [name, ...rest] = example.split(/,\s|\s+launched\s+|\s+energises\s+|\s+created\s+|\s+anticipated\s+/i);
              return (
                <div
                  key={example}
                  className="rounded-[8px] border border-[#A9B8CE] bg-white px-[18px] py-[14px] text-[12px] leading-[20px] text-[#313C52]"
                >
                  <div className="font-bold text-[#313C52]">
                    {name && name.length < 40 ? name.replace(/^•\s*/, "") : exampleNames[index]}
                  </div>
                  <p className="mt-[6px]">
                    {name && name.length < 40 && rest.length ? example.replace(name, "").replace(/^,?\s*/, "") : example}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-[18px] overflow-x-auto rounded-[8px]">
        <table className="w-full min-w-[760px] border-collapse text-[12px] leading-[22px] text-[#084595]">
          <thead>
            <tr>
              {[
                "You deliver your best value when:",
                "You build trust when:",
                "You leverage value when:",
              ].map((heading, index) => (
                <th
                  key={heading}
                  className={cls(
                    "border-r-4 border-white px-4 py-4 text-left text-[10px] font-extrabold uppercase tracking-[1px] text-white last:border-r-0",
                    index === 0 ? "bg-[#16356D]" : index === 1 ? "bg-[#284C9C]" : "bg-[#2E80BD]",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(parsed.deliver.length, parsed.trust.length, parsed.leverage.length, 1) }).map((_, index) => (
              <tr key={index}>
                {[parsed.deliver, parsed.trust, parsed.leverage].map((items, cellIndex) => (
                  <td
                    key={`${index}-${cellIndex}`}
                    className={cls(
                      "w-1/3 border-r-4 border-t-4 border-white px-4 py-4 align-top last:border-r-0",
                      index % 2 === 0 ? "bg-[#CFE4F3]" : "bg-[#BFD3E6]",
                    )}
                  >
                    {items[index] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WhiteCard>
  );
}

function stripBulletPrefix(text: string) {
  return String(text || "").replace(/^•\s*/, "").replace(/^\d+\.\s*/, "").trim();
}

function stripHeadingPrefix(text: string, heading: string) {
  return String(text || "").replace(new RegExp(`^${heading}\\s*:?\\s*`, "i"), "").trim();
}

function pluralProfileToImageName(label: string) {
  const normalized = String(label || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/profiles?/gi, "")
    .trim()
    .toLowerCase();

  if (normalized.includes("visionar")) return "Visionary";
  if (normalized.includes("catalyst")) return "Catalyst";
  if (normalized.includes("motivator")) return "Motivator";
  if (normalized.includes("connector")) return "Connector";
  if (normalized.includes("facilitator")) return "Facilitator";
  if (normalized.includes("coordinator")) return "Coordinator";
  if (normalized.includes("controller")) return "Controller";
  if (normalized.includes("optimiser") || normalized.includes("optimizer")) return "Optimiser";
  return label;
}

function splitProfileSection(
  blocks: string[],
  startPattern: RegExp,
  endPatterns: RegExp[] = [],
) {
  const start = blocks.findIndex((block) => startPattern.test(block));
  if (start < 0) return [];
  const end = blocks.findIndex(
    (block, index) => index > start && endPatterns.some((pattern) => pattern.test(block)),
  );
  return blocks.slice(start + 1, end > start ? end : blocks.length);
}

function CollaborationTipsSection(props: { profileContent: ProfileBasedContent }) {
  const blocks = props.profileContent.collaborationTips || [];
  const bestStart = blocks.findIndex((block) => /best collaborators/i.test(block));
  const tipsStart = blocks.findIndex((block) => /tips for working/i.test(block));
  const roleIndex = blocks.findIndex((block) => /your role in the team/i.test(block));

  const intro = blocks
    .slice(0, Math.min(...[roleIndex, bestStart, tipsStart].filter((x) => x >= 0)))
    .filter((block) => block && !block.trim().startsWith("•"));

  const roleText = roleIndex >= 0 ? stripHeadingPrefix(blocks[roleIndex], "Your Role in the Team") : "";

  const collaboratorBlocks = bestStart >= 0
    ? blocks.slice(bestStart + 1, tipsStart > bestStart ? tipsStart : blocks.length)
    : [];
  const collaborators = collaboratorBlocks
    .filter((block) => block.trim().startsWith("•"))
    .map((block) => {
      const text = stripBulletPrefix(block);
      const [label, ...rest] = text.split(":");
      return {
        label: label.trim(),
        imageName: pluralProfileToImageName(label),
        body: rest.join(":").trim(),
      };
    })
    .slice(0, 3);

  const tipBlocks = tipsStart >= 0 ? blocks.slice(tipsStart + 1) : [];
  const tips = tipBlocks
    .filter((block) => block.trim().startsWith("•"))
    .map((block, index) => {
      const text = stripBulletPrefix(block);
      const [maybeTitle, ...rest] = text.split(":");
      const hasExplicitTitle = rest.length > 0 && maybeTitle.length < 70;
      return {
        title: hasExplicitTitle ? maybeTitle.trim() : `Tip ${index + 1}`,
        body: hasExplicitTitle ? rest.join(":").trim() : text,
      };
    });

  return (
    <WhiteCard className="p-[20px]">
      <div className="space-y-[18px] text-[13px] leading-[28px] text-[#313C52]">
        {intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {roleText ? (
          <p>
            <strong>Your Role in the Team:</strong> {roleText}
          </p>
        ) : null}
      </div>

      {collaborators.length ? (
        <div className="mt-[24px]">
          <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
            Best collaborators for you:
          </h3>
          <div className="mt-[18px] grid gap-[28px] sm:grid-cols-3">
            {collaborators.map((collaborator) => {
              const image = topProfileImage(collaborator.imageName);
              return (
                <div key={collaborator.label}>
                  {image ? (
                    <ReportAssetImage
                      src={image}
                      alt={collaborator.label}
                      className="h-[124px] w-[124px] object-contain"
                    />
                  ) : null}
                  <div className="mt-[10px] text-[13px] font-bold leading-[20px] text-[#313C52]">
                    {collaborator.label}
                  </div>
                  <p className="mt-[6px] text-[12px] leading-[20px] text-[#313C52]">
                    {collaborator.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tips.length ? (
        <div className="mt-[28px]">
          <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
            Tips for working with all profiles:
          </h3>
          <div className="mt-[14px] space-y-[8px]">
            {tips.map((tip) => (
              <div
                key={`${tip.title}-${tip.body}`}
                className="rounded-[8px] border border-[#A9B8CE] border-l-[4px] border-l-[#084595] bg-white px-[18px] py-[12px]"
              >
                <div className="text-[13px] font-bold leading-[20px] text-[#313C52]">
                  {tip.title}
                </div>
                <p className="mt-[4px] text-[12px] leading-[20px] text-[#313C52]">
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </WhiteCard>
  );
}

function DevelopmentRecommendationsSection(props: { profileContent: ProfileBasedContent }) {
  const blocks = props.profileContent.developmentRecommendations || [];
  const elevateHeading = /to elevate performance/i;
  const anchorsHeading = /daily anchors/i;
  const promptsHeading = /workshop reflection prompts/i;
  const firstHeadingIndex = blocks.findIndex((block) => elevateHeading.test(block));
  const intro = blocks.slice(0, firstHeadingIndex >= 0 ? firstHeadingIndex : blocks.length);
  const elevate = splitProfileSection(blocks, elevateHeading, [anchorsHeading, promptsHeading]).map(stripBulletPrefix);
  const anchors = splitProfileSection(blocks, anchorsHeading, [promptsHeading]).map(stripBulletPrefix);
  const prompts = splitProfileSection(blocks, promptsHeading).map(stripBulletPrefix);
  const rowCount = Math.max(elevate.length, anchors.length, prompts.length, 1);

  return (
    <WhiteCard className="p-[20px]">
      <div className="space-y-[16px] text-[13px] leading-[28px] text-[#313C52]">
        {intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-[22px] overflow-x-auto rounded-[8px]">
        <table className="w-full min-w-[760px] border-collapse text-[12px] leading-[22px] text-[#084595]">
          <thead>
            <tr>
              {["To elevate performance:", "Daily anchors:", "Workshop reflection prompts:"].map((heading, index) => (
                <th
                  key={heading}
                  className={cls(
                    "w-1/3 border-r-4 border-white px-4 py-4 text-left text-[10px] font-extrabold uppercase tracking-[1px] text-white last:border-r-0",
                    index === 0 ? "bg-[#16356D]" : index === 1 ? "bg-[#284C9C]" : "bg-[#2E80BD]",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, index) => (
              <tr key={index}>
                {[elevate, anchors, prompts].map((items, cellIndex) => (
                  <td
                    key={`${index}-${cellIndex}`}
                    className={cls(
                      "w-1/3 border-r-4 border-t-4 border-white px-4 py-5 align-top last:border-r-0",
                      index % 2 === 0 ? "bg-[#CFE4F3]" : "bg-[#BFD3E6]",
                    )}
                  >
                    {items[index] ? (cellIndex === 2 ? `• ${items[index]}` : items[index]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WhiteCard>
  );
}

function HoldingBackSection(props: { profileContent: ProfileBasedContent }) {
  const blocks = props.profileContent.holdingBack || [];
  const weeklyHeading = /weekly check-in prompts/i;
  const monthlyHeading = /monthly calibration metrics/i;
  const firstHeadingIndex = blocks.findIndex((block) => weeklyHeading.test(block));
  const intro = blocks.slice(0, firstHeadingIndex >= 0 ? firstHeadingIndex : blocks.length);
  const weekly = splitProfileSection(blocks, weeklyHeading, [monthlyHeading]).map(stripBulletPrefix);
  const monthly = splitProfileSection(blocks, monthlyHeading).map(stripBulletPrefix);

  return (
    <WhiteCard className="p-[20px]">
      <div className="space-y-[16px] text-[13px] leading-[28px] text-[#313C52]">
        {intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-[24px] grid gap-[34px] lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
            Weekly Check-In Prompts:
          </h3>
          <div className="mt-[14px] space-y-[9px]">
            {weekly.map((item) => (
              <div
                key={item}
                className="rounded-[8px] bg-[#E7F0FA] px-[16px] py-[13px] text-[12px] italic leading-[20px] text-[#313C52]"
              >
                • {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-extrabold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
            Monthly Calibration Metrics:
          </h3>
          <ul className="mt-[14px] space-y-[10px] text-[12px] leading-[22px] text-[#313C52]">
            {monthly.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </WhiteCard>
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
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
        <ReportAssetImage
          src={REPORT_ASSETS.icons.nextSteps}
          alt="Next steps"
          className="h-full w-full object-contain"
        />
      </div>
      <h4 className="mt-4 font-semibold text-slate-800">{props.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.body}</p>
      {props.onClick || props.href ? (
        <button
          type="button"
          disabled={props.disabled}
          data-html2canvas-ignore="true"
          onClick={() => {
            if (props.onClick) {
              props.onClick();
              return;
            }
            window.open(props.href || "#", "_blank", "noopener,noreferrer");
          }}
          className={cls(
            "mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60",
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
  const [pdfBusy, setPdfBusy] = useState(false);

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
    if (pdfBusy) return;

    setPdfBusy(true);

    try {
      const qs = new URLSearchParams({ token, tid });
      if (src) qs.set("src", src);

      const res = await fetch(
        `/api/reports/team-puzzle-rhythm-pdf?${qs.toString()}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        const message = await res.text().catch(() => "");
        throw new Error(message || `PDF download failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `team-puzzle-rhythm-report-${token}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Server PDF download failed", e);
      window.print();
    } finally {
      setPdfBusy(false);
    }
  }

  const derived = useMemo(() => {
    if (!data) return null;

    const participantName = fullName(data.taker);
    const orgName = data.org?.name || "Life Puzzle";
    const profileName = data.result.top_profile_name || "Your Profile";
    const profileCode = data.result.top_profile_code || "";
    const profileContent = getProfileContent(profileCode);

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
      profileContent,
      topFreq,
      topFreqName,
      topFreqContent: getFrequencyContent(topFreq),
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
    profileContent,
    topFreq,
    topFreqName,
    topFreqContent,
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
      className="relative min-h-screen bg-[#061A3A] text-white"
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
              disabled={pdfBusy}
              data-html2canvas-ignore="true"
              className="h-[37px] rounded-lg border border-white/15 bg-[#08162B]/70 px-[15px] text-[13px] font-semibold leading-[20px] text-white hover:bg-[#08162B]/90 disabled:cursor-wait disabled:opacity-60"
            >
              {pdfBusy ? "Preparing..." : "Download PDF"}
            </button>
            {nextStepsUrl ? (
              <button
                type="button"
                onClick={() =>
                  window.open(nextStepsUrl, "_blank", "noopener,noreferrer")
                }
                data-html2canvas-ignore="true"
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
          <aside className="self-start rounded-[24px] border border-white/10 bg-gradient-to-b from-[rgba(27,60,99,0.78)] to-[rgba(12,32,58,0.84)] p-[18px] shadow-[0_14px_42px_rgba(0,0,0,0.32)] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
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
                disabled={pdfBusy}
                data-html2canvas-ignore="true"
                className="inline-flex h-[31px] items-center justify-center rounded-[8px] border border-white/12 bg-[rgba(8,22,43,0.72)] px-[14px] text-[11px] font-semibold leading-[16px] text-[#F8FAFC] shadow-sm disabled:cursor-wait disabled:opacity-60"
              >
                {pdfBusy ? "Preparing..." : "Download PDF"}
              </button>
              {nextStepsUrl ? (
                <a
                  href={nextStepsUrl}
                  data-html2canvas-ignore="true"
                  className="inline-flex h-[31px] items-center justify-center rounded-[8px] bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-[14px] text-[11px] font-semibold leading-[16px] text-[#071C36] shadow-sm"
                >
                  Next step
                </a>
              ) : (
                <button
                  type="button"
                  data-html2canvas-ignore="true"
                  className="inline-flex h-[31px] items-center justify-center rounded-[8px] bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-[14px] text-[11px] font-semibold leading-[16px] text-[#071C36] shadow-sm"
                >
                  Next step
                </button>
              )}
            </div>
          </aside>

          <div className="space-y-8">
            <Card className="p-0 bg-transparent shadow-none border-0">
              <WhiteCard className="rounded-[18px] p-[28px]">
                <h2 className="text-[18px] font-bold leading-[24px] text-[#111828]">
                  Welcome to your Team Puzzle Discovery Report
                </h2>
                <p className="mt-[6px] text-[14px] font-semibold leading-[22px] text-[#64748B]">
                  A note from the creator of this framework.
                </p>

                <div className="mt-[18px] space-y-[14px] text-[14px] leading-[25px] text-[#334155]">
                  <p>
                    Welcome to your Team Puzzle Discovery Report. I’m excited to be part of your journey as you uncover your natural strengths, communication style and best-fit contribution at work.
                  </p>
                  <p>
                    This report is designed to give you deep insight into how you work best, where you thrive in a team and how to align your role with your natural energy. When people understand themselves and each other more deeply, culture shifts, communication improves and performance becomes more sustainable.
                  </p>
                  <p>
                    Team Puzzle was created with that in mind. It’s not just a tool for insight — it is a practical system for action. It maps the puzzle pieces of your team so that you can fit together more effectively, reduce friction and increase flow.
                  </p>
                  <p>
                    Whether you are reading this as part of a leadership program, a coaching session or your own development, treat this as a starting point, not an ending. Use what you discover here to guide conversations, make better choices and design the way you want to work going forward.
                  </p>
                  <p>Warm regards,</p>
                  <p>Chandell Labbozzetta, Founder – Life Puzzle &amp; Team Puzzle Discovery Assessment</p>
                </div>

                <div className="mt-[26px]">
                  <ReportAssetImage
                    src={REPORT_ASSETS.chandell}
                    alt="Chandell Labbozzetta"
                    className="h-[110px] w-[110px] rounded-full border border-[#3B82F6] object-cover"
                  />
                  <p className="mt-[12px] text-[12px] leading-[20px] text-[#64748B]">
                    Chandell Labbozzetta, Founder – Life Puzzle &amp; Team Puzzle Discovery Assessment
                  </p>
                </div>
              </WhiteCard>
            </Card>

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
                          <div className="flex flex-wrap items-center justify-center gap-2 px-2">
                            <h3 className="text-[12px] font-semibold leading-[19px] text-[#111828]">
                              {p.name}
                            </h3>
                            {active ? (
                              <span className="whitespace-nowrap rounded-full bg-[#0FCD5E] px-[7px] py-[2px] text-[8px] font-bold leading-[10px] text-white">
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
                    {topFreqContent.name} ({topFreqContent.code})
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
                      {topFreqContent.name} ({topFreqContent.code})
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
                        <strong>Key traits:</strong>{" "}
                        {topFreqContent.coreAttributes.slice(0, 3).join(", ")}.
                      </p>
                    </div>
                    <div>
                      <ReportAssetImage
                        src="/icons/tp-key-trait2.png"
                        alt="Ideal roles"
                        className="h-[66px] w-[60px] object-contain"
                      />
                      <p className="mt-[12px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Ideal roles:</strong>{" "}
                        {topFreqContent.idealRoles.join(", ")}.
                      </p>
                    </div>
                    <div>
                      <ReportAssetImage
                        src="/icons/tp-key-trait3.png"
                        alt="Watch outs"
                        className="h-[66px] w-[60px] object-contain"
                      />
                      <p className="mt-[12px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Watch outs:</strong>{" "}
                        {topFreqContent.potentialBlindSpots.join(", ")}.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-[28px] rounded-[18px] border border-slate-200 bg-slate-50 p-[22px]">
                  <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                    Understanding {topFreqContent.name} Frequency
                  </h3>
                  <p className="mt-[12px] text-[13px] leading-[28px] text-[#313C52]">
                    {topFreqContent.definition}
                  </p>

                  <div className="mt-[20px] grid gap-[16px] lg:grid-cols-2">
                    <div className="rounded-[14px] bg-white p-[18px] shadow-sm">
                      <h4 className="text-[13px] font-bold text-[#111828]">
                        Core Attributes
                      </h4>
                      <ul className="mt-[10px] list-disc space-y-[6px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                        {topFreqContent.coreAttributes.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[14px] bg-white p-[18px] shadow-sm">
                      <h4 className="text-[13px] font-bold text-[#111828]">
                        Potential Blind Spots
                      </h4>
                      <ul className="mt-[10px] list-disc space-y-[6px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                        {topFreqContent.potentialBlindSpots.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-[18px] rounded-[18px] border border-slate-200 bg-white p-[22px]">
                  <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                    Profiles Aligned to the {topFreqContent.name} Frequency
                  </h3>
                  <div className="mt-[16px] grid gap-[14px] lg:grid-cols-3">
                    {topFreqContent.alignedProfiles.map((profile) => (
                      <div
                        key={profile.profile}
                        className="rounded-[14px] border border-slate-200 bg-slate-50 p-[16px]"
                      >
                        <h4 className="text-[13px] font-bold text-[#111828]">
                          {profile.profile}
                        </h4>
                        <ul className="mt-[10px] list-disc space-y-[6px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                          {profile.bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-[18px] rounded-[18px] border border-slate-200 bg-white p-[22px]">
                  <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                    How {topFreqContent.name} Shows Up in Teams
                  </h3>
                  <div className="mt-[16px] overflow-hidden rounded-[12px] border border-slate-200">
                    <div className="grid grid-cols-[210px_1fr] bg-[#084595] text-[13px] font-bold text-white">
                      <div className="border-r border-white/20 p-[12px]">
                        Trait
                      </div>
                      <div className="p-[12px]">Expression in Team Setting</div>
                    </div>
                    {topFreqContent.howItShowsUp.map((row) => (
                      <div
                        key={row.trait}
                        className="grid grid-cols-[210px_1fr] border-t border-slate-200 text-[13px] leading-[22px] text-[#313C52]"
                      >
                        <div className="border-r border-slate-200 p-[12px] font-medium">
                          {row.trait}
                        </div>
                        <div className="p-[12px]">{row.expression}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-[18px] grid gap-[18px] lg:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 bg-white p-[22px]">
                    <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                      Ideal Roles and Environments
                    </h3>
                    <ul className="mt-[14px] list-disc space-y-[7px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                      {topFreqContent.idealRoles.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <h4 className="mt-[18px] text-[13px] font-bold text-[#111828]">
                      Avoid environments that:
                    </h4>
                    <ul className="mt-[8px] list-disc space-y-[7px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                      {topFreqContent.avoidEnvironments.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[18px] border border-slate-200 bg-white p-[22px]">
                    <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                      {topFreqContent.name} Frequency in Practice: Coaching Tips
                    </h3>
                    <ul className="mt-[14px] list-disc space-y-[7px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                      {topFreqContent.coachingTips.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-[18px] grid gap-[18px] lg:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 bg-white p-[22px]">
                    <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                      Reflection Prompts
                    </h3>
                    <ol className="mt-[14px] list-decimal space-y-[7px] pl-[18px] text-[13px] leading-[22px] text-[#313C52]">
                      {topFreqContent.reflectionPrompts.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="rounded-[18px] border border-[#4092C5] bg-[#4092C5]/10 p-[22px]">
                    <h3 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#084595]">
                      Final Thoughts and Next Step
                    </h3>
                    <p className="mt-[14px] text-[13px] leading-[24px] text-[#313C52]">
                      {topFreqContent.finalThoughts}
                    </p>
                    {topFreqContent.nextStep ? (
                      <p className="mt-[14px] text-[13px] font-semibold leading-[24px] text-[#313C52]">
                        {topFreqContent.nextStep}
                      </p>
                    ) : null}
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
                    const itemContent = getProfileContent(item.code);
                    const watchOut = itemContent.holdingBack?.[0] ||
                      "Things to watch out for when this style is over-used or under pressure.";

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
                            <strong>Key traits:</strong> {itemContent.coreTraits}
                          </p>
                          <p className="mt-[14px]">
                            <strong>Motivators:</strong> {itemContent.idealEnvironment}
                          </p>
                          <p className="mt-[14px]">
                            <strong>Watch outs:</strong> {watchOut}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>

            <Card>
              <SectionHeader
                title={`Your profile in depth: ${profileContent.title}`}
                icon={REPORT_ASSETS.icons.profileInDepth}
              />
              <WhiteCard className="p-0">
                <div className="grid gap-[20px] p-[17px] lg:grid-cols-[minmax(390px,527px)_minmax(0,1fr)]">
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
                              {profileContent.frequency}
                            </p>
                            <p className="mt-[12px]">
                              <strong>Core Traits:</strong>{" "}
                              {profileContent.coreTraits}
                            </p>
                            <p className="mt-[12px]">
                              <strong>Ideal Environment:</strong>{" "}
                              {profileContent.idealEnvironment}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[18px] bg-white p-[24px] shadow-[0_6px_32px_rgba(58,110,212,0.12)] ring-1 ring-[#4092C5]">
                      <p className="text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>You may have been called:</strong>
                        <br />
                        {profileContent.youMayHaveBeenCalled || "Recognised for this natural contribution style."}
                      </p>
                      <p className="mt-[18px] text-[13px] leading-[20.8px] text-[#313C52]">
                        <strong>Famous {profileContent.display}s include:</strong>
                        <br />
                        {profileContent.famousExamples ||
                          "Recognised leaders and contributors who create value through this style."}
                      </p>
                    </div>
                  </div>

                  <ProfileTextBlocks
                    blocks={profileContent.profileInDepth}
                    className="min-w-0 text-[12.5px] leading-[25px]"
                  />
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

                <div className="mt-[24px] flex justify-center rounded-[18px] bg-white p-2 shadow-[0_6px_32px_rgba(58,110,212,0.12)]">
                  <ReportAssetImage
                    src={REPORT_ASSETS.rhythmPuzzle}
                    alt="Professional Performance Rhythm puzzle"
                    className="h-auto w-full max-w-[780px] object-contain"
                  />
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
              <WhiteCard className="p-[24px]">
                <h3 className="text-[14px] font-bold leading-[22px] text-[#111828]">
                  Professional Performance Rhythm – Driver Framework
                </h3>
                <div className="mt-[18px] text-[10px] font-bold uppercase leading-[16px] tracking-[1px] text-[#313C52]">
                  Understanding the RHYTHM Model
                </div>
                <div className="mt-[18px] grid gap-[16px] lg:grid-cols-2">
                  <div className="rounded-[18px] border border-[#4092C5] bg-white p-[24px] text-[13px] leading-[28px] text-[#313C52]">
                    <p>
                      The Professional Performance Rhythm framework is grounded in established organisational psychology principles, particularly:
                    </p>
                    <ul className="mt-[10px] space-y-[4px]">
                      <li>• Person–Job Fit Theory (Kristof-Brown, 2005)</li>
                      <li>• Self-Determination Theory (Deci & Ryan, 2000)</li>
                      <li>• Strengths-Based Performance Research (Clifton & Harter, Gallup)</li>
                      <li>• Cognitive Load and Decision-Making Models (Kahneman, 2011)</li>
                    </ul>
                  </div>
                  <div className="rounded-[18px] border border-[#4092C5] bg-white p-[24px] text-[13px] leading-[28px] text-[#313C52]">
                    <p>These frameworks consistently show that:</p>
                    <ul className="mt-[10px] space-y-[4px]">
                      <li>• Individuals perform best when working in areas of natural cognitive and behavioural preference.</li>
                      <li>• Sustained performance declines when individuals operate outside these zones for extended periods.</li>
                      <li>• Teams perform optimally when complementary strengths are distributed, not duplicated.</li>
                    </ul>
                  </div>
                </div>
                <p className="mt-[18px] text-[13px] leading-[28px] text-[#313C52]">
                  The RHYTHM model translates these principles into six observable workplace drivers, providing a practical lens for understanding how individuals contribute to team performance and project execution.
                </p>
              </WhiteCard>

              <WhiteCard className="mt-[22px] p-[24px]">
                <h3 className="text-[14px] font-bold leading-[22px] text-[#111828]">
                  Driver Categories and Performance Energy
                </h3>
                <p className="mt-[14px] text-[13px] leading-[28px] text-[#313C52]">
                  Each driver operates across three levels:
                </p>
                <div className="mt-[22px] grid gap-[18px] md:grid-cols-3">
                  <div className="rounded-[12px] border border-[#16A34A] bg-green-50 p-[24px] text-[13px] leading-[28px] text-[#313C52]">
                    <h4 className="text-[15px] font-bold text-[#16A34A]">Flow Drivers</h4>
                    <div className="mt-[4px] font-bold text-[#16A34A]">(High Energy / High Alignment)</div>
                    <p className="mt-[14px]">These represent areas of natural alignment between:</p>
                    <ul className="mt-[8px] space-y-[4px]">
                      <li>• Cognitive preference</li>
                      <li>• Behavioural tendency</li>
                      <li>• Motivational energy</li>
                    </ul>
                    <p className="mt-[14px]">Research shows that individuals working in these zones experience:</p>
                    <ul className="mt-[8px] space-y-[4px]">
                      <li>• Higher engagement</li>
                      <li>• Faster decision-making</li>
                      <li>• Greater resilience under pressure</li>
                    </ul>
                  </div>
                  <div className="rounded-[12px] border border-[#F59E0B] bg-amber-50 p-[24px] text-[13px] leading-[28px] text-[#313C52]">
                    <h4 className="text-[15px] font-bold text-[#F59E0B]">Stabilising Drivers</h4>
                    <div className="mt-[4px] font-bold text-[#F59E0B]">(Moderate Energy / Adaptive Use)</div>
                    <p className="mt-[14px]">These drivers sit within an individual's functional capability but are not intrinsically energising.</p>
                    <p className="mt-[14px]">They are associated with:</p>
                    <ul className="mt-[8px] space-y-[4px]">
                      <li>• Learned behaviours</li>
                      <li>• Situational adaptability</li>
                      <li>• Role-based necessity</li>
                    </ul>
                    <p className="mt-[14px]">While useful, over-reliance can lead to:</p>
                    <ul className="mt-[8px] space-y-[4px]">
                      <li>• Reduced engagement</li>
                      <li>• Increased cognitive effort</li>
                    </ul>
                  </div>
                  <div className="rounded-[12px] border border-[#BC1823] bg-red-50 p-[24px] text-[13px] leading-[28px] text-[#313C52]">
                    <h4 className="text-[15px] font-bold text-[#BC1823]">Frustration Drivers</h4>
                    <div className="mt-[4px] font-bold text-[#BC1823]">(Low Energy / High Effort)</div>
                    <p className="mt-[14px]">These represent areas of misalignment between natural preference and required behaviour. Operating in these areas consistently is linked to:</p>
                    <ul className="mt-[8px] space-y-[4px]">
                      <li>• Cognitive fatigue</li>
                      <li>• Reduced performance quality</li>
                      <li>• Increased stress and disengagement</li>
                    </ul>
                    <p className="mt-[14px]">These are not weaknesses, but energy-draining zones.</p>
                  </div>
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
              <EnergyMatrixSection
                profileCode={profileCode}
                profileName={profileName}
                blocks={profileContent.energyMatrix}
              />
            </Card>

            <Card>
              <SectionHeader
                title="Team Role Fit"
                icon={REPORT_ASSETS.icons.teamRoleFit}
              />
              <TeamRoleFitSection profileContent={profileContent} />
            </Card>

            <Card>
              <SectionHeader
                title="Your Value Creation Pathway"
                icon={REPORT_ASSETS.icons.valueCreationPathway}
              />
              <ValueCreationPathwaySection profileContent={profileContent} />
            </Card>

            <Card>
              <SectionHeader
                title="Collaboration Tips"
                icon={REPORT_ASSETS.icons.collaborationTips}
              />
              <CollaborationTipsSection profileContent={profileContent} />
            </Card>

            <Card>
              <SectionHeader
                title="Development Recommendations"
                icon={REPORT_ASSETS.icons.developmentRecommendations}
              />
              <DevelopmentRecommendationsSection profileContent={profileContent} />
            </Card>

            <Card>
              <SectionHeader
                title="What Could Be Holding You Back?"
                icon={REPORT_ASSETS.icons.whatsHoldingYouBack}
              />
              <HoldingBackSection profileContent={profileContent} />
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
                    button={pdfBusy ? "Preparing..." : GENERIC_CONTENT.nextSteps.cards[0].button}
                    onClick={handleDownloadPdf}
                    disabled={pdfBusy}
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
