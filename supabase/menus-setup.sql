-- My Cocktail Cart: saved menus from Decode a cocktail menu. Private: only their owner can see or change them.
-- Paste into the Supabase SQL Editor and run once. Safe to run again.

create table if not exists public.menus (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  bar text check (bar is null or char_length(bar) <= 80),
  drinks jsonb not null default '[]'::jsonb check (jsonb_typeof(drinks) = 'array' and pg_column_size(drinks) < 200000),
  created_at timestamptz not null default now()
);
create index if not exists menus_user_idx on public.menus (user_id, created_at desc);
alter table public.menus enable row level security;
drop policy if exists "People read their own menus" on public.menus;
drop policy if exists "People add their own menus" on public.menus;
drop policy if exists "People change their own menus" on public.menus;
drop policy if exists "People delete their own menus" on public.menus;
create policy "People read their own menus" on public.menus for select to authenticated using (user_id = auth.uid());
create policy "People add their own menus" on public.menus for insert to authenticated with check (user_id = auth.uid());
create policy "People change their own menus" on public.menus for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People delete their own menus" on public.menus for delete to authenticated using (user_id = auth.uid());
