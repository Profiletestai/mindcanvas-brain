-- Run in the Supabase SQL editor. Returns ONE row, ONE column. Paste it back whole.
select jsonb_pretty(jsonb_build_object(

  'portal_tests_columns', (
    select jsonb_agg(column_name || ' ' || data_type ||
                     case when is_nullable='NO' then ' NOT NULL' else '' end ||
                     coalesce(' DEFAULT ' || column_default, '') order by ordinal_position)
      from information_schema.columns
     where table_schema='portal' and table_name='tests'),

  'portal_tests_constraints', (
    select jsonb_agg(conname || ' :: ' || pg_get_constraintdef(oid))
      from pg_constraint where conrelid='portal.tests'::regclass),

  'catalogue_tests', (
    select jsonb_agg(jsonb_build_object('id',id,'org_id',org_id,'slug',slug,'status',status))
      from portal.tests
     where slug in ('growth-engine-diagnostic','lead-system','mcas-core-alignment','mcas')),

  'engines', (select jsonb_agg(to_jsonb(e)) from portal.engines e),
  'engine_tests', (select jsonb_agg(to_jsonb(et)) from portal.engine_tests et),

  'user_orgs_roles', (
    select jsonb_agg(jsonb_build_object('role', role, 'n', n))
      from (select role, count(*) n from portal.user_orgs group by role) s),

  'usage_ledger_columns', (
    select jsonb_agg(column_name || ' ' || data_type order by ordinal_position)
      from information_schema.columns
     where table_schema='portal' and table_name='usage_ledger'),

  'usage_ledger_submission_dupes', (
    select coalesce(jsonb_agg(jsonb_build_object('reference_id',reference_id,'event_type',event_type,'n',n)), '[]'::jsonb)
      from (select reference_id, event_type, count(*) n
              from portal.usage_ledger
             where reference_type='submission'
             group by 1,2 having count(*) > 1) d),

  'mcas_organisations_columns', (
    select jsonb_agg(column_name || ' ' || data_type ||
                     case when is_nullable='NO' then ' NOT NULL' else '' end ||
                     coalesce(' DEFAULT ' || column_default, '') order by ordinal_position)
      from information_schema.columns
     where table_schema='mcas' and table_name='organisations'),

  'mcas_organisations_constraints', (
    select jsonb_agg(conname || ' :: ' || pg_get_constraintdef(oid))
      from pg_constraint where conrelid='mcas.organisations'::regclass),

  'mcas_test_links_columns', (
    select jsonb_agg(column_name || ' ' || data_type ||
                     case when is_nullable='NO' then ' NOT NULL' else '' end order by ordinal_position)
      from information_schema.columns
     where table_schema='mcas' and table_name='test_links'),

  'mcas_partner_applications_columns', (
    select jsonb_agg(column_name || ' ' || data_type ||
                     case when is_nullable='NO' then ' NOT NULL' else '' end order by ordinal_position)
      from information_schema.columns
     where table_schema='mcas' and table_name='partner_applications'),

  'mcas_assessments_columns', (
    select jsonb_agg(column_name || ' ' || data_type ||
                     case when is_nullable='NO' then ' NOT NULL' else '' end order by ordinal_position)
      from information_schema.columns
     where table_schema='mcas' and table_name='assessments'),

  'mcas_results_columns', (
    select jsonb_agg(column_name || ' ' || data_type ||
                     case when is_nullable='NO' then ' NOT NULL' else '' end order by ordinal_position)
      from information_schema.columns
     where table_schema='mcas' and table_name='results'),

  'existing_portal_org_like_columns', (
    select coalesce(jsonb_agg(table_schema || '.' || table_name || '.' || column_name), '[]'::jsonb)
      from information_schema.columns
     where column_name ilike '%portal%org%'),

  'v_admin_candidate_database_def',
    pg_get_viewdef('mcas.v_admin_candidate_database'::regclass, true),

  'mcas_org_volumes', (
    select jsonb_agg(jsonb_build_object(
             'mcas_slug', mo.slug, 'mcas_name', mo.name,
             'portal_slug_exact_match', po.slug,
             'links', (select count(*) from mcas.test_links tl where tl.org_id = mo.id),
             'applications', (select count(*) from mcas.partner_applications pa where pa.org_id = mo.id)))
      from mcas.organisations mo
      left join portal.orgs po on po.slug = mo.slug)

)) as preflight;
