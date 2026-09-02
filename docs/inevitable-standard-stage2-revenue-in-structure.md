# Stage 2 — Revenue in Your Structure (RRE) calculation (build notes)

_Companion to `inevitable-standard-spec.md` §4. Status: built, tested, committed (`0d8b1eba`)._

## Files

- `apps/web/lib/inevitable-standard/revenueInStructure.ts` — pure function, no IO, no model calls
- `apps/web/lib/inevitable-standard/revenueInStructure.test.ts` — 10 tests

Nothing else touched: `constraintEngine.ts`, `scoreInevitableStandard.ts`, `questions.ts`, `definition.ts`, `mapSubmission.ts`, and the route files are all unchanged.

## Test output

```
✓ lib/inevitable-standard/constraintEngine.test.ts (12 tests)
✓ lib/inevitable-standard/revenueInStructure.test.ts (10 tests)
✓ lib/inevitable-standard/scoreInevitableStandard.test.ts (7 tests)
✓ lib/inevitable-standard/questions.test.ts (5 tests)
✓ lib/inevitable-standard/mapSubmission.test.ts (4 tests)

Test Files  5 passed (5)
     Tests  38 passed (38)
```

`npx tsc --noEmit` → exit 0.

## Public API

```ts
calculateInevitableStandardRevenueInStructure({
  primary_constraint,                       // pillar, from the Constraint Engine result
  confidence,                               // "High" | "Medium" | "Directional", from the Constraint Engine result
  primary_constraint_pillar_percentage,     // score.pillars[primary_constraint].percentage
  commercial_context,                       // from mapSubmission (C1/C2/C3 + currency); null/undefined tolerated
  approximate_revenue_override?,            // optional specific revenue figure the caller collected
}) => {
  primary_constraint_pillar,   // pillar name
  point_estimate,              // number (0 when no midpoint is available)
  range_low,                   // point_estimate * 0.8
  range_high,                  // point_estimate * 1.2
  currency,                    // string, defaults to "USD"
  severity_factor,             // number, max(0, (80 - pillar_%) / 80)
  opportunity_factor,          // number, from the pillar table
  needs_revenue_confirmation,  // boolean, true iff C1 band is "10m_plus"
  translation: { customer_values_low, customer_values_high } | null,
  confidence_label,            // passthrough of `confidence`
  disclaimer,                  // spec text, hedged further when confidence is Directional
}
```

Also exported:
`INEVITABLE_STANDARD_REVENUE_MIDPOINTS`, `INEVITABLE_STANDARD_OPPORTUNITY_FACTORS`,
`INEVITABLE_STANDARD_DEAL_VALUE_MIDPOINTS`, `INEVITABLE_STANDARD_RRE_DISCLAIMER`,
`INEVITABLE_STANDARD_RRE_DIRECTIONAL_PREFIX`, `validateInevitableStandardRevenueModel()`,
plus tuning constants `RRE_SEVERITY_CEILING_PCT` (80), `RRE_RANGE_LOW_MULTIPLIER` (0.8),
`RRE_RANGE_HIGH_MULTIPLIER` (1.2), `RRE_TRANSLATION_MIN_CUSTOMER_VALUES` (1),
`RRE_DEFAULT_CURRENCY` ("USD"), and the two band-type unions
`InevitableStandardRevenueBand` / `InevitableStandardCustomerValueBand`.

## Calculation (exact, spec §4)

```
severity_factor = max(0, (80 - primary_constraint_pillar_%) / 80)
point_estimate  = revenue_midpoint * opportunity_factor[primary_constraint] * severity_factor
range_low       = point_estimate * 0.8
range_high      = point_estimate * 1.2
```

Money fields are rounded to whole units; `severity_factor` / `opportunity_factor` are
rounded to 4 decimal places. `range_low` / `range_high` are computed from the unrounded
point estimate, then rounded.

### Revenue midpoints by C1 band

| Band | Midpoint |
|---|---|
| under_100k | 50,000 |
| 100k_250k | 175,000 |
| 250k_500k | 375,000 |
| 500k_1m | 750,000 |
| 1m_2m | 1,500,000 |
| 2m_5m | 3,500,000 |
| 5m_10m | 7,500,000 |
| 10m_plus | *(no entry — see below)* |

### Opportunity factor by primary constraint pillar

| Pillar | Factor |
|---|---|
| sales | 0.30 |
| revenue_model | 0.30 |
| offer | 0.25 |
| positioning | 0.20 |
| identity | 0.15 |
| decision | 0.15 |

### 10m+ handling

`needs_revenue_confirmation` is `true` whenever C1 is `10m_plus` (literally that, per the
output spec — regardless of whether an override is supplied).

- **No override:** no midpoint is available → `point_estimate`, `range_low`, `range_high`
  are all `0`; `translation` is `null`. `severity_factor` and `opportunity_factor` are
  still computed and returned so the caller can explain the model.
- **With `approximate_revenue_override`:** the supplied figure is used as the midpoint
  directly and a real estimate is produced. A valid, positive override also wins for any
  other band, not just 10m+ (chosen for future UI flexibility, as the brief noted).

## Translation (C2 / C3 → customer values)

C2 and C3 never affect `point_estimate`. C3 only translates the dollar range into a
relatable "approximately N to M typical customer values" statement.

### Deal-value midpoints by C3 band

| Band | Representative deal value |
|---|---|
| under_1k | 500 |
| 1k_5k | 3,000 |
| 5k_15k | 10,000 |
| 15k_50k | 32,500 |
| 50k_100k | 75,000 |
| 100k_plus | 100,000 *(flat floor; open-ended band, only feeds relatability)* |

```
customer_values_low  = range_low  / deal_value      (rounded to nearest 0.5)
customer_values_high = range_high / deal_value      (rounded to nearest 0.5)
```

`translation` is populated only when a C3 deal value is available **and** the upper end of
the range is worth at least 1 whole customer value (`RRE_TRANSLATION_MIN_CUSTOMER_VALUES`).
Otherwise it is `null` — a "less than one customer" translation is not a useful statement.

## Confidence-tuned disclaimer

Base text (spec, Revenue Module §6), used verbatim for **High** and **Medium**:

> This figure is a modelled estimate based on the ranges you provided and the pattern in
> your diagnostic. It is not a reading of your accounts, a valuation, or a promise of
> results. Its purpose is to indicate the possible scale and location of commercial value
> associated with the current structure, so you know where to investigate first. General
> business information only, not financial, tax, legal or accounting advice.

For **Directional**, `"This is a directional estimate only. "` is prepended. No other
wording changes. Framing stays "scale and location of commercial value" / "may be easier
to convert, retain or release" — never "lost" or "guaranteed". The validator asserts the
disclaimer contains the advice carve-out and contains no loss-led/guarantee language.

## Test coverage (revenueInStructure.test.ts)

- model integrity check returns `[]`
- standard mid-range calculation against each of the 6 opportunity factors (under_100k
  midpoint, pillar at 40% ⇒ severity 0.5), asserting factor, severity, point, and range
- severity factor derived from the pillar percentage (0% ⇒ 1.0, 20% ⇒ 0.75, 60% ⇒ 0.25)
- severity floor at zero for pillar at 80% and at 95%, with zeroed estimate and null translation
- 10m+ band without an override ⇒ safe zero estimate, `needs_revenue_confirmation: true`,
  factors still reported
- 10m+ band with `approximate_revenue_override` ⇒ real estimate from the supplied midpoint
- translation calculation (250k_500k × 5k_15k ⇒ 4.5 to 7 customer values)
- translation omitted when C3 is absent, and when the deal value dwarfs the whole range
- disclaimer tuned across all three confidence levels; no loss-led / guarantee wording
- currency passthrough (trimmed), and default to "USD" when null or when
  `commercial_context` is `null`

## Decisions to sanity-check

1. **Spec-doc gap.** §4's midpoint and opportunity-factor tables now live in code
   (`INEVITABLE_STANDARD_REVENUE_MIDPOINTS`, `INEVITABLE_STANDARD_OPPORTUNITY_FACTORS`).
   The C3 deal-value midpoints are not in the spec at all — the values from the build
   brief were used, with 100,000 as a flat floor for the open-ended 100k+ band. Both
   tables should be added to spec §4.
2. **`approximate_revenue_override` applies to any band**, not only 10m+. A supplied,
   valid, positive figure replaces the band-table midpoint for whatever C1 says.
   `needs_revenue_confirmation` still tracks only `C1 === "10m_plus"`.
3. **10m+ without override returns `0`, not `null`**, for `point_estimate` and the range,
   to keep the field type `number`. `translation` is `null` in that case.
4. **Translation is gated** on both C3 availability and the range's upper end being worth
   ≥ 1 customer value; values are rounded to the nearest 0.5.
5. **Disclaimer** changes only for Directional (prefix added). High and Medium are the
   spec text verbatim.
6. **Currency** defaults to `"USD"` (`RRE_DEFAULT_CURRENCY`) — the codebase has no
   existing default currency constant; currency is a free, nullable string on
   `commercial_context`.
7. **Non-finite pillar percentage** is treated as 80 (⇒ zero severity), not 0, so a
   missing signal never produces an inflated estimate.

## Not done in this stage (later stages)

- Wiring into `submit/route.ts` (compute after the constraint engine, persist alongside
  `totals.inevitable_standard`) and `result/route.ts` passthrough
- Report rendering: the RRE range block, the customer-value translation line, and the
  confidence-tuned disclaimer
- Deciding whether to collect an actual figure for the 10m+ band in the quiz UI and pass
  it as `approximate_revenue_override`
- Calibrating the opportunity factors, severity curve, and deal-value midpoints against
  real client outcomes before describing any of them as validated (spec §6, item 3)
