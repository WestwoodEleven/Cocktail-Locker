-- Favorites: each person's own list of favorite drinks (theirs or anyone's).
-- Private: only the person who saved a favorite can see or change it.
-- Run once in Supabase (SQL Editor > New query > paste > Run). Safe to run again.
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  drink_id text not null references public.drinks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, drink_id)
);
alter table public.favorites enable row level security;
drop policy if exists "People see their own favorites" on public.favorites;
drop policy if exists "People add their own favorites" on public.favorites;
drop policy if exists "People remove their own favorites" on public.favorites;
create policy "People see their own favorites" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "People add their own favorites" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "People remove their own favorites" on public.favorites for delete to authenticated using (user_id = auth.uid());
