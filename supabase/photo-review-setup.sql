-- My Cocktail Cart: photos held for review.
-- New drink and bottle photos get a quick AI check. Ones that don't look like drinks (or look inappropriate)
-- wait here, hidden, until a site admin approves or rejects them.
-- Paste into the Supabase SQL Editor and run once. Safe to run again. Needs reports-setup.sql first.

create table if not exists public.photo_reviews (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('drink', 'bottle')),
  target text not null check (char_length(target) between 1 and 200),
  target_name text check (target_name is null or char_length(target_name) <= 120),
  path text not null check (char_length(path) <= 300),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
alter table public.photo_reviews enable row level security;
drop policy if exists "People hold their own photos" on public.photo_reviews;
drop policy if exists "People and admins see held photos" on public.photo_reviews;
drop policy if exists "People and admins clear held photos" on public.photo_reviews;
create policy "People hold their own photos" on public.photo_reviews for insert to authenticated
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%');
create policy "People and admins see held photos" on public.photo_reviews for select to authenticated
  using (user_id = auth.uid() or public.is_site_admin());
create policy "People and admins clear held photos" on public.photo_reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_site_admin());

-- Approving a held bottle photo adds it in the name of the person who took it.
drop policy if exists "Admins add approved bottle photos" on public.bottle_photos;
create policy "Admins add approved bottle photos" on public.bottle_photos for insert to authenticated
  with check (public.is_site_admin());
