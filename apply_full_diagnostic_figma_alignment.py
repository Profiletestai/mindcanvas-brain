#!/usr/bin/env python3
"""
Apply the approved Figma structure and styling to The Inevitable Standard
Full Diagnostic Report, while preserving the diagnosis-led logic from Phase 1.

Run from the mindcanvas-brain repository root:
    python3 apply_full_diagnostic_figma_alignment.py

This script does NOT commit, push, merge, or deploy anything.
"""

from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()
FILES = {
    "engine": ROOT / "apps/web/lib/inevitable-standard/constraintEngine.ts",
    "tests": ROOT / "apps/web/lib/inevitable-standard/constraintEngine.test.ts",
    "shared": ROOT / "apps/web/app/t/[token]/report/inevitableStandardShared.tsx",
    "full": ROOT / "apps/web/app/t/[token]/full-report/InevitableStandardFullDiagnosticClient.tsx",
}


def branch_name():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return ""


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: expected exactly one source match, found {count}. No files were written."
        )
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    start_i = text.find(start)
    if start_i < 0:
        raise RuntimeError(f"{label}: start marker not found. No files were written.")
    end_i = text.find(end, start_i + len(start))
    if end_i < 0:
        raise RuntimeError(f"{label}: end marker not found. No files were written.")
    return text[:start_i] + replacement + text[end_i:]


missing = [str(p) for p in FILES.values() if not p.exists()]
if missing:
    print("Missing expected files:")
    for p in missing:
        print("  -", p)
    print("Run this script from the mindcanvas-brain repository root.")
    sys.exit(1)

branch = branch_name()
if branch and branch not in {"feature/inevitable-standard", "fix/inevitable-report-alignment"}:
    print(f"Current branch is {branch!r}.")
    print("Switch to feature/inevitable-standard (or a fix branch from it) before applying.")
    sys.exit(1)

pending = {}

# ---------------------------------------------------------------------------
# 1. Correct the Method-layer grouping to the approved Full Diagnostic:
#    Identity = Identity + Positioning
#    Structure = Offer + Revenue Model
#    Execution = Sales + Decision
# ---------------------------------------------------------------------------
engine = FILES["engine"].read_text(encoding="utf-8")
engine = replace_once(
    engine,
    """export const INEVITABLE_STANDARD_METHOD_LAYERS: readonly {
  layer: InevitableStandardMethodLayer;
  pillars: readonly InevitableStandardPillar[];
}[] = [
  { layer: "identity", pillars: ["identity"] },
  { layer: "structure", pillars: ["positioning", "offer", "revenue_model"] },
  { layer: "execution", pillars: ["sales", "decision"] },
];""",
    """export const INEVITABLE_STANDARD_METHOD_LAYERS: readonly {
  layer: InevitableStandardMethodLayer;
  pillars: readonly InevitableStandardPillar[];
}[] = [
  { layer: "identity", pillars: ["identity", "positioning"] },
  { layer: "structure", pillars: ["offer", "revenue_model"] },
  { layer: "execution", pillars: ["sales", "decision"] },
];""",
    "constraint engine Method layers",
)
pending[FILES["engine"]] = engine

tests = FILES["tests"].read_text(encoding="utf-8")
tests = replace_once(
    tests,
    '    expect(methodLayerFor("positioning")).toBe("structure");',
    '    expect(methodLayerFor("positioning")).toBe("identity");',
    "Method-layer regression test",
)
pending[FILES["tests"]] = tests

shared = FILES["shared"].read_text(encoding="utf-8")
shared = replace_once(
    shared,
    """export const METHOD_LAYERS: Array<{
  layer: "Identity" | "Structure" | "Execution";
  blurb: string;
  pillars: PillarKey[];
}> = [
  {
    layer: "Identity",
    blurb: "What the business believes it is allowed to charge and lead on.",
    pillars: ["identity"],
  },
  {
    layer: "Structure",
    blurb: "How the offer, position and revenue model are built to hold.",
    pillars: ["positioning", "offer", "revenue_model"],
  },
  {
    layer: "Execution",
    blurb: "Whether the selling and the daily decisions actually happen.",
    pillars: ["sales", "decision"],
  },
];""",
    """export const METHOD_LAYERS: Array<{
  layer: "Identity" | "Structure" | "Execution";
  blurb: string;
  pillars: PillarKey[];
}> = [
  {
    layer: "Identity",
    blurb:
      "Who this business is for, what it is worth, and whether the owner can hold the commercial weight of it. When this layer is unclear, everything downstream is negotiated rather than decided.",
    pillars: ["identity", "positioning"],
  },
  {
    layer: "Structure",
    blurb:
      "How value is packaged and how money is designed to behave once it arrives. This is the layer that determines whether revenue becomes profit.",
    pillars: ["offer", "revenue_model"],
  },
  {
    layer: "Execution",
    blurb:
      "What actually happens in the room and how commercial choices get made. This is the layer most people try to fix first, and the layer that depends most on the other two.",
    pillars: ["sales", "decision"],
  },
];""",
    "shared Method layers",
)
shared = replace_once(
    shared,
    """export const REVENUE_CHAIN: Array<{ label: string; blurb: string }> = [
  { label: "Revenue", blurb: "What the business brings in." },
  { label: "Profit", blurb: "What it keeps after it has been fed." },
  { label: "Personal Wealth", blurb: "What that profit builds for the owner." },
  { label: "Freedom", blurb: "The choice and time that wealth is meant to buy." },
];""",
    """export const REVENUE_CHAIN: Array<{ label: string; blurb: string }> = [
  {
    label: "Revenue",
    blurb: "Money arriving in the business. The most visible measure, and the least complete.",
  },
  {
    label: "Profit",
    blurb: "What the structure of the business allows you to keep once delivery is paid for.",
  },
  {
    label: "Personal Wealth",
    blurb: "Whether retained profit creates value that exists beyond the business itself.",
  },
  {
    label: "Freedom",
    blurb: "Whether the business is building greater choice for the person who owns it.",
  },
];""",
    "Revenue-to-Freedom copy",
)
shared = replace_once(
    shared,
    """export const METHOD_LAYER_LABEL: Record<
  PillarKey,
  "Identity" | "Structure" | "Execution"
> = {
  identity: "Identity",
  positioning: "Structure",
  offer: "Structure",
  revenue_model: "Structure",
  sales: "Execution",
  decision: "Execution",
};""",
    """export const METHOD_LAYER_LABEL: Record<
  PillarKey,
  "Identity" | "Structure" | "Execution"
> = {
  identity: "Identity",
  positioning: "Identity",
  offer: "Structure",
  revenue_model: "Structure",
  sales: "Execution",
  decision: "Execution",
};""",
    "shared Method-layer labels",
)
pending[FILES["shared"]] = shared

# ---------------------------------------------------------------------------
# 2. Full Diagnostic visual / information architecture alignment
# ---------------------------------------------------------------------------
full = FILES["full"].read_text(encoding="utf-8")

# Remove the Figma-nonexistent Revenue-in-Structure panel from this report.
full = full.replace("  RevenueInStructurePanel,\n", "", 1)
full = full.replace("    const revenueInStructure = score.revenue_in_structure ?? null;\n", "", 1)
full = full.replace("      revenueInStructure,\n", "", 1)
full = full.replace("    revenueInStructure,\n", "", 1)

# Add approved report assets and exact pillar questions.
anchor = """const CHAPTER_SECTIONS: Array<{
  key: InevitableStandardContentSection;
  heading: string;
}> = [
  { key: "what_this_means", heading: "What This Result Means" },
  { key: "what_appears_working", heading: "What Appears to Be Working" },
  { key: "where_leaking", heading: "Where Value May Currently Be Leaking" },
  { key: "pathway_impact", heading: "How This Affects Your Revenue-To-Freedom Pathway" },
  { key: "focus_now", heading: "What to Focus On Now" },
  { key: "what_to_watch", heading: "What to Watch" },
  { key: "progress_looks_like", heading: "What Progress Should Look Like" },
];"""
assets = anchor + """

const PILLAR_ICON: Record<PillarKey, string> = {
  identity: "/inevitable-standard/snapshot/identitiy.png",
  positioning: "/inevitable-standard/snapshot/positioning.png",
  offer: "/inevitable-standard/snapshot/offer.png",
  sales: "/inevitable-standard/snapshot/sales.png",
  revenue_model: "/inevitable-standard/snapshot/revenue-model.png",
  decision: "/inevitable-standard/snapshot/decision.png",
};

const PILLAR_QUESTION: Record<PillarKey, string> = {
  identity: "Can you hold the commercial weight of what you have built?",
  positioning: "Is it clear who this is for, and why it is worth choosing?",
  offer: "Is the value structured, or explained case by case?",
  sales: "Does the same outcome happen without you in the room?",
  revenue_model: "Does revenue become retained profit?",
  decision: "Are commercial decisions made deliberately, or at speed?",
};

const CHAPTER_SECTION_ICON: Partial<Record<InevitableStandardContentSection, string>> = {
  what_this_means: "/inevitable-standard/full-diagnostic/revenue-means.png",
  what_appears_working: "/inevitable-standard/full-diagnostic/appears-to-be-working.png",
  where_leaking: "/inevitable-standard/full-diagnostic/value-leaking.png",
  pathway_impact: "/inevitable-standard/full-diagnostic/revenue-to-freedom.png",
  focus_now: "/inevitable-standard/full-diagnostic/focus-on-now.png",
  what_to_watch: "/inevitable-standard/full-diagnostic/what-to-watch.png",
  progress_looks_like: "/inevitable-standard/full-diagnostic/progress.png",
};

const APPROACH_ICON: Record<ApproachCode, string> = {
  A: "/inevitable-standard/full-diagnostic/Rocket.png",
  B: "/inevitable-standard/full-diagnostic/connect.png",
  C: "/inevitable-standard/full-diagnostic/Clock.png",
  D: "/inevitable-standard/full-diagnostic/Evidence.png",
};

const REVENUE_ICON: Record<string, string> = {
  Revenue: "/inevitable-standard/full-diagnostic/revenue.png",
  Profit: "/inevitable-standard/full-diagnostic/profit.png",
  "Personal Wealth": "/inevitable-standard/full-diagnostic/personal-wealth.png",
  Freedom: "/inevitable-standard/full-diagnostic/freedom.png",
};

const HOW_TO_READ = [
  ["I", "Your Diagnosis", "Readiness, six pillars, constraints, priority fix order"],
  ["II", "The Revenue-To-Freedom Pathway", "What the diagnostic is measuring, and why"],
  ["III", "The Six Pillars", "Identity, Positioning, Offer, Sales, Revenue Model, Decision"],
  ["IV", "How You Make Commercial Decisions", "Your approach, and how it shows up in the results"],
  ["V", "Your Next Ninety Days", "30, 60 and 90-day focus"],
] as const;
"""
full = replace_once(full, anchor, assets, "Full Diagnostic asset constants")

# Figma navy section shell + ivory inner panel.
old_chapter = """function Chapter({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-t py-12 first:border-t-0 first:pt-0 sm:py-16 print:break-before-page"
      style={{ borderColor: HAIRLINE }}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="mt-3 text-[26px] leading-snug sm:text-[32px]"
        style={{ ...serif, color: INK }}
      >
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}"""
new_chapter = """function Chapter({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 rounded-[20px] p-[22px] sm:p-[27px] print:break-before-page"
      style={{
        backgroundColor: NAVY_DEEP,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <p
        className="text-[14px] font-semibold uppercase tracking-[0.18em] sm:text-[16px]"
        style={{ color: GOLD }}
      >
        {eyebrow}
      </p>
      <div className="mt-[26px] rounded-[20px] p-6 sm:p-10" style={{ backgroundColor: "#f8f6f1" }}>
        <h2 className="text-[26px] leading-snug sm:text-[32px]" style={{ ...serif, color: INK }}>
          {title}
        </h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}"""
full = replace_once(full, old_chapter, new_chapter, "Figma Chapter shell")

# Constraint cards.
old_constraint = """function ConstraintBlock({
  label,
  pillarName,
  body,
}: {
  label: string;
  pillarName: string;
  body: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: GOLD_TEXT }}
      >
        {label}
      </p>
      <p className="mt-1 text-xl" style={{ ...serif, color: INK }}>
        {pillarName}
      </p>
      <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">{body}</p>
    </div>
  );
}"""
new_constraint = """function ConstraintBlock({
  label,
  pillarName,
  body,
}: {
  label: string;
  pillarName: string;
  body: string;
}) {
  const isPrimary = label.toLowerCase().includes("primary");
  const tone = isPrimary ? "#a8503f" : "#bd8b3d";
  return (
    <div
      className="rounded-[4px] border border-l-[5px] bg-white p-6 sm:p-7"
      style={{ borderColor: tone }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#736c5c]">{label}</p>
      <p className="mt-2 text-[22px] font-semibold" style={{ ...serif, color: tone }}>
        {pillarName}
      </p>
      <p className="mt-2 text-[13px] leading-5 text-[#736c5c]">
        {isPrimary
          ? "The area most likely to be limiting progress right now."
          : "The area most likely to reinforce or recreate the primary constraint."}
      </p>
      <p className="mt-4 text-[14px] leading-6 text-[#66727d]">{body}</p>
    </div>
  );
}"""
full = replace_once(full, old_constraint, new_constraint, "Figma constraint cards")

# Revenue pathway cards.
start = "/** Revenue → Profit → Personal Wealth → Freedom — the primary framework visual. */\nfunction RevenueChainDiagram() {"
end = "\n\n/** Identity → Structure → Execution — the second framework visual, live scores. */"
new_revenue = """/** Revenue → Profit → Personal Wealth → Freedom — the primary framework visual. */
function RevenueChainDiagram() {
  return (
    <div className="grid gap-[18px] md:grid-cols-4">
      {REVENUE_CHAIN.map((node, index) => (
        <div
          key={node.label}
          className="rounded-[4px] border bg-[#fffdf9] p-5"
          style={{ borderColor: IVORY_BORDER }}
        >
          <img src={REVENUE_ICON[node.label]} alt="" className="h-12 w-12 object-contain" />
          <p className="mt-2 text-[28px] leading-none" style={{ ...serif, color: GOLD_TEXT }}>
            {String(index + 1).padStart(2, "0")}
          </p>
          <p className="mt-3 text-[19px]" style={{ ...serif, color: INK }}>{node.label}</p>
          <p className="mt-2 text-[12px] leading-5 text-[#66727d]">{node.blurb}</p>
        </div>
      ))}
    </div>
  );
}"""
full = replace_between(full, start, end, new_revenue, "Revenue pathway visual")

# Method layer cards + dynamic in-result paragraph.
start = "/** Identity → Structure → Execution — the second framework visual, live scores. */\nfunction MethodLayersDiagram"
end = "\n\nfunction PhaseBlock"
new_layers = """/** Identity → Structure → Execution — the second framework visual, live scores. */
function MethodLayersDiagram({
  pillarView,
  primaryKey,
  secondaryKey,
}: {
  pillarView: PillarView[];
  primaryKey: PillarKey | null;
  secondaryKey: PillarKey | null;
}) {
  const byKey = new Map(pillarView.map((pillar) => [pillar.key, pillar]));
  const layerIcon: Record<string, string> = {
    Identity: "/inevitable-standard/full-diagnostic/identity.png",
    Structure: "/inevitable-standard/full-diagnostic/structure2.png",
    Execution: "/inevitable-standard/full-diagnostic/execution.png",
  };
  const layerState = (keys: PillarKey[]) => {
    const values = keys.map((key) => byKey.get(key)?.percentage ?? 0);
    const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    if (average >= 70) return "strong";
    if (average >= 50) return "mixed";
    return "under pressure";
  };
  const primaryLayer = primaryKey ? METHOD_LAYER_LABEL[primaryKey] : null;
  const secondaryLayer = secondaryKey ? METHOD_LAYER_LABEL[secondaryKey] : null;
  const constraintSentence =
    primaryLayer && secondaryLayer && primaryLayer === secondaryLayer
      ? `Both of your constraints sit in ${primaryLayer}.`
      : primaryLayer && secondaryLayer
        ? `Your Primary Constraint sits in ${primaryLayer}; your Secondary Constraint sits in ${secondaryLayer}.`
        : primaryLayer
          ? `Your Primary Constraint sits in ${primaryLayer}.`
          : "";

  return (
    <div>
      <div className="grid gap-[22px] md:grid-cols-3">
        {METHOD_LAYERS.map((layer) => (
          <div
            key={layer.layer}
            className="rounded-[15px] border-t-2 bg-[#fffdf9] px-[22px] py-7"
            style={{ borderColor: GOLD }}
          >
            <img src={layerIcon[layer.layer]} alt="" className="h-9 w-9 object-contain" />
            <p className="mt-2 text-[21px]" style={{ ...serif, color: INK }}>{layer.layer}</p>
            <p className="mt-4 text-[11px] font-semibold text-[#66727d]">
              {layer.pillars.map((key) => pillarLabel(key)).join(", ")}
            </p>
            <p className="mt-4 text-[12px] leading-[18px] text-[#66727d]">{layer.blurb}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-[12px] font-medium uppercase tracking-[0.14em]" style={{ color: GOLD_TEXT }}>
        In your result
      </p>
      <p className="mt-4 text-[15px] leading-7 text-[#66727d]">
        Your Identity layer is {layerState(["identity", "positioning"])}. Your Structure layer is {layerState(["offer", "revenue_model"])}. {constraintSentence} The layers show what needs to support the diagnosed intervention so the change can hold.
      </p>
    </div>
  );
}"""
full = replace_between(full, start, end, new_layers, "Method layer visual")

# 30/60/90 cards.
start = "function PhaseBlock({ phase }: { phase: NinetyDayPhase }) {"
end = "\n\nfunction SidebarIndex"
new_phase = """function PhaseBlock({ phase }: { phase: NinetyDayPhase }) {
  const windowLabel =
    phase.window === "Days 1–30"
      ? "30 Days"
      : phase.window === "Days 31–60"
        ? "60 Days"
        : "90 Days";

  return (
    <div
      className="rounded-[15px] border border-t-4 bg-white p-[22px] print:break-inside-avoid"
      style={{ borderColor: "#ddd4bd" }}
    >
      <p className="text-[25px] leading-10" style={{ ...serif, color: GOLD_TEXT }}>{windowLabel}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#918a7d]">
        {pillarLabel(phase.pillar)} · {phase.role}
      </p>
      <div className="mt-4 space-y-3">
        {phase.actions.map((action, index) => (
          <p key={index} className="text-[14px] leading-[22px] text-[#66727d]">{action}</p>
        ))}
      </div>
    </div>
  );
}"""
full = replace_between(full, start, end, new_phase, "Figma 30/60/90 cards")

# Figma report-index card.
start = "function SidebarIndex({"
end = "\n\n/* -------------------------------------------------------------------------- */\n/* Component"
new_sidebar = """function SidebarIndex({
  sections,
  activeSection,
  readiness: _readiness,
  band: _band,
}: {
  sections: Array<{ id: string; label: string }>;
  activeSection: string;
  readiness: number;
  band: string;
}) {
  return (
    <aside className="hidden lg:block print:hidden">
      <div className="sticky top-5 rounded-[20px] border border-white/10 p-5" style={{ backgroundColor: "#f8f6f1" }}>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#33445a]">Report Index</p>
        <nav className="mt-4 space-y-2">
          {sections.map((section, index) => {
            const active = section.id === activeSection;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                className="block rounded-[15px] border px-4 py-3 text-[12px] leading-5 transition"
                style={active
                  ? { backgroundColor: NAVY_DEEP, borderColor: NAVY_DEEP, color: "#ffffff" }
                  : { borderColor: "#33445a", color: "#33445a" }}
              >
                {index + 1}. {section.label}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-3 w-full rounded-[10px] bg-[#33445a] px-4 py-3 text-[12px] font-semibold text-white"
        >
          Download PDF
        </button>
        <a
          href="#plan"
          className="mt-2 block w-full rounded-[10px] bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-4 py-3 text-center text-[12px] font-semibold text-white"
        >
          Next step
        </a>
      </div>
    </aside>
  );
}

function HeroPillarSummary({ pillars }: { pillars: PillarView[] }) {
  return (
    <div className="rounded-[10px] border border-white/15 bg-white/[0.05] px-7 py-5">
      <p className="mb-4 text-[10px] uppercase tracking-[0.16em] text-[#a9a08a]">The six pillars</p>
      <div className="space-y-[13px]">
        {pillars.map((pillar) => {
          const colour = GAR[pillar.gar].bar;
          return (
            <div key={pillar.key} className="grid grid-cols-[105px_1fr_34px] items-center gap-3">
              <div className="flex items-center gap-2">
                <img src={PILLAR_ICON[pillar.key]} alt="" className="h-6 w-6 object-contain" />
                <span className="text-[11px] text-[#cfc9b8]">{pillar.key === "revenue_model" ? "Rev. Model" : pillar.label}</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full" style={{ width: `${pillar.percentage}%`, backgroundColor: colour }} />
              </div>
              <span className="text-right text-[11px] font-bold text-[#f0ece0]">{pillar.percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}"""
full = replace_between(full, start, end, new_sidebar, "Figma sidebar and hero summary")

# Initial active section.
full = replace_once(
    full,
    '  const [activeSection, setActiveSection] = useState<string>("summary");',
    '  const [activeSection, setActiveSection] = useState<string>("how-to-read");',
    "initial report section",
)

# Sidebar / page section order, including all six pillar chapters.
start = "  const sections = useMemo(() => {"
end = "\n\n  useEffect(() => {\n    if (!view || typeof IntersectionObserver"
new_sections = """  const sections = useMemo(() => {
    if (!view) return [];
    const list: Array<{ id: string; label: string }> = [
      { id: "how-to-read", label: "How to read this report" },
      { id: "summary", label: "Your diagnosis" },
      { id: "diagnosis", label: "What is holding you back" },
      { id: "model", label: "The Model" },
      { id: "layers", label: "The pillars" },
    ];
    view.pillarView.forEach((pillar, index) =>
      list.push({ id: `pillar-${pillar.key}`, label: `Pillar ${index + 1}: ${pillar.label}` }),
    );
    if (view.diagnosticAdds) list.push({ id: "your-words", label: "In your words" });
    list.push({ id: "approach", label: "Commercial Decision Intelligence" });
    list.push({ id: "plan", label: "Your next ninety days" });
    list.push({ id: "closing", label: "In closing" });
    return list;
  }, [view]);"""
full = replace_between(full, start, end, new_sections, "Full Diagnostic section order")

# Page background.
full = full.replace('style={{ backgroundColor: IVORY, color: INK }}', 'style={{ backgroundColor: "#041731", color: INK }}')

# Replace floating print button with the approved top report bar.
old_button = """      <button
        type="button"
        onClick={() => window.print()}
        className="fixed right-4 top-4 z-20 rounded-full border bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b5563] shadow-sm backdrop-blur transition hover:bg-white print:hidden"
        style={{ borderColor: IVORY_BORDER }}
      >
        Print / Save PDF
      </button>
"""
new_topbar = """      <header className="border-b border-white/10 px-5 py-4 text-white print:hidden" style={{ backgroundColor: NAVY_DEEP }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 lg:flex-nowrap">
          <div className="mr-auto flex min-w-[330px] items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
              <img src="/images/profile-test-ai-logo.png" alt="profiletest.ai" className="max-h-8 max-w-8 object-contain brightness-0 invert" />
            </div>
            <div>
              <p className="text-[18px] font-semibold uppercase tracking-[0.14em] sm:text-[24px]">Full Diagnostic Report</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#c9b98f" }}>
                The Inevitable Standard Method™ · powered by Profiletest.ai
              </p>
            </div>
          </div>
          <button type="button" onClick={() => window.print()} className="rounded-lg px-5 py-2 text-[12px] font-semibold text-white" style={{ backgroundColor: GOLD }}>
            Download PDF
          </button>
          <a href="#plan" className="rounded-lg bg-gradient-to-r from-[#5a7a9e] via-[#2563c8] to-[#14263d] px-5 py-2 text-[12px] font-semibold text-white">Next step</a>
        </div>
        <div className="mx-auto mt-3 grid max-w-[600px] grid-cols-3 gap-2 text-[10px] lg:ml-auto lg:mr-5 lg:mt-2">
          <div className="rounded-xl border border-white/25 px-3 py-2"><span className="block text-white/40">PREPARED FOR</span><strong className="mt-1 block text-[12px] text-white">{clientName}</strong></div>
          <div className="rounded-xl border border-white/25 px-3 py-2"><span className="block text-white/40">BUSINESS</span><strong className="mt-1 block truncate text-[12px] text-white">{businessName || "—"}</strong></div>
          <div className="rounded-xl border border-white/25 px-3 py-2"><span className="block text-white/40">DATE</span><strong className="mt-1 block text-[12px] text-white">{assessmentDate}</strong></div>
        </div>
      </header>
"""
full = replace_once(full, old_button, new_topbar, "Full Diagnostic top header")

# Approved hero.
start = "      {/* Cover */}"
end = "      {/* Print-only index */}"
hero = """      {/* Cover */}
      <header
        className="bg-gradient-to-b from-[#14263d] to-[#1f2c46] px-6 py-12 text-white sm:px-10 sm:py-[60px] print:break-after-page"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
      >
        <div className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_263px_388px] xl:items-start">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>The Inevitable Standard Method™</p>
            <h1 className="mt-6 text-[48px] leading-[0.96] sm:text-[64px] xl:text-[80px]" style={serif}>{clientName}</h1>
            <p className="mt-5 text-[24px] italic sm:text-[30px]" style={{ ...serif, color: "#c9b98f" }}>Your Revenue-To-Freedom Pathway</p>
            <div className="mt-8 border-t border-[#b89a5e]/45 pt-3 text-[11px] uppercase tracking-[0.2em]">Your Full Diagnostic Report</div>
          </div>
          <div className="flex flex-col items-center rounded-[10px] border border-white/15 bg-white/[0.05] px-5 py-4">
            <p className="text-center text-[10px] uppercase tracking-[0.14em] text-[#a9a08a]">Inevitable Standard Readiness</p>
            <ReadinessDonut percentage={overallPercentage} band={bandDescriptor} />
            <p className="text-center text-[13px] text-[#e8e2d0]">{bandDescriptor} <span className="text-[#cfc9b8]">· Current standard</span></p>
          </div>
          <HeroPillarSummary pillars={pillarView} />
        </div>
      </header>

"""
full = replace_between(full, start, end, hero, "Full Diagnostic hero")

# Main report grid dimensions from the approved frame.
full = replace_once(
    full,
    '      <div className="mx-auto max-w-6xl gap-x-12 px-6 py-12 sm:px-10 lg:grid lg:grid-cols-[260px_1fr] lg:py-16 print:block">',
    '      <div className="mx-auto max-w-[1275px] gap-x-[46px] px-5 py-14 lg:grid lg:grid-cols-[303px_minmax(0,963px)] print:block">',
    "Full Diagnostic report grid",
)

# Add How-To-Read and split diagnosis from readiness.
insert_marker = """        <div className="min-w-0">
          {/* Results at a glance */}"""
insert_replacement = """        <div className="min-w-0 space-y-10">
          <Chapter id="how-to-read" eyebrow="How to Read This Report" title="Your result first, then what it means">
            <p className="max-w-3xl text-[14px] leading-6 text-[#66727d]">
              This report opens with your diagnosis rather than the framework behind it. Read the first two sections for your result. Read the pillar chapters when you want to understand why a result appeared and what to do about it.
            </p>
            <div className="mt-7 border-t" style={{ borderColor: HAIRLINE }}>
              {HOW_TO_READ.map(([roman, heading, description], index) => (
                <div key={roman} className="grid grid-cols-[54px_1fr_36px] items-center gap-5 border-b py-4" style={{ borderColor: HAIRLINE }}>
                  <span className="text-[18px]" style={{ color: GOLD_TEXT }}>{roman}</span>
                  <div><p className="text-[17px]" style={serif}>{heading}</p><p className="mt-1 text-[11px] text-[#66727d]">{description}</p></div>
                  <span className="text-right text-[18px] text-[#66727d]">{["03", "05", "07", "14", "15"][index]}</span>
                </div>
              ))}
            </div>
          </Chapter>

          {/* Results at a glance */}"""
full = replace_once(full, insert_marker, insert_replacement, "How to Read section")

full = replace_once(
    full,
    """          <Chapter
            id="summary"
            eyebrow="Results at a Glance"
            title="Where the business stands, before we go deeper"
          >""",
    """          <Chapter
            id="summary"
            eyebrow="Your Diagnosis"
            title="Your Inevitable Standard Readiness"
          >""",
    "Readiness chapter heading",
)

# Add the core explanatory paragraph beneath the readiness result.
old_band = """            {bandMeaning ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
                {bandMeaning}
              </p>
            ) : null}
"""
new_band = old_band + """            <p className="mt-5 max-w-3xl text-[14px] leading-6 text-[#66727d]">
              Your Inevitable Standard Readiness shows how deliberately your business is currently built to move revenue through to profit, personal wealth and greater freedom. It is calculated across six areas of the business and is designed to show where the foundations are already working and where greater structure could have the biggest impact.
            </p>
"""
full = replace_once(full, old_band, new_band, "Readiness explanatory copy")

# Close readiness after the six-pillar list and open the separate diagnosis section.
needle = '            <div className="mt-12 space-y-8">'
replacement = """          </Chapter>

          <Chapter
            id="diagnosis"
            eyebrow="Your Diagnosis"
            title="What is most likely holding you back"
          >
            <div className="space-y-4">"""
full = replace_once(full, needle, replacement, "Split diagnosis from readiness")

# Remove the duplicate mini decision-approach paragraph from the diagnosis section.
mini_approach = """              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: GOLD_TEXT }}
                >
                  Commercial decision approach
                </p>
                <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                  Your leading approach is{" "}
                  <strong className="font-semibold" style={{ color: INK }}>
                    {dominantLabel || "still forming"}
                  </strong>
                  {dominant ? ` (${dominantPct}%)` : ""}
                  {secondaryApproachLabel
                    ? `, with a secondary influence of ${secondaryApproachLabel}`
                    : ""}
                  . The full picture is in the Commercial Decision Intelligence chapter.
                </p>
              </div>

"""
full = replace_once(full, mini_approach, "", "Remove duplicate decision approach")

# Priority order: approved horizontal 01-06 treatment.
start = """                <ol className="mt-3 border-t" style={{ borderColor: HAIRLINE }}>"""
end = """                <p className="mt-4 text-[12px] leading-6 text-[#918a7d]">
                  {PRIORITY_ORDER_NOTE}
                </p>"""
priority = """                <ol className="mt-5 grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
                  {priorityOrder.map((key, index) => (
                    <li key={key} className="border-t-2 pt-3" style={{ borderColor: index === 0 ? GOLD : HAIRLINE }}>
                      <p className="text-[9px] text-[#66727d]">{String(index + 1).padStart(2, "0")}</p>
                      <p className="mt-1 text-[15px] leading-5" style={serif}>{pillarLabel(key)}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 text-[12px] leading-6 text-[#66727d]">{PRIORITY_ORDER_NOTE}</p>"""
full = replace_between(full, start, end, priority, "Horizontal Priority Fix Order")

# Model title / copy.
full = replace_once(
    full,
    '            title="How revenue is meant to become freedom"',
    '            title="Revenue is the beginning of the pathway, not the destination"',
    "Revenue model title",
)
full = replace_once(
    full,
    """            <p className="max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Every number in this report is in service of one chain. Revenue is only the
              first link; the point of the business is what the chain produces at the end.
            </p>""",
    """            <p className="max-w-3xl text-[15px] leading-7 text-[#66727d]">
              Revenue is the beginning of the pathway, not the destination. The Inevitable Standard looks at whether the structure of the business allows revenue to become retained profit, whether that profit can create value beyond the business itself, and ultimately whether the business is building greater choice and freedom for its owner.
            </p>""",
    "Revenue model explanation",
)

# Split Method layers into their own Figma section.
old_method_heading = """            <h3
              className="mt-12 text-[13px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: GOLD_TEXT }}
            >
              Identity → Structure → Execution
            </h3>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              The six pillars sit in three layers. Each layer depends on the one before it,
              which is why a problem that appears in execution can have quieter dependencies
              elsewhere. The layers explain what helps the intervention hold; they do not
              override the Primary Constraint as the place to begin.
            </p>
            <div className="mt-6">
              <MethodLayersDiagram pillarView={pillarView} />
            </div>"""
new_method_heading = """          </Chapter>

          <Chapter
            id="layers"
            eyebrow="The Pillars"
            title="Identity → Structure → Execution"
          >
            <p className="max-w-3xl text-[15px] leading-7 text-[#66727d]">
              The six pillars sit in three layers. Each layer depends on the one before it, which is why a problem that appears in execution often begins somewhere quieter.
            </p>
            <div className="mt-7">
              <MethodLayersDiagram pillarView={pillarView} primaryKey={primaryKey} secondaryKey={secondaryKey} />
            </div>"""
full = replace_once(full, old_method_heading, new_method_heading, "Separate Method-layer section")

# Replace the single long pillar chapter with six Figma-style pillar sections.
start = "          {/* Pillar chapters */}"
end = "          {/* In your words */}"
pillars_block = """          {/* Pillar chapters */}
          {pillarView.map((pillar, index) => {
            const content = getInevitableStandardPillarBandContent(pillar.key, pillar.gar);
            const rows = CHAPTER_SECTIONS.map((section) => ({
              key: section.key,
              heading: section.heading,
              icon: CHAPTER_SECTION_ICON[section.key],
              text: content[section.key]?.text,
            })).filter((row): row is { key: InevitableStandardContentSection; heading: string; icon: string | undefined; text: string } => Boolean(row.text));
            if (rows.length === 0) {
              rows.push({ key: "what_this_means", heading: "What This Result Means", icon: CHAPTER_SECTION_ICON.what_this_means, text: chapterFallbackSentence(pillar) });
            }
            const constraintSuffix = pillar.key === primaryKey
              ? " · Primary Constraint"
              : pillar.key === secondaryKey
                ? " · Secondary Constraint"
                : "";

            return (
              <Chapter
                key={pillar.key}
                id={`pillar-${pillar.key}`}
                eyebrow={`Pillar ${index + 1}${constraintSuffix}`}
                title={pillar.label}
              >
                <div className="flex flex-wrap items-start justify-between gap-5 border-b pb-6" style={{ borderColor: HAIRLINE }}>
                  <div className="flex items-start gap-4">
                    <img src={PILLAR_ICON[pillar.key]} alt="" className="h-11 w-11 object-contain" />
                    <div>
                      <p className="text-[15px] leading-6 text-[#66727d]">{PILLAR_QUESTION[pillar.key]}</p>
                      {content.snapshot_line?.text ? <p className="mt-2 text-[13px] italic leading-6 text-[#918a7d]" style={serif}>{content.snapshot_line.text}</p> : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[32px] leading-none" style={{ ...serif, color: INK }}>{pillar.percentage}%</p>
                    <div className="mt-2"><GarChip gar={pillar.gar} /></div>
                  </div>
                </div>
                <div className="mt-7 grid gap-x-12 gap-y-7 md:grid-cols-2">
                  {rows.map((row) => (
                    <div
                      key={row.heading}
                      className={row.key === "progress_looks_like" ? "rounded-[4px] border-t-2 bg-[#fffdf9] p-5" : ""}
                      style={row.key === "progress_looks_like" ? { borderColor: GOLD } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {row.icon ? <img src={row.icon} alt="" className="h-6 w-6 object-contain" /> : null}
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: GOLD_TEXT }}>{row.heading}</p>
                      </div>
                      <p className="mt-3 text-[14px] leading-6 text-[#66727d]">{row.text}</p>
                    </div>
                  ))}
                </div>
              </Chapter>
            );
          })}

"""
full = replace_between(full, start, end, pillars_block, "Six separate pillar sections")

# Figma-style Commercial Decision Intelligence.
start = "          {/* Commercial decision intelligence */}"
end = "          {/* Revenue in your structure */}"
approach_block = """          {/* Commercial decision intelligence */}
          <Chapter
            id="approach"
            eyebrow="Commercial Decision Intelligence"
            title="How you naturally make commercial decisions"
          >
            <div className="flex flex-wrap items-end justify-between gap-5">
              <p className="text-[38px] sm:text-[46px]" style={{ ...serif, color: GOLD_TEXT }}>{dominantLabel || "Still forming"}</p>
              <p className="text-[46px] sm:text-[58px]" style={{ ...serif, color: GOLD_TEXT }}>{dominantPct}%</p>
            </div>
            <p className="mt-5 max-w-3xl text-[14px] leading-6 text-[#66727d]">
              {dominant ? APPROACH_LENS_COPY[dominant] : "Your approach is a lens, not a label. It describes the information you tend to weigh first when a commercial decision is in front of you."}
            </p>
            <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
              <div>
                {APPROACHES.map((approach) => {
                  const pct = approachPercent(approach.code);
                  const isDominant = approach.code === dominant;
                  return (
                    <div key={approach.code} className="grid grid-cols-[32px_130px_1fr_42px] items-center gap-3 border-b py-3" style={{ borderColor: HAIRLINE }}>
                      <img src={APPROACH_ICON[approach.code]} alt="" className="h-6 w-6 object-contain" />
                      <span className="text-[12px] font-semibold" style={{ color: isDominant ? GOLD_TEXT : INK }}>{approach.label}</span>
                      <div className="h-[5px] bg-[#e9e6df]"><div className="h-full" style={{ width: `${pct}%`, backgroundColor: isDominant ? GOLD : "#8e9aaa" }} /></div>
                      <span className="text-right text-[12px]">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <ApproachCompass x={compassX} y={compassY} />
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="border-t pt-5" style={{ borderColor: HAIRLINE }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: GOLD_TEXT }}>Your Primary Approach</p>
                <p className="mt-3 text-[14px] leading-6 text-[#66727d]">{dominant ? APPROACH_LENS_COPY[dominant] : "Your primary approach is still forming."}</p>
              </div>
              <div className="border-t pt-5" style={{ borderColor: HAIRLINE }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: GOLD_TEXT }}>Your Secondary Influence</p>
                <p className="mt-3 text-[14px] leading-6 text-[#66727d]">{secondaryApproachLabel ? `${secondaryApproachLabel} adds a secondary influence to how you weigh commercial choices.` : "No single secondary influence is dominant in this result."}</p>
              </div>
            </div>
            {primaryKey ? (
              <div className="mt-8 border-t pt-6" style={{ borderColor: HAIRLINE }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: GOLD_TEXT }}>How this may connect to your pillar evidence</p>
                <p className="mt-3 text-[14px] leading-6 text-[#66727d]">Your approach may influence how the {pillarLabel(primaryKey)} result shows up, but it does not create the constraint. The pillar evidence and Constraint Engine remain the commercial diagnosis.</p>
              </div>
            ) : null}
          </Chapter>

"""
full = replace_between(full, start, end, approach_block, "Commercial Decision Intelligence section")

# Remove Revenue in Your Structure section entirely to match the approved Figma report.
start = "          {/* Revenue in your structure */}"
end = "          {/* 30/60/90 */}"
full = replace_between(full, start, end, "", "Remove Revenue-in-Structure from Full Diagnostic")

# Replace plan section with the approved three-column horizon treatment.
start = "          {/* 30/60/90 */}"
end = "          {/* Closing */}"
plan_block = """          {/* 30/60/90 */}
          <Chapter
            id="plan"
            eyebrow="Your Next Ninety Days"
            title="Where the work compounds fastest"
          >
            <p className="max-w-3xl text-[15px] leading-7 text-[#66727d]">
              In sequence. Each horizon assumes the one before it is in place. The first window begins with the Primary Constraint, the second works the reinforcing Secondary Constraint, and the third advances the next most material issue.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {plan.map((phase) => <PhaseBlock key={phase.window} phase={phase} />)}
            </div>
          </Chapter>

"""
full = replace_between(full, start, end, plan_block, "Next Ninety Days section")

# Full-bleed closing panel, not another ivory chapter.
start = "          {/* Closing */}"
end = "        </div>\n      </div>\n\n      <footer"
closing = """          {/* Closing */}
          <section
            id="closing"
            className="scroll-mt-8 rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-12 text-center text-white shadow-xl print:break-before-page"
          >
            <p className="text-[15px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>In Closing</p>
            <h2 className="mx-auto mt-8 max-w-3xl text-[28px] leading-9 sm:text-[34px]" style={serif}>
              The purpose is not to improve six scores. It is to build a business that works more deliberately for you.
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-[14px] leading-6 text-[#b9c2ce]">
              Your result is not a verdict on the business or on you. It is a description of how much of what currently works is held by structure, and how much is held by you personally. At {overallPercentage}%, the opportunity is to move more of what currently depends on judgement into the structure of the business.
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-6 text-[#b9c2ce]">
              The work ahead is narrow: begin with {primaryKey ? pillarLabel(primaryKey) : "the Primary Constraint"}, strengthen {secondaryKey ? pillarLabel(secondaryKey) : "the reinforcing issue"}, and use the Method layers to make the change hold.
            </p>
            <div className="mx-auto mt-10 grid max-w-[650px] grid-cols-2 text-left sm:grid-cols-4">
              {REVENUE_CHAIN.map((node, index) => (
                <div key={node.label} className={index === 0 ? "px-5 py-4" : "border-l border-white/20 px-5 py-4"}>
                  <p className="text-[12px]" style={{ color: GOLD }}>{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-[25px] leading-7" style={serif}>{node.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-[11px] text-[#8e9aaa]">Created from The Inevitable Standard Method™ by Genene Wilson, The Wealth Architect.</p>
          </section>
"""
full = replace_between(full, start, end, closing, "Full Diagnostic closing panel")

pending[FILES["full"]] = full

# Validate before writing any file.
for path, content in pending.items():
    if not content.strip():
        raise RuntimeError(f"Refusing to write empty file: {path}")

for path, content in pending.items():
    path.write_text(content, encoding="utf-8")

print("Applied approved Full Diagnostic Figma alignment to:")
for path in pending:
    print("  -", path.relative_to(ROOT))
print("\nNo commit, push, merge, or deployment was performed.")
print("\nRun next:")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/constraintEngine.test.ts")
print("  pnpm --dir apps/web run typecheck")
print("  git diff --check")
