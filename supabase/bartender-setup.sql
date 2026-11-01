-- AI bartender and ratings. Run once in Supabase (SQL Editor > New query > paste > Run).
-- Safe to run again.

-- Each person's saved bar supplies (liquors, syrups, bitters). Private to them.
create table if not exists public.bars (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bars enable row level security;
drop policy if exists "People see their own bar" on public.bars;
drop policy if exists "People save their own bar" on public.bars;
drop policy if exists "People update their own bar" on public.bars;
create policy "People see their own bar" on public.bars for select to authenticated using (user_id = auth.uid());
create policy "People save their own bar" on public.bars for insert to authenticated with check (user_id = auth.uid());
create policy "People update their own bar" on public.bars for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Star ratings: one per person per drink. Everyone sees them; people change only their own.
create table if not exists public.ratings (
  drink_id text not null references public.drinks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (drink_id, user_id)
);
alter table public.ratings enable row level security;
drop policy if exists "Anyone can see ratings" on public.ratings;
drop policy if exists "People add their own rating" on public.ratings;
drop policy if exists "People change their own rating" on public.ratings;
drop policy if exists "People remove their own rating" on public.ratings;
create policy "Anyone can see ratings" on public.ratings for select using (true);
create policy "People add their own rating" on public.ratings for insert to authenticated with check (user_id = auth.uid());
create policy "People change their own rating" on public.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People remove their own rating" on public.ratings for delete to authenticated using (user_id = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.ratings;
exception when duplicate_object then null; end $$;

-- Scans and drink ideas share one daily allowance; record which was which.
create table if not exists public.recipe_scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.recipe_scans add column if not exists kind text not null default 'scan';
create index if not exists recipe_scans_user_time_idx on public.recipe_scans (user_id, created_at);
alter table public.recipe_scans enable row level security;
