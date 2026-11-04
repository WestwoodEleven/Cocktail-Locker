-- My Cocktail Cart: drink log ("I made this"). Private: only the person who wrote an entry can see or change it.
-- Paste into the Supabase SQL Editor and run once. Safe to run again.

create table if not exists public.drink_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  drink_id text not null check (char_length(drink_id) between 1 and 200),
  drink_name text check (drink_name is null or char_length(drink_name) <= 120),
  made_on date not null default current_date,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists drink_log_user_idx on public.drink_log (user_id, made_on desc);
alter table public.drink_log enable row level security;
drop policy if exists "People read their own log" on public.drink_log;
drop policy if exists "People add to their own log" on public.drink_log;
drop policy if exists "People edit their own log" on public.drink_log;
drop policy if exists "People delete from their own log" on public.drink_log;
create policy "People read their own log" on public.drink_log for select to authenticated using (user_id = auth.uid());
create policy "People add to their own log" on public.drink_log for insert to authenticated with check (user_id = auth.uid());
create policy "People edit their own log" on public.drink_log for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People delete from their own log" on public.drink_log for delete to authenticated using (user_id = auth.uid());
