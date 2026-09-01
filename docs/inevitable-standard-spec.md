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

Priority Fix Order is a **full ranking of all 6 pillars**, sequenced strictly by Method layer — Identity, then Structure, then Execution — regardless of which pillar is numerically lowest. Within a layer, order by severity (lowest % first). The order is explicitly *not* a ranking of importance — it's the sequence in which work compounds fastest, per the approved report copy ("The order is not a ranking of importance. It is the sequence in which work compounds fastest for this result.").

**Single source of truth, sliced per report:** the engine (`constraintEngine.ts`) always returns the full 6-pillar ranking. Individual reports decide how much to show — the Diagnostic Snapshot shows only the top 3 ("Your First Three Priorities"), the Full Diagnostic shows all 6, numbered 01–06. Do not build two separate ranking outputs — slicing in the UI guarantees both reports can never silently disagree.

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

**[Updated 31 Aug 2026 — reconciled against the Design Brief for The Inevitable Standard™ Reporting Suite. This supersedes all earlier "Lite/Full/Internal" naming — follow this exactly.]**

**Design system principles (apply across all four surfaces):**
- Editorial, intelligent, premium. High-end strategic advisory report, not colorful quiz/assessment software. Generous white space, strong hierarchy.
- No excessive icons, illustrations, rounded "quiz cards", cartoon graphics or decorative gradients on content. Charts/visual devices only when they aid understanding. The **navy cover/hero gradient** (`#14263d → #1f2c46`) is the one deliberate exception — it is the brand's signature surface, not decoration, and only appears as the hero band and the CTA/accent blocks.
- Green/Amber/Red must be muted and sophisticated, not traffic-light neon.
- **Content rule:** Green ≠ "ignore this" — it means *leverage this strength*. Amber = strengthen and stabilise. Red = priority investigation and rebuild. Apply this to all risk-band copy.
- **Content rule:** never say a founder behaves a certain way *because* they are Connection-Led/Future-Led/etc. Always frame as "your approach *may influence* how this result shows up." The Commercial Decision Approach is a lens within the diagnostic, not a personality label — never let it recolor the whole report.
- Same typography, spacing, colour language, pillar labels, G/A/R treatment, approach visual language, and Revenue→Freedom model must appear consistently across all four surfaces — they should feel like one product, distinguished by purpose, not four different products.

### Report 1 — Diagnostic Snapshot (client-facing, fast/visual, ~5–8 pages)
Answers in seconds: Where am I now? What's strong? Where's the risk? What's most likely holding me back? How do I naturally make decisions? What should I focus on first?

**Layout:** navy gradient **hero** (cover + result in one band) across the top, then a **two-column body** — a persistent ivory **Report Index** sidebar (sticky, scroll-spy, numbered section links + the readiness figure) on the left, the report on the right. On print the sidebar is replaced by a compact inline Report Index and the body collapses to one column.

- Hero (navy gradient `#14263d → #1f2c46`, white text): "The Inevitable Standard Diagnostic™" eyebrow, "Map Your Revenue-To-Freedom Pathway", "Your Diagnostic Snapshot", client name, business name, assessment date. **Circular readiness gauge** (gold arc donut) with the Readiness % and band word in the centre. Optional footer elsewhere: "Created from The Inevitable Standard Method™ by Genene Wilson, The Wealth Architect."
- Readiness Overview section: short explanatory copy, the four-band meter with a marker at the score, and one band-meaning sentence (reuse spec §2 band language).
- Six-pillar display: all 6, each with score %, G/A/R indicator, very short descriptor. Six clean **bars**, not a radar or a donut (radar/radial makes precise comparison harder). The circular gauge is reserved for the single overall readiness value only.
- Key diagnosis: Primary Constraint (named + "the area most likely to be limiting progress right now"), Secondary Constraint (named + "the area most likely to reinforce or recreate the primary constraint"), "What May Not Be The Real Problem" (client-friendly label for False Constraint — only render if non-null). Revenue-in-Structure range sits under the Primary Constraint on a gold rule.
- Commercial Decision Approach: heading "How You Naturally Make Commercial Decisions", primary approach + %, all 4 as a percentage mix, compass-style map (North=Future-Led, South=Timing-Led, Left=Evidence-Led, Right=Connection-Led), one gold accent dot. Must not look like a personality badge — frame as commercial decision intelligence.
- Finish: "Your First Three Priorities" (top 3 slice of the full 6-pillar Priority Fix Order), then CTA: "Explore Your Full Revenue-To-Freedom Pathway" (navy block).

#### Design tokens (Report 1, and the shared basis for Reports 2–4)

| Token | Value | Use |
|---|---|---|
| Navy deep / navy | `#14263d` / `#1f2c46` | hero gradient (`158deg`), CTA block, sidebar active item, band-meter marker |
| Gold | `#b89a5e` | readiness arc, section/rule accents, dominant approach bar, compass dot, priority numerals |
| Gold text | `#8a6a3c` | small-caps eyebrows / labels on the ivory ground (readable contrast) |
| Ivory ground | `#faf8f4` | page background |
| Ivory panel / border | `#f5efe3` / `#e7ddc8` | sidebar, inset panels |
| Ink | `#1e2a38` | body + headings ink |
| Hairline | `#e7e3db` | section dividers, list rules |
| G / A / R bars | `#5b8a72` / `#b58a45` / `#a6564e` | muted, never traffic-light; chips use low-chroma tints of each |
| Display type | **Newsreader** (serif, `next/font`, self-hosted) | h1, section titles, readiness figure, pillar names, priority numerals |
| Body type | Inter (platform default) | all body copy |

**Status: built.** The rebuild to this layout/token set is live in `InevitableStandardReportClient.tsx` (data, scoring and copy layers unchanged from Stage 4 — this was a presentational rebuild only). Newsreader is loaded via `next/font` scoped to that one component, so no other surface is affected.

### Report 2 — Full Diagnostic Report (client-facing, explanatory, "beautifully designed strategy report or short book")
- Cover: "The Inevitable Standard Diagnostic™ — Your Revenue-To-Freedom Pathway — Prepared for [CLIENT NAME]", then "Genene Wilson, The Wealth Architect".
- Opening (results-first, not buried after 10 pages of theory): Readiness %, six-pillar summary, Primary Constraint, Secondary Constraint, Commercial Decision Approach, full Priority Fix Order (all 6, numbered 01–06).
- Core framework spread: Revenue → Profit → Personal Wealth → Freedom (major visual), then Identity → Structure → Execution (second visual model).
- Pillar chapters — all 6, each with a consistent template: score + G/A/R status, then What This Result Means / What Appears to Be Working / Where Value May Currently Be Leaking / How This Affects Your Revenue-To-Freedom Pathway / What to Focus On Now / What to Watch / What Progress Should Look Like. Layout must accommodate G/A/R content changing dynamically without breaking.
- Personal context: Q13/Q29 (and contextual MCQs) surfaced selectively as "What You Told Us" → "What Your Diagnostic Adds" (dynamic interpretation). Don't overuse — only where a quote genuinely improves interpretation.
- Commercial Decision Approach chapter: primary approach, secondary influence, percentage mix, connected to pillar evidence — same "may influence" framing rule as Report 1.
- Closing: 30/60/90-day focus as a strong visual pathway, then reconnect to Revenue → Profit → Personal Wealth → Freedom. Final message: the purpose is not to improve six scores, it's to build a business that works more deliberately for the founder.

**Status: built.** `InevitableStandardFullDiagnosticClient.tsx`, route `/t/[token]/full-report?tid=…`, reached from the Snapshot's "Explore Your Full Revenue-To-Freedom Pathway" CTA (previously a placeholder). Same navy/gold/ivory + Newsreader system as Report 1, via the shared `inevitableStandardShared.tsx` module (tokens, gauge, band meter, pillar list, compass, and the one Revenue-in-Structure panel — Report 2 renders it in `variant="full"` with the customer-value translation line; Report 1 stays `variant="compact"`).

- **Pillar chapters** pull from `content/reportCopy.ts` unchanged. Only Amber (+ Identity Green) is authored, so Red/most-Green chapters and the provisional Positioning pillar render the sections that exist and fall back to one plain "What This Result Means" line (`primaryConstraintSentence` → `PILLAR_CONSTRAINT_COPY`, or a Green "hold this as a standard" line). Missing sections are simply omitted — not faked.
- **Templated, non-sourced content** lives in `lib/inevitable-standard/fullDiagnosticTemplates.ts`, clearly marked as data-driven, not book voice: (a) the **30/60/90-day plan** — three windows following the resolved 6-pillar priority order, each phase carrying 2–3 plain operational actions and one "what changes" line per pillar, tagged with the constraint role; degrades to the three lowest pillars when no constraint data; (b) **"What Your Diagnostic Adds"** — assembles a short interpretive paragraph linking the filtered Q13/Q29 quotes to the primary/secondary constraint (or, when a False Constraint fires, frames the stated→evidence shift as the recognition moment). Renders nothing when there is no meaningful quote and no constraint.
- Priority Fix Order shows all six, numbered 01–06 (no slicing). Degraded submissions (no `constraints` / `revenue_in_structure`) drop those blocks and fall back exactly as Report 1 does.

### Report 3 — Insider Insights (advisor/seller-facing only, NOT shown to test-taker)
"Predictive Selling & Coaching Playbook." Related visual family to the client reports but more analytical/operational — more navy/slate, less ivory/gold.

- Cover: "The Inevitable Standard™ Insider Insights — Predictive Selling & Coaching Playbook — Prepared for [CLIENT NAME] — INTERNAL USE ONLY".
- Page 1 (Insider Snapshot): client, primary/secondary Commercial Decision Approach, overall readiness, primary/secondary constraint, strongest pillar, possible false constraint, priority fix order, six pillar scores.
- Page 2 (Predictive Signals at a Glance): How They Think, How They Decide, How They Buy, What Builds Trust, What Reduces Trust, Best Communication Style, Likely Objection, What May Really Be Underneath It, Buying Signals, Resistance Signals, What To Challenge, What Not To Assume, Coaching Style. Close with a visually strong box: "THE ONE THING THIS CONVERSATION NEEDS TO ACHIEVE."
- Diagnostic Interpretation: Q13/Q29 verbatim ("Founder's Own Words"), then pillar G/A/R readout, then scannable tags: HYPOTHESIS TO VALIDATE, LISTEN FOR, DO NOT ASSUME, COACHING SIGNAL, BUYING SIGNAL, RISK SIGNAL, GREEN LEVERAGE.

**Requires real authored content for all 24 Style × Pillar combinations** (per Framework §6.1 format) — this is a writing workstream, not something to auto-generate from scoring data. See §6 item 5.

### Product 4 — Group Diagnostic Dashboard (advisor/cohort-owner facing, NOT a report — a dashboard attached to a specific assessment link)
- Heading: "The Inevitable Standard™ Group Diagnostic Dashboard" + [Link/Cohort/Organisation name]. Subtext: "A consolidated view of the commercial strengths, constraints and decision patterns across this group."
- Top summary: Total Assessments Completed, Average Readiness, Most Common Primary Constraint, Most Common Secondary Constraint, Strongest Group Pillar, Highest-Risk Group Pillar.
- Six-pillar group view: average % **and** %Green/%Amber/%Red per pillar — distribution matters more than the average (a polarised group can hide behind a mid-range mean).
- Constraint intelligence: Primary Constraint Distribution (% per pillar across the cohort), Most Common Constraint Combinations (e.g. "Sales + Decision"), a generated "where intervention should begin" recommendation.
- Commercial Decision Approach distribution: aggregate 4-way mix; approach↔pillar-state correlation as a secondary drill-down, not on the main view.
- Individual results table: Name, Date, Readiness %, Primary Approach, Primary/Secondary Constraint, all 6 pillar scores — every row clickable through to that person's reports. Filterable by G/A/R, Primary Constraint, Approach, completion date, pillar, readiness range.
- Data-first, clean, practical — less editorial than the reports, but same design system.

**Still new scope, needs its own logic spec before building** (distribution bucketing, constraint-combination clustering, intervention-recommendation generation) — sequence after Reports 1–3 are complete. See §6 item 7.

## 6. Known open items (not blockers, but tracked)

1. Distribution test (~20 real completions) needed before full launch — checking A/B/C/D score neutrality and Q15/Q24 correlation.
2. Question wording assumes founder is personally in the sales conversation (Q9, Q15, Q21, Q24) — noted limitation above ~5m revenue, to revisit for licensed/institutional version.
3. RRE opportunity factors and severity curve are judgement-based starting assumptions — need calibration against real client outcomes before being described as validated.
4. **`link.show_results` gating is not respected.** The platform's existing "hold results back for the debrief call" setting lives in `ReportGateClient`, but `InevitableStandardReportClient` is reached directly from `report/page.tsx` and bypasses it. Every Inevitable Standard completion currently shows the full report regardless of link configuration. The new `/t/[token]/full-report` route (Report 2) has the same gap. Deferred to Stage 5 — must be resolved before any real seller relies on this setting.
   - 4a. **`/t/[token]/full-report` has no server-side test-type check.** It renders the Report 2 client directly and relies on the `result` API's own `isInevitableStandard` gate to error for a non-IS token. Fine for launch (the CTA only appears on an IS snapshot), but if the route is ever linked directly it should mirror `report/page.tsx`'s `looksLikeInevitableStandardTest` detection.
5. **Insider Insights 24-cell source code content does not exist yet.** This is a writing/authoring task (Genene's voice, per Framework §6.1 format), not something Claude Code should invent. Sequence this as a parallel workstream, not a blocker to building the report UI — build against placeholder/sample content first if needed, swap in real content once authored.
6. **Group Diagnostic Dashboard is new scope beyond the original Framework doc** (which placed group/institutional dashboards at Phase 4). Group-level aggregation logic (distribution buckets, constraint-combination clustering, intervention recommendations) needs its own spec before building — the Design Brief describes the UI/content but not the underlying computation. Sequence after Reports 1–3 are complete.
7. ~~**Stage 4's report component needs rework, not polish, to match Report 1 (Diagnostic Snapshot) per the Design Brief.**~~ Done — rebuilt to the navy Reporting Suite tokens (cover/hero + readiness gauge, two-column Report Index sidebar, compass, defined structure).
8. **Report 2's 30/60/90 plan and "What Your Diagnostic Adds" are templated, not authored.** Built from constraint outputs and free-text in `lib/inevitable-standard/fullDiagnosticTemplates.ts`. Fine as an honest data-driven layer; replace wholesale if Genene supplies authored 30/60/90 or interpretive material. The Positioning pillar chapter is also thin (content layer is provisional for that pillar).

## 7. Question bank

> Full 29 questions with exact wording, answer options, scores, and style tags to be appended here from the source docs (Internal Scoring v0.2 baseline + Q2/Q3/Q6/Q12 replacements from Sign-off v0.4). Recommend generating this as structured JSON/TS data alongside this doc rather than duplicating prose here — see build stage 1.

---
*Consolidated from: Diagnostic Framework v0.3, Internal Scoring v0.2, 29-Question Sign-off v0.4, Revenue in Your Structure Module v0.2.*