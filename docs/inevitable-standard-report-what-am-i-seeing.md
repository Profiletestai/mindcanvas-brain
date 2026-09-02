# What the live Inevitable Standard report is actually showing (pre-Stage-4)

_Answering: the report page shows pillar scores, "a constraint", and "a dollar figure",
but Stage 3 notes say `InevitableStandardReportClient.tsx` was not touched. So what is it?_

## 1. Is there a diff on `InevitableStandardReportClient.tsx` since `fb6a699a`?

**No. Zero changes.**

```
$ git log --oneline -- apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx
dcbb7e79 add inevitable standard participant report

$ git diff fb6a699a -- apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx
(empty)
```

The file has exactly one commit in its whole history — `dcbb7e79`, which landed two
commits before Stage 1 (`5f6fac0d`). Nothing this session touched it; there are no
uncommitted changes to it. The build notes are accurate.

## 2. Raw `totals.inevitable_standard` for `tid=e19689a1-42c9-4248-b7dd-60fe0e9fe6bb`

**Both new objects are populated, not null.** `result/route.ts` reads
`totals.inevitable_standard` straight out of the `test_submissions.totals` DB column and
passes the nested objects through untouched, so the API response is the DB content.

```jsonc
// totals.inevitable_standard.constraints
{
  "primary_constraint": "decision",
  "secondary_constraint": "offer",
  "false_constraint": null,          // Q13 and Q29 were both "test" - nothing to match
  "false_constraint_rule_id": null,
  "priority_fix_order": ["identity", "offer", "decision"],
  "confidence": "Medium",
  "identity_decision_override": false,
  "constraint_version": "inevitable_standard_constraints_v1"
}

// totals.inevitable_standard.revenue_in_structure
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

## 3. Is the report component reading them? No.

The component reads only these keys off `payload.inevitable_standard`: `overall`,
`approaches`, `pillars`, `context_answers`, `commercial_context`. It never references
`constraints` or `revenue_in_structure`. A grep of the whole file for
`constraint | revenue_in_structure | point_estimate | primary_constraint | false_constraint |
priority_fix | disclaimer | range_low | range_high` returns a single hit: a card label that
displays the Q13 free-text answer.

| What you saw | What it actually is | Source (line) |
|---|---|---|
| **Pillar scores** | Real - `score.pillars`, present since `dcbb7e79` | ~467 |
| **"a constraint"** | The **"lowest pillar" placeholder**: *"The lowest current pillar is Decision at 25%."* Computed **client-side** by sorting `score.pillars` by percentage - it is **not** `constraints.primary_constraint`. It reads "Decision" because Decision is both the lowest pillar and the primary constraint this time; they coincide whenever there is no Identity/Decision override. Plus a card titled *"The constraint you named"* that just echoes the Q13 answer (`"test"`). | 317-323, 499, 361 |
| **"a dollar figure"** | A **commercial-context band label**, not the RRE. The cards render `revenue_band` -> *"Under 100k"*, `initial_customer_value_band` -> *"50k-100k"*, `monthly_opportunity_band` -> *"6-10 opportunities"*, via a label lookup (`commercialContextValue`). | 368-372 |

The RRE `point_estimate` (5156), the range (4125-6188), the disclaimer,
`priority_fix_order`, `secondary_constraint`, `false_constraint`, `confidence` -
**none of them appear anywhere in the rendered page.**

## Summary

Stage 3 put the data in the payload; Stage 4 (not started) is what makes the report
component read and display it. Right now the report is the pre-existing `dcbb7e79`
version showing base-score content only. The "constraint" and "dollar figure" you spotted
are coincidental look-alikes - a client-side minimum of the pillar percentages, and a
revenue-band label - not the constraint engine or RRE output.
