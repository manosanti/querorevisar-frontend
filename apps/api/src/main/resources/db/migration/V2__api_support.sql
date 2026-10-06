-- Support structures the API needs beyond docs/db.sql (V1).

-- Offline queue (POST /v1/sync): one row per mutation id, so a replayed batch is applied only once.
create table sync_mutations (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          uuid not null,
  type        text not null,
  status      text not null check (status in ('applied','rejected')),
  problem     jsonb,
  applied_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- FIPE daily request budget (FIPE_DAILY_BUDGET).
create table fipe_usage (
  day    date primary key,
  calls  integer not null default 0
);

-- Pix QR code and checkout link are returned again by GET /v1/credits/purchases/{id} (page reload while paying).
alter table credit_purchases add column qr_code text;
alter table credit_purchases add column qr_code_base64 text;
alter table credit_purchases add column init_point text;

-- Replayed responses keep their content type (application/json or application/problem+json).
alter table idempotency_keys add column response_content_type text;

-- Welcome e-mail is sent once, the first time a permanent (non-anonymous) account is seen.
alter table profiles add column welcome_sent_at timestamptz;

create index credit_purchases_user_idx on credit_purchases(user_id, created_at desc);
create index subscriptions_user_idx on subscriptions(user_id, created_at desc);
create index push_subscriptions_user_idx on push_subscriptions(user_id);
create index alerts_pending_idx on alerts(run_date) where sent_at is null;
create index lookups_sync_idx on vehicle_lookups(user_id, created_at);
create index webhook_events_pending_idx on webhook_events(received_at) where processed_at is null;

-- Supabase exposes the public schema through PostgREST. Every table is reached only through the API (table owner,
-- which bypasses RLS), so RLS without policies closes the remaining tables to the anon/authenticated keys too.
alter table catalog_items enable row level security;
alter table manufacturer_plans enable row level security;
alter table fipe_reference enable row level security;
alter table fipe_prices enable row level security;
alter table fipe_price_history enable row level security;
alter table webhook_events enable row level security;
alter table idempotency_keys enable row level security;
alter table job_runs enable row level security;
alter table shedlock enable row level security;
alter table sync_mutations enable row level security;
alter table fipe_usage enable row level security;
-- Views run with the owner's rights by default; make the balance view respect the caller's RLS.
alter view credit_balances set (security_invoker = true);
