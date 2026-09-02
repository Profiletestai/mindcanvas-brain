# Stage 1 — Constraint Engine (build notes)

_Companion to `inevitable-standard-spec.md` §3. Status: built, tested, not committed._

## New files

- `apps/web/lib/inevitable-standard/constraintEngine.ts` — pure function, no IO, no model calls
- `apps/web/lib/inevitable-standard/constraintEngine.test.ts` — 12 tests

Nothing else touched: `scoreInevitableStandard.ts`, `questions.ts`, `definition.ts`, the submit route, and the report component are all unchanged.

## Test output

```
✓ lib/inevitable-standard/questions.test.ts (5 tests)
✓ lib/inevitable-standard/constraintEngine.test.ts (12 tests)
✓ lib/inevitable-standard/scoreInevitableStandard.test.ts (7 tests)
✓ lib/inevitable-standard/mapSubmission.test.ts (4 tests)

Test Files  4 passed (4)
     Tests  28 passed (28)
```

`npx tsc --noEmit` → exit 0.

## Public API

```ts
deriveInevitableStandardConstraints({ score, q13_text?, q29_text? }) => {
  constraint_version,
  primary_constraint,           // pillar name
  secondary_constraint,         // pillar name
  false_constraint: { stated_pillar, evidence_pillar, mismatch, explanation } | null,
  false_constraint_rule_id: string | null,
  priority_fix_order: pillar[], // 2–3 pillars, ordered Identity -> Structure -> Execution
  confidence: "High" | "Medium" | "Directional",
  identity_decision_override: boolean,
}
```

`score` is the `InevitableStandardScoreResult` from `scoreInevitableStandard.ts`. `q13_text` / `q29_text` are optional; when omitted the engine reads `score.context_answers[13]` / `[29]`. Explicit arguments win over the stored context answers.

Also exported: `INEVITABLE_STANDARD_METHOD_LAYERS`, `INEVITABLE_STANDARD_FALSE_CONSTRAINT_RULES`, `InevitableStandardFalseConstraintRule` (type), `methodLayerFor()`, `validateInevitableStandardConstraintModel()`, and all five tuning constants.

## Logic summary

1. **Primary constraint** — the weakest pillar, unless a materially-low Identity or Decision pillar (`<= 40%`) sits within `10` points above the numerically-lowest pillar, in which case Identity/Decision is promoted (`identity_decision_override = true`). Identity is checked before Decision. Ties in pillar ranking break on the canonical pillar order for determinism.
2. **Secondary constraint** — the next weakest pillar after the primary is chosen.
3. **False constraint** — v1 deterministic keyword matching against the combined Q13 + Q29 text (case-insensitive substring). Four seed rules: `lead_volume` (stated Positioning / evidence Sales), `price_too_high` (stated Offer / evidence Identity), `new_offer_needed` (stated Offer / evidence Decision), `needs_systems` (stated Revenue Model / evidence Sales). `evidence_pillar` in the output is always the real `primary_constraint`; `mismatch` is `stated_pillar !== primary_constraint`. No keyword match ⇒ `false_constraint: null`. `matchFalseConstraintRule` is the clean seam for a future LLM classification pass.
4. **Priority fix order** — primary + secondary (+ a third pillar if it scores `< 60%`), sorted strictly by Method layer (Identity → Structure → Execution), then by severity, then canonical order. This means Identity/Structure can precede the primary constraint in the sequence when the primary is an Execution pillar.
5. **Confidence** — `Directional` if pillar spread `< 15` points OR there is no free-text signal at all; otherwise `High` if primary/secondary are clearly separated (`>= 12` points, and no override) AND the false-constraint match is decisive (confirms, or contradicts with the evidence landing on the rule's expected pillar); otherwise `Medium`.

## Tuning constants (all documented in-file)

| Constant | Value | Purpose |
|---|---|---|
| `IDENTITY_DECISION_OVERRIDE_MAX_PCT` | 40 | Identity/Decision "materially low" ceiling |
| `IDENTITY_DECISION_OVERRIDE_PROXIMITY_PCT` | 10 | how far below it the lowest pillar can be and still be overridden |
| `PRIORITY_FIX_THIRD_ISSUE_MAX_PCT` | 60 | a pillar below this is a "clear third issue" for the fix order |
| `CONFIDENCE_CLEAR_PRIMARY_GAP_PCT` | 12 | primary/secondary separation needed for "clearly separated" |
| `CONFIDENCE_FLAT_SPREAD_PCT` | 15 | pillar spread below this ⇒ Directional |

## Method layers

| Layer | Pillars |
|---|---|
| identity | Identity |
| structure | Positioning, Offer, Revenue Model |
| execution | Sales, Decision |

## Test coverage (constraintEngine.test.ts)

- model integrity check returns `[]`
- pillar → Method layer mapping
- clear weakest pillar ⇒ primary (with contradicting false-constraint match, High confidence)
- materially-low Identity promoted over a marginally-lower pillar (override, Medium confidence)
- no override when the lowest pillar is clearly below Identity/Decision (past the proximity window)
- false constraint that agrees with the evidence (`mismatch: false`)
- free text matches no keyword rule ⇒ `false_constraint: null`
- flat / blended pillar scores ⇒ Directional, and a third issue added to the fix order
- no free-text signal ⇒ confidence capped at Directional even with a separated primary
- priority fix order sequences Identity → Structure → Execution regardless of which pillar is primary
- falls back to the score's stored Q13/Q29 context answers
- explicit free-text arguments override the stored context answers

## Decisions to sanity-check

1. **Spec cross-reference gap.** The build brief cites "Framework doc section 9.3" and the Method layers, but `docs/inevitable-standard-spec.md` contains neither a §9.3 nor an explicit layer grouping. The engine uses the grouping given in the brief (Identity alone / Structure = Positioning + Offer + Revenue Model / Execution = Sales + Decision) and cites §9.3 in code comments. Per the spec's own "update this file first" rule, §3 should be expanded to codify both the layers and the false-constraint seed rules.
2. **Two extra output fields** beyond the five specified — `false_constraint_rule_id` and `identity_decision_override` — added as diagnostic aids, mirroring how `scoreInevitableStandard` exposes `qa_flags` and answered-count fields. Easy to drop if the object should stay lean.
3. **Confidence, literal reading of the brief.** "No usable free-text signal at all ⇒ Directional" means a crisp, well-separated pillar profile with empty Q13/Q29 still grades Directional. And the Identity/Decision override always caps confidence below High, because an override is inherently a judgement call. Flag if either is too harsh.
4. **Priority fix order is sequenced strictly by Method layer**, so Identity/Structure can appear before the primary constraint — e.g. primary = Sales, secondary = Identity ⇒ `["identity", "sales"]`. This is the reading of "Identity must hold before Structure; Structure must hold before Execution."

## Not done in this stage (later stages)

- Wiring into `submit/route.ts` (persist alongside `totals.inevitable_standard`) and `result/route.ts`
- Report rendering (False Constraint section, Priority Fix Order, confidence-tuned copy)
- Bumping `INEVITABLE_STANDARD_CONSTRAINT_VERSION` off its `_draft` suffix
