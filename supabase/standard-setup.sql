-- Standard recipes: a shared library of classic recipes looked up with Claude.
-- Everyone can read it; only the read-recipe function adds to it.
-- Run once in Supabase (SQL Editor > New query > paste > Run). Safe to run again.
create table if not exists public.standard_recipes (
  slug text primary key,
  name text not null,
  data jsonb not null,
  aliases text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.standard_recipes enable row level security;
drop policy if exists "Anyone can read standard recipes" on public.standard_recipes;
create policy "Anyone can read standard recipes" on public.standard_recipes for select using (true);
do $$ begin
  alter publication supabase_realtime add table public.standard_recipes;
exception when duplicate_object then null; end $$;

-- Let people rate and favorite standard recipes too (their ids start with "std:"),
-- and tidy up ratings and favorites when someone deletes one of their drinks.
alter table public.ratings drop constraint if exists ratings_drink_id_fkey;
alter table public.favorites drop constraint if exists favorites_drink_id_fkey;
create or replace function public.cleanup_drink_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ratings where drink_id = old.id;
  delete from public.favorites where drink_id = old.id;
  return old;
end $$;
drop trigger if exists drinks_cleanup_refs on public.drinks;
create trigger drinks_cleanup_refs after delete on public.drinks
  for each row execute function public.cleanup_drink_refs();
