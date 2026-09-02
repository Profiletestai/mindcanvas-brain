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
- **Priority Fix Order**: diagnosis-led intervention sequence — Primary Constraint first, Secondary Constraint second, then the remaining pillars by current severity. Never try to fix everything at once. Identity → Structure → Execution remains the Method dependency architecture, but it does not override the diagnosed intervention point.

### Method layer grouping (used to sequence Priority Fix Order)

| Layer | Pillars |
|---|---|
| Identity | Identity |
| Structure | Positioning, Offer, Revenue Model |
| Execution | Sales, Decision |

Priority Fix Order is a **full ranking of all 6 pillars**, led by the diagnosis: Primary Constraint first, Secondary Constraint second, then the remaining four pillars by severity (lowest % first; canonical pillar order breaks ties). Identity → Structure → Execution remains the dependency model used to explain what supports a change and why a constraint may be recreated; it must not push the Primary Constraint later in the intervention sequence. The order is explicitly *not* a ranking of abstract importance — it is the sequence in which work should be addressed for this result.

**Shared diagnosis, report-specific action treatment:** the engine (`constraintEngine.ts`) always returns the full 6-pillar diagnosis-led ranking and the Full Diagnostic shows all 6, numbered 01–06. The Diagnostic Snapshot's "Your First Three Priorities" is an action-focused surface: it must begin with the Primary Constraint and may select the next two immediate actions from the current severity pattern so the short report remains practical. Both surfaces must agree on Primary and Secondary Constraint even when the Snapshot action cards are not a literal slice of the six-pillar list.

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

**Design tokens — pulled directly from Figma via MCP on 31 Aug 2026 (file mDcKNbBpOpXUCWKBdAdVnA, node 4:3 "Your Diagnostic Snapshot"). These are exact values, not descriptions — use them, don't reinterpret.**

- **Colors:**
  - Header/hero background: gradient `#14263d → #1f2c46` (deep navy)
  - Sidebar/body background: `#f8f6f1` (warm ivory) — body sections sit on ivory, header/hero sits on navy. Both appear in the same report.
  - Gold accents: `#b89a5e` (eyebrow labels, Download PDF button), `#c9b98f` (subtitle/italic text), `#b3893f` (the "%" symbol next to the readiness score)
  - Navy text/borders (on ivory sections): `#33445a`
  - Pillar bar colors: Green `#4c7a5b`, Amber `#bd8b3d`, Red `#a8503f` — muted, not neon, matches the content rule
  - CTA button gradient: `#5a7a9e → #2563c8 → #14263d` (blue, not gold — gold is reserved for the primary Download PDF action)
  - Off-white display text on navy: `#f8f6f1` / `#f4f1e8`
- **Typography (four font families, used deliberately for different roles):**
  - `Newsreader` (serif) — the big display moments: client name (80px), the readiness % figure (52px)
  - `Newsreader Italic` — the tagline under the client name ("Map Your Revenue-To-Freedom Pathway")
  - `Playfair Display Bold` — just the "%" symbol next to the readiness score
  - `Inter` (Regular/Semi Bold/Bold) — the workhorse: labels, body copy, pillar names, buttons
  - `Plus Jakarta Sans` — small uppercase eyebrow tags ("YOUR DIAGNOSTIC SNAPSHOT")
  - `Sora Bold` — the "Get the Full Report" nav button specifically
  - Wide uppercase letter-spacing (`tracking-[2.4px]` to `tracking-[4.48px]`) on eyebrow/label text throughout
- **Key components confirmed from the real file (not the written brief):**
  - Readiness score is a **circular/donut gauge** (two overlapping SVG ellipses, one full-opacity arc for the score, one dim background ring), NOT a linear progress bar
  - Six pillars appear **twice**: a compact mini-summary with small circular icon badges in the navy hero (icon + name + thin bar + %), and a fuller detailed section further down the page with larger circular badges, risk labels, and descriptive text
  - A **persistent sidebar** (ivory, rounded-pill nav links, navy border) with a numbered Report Index (1–5), sitting alongside the main content rather than above it — this is a two-column layout, not a single scrolling column
  - Header nav bar (separate from the hero) contains: logo insignia, "Download PDF" (gold), "Get the Full Report" and "Next step" (blue gradient) buttons, plus Prepared for / Business / Date info cards
  - Constraint cards (Primary/Secondary/False) each have a **circular icon badge** in the top-right (chain-link icon for Decision, etc.) rather than a plain risk chip
  - Priority items use **large "01" / "02" / "03" numerals** (not "1st/2nd/3rd" text) in a serif-adjacent weight
  - The Commercial Decision Approach compass map in the actual file is a **placeholder AI-generated raster image**, not a built component — the previously-built inline SVG compass is a reasonable approach to make this real, but should be restyled to match the navy/gold palette above rather than the muted-teal palette used previously

This supersedes the "muted teal accent, serif-editorial-ivory-only" interpretation built in the first Report 1 attempt — the real design uses a confident navy-and-gold palette with a two-section (navy hero + ivory body) structure, not a single restrained ivory page throughout.

**Content rules (apply across all four surfaces, independent of visual styling):**
- **Green ≠ "ignore this"** — it means *leverage this strength*. Amber = strengthen and stabilise. Red = priority investigation and rebuild. Apply this to all risk-band copy.
- Never say a founder behaves a certain way *because* they are Connection-Led/Future-Led/etc. Always frame as "your approach *may influence* how this result shows up." The Commercial Decision Approach is a lens within the diagnostic, not a personality label.
- Same typography, spacing, colour language, pillar labels, G/A/R treatment, approach visual language, and Revenue→Freedom model must appear consistently across all four surfaces — they should feel like one product, distinguished by purpose, not four different products.

### Report 1 — Diagnostic Snapshot (client-facing, fast/visual, ~5–8 pages)
Answers in seconds: Where am I now? What's strong? Where's the risk? What's most likely holding me back? How do I naturally make decisions? What should I focus on first?

- Cover: "The Inevitable Standard Diagnostic™ — Map Your Revenue-To-Freedom Pathway — Your Diagnostic Snapshot", client name, business name, assessment date. Optional footer: "Created from The Inevitable Standard Method™ by Genene Wilson, The Wealth Architect."
- Opening result area (feels like a personal commercial dashboard): Readiness % prominent, band descriptor beneath, short explanatory copy (reuse spec §2 band language).
- Six-pillar display: all 6, each with score %, G/A/R indicator, very short descriptor. Favour six clean bars/cards over a radar chart (radar makes precise comparison harder).
- Key diagnosis: Primary Constraint (named + "the area most likely to be limiting progress right now"), Secondary Constraint (named + "the area most likely to reinforce or recreate the primary constraint"), "What May Not Be The Real Problem" (client-friendly label for False Constraint — only render if non-null).
- Commercial Decision Approach: heading "How You Naturally Make Commercial Decisions", primary approach + %, all 4 as a percentage mix, optional compass-style map (North=Future-Led, South=Timing-Led, Left=Evidence-Led, Right=Connection-Led). Must not look like a personality badge — frame as commercial decision intelligence.
- Finish: "Your First Three Priorities" (top 3 slice of the full 6-pillar Priority Fix Order), then CTA: "Explore Your Full Revenue-To-Freedom Pathway".

**This replaces what Stage 4 built.** Stage 4's implementation was a lighter retrofit onto the existing report component and does not yet reflect this structure (no cover, no dashboard-style opening, no compass map, no proper page structure) — needs rework, not incremental polish, to match this brief exactly.

### Report 2 — Full Diagnostic Report (client-facing, explanatory, "beautifully designed strategy report or short book")
- Cover: "The Inevitable Standard Diagnostic™ — Your Revenue-To-Freedom Pathway — Prepared for [CLIENT NAME]", then "Genene Wilson, The Wealth Architect".
- Opening (results-first, not buried after 10 pages of theory): Readiness %, six-pillar summary, Primary Constraint, Secondary Constraint, Commercial Decision Approach, full Priority Fix Order (all 6, numbered 01–06).
- Core framework spread: Revenue → Profit → Personal Wealth → Freedom (major visual), then Identity → Structure → Execution (second visual model).
- Pillar chapters — all 6, each with a consistent template: score + G/A/R status, then What This Result Means / What Appears to Be Working / Where Value May Currently Be Leaking / How This Affects Your Revenue-To-Freedom Pathway / What to Focus On Now / What to Watch / What Progress Should Look Like. Layout must accommodate G/A/R content changing dynamically without breaking.
- Personal context: Q13/Q29 (and contextual MCQs) surfaced selectively as "What You Told Us" → "What Your Diagnostic Adds" (dynamic interpretation). Don't overuse — only where a quote genuinely improves interpretation.
- Commercial Decision Approach chapter: primary approach, secondary influence, percentage mix, connected to pillar evidence — same "may influence" framing rule as Report 1.
- Closing: 30/60/90-day focus as a strong visual pathway, then reconnect to Revenue → Profit → Personal Wealth → Freedom. Final message: the purpose is not to improve six scores, it's to build a business that works more deliberately for the founder.

### Report 3 — Insider Insights (advisor/seller-facing only, NOT shown to test-taker)

**[Corrected 2 Sept 2026 — verified directly against the Figma file's node structure, not a written description.]** This is a compact 5-section report, the same overall scale as Report 1 (~5,728px in Figma, vs. Report 2's 14,204px). It is NOT the 36-section deep architecture described in the "Insider Insights Build & Delivery Guide" — that guide describes a much larger scope than what was actually designed and approved. The guide's deep content (24-cell grid, full approach profiles, PROSPER sequences, pre-call prep, coaching priorities, etc.) is valuable as an underlying data source, but only a small selected slice of it renders in the actual report. Building the full 36-section architecture as visible report content is a confirmed scope overshoot — do not repeat it.

The 5 sections, per the Report Index in the actual Figma frame:
1. **Insider Snapshot** — client, primary/secondary Commercial Decision Approach, overall readiness, primary/secondary constraint, strongest pillar, possible false constraint, priority fix order, six pillar scores.
2. **Predictive Signals at a Glance** — the 13-field table (How They Think, How They Decide, How They Buy, What Builds Trust, What Reduces Trust, Best Communication Style, Likely Objection, What May Really Be Underneath It, Buying Signals, Resistance Signals, What to Challenge, What Not to Assume, Coaching Style) for the founder's primary approach only.
3. **Founder's Own Words** — Q13/Q29 verbatim, each with pillar G/A/R readout, HYPOTHESIS TO VALIDATE / LISTEN FOR / DO NOT ASSUME / GREEN LEVERAGE tags, and a RISK SIGNAL callout where relevant.
4. **Suggested Sequence** — a 4-step talk-track tailored to the founder's dominant approach, each step with an instruction and an example phrase (PROSPER-derived).
5. **The Objective** — one sentence: what this specific conversation needs to achieve.

Requires the 24-cell source code (4 approaches × 6 pillars) and the 4-row approach table as underlying content — both extracted from the real master reports (`docs/insider-insights-source/`), following the direct/applied sourcing discipline. See §6 item 5.

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
4. **`link.show_results` gating is not respected.** The platform's existing "hold results back for the debrief call" setting lives in `ReportGateClient`, but `InevitableStandardReportClient` is reached directly from `report/page.tsx` and bypasses it. Every Inevitable Standard completion currently shows the full report regardless of link configuration. Deferred to Stage 5 — must be resolved before any real seller relies on this setting.
5. **Insider Insights 24-cell source code content does not exist yet.** This is a writing/authoring task (Genene's voice, per Framework §6.1 format), not something Claude Code should invent. Sequence this as a parallel workstream, not a blocker to building the report UI — build against placeholder/sample content first if needed, swap in real content once authored.
6. **Group Diagnostic Dashboard is new scope beyond the original Framework doc** (which placed group/institutional dashboards at Phase 4). Group-level aggregation logic (distribution buckets, constraint-combination clustering, intervention recommendations) needs its own spec before building — the Design Brief describes the UI/content but not the underlying computation. Sequence after Reports 1–3 are complete.
8. **Report copy content source: exclusively "The Inevitable Standard – Knowledge Base v1" (the 81-page book manuscript), not the Framework doc's brief bullet points, not Figma mockup placeholder text, and not generically AI-written copy.** Every line of report content must be either a close paraphrase of an actual passage in the Knowledge Base ("direct"), or a clearly-labeled extension of the book's own reasoning to a case it doesn't narrate directly ("applied") — never invented outside those two categories. See `/mnt/user-data/outputs/identity-pillar-copy-v4-calibrated.md` and `/mnt/user-data/outputs/remaining-5-pillars-copy-v4.md` for the drafted content and the direct/applied labeling convention to follow when writing any further report copy.
9. **Positioning pillar has materially weaker Knowledge Base coverage than the other five pillars.** The book has no dedicated treatment of market positioning distinct from the offer itself — Ch5's offer-packaging logic only applies loosely. Built thinner than the other five pillars for now (fewer of the 7 template sections filled, rest left blank rather than padded). Marked for revisit once Genene supplies dedicated source material for this pillar specifically.

## 7. Question bank

> Full 29 questions with exact wording, answer options, scores, and style tags to be appended here from the source docs (Internal Scoring v0.2 baseline + Q2/Q3/Q6/Q12 replacements from Sign-off v0.4). Recommend generating this as structured JSON/TS data alongside this doc rather than duplicating prose here — see build stage 1.

---
*Consolidated from: Diagnostic Framework v0.3, Internal Scoring v0.2, 29-Question Sign-off v0.4, Revenue in Your Structure Module v0.2.*