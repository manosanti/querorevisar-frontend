-- QueroRevisar — schema inicial (Flyway V1__init.sql)
-- Postgres 15+ (Supabase). Usuários vêm de auth.users (Supabase Auth).
-- Dinheiro em centavos. Timestamps em timestamptz. Soft delete via deleted_at.

create extension if not exists pgcrypto;

create table profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  name           text,
  plan           text not null default 'free' check (plan in ('free','premium')),
  premium_until  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table catalog_items (
  id             text primary key,
  category_id    text not null,
  category_name  text not null,
  icon           text not null,
  name           text not null,
  description    text,
  interval_km    integer,
  interval_months integer,
  vehicle_types  text[] not null,
  visual_inspection boolean not null default false,
  catalog_version integer not null
);

create table manufacturer_plans (
  id             text primary key,
  brand          text not null,
  model          text not null,
  data           jsonb not null,          -- estrutura de data/planos.json
  unique (brand, model)
);

create table vehicles (
  id             uuid primary key,        -- gerado no cliente (v7)
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null check (type in ('car','moto')),
  brand          text not null,
  model          text not null,
  year           smallint not null check (year between 1950 and 2100),
  plate          text,
  km             integer not null check (km >= 0),
  km_at          timestamptz not null,
  km_per_month   integer not null check (km_per_month >= 0),
  fipe_brand_code text, fipe_model_code text, fipe_year_code text, fipe_code text,
  status         text not null default 'active' check (status in ('active','archived')),
  position       integer not null default 0,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index vehicles_user_idx on vehicles(user_id) where deleted_at is null;
create index vehicles_sync_idx on vehicles(user_id, updated_at);

create table maintenance_records (
  id             uuid primary key,        -- gerado no cliente (v7)
  user_id        uuid not null references auth.users(id) on delete cascade,
  vehicle_id     uuid not null references vehicles(id) on delete cascade,
  item_id        text not null references catalog_items(id),
  km             integer not null check (km > 0),
  done_on        date,
  cost_cents     integer check (cost_cents >= 0),
  brand          text,
  place          text not null default 'home' check (place in ('home','shop')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index records_vehicle_item_idx on maintenance_records(vehicle_id, item_id, km desc) where deleted_at is null;
create index records_sync_idx on maintenance_records(user_id, updated_at);

create table alerts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  vehicle_id     uuid not null references vehicles(id) on delete cascade,
  run_date       date not null,
  items          jsonb not null,          -- [{itemId, status, pct, line}]
  channel        text check (channel in ('push','email')),
  sent_at        timestamptz,
  unique (vehicle_id, run_date)
);

create table push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  user_agent     text,
  created_at     timestamptz not null default now(),
  last_success_at timestamptz
);

create table subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  provider       text not null default 'mercadopago',
  provider_id    text not null unique,    -- preapproval id
  status         text not null,           -- pending | authorized | paused | cancelled
  next_billing_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table credit_purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  pack_id        text not null,
  credits        integer not null check (credits > 0),
  amount_cents   integer not null check (amount_cents > 0),
  method         text not null check (method in ('pix','card')),
  status         text not null default 'pending' check (status in ('pending','approved','rejected','expired','refunded')),
  provider_payment_id text unique,
  provider_preference_id text,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table credit_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  delta          integer not null,
  reason         text not null check (reason in ('purchase','premium_bonus','lookup','refund','admin')),
  ref_type       text,                    -- credit_purchase | subscription_payment | lookup
  ref_id         text,
  created_at     timestamptz not null default now(),
  unique (reason, ref_type, ref_id)       -- idempotência
);
create index ledger_user_idx on credit_ledger(user_id, created_at desc);
create view credit_balances as select user_id, coalesce(sum(delta),0)::int as balance from credit_ledger group by user_id;

create table vehicle_lookups (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  plate          text not null,
  product        text not null check (product in ('laudo','restricoes','leilao','debitos','basica','fipe')),
  mine           boolean not null default false,
  vehicle_id     uuid references vehicles(id) on delete set null,
  credits_spent  integer not null default 0,
  provider       text not null,
  result         jsonb not null,
  created_at     timestamptz not null default now()
);
create index lookups_user_idx on vehicle_lookups(user_id, created_at desc);

create table fipe_reference (            -- cache de marcas, modelos, anos
  key            text primary key,        -- ex: cars/brands, cars/brands/23/models
  data           jsonb not null,
  fetched_at     timestamptz not null default now()
);

create table fipe_prices (               -- preço atual por código fipe + ano (cache 7 dias)
  fipe_code      text not null,
  year_code      text not null,
  value_cents    integer not null,
  reference_month text not null,
  fetched_at     timestamptz not null default now(),
  primary key (fipe_code, year_code)
);

create table fipe_price_history (
  fipe_code      text not null,
  year_code      text not null,
  reference_month text not null,
  value_cents    integer not null,
  primary key (fipe_code, year_code, reference_month)
);

create table webhook_events (
  id             text primary key,        -- provider:type:data.id:x-request-id
  provider       text not null,
  type           text,
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  error          text
);

create table idempotency_keys (
  user_id        uuid not null,
  key            uuid not null,
  request_hash   text not null,
  response_status integer,
  response_body  jsonb,
  created_at     timestamptz not null default now(),
  primary key (user_id, key)
);

create table job_runs (
  job            text not null,
  run_date       date not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  stats          jsonb,
  primary key (job, run_date)
);

create table shedlock (name varchar(64) primary key, lock_until timestamp not null, locked_at timestamp not null, locked_by varchar(255) not null); -- opcional

-- RLS: o acesso é só pela API (role de serviço). Habilitar RLS sem policies bloqueia acesso direto pelo anon key.
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table maintenance_records enable row level security;
alter table alerts enable row level security;
alter table push_subscriptions enable row level security;
alter table subscriptions enable row level security;
alter table credit_purchases enable row level security;
alter table credit_ledger enable row level security;
alter table vehicle_lookups enable row level security;
