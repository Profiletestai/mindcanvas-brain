-- =============================================================
-- MCAS Portal Integration — rollout verification
--
-- Run the numbered block that matches the step you just completed.
-- Every statement here is read-only except STEP 2a (creates a snapshot table)
-- and STEP 9 (drops it).
-- =============================================================


-- -------------------------------------------------------------
-- STEP 1 — after 20260813120000_map_people_engine_mcas_test.sql
-- Expect exactly one row, engine_key = 'people'.
-- -------------------------------------------------------------
select t.id, t.org_id, t.slug, t.status, t.mode, et.engine_key
  from portal.tests t
  left join portal.engine_tests et on et.test_id = t.id
 where t.slug = 'mcas-core-alignment';


-- -------------------------------------------------------------
-- STEP 2a — BEFORE 20260813121000_resync_people_engine_test_access.sql
-- Snapshot current access for People-engine orgs so the revocations can be
-- diffed. Creates a real table (temp tables die with the SQL editor session).
-- -------------------------------------------------------------
drop table if exists portal.zz_mcas_access_before;

create table portal.zz_mcas_access_before as
select ota.org_id,
       ota.test_id,
       o.slug  as org_slug,
       t.slug  as test_slug,
       ota.status,
       ota.source
  from portal.org_test_access ota
  join portal.orgs  o on o.id = ota.org_id
  join portal.tests t on t.id = ota.test_id
 where exists (
         select 1 from portal.org_engines oe
          where oe.org_id = ota.org_id
            and oe.engine_key = 'people'
            and oe.status = 'active');

select count(*) as snapshot_rows from portal.zz_mcas_access_before;


-- -------------------------------------------------------------
-- STEP 2b — AFTER 20260813121000
-- Anything with change_type = 'REVOKED' is access an org just lost. Confirm
-- each one is intended before continuing.
-- -------------------------------------------------------------
with after_state as (
  select ota.org_id, ota.test_id, o.slug as org_slug, t.slug as test_slug,
         ota.status, ota.source
    from portal.org_test_access ota
    join portal.orgs  o on o.id = ota.org_id
    join portal.tests t on t.id = ota.test_id
   where exists (
           select 1 from portal.org_engines oe
            where oe.org_id = ota.org_id
              and oe.engine_key = 'people'
              and oe.status = 'active')
)
select coalesce(b.org_slug,  a.org_slug)  as org_slug,
       coalesce(b.test_slug, a.test_slug) as test_slug,
       b.status as before_status,
       a.status as after_status,
       case
         when b.org_id is null                        then 'NEW'
         when a.status = 'active' and b.status <> 'active' then 'GRANTED'
         when a.status <> 'active' and b.status = 'active' then 'REVOKED'
         else 'unchanged'
       end as change_type
  from portal.zz_mcas_access_before b
  full join after_state a
    on a.org_id = b.org_id and a.test_id = b.test_id
 where b.status is distinct from a.status or b.org_id is null
 order by change_type, org_slug;


-- -------------------------------------------------------------
-- STEP 3 — after 20260813130000_mcas_portal_org_ownership.sql
-- Expect 3 column rows and the view to be queryable (0 rows is correct
-- before the backfill).
-- -------------------------------------------------------------
select table_name, column_name, is_nullable
  from information_schema.columns
 where table_schema = 'mcas' and column_name = 'portal_org_id'
 order by table_name;

select count(*) as view_rows,
       count(*) filter (where portal_org_id is not null) as attributed_rows
  from mcas.v_portal_candidate_database;


-- -------------------------------------------------------------
-- STEP 4 — after 20260813140000_usage_ledger_idempotent_submissions.sql
-- Expect one index row, and the function to report 3 arguments.
-- -------------------------------------------------------------
select indexname, indexdef
  from pg_indexes
 where schemaname = 'portal'
   and indexname = 'uq_usage_ledger_submission_reference';

select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'portal' and p.proname = 'fn_reserve_submission';


-- -------------------------------------------------------------
-- STEP 6 — after creating a link in the portal
-- Expect one row with portal_org_id set.
-- -------------------------------------------------------------
select tl.id, tl.name, tl.status, tl.org_id, tl.portal_org_id,
       o.slug as portal_org_slug, tl.public_token, tl.created_at
  from mcas.test_links tl
  left join portal.orgs o on o.id = tl.portal_org_id
 where tl.portal_org_id is not null
 order by tl.created_at desc
 limit 10;


-- -------------------------------------------------------------
-- STEP 7 — after completing an assessment as a candidate
-- Ownership must be identical down all three rows, and result_id non-null.
-- -------------------------------------------------------------
select tl.name                 as link_name,
       tl.portal_org_id        as link_owner,
       pa.portal_org_id        as application_owner,
       a.portal_org_id         as assessment_owner,
       pa.status               as application_status,
       a.status                as assessment_status,
       r.id                    as result_id,
       a.id                    as assessment_id
  from mcas.test_links tl
  join mcas.partner_applications pa on pa.test_link_id = tl.id
  left join mcas.assessments a on a.partner_application_id = pa.id
  left join mcas.results r on r.assessment_id = a.id
 where tl.portal_org_id is not null
 order by pa.created_at desc
 limit 10;

-- One ledger row per assessment. 'engine_trial_consumed' means a People-engine
-- trial credit was spent; 'trial_consumed' means the monthly allowance was.
select ul.reference_id, ul.event_type, ul.engine_key, ul.quantity,
       o.slug as org_slug, ul.created_at
  from portal.usage_ledger ul
  join portal.orgs o on o.id = ul.org_id
 where ul.reference_id like 'mcas:%'
 order by ul.created_at desc
 limit 10;


-- -------------------------------------------------------------
-- STEP 8 — idempotency check, after submitting the SAME assessment twice
-- Must return NO rows. Any row means one assessment was charged twice.
-- -------------------------------------------------------------
select reference_id, count(*) as charges
  from portal.usage_ledger
 where reference_type = 'submission'
   and reference_id like 'mcas:%'
 group by reference_id
having count(*) > 1;

-- Trial credits should have gone down by exactly the number of DISTINCT
-- assessments completed, not the number of submit requests.
select o.slug, eta.engine_key, eta.quantity_allocated, eta.quantity_remaining
  from portal.engine_trial_allocations eta
  join portal.orgs o on o.id = eta.org_id
 where eta.engine_key = 'people';


-- -------------------------------------------------------------
-- STEP 9 — after the backfill
-- -------------------------------------------------------------
select 'test_links' as tbl,
       count(*) as total,
       count(*) filter (where portal_org_id is not null) as attributed
  from mcas.test_links
union all
select 'partner_applications', count(*),
       count(*) filter (where portal_org_id is not null)
  from mcas.partner_applications
union all
select 'assessments', count(*),
       count(*) filter (where portal_org_id is not null)
  from mcas.assessments;

-- Clean up the snapshot table once the rollout is signed off.
-- drop table if exists portal.zz_mcas_access_before;
