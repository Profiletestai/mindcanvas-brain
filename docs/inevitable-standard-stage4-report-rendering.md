# Stage 4 — Render constraint + RRE in the Lite Report (build notes)

_Companion to `inevitable-standard-spec.md` §5 (Lite Report only). Status: built, committed
(`6242709d`), pushed, verified on the preview deployment._

## File changed

`apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx` only — UI change,
consuming data already present in the API response. No engine or route changes.

- `tsc --noEmit` → exit 0
- `vitest run` → 109/109 pass (no report-component tests exist; this file was never unit-tested)
- `next lint` is not runnable non-interactively in this repo, so it was not run

## Verification (no screenshot possible)

Browser tools are not available in this session, and the report hydrates client-side, so a
raw fetch of the report URL only returns the "Preparing your personalised report…" shell.
Verified instead by:

1. The deployed JS bundle (`page-9b4fb373729facbd.js` on the new build) contains every new
   markup string: `Headline diagnosis`, `The one thing to strengthen first`,
   `reinforcing issue holding it in place`, `False constraint`, `Priority fix order`,
   `Revenue in your structure`, `commercial value that may be easier to convert, retain or
   release`, `When Decision is the constraint`, `typical customer values, based on the deal
   size`.
2. The result API still returns the data for `tid=e19689a1-42c9-4248-b7dd-60fe0e9fe6bb`:
   `primary decision | secondary offer | false_constraint null | fix_order [identity, offer,
   decision] | confidence Medium`; RRE `AUD 4125–6188 | needs_revenue_confirmation false |
   translation null | pillar decision`.
3. Tracing the component logic against that data.

## What renders for `tid=e19689a1-…` (Lisa Walker)

| # | Section | Renders as |
|---|---|---|
| — | Header / Hero | unchanged — "54.2%", "Inconsistent", overall copy |
| 1 | **Headline diagnosis** (new) | Title "Lisa, your commercial readiness is 54.2%". Body: "That places the business in the 'Inconsistent' band. The single biggest thing holding this back is **Decision** at 25%. Strengthening this is where the next gain in consistency comes from." Driven by `constraints.primary_constraint`, not the client-side lowest-pillar calc. |
| 6 | Style snapshot | unchanged — "Future-Led" (A) dominant, approach-mix bars 33.3 / 16.7 / 25 / 25 |
| 2–3 | Readiness % + Six-pillar snapshot | unchanged |
| 4 | **Primary constraint** (replaces the old "next increase in consistency" placeholder) | Eyebrow "Primary constraint", title "The one thing to strengthen first". "Your primary constraint is **Decision** at 25%. When Decision is the constraint, priorities and follow-through shift too easily…" then "The reinforcing issue holding it in place is **Offer** at 50%…" then the blue "useful question to carry forward" box. |
| 5 | **False constraint** | Not rendered — `false_constraint` is null. No empty state. |
| 7 | **Priority fix order** (new) | Title "Work these in sequence, not all at once". Ordered list: 1st Identity / 2nd Offer / 3rd Decision, each with its pillar insight; footer note about holding each before the next. |
| 8 | **Revenue in your structure** (new) | Big text "AUD 4,125 to AUD 6,188". "This is commercial value that may be easier to convert, retain or release once **Decision** becomes more deliberate and repeatable. It is a modelled range, not a measured figure." No translation line (null). Full engine disclaimer in small grey text. |
| 10–11 | Business context / Commercial context | unchanged — bands render as "Under 100k", "6–10 opportunities", "50k–100k" |
| 9 | CTA | still hardcoded, one line updated: "Start with **your primary constraint (Decision)** and the decision you identified as still waiting…" |

Both requested checks pass: Primary Constraint shows "Decision" via the new `constraints`
path (the eyebrow/title changed, confirming it is not the old placeholder even though the
value coincides here), and the revenue range shows "AUD 4,125 to AUD 6,188".

## Behaviour by data state

| Data | Sections 4 / 7 / 8 | Section 5 | Section 1 (headline) |
|---|---|---|---|
| `constraints` present, `false_constraint` null | render (4, 7) | omitted | primary_constraint |
| `constraints` present, `false_constraint` set | render | render | primary_constraint |
| `constraints` null (pre-Stage-3 submissions) | omitted | omitted | falls back to client-side lowest pillar |
| `revenue_in_structure` null | section 8 omitted | — | — |
| `revenue_in_structure.needs_revenue_confirmation` true | section 8 shows a "share an approximate figure" note, no numbers | — | — |
| `translation` null or both values null | translation line omitted inside section 8 | — | — |

Old submissions therefore render exactly as before, minus the four new sections. Sections
1–3 and 6 always render.

## New copy added in this file (not in spec/definition.ts, which have no pillar prose)

`PILLAR_CONSTRAINT_COPY` — one line per pillar describing what it means when that pillar is
the primary constraint, written in the existing report voice and consistent with
`PILLAR_INSIGHTS`. `PILLAR_INSIGHTS` is reused for the priority-fix-order list items.

## Flags

1. **CTA configurability — easy (~10 lines), not done.** `payload.link` is already in the
   API response: `{ show_results, redirect_url, hidden_results_message, next_steps_url }`.
   Wiring `next_steps_url` to a button is small, but the CTA is currently a text block with
   no button element, so a button needs adding too. Left hardcoded per the stage brief.
2. **`link.show_results` is not respected by this report.** On the test link it is `false`
   (`hidden_results_message` set), yet the report renders in full. `InevitableStandardReportClient`
   is reached directly from `report/page.tsx` and bypasses `ReportGateClient`, where the
   `show_results` gating lives. Every Inevitable Standard completion currently shows a full
   report regardless of link settings. Out of scope for Stage 4; decide before real use.
3. **Minor copy:** the carry-forward question reads "…repeatable in decision for the
   business…" — a lowercased pillar mid-sentence is slightly awkward. Pre-existing pattern
   (the old code did the same with the lowest-pillar label); now inherited by the
   constraint path. One-line fix available.

## Not in this stage (Stage 5)

- Full Diagnostic report (Executive Summary, detailed pillar breakdowns, Secondary
  Constraint detail, selected 4×6 source-code cells, Revenue Chain Impact, Commercial Risk
  Factors, Reassessment Guidance)
- Internal Extended Source Code (advisor-only view)
- Any Lite / Full / Internal gating mechanism
