-- My Cocktail Cart: shopping list. Private: only its owner can see or change it.
-- Paste into the Supabase SQL Editor and run once. Safe to run again.

create table if not exists public.shopping_list (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'other' check (kind in ('bottle', 'mixer', 'other')),
  reason text check (reason is null or char_length(reason) <= 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_list_user_idx on public.shopping_list (user_id, created_at);
alter table public.shopping_list enable row level security;
drop policy if exists "People read their own shopping list" on public.shopping_list;
drop policy if exists "People add to their own shopping list" on public.shopping_list;
drop policy if exists "People change their own shopping list" on public.shopping_list;
drop policy if exists "People delete from their own shopping list" on public.shopping_list;
create policy "People read their own shopping list" on public.shopping_list for select to authenticated using (user_id = auth.uid());
create policy "People add to their own shopping list" on public.shopping_list for insert to authenticated with check (user_id = auth.uid());
create policy "People change their own shopping list" on public.shopping_list for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People delete from their own shopping list" on public.shopping_list for delete to authenticated using (user_id = auth.uid());
