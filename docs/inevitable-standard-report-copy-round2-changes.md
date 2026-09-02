# Report copy content layer — round 2 (text/note cleanup)

Every `text` field rewritten to customer-ready prose. All 30 entries audited, not
just the flagged ones. Full dump is in
`inevitable-standard-report-copy-content-layer-review.md`.

## What changed since the last review

**All meta pulled out of `text` → into `note`:**

| Entry | was | now (rendered) |
|---|---|---|
| identity/amber `pathway_impact` | "The book's binding-constraint logic: a business is a system…" | "A business is a system, only as strong as its weakest link…" |
| offer/amber `what_to_watch` | "The book's caution on ladders applies here: too many tiers…" | "Too many tiers freeze a buyer rather than helping her choose…" |
| offer/amber `progress_looks_like` | "The book's own example (the \"studio that stopped selling hours,\" Ch5) shows revenue per client roughly tripling…" | "Revenue per client roughly triples within two quarters once a named offer and a three-rung ladder exist…" |
| positioning/amber `what_this_means` | "A named, packaged offer (Ch5) only does its work… — the book assumes this rather than arguing it directly." | "A named, packaged offer only does its work if the right people recognize themselves in it." |
| positioning/amber `where_leaking` / `focus_now` | had "(Ch5)" + "the book's … logic suggests" | citations & rationale moved to `note` |
| revenue_model/amber `what_appears_working`, `what_to_watch`, `progress_looks_like` | "the book's distinction applies", "The book's caution", "The book's own framing…" | clean |
| sales/amber `what_appears_working`, `focus_now`, `what_to_watch`, `progress_looks_like` | "the book's own diagnostic question", "The book's own framework, PROSPER", "the book's named pattern", "The book's own contrast (Ch6/7…)" | clean; PROSPER kept (it's a Method framework name, not a citation) |
| decision/amber `what_appears_working`, `pathway_impact`, `what_to_watch`, `progress_looks_like` | "the book's own distinction", "The book's own contrast", "The book's own diagnostic language", "The book's own example (Ch6/7)" | clean |
| identity/amber `what_appears_working`, `progress_looks_like` | (already split last round) | unchanged |

**Kept in `text`** (not source-structure references): "the Chain (Revenue →
Profit → …)", "PROSPER", `"The retreat into building"`, `"Decision drift"` —
these are named Method concepts that appear customer-side.

## New guardrail

`reportCopy.test.ts` now has a test that fails if any `text` field matches
`/the book/`, `/the source/`, `/\(ch/`, `/ch\.?\s?\d/`, `/chapter \d/`,
`/knowledge base/`.

## Checks

- Tests: **118 passed** (110 baseline + 8)
- `tsc --noEmit`: **clean**
- Text audit script: all 30 `text` fields clean

## Ready to commit — two asks

1. **Approve the cleaned copy** (full list in the review doc), or flag any line
   where I trimmed too much / too little.
2. **Preview:** the on-file real submission hits the red fallback path (no visible
   change). Options:
   - Give me a submission token whose lowest / primary-constraint pillar is Amber, or
   - I push, confirm the red-fallback case renders unchanged + inspect the
     deployed bundle for the new module, and you check an Amber case yourself.
