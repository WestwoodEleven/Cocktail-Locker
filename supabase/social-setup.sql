-- Lists, notes on ratings, and following. Run once in Supabase (SQL Editor > New query > paste > Run). Safe to run again.

-- Notes on ratings ("Too sweet, cut the syrup")
alter table public.ratings add column if not exists note text check (note is null or char_length(note) <= 280);

-- Lists (collections) of drinks. Public lists show on the owner's locker page; private ones only to the owner.
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
drop policy if exists "See public lists and your own" on public.collections;
drop policy if exists "Create your own lists" on public.collections;
drop policy if exists "Change your own lists" on public.collections;
drop policy if exists "Delete your own lists" on public.collections;
create policy "See public lists and your own" on public.collections for select using (is_public or owner = auth.uid());
create policy "Create your own lists" on public.collections for insert to authenticated with check (owner = auth.uid());
create policy "Change your own lists" on public.collections for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "Delete your own lists" on public.collections for delete to authenticated using (owner = auth.uid());

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  drink_id text not null,
  added_at timestamptz not null default now(),
  primary key (collection_id, drink_id)
);
alter table public.collection_items enable row level security;
drop policy if exists "See items in lists you can see" on public.collection_items;
drop policy if exists "Add to your own lists" on public.collection_items;
drop policy if exists "Remove from your own lists" on public.collection_items;
create policy "See items in lists you can see" on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.owner = auth.uid())));
create policy "Add to your own lists" on public.collection_items for insert to authenticated
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner = auth.uid()));
create policy "Remove from your own lists" on public.collection_items for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner = auth.uid()));

-- Following other lockers. Everyone can see follower counts; people manage only their own follows.
create table if not exists public.follows (
  follower uuid not null references auth.users (id) on delete cascade default auth.uid(),
  followee uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
drop policy if exists "Anyone can see follows" on public.follows;
drop policy if exists "Follow as yourself" on public.follows;
drop policy if exists "Unfollow as yourself" on public.follows;
create policy "Anyone can see follows" on public.follows for select using (true);
create policy "Follow as yourself" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "Unfollow as yourself" on public.follows for delete to authenticated using (follower = auth.uid());

-- When a drink is deleted, also take it out of lists (ratings and favorites were already handled).
create or replace function public.cleanup_drink_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ratings where drink_id = old.id;
  delete from public.favorites where drink_id = old.id;
  delete from public.collection_items where drink_id = old.id;
  return old;
end $$;
drop trigger if exists drinks_cleanup_refs on public.drinks;
create trigger drinks_cleanup_refs after delete on public.drinks
  for each row execute function public.cleanup_drink_refs();
