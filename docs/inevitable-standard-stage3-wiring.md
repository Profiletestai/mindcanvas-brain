# Stage 3 — Wire Constraint Engine + RRE into submit/result (build notes)

_Companion to `inevitable-standard-spec.md` §3 and §4. Status: built, tested, committed (`fb6a699a`)._

## Files changed

| File | Change |
|---|---|
| `apps/web/app/api/public/test/[token]/submit/route.ts` | Import both engines; after `mapped.score` succeeds, derive constraints + RRE inside the existing Inevitable Standard block; persist as sibling keys on `totals.inevitable_standard`; add two booleans to `totals.meta.inevitable_standard` |
| `apps/web/app/api/public/test/[token]/result/route.ts` | Pass `constraints` / `revenue_in_structure` through in `data.inevitable_standard`, normalising absent → `null` |
| `apps/web/lib/inevitable-standard/definition.ts` | One line: `INEVITABLE_STANDARD_CONSTRAINT_VERSION` `"…_v1_draft"` → `"…_v1"` |

Not touched: `constraintEngine.ts`, `revenueInStructure.ts`, `scoreInevitableStandard.ts`, `questions.ts`, `mapSubmission.ts`, `InevitableStandardReportClient.tsx`.

## Test output

```
Test Files  11 passed (11)
     Tests  109 passed (109)
```

`npx tsc --noEmit` → exit 0.

## Storage shape

`totals.inevitable_standard` was the flat `InevitableStandardScoreResult`. It now carries two extra sibling keys:

```js
totals.inevitable_standard = {
  ...score,                            // unchanged score fields
  constraints: { … } | null,           // deriveInevitableStandardConstraints() result
  revenue_in_structure: { … } | null,  // calculateInevitableStandardRevenueInStructure() result
}

totals.meta.inevitable_standard = {
  model_version, scoring_version, constraint_version, scoring_complete, qa_flags,
  constraints_derived: boolean,           // NEW
  revenue_in_structure_derived: boolean,  // NEW
}
```

`result` returns the whole object under `data.inevitable_standard`, so Stage 4 reads
`data.inevitable_standard.constraints` and `data.inevitable_standard.revenue_in_structure`
(each an object, or `null`).

## Engine inputs (all reused from `mapped`, nothing re-derived)

- **Constraint engine:** `{ score: mapped.score }`. The engine reads the founder's Q13/Q29
  free text from `score.context_answers`, which `mapSubmission` has already populated.
- **RRE:** `primary_constraint` and `confidence` from the constraint result;
  `primary_constraint_pillar_percentage` from
  `mapped.score.pillars[primary_constraint].percentage` (coerced with `Number`, falls back
  to `0` if non-finite); `commercial_context` from `mapped.commercial_context`.
- No `approximate_revenue_override` is passed — no UI collects a specific 10m+ figure yet,
  so that band produces the safe zero estimate with `needs_revenue_confirmation: true`.

## Decision 1 — submit: graceful degradation with a logged warning

If either engine throws, the `catch` logs `console.warn("[submit] Inevitable Standard
constraint/RRE derivation failed; storing score only", { taker_id, test_id,
effective_test_id, error })` and the submission is stored with `constraints: null` /
`revenue_in_structure: null`.

Reasoning:

- The readiness score (pillars, overall %, approach mix) is a complete, useful diagnostic
  on its own. The constraint/RRE layer is additive.
- Both functions are pure and synchronous with no IO — on a valid
  `InevitableStandardScoreResult` they cannot realistically throw. A throw would imply a
  corrupted score object, i.e. genuinely exceptional.
- The existing `mapped.issues` check still hard-fails (400). That path means the
  *submission data itself* is incomplete or invalid, so the score would be garbage. A
  constraint/RRE failure carries no such implication, so failing the whole submission
  there would discard a completed quiz and a valid score — strictly worse.
- `constraints_derived` / `revenue_in_structure_derived` in `meta` provide observability
  if it ever happens in production.

## Decision 2 — result: graceful omission, no 409

Missing `constraints` / `revenue_in_structure` (submissions completed before this stage
shipped) → surface `null`, do not 409.

Reasoning:

- Every Inevitable Standard submission made before this ships has a valid score but no
  constraint/RRE data. 409-ing those would retroactively break every existing report link.
- The 409 stays exactly as-is for its real purpose: the base score object is missing or
  not an object (submission genuinely incomplete, or wrong test type).
- Normalising absent values to `null` (rather than leaving them `undefined`) gives the
  Stage 4 client one clean `=== null` check and a single contract regardless of
  submission age.

## The `definition.ts` conflict — flagged

The build brief asked to bump `INEVITABLE_STANDARD_CONSTRAINT_VERSION` **and** listed
`definition.ts` under "do not touch". That constant lives in `definition.ts`.

Interpretation taken: the version bump is the specific, deliberate instruction; the "do
not touch" is the generic guard against changing model/scoring logic. Only the one-line
string change was made (`inevitable_standard_constraints_v1_draft` →
`inevitable_standard_constraints_v1`), matching the sibling constants
(`inevitable_standard_model_v1`, `inevitable_standard_scoring_v1`). No test asserts the
literal string. Revert to `_draft` if that call is wrong.

## Test gap (noted, not filled)

The repo's `route.test.ts` pattern (`vi.mock` the handful of lib deps a thin route uses)
does not scale to the public submit handler (~3,200 lines, Supabase calls throughout,
billing, email). Per the brief, no new harness was invented. Coverage rests on:

- the two engines' full unit suites (unchanged, still green)
- `tsc --noEmit`
- manual verification

A focused integration test for the submit/result routes would be its own piece of work.

## Not done in this stage (Stage 4)

- `InevitableStandardReportClient.tsx`: render the Primary/Secondary/False Constraint
  sections, Priority Fix Order, the RRE range block, the customer-value translation line,
  and the confidence-tuned disclaimer — all conditional on the fields being non-null.
- Any gating for Lite vs Full vs Internal report tiers.
