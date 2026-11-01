-- Run once to switch on recipe photo scanning (only needed if setup.sql was run before scanning existed).
create table if not exists public.recipe_scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists recipe_scans_user_time_idx on public.recipe_scans (user_id, created_at);
alter table public.recipe_scans enable row level security;
