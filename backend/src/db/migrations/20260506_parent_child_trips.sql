-- Arbebus real parent/child/trip foundation.
-- Apply on Supabase/Postgres before enabling parent dashboard in production.

create extension if not exists pgcrypto;

create table if not exists parent_users (
  id text primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists child_profiles (
  id text primary key,
  parent_id text not null references parent_users(id) on delete cascade,
  display_name text not null,
  avatar_color text default '#22C55E',
  grade text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saved_places (
  id text primary key,
  parent_id text not null references parent_users(id) on delete cascade,
  child_id text references child_profiles(id) on delete cascade,
  label text not null,
  place_type text not null default 'custom',
  title text not null,
  subtitle text,
  latitude double precision not null,
  longitude double precision not null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trusted_routes (
  id text primary key,
  parent_id text not null references parent_users(id) on delete cascade,
  child_id text references child_profiles(id) on delete cascade,
  title text not null,
  origin jsonb not null default '{}'::jsonb,
  destination jsonb not null default '{}'::jsonb,
  route_option jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists child_trips (
  id text primary key,
  parent_id text not null references parent_users(id) on delete cascade,
  child_id text references child_profiles(id) on delete set null,
  status text not null default 'planned',
  origin jsonb not null default '{}'::jsonb,
  destination jsonb not null default '{}'::jsonb,
  route_option jsonb not null default '{}'::jsonb,
  current_step_index integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trip_events (
  id text primary key,
  parent_id text not null references parent_users(id) on delete cascade,
  child_id text references child_profiles(id) on delete set null,
  trip_id text references child_trips(id) on delete cascade,
  event_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists idx_child_profiles_parent on child_profiles(parent_id);
create index if not exists idx_saved_places_parent_child on saved_places(parent_id, child_id);
create index if not exists idx_child_trips_parent_status on child_trips(parent_id, status);
create index if not exists idx_trip_events_parent_created on trip_events(parent_id, created_at desc);
