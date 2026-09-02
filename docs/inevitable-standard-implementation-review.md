# The Inevitable Standard — Implementation Review (spec vs. code)

_Analysis only. No code changed. Companion to `inevitable-standard-spec.md`._

---

## 1. What already exists for "Inevitable Standard"

All of it lives in **`apps/web/lib/inevitable-standard/`** plus a report component and route wiring. Built across 6 commits on this branch (`ff15ec4b`→`d3562480`).

| File | Purpose | State vs spec |
|---|---|---|
| `definition.ts` (169 L) | Pillars, approach codes/labels, the **24-question scoring authority** (`INEVITABLE_STANDARD_SCORING_RULES` — pillar + `dual_coded` flag + `option_scores` per question), expected counts, model-integrity validator | Matches spec §1–2 model shape. Version constants present, incl. `INEVITABLE_STANDARD_CONSTRAINT_VERSION = "..._v1_draft"` (a placeholder string — **no constraint logic behind it**) |
| `questions.ts` (703 L) | Full 29-question bank + C1/C2/C3 as orders 30–32, exact wording, option values, `toInevitableStandardDatabaseQuestions()` serializer, bank validator | **This is spec §7 already done as structured TS.** 24 scored / 5 context (Q13,26,27,28,29) / 3 commercial |
| `scoreInevitableStandard.ts` (330 L) | Pure scoring engine: pillar raw/percentage, risk band per pillar, overall %, band label, approach counts/percentages/dominant/secondary, 2-axis approach map, context-answer passthrough, commercial-context passthrough, QA flags | Implements spec §2 scoring + bands. **Does NOT implement:** confidence logic, constraint engine, RRE |
| `mapSubmission.ts` (162 L) | Adapts stored DB questions + submitted answers → scoring-engine input, by matching `question.idx` (order) to the bank; routes C1–C3 into `commercial_context`; returns `{scoring_answers, commercial_context, score, issues}` | Works. Validates completeness |
| `*.test.ts` (3 files) | Vitest coverage for definition integrity, scoring extremes/ties/incompleteness, submission mapping | Good coverage of what exists |
| `app/t/[token]/report/InevitableStandardReportClient.tsx` (564 L) | Client report component. Fetches `/api/public/test/[token]/result`, renders: headline + readiness %, dominant approach + approach mix bars, 6-pillar cards with risk badges, "lowest pillar" callout, context cards, commercial-context cards, generic CTA | Roughly a **partial Lite Report**. Missing: Primary/Secondary/False Constraint, Priority Fix Order, RRE, proper Style Snapshot, disclaimer wording |
| `app/t/[token]/report/ReportRouterClient.tsx` (133 L) | Client router with Inevitable Standard detection | **Dead code** — not imported anywhere |
| `inevitable-report-live-route.patch` (repo root) | A diff against `report/page.tsx` | **Already applied** — `page.tsx` matches the patched state exactly. Safe to delete |

### Scoring & routing wiring (already connected)

- **Submit** (`app/api/public/test/[token]/submit/route.ts` ~L2823–2937, 3102–3121): detects Inevitable Standard via `meta.engine_key` / `meta.is_inevitable_standard` / slug / name → runs `mapInevitableStandardSubmission()` → stores the full score object at `totals.inevitable_standard` on the taker's submission row, plus a version/qa-flags summary under `totals.meta.inevitable_standard`. Hard-fails the submission (400) if `mapped.issues` is non-empty.
- **Result** (`app/api/public/test/[token]/result/route.ts` ~L364–408): same detection → reads `totals.inevitable_standard` back, returns it as `data.inevitable_standard` (409 if missing).
- **Report page** (`app/t/[token]/report/page.tsx`): server component; `looksLikeInevitableStandardTest()` checks the portal `tests` row (wrapper **and** resolved effective/source row) → renders `<InevitableStandardReportClient>` directly instead of `<ReportGateClient>`.

### What is NOT wired

- **No DB seeding path.** `toInevitableStandardDatabaseQuestions()` is called by nothing. There's no script/route that creates the portal `tests` row + 32 `test_questions` rows + the `meta.engine_key = "inevitable_standard"` flag. Detection everywhere keys off that row existing, so today someone must hand-create it (or add a seed route like the existing `app/api/admin/tests/seed-base/route.ts` pattern).

---

## 2. How the report system routes to a specific report type

Two **layers**, and only the first is live for Inevitable Standard:

**Layer 1 — `report/page.tsx` (server component, the real entry point).** For `/t/[token]/report?tid=...` it does a priority cascade against DB rows:

1. `visibility.tests` match → `redirect()` to `/t/[token]/visibility/report`
2. Fetch the portal `tests` row for the link (`fetchPortalTestRow`) and its effective/source row (`resolveEffectiveTestRow`, following `meta.default_source_test` / `source_test_id` / `source_tests[]`)
3. `looksLikeInevitableStandardTest(wrapper || effective)` → set `renderInevitableStandard = true` (renders in place, no redirect)
4. else `looksLikeTeamPuzzleRhythmTest` → redirect to rhythm report
5. else `looksLikeQscTest` → redirect to `/qsc/[token]/entrepreneur`
6. **Fallback:** `<ReportGateClient token tid src>`

`redirect()` is deliberately called *outside* the try/catch (Next implements it by throwing). Inevitable Standard is a *render*, not a redirect, so it returns `<InevitableStandardReportClient>` after the block.

**Layer 2 — `ReportGateClient` (client, the fallback's own router).** Fetches `/api/public/test/[token]/report`, then branches on the *result payload shape* rather than DB rows:
`isLegacyOrgForced` → `isFiveDLeadership` → `isOperatingFrame` (loads framework JSON from Supabase Storage) → `isLeadSystem` → `useBlocksEngine` (`NativeBlocksReportClient` + framework JSON) → `LegacyReportClient`.

**`ReportRouterClient`** is a *third*, unused variant that also detects Inevitable Standard / `reportFramework` / legacy. Nothing imports it — treat as dead.

So: **a new report type is added by (a) a detector function + branch in `page.tsx` keyed on the portal `tests` row, and (b) either a redirect to a dedicated route or an inline dedicated client component.** Inevitable Standard took the inline-component path. The detector needs a distinguishing signal on `tests.meta` (here: `engine_key`), because slug/name matching alone is fragile.

---

## 3. Spec vs. code — what's missing for a working diagnostic

### Question bank — ✅ essentially complete
`questions.ts` has all 29 + C1–C3 with exact wording, option values, categories. Bank + definition validators enforce the spec's counts (24/5/3, 4 per pillar, 12 dual-coded, contiguous orders 1–32). **Gap:** nothing seeds it into `test_questions`; spec §7's "append full wording here" is satisfied by the TS module instead (which the doc itself recommends — fine, but the doc should be updated to point at the file).

### Scoring engine — 🟡 partial
Implemented: pillar raw/%, overall %, 4 customer-facing bands, approach counts/%/dominant/secondary/tie-handling, approach map, QA flags.

Missing / divergent:
- **Confidence logic (spec §2)** — not implemented at all. No pattern-consistency, contradiction detection, score-spread, or dual-coded A–D consistency signals. Output `High/Medium/Directional` doesn't exist.
- **Internal Red/Amber/Green overlay (spec §2)** — `pillarRisk()` uses raw thresholds `≥9 / ≥5` (≈75% / ≈41.7%), but the spec overlay is `Red 0–39 / Amber 40–69 / Green 70–100`. Minor but a real mismatch to reconcile.
- **Band labels** differ slightly from spec text ("Chance-Based" vs "Chance-based or critical", etc.) — cosmetic, decide which wins.
- Overall % is the mean of the six pillar percentages (== `overallRaw/72`). Spec doesn't define an overall number explicitly; this is a reasonable choice but should be written into the spec.

### Constraint engine — ❌ not implemented
Nothing exists for spec §3:
- **Primary Constraint** (lowest pillar, with Identity/Decision override rule)
- **Secondary Constraint**
- **False Constraint** — compare founder's stated blocker (Q13/Q29 free text) against the evidence. Needs a text-interpretation strategy (keyword→pillar mapping, or an LLM classification step) — **a design decision you need to make.**
- **Priority Fix Order** (Identity → Structure → Execution sequencing)

`constraint_version` is a string constant with no code behind it.

### RRE calculation — ❌ not implemented
Nothing exists for spec §4:
- Revenue-midpoint lookup from C1 band (incl. the 10m+ "ask conditionally, don't guess" special case)
- `opportunity_factor` table keyed on Primary Constraint pillar
- `severity_factor = max(0, (80 − primary_pillar_%) / 80)`
- `point_estimate` and `display_range` (±20%)
- C2/C3 → "~N–M typical customer values" relatability translation
- Copy rules (always a range, "may be easier to convert/retain/release" framing, confidence-tuned hedging, standard disclaimer)

C1/C2/C3 answers *are* already captured and persisted in `commercial_context`, so the inputs are there.

### Report rendering — 🟡 partial (one report, ~Lite)
`InevitableStandardReportClient` covers: readiness %, six-pillar snapshot, style snapshot (partial — bars + dominant copy), a "lowest pillar" section that stands in for Primary Constraint.

Missing vs spec §5:
- **Lite:** Headline Diagnosis (proper), **False Constraint**, **Priority Fix Order**, configurable CTA (currently hardcoded), RRE range block, the required disclaimer text
- **Full Diagnostic:** doesn't exist (Executive Summary, pillar breakdowns, Secondary Constraint, selected 4×6 source-code cells, Revenue Chain Impact, Commercial Risk Factors, Reassessment Guidance)
- **Internal Extended Source Code:** doesn't exist (advisor-only view)
- No gating/entitlement logic to separate Lite vs Full vs Internal

### Delivery plumbing
- No seed/admin route to create the test + questions + `meta.engine_key`.
- Free-text questions Q13/Q29 depend on the generic quiz UI supporting text inputs — worth a quick verification but not obviously broken.

---

## 4. Recommended build order

Pure functions + tests first (matches how this feature was built so far), then wiring, then UI.

**Stage 0 — Seeding + doc fixup (small, unblocks everything)**
- Add an admin/seed route (mirror `app/api/admin/tests/seed-base/route.ts`) that upserts the portal `tests` row with `meta.engine_key = "inevitable_standard"` and inserts `toInevitableStandardDatabaseQuestions()`.
- Update spec §2 (define overall %, reconcile the R/A/G overlay thresholds and band labels with `scoreInevitableStandard.ts`) and §7 (point to `questions.ts`). Spec says "this file wins — update it first," so settle these before touching scoring code.
- Delete the applied `inevitable-report-live-route.patch`.

**Stage 1 — Constraint engine** (`lib/inevitable-standard/constraintEngine.ts`, pure)
- Input: `InevitableStandardScoreResult` + Q13/Q29 text. Output: `{ primary, secondary, false_constraint, priority_fix_order, confidence }`.
- Primary = lowest pillar + Identity/Decision override rule. Secondary = reinforcing pillar. Priority order from the Identity→Structure→Execution grouping.
- Confidence logic lands here too (it feeds constraint certainty and RRE hedging).
- **Decision needed from you:** how False Constraint interprets free text — keyword→pillar map (deterministic, testable, ships now) vs LLM classification (richer, adds a model call + prompt to maintain). Recommend starting deterministic, with a clean seam to swap in an LLM pass later.
- Full vitest coverage, same style as existing tests.

**Stage 2 — RRE calculation** (`lib/inevitable-standard/revenueInStructure.ts`, pure)
- Depends on Stage 1's Primary Constraint pillar + confidence.
- Midpoint table, opportunity-factor table, severity factor, point estimate, ±20% range, C2/C3 translation, 10m+ conditional handling.
- Return structured numbers *and* the spec's copy fragments (range string, framing clause, disclaimer), confidence-tuned.
- Vitest coverage including the 10m+ path and severity clamp at 0.

**Stage 3 — Wire into submit/result**
- In `submit/route.ts`, after `mapInevitableStandardSubmission`, run constraint engine + RRE and persist alongside the score (extend `totals.inevitable_standard` or add sibling keys). Keep it in the same 400-on-issues guard.
- `result/route.ts` passes the new fields through.
- Bump `constraint_version` off `_draft` once real.

**Stage 4 — Lite Report to spec**
- Extend `InevitableStandardReportClient`: Headline Diagnosis, False Constraint section (the "recognition moment"), Priority Fix Order, RRE range block with disclaimer, configurable CTA (from link/test meta).
- Keep it strictly Lite — no full source-code cells.

**Stage 5 — Full Diagnostic + Internal Extended Source Code**
- New sections/components + a gating mechanism (link meta or entitlement) to choose Lite / Full / Internal. Internal view should be a separate route or explicitly access-controlled.

**Stage 6 — Calibration hooks (tracked, not blocking — spec §6)**
- Leave the opportunity factors / severity curve as named constants in one place so they're easy to tune after the ~20-completion distribution test.

Stages 1 and 2 are the critical path — they're the two engines the spec describes in most detail and neither exists. Self-contained pure functions, so they can be built and fully tested before any wiring.
