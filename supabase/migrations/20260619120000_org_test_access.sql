-- =============================================================
-- Migration: Org-level Test Access Driven by Billing
-- - portal.plan_test_access: admin-curated tier_definition -> tests mapping
-- - portal.org_test_access:  source of truth for org test access
-- - portal.v_user_test_access: derived per-user view
-- - sync/suspend/reactivate functions
-- - triggers on portal.entitlements and portal.orgs to automate
-- =============================================================

-- -------------------------------------------------------
-- 1. portal.plan_test_access
-- -------------------------------------------------------
create table portal.plan_test_access (
  id                 uuid primary key default gen_random_uuid(),
  tier_definition_id uuid not null references portal.tier_definitions(id) on delete cascade,
  test_id            uuid not null references portal.tests(id) on delete cascade,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tier_definition_id, test_id)
);

create index idx_plan_test_access_tier_def_active
  on portal.plan_test_access (tier_definition_id)
  where active;

create trigger trg_plan_test_access_updated_at
  before update on portal.plan_test_access
  for each row execute function portal.fn_set_updated_at();

alter table portal.plan_test_access enable row level security;

-- -------------------------------------------------------
-- 2. portal.org_test_access
-- -------------------------------------------------------
create table portal.org_test_access (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references portal.orgs(id)  on delete cascade,
  test_id    uuid not null references portal.tests(id) on delete cascade,
  status     text not null default 'active'
               check (status in ('active','suspended','revoked')),
  source     text not null default 'billing'
               check (source in ('billing','manual','migration')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, test_id)
);

create index idx_org_test_access_org_active
  on portal.org_test_access (org_id)
  where status = 'active';

create index idx_org_test_access_test_active
  on portal.org_test_access (test_id)
  where status = 'active';

create trigger trg_org_test_access_updated_at
  before update on portal.org_test_access
  for each row execute function portal.fn_set_updated_at();

alter table portal.org_test_access enable row level security;

-- Org members may read their org's access rows.
create policy org_test_access_member_select
  on portal.org_test_access
  for select
  to authenticated
  using (
    exists (
      select 1
        from portal.user_orgs uo
       where uo.org_id  = org_test_access.org_id
         and uo.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 3. View: portal.v_user_test_access
-- -------------------------------------------------------
create or replace view portal.v_user_test_access
  with (security_invoker = true, security_barrier = true) as
  select
    uo.user_id,
    ota.org_id,
    ota.test_id,
    ota.status
  from portal.user_orgs uo
  join portal.org_test_access ota
    on ota.org_id = uo.org_id
  where ota.status = 'active';

grant select on portal.v_user_test_access to authenticated;

comment on view portal.v_user_test_access is
  'Per-user active test access derived from user_orgs x org_test_access.';

-- -------------------------------------------------------
-- 4. portal.fn_sync_org_test_access(org_id, tier_definition_id)
-- -------------------------------------------------------
create or replace function portal.fn_sync_org_test_access(
  p_org_id             uuid,
  p_tier_definition_id uuid
) returns void
language plpgsql security definer set search_path = portal
as $$
begin
  if p_tier_definition_id is null then
    raise exception 'fn_sync_org_test_access: p_tier_definition_id is null for org %', p_org_id;
  end if;

  -- Serialize concurrent syncs for the same org.
  perform pg_advisory_xact_lock(hashtext('portal.org_test_access:' || p_org_id::text));

  -- Grant or refresh access for every test mapped to this tier definition.
  insert into portal.org_test_access (org_id, test_id, status, source, granted_at, revoked_at)
  select p_org_id, pta.test_id, 'active', 'billing', now(), null
    from portal.plan_test_access pta
   where pta.tier_definition_id = p_tier_definition_id
     and pta.active = true
  on conflict (org_id, test_id) do update
     set status     = 'active',
         source     = case when portal.org_test_access.source in ('manual','migration')
                           then portal.org_test_access.source
                           else 'billing' end,
         revoked_at = null,
         granted_at = case when portal.org_test_access.status = 'active'
                           then portal.org_test_access.granted_at
                           else now() end;

  -- Revoke billing-sourced rows no longer in the tier mapping.
  update portal.org_test_access ota
     set status     = 'revoked',
         revoked_at = now()
   where ota.org_id = p_org_id
     and ota.source = 'billing'
     and ota.status <> 'revoked'
     and not exists (
       select 1
         from portal.plan_test_access pta
        where pta.tier_definition_id = p_tier_definition_id
          and pta.active             = true
          and pta.test_id            = ota.test_id
     );
end;
$$;

grant execute on function portal.fn_sync_org_test_access(uuid, uuid) to service_role;

-- -------------------------------------------------------
-- 5. portal.fn_suspend_org_test_access(org_id)
-- -------------------------------------------------------
create or replace function portal.fn_suspend_org_test_access(
  p_org_id uuid
) returns void
language plpgsql security definer set search_path = portal
as $$
begin
  update portal.org_test_access
     set status = 'suspended'
   where org_id = p_org_id
     and status = 'active';
end;
$$;

grant execute on function portal.fn_suspend_org_test_access(uuid) to service_role;

-- -------------------------------------------------------
-- 6. portal.fn_reactivate_org_test_access(org_id)
-- -------------------------------------------------------
create or replace function portal.fn_reactivate_org_test_access(
  p_org_id uuid
) returns void
language plpgsql security definer set search_path = portal
as $$
begin
  update portal.org_test_access
     set status = 'active'
   where org_id = p_org_id
     and status = 'suspended';
end;
$$;

grant execute on function portal.fn_reactivate_org_test_access(uuid) to service_role;

-- -------------------------------------------------------
-- 7. Trigger A: portal.entitlements -> sync/suspend access
-- -------------------------------------------------------
create or replace function portal.fn_entitlements_sync_test_access()
returns trigger
language plpgsql security definer set search_path = portal
as $$
declare
  v_tier_def_id uuid;
begin
  if new.status = 'active' then
    v_tier_def_id := new.tier_definition_id;

    -- Fallback: resolve current tier_definition by tier when entitlement
    -- row was written without tier_definition_id (legacy/migrated rows).
    -- Prefer the most recently created open-ended definition for determinism.
    if v_tier_def_id is null then
      select td.id
        into v_tier_def_id
        from portal.tier_definitions td
       where td.tier = new.tier
         and td.valid_until is null
       order by td.created_at desc, td.id desc
       limit 1;
    end if;

    if v_tier_def_id is null then
      raise exception
        'fn_entitlements_sync_test_access: no tier_definition for entitlement % (tier %)',
        new.id, new.tier;
    end if;

    perform portal.fn_sync_org_test_access(new.org_id, v_tier_def_id);
  elsif new.status = 'suspended' then
    perform portal.fn_suspend_org_test_access(new.org_id);
  elsif new.status = 'archived' then
    -- Terminal: revoke billing-sourced access, leave manual grants intact.
    update portal.org_test_access
       set status     = 'revoked',
           revoked_at = now()
     where org_id = new.org_id
       and source = 'billing'
       and status <> 'revoked';
  end if;

  return new;
end;
$$;

create trigger trg_entitlements_sync_test_access
  after insert or update of status, tier, tier_definition_id on portal.entitlements
  for each row execute function portal.fn_entitlements_sync_test_access();

-- -------------------------------------------------------
-- 8. Trigger B: portal.orgs.status -> suspend/reactivate access
-- -------------------------------------------------------
create or replace function portal.fn_orgs_sync_test_access()
returns trigger
language plpgsql security definer set search_path = portal
as $$
begin
  if new.status = 'suspended' then
    perform portal.fn_suspend_org_test_access(new.id);
  elsif new.status = 'archived' then
    update portal.org_test_access
       set status     = 'revoked',
           revoked_at = now()
     where org_id = new.id
       and source = 'billing'
       and status <> 'revoked';
  elsif new.status = 'active'
        and old.status in ('pending_activation','suspended','past_due') then
    perform portal.fn_reactivate_org_test_access(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_orgs_status_sync_test_access
  after update of status on portal.orgs
  for each row
  when (old.status is distinct from new.status)
  execute function portal.fn_orgs_sync_test_access();
