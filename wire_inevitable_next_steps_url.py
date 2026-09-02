#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()
FILES = {
    "shared": ROOT / "apps/web/app/t/[token]/report/inevitableStandardShared.tsx",
    "snapshot": ROOT / "apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx",
    "full": ROOT / "apps/web/app/t/[token]/full-report/InevitableStandardFullDiagnosticClient.tsx",
    "insider_page": ROOT / "apps/web/app/portal/insider-insights/[slug]/[takerId]/page.tsx",
    "insider_client": ROOT / "apps/web/app/portal/insider-insights/[slug]/[takerId]/InsiderInsightsReportClient.tsx",
}

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: expected exactly one source match, found {count}. No files were written."
        )
    return text.replace(old, new, 1)

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

missing = [str(path) for path in FILES.values() if not path.exists()]
if missing:
    print("Missing expected files:")
    for path in missing:
        print("  -", path)
    sys.exit(1)

branch = branch_name()
if branch and branch not in {"feature/inevitable-standard", "fix/inevitable-report-alignment"}:
    print(f"Current branch is {branch!r}.")
    sys.exit(1)

pending = {}

shared = FILES["shared"].read_text(encoding="utf-8")
shared = replace_once(
    shared,
    '''export type ResultPayload = {
  test_name?: string | null;
  org_name?: string | null;
  completed_at?: string | null;''',
    '''export type ResultPayload = {
  test_name?: string | null;
  org_name?: string | null;
  completed_at?: string | null;
  link?: {
    next_steps_url?: string | null;
    redirect_url?: string | null;
  } | null;''',
    "ResultPayload link metadata",
)
pending[FILES["shared"]] = shared

snapshot = FILES["snapshot"].read_text(encoding="utf-8")
snapshot = replace_once(
    snapshot,
    '''  const statedProblem = String(score.context_answers?.[13] || "").trim();

  return (''',
    '''  const statedProblem = String(score.context_answers?.[13] || "").trim();
  const nextStepsHref =
    (payload?.link?.next_steps_url || payload?.link?.redirect_url || "").trim() ||
    null;

  return (''',
    "Snapshot next-steps URL",
)
count = snapshot.count('href="#priorities"')
if count != 2:
    raise RuntimeError(f"Snapshot: expected 2 Next step anchors, found {count}.")
snapshot = snapshot.replace('href="#priorities"', 'href={nextStepsHref || "#priorities"}')
pending[FILES["snapshot"]] = snapshot

full = FILES["full"].read_text(encoding="utf-8")
full = replace_once(
    full,
    '''function SidebarIndex({
  sections,
  activeSection,
  readiness: _readiness,
  band: _band,
}: {
  sections: Array<{ id: string; label: string }>;
  activeSection: string;
  readiness: number;
  band: string;
}) {''',
    '''function SidebarIndex({
  sections,
  activeSection,
  readiness: _readiness,
  band: _band,
  nextStepsHref,
}: {
  sections: Array<{ id: string; label: string }>;
  activeSection: string;
  readiness: number;
  band: string;
  nextStepsHref: string | null;
}) {''',
    "Full sidebar next-steps prop",
)
count = full.count('href="#plan"')
if count != 2:
    raise RuntimeError(f"Full Diagnostic: expected 2 Next step anchors, found {count}.")
full = full.replace('href="#plan"', 'href={nextStepsHref || "#plan"}')
full = replace_once(
    full,
    '''  } = view;

  return (''',
    '''  } = view;

  const nextStepsHref =
    (payload?.link?.next_steps_url || payload?.link?.redirect_url || "").trim() ||
    null;

  return (''',
    "Full next-steps URL",
)
full = replace_once(
    full,
    '''          readiness={overallPercentage}
          band={bandDescriptor}
        />''',
    '''          readiness={overallPercentage}
          band={bandDescriptor}
          nextStepsHref={nextStepsHref}
        />''',
    "Full sidebar next-steps wiring",
)
pending[FILES["full"]] = full

page = FILES["insider_page"].read_text(encoding="utf-8")
page = replace_once(
    page,
    '''    .select("id, org_id, test_id, first_name, last_name, email, company")''',
    '''    .select("id, org_id, test_id, link_id, link_token, first_name, last_name, email, company")''',
    "Insider taker link metadata",
)
page = replace_once(
    page,
    '''  const fullName = [taker.first_name, taker.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const report = buildInsiderInsightsReport({''',
    '''  let nextStepsHref: string | null = null;
  if (taker.link_id || taker.link_token) {
    let linkQuery = sb
      .from("test_links")
      .select("next_steps_url, redirect_url");

    linkQuery = taker.link_id
      ? linkQuery.eq("id", taker.link_id)
      : linkQuery.eq("token", taker.link_token);

    const { data: originatingLink } = await linkQuery.maybeSingle();
    nextStepsHref =
      (
        originatingLink?.next_steps_url ||
        originatingLink?.redirect_url ||
        ""
      ).trim() || null;
  }

  const fullName = [taker.first_name, taker.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const report = buildInsiderInsightsReport({''',
    "Insider originating link lookup",
)
page = replace_once(
    page,
    '''      backHref={`/portal/${encodeURIComponent(slug)}/database/${encodeURIComponent(
        taker.id,
      )}`}
    />''',
    '''      backHref={`/portal/${encodeURIComponent(slug)}/database/${encodeURIComponent(
        taker.id,
      )}`}
      nextStepsHref={nextStepsHref}
    />''',
    "Insider next-steps prop wiring",
)
pending[FILES["insider_page"]] = page

client = FILES["insider_client"].read_text(encoding="utf-8")
client = replace_once(
    client,
    '''export default function InsiderInsightsReportClient({
  report,
  backHref,
}: {
  report: InsiderInsightsReport;
  backHref: string;
}) {''',
    '''export default function InsiderInsightsReportClient({
  report,
  backHref,
  nextStepsHref,
}: {
  report: InsiderInsightsReport;
  backHref: string;
  nextStepsHref: string | null;
}) {''',
    "Insider client next-steps prop",
)
client = replace_once(
    client,
    '''href="#suggested-sequence"''',
    '''href={nextStepsHref || "#suggested-sequence"}''',
    "Insider Next step href",
)
pending[FILES["insider_client"]] = client

for path, content in pending.items():
    if not content.strip():
        raise RuntimeError(f"Refusing to write empty file: {path}")

for path, content in pending.items():
    path.write_text(content, encoding="utf-8")

print("Wired Inevitable Standard Next step buttons to the configured test-link URL:")
for path in pending:
    print("  -", path.relative_to(ROOT))
print()
print("Behaviour:")
print("  - uses test_links.next_steps_url first")
print("  - falls back to redirect_url for older links")
print("  - keeps the existing in-report anchor only if neither URL is configured")
print("  - Snapshot and Full use data.link from the existing public result API")
print("  - Insider resolves the originating link from the taker's link_id/link_token")
print()
print("No scoring, Constraint Engine, report-content, or visual-layout changes.")
print("No commit, push, merge, or deployment was performed.")
print()
print("Run next:")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/buildInsiderInsightsReport.test.ts")
print("  pnpm --dir apps/web exec vitest run lib/inevitable-standard/constraintEngine.test.ts")
print("  pnpm --dir apps/web run typecheck")
print("  git diff --check")
