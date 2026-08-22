-- =============================================================
-- MCAS Portal Integration — preflight checks
--
-- Read-only. Run this BEFORE the 20260813* migrations and keep the output:
-- several statements in those migrations are written against expected shapes
-- (the mcas schema has no migration history in this repo, so its tables were
-- created out of band). Anything surprising here means a migration needs
-- adjusting before it runs.
-- =============================================================

-- 1. Ownership columns: do equivalents already exist? If a column with the same
--    meaning is already there, drop it from 20260813130000 rather than adding a
--    duplicate.
select table_schema, table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema in ('mcas', 'portal')
   and (column_name ilike '%portal_org%' or column_name = 'org_id')
 order by table_schema, table_name, column_name;

-- 2. portal.tests shape + uniqueness. 20260813120000 inserts the MCAS catalogue
--    row using (org_id, name, slug, status, meta) — confirm all five exist.
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'portal' and table_name = 'tests'
 order by ordinal_position;

select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'portal.tests'::regclass;

-- 3. Catalogue tests. The MCAS row is created in the same org as these; if this
--    returns no rows, 20260813120000 raises and you must pick the org by hand.
select id, org_id, slug, status, created_at
  from portal.tests
 where slug in ('growth-engine-diagnostic', 'lead-system', 'mcas-core-alignment');

-- 4. Role values. lib/portal/authz.ts treats these as write roles:
--      org_owner, org_admin, owner, admin
--    Anything else in this list that should be able to create links must be
--    added to PORTAL_WRITE_ROLES.
select role, count(*) from portal.user_orgs group by role order by 2 desc;

-- 5. usage_ledger duplicates. 20260813140000 adds a unique index over
--    (reference_id) where reference_type='submission'. If this returns rows the
--    index will fail — review them with the team before de-duping, they are
--    billing history.
select reference_id, event_type, count(*) as rows, min(created_at), max(created_at)
  from portal.usage_ledger
 where reference_type = 'submission'
 group by reference_id, event_type
having count(*) > 1
 order by 3 desc;

-- 6. mcas.results primary key. 20260813130000 creates a view selecting r.id as
--    result_id; confirm the column exists.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'mcas' and table_name = 'results'
 order by ordinal_position;

-- 7. mcas.organisations shape. ensureMcasOrganisationForPortalOrg() looks the
--    row up by slug and inserts (name, slug, status) when missing — confirm no
--    other NOT NULL column without a default would block that insert, and that
--    slug is unique.
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'mcas' and table_name = 'organisations'
 order by ordinal_position;

select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'mcas.organisations'::regclass;

-- 8. Column lists for the three tables gaining portal_org_id.
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'mcas'
   and table_name in ('test_links', 'partner_applications', 'assessments')
 order by table_name, ordinal_position;

-- 9. Blast radius of 20260813121000 (the re-sync). These orgs have the People
--    engine active; after the engine mapping exists they gain the MCAS test and
--    lose any billing-sourced test that belongs to no selected engine. Diff
--    this before and after and eyeball the revocations.
select o.slug,
       o.name,
       array_agg(distinct oe.engine_key order by oe.engine_key) as engines,
       array_agg(distinct t.slug order by t.slug)               as tests_now
  from portal.orgs o
  join portal.org_engines oe    on oe.org_id = o.id and oe.status = 'active'
  left join portal.org_test_access ota on ota.org_id = o.id and ota.status = 'active'
  left join portal.tests t      on t.id = ota.test_id
 where exists (
         select 1 from portal.org_engines x
          where x.org_id = o.id and x.engine_key = 'people' and x.status = 'active'
       )
 group by o.slug, o.name
 order by o.slug;

-- 10. Backfill sizing: MCAS orgs and their volumes, so the mapping file for
--     scripts/backfill-mcas-portal-org.ts can be agreed against real numbers.
select mo.slug        as mcas_slug,
       mo.name        as mcas_name,
       po.slug        as portal_slug_exact_match,
       count(distinct tl.id) as links,
       count(distinct pa.id) as applications
  from mcas.organisations mo
  left join portal.orgs po            on po.slug = mo.slug
  left join mcas.test_links tl        on tl.org_id = mo.id
  left join mcas.partner_applications pa on pa.org_id = mo.id
 group by mo.slug, mo.name, po.slug
 order by 5 desc nulls last;
