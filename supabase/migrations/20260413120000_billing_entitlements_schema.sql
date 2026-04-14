-- =============================================================
-- Migration: Billing & Entitlement Schema
-- Creates tables for org relationships, billing, entitlements,
-- usage tracking, Stripe integration, and tier definitions.
-- =============================================================

-- -------------------------------------------------------
-- 0. Helper: reusable updated_at trigger function
-- -------------------------------------------------------
create or replace function portal.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------
-- 1. portal.org_relationships
-- -------------------------------------------------------
create table portal.org_relationships (
  id               uuid primary key default gen_random_uuid(),
  parent_org_id    uuid not null references portal.orgs(id),
  child_org_id     uuid not null references portal.orgs(id),
  relationship_type text not null default 'licensee',
  status           text not null default 'active'
                     check (status in ('active', 'suspended', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint chk_no_self_relationship check (parent_org_id != child_org_id)
);

-- A child can have at most one active licensee parent
create unique index uq_org_relationships_active_licensee
  on portal.org_relationships (child_org_id)
  where relationship_type = 'licensee' and status = 'active';

create index idx_org_relationships_parent on portal.org_relationships (parent_org_id);
create index idx_org_relationships_child  on portal.org_relationships (child_org_id);

create trigger trg_org_relationships_updated_at
  before update on portal.org_relationships
  for each row execute function portal.fn_set_updated_at();

alter table portal.org_relationships enable row level security;

-- -------------------------------------------------------
-- 2. portal.tier_definitions
-- -------------------------------------------------------
create table portal.tier_definitions (
  id                          uuid primary key default gen_random_uuid(),
  tier                        int not null,
  version                     int not null,
  included_trials_per_month   int not null,
  extra_trial_unit_price_cents int not null,
  extra_trials_cap            int,          -- null = unlimited
  valid_from                  timestamptz not null,
  valid_until                 timestamptz,  -- null = still current
  created_at                  timestamptz not null default now(),

  constraint uq_tier_version unique (tier, version)
);

alter table portal.tier_definitions enable row level security;

-- -------------------------------------------------------
-- 3. portal.billing_accounts
-- -------------------------------------------------------
create table portal.billing_accounts (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references portal.orgs(id),
  billing_type            text not null
                            check (billing_type in ('owner', 'licensee')),
  tier                    int not null
                            check (tier between 1 and 4),
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  stripe_status           text,  -- active, past_due, unpaid, canceled, etc.
  period_start            timestamptz,
  period_end              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One org can have at most one active billing account per billing_type
create unique index uq_billing_accounts_active
  on portal.billing_accounts (org_id, billing_type)
  where stripe_status = 'active';

create index idx_billing_accounts_org on portal.billing_accounts (org_id);

create trigger trg_billing_accounts_updated_at
  before update on portal.billing_accounts
  for each row execute function portal.fn_set_updated_at();

alter table portal.billing_accounts enable row level security;

-- -------------------------------------------------------
-- 4. portal.tier_prices
-- -------------------------------------------------------
create table portal.tier_prices (
  id                 uuid primary key default gen_random_uuid(),
  billing_type       text not null
                       check (billing_type in ('owner', 'licensee')),
  tier_definition_id uuid not null references portal.tier_definitions(id),
  stripe_price_id    text unique,
  interval           text not null
                       check (interval in ('month', 'year')),
  currency           text not null default 'usd',
  amount_cents       int not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create index idx_tier_prices_tier_def on portal.tier_prices (tier_definition_id);

alter table portal.tier_prices enable row level security;

-- -------------------------------------------------------
-- 5. portal.entitlements
-- -------------------------------------------------------
create table portal.entitlements (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references portal.orgs(id),
  billing_account_id          uuid not null references portal.billing_accounts(id),
  tier                        int not null,
  included_trials_per_month   int not null,
  extra_trials_purchased      int not null default 0,
  extra_trials_cap            int,                -- null = unlimited
  extra_trial_unit_price_in_cents int not null,
  status                      text not null default 'active'
                                check (status in ('active', 'suspended', 'archived')),
  period_start                timestamptz not null,
  period_end                  timestamptz not null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  tier_definition_id          uuid references portal.tier_definitions(id),

  constraint uq_entitlement_period unique (billing_account_id, period_start)
);

create index idx_entitlements_org             on portal.entitlements (org_id);
create index idx_entitlements_billing_account on portal.entitlements (billing_account_id);
create index idx_entitlements_tier_def        on portal.entitlements (tier_definition_id);

create trigger trg_entitlements_updated_at
  before update on portal.entitlements
  for each row execute function portal.fn_set_updated_at();

alter table portal.entitlements enable row level security;

-- -------------------------------------------------------
-- 6. portal.usage_ledger
-- -------------------------------------------------------
create table portal.usage_ledger (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references portal.orgs(id),
  billing_account_id uuid not null references portal.billing_accounts(id),
  event_type         text not null
                       check (event_type in ('trial_consumed', 'extra_trials_purchased', 'period_reset')),
  quantity           int not null,
  reference_type     text not null
                       check (reference_type in ('submission', 'stripe_invoice', 'manual')),
  reference_id       text,
  created_at         timestamptz not null default now()
);

create index idx_usage_ledger_org             on portal.usage_ledger (org_id);
create index idx_usage_ledger_billing_account on portal.usage_ledger (billing_account_id);
create index idx_usage_ledger_created_at      on portal.usage_ledger (created_at);

alter table portal.usage_ledger enable row level security;

-- -------------------------------------------------------
-- 7. portal.stripe_events
-- -------------------------------------------------------
create table portal.stripe_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  type            text not null,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  status          text not null default 'ok'
                    check (status in ('ok', 'failed')),
  error           text,
  payload         jsonb,
  updated_at      timestamptz not null default now()
);

create index idx_stripe_events_type on portal.stripe_events (type);

create trigger trg_stripe_events_updated_at
  before update on portal.stripe_events
  for each row execute function portal.fn_set_updated_at();

alter table portal.stripe_events enable row level security;

-- -------------------------------------------------------
-- 8. portal.usage_credit_purchases
-- -------------------------------------------------------
create table portal.usage_credit_purchases (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references portal.orgs(id),
  billing_account_id      uuid not null references portal.billing_accounts(id),
  entitlement_id          uuid not null references portal.entitlements(id),
  stripe_invoice_id       text not null,
  stripe_invoice_item_id  text,
  stripe_price_id         text not null,
  credit_type             text not null default 'trial',
  quantity                int not null check (quantity > 0),
  unit_price_cents        int not null,
  total_cents             int not null,  -- quantity * unit_price, denormalized
  status                  text not null default 'pending'
                            check (status in ('pending', 'paid')),
  purchased_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_usage_credit_purchases_org             on portal.usage_credit_purchases (org_id);
create index idx_usage_credit_purchases_billing_account on portal.usage_credit_purchases (billing_account_id);
create index idx_usage_credit_purchases_entitlement     on portal.usage_credit_purchases (entitlement_id);

create trigger trg_usage_credit_purchases_updated_at
  before update on portal.usage_credit_purchases
  for each row execute function portal.fn_set_updated_at();

alter table portal.usage_credit_purchases enable row level security;

-- -------------------------------------------------------
-- 9. View: portal.v_current_entitlements
-- -------------------------------------------------------
create or replace view portal.v_current_entitlements as
  select *
  from portal.entitlements
  where status = 'active';

comment on view portal.v_current_entitlements is
  'Active entitlements only — use for runtime quota checks.';
