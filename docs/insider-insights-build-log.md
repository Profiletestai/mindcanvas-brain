# Insider Insights — build log

Everything built for the Inevitable Standard **Insider Insights** report in the
2 Sep 2026 session. Four commits on `feature/inevitable-standard`, all pushed.

| | |
|---|---|
| Branch | `feature/inevitable-standard` |
| Commits | `8dec6f0a` → `0df8b8f3` |
| Net change | 11 files, +6,720 lines |
| Tests | 102 passing (`apps/web` · vitest) |

---

## What it is

**Insider Insights** is the private, adviser-facing companion to the Inevitable
Standard client reports (Diagnostic Snapshot, Full Diagnostic). It reads the same
stored diagnostic result and turns it into a preparation brief for the coach or
consultant about to have a commercial conversation with the founder. **The
test-taker never sees it.**

The session began with an extraction script and a raw JSON file already sitting
untracked in the repo. From there: the content layer was committed, wired into a
report route reachable from the test-taker profile, corrected for three rendering
bugs, then rebuilt to the compact five-section structure confirmed against the
Figma file.

---

## Commit summary

| Commit | Time | What it did |
|---|---|---|
| `8dec6f0a` | 06:01 | Extract the Insider Insights content layer from the four master reports — a deterministic parser plus the structured JSON it produces. |
| `5d4fb807` | 06:30 | Render it as an adviser-facing report, gated to the owning organisation, reachable from a button on the test-taker profile. |
| `d8e81628` | 07:09 | Fix three presentation bugs: admin-dashboard chrome, wrong per-pillar scale, leaked `SOURCE ANCHOR` citations. |
| `0df8b8f3` | 07:52 | Rebuild the report to the approved five-section design — selection and compression over the full content layer, not a 30-section document. |

---

## Commit by commit

### 1 — Extract the content layer · `8dec6f0a` · 3 files, +4,369

The four master reports in `docs/insider-insights-source/` run to ~11,000 lines —
one report per Commercial Decision Approach (Future-Led, Connection-Led,
Timing-Led, Evidence-Led). Rather than hand-transcribe them,
`scripts/insider-insights/extract.ts` parses them into structured, verbatim
content keyed by the Content ID scheme.

Coverage: **72/72** pillar-state blocks, **24/24** primary-constraint cells,
**120/120** directional pairs, plus risk signals, objections, PROSPER
conversation strategy, pre-call questions and post-sale coaching per approach.
The parser normalises the reports' differing bullet markers (report A uses `•`,
B/C/D use `*`) so pre-call questions, by-primary questions and adviser green/red
flags come out in one consistent shape.

```
new  scripts/insider-insights/extract.ts
new  scripts/insider-insights/extraction-report.json
new  apps/web/lib/inevitable-standard/content/insiderInsights.data.json
```

### 2 — Render it as an adviser report · `5d4fb807` · 8 files, +1,856

Three new pieces plus a button:

- **`content/insiderInsights.ts`** — a typed accessor over the JSON, with
  selectors that bridge the JSON's upper-snake keys (`IDENTITY_RED`,
  `FUTURE_LED`) to the engine's lower-snake vocabulary (`identity`, `A`,
  `high_risk`).
- **`buildInsiderInsightsReport.ts`** — a pure function that takes the stored
  score and assembles the report. Missing inputs are suppressed and logged to a
  `qaFlags` list rather than rendered as placeholders.
- **The route** under `app/portal/…/database/[takerId]/insider-insights/`, gated
  by `requirePortalOrgAccess` — a caller outside the organisation gets a 404,
  matching the "don't confirm it exists" posture of the parent profile page.
- **An amber "Open Insider Insights (adviser-only)" button** on the test-taker
  profile, shown only for Inevitable Standard takers.

This first cut rendered the full extracted content — around twenty-two sections —
which the Figma check later corrected.

```
new   apps/web/lib/inevitable-standard/content/insiderInsights.ts
new   apps/web/lib/inevitable-standard/buildInsiderInsightsReport.ts
new   apps/web/app/portal/…/insider-insights/page.tsx + InsiderInsightsReportClient.tsx
new   …/content/insiderInsights.test.ts + buildInsiderInsightsReport.test.ts
edit  apps/web/app/portal/[slug]/database/[takerId]/page.tsx
```

### 3 — Three presentation fixes · `d8e81628` · 8 files, +470 / −299

- **Page chrome.** The route was under `/portal/[slug]/*`, which wraps every
  child in the portal sidebar and "Welcome" header. Moved to
  `app/portal/insider-insights/[slug]/[takerId]/` so it renders standalone like
  the client reports. Auth is unchanged — middleware still matches `/portal/*`.
- **Six-pillar scale.** Each pillar row was using the overall-readiness widget,
  which printed the four-band labels (*Chance-Based / Inconsistent / …*) under
  every pillar. Swapped to the shared `PillarSummaryList` — the same 0–100 bar
  and G/A/R chip Reports 1 and 2 use.
- **Leaked citations.** The extractor had pulled the master docs' trailing
  `SOURCE ANCHOR …` / `CONTENT ID: …` paragraphs into ~164 rendered fields.
  Added `hoistProvenance()` to the extractor: every such paragraph is stripped
  into a non-rendered `sourceAnchor` slot and a per-approach `provenance[]`.
  Guardrail tests at the data and builder level now fail if a citation reaches a
  rendered string.

```
move  insider-insights route out from under [slug]/
edit  scripts/insider-insights/extract.ts        (hoistProvenance())
edit  content/insiderInsights.data.json           (regenerated)
edit  InsiderInsightsReportClient.tsx             (PillarSummaryList)
```

### 4 — Rebuild to five sections · `0df8b8f3` · 6 files, +959 / −635

Node inspection of the Figma file established that Insider Insights is a compact
**five-section** report — roughly the length of the Diagnostic Snapshot, not the
30+-section scope the Build & Delivery Guide describes. The builder and renderer
were rebuilt to that structure. **The full extracted content stays in the JSON as
the data source** — this is selection and compression, not deletion.

Also in this commit: report D's source has no standalone "How to Challenge Them"
or "What Not to Assume" section, so the extractor now falls back to D's §32
(challenge-sequence intro) and §2 (evidence-hierarchy opening) — every one of the
thirteen signal rows now fills for all four approaches.

```
edit  buildInsiderInsightsReport.ts        5-section output
edit  InsiderInsightsReportClient.tsx      bespoke section layouts
edit  buildInsiderInsightsReport.test.ts   13 tests rewritten
edit  scripts/insider-insights/extract.ts  D §14/§15 fallbacks
```

---

## How it fits together

```
docs/insider-insights-source/report-{A,B,C,D}-*.txt   ← master documents
        │
        ▼  scripts/insider-insights/extract.ts        ← verbatim parse + provenance strip
        │
        ▼  content/insiderInsights.data.json          ← full content, all 24 cells
        │
        ▼  content/insiderInsights.ts                 ← typed selectors
        │
        ▼  buildInsiderInsightsReport.ts              ← select + compress to 5 sections
        │
        ▼  app/portal/insider-insights/[slug]/[takerId]/
```

Score input comes from `portal.test_results.totals.inevitable_standard`
(score result + `constraints` + `context_answers`), written at submit time.

### The five sections

1. **Insider Snapshot** — readiness %, primary/secondary approach,
   primary/secondary constraint, strongest pillar, possible false constraint,
   priority fix order, six-pillar bars. Pure score data, no new content.
2. **Predictive Signals at a Glance** — a 13-row table (how they think / decide /
   buy, trust builders/reducers, communication style, likely objection + what's
   underneath it, buying/resistance signals, what to challenge, what not to
   assume, coaching style) for the founder's *primary* approach only. Each row is
   the lead paragraph of the matching master section.
3. **The Founder's Own Words** — Q13 and Q29 verbatim. Q13 keyed to the
   primary-constraint pillar, Q29 to Decision. Each annotated with
   `HYPOTHESIS TO VALIDATE` / `LISTEN FOR` / `DO NOT ASSUME` / `GREEN LEVERAGE`
   tags and one relevant risk signal (different per card).
4. **Suggested Sequence** — a four-step talk-track for the dominant approach:
   compressed PROSPER stages plus the approach × primary-constraint cell, with
   example phrases drawn from the real by-primary diagnostic questions.
5. **The Objective** — one line, the primary constraint's conversation objective.

### Access model

Gated to the **owning organisation** — the org acts as the adviser here.
`requirePortalOrgAccess` enforces session → org → membership; anyone else gets a
404. The source spec's "separate permission layer" rule means keep the content
from the *test-taker*, not from the org. Reached only through the "Open Insider
Insights" button on the taker's profile.

---

## Open decisions

Five places where content did not map one-to-one onto the five-section target.
Each has a defensible default in place; none is invented copy.

| Status | Item | Detail |
|---|---|---|
| **handled** | Report D's missing sections | Evidence-Led's source has no standalone "How to Challenge Them" / "What Not to Assume". The extractor falls back to D's §32 and §2 openings — the master docs' own words, from a different section. All 13 rows now fill for every approach. |
| **your call** | Table row length | "At a glance" implies short cells; the master sections are 2–3 paragraphs. Current behaviour takes the *first paragraph* (≈300–480 characters). Tighter options: first sentence only (risks cutting meaning), or you supply short synopses. No new copy was written. |
| **your call** | Talk-track example phrases | The master docs have no canned per-step phrases. The build uses the real by-primary diagnostic questions as the quoted examples. Step 1 (the opener) has no example — nothing suitable exists to quote. |
| **heuristic** | Risk-signal relevance | The constraint engine emits no per-taker risk scoring, so the builder picks by token-overlap against the founder's quote and constraint (threshold 3, else none). A heuristic, not a scored output. |
| **retained** | The deep content | `insiderInsights.data.json` still holds all 24 primary-constraint cells, all four approach profiles, the seven-stage PROSPER sequences, pre-call questions, post-sale coaching and accountability guidance. The builder simply stopped rendering most of it. |

---

## Verification

- **Typecheck** — `tsc --noEmit` clean across the whole app.
- **Production build** — `next build` compiles all routes, including the new one
  ("Compiled successfully in 97s"). It then stops on an unrelated pre-existing
  route that needs an `OPENAI_API_KEY` this environment doesn't have.
- **Unit tests** — 102 passing. 13 cover the five-section builder (structure,
  per-approach coverage, Q13/Q29 handling, degradation without a primary
  constraint); citation guards run at the data and builder level; a sweep
  exercises every approach × constraint combination.
- **Content review** — full section dumps confirmed each of the five sections
  reads correctly across approaches and constraints.
- **Not done here** — an authenticated render against the real submission on
  preview. This environment has no database, session, or seeded submission. That
  visual pass is still open.

### Commands

```bash
# Regenerate the content layer after editing docs/insider-insights-source/*.txt
npx tsx scripts/insider-insights/extract.ts
# then bump INSIDER_INSIGHTS_SOURCE_VERSION in content/insiderInsights.ts

# Tests
cd apps/web
npx vitest run lib/inevitable-standard/
npx tsc --noEmit
```

### See it in the app

1. `/admin/inevitable-standard` — seed the test + mint a link.
2. Complete it once as a taker so a `test_results` row exists.
3. Portal → that org → Database → the taker → **"Open Insider Insights
   (adviser-only)"**.

---

## File inventory

```
new   scripts/insider-insights/extract.ts
new   scripts/insider-insights/extraction-report.json
new   apps/web/lib/inevitable-standard/content/insiderInsights.data.json
new   apps/web/lib/inevitable-standard/content/insiderInsights.ts
new   apps/web/lib/inevitable-standard/content/insiderInsights.test.ts
new   apps/web/lib/inevitable-standard/buildInsiderInsightsReport.ts
new   apps/web/lib/inevitable-standard/buildInsiderInsightsReport.test.ts
new   apps/web/app/portal/insider-insights/[slug]/[takerId]/page.tsx
new   apps/web/app/portal/insider-insights/[slug]/[takerId]/InsiderInsightsReportClient.tsx
edit  apps/web/app/portal/[slug]/database/[takerId]/page.tsx
edit  apps/web/lib/inevitable-standard/content/README.md
```

Not touched: `docs/inevitable-standard-spec.md` carries in-progress Figma-token
edits and was deliberately left unstaged.
