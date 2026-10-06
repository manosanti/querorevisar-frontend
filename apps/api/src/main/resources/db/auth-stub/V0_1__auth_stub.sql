-- Plain Postgres (local embedded database and tests) has no Supabase `auth` schema. This stub provides the
-- auth.users table that V1__init.sql references. Only applied when DB_AUTH_STUB=true (local profile and tests);
-- dev and prod run on Supabase, which owns the real auth schema.
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  encrypted_password text,
  is_anonymous       boolean not null default false,
  raw_user_meta_data jsonb,
  created_at         timestamptz not null default now()
);
