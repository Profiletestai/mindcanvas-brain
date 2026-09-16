#!/usr/bin/env python3
'''
Restore the existing Revenue in Your Structure ($ calculation) to the two
client-facing Inevitable Standard reports.

Run from the mindcanvas-brain repository root:
    python3 restore_inevitable_revenue_in_structure.py

No scoring, formula, Constraint Engine, question, currency, payment, or Insider
logic changes. No commit, push, merge, or deployment.
'''

from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()

FILES = {
    "snapshot": ROOT / "apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx",
    "full": ROOT / "apps/web/app/t/[token]/full-report/InevitableStandardFullDiagnosticClient.tsx",
}

def current_branch():
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
            f"{label}: expected exactly one source match, found {count}. "
            "No files were written."
        )
    return text.replace(old, new, 1)

missing = [str(path) for path in FILES.values() if not path.exists()]
if missing:
    print("Missing expected files:")
    for path in missing:
        print("  -", path)
    print("\nRun this script from the mindcanvas-brain repository root.")
    sys.exit(1)

branch = current_branch()
if branch and branch not in {
    "feature/inevitable-standard",
    "fix/inevitable-report-alignment",
}:
    print(f"Current branch is {branch!r}.")
    print("Switch to feature/inevitable-standard (or a fix branch from it) first.")
    sys.exit(1)

pending = {}

# Snapshot ---------------------------------------------------------------
snapshot_path = FILES["snapshot"]
snapshot = snapshot_path.read_text(encoding="utf-8")

snapshot = replace_once(
    snapshot,
    '''  ReadinessDonut,
  bandLabelFor,''',
    '''  ReadinessDonut,
  RevenueInStructurePanel,
  bandLabelFor,''',
    "Snapshot shared RRE import",
)

primary_to_secondary = '''</p></div> : null}{secondaryKey && secondaryPillar ? <div className="rounded border border-[#bd8b3d] border-l-[5px] bg-white p-6">'''

rre_between = '''</p></div> : null}{score.revenue_in_structure ? <div className="rounded border border-[#ddd4bd] border-l-[5px] bg-[#fffdf9] p-6" style={{ borderLeftColor: FIGMA.gold }}><RevenueInStructurePanel rre={score.revenue_in_structure} variant="compact" /></div> : null}{secondaryKey && secondaryPillar ? <div className="rounded border border-[#bd8b3d] border-l-[5px] bg-white p-6">'''

snapshot = replace_once(
    snapshot,
    primary_to_secondary,
    rre_between,
    "Snapshot RRE position",
)

pending[snapshot_path] = snapshot

# Full Diagnostic --------------------------------------------------------
full_path = FILES["full"]
full = full_path.read_text(encoding="utf-8")

full = replace_once(
    full,
    '''  ReadinessDonut,
  REVENUE_CHAIN,''',
    '''  ReadinessDonut,
  RevenueInStructurePanel,
  REVENUE_CHAIN,''',
    "Full shared RRE import",
)

full = replace_once(
    full,
    '''    list.push({ id: "approach", label: "Commercial Decision Intelligence" });
    list.push({ id: "plan", label: "Your next ninety days" });''',
    '''    list.push({ id: "approach", label: "Commercial Decision Intelligence" });
    if (score?.revenue_in_structure) {
      list.push({ id: "revenue-structure", label: "Revenue in your structure" });
    }
    list.push({ id: "plan", label: "Your next ninety days" });''',
    "Full sidebar RRE entry",
)

full = replace_once(
    full,
    '''  }, [view]);''',
    '''  }, [view, score]);''',
    "Full sidebar dependency",
)

approach_to_plan = '''          </Chapter>

          {/* 30/60/90 */}
          <Chapter
            id="plan"'''

rre_chapter = '''          </Chapter>

          {/* Revenue in Your Structure — existing RRE calculation, restored */}
          {score.revenue_in_structure ? (
            <Chapter
              id="revenue-structure"
              eyebrow="Revenue in Your Structure"
              title="The commercial value sitting inside the current build"
            >
              <p className="max-w-3xl text-[15px] leading-7 text-[#66727d]">
                This is a modelled estimate of the commercial value most closely associated
                with the Primary Constraint — value that a more deliberate structure could
                make easier to convert, retain or release. It is a location and a scale, not
                a forecast.
              </p>
              <div
                className="mt-8 rounded-[12px] border bg-[#fffdf9] p-6 sm:p-8 print:break-inside-avoid"
                style={{ borderColor: IVORY_BORDER }}
              >
                <RevenueInStructurePanel
                  rre={score.revenue_in_structure}
                  variant="full"
                />
              </div>
            </Chapter>
          ) : null}

          {/* 30/60/90 */}
          <Chapter
            id="plan"'''

full = replace_once(
    full,
    approach_to_plan,
    rre_chapter,
    "Full RRE chapter",
)

pending[full_path] = full

# Validate all transforms before writing.
for path, text in pending.items():
    if not text.strip():
        raise RuntimeError(f"Refusing to write an empty file: {path}")

for path, text in pending.items():
    path.write_text(text, encoding="utf-8")

print("Restored Revenue in Your Structure to:")
for path in pending:
    print("  -", path.relative_to(ROOT))

print()
print("Behaviour:")
print("  - Snapshot: compact dollar range after Primary Constraint")
print("  - Full: dedicated Revenue in Your Structure chapter before 30/60/90")
print("  - Full uses the existing customer-value translation when present")
print("  - existing currency, confirmation state and disclaimer are preserved")
print()
print("Not changed:")
print("  - RRE formula")
print("  - scoring")
print("  - Constraint Engine")
print("  - assessment questions / C1-C3")
print("  - Insider Insights")
print("  - payment/report-access logic")
print()
print("No commit, push, merge, or deployment was performed.")
print()
print("Run next:")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/revenueInStructure.test.ts")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/constraintEngine.test.ts")
print("  pnpm --dir apps/web run typecheck")
print("  git diff --check")
