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
type ProfileLabel = { code: string; name: string; frequency_code?: FrequencyCode | null };

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
    secondary_profile?: (ProfileLabel & { pct: number; short_code: string }) | null;
    tertiary_profile?: (ProfileLabel & { pct: number; short_code: string }) | null;
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

const FREQUENCY_COPY: Record<FrequencyCode, { title: string; description: string; focus: string; strength: string; blindSpot: string }> = {
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

const PROFILE_COPY: Record<string, { title: string; role: string; summary: string; coreTraits: string; idealEnvironment: string; famous?: string }> = {
  PROFILE_1: {
    title: "The Visionary",
    role: "Strategist",
    summary:
      "Visionaries see possibilities before others do. They bring bold ideas, challenge the status quo, and drive future-focused thinking.",
    coreTraits: "Future-focused, imaginative, strategic, opportunity-driven",
    idealEnvironment: "Open, innovative environments with room to explore ideas",
  },
  PROFILE_2: {
    title: "The Catalyst",
    role: "Spark",
    summary:
      "Catalysts build momentum and belief. They energise people and ideas, especially in early-stage projects and change efforts.",
    coreTraits: "Energetic, persuasive, expressive, action-oriented",
    idealEnvironment: "Fast-moving, people-centred environments that need momentum",
  },
  PROFILE_3: {
    title: "The Motivator",
    role: "Heart",
    summary:
      "Motivators uplift, engage, and build emotional connection. They keep morale high and help others feel seen and valued.",
    coreTraits: "Empathetic, encouraging, expressive, people-first",
    idealEnvironment: "Relational teams where motivation, culture, and care matter",
  },
  PROFILE_4: {
    title: "The Connector",
    role: "Bridge",
    summary:
      "Connectors bring people together through empathy, timing, and intuition. They translate relationships into shared movement and practical alignment.",
    coreTraits: "Empathetic, observant, timing-sensitive, trusted, intuitive communicator",
    idealEnvironment: "Collaborative, values-driven teams with responsive leadership",
    famous: "Michelle Obama, Satya Nadella, Angela Merkel, Malala Yousafzai",
  },
  PROFILE_5: {
    title: "The Facilitator",
    role: "Grounder",
    summary:
      "Facilitators provide stability, rhythm, and calm presence. They create safety, hold space, and help groups move with steadiness.",
    coreTraits: "Calm, inclusive, steady, intuitive, supportive",
    idealEnvironment: "Teams that need presence, trust, inclusion, and grounded pacing",
  },
  PROFILE_6: {
    title: "The Coordinator",
    role: "Planner",
    summary:
      "Coordinators thrive on execution and operational clarity. They track timelines, manage deliverables, and turn plans into outcomes.",
    coreTraits: "Organised, reliable, structured, practical, delivery-focused",
    idealEnvironment: "Operational settings where planning, consistency, and delivery matter",
  },
  PROFILE_7: {
    title: "The Controller",
    role: "Analyst",
    summary:
      "Controllers bring accuracy, logic, and accountability. They spot failure points early and protect the integrity of work.",
    coreTraits: "Precise, analytical, rigorous, careful, accountable",
    idealEnvironment: "Technical, regulatory, quality-control, or detail-sensitive environments",
  },
  PROFILE_8: {
    title: "The Optimiser",
    role: "Refiner",
    summary:
      "Optimisers improve systems, processes, and outcomes. They quietly enhance what exists so it performs better and lasts longer.",
    coreTraits: "Systems-minded, reflective, improvement-focused, strategic",
    idealEnvironment: "Settings where refinement, process improvement, and long-term performance matter",
  },
};

const DRIVER_COPY: Record<RhythmDriverKey, {
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
}> = {
  resourceful: {
    letter: "R",
    label: "Resourceful",
    short: "Solves problems quickly with practical solutions.",
    definition:
      "The ability to generate practical, effective solutions quickly, particularly in dynamic or uncertain environments.",
    research: ["Linked to adaptive performance theory", "Associated with problem-solving agility and fluid intelligence"],
    flow: ["Rapidly identifies workable solutions under pressure", "Comfortable making decisions with incomplete information", "Prioritises progress and momentum over perfection"],
    stabilising: ["Can solve problems effectively when required", "Prefers some structure or clarity before acting", "May take slightly longer to commit to decisions"],
    frustration: ["Experiences discomfort in ambiguity", "Hesitates without clear information or direction", "Avoids rapid decision-making environments"],
    impact: ["Drives momentum in teams", "Prevents stagnation", "Critical in early-stage problem solving"],
    thrives: "Fast-moving environments, ambiguous situations, crisis or change scenarios",
  },
  human_centred: {
    letter: "H",
    label: "Human-Centred",
    short: "Builds trust, connection, and team alignment.",
    definition:
      "The ability to understand, connect with, and influence others to build trust, alignment, and collaboration.",
    research: ["Rooted in Emotional Intelligence theory", "Linked to social awareness and relationship management competencies"],
    flow: ["Intuitively reads emotional dynamics within teams", "Builds strong interpersonal trust", "Aligns individuals toward shared outcomes"],
    stabilising: ["Can engage and support others when required", "Balances relational and task-based priorities"],
    frustration: ["Finds emotional engagement draining", "Prioritises outcomes over relationships", "May struggle with interpersonal conflict resolution"],
    impact: ["Strengthens team cohesion", "Reduces conflict", "Improves communication effectiveness"],
    thrives: "Leadership roles, team facilitation, stakeholder management",
  },
  yielding: {
    letter: "Y",
    label: "Yielding",
    short: "Adapts, flexes, and supports changing needs.",
    definition:
      "The ability to remain flexible, adaptable, and responsive to changing environments, perspectives, and priorities.",
    research: ["Connected to cognitive flexibility", "A key component of learning agility"],
    flow: ["Adapts quickly to change", "Open to alternative viewpoints", "Comfortable shifting direction as needed"],
    stabilising: ["Can adapt when necessary", "Prefers some consistency or predictability"],
    frustration: ["Resists change", "Prefers control and stability", "Struggles in fluid or undefined environments"],
    impact: ["Enables agility within teams", "Reduces resistance to change", "Supports collaboration across styles"],
    thrives: "Dynamic environments, cross-functional teams, evolving project scopes",
  },
  tactical: {
    letter: "T",
    label: "Tactical",
    short: "Prioritises, structures, and executes effectively.",
    definition: "The ability to structure, prioritise, and execute work in a focused and efficient manner.",
    research: ["Linked to executive functioning", "Strong correlation with goal-setting theory"],
    flow: ["Breaks complex work into actionable steps", "Prioritises effectively under pressure", "Drives execution and delivery"],
    stabilising: ["Can organise and prioritise when needed", "Does not naturally default to structure"],
    frustration: ["Avoids planning or structure", "Becomes overwhelmed by complexity", "Struggles with prioritisation"],
    impact: ["Ensures work gets completed", "Maintains focus on outcomes", "Drives accountability"],
    thrives: "Operations, project management, delivery-focused roles",
  },
  hopeful: {
    letter: "H",
    label: "Hopeful",
    short: "Drives belief, energy, and forward momentum.",
    definition:
      "The ability to maintain optimism, belief, and forward momentum, particularly in challenging or uncertain situations.",
    research: ["Linked to Psychological Capital", "Includes elements of hope, resilience, and optimism"],
    flow: ["Maintains positive outlook under pressure", "Encourages and motivates others", "Sustains momentum during setbacks"],
    stabilising: ["Can remain positive when required", "Not a natural source of energy for others"],
    frustration: ["Focuses on risks and problems", "Finds it difficult to maintain optimism", "Drained by the need to motivate others"],
    impact: ["Sustains morale", "Reduces burnout in teams", "Drives long-term persistence"],
    thrives: "Challenging moments, morale building, change journeys, resilience work",
  },
  measured: {
    letter: "M",
    label: "Measured",
    short: "Applies logic, process, and consistency.",
    definition:
      "The ability to apply logic, structure, and systems to ensure consistency, quality, and informed decision making.",
    research: ["Connected to analytical reasoning and decision-making models", "Aligns with systematic thinking and risk management frameworks"],
    flow: ["Uses data and evidence to guide decisions", "Builds systems and processes", "Ensures accuracy and quality"],
    stabilising: ["Can apply structure when needed", "Does not rely on it consistently"],
    frustration: ["Avoids structured approaches", "Makes reactive or inconsistent decisions", "Struggles with detail and accuracy"],
    impact: ["Creates stability", "Reduces risk", "Ensures consistency and quality"],
    thrives: "Compliance, finance, strategy, analysis, process and quality work",
  },
};

const GROUP_COPY: Record<DriverGroup, { label: string; heading: string; color: string; bg: string; border: string; text: string }> = {
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

const REPORT_ASSETS = {
  logo: "/org-graphics/tp-logo.png",
  chandell: "/org-graphics/tp-chandell.png",
  frameworkVisual: "/org-graphics/tp-framework-visual.png",
  frequencyWheel: "/org-graphics/tp-frequency-wheel.png",
  rhythmPuzzle: "/org-graphics/rhythm-puzzle.png",
  icons: {
    welcome: "/icons/tp-welcome-from-chandell.png",
    howToUse: "/icons/tp-how-to-use-report.png",
    ideas: "/icons/tp-ideas.png",
    naturalContribution: "/icons/tp-natural-contribution.png",
    nextSteps: "/icons/tp-next-steps.png",
    personalityMap: "/icons/tp-personality-map.png",
    profileInDepth: "/icons/tp-profile-in-depth.png",
    profileMix: "/icons/tp-profile-mix.png",
    strategicMap: "/icons/tp-strategic-map.png",
    structure: "/icons/tp-structure.png",
    teamRoleFit: "/icons/tp-team-role-fit.png",
    valueCreationPathway: "/icons/tp-value-creation-pathway.png",
    whatsHoldingYouBack: "/icons/tp-whats-holding-you-back.png",
  },
} as const;

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function fullName(taker: ReportData["taker"]) {
  return [taker.first_name, taker.last_name].map((x) => String(x || "").trim()).filter(Boolean).join(" ") || "Participant";
}

function formatDate(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function profileCodeToShort(code: string) {
  const m = String(code || "").match(/(\d+)/);
  return m ? `P${m[1]}` : code;
}

function topProfileImage(profileName?: string | null) {
  const cleaned = String(profileName || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes("visionary")) return "/profile-cards/tp-visionary.png";
  if (cleaned.includes("catalyst")) return "/profile-cards/tp-catalyst.png";
  if (cleaned.includes("motivator")) return "/profile-cards/tp-motivator.png";
  if (cleaned.includes("connector")) return "/profile-cards/tp-connector.png";
  if (cleaned.includes("facilitator")) return "/profile-cards/tp-facilitator.png";
  if (cleaned.includes("coordinator")) return "/profile-cards/tp-coordinator.png";
  if (cleaned.includes("controller")) return "/profile-cards/tp-controller.png";
  if (cleaned.includes("optimiser") || cleaned.includes("optimizer")) return "/profile-cards/tp-optimiser.png";
  return null;
}

function ReportAssetImage(props: { src: string; alt: string; className?: string }) {
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

function Card(props: { children: ReactNode; className?: string }) {
  return <section className={cls("rounded-3xl border border-white/10 bg-[#0C203A]/80 p-5 shadow-2xl shadow-black/20", props.className)}>{props.children}</section>;
}

function WhiteCard(props: { children: ReactNode; className?: string }) {
  return <div className={cls("rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm", props.className)}>{props.children}</div>;
}

function SectionHeader(props: { eyebrow?: string; title: string; icon?: string }) {
  const iconIsImage = typeof props.icon === "string" && props.icon.startsWith("/");

  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-300/20 bg-blue-400/10 text-lg">
        {iconIsImage ? (
          <ReportAssetImage src={props.icon || ""} alt="" className="h-full w-full object-cover" />
        ) : (
          props.icon || "✉"
        )}
      </div>
      <div>
        {props.eyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">{props.eyebrow}</div> : null}
        <h2 className="text-lg font-semibold text-white">{props.title}</h2>
      </div>
    </div>
  );
}

function StatPill(props: { children: ReactNode; tone?: "green" | "blue" | "white" }) {
  const tone = props.tone || "white";
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "green" && "border-green-400/30 bg-green-400/10 text-green-300",
        tone === "blue" && "border-sky-400/30 bg-sky-400/10 text-sky-200",
        tone === "white" && "border-white/15 bg-white/10 text-white"
      )}
    >
      {props.children}
    </span>
  );
}

function FrequencyChart(props: { labels: FrequencyLabel[]; percentages: Record<FrequencyCode, number> }) {
  const colors: Record<FrequencyCode, string> = {
    A: "bg-red-500",
    B: "bg-amber-500",
    C: "bg-emerald-500",
    D: "bg-blue-500",
  };
  const labels = props.labels?.length ? props.labels : [
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
          <p className="mt-1 text-sm text-slate-600">The behavioural energy you use most often.</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {labels.map((item) => {
          const pct = clamp(props.percentages?.[item.code] || 0);
          return (
            <div key={item.code} className="flex flex-col items-center gap-2">
              <div className="text-xs font-bold text-slate-600">{pct}%</div>
              <div className="relative h-56 w-full max-w-[78px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className={cls("absolute bottom-0 left-0 right-0", colors[item.code])} style={{ height: `${pct}%` }} />
              </div>
              <div className="text-sm font-bold text-slate-900">{item.code}</div>
              <div className="text-center text-[11px] leading-tight text-slate-600">{item.name} ({item.code})</div>
            </div>
          );
        })}
      </div>
    </WhiteCard>
  );
}

function ProfileRadar(props: { labels: ProfileLabel[]; percentages: Record<string, number> }) {
  const labels = props.labels?.length ? props.labels : [];
  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 205;
  const max = 50;

  function point(i: number, valuePct: number) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = radius * clamp(valuePct, 0, max) / max;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  function axisPoint(i: number, multiplier = 1) {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = radius * multiplier;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  const points = labels.map((label, i) => point(i, props.percentages?.[label.code] || 0));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <WhiteCard>
      <h3 className="text-base font-semibold">Your Personality Map (Profile)</h3>
      <p className="mt-1 text-sm text-slate-600">Higher values show patterns you use more often.</p>
      <div className="mt-4 flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {labels.length ? (
          <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-[520px]">
            {[10, 20, 30, 40, 50].map((ring) => (
              <polygon
                key={ring}
                points={labels.map((_, i) => point(i, ring)).map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="rgba(15,23,42,0.12)"
              />
            ))}
            {labels.map((label, i) => {
              const p = axisPoint(i, 1);
              const t = axisPoint(i, 1.17);
              return (
                <g key={label.code}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(15,23,42,0.12)" />
                  <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="rgba(15,23,42,0.62)">
                    {`${profileCodeToShort(label.code)}: ${label.name}`}
                  </text>
                </g>
              );
            })}
            <path d={path} fill="rgba(64,146,197,0.18)" stroke="#4092C5" strokeWidth="3" />
            {labels.map((label, i) => {
              const pct = props.percentages?.[label.code] || 0;
              const p = point(i, pct);
              const t = axisPoint(i, 0.75);
              return (
                <g key={`${label.code}-point`}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#084595" />
                  {pct > 0 ? <text x={t.x} y={t.y} textAnchor="middle" fontSize="11" fill="#334155">{pct}%</text> : null}
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="py-10 text-sm text-slate-500">No profile labels found.</div>
        )}
      </div>
    </WhiteCard>
  );
}

function DriverTile(props: { driver: RhythmDriverKey; group?: DriverGroup }) {
  const d = DRIVER_COPY[props.driver];
  const group = props.group ? GROUP_COPY[props.group] : null;
  return (
    <div className={cls("rounded-2xl border p-4", group ? `${group.bg} ${group.border}` : "border-white/10 bg-white/5")}>
      <div className="text-4xl font-bold" style={{ color: group?.color || "#60A5FA" }}>{d.letter}</div>
      <div className={cls("mt-2 text-base font-bold", group ? group.text : "text-white")}>{d.label}</div>
      <p className={cls("mt-2 text-sm leading-6", group ? "text-slate-700" : "text-white/75")}>{d.short}</p>
    </div>
  );
}

function DriverDetailCard(props: { driver: RhythmDriverKey; group: DriverGroup }) {
  const d = DRIVER_COPY[props.driver];
  const g = GROUP_COPY[props.group];
  const expression = props.group === "flow" ? d.flow : props.group === "stabilising" ? d.stabilising : d.frustration;

  return (
    <div className={cls("overflow-hidden rounded-2xl border bg-white", g.border)}>
      <div className="flex gap-4 p-5 text-white" style={{ backgroundColor: g.color }}>
        <div className="text-4xl font-bold leading-none">{d.letter}</div>
        <div>
          <h4 className="text-xl font-bold">{d.label}</h4>
          <p className="mt-1 text-sm text-white/90">{g.label} · {d.definition}</p>
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <InfoList title="Research Alignment" items={d.research} tone={props.group} />
        <InfoList title={`${g.label} Expression`} items={expression} tone={props.group} />
        <InfoList title="Workplace Impact" items={d.impact} tone={props.group} />
        <div className={cls("rounded-xl border p-4", g.bg, g.border)}>
          <div className={cls("text-xs font-bold uppercase tracking-wide", g.text)}>Best used in</div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{d.thrives}</p>
        </div>
      </div>
    </div>
  );
}

function InfoList(props: { title: string; items: string[]; tone: DriverGroup }) {
  const g = GROUP_COPY[props.tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className={cls("text-xs font-bold uppercase tracking-wide", g.text)}>{props.title}</div>
      <ul className="mt-3 space-y-2">
        {props.items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
            <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntroTextBlock(props: { title: string; children: ReactNode; icon?: string }) {
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
  const items = [
    ["Start with curiosity", "Read through the full report to understand your natural energy and profile."],
    ["Use it in real time", "Bring it to meetings, planning sessions, coaching conversations, or reviews."],
    ["Share it", "Invite your team, coach, or leader to explore the insights with you."],
    ["Implement gradually", "Start with one recommendation, test it, then layer in more."],
    ["Check back often", "As you grow, how you express your profile will continue to mature."],
  ];

  return (
    <Card>
      <SectionHeader title="How to Use This Report" icon={REPORT_ASSETS.icons.howToUse} />
      <WhiteCard>
        <p className="text-sm leading-7 text-slate-700">
          Think of this report as your personal blueprint for working smarter, not harder. It is more than a profile; it is a practical manual for doing your best work, building stronger relationships, and creating long-term impact.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {items.map(([title, body], index) => (
            <div key={title} className="rounded-2xl bg-[#084595] p-4 text-white">
              <div className="text-2xl font-bold text-white/60">{index + 1}</div>
              <div className="mt-3 text-sm font-bold">{title}</div>
              <p className="mt-2 text-xs leading-5 text-white/80">{body}</p>
            </div>
          ))}
        </div>
      </WhiteCard>
    </Card>
  );
}

function ProfileList(props: { profiles: Array<ProfileLabel & { pct?: number; short_code?: string }>; activeCode?: string }) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
      {props.profiles.map((p, index) => {
        const active = p.code === props.activeCode;
        return (
          <div key={p.code} className={cls("flex items-center gap-3 rounded-xl border p-3", active ? "border-green-400/40 bg-green-400/15" : "border-white/10 bg-white/[0.03]")}>
            <span className={cls("w-5 text-xs font-bold", active ? "text-green-300" : "text-white/40")}>{index + 1}</span>
            <span className={cls("h-2 w-2 rounded-full", active ? "bg-green-400" : "bg-sky-200/60")} />
            <div className="min-w-0 flex-1">
              <div className={cls("text-sm font-semibold", active ? "text-green-300" : "text-white")}>{p.name}</div>
            </div>
            <span className="text-xs text-white/45">{p.frequency_code ? `${FREQUENCY_COPY[p.frequency_code]?.title.replace(" Frequency", "")} (${p.frequency_code})` : ""}</span>
            {active ? <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">You</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function NextStepCard(props: { title: string; body: string; button: string; href?: string | null; primary?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100"><ReportAssetImage src={REPORT_ASSETS.icons.nextSteps} alt="Next steps" className="h-full w-full object-cover" /></div>
      <h4 className="mt-4 font-semibold text-slate-800">{props.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.body}</p>
      {props.href ? (
        <button
          type="button"
          onClick={() => window.open(props.href || "#", "_blank", "noopener,noreferrer")}
          className={cls(
            "mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold",
            props.primary ? "bg-slate-900 text-white hover:bg-slate-700" : "border border-slate-900 text-slate-900 hover:bg-slate-50"
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

export default function TeamPuzzleRhythmReportClient(props: { token: string; tid: string; src?: string }) {
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

        const res = await fetch(`/api/public/test/${encodeURIComponent(token)}/team-puzzle-rhythm-report?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ReportAPI;
        if (!res.ok || !json.ok || !json.data) throw new Error(json.error || `HTTP ${res.status}`);
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
      summary: "Your profile describes how you most naturally create value inside a team.",
      coreTraits: "Natural strengths, working energy, contribution style",
      idealEnvironment: "A role and environment that lets you use your strengths consistently",
    };

    const topFreq = data.result.top_freq;
    const topFreqName = data.result.top_freq_name || topFreq;
    const sortedProfiles = data.result.sorted_profiles || [];
    const primary = sortedProfiles[0] || null;
    const secondary = sortedProfiles[1] || data.result.secondary_profile || null;
    const tertiary = sortedProfiles[2] || data.result.tertiary_profile || null;

    const rhythm = data.rhythm;
    const flow = rhythm?.flow_drivers?.length ? rhythm.flow_drivers : ["resourceful", "human_centred"] as RhythmDriverKey[];
    const stabilising = rhythm?.stabilising_drivers?.length ? rhythm.stabilising_drivers : ["yielding", "tactical"] as RhythmDriverKey[];
    const frustration = rhythm?.frustration_drivers?.length ? rhythm.frustration_drivers : ["hopeful", "measured"] as RhythmDriverKey[];

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
          <p className="mt-4 text-sm text-slate-300">This report needs a taker ID in the URL. Please open it from the completed assessment or portal profile.</p>
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
          <p className="text-sm text-red-300">Could not load the report. Please refresh or contact support.</p>
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

  const { participantName, orgName, profileName, profileCode, profileCopy, topFreq, topFreqName, sortedProfiles, primary, secondary, tertiary, flow, stabilising, frustration, heroImage, nextStepsUrl, date } = derived;
  const topFreqCopy = FREQUENCY_COPY[topFreq];

  return (
    <div ref={reportRef} className="relative min-h-screen overflow-hidden bg-[#061A3A] text-white">
      <AppBackground />
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 12% 12%, rgba(79,125,255,0.22), transparent 35%), radial-gradient(circle at 86% 18%, rgba(69,224,209,0.12), transparent 32%), radial-gradient(circle at 50% 90%, rgba(139,92,246,0.10), transparent 36%)" }} />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                  <ReportAssetImage src={REPORT_ASSETS.logo} alt="Life Puzzle" className="h-full w-full object-cover" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Team Puzzle Discovery Report</div>
                  <div className="text-2xl font-bold uppercase tracking-[0.14em] md:text-4xl">Personalised Profile</div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-[0.28em] text-white/60">Life Puzzle</div>
                </div>
              </div>
              <div className="mt-4 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">powered by profiletest.ai</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[560px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Prepared for</div>
                <div className="mt-1 font-semibold">{participantName}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Date</div>
                <div className="mt-1 font-semibold">{date}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Framework</div>
                <div className="mt-1 font-semibold">Team Puzzle RHYTHM Edition</div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={handleDownloadPdf} className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Download PDF</button>
            {nextStepsUrl ? (
              <button type="button" onClick={() => window.open(nextStepsUrl, "_blank", "noopener,noreferrer")} className="rounded-lg bg-gradient-to-r from-[#45E0D1] via-[#4F7DFF] to-[#8B5CF6] px-4 py-2 text-sm font-bold text-[#071C36]">Next steps</button>
            ) : null}
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">Team Puzzle Profile</div>
            <h1 className="mt-3 text-4xl font-bold md:text-6xl">{participantName}</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/80">How the four behavioural energies show up in you, and your pattern to a more fearless way of being.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <StatPill tone="blue">Profile: {profileName}</StatPill>
              <StatPill tone="green">{topFreqName} ({topFreq})</StatPill>
              <StatPill>Organisation: {data.taker.company || orgName}</StatPill>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Driver</div>
                <div className="mt-2 text-2xl font-bold">{topFreqName} ({topFreq})</div>
                <p className="mt-3 text-sm leading-6 text-white/60">{topFreqCopy?.description}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Top Profile</div>
                <div className="mt-2 text-2xl font-bold">{profileName}</div>
                <p className="mt-3 text-sm leading-6 text-white/60">A distinct working pattern that describes how you most naturally create value.</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <ProfileList profiles={sortedProfiles} activeCode={profileCode} />
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <h2 className="text-lg font-semibold">Profile mix</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[primary, secondary, tertiary].filter(Boolean).map((p: any, index) => (
                <div key={p.code} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/45">{index === 0 ? "Primary" : index === 1 ? "Secondary" : "Tertiary"}</div>
                  <div className="mt-2 text-2xl font-bold">{p.name}</div>
                  <div className="mt-1 text-sm text-white/55">{p.short_code || profileCodeToShort(p.code)} · {p.pct}%</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Professional Performance Rhythm</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["resourceful", "hopeful", "yielding", "tactical", "human_centred", "measured"] as RhythmDriverKey[]).map((driver) => (
                <DriverTile key={driver} driver={driver} />
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <FrequencyChart labels={data.result.frequency_labels} percentages={data.result.frequency_percentages} />
          <ProfileRadar labels={data.result.profile_labels} percentages={data.result.profile_percentages} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-[#0C203A]/80 p-5 shadow-2xl shadow-black/20 lg:sticky lg:top-4">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Report Index</div>
            <ol className="mt-4 space-y-2 text-sm leading-6 text-white/80">
              {["Welcome from Chandell", "How to use this report", "Team Puzzle Framework", "Four Frequencies & Eight Profiles", "Frequency summary", "Profile mix", `Your profile in depth: ${profileName}`, "Professional Performance Rhythm", "The 3-Level Energy Model", "Your Professional Performance Rhythm", "Energy mix", "Team Role Fit", "Your Value Creation Pathway", "Collaboration Tips", "Development Recommendations", "What Could Be Holding You Back?", "Your Next Steps"].map((item, index) => (
                <li key={item}><span className="text-white/40">{index + 1}.</span> {item}</li>
              ))}
            </ol>
          </aside>

          <div className="space-y-8">
            <IntroTextBlock title="Welcome from Chandell" icon={REPORT_ASSETS.icons.welcome}>
              <p>Welcome to your Team Puzzle Discovery Report. I am so excited to be part of your journey as you uncover your natural strengths, communication style, and best-fit contribution in the workplace.</p>
              <p>Team Puzzle was created to help people understand themselves and each other more deeply. When this happens, the entire culture shifts, results improve, engagement increases, and people are genuinely more fulfilled.</p>
              <p>Whether you are reading this as part of a leadership team, a coaching session, or a personal development journey, treat this insight as a starting point: a map for growth, alignment, and leadership that reflects your natural style.</p>
              <div className="not-prose mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <ReportAssetImage src={REPORT_ASSETS.chandell} alt="Chandell Labbozzetta" className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
                <p className="m-0 text-sm leading-7 text-slate-700"><strong>Warm regards<br />Chandell Labbozzetta</strong><br />CEO of Life Puzzle, and Creator of the Team Puzzle Discovery Assessment</p>
              </div>
            </IntroTextBlock>

            <HowToUseCards />

            <IntroTextBlock title="Introducing the Team Puzzle Framework" icon={REPORT_ASSETS.icons.ideas}>
              <p>High-performing teams do not happen by accident. They are built with intention, structure, and insight. The Team Puzzle Framework bridges the gap between untapped human potential and practical business results.</p>
              <p>At its core, Team Puzzle helps organisations answer one fundamental question: <em>How do we get the best from each individual, and even better results from the team as a whole?</em></p>
              <p>The Team Puzzle approach is not about fixing people. It is about fitting people together. Each person has a unique shape and contribution, and the goal is to help teams see how those pieces connect.</p>
              <div className="not-prose mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <ReportAssetImage src={REPORT_ASSETS.frameworkVisual} alt="Team Puzzle framework visual" className="w-full object-contain" />
              </div>
            </IntroTextBlock>

            <Card>
              <SectionHeader title="Understanding the Four Frequencies & Eight Profiles" icon={REPORT_ASSETS.icons.structure} />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                  <p className="text-sm leading-7 text-slate-700">Behind every high-performing team is a diverse mix of energy. In Team Puzzle, we call these core energy types the Frequencies: the foundational rhythms that drive how people think, operate, and contribute.</p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage src={REPORT_ASSETS.frequencyWheel} alt="Team Puzzle frequency wheel" className="mx-auto max-h-[360px] w-full object-contain" />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  {(["A", "B", "C", "D"] as FrequencyCode[]).map((code) => (
                    <div key={code} className="rounded-2xl border border-[#084595] bg-white p-4">
                      <h3 className="font-semibold text-[#084595]">{FREQUENCY_COPY[code].title} ({code})</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{FREQUENCY_COPY[code].description}</p>
                    </div>
                  ))}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="The Eight Profiles" icon={REPORT_ASSETS.icons.naturalContribution} />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">The Team Puzzle framework maps eight unique Profiles, each representing a different way of thinking, contributing, and leading.</p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {data.result.profile_labels.map((p) => {
                    const copy = PROFILE_COPY[p.code];
                    const active = p.code === profileCode;
                    return (
                      <div key={p.code} className={cls("rounded-2xl border p-4", active ? "border-green-500 bg-green-50" : "border-slate-200 bg-white") }>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-slate-900">{copy?.title || p.name}</h3>
                          {active ? <span className="rounded-full bg-green-600 px-2 py-1 text-xs font-bold text-white">Your Profile</span> : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{copy?.summary || "A distinct contribution pattern within the Team Puzzle framework."}</p>
                      </div>
                    );
                  })}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Frequency summary" icon={REPORT_ASSETS.icons.structure} />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">Your strongest overall frequency is <strong>{topFreqName} ({topFreq})</strong>, which shapes how you approach problems, make decisions, and contribute in a team.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {data.result.frequency_labels.map((f) => (
                    <div key={f.code} className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-slate-900">{f.name}</div>
                      <div className="mt-2 text-3xl font-bold text-[#084595]">{data.result.frequency_percentages[f.code] || 0}%</div>
                    </div>
                  ))}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title={`Your profile in depth: ${profileName}`} icon={REPORT_ASSETS.icons.profileInDepth} />
              <WhiteCard>
                <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{profileCopy.title} · {profileCopy.role}</h3>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{profileCopy.summary}</p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Core Traits</div><p className="mt-2 text-sm leading-6 text-slate-700">{profileCopy.coreTraits}</p></div>
                      <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ideal Environment</div><p className="mt-2 text-sm leading-6 text-slate-700">{profileCopy.idealEnvironment}</p></div>
                    </div>
                    {profileCopy.famous ? <p className="mt-5 text-sm leading-7 text-slate-700"><strong>Famous examples include:</strong> {profileCopy.famous}</p> : null}
                  </div>
                  {heroImage ? <img src={heroImage} alt={profileName} className="rounded-3xl border border-slate-200 object-cover" /> : null}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Professional Performance Rhythm" icon={REPORT_ASSETS.rhythmPuzzle} />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">Your Team Puzzle profile explains your natural energy and contribution style. Alongside this, the Professional Performance Rhythm reveals how you approach work and create results across six key drivers.</p>
                <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
                  <div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">Think of it as the tempo behind your profile — the underlying rhythm that influences the way you solve problems, collaborate, adapt, and lead.</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage src={REPORT_ASSETS.rhythmPuzzle} alt="RHYTHM puzzle visual" className="mx-auto max-h-[220px] w-full object-contain" />
                  </div>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {(["resourceful", "human_centred", "yielding", "tactical", "hopeful", "measured"] as RhythmDriverKey[]).map((driver) => <DriverTile key={driver} driver={driver} group={flow.includes(driver) ? "flow" : stabilising.includes(driver) ? "stabilising" : "frustration"} />)}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="The 3-Level Energy Model" icon={REPORT_ASSETS.icons.strategicMap} />
              <WhiteCard>
                <div className="grid gap-4 md:grid-cols-3">
                  {(["flow", "stabilising", "frustration"] as DriverGroup[]).map((group, index) => {
                    const g = GROUP_COPY[group];
                    const text = group === "flow" ? ["Where energy is highest", "Natural, effortless", "Creates momentum and impact", "Core contribution to team"] : group === "stabilising" ? ["Can use when needed", "Not energising, but not draining", "Provides balance and adaptability"] : ["Requires effort", "Draining over time", "Often avoided or resisted", "Key source of friction in teams"];
                    return (
                      <div key={group} className={cls("rounded-2xl border p-5", g.bg, g.border)}>
                        <div className={cls("text-5xl font-bold", g.text)}>{index + 1}</div>
                        <h3 className={cls("mt-4 font-bold", g.text)}>{g.heading.replace(" — Your Top 2", "").replace(" — Your Middle 2", "").replace(" — Your Bottom 2", "")}</h3>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">{text.map((x) => <li key={x}>• {x}</li>)}</ul>
                      </div>
                    );
                  })}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Your Professional Performance Rhythm" icon={REPORT_ASSETS.rhythmPuzzle} />
              <div className="space-y-6">
                <WhiteCard>
                  <h3 className="text-lg font-bold text-slate-900">{GROUP_COPY.flow.heading}</h3>
                  <div className="mt-5 space-y-5">{flow.map((driver) => <DriverDetailCard key={driver} driver={driver} group="flow" />)}</div>
                </WhiteCard>
                <WhiteCard>
                  <h3 className="text-lg font-bold text-slate-900">{GROUP_COPY.stabilising.heading}</h3>
                  <div className="mt-5 space-y-5">{stabilising.map((driver) => <DriverDetailCard key={driver} driver={driver} group="stabilising" />)}</div>
                </WhiteCard>
                <WhiteCard>
                  <h3 className="text-lg font-bold text-slate-900">{GROUP_COPY.frustration.heading}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">These are not weaknesses. They are energy-draining zones that may require support, structure, or collaboration.</p>
                  <div className="mt-5 space-y-5">{frustration.map((driver) => <DriverDetailCard key={driver} driver={driver} group="frustration" />)}</div>
                </WhiteCard>
              </div>
            </Card>

            <Card>
              <SectionHeader title="Energy mix — how your profile and RHYTHM work together" icon={REPORT_ASSETS.icons.profileMix} />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">As a <strong>{profileName}</strong>, your core contribution is shaped by {topFreqName} energy. Your RHYTHM adds another layer: it shows the conditions and behaviours that help you create results sustainably.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-green-500 bg-green-50 p-4"><div className="font-bold text-green-700">Lean into</div><p className="mt-2 text-sm text-slate-700">{flow.map((d) => DRIVER_COPY[d].label).join(" and ")} when you need momentum, confidence, and stronger contribution.</p></div>
                  <div className="rounded-2xl border border-amber-500 bg-amber-50 p-4"><div className="font-bold text-amber-700">Use consciously</div><p className="mt-2 text-sm text-slate-700">{stabilising.map((d) => DRIVER_COPY[d].label).join(" and ")} can support balance, but may require more intention.</p></div>
                  <div className="rounded-2xl border border-red-500 bg-red-50 p-4"><div className="font-bold text-red-700">Get support around</div><p className="mt-2 text-sm text-slate-700">{frustration.map((d) => DRIVER_COPY[d].label).join(" and ")} may drain energy if overused for too long.</p></div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Team Role Fit" icon={REPORT_ASSETS.icons.teamRoleFit} />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
                  <p className="text-sm leading-7 text-slate-700">Your profile gives language to your natural team role. Use this section as a Johari-style reflection: what others see clearly, what you may underplay, what you hold back, and what potential is still emerging.</p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage src={REPORT_ASSETS.icons.teamRoleFit} alt="Team role fit" className="mx-auto max-h-[160px] w-full object-contain" />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {["Open Area — visible strengths", "Blind Spot — what others may notice", "Hidden Area — what you may hold back", "Unknown Area — potential still emerging"].map((title) => (
                    <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h4 className="font-semibold text-slate-900">{title}</h4><p className="mt-2 text-sm leading-6 text-slate-700">Reflect on how your {profileName} style shows up here and what support helps you contribute with more confidence.</p></div>
                  ))}
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Your Value Creation Pathway" icon={REPORT_ASSETS.icons.valueCreationPathway} />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
                  <p className="text-sm leading-7 text-slate-700">You create value when your profile contribution and your RHYTHM drivers work together. Your strongest pathway is to use your natural contribution style while designing your work around the drivers that create energy rather than drain it.</p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage src={REPORT_ASSETS.icons.valueCreationPathway} alt="Value creation pathway" className="mx-auto max-h-[160px] w-full object-contain" />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">You deliver your best value when</h4><p className="mt-2 text-sm leading-6 text-slate-700">You work in roles and projects that let you express {profileName} strengths and your Flow Drivers.</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">You build trust when</h4><p className="mt-2 text-sm leading-6 text-slate-700">You communicate your needs clearly and help others understand your natural working rhythm.</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">You leverage value when</h4><p className="mt-2 text-sm leading-6 text-slate-700">You partner with people whose strengths complement your Frustration Drivers.</p></div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Collaboration Tips" icon={REPORT_ASSETS.icons.teamRoleFit} />
              <WhiteCard>
                <p className="text-sm leading-7 text-slate-700">You thrive in teams that respect both contribution and rhythm. Use these tips to collaborate with more awareness.</p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">Best collaborators</h4><p className="mt-2 text-sm leading-6 text-slate-700">People who bring structure, clarity, emotional intelligence, or complementary execution energy.</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">When working with fast movers</h4><p className="mt-2 text-sm leading-6 text-slate-700">Translate vision into people-aligned messages and practical next steps.</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">When working with detail thinkers</h4><p className="mt-2 text-sm leading-6 text-slate-700">Give structure, evidence, and enough clarity for them to trust the process.</p></div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Development Recommendations" icon={REPORT_ASSETS.icons.strategicMap} />
              <WhiteCard>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><h4 className="font-bold text-slate-900">To elevate performance</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>• Protect time for your Flow Drivers.</li><li>• Build simple support around your Frustration Drivers.</li><li>• Use Stabilising Drivers without over-relying on them.</li></ul></div>
                  <div><h4 className="font-bold text-slate-900">Daily anchors</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>• What gives me energy today?</li><li>• What task needs support or structure?</li><li>• Where am I pushing against my rhythm?</li></ul></div>
                  <div><h4 className="font-bold text-slate-900">Reflection prompts</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>• When do I feel most effective?</li><li>• Who complements my working rhythm?</li><li>• What should I stop carrying alone?</li></ul></div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="What Could Be Holding You Back?" icon={REPORT_ASSETS.icons.whatsHoldingYouBack} />
              <WhiteCard>
                <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:items-start">
                  <p className="text-sm leading-7 text-slate-700">Sometimes the behaviours that make you valuable can also become limiting when overused. Use this section to self-audit and rebalance.</p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <ReportAssetImage src={REPORT_ASSETS.icons.whatsHoldingYouBack} alt="What could be holding you back" className="mx-auto max-h-[160px] w-full object-contain" />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">Weekly check-in prompts</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>• What emotional or practical weight am I carrying?</li><li>• Where am I compromising too often?</li><li>• What did I notice but not say?</li></ul></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><h4 className="font-bold">Monthly calibration metrics</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>• Times I redirected confusion constructively.</li><li>• Discussions where I contributed a bridge or solution.</li><li>• One opportunity where I influenced direction without needing credit.</li></ul></div>
                </div>
              </WhiteCard>
            </Card>

            <Card>
              <SectionHeader title="Your Next Steps" icon={REPORT_ASSETS.icons.nextSteps} />
              <WhiteCard>
                <div className="grid gap-4 md:grid-cols-3">
                  <NextStepCard title="Download Your Report" body="Save a PDF copy of your Team Puzzle RHYTHM report for reference." button="Download PDF" href={null} />
                  <NextStepCard title="Discuss with Your Advisor" body="Take your insights further with a debrief session or team workshop." button="Explore Now" href={nextStepsUrl} primary />
                  <NextStepCard title="Explore Team Puzzle" body="Find more resources, join coaching communities and accelerators." button="Visit Now" href={data.org?.website_url || nextStepsUrl} />
                </div>
                <div className="mt-6 text-sm text-slate-500">Team Puzzle Assessment — RHYTHM Edition</div>
              </WhiteCard>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}