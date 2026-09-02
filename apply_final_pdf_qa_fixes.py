#!/usr/bin/env python3
"""
Final PDF QA fixes for The Inevitable Standard reporting suite.

Run from the mindcanvas-brain repository root:
    python3 apply_final_pdf_qa_fixes.py

Scope is intentionally narrow:
- stop the global GHL chat host from printing;
- keep Figma desktop grids intact in A4 landscape print;
- reduce print-only padding / forced page breaks that create mostly blank pages;
- remove duplicate Full Diagnostic constraint / priority copy;
- correct one Identity pathway sentence that falsely calls Identity "the actual constraint".

No scoring, Constraint Engine, Insider selection logic, commit, push, merge or deployment.
"""

from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()
FILES = {
    "print_css": ROOT / "apps/web/app/pdf-print.css",
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


def replace_optional_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        print(f"  - {label}: already clean / source form not present")
        return text
    if count != 1:
        raise RuntimeError(
            f"{label}: expected at most one source match, found {count}. No files were written."
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
# 1. Global print CSS: the GHL loader creates a <chat-widget> custom element.
#    Existing CSS hides common iframes/ids but not that host element.
# ---------------------------------------------------------------------------
css = FILES["print_css"].read_text(encoding="utf-8")
css = replace_once(
    css,
    '''  #chat-widget,\n  #chat-widget-container,\n  [id*="lc_text_widget"],''',
    '''  #chat-widget,\n  #chat-widget-container,\n  chat-widget,\n  [id*="chat-widget"],\n  [class*="chat-widget"],\n  [id*="lc_text_widget"],''',
    "print CSS chat-widget host suppression",
)
pending[FILES["print_css"]] = css

# ---------------------------------------------------------------------------
# 2. Diagnostic Snapshot: preserve the approved wide Figma composition in print.
# ---------------------------------------------------------------------------
snapshot = FILES["snapshot"].read_text(encoding="utf-8")
snapshot = replace_once(
    snapshot,
    'className="scroll-mt-6 rounded-[20px] p-[22px] sm:p-[27px] print:break-inside-avoid"',
    'className="scroll-mt-6 rounded-[20px] p-[22px] sm:p-[27px] print:p-4"',
    "Snapshot section print flow",
)
snapshot = replace_once(
    snapshot,
    'className="rounded-[20px] p-6 sm:p-10"',
    'className="rounded-[20px] p-6 sm:p-10 print:p-6"',
    "Snapshot ivory panel print padding",
)
snapshot = replace_once(
    snapshot,
    'className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_263px_388px] xl:items-start"',
    'className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_263px_388px] xl:items-start print:grid-cols-[minmax(0,1fr)_190px_280px] print:items-start print:gap-4"',
    "Snapshot hero print grid",
)
snapshot = replace_once(
    snapshot,
    'className="mx-auto grid max-w-[1275px] gap-8 px-5 py-[88px] lg:grid-cols-[283px_minmax(0,1fr)]"',
    'className="mx-auto grid max-w-[1275px] gap-8 px-5 py-[88px] lg:grid-cols-[283px_minmax(0,1fr)] print:block print:py-8"',
    "Snapshot body print layout",
)
snapshot = replace_once(
    snapshot,
    'className="mt-7 grid grid-cols-2 overflow-hidden rounded-md sm:grid-cols-4"',
    'className="mt-7 grid grid-cols-2 overflow-hidden rounded-md sm:grid-cols-4 print:grid-cols-4"',
    "Snapshot readiness bands print grid",
)
snapshot = replace_once(
    snapshot,
    'className="grid gap-4 border-b py-5 sm:grid-cols-[190px_1fr_82px] sm:items-center"',
    'className="grid gap-4 border-b py-5 sm:grid-cols-[190px_1fr_82px] sm:items-center print:grid-cols-[170px_1fr_76px] print:items-center print:py-3"',
    "Snapshot pillar-row print grid",
)
snapshot = replace_once(
    snapshot,
    'className="mt-7 grid gap-8 lg:grid-cols-[1fr_390px] lg:items-center"',
    'className="mt-7 grid gap-8 lg:grid-cols-[1fr_390px] lg:items-center print:grid-cols-[1fr_300px] print:items-center print:gap-5"',
    "Snapshot decision-intelligence print grid",
)
pending[FILES["snapshot"]] = snapshot

# ---------------------------------------------------------------------------
# 3. Full Diagnostic: compact print flow, remove duplicate copy, preserve grids.
# ---------------------------------------------------------------------------
full = FILES["full"].read_text(encoding="utf-8")
full = replace_once(
    full,
    'className="scroll-mt-8 rounded-[20px] p-[22px] sm:p-[27px] print:break-before-page"',
    'className="scroll-mt-8 rounded-[20px] p-[22px] sm:p-[27px] print:p-4"',
    "Full chapter forced page break",
)
full = replace_once(
    full,
    'className="mt-[26px] rounded-[20px] p-6 sm:p-10"',
    'className="mt-[26px] rounded-[20px] p-6 sm:p-10 print:mt-4 print:p-6"',
    "Full chapter print padding",
)
full = replace_once(
    full,
    '''  const isPrimary = label.toLowerCase().includes("primary");\n  const tone = isPrimary ? "#a8503f" : "#bd8b3d";\n  return (''',
    '''  const isPrimary = label.toLowerCase().includes("primary");\n  const tone = isPrimary ? "#a8503f" : "#bd8b3d";\n  const hint = isPrimary\n    ? "The area most likely to be limiting progress right now."\n    : "The area most likely to reinforce or recreate the primary constraint.";\n  const cleanBody = body.startsWith(hint) ? body.slice(hint.length).trim() : body.trim();\n  return (''',
    "Full constraint dedupe helper",
)
full = replace_once(
    full,
    '''      <p className="mt-2 text-[13px] leading-5 text-[#736c5c]">\n        {isPrimary\n          ? "The area most likely to be limiting progress right now."\n          : "The area most likely to reinforce or recreate the primary constraint."}\n      </p>\n      <p className="mt-4 text-[14px] leading-6 text-[#66727d]">{body}</p>''',
    '''      <p className="mt-2 text-[13px] leading-5 text-[#736c5c]">{hint}</p>\n      {cleanBody ? (\n        <p className="mt-4 text-[14px] leading-6 text-[#66727d]">{cleanBody}</p>\n      ) : null}''',
    "Full constraint duplicate body",
)
full = replace_optional_once(
    full,
    '''                <p className="mt-4 text-[12px] leading-6 text-[#918a7d]">\n                  {PRIORITY_ORDER_NOTE}\n                </p>''',
    "",
    "Full duplicate Priority Fix Order note",
)
full = replace_once(
    full,
    'className="grid gap-[18px] md:grid-cols-4"',
    'className="grid gap-[18px] md:grid-cols-4 print:grid-cols-4 print:gap-3"',
    "Full Revenue-to-Freedom print grid",
)
full = replace_once(
    full,
    'className="grid gap-[22px] md:grid-cols-3"',
    'className="grid gap-[22px] md:grid-cols-3 print:grid-cols-3 print:gap-3"',
    "Full Method layers print grid",
)
full = replace_once(
    full,
    'className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_263px_388px] xl:items-start"',
    'className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_263px_388px] xl:items-start print:grid-cols-[minmax(0,1fr)_190px_280px] print:items-start print:gap-4"',
    "Full hero print grid",
)
full = replace_once(
    full,
    'className="mt-5 grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-6"',
    'className="mt-5 grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6"',
    "Full priority print grid",
)
full = replace_once(
    full,
    'className="mt-7 grid gap-x-12 gap-y-7 md:grid-cols-2"',
    'className="mt-7 grid gap-x-12 gap-y-7 md:grid-cols-2 print:grid-cols-2 print:gap-x-8 print:gap-y-5"',
    "Full pillar chapter print grid",
)
full = replace_once(
    full,
    'className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start"',
    'className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start print:grid-cols-[1fr_300px] print:items-start print:gap-6"',
    "Full decision-intelligence print grid",
)
full = replace_once(
    full,
    'className="mt-8 grid gap-5 md:grid-cols-3"',
    'className="mt-8 grid gap-5 md:grid-cols-3 print:grid-cols-3 print:gap-3"',
    "Full ninety-day print grid",
)
full = replace_once(
    full,
    'className="mx-auto mt-10 grid max-w-[650px] grid-cols-2 text-left sm:grid-cols-4"',
    'className="mx-auto mt-10 grid max-w-[650px] grid-cols-2 text-left sm:grid-cols-4 print:grid-cols-4"',
    "Full closing pathway print grid",
)
pending[FILES["full"]] = full

# ---------------------------------------------------------------------------
# 4. Client-facing content: don't call Identity the actual constraint when it
#    is merely the selected Identity chapter. The source supports weakest-link
#    logic; the live Constraint Engine supplies which pillar is binding.
# ---------------------------------------------------------------------------
old_identity = (
    "A business is a system, only as strong as its weakest link. Effort poured into a strong "
    "link while identity is the actual constraint moves almost nothing, because the system can "
    "only move as much as its narrowest point allows."
)
new_identity = (
    "A business is a system, only as strong as its weakest link. Effort poured into a stronger "
    "link while the binding constraint sits elsewhere moves almost nothing, because the system "
    "can only move as much as its narrowest point allows."
)
content_matches: list[Path] = []
for path in (ROOT / "apps/web/lib/inevitable-standard").rglob("*.ts"):
    try:
        if old_identity in path.read_text(encoding="utf-8"):
            content_matches.append(path)
    except UnicodeDecodeError:
        pass
if len(content_matches) != 1:
    raise RuntimeError(
        "Identity pathway copy: expected exactly one source file containing the known sentence, "
        f"found {len(content_matches)} ({', '.join(str(p) for p in content_matches)}). No files were written."
    )
content_path = content_matches[0]
content_text = content_path.read_text(encoding="utf-8").replace(old_identity, new_identity, 1)
pending[content_path] = content_text

# ---------------------------------------------------------------------------
# 5. Insider Insights: preserve its Figma two-column/strip layouts in print.
#    Do not touch the evidence-led builder — its tests already pass.
# ---------------------------------------------------------------------------
insider = FILES["insider"].read_text(encoding="utf-8")
insider = replace_once(
    insider,
    'className="scroll-mt-6 rounded-[20px] p-[27px] print:break-inside-avoid"',
    'className="scroll-mt-6 rounded-[20px] p-[27px] print:p-4"',
    "Insider section print flow",
)
insider = replace_once(
    insider,
    'className="mt-[26px] rounded-[20px] p-6 sm:p-10"',
    'className="mt-[26px] rounded-[20px] p-6 sm:p-10 print:mt-4 print:p-6"',
    "Insider section print padding",
)
insider = replace_once(
    insider,
    'className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"',
    'className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 print:grid-cols-6"',
    "Insider pillar strip print grid",
)
insider = replace_once(
    insider,
    'className="grid grid-cols-2 gap-3 sm:grid-cols-4"',
    'className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4"',
    "Insider evidence strip print grid",
)
insider = replace_once(
    insider,
    'className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_676px]"',
    'className="mx-auto grid max-w-[1275px] gap-8 xl:grid-cols-[1fr_676px] print:grid-cols-[minmax(0,1fr)_520px] print:gap-5"',
    "Insider hero print grid",
)
insider = replace_once(
    insider,
    'className="grid gap-6 sm:grid-cols-[263px_1fr]"',
    'className="grid gap-6 sm:grid-cols-[263px_1fr] print:grid-cols-[190px_1fr] print:gap-4"',
    "Insider hero metrics print grid",
)
insider = replace_once(
    insider,
    'className="mt-6 grid bg-white md:grid-cols-2"',
    'className="mt-6 grid bg-white md:grid-cols-2 print:grid-cols-2"',
    "Insider predictive print grid",
)
insider = replace_once(
    insider,
    '${last ? "md:col-span-2" : ""}',
    '${last ? "md:col-span-2 print:col-span-2" : ""}',
    "Insider last predictive row print span",
)
insider = replace_once(
    insider,
    'className="scroll-mt-6 rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-12 text-center text-white shadow-xl print:break-inside-avoid"',
    'className="scroll-mt-6 rounded-[20px] bg-gradient-to-r from-[#14263d] to-[#1f2c46] px-8 py-12 text-center text-white shadow-xl print:py-8"',
    "Insider objective print flow",
)
pending[FILES["insider"]] = insider

# All transformations must succeed before writing anything.
for path, text in pending.items():
    if not text.strip():
        raise RuntimeError(f"Refusing to write an empty file: {path}")

for path, text in pending.items():
    path.write_text(text, encoding="utf-8")

print("Applied final PDF QA fixes to:")
for path in pending:
    print("  -", path.relative_to(ROOT))

print("\nVerified scope:")
print("  - no scoring or Constraint Engine changes")
print("  - no Insider evidence-selection changes")
print("  - no Sarah-specific action copy hardcoded into Lisa's report")
print("  - print layout, chat-widget suppression and verified Full copy defects only")
print("\nNo commit, push, merge, or deployment was performed.")
print("\nRun next:")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/buildInsiderInsightsReport.test.ts")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/constraintEngine.test.ts")
print("  pnpm --dir apps/web run typecheck")
print("  git diff --check")
