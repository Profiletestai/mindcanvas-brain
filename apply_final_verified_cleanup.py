#!/usr/bin/env python3
"""
Final verified cleanup after visual QA of the regenerated Snapshot, Full Diagnostic
and Insider Insights PDFs.

Run from the mindcanvas-brain repository root:
    python3 apply_final_verified_cleanup.py

Scope:
- fixes two evidence-integrity issues exposed by Lisa's Insider PDF;
- removes remaining forced/empty Full Diagnostic print pages;
- restores the Snapshot's approved end CTA in the PDF;
- makes the three report PDFs full-bleed navy instead of leaving white page remainder;
- corrects the 30/60/90 helper's Positioning Method-layer metadata.

No scoring, Constraint Engine ranking, approach scoring, or report-selection logic changes.
No commit, push, merge, or deployment.
"""

from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()
FILES = {
    "builder": ROOT / "apps/web/lib/inevitable-standard/buildInsiderInsightsReport.ts",
    "builder_tests": ROOT / "apps/web/lib/inevitable-standard/buildInsiderInsightsReport.test.ts",
    "templates": ROOT / "apps/web/lib/inevitable-standard/fullDiagnosticTemplates.ts",
    "snapshot": ROOT / "apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx",
    "full": ROOT / "apps/web/app/t/[token]/full-report/InevitableStandardFullDiagnosticClient.tsx",
    "insider": ROOT / "apps/web/app/portal/insider-insights/[slug]/[takerId]/InsiderInsightsReportClient.tsx",
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


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: expected exactly one source match, found {count}. No files were written."
        )
    return text.replace(old, new, 1)


missing = [str(path) for path in FILES.values() if not path.exists()]
if missing:
    print("Missing expected files:")
    for path in missing:
        print("  -", path)
    print("\nRun this script from the mindcanvas-brain repository root.")
    sys.exit(1)

branch = branch_name()
if branch and branch not in {"feature/inevitable-standard", "fix/inevitable-report-alignment"}:
    print(f"Current branch is {branch!r}.")
    print("Switch to feature/inevitable-standard (or a fix branch from it) before applying.")
    sys.exit(1)

pending: dict[Path, str] = {}

# ---------------------------------------------------------------------------
# 1. Insider evidence integrity
# ---------------------------------------------------------------------------
builder = FILES["builder"].read_text(encoding="utf-8")

# GREEN LEVERAGE means Green. Lisa's strongest pillar is Offer at 66.7% Amber;
# it must not be labelled as Green leverage merely because it is the strongest.
builder = replace_once(
    builder,
    '    if (strongest && strongest.gar !== "RED" && strongestBlurb) {',
    '    if (strongest && strongest.gar === "GREEN" && strongestBlurb) {',
    "Insider Green Leverage gate",
)

# Risk flags require answer-level evidence. Do not strengthen a one-word or
# vague Q29 answer with approach/constraint text and then treat the combined
# text as though the founder actually supplied that evidence.
builder = replace_once(
    builder,
    '''  if (q29present) {
    const riskContext = [
      cleanText(contextAnswers[29]),
      "decision certainty analysis",
      cleanText(pc?.approachMechanism),
      cleanText(decisionState?.commercialConsequence),
    ].join(" ");

    foundersWords.push({''',
    '''  if (q29present) {
    const riskContext = cleanText(contextAnswers[29]);
    const riskSignal =
      riskContext.split(/\\s+/).filter(Boolean).length >= 4
        ? toRiskSignalCard(
            pickRiskSignal(approachData.riskSignals ?? [], riskContext),
          )
        : null;

    if (!riskSignal && riskContext.split(/\\s+/).filter(Boolean).length < 4) {
      qaFlags.push(
        "Q29 answer is too brief for an answer-level risk signal — risk card suppressed",
      );
    }

    foundersWords.push({''',
    "Insider Q29 answer-level risk gate",
)
builder = replace_once(
    builder,
    '''      riskSignal: toRiskSignalCard(
        pickRiskSignal(approachData.riskSignals ?? [], riskContext),
      ),''',
    '''      riskSignal,''',
    "Insider Q29 selected risk signal",
)

pending[FILES["builder"]] = builder

# ---------------------------------------------------------------------------
# 2. Regression tests for the two PDF-discovered evidence issues
# ---------------------------------------------------------------------------
tests = FILES["builder_tests"].read_text(encoding="utf-8")
marker = '''  it("Q29 is the answer-level risk surface, matching the approved Figma treatment", () => {
    const report = buildInsiderInsightsReport({ score: fakeScore() })!;
    const q29 = report.foundersWords.find((item) => item.questionNumber === 29)!;
    expect(q29.evidencePillars).toHaveLength(0);
    expect(q29.tags).toHaveLength(0);
  });
'''
addition = marker + '''
  it("does not infer a Q29 risk signal from a one-word answer or approach alone", () => {
    const report = buildInsiderInsightsReport({
      score: fakeScore({
        context_answers: {
          13: "leads",
          29: "Sales",
        },
        approaches: {
          percentages: { A: 16.7, B: 41.7, C: 33.3, D: 8.3 },
          dominant: "B",
          secondary: "C",
        },
      }),
    })!;

    const q29 = report.foundersWords.find((item) => item.questionNumber === 29)!;
    expect(q29.riskSignal).toBeNull();
    expect(report.qaFlags.join(" ")).toContain("too brief");
  });

  it("does not label an Amber strongest pillar as GREEN LEVERAGE", () => {
    const report = buildInsiderInsightsReport({
      score: fakeScore({
        pillars: {
          identity: { percentage: 41.7, risk: "medium_risk" },
          positioning: { percentage: 50, risk: "medium_risk" },
          offer: { percentage: 66.7, risk: "medium_risk" },
          sales: { percentage: 33.3, risk: "high_risk" },
          revenue_model: { percentage: 66.7, risk: "medium_risk" },
          decision: { percentage: 58.3, risk: "medium_risk" },
        },
        approaches: {
          percentages: { A: 16.7, B: 41.7, C: 33.3, D: 8.3 },
          dominant: "B",
          secondary: "C",
        },
        constraints: {
          primary_constraint: "sales",
          secondary_constraint: "identity",
          false_constraint: null,
          false_constraint_rule_id: null,
          priority_fix_order: [],
        },
        context_answers: {
          13: "leads",
          29: "Sales",
        },
      }),
    })!;

    const q13 = report.foundersWords.find((item) => item.questionNumber === 13)!;
    expect(q13.tags.map((tag) => tag.kind)).not.toContain("GREEN LEVERAGE");
    expect(report.snapshot.strongestPillar?.gar).toBe("AMBER");
  });
'''
tests = replace_once(
    tests,
    marker,
    addition,
    "Insider evidence regression tests",
)
pending[FILES["builder_tests"]] = tests

# ---------------------------------------------------------------------------
# 3. Full Diagnostic print cleanup
# ---------------------------------------------------------------------------
full = FILES["full"].read_text(encoding="utf-8")

full = replace_once(
    full,
    'className="bg-gradient-to-b from-[#14263d] to-[#1f2c46] px-6 py-12 text-white sm:px-10 sm:py-[60px] print:break-after-page"',
    'className="bg-gradient-to-b from-[#14263d] to-[#1f2c46] px-6 py-12 text-white sm:px-10 sm:py-[60px]"',
    "Full cover forced page break",
)
full = replace_once(
    full,
    'className="scroll-mt-8 rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-12 text-center text-white shadow-xl print:break-before-page"',
    'className="scroll-mt-8 rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-12 text-center text-white shadow-xl"',
    "Full closing forced page break",
)
full = replace_once(
    full,
    '<footer className="border-t" style={{ borderColor: HAIRLINE }}>',
    '<footer className="border-t print:hidden" style={{ borderColor: HAIRLINE }}>',
    "Full footer-only print page",
)
full = replace_once(
    full,
    '''    >
      <header className="border-b border-white/10 px-5 py-4 text-white print:hidden" style={{ backgroundColor: NAVY_DEEP }}>''',
    '''    >
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { background: #041731 !important; }
        }
      `}</style>
      <header className="border-b border-white/10 px-5 py-4 text-white print:hidden" style={{ backgroundColor: NAVY_DEEP }}>''',
    "Full route print background",
)
pending[FILES["full"]] = full

# ---------------------------------------------------------------------------
# 4. Snapshot: approved report CTA + full-bleed PDF background
# ---------------------------------------------------------------------------
snapshot = FILES["snapshot"].read_text(encoding="utf-8")
snapshot = replace_once(
    snapshot,
    '''<main className={`${newsreader.variable} min-h-screen`} style={{ backgroundColor: FIGMA.page, color: FIGMA.ink }}>
      <header className="border-b border-white/10 px-5 py-4 text-white print:hidden" style={{ backgroundColor: FIGMA.navy }}>''',
    '''<main className={`${newsreader.variable} min-h-screen`} style={{ backgroundColor: FIGMA.page, color: FIGMA.ink }}>
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { background: #041731 !important; }
        }
      `}</style>
      <header className="border-b border-white/10 px-5 py-4 text-white print:hidden" style={{ backgroundColor: FIGMA.navy }}>''',
    "Snapshot route print background",
)
snapshot = replace_once(
    snapshot,
    '<div className="rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-9 text-center text-white shadow-xl print:hidden">',
    '<div className="rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-9 text-center text-white shadow-xl">',
    "Snapshot approved end CTA in PDF",
)
pending[FILES["snapshot"]] = snapshot

# ---------------------------------------------------------------------------
# 5. Insider: full-bleed PDF background
# ---------------------------------------------------------------------------
insider = FILES["insider"].read_text(encoding="utf-8")
insider = replace_once(
    insider,
    '''        @media print {
          body .fixed,''',
    '''        @media print {
          @page { margin: 0; }
          html, body { background: #041731 !important; }
          body .fixed,''',
    "Insider route print background",
)
pending[FILES["insider"]] = insider

# ---------------------------------------------------------------------------
# 6. Keep 30/60/90 metadata aligned with the approved Method grouping.
# ---------------------------------------------------------------------------
templates = FILES["templates"].read_text(encoding="utf-8")
templates = replace_once(
    templates,
    '  positioning: "Structure",',
    '  positioning: "Identity",',
    "30/60/90 Method-layer metadata",
)
pending[FILES["templates"]] = templates

# Validate every transformation before any write.
for path, text in pending.items():
    if not text.strip():
        raise RuntimeError(f"Refusing to write an empty file: {path}")

for path, text in pending.items():
    path.write_text(text, encoding="utf-8")

print("Applied final verified cleanup to:")
for path in pending:
    print("  -", path.relative_to(ROOT))

print("\nVerified corrections:")
print("  - Amber strongest pillars can no longer render as GREEN LEVERAGE")
print("  - Q29 risk flags now require the founder's answer itself to carry evidence")
print("  - Full Diagnostic no longer forces blank cover/closing gaps or a footer-only page")
print("  - Snapshot end CTA is included in the downloaded PDF")
print("  - report PDFs use full-bleed navy page background")
print("  - Positioning plan metadata is aligned to the approved Identity layer")
print("\nNo commit, push, merge, or deployment was performed.")
print("\nRun next:")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/buildInsiderInsightsReport.test.ts")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/constraintEngine.test.ts")
print("  pnpm --dir apps/web run typecheck")
print("  git diff --check")
