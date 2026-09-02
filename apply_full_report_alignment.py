#!/usr/bin/env python3
"""
Apply Phase 1 alignment for The Inevitable Standard Full Diagnostic.

Run from the mindcanvas-brain repository root:
    python3 apply_full_report_alignment.py

The script:
- corrects Priority Fix Order to Primary -> Secondary -> remaining severity;
- fixes rendering for older stored assessments;
- updates regression tests;
- removes Full Diagnostic copy that defers the Primary Constraint behind Method layers;
- updates the repo implementation spec so the old rule is not reintroduced.

It does NOT commit, merge, push, or deploy anything.
"""

from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()

FILES = {
    "engine": ROOT / "apps/web/lib/inevitable-standard/constraintEngine.ts",
    "tests": ROOT / "apps/web/lib/inevitable-standard/constraintEngine.test.ts",
    "shared": ROOT / "apps/web/app/t/[token]/report/inevitableStandardShared.tsx",
    "templates": ROOT / "apps/web/lib/inevitable-standard/fullDiagnosticTemplates.ts",
    "full": ROOT / "apps/web/app/t/[token]/full-report/InevitableStandardFullDiagnosticClient.tsx",
    "spec": ROOT / "docs/inevitable-standard-spec.md",
}


def current_branch() -> str:
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
            f"{label}: expected exactly one matching source block, found {count}. "
            "No files were written."
        )
    return text.replace(old, new, 1)


def transform(path: Path, replacements):
    text = path.read_text(encoding="utf-8")
    for old, new, label in replacements:
        text = replace_once(text, old, new, label)
    return text


missing = [str(path) for path in FILES.values() if not path.exists()]
if missing:
    print("Could not find the expected project files:")
    for path in missing:
        print("  -", path)
    print("\nRun this script from the mindcanvas-brain repository root.")
    sys.exit(1)

branch = current_branch()
if branch and branch not in {"feature/inevitable-standard", "fix/inevitable-report-alignment"}:
    print(f"Current branch is {branch!r}.")
    print("Switch to feature/inevitable-standard (or a fix branch from it) before applying.")
    sys.exit(1)

changes = {}

# ---------------------------------------------------------------------------
# 1. Constraint Engine: diagnosis-led full order
# ---------------------------------------------------------------------------
changes[FILES["engine"]] = transform(
    FILES["engine"],
    [
        (
            """ *  - Priority Fix Order   - the constrained pillars sequenced by Method layer
 *    (Identity -> Structure -> Execution).""",
            """ *  - Priority Fix Order   - a diagnosis-led full ranking: Primary first,
 *    Secondary second, then the remaining pillars by current severity.""",
            "constraint engine header",
        ),
        (
            """  /** 2-3 pillars, ordered Identity -> Structure -> Execution. */
  priority_fix_order: InevitableStandardPillar[];""",
            """  /** Full 6-pillar diagnosis-led sequence: Primary, Secondary, then severity. */
  priority_fix_order: InevitableStandardPillar[];""",
            "constraint result contract",
        ),
        (
            """  // 4) Priority fix order: the FULL 6-pillar ranking, sequenced strictly by
  //    Method layer (Identity -> Structure -> Execution) regardless of which
  //    pillar is numerically lowest, then by severity (lowest % first) within
  //    each layer. Reports slice this single list: the Diagnostic Snapshot
  //    shows the top 3, the Full Diagnostic shows all 6 (spec section 3).
  const priorityFixOrder = [...INEVITABLE_STANDARD_PILLARS].sort(
    (a, b) =>
      methodLayerIndex(a) - methodLayerIndex(b) ||
      pillarPercentage(score, a) - pillarPercentage(score, b) ||
      pillarOrderIndex(a) - pillarOrderIndex(b),
  );""",
            """  // 4) Priority fix order: diagnosis first.
  //
  //    The Primary Constraint is the highest-leverage intervention point.
  //    The Secondary Constraint is the issue most likely to reinforce or
  //    recreate it. Those two therefore lead the sequence. The remaining four
  //    pillars follow by current severity (lowest percentage first), with the
  //    canonical pillar order as a deterministic tie-break.
  //
  //    Identity -> Structure -> Execution remains the Method architecture used
  //    to explain dependencies and what helps a change hold. It does not
  //    override the diagnostic intervention sequence.
  const remainingBySeverity = rankedPillars.filter(
    (pillar) =>
      pillar !== primaryConstraint && pillar !== secondaryConstraint,
  );

  const priorityFixOrder: InevitableStandardPillar[] = [
    primaryConstraint,
    secondaryConstraint,
    ...remainingBySeverity,
  ];""",
            "constraint priority algorithm",
        ),
    ],
)

# ---------------------------------------------------------------------------
# 2. Regression tests: lock the diagnosis-led order
# ---------------------------------------------------------------------------
changes[FILES["tests"]] = transform(
    FILES["tests"],
    [
        (
            """    // Full 6-pillar ranking: Identity, then Structure by severity, then Execution
    // by severity. offer 66.7 < revenue_model 75 < positioning 83.3; sales 16.7 < decision 66.7.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "offer",
      "revenue_model",
      "positioning",
      "sales",
      "decision",
    ]);""",
            """    // Primary first, Secondary second, then remaining pillars by severity.
    expect(result.priority_fix_order).toEqual([
      "sales",
      "offer",
      "decision",
      "identity",
      "revenue_model",
      "positioning",
    ]);""",
            "test: clearly weakest primary order",
        ),
        (
            """    // Structure: offer 75 and revenue_model 75 tie -> canonical order; positioning 83.3 last.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "offer",
      "revenue_model",
      "positioning",
      "sales",
      "decision",
    ]);""",
            """    // The override makes Identity Primary; Sales is the reinforcing Secondary.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "sales",
      "offer",
      "revenue_model",
      "positioning",
      "decision",
    ]);""",
            "test: identity override order",
        ),
        (
            """    // offer 66.7 < positioning 75 = revenue_model 75; decision 25 < sales 66.7.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "offer",
      "positioning",
      "revenue_model",
      "decision",
      "sales",
    ]);""",
            """    // Decision is Primary; Offer is Secondary; the rest follow by severity.
    expect(result.priority_fix_order).toEqual([
      "decision",
      "offer",
      "sales",
      "identity",
      "positioning",
      "revenue_model",
    ]);""",
            "test: decision primary order",
        ),
        (
            """    // All equal -> Method layer order, then canonical pillar order within a layer.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "positioning",
      "offer",
      "revenue_model",
      "sales",
      "decision",
    ]);""",
            """    // All equal -> Primary and Secondary first, then canonical order for the tie.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "positioning",
      "offer",
      "sales",
      "revenue_model",
      "decision",
    ]);""",
            "test: flat profile order",
        ),
        (
            '  it("always returns the full 6-pillar ranking, layer-sequenced then severity-sorted", () => {',
            '  it("always returns the full 6-pillar diagnosis-led ranking", () => {',
            "test name: full ranking",
        ),
        (
            """    // Identity (layer 0). Structure by severity: offer 50, positioning 66.7,
    // revenue_model 66.7 (canonical tiebreak). Execution by severity: decision 25, sales 58.3.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "offer",
      "positioning",
      "revenue_model",
      "decision",
      "sales",
    ]);""",
            """    // Decision Primary, Offer Secondary, then remaining pillars by severity.
    expect(result.priority_fix_order).toEqual([
      "decision",
      "offer",
      "identity",
      "sales",
      "positioning",
      "revenue_model",
    ]);""",
            "test: full ranking expected order",
        ),
        (
            '  it("sequences the priority fix order Identity -> Structure -> Execution regardless of which pillar is primary", () => {',
            '  it("starts the priority fix order with Primary then Secondary regardless of Method layer", () => {',
            "test name: primary first",
        ),
        (
            """    // Identity leads the full ranking even though Sales is the primary constraint;
    // Structure pillars all tie at 83.3 -> canonical order.
    expect(result.priority_fix_order).toEqual([
      "identity",
      "positioning",
      "offer",
      "revenue_model",
      "sales",
      "decision",
    ]);
    expect(result.priority_fix_order.slice(0, 3)).toEqual([
      "identity",
      "positioning",
      "offer",
    ]);""",
            """    // Sales is the intervention point; Identity is the reinforcing Secondary.
    // The remaining tied pillars use canonical order.
    expect(result.priority_fix_order).toEqual([
      "sales",
      "identity",
      "positioning",
      "offer",
      "revenue_model",
      "decision",
    ]);
    expect(result.priority_fix_order.slice(0, 3)).toEqual([
      "sales",
      "identity",
      "positioning",
    ]);""",
            "test: cross-layer primary expected order",
        ),
    ],
)

# ---------------------------------------------------------------------------
# 3. Shared resolver: correct historical stored results at render time
# ---------------------------------------------------------------------------
changes[FILES["shared"]] = transform(
    FILES["shared"],
    [
        (
            """/**
 * Full 6-pillar priority order. Uses the stored constraint engine order when
 * present; otherwise falls back to ascending pillar percentage (lowest first),
 * matching how Report 1 degrades.
 */
export function resolvePriorityOrder(
  constraints: ConstraintResult | null,
  pillarView: PillarView[],
): PillarKey[] {
  const stored = Array.isArray(constraints?.priority_fix_order)
    ? (constraints!.priority_fix_order!.filter(Boolean) as string[])
    : [];

  const ordered = stored.filter((key): key is PillarKey =>
    PILLARS.some((pillar) => pillar.key === key),
  );

  // Ensure all six appear even if stored data is a short pre-change list.
  for (const pillar of [...pillarView].sort((a, b) => a.percentage - b.percentage)) {
    if (!ordered.includes(pillar.key)) ordered.push(pillar.key);
  }

  return ordered;
}""",
            """/**
 * Full 6-pillar diagnosis-led priority order.
 *
 * Older completed assessments may carry a stored priority_fix_order generated
 * by the earlier Method-layer sorter. Do not trust that stale order at render
 * time. Rebuild the sequence from the stored Primary/Secondary diagnosis and
 * current pillar percentages so existing reports are corrected immediately.
 *
 * Order:
 *   1. Primary Constraint
 *   2. Secondary Constraint
 *   3-6. Remaining pillars by severity, canonical order as tie-break
 *
 * Identity -> Structure -> Execution remains the dependency architecture used
 * to explain what helps a change hold; it does not override where the diagnosis
 * says to begin.
 */
export function resolvePriorityOrder(
  constraints: ConstraintResult | null,
  pillarView: PillarView[],
): PillarKey[] {
  const isPillarKey = (value: unknown): value is PillarKey =>
    typeof value === "string" &&
    PILLARS.some((pillar) => pillar.key === value);

  const ordered: PillarKey[] = [];
  const primary = constraints?.primary_constraint;
  const secondary = constraints?.secondary_constraint;

  if (isPillarKey(primary)) ordered.push(primary);
  if (isPillarKey(secondary) && secondary !== primary) ordered.push(secondary);

  const severitySorted = [...pillarView].sort(
    (a, b) =>
      a.percentage - b.percentage ||
      PILLARS.findIndex((pillar) => pillar.key === a.key) -
        PILLARS.findIndex((pillar) => pillar.key === b.key),
  );

  for (const pillar of severitySorted) {
    if (!ordered.includes(pillar.key)) ordered.push(pillar.key);
  }

  return ordered;
}""",
            "shared priority resolver",
        ),
    ],
)

# ---------------------------------------------------------------------------
# 4. 30/60/90 helper documentation
# ---------------------------------------------------------------------------
changes[FILES["templates"]] = transform(
    FILES["templates"],
    [
        (
            """ * Three phases, one per 30-day window, following the resolved 6-pillar priority
 * fix order (Method-layer sequenced) — the same order the reports show. Each
 * phase is tagged with how its pillar relates to the constraint findings.""",
            """ * Three phases, one per 30-day window, following the resolved diagnosis-led
 * priority order — Primary Constraint first, Secondary Constraint second, then
 * the next most severe pillar. Each phase is tagged with how its pillar relates
 * to the constraint findings.""",
            "90-day helper documentation",
        ),
    ],
)

# ---------------------------------------------------------------------------
# 5. Full Diagnostic: remove the contradiction and align key wording with Figma
# ---------------------------------------------------------------------------
changes[FILES["full"]] = transform(
    FILES["full"],
    [
        (
            """      <p className="text-[12px] leading-6 text-[#918a7d]">
        Work sequences top to bottom: Identity must hold before Structure, and Structure
        before Execution. That is why the priorities and the 30/60/90-day focus follow this
        order rather than starting with whichever pillar scores lowest.
      </p>""",
            """      <p className="text-[12px] leading-6 text-[#918a7d]">
        These layers explain what helps a change hold; they do not replace the diagnosis.
        The Primary Constraint tells you where to begin, the Secondary Constraint shows
        what may recreate it, and the layers show what needs to support the change around them.
      </p>""",
            "method layer contradiction",
        ),
        (
            """    const primaryFixPosition = primaryKey ? priorityOrder.indexOf(primaryKey) : -1;
""",
            "",
            "remove primary fix position",
        ),
        (
            """    const planPillars = new Set(plan.map((phase) => phase.pillar));
    const primaryOutsidePlan =
      !!primaryKey && !planPillars.has(primaryKey) && primaryFixPosition >= 0;
    const layersBeforePrimary =
      primaryKey && METHOD_LAYER_LABEL[primaryKey] === "Execution"
        ? "Identity and Structure"
        : primaryKey && METHOD_LAYER_LABEL[primaryKey] === "Structure"
          ? "Identity"
          : "";
""",
            "",
            "remove deferred-primary calculations",
        ),
        (
            """      primaryFixPosition,
""",
            "",
            "remove primary fix position return",
        ),
        (
            """      primaryOutsidePlan,
      layersBeforePrimary,
""",
            "",
            "remove deferred-primary return values",
        ),
        (
            """    primaryOutsidePlan,
    layersBeforePrimary,
""",
            "",
            "remove deferred-primary destructuring",
        ),
        (
            """            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              The six pillars group into three layers. The chain above only moves if these
              hold in order.
            </p>""",
            """            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              The six pillars sit in three layers. Each layer depends on the one before it,
              which is why a problem that appears in execution can have quieter dependencies
              elsewhere. The layers explain what helps the intervention hold; they do not
              override the Primary Constraint as the place to begin.
            </p>""",
            "full report method explanation",
        ),
        (
            """            {primaryOutsidePlan && layersBeforePrimary ? (
              <p
                className="mt-6 border-l-2 pl-5 text-[13px] leading-6 text-[#4b5563]"
                style={{ borderColor: GOLD }}
              >
                <strong className="font-semibold" style={{ color: INK }}>
                  {pillarLabel(primaryKey)}
                </strong>{" "}
                is your primary constraint. It sits later in this sequence because{" "}
                {layersBeforePrimary} work compounds first — the same logic as the priority
                order. It is not being deferred; it is being set up to hold.
              </p>
            ) : null}

""",
            "",
            "remove deferred-primary UI note",
        ),
        (
            """            <p className="mt-8 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Everything in this report points at the earliest link that is not yet holding.
              Strengthen that, in sequence, and the rest of the chain has something solid to
              move against.
            </p>""",
            """            <p className="mt-8 max-w-2xl text-[15px] leading-7 text-[#4b5563]">
              Everything in this report points at the highest-leverage constraint in the
              current system. Strengthen that first, then the issue most likely to recreate
              it, while using the Method layers to make the change hold.
            </p>""",
            "full report closing",
        ),
    ],
)

# ---------------------------------------------------------------------------
# 6. Implementation spec: prevent the old Method-layer sorting rule returning
# ---------------------------------------------------------------------------
changes[FILES["spec"]] = transform(
    FILES["spec"],
    [
        (
            """- **Priority Fix Order**: sequence (1st, 2nd, 3rd) — never try to fix everything at once. Identity must hold before Structure; Structure must hold before Execution.""",
            """- **Priority Fix Order**: diagnosis-led intervention sequence — Primary Constraint first, Secondary Constraint second, then the remaining pillars by current severity. Never try to fix everything at once. Identity → Structure → Execution remains the Method dependency architecture, but it does not override the diagnosed intervention point.""",
            "spec priority definition",
        ),
        (
            """Priority Fix Order is a **full ranking of all 6 pillars**, sequenced strictly by Method layer — Identity, then Structure, then Execution — regardless of which pillar is numerically lowest. Within a layer, order by severity (lowest % first). The order is explicitly *not* a ranking of importance — it's the sequence in which work compounds fastest, per the approved report copy ("The order is not a ranking of importance. It is the sequence in which work compounds fastest for this result.").""",
            """Priority Fix Order is a **full ranking of all 6 pillars**, led by the diagnosis: Primary Constraint first, Secondary Constraint second, then the remaining four pillars by severity (lowest % first; canonical pillar order breaks ties). Identity → Structure → Execution remains the dependency model used to explain what supports a change and why a constraint may be recreated; it must not push the Primary Constraint later in the intervention sequence. The order is explicitly *not* a ranking of abstract importance — it is the sequence in which work should be addressed for this result.""",
            "spec full priority rule",
        ),
        (
            """**Single source of truth, sliced per report:** the engine (`constraintEngine.ts`) always returns the full 6-pillar ranking. Individual reports decide how much to show — the Diagnostic Snapshot shows only the top 3 ("Your First Three Priorities"), the Full Diagnostic shows all 6, numbered 01–06. Do not build two separate ranking outputs — slicing in the UI guarantees both reports can never silently disagree.""",
            """**Shared diagnosis, report-specific action treatment:** the engine (`constraintEngine.ts`) always returns the full 6-pillar diagnosis-led ranking and the Full Diagnostic shows all 6, numbered 01–06. The Diagnostic Snapshot's "Your First Three Priorities" is an action-focused surface: it must begin with the Primary Constraint and may select the next two immediate actions from the current severity pattern so the short report remains practical. Both surfaces must agree on Primary and Secondary Constraint even when the Snapshot action cards are not a literal slice of the six-pillar list.""",
            "spec report-specific priority treatment",
        ),
    ],
)

# All source matching succeeded. Only now write files.
for path, new_text in changes.items():
    path.write_text(new_text, encoding="utf-8")

print("Applied Full Diagnostic alignment to:")
for path in changes:
    print("  -", path.relative_to(ROOT))

print("\nRegression expectations:")
print("  Sarah reference: Sales -> Decision -> Revenue Model -> Offer -> Positioning -> Identity")
print("  Lisa example:    Sales -> Identity -> Positioning -> Decision -> Offer -> Revenue Model")
print("\nNo commit, push, merge, or deployment was performed.")
print("\nNow run:")
print("  pnpm --filter web test -- constraintEngine.test.ts")
print("  git diff -- apps/web/lib/inevitable-standard apps/web/app/t/[token]/full-report apps/web/app/t/[token]/report/inevitableStandardShared.tsx docs/inevitable-standard-spec.md")
