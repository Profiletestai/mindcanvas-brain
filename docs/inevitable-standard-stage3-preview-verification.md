# Stage 3 — Preview verification (constraint + RRE end-to-end)

_Live check of a real submission on the `feature/inevitable-standard` Vercel preview,
after pushing `fb6a699a`. Both new objects are populated and the numbers are sane._

- **Preview:** `mindcanvas-staging-git-feature-i-59a757-lisas-projects-c978d6f1.vercel.app`
- **Token:** `3f018587d78a4bdfac48409f2d826fa5`
- **Taker:** `e19689a1-42c9-4248-b7dd-60fe0e9fe6bb` (Lisa Walker)
- **Source:** `GET /api/public/test/<token>/result?tid=<tid>` → `data.inevitable_standard`

## Score summary (context for the checks)

| Pillar | raw | % | risk |
|---|---|---|---|
| decision | 3 | 25.0 | high_risk |
| offer | 6 | 50.0 | medium_risk |
| sales | 7 | 58.3 | medium_risk |
| identity | 7 | 58.3 | medium_risk |
| positioning | 8 | 66.7 | medium_risk |
| revenue_model | 8 | 66.7 | medium_risk |

Overall: raw 39 / 72, 54.2%, "Inconsistent".
Context answers: Q13 `"test"`, Q29 `"test"`.
Commercial context: `currency: AUD`, `revenue_band: under_100k`,
`monthly_opportunity_band: 6_10`, `initial_customer_value_band: 50k_100k`.

## `data.inevitable_standard.constraints`

```json
{
  "primary_constraint": "decision",
  "secondary_constraint": "offer",
  "false_constraint": null,
  "false_constraint_rule_id": null,
  "priority_fix_order": ["identity", "offer", "decision"],
  "confidence": "Medium",
  "identity_decision_override": false,
  "constraint_version": "inevitable_standard_constraints_v1"
}
```

## `data.inevitable_standard.revenue_in_structure`

```json
{
  "primary_constraint_pillar": "decision",
  "point_estimate": 5156,
  "range_low": 4125,
  "range_high": 6188,
  "currency": "AUD",
  "severity_factor": 0.6875,
  "opportunity_factor": 0.15,
  "needs_revenue_confirmation": false,
  "translation": null,
  "confidence_label": "Medium",
  "disclaimer": "This figure is a modelled estimate based on the ranges you provided and the pattern in your diagnostic. It is not a reading of your accounts, a valuation, or a promise of results. Its purpose is to indicate the possible scale and location of commercial value associated with the current structure, so you know where to investigate first. General business information only, not financial, tax, legal or accounting advice."
}
```

## Verification

| Field | Value | Cross-check |
|---|---|---|
| primary_constraint | `decision` | Decision is the lowest pillar (25%, high_risk). ✓ |
| secondary_constraint | `offer` | Offer (50%) is next-lowest. ✓ |
| priority_fix_order | `[identity, offer, decision]` | Third pillar = identity (58.3% < 60 threshold); sorted by Method layer: Identity → Structure (offer) → Execution (decision). Re-sequences so Identity leads even though Decision is primary. ✓ |
| confidence | `Medium` | Spread 41.7 pts (not flat), free text present, but no decisive false-constraint match → Medium, not High. ✓ |
| identity_decision_override | `false` | Decision was the outright lowest — no override needed. ✓ |
| constraint_version | `inevitable_standard_constraints_v1` | The `_draft` bump is deployed. ✓ |
| severity_factor | `0.6875` | (80 − 25) / 80. ✓ |
| opportunity_factor | `0.15` | Decision pillar factor. ✓ |
| point_estimate | `5156` | 50,000 (under_100k midpoint) × 0.15 × 0.6875 = 5,156.25. ✓ |
| range | `4125 – 6188` | ±20% of the point estimate (5,156.25 × 0.8 / × 1.2). ✓ |
| currency | `AUD` | Pulled from the submission's commercial context, not the USD fallback. ✓ |
| disclaimer | full spec text | Not the Directional-prefixed variant, because confidence is Medium. ✓ |

## Two expected results (not bugs)

1. **`false_constraint: null`** — Q13 and Q29 were both answered `"test"`, so there is no
   phrase for the keyword matcher to catch. To exercise that path, answer with a real
   sentence containing a seed phrase (e.g. "we just need more leads", "our prices are too
   high", "we need better systems").
2. **`translation: null`** — the tester picked revenue band `under_100k` but typical deal
   size `50k_100k` (deal-value midpoint 75,000). The whole modelled range (~6k) is worth
   < 0.1 of one customer, below the "≥ 1 customer value" gate, so the translation is
   correctly suppressed rather than showing a meaningless "0.08 to 0.1 customers". A
   consistent answer combo (e.g. deal size `1k_5k`) would populate it.

## Conclusion

Stage 3 wiring works end-to-end on the preview: `submit/route.ts` computes and persists
both the constraint engine and RRE results as sibling keys on
`totals.inevitable_standard`, and `result/route.ts` passes them through. The report UI
does not render these yet — that is Stage 4.
