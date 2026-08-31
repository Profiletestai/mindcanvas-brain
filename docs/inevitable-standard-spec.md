# The Inevitable Standard Diagnostic™ — Build Spec

**Status:** Locked. Source: Sign-off doc v0.4 (28 Aug 2026, Approved with comments) + Revenue in Your Structure Module v0.2 (26 Aug 2026).
**This file is the single source of truth for implementation.** If code and this file disagree, this file wins — update it first, then the code.

---

## 1. Model overview

- 29 questions, one continuous flow, no visible pillar/style labels to the user.
- 24 scored questions: 12 dual-coded (pillar + style), 12 pillar-only.
- 5 contextual questions: Q13, Q29 (open text), Q26–28 (self-select, report flavor only, don't affect scoring).
- 3 post-Q29 commercial-context fields: C1 (revenue), C2 (monthly opportunities), C3 (typical deal size).
- 6 pillars: Identity, Positioning, Offer, Sales, Revenue Model, Decision — 4 scored questions each.
- 4 Commercial Decision Styles: A Future-Led, B Connection-Led, C Timing-Led, D Evidence-Led.

## 2. Scoring

```
pillar_raw_score = sum of 4 question scores for that pillar (0-3 each, max 12)
pillar_percentage = pillar_raw_score / 12 * 100

style_percentage[X] = count(dual-coded answers tagged X) / 12 * 100   // X in {A,B,C,D}
```

### Score bands (customer-facing — use these, not Red/Amber/Green)

| Range | Label | Meaning |
|---|---|---|
| 0–39% | Chance-based or critical | Carried by effort/instinct/hope, not structure |
| 40–59% | Inconsistent or leaking | Some parts working, value/time/money leaking |
| 60–79% | Partly structured | Working base, needs tightening before scale |
| 80–100% | Deliberate and repeatable | Built clearly enough to support predictable results |

Internal-only overlay: Red 0–39, Amber 40–69, Green 70–100 (color coding only, never shown as the primary label).

### Confidence logic (internal, not shown to user as a score)
Based on: pattern consistency across related questions, contradiction detection, score spread (clear primary vs. blended), dual-coded A-D consistency, repeated constraint signals across scenarios. Output: High / Medium / Directional.

## 3. Constraint Engine

- **Primary Constraint**: highest-leverage issue now. Usually lowest pillar, but Identity/Decision can override — a low Identity score can suppress the value of an otherwise-strong pillar.
- **Secondary Constraint**: reinforcing issue that keeps Primary in place.
- **False Constraint**: what the founder believes is the problem (from Q13/Q29 free text) vs. what the evidence shows. This is the core "recognition moment" of the product — do not skip it.
- **Priority Fix Order**: sequence (1st, 2nd, 3rd) — never try to fix everything at once. Identity must hold before Structure; Structure must hold before Execution.

### Method layer grouping (used to sequence Priority Fix Order)

| Layer | Pillars |
|---|---|
| Identity | Identity |
| Structure | Positioning, Offer, Revenue Model |
| Execution | Sales, Decision |

Priority Fix Order is sequenced strictly by layer — Identity, then Structure, then Execution — regardless of which pillar is numerically lowest. A pillar in an earlier layer can appear before the primary constraint in the sequence if the primary constraint sits in a later layer (e.g. primary = Sales, secondary = Identity → fix order is [Identity, Sales]).

### False Constraint — v1 keyword rules

Deterministic keyword matching against combined Q13 + Q29 free text (case-insensitive substring). Four seed rules:

| Rule | Founder's phrasing (stated pillar) | What evidence actually points to |
|---|---|---|
| `lead_volume` | "need more leads" / "not enough leads" / "lead volume" → **Positioning** | **Sales** (weak follow-up/conversion) |
| `price_too_high` | "pricing too high" / "need to lower prices" → **Offer** | **Identity** (discounting, not holding price) |
| `new_offer_needed` | "need a new offer" / "offer isn't working" → **Offer** | **Decision** (not promoted/followed up) |
| `needs_systems` | "need better systems" / "need more structure" → **Revenue Model** | **Sales** (conversation not reaching a decision) |

No keyword match → `false_constraint: null` (do not guess). This is v1 deterministic matching; the seam for a future LLM classification pass is `matchFalseConstraintRule()`.

## 4. Revenue in Your Structure (RRE) — full calculation

```
severity_factor = max(0, (80 - primary_constraint_pillar_%) / 80)
point_estimate = revenue_midpoint × opportunity_factor(primary_constraint_pillar) × severity_factor

Display range = point_estimate × [0.8, 1.2]   // ±20%
```

### Revenue midpoints (C1 band)

| Band | Midpoint |
|---|---|
| Under 100k | 50,000 |
| 100k–250k | 175,000 |
| 250k–500k | 375,000 |
| 500k–1m | 750,000 |
| 1m–2m | 1,500,000 |
| 2m–5m | 3,500,000 |
| 5m–10m | 7,500,000 |
| 10m+ | **No table entry.** Requires `approximate_revenue_override` (a specific figure collected separately) or the estimate returns 0 with `needs_revenue_confirmation: true`. Do not guess a midpoint. |

`approximate_revenue_override`, when supplied, replaces the band-table midpoint for **any** band, not only 10m+ — kept flexible for future UI iteration. `needs_revenue_confirmation` only ever tracks whether C1 is the 10m+ band.

### Opportunity factor by Primary Constraint pillar

| Pillar | Factor |
|---|---|
| Sales | 0.30 |
| Revenue Model | 0.30 |
| Offer | 0.25 |
| Positioning | 0.20 |
| Identity | 0.15 |
| Decision | 0.15 |

C2 (monthly opportunities) and C3 (typical deal size) do **not** affect the RRE number. They're used only to translate the dollar range into "~N–M typical customer values" for relatability, when the ranges support a sensible translation.

### Deal-value midpoints (C3 band, for translation only)

| Band | Representative deal value |
|---|---|
| Under 1k | 500 |
| 1k–5k | 3,000 |
| 5k–15k | 10,000 |
| 15k–50k | 32,500 |
| 50k–100k | 75,000 |
| 100k+ | 100,000 (flat floor — open-ended band, relatability only) |

Translation is only shown when the range's upper end is worth at least 1 whole customer value — a "less than one customer" statement isn't useful and is omitted (`null`).

### Report copy rules
- Always show as a range, never a point estimate.
- Never claim customers were "definitely lost" — frame as "commercial value that may be easier to convert, retain or release."
- Confidence level should soften/strengthen the wording (Directional confidence prepends "This is a directional estimate only." to the standard disclaimer).
- Standard disclaimer required (see Revenue Module §6) — general business information, not financial/tax/legal/accounting advice.
- **Data-safety rule:** if the primary constraint's pillar percentage is missing or invalid, treat it as 80% (→ zero severity → zero estimate) rather than guessing low. A data problem must never produce an inflated dollar figure.

### Known gap — currency
Currency currently defaults to a flat `"USD"` constant. The product intent (per the original Revenue Module doc) is to default from the user's account, organisation, or locale, with the founder able to change it. That infrastructure doesn't exist yet in the codebase. **Tracked as a pre-international-launch requirement, not a final decision.**

## 5. Report architecture

- **Lite Report**: Headline Diagnosis, Readiness %, Six Pillar Snapshot, Primary Constraint, False Constraint, Style Snapshot, Priority Fix Order, configurable CTA. Does NOT reveal full source code or complete method.
- **Full Diagnostic**: adds Executive Summary, detailed pillar breakdowns, Secondary Constraint, selected 4×6 source code cells (not all 24), Revenue Chain Impact, Commercial Risk Factors, Reassessment Guidance.
- **Internal Extended Source Code**: private, advisor-only. Profile Summary, How They Think/Decide, Constraint Pattern, How to Communicate, What Builds Trust, What Blocks the Sale, Best Offer Fit, Pre-call Questions, Micro Scripts, Green/Red Flags.

## 6. Known open items (not blockers, but tracked)

1. Distribution test (~20 real completions) needed before full launch — checking A/B/C/D score neutrality and Q15/Q24 correlation.
2. Question wording assumes founder is personally in the sales conversation (Q9, Q15, Q21, Q24) — noted limitation above ~5m revenue, to revisit for licensed/institutional version.
3. RRE opportunity factors and severity curve are judgement-based starting assumptions — need calibration against real client outcomes before being described as validated.
4. **`link.show_results` gating is not respected.** The platform's existing "hold results back for the debrief call" setting lives in `ReportGateClient`, but `InevitableStandardReportClient` is reached directly from `report/page.tsx` and bypasses it. Every Inevitable Standard completion currently shows the full report regardless of link configuration. Deferred to Stage 5 — must be resolved before any real seller relies on this setting.

## 7. Question bank

> Full 29 questions with exact wording, answer options, scores, and style tags to be appended here from the source docs (Internal Scoring v0.2 baseline + Q2/Q3/Q6/Q12 replacements from Sign-off v0.4). Recommend generating this as structured JSON/TS data alongside this doc rather than duplicating prose here — see build stage 1.

---
*Consolidated from: Diagnostic Framework v0.3, Internal Scoring v0.2, 29-Question Sign-off v0.4, Revenue in Your Structure Module v0.2.*