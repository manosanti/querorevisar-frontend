-- Premium annual plan: a subscription is charged every month (monthly) or every 12 months (annual).
alter table subscriptions
  add column billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual'));
