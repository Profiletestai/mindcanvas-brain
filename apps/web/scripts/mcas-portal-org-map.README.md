# MCAS → portal organisation mapping

Consumed by `scripts/backfill-mcas-portal-org.ts`. JSON has no comments, so the
reasoning lives here.

## Included

| mcas.organisations | portal.orgs | links | applications |
|---|---|---|---|
| `profiletest-ai` | `profiletest-ai` | 12 | 41 |

Exact slug match on both sides, and the only MCAS organisation that owns
`test_links` — which is what the portal link list reads.

**Confirm before running with `--apply`:** `profiletest-ai` is the platform
vendor's own name. If that portal org is an internal/admin org rather than a
customer tenant, attributing 41 candidate records to it is wrong and this file
should be emptied instead.

## Deliberately excluded

`atumaphire` — 154 applications, **0 test links**, and no `portal.orgs` row with
a matching slug. Those applications arrive through the partner API
(`/api/public/mcas/partner/export/[partnerKey]/[applicationId]`), which is out of
scope for the portal integration, and the backfill reaches assessments via
`test_link_id` so it would attribute nothing for them anyway. Add an entry here
only if a portal organisation is created for Atumaphire and its applications are
meant to appear in the portal.
