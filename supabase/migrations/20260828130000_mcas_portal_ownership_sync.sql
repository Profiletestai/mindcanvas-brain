-- Ensure portal-owned MCAS links propagate their ownership to applications
-- and assessments, regardless of which application route creates them.

-- -------------------------------------------------------
-- 1. Partner application ownership
-- -------------------------------------------------------
create or replace function mcas.fn_inherit_partner_application_portal_org()
returns trigger
language plpgsql
security definer
set search_path = mcas, portal
as $$
begin
  if new.portal_org_id is null
     and new.test_link_id is not null then
    select tl.portal_org_id
      into new.portal_org_id
      from mcas.test_links tl
     where tl.id = new.test_link_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_partner_applications_inherit_portal_org
  on mcas.partner_applications;

create trigger trg_partner_applications_inherit_portal_org
  before insert or update of test_link_id, portal_org_id
  on mcas.partner_applications
  for each row
  execute function mcas.fn_inherit_partner_application_portal_org();

-- -------------------------------------------------------
-- 2. Assessment ownership
-- -------------------------------------------------------
create or replace function mcas.fn_inherit_assessment_portal_org()
returns trigger
language plpgsql
security definer
set search_path = mcas, portal
as $$
begin
  if new.portal_org_id is null
     and new.partner_application_id is not null then
    select pa.portal_org_id
      into new.portal_org_id
      from mcas.partner_applications pa
     where pa.id = new.partner_application_id;
  end if;

  if new.portal_org_id is null
     and new.test_link_id is not null then
    select tl.portal_org_id
      into new.portal_org_id
      from mcas.test_links tl
     where tl.id = new.test_link_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assessments_inherit_portal_org
  on mcas.assessments;

create trigger trg_assessments_inherit_portal_org
  before insert or update of
    partner_application_id,
    test_link_id,
    portal_org_id
  on mcas.assessments
  for each row
  execute function mcas.fn_inherit_assessment_portal_org();

-- -------------------------------------------------------
-- 3. Reconcile existing portal-owned applications
-- -------------------------------------------------------
update mcas.partner_applications pa
   set portal_org_id = tl.portal_org_id
  from mcas.test_links tl
 where pa.test_link_id = tl.id
   and pa.portal_org_id is null
   and tl.portal_org_id is not null;

-- -------------------------------------------------------
-- 4. Reconcile assessments through their applications
-- -------------------------------------------------------
update mcas.assessments a
   set portal_org_id = pa.portal_org_id
  from mcas.partner_applications pa
 where a.partner_application_id = pa.id
   and a.portal_org_id is null
   and pa.portal_org_id is not null;

-- Fallback for assessments connected directly to a portal-owned link.
update mcas.assessments a
   set portal_org_id = tl.portal_org_id
  from mcas.test_links tl
 where a.test_link_id = tl.id
   and a.portal_org_id is null
   and tl.portal_org_id is not null;