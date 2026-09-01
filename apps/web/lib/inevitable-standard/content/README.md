# The Inevitable Standard — report copy content layer

`reportCopy.ts` holds the report-facing prose for The Inevitable Standard report,
separated from the report components so it can be revised without a code change to
rendering logic.

## What lives here

- **Data only.** No scoring, constraint, or presentation logic. The scoring and
  constraint engines never import this module; only the report components do.
- Content is keyed **pillar → band → section**:
  - pillars: `identity`, `positioning`, `offer`, `sales`, `revenue_model`, `decision`
  - bands: `red`, `amber`, `green` (the report maps the score model's
    `high_risk` / `medium_risk` / `low_risk` to these via `garForRisk()`)
  - sections: `snapshot_line`, `what_this_means`, `what_appears_working`,
    `where_leaking`, `pathway_impact`, `focus_now`, `what_to_watch`,
    `progress_looks_like`
- **Not every pillar/band/section combination is filled.** Missing entries are
  intentional. Accessors return `{}` / `null`, and the components omit the
  section entirely rather than rendering an empty heading.

## Source

All copy is drawn from:

> **The Inevitable Standard - Knowledge Base v1, 6 August 2026**

recorded in `source_version` at the top of `reportCopy.ts`. If that document is
revised, update `source_version` and re-verify every entry against the new text.

## Sourcing standard for new or changed content

Content may only be added under a **direct-quote-or-labeled-application** standard.
Every entry carries a `provenance` field:

- `"direct"` — a close paraphrase of an actual passage in the Knowledge Base.
- `"applied"` — the book's *own* reasoning, extended to a case it does not narrate
  directly (for example a partial / Amber state), where the logic clearly carries
  over. Use the optional `note` field to record the rationale for the inference.

**Nothing is written outside those two categories.** Do not invent copy, do not
import phrasing from mockups or other documents, and do not "improve" drafted
copy — structuring it is the job here, not editing it.

### `text` vs `note`

- **`text`** is what a founder reads. Customer-ready prose only: no citations
  (`Ch5`, `(Ch6/7)`), no meta-commentary (`the book assumes…`, `the source's own
  example`), no `direct` / `applied` labelling. A test enforces the no-citation
  rule.
- **`note`** holds the passage cited and the rationale for an `applied` line. It
  is never rendered. `provenance` holds the label.

When you lift a line from a working draft that interleaves rationale with copy,
split it: the founder-facing sentence goes in `text`, everything about *why it is
defensible* goes in `note`.

## Positioning is intentionally incomplete

`positioning.status` is `"provisional"`. The Knowledge Base has no dedicated
treatment of market positioning as a topic distinct from offer packaging (Ch5),
so only `what_this_means`, `where_leaking` and `focus_now` are populated, each
marked `[applied, weak]`. The remaining sections are deliberately blank.

Treat the Positioning entries as placeholders. Rebuild this pillar once Genene
has supplied direct source material for it, then set `status` to `"complete"`.

## Where it is read

- `app/t/[token]/report/InevitableStandardReportClient.tsx` (Diagnostic
  Snapshot / Report 1) reads the primary-constraint pillar's `what_this_means`
  (then `where_leaking`) for its band, and falls back to the in-component
  `PILLAR_CONSTRAINT_COPY` string when the content layer has no entry.
- The full section set is stored here ahead of the Report 2 full pillar chapter,
  which will render the remaining sections.
